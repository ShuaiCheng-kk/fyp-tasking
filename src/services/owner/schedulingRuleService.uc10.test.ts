import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase', () => ({
  supabase: {},
  createClient: () => ({}),
}))

const { mockCreate } = vi.hoisted(() => ({ mockCreate: vi.fn() }))
vi.mock('openai', () => ({
  default: vi.fn().mockImplementation(function (this: any) {
    this.chat = { completions: { create: mockCreate } }
  }),
}))

vi.mock('@/repositories/auth/authRepository', () => ({
  authRepository: {
    findByAuthIdOrInternalId: vi.fn(),
  },
}))

vi.mock('@/repositories/owner/schedulingRuleRepository', () => ({
  schedulingRuleRepository: {
    getCompanyUsers: vi.fn(),
    getOffDayRequests: vi.fn(),
    getPublishedOrDraftScheduleItems: vi.fn(),
  },
}))

vi.mock('@/repositories/owner/shiftRepository', () => ({
  shiftRepository: {
    createShift: vi.fn(),
    createShiftAssignment: vi.fn(),
    createActionHistory: vi.fn(),
  },
}))

import { schedulingRuleService } from './schedulingRuleService'
import { shiftService } from './shiftService'
import { authRepository } from '@/repositories/auth/authRepository'
import { schedulingRuleRepository } from '@/repositories/owner/schedulingRuleRepository'
import { shiftRepository } from '@/repositories/owner/shiftRepository'

async function* fakeAiStream(lines: string[]) {
  for (const line of lines) {
    yield { choices: [{ delta: { content: `${line}\n` } }] }
  }
}

