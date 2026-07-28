import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase', () => ({
  supabase: {},
  createClient: () => ({}),
}))

vi.mock('@/services/ai/openAIService', () => ({
  openAIService: { generateStructuredJson: vi.fn() },
}))

vi.mock('@/repositories/owner/attendanceRepository', () => ({
  attendanceRepository: {
    getEmployeesByCompany: vi.fn(),
    getOffDayRequestsByCompanyAndWeek: vi.fn(),
  },
}))

vi.mock('@/repositories/owner/ownerTeamRepository', () => ({
  ownerTeamRepository: {
    findManagersByDepartment: vi.fn(),
  },
}))

import { requestAISuggestService } from './requestAISuggestService'
import { openAIService } from '@/services/ai/openAIService'
import { attendanceRepository } from '@/repositories/owner/attendanceRepository'
import { ownerTeamRepository } from '@/repositories/owner/ownerTeamRepository'

const stubSuggestion = {
  recommendation: 'approve' as const,
  confidence: 90,
  reason: 'Staffing is adequate.',
  concerns: [],
  alternatives: [],
}

// getOffDayRequestsByCompanyAndWeek is now called once per week under consideration (the requested
// week AND the following week, since a replacement may spill over) — resolve per-week so a row
// belonging to one week doesn't get double-counted when the other week's call reuses the same stub.
function mockOffDayRowsForWeek(week: string, rows: unknown[]) {
  vi.mocked(attendanceRepository.getOffDayRequestsByCompanyAndWeek).mockImplementation(
    async (_company: string, ws: string) => (ws === week ? rows : []) as any,
  )
}

function offDayRow(overrides: Partial<{ user_id: string; requested_date: string; status: string }> = {}) {
  return {
    id: `row-${Math.random()}`,
    company_id: 'company-1',
    requested_week: '2026-07-13',
    source: 'submitted',
    reviewed_by: null,
    reviewed_at: null,
    created_at: '2026-01-01',
    user_id: 'other-user',
    requested_date: '2026-07-13',
    status: 'approved',
    ...overrides,
  }
}

