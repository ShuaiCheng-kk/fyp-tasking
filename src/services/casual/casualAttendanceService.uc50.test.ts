import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase', () => ({
  supabase: {},
  createClient: () => ({}),
}))

vi.mock('@/repositories/casual/casualAttendanceRepository', () => ({
  casualAttendanceRepository: {
    getUserByAuthId: vi.fn(),
    getAssignmentById: vi.fn(),
    isBannedByCompany: vi.fn(),
    getAttendanceRecordByAssignmentId: vi.fn(),
    createAttendanceRecord: vi.fn(),
    updateAttendanceRecord: vi.fn(),
  },
}))

import { casualAttendanceService } from './casualAttendanceService'
import { casualAttendanceRepository } from '@/repositories/casual/casualAttendanceRepository'

// Shift: 2026-08-10, 09:00-17:00 SGT
const shift = {
  id: 'shift-1', shift_date: '2026-08-10', start_time: '09:00', end_time: '17:00', is_open_ended: false, company_id: 'comp-1',
}
const assignment = { id: 'assign-1', user_id: 'cw-1', shifts: shift }

describe('UC50 Clock In (Casual Worker)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(casualAttendanceRepository.getUserByAuthId).mockResolvedValue({ id: 'cw-1', full_name: 'Casual Chris', role: 'Casual Worker' } as never)
    vi.mocked(casualAttendanceRepository.getAssignmentById).mockResolvedValue(assignment as never)
    vi.mocked(casualAttendanceRepository.isBannedByCompany).mockResolvedValue(false)
    vi.mocked(casualAttendanceRepository.getAttendanceRecordByAssignmentId).mockResolvedValue(null)
    vi.mocked(casualAttendanceRepository.createAttendanceRecord).mockImplementation(async (input) => input as never)
  })

  it('UC50-M-UT-CW: Casual Worker clocks in within the present window and the record is created', async () => {
    const result = await casualAttendanceService.clockIn({
      authId: 'auth-1', shift_assignment_id: 'assign-1', clock_time: '2026-08-10T00:45:00.000Z', // 08:45 SGT
    })

    expect(result).toMatchObject({ shift_assignment_id: 'assign-1', user_id: 'cw-1', clock_in_time: '2026-08-10T00:45:00.000Z' })
  })

  it('UC50-A1-UT-CW: Casual Worker clocking in more than 10 minutes late is recorded as-is, not rounded down', async () => {
    const result = await casualAttendanceService.clockIn({
      authId: 'auth-1', shift_assignment_id: 'assign-1', clock_time: '2026-08-10T01:20:00.000Z', // 09:20 SGT, 20 min late
    })

    expect(result).toMatchObject({ clock_in_time: '2026-08-10T01:20:00.000Z' })
  })

  it('UC50-A2-UT-CW-1: Casual Worker is blocked from clocking in more than 30 minutes before the shift starts', async () => {
    await expect(casualAttendanceService.clockIn({
      authId: 'auth-1', shift_assignment_id: 'assign-1', clock_time: '2026-08-10T00:00:00.000Z', // 08:00 SGT
    })).rejects.toThrow('Too early to clock in for this shift')
  })

  it('UC50-A2-UT-CW-2: Casual Worker is blocked from clocking in after the shift has already ended', async () => {
    await expect(casualAttendanceService.clockIn({
      authId: 'auth-1', shift_assignment_id: 'assign-1', clock_time: '2026-08-10T09:30:00.000Z', // 17:30 SGT
    })).rejects.toThrow('Shift has already ended')
  })

  it('UC50-BR-UT-CW-1: Casual Worker clocking in within the 10-minute grace period is rounded down to the exact scheduled start', async () => {
    const result = await casualAttendanceService.clockIn({
      authId: 'auth-1', shift_assignment_id: 'assign-1', clock_time: '2026-08-10T01:07:00.000Z', // 09:07 SGT
    })

    expect(result).toMatchObject({ clock_in_time: '2026-08-10T01:00:00.000Z' })
  })

  it('UC50-BR-UT-CW-2: Casual Worker banned by this company is blocked from clocking in for its shifts', async () => {
    vi.mocked(casualAttendanceRepository.isBannedByCompany).mockResolvedValue(true)

    await expect(casualAttendanceService.clockIn({
      authId: 'auth-1', shift_assignment_id: 'assign-1', clock_time: '2026-08-10T00:45:00.000Z',
    })).rejects.toThrow('You have been deactivated by this company and can no longer clock in for their shifts.')

    expect(casualAttendanceRepository.createAttendanceRecord).not.toHaveBeenCalled()
  })
})