describe('UC10 Generate AI Schedule Suggestion', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(schedulingRuleRepository.getOffDayRequests).mockResolvedValue([])
    vi.mocked(schedulingRuleRepository.getPublishedOrDraftScheduleItems).mockResolvedValue([])
  })

  it('UC10-M-UT-O: Owner generates an AI schedule suggestion for one department and date', async () => {
    vi.mocked(authRepository.findByAuthIdOrInternalId).mockResolvedValue({
      id: 'owner-1', role: 'Owner', company_id: 'comp-1',
    } as never)
    vi.mocked(schedulingRuleRepository.getCompanyUsers).mockResolvedValue([
      { id: 'mgr-1', full_name: 'Manager One', role: 'Manager', department_ids: ['dept-1'] } as never,
      { id: 'emp-1', full_name: 'Employee One', role: 'Employee', department_ids: ['dept-1'] } as never,
    ])

    const aiSuggestedLine = JSON.stringify({
      department_id: 'dept-1',
      shift_date: '2026-08-10',
      slots: [{
        shift_label: 'Day', start_time: '09:00', end_time: '17:00',
        assigned_user_id: 'someone-the-ai-guessed', assigned_user_name: 'Guessed Person', reason: 'fair_rotation',
      }],
      warning: null,
    })
    const noticeLine = JSON.stringify({ notice: 'Generated a balanced schedule for Dept 1.' })
    mockCreate.mockResolvedValueOnce(fakeAiStream([aiSuggestedLine, noticeLine]))

    const capturedBlocks: any[] = []
    const result = await schedulingRuleService.generateScheduleWithAIStream({
      company_id: 'comp-1',
      user_id: 'owner-1',
      date_from: '2026-08-10',
      date_to: '2026-08-10',
      department_ids: ['dept-1'],
      shiftTypes: [{ label: 'Day', start_time: '09:00', end_time: '17:00' }],
    }, block => capturedBlocks.push(block))

    expect(result.blockCount).toBe(1)
    expect(result.notice).toBe('Generated a balanced schedule for Dept 1.')
    expect(capturedBlocks).toHaveLength(1)
    expect(capturedBlocks[0].warning).toBeNull()
    expect(capturedBlocks[0].slots).toHaveLength(2)
    // The server's own eligibility/fairness algorithm always overrides whatever staff member the
    // AI suggested in its raw JSON — it recomputes the real pick from scratch, so "someone-the-ai-guessed"
    // never appears in the final result.
    const managerSlot = capturedBlocks[0].slots.find((s: any) => s.role === 'Manager')
    const employeeSlot = capturedBlocks[0].slots.find((s: any) => s.role === 'Employee')
    expect(managerSlot.assigned_user_id).toBe('mgr-1')
    expect(managerSlot.reason).toBe('Manager assigned to meet daily minimum requirement.')
    expect(employeeSlot.assigned_user_id).toBe('emp-1')
    expect(employeeSlot.reason).toBe('Employee assigned to meet daily minimum requirement.')
  })

  it('UC10-M-UT-P: Partner generates an AI schedule suggestion for one department and date', async () => {
    vi.mocked(authRepository.findByAuthIdOrInternalId).mockResolvedValue({
      id: 'partner-1', role: 'Partner', company_id: 'comp-1',
    } as never)
    vi.mocked(schedulingRuleRepository.getCompanyUsers).mockResolvedValue([
      { id: 'mgr-2', full_name: 'Manager Two', role: 'Manager', department_ids: ['dept-1'] } as never,
      { id: 'emp-2', full_name: 'Employee Two', role: 'Employee', department_ids: ['dept-1'] } as never,
    ])

    // The AI stream never sends a "notice" line this time, exercising the fallback notice text
    // the service generates on its own from the active hard-rule count.
    const aiSuggestedLine = JSON.stringify({
      department_id: 'dept-1', shift_date: '2026-08-10', slots: [], warning: null,
    })
    mockCreate.mockResolvedValueOnce(fakeAiStream([aiSuggestedLine]))

    const capturedBlocks: any[] = []
    const result = await schedulingRuleService.generateScheduleWithAIStream({
      company_id: 'comp-1',
      user_id: 'partner-1',
      date_from: '2026-08-10',
      date_to: '2026-08-10',
      department_ids: ['dept-1'],
      shiftTypes: [{ label: 'Day', start_time: '09:00', end_time: '17:00' }],
    }, block => capturedBlocks.push(block))

    expect(result.blockCount).toBe(1)
    expect(result.notice).toBe('AI checked 4 hard rules and generated the best available draft for Owner review.')
    expect(capturedBlocks[0].slots.find((s: any) => s.role === 'Manager').assigned_user_id).toBe('mgr-2')
    expect(capturedBlocks[0].slots.find((s: any) => s.role === 'Employee').assigned_user_id).toBe('emp-2')
  })

  it('UC10-A1-UT-O: Owner requests a combination that exceeds the 150-slot generation limit', async () => {
    vi.mocked(authRepository.findByAuthIdOrInternalId).mockResolvedValue({
      id: 'owner-1', role: 'Owner', company_id: 'comp-1',
    } as never)
    vi.mocked(schedulingRuleRepository.getCompanyUsers).mockResolvedValue([])

    // 1 department x 31 dates x 3 shift types x 2 required people per shift type = 186 slots, over the 150 cap.
    await expect(schedulingRuleService.generateScheduleWithAIStream({
      company_id: 'comp-1',
      user_id: 'owner-1',
      date_from: '2026-08-01',
      date_to: '2026-08-31',
      department_ids: ['dept-1'],
      shiftTypes: [
        { label: 'Morning', start_time: '06:00', end_time: '14:00' },
        { label: 'Afternoon', start_time: '14:00', end_time: '22:00' },
        { label: 'Night', start_time: '22:00', end_time: '06:00' },
      ],
    }, () => {})).rejects.toThrow('Too many shifts to generate at once (186). Narrow the date range, departments, or shift types and try again.')

    expect(mockCreate).not.toHaveBeenCalled()
  })

  it('UC10-A1-UT-P: Partner requests a combination that exceeds the 150-slot generation limit', async () => {
    vi.mocked(authRepository.findByAuthIdOrInternalId).mockResolvedValue({
      id: 'partner-1', role: 'Partner', company_id: 'comp-1',
    } as never)
    vi.mocked(schedulingRuleRepository.getCompanyUsers).mockResolvedValue([])

    await expect(schedulingRuleService.generateScheduleWithAIStream({
      company_id: 'comp-1',
      user_id: 'partner-1',
      date_from: '2026-08-01',
      date_to: '2026-08-31',
      department_ids: ['dept-1'],
      shiftTypes: [
        { label: 'Morning', start_time: '06:00', end_time: '14:00' },
        { label: 'Afternoon', start_time: '14:00', end_time: '22:00' },
        { label: 'Night', start_time: '22:00', end_time: '06:00' },
      ],
    }, () => {})).rejects.toThrow('Too many shifts to generate at once (186). Narrow the date range, departments, or shift types and try again.')

    expect(mockCreate).not.toHaveBeenCalled()
  })

  it('UC10-A2-UT-O: Owner accepts AI suggestions that violate a Hard Rule, and the shifts are still created', async () => {
    vi.mocked(schedulingRuleRepository.getCompanyUsers).mockResolvedValue([
      { id: 'emp-1', role: 'Employee' } as never,
    ])
    const understaffedItem = {
      department_id: 'dept-1', shift_date: '2026-08-10', start_time: '09:00', end_time: '17:00', user_id: 'emp-1',
    }

    // No Manager is on this shift at all, which violates the "minimum 1 manager per department per
    // active shift slot" Hard Rule.
    const validation = await schedulingRuleService.validateSchedule({
      company_id: 'comp-1', date_from: '2026-08-10', date_to: '2026-08-10', items: [understaffedItem],
    })
    expect(validation.valid).toBe(false)
    expect(validation.errors.some(e => e.rule_key === 'min_managers_per_department_day')).toBe(true)

    // Rules are advisory only — accepting and creating the draft shifts does not re-check
    // validateSchedule at all, so creation succeeds regardless of the violation just reported above.
    vi.mocked(shiftRepository.createShift).mockResolvedValue({
      id: 'shift-1', company_id: 'comp-1', department_id: 'dept-1', shift_date: '2026-08-10',
      start_time: '09:00', end_time: '17:00', status: 'active', publication_status: 'draft',
      recurrence_group_id: null, recurrence_rule: null, source_shift_id: null, split_group_id: null,
      template_id: null, source_job_posting_id: null, is_open_ended: false, hourly_rate: null, created_by: 'owner-1',
    } as never)
    vi.mocked(shiftRepository.createShiftAssignment).mockResolvedValue({} as never)
    vi.mocked(shiftRepository.createActionHistory).mockResolvedValue(undefined as never)

    const creation = await shiftService.createShiftsInBulk({
      company_id: 'comp-1',
      created_by: 'owner-1',
      items: [{ department_id: 'dept-1', shift_date: '2026-08-10', start_time: '09:00', end_time: '17:00', assigned_user_id: 'emp-1' }],
    })

    expect(creation.failed).toEqual([])
    expect(creation.created).toHaveLength(1)
  })

  it('UC10-A2-UT-P: Partner accepts AI suggestions that violate a Hard Rule, and the shifts are still created', async () => {
    vi.mocked(schedulingRuleRepository.getCompanyUsers).mockResolvedValue([
      { id: 'emp-2', role: 'Employee' } as never,
    ])
    const understaffedItem = {
      department_id: 'dept-1', shift_date: '2026-08-10', start_time: '09:00', end_time: '17:00', user_id: 'emp-2',
    }

    const validation = await schedulingRuleService.validateSchedule({
      company_id: 'comp-1', date_from: '2026-08-10', date_to: '2026-08-10', items: [understaffedItem],
    })
    expect(validation.valid).toBe(false)
    expect(validation.errors.some(e => e.rule_key === 'min_managers_per_department_day')).toBe(true)

    vi.mocked(shiftRepository.createShift).mockResolvedValue({
      id: 'shift-2', company_id: 'comp-1', department_id: 'dept-1', shift_date: '2026-08-10',
      start_time: '09:00', end_time: '17:00', status: 'active', publication_status: 'draft',
      recurrence_group_id: null, recurrence_rule: null, source_shift_id: null, split_group_id: null,
      template_id: null, source_job_posting_id: null, is_open_ended: false, hourly_rate: null, created_by: 'partner-1',
    } as never)
    vi.mocked(shiftRepository.createShiftAssignment).mockResolvedValue({} as never)
    vi.mocked(shiftRepository.createActionHistory).mockResolvedValue(undefined as never)

    const creation = await shiftService.createShiftsInBulk({
      company_id: 'comp-1',
      created_by: 'partner-1',
      items: [{ department_id: 'dept-1', shift_date: '2026-08-10', start_time: '09:00', end_time: '17:00', assigned_user_id: 'emp-2' }],
    })

    expect(creation.failed).toEqual([])
    expect(creation.created).toHaveLength(1)
  })
})
