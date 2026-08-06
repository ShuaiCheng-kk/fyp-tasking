import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase', () => ({
  supabase: {},
  createClient: () => ({}),
}))

vi.mock('@/repositories/owner/attendanceRepository', () => ({
  attendanceRepository: {
    getShiftAssignmentById: vi.fn(),
    getUsersByIds: vi.fn(),
    getPendingSwapRequestsByAssignment: vi.fn(),
    createShiftSwapRequest: vi.fn(),
  },
}))

import { attendanceService } from './attendanceService'
import { attendanceRepository } from '@/repositories/owner/attendanceRepository'

// "Today" (sgtTodayKey) resolves off Date.now(); fix it so shift dates in tests are stable.
vi.setSystemTime(new Date('2026-08-05T00:00:00.000Z')) // 08:00 SGT, 5 August 2026

const reqShift = { id: 'shift-1', company_id: 'comp-1', department_id: 'dept-1', shift_date: '2026-08-10' }
const ctrShift = { id: 'shift-2', company_id: 'comp-1', department_id: 'dept-1', shift_date: '2026-08-11' }

function assignment(id: string, user_id: string, shifts: typeof reqShift) {
  return { id, user_id, shift_id: shifts.id, shifts }
}

const requesterUser = { id: 'emp-1', full_name: 'Req', role: 'Employee', profile_photo_url: null }
const counterpartUser = { id: 'emp-2', full_name: 'Ctr', role: 'Employee', profile_photo_url: null }

