import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabaseAdmin', () => ({
  getSupabaseAdmin: () => ({}),
}))

vi.mock('@/lib/supabase', () => ({
  supabase: {},
  createClient: () => ({}),
}))

vi.mock('@/repositories/employee/employeeAttendanceRepository', () => ({
  employeeAttendanceRepository: {
    getUserByAuthId: vi.fn(),
    getAttendanceRecordByAssignmentId: vi.fn(),
    updateAttendanceRecord: vi.fn(),
  },
}))

import { employeeAttendanceService } from './employeeAttendanceService'
import { employeeAttendanceRepository } from '@/repositories/employee/employeeAttendanceRepository'

describe('UC52 Break In', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(employeeAttendanceRepository.updateAttendanceRecord).mockImplementation(async (id, fields) => ({ id, ...fields } as never))
  })

  it('UC52-M-UT-M: Manager starts a break after clocking in', async () => {
    vi.mocked(employeeAttendanceRepository.getUserByAuthId).mockResolvedValue({ id: 'manager-1', full_name: 'Mgr', role: 'Manager' } as never)
    vi.mocked(employeeAttendanceRepository.getAttendanceRecordByAssignmentId).mockResolvedValue({ id: 'rec-1', clock_in_time: '2026-08-10T01:00:00.000Z', clock_out_time: null, break_in_time: null, break_out_time: null } as never)

    const result = await employeeAttendanceService.breakIn({ authId: 'auth-1', shift_assignment_id: 'assign-1' })

    expect(result).toMatchObject({ id: 'rec-1', break_in_time: expect.any(String) })
  })

  it('UC52-M-UT-E: Employee starts a break after clocking in', async () => {
    vi.mocked(employeeAttendanceRepository.getUserByAuthId).mockResolvedValue({ id: 'employee-1', full_name: 'Emp', role: 'Employee' } as never)
    vi.mocked(employeeAttendanceRepository.getAttendanceRecordByAssignmentId).mockResolvedValue({ id: 'rec-1', clock_in_time: '2026-08-10T01:00:00.000Z', clock_out_time: null, break_in_time: null, break_out_time: null } as never)

    const result = await employeeAttendanceService.breakIn({ authId: 'auth-2', shift_assignment_id: 'assign-1' })

    expect(result).toMatchObject({ id: 'rec-1', break_in_time: expect.any(String) })
  })

  it('UC52-BR-UT-M-1: Manager is blocked from starting a break before clocking in', async () => {
    vi.mocked(employeeAttendanceRepository.getUserByAuthId).mockResolvedValue({ id: 'manager-1', full_name: 'Mgr', role: 'Manager' } as never)
    vi.mocked(employeeAttendanceRepository.getAttendanceRecordByAssignmentId).mockResolvedValue(null)

    await expect(employeeAttendanceService.breakIn({ authId: 'auth-1', shift_assignment_id: 'assign-1' }))
      .rejects.toThrow('Clock in before taking a break')
  })

  it('UC52-BR-UT-E-1: Employee is blocked from starting a break while already on an active break', async () => {
    vi.mocked(employeeAttendanceRepository.getUserByAuthId).mockResolvedValue({ id: 'employee-1', full_name: 'Emp', role: 'Employee' } as never)
    vi.mocked(employeeAttendanceRepository.getAttendanceRecordByAssignmentId).mockResolvedValue({ id: 'rec-1', clock_in_time: '2026-08-10T01:00:00.000Z', clock_out_time: null, break_in_time: '2026-08-10T05:00:00.000Z', break_out_time: null } as never)

    await expect(employeeAttendanceService.breakIn({ authId: 'auth-2', shift_assignment_id: 'assign-1' }))
      .rejects.toThrow('Already on a break')
  })

  it('UC52-BR-UT-M-2: One Break Per Shift is not enforced server-side for Manager, so a second break-in after one already completed still succeeds', async () => {
    vi.mocked(employeeAttendanceRepository.getUserByAuthId).mockResolvedValue({ id: 'manager-1', full_name: 'Mgr', role: 'Manager' } as never)
    vi.mocked(employeeAttendanceRepository.getAttendanceRecordByAssignmentId).mockResolvedValue({ id: 'rec-1', clock_in_time: '2026-08-10T01:00:00.000Z', clock_out_time: null, break_in_time: '2026-08-10T05:00:00.000Z', break_out_time: '2026-08-10T05:15:00.000Z' } as never)

    const result = await employeeAttendanceService.breakIn({ authId: 'auth-1', shift_assignment_id: 'assign-1' })

    expect(result).toMatchObject({ id: 'rec-1', break_in_time: expect.any(String) })
  })

  it('UC52-BR-UT-E-2: One Break Per Shift is not enforced server-side for Employee, so a second break-in after one already completed still succeeds', async () => {
    vi.mocked(employeeAttendanceRepository.getUserByAuthId).mockResolvedValue({ id: 'employee-1', full_name: 'Emp', role: 'Employee' } as never)
    vi.mocked(employeeAttendanceRepository.getAttendanceRecordByAssignmentId).mockResolvedValue({ id: 'rec-1', clock_in_time: '2026-08-10T01:00:00.000Z', clock_out_time: null, break_in_time: '2026-08-10T05:00:00.000Z', break_out_time: '2026-08-10T05:15:00.000Z' } as never)

    const result = await employeeAttendanceService.breakIn({ authId: 'auth-2', shift_assignment_id: 'assign-1' })

    expect(result).toMatchObject({ id: 'rec-1', break_in_time: expect.any(String) })
  })
})
