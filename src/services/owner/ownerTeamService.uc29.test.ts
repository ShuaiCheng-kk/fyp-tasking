import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase', () => ({
  supabase: {},
  createClient: () => ({}),
}))

const deleteUserMock = vi.fn()
vi.mock('@/lib/supabaseAdmin', () => ({
  getSupabaseAdmin: () => ({ auth: { admin: { deleteUser: deleteUserMock } } }),
}))

vi.mock('@/services/email/emailService', () => ({
  emailService: {
    sendRemovedFromCompanyEmail: vi.fn(),
  },
}))

vi.mock('@/repositories/owner/ownerTeamRepository', () => ({
  ownerTeamRepository: {
    findCompanyById: vi.fn(),
    findUserByAuthIdOrInternalId: vi.fn(),
    findUserById: vi.fn(),
    findPartnersByCompany: vi.fn(),
    findManagerDepartments: vi.fn(),
    findManagersByDepartment: vi.fn(),
    findEmployeeDepartments: vi.fn(),
    findEmployeesByDepartment: vi.fn(),
    deleteMessagesByUserId: vi.fn(),
    cleanupUserOperationalReferences: vi.fn(),
    deleteManagerDepartmentsByUserId: vi.fn(),
    deleteEmployeeDepartmentsByUserId: vi.fn(),
    deleteUserById: vi.fn(),
  },
}))

import { ownerTeamService } from './ownerTeamService'
import { emailService } from '@/services/email/emailService'
import { ownerTeamRepository } from '@/repositories/owner/ownerTeamRepository'

const company = { id: 'comp-1', owner_id: 'owner-1', name: 'Test Company' }

