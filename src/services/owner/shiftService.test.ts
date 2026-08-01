import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase', () => ({
  supabase: {},
  createClient: () => ({}),
}))

vi.mock('@/repositories/owner/shiftRepository', () => ({
  shiftRepository: {
    createShift: vi.fn(),
    createShiftAssignment: vi.fn(),
    getShiftById: vi.fn(),
    updateShift: vi.fn(),
    updateSchedulePublication: vi.fn(),
    deleteShift: vi.fn(),
    deleteAssignmentsByShiftId: vi.fn(),
    deleteAssignmentById: vi.fn(),
    getAssignmentById: vi.fn(),
    getAssignmentsByShiftIds: vi.fn(),
    getAssignmentsByUserAndDateRange: vi.fn(),
    getShiftsByCompanyAndDateRange: vi.fn(),
    getCompanyMembers: vi.fn(),
    getDepartmentsByIds: vi.fn(),
    getUsersByIds: vi.fn(),
    getShiftsBySplitGroupId: vi.fn(),
    getShiftsByRecurrenceGroupId: vi.fn(),
    createActionHistory: vi.fn(),
    getLatestUndoableAction: vi.fn(),
    getLatestRedoableAction: vi.fn(),
    markActionUndone: vi.fn(),
    markActionRedone: vi.fn(),
    restoreShift: vi.fn(),
    restoreShifts: vi.fn(),
    restoreShiftAssignments: vi.fn(),
    getShiftsByIds: vi.fn(),
    upsertShifts: vi.fn(),
    deleteShiftsByIds: vi.fn(),
    deleteAssignmentsByShiftIds: vi.fn(),
    updatePublicationStatusByIds: vi.fn(),
  },
}))

vi.mock('@/services/owner/schedulingRuleService', () => ({
  schedulingRuleService: {
    validateSchedule: vi.fn(),
  },
}))

vi.mock('@/repositories/owner/attendanceRepository', () => ({
  attendanceRepository: {
    getAttendanceRecordsByAssignmentIds: vi.fn(),
  },
}))

import { shiftService } from './shiftService'
import { shiftRepository } from '@/repositories/owner/shiftRepository'
import { attendanceRepository } from '@/repositories/owner/attendanceRepository'
import { schedulingRuleService } from '@/services/owner/schedulingRuleService'

const baseShift = {
  id: 'shift-1',
  company_id: 'company-1',
  department_id: 'dept-1',
  shift_date: '2026-06-22',
  start_time: '09:00',
  end_time: '17:00',
  status: 'active' as const,
  publication_status: 'draft' as const,
  recurrence_group_id: null,
  recurrence_rule: null,
  source_shift_id: null,
  split_group_id: null,
  template_id: null,
  source_job_posting_id: null,
  is_open_ended: false,
  hourly_rate: null,
  created_by: 'owner-1',
}

