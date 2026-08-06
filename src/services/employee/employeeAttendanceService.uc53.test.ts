import { describe, it, expect, vi, beforeEach } from 'vitest'

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

describe('UC53 Break Out', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(employeeAttendanceRepository.updateAttendanceRecord).mockImplementation(async (id, fields) => ({ id, ...fields } as never))
  })

  it('UC53-M-UT-M: Manager ends an in-progress break', async () => {
    vi.mocked(employeeAttendanceRepository.getUserByAuthId).mockResolvedValue({ id: 'manager-1', full_name: 'Mgr', role: 'Manager' } as never)
    vi.mocked(employeeAttendanceRepository.getAttendanceRecordByAssignmentId).mockResolvedValue({ id: 'rec-1', break_in_time: '2026-08-10T05:00:00.000Z', break_out_time: null } as never)

    const result = await employeeAttendanceService.breakOut({ authId: 'auth-1', shift_assignment_id: 'assign-1' })

    expect(result).toMatchObject({ id: 'rec-1', break_out_time: expect.any(String) })
  })

  it('UC53-M-UT-E: Employee ends an in-progress break', async () => {
    vi.mocked(employeeAttendanceRepository.getUserByAuthId).mockResolvedValue({ id: 'employee-1', full_name: 'Emp', role: 'Employee' } as never)
    vi.mocked(employeeAttendanceRepository.getAttendanceRecordByAssignmentId).mockResolvedValue({ id: 'rec-1', break_in_time: '2026-08-10T05:00:00.000Z', break_out_time: null } as never)

    const result = await employeeAttendanceService.breakOut({ authId: 'auth-2', shift_assignment_id: 'assign-1' })

    expect(result).toMatchObject({ id: 'rec-1', break_out_time: expect.any(String) })
  })

  it('UC53-BR-UT-M: Manager is blocked from ending a break that was never started', async () => {
    vi.mocked(employeeAttendanceRepository.getUserByAuthId).mockResolvedValue({ id: 'manager-1', full_name: 'Mgr', role: 'Manager' } as never)
    vi.mocked(employeeAttendanceRepository.getAttendanceRecordByAssignmentId).mockResolvedValue({ id: 'rec-1', break_in_time: null, break_out_time: null } as never)

    await expect(employeeAttendanceService.breakOut({ authId: 'auth-1', shift_assignment_id: 'assign-1' }))
      .rejects.toThrow('No break started')
  })

  it('UC53-BR-UT-E: Employee is blocked from ending a break that has already ended', async () => {
    vi.mocked(employeeAttendanceRepository.getUserByAuthId).mockResolvedValue({ id: 'employee-1', full_name: 'Emp', role: 'Employee' } as never)
    vi.mocked(employeeAttendanceRepository.getAttendanceRecordByAssignmentId).mockResolvedValue({ id: 'rec-1', break_in_time: '2026-08-10T05:00:00.000Z', break_out_time: '2026-08-10T05:15:00.000Z' } as never)

    await expect(employeeAttendanceService.breakOut({ authId: 'auth-2', shift_assignment_id: 'assign-1' }))
      .rejects.toThrow('Break already ended')
  })
})