describe('UC54 Submit Shift Swap Request', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(attendanceRepository.getPendingSwapRequestsByAssignment).mockResolvedValue([])
    vi.mocked(attendanceRepository.createShiftSwapRequest).mockImplementation(async (input) => ({ ...input, id: 'swap-1', status: 'pending', counterpart_status: 'pending' } as never))
  })

  it('UC54-M-UT-M: Manager submits a shift swap request against a same-role, same-department peer', async () => {
    const mgrReq = { id: 'emp-1', full_name: 'Req', role: 'Manager', profile_photo_url: null }
    const mgrCtr = { id: 'emp-2', full_name: 'Ctr', role: 'Manager', profile_photo_url: null }
    vi.mocked(attendanceRepository.getShiftAssignmentById)
      .mockResolvedValueOnce(assignment('assign-1', 'emp-1', reqShift) as never)
      .mockResolvedValueOnce(assignment('assign-2', 'emp-2', ctrShift) as never)
    vi.mocked(attendanceRepository.getUsersByIds).mockResolvedValue([mgrReq, mgrCtr] as never)

    const result = await attendanceService.submitShiftSwapRequest({
      company_id: 'comp-1', requester_id: 'emp-1', requester_assignment_id: 'assign-1',
      counterpart_id: 'emp-2', counterpart_assignment_id: 'assign-2', reason: 'Family commitment',
    })

    expect(result).toMatchObject({ status: 'pending', counterpart_status: 'pending' })
  })

  it('UC54-M-UT-E: Employee submits a shift swap request against a same-role, same-department peer', async () => {
    vi.mocked(attendanceRepository.getShiftAssignmentById)
      .mockResolvedValueOnce(assignment('assign-1', 'emp-1', reqShift) as never)
      .mockResolvedValueOnce(assignment('assign-2', 'emp-2', ctrShift) as never)
    vi.mocked(attendanceRepository.getUsersByIds).mockResolvedValue([requesterUser, counterpartUser] as never)

    const result = await attendanceService.submitShiftSwapRequest({
      company_id: 'comp-1', requester_id: 'emp-1', requester_assignment_id: 'assign-1',
      counterpart_id: 'emp-2', counterpart_assignment_id: 'assign-2', reason: 'Family commitment',
    })

    expect(result).toMatchObject({ status: 'pending', counterpart_status: 'pending' })
  })

  it('UC54-A1-UT-M-1: Manager is blocked from picking a counterpart of a different role', async () => {
    const mgrReq = { id: 'emp-1', full_name: 'Req', role: 'Manager', profile_photo_url: null }
    const empCtr = { id: 'emp-2', full_name: 'Ctr', role: 'Employee', profile_photo_url: null }
    vi.mocked(attendanceRepository.getShiftAssignmentById)
      .mockResolvedValueOnce(assignment('assign-1', 'emp-1', reqShift) as never)
      .mockResolvedValueOnce(assignment('assign-2', 'emp-2', ctrShift) as never)
    vi.mocked(attendanceRepository.getUsersByIds).mockResolvedValue([mgrReq, empCtr] as never)

    await expect(attendanceService.submitShiftSwapRequest({
      company_id: 'comp-1', requester_id: 'emp-1', requester_assignment_id: 'assign-1',
      counterpart_id: 'emp-2', counterpart_assignment_id: 'assign-2', reason: null,
    })).rejects.toThrow('Both users must have the same role to swap shifts')
  })

  it('UC54-A1-UT-M-2: Manager is blocked from picking a counterpart shift in a different department', async () => {
    const mgrReq = { id: 'emp-1', full_name: 'Req', role: 'Manager', profile_photo_url: null }
    const mgrCtr = { id: 'emp-2', full_name: 'Ctr', role: 'Manager', profile_photo_url: null }
    const otherDeptShift = { ...ctrShift, department_id: 'dept-2' }
    vi.mocked(attendanceRepository.getShiftAssignmentById)
      .mockResolvedValueOnce(assignment('assign-1', 'emp-1', reqShift) as never)
      .mockResolvedValueOnce(assignment('assign-2', 'emp-2', otherDeptShift) as never)
    vi.mocked(attendanceRepository.getUsersByIds).mockResolvedValue([mgrReq, mgrCtr] as never)

    await expect(attendanceService.submitShiftSwapRequest({
      company_id: 'comp-1', requester_id: 'emp-1', requester_assignment_id: 'assign-1',
      counterpart_id: 'emp-2', counterpart_assignment_id: 'assign-2', reason: null,
    })).rejects.toThrow('Both shifts must be in the same department')
  })

  it('UC54-A1-UT-E-1: Employee is blocked from picking their own shift when it is scheduled for today or earlier', async () => {
    const todayShift = { ...reqShift, shift_date: '2026-08-05' }
    vi.mocked(attendanceRepository.getShiftAssignmentById)
      .mockResolvedValueOnce(assignment('assign-1', 'emp-1', todayShift) as never)
      .mockResolvedValueOnce(assignment('assign-2', 'emp-2', ctrShift) as never)
    vi.mocked(attendanceRepository.getUsersByIds).mockResolvedValue([requesterUser, counterpartUser] as never)

    await expect(attendanceService.submitShiftSwapRequest({
      company_id: 'comp-1', requester_id: 'emp-1', requester_assignment_id: 'assign-1',
      counterpart_id: 'emp-2', counterpart_assignment_id: 'assign-2', reason: null,
    })).rejects.toThrow('Your shift must be scheduled for tomorrow or later')
  })

  it('UC54-A1-UT-E-2: Employee is blocked from picking a shift that already has a pending swap request', async () => {
    vi.mocked(attendanceRepository.getShiftAssignmentById)
      .mockResolvedValueOnce(assignment('assign-1', 'emp-1', reqShift) as never)
      .mockResolvedValueOnce(assignment('assign-2', 'emp-2', ctrShift) as never)
    vi.mocked(attendanceRepository.getUsersByIds).mockResolvedValue([requesterUser, counterpartUser] as never)
    vi.mocked(attendanceRepository.getPendingSwapRequestsByAssignment)
      .mockResolvedValueOnce([{ id: 'existing-swap' }] as never)
      .mockResolvedValueOnce([])

    await expect(attendanceService.submitShiftSwapRequest({
      company_id: 'comp-1', requester_id: 'emp-1', requester_assignment_id: 'assign-1',
      counterpart_id: 'emp-2', counterpart_assignment_id: 'assign-2', reason: null,
    })).rejects.toThrow('Your shift already has a pending swap request')
  })

  it('UC54-BR-UT-M: Manager is blocked from submitting a swap naming themselves as the counterpart', async () => {
    await expect(attendanceService.submitShiftSwapRequest({
      company_id: 'comp-1', requester_id: 'mgr-1', requester_assignment_id: 'assign-1',
      counterpart_id: 'mgr-1', counterpart_assignment_id: 'assign-1', reason: null,
    })).rejects.toThrow('Cannot swap shifts with yourself')
  })
})
