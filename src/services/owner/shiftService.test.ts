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
    createActionHistory: vi.fn(),
    getLatestUndoableAction: vi.fn(),
    markActionUndone: vi.fn(),
    restoreShift: vi.fn(),
    restoreShiftAssignments: vi.fn(),
  },
}))

vi.mock('@/services/owner/schedulingRuleService', () => ({
  schedulingRuleService: {
    validateSchedule: vi.fn(),
  },
}))

import { shiftService } from './shiftService'
import { shiftRepository } from '@/repositories/owner/shiftRepository'
import { schedulingRuleService } from '@/services/owner/schedulingRuleService'

const baseShift = {
  id: 'shift-1',
  company_id: 'company-1',
  department_id: 'dept-1',
  title: null,
  instruction: null,
  shift_date: '2026-06-22',
  start_time: '09:00',
  end_time: '17:00',
  status: 'active' as const,
  publication_status: 'draft' as const,
  acceptance_deadline_at: null,
  recurrence_group_id: null,
  recurrence_rule: null,
  source_shift_id: null,
  split_group_id: null,
  created_by: 'owner-1',
  created_at: '2026-06-01T00:00:00.000Z',
  updated_at: '2026-06-01T00:00:00.000Z',
}

describe('shiftService — Shift (UC1-8, UC10, UC12)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(shiftRepository.getAssignmentsByUserAndDateRange).mockResolvedValue([])
  })

  describe('createShift (UC3)', () => {
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
        assignment_status: 'assigned',
        supervisor_employee_id: null,
        created_at: '2026-06-01T00:00:00.000Z',
        updated_at: '2026-06-01T00:00:00.000Z',
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

    it('rejects when start_time is not before end_time', async () => {
      await expect(shiftService.createShift({
        company_id: 'company-1',
        department_id: 'dept-1',
        shift_date: '2026-06-22',
        start_time: '17:00',
        end_time: '09:00',
        created_by: 'owner-1',
      })).rejects.toThrow('start_time must be before end_time')
    })

    it('rejects an acceptance_deadline_at that is after the shift starts', async () => {
      await expect(shiftService.createShift({
        company_id: 'company-1',
        department_id: 'dept-1',
        shift_date: '2026-06-22',
        start_time: '09:00',
        end_time: '17:00',
        created_by: 'owner-1',
        acceptance_deadline_at: '2026-06-22T10:00:00.000Z',
      })).rejects.toThrow('acceptance_deadline_at must be before the shift starts')
    })

    it('throws a CLOPENING_CONFLICT error when rest hours are below the minimum and override is not set (UC10)', async () => {
      vi.mocked(shiftRepository.getAssignmentsByUserAndDateRange).mockResolvedValue([
        {
          id: 'assign-prev',
          shift_id: 'shift-prev',
          user_id: 'user-1',
          assigned_by: 'owner-1',
          assignment_status: 'assigned',
          supervisor_employee_id: null,
          created_at: '2026-06-01T00:00:00.000Z',
          updated_at: '2026-06-01T00:00:00.000Z',
          shifts: { ...baseShift, id: 'shift-prev', shift_date: '2026-06-21', start_time: '14:00', end_time: '22:00' },
        },
      ])

      await expect(shiftService.createShift({
        company_id: 'company-1',
        department_id: 'dept-1',
        shift_date: '2026-06-22',
        start_time: '06:00',
        end_time: '14:00',
        created_by: 'owner-1',
        assigned_user_id: 'user-1',
      })).rejects.toThrow(/CLOPENING_CONFLICT/)
      expect(shiftRepository.createShift).not.toHaveBeenCalled()
    })

    it('creates the shift despite a clopening conflict when override_clopening is true (UC10)', async () => {
      vi.mocked(shiftRepository.getAssignmentsByUserAndDateRange).mockResolvedValue([
        {
          id: 'assign-prev',
          shift_id: 'shift-prev',
          user_id: 'user-1',
          assigned_by: 'owner-1',
          assignment_status: 'assigned',
          supervisor_employee_id: null,
          created_at: '2026-06-01T00:00:00.000Z',
          updated_at: '2026-06-01T00:00:00.000Z',
          shifts: { ...baseShift, id: 'shift-prev', shift_date: '2026-06-21', start_time: '14:00', end_time: '22:00' },
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
        override_clopening: true,
      })

      expect(shiftRepository.createShift).toHaveBeenCalled()
      expect(result.warning).not.toBeNull()
    })
  })

  describe('createSplitShift (UC9)', () => {
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

    it('blocks creation on a clopening conflict unless overridden', async () => {
      vi.mocked(shiftRepository.getAssignmentsByUserAndDateRange).mockResolvedValue([
        {
          id: 'assign-prev',
          shift_id: 'shift-prev',
          user_id: 'user-1',
          assigned_by: 'owner-1',
          assignment_status: 'assigned',
          supervisor_employee_id: null,
          created_at: '2026-06-01T00:00:00.000Z',
          updated_at: '2026-06-01T00:00:00.000Z',
          shifts: { ...baseShift, id: 'shift-prev', shift_date: '2026-06-21', start_time: '20:00', end_time: '23:59' },
        },
      ])

      await expect(shiftService.createSplitShift({
        company_id: 'company-1',
        department_id: 'dept-1',
        shift_date: '2026-06-22',
        blocks: [
          { start_time: '06:00', end_time: '10:00' },
          { start_time: '14:00', end_time: '18:00' },
        ],
        created_by: 'owner-1',
        assigned_user_id: 'user-1',
      })).rejects.toThrow(/CLOPENING_CONFLICT/)
      expect(shiftRepository.createShift).not.toHaveBeenCalled()
    })
  })

  describe('editShift (UC4)', () => {
    it('updates fields on an existing shift', async () => {
      vi.mocked(shiftRepository.getShiftById).mockResolvedValue(baseShift)
      vi.mocked(shiftRepository.updateShift).mockResolvedValue({ ...baseShift, title: 'Morning' })

      const result = await shiftService.editShift('shift-1', { title: 'Morning' })

      expect(shiftRepository.updateShift).toHaveBeenCalledWith('shift-1', { title: 'Morning' })
      expect(result.shift.title).toBe('Morning')
    })

    it('throws when the shift does not exist', async () => {
      vi.mocked(shiftRepository.getShiftById).mockResolvedValue(null)

      await expect(shiftService.editShift('missing', { title: 'X' })).rejects.toThrow('Shift not found')
    })

    it('rejects an edit that makes start_time after end_time', async () => {
      vi.mocked(shiftRepository.getShiftById).mockResolvedValue(baseShift)

      await expect(shiftService.editShift('shift-1', { start_time: '18:00' })).rejects.toThrow(
        'start_time must be before end_time',
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

    it('clears the assignment without creating a new one when assigned_user_id is null', async () => {
      vi.mocked(shiftRepository.getShiftById).mockResolvedValue(baseShift)
      vi.mocked(shiftRepository.deleteAssignmentsByShiftId).mockResolvedValue(undefined)

      await shiftService.editShift('shift-1', {}, {
        assigned_user_id: null,
        assigned_by: 'owner-1',
        supervisor_employee_id: null,
      })

      expect(shiftRepository.deleteAssignmentsByShiftId).toHaveBeenCalledWith('shift-1')
      expect(shiftRepository.createShiftAssignment).not.toHaveBeenCalled()
    })
  })

  describe('publishSchedule (UC6)', () => {
    it('publishes a schedule that passes hard-rule validation', async () => {
      vi.mocked(schedulingRuleService.validateSchedule).mockResolvedValue({ valid: true, errors: [], warnings: [] })
      vi.mocked(shiftRepository.updateSchedulePublication).mockResolvedValue([baseShift])

      const result = await shiftService.publishSchedule({
        company_id: 'company-1',
        date_from: '2026-06-22',
        date_to: '2026-06-28',
        publication_status: 'published',
      })

      expect(shiftRepository.updateSchedulePublication).toHaveBeenCalled()
      expect(result.shifts).toEqual([baseShift])
    })

    it('allows unpublishing (draft) without running hard-rule validation gate', async () => {
      vi.mocked(schedulingRuleService.validateSchedule).mockResolvedValue({ valid: false, errors: [{ rule_key: 'weekly_hours_limit', rule_name: 'x', severity: 'error', message: 'bad' }], warnings: [] })
      vi.mocked(shiftRepository.updateSchedulePublication).mockResolvedValue([baseShift])

      const result = await shiftService.publishSchedule({
        company_id: 'company-1',
        date_from: '2026-06-22',
        date_to: '2026-06-28',
        publication_status: 'draft',
      })

      expect(shiftRepository.updateSchedulePublication).toHaveBeenCalled()
      expect(result.shifts).toEqual([baseShift])
    })

    it('blocks publishing when hard-rule validation fails', async () => {
      vi.mocked(schedulingRuleService.validateSchedule).mockResolvedValue({
        valid: false,
        errors: [{ rule_key: 'weekly_hours_limit', rule_name: 'Weekly hours', severity: 'error', message: 'Worker exceeds weekly hours' }],
        warnings: [],
      })

      await expect(shiftService.publishSchedule({
        company_id: 'company-1',
        date_from: '2026-06-22',
        date_to: '2026-06-28',
        publication_status: 'published',
      })).rejects.toThrow('Worker exceeds weekly hours')
      expect(shiftRepository.updateSchedulePublication).not.toHaveBeenCalled()
    })

    it('rejects an inverted date range', async () => {
      await expect(shiftService.publishSchedule({
        company_id: 'company-1',
        date_from: '2026-06-28',
        date_to: '2026-06-22',
        publication_status: 'draft',
      })).rejects.toThrow('date_from must be before date_to')
    })
  })

  describe('duplicateShift (UC7)', () => {
    it('duplicates a shift as a draft, carrying over the original assignment', async () => {
      vi.mocked(shiftRepository.getShiftById).mockResolvedValue(baseShift)
      vi.mocked(shiftRepository.getAssignmentsByShiftIds).mockResolvedValue([{
        id: 'assign-1',
        shift_id: 'shift-1',
        user_id: 'user-1',
        assigned_by: 'owner-1',
        assignment_status: 'assigned',
        supervisor_employee_id: null,
        created_at: '2026-06-01T00:00:00.000Z',
        updated_at: '2026-06-01T00:00:00.000Z',
      }])
      const duplicated = { ...baseShift, id: 'shift-2', shift_date: '2026-06-23', source_shift_id: 'shift-1', publication_status: 'draft' as const }
      vi.mocked(shiftRepository.createShift).mockResolvedValue(duplicated)
      vi.mocked(shiftRepository.createShiftAssignment).mockResolvedValue({} as never)

      const result = await shiftService.duplicateShift('shift-1', {
        shift_date: '2026-06-23',
        start_time: '09:00',
        end_time: '17:00',
        created_by: 'owner-1',
      })

      expect(shiftRepository.createShift).toHaveBeenCalledWith(expect.objectContaining({
        source_shift_id: 'shift-1',
        publication_status: 'draft',
      }))
      expect(shiftRepository.createShiftAssignment).toHaveBeenCalledWith(expect.objectContaining({ user_id: 'user-1' }))
      expect(result.shift).toEqual(duplicated)
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

  describe('createRecurringShifts (UC8)', () => {
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
  })

  describe('deleteShift (UC5)', () => {
    it('deletes assignments then the shift', async () => {
      vi.mocked(shiftRepository.getShiftById).mockResolvedValue(baseShift)
      vi.mocked(shiftRepository.deleteAssignmentsByShiftId).mockResolvedValue(undefined)
      vi.mocked(shiftRepository.deleteShift).mockResolvedValue(undefined)

      await shiftService.deleteShift('shift-1')

      expect(shiftRepository.deleteAssignmentsByShiftId).toHaveBeenCalledWith('shift-1')
      expect(shiftRepository.deleteShift).toHaveBeenCalledWith('shift-1')
    })

    it('throws when the shift does not exist', async () => {
      vi.mocked(shiftRepository.getShiftById).mockResolvedValue(null)

      await expect(shiftService.deleteShift('missing')).rejects.toThrow('Shift not found')
      expect(shiftRepository.deleteShift).not.toHaveBeenCalled()
    })
  })

  describe('assignShiftsInBulk (UC12)', () => {
    it('creates shifts for valid assignments and collects failures for invalid ones', async () => {
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
        ],
      })

      expect(result.created).toHaveLength(1)
      expect(result.failed).toHaveLength(2)
      expect(result.failed[0].message).toBe('Missing required fields')
      expect(result.failed[1].message).toBe('start_time must be before end_time')
    })
  })

  describe('getTimelineShifts (UC1, UC2)', () => {
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
          assignment_status: 'assigned',
          supervisor_employee_id: null,
          created_at: '2026-06-01T00:00:00.000Z',
          updated_at: '2026-06-01T00:00:00.000Z',
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
  })

  describe('deleteShiftAssignment', () => {
    it('deletes an existing assignment', async () => {
      vi.mocked(shiftRepository.getAssignmentById).mockResolvedValue({
        id: 'assign-1',
        shift_id: 'shift-1',
        user_id: 'user-1',
        assigned_by: 'owner-1',
        assignment_status: 'assigned',
        supervisor_employee_id: null,
        created_at: '2026-06-01T00:00:00.000Z',
        updated_at: '2026-06-01T00:00:00.000Z',
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

  describe('createShift (UC3) — records undo history', () => {
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

  describe('undoLastShiftAction (UC11)', () => {
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
      vi.mocked(shiftRepository.deleteAssignmentsByShiftId).mockResolvedValue(undefined)
      vi.mocked(shiftRepository.deleteShift).mockResolvedValue(undefined)
      vi.mocked(shiftRepository.markActionUndone).mockResolvedValue(undefined)

      const result = await shiftService.undoLastShiftAction('company-1', 'owner-1')

      expect(shiftRepository.deleteAssignmentsByShiftId).toHaveBeenCalledWith('shift-1')
      expect(shiftRepository.deleteShift).toHaveBeenCalledWith('shift-1')
      expect(shiftRepository.markActionUndone).toHaveBeenCalledWith('history-1')
      expect(result.action_type).toBe('create')
    })

    it('undoes a delete action by restoring the deleted shift and assignments', async () => {
      const deletedAssignment = {
        id: 'assign-1',
        shift_id: 'shift-1',
        user_id: 'user-1',
        assigned_by: 'owner-1',
        assignment_status: 'assigned' as const,
        supervisor_employee_id: null,
        created_at: '2026-06-01T00:00:00.000Z',
        updated_at: '2026-06-01T00:00:00.000Z',
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
      vi.mocked(shiftRepository.restoreShift).mockResolvedValue(baseShift)
      vi.mocked(shiftRepository.restoreShiftAssignments).mockResolvedValue(undefined)
      vi.mocked(shiftRepository.markActionUndone).mockResolvedValue(undefined)

      const result = await shiftService.undoLastShiftAction('company-1', 'owner-1')

      expect(shiftRepository.restoreShift).toHaveBeenCalledWith(baseShift)
      expect(shiftRepository.restoreShiftAssignments).toHaveBeenCalledWith([deletedAssignment])
      expect(result.action_type).toBe('delete')
    })

    it('undoes an edit action by restoring the previous shift fields and assignments', async () => {
      const previousShift = { ...baseShift, title: 'Old Title' }
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
      vi.mocked(shiftRepository.updateShift).mockResolvedValue(previousShift)
      vi.mocked(shiftRepository.deleteAssignmentsByShiftId).mockResolvedValue(undefined)
      vi.mocked(shiftRepository.restoreShiftAssignments).mockResolvedValue(undefined)
      vi.mocked(shiftRepository.markActionUndone).mockResolvedValue(undefined)

      const result = await shiftService.undoLastShiftAction('company-1', 'owner-1')

      expect(shiftRepository.updateShift).toHaveBeenCalledWith('shift-1', expect.objectContaining({ title: 'Old Title' }))
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
      vi.mocked(shiftRepository.deleteAssignmentsByShiftId).mockResolvedValue(undefined)
      vi.mocked(shiftRepository.deleteShift).mockResolvedValue(undefined)
      vi.mocked(shiftRepository.markActionUndone).mockResolvedValue(undefined)

      await shiftService.undoLastShiftAction('company-1', 'owner-1')

      expect(shiftRepository.deleteShift).toHaveBeenCalledWith('shift-1')
      expect(shiftRepository.deleteShift).toHaveBeenCalledWith('shift-2')
    })
  })
})