describe('UC29 Remove Team Member', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(ownerTeamRepository.findCompanyById).mockResolvedValue(company as never)
    vi.mocked(ownerTeamRepository.deleteMessagesByUserId).mockResolvedValue(undefined as never)
    vi.mocked(ownerTeamRepository.cleanupUserOperationalReferences).mockResolvedValue(undefined as never)
    vi.mocked(ownerTeamRepository.deleteManagerDepartmentsByUserId).mockResolvedValue(undefined as never)
    vi.mocked(ownerTeamRepository.deleteEmployeeDepartmentsByUserId).mockResolvedValue(undefined as never)
    vi.mocked(ownerTeamRepository.deleteUserById).mockResolvedValue(undefined as never)
    deleteUserMock.mockResolvedValue({ error: null })
  })

  it('UC29-M-UT-O-1: Owner removes a Manager, whose work reassigns to another Manager in the same department', async () => {
    vi.mocked(ownerTeamRepository.findUserByAuthIdOrInternalId).mockResolvedValue({ id: 'owner-1', company_id: 'comp-1' } as never)
    vi.mocked(ownerTeamRepository.findUserById).mockResolvedValue({
      id: 'mgr-1', company_id: 'comp-1', role: 'Manager', full_name: 'Manager One', supabase_auth_id: 'auth-mgr-1', email_address: 'mgr1@test.com',
    } as never)
    vi.mocked(ownerTeamRepository.findManagerDepartments).mockResolvedValue([{ department_id: 'dept-1', department_name: 'Operations' }] as never)
    vi.mocked(ownerTeamRepository.findManagersByDepartment).mockResolvedValue([
      { id: 'mgr-1', full_name: 'Manager One' }, { id: 'mgr-2', full_name: 'Manager Two' },
    ] as never)

    const result = await ownerTeamService.removeMember('comp-1', 'mgr-1', 'owner-1')

    expect(result).toEqual({
      success: true,
      accountDeleted: true,
      removalNotice: { to: 'mgr1@test.com', fullName: 'Manager One', companyName: 'Test Company' },
    })
    expect(ownerTeamRepository.cleanupUserOperationalReferences).toHaveBeenCalledWith('mgr-1', 'mgr-2', 'Manager One', 'mgr-2')
    expect(ownerTeamRepository.deleteUserById).toHaveBeenCalledWith('mgr-1')
    expect(deleteUserMock).toHaveBeenCalledWith('auth-mgr-1')
  })

  it('UC29-M-UT-O-2: Owner removes an Employee, whose work reassigns to another Employee in the same department', async () => {
    vi.mocked(ownerTeamRepository.findUserByAuthIdOrInternalId).mockResolvedValue({ id: 'owner-1', company_id: 'comp-1' } as never)
    vi.mocked(ownerTeamRepository.findUserById).mockResolvedValue({
      id: 'emp-1', company_id: 'comp-1', role: 'Employee', full_name: 'Employee One', supabase_auth_id: 'auth-emp-1', email_address: 'emp1@test.com',
    } as never)
    vi.mocked(ownerTeamRepository.findEmployeeDepartments).mockResolvedValue([{ department_id: 'dept-1', department_name: 'Operations' }] as never)
    vi.mocked(ownerTeamRepository.findEmployeesByDepartment).mockResolvedValue([
      { id: 'emp-1', full_name: 'Employee One' }, { id: 'emp-2', full_name: 'Employee Two' },
    ] as never)

    const result = await ownerTeamService.removeMember('comp-1', 'emp-1', 'owner-1')

    expect(result).toMatchObject({ success: true, accountDeleted: true })
    expect(ownerTeamRepository.cleanupUserOperationalReferences).toHaveBeenCalledWith('emp-1', 'emp-2', 'Employee One', 'emp-2')
    expect(ownerTeamRepository.deleteUserById).toHaveBeenCalledWith('emp-1')
  })

  it('UC29-M-UT-O-3: Owner removes a Partner, whose work reassigns to another Partner', async () => {
    vi.mocked(ownerTeamRepository.findUserByAuthIdOrInternalId).mockResolvedValue({ id: 'owner-1', company_id: 'comp-1' } as never)
    vi.mocked(ownerTeamRepository.findUserById).mockResolvedValue({
      id: 'partner-1', company_id: 'comp-1', role: 'Partner', full_name: 'Partner One', supabase_auth_id: 'auth-partner-1', email_address: 'partner1@test.com',
    } as never)
    vi.mocked(ownerTeamRepository.findPartnersByCompany).mockResolvedValue([
      { id: 'partner-1' }, { id: 'partner-2' },
    ] as never)

    const result = await ownerTeamService.removeMember('comp-1', 'partner-1', 'owner-1')

    expect(result).toMatchObject({ success: true, accountDeleted: true })
    expect(ownerTeamRepository.cleanupUserOperationalReferences).toHaveBeenCalledWith('partner-1', 'partner-2', 'Partner One', 'partner-2')
  })

  // The removal used to await the "you've been removed" email before returning, so a slow email
  // provider stalled a removal whose database work was already finished (14.6s measured against the
  // 50-employee scalability fixture). The email is now the route's job, scheduled after it responds.
  it('UC29-BR-UT-O-2: removeMember returns the notice for the caller to send instead of sending it inline', async () => {
    vi.mocked(ownerTeamRepository.findUserByAuthIdOrInternalId).mockResolvedValue({ id: 'owner-1', company_id: 'comp-1' } as never)
    vi.mocked(ownerTeamRepository.findUserById).mockResolvedValue({
      id: 'emp-9', company_id: 'comp-1', role: 'Employee', full_name: 'Employee Nine', supabase_auth_id: 'auth-emp-9', email_address: 'emp9@test.com',
    } as never)
    vi.mocked(ownerTeamRepository.findEmployeeDepartments).mockResolvedValue([] as never)

    const result = await ownerTeamService.removeMember('comp-1', 'emp-9', 'owner-1')

    expect(result.removalNotice).toEqual({
      to: 'emp9@test.com', fullName: 'Employee Nine', companyName: 'Test Company',
    })
    expect(emailService.sendRemovedFromCompanyEmail).not.toHaveBeenCalled()

    // ...and the separate method the route schedules does send it.
    await ownerTeamService.sendRemovalNotice(result.removalNotice)
    expect(emailService.sendRemovedFromCompanyEmail).toHaveBeenCalledWith({
      to: 'emp9@test.com', fullName: 'Employee Nine', companyName: 'Test Company',
    })
  })

  it('UC29-BR-UT-O-1: Owner removes the only Partner, whose work reassigns to the Owner instead of being blocked', async () => {
    vi.mocked(ownerTeamRepository.findUserByAuthIdOrInternalId).mockResolvedValue({ id: 'owner-1', company_id: 'comp-1' } as never)
    vi.mocked(ownerTeamRepository.findUserById).mockResolvedValue({
      id: 'partner-3', company_id: 'comp-1', role: 'Partner', full_name: 'Partner Three', supabase_auth_id: 'auth-partner-3', email_address: 'partner3@test.com',
    } as never)
    vi.mocked(ownerTeamRepository.findPartnersByCompany).mockResolvedValue([{ id: 'partner-3' }] as never)

    const result = await ownerTeamService.removeMember('comp-1', 'partner-3', 'owner-1')

    expect(result).toMatchObject({ success: true, accountDeleted: true })
    expect(ownerTeamRepository.cleanupUserOperationalReferences).toHaveBeenCalledWith('partner-3', 'owner-1', 'Partner Three', 'owner-1')
  })

  it('UC29-A1-UT-O-1: Owner is blocked from removing the only Manager left in a department', async () => {
    vi.mocked(ownerTeamRepository.findUserByAuthIdOrInternalId).mockResolvedValue({ id: 'owner-1', company_id: 'comp-1' } as never)
    vi.mocked(ownerTeamRepository.findUserById).mockResolvedValue({
      id: 'mgr-3', company_id: 'comp-1', role: 'Manager', full_name: 'Manager Three', supabase_auth_id: 'auth-mgr-3', email_address: 'mgr3@test.com',
    } as never)
    vi.mocked(ownerTeamRepository.findManagerDepartments).mockResolvedValue([{ department_id: 'dept-2', department_name: 'Finance' }] as never)
    vi.mocked(ownerTeamRepository.findManagersByDepartment).mockResolvedValue([{ id: 'mgr-3', full_name: 'Manager Three' }] as never)

    await expect(ownerTeamService.removeMember('comp-1', 'mgr-3', 'owner-1'))
      .rejects.toThrow('Manager Three is the only Manager in the Finance department. Assign another Manager to this department before removing them.')

    expect(ownerTeamRepository.deleteUserById).not.toHaveBeenCalled()
  })

  it('UC29-A1-UT-O-2: Owner is blocked from removing the only Employee left in a department', async () => {
    vi.mocked(ownerTeamRepository.findUserByAuthIdOrInternalId).mockResolvedValue({ id: 'owner-1', company_id: 'comp-1' } as never)
    vi.mocked(ownerTeamRepository.findUserById).mockResolvedValue({
      id: 'emp-3', company_id: 'comp-1', role: 'Employee', full_name: 'Employee Three', supabase_auth_id: 'auth-emp-3', email_address: 'emp3@test.com',
    } as never)
    vi.mocked(ownerTeamRepository.findEmployeeDepartments).mockResolvedValue([{ department_id: 'dept-2', department_name: 'Finance' }] as never)
    vi.mocked(ownerTeamRepository.findEmployeesByDepartment).mockResolvedValue([{ id: 'emp-3', full_name: 'Employee Three' }] as never)

    await expect(ownerTeamService.removeMember('comp-1', 'emp-3', 'owner-1'))
      .rejects.toThrow('Employee Three is the only Employee in the Finance department. Assign another Employee to this department before removing them.')

    expect(ownerTeamRepository.deleteUserById).not.toHaveBeenCalled()
  })

  it('UC29-BR-UT-P: Partner is blocked from removing a team member, since only the company creator may remove members', async () => {
    vi.mocked(ownerTeamRepository.findUserByAuthIdOrInternalId).mockResolvedValue({ id: 'partner-9', company_id: 'comp-1' } as never)
    vi.mocked(ownerTeamRepository.findUserById).mockResolvedValue({
      id: 'mgr-9', company_id: 'comp-1', role: 'Manager', full_name: 'Manager Nine', supabase_auth_id: 'auth-mgr-9', email_address: 'mgr9@test.com',
    } as never)

    await expect(ownerTeamService.removeMember('comp-1', 'mgr-9', 'partner-9'))
      .rejects.toThrow('Insufficient permissions to remove a member')

    expect(ownerTeamRepository.deleteUserById).not.toHaveBeenCalled()
  })
})
