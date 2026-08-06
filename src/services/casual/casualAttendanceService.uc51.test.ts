import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase', () => ({
  supabase: {},
  createClient: () => ({}),
}))

vi.mock('@/repositories/casual/casualAttendanceRepository', () => ({
  casualAttendanceRepository: {
    getUserByAuthId: vi.fn(),
    getAssignmentById: vi.fn(),
    getAttendanceRecordByAssignmentId: vi.fn(),
    updateAttendanceRecord: vi.fn(),
    markCasualWorkerDepartmentVerified: vi.fn(),
  },
}))

import { casualAttendanceService } from './casualAttendanceService'
import { casualAttendanceRepository } from '@/repositories/casual/casualAttendanceRepository'

const fixedShift = {
  id: 'shift-1', shift_date: '2026-08-10', start_time: '09:00', end_time: '17:00', is_open_ended: false, department_id: 'dept-1',
}
const oneOffShift = {
  id: 'shift-2', shift_date: '2026-08-10', start_time: '09:00', end_time: '09:00', is_open_ended: true, department_id: 'dept-1',
}

describe('UC51 Clock Out (Casual Worker)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(casualAttendanceRepository.getUserByAuthId).mockResolvedValue({ id: 'cw-1', full_name: 'Casual Chris', role: 'Casual Worker' } as never)
    vi.mocked(casualAttendanceRepository.updateAttendanceRecord).mockImplementation(async (id, fields) => ({ id, ...fields } as never))
    vi.mocked(casualAttendanceRepository.markCasualWorkerDepartmentVerified).mockResolvedValue(undefined as never)
  })

  it('UC51-M-UT-CW: Casual Worker clocks out after a fixed shift has reached its scheduled end', async () => {
    vi.mocked(casualAttendanceRepository.getAssignmentById).mockResolvedValue({ id: 'assign-1', user_id: 'cw-1', shifts: fixedShift } as never)
    vi.mocked(casualAttendanceRepository.getAttendanceRecordByAssignmentId).mockResolvedValue({ id: 'rec-1', clock_in_time: '2026-08-10T01:00:00.000Z', clock_out_time: null } as never)

    const result = await casualAttendanceService.clockOut({
      authId: 'auth-1', shift_assignment_id: 'assign-1', clock_time: '2026-08-10T09:00:00.000Z', // 17:00 SGT
    })

    expect(result).toMatchObject({ id: 'rec-1', clock_out_time: '2026-08-10T09:00:00.000Z' })
  })

  it('UC51-A1-UT-CW: Casual Worker is blocked from clocking out before a fixed shift\'s scheduled end', async () => {
    vi.mocked(casualAttendanceRepository.getAssignmentById).mockResolvedValue({ id: 'assign-1', user_id: 'cw-1', shifts: fixedShift } as never)
    vi.mocked(casualAttendanceRepository.getAttendanceRecordByAssignmentId).mockResolvedValue({ id: 'rec-1', clock_in_time: '2026-08-10T01:00:00.000Z', clock_out_time: null } as never)

    await expect(casualAttendanceService.clockOut({
      authId: 'auth-1', shift_assignment_id: 'assign-1', clock_time: '2026-08-10T08:00:00.000Z', // 16:00 SGT
    })).rejects.toThrow('Too early to clock out')
  })

  it('UC51-A2-UT-CW: Casual Worker on an open-ended one-off job is blocked from clocking out before their supervisor releases them', async () => {
    vi.mocked(casualAttendanceRepository.getAssignmentById).mockResolvedValue({ id: 'assign-2', user_id: 'cw-1', shifts: oneOffShift } as never)
    vi.mocked(casualAttendanceRepository.getAttendanceRecordByAssignmentId).mockResolvedValue({ id: 'rec-2', clock_in_time: '2026-08-10T01:00:00.000Z', clock_out_time: null, clock_out_released: false } as never)

    await expect(casualAttendanceService.clockOut({
      authId: 'auth-1', shift_assignment_id: 'assign-2', clock_time: '2026-08-10T02:00:00.000Z',
    })).rejects.toThrow('Waiting for your supervisor to review your work before you can clock out')
  })

  it('UC51-BR-UT-CW-1: Casual Worker clocking out twice for the same shift is blocked', async () => {
    vi.mocked(casualAttendanceRepository.getAssignmentById).mockResolvedValue({ id: 'assign-1', user_id: 'cw-1', shifts: fixedShift } as never)
    vi.mocked(casualAttendanceRepository.getAttendanceRecordByAssignmentId).mockResolvedValue({ id: 'rec-1', clock_in_time: '2026-08-10T01:00:00.000Z', clock_out_time: '2026-08-10T09:00:00.000Z' } as never)

    await expect(casualAttendanceService.clockOut({
      authId: 'auth-1', shift_assignment_id: 'assign-1', clock_time: '2026-08-10T09:05:00.000Z',
    })).rejects.toThrow('Already clocked out for this shift')
  })

  it('UC51-BR-UT-CW-2: A successful clock-out marks the Casual Worker verified in this department\'s pool', async () => {
    vi.mocked(casualAttendanceRepository.getAssignmentById).mockResolvedValue({ id: 'assign-1', user_id: 'cw-1', shifts: fixedShift } as never)
    vi.mocked(casualAttendanceRepository.getAttendanceRecordByAssignmentId).mockResolvedValue({ id: 'rec-1', clock_in_time: '2026-08-10T01:00:00.000Z', clock_out_time: null } as never)

    await casualAttendanceService.clockOut({
      authId: 'auth-1', shift_assignment_id: 'assign-1', clock_time: '2026-08-10T09:00:00.000Z',
    })

    expect(casualAttendanceRepository.markCasualWorkerDepartmentVerified).toHaveBeenCalledWith('cw-1', 'dept-1')
  })
})
