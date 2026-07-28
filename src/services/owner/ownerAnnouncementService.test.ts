import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase', () => ({
  supabase: {},
  createClient: () => ({}),
}))

vi.mock('@/repositories/owner/ownerAnnouncementRepository', () => ({
  ownerAnnouncementRepository: {
    getAnnouncements: vi.fn(),
    insertAnnouncement: vi.fn(),
    getAnnouncementOwner: vi.fn(),
    updateAnnouncement: vi.fn(),
    deleteAnnouncement: vi.fn(),
    markAnnouncementsRead: vi.fn(),
    getReadAnnouncementIds: vi.fn(),
  },
}))

vi.mock('@/services/auth/userService', () => ({
  userService: {
    getUserById: vi.fn(),
  },
}))

import { ownerAnnouncementService } from './ownerAnnouncementService'
import { ownerAnnouncementRepository } from '@/repositories/owner/ownerAnnouncementRepository'
import { userService } from '@/services/auth/userService'

describe('ownerAnnouncementService — Communication (UC58-60)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(userService.getUserById).mockResolvedValue({ role: 'Owner', department_id: null } as any)
    vi.mocked(ownerAnnouncementRepository.getAnnouncementOwner).mockResolvedValue({ user_id: 'owner-1' })
  })

  describe('getAnnouncements', () => {
    it('delegates straight to the repository', async () => {
      const announcements = [{ id: 'ann-1', title: 'Welcome' }]
      vi.mocked(ownerAnnouncementRepository.getAnnouncements).mockResolvedValue(announcements)

      const result = await ownerAnnouncementService.getAnnouncements('company-1', 'owner-1', 'Owner', 'dept-1')

      expect(ownerAnnouncementRepository.getAnnouncements).toHaveBeenCalledWith('company-1', 'owner-1', 'Owner', 'dept-1')
      expect(result).toEqual(announcements)
    })
  })

  describe('postAnnouncement (UC58)', () => {
    it('rejects an empty title', async () => {
      await expect(ownerAnnouncementService.postAnnouncement('owner-1', 'company-1', null, '   ', 'Body'))
        .rejects.toThrow('Title cannot be empty')
      expect(ownerAnnouncementRepository.insertAnnouncement).not.toHaveBeenCalled()
    })

    it('rejects empty content', async () => {
      await expect(ownerAnnouncementService.postAnnouncement('owner-1', 'company-1', null, 'Title', '   '))
        .rejects.toThrow('Content cannot be empty')
      expect(ownerAnnouncementRepository.insertAnnouncement).not.toHaveBeenCalled()
    })

    it('trims title/content before inserting', async () => {
      vi.mocked(ownerAnnouncementRepository.insertAnnouncement).mockResolvedValue({ id: 'ann-1' })

      await ownerAnnouncementService.postAnnouncement('owner-1', 'company-1', 'dept-1', '  Welcome  ', '  Hello team  ')

      expect(ownerAnnouncementRepository.insertAnnouncement).toHaveBeenCalledWith('owner-1', 'company-1', 'dept-1', 'Welcome', 'Hello team')
    })

    it('rejects an Employee poster', async () => {
      vi.mocked(userService.getUserById).mockResolvedValue({ role: 'Employee', department_id: 'dept-1' } as any)

      await expect(ownerAnnouncementService.postAnnouncement('emp-1', 'company-1', null, 'Title', 'Body'))
        .rejects.toThrow('Employees cannot post announcements')
      expect(ownerAnnouncementRepository.insertAnnouncement).not.toHaveBeenCalled()
    })

    it('rejects a Manager attempting to post company-wide', async () => {
      vi.mocked(userService.getUserById).mockResolvedValue({ role: 'Manager', department_id: 'dept-1' } as any)

      await expect(ownerAnnouncementService.postAnnouncement('mgr-1', 'company-1', null, 'Title', 'Body'))
        .rejects.toThrow('Managers can only post announcements to their own department')
      expect(ownerAnnouncementRepository.insertAnnouncement).not.toHaveBeenCalled()
    })

    it('rejects a Manager posting to a different department', async () => {
      vi.mocked(userService.getUserById).mockResolvedValue({ role: 'Manager', department_id: 'dept-1' } as any)

      await expect(ownerAnnouncementService.postAnnouncement('mgr-1', 'company-1', 'dept-2', 'Title', 'Body'))
        .rejects.toThrow('Managers can only post announcements to their own department')
      expect(ownerAnnouncementRepository.insertAnnouncement).not.toHaveBeenCalled()
    })

    it('allows a Manager to post to their own department', async () => {
      vi.mocked(userService.getUserById).mockResolvedValue({ role: 'Manager', department_id: 'dept-1' } as any)
      vi.mocked(ownerAnnouncementRepository.insertAnnouncement).mockResolvedValue({ id: 'ann-1' })

      await ownerAnnouncementService.postAnnouncement('mgr-1', 'company-1', 'dept-1', 'Title', 'Body')

      expect(ownerAnnouncementRepository.insertAnnouncement).toHaveBeenCalledWith('mgr-1', 'company-1', 'dept-1', 'Title', 'Body')
    })
  })

  describe('updateAnnouncement (UC59)', () => {
    it('rejects an empty title', async () => {
      await expect(ownerAnnouncementService.updateAnnouncement('ann-1', 'owner-1', '', 'Body', null))
        .rejects.toThrow('Title cannot be empty')
    })

    it('rejects empty content', async () => {
      await expect(ownerAnnouncementService.updateAnnouncement('ann-1', 'owner-1', 'Title', '', null))
        .rejects.toThrow('Content cannot be empty')
    })

    it('trims and forwards the update to the repository', async () => {
      vi.mocked(ownerAnnouncementRepository.updateAnnouncement).mockResolvedValue({ id: 'ann-1' })

      await ownerAnnouncementService.updateAnnouncement('ann-1', 'owner-1', '  New Title  ', '  New Body  ', 'dept-2')

      expect(ownerAnnouncementRepository.updateAnnouncement).toHaveBeenCalledWith('ann-1', 'owner-1', 'New Title', 'New Body', 'dept-2')
    })

    it('rejects a Manager trying to move their announcement to a different department', async () => {
      vi.mocked(ownerAnnouncementRepository.getAnnouncementOwner).mockResolvedValue({ user_id: 'mgr-1' })
      vi.mocked(userService.getUserById).mockResolvedValue({ role: 'Manager', department_id: 'dept-1' } as any)

      await expect(ownerAnnouncementService.updateAnnouncement('ann-1', 'mgr-1', 'Title', 'Body', 'dept-2'))
        .rejects.toThrow('Managers can only post announcements to their own department')
      expect(ownerAnnouncementRepository.updateAnnouncement).not.toHaveBeenCalled()
    })

    it('rejects a Manager trying to make their announcement company-wide', async () => {
      vi.mocked(ownerAnnouncementRepository.getAnnouncementOwner).mockResolvedValue({ user_id: 'mgr-1' })
      vi.mocked(userService.getUserById).mockResolvedValue({ role: 'Manager', department_id: 'dept-1' } as any)

      await expect(ownerAnnouncementService.updateAnnouncement('ann-1', 'mgr-1', 'Title', 'Body', null))
        .rejects.toThrow('Managers can only post announcements to their own department')
      expect(ownerAnnouncementRepository.updateAnnouncement).not.toHaveBeenCalled()
    })

    it('allows a Manager to keep their announcement in their own department', async () => {
      vi.mocked(ownerAnnouncementRepository.getAnnouncementOwner).mockResolvedValue({ user_id: 'mgr-1' })
      vi.mocked(userService.getUserById).mockResolvedValue({ role: 'Manager', department_id: 'dept-1' } as any)
      vi.mocked(ownerAnnouncementRepository.updateAnnouncement).mockResolvedValue({ id: 'ann-1' })

      await ownerAnnouncementService.updateAnnouncement('ann-1', 'mgr-1', 'Title', 'Body', 'dept-1')

      expect(ownerAnnouncementRepository.updateAnnouncement).toHaveBeenCalledWith('ann-1', 'mgr-1', 'Title', 'Body', 'dept-1')
    })

    it('rejects editing when the requester does not own the announcement', async () => {
      vi.mocked(ownerAnnouncementRepository.getAnnouncementOwner).mockResolvedValue({ user_id: 'owner-1' })

      await expect(ownerAnnouncementService.updateAnnouncement('ann-1', 'mgr-1', 'Title', 'Body', null))
        .rejects.toThrow('You can only edit your own announcements')
      expect(ownerAnnouncementRepository.updateAnnouncement).not.toHaveBeenCalled()
    })
  })

  describe('deleteAnnouncement (UC60)', () => {
    it('delegates to the repository', async () => {
      await ownerAnnouncementService.deleteAnnouncement('ann-1', 'owner-1')
      expect(ownerAnnouncementRepository.deleteAnnouncement).toHaveBeenCalledWith('ann-1', 'owner-1')
    })
  })

  describe('markAnnouncementsRead', () => {
    it('delegates to the repository', async () => {
      await ownerAnnouncementService.markAnnouncementsRead('owner-1', ['ann-1', 'ann-2'])
      expect(ownerAnnouncementRepository.markAnnouncementsRead).toHaveBeenCalledWith('owner-1', ['ann-1', 'ann-2'])
    })
  })

  describe('getReadAnnouncementIds', () => {
    it('delegates to the repository', async () => {
      vi.mocked(ownerAnnouncementRepository.getReadAnnouncementIds).mockResolvedValue(['ann-1'])

      const result = await ownerAnnouncementService.getReadAnnouncementIds('owner-1', 'company-1')

      expect(ownerAnnouncementRepository.getReadAnnouncementIds).toHaveBeenCalledWith('owner-1', 'company-1')
      expect(result).toEqual(['ann-1'])
    })
  })
})
