import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase', () => ({
  supabase: {},
  createClient: () => ({}),
}))

vi.mock('@/repositories/owner/ownerAnnouncementRepository', () => ({
  ownerAnnouncementRepository: {
    getAnnouncements: vi.fn(),
    insertAnnouncement: vi.fn(),
    updateAnnouncement: vi.fn(),
    deleteAnnouncement: vi.fn(),
    markAnnouncementsRead: vi.fn(),
    getReadAnnouncementIds: vi.fn(),
  },
}))

import { ownerAnnouncementService } from './ownerAnnouncementService'
import { ownerAnnouncementRepository } from '@/repositories/owner/ownerAnnouncementRepository'

describe('ownerAnnouncementService — Communication (UC59-61)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
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

  describe('postAnnouncement (UC59)', () => {
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
  })

  describe('updateAnnouncement (UC60)', () => {
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
  })

  describe('deleteAnnouncement (UC61)', () => {
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