describe('requestAISuggestService.suggestFixedOffDayGroup', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(ownerTeamRepository.findManagersByDepartment).mockResolvedValue([
      { id: 'mgr-1', full_name: 'Manager One' },
    ])
    vi.mocked(attendanceRepository.getEmployeesByCompany).mockResolvedValue([
      { id: 'emp-1', full_name: 'Employee One', department_id: 'dept-ops' },
      { id: 'emp-2', full_name: 'Employee Two', department_id: 'dept-ops' },
    ] as any)
    vi.mocked(attendanceRepository.getOffDayRequestsByCompanyAndWeek).mockResolvedValue([])
    vi.mocked(openAIService.generateStructuredJson).mockResolvedValue(stubSuggestion)
  })

  // Regression: off-day requests are for a week that hasn't been shift-scheduled yet, so a check
  // based on the (always-empty) shifts table would flag every date as understaffed no matter what.
  // Staffing risk must be measured against the department roster instead.
  it('does not flag understaffing purely because no shifts have been scheduled yet for that future week', async () => {
    await requestAISuggestService.suggestFixedOffDayGroup({
      requester_name: 'Manager One',
      requester_role: 'Manager',
      requested_dates: ['2026-07-13'],
      department_id: 'dept-ops',
      company_id: 'company-1',
      user_id: 'mgr-1',
    })

    const call = vi.mocked(openAIService.generateStructuredJson).mock.calls[0][0] as any
    // Roster is 1 manager + 2 employees, nobody else off that day — approving the sole manager's
    // request would drop the department to 0 managers, which IS genuinely understaffed (min 1).
    expect(call.input.any_date_would_be_understaffed).toBe(true)
    expect(call.input.department_manager_headcount).toBe(1)
    expect(call.input.department_employee_headcount).toBe(2)
  })

  // The reason shown to the Owner must directly name the problem date and cause, not a paraphrased
  // explanation — built deterministically so it's never at the mercy of the LLM's wording.
  it('overrides the LLM reason with a deterministic, direct message naming the date and the short role', async () => {
    const result = await requestAISuggestService.suggestFixedOffDayGroup({
      requester_name: 'Manager One',
      requester_role: 'Manager',
      requested_dates: ['2026-07-13'],
      department_id: 'dept-ops',
      company_id: 'company-1',
      user_id: 'mgr-1',
    })

    expect(result.reason).toBe('Monday [13 Jul] already has too many managers off.')
  })

  it('returns the reassuring reason when nothing is understaffed, ignoring whatever the LLM said', async () => {
    vi.mocked(ownerTeamRepository.findManagersByDepartment).mockResolvedValue([
      { id: 'mgr-1', full_name: 'Manager One' },
      { id: 'mgr-2', full_name: 'Manager Two' },
    ])

    const result = await requestAISuggestService.suggestFixedOffDayGroup({
      requester_name: 'Manager One',
      requester_role: 'Manager',
      requested_dates: ['2026-07-13'],
      department_id: 'dept-ops',
      company_id: 'company-1',
      user_id: 'mgr-1',
    })

    expect(result.reason).toBe('This request keeps staffing balanced — safe to approve.')
  })

  it('flags understaffing when the requester is the only one covering their role that day, based on roster minus others already off', async () => {
    vi.mocked(ownerTeamRepository.findManagersByDepartment).mockResolvedValue([
      { id: 'mgr-1', full_name: 'Manager One' },
      { id: 'mgr-2', full_name: 'Manager Two' },
    ])
    mockOffDayRowsForWeek('2026-07-13', [
      offDayRow({ user_id: 'mgr-2', requested_date: '2026-07-13', status: 'approved' }),
    ])

    await requestAISuggestService.suggestFixedOffDayGroup({
      requester_name: 'Manager One',
      requester_role: 'Manager',
      requested_dates: ['2026-07-13'],
      department_id: 'dept-ops',
      company_id: 'company-1',
      user_id: 'mgr-1',
    })

    const call = vi.mocked(openAIService.generateStructuredJson).mock.calls[0][0] as any
    // 2 managers on roster, mgr-2 already off that day, mgr-1 requesting too -> 0 remain, below min 1.
    expect(call.input.any_date_would_be_understaffed).toBe(true)
    expect(call.input.requested_dates[0].other_managers_already_off).toBe(1)
  })

  it('does not flag understaffing when enough roster remains after this request and everyone else already off', async () => {
    vi.mocked(ownerTeamRepository.findManagersByDepartment).mockResolvedValue([
      { id: 'mgr-1', full_name: 'Manager One' },
      { id: 'mgr-2', full_name: 'Manager Two' },
    ])

    await requestAISuggestService.suggestFixedOffDayGroup({
      requester_name: 'Manager One',
      requester_role: 'Manager',
      requested_dates: ['2026-07-13', '2026-07-15'],
      department_id: 'dept-ops',
      company_id: 'company-1',
      user_id: 'mgr-1',
    })

    const call = vi.mocked(openAIService.generateStructuredJson).mock.calls[0][0] as any
    // 2 managers on roster, nobody else off, mgr-1 requesting -> 1 remains, meets min 1.
    expect(call.input.any_date_would_be_understaffed).toBe(false)
    expect(call.input.requested_dates).toHaveLength(2)
  })

  it('flags only the specific date that is tight when several requested dates are mixed', async () => {
    vi.mocked(ownerTeamRepository.findManagersByDepartment).mockResolvedValue([
      { id: 'mgr-1', full_name: 'Manager One' },
      { id: 'mgr-2', full_name: 'Manager Two' },
    ])
    mockOffDayRowsForWeek('2026-07-13', [
      offDayRow({ user_id: 'mgr-2', requested_date: '2026-07-15', status: 'approved' }),
    ])

    await requestAISuggestService.suggestFixedOffDayGroup({
      requester_name: 'Manager One',
      requester_role: 'Manager',
      requested_dates: ['2026-07-13', '2026-07-15'],
      department_id: 'dept-ops',
      company_id: 'company-1',
      user_id: 'mgr-1',
    })

    const call = vi.mocked(openAIService.generateStructuredJson).mock.calls[0][0] as any
    expect(call.input.any_date_would_be_understaffed).toBe(true)
    const tight = call.input.requested_dates.find((d: any) => d.date === '2026-07-15')
    const ok = call.input.requested_dates.find((d: any) => d.date === '2026-07-13')
    expect(tight.would_be_understaffed).toBe(true)
    expect(ok.would_be_understaffed).toBe(false)
  })

  it('excludes the requester\'s own other-date rows from "others already off" for a given date', async () => {
    mockOffDayRowsForWeek('2026-07-13', [
      offDayRow({ user_id: 'mgr-1', requested_date: '2026-07-14', status: 'pending' }),
    ])

    await requestAISuggestService.suggestFixedOffDayGroup({
      requester_name: 'Manager One',
      requester_role: 'Manager',
      requested_dates: ['2026-07-13'],
      department_id: 'dept-ops',
      company_id: 'company-1',
      user_id: 'mgr-1',
    })

    const call = vi.mocked(openAIService.generateStructuredJson).mock.calls[0][0] as any
    expect(call.input.requested_dates[0].other_managers_already_off).toBe(0)
  })

  it('excludes rejected rows from "others already off"', async () => {
    vi.mocked(ownerTeamRepository.findManagersByDepartment).mockResolvedValue([
      { id: 'mgr-1', full_name: 'Manager One' },
      { id: 'mgr-2', full_name: 'Manager Two' },
    ])
    mockOffDayRowsForWeek('2026-07-13', [
      offDayRow({ user_id: 'mgr-2', requested_date: '2026-07-13', status: 'rejected' }),
    ])

    await requestAISuggestService.suggestFixedOffDayGroup({
      requester_name: 'Manager One',
      requester_role: 'Manager',
      requested_dates: ['2026-07-13'],
      department_id: 'dept-ops',
      company_id: 'company-1',
      user_id: 'mgr-1',
    })

    const call = vi.mocked(openAIService.generateStructuredJson).mock.calls[0][0] as any
    expect(call.input.requested_dates[0].other_managers_already_off).toBe(0)
    expect(call.input.any_date_would_be_understaffed).toBe(false)
  })

  // First-come-first-served: the queue is worked in submission order. Two people's still-pending
  // requests for the same day aren't in conflict with each other yet — only an ALREADY-DECIDED
  // (approved/modified) day actually reserves it. The first person to submit should always come
  // back clean since nothing has been approved ahead of them yet.
  it('does not count another person\'s still-pending request against "others already off" — first-come-first-served', async () => {
    vi.mocked(ownerTeamRepository.findManagersByDepartment).mockResolvedValue([
      { id: 'mgr-1', full_name: 'Manager One' },
      { id: 'mgr-2', full_name: 'Manager Two' },
    ])
    mockOffDayRowsForWeek('2026-07-13', [
      offDayRow({ user_id: 'mgr-2', requested_date: '2026-07-13', status: 'pending' }),
    ])

    await requestAISuggestService.suggestFixedOffDayGroup({
      requester_name: 'Manager One',
      requester_role: 'Manager',
      requested_dates: ['2026-07-13'],
      department_id: 'dept-ops',
      company_id: 'company-1',
      user_id: 'mgr-1',
    })

    const call = vi.mocked(openAIService.generateStructuredJson).mock.calls[0][0] as any
    expect(call.input.requested_dates[0].other_managers_already_off).toBe(0)
    expect(call.input.any_date_would_be_understaffed).toBe(false)
  })

  it('only includes dates in safe_alternative_dates that stay at or above the minimum and are not already requested', async () => {
    vi.mocked(ownerTeamRepository.findManagersByDepartment).mockResolvedValue([
      { id: 'mgr-1', full_name: 'Manager One' },
      { id: 'mgr-2', full_name: 'Manager Two' },
    ])
    // Department is tight on 2026-07-14 (Tue) because mgr-2 is already off then.
    mockOffDayRowsForWeek('2026-07-13', [
      offDayRow({ user_id: 'mgr-2', requested_date: '2026-07-14', status: 'approved' }),
    ])

    await requestAISuggestService.suggestFixedOffDayGroup({
      requester_name: 'Manager One',
      requester_role: 'Manager',
      requested_dates: ['2026-07-13'],
      department_id: 'dept-ops',
      company_id: 'company-1',
      user_id: 'mgr-1',
    })

    const call = vi.mocked(openAIService.generateStructuredJson).mock.calls[0][0] as any
    expect(call.input.safe_alternative_dates).not.toContain('2026-07-14')
    expect(call.input.safe_alternative_dates).not.toContain('2026-07-13')
  })

  // Cross-week spillover: when the requested week is fully booked (every remaining day already
  // short-staffed), safe alternatives should spill into the following week rather than come back
  // empty — this is the "borrow a bonus day off the following week" case the Owner asked for.
  it('spills over to a safe date in the following week when every day in the requested week is already short-staffed', async () => {
    vi.mocked(ownerTeamRepository.findManagersByDepartment).mockResolvedValue([
      { id: 'mgr-1', full_name: 'Manager One' },
      { id: 'mgr-2', full_name: 'Manager Two' },
    ])
    mockOffDayRowsForWeek('2026-07-13', [
      offDayRow({ user_id: 'mgr-2', requested_date: '2026-07-14', status: 'approved' }),
      offDayRow({ user_id: 'mgr-2', requested_date: '2026-07-15', status: 'approved' }),
      offDayRow({ user_id: 'mgr-2', requested_date: '2026-07-16', status: 'approved' }),
      offDayRow({ user_id: 'mgr-2', requested_date: '2026-07-17', status: 'approved' }),
      offDayRow({ user_id: 'mgr-2', requested_date: '2026-07-18', status: 'approved' }),
      offDayRow({ user_id: 'mgr-2', requested_date: '2026-07-19', status: 'approved' }),
    ])

    await requestAISuggestService.suggestFixedOffDayGroup({
      requester_name: 'Manager One',
      requester_role: 'Manager',
      requested_dates: ['2026-07-13'],
      department_id: 'dept-ops',
      company_id: 'company-1',
      user_id: 'mgr-1',
    })

    expect(attendanceRepository.getOffDayRequestsByCompanyAndWeek).toHaveBeenCalledWith('company-1', '2026-07-20')
    const call = vi.mocked(openAIService.generateStructuredJson).mock.calls[0][0] as any
    expect(call.input.safe_alternative_dates.length).toBeGreaterThan(0)
    expect(call.input.safe_alternative_dates.every((d: string) => d >= '2026-07-20')).toBe(true)
  })

  it('returns an empty safe_alternative_dates list and skips roster lookups when department_id is null', async () => {
    await requestAISuggestService.suggestFixedOffDayGroup({
      requester_name: 'Employee One',
      requester_role: 'Employee',
      requested_dates: ['2026-07-13'],
      department_id: null,
      company_id: 'company-1',
      user_id: 'emp-1',
    })

    const call = vi.mocked(openAIService.generateStructuredJson).mock.calls[0][0] as any
    expect(call.input.safe_alternative_dates).toEqual([])
    expect(ownerTeamRepository.findManagersByDepartment).not.toHaveBeenCalled()
  })
})

