import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase', () => ({
  supabase: {},
  createClient: () => ({}),
}))

vi.mock('@/repositories/casual/casualDashboardRepository', () => ({
  casualDashboardRepository: {
    getUserByAuthId: vi.fn(),
    getUpcomingAssignments: vi.fn(),
    getJobPostingsByIds: vi.fn(),
    getUsersByIds: vi.fn(),
  },
}))

vi.mock('@/repositories/casual/casualAttendanceRepository', () => ({
  casualAttendanceRepository: {
    getAttendanceRecordsByAssignmentIds: vi.fn(),
  },
}))

import { casualDashboardService } from './casualDashboardService'
import { casualDashboardRepository } from '@/repositories/casual/casualDashboardRepository'
import { casualAttendanceRepository } from '@/repositories/casual/casualAttendanceRepository'

const user = { id: 'cw-1', full_name: 'Casual Worker One', role: 'Casual Worker' }

function makeAssignment(overrides: Partial<{
  id: string
  supervisor_employee_id: string | null
  shift_id: string
  shift_date: string
  start_time: string
  source_job_posting_id: string | null
}> = {}) {
  return {
    id: overrides.id ?? 'a-1',
    supervisor_employee_id: overrides.supervisor_employee_id ?? 'emp-1',
    shift: {
      id: overrides.shift_id ?? 's-1',
      company_id: 'company-1',
      department_id: 'dept-1',
      title: 'Barista',
      shift_date: overrides.shift_date ?? '2026-07-15',
      start_time: overrides.start_time ?? '09:00',
      end_time: '17:00',
      is_open_ended: false,
      source_job_posting_id: overrides.source_job_posting_id ?? 'job-1',
    },
  }
}

describe('casualDashboardService.getDashboard — single current-job model', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(casualDashboardRepository.getJobPostingsByIds).mockResolvedValue([
      { id: 'job-1', company_name: 'Sunrise Hospitality', location: '1 Raffles Place' },
    ])
    vi.mocked(casualDashboardRepository.getUsersByIds).mockResolvedValue([
      { id: 'emp-1', full_name: 'Felix Ng', phone_number: '+65 8567 8901', email_address: 'felix@test.com' },
    ])
  })

  it('returns current_job: null when there are no upcoming assignments', async () => {
    vi.mocked(casualDashboardRepository.getUserByAuthId).mockResolvedValue(user)
    vi.mocked(casualDashboardRepository.getUpcomingAssignments).mockResolvedValue([])
    vi.mocked(casualAttendanceRepository.getAttendanceRecordsByAssignmentIds).mockResolvedValue([])

    const result = await casualDashboardService.getDashboard('auth-1')
    expect(result.current_job).toBeNull()
  })

  it('picks the earliest assignment that has not been clocked out of yet', async () => {
    vi.mocked(casualDashboardRepository.getUserByAuthId).mockResolvedValue(user)
    vi.mocked(casualDashboardRepository.getUpcomingAssignments).mockResolvedValue([
      makeAssignment({ id: 'a-1', shift_date: '2026-07-15' }),
      makeAssignment({ id: 'a-2', shift_date: '2026-07-16' }),
    ])
    vi.mocked(casualAttendanceRepository.getAttendanceRecordsByAssignmentIds).mockResolvedValue([])

    const result = await casualDashboardService.getDashboard('auth-1')
    expect(result.current_job?.assignment_id).toBe('a-1')
  })

  it('skips an assignment once it has been clocked out of, surfacing the next one instead', async () => {
    vi.mocked(casualDashboardRepository.getUserByAuthId).mockResolvedValue(user)
    vi.mocked(casualDashboardRepository.getUpcomingAssignments).mockResolvedValue([
      makeAssignment({ id: 'a-1', shift_date: '2026-07-15' }),
      makeAssignment({ id: 'a-2', shift_date: '2026-07-16' }),
    ])
    vi.mocked(casualAttendanceRepository.getAttendanceRecordsByAssignmentIds).mockResolvedValue([
      { shift_assignment_id: 'a-1', clock_in_time: '2026-07-15T09:00:00Z', clock_out_time: '2026-07-15T17:00:00Z' } as any,
    ])

    const result = await casualDashboardService.getDashboard('auth-1')
    expect(result.current_job?.assignment_id).toBe('a-2')
  })

  it('resolves the supervisor from the assignment\'s supervisor_employee_id, not the job posting', async () => {
    vi.mocked(casualDashboardRepository.getUserByAuthId).mockResolvedValue(user)
    vi.mocked(casualDashboardRepository.getUpcomingAssignments).mockResolvedValue([makeAssignment()])
    vi.mocked(casualAttendanceRepository.getAttendanceRecordsByAssignmentIds).mockResolvedValue([])

    const result = await casualDashboardService.getDashboard('auth-1')
    expect(result.current_job?.supervisor).toEqual({
      id: 'emp-1', full_name: 'Felix Ng', phone_number: '+65 8567 8901', email_address: 'felix@test.com',
    })
    expect(casualDashboardRepository.getUsersByIds).toHaveBeenCalledWith(['emp-1'])
  })

  it('throws when the casual worker cannot be found', async () => {
    vi.mocked(casualDashboardRepository.getUserByAuthId).mockResolvedValue(null)
    await expect(casualDashboardService.getDashboard('auth-1')).rejects.toThrow('Casual worker not found')
  })
})
