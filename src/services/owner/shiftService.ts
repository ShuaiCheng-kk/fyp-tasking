// LAYER: Service
// RULE: Business logic only. No HTTP handling. No direct DB access.

import { shiftRepository } from '@/repositories/owner/shiftRepository'
import { attendanceRepository } from '@/repositories/owner/attendanceRepository'
import { BulkCreateShiftsPayload, BulkCreateShiftsResult, BulkEditShiftItem, BulkEditShiftsResult, BulkShiftAssignmentPayload, BulkShiftAssignmentResult, ClopeningConflict, DuplicateShiftInput, RecurringShiftInput, RecurringSplitShiftInput, Shift, ShiftInput, ShiftMutationResult, SplitShiftInput, SplitShiftResult } from '@/types/Shift'
import { TimelineRow, TimelineShiftBlock } from '@/types/Timeline'
import { ShiftActionRedoPayload, ShiftActionType } from '@/types/ShiftActionHistory'

const TIMELINE_ROLE_ORDER: Record<string, number> = {
  Manager: 1,
  Employee: 2,
  'Casual Worker': 3,
}
const MIN_REST_HOURS = 5

export const shiftService = {

  async createShift(input: ShiftInput & {
    assigned_user_id?: string | null
    supervisor_employee_id?: string | null
  }): Promise<ShiftMutationResult> {
    if (!input.company_id || !input.department_id || !input.shift_date || !input.start_time || !input.end_time || !input.created_by) {
      throw new Error('Missing required shift fields')
    }
    if (input.start_time >= input.end_time) {
      throw new Error('start_time must be before end_time')
    }
    const warning = input.assigned_user_id
      ? await detectClopeningConflict({
          user_id: input.assigned_user_id,
          shift_date: input.shift_date,
          start_time: input.start_time,
          end_time: input.end_time,
        })
      : null

    const shift = await shiftRepository.createShift(input)
    if (input.assigned_user_id) {
      await shiftRepository.createShiftAssignment({
        shift_id: shift.id,
        user_id: input.assigned_user_id,
        assigned_by: input.created_by,
        supervisor_employee_id: input.supervisor_employee_id ?? null,
      })
    }
    await recordCreateHistory('create', input.company_id, input.created_by, [shift])
    return { shift, warning }
  },

  async createSplitShift(input: SplitShiftInput): Promise<SplitShiftResult> {
    if (!input.company_id || !input.department_id || !input.shift_date || !input.created_by) {
      throw new Error('Missing required shift fields')
    }
    if (input.blocks.length !== 2) {
      throw new Error('A split shift must have exactly 2 time blocks')
    }
    for (const block of input.blocks) {
      if (!block.start_time || !block.end_time || block.start_time >= block.end_time) {
        throw new Error('Each block must have start_time before end_time')
      }
    }
    const sortedBlocks = [...input.blocks].sort((a, b) => a.start_time.localeCompare(b.start_time))
    const [first, second] = sortedBlocks
    if (second.start_time < first.end_time) {
      throw new Error('Split shift blocks must not overlap')
    }

    let warning: ClopeningConflict | null = null
    if (input.assigned_user_id) {
      for (const block of sortedBlocks) {
        const blockWarning = await detectClopeningConflict({
          user_id: input.assigned_user_id,
          shift_date: input.shift_date,
          start_time: block.start_time,
          end_time: block.end_time,
        })
        warning = warning ?? blockWarning
      }
    }

    const splitGroupId = crypto.randomUUID()
    const shifts: Shift[] = []
    for (const block of sortedBlocks) {
      const shift = await shiftRepository.createShift({
        company_id: input.company_id,
        department_id: input.department_id,
        title: input.title ?? null,
        instruction: input.instruction ?? null,
        shift_date: input.shift_date,
        start_time: block.start_time,
        end_time: block.end_time,
        created_by: input.created_by,
        publication_status: input.publication_status ?? 'draft',
        split_group_id: splitGroupId,
      })
      if (input.assigned_user_id) {
        await shiftRepository.createShiftAssignment({
          shift_id: shift.id,
          user_id: input.assigned_user_id,
          assigned_by: input.created_by,
          supervisor_employee_id: input.supervisor_employee_id ?? null,
        })
      }
      shifts.push(shift)
    }

    await recordCreateHistory('split', input.company_id, input.created_by, shifts)
    return { shifts, warning }
  },

  async editShift(
    id: string,
    fields: Partial<Omit<Shift, 'id' | 'company_id' | 'created_by' | 'created_at'>>,
    assignment?: {
      assigned_user_id: string | null
      assigned_by: string
      // undefined = caller did not specify a supervisor, so keep whatever the assignment
      // already has instead of clobbering it — callers like Bulk Edit have no supervisor
      // field in their UI and must not silently wipe it on an unrelated save.
      supervisor_employee_id?: string | null
    },
    performed_by?: string,
  ): Promise<ShiftMutationResult> {
    const existing = await shiftRepository.getShiftById(id)
    if (!existing) throw new Error('Shift not found')
    const effectiveShift = { ...existing, ...fields }
    if (effectiveShift.start_time >= effectiveShift.end_time) {
      throw new Error('start_time must be before end_time')
    }
    const assignedUserId = assignment?.assigned_user_id
    const warning = assignedUserId
      ? await detectClopeningConflict({
          user_id: assignedUserId,
          shift_date: effectiveShift.shift_date,
          start_time: effectiveShift.start_time,
          end_time: effectiveShift.end_time,
          exclude_shift_id: id,
          exclude_split_group_id: existing.split_group_id,
        })
      : null

    const previousAssignments = await shiftRepository.getAssignmentsByShiftIds([id])
    const previousUserId = previousAssignments[0]?.user_id ?? null
    const previousSupervisorId = previousAssignments[0]?.supervisor_employee_id ?? null
    const nextSupervisorId = assignment?.supervisor_employee_id !== undefined
      ? assignment.supervisor_employee_id
      : previousSupervisorId
    // Skip touching shift_assignments entirely when nothing about the assignment actually
    // changed (e.g. saving other shift fields with the assignee dropdown left as-is) — deleting
    // and recreating the row for a no-op reassignment would violate the FK from attendance_records
    // once attendance has been recorded against that assignment.
    const assignmentChanged = !!assignment && (
      assignment.assigned_user_id !== previousUserId ||
      nextSupervisorId !== previousSupervisorId
    )

    // Reassigning to someone who is already working that day would otherwise double-book them.
    // Swap instead: give the new assignee's existing same-day shift to whoever this shift is being taken from.
    let swapShiftId: string | null = null
    let swapPreviousAssignments: typeof previousAssignments = []
    if (assignedUserId && assignedUserId !== previousUserId) {
      const sameDayAssignments = await shiftRepository.getAssignmentsByUserAndDateRange(
        assignedUserId,
        effectiveShift.shift_date,
        effectiveShift.shift_date,
        id,
      )
      const conflicting = sameDayAssignments.find(a => a.shifts)
      if (conflicting) {
        if (!previousUserId) {
          throw new Error('CLOPENING_CONFLICT: This person already has a shift on that date.')
        }
        swapShiftId = conflicting.shift_id
        swapPreviousAssignments = await shiftRepository.getAssignmentsByShiftIds([swapShiftId])
      }
    }

    const shift = Object.keys(fields).length > 0
      ? await shiftRepository.updateShift(id, fields)
      : existing
    if (assignmentChanged) {
      await shiftRepository.deleteAssignmentsByShiftId(id)
      if (assignment!.assigned_user_id) {
        await shiftRepository.createShiftAssignment({
          shift_id: id,
          user_id: assignment!.assigned_user_id,
          assigned_by: assignment!.assigned_by,
          supervisor_employee_id: nextSupervisorId,
        })
      }
    }
    if (swapShiftId && previousUserId) {
      await shiftRepository.deleteAssignmentsByShiftId(swapShiftId)
      await shiftRepository.createShiftAssignment({
        shift_id: swapShiftId,
        user_id: previousUserId,
        assigned_by: assignment!.assigned_by,
        supervisor_employee_id: null,
      })
    }
    let cascaded: Shift[] = []
    let cascadedPrevious: Shift[] = []
    let cascadedPreviousAssignments: typeof previousAssignments = []
    const isRecurrenceOriginal = existing.recurrence_group_id && existing.source_shift_id === null
    const cascadeFields: Partial<Pick<Shift, 'shift_date' | 'start_time' | 'end_time' | 'department_id'>> = {}
    if (fields.start_time !== undefined) cascadeFields.start_time = fields.start_time
    if (fields.end_time !== undefined) cascadeFields.end_time = fields.end_time
    if (fields.department_id !== undefined) cascadeFields.department_id = fields.department_id
    const hasFieldCascade = Object.keys(cascadeFields).length > 0

    if (isRecurrenceOriginal && (hasFieldCascade || assignmentChanged)) {
      const siblings = (await shiftRepository.getShiftsByRecurrenceGroupId(existing.recurrence_group_id!))
        .filter(s => s.id !== id)

      for (const sibling of siblings) {
        let siblingChanged = false

        if (hasFieldCascade) {
          cascadedPrevious.push(sibling)
          cascaded.push(await shiftRepository.updateShift(sibling.id, cascadeFields))
          siblingChanged = true
        }

        if (assignmentChanged) {
          const siblingAssignments = await shiftRepository.getAssignmentsByShiftIds([sibling.id])
          if (assignment!.assigned_user_id) {
            const siblingDate = cascadeFields.shift_date ?? sibling.shift_date
            const siblingConflicts = await shiftRepository.getAssignmentsByUserAndDateRange(
              assignment!.assigned_user_id,
              siblingDate,
              siblingDate,
              sibling.id,
            )
            if (siblingConflicts.some(a => a.shifts)) continue
          }
          cascadedPreviousAssignments.push(...siblingAssignments)
          const siblingSupervisorId = assignment!.supervisor_employee_id !== undefined
            ? assignment!.supervisor_employee_id
            : (siblingAssignments[0]?.supervisor_employee_id ?? null)
          await shiftRepository.deleteAssignmentsByShiftId(sibling.id)
          if (assignment!.assigned_user_id) {
            await shiftRepository.createShiftAssignment({
              shift_id: sibling.id,
              user_id: assignment!.assigned_user_id,
              assigned_by: assignment!.assigned_by,
              supervisor_employee_id: siblingSupervisorId,
            })
          }
          siblingChanged = true
        }

        if (siblingChanged && !cascaded.some(s => s.id === sibling.id)) cascaded.push(sibling)
      }
    }

    if (performed_by) {
      const affected_shift_ids = [id, ...(swapShiftId ? [swapShiftId] : []), ...cascaded.map(s => s.id)]
      await shiftRepository.createActionHistory({
        company_id: existing.company_id,
        performed_by,
        action_type: 'edit',
        affected_shift_ids,
        undo_payload: {
          previous_shift: existing,
          previous_assignments: swapShiftId ? [...previousAssignments, ...swapPreviousAssignments] : previousAssignments,
          previous_cascaded_shifts: cascadedPrevious.length > 0 ? cascadedPrevious : undefined,
          previous_cascaded_assignments: cascadedPreviousAssignments.length > 0 ? cascadedPreviousAssignments : undefined,
        },
      })
    }
    return { shift, warning }
  },

  async bulkEditShifts(
    company_id: string,
    items: BulkEditShiftItem[],
    performed_by: string,
  ): Promise<BulkEditShiftsResult> {
    if (!company_id) throw new Error('company_id is required')
    if (!performed_by) throw new Error('performed_by is required')
    if (!Array.isArray(items) || items.length === 0) throw new Error('items must be a non-empty array')

    const updated: Shift[] = []
    const failed: { id: string; message: string }[] = []
    const previousShifts: Shift[] = []
    const affectedShiftIds: string[] = []

    for (const item of items) {
      try {
        const fields: Partial<Omit<Shift, 'id' | 'company_id' | 'created_by' | 'created_at'>> = {}
        if (item.shift_date !== undefined) fields.shift_date = item.shift_date
        if (item.start_time !== undefined) fields.start_time = item.start_time
        if (item.end_time !== undefined) fields.end_time = item.end_time
        if (item.department_id !== undefined) fields.department_id = item.department_id

        const existing = await shiftRepository.getShiftById(item.id)
        if (!existing) throw new Error('Shift not found')

        const result = await this.editShift(
          item.id,
          fields,
          item.assigned_user_id === undefined
            ? undefined
            // Bulk Edit has no supervisor field — omit supervisor_employee_id so editShift
            // preserves whatever the assignment already has instead of clearing it.
            : { assigned_user_id: item.assigned_user_id, assigned_by: performed_by },
        )
        updated.push(result.shift)
        previousShifts.push(existing)
        affectedShiftIds.push(item.id)
      } catch (err) {
        failed.push({ id: item.id, message: err instanceof Error ? err.message.replace('CLOPENING_CONFLICT: ', '') : 'Failed to update shift' })
      }
    }

    if (affectedShiftIds.length > 0) {
      await shiftRepository.createActionHistory({
        company_id,
        performed_by,
        action_type: 'bulk_edit',
        affected_shift_ids: affectedShiftIds,
        undo_payload: {
          previous_shifts: previousShifts,
        },
      })
    }

    return { updated, failed }
  },

  async publishSchedule(input: {
    company_id: string
    date_from: string
    date_to: string
    publication_status: 'draft' | 'published'
    performed_by?: string
    department_id?: string
  }): Promise<{ shifts: Shift[] }> {
    if (!input.company_id || !input.date_from || !input.date_to) {
      throw new Error('company_id, date_from, and date_to are required')
    }
    if (!['draft', 'published'].includes(input.publication_status)) {
      throw new Error('publication_status must be draft or published')
    }
    if (input.date_from > input.date_to) {
      throw new Error('date_from must be before date_to')
    }
    const beforeShifts = input.performed_by
      ? await shiftRepository.getShiftsByCompanyAndDateRange(input.company_id, input.date_from, input.date_to, input.department_id)
      : []
    const shifts = await shiftRepository.updateSchedulePublication(input)
    if (input.performed_by && beforeShifts.length > 0) {
      await shiftRepository.createActionHistory({
        company_id: input.company_id,
        performed_by: input.performed_by,
        action_type: 'publish',
        affected_shift_ids: beforeShifts.map(s => s.id),
        undo_payload: {
          previous_publication_statuses: beforeShifts.map(s => ({ id: s.id, publication_status: s.publication_status })),
        },
      })
    }
    return { shifts }
  },

  async duplicateShift(id: string, input: DuplicateShiftInput): Promise<ShiftMutationResult> {
    if (!id) throw new Error('Shift id is required')
    if (!input.shift_date || !input.start_time || !input.end_time || !input.created_by) {
      throw new Error('shift_date, start_time, end_time, and created_by are required')
    }
    if (input.start_time >= input.end_time) {
      throw new Error('start_time must be before end_time')
    }

    const original = await shiftRepository.getShiftById(id)
    if (!original) throw new Error('Shift not found')
    const originalAssignments = await shiftRepository.getAssignmentsByShiftIds([id])
    const assignedUserId = input.assigned_user_id ?? originalAssignments[0]?.user_id ?? null
    const warning = assignedUserId
      ? await detectClopeningConflict({
          user_id: assignedUserId,
          shift_date: input.shift_date,
          start_time: input.start_time,
          end_time: input.end_time,
        })
      : null

    const shift = await shiftRepository.createShift({
      company_id: original.company_id,
      department_id: original.department_id,
      title: original.title,
      instruction: original.instruction,
      shift_date: input.shift_date,
      start_time: input.start_time,
      end_time: input.end_time,
      created_by: input.created_by,
      publication_status: 'draft',
      template_id: input.template_id ?? null,
    })

    if (assignedUserId) {
      await shiftRepository.createShiftAssignment({
        shift_id: shift.id,
        user_id: assignedUserId,
        assigned_by: input.created_by,
        supervisor_employee_id: originalAssignments[0]?.supervisor_employee_id ?? null,
      })
    }

    await recordCreateHistory('duplicate', original.company_id, input.created_by, [shift])
    return { shift, warning }
  },

  async createRecurringShifts(id: string, input: RecurringShiftInput): Promise<Shift[]> {
    if (!id) throw new Error('Shift id is required')
    if (!input.created_by || !input.recurrence_end_date) {
      throw new Error('created_by and recurrence_end_date are required')
    }
    if (!['daily', 'weekly', 'custom'].includes(input.recurrence_rule)) {
      throw new Error('recurrence_rule must be daily, weekly, or custom')
    }

    const original = await shiftRepository.getShiftById(id)
    if (!original) throw new Error('Shift not found')
    if (original.source_shift_id !== null) {
      throw new Error('Only the original shift in a recurring series can have its recurrence edited')
    }
    if (input.recurrence_end_date <= original.shift_date) {
      throw new Error('recurrence_end_date must be after the shift date')
    }

    const intervalDays = input.recurrence_rule === 'daily'
      ? 1
      : input.recurrence_rule === 'weekly'
        ? 7
        : input.custom_interval_days ?? 1
    if (intervalDays < 1 || intervalDays > 31) {
      throw new Error('custom_interval_days must be between 1 and 31')
    }

    // Editing an already-recurring shift's settings (e.g. weekly -> daily) replaces its
    // previously generated future occurrences rather than layering new ones alongside them.
    if (original.recurrence_group_id) {
      const siblings = (await shiftRepository.getShiftsByRecurrenceGroupId(original.recurrence_group_id))
        .filter(s => s.id !== id)
      for (const sibling of siblings) {
        await shiftRepository.deleteAssignmentsByShiftId(sibling.id)
        await shiftRepository.deleteShift(sibling.id)
      }
    }

    const recurrenceGroupId = original.recurrence_group_id ?? crypto.randomUUID()
    const originalAssignments = await shiftRepository.getAssignmentsByShiftIds([id])
    const assignedUserId = input.assigned_user_id ?? originalAssignments[0]?.user_id ?? null
    const created: Shift[] = []

    await shiftRepository.updateShift(id, {
      recurrence_group_id: recurrenceGroupId,
      recurrence_rule: input.recurrence_rule,
    })

    let nextDate = addDaysToDateKey(original.shift_date, intervalDays)
    while (nextDate <= input.recurrence_end_date) {
      if (created.length >= 60) throw new Error('Recurring shift limit is 60 instances')
      const shift = await shiftRepository.createShift({
        company_id: original.company_id,
        department_id: original.department_id,
        title: original.title,
        instruction: original.instruction,
        shift_date: nextDate,
        start_time: original.start_time,
        end_time: original.end_time,
        created_by: input.created_by,
        publication_status: 'draft',
        recurrence_group_id: recurrenceGroupId,
        recurrence_rule: input.recurrence_rule,
        source_shift_id: original.id,
        template_id: original.template_id,
      })
      if (assignedUserId) {
        await shiftRepository.createShiftAssignment({
          shift_id: shift.id,
          user_id: assignedUserId,
          assigned_by: input.created_by,
          supervisor_employee_id: originalAssignments[0]?.supervisor_employee_id ?? null,
        })
      }
      created.push(shift)
      nextDate = addDaysToDateKey(nextDate, intervalDays)
    }

    await recordCreateHistory('recurrence', original.company_id, input.created_by, created)
    return created
  },

  async createRecurringSplitShifts(split_group_id: string, input: RecurringSplitShiftInput): Promise<Shift[]> {
    if (!split_group_id) throw new Error('split_group_id is required')
    if (!input.created_by || !input.recurrence_end_date) {
      throw new Error('created_by and recurrence_end_date are required')
    }
    if (!['daily', 'weekly', 'custom'].includes(input.recurrence_rule)) {
      throw new Error('recurrence_rule must be daily, weekly, or custom')
    }

    const originals = await shiftRepository.getShiftsBySplitGroupId(split_group_id)
    if (originals.length !== 2) throw new Error('Split shift pair not found')
    const [first, second] = originals
    if (input.recurrence_end_date <= first.shift_date) {
      throw new Error('recurrence_end_date must be after the shift date')
    }

    const intervalDays = input.recurrence_rule === 'daily'
      ? 1
      : input.recurrence_rule === 'weekly'
        ? 7
        : input.custom_interval_days ?? 1
    if (intervalDays < 1 || intervalDays > 31) {
      throw new Error('custom_interval_days must be between 1 and 31')
    }

    const firstRecurrenceGroupId = first.recurrence_group_id ?? crypto.randomUUID()
    const secondRecurrenceGroupId = second.recurrence_group_id ?? crypto.randomUUID()
    const originalAssignments = await shiftRepository.getAssignmentsByShiftIds([first.id, second.id])
    const assignedUserId = input.assigned_user_id ?? originalAssignments[0]?.user_id ?? null
    const supervisorEmployeeId = originalAssignments[0]?.supervisor_employee_id ?? null
    const created: Shift[] = []

    await shiftRepository.updateShift(first.id, { recurrence_group_id: firstRecurrenceGroupId, recurrence_rule: input.recurrence_rule })
    await shiftRepository.updateShift(second.id, { recurrence_group_id: secondRecurrenceGroupId, recurrence_rule: input.recurrence_rule })

    let nextDate = addDaysToDateKey(first.shift_date, intervalDays)
    while (nextDate <= input.recurrence_end_date) {
      if (created.length >= 120) throw new Error('Recurring shift limit is 60 instances')
      const nextSplitGroupId = crypto.randomUUID()
      for (const [block, recurrenceGroupId] of [[first, firstRecurrenceGroupId], [second, secondRecurrenceGroupId]] as const) {
        const shift = await shiftRepository.createShift({
          company_id: block.company_id,
          department_id: block.department_id,
          title: block.title,
          instruction: block.instruction,
          shift_date: nextDate,
          start_time: block.start_time,
          end_time: block.end_time,
          created_by: input.created_by,
          publication_status: 'draft',
          recurrence_group_id: recurrenceGroupId,
          recurrence_rule: input.recurrence_rule,
          source_shift_id: block.id,
          split_group_id: nextSplitGroupId,
          template_id: block.template_id,
        })
        if (assignedUserId) {
          await shiftRepository.createShiftAssignment({
            shift_id: shift.id,
            user_id: assignedUserId,
            assigned_by: input.created_by,
            supervisor_employee_id: supervisorEmployeeId,
          })
        }
        created.push(shift)
      }
      nextDate = addDaysToDateKey(nextDate, intervalDays)
    }

    await recordCreateHistory('recurrence', first.company_id, input.created_by, created)
    return created
  },

  async deleteShift(id: string, performed_by?: string): Promise<{ skipped_shifts: Shift[] }> {
    const shift = await shiftRepository.getShiftById(id)
    if (!shift) throw new Error('Shift not found')

    const isRecurrenceOriginal = shift.recurrence_group_id && shift.source_shift_id === null
    const siblings = isRecurrenceOriginal
      ? (await shiftRepository.getShiftsByRecurrenceGroupId(shift.recurrence_group_id!)).filter(s => s.id !== id)
      : []
    const candidates = [shift, ...siblings]

    // Pre-check attendance per candidate instead of reacting to the FK violation mid-loop —
    // a recurring series' cascade must not abort (and half-delete) just because ONE occurrence
    // already has attendance recorded; that occurrence is skipped/kept, the rest still delete.
    const candidateAssignments = await shiftRepository.getAssignmentsByShiftIds(candidates.map(s => s.id))
    const attendanceRecords = await attendanceRepository.getAttendanceRecordsByAssignmentIds(candidateAssignments.map(a => a.id))
    const attendedAssignmentIds = new Set(attendanceRecords.map(r => r.shift_assignment_id))
    const attendedShiftIds = new Set(
      candidateAssignments.filter(a => attendedAssignmentIds.has(a.id)).map(a => a.shift_id),
    )

    const shiftsToDelete = candidates.filter(s => !attendedShiftIds.has(s.id))
    const skippedShifts = candidates.filter(s => attendedShiftIds.has(s.id))

    if (shiftsToDelete.length === 0) {
      throw new Error(candidates.length > 1
        ? 'Cannot delete this series — every occurrence already has attendance recorded against it.'
        : 'Cannot delete this shift — attendance has already been recorded against it.')
    }

    const assignments = candidateAssignments.filter(a => shiftsToDelete.some(s => s.id === a.shift_id))
    for (const s of shiftsToDelete) {
      await shiftRepository.deleteAssignmentsByShiftId(s.id, 'delete')
      await shiftRepository.deleteShift(s.id)
    }
    if (performed_by) {
      await shiftRepository.createActionHistory({
        company_id: shift.company_id,
        performed_by,
        action_type: 'delete',
        affected_shift_ids: shiftsToDelete.map(s => s.id),
        undo_payload: {
          deleted_shifts: shiftsToDelete,
          deleted_assignments: assignments,
        },
      })
    }
    return { skipped_shifts: skippedShifts }
  },

  async deleteShiftAssignment(assignment_id: string): Promise<void> {
    if (!assignment_id) throw new Error('assignment_id is required')
    const assignment = await shiftRepository.getAssignmentById(assignment_id)
    if (!assignment) throw new Error('Shift assignment not found')
    await shiftRepository.deleteAssignmentById(assignment_id)
  },

  async assignShiftsInBulk(payload: BulkShiftAssignmentPayload): Promise<BulkShiftAssignmentResult> {
    const { company_id, department_id, created_by, assignments } = payload
    const created: Shift[] = []
    const failed: BulkShiftAssignmentResult['failed'] = []
    const warnings: BulkShiftAssignmentResult['warnings'] = []

    for (const item of assignments) {
      if (!item.user_id || !item.shift_date || !item.start_time || !item.end_time) {
        failed.push({ ...item, message: 'Missing required fields' })
        continue
      }
      if (item.start_time >= item.end_time) {
        failed.push({ ...item, message: 'start_time must be before end_time' })
        continue
      }
      try {
        const warning = await detectClopeningConflict({
          user_id: item.user_id,
          shift_date: item.shift_date,
          start_time: item.start_time,
          end_time: item.end_time,
        })
        if (warning) {
          warnings.push({ ...item, message: warning.message })
        }
        const shift = await shiftRepository.createShift({
          company_id,
          department_id,
          shift_date: item.shift_date,
          start_time: item.start_time,
          end_time: item.end_time,
          created_by,
          publication_status: 'draft',
          template_id: item.template_id ?? null,
        })
        await shiftRepository.createShiftAssignment({
          shift_id: shift.id,
          user_id: item.user_id,
          assigned_by: created_by,
          supervisor_employee_id: item.supervisor_employee_id ?? null,
        })
        created.push(shift)
      } catch (err) {
        failed.push({ ...item, message: err instanceof Error ? err.message : 'Failed to assign shift' })
      }
    }

    if (created.length > 0) {
      await recordCreateHistory('bulk', company_id, created_by, created)
    }
    return { created, failed, warnings }
  },

  async createShiftsInBulk(payload: BulkCreateShiftsPayload): Promise<BulkCreateShiftsResult> {
    const { company_id, created_by, items } = payload
    const created: Shift[] = []
    const failed: BulkCreateShiftsResult['failed'] = []

    for (const item of items) {
      if (!item.department_id || !item.shift_date || !item.start_time || !item.end_time) {
        failed.push({ shift_date: item.shift_date, start_time: item.start_time, end_time: item.end_time, message: 'Missing required fields' })
        continue
      }
      if (item.start_time >= item.end_time) {
        failed.push({ shift_date: item.shift_date, start_time: item.start_time, end_time: item.end_time, message: 'start_time must be before end_time' })
        continue
      }
      try {
        const shift = await shiftRepository.createShift({
          company_id,
          department_id: item.department_id,
          title: item.title ?? null,
          instruction: item.instruction ?? null,
          shift_date: item.shift_date,
          start_time: item.start_time,
          end_time: item.end_time,
          created_by,
          publication_status: 'draft',
          template_id: item.template_id ?? null,
        })
        if (item.assigned_user_id) {
          await shiftRepository.createShiftAssignment({
            shift_id: shift.id,
            user_id: item.assigned_user_id,
            assigned_by: created_by,
            supervisor_employee_id: null,
          })
        }
        created.push(shift)
      } catch (err) {
        failed.push({ shift_date: item.shift_date, start_time: item.start_time, end_time: item.end_time, message: err instanceof Error ? err.message : 'Failed to create shift' })
      }
    }

    if (created.length > 0) {
      await recordCreateHistory('bulk', company_id, created_by, created)
    }
    return { created, failed }
  },

  async getTimelineShifts(
    company_id: string,
    date_from: string,
    date_to: string,
    viewer?: { role?: string; user_id?: string },
  ): Promise<TimelineRow[]> {
    const [allShifts, members] = await Promise.all([
      shiftRepository.getShiftsByCompanyAndDateRange(company_id, date_from, date_to),
      shiftRepository.getCompanyMembers(company_id),
    ])

    const shifts = filterShiftsForViewer(allShifts, viewer)

    const shiftIds = shifts.map(shift => shift.id)
    const assignments = await shiftRepository.getAssignmentsByShiftIds(shiftIds)

    const deptIds = [
      ...new Set([
        ...shifts.map(shift => shift.department_id),
        ...members.map(member => member.department_id).filter((id): id is string => Boolean(id)),
      ]),
    ]
    const assigneeIds = [...new Set(assignments.map(assignment => assignment.user_id))]

    const [departments, assignedUsers] = await Promise.all([
      shiftRepository.getDepartmentsByIds(deptIds),
      shiftRepository.getUsersByIds(assigneeIds),
    ])

    const deptMap = new Map(departments.map(d => [d.id, d.name]))
    const memberMap = new Map(
      [...members, ...assignedUsers].map(member => [member.id, member]),
    )
    const shiftMap = new Map(shifts.map(shift => [shift.id, shift]))

    const rowMap = new Map<string, TimelineRow>()

    for (const member of members) {
      if (!['Manager', 'Employee', 'Casual Worker'].includes(member.role)) continue
      const departmentId = member.department_id ?? 'unassigned'
      // Skip members whose department has been deleted
      if (departmentId !== 'unassigned' && !deptMap.has(departmentId)) continue
      rowMap.set(member.id, {
        user_id: member.id,
        full_name: member.full_name,
        role: member.role,
        department_id: departmentId,
        department_name: departmentId === 'unassigned' ? 'Unassigned' : deptMap.get(departmentId) ?? 'Unknown department',
        profile_photo_url: (member as any).profile_photo_url ?? null,
        shifts: [],
      })
    }

    const assignedShiftIds = new Set<string>()
    for (const assignment of assignments) {
      const shift = shiftMap.get(assignment.shift_id)
      const user = memberMap.get(assignment.user_id)
      if (!shift || !user) continue
      assignedShiftIds.add(shift.id)

      if (!rowMap.has(user.id)) {
        const departmentId = (user as any).department_id ?? shift.department_id
        // Skip if the department no longer exists
        if (departmentId && !deptMap.has(departmentId)) continue
        rowMap.set(user.id, {
          user_id: user.id,
          full_name: user.full_name,
          role: user.role,
          department_id: departmentId,
          department_name: deptMap.get(departmentId) ?? 'Unknown department',
          profile_photo_url: (user as any).profile_photo_url ?? null,
          shifts: [],
        })
      }

      rowMap.get(user.id)!.shifts.push(toTimelineShiftBlock(
        shift,
        deptMap.get(shift.department_id) ?? 'Unknown department',
        assignment.id,
        assignment.assignment_status,
        assignment.supervisor_employee_id,
      ))
    }

    for (const shift of shifts) {
      if (assignedShiftIds.has(shift.id)) continue
      // Skip shifts belonging to a deleted department
      if (!deptMap.has(shift.department_id)) continue
      const key = `dept_${shift.department_id}`
      if (!rowMap.has(key)) {
        rowMap.set(key, {
          user_id: null,
          full_name: 'Open Shift',
          role: 'Unassigned',
          department_id: shift.department_id,
          department_name: deptMap.get(shift.department_id) ?? 'Unknown department',
          profile_photo_url: null,
          shifts: [],
        })
      }
      rowMap.get(key)!.shifts.push(toTimelineShiftBlock(
        shift,
        deptMap.get(shift.department_id) ?? 'Unknown department',
        null,
        null,
      ))
    }

    let rows = Array.from(rowMap.values())

    // Employee's Shifts page (read-only) shows the whole department's shift schedule — same
    // scope as Manager gets — so an Employee can see who else is on that day, not just
    // themselves. Attendance-record detail (clock in/out times, via arRecordsForCell in
    // ShiftsView) stays restricted to the Employee's own row plus any Casual Worker they
    // currently supervise; that privacy gating happens client-side since it's a display concern,
    // not a data-scope one — the shift schedule itself is fine to share within the department.
    if (viewer?.role === 'Employee' && viewer.user_id) {
      const viewerDeptId = members.find(m => m.id === viewer.user_id)?.department_id ?? null
      rows = rows.filter(row => row.department_id === viewerDeptId)
    }

    return rows
      .map(row => ({
        ...row,
        shifts: row.shifts.sort((a, b) => a.start_time.localeCompare(b.start_time)),
      }))
      .sort((a, b) => {
        const deptCompare = a.department_name.localeCompare(b.department_name)
        if (deptCompare !== 0) return deptCompare
        const roleCompare = (TIMELINE_ROLE_ORDER[a.role] ?? 99) - (TIMELINE_ROLE_ORDER[b.role] ?? 99)
        if (roleCompare !== 0) return roleCompare
        return a.full_name.localeCompare(b.full_name)
      })
  },

  async undoLastShiftAction(company_id: string, performed_by: string): Promise<{ action_type: ShiftActionType }> {
    if (!company_id || !performed_by) throw new Error('company_id and performed_by are required')
    const action = await shiftRepository.getLatestUndoableAction(company_id, performed_by)
    if (!action) throw new Error('No recent shift action to undo')

    const redo_payload: ShiftActionRedoPayload = {}

    if (action.action_type === 'edit') {
      const previousShift = action.undo_payload.previous_shift as Shift | undefined
      const previousCascadedShifts = action.undo_payload.previous_cascaded_shifts ?? []
      const shiftsToRestore = previousShift ? [previousShift, ...previousCascadedShifts] : previousCascadedShifts
      if (shiftsToRestore.length > 0) {
        const currentShifts = await shiftRepository.getShiftsByIds(shiftsToRestore.map(s => s.id))
        if (previousShift) {
          const currentMain = currentShifts.find(s => s.id === previousShift.id)
          if (currentMain) redo_payload.next_shift = currentMain
        }
        const currentCascaded = currentShifts.filter(s => previousCascadedShifts.some(sibling => sibling.id === s.id))
        if (currentCascaded.length > 0) redo_payload.next_cascaded_shifts = currentCascaded
        await shiftRepository.upsertShifts(shiftsToRestore)
      }
      const currentAssignments = await shiftRepository.getAssignmentsByShiftIds(action.affected_shift_ids)
      if (currentAssignments.length > 0) redo_payload.next_assignments = currentAssignments
      const previousAssignments = [
        ...(action.undo_payload.previous_assignments ?? []),
        ...(action.undo_payload.previous_cascaded_assignments ?? []),
      ]
      await shiftRepository.deleteAssignmentsByShiftIds(action.affected_shift_ids)
      await shiftRepository.restoreShiftAssignments(previousAssignments.filter(a => action.affected_shift_ids.includes(a.shift_id)))
    } else if (action.action_type === 'delete') {
      const deletedShifts = action.undo_payload.deleted_shifts ?? []
      await shiftRepository.restoreShifts(deletedShifts)
      const deletedAssignments = action.undo_payload.deleted_assignments ?? []
      await shiftRepository.restoreShiftAssignments(deletedAssignments)
    } else if (action.action_type === 'bulk_edit') {
      const previousShifts = action.undo_payload.previous_shifts ?? []
      if (previousShifts.length > 0) {
        const currentShifts = await shiftRepository.getShiftsByIds(previousShifts.map(s => s.id))
        if (currentShifts.length > 0) redo_payload.next_shifts = currentShifts
        await shiftRepository.upsertShifts(previousShifts)
      }
    } else if (action.action_type === 'publish') {
      const previousStatuses = action.undo_payload.previous_publication_statuses ?? []
      if (previousStatuses.length > 0) {
        const currentShifts = await shiftRepository.getShiftsByIds(previousStatuses.map(s => s.id))
        if (currentShifts.length > 0) {
          redo_payload.next_publication_statuses = currentShifts.map(s => ({ id: s.id, publication_status: s.publication_status }))
        }
        const draftIds = previousStatuses.filter(s => s.publication_status === 'draft').map(s => s.id)
        const publishedIds = previousStatuses.filter(s => s.publication_status === 'published').map(s => s.id)
        await Promise.all([
          shiftRepository.updatePublicationStatusByIds(draftIds, 'draft'),
          shiftRepository.updatePublicationStatusByIds(publishedIds, 'published'),
        ])
      }
    } else {
      const recreateShifts = await shiftRepository.getShiftsByIds(action.affected_shift_ids)
      const recreateAssignments = await shiftRepository.getAssignmentsByShiftIds(action.affected_shift_ids)
      if (recreateShifts.length > 0) redo_payload.recreate_shifts = recreateShifts
      if (recreateAssignments.length > 0) redo_payload.recreate_assignments = recreateAssignments
      await shiftRepository.deleteAssignmentsByShiftIds(action.affected_shift_ids, 'delete')
      await shiftRepository.deleteShiftsByIds(action.affected_shift_ids)
    }

    await shiftRepository.markActionUndone(action.id, redo_payload)
    return { action_type: action.action_type }
  },

  async redoLastUndoneAction(company_id: string, performed_by: string): Promise<{ action_type: ShiftActionType }> {
    if (!company_id || !performed_by) throw new Error('company_id and performed_by are required')
    const action = await shiftRepository.getLatestRedoableAction(company_id, performed_by)
    if (!action) throw new Error('No recently undone action to redo')

    const redo_payload = action.redo_payload ?? {}

    if (action.action_type === 'edit') {
      const nextShift = redo_payload.next_shift
      const nextCascadedShifts = redo_payload.next_cascaded_shifts ?? []
      const shiftsToApply = nextShift ? [nextShift, ...nextCascadedShifts] : nextCascadedShifts
      if (shiftsToApply.length > 0) await shiftRepository.upsertShifts(shiftsToApply)
      await shiftRepository.deleteAssignmentsByShiftIds(action.affected_shift_ids)
      const nextAssignments = redo_payload.next_assignments ?? []
      await shiftRepository.restoreShiftAssignments(nextAssignments.filter(a => action.affected_shift_ids.includes(a.shift_id)))
    } else if (action.action_type === 'delete') {
      await shiftRepository.deleteAssignmentsByShiftIds(action.affected_shift_ids, 'delete')
      await shiftRepository.deleteShiftsByIds(action.affected_shift_ids)
    } else if (action.action_type === 'bulk_edit') {
      const nextShifts = redo_payload.next_shifts ?? []
      if (nextShifts.length > 0) await shiftRepository.upsertShifts(nextShifts)
    } else if (action.action_type === 'publish') {
      const nextStatuses = redo_payload.next_publication_statuses ?? []
      const draftIds = nextStatuses.filter(s => s.publication_status === 'draft').map(s => s.id)
      const publishedIds = nextStatuses.filter(s => s.publication_status === 'published').map(s => s.id)
      await Promise.all([
        shiftRepository.updatePublicationStatusByIds(draftIds, 'draft'),
        shiftRepository.updatePublicationStatusByIds(publishedIds, 'published'),
      ])
    } else {
      const recreateShifts = redo_payload.recreate_shifts ?? []
      await shiftRepository.restoreShifts(recreateShifts)
      await shiftRepository.restoreShiftAssignments(redo_payload.recreate_assignments ?? [])
    }

    await shiftRepository.markActionRedone(action.id)
    return { action_type: action.action_type }
  },

}

