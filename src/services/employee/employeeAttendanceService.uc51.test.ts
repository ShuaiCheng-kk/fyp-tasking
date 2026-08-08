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
    getAssignmentById: vi.fn(),
    getAttendanceRecordByAssignmentId: vi.fn(),
    updateAttendanceRecord: vi.fn(),
  },
}))

import { employeeAttendanceService } from './employeeAttendanceService'
import { employeeAttendanceRepository } from '@/repositories/employee/employeeAttendanceRepository'

const fixedShift = {
  id: 'shift-1', shift_date: '2026-08-10', start_time: '09:00', end_time: '17:00', is_open_ended: false,
}

function assignmentFor(role: 'Manager' | 'Employee') {
  return { id: 'assign-1', user_id: `${role.toLowerCase()}-1`, shifts: fixedShift }
}

describe('UC51 Clock Out', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(employeeAttendanceRepository.updateAttendanceRecord).mockImplementation(async (id, fields) => ({ id, ...fields } as never))
  })

  it('UC51-M-UT-M: Manager clocks out after the shift has reached its scheduled end', async () => {
    vi.mocked(employeeAttendanceRepository.getUserByAuthId).mockResolvedValue({ id: 'manager-1', full_name: 'Mgr', role: 'Manager' } as never)
    vi.mocked(employeeAttendanceRepository.getAssignmentById).mockResolvedValue(assignmentFor('Manager') as never)
    vi.mocked(employeeAttendanceRepository.getAttendanceRecordByAssignmentId).mockResolvedValue({ id: 'rec-1', clock_in_time: '2026-08-10T01:00:00.000Z', clock_out_time: null } as never)

    const result = await employeeAttendanceService.clockOut({
      authId: 'auth-1', shift_assignment_id: 'assign-1', clock_time: '2026-08-10T09:00:00.000Z', // 17:00 SGT
    })

    expect(result).toMatchObject({ id: 'rec-1', clock_out_time: '2026-08-10T09:00:00.000Z' })
  })

  it('UC51-M-UT-E: Employee clocks out after the shift has reached its scheduled end', async () => {
    vi.mocked(employeeAttendanceRepository.getUserByAuthId).mockResolvedValue({ id: 'employee-1', full_name: 'Emp', role: 'Employee' } as never)
    vi.mocked(employeeAttendanceRepository.getAssignmentById).mockResolvedValue(assignmentFor('Employee') as never)
    vi.mocked(employeeAttendanceRepository.getAttendanceRecordByAssignmentId).mockResolvedValue({ id: 'rec-1', clock_in_time: '2026-08-10T01:00:00.000Z', clock_out_time: null } as never)

    const result = await employeeAttendanceService.clockOut({
      authId: 'auth-2', shift_assignment_id: 'assign-1', clock_time: '2026-08-10T09:00:00.000Z',
    })

    expect(result).toMatchObject({ id: 'rec-1', clock_out_time: '2026-08-10T09:00:00.000Z' })
  })

  it('UC51-A1-UT-M: Manager is blocked from clocking out before a fixed shift\'s scheduled end', async () => {
    vi.mocked(employeeAttendanceRepository.getUserByAuthId).mockResolvedValue({ id: 'manager-1', full_name: 'Mgr', role: 'Manager' } as never)
    vi.mocked(employeeAttendanceRepository.getAssignmentById).mockResolvedValue(assignmentFor('Manager') as never)
    vi.mocked(employeeAttendanceRepository.getAttendanceRecordByAssignmentId).mockResolvedValue({ id: 'rec-1', clock_in_time: '2026-08-10T01:00:00.000Z', clock_out_time: null } as never)

    await expect(employeeAttendanceService.clockOut({
      authId: 'auth-1', shift_assignment_id: 'assign-1', clock_time: '2026-08-10T08:00:00.000Z', // 16:00 SGT
    })).rejects.toThrow('Too early to clock out')
  })

  it('UC51-A1-UT-E: Employee is blocked from clocking out before a fixed shift\'s scheduled end', async () => {
    vi.mocked(employeeAttendanceRepository.getUserByAuthId).mockResolvedValue({ id: 'employee-1', full_name: 'Emp', role: 'Employee' } as never)
    vi.mocked(employeeAttendanceRepository.getAssignmentById).mockResolvedValue(assignmentFor('Employee') as never)
    vi.mocked(employeeAttendanceRepository.getAttendanceRecordByAssignmentId).mockResolvedValue({ id: 'rec-1', clock_in_time: '2026-08-10T01:00:00.000Z', clock_out_time: null } as never)

    await expect(employeeAttendanceService.clockOut({
      authId: 'auth-2', shift_assignment_id: 'assign-1', clock_time: '2026-08-10T08:00:00.000Z',
    })).rejects.toThrow('Too early to clock out')
  })

  it('UC51-BR-UT-M: Manager clocking out twice for the same shift is blocked', async () => {
    vi.mocked(employeeAttendanceRepository.getUserByAuthId).mockResolvedValue({ id: 'manager-1', full_name: 'Mgr', role: 'Manager' } as never)
    vi.mocked(employeeAttendanceRepository.getAssignmentById).mockResolvedValue(assignmentFor('Manager') as never)
    vi.mocked(employeeAttendanceRepository.getAttendanceRecordByAssignmentId).mockResolvedValue({ id: 'rec-1', clock_in_time: '2026-08-10T01:00:00.000Z', clock_out_time: '2026-08-10T09:00:00.000Z' } as never)

    await expect(employeeAttendanceService.clockOut({
      authId: 'auth-1', shift_assignment_id: 'assign-1', clock_time: '2026-08-10T09:05:00.000Z',
    })).rejects.toThrow('Already clocked out for this shift')
  })

  it('UC51-BR-UT-E: Employee clocking out without having clocked in first is blocked', async () => {
    vi.mocked(employeeAttendanceRepository.getUserByAuthId).mockResolvedValue({ id: 'employee-1', full_name: 'Emp', role: 'Employee' } as never)
    vi.mocked(employeeAttendanceRepository.getAssignmentById).mockResolvedValue(assignmentFor('Employee') as never)
    vi.mocked(employeeAttendanceRepository.getAttendanceRecordByAssignmentId).mockResolvedValue(null)

    await expect(employeeAttendanceService.clockOut({
      authId: 'auth-2', shift_assignment_id: 'assign-1', clock_time: '2026-08-10T09:00:00.000Z',
    })).rejects.toThrow('Clock in before clocking out')
  })
})
