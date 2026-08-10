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

vi.setSystemTime(new Date('2026-08-05T00:00:00.000Z')) // 08:00 SGT, 5 August 2026

const users: Record<string, { id: string; full_name: string; role: string; profile_photo_url: null; company_id: string }> = {
  'owner-1': { id: 'owner-1', full_name: 'Owner', role: 'Owner', profile_photo_url: null, company_id: 'comp-1' },
  'partner-1': { id: 'partner-1', full_name: 'Partner', role: 'Partner', profile_photo_url: null, company_id: 'comp-1' },
  'mgr-1': { id: 'mgr-1', full_name: 'Requester Mgr', role: 'Manager', profile_photo_url: null, company_id: 'comp-1' },
  'mgr-2': { id: 'mgr-2', full_name: 'Counterpart Mgr', role: 'Manager', profile_photo_url: null, company_id: 'comp-1' },
  'mgr-3': { id: 'mgr-3', full_name: 'Dept Manager', role: 'Manager', profile_photo_url: null, company_id: 'comp-1' },
  'emp-1': { id: 'emp-1', full_name: 'Requester Emp', role: 'Employee', profile_photo_url: null, company_id: 'comp-1' },
  'emp-2': { id: 'emp-2', full_name: 'Counterpart Emp', role: 'Employee', profile_photo_url: null, company_id: 'comp-1' },
}

const assignments: Record<string, { id: string; user_id: string; shift_id: string; shifts: { id: string; shift_date: string; department_id: string } }> = {
  'assign-mgr-1': { id: 'assign-mgr-1', user_id: 'mgr-1', shift_id: 'shift-mgr-1', shifts: { id: 'shift-mgr-1', shift_date: '2026-08-10', department_id: 'dept-1' } },
  'assign-mgr-2': { id: 'assign-mgr-2', user_id: 'mgr-2', shift_id: 'shift-mgr-2', shifts: { id: 'shift-mgr-2', shift_date: '2026-08-11', department_id: 'dept-1' } },
  'assign-emp-1': { id: 'assign-emp-1', user_id: 'emp-1', shift_id: 'shift-emp-1', shifts: { id: 'shift-emp-1', shift_date: '2026-08-10', department_id: 'dept-1' } },
  'assign-emp-2': { id: 'assign-emp-2', user_id: 'emp-2', shift_id: 'shift-emp-2', shifts: { id: 'shift-emp-2', shift_date: '2026-08-11', department_id: 'dept-1' } },
}

function managerSwap() {
  return {
    id: 'swap-1', company_id: 'comp-1', requester_id: 'mgr-1', requester_assignment_id: 'assign-mgr-1',
    counterpart_id: 'mgr-2', counterpart_assignment_id: 'assign-mgr-2', reason: 'Personal', status: 'pending',
    counterpart_status: 'approved', reviewed_by: null, reviewed_at: null, owner_review_reason: null,
  }
}

function employeeSwap() {
  return {
    id: 'swap-2', company_id: 'comp-1', requester_id: 'emp-1', requester_assignment_id: 'assign-emp-1',
    counterpart_id: 'emp-2', counterpart_assignment_id: 'assign-emp-2', reason: 'Personal', status: 'pending',
    counterpart_status: 'approved', reviewed_by: null, reviewed_at: null, owner_review_reason: null,
  }
}

describe('UC56 Reject Shift Swap Request', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(attendanceRepository.getUsersByIds).mockImplementation(async (ids) => ids.map(id => users[id]).filter(Boolean) as never)
    vi.mocked(attendanceRepository.getShiftAssignmentById).mockImplementation(async (id) => (assignments[id] ?? null) as never)
    vi.mocked(attendanceRepository.updateShiftSwapRequest).mockImplementation(async (id, fields) => ({ id, ...fields } as never))
    vi.mocked(ownerTeamRepository.findManagerDepartments).mockResolvedValue([{ department_id: 'dept-1', department_name: 'Retail' }] as never)
  })

  it('UC56-M-UT-O: Owner rejects a Manager\'s shift swap request with a reason', async () => {
    vi.mocked(attendanceRepository.getShiftSwapRequestById).mockResolvedValue(managerSwap() as never)

    const result = await attendanceService.decideShiftSwapRequest({ id: 'swap-1', decision: 'rejected', reviewer_id: 'owner-1', reason: 'Coverage conflict' })

    expect(result).toMatchObject({ status: 'rejected', owner_review_reason: 'Coverage conflict' })
  })

  it('UC56-M-UT-P: Partner rejects a Manager\'s shift swap request with a reason', async () => {
    vi.mocked(attendanceRepository.getShiftSwapRequestById).mockResolvedValue(managerSwap() as never)

    const result = await attendanceService.decideShiftSwapRequest({ id: 'swap-1', decision: 'rejected', reviewer_id: 'partner-1', reason: 'Coverage conflict' })

    expect(result).toMatchObject({ status: 'rejected', owner_review_reason: 'Coverage conflict' })
  })

  it('UC56-M-UT-M: Manager rejects an Employee\'s shift swap request with a reason', async () => {
    vi.mocked(attendanceRepository.getShiftSwapRequestById).mockResolvedValue(employeeSwap() as never)

    const result = await attendanceService.decideShiftSwapRequest({ id: 'swap-2', decision: 'rejected', reviewer_id: 'mgr-3', reason: 'Coverage conflict' })

    expect(result).toMatchObject({ status: 'rejected', owner_review_reason: 'Coverage conflict' })
  })

  it('UC56-A1-UT-O: Owner is blocked from rejecting a Manager\'s swap request without typing a reason', async () => {
    vi.mocked(attendanceRepository.getShiftSwapRequestById).mockResolvedValue(managerSwap() as never)

    await expect(attendanceService.decideShiftSwapRequest({ id: 'swap-1', decision: 'rejected', reviewer_id: 'owner-1', reason: '' }))
      .rejects.toThrow('A reason is required to reject a shift swap request')
  })

  it('UC56-A1-UT-P: Partner is blocked from rejecting a Manager\'s swap request without typing a reason', async () => {
    vi.mocked(attendanceRepository.getShiftSwapRequestById).mockResolvedValue(managerSwap() as never)

    await expect(attendanceService.decideShiftSwapRequest({ id: 'swap-1', decision: 'rejected', reviewer_id: 'partner-1', reason: '   ' }))
      .rejects.toThrow('A reason is required to reject a shift swap request')
  })

  it('UC56-A1-UT-M: Manager is blocked from rejecting an Employee\'s swap request without typing a reason', async () => {
    vi.mocked(attendanceRepository.getShiftSwapRequestById).mockResolvedValue(employeeSwap() as never)

    await expect(attendanceService.decideShiftSwapRequest({ id: 'swap-2', decision: 'rejected', reviewer_id: 'mgr-3', reason: null }))
      .rejects.toThrow('A reason is required to reject a shift swap request')
  })
})