async function recordCreateHistory(
  action_type: ShiftActionType,
  company_id: string,
  performed_by: string,
  shifts: Shift[],
): Promise<void> {
  await shiftRepository.createActionHistory({
    company_id,
    performed_by,
    action_type,
    affected_shift_ids: shifts.map(s => s.id),
    undo_payload: {
      created_shift_ids: shifts.map(s => s.id),
    },
  })
}

function toTimelineShiftBlock(
  shift: Shift,
  department_name: string,
  assignment_id: string | null,
  assignment_status: string | null,
  supervisor_employee_id: string | null = null,
): TimelineShiftBlock {
  return {
    id: shift.id,
    assignment_id,
    shift_date: shift.shift_date,
    start_time: shift.start_time,
    end_time: shift.end_time,
    title: shift.title,
    instruction: shift.instruction,
    department_id: shift.department_id,
    department_name,
    status: shift.status,
    publication_status: shift.publication_status,
    recurrence_group_id: shift.recurrence_group_id,
    recurrence_rule: shift.recurrence_rule,
    source_shift_id: shift.source_shift_id,
    split_group_id: shift.split_group_id,
    assignment_status,
    template_id: shift.template_id,
    supervisor_employee_id,
  }
}

function filterShiftsForViewer(shifts: Shift[], viewer?: { role?: string; user_id?: string }): Shift[] {
  if (!viewer?.role || viewer.role === 'Owner' || viewer.role === 'Partner') return shifts
  return shifts.filter(shift => shift.publication_status === 'published')
}

