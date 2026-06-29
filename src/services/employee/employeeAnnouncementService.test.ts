import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase', () => ({
  supabase: {},
  createClient: () => ({}),
}))

vi.mock('@/repositories/employee/employeeAnnouncementRepository', () => ({
  employeeAnnouncementRepository: {
    getEmployeeAnnouncements: vi.fn(),
  },
}))

vi.mock('@/repositories/employee/employeeInboxRepository', () => ({
  employeeInboxRepository: {
    findUserByAuthIdOrInternalId: vi.fn(),
  },
}))

import { employeeAnnouncementService } from './employeeAnnouncementService'
import { employeeAnnouncementRepository } from '@/repositories/employee/employeeAnnouncementRepository'
import { employeeInboxRepository } from '@/repositories/employee/employeeInboxRepository'

describe('employeeAnnouncementService — View Announcements (UC59)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getAnnouncements', () => {
    it('throws when the user cannot be resolved from the auth id', async () => {
      vi.mocked(employeeInboxRepository.findUserByAuthIdOrInternalId).mockResolvedValue(null)

      await expect(employeeAnnouncementService.getAnnouncements('auth-1')).rejects.toThrow('User not found')
      expect(employeeAnnouncementRepository.getEmployeeAnnouncements).not.toHaveBeenCalled()
    })

    it('resolves the internal user id first, then fetches their announcements', async () => {
      vi.mocked(employeeInboxRepository.findUserByAuthIdOrInternalId).mockResolvedValue({ id: 'employee-1' })
      const announcements = [{
        id: 'ann-1', from_user_id: 'owner-1', company_id: 'company-1', department_id: null,
        title: 'Welcome', content: 'Hello team', created_at: '2026-06-01T00:00:00Z', created_by_name: 'Owner One',
      }]
      vi.mocked(employeeAnnouncementRepository.getEmployeeAnnouncements).mockResolvedValue(announcements)

      const result = await employeeAnnouncementService.getAnnouncements('auth-1')

      expect(employeeInboxRepository.findUserByAuthIdOrInternalId).toHaveBeenCalledWith('auth-1')
      expect(employeeAnnouncementRepository.getEmployeeAnnouncements).toHaveBeenCalledWith('employee-1')
      expect(result).toEqual(announcements)
    })
  })
})
