import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabaseAdmin', () => ({
  getSupabaseAdmin: () => ({}),
}))

vi.mock('@/lib/supabase', () => ({
  supabase: {},
  createClient: () => ({}),
}))

vi.mock('@/repositories/owner/ownerTeamRepository', () => ({
  ownerTeamRepository: {
    findUserById: vi.fn(),
    findDepartmentById: vi.fn(),
    removeManagerDepartmentsByCompany: vi.fn(),
    moveManagerToDepartment: vi.fn(),
    deleteEmployeeDepartmentsByUserId: vi.fn(),
    assignEmployeeDepartment: vi.fn(),
  },
}))

import { ownerTeamService } from './ownerTeamService'
import { ownerTeamRepository } from '@/repositories/owner/ownerTeamRepository'

describe('UC30 Change Member Department', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(ownerTeamRepository.findDepartmentById).mockResolvedValue({ id: 'dept-2', company_id: 'comp-1', name: 'Finance' } as never)
  })

  it('UC30-M-UT-O-1: Owner moves a Manager to a different department', async () => {
    vi.mocked(ownerTeamRepository.findUserById).mockResolvedValue({ id: 'mgr-1', company_id: 'comp-1', role: 'Manager' } as never)
    vi.mocked(ownerTeamRepository.removeManagerDepartmentsByCompany).mockResolvedValue(undefined as never)
    vi.mocked(ownerTeamRepository.moveManagerToDepartment).mockResolvedValue(undefined as never)

    await ownerTeamService.changeMemberDepartment({ user_id: 'mgr-1', department_id: 'dept-2', company_id: 'comp-1' })

    expect(ownerTeamRepository.removeManagerDepartmentsByCompany).toHaveBeenCalledWith('mgr-1', 'comp-1')
    expect(ownerTeamRepository.moveManagerToDepartment).toHaveBeenCalledWith('mgr-1', 'comp-1', 'dept-2')
  })

  it('UC30-M-UT-O-2: Owner moves an Employee to a different department', async () => {
    vi.mocked(ownerTeamRepository.findUserById).mockResolvedValue({ id: 'emp-1', company_id: 'comp-1', role: 'Employee' } as never)
    vi.mocked(ownerTeamRepository.deleteEmployeeDepartmentsByUserId).mockResolvedValue(undefined as never)
    vi.mocked(ownerTeamRepository.assignEmployeeDepartment).mockResolvedValue(undefined as never)

    await ownerTeamService.changeMemberDepartment({ user_id: 'emp-1', department_id: 'dept-2', company_id: 'comp-1' })

    expect(ownerTeamRepository.deleteEmployeeDepartmentsByUserId).toHaveBeenCalledWith('emp-1')
    expect(ownerTeamRepository.assignEmployeeDepartment).toHaveBeenCalledWith('emp-1', 'dept-2')
  })

  it('UC30-BR-UT-O: Owner is blocked from changing a Partner\'s department', async () => {
    vi.mocked(ownerTeamRepository.findUserById).mockResolvedValue({ id: 'partner-1', company_id: 'comp-1', role: 'Partner' } as never)

    await expect(ownerTeamService.changeMemberDepartment({ user_id: 'partner-1', department_id: 'dept-2', company_id: 'comp-1' }))
      .rejects.toThrow('Only Managers and Employees can be assigned to departments')

    expect(ownerTeamRepository.moveManagerToDepartment).not.toHaveBeenCalled()
    expect(ownerTeamRepository.assignEmployeeDepartment).not.toHaveBeenCalled()
  })
})
