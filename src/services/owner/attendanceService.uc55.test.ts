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
    getShiftSwapRequestById: vi.fn(),
    getUsersByIds: vi.fn(),
    getShiftAssignmentById: vi.fn(),
    updateShiftAssignmentUser: vi.fn(),
    updateShiftSwapRequest: vi.fn(),
  },
}))

vi.mock('@/repositories/owner/ownerTeamRepository', () => ({
  ownerTeamRepository: {
    findManagerDepartments: vi.fn(),
  },
}))

vi.mock('@/repositories/owner/taskRepository', () => ({
  taskRepository: {
    reassignTasksForShiftSwap: vi.fn(),
  },
}))

import { attendanceService } from './attendanceService'
import { attendanceRepository } from '@/repositories/owner/attendanceRepository'
import { ownerTeamRepository } from '@/repositories/owner/ownerTeamRepository'
import { taskRepository } from '@/repositories/owner/taskRepository'

vi.setSystemTime(new Date('2026-08-05T00:00:00.000Z')) // 08:00 SGT, 5 August 2026

const users: Record<string, { id: string; full_name: string; role: string; profile_photo_url: null }> = {
  'owner-1': { id: 'owner-1', full_name: 'Owner', role: 'Owner', profile_photo_url: null },
  'partner-1': { id: 'partner-1', full_name: 'Partner', role: 'Partner', profile_photo_url: null },
  'mgr-1': { id: 'mgr-1', full_name: 'Requester Mgr', role: 'Manager', profile_photo_url: null },
  'mgr-2': { id: 'mgr-2', full_name: 'Counterpart Mgr', role: 'Manager', profile_photo_url: null },
  'mgr-3': { id: 'mgr-3', full_name: 'Dept Manager', role: 'Manager', profile_photo_url: null },
  'mgr-4': { id: 'mgr-4', full_name: 'Other Dept Manager', role: 'Manager', profile_photo_url: null },
  'emp-1': { id: 'emp-1', full_name: 'Requester Emp', role: 'Employee', profile_photo_url: null },
  'emp-2': { id: 'emp-2', full_name: 'Counterpart Emp', role: 'Employee', profile_photo_url: null },
}

const assignments: Record<string, { id: string; user_id: string; shift_id: string; shifts: { id: string; shift_date: string; department_id: string } }> = {
  'assign-mgr-1': { id: 'assign-mgr-1', user_id: 'mgr-1', shift_id: 'shift-mgr-1', shifts: { id: 'shift-mgr-1', shift_date: '2026-08-10', department_id: 'dept-1' } },
  'assign-mgr-2': { id: 'assign-mgr-2', user_id: 'mgr-2', shift_id: 'shift-mgr-2', shifts: { id: 'shift-mgr-2', shift_date: '2026-08-11', department_id: 'dept-1' } },
  'assign-emp-1': { id: 'assign-emp-1', user_id: 'emp-1', shift_id: 'shift-emp-1', shifts: { id: 'shift-emp-1', shift_date: '2026-08-10', department_id: 'dept-1' } },
  'assign-emp-2': { id: 'assign-emp-2', user_id: 'emp-2', shift_id: 'shift-emp-2', shifts: { id: 'shift-emp-2', shift_date: '2026-08-11', department_id: 'dept-1' } },
}

function managerSwap(counterpart_status: 'pending' | 'approved') {
  return {
    id: 'swap-1', company_id: 'comp-1', requester_id: 'mgr-1', requester_assignment_id: 'assign-mgr-1',
    counterpart_id: 'mgr-2', counterpart_assignment_id: 'assign-mgr-2', reason: 'Personal', status: 'pending',
    counterpart_status, reviewed_by: null, reviewed_at: null, owner_review_reason: null,
  }
}

function employeeSwap(counterpart_status: 'pending' | 'approved') {
  return {
    id: 'swap-2', company_id: 'comp-1', requester_id: 'emp-1', requester_assignment_id: 'assign-emp-1',
    counterpart_id: 'emp-2', counterpart_assignment_id: 'assign-emp-2', reason: 'Personal', status: 'pending',
    counterpart_status, reviewed_by: null, reviewed_at: null, owner_review_reason: null,
  }
}

