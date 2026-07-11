import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase', () => ({
  supabase: {},
  createClient: () => ({}),
}))

const deleteUserMock = vi.fn()
vi.mock('@/lib/supabaseAdmin', () => ({
  getSupabaseAdmin: () => ({
    auth: { admin: { deleteUser: deleteUserMock } },
  }),
}))

vi.mock('@/repositories/owner/ownerTeamRepository', () => ({
  ownerTeamRepository: {
    findCompanyById: vi.fn(),
    findMembersByCompanyId: vi.fn(),
    findManagersByCompany: vi.fn(),
    findManagersByDepartment: vi.fn(),
    findUserById: vi.fn(),
    findUserByAuthIdOrInternalId: vi.fn(),
    deleteUserById: vi.fn(),
    deleteInboxByUserId: vi.fn(),
    deleteMessagesByUserId: vi.fn(),
    deleteManagerDepartmentsByUserId: vi.fn(),
    deleteEmployeeDepartmentsByUserId: vi.fn(),
    cleanupUserOperationalReferences: vi.fn(),
    countSupervisedActivePostings: vi.fn(),
    countSupervisedUpcomingShifts: vi.fn(),
    findManagerDepartments: vi.fn(),
    findDepartmentManagers: vi.fn(),
    assignManagerDepartment: vi.fn(),
    removeManagerDepartmentsByCompany: vi.fn(),
    removeManagerDepartment: vi.fn(),
  },
}))

import { ownerTeamService } from './ownerTeamService'
import { ownerTeamRepository } from '@/repositories/owner/ownerTeamRepository'
import { User } from '@/types/auth.types'

const company = { id: 'company-1', owner_id: 'owner-1' }

const makeUser = (overrides: Partial<User> = {}): User => ({
  id: 'user-1',
  supabase_auth_id: 'auth-1',
  full_name: 'Test User',
  email_address: 'test@example.com',
  phone_number: null,
  date_of_birth: null,
  profile_photo_url: null,
  role: 'Employee',
  company_id: 'company-1',
  created_at: '2026-01-01',
  payment_method: null,
  payment_account: null,
  ...overrides,
})