describe('shiftService — Shift (UC1, UC3-10)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(shiftRepository.getAssignmentsByUserAndDateRange).mockResolvedValue([])
    vi.mocked(shiftRepository.getAssignmentsByShiftIds).mockResolvedValue([])
    vi.mocked(attendanceRepository.getAttendanceRecordsByAssignmentIds).mockResolvedValue([])
  })

  describe('createShift (UC1)', () => {
    it('creates a shift with no assignment', async () => {
      vi.mocked(shiftRepository.createShift).mockResolvedValue(baseShift)

      const result = await shiftService.createShift({
        company_id: 'company-1',
        department_id: 'dept-1',
        shift_date: '2026-06-22',
        start_time: '09:00',
        end_time: '17:00',
        created_by: 'owner-1',
      })

      expect(shiftRepository.createShift).toHaveBeenCalled()
      expect(shiftRepository.createShiftAssignment).not.toHaveBeenCalled()
      expect(result).toEqual({ shift: baseShift, warning: null })
    })

    it('creates a shift and an assignment when assigned_user_id is provided', async () => {
      vi.mocked(shiftRepository.createShift).mockResolvedValue(baseShift)
      vi.mocked(shiftRepository.createShiftAssignment).mockResolvedValue({
        id: 'assign-1',
        shift_id: 'shift-1',
        user_id: 'user-1',
        assigned_by: 'owner-1',
        supervisor_employee_id: null, user_name_snapshot: null,
        created_at: '2026-06-01T00:00:00.000Z',
      })

      await shiftService.createShift({
        company_id: 'company-1',
        department_id: 'dept-1',
        shift_date: '2026-06-22',
        start_time: '09:00',
        end_time: '17:00',
        created_by: 'owner-1',
        assigned_user_id: 'user-1',
      })

      expect(shiftRepository.createShiftAssignment).toHaveBeenCalledWith({
        shift_id: 'shift-1',
        user_id: 'user-1',
        assigned_by: 'owner-1',
        supervisor_employee_id: null,
      })
    })

    it('rejects missing required fields', async () => {
      await expect(shiftService.createShift({
        company_id: '',
        department_id: 'dept-1',
        shift_date: '2026-06-22',
        start_time: '09:00',
        end_time: '17:00',
        created_by: 'owner-1',
      })).rejects.toThrow('Missing required shift fields')
    })

    // BUG-021: overnight shifts (end_time on the following day) are valid — only an exact
    // start===end match is rejected.
    it('accepts an overnight shift where end_time is numerically before start_time', async () => {
      vi.mocked(shiftRepository.createShift).mockResolvedValue({ ...baseShift, start_time: '17:00', end_time: '09:00' })

      const result = await shiftService.createShift({
        company_id: 'company-1',
        department_id: 'dept-1',
        shift_date: '2026-06-22',
        start_time: '17:00',
        end_time: '09:00',
        created_by: 'owner-1',
      })

      expect(result.shift.start_time).toBe('17:00')
      expect(result.shift.end_time).toBe('09:00')
    })

    it('rejects when start_time equals end_time', async () => {
      await expect(shiftService.createShift({
        company_id: 'company-1',
        department_id: 'dept-1',
        shift_date: '2026-06-22',
        start_time: '09:00',
        end_time: '09:00',
        created_by: 'owner-1',
      })).rejects.toThrow('start_time and end_time cannot be the same')
    })

    it('creates the shift but returns a warning when rest hours are below the minimum (UC9)', async () => {
      vi.mocked(shiftRepository.getAssignmentsByUserAndDateRange).mockResolvedValue([
        {
          id: 'assign-prev',
          shift_id: 'shift-prev',
          user_id: 'user-1',
          assigned_by: 'owner-1',
          supervisor_employee_id: null, user_name_snapshot: null,
          created_at: '2026-06-01T00:00:00.000Z',
          shifts: { ...baseShift, id: 'shift-prev', shift_date: '2026-06-22', start_time: '00:00', end_time: '02:00' },
        },
      ])
      vi.mocked(shiftRepository.createShift).mockResolvedValue(baseShift)
      vi.mocked(shiftRepository.createShiftAssignment).mockResolvedValue({} as never)

      const result = await shiftService.createShift({
        company_id: 'company-1',
        department_id: 'dept-1',
        shift_date: '2026-06-22',
        start_time: '06:00',
        end_time: '14:00',
        created_by: 'owner-1',
        assigned_user_id: 'user-1',
      })

      expect(shiftRepository.createShift).toHaveBeenCalled()
      expect(result.warning).not.toBeNull()
    })
  })

  describe('createSplitShift (UC8)', () => {
    it('creates two linked shift rows sharing the same split_group_id', async () => {
      let counter = 0
      vi.mocked(shiftRepository.createShift).mockImplementation(async (input) => ({
        ...baseShift,
        id: `split-shift-${++counter}`,
        start_time: input.start_time,
        end_time: input.end_time,
        split_group_id: input.split_group_id ?? null,
      }))

      const result = await shiftService.createSplitShift({
        company_id: 'company-1',
        department_id: 'dept-1',
        shift_date: '2026-06-22',
        blocks: [
          { start_time: '09:00', end_time: '12:00' },
          { start_time: '14:00', end_time: '18:00' },
        ],
        created_by: 'owner-1',
      })

      expect(result.shifts).toHaveLength(2)
      expect(result.shifts[0].split_group_id).toBe(result.shifts[1].split_group_id)
      expect(result.shifts[0].split_group_id).not.toBeNull()
      expect(shiftRepository.createShiftAssignment).not.toHaveBeenCalled()
    })

    it('creates a shared assignment on both blocks when assigned_user_id is provided', async () => {
      vi.mocked(shiftRepository.createShift).mockImplementation(async (input) => ({
        ...baseShift,
        id: `split-shift-${input.start_time}`,
        start_time: input.start_time,
        end_time: input.end_time,
      }))
      vi.mocked(shiftRepository.createShiftAssignment).mockResolvedValue({} as never)

      await shiftService.createSplitShift({
        company_id: 'company-1',
        department_id: 'dept-1',
        shift_date: '2026-06-22',
        blocks: [
          { start_time: '09:00', end_time: '12:00' },
          { start_time: '14:00', end_time: '18:00' },
        ],
        created_by: 'owner-1',
        assigned_user_id: 'user-1',
      })

      expect(shiftRepository.createShiftAssignment).toHaveBeenCalledTimes(2)
    })

    it('rejects a split shift that does not have exactly 2 blocks', async () => {
      await expect(shiftService.createSplitShift({
        company_id: 'company-1',
        department_id: 'dept-1',
        shift_date: '2026-06-22',
        blocks: [{ start_time: '09:00', end_time: '12:00' }],
        created_by: 'owner-1',
      })).rejects.toThrow('A split shift must have exactly 2 time blocks')
    })

    it('rejects a block where start_time is not before end_time', async () => {
      await expect(shiftService.createSplitShift({
        company_id: 'company-1',
        department_id: 'dept-1',
        shift_date: '2026-06-22',
        blocks: [
          { start_time: '12:00', end_time: '09:00' },
          { start_time: '14:00', end_time: '18:00' },
        ],
        created_by: 'owner-1',
      })).rejects.toThrow('Each block must have start_time before end_time')
    })

    it('rejects overlapping blocks', async () => {
      await expect(shiftService.createSplitShift({
        company_id: 'company-1',
        department_id: 'dept-1',
        shift_date: '2026-06-22',
        blocks: [
          { start_time: '09:00', end_time: '15:00' },
          { start_time: '14:00', end_time: '18:00' },
        ],
        created_by: 'owner-1',
      })).rejects.toThrow('Split shift blocks must not overlap')
      expect(shiftRepository.createShift).not.toHaveBeenCalled()
    })

    it('creates the split shift but returns a warning on a clopening conflict', async () => {
      vi.mocked(shiftRepository.getAssignmentsByUserAndDateRange).mockResolvedValue([
        {
          id: 'assign-prev',
          shift_id: 'shift-prev',
          user_id: 'user-1',
          assigned_by: 'owner-1',
          supervisor_employee_id: null, user_name_snapshot: null,
          created_at: '2026-06-01T00:00:00.000Z',
          shifts: { ...baseShift, id: 'shift-prev', shift_date: '2026-06-22', start_time: '00:00', end_time: '02:00' },
        },
      ])
      vi.mocked(shiftRepository.createShift).mockImplementation(async (input) => ({
        ...baseShift,
        id: `split-shift-${input.start_time}`,
        start_time: input.start_time,
        end_time: input.end_time,
      }))
      vi.mocked(shiftRepository.createShiftAssignment).mockResolvedValue({} as never)

      const result = await shiftService.createSplitShift({
        company_id: 'company-1',
        department_id: 'dept-1',
        shift_date: '2026-06-22',
        blocks: [
          { start_time: '06:00', end_time: '10:00' },
          { start_time: '14:00', end_time: '18:00' },
        ],
        created_by: 'owner-1',
        assigned_user_id: 'user-1',
      })

      expect(shiftRepository.createShift).toHaveBeenCalled()
      expect(result.warning).not.toBeNull()
    })
  })

  describe('editShift (UC3)', () => {
    it('updates fields on an existing shift', async () => {
      vi.mocked(shiftRepository.getShiftById).mockResolvedValue(baseShift)
      vi.mocked(shiftRepository.updateShift).mockResolvedValue({ ...baseShift, start_time: '10:00' })

      const result = await shiftService.editShift('shift-1', { start_time: '10:00' })

      expect(shiftRepository.updateShift).toHaveBeenCalledWith('shift-1', { start_time: '10:00' })
      expect(result.shift.start_time).toBe('10:00')
    })

    it('throws when the shift does not exist', async () => {
      vi.mocked(shiftRepository.getShiftById).mockResolvedValue(null)

      await expect(shiftService.editShift('missing', { start_time: '10:00' })).rejects.toThrow('Shift not found')
    })

    // BUG-021: overnight shifts (end_time on the following day) are valid — only an exact
    // start===end match is rejected.
    it('accepts an edit that makes the shift overnight (end_time numerically before start_time)', async () => {
      vi.mocked(shiftRepository.getShiftById).mockResolvedValue(baseShift)
      vi.mocked(shiftRepository.getAssignmentsByShiftIds).mockResolvedValue([])
      vi.mocked(shiftRepository.updateShift).mockResolvedValue({ ...baseShift, start_time: '18:00' })

      const result = await shiftService.editShift('shift-1', { start_time: '18:00' })

      expect(result.shift.start_time).toBe('18:00')
    })

    it('rejects an edit that makes start_time equal to end_time', async () => {
      vi.mocked(shiftRepository.getShiftById).mockResolvedValue(baseShift)

      await expect(shiftService.editShift('shift-1', { start_time: baseShift.end_time })).rejects.toThrow(
        'start_time and end_time cannot be the same',
      )
    })

    it('replaces the assignment when an assignment block is provided', async () => {
      vi.mocked(shiftRepository.getShiftById).mockResolvedValue(baseShift)
      vi.mocked(shiftRepository.deleteAssignmentsByShiftId).mockResolvedValue(undefined)
      vi.mocked(shiftRepository.createShiftAssignment).mockResolvedValue({} as never)

      await shiftService.editShift('shift-1', {}, {
        assigned_user_id: 'user-2',
        assigned_by: 'owner-1',
        supervisor_employee_id: null,
      })

      expect(shiftRepository.deleteAssignmentsByShiftId).toHaveBeenCalledWith('shift-1')
      expect(shiftRepository.createShiftAssignment).toHaveBeenCalledWith({
        shift_id: 'shift-1',
        user_id: 'user-2',
        assigned_by: 'owner-1',
        supervisor_employee_id: null,
      })
    })

    it('clears an existing assignment without creating a new one when assigned_user_id is null', async () => {
      vi.mocked(shiftRepository.getShiftById).mockResolvedValue(baseShift)
      vi.mocked(shiftRepository.getAssignmentsByShiftIds).mockResolvedValue([
        { id: 'a-1', shift_id: 'shift-1', user_id: 'user-1', assigned_by: 'owner-1', supervisor_employee_id: null, user_name_snapshot: null, created_at: '' },
      ])
      vi.mocked(shiftRepository.deleteAssignmentsByShiftId).mockResolvedValue(undefined)

      await shiftService.editShift('shift-1', {}, {
        assigned_user_id: null,
        assigned_by: 'owner-1',
        supervisor_employee_id: null,
      })

      expect(shiftRepository.deleteAssignmentsByShiftId).toHaveBeenCalledWith('shift-1')
      expect(shiftRepository.createShiftAssignment).not.toHaveBeenCalled()
    })

    it('does not touch shift_assignments when the assignment block matches the existing assignment (e.g. saving other fields unchanged)', async () => {
      vi.mocked(shiftRepository.getShiftById).mockResolvedValue(baseShift)
      vi.mocked(shiftRepository.getAssignmentsByShiftIds).mockResolvedValue([
        { id: 'a-1', shift_id: 'shift-1', user_id: 'user-1', assigned_by: 'owner-1', supervisor_employee_id: null, user_name_snapshot: null, created_at: '' },
      ])

      await shiftService.editShift('shift-1', { start_time: '08:30' }, {
        assigned_user_id: 'user-1',
        assigned_by: 'owner-1',
        supervisor_employee_id: null,
      })

      expect(shiftRepository.deleteAssignmentsByShiftId).not.toHaveBeenCalled()
      expect(shiftRepository.createShiftAssignment).not.toHaveBeenCalled()
    })

    it('does not touch shift_assignments for a Casual Worker assignment (has a supervisor) when the caller omits supervisor_employee_id entirely, e.g. Bulk Edit', async () => {
      vi.mocked(shiftRepository.getShiftById).mockResolvedValue(baseShift)
      vi.mocked(shiftRepository.getAssignmentsByShiftIds).mockResolvedValue([
        { id: 'a-1', shift_id: 'shift-1', user_id: 'casual-1', assigned_by: 'owner-1', supervisor_employee_id: 'employee-1', user_name_snapshot: null, created_at: '' },
      ])

      // No supervisor_employee_id key at all — Bulk Edit has no supervisor field in its UI.
      await shiftService.editShift('shift-1', { start_time: '08:30' }, {
        assigned_user_id: 'casual-1',
        assigned_by: 'owner-1',
      })

      expect(shiftRepository.deleteAssignmentsByShiftId).not.toHaveBeenCalled()
      expect(shiftRepository.createShiftAssignment).not.toHaveBeenCalled()
    })

    it('preserves the existing supervisor when actually reassigning without specifying supervisor_employee_id', async () => {
      vi.mocked(shiftRepository.getShiftById).mockResolvedValue(baseShift)
      vi.mocked(shiftRepository.deleteAssignmentsByShiftId).mockResolvedValue(undefined)
      vi.mocked(shiftRepository.createShiftAssignment).mockResolvedValue({} as never)
      vi.mocked(shiftRepository.getAssignmentsByShiftIds).mockResolvedValue([
        { id: 'a-1', shift_id: 'shift-1', user_id: 'casual-1', assigned_by: 'owner-1', supervisor_employee_id: 'employee-1', user_name_snapshot: null, created_at: '' },
      ])

      await shiftService.editShift('shift-1', {}, {
        assigned_user_id: 'casual-2',
        assigned_by: 'owner-1',
      })

      expect(shiftRepository.deleteAssignmentsByShiftId).toHaveBeenCalledWith('shift-1')
      expect(shiftRepository.createShiftAssignment).toHaveBeenCalledWith({
        shift_id: 'shift-1',
        user_id: 'casual-2',
        assigned_by: 'owner-1',
        supervisor_employee_id: 'employee-1',
      })
    })

    it('swaps the new assignee\'s same-day shift to the previous assignee instead of double-booking', async () => {
      // Shift A (shift-1) was Irene's 11am-5pm; reassigning it to Marcus, who already has shift-2 (9am-5pm) that day.
      vi.mocked(shiftRepository.getShiftById).mockResolvedValue({ ...baseShift, start_time: '11:00', end_time: '17:00' })
      vi.mocked(shiftRepository.deleteAssignmentsByShiftId).mockResolvedValue(undefined)
      vi.mocked(shiftRepository.createShiftAssignment).mockResolvedValue({} as never)
      vi.mocked(shiftRepository.getAssignmentsByShiftIds)
        .mockResolvedValueOnce([{ id: 'a-1', shift_id: 'shift-1', user_id: 'irene', assigned_by: 'owner-1', supervisor_employee_id: null, user_name_snapshot: null, created_at: '' }])
        .mockResolvedValueOnce([{ id: 'a-2', shift_id: 'shift-2', user_id: 'marcus', assigned_by: 'owner-1', supervisor_employee_id: null, user_name_snapshot: null, created_at: '' }])
      vi.mocked(shiftRepository.getAssignmentsByUserAndDateRange).mockResolvedValue([
        { id: 'a-2', shift_id: 'shift-2', user_id: 'marcus', assigned_by: 'owner-1', supervisor_employee_id: null, user_name_snapshot: null, created_at: '', shifts: { ...baseShift, id: 'shift-2', start_time: '09:00', end_time: '17:00' } },
      ])

      await shiftService.editShift('shift-1', {}, {
        assigned_user_id: 'marcus',
        assigned_by: 'owner-1',
        supervisor_employee_id: null,
      }, 'owner-1')

      expect(shiftRepository.deleteAssignmentsByShiftId).toHaveBeenCalledWith('shift-1')
      expect(shiftRepository.createShiftAssignment).toHaveBeenCalledWith({
        shift_id: 'shift-1',
        user_id: 'marcus',
        assigned_by: 'owner-1',
        supervisor_employee_id: null,
      })
      expect(shiftRepository.deleteAssignmentsByShiftId).toHaveBeenCalledWith('shift-2')
      expect(shiftRepository.createShiftAssignment).toHaveBeenCalledWith({
        shift_id: 'shift-2',
        user_id: 'irene',
        assigned_by: 'owner-1',
        supervisor_employee_id: null,
      })
      expect(shiftRepository.createActionHistory).toHaveBeenCalledWith(
        expect.objectContaining({ affected_shift_ids: ['shift-1', 'shift-2'] }),
      )
    })

    it('rejects reassigning an unassigned shift to someone already booked that day (nothing to swap into)', async () => {
      vi.mocked(shiftRepository.getShiftById).mockResolvedValue({ ...baseShift, start_time: '11:00', end_time: '17:00' })
      vi.mocked(shiftRepository.getAssignmentsByShiftIds).mockResolvedValueOnce([])
      vi.mocked(shiftRepository.getAssignmentsByUserAndDateRange).mockResolvedValue([
        { id: 'a-2', shift_id: 'shift-2', user_id: 'marcus', assigned_by: 'owner-1', supervisor_employee_id: null, user_name_snapshot: null, created_at: '', shifts: { ...baseShift, id: 'shift-2', start_time: '09:00', end_time: '17:00' } },
      ])

      await expect(shiftService.editShift('shift-1', {}, {
        assigned_user_id: 'marcus',
        assigned_by: 'owner-1',
        supervisor_employee_id: null,
      })).rejects.toThrow('already has a shift on that date')
    })

    it('cascades a time-field edit on a recurring original to all sibling occurrences', async () => {
      const original = { ...baseShift, id: 'shift-1', recurrence_group_id: 'rec-1', source_shift_id: null }
      const sibling1 = { ...baseShift, id: 'shift-2', shift_date: '2026-06-29', recurrence_group_id: 'rec-1', source_shift_id: 'shift-1' }
      const sibling2 = { ...baseShift, id: 'shift-3', shift_date: '2026-07-06', recurrence_group_id: 'rec-1', source_shift_id: 'shift-1' }
      vi.mocked(shiftRepository.getShiftById).mockResolvedValue(original)
      vi.mocked(shiftRepository.updateShift)
        .mockResolvedValueOnce({ ...original, start_time: '10:00' })
        .mockResolvedValueOnce({ ...sibling1, start_time: '10:00' })
        .mockResolvedValueOnce({ ...sibling2, start_time: '10:00' })
      vi.mocked(shiftRepository.getShiftsByRecurrenceGroupId).mockResolvedValue([original, sibling1, sibling2])

      await shiftService.editShift('shift-1', { start_time: '10:00', end_time: '17:00' }, undefined, 'owner-1')

      expect(shiftRepository.getShiftsByRecurrenceGroupId).toHaveBeenCalledWith('rec-1')
      expect(shiftRepository.updateShift).toHaveBeenCalledWith('shift-2', { start_time: '10:00', end_time: '17:00' })
      expect(shiftRepository.updateShift).toHaveBeenCalledWith('shift-3', { start_time: '10:00', end_time: '17:00' })
      expect(shiftRepository.createActionHistory).toHaveBeenCalledWith(
        expect.objectContaining({ affected_shift_ids: ['shift-1', 'shift-2', 'shift-3'] }),
      )
    })

    it('cascades a reassign on a recurring original to all sibling occurrences', async () => {
      const original = { ...baseShift, id: 'shift-1', recurrence_group_id: 'rec-1', source_shift_id: null }
      const sibling1 = { ...baseShift, id: 'shift-2', shift_date: '2026-06-29', recurrence_group_id: 'rec-1', source_shift_id: 'shift-1' }
      const sibling2 = { ...baseShift, id: 'shift-3', shift_date: '2026-07-06', recurrence_group_id: 'rec-1', source_shift_id: 'shift-1' }
      vi.mocked(shiftRepository.getShiftById).mockResolvedValue(original)
      vi.mocked(shiftRepository.getShiftsByRecurrenceGroupId).mockResolvedValue([original, sibling1, sibling2])
      vi.mocked(shiftRepository.getAssignmentsByShiftIds).mockResolvedValue([])
      vi.mocked(shiftRepository.getAssignmentsByUserAndDateRange).mockResolvedValue([])
      vi.mocked(shiftRepository.deleteAssignmentsByShiftId).mockResolvedValue(undefined)
      vi.mocked(shiftRepository.createShiftAssignment).mockResolvedValue({} as never)

      await shiftService.editShift('shift-1', {}, {
        assigned_user_id: 'user-2',
        assigned_by: 'owner-1',
        supervisor_employee_id: null,
      }, 'owner-1')

      expect(shiftRepository.getShiftsByRecurrenceGroupId).toHaveBeenCalledWith('rec-1')
      expect(shiftRepository.deleteAssignmentsByShiftId).toHaveBeenCalledWith('shift-2')
      expect(shiftRepository.deleteAssignmentsByShiftId).toHaveBeenCalledWith('shift-3')
      expect(shiftRepository.createShiftAssignment).toHaveBeenCalledWith({
        shift_id: 'shift-2',
        user_id: 'user-2',
        assigned_by: 'owner-1',
        supervisor_employee_id: null,
      })
      expect(shiftRepository.createShiftAssignment).toHaveBeenCalledWith({
        shift_id: 'shift-3',
        user_id: 'user-2',
        assigned_by: 'owner-1',
        supervisor_employee_id: null,
      })
      expect(shiftRepository.createActionHistory).toHaveBeenCalledWith(
        expect.objectContaining({ affected_shift_ids: ['shift-1', 'shift-2', 'shift-3'] }),
      )
    })

    it('skips a sibling occurrence whose date the new assignee is already booked on, but still reassigns the others', async () => {
      const original = { ...baseShift, id: 'shift-1', recurrence_group_id: 'rec-1', source_shift_id: null }
      const sibling1 = { ...baseShift, id: 'shift-2', shift_date: '2026-06-29', recurrence_group_id: 'rec-1', source_shift_id: 'shift-1' }
      const sibling2 = { ...baseShift, id: 'shift-3', shift_date: '2026-07-06', recurrence_group_id: 'rec-1', source_shift_id: 'shift-1' }
      vi.mocked(shiftRepository.getShiftById).mockResolvedValue(original)
      vi.mocked(shiftRepository.getShiftsByRecurrenceGroupId).mockResolvedValue([original, sibling1, sibling2])
      vi.mocked(shiftRepository.getAssignmentsByShiftIds).mockResolvedValue([])
      vi.mocked(shiftRepository.deleteAssignmentsByShiftId).mockResolvedValue(undefined)
      vi.mocked(shiftRepository.createShiftAssignment).mockResolvedValue({} as never)
      vi.mocked(shiftRepository.getAssignmentsByUserAndDateRange).mockImplementation(async (_user, from) => {
        if (from === '2026-06-29') {
          return [{ id: 'a-x', shift_id: 'shift-conflict', user_id: 'user-2', assigned_by: 'owner-1', supervisor_employee_id: null, user_name_snapshot: null, created_at: '', shifts: { ...baseShift, id: 'shift-conflict' } }]
        }
        return []
      })

      await shiftService.editShift('shift-1', {}, {
        assigned_user_id: 'user-2',
        assigned_by: 'owner-1',
        supervisor_employee_id: null,
      }, 'owner-1')

      expect(shiftRepository.deleteAssignmentsByShiftId).not.toHaveBeenCalledWith('shift-2')
      expect(shiftRepository.deleteAssignmentsByShiftId).toHaveBeenCalledWith('shift-3')
      expect(shiftRepository.createShiftAssignment).toHaveBeenCalledWith(expect.objectContaining({ shift_id: 'shift-3' }))
      expect(shiftRepository.createActionHistory).toHaveBeenCalledWith(
        expect.objectContaining({ affected_shift_ids: ['shift-1', 'shift-3'] }),
      )
    })

    it('does not cascade an edit on a non-original recurring occurrence', async () => {
      const childShift = { ...baseShift, id: 'shift-2', recurrence_group_id: 'rec-1', source_shift_id: 'shift-1' }
      vi.mocked(shiftRepository.getShiftById).mockResolvedValue(childShift)
      vi.mocked(shiftRepository.updateShift).mockResolvedValue({ ...childShift, start_time: '10:00' })

      await shiftService.editShift('shift-2', { start_time: '10:00', end_time: '17:00' }, undefined, 'owner-1')

      expect(shiftRepository.getShiftsByRecurrenceGroupId).not.toHaveBeenCalled()
      expect(shiftRepository.updateShift).toHaveBeenCalledTimes(1)
      expect(shiftRepository.createActionHistory).toHaveBeenCalledWith(
        expect.objectContaining({ affected_shift_ids: ['shift-2'] }),
      )
    })

    it('does not cascade a non-schedule field edit (e.g. publication_status only) on a recurring original', async () => {
      const original = { ...baseShift, id: 'shift-1', recurrence_group_id: 'rec-1', source_shift_id: null }
      vi.mocked(shiftRepository.getShiftById).mockResolvedValue(original)
      vi.mocked(shiftRepository.updateShift).mockResolvedValue({ ...original, publication_status: 'published' })

      await shiftService.editShift('shift-1', { publication_status: 'published' }, undefined, 'owner-1')

      expect(shiftRepository.getShiftsByRecurrenceGroupId).not.toHaveBeenCalled()
      expect(shiftRepository.updateShift).toHaveBeenCalledTimes(1)
    })
  })

  describe('bulkEditShifts (UC10)', () => {
    it('updates multiple shifts and records one combined history entry', async () => {
      vi.mocked(shiftRepository.getShiftById)
        .mockResolvedValueOnce({ ...baseShift, id: 'shift-1' })
        .mockResolvedValueOnce({ ...baseShift, id: 'shift-1' })
        .mockResolvedValueOnce({ ...baseShift, id: 'shift-2' })
        .mockResolvedValueOnce({ ...baseShift, id: 'shift-2' })
      vi.mocked(shiftRepository.updateShift)
        .mockResolvedValueOnce({ ...baseShift, id: 'shift-1', start_time: '10:00' })
        .mockResolvedValueOnce({ ...baseShift, id: 'shift-2', start_time: '11:00' })

      const result = await shiftService.bulkEditShifts('company-1', [
        { id: 'shift-1', start_time: '10:00' },
        { id: 'shift-2', start_time: '11:00' },
      ], 'owner-1')

      expect(result.updated).toHaveLength(2)
      expect(result.failed).toHaveLength(0)
      expect(shiftRepository.createActionHistory).toHaveBeenCalledWith(
        expect.objectContaining({
          company_id: 'company-1',
          performed_by: 'owner-1',
          action_type: 'bulk_edit',
          affected_shift_ids: ['shift-1', 'shift-2'],
        }),
      )
    })

    it('collects per-row failures without aborting the whole batch', async () => {
      vi.mocked(shiftRepository.getShiftById)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ ...baseShift, id: 'shift-2' })
        .mockResolvedValueOnce({ ...baseShift, id: 'shift-2' })
      vi.mocked(shiftRepository.updateShift).mockResolvedValueOnce({ ...baseShift, id: 'shift-2', start_time: '11:00' })

      const result = await shiftService.bulkEditShifts('company-1', [
        { id: 'missing-shift', start_time: '10:00' },
        { id: 'shift-2', start_time: '11:00' },
      ], 'owner-1')

      expect(result.updated).toHaveLength(1)
      expect(result.failed).toEqual([{ id: 'missing-shift', message: 'Shift not found' }])
    })

    it('throws when items is empty', async () => {
      await expect(shiftService.bulkEditShifts('company-1', [], 'owner-1')).rejects.toThrow('items must be a non-empty array')
    })

    it('regression: saving a Casual Worker row with the same assignee does not touch shift_assignments (Bulk Edit has no supervisor field, so it must not look like a reassignment)', async () => {
      vi.mocked(shiftRepository.getShiftById).mockResolvedValue({ ...baseShift, id: 'shift-1' })
      vi.mocked(shiftRepository.updateShift).mockResolvedValue({ ...baseShift, id: 'shift-1', start_time: '10:00' })
      vi.mocked(shiftRepository.getAssignmentsByShiftIds).mockResolvedValue([
        { id: 'a-1', shift_id: 'shift-1', user_id: 'casual-1', assigned_by: 'owner-1', supervisor_employee_id: 'employee-1', user_name_snapshot: null, created_at: '' },
      ])

      const result = await shiftService.bulkEditShifts('company-1', [
        { id: 'shift-1', start_time: '10:00', assigned_user_id: 'casual-1' },
      ], 'owner-1')

      expect(result.failed).toHaveLength(0)
      expect(result.updated).toHaveLength(1)
      expect(shiftRepository.deleteAssignmentsByShiftId).not.toHaveBeenCalled()
      expect(shiftRepository.createShiftAssignment).not.toHaveBeenCalled()
    })
  })

  describe('publishSchedule (UC5)', () => {
    it('publishes a schedule without running any scheduling-rule validation', async () => {
      vi.mocked(shiftRepository.getShiftsByCompanyAndDateRange).mockResolvedValue([baseShift])
      vi.mocked(shiftRepository.updateSchedulePublication).mockResolvedValue([baseShift])

      const result = await shiftService.publishSchedule({
        company_id: 'company-1',
        date_from: '2026-06-22',
        date_to: '2026-06-28',
        publication_status: 'published',
      })

      expect(schedulingRuleService.validateSchedule).not.toHaveBeenCalled()
      expect(shiftRepository.updateSchedulePublication).toHaveBeenCalled()
      expect(result.shifts).toEqual([baseShift])
    })

    it('allows unpublishing (draft) without running any scheduling-rule validation', async () => {
      vi.mocked(shiftRepository.getShiftsByCompanyAndDateRange).mockResolvedValue([{ ...baseShift, publication_status: 'published' }])
      vi.mocked(shiftRepository.updateSchedulePublication).mockResolvedValue([baseShift])

      const result = await shiftService.publishSchedule({
        company_id: 'company-1',
        date_from: '2026-06-22',
        date_to: '2026-06-28',
        publication_status: 'draft',
      })

      expect(schedulingRuleService.validateSchedule).not.toHaveBeenCalled()
      expect(shiftRepository.updateSchedulePublication).toHaveBeenCalled()
      expect(result.shifts).toEqual([baseShift])
    })

    it('rejects an inverted date range', async () => {
      await expect(shiftService.publishSchedule({
        company_id: 'company-1',
        date_from: '2026-06-28',
        date_to: '2026-06-22',
        publication_status: 'draft',
      })).rejects.toThrow('date_from must be before date_to')
    })

    it('records action history with the previous publication statuses when performed_by is given', async () => {
      vi.mocked(schedulingRuleService.validateSchedule).mockResolvedValue({ valid: true, errors: [], warnings: [] })
      vi.mocked(shiftRepository.getShiftsByCompanyAndDateRange).mockResolvedValue([baseShift])
      vi.mocked(shiftRepository.updateSchedulePublication).mockResolvedValue([{ ...baseShift, publication_status: 'published' }])

      await shiftService.publishSchedule({
        company_id: 'company-1',
        date_from: '2026-06-22',
        date_to: '2026-06-28',
        publication_status: 'published',
        performed_by: 'owner-1',
      })

      expect(shiftRepository.createActionHistory).toHaveBeenCalledWith(expect.objectContaining({
        action_type: 'publish',
        affected_shift_ids: [baseShift.id],
        undo_payload: { previous_publication_statuses: [{ id: baseShift.id, publication_status: 'draft' }] },
      }))
    })

    it('does not record history when performed_by is omitted', async () => {
      vi.mocked(schedulingRuleService.validateSchedule).mockResolvedValue({ valid: true, errors: [], warnings: [] })
      vi.mocked(shiftRepository.updateSchedulePublication).mockResolvedValue([baseShift])

      await shiftService.publishSchedule({
        company_id: 'company-1',
        date_from: '2026-06-22',
        date_to: '2026-06-28',
        publication_status: 'published',
      })

      expect(shiftRepository.createActionHistory).not.toHaveBeenCalled()
    })
  })

  describe('duplicateShift (UC6)', () => {
    it('duplicates a shift as a draft, carrying over the original assignment', async () => {
      vi.mocked(shiftRepository.getShiftById).mockResolvedValue(baseShift)
      vi.mocked(shiftRepository.getAssignmentsByShiftIds).mockResolvedValue([{
        id: 'assign-1',
        shift_id: 'shift-1',
        user_id: 'user-1',
        assigned_by: 'owner-1',
        supervisor_employee_id: null, user_name_snapshot: null,
        created_at: '2026-06-01T00:00:00.000Z',
      }])
      const duplicated = { ...baseShift, id: 'shift-2', shift_date: '2026-06-23', publication_status: 'draft' as const }
      vi.mocked(shiftRepository.createShift).mockResolvedValue(duplicated)
      vi.mocked(shiftRepository.createShiftAssignment).mockResolvedValue({} as never)

      const result = await shiftService.duplicateShift('shift-1', {
        shift_date: '2026-06-23',
        start_time: '09:00',
        end_time: '17:00',
        created_by: 'owner-1',
      })

      expect(shiftRepository.createShift).toHaveBeenCalledWith(expect.objectContaining({
        publication_status: 'draft',
      }))
      expect(shiftRepository.createShiftAssignment).toHaveBeenCalledWith(expect.objectContaining({ user_id: 'user-1' }))
      expect(result.shift).toEqual(duplicated)
    })

    it('does not carry recurrence fields onto the duplicate, even when duplicating a recurring original', async () => {
      const original = { ...baseShift, id: 'shift-1', recurrence_group_id: 'rec-1', recurrence_rule: 'weekly' as const, source_shift_id: null }
      vi.mocked(shiftRepository.getShiftById).mockResolvedValue(original)
      vi.mocked(shiftRepository.getAssignmentsByShiftIds).mockResolvedValue([])
      vi.mocked(shiftRepository.createShift).mockResolvedValue({ ...baseShift, id: 'shift-2', shift_date: '2026-06-23' })

      await shiftService.duplicateShift('shift-1', {
        shift_date: '2026-06-23',
        start_time: '09:00',
        end_time: '17:00',
        created_by: 'owner-1',
      })

      const createCall = vi.mocked(shiftRepository.createShift).mock.calls[0][0]
      expect(createCall.recurrence_group_id).toBeUndefined()
      expect(createCall.recurrence_rule).toBeUndefined()
      expect(createCall.source_shift_id).toBeUndefined()
    })

    it('throws when the source shift does not exist', async () => {
      vi.mocked(shiftRepository.getShiftById).mockResolvedValue(null)

      await expect(shiftService.duplicateShift('missing', {
        shift_date: '2026-06-23',
        start_time: '09:00',
        end_time: '17:00',
        created_by: 'owner-1',
      })).rejects.toThrow('Shift not found')
    })
  })

  describe('createRecurringShifts (UC7)', () => {
    it('creates weekly recurring shifts up to the end date', async () => {
      vi.mocked(shiftRepository.getShiftById).mockResolvedValue(baseShift)
      vi.mocked(shiftRepository.getAssignmentsByShiftIds).mockResolvedValue([])
      vi.mocked(shiftRepository.updateShift).mockResolvedValue(baseShift)
      let counter = 0
      vi.mocked(shiftRepository.createShift).mockImplementation(async (input) => ({
        ...baseShift,
        id: `shift-gen-${++counter}`,
        shift_date: input.shift_date,
      }))

      const created = await shiftService.createRecurringShifts('shift-1', {
        recurrence_rule: 'weekly',
        recurrence_end_date: '2026-07-13',
        created_by: 'owner-1',
      })

      expect(created).toHaveLength(3)
      expect(created.map(s => s.shift_date)).toEqual(['2026-06-29', '2026-07-06', '2026-07-13'])
      expect(shiftRepository.updateShift).toHaveBeenCalledWith('shift-1', expect.objectContaining({ recurrence_rule: 'weekly' }))
    })

    it('carries the original shift\'s template_id onto every generated occurrence', async () => {
      const templated = { ...baseShift, id: 'shift-1', template_id: 'template-1' }
      vi.mocked(shiftRepository.getShiftById).mockResolvedValue(templated)
      vi.mocked(shiftRepository.getAssignmentsByShiftIds).mockResolvedValue([])
      vi.mocked(shiftRepository.updateShift).mockResolvedValue(templated)
      let counter = 0
      vi.mocked(shiftRepository.createShift).mockImplementation(async (input) => ({
        ...templated,
        id: `shift-gen-${++counter}`,
        shift_date: input.shift_date,
        template_id: input.template_id ?? null,
      }))

      const created = await shiftService.createRecurringShifts('shift-1', {
        recurrence_rule: 'weekly',
        recurrence_end_date: '2026-07-06',
        created_by: 'owner-1',
      })

      expect(created.every(s => s.template_id === 'template-1')).toBe(true)
      expect(shiftRepository.createShift).toHaveBeenCalledWith(expect.objectContaining({ template_id: 'template-1' }))
    })

    it('rejects an invalid recurrence_rule', async () => {
      await expect(shiftService.createRecurringShifts('shift-1', {
        recurrence_rule: 'monthly' as never,
        recurrence_end_date: '2026-07-13',
        created_by: 'owner-1',
      })).rejects.toThrow('recurrence_rule must be daily, weekly, or custom')
    })

    it('rejects a recurrence_end_date that is not after the shift date', async () => {
      vi.mocked(shiftRepository.getShiftById).mockResolvedValue(baseShift)

      await expect(shiftService.createRecurringShifts('shift-1', {
        recurrence_rule: 'daily',
        recurrence_end_date: '2026-06-22',
        created_by: 'owner-1',
      })).rejects.toThrow('recurrence_end_date must be after the shift date')
    })

    it('rejects editing recurrence on a non-original occurrence', async () => {
      vi.mocked(shiftRepository.getShiftById).mockResolvedValue({ ...baseShift, id: 'shift-occurrence', source_shift_id: 'shift-1', recurrence_group_id: 'group-1' })

      await expect(shiftService.createRecurringShifts('shift-occurrence', {
        recurrence_rule: 'daily',
        recurrence_end_date: '2026-07-13',
        created_by: 'owner-1',
      })).rejects.toThrow('Only the original shift in a recurring series can have its recurrence edited')
    })

    it('replaces existing future occurrences when editing an already-recurring original\'s settings', async () => {
      const original = { ...baseShift, id: 'shift-1', recurrence_group_id: 'group-1', recurrence_rule: 'weekly' as const, source_shift_id: null }
      vi.mocked(shiftRepository.getShiftById).mockResolvedValue(original)
      vi.mocked(shiftRepository.getAssignmentsByShiftIds).mockResolvedValue([])
      vi.mocked(shiftRepository.updateShift).mockResolvedValue(original)
      vi.mocked(shiftRepository.getShiftsByRecurrenceGroupId).mockResolvedValue([
        original,
        { ...baseShift, id: 'old-occurrence-1', recurrence_group_id: 'group-1', source_shift_id: 'shift-1', shift_date: '2026-06-29' },
        { ...baseShift, id: 'old-occurrence-2', recurrence_group_id: 'group-1', source_shift_id: 'shift-1', shift_date: '2026-07-06' },
      ])
      vi.mocked(shiftRepository.deleteAssignmentsByShiftId).mockResolvedValue(undefined)
      vi.mocked(shiftRepository.deleteShift).mockResolvedValue(undefined)
      let counter = 0
      vi.mocked(shiftRepository.createShift).mockImplementation(async (input) => ({
        ...original,
        id: `shift-gen-${++counter}`,
        shift_date: input.shift_date,
      }))

      const created = await shiftService.createRecurringShifts('shift-1', {
        recurrence_rule: 'daily',
        recurrence_end_date: '2026-06-25',
        created_by: 'owner-1',
      })

      expect(shiftRepository.deleteShift).toHaveBeenCalledWith('old-occurrence-1')
      expect(shiftRepository.deleteShift).toHaveBeenCalledWith('old-occurrence-2')
      expect(shiftRepository.deleteAssignmentsByShiftId).toHaveBeenCalledWith('old-occurrence-1')
      expect(shiftRepository.deleteAssignmentsByShiftId).toHaveBeenCalledWith('old-occurrence-2')
      expect(shiftRepository.updateShift).toHaveBeenCalledWith('shift-1', expect.objectContaining({ recurrence_rule: 'daily' }))
      expect(created.map(s => s.shift_date)).toEqual(['2026-06-23', '2026-06-24', '2026-06-25'])
    })
  })

  describe('deleteShift (UC4)', () => {
    it('deletes assignments then the shift', async () => {
      vi.mocked(shiftRepository.getShiftById).mockResolvedValue(baseShift)
      vi.mocked(shiftRepository.deleteAssignmentsByShiftId).mockResolvedValue(undefined)
      vi.mocked(shiftRepository.deleteShift).mockResolvedValue(undefined)

      await shiftService.deleteShift('shift-1')

      expect(shiftRepository.deleteAssignmentsByShiftId).toHaveBeenCalledWith('shift-1', 'delete')
      expect(shiftRepository.deleteShift).toHaveBeenCalledWith('shift-1')
    })

    it('throws when the shift does not exist', async () => {
      vi.mocked(shiftRepository.getShiftById).mockResolvedValue(null)

      await expect(shiftService.deleteShift('missing')).rejects.toThrow('Shift not found')
      expect(shiftRepository.deleteShift).not.toHaveBeenCalled()
    })

    it('cascades a delete on a recurring original to all sibling occurrences', async () => {
      const original = { ...baseShift, id: 'shift-1', recurrence_group_id: 'rec-1', source_shift_id: null }
      const sibling1 = { ...baseShift, id: 'shift-2', shift_date: '2026-06-29', recurrence_group_id: 'rec-1', source_shift_id: 'shift-1' }
      const sibling2 = { ...baseShift, id: 'shift-3', shift_date: '2026-07-06', recurrence_group_id: 'rec-1', source_shift_id: 'shift-1' }
      vi.mocked(shiftRepository.getShiftById).mockResolvedValue(original)
      vi.mocked(shiftRepository.getShiftsByRecurrenceGroupId).mockResolvedValue([original, sibling1, sibling2])
      vi.mocked(shiftRepository.getAssignmentsByShiftIds).mockResolvedValue([])
      vi.mocked(shiftRepository.deleteAssignmentsByShiftId).mockResolvedValue(undefined)
      vi.mocked(shiftRepository.deleteShift).mockResolvedValue(undefined)

      await shiftService.deleteShift('shift-1', 'owner-1')

      expect(shiftRepository.getShiftsByRecurrenceGroupId).toHaveBeenCalledWith('rec-1')
      expect(shiftRepository.deleteShift).toHaveBeenCalledWith('shift-1')
      expect(shiftRepository.deleteShift).toHaveBeenCalledWith('shift-2')
      expect(shiftRepository.deleteShift).toHaveBeenCalledWith('shift-3')
      expect(shiftRepository.createActionHistory).toHaveBeenCalledWith(
        expect.objectContaining({ affected_shift_ids: ['shift-1', 'shift-2', 'shift-3'] }),
      )
    })

    it('does not cascade a delete on a non-original recurring occurrence', async () => {
      const childShift = { ...baseShift, id: 'shift-2', recurrence_group_id: 'rec-1', source_shift_id: 'shift-1' }
      vi.mocked(shiftRepository.getShiftById).mockResolvedValue(childShift)
      vi.mocked(shiftRepository.getAssignmentsByShiftIds).mockResolvedValue([])
      vi.mocked(shiftRepository.deleteAssignmentsByShiftId).mockResolvedValue(undefined)
      vi.mocked(shiftRepository.deleteShift).mockResolvedValue(undefined)

      await shiftService.deleteShift('shift-2', 'owner-1')

      expect(shiftRepository.getShiftsByRecurrenceGroupId).not.toHaveBeenCalled()
      expect(shiftRepository.deleteShift).toHaveBeenCalledTimes(1)
      expect(shiftRepository.deleteShift).toHaveBeenCalledWith('shift-2')
    })

    it('throws without deleting anything when the shift itself already has attendance recorded', async () => {
      vi.mocked(shiftRepository.getShiftById).mockResolvedValue(baseShift)
      vi.mocked(shiftRepository.getAssignmentsByShiftIds).mockResolvedValue([
        { id: 'assign-1', shift_id: 'shift-1', user_id: 'user-1', assigned_by: 'owner-1', supervisor_employee_id: null, user_name_snapshot: null, created_at: '' },
      ])
      vi.mocked(attendanceRepository.getAttendanceRecordsByAssignmentIds).mockResolvedValue([
        { id: 'att-1', shift_assignment_id: 'assign-1' } as never,
      ])

      await expect(shiftService.deleteShift('shift-1')).rejects.toThrow(
        'Cannot delete this shift — attendance has already been recorded against it.',
      )
      expect(shiftRepository.deleteShift).not.toHaveBeenCalled()
      expect(shiftRepository.deleteAssignmentsByShiftId).not.toHaveBeenCalled()
    })

    it('skips only the recurring occurrence with recorded attendance and still deletes the rest', async () => {
      const original = { ...baseShift, id: 'shift-1', recurrence_group_id: 'rec-1', source_shift_id: null }
      const sibling1 = { ...baseShift, id: 'shift-2', shift_date: '2026-06-29', recurrence_group_id: 'rec-1', source_shift_id: 'shift-1' }
      const sibling2 = { ...baseShift, id: 'shift-3', shift_date: '2026-07-06', recurrence_group_id: 'rec-1', source_shift_id: 'shift-1' }
      vi.mocked(shiftRepository.getShiftById).mockResolvedValue(original)
      vi.mocked(shiftRepository.getShiftsByRecurrenceGroupId).mockResolvedValue([original, sibling1, sibling2])
      vi.mocked(shiftRepository.getAssignmentsByShiftIds).mockResolvedValue([
        { id: 'assign-1', shift_id: 'shift-1', user_id: 'user-1', assigned_by: 'owner-1', supervisor_employee_id: null, user_name_snapshot: null, created_at: '' },
        { id: 'assign-2', shift_id: 'shift-2', user_id: 'user-1', assigned_by: 'owner-1', supervisor_employee_id: null, user_name_snapshot: null, created_at: '' },
        { id: 'assign-3', shift_id: 'shift-3', user_id: 'user-1', assigned_by: 'owner-1', supervisor_employee_id: null, user_name_snapshot: null, created_at: '' },
      ])
      // Only shift-1's assignment (today's already-occurred instance) has attendance recorded.
      vi.mocked(attendanceRepository.getAttendanceRecordsByAssignmentIds).mockResolvedValue([
        { id: 'att-1', shift_assignment_id: 'assign-1' } as never,
      ])
      vi.mocked(shiftRepository.deleteAssignmentsByShiftId).mockResolvedValue(undefined)
      vi.mocked(shiftRepository.deleteShift).mockResolvedValue(undefined)

      const result = await shiftService.deleteShift('shift-1', 'owner-1')

      expect(shiftRepository.deleteShift).not.toHaveBeenCalledWith('shift-1')
      expect(shiftRepository.deleteShift).toHaveBeenCalledWith('shift-2')
      expect(shiftRepository.deleteShift).toHaveBeenCalledWith('shift-3')
      expect(shiftRepository.deleteAssignmentsByShiftId).not.toHaveBeenCalledWith('shift-1', 'delete')
      expect(result.skipped_shifts.map(s => s.id)).toEqual(['shift-1'])
      expect(shiftRepository.createActionHistory).toHaveBeenCalledWith(
        expect.objectContaining({ affected_shift_ids: ['shift-2', 'shift-3'] }),
      )
    })
  })

  describe('assignShiftsInBulk (UC10)', () => {
    // BUG-021: overnight shifts (end_time on the following day) are valid — only an exact
    // start===end match fails, so the third assignment below now succeeds instead of failing.
    it('creates shifts for valid assignments (including overnight ones) and collects failures for invalid ones', async () => {
      vi.mocked(shiftRepository.createShift).mockResolvedValue(baseShift)
      vi.mocked(shiftRepository.createShiftAssignment).mockResolvedValue({} as never)

      const result = await shiftService.assignShiftsInBulk({
        company_id: 'company-1',
        department_id: 'dept-1',
        created_by: 'owner-1',
        assignments: [
          { user_id: 'user-1', shift_date: '2026-06-22', start_time: '09:00', end_time: '17:00' },
          { user_id: '', shift_date: '2026-06-22', start_time: '09:00', end_time: '17:00' },
          { user_id: 'user-2', shift_date: '2026-06-22', start_time: '17:00', end_time: '09:00' },
          { user_id: 'user-3', shift_date: '2026-06-22', start_time: '09:00', end_time: '09:00' },
        ],
      })

      expect(result.created).toHaveLength(2)
      expect(result.failed).toHaveLength(2)
      expect(result.failed[0].message).toBe('Missing required fields')
      expect(result.failed[1].message).toBe('start_time and end_time cannot be the same')
    })
  })

  describe('createShiftsInBulk (UC10)', () => {
    it('creates all valid shifts in one batch and records a single bulk history entry', async () => {
      vi.mocked(shiftRepository.createShift)
        .mockResolvedValueOnce({ ...baseShift, id: 'shift-1' })
        .mockResolvedValueOnce({ ...baseShift, id: 'shift-2' })
      vi.mocked(shiftRepository.createShiftAssignment).mockResolvedValue({} as never)

      const result = await shiftService.createShiftsInBulk({
        company_id: 'company-1',
        created_by: 'owner-1',
        items: [
          { department_id: 'dept-1', shift_date: '2026-06-22', start_time: '09:00', end_time: '17:00', assigned_user_id: 'user-1' },
          { department_id: 'dept-1', shift_date: '2026-06-23', start_time: '09:00', end_time: '17:00', assigned_user_id: null },
        ],
      })

      expect(result.created).toHaveLength(2)
      expect(result.failed).toHaveLength(0)
      expect(shiftRepository.createActionHistory).toHaveBeenCalledTimes(1)
      expect(shiftRepository.createActionHistory).toHaveBeenCalledWith(expect.objectContaining({
        action_type: 'bulk',
        affected_shift_ids: ['shift-1', 'shift-2'],
      }))
    })

    // BUG-021: overnight shifts (end_time on the following day) are valid — only an exact
    // start===end match fails.
    it('collects per-row failures without aborting the batch', async () => {
      vi.mocked(shiftRepository.createShift).mockResolvedValue(baseShift)
      vi.mocked(shiftRepository.createShiftAssignment).mockResolvedValue({} as never)

      const result = await shiftService.createShiftsInBulk({
        company_id: 'company-1',
        created_by: 'owner-1',
        items: [
          { department_id: 'dept-1', shift_date: '2026-06-22', start_time: '09:00', end_time: '17:00' },
          { department_id: 'dept-1', shift_date: '2026-06-22', start_time: '09:00', end_time: '09:00' },
        ],
      })

      expect(result.created).toHaveLength(1)
      expect(result.failed).toHaveLength(1)
      expect(result.failed[0].message).toBe('start_time and end_time cannot be the same')
    })
  })

  describe('getTimelineShifts', () => {
    it('groups shifts by member and includes unassigned open shifts under their department', async () => {
      vi.mocked(shiftRepository.getShiftsByCompanyAndDateRange).mockResolvedValue([
        { ...baseShift, id: 'shift-assigned', department_id: 'dept-1' },
        { ...baseShift, id: 'shift-open', department_id: 'dept-1' },
      ])
      vi.mocked(shiftRepository.getCompanyMembers).mockResolvedValue([
        { id: 'user-1', full_name: 'Alice', role: 'Employee', department_id: 'dept-1' } as never,
      ])
      vi.mocked(shiftRepository.getAssignmentsByShiftIds).mockResolvedValue([
        {
          id: 'assign-1',
          shift_id: 'shift-assigned',
          user_id: 'user-1',
          assigned_by: 'owner-1',
          supervisor_employee_id: null, user_name_snapshot: null,
          created_at: '2026-06-01T00:00:00.000Z',
        },
      ])
      vi.mocked(shiftRepository.getDepartmentsByIds).mockResolvedValue([{ id: 'dept-1', name: 'Kitchen' }])
      vi.mocked(shiftRepository.getUsersByIds).mockResolvedValue([])

      const rows = await shiftService.getTimelineShifts('company-1', '2026-06-22', '2026-06-28')

      expect(shiftRepository.getShiftsByCompanyAndDateRange).toHaveBeenCalledWith('company-1', '2026-06-22', '2026-06-28')
      expect(rows).toHaveLength(2)
      const aliceRow = rows.find(r => r.user_id === 'user-1')
      expect(aliceRow?.shifts).toHaveLength(1)
      const openRow = rows.find(r => r.user_id === null)
      expect(openRow?.full_name).toBe('Open Shift')
      expect(openRow?.shifts).toHaveLength(1)
    })

    it('excludes shifts and members whose department has been deleted', async () => {
      vi.mocked(shiftRepository.getShiftsByCompanyAndDateRange).mockResolvedValue([
        { ...baseShift, id: 'shift-orphan', department_id: 'dept-deleted' },
      ])
      vi.mocked(shiftRepository.getCompanyMembers).mockResolvedValue([
        { id: 'user-1', full_name: 'Alice', role: 'Employee', department_id: 'dept-deleted' } as never,
      ])
      vi.mocked(shiftRepository.getAssignmentsByShiftIds).mockResolvedValue([])
      vi.mocked(shiftRepository.getDepartmentsByIds).mockResolvedValue([])
      vi.mocked(shiftRepository.getUsersByIds).mockResolvedValue([])

      const rows = await shiftService.getTimelineShifts('company-1', '2026-06-22', '2026-06-28')

      expect(rows).toHaveLength(0)
    })

    it('hides draft shifts from Employee and Casual Worker viewers', async () => {
      vi.mocked(shiftRepository.getShiftsByCompanyAndDateRange).mockResolvedValue([
        { ...baseShift, id: 'shift-draft', department_id: 'dept-1', publication_status: 'draft' },
        { ...baseShift, id: 'shift-published', department_id: 'dept-1', publication_status: 'published' },
      ])
      vi.mocked(shiftRepository.getCompanyMembers).mockResolvedValue([
        { id: 'user-1', full_name: 'Alice', role: 'Employee', department_id: 'dept-1' } as never,
      ])
      vi.mocked(shiftRepository.getAssignmentsByShiftIds).mockResolvedValue([])
      vi.mocked(shiftRepository.getDepartmentsByIds).mockResolvedValue([{ id: 'dept-1', name: 'Kitchen' }])
      vi.mocked(shiftRepository.getUsersByIds).mockResolvedValue([])

      const rows = await shiftService.getTimelineShifts('company-1', '2026-06-22', '2026-06-28', { role: 'Employee' })

      const allShiftIds = rows.flatMap(r => r.shifts.map(s => s.id))
      expect(allShiftIds).toEqual(['shift-published'])
    })

    it('hides draft shifts from a Manager viewer, even in their own department', async () => {
      vi.mocked(shiftRepository.getShiftsByCompanyAndDateRange).mockResolvedValue([
        { ...baseShift, id: 'shift-own-draft', department_id: 'dept-1', publication_status: 'draft' },
        { ...baseShift, id: 'shift-other-draft', department_id: 'dept-2', publication_status: 'draft' },
        { ...baseShift, id: 'shift-other-published', department_id: 'dept-2', publication_status: 'published' },
      ])
      vi.mocked(shiftRepository.getCompanyMembers).mockResolvedValue([
        { id: 'manager-1', full_name: 'Manager One', role: 'Manager', department_id: 'dept-1' } as never,
      ])
      vi.mocked(shiftRepository.getAssignmentsByShiftIds).mockResolvedValue([])
      vi.mocked(shiftRepository.getDepartmentsByIds).mockResolvedValue([
        { id: 'dept-1', name: 'Kitchen' },
        { id: 'dept-2', name: 'Floor' },
      ])
      vi.mocked(shiftRepository.getUsersByIds).mockResolvedValue([])

      const rows = await shiftService.getTimelineShifts('company-1', '2026-06-22', '2026-06-28', {
        role: 'Manager',
        user_id: 'manager-1',
      })

      const allShiftIds = rows.flatMap(r => r.shifts.map(s => s.id))
      expect(allShiftIds).toEqual(['shift-other-published'])
    })

    it('does not filter shifts for Owner or Partner viewers', async () => {
      vi.mocked(shiftRepository.getShiftsByCompanyAndDateRange).mockResolvedValue([
        { ...baseShift, id: 'shift-draft', department_id: 'dept-1', publication_status: 'draft' },
      ])
      vi.mocked(shiftRepository.getCompanyMembers).mockResolvedValue([])
      vi.mocked(shiftRepository.getAssignmentsByShiftIds).mockResolvedValue([])
      vi.mocked(shiftRepository.getDepartmentsByIds).mockResolvedValue([{ id: 'dept-1', name: 'Kitchen' }])
      vi.mocked(shiftRepository.getUsersByIds).mockResolvedValue([])

      const rows = await shiftService.getTimelineShifts('company-1', '2026-06-22', '2026-06-28', { role: 'Owner' })

      const allShiftIds = rows.flatMap(r => r.shifts.map(s => s.id))
      expect(allShiftIds).toEqual(['shift-draft'])
    })
  })

  describe('deleteShiftAssignment', () => {
    it('deletes an existing assignment', async () => {
      vi.mocked(shiftRepository.getAssignmentById).mockResolvedValue({
        id: 'assign-1',
        shift_id: 'shift-1',
        user_id: 'user-1',
        assigned_by: 'owner-1',
        supervisor_employee_id: null, user_name_snapshot: null,
        created_at: '2026-06-01T00:00:00.000Z',
      })
      vi.mocked(shiftRepository.deleteAssignmentById).mockResolvedValue(undefined)

      await shiftService.deleteShiftAssignment('assign-1')

      expect(shiftRepository.deleteAssignmentById).toHaveBeenCalledWith('assign-1')
    })

    it('throws when the assignment does not exist', async () => {
      vi.mocked(shiftRepository.getAssignmentById).mockResolvedValue(null)

      await expect(shiftService.deleteShiftAssignment('missing')).rejects.toThrow('Shift assignment not found')
    })
  })

  describe('createShift (UC1) — records undo history', () => {
    it('records a create action history entry', async () => {
      vi.mocked(shiftRepository.createShift).mockResolvedValue(baseShift)
      vi.mocked(shiftRepository.createActionHistory).mockResolvedValue({} as never)

      await shiftService.createShift({
        company_id: 'company-1',
        department_id: 'dept-1',
        shift_date: '2026-06-22',
        start_time: '09:00',
        end_time: '17:00',
        created_by: 'owner-1',
      })

      expect(shiftRepository.createActionHistory).toHaveBeenCalledWith(expect.objectContaining({
        company_id: 'company-1',
        performed_by: 'owner-1',
        action_type: 'create',
        affected_shift_ids: [baseShift.id],
      }))
    })
  })

  describe('undoLastShiftAction', () => {
    it('throws when there is no recent action to undo', async () => {
      vi.mocked(shiftRepository.getLatestUndoableAction).mockResolvedValue(null)

      await expect(shiftService.undoLastShiftAction('company-1', 'owner-1')).rejects.toThrow(
        'No recent shift action to undo',
      )
    })

    it('undoes a create action by deleting the created shift', async () => {
      vi.mocked(shiftRepository.getLatestUndoableAction).mockResolvedValue({
        id: 'history-1',
        company_id: 'company-1',
        performed_by: 'owner-1',
        action_type: 'create',
        affected_shift_ids: ['shift-1'],
        undo_payload: { created_shift_ids: ['shift-1'] },
        undone: false,
        created_at: '2026-06-22T00:00:00.000Z',
      })
      vi.mocked(shiftRepository.getShiftsByIds).mockResolvedValue([baseShift])
      vi.mocked(shiftRepository.getAssignmentsByShiftIds).mockResolvedValue([])
      vi.mocked(shiftRepository.markActionUndone).mockResolvedValue(undefined)

      const result = await shiftService.undoLastShiftAction('company-1', 'owner-1')

      expect(shiftRepository.deleteAssignmentsByShiftIds).toHaveBeenCalledWith(['shift-1'], 'delete')
      expect(shiftRepository.deleteShiftsByIds).toHaveBeenCalledWith(['shift-1'])
      expect(shiftRepository.markActionUndone).toHaveBeenCalledWith('history-1', expect.objectContaining({
        recreate_shifts: [baseShift],
      }))
      expect(result.action_type).toBe('create')
    })

    it('undoes a delete action by restoring the deleted shift and assignments', async () => {
      const deletedAssignment = {
        id: 'assign-1',
        shift_id: 'shift-1',
        user_id: 'user-1',
        assigned_by: 'owner-1',
        supervisor_employee_id: null, user_name_snapshot: null,
        created_at: '2026-06-01T00:00:00.000Z',
      }
      vi.mocked(shiftRepository.getLatestUndoableAction).mockResolvedValue({
        id: 'history-2',
        company_id: 'company-1',
        performed_by: 'owner-1',
        action_type: 'delete',
        affected_shift_ids: ['shift-1'],
        undo_payload: { deleted_shifts: [baseShift], deleted_assignments: [deletedAssignment] },
        undone: false,
        created_at: '2026-06-22T00:00:00.000Z',
      })
      vi.mocked(shiftRepository.restoreShifts).mockResolvedValue([baseShift])
      vi.mocked(shiftRepository.restoreShiftAssignments).mockResolvedValue(undefined)
      vi.mocked(shiftRepository.markActionUndone).mockResolvedValue(undefined)

      const result = await shiftService.undoLastShiftAction('company-1', 'owner-1')

      expect(shiftRepository.restoreShifts).toHaveBeenCalledWith([baseShift])
      expect(shiftRepository.restoreShiftAssignments).toHaveBeenCalledWith([deletedAssignment])
      expect(shiftRepository.markActionUndone).toHaveBeenCalledWith('history-2', {})
      expect(result.action_type).toBe('delete')
    })

    it('undoes an edit action by restoring the previous shift fields and assignments', async () => {
      const previousShift = { ...baseShift, start_time: '07:00' }
      vi.mocked(shiftRepository.getLatestUndoableAction).mockResolvedValue({
        id: 'history-3',
        company_id: 'company-1',
        performed_by: 'owner-1',
        action_type: 'edit',
        affected_shift_ids: ['shift-1'],
        undo_payload: { previous_shift: previousShift, previous_assignments: [] },
        undone: false,
        created_at: '2026-06-22T00:00:00.000Z',
      })
      vi.mocked(shiftRepository.getShiftsByIds).mockResolvedValue([baseShift])
      vi.mocked(shiftRepository.getAssignmentsByShiftIds).mockResolvedValue([])
      vi.mocked(shiftRepository.restoreShiftAssignments).mockResolvedValue(undefined)
      vi.mocked(shiftRepository.markActionUndone).mockResolvedValue(undefined)

      const result = await shiftService.undoLastShiftAction('company-1', 'owner-1')

      expect(shiftRepository.upsertShifts).toHaveBeenCalledWith([previousShift])
      expect(shiftRepository.deleteAssignmentsByShiftIds).toHaveBeenCalledWith(['shift-1'])
      expect(shiftRepository.markActionUndone).toHaveBeenCalledWith('history-3', expect.objectContaining({
        next_shift: baseShift,
      }))
      expect(result.action_type).toBe('edit')
    })

    it('undoes a bulk/duplicate/recurrence/split action by deleting all affected shifts', async () => {
      vi.mocked(shiftRepository.getLatestUndoableAction).mockResolvedValue({
        id: 'history-4',
        company_id: 'company-1',
        performed_by: 'owner-1',
        action_type: 'bulk',
        affected_shift_ids: ['shift-1', 'shift-2'],
        undo_payload: { created_shift_ids: ['shift-1', 'shift-2'] },
        undone: false,
        created_at: '2026-06-22T00:00:00.000Z',
      })
      vi.mocked(shiftRepository.getShiftsByIds).mockResolvedValue([baseShift, { ...baseShift, id: 'shift-2' }])
      vi.mocked(shiftRepository.getAssignmentsByShiftIds).mockResolvedValue([])
      vi.mocked(shiftRepository.markActionUndone).mockResolvedValue(undefined)

      await shiftService.undoLastShiftAction('company-1', 'owner-1')

      expect(shiftRepository.deleteAssignmentsByShiftIds).toHaveBeenCalledWith(['shift-1', 'shift-2'], 'delete')
      expect(shiftRepository.deleteShiftsByIds).toHaveBeenCalledWith(['shift-1', 'shift-2'])
    })

    it('undoes a publish action by restoring each shift\'s previous publication_status', async () => {
      vi.mocked(shiftRepository.getLatestUndoableAction).mockResolvedValue({
        id: 'history-5',
        company_id: 'company-1',
        performed_by: 'owner-1',
        action_type: 'publish',
        affected_shift_ids: ['shift-1'],
        undo_payload: { previous_publication_statuses: [{ id: 'shift-1', publication_status: 'draft' }] },
        undone: false,
        created_at: '2026-06-22T00:00:00.000Z',
      })
      vi.mocked(shiftRepository.getShiftsByIds).mockResolvedValue([{ ...baseShift, publication_status: 'published' }])
      vi.mocked(shiftRepository.markActionUndone).mockResolvedValue(undefined)

      const result = await shiftService.undoLastShiftAction('company-1', 'owner-1')

      expect(shiftRepository.updatePublicationStatusByIds).toHaveBeenCalledWith(['shift-1'], 'draft')
      expect(shiftRepository.markActionUndone).toHaveBeenCalledWith('history-5', expect.objectContaining({
        next_publication_statuses: [{ id: 'shift-1', publication_status: 'published' }],
      }))
      expect(result.action_type).toBe('publish')
    })
  })

  describe('redoLastUndoneAction', () => {
    it('throws when there is no recently undone action to redo', async () => {
      vi.mocked(shiftRepository.getLatestRedoableAction).mockResolvedValue(null)

      await expect(shiftService.redoLastUndoneAction('company-1', 'owner-1')).rejects.toThrow(
        'No recently undone action to redo',
      )
    })

    it('redoes an undone create action by recreating the shift', async () => {
      vi.mocked(shiftRepository.getLatestRedoableAction).mockResolvedValue({
        id: 'history-1',
        company_id: 'company-1',
        performed_by: 'owner-1',
        action_type: 'create',
        affected_shift_ids: ['shift-1'],
        undo_payload: { created_shift_ids: ['shift-1'] },
        redo_payload: { recreate_shifts: [baseShift], recreate_assignments: [] },
        undone: true,
        created_at: '2026-06-22T00:00:00.000Z',
      })
      vi.mocked(shiftRepository.restoreShifts).mockResolvedValue([baseShift])
      vi.mocked(shiftRepository.restoreShiftAssignments).mockResolvedValue(undefined)
      vi.mocked(shiftRepository.markActionRedone).mockResolvedValue(undefined)

      const result = await shiftService.redoLastUndoneAction('company-1', 'owner-1')

      expect(shiftRepository.restoreShifts).toHaveBeenCalledWith([baseShift])
      expect(shiftRepository.markActionRedone).toHaveBeenCalledWith('history-1')
      expect(result.action_type).toBe('create')
    })

    it('redoes an undone delete action by deleting the shift again', async () => {
      vi.mocked(shiftRepository.getLatestRedoableAction).mockResolvedValue({
        id: 'history-2',
        company_id: 'company-1',
        performed_by: 'owner-1',
        action_type: 'delete',
        affected_shift_ids: ['shift-1'],
        undo_payload: { deleted_shifts: [baseShift], deleted_assignments: [] },
        redo_payload: {},
        undone: true,
        created_at: '2026-06-22T00:00:00.000Z',
      })
      vi.mocked(shiftRepository.markActionRedone).mockResolvedValue(undefined)

      const result = await shiftService.redoLastUndoneAction('company-1', 'owner-1')

      expect(shiftRepository.deleteAssignmentsByShiftIds).toHaveBeenCalledWith(['shift-1'], 'delete')
      expect(shiftRepository.deleteShiftsByIds).toHaveBeenCalledWith(['shift-1'])
      expect(result.action_type).toBe('delete')
    })

    it('redoes an undone edit action by reapplying the forward shift fields', async () => {
      const nextShift = { ...baseShift, start_time: '11:00' }
      vi.mocked(shiftRepository.getLatestRedoableAction).mockResolvedValue({
        id: 'history-3',
        company_id: 'company-1',
        performed_by: 'owner-1',
        action_type: 'edit',
        affected_shift_ids: ['shift-1'],
        undo_payload: { previous_shift: baseShift, previous_assignments: [] },
        redo_payload: { next_shift: nextShift, next_assignments: [] },
        undone: true,
        created_at: '2026-06-22T00:00:00.000Z',
      })
      vi.mocked(shiftRepository.restoreShiftAssignments).mockResolvedValue(undefined)
      vi.mocked(shiftRepository.markActionRedone).mockResolvedValue(undefined)

      const result = await shiftService.redoLastUndoneAction('company-1', 'owner-1')

      expect(shiftRepository.upsertShifts).toHaveBeenCalledWith([nextShift])
      expect(shiftRepository.deleteAssignmentsByShiftIds).toHaveBeenCalledWith(['shift-1'])
      expect(result.action_type).toBe('edit')
    })

    it('redoes an undone publish action by reapplying the forward publication_status', async () => {
      vi.mocked(shiftRepository.getLatestRedoableAction).mockResolvedValue({
        id: 'history-5',
        company_id: 'company-1',
        performed_by: 'owner-1',
        action_type: 'publish',
        affected_shift_ids: ['shift-1'],
        undo_payload: { previous_publication_statuses: [{ id: 'shift-1', publication_status: 'draft' }] },
        redo_payload: { next_publication_statuses: [{ id: 'shift-1', publication_status: 'published' }] },
        undone: true,
        created_at: '2026-06-22T00:00:00.000Z',
      })
      vi.mocked(shiftRepository.markActionRedone).mockResolvedValue(undefined)

      const result = await shiftService.redoLastUndoneAction('company-1', 'owner-1')

      expect(shiftRepository.updatePublicationStatusByIds).toHaveBeenCalledWith(['shift-1'], 'published')
      expect(result.action_type).toBe('publish')
    })
  })
})
