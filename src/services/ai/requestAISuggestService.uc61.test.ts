import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabaseAdmin', () => ({
  getSupabaseAdmin: () => ({}),
}))

vi.mock('@/lib/supabase', () => ({
  supabase: {},
  createClient: () => ({}),
}))

vi.mock('@/repositories/owner/attendanceRepository', () => ({
  attendanceRepository: {
    getEmployeesByCompany: vi.fn(),
  },
}))

vi.mock('@/repositories/owner/ownerTeamRepository', () => ({
  ownerTeamRepository: {
    findManagersByDepartment: vi.fn(),
  },
}))

import { requestAISuggestService } from './requestAISuggestService'
import { attendanceRepository } from '@/repositories/owner/attendanceRepository'
import { ownerTeamRepository } from '@/repositories/owner/ownerTeamRepository'

// Department dept-1 roster: 1 Manager (mgr-1), 2 Employees (emp-1, emp-2). MIN_MANAGERS_PER_DAY = 1,
// MIN_EMPLOYEES_PER_DAY = 1, so at most one of the two Employees can safely be off on any given day.
function seedRoster() {
  vi.mocked(ownerTeamRepository.findManagersByDepartment).mockResolvedValue([{ id: 'mgr-1', full_name: 'Mgr' }] as never)
  vi.mocked(attendanceRepository.getEmployeesByCompany).mockResolvedValue([
    { id: 'emp-1', full_name: 'Emp One', department_id: 'dept-1' },
    { id: 'emp-2', full_name: 'Emp Two', department_id: 'dept-1' },
  ] as never)
}

function pendingRow(overrides: Partial<{ id: string; user_id: string; requester_name: string; requester_role: string; requested_date: string; created_at: string; status: string }>) {
  return {
    id: 'row-1', user_id: 'emp-1', requester_name: 'Emp One', requester_role: 'Employee',
    department_id: 'dept-1', requested_week: '2026-08-10', requested_date: '2026-08-11',
    status: 'pending', created_at: '2026-08-01T00:00:00.000Z',
    ...overrides,
  }
}

describe('UC61 Generate AI Day Off Suggestion', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    seedRoster()
  })

  it('UC61-M-UT-O: Owner runs AI Process on a queue containing one safe and one flagged submission', async () => {
    const rows = [
      pendingRow({ id: 'row-1', user_id: 'emp-1', requester_name: 'Emp One', requested_date: '2026-08-11', created_at: '2026-08-01T00:00:00.000Z' }),
      pendingRow({ id: 'row-2', user_id: 'emp-2', requester_name: 'Emp Two', requested_date: '2026-08-11', created_at: '2026-08-02T00:00:00.000Z' }),
    ]

    const result = await requestAISuggestService.suggestFixedOffDayQueue({ company_id: 'comp-1', rows })

    expect(result.safe_count).toBe(1)
    expect(result.flagged_count).toBe(1)
    const safeItem = result.items.find(i => i.user_id === 'emp-1')!
    const flaggedItem = result.items.find(i => i.user_id === 'emp-2')!
    expect(safeItem.verdict).toBe('safe')
    expect(flaggedItem.verdict).toBe('flagged')
    expect(flaggedItem.suggested_dates).not.toContain('2026-08-11')
    expect(flaggedItem.suggested_dates.length).toBeGreaterThan(0)
  })

  it('UC61-M-UT-P: Partner runs AI Process on a queue containing one safe and one flagged submission', async () => {
    const rows = [
      pendingRow({ id: 'row-1', user_id: 'emp-1', requester_name: 'Emp One', requested_date: '2026-08-11', created_at: '2026-08-01T00:00:00.000Z' }),
      pendingRow({ id: 'row-2', user_id: 'emp-2', requester_name: 'Emp Two', requested_date: '2026-08-11', created_at: '2026-08-02T00:00:00.000Z' }),
    ]

    const result = await requestAISuggestService.suggestFixedOffDayQueue({ company_id: 'comp-1', rows })

    expect(result.safe_count).toBe(1)
    expect(result.flagged_count).toBe(1)
  })

  it('UC61-BR-UT-System-1: A pending submission colliding with an already-Approved off-day (not another pending one) is immediately Flagged', async () => {
    const rows = [
      pendingRow({ id: 'row-approved', user_id: 'emp-2', requester_name: 'Emp Two', requested_date: '2026-08-11', status: 'approved' }),
      pendingRow({ id: 'row-1', user_id: 'emp-1', requester_name: 'Emp One', requested_date: '2026-08-11', created_at: '2026-08-01T00:00:00.000Z' }),
    ]

    const result = await requestAISuggestService.suggestFixedOffDayQueue({ company_id: 'comp-1', rows })

    expect(result.items).toHaveLength(1)
    expect(result.items[0]).toMatchObject({ user_id: 'emp-1', verdict: 'flagged' })
  })

  it('UC61-BR-UT-System-2: Two still-pending requests for the same day are not measured against each other directly, only whichever is processed earlier reserves the day', async () => {
    const rowsEmp1First = [
      pendingRow({ id: 'row-1', user_id: 'emp-1', requester_name: 'Emp One', requested_date: '2026-08-11', created_at: '2026-08-01T00:00:00.000Z' }),
      pendingRow({ id: 'row-2', user_id: 'emp-2', requester_name: 'Emp Two', requested_date: '2026-08-11', created_at: '2026-08-02T00:00:00.000Z' }),
    ]
    const rowsEmp2First = [
      pendingRow({ id: 'row-1', user_id: 'emp-1', requester_name: 'Emp One', requested_date: '2026-08-11', created_at: '2026-08-02T00:00:00.000Z' }),
      pendingRow({ id: 'row-2', user_id: 'emp-2', requester_name: 'Emp Two', requested_date: '2026-08-11', created_at: '2026-08-01T00:00:00.000Z' }),
    ]

    const resultA = await requestAISuggestService.suggestFixedOffDayQueue({ company_id: 'comp-1', rows: rowsEmp1First })
    const resultB = await requestAISuggestService.suggestFixedOffDayQueue({ company_id: 'comp-1', rows: rowsEmp2First })

    expect(resultA.items.find(i => i.user_id === 'emp-1')!.verdict).toBe('safe')
    expect(resultA.items.find(i => i.user_id === 'emp-2')!.verdict).toBe('flagged')
    expect(resultB.items.find(i => i.user_id === 'emp-2')!.verdict).toBe('safe')
    expect(resultB.items.find(i => i.user_id === 'emp-1')!.verdict).toBe('flagged')
  })

  it('UC61-BR-UT-System-3: Running the sweep twice on the identical queue returns identical results, since it is deterministic code rather than a variable AI call', async () => {
    const rows = [
      pendingRow({ id: 'row-1', user_id: 'emp-1', requester_name: 'Emp One', requested_date: '2026-08-11', created_at: '2026-08-01T00:00:00.000Z' }),
      pendingRow({ id: 'row-2', user_id: 'emp-2', requester_name: 'Emp Two', requested_date: '2026-08-11', created_at: '2026-08-02T00:00:00.000Z' }),
    ]

    const resultA = await requestAISuggestService.suggestFixedOffDayQueue({ company_id: 'comp-1', rows })
    const resultB = await requestAISuggestService.suggestFixedOffDayQueue({ company_id: 'comp-1', rows })

    expect(resultA).toEqual(resultB)
  })
})