describe('ownerTeamService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Employees with no live supervised jobs/shifts pass the removal guard by default.
    vi.mocked(ownerTeamRepository.countSupervisedActivePostings).mockResolvedValue(0)
    vi.mocked(ownerTeamRepository.countSupervisedUpcomingShifts).mockResolvedValue(0)
  })

  describe('getTeamByCompany (UC28)', () => {
    it('sorts members by role hierarchy: Owner, Partner, Manager, Employee, Casual Worker, Guest User', async () => {
      const members = [
        makeUser({ id: 'cw-1', role: 'Casual Worker' }),
        makeUser({ id: 'owner-1', role: 'Owner' }),
        makeUser({ id: 'emp-1', role: 'Employee' }),
        makeUser({ id: 'mgr-1', role: 'Manager' }),
      ]
      vi.mocked(ownerTeamRepository.findMembersByCompanyId).mockResolvedValue(members)

      const result = await ownerTeamService.getTeamByCompany('company-1')

      expect(result.map(m => m.id)).toEqual(['owner-1', 'mgr-1', 'emp-1', 'cw-1'])
    })
  })

  describe('getManagersByDepartment', () => {
    it('delegates straight to the repository', async () => {
      const managers = [{ id: 'mgr-1', full_name: 'Manager One' }]
      vi.mocked(ownerTeamRepository.findManagersByDepartment).mockResolvedValue(managers)

      const result = await ownerTeamService.getManagersByDepartment('company-1', 'dept-1')

      expect(ownerTeamRepository.findManagersByDepartment).toHaveBeenCalledWith('company-1', 'dept-1')
      expect(result).toEqual(managers)
    })
  })

  describe('removeMember (UC30)', () => {
    const requester = makeUser({ id: 'owner-1', role: 'Owner' })
    const target = makeUser({ id: 'user-2', role: 'Employee', supabase_auth_id: 'auth-2' })

    it('throws when the company does not exist', async () => {
      vi.mocked(ownerTeamRepository.findCompanyById).mockResolvedValue(null)
      await expect(ownerTeamService.removeMember('company-1', 'user-2', 'owner-1'))
        .rejects.toThrow('Company not found')
    })

    it('throws when the requesting user cannot be found', async () => {
      vi.mocked(ownerTeamRepository.findCompanyById).mockResolvedValue(company)
      vi.mocked(ownerTeamRepository.findUserByAuthIdOrInternalId).mockResolvedValue(null)
      await expect(ownerTeamService.removeMember('company-1', 'user-2', 'owner-1'))
        .rejects.toThrow('Requesting user not found')
    })

    it('throws when the target user cannot be found', async () => {
      vi.mocked(ownerTeamRepository.findCompanyById).mockResolvedValue(company)
      vi.mocked(ownerTeamRepository.findUserByAuthIdOrInternalId).mockResolvedValue(requester)
      vi.mocked(ownerTeamRepository.findUserById).mockResolvedValue(null)
      await expect(ownerTeamService.removeMember('company-1', 'user-2', 'owner-1'))
        .rejects.toThrow('Target user not found')
    })

    it('refuses to remove the company creator', async () => {
      vi.mocked(ownerTeamRepository.findCompanyById).mockResolvedValue(company)
      vi.mocked(ownerTeamRepository.findUserByAuthIdOrInternalId).mockResolvedValue(requester)
      vi.mocked(ownerTeamRepository.findUserById).mockResolvedValue(makeUser({ id: 'owner-1', role: 'Owner' }))
      await expect(ownerTeamService.removeMember('company-1', 'owner-1', 'owner-1'))
        .rejects.toThrow('Cannot remove the company creator')
    })

    it('refuses to let a user remove themselves', async () => {
      const manager = makeUser({ id: 'mgr-1', role: 'Manager' })
      vi.mocked(ownerTeamRepository.findCompanyById).mockResolvedValue(company)
      vi.mocked(ownerTeamRepository.findUserByAuthIdOrInternalId).mockResolvedValue(manager)
      vi.mocked(ownerTeamRepository.findUserById).mockResolvedValue(manager)
      await expect(ownerTeamService.removeMember('company-1', 'mgr-1', 'mgr-1'))
        .rejects.toThrow('Cannot remove yourself')
    })

    it('refuses when the target belongs to a different company', async () => {
      vi.mocked(ownerTeamRepository.findCompanyById).mockResolvedValue(company)
      vi.mocked(ownerTeamRepository.findUserByAuthIdOrInternalId).mockResolvedValue(requester)
      vi.mocked(ownerTeamRepository.findUserById).mockResolvedValue(makeUser({ id: 'user-2', company_id: 'other-company' }))
      await expect(ownerTeamService.removeMember('company-1', 'user-2', 'owner-1'))
        .rejects.toThrow('User is not a member of this company')
    })

    it('refuses a non-creator (Partner) removing another Owner/Partner', async () => {
      const partnerRequester = makeUser({ id: 'partner-1', role: 'Partner' })
      vi.mocked(ownerTeamRepository.findCompanyById).mockResolvedValue(company)
      vi.mocked(ownerTeamRepository.findUserByAuthIdOrInternalId).mockResolvedValue(partnerRequester)
      vi.mocked(ownerTeamRepository.findUserById).mockResolvedValue(makeUser({ id: 'user-2', role: 'Owner' }))
      await expect(ownerTeamService.removeMember('company-1', 'user-2', 'partner-1'))
        .rejects.toThrow('Insufficient permissions to remove a Partner')
    })

    it('blocks removing an Employee who supervises live recruitment jobs or upcoming casual shifts', async () => {
      vi.mocked(ownerTeamRepository.findCompanyById).mockResolvedValue(company)
      vi.mocked(ownerTeamRepository.findUserByAuthIdOrInternalId).mockResolvedValue(requester)
      vi.mocked(ownerTeamRepository.findUserById).mockResolvedValue(target)
      vi.mocked(ownerTeamRepository.countSupervisedActivePostings).mockResolvedValue(1)

      await expect(ownerTeamService.removeMember('company-1', 'user-2', 'owner-1'))
        .rejects.toThrow('Assign another supervisor')
      expect(ownerTeamRepository.deleteUserById).not.toHaveBeenCalled()

      // Also blocked when the postings are done but hired shifts are still upcoming.
      vi.mocked(ownerTeamRepository.countSupervisedActivePostings).mockResolvedValue(0)
      vi.mocked(ownerTeamRepository.countSupervisedUpcomingShifts).mockResolvedValue(2)
      await expect(ownerTeamService.removeMember('company-1', 'user-2', 'owner-1'))
        .rejects.toThrow('Assign another supervisor')
    })

    it('removes a member: cleans up references, deletes the row, and deletes the auth user', async () => {
      vi.mocked(ownerTeamRepository.findCompanyById).mockResolvedValue(company)
      vi.mocked(ownerTeamRepository.findUserByAuthIdOrInternalId).mockResolvedValue(requester)
      vi.mocked(ownerTeamRepository.findUserById).mockResolvedValue(target)
      deleteUserMock.mockResolvedValue({ error: null })

      const result = await ownerTeamService.removeMember('company-1', 'user-2', 'owner-1')

      expect(ownerTeamRepository.deleteInboxByUserId).toHaveBeenCalledWith('user-2')
      expect(ownerTeamRepository.deleteMessagesByUserId).toHaveBeenCalledWith('user-2')
      expect(ownerTeamRepository.cleanupUserOperationalReferences).toHaveBeenCalledWith('user-2', 'owner-1')
      expect(ownerTeamRepository.deleteManagerDepartmentsByUserId).toHaveBeenCalledWith('user-2')
      expect(ownerTeamRepository.deleteEmployeeDepartmentsByUserId).toHaveBeenCalledWith('user-2')
      expect(ownerTeamRepository.deleteUserById).toHaveBeenCalledWith('user-2')
      expect(deleteUserMock).toHaveBeenCalledWith('auth-2')
      expect(result).toEqual({ success: true, accountDeleted: true })
    })

    it('throws when deleting the auth user fails', async () => {
      vi.mocked(ownerTeamRepository.findCompanyById).mockResolvedValue(company)
      vi.mocked(ownerTeamRepository.findUserByAuthIdOrInternalId).mockResolvedValue(requester)
      vi.mocked(ownerTeamRepository.findUserById).mockResolvedValue(target)
      deleteUserMock.mockResolvedValue({ error: { message: 'boom' } })

      await expect(ownerTeamService.removeMember('company-1', 'user-2', 'owner-1'))
        .rejects.toThrow('Failed to delete auth user: boom')
    })

    it('does not call auth.admin.deleteUser when the target has no supabase_auth_id', async () => {
      vi.mocked(ownerTeamRepository.findCompanyById).mockResolvedValue(company)
      vi.mocked(ownerTeamRepository.findUserByAuthIdOrInternalId).mockResolvedValue(requester)
      vi.mocked(ownerTeamRepository.findUserById).mockResolvedValue(makeUser({ id: 'user-2', supabase_auth_id: '' }))

      await ownerTeamService.removeMember('company-1', 'user-2', 'owner-1')

      expect(deleteUserMock).not.toHaveBeenCalled()
    })
  })

  describe('setDepartmentManager (UC31)', () => {
    it('throws when the manager is not found in the company', async () => {
      vi.mocked(ownerTeamRepository.findUserById).mockResolvedValue(null)
      await expect(ownerTeamService.setDepartmentManager({
        manager_id: 'mgr-1', company_id: 'company-1', department_id: 'dept-1', assigned_by: 'owner-1',
      })).rejects.toThrow('Manager not found in this company')
    })

    it('throws when the user is not a Manager', async () => {
      vi.mocked(ownerTeamRepository.findUserById).mockResolvedValue(makeUser({ id: 'mgr-1', role: 'Employee' }))
      await expect(ownerTeamService.setDepartmentManager({
        manager_id: 'mgr-1', company_id: 'company-1', department_id: 'dept-1', assigned_by: 'owner-1',
      })).rejects.toThrow('Manager not found in this company')
    })

    it('throws when the manager belongs to a different company', async () => {
      vi.mocked(ownerTeamRepository.findUserById).mockResolvedValue(makeUser({ id: 'mgr-1', role: 'Manager', company_id: 'other-company' }))
      await expect(ownerTeamService.setDepartmentManager({
        manager_id: 'mgr-1', company_id: 'company-1', department_id: 'dept-1', assigned_by: 'owner-1',
      })).rejects.toThrow('Manager not found in this company')
    })

    it('clears existing department assignments before assigning the new one', async () => {
      vi.mocked(ownerTeamRepository.findUserById).mockResolvedValue(makeUser({ id: 'mgr-1', role: 'Manager', company_id: 'company-1' }))

      await ownerTeamService.setDepartmentManager({
        manager_id: 'mgr-1', company_id: 'company-1', department_id: 'dept-1', assigned_by: 'owner-1',
      })

      expect(ownerTeamRepository.removeManagerDepartmentsByCompany).toHaveBeenCalledWith('mgr-1', 'company-1')
      expect(ownerTeamRepository.assignManagerDepartment).toHaveBeenCalledWith('mgr-1', 'company-1', 'dept-1', 'owner-1')
    })
  })

  describe('assignManagerToDepartment', () => {
    it('throws when the manager is not found in the company', async () => {
      vi.mocked(ownerTeamRepository.findUserById).mockResolvedValue(null)
      await expect(ownerTeamService.assignManagerToDepartment('mgr-1', 'company-1', 'dept-1', 'owner-1'))
        .rejects.toThrow('Manager not found in this company')
    })

    it('assigns the manager once found in the company', async () => {
      vi.mocked(ownerTeamRepository.findUserById).mockResolvedValue(makeUser({ id: 'mgr-1', company_id: 'company-1' }))

      await ownerTeamService.assignManagerToDepartment('mgr-1', 'company-1', 'dept-1', 'owner-1')

      expect(ownerTeamRepository.assignManagerDepartment).toHaveBeenCalledWith('mgr-1', 'company-1', 'dept-1', 'owner-1')
    })
  })

  describe('removeManagerFromDepartment', () => {
    it('throws when the manager cannot be found', async () => {
      vi.mocked(ownerTeamRepository.findUserById).mockResolvedValue(null)
      await expect(ownerTeamService.removeManagerFromDepartment('mgr-1', 'dept-1'))
        .rejects.toThrow('Manager not found')
    })

    it('removes the manager from the department once found', async () => {
      vi.mocked(ownerTeamRepository.findUserById).mockResolvedValue(makeUser({ id: 'mgr-1' }))

      await ownerTeamService.removeManagerFromDepartment('mgr-1', 'dept-1')

      expect(ownerTeamRepository.removeManagerDepartment).toHaveBeenCalledWith('mgr-1', 'dept-1')
    })
  })
})
