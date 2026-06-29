import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase', () => ({
  supabase: {},
  createClient: () => ({}),
}))

vi.mock('@/repositories/employee/employeeTeamRepository', () => ({
  employeeTeamRepository: {
    getEmployeeTeam: vi.fn(),
  },
}))

vi.mock('@/repositories/employee/employeeInboxRepository', () => ({
  employeeInboxRepository: {
    findUserByAuthIdOrInternalId: vi.fn(),
  },
}))

import { employeeTeamService } from './employeeTeamService'
import { employeeTeamRepository } from '@/repositories/employee/employeeTeamRepository'
import { employeeInboxRepository } from '@/repositories/employee/employeeInboxRepository'

describe('employeeTeamService — View Own Team', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getTeam', () => {
    it('throws when the user cannot be resolved from the auth id', async () => {
      vi.mocked(employeeInboxRepository.findUserByAuthIdOrInternalId).mockResolvedValue(null)

      await expect(employeeTeamService.getTeam('auth-1')).rejects.toThrow('User not found')
      expect(employeeTeamRepository.getEmployeeTeam).not.toHaveBeenCalled()
    })

    it('resolves the internal user id first, then fetches their team', async () => {
      vi.mocked(employeeInboxRepository.findUserByAuthIdOrInternalId).mockResolvedValue({
        id: 'employee-1', full_name: 'Employee One', email_address: 'e1@example.com', role: 'Employee',
      })
      const team = {
        manager: { id: 'mgr-1', full_name: 'Manager One', email_address: 'm1@example.com', role: 'Manager' },
        employees: [{ id: 'employee-2', full_name: 'Employee Two', email_address: 'e2@example.com', role: 'Employee' }],
      }
      vi.mocked(employeeTeamRepository.getEmployeeTeam).mockResolvedValue(team)

      const result = await employeeTeamService.getTeam('auth-1')

      expect(employeeInboxRepository.findUserByAuthIdOrInternalId).toHaveBeenCalledWith('auth-1')
      expect(employeeTeamRepository.getEmployeeTeam).toHaveBeenCalledWith('employee-1')
      expect(result).toEqual(team)
    })
  })
})