describe('UC55 Approve Shift Swap Request', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(attendanceRepository.getUsersByIds).mockImplementation(async (ids) => ids.map(id => users[id]).filter(Boolean) as never)
    vi.mocked(attendanceRepository.getShiftAssignmentById).mockImplementation(async (id) => (assignments[id] ?? null) as never)
    vi.mocked(attendanceRepository.updateShiftAssignmentUser).mockResolvedValue(undefined as never)
    vi.mocked(attendanceRepository.updateShiftSwapRequest).mockImplementation(async (id, fields) => ({ id, ...fields } as never))
    vi.mocked(taskRepository.reassignTasksForShiftSwap).mockResolvedValue(undefined as never)
    vi.mocked(ownerTeamRepository.findManagerDepartments).mockResolvedValue([{ department_id: 'dept-1', department_name: 'Retail' }] as never)
  })

  it('UC55-M-UT-O: Owner approves a Manager\'s shift swap request whose counterpart has already agreed', async () => {
    vi.mocked(attendanceRepository.getShiftSwapRequestById).mockResolvedValue(managerSwap('approved') as never)

    const result = await attendanceService.decideShiftSwapRequest({ id: 'swap-1', decision: 'approved', reviewer_id: 'owner-1' })

    expect(result).toMatchObject({ status: 'approved' })
    expect(attendanceRepository.updateShiftAssignmentUser).toHaveBeenCalledWith('assign-mgr-1', 'mgr-2')
    expect(attendanceRepository.updateShiftAssignmentUser).toHaveBeenCalledWith('assign-mgr-2', 'mgr-1')
  })

  it('UC55-M-UT-P: Partner approves a Manager\'s shift swap request whose counterpart has already agreed', async () => {
    vi.mocked(attendanceRepository.getShiftSwapRequestById).mockResolvedValue(managerSwap('approved') as never)

    const result = await attendanceService.decideShiftSwapRequest({ id: 'swap-1', decision: 'approved', reviewer_id: 'partner-1' })

    expect(result).toMatchObject({ status: 'approved' })
  })

  it('UC55-M-UT-M: Manager approves an Employee\'s shift swap request within their own department, whose counterpart has already agreed', async () => {
    vi.mocked(attendanceRepository.getShiftSwapRequestById).mockResolvedValue(employeeSwap('approved') as never)

    const result = await attendanceService.decideShiftSwapRequest({ id: 'swap-2', decision: 'approved', reviewer_id: 'mgr-3' })

    expect(result).toMatchObject({ status: 'approved' })
    expect(attendanceRepository.updateShiftAssignmentUser).toHaveBeenCalledWith('assign-emp-1', 'emp-2')
    expect(attendanceRepository.updateShiftAssignmentUser).toHaveBeenCalledWith('assign-emp-2', 'emp-1')
  })

  it('UC55-A1-UT-O: Owner is blocked from approving a Manager\'s swap the counterpart has not agreed to yet', async () => {
    vi.mocked(attendanceRepository.getShiftSwapRequestById).mockResolvedValue(managerSwap('pending') as never)

    await expect(attendanceService.decideShiftSwapRequest({ id: 'swap-1', decision: 'approved', reviewer_id: 'owner-1' }))
      .rejects.toThrow('Counterpart has not agreed yet')
  })

  it('UC55-A1-UT-P: Partner is blocked from approving a Manager\'s swap the counterpart has not agreed to yet', async () => {
    vi.mocked(attendanceRepository.getShiftSwapRequestById).mockResolvedValue(managerSwap('pending') as never)

    await expect(attendanceService.decideShiftSwapRequest({ id: 'swap-1', decision: 'approved', reviewer_id: 'partner-1' }))
      .rejects.toThrow('Counterpart has not agreed yet')
  })

  it('UC55-A1-UT-M: Manager is blocked from approving an Employee\'s swap the counterpart has not agreed to yet', async () => {
    vi.mocked(attendanceRepository.getShiftSwapRequestById).mockResolvedValue(employeeSwap('pending') as never)

    await expect(attendanceService.decideShiftSwapRequest({ id: 'swap-2', decision: 'approved', reviewer_id: 'mgr-3' }))
      .rejects.toThrow('Counterpart has not agreed yet')
  })

  it('UC55-A2-UT-O: Owner rejects a Manager\'s swap request instead of approving it, and no shift assignment changes', async () => {
    vi.mocked(attendanceRepository.getShiftSwapRequestById).mockResolvedValue(managerSwap('approved') as never)

    const result = await attendanceService.decideShiftSwapRequest({ id: 'swap-1', decision: 'rejected', reviewer_id: 'owner-1', reason: 'Coverage conflict' })

    expect(result).toMatchObject({ status: 'rejected' })
    expect(attendanceRepository.updateShiftAssignmentUser).not.toHaveBeenCalled()
  })

  it('UC55-A2-UT-P: Partner rejects a Manager\'s swap request instead of approving it, and no shift assignment changes', async () => {
    vi.mocked(attendanceRepository.getShiftSwapRequestById).mockResolvedValue(managerSwap('approved') as never)

    const result = await attendanceService.decideShiftSwapRequest({ id: 'swap-1', decision: 'rejected', reviewer_id: 'partner-1', reason: 'Coverage conflict' })

    expect(result).toMatchObject({ status: 'rejected' })
    expect(attendanceRepository.updateShiftAssignmentUser).not.toHaveBeenCalled()
  })

  it('UC55-A2-UT-M: Manager rejects an Employee\'s swap request instead of approving it, and no shift assignment changes', async () => {
    vi.mocked(attendanceRepository.getShiftSwapRequestById).mockResolvedValue(employeeSwap('approved') as never)

    const result = await attendanceService.decideShiftSwapRequest({ id: 'swap-2', decision: 'rejected', reviewer_id: 'mgr-3', reason: 'Coverage conflict' })

    expect(result).toMatchObject({ status: 'rejected' })
    expect(attendanceRepository.updateShiftAssignmentUser).not.toHaveBeenCalled()
  })

  it('UC55-BR-UT-O: Owner is blocked from deciding an Employee\'s swap request, since only a Manager can', async () => {
    vi.mocked(attendanceRepository.getShiftSwapRequestById).mockResolvedValue(employeeSwap('approved') as never)

    await expect(attendanceService.decideShiftSwapRequest({ id: 'swap-2', decision: 'approved', reviewer_id: 'owner-1' }))
      .rejects.toThrow("Only a Manager can decide an Employee's shift swap request")
  })

  it('UC55-BR-UT-M-1: Manager is blocked from deciding a peer Manager\'s swap request, since only Owner or Partner can', async () => {
    vi.mocked(attendanceRepository.getShiftSwapRequestById).mockResolvedValue(managerSwap('approved') as never)

    await expect(attendanceService.decideShiftSwapRequest({ id: 'swap-1', decision: 'approved', reviewer_id: 'mgr-3' }))
      .rejects.toThrow("Only Owner or Partner can decide a Manager's shift swap request")
  })

  it('UC55-BR-UT-M-2: Manager is blocked from deciding an Employee\'s swap request outside their own managed department', async () => {
    vi.mocked(attendanceRepository.getShiftSwapRequestById).mockResolvedValue(employeeSwap('approved') as never)
    vi.mocked(ownerTeamRepository.findManagerDepartments).mockResolvedValue([{ department_id: 'dept-2', department_name: 'Warehouse' }] as never)

    await expect(attendanceService.decideShiftSwapRequest({ id: 'swap-2', decision: 'approved', reviewer_id: 'mgr-4' }))
      .rejects.toThrow('You can only decide shift swap requests within your own department')
  })
})
