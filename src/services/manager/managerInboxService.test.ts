import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase', () => ({
  supabase: {},
  createClient: () => ({}),
}))

vi.mock('@/repositories/manager/managerInboxRepository', () => ({
  managerInboxRepository: {
    getManagerContacts: vi.fn(),
    findUserByAuthIdOrInternalId: vi.fn(),
  },
}))

import { managerInboxService } from './managerInboxService'
import { managerInboxRepository } from '@/repositories/manager/managerInboxRepository'

describe('managerInboxService — Communication (Manager scope)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getContacts', () => {
    it('resolves the auth id to an internal user, then returns department-scoped contacts', async () => {
      vi.mocked(managerInboxRepository.findUserByAuthIdOrInternalId).mockResolvedValue({ id: 'mgr-1' } as any)
      const contacts = [{ id: 'owner-1', full_name: 'Owner', role: 'Owner', email_address: 'o@x.com', profile_photo_url: null }]
      vi.mocked(managerInboxRepository.getManagerContacts).mockResolvedValue(contacts)

      const result = await managerInboxService.getContacts('auth-1')

      expect(managerInboxRepository.findUserByAuthIdOrInternalId).toHaveBeenCalledWith('auth-1')
      expect(managerInboxRepository.getManagerContacts).toHaveBeenCalledWith('mgr-1')
      expect(result).toEqual(contacts)
    })

    it('throws when the user cannot be resolved', async () => {
      vi.mocked(managerInboxRepository.findUserByAuthIdOrInternalId).mockResolvedValue(null)

      await expect(managerInboxService.getContacts('missing')).rejects.toThrow('User not found')
      expect(managerInboxRepository.getManagerContacts).not.toHaveBeenCalled()
    })
  })
})
