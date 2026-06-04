// LAYER: Service
// RULE: Business logic only. No HTTP handling. No direct DB access.

import { shiftRepository } from '@/repositories/owner/shiftRepository'
import { ClopeningConflict, DuplicateShiftInput, RecurringShiftInput, Shift, ShiftInput, ShiftMutationResult, ShiftSnapshot } from '@/types/Shift'
import { TimelineRow, TimelineShiftBlock } from '@/types/Timeline'

const TIMELINE_ROLE_ORDER: Record<string, number> = {
  Manager: 1,
  Employee: 2,
  'Casual Worker': 3,
}
const MIN_REST_HOURS = 10

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
    if (
      input.acceptance_deadline_at &&
      new Date(input.acceptance_deadline_at).getTime() > new Date(`${input.shift_date}T${input.start_time}`).getTime()
    ) {
      throw new Error('acceptance_deadline_at must be before the shift starts')
    }
    const warning = input.assigned_user_id
      ? await detectClopeningConflict({
          user_id: input.assigned_user_id,
          shift_date: input.shift_date,
          start_time: input.start_time,
          end_time: input.end_time,
        })
      : null
    if (warning && !input.override_clopening) throw new Error(`CLOPENING_CONFLICT: ${warning.message}`)

    const shift = await shiftRepository.createShift(input)
    if (input.assigned_user_id) {
      await shiftRepository.createShiftAssignment({
        shift_id: shift.id,
        user_id: input.assigned_user_id,
        assigned_by: input.created_by,
        supervisor_employee_id: input.supervisor_employee_id ?? null,
      })
    }
    const after = await getShiftSnapshot(shift.id)
    await shiftRepository.createShiftActionHistory({
      company_id: shift.company_id,
      actor_id: input.created_by,
      action_type: 'create',
      shift_id: shift.id,
      before_data: null,
      after_data: after,
    })
    return { shift, warning }
  },

  async editShift(
    id: string,
    fields: Partial<Omit<Shift, 'id' | 'company_id' | 'created_by' | 'created_at'>> & { override_clopening?: boolean },
    assignment?: {
      assigned_user_id: string | null
      assigned_by: string
      supervisor_employee_id: string | null
    },
  ): Promise<ShiftMutationResult> {
    const existing = await shiftRepository.getShiftById(id)
    if (!existing) throw new Error('Shift not found')
    const before = await getShiftSnapshot(id)
    const effectiveShift = { ...existing, ...fields }
    if (effectiveShift.start_time >= effectiveShift.end_time) {
      throw new Error('start_time must be before end_time')
    }
    if (
      effectiveShift.acceptance_deadline_at &&
      new Date(effectiveShift.acceptance_deadline_at).getTime() >
        new Date(`${effectiveShift.shift_date}T${effectiveShift.start_time}`).getTime()
    ) {
      throw new Error('acceptance_deadline_at must be before the shift starts')
    }
    const assignedUserId = assignment?.assigned_user_id
    const warning = assignedUserId
      ? await detectClopeningConflict({
          user_id: assignedUserId,
          shift_date: effectiveShift.shift_date,
          start_time: effectiveShift.start_time,
          end_time: effectiveShift.end_time,
          exclude_shift_id: id,
        })
      : null
    if (warning && !fields.override_clopening) throw new Error(`CLOPENING_CONFLICT: ${warning.message}`)

    const { override_clopening, ...persistedFields } = fields
    void override_clopening
    const shift = Object.keys(persistedFields).length > 0
      ? await shiftRepository.updateShift(id, persistedFields)
      : existing
    if (assignment) {
      await shiftRepository.deleteAssignmentsByShiftId(id)
      if (assignment.assigned_user_id) {
        await shiftRepository.createShiftAssignment({
          shift_id: id,
          user_id: assignment.assigned_user_id,
          assigned_by: assignment.assigned_by,
          supervisor_employee_id: assignment.supervisor_employee_id,
        })
      }
    }
    const after = await getShiftSnapshot(id)
    await shiftRepository.createShiftActionHistory({
      company_id: shift.company_id,
      actor_id: assignment?.assigned_by ?? shift.created_by,
      action_type: 'edit',
      shift_id: shift.id,
      before_data: before,
      after_data: after,
    })
    return { shift, warning }
  },

  async publishSchedule(input: {
    company_id: string
    date_from: string
    date_to: string
    publication_status: 'draft' | 'published'
  }): Promise<Shift[]> {
    if (!input.company_id || !input.date_from || !input.date_to) {
      throw new Error('company_id, date_from, and date_to are required')
    }
    if (!['draft', 'published'].includes(input.publication_status)) {
      throw new Error('publication_status must be draft or published')
    }
    if (input.date_from > input.date_to) {
      throw new Error('date_from must be before date_to')
    }
    return shiftRepository.updateSchedulePublication(input)
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
    if (warning && !input.override_clopening) throw new Error(`CLOPENING_CONFLICT: ${warning.message}`)
    const duplicateStartAt = new Date(`${input.shift_date}T${input.start_time}`).getTime()
    const acceptanceDeadlineAt = original.acceptance_deadline_at &&
      new Date(original.acceptance_deadline_at).getTime() <= duplicateStartAt
      ? original.acceptance_deadline_at
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
      acceptance_deadline_at: acceptanceDeadlineAt,
      recurrence_group_id: original.recurrence_group_id,
      recurrence_rule: original.recurrence_rule,
      source_shift_id: original.id,
    })

    if (assignedUserId) {
      await shiftRepository.createShiftAssignment({
        shift_id: shift.id,
        user_id: assignedUserId,
        assigned_by: input.created_by,
        supervisor_employee_id: originalAssignments[0]?.supervisor_employee_id ?? null,
      })
    }

    const after = await getShiftSnapshot(shift.id)
    await shiftRepository.createShiftActionHistory({
      company_id: shift.company_id,
      actor_id: input.created_by,
      action_type: 'create',
      shift_id: shift.id,
      before_data: null,
      after_data: after,
    })
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
        acceptance_deadline_at: original.acceptance_deadline_at,
        recurrence_group_id: recurrenceGroupId,
        recurrence_rule: input.recurrence_rule,
        source_shift_id: original.id,
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

    return created
  },

  async deleteShift(id: string, actor_id?: string): Promise<void> {
    const before = await getShiftSnapshot(id)
    if (!before) throw new Error('Shift not found')
    await shiftRepository.deleteAssignmentsByShiftId(id)
    await shiftRepository.deleteShift(id)
    await shiftRepository.createShiftActionHistory({
      company_id: before.shift.company_id,
      actor_id: actor_id ?? before.shift.created_by,
      action_type: 'delete',
      shift_id: before.shift.id,
      before_data: before,
      after_data: null,
    })
  },

  async undoLastShiftAction(company_id: string, actor_id: string): Promise<void> {
    if (!company_id || !actor_id) throw new Error('company_id and actor_id are required')
    const action = await shiftRepository.getLastUndoableShiftAction(company_id, actor_id)
    if (!action) throw new Error('No shift action to undo')

    if (action.action_type === 'create') {
      await shiftRepository.deleteAssignmentsByShiftId(action.shift_id)
      await shiftRepository.deleteShift(action.shift_id)
    } else if (action.action_type === 'edit') {
      if (!action.before_data) throw new Error('Undo data is missing')
      await shiftRepository.updateShift(action.shift_id, toShiftUpdateFields(action.before_data.shift))
      await shiftRepository.deleteAssignmentsByShiftId(action.shift_id)
      await shiftRepository.restoreShiftAssignments(action.before_data.assignments)
    } else if (action.action_type === 'delete') {
      if (!action.before_data) throw new Error('Undo data is missing')
      await shiftRepository.restoreShift(action.before_data.shift)
      await shiftRepository.restoreShiftAssignments(action.before_data.assignments)
    }

    await shiftRepository.markShiftActionUndone(action.id)
  },

  async getTimelineShifts(
    company_id: string,
    date_from: string,
    date_to: string,
  ): Promise<TimelineRow[]> {
    const [shifts, members] = await Promise.all([
      shiftRepository.getShiftsByCompanyAndDateRange(company_id, date_from, date_to),
      shiftRepository.getCompanyMembers(company_id),
    ])

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
      rowMap.set(member.id, {
        user_id: member.id,
        full_name: member.full_name,
        role: member.role,
        department_id: departmentId,
        department_name: departmentId === 'unassigned' ? 'Unassigned' : deptMap.get(departmentId) ?? 'Unknown department',
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
        const departmentId = user.department_id ?? shift.department_id
        rowMap.set(user.id, {
          user_id: user.id,
          full_name: user.full_name,
          role: user.role,
          department_id: departmentId,
          department_name: deptMap.get(departmentId) ?? 'Unknown department',
          shifts: [],
        })
      }

      rowMap.get(user.id)!.shifts.push(toTimelineShiftBlock(
        shift,
        deptMap.get(shift.department_id) ?? 'Unknown department',
        assignment.id,
        assignment.assignment_status,
      ))
    }

    for (const shift of shifts) {
      if (assignedShiftIds.has(shift.id)) continue
      const key = `dept_${shift.department_id}`
      if (!rowMap.has(key)) {
        rowMap.set(key, {
          user_id: null,
          full_name: 'Open Shift',
          role: 'Unassigned',
          department_id: shift.department_id,
          department_name: deptMap.get(shift.department_id) ?? 'Unknown department',
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

    return Array.from(rowMap.values())
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

}

function toTimelineShiftBlock(
  shift: Shift,
  department_name: string,
  assignment_id: string | null,
  assignment_status: string | null,
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
    acceptance_deadline_at: shift.acceptance_deadline_at,
    recurrence_group_id: shift.recurrence_group_id,
    recurrence_rule: shift.recurrence_rule,
    assignment_status,
  }
}

function addDaysToDateKey(dateKey: string, days: number): string {
  const date = new Date(`${dateKey}T00:00:00`)
  date.setDate(date.getDate() + days)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

async function getShiftSnapshot(shift_id: string): Promise<ShiftSnapshot> {
  const shift = await shiftRepository.getShiftById(shift_id)
  if (!shift) throw new Error('Shift not found')
  const assignments = await shiftRepository.getAssignmentsByShiftIds([shift_id])
  return {
    shift,
    assignments: assignments as unknown as Array<Record<string, unknown>>,
  }
}

async function detectClopeningConflict(input: {
  user_id: string
  shift_date: string
  start_time: string
  end_time: string
  exclude_shift_id?: string
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

function toShiftUpdateFields(
  shift: Shift,
): Partial<Omit<Shift, 'id' | 'company_id' | 'created_by' | 'created_at'>> {
  return {
    department_id: shift.department_id,
    title: shift.title,
    instruction: shift.instruction,
    shift_date: shift.shift_date,
    start_time: shift.start_time,
    end_time: shift.end_time,
    status: shift.status,
    publication_status: shift.publication_status,
    acceptance_deadline_at: shift.acceptance_deadline_at,
    recurrence_group_id: shift.recurrence_group_id,
    recurrence_rule: shift.recurrence_rule,
    source_shift_id: shift.source_shift_id,
    updated_at: shift.updated_at,
  }
}
