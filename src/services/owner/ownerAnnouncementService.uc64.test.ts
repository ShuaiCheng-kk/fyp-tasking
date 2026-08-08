import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabaseAdmin', () => ({
  getSupabaseAdmin: () => ({}),
}))

vi.mock('@/lib/supabase', () => ({
  supabase: {},
  createClient: () => ({}),
}))

vi.mock('@/repositories/owner/ownerAnnouncementRepository', () => ({
  ownerAnnouncementRepository: {
    getAnnouncementOwner: vi.fn(),
    deleteAnnouncement: vi.fn(),
  },
}))

import { ownerAnnouncementService } from './ownerAnnouncementService'
import { ownerAnnouncementRepository } from '@/repositories/owner/ownerAnnouncementRepository'

describe('UC64 Delete Announcement', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(ownerAnnouncementRepository.deleteAnnouncement).mockResolvedValue(undefined as never)
  })

  it('UC64-M-UT-O: Owner deletes their own announcement', async () => {
    vi.mocked(ownerAnnouncementRepository.getAnnouncementOwner).mockResolvedValue({ user_id: 'owner-1' } as never)

    await ownerAnnouncementService.deleteAnnouncement('ann-1', 'owner-1')

    expect(ownerAnnouncementRepository.deleteAnnouncement).toHaveBeenCalledWith('ann-1')
  })

  it('UC64-M-UT-P: Partner deletes their own announcement', async () => {
    vi.mocked(ownerAnnouncementRepository.getAnnouncementOwner).mockResolvedValue({ user_id: 'partner-1' } as never)

    await ownerAnnouncementService.deleteAnnouncement('ann-2', 'partner-1')

    expect(ownerAnnouncementRepository.deleteAnnouncement).toHaveBeenCalledWith('ann-2')
  })

  it('UC64-M-UT-M: Manager deletes their own announcement', async () => {
    vi.mocked(ownerAnnouncementRepository.getAnnouncementOwner).mockResolvedValue({ user_id: 'mgr-1' } as never)

    await ownerAnnouncementService.deleteAnnouncement('ann-3', 'mgr-1')

    expect(ownerAnnouncementRepository.deleteAnnouncement).toHaveBeenCalledWith('ann-3')
  })

  it('UC64-BR-UT-O: Owner is blocked from deleting an announcement someone else posted', async () => {
    vi.mocked(ownerAnnouncementRepository.getAnnouncementOwner).mockResolvedValue({ user_id: 'partner-1' } as never)

    await expect(ownerAnnouncementService.deleteAnnouncement('ann-1', 'owner-1'))
      .rejects.toThrow('You can only delete your own announcements')
    expect(ownerAnnouncementRepository.deleteAnnouncement).not.toHaveBeenCalled()
  })

  it('UC64-BR-UT-M: Manager is blocked from deleting an announcement someone else posted', async () => {
    vi.mocked(ownerAnnouncementRepository.getAnnouncementOwner).mockResolvedValue({ user_id: 'mgr-2' } as never)

    await expect(ownerAnnouncementService.deleteAnnouncement('ann-4', 'mgr-1'))
      .rejects.toThrow('You can only delete your own announcements')
    expect(ownerAnnouncementRepository.deleteAnnouncement).not.toHaveBeenCalled()
  })
})
