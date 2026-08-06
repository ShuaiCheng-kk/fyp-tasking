import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase', () => ({
  supabase: {},
  createClient: () => ({}),
}))

vi.mock('@/repositories/employee/employeeAttendanceRepository', () => ({
  employeeAttendanceRepository: {
    getUserByAuthId: vi.fn(),
    getAssignmentById: vi.fn(),
    getAttendanceRecordByAssignmentId: vi.fn(),
    createAttendanceRecord: vi.fn(),
    updateAttendanceRecord: vi.fn(),
  },
}))

import { employeeAttendanceService } from './employeeAttendanceService'
import { employeeAttendanceRepository } from '@/repositories/employee/employeeAttendanceRepository'

// Shift: 2026-08-10, 09:00-17:00 SGT
const shift = {
  id: 'shift-1', shift_date: '2026-08-10', start_time: '09:00', end_time: '17:00', is_open_ended: false,
}

function assignmentFor(role: 'Manager' | 'Employee') {
  return { id: 'assign-1', user_id: `${role.toLowerCase()}-1`, shifts: shift }
}

describe('UC50 Clock In', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(employeeAttendanceRepository.getAttendanceRecordByAssignmentId).mockResolvedValue(null)
    vi.mocked(employeeAttendanceRepository.createAttendanceRecord).mockImplementation(async (input) => input as never)
  })

  it('UC50-M-UT-M: Manager clocks in within the present window and the record is created', async () => {
    vi.mocked(employeeAttendanceRepository.getUserByAuthId).mockResolvedValue({ id: 'manager-1', full_name: 'Mgr', role: 'Manager' } as never)
    vi.mocked(employeeAttendanceRepository.getAssignmentById).mockResolvedValue(assignmentFor('Manager') as never)

    const result = await employeeAttendanceService.clockIn({
      authId: 'auth-1', shift_assignment_id: 'assign-1', clock_time: '2026-08-10T00:45:00.000Z', // 08:45 SGT
    })

    expect(result).toMatchObject({ shift_assignment_id: 'assign-1', user_id: 'manager-1', clock_in_time: '2026-08-10T00:45:00.000Z' })
  })

  it('UC50-M-UT-E: Employee clocks in within the present window and the record is created', async () => {
    vi.mocked(employeeAttendanceRepository.getUserByAuthId).mockResolvedValue({ id: 'employee-1', full_name: 'Emp', role: 'Employee' } as never)
    vi.mocked(employeeAttendanceRepository.getAssignmentById).mockResolvedValue(assignmentFor('Employee') as never)

    const result = await employeeAttendanceService.clockIn({
      authId: 'auth-2', shift_assignment_id: 'assign-1', clock_time: '2026-08-10T00:45:00.000Z',
    })

    expect(result).toMatchObject({ shift_assignment_id: 'assign-1', user_id: 'employee-1', clock_in_time: '2026-08-10T00:45:00.000Z' })
  })

  it('UC50-A1-UT-M: Manager clocking in more than 10 minutes late is recorded as-is, not rounded down', async () => {
    vi.mocked(employeeAttendanceRepository.getUserByAuthId).mockResolvedValue({ id: 'manager-1', full_name: 'Mgr', role: 'Manager' } as never)
    vi.mocked(employeeAttendanceRepository.getAssignmentById).mockResolvedValue(assignmentFor('Manager') as never)

    const result = await employeeAttendanceService.clockIn({
      authId: 'auth-1', shift_assignment_id: 'assign-1', clock_time: '2026-08-10T01:20:00.000Z', // 09:20 SGT, 20 min late
    })

    expect(result).toMatchObject({ clock_in_time: '2026-08-10T01:20:00.000Z' })
  })

  it('UC50-A1-UT-E: Employee clocking in more than 10 minutes late is recorded as-is, not rounded down', async () => {
    vi.mocked(employeeAttendanceRepository.getUserByAuthId).mockResolvedValue({ id: 'employee-1', full_name: 'Emp', role: 'Employee' } as never)
    vi.mocked(employeeAttendanceRepository.getAssignmentById).mockResolvedValue(assignmentFor('Employee') as never)

    const result = await employeeAttendanceService.clockIn({
      authId: 'auth-2', shift_assignment_id: 'assign-1', clock_time: '2026-08-10T01:20:00.000Z',
    })

    expect(result).toMatchObject({ clock_in_time: '2026-08-10T01:20:00.000Z' })
  })

  it('UC50-A2-UT-M-1: Manager is blocked from clocking in more than 30 minutes before the shift starts', async () => {
    vi.mocked(employeeAttendanceRepository.getUserByAuthId).mockResolvedValue({ id: 'manager-1', full_name: 'Mgr', role: 'Manager' } as never)
    vi.mocked(employeeAttendanceRepository.getAssignmentById).mockResolvedValue(assignmentFor('Manager') as never)

    await expect(employeeAttendanceService.clockIn({
      authId: 'auth-1', shift_assignment_id: 'assign-1', clock_time: '2026-08-10T00:00:00.000Z', // 08:00 SGT, 60 min early
    })).rejects.toThrow('Too early to clock in for this shift')
  })

  it('UC50-A2-UT-M-2: Manager is blocked from clocking in after the shift has already ended', async () => {
    vi.mocked(employeeAttendanceRepository.getUserByAuthId).mockResolvedValue({ id: 'manager-1', full_name: 'Mgr', role: 'Manager' } as never)
    vi.mocked(employeeAttendanceRepository.getAssignmentById).mockResolvedValue(assignmentFor('Manager') as never)

    await expect(employeeAttendanceService.clockIn({
      authId: 'auth-1', shift_assignment_id: 'assign-1', clock_time: '2026-08-10T09:30:00.000Z', // 17:30 SGT, after end
    })).rejects.toThrow('Shift has already ended')
  })

  it('UC50-A2-UT-E-1: Employee is blocked from clocking in more than 30 minutes before the shift starts', async () => {
    vi.mocked(employeeAttendanceRepository.getUserByAuthId).mockResolvedValue({ id: 'employee-1', full_name: 'Emp', role: 'Employee' } as never)
    vi.mocked(employeeAttendanceRepository.getAssignmentById).mockResolvedValue(assignmentFor('Employee') as never)

    await expect(employeeAttendanceService.clockIn({
      authId: 'auth-2', shift_assignment_id: 'assign-1', clock_time: '2026-08-10T00:00:00.000Z',
    })).rejects.toThrow('Too early to clock in for this shift')
  })

  it('UC50-A2-UT-E-2: Employee is blocked from clocking in after the shift has already ended', async () => {
    vi.mocked(employeeAttendanceRepository.getUserByAuthId).mockResolvedValue({ id: 'employee-1', full_name: 'Emp', role: 'Employee' } as never)
    vi.mocked(employeeAttendanceRepository.getAssignmentById).mockResolvedValue(assignmentFor('Employee') as never)

    await expect(employeeAttendanceService.clockIn({
      authId: 'auth-2', shift_assignment_id: 'assign-1', clock_time: '2026-08-10T09:30:00.000Z',
    })).rejects.toThrow('Shift has already ended')
  })

  it('UC50-BR-UT-M: Manager clocking in within the 10-minute grace period is rounded down to the exact scheduled start', async () => {
    vi.mocked(employeeAttendanceRepository.getUserByAuthId).mockResolvedValue({ id: 'manager-1', full_name: 'Mgr', role: 'Manager' } as never)
    vi.mocked(employeeAttendanceRepository.getAssignmentById).mockResolvedValue(assignmentFor('Manager') as never)

    const result = await employeeAttendanceService.clockIn({
      authId: 'auth-1', shift_assignment_id: 'assign-1', clock_time: '2026-08-10T01:07:00.000Z', // 09:07 SGT, 7 min late
    })

    expect(result).toMatchObject({ clock_in_time: '2026-08-10T01:00:00.000Z' }) // rounded to 09:00 SGT
  })

  it('UC50-BR-UT-E: Employee clocking in within the 10-minute grace period is rounded down to the exact scheduled start', async () => {
    vi.mocked(employeeAttendanceRepository.getUserByAuthId).mockResolvedValue({ id: 'employee-1', full_name: 'Emp', role: 'Employee' } as never)
    vi.mocked(employeeAttendanceRepository.getAssignmentById).mockResolvedValue(assignmentFor('Employee') as never)

    const result = await employeeAttendanceService.clockIn({
      authId: 'auth-2', shift_assignment_id: 'assign-1', clock_time: '2026-08-10T01:07:00.000Z',
    })

    expect(result).toMatchObject({ clock_in_time: '2026-08-10T01:00:00.000Z' })
  })
})