function addDaysToDateKey(dateKey: string, days: number): string {
  const date = new Date(`${dateKey}T00:00:00`)
  date.setDate(date.getDate() + days)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

async function detectClopeningConflict(input: {
  user_id: string
  shift_date: string
  start_time: string
  end_time: string
  exclude_shift_id?: string
  exclude_split_group_id?: string | null
}): Promise<ClopeningConflict | null> {
  const from = addDaysToDateKey(input.shift_date, -1)
  const to = addDaysToDateKey(input.shift_date, 1)
  const assigned = await shiftRepository.getAssignmentsByUserAndDateRange(
    input.user_id,
    from,
    to,
    input.exclude_shift_id,
  )
  const newStart = new Date(`${input.shift_date}T${input.start_time}`).getTime()
  const newEnd = new Date(`${input.shift_date}T${input.end_time}`).getTime()

  for (const assignment of assigned) {
    const shift = assignment.shifts
    if (!shift) continue
    // The other half of the same split shift is meant to sit right next to this one — not a real clopening risk.
    if (input.exclude_split_group_id && shift.split_group_id === input.exclude_split_group_id) continue
    const existingStart = new Date(`${shift.shift_date}T${shift.start_time}`).getTime()
    const existingEnd = new Date(`${shift.shift_date}T${shift.end_time}`).getTime()
    let restMs: number | null = null
    if (existingEnd <= newStart) restMs = newStart - existingEnd
    if (newEnd <= existingStart) restMs = existingStart - newEnd
    if (restMs === null) continue
    const restHours = Math.round((restMs / 3_600_000) * 10) / 10
    if (restHours < MIN_REST_HOURS) {
      return {
        conflicting_shift_id: shift.id,
        conflicting_shift_date: shift.shift_date,
        conflicting_start_time: shift.start_time,
        conflicting_end_time: shift.end_time,
        rest_hours: restHours,
        message: `Clopening warning: only ${restHours} hours of rest before/after another shift.`,
      }
    }
  }

  return null
}