// Rows as the queue analysis receives them — FixedOffDayRequestView shape (base row + the
// requester_name/requester_role/department_id the Owner view resolves).
function queueRow(overrides: Partial<{
  id: string; user_id: string; requested_date: string; requested_week: string; status: string
  created_at: string; requester_name: string; requester_role: string; department_id: string | null
}> = {}) {
  return {
    id: `row-${Math.random()}`,
    company_id: 'company-1',
    requested_week: '2026-07-13',
    source: 'submitted',
    reviewed_by: null,
    reviewed_at: null,
    created_at: '2026-07-08T01:00:00Z',
    user_id: 'mgr-1',
    requested_date: '2026-07-13',
    status: 'pending',
    requester_name: 'Manager One',
    requester_role: 'Manager',
    department_id: 'dept-ops',
    ...overrides,
  } as any
}

describe('requestAISuggestService.suggestFixedOffDayQueue', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(ownerTeamRepository.findManagersByDepartment).mockResolvedValue([
      { id: 'mgr-1', full_name: 'Manager One' },
      { id: 'mgr-2', full_name: 'Manager Two' },
    ])
    vi.mocked(attendanceRepository.getEmployeesByCompany).mockResolvedValue([
      { id: 'emp-1', full_name: 'Employee One', department_id: 'dept-ops' },
      { id: 'emp-2', full_name: 'Employee Two', department_id: 'dept-ops' },
    ] as any)
  })

  // The heart of the feature: the first submitter always comes back safe, and once their day is
  // (simulated-)taken, a later submitter colliding with it gets flagged instead — without a single
  // per-request Suggestion click.
  it('marks the earlier submitter safe and flags a later one colliding with the now-taken day', async () => {
    const result = await requestAISuggestService.suggestFixedOffDayQueue({
      company_id: 'company-1',
      rows: [
        queueRow({ user_id: 'mgr-1', requester_name: 'Manager One', requested_date: '2026-07-14', created_at: '2026-07-08T01:00:00Z' }),
        queueRow({ user_id: 'mgr-2', requester_name: 'Manager Two', requested_date: '2026-07-14', created_at: '2026-07-08T02:00:00Z' }),
      ],
    })

    expect(result.safe_count).toBe(1)
    expect(result.flagged_count).toBe(1)
    const [first, second] = result.items
    expect(first.key).toBe('mgr-1_2026-07-13')
    expect(first.verdict).toBe('safe')
    expect(first.suggested_dates).toEqual(['2026-07-14'])
    expect(second.key).toBe('mgr-2_2026-07-13')
    expect(second.verdict).toBe('flagged')
    expect(second.problem_dates).toEqual(['2026-07-14'])
    expect(second.problem_reasons['2026-07-14']).toBe('Tuesday [14 Jul] already has too many managers off.')
    // Recommended replacement: the contested Tuesday swapped for the first staffing-safe day (Monday).
    expect(second.suggested_dates).toEqual(['2026-07-13'])
  })

  it('orders the queue by submission time, not by row order — the earlier submitter wins the contested day', async () => {
    const result = await requestAISuggestService.suggestFixedOffDayQueue({
      company_id: 'company-1',
      rows: [
        queueRow({ user_id: 'mgr-1', requested_date: '2026-07-14', created_at: '2026-07-08T02:00:00Z' }),
        queueRow({ user_id: 'mgr-2', requester_name: 'Manager Two', requested_date: '2026-07-14', created_at: '2026-07-08T01:00:00Z' }),
      ],
    })

    expect(result.items[0].key).toBe('mgr-2_2026-07-13')
    expect(result.items[0].verdict).toBe('safe')
    expect(result.items[1].key).toBe('mgr-1_2026-07-13')
    expect(result.items[1].verdict).toBe('flagged')
  })

  // A weekly submission is decided as one unit: one bad date flags the whole group, and a flagged
  // group must NOT reserve its safe dates either (it isn't being approved), so a later request for
  // one of those dates stays safe.
  it('flags a whole group on one bad date and does not let the flagged group reserve its other dates', async () => {
    const result = await requestAISuggestService.suggestFixedOffDayQueue({
      company_id: 'company-1',
      rows: [
        queueRow({ id: 'a1', user_id: 'mgr-1', requested_date: '2026-07-14', created_at: '2026-07-08T01:00:00Z' }),
        queueRow({ id: 'b1', user_id: 'mgr-2', requester_name: 'Manager Two', requested_date: '2026-07-14', created_at: '2026-07-08T02:00:00Z' }),
        queueRow({ id: 'b2', user_id: 'mgr-2', requester_name: 'Manager Two', requested_date: '2026-07-15', created_at: '2026-07-08T02:00:00Z' }),
        queueRow({ id: 'c1', user_id: 'emp-1', requester_name: 'Employee One', requester_role: 'Employee', requested_date: '2026-07-15', created_at: '2026-07-08T03:00:00Z' }),
      ],
    })

    const flagged = result.items.find(i => i.user_id === 'mgr-2')!
    expect(flagged.verdict).toBe('flagged')
    expect(flagged.ids).toEqual(['b1', 'b2'])
    // Only the contested Tuesday is the problem — Wednesday was fine as requested.
    expect(flagged.problem_dates).toEqual(['2026-07-14'])
    // Recommendation keeps the safe Wednesday and swaps Tuesday for the first safe day (Monday).
    expect(flagged.suggested_dates).toEqual(['2026-07-15', '2026-07-13'])
    // And the employee requesting Wednesday is judged against the employee pool, not the managers'.
    expect(result.items.find(i => i.user_id === 'emp-1')!.verdict).toBe('safe')
  })

  it('counts already-decided off-days as reserved before the queue even starts', async () => {
    const result = await requestAISuggestService.suggestFixedOffDayQueue({
      company_id: 'company-1',
      rows: [
        queueRow({ user_id: 'mgr-2', requested_date: '2026-07-14', status: 'approved' }),
        queueRow({ user_id: 'mgr-1', requested_date: '2026-07-14', created_at: '2026-07-08T01:00:00Z' }),
      ],
    })

    expect(result.items).toHaveLength(1)
    expect(result.items[0].verdict).toBe('flagged')
  })

  it('treats a requester without a department as safe and skips roster lookups when the queue has no departments', async () => {
    const result = await requestAISuggestService.suggestFixedOffDayQueue({
      company_id: 'company-1',
      rows: [queueRow({ department_id: null })],
    })

    expect(result.items[0].verdict).toBe('safe')
    expect(ownerTeamRepository.findManagersByDepartment).not.toHaveBeenCalled()
  })
})
