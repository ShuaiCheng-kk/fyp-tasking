import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from 'vitest'

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
  // The 7-day upcoming window is measured from "today" — pin the clock so the window
  // (2026-07-15 … 2026-07-21) is stable no matter when the suite runs.
  beforeAll(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-07-15T08:00:00'))
  })
  afterAll(() => {
    vi.useRealTimers()
  })

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(casualDashboardRepository.getJobPostingsByIds).mockResolvedValue([
      { id: 'job-1', company_name: 'Sunrise Hospitality', location: '1 Raffles Place', created_by: 'owner-1' },
    ])
    vi.mocked(casualDashboardRepository.getUsersByIds).mockResolvedValue([
      { id: 'emp-1', full_name: 'Felix Ng', role: 'Employee', phone_number: '+65 8567 8901', email_address: 'felix@test.com', profile_photo_url: null },
      { id: 'owner-1', full_name: 'Olivia Wong', role: 'Owner', phone_number: '+65 8123 0001', email_address: 'owner@test.com', profile_photo_url: null },
    ])
  })

  it('returns current_job: null when there are no upcoming assignments', async () => {
    vi.mocked(casualDashboardRepository.getUserByAuthId).mockResolvedValue(user)
    vi.mocked(casualDashboardRepository.getUpcomingAssignments).mockResolvedValue([])
    vi.mocked(casualAttendanceRepository.getAttendanceRecordsByAssignmentIds).mockResolvedValue([])

    const result = await casualDashboardService.getDashboard('auth-1')
    expect(result.current_job).toBeNull()
    expect(result.upcoming_jobs).toEqual([])
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
      id: 'emp-1', full_name: 'Felix Ng', phone_number: '+65 8567 8901', email_address: 'felix@test.com', profile_photo_url: null,
    })
    // One user fetch covers both the supervisor and the posting's creator.
    expect(casualDashboardRepository.getUsersByIds).toHaveBeenCalledWith(['emp-1', 'owner-1'])
    // The source posting id is exposed so the worker can re-open the job detail from the card.
    expect(result.current_job?.job_posting_id).toBe('job-1')
  })

  it('throws when the casual worker cannot be found', async () => {
    vi.mocked(casualDashboardRepository.getUserByAuthId).mockResolvedValue(null)
    await expect(casualDashboardService.getDashboard('auth-1')).rejects.toThrow('Casual worker not found')
  })

  it('lists every job inside the 7-day window as upcoming_jobs, completed ones included', async () => {
    vi.mocked(casualDashboardRepository.getUserByAuthId).mockResolvedValue(user)
    vi.mocked(casualDashboardRepository.getUpcomingAssignments).mockResolvedValue([
      makeAssignment({ id: 'a-1', shift_date: '2026-07-15' }),
      makeAssignment({ id: 'a-2', shift_date: '2026-07-15', start_time: '19:00' }),
      makeAssignment({ id: 'a-3', shift_date: '2026-07-18' }),
    ])
    // The morning job is already clocked out — it stays on the timeline (shown as completed)
    // but the evening job becomes the current one.
    vi.mocked(casualAttendanceRepository.getAttendanceRecordsByAssignmentIds).mockResolvedValue([
      { shift_assignment_id: 'a-1', clock_in_time: '2026-07-15T09:00:00Z', clock_out_time: '2026-07-15T17:00:00Z' } as any,
    ])

    const result = await casualDashboardService.getDashboard('auth-1')
    expect(result.upcoming_jobs.map(j => j.assignment_id)).toEqual(['a-1', 'a-2', 'a-3'])
    expect(result.current_job?.assignment_id).toBe('a-2')
    expect(result.upcoming_jobs[0].clock_out_time).toBe('2026-07-15T17:00:00Z')
    // Every timeline entry carries the full pre-work info (supervisor + posting location).
    expect(result.upcoming_jobs[2].supervisor?.id).toBe('emp-1')
    expect(result.upcoming_jobs[2].location).toBe('1 Raffles Place')
  })

  it('excludes jobs beyond the 7-day window but always keeps the current job itself', async () => {
    vi.mocked(casualDashboardRepository.getUserByAuthId).mockResolvedValue(user)
    vi.mocked(casualDashboardRepository.getUpcomingAssignments).mockResolvedValue([
      makeAssignment({ id: 'a-1', shift_date: '2026-07-16' }),
      makeAssignment({ id: 'a-2', shift_date: '2026-07-30' }),
    ])
    vi.mocked(casualAttendanceRepository.getAttendanceRecordsByAssignmentIds).mockResolvedValue([])

    const result = await casualDashboardService.getDashboard('auth-1')
    expect(result.upcoming_jobs.map(j => j.assignment_id)).toEqual(['a-1'])
    expect(result.current_job?.assignment_id).toBe('a-1')
  })

  it('keeps a beyond-window current job on the timeline when it is the only one', async () => {
    vi.mocked(casualDashboardRepository.getUserByAuthId).mockResolvedValue(user)
    vi.mocked(casualDashboardRepository.getUpcomingAssignments).mockResolvedValue([
      makeAssignment({ id: 'a-far', shift_date: '2026-07-30' }),
    ])
    vi.mocked(casualAttendanceRepository.getAttendanceRecordsByAssignmentIds).mockResolvedValue([])

    const result = await casualDashboardService.getDashboard('auth-1')
    expect(result.current_job?.assignment_id).toBe('a-far')
    expect(result.upcoming_jobs.map(j => j.assignment_id)).toEqual(['a-far'])
  })
})
