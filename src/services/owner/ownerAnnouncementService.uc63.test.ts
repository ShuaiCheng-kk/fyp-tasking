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
    updateAnnouncement: vi.fn(),
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

describe('UC63 Edit Announcement', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(ownerAnnouncementRepository.updateAnnouncement).mockImplementation(async (id, title, content, departmentId) =>
      ({ id, title, content, audience_department_id: departmentId } as never))
  })

  it('UC63-M-UT-O: Owner edits their own announcement\'s title, content, and audience', async () => {
    vi.mocked(ownerAnnouncementRepository.getAnnouncementOwner).mockResolvedValue({ user_id: 'owner-1' } as never)
    vi.mocked(userService.getUserById).mockResolvedValue({ id: 'owner-1', role: 'Owner', department_id: null } as never)

    const result = await ownerAnnouncementService.updateAnnouncement('ann-1', 'owner-1', 'Updated Notice', 'Updated body.', 'dept-1')

    expect(result).toMatchObject({ title: 'Updated Notice', audience_department_id: 'dept-1' })
  })

  it('UC63-M-UT-P: Partner edits their own announcement\'s title and content', async () => {
    vi.mocked(ownerAnnouncementRepository.getAnnouncementOwner).mockResolvedValue({ user_id: 'partner-1' } as never)
    vi.mocked(userService.getUserById).mockResolvedValue({ id: 'partner-1', role: 'Partner', department_id: null } as never)

    const result = await ownerAnnouncementService.updateAnnouncement('ann-2', 'partner-1', 'Updated Notice', 'Updated body.', null)

    expect(result).toMatchObject({ title: 'Updated Notice', audience_department_id: null })
  })

  it('UC63-M-UT-M: Manager edits their own announcement within their own department', async () => {
    vi.mocked(ownerAnnouncementRepository.getAnnouncementOwner).mockResolvedValue({ user_id: 'mgr-1' } as never)
    vi.mocked(userService.getUserById).mockResolvedValue({ id: 'mgr-1', role: 'Manager', department_id: 'dept-1' } as never)

    const result = await ownerAnnouncementService.updateAnnouncement('ann-3', 'mgr-1', 'Updated Notice', 'Updated body.', 'dept-1')

    expect(result).toMatchObject({ title: 'Updated Notice', audience_department_id: 'dept-1' })
  })

  it('UC63-BR-UT-O: Owner is blocked from editing an announcement someone else posted', async () => {
    vi.mocked(ownerAnnouncementRepository.getAnnouncementOwner).mockResolvedValue({ user_id: 'partner-1' } as never)

    await expect(ownerAnnouncementService.updateAnnouncement('ann-1', 'owner-1', 'Hijacked', 'Body', null))
      .rejects.toThrow('You can only edit your own announcements')
    expect(ownerAnnouncementRepository.updateAnnouncement).not.toHaveBeenCalled()
  })

  it('UC63-BR-UT-M-1: Manager is blocked from editing an announcement someone else posted', async () => {
    vi.mocked(ownerAnnouncementRepository.getAnnouncementOwner).mockResolvedValue({ user_id: 'mgr-2' } as never)

    await expect(ownerAnnouncementService.updateAnnouncement('ann-4', 'mgr-1', 'Hijacked', 'Body', 'dept-1'))
      .rejects.toThrow('You can only edit your own announcements')
    expect(ownerAnnouncementRepository.updateAnnouncement).not.toHaveBeenCalled()
  })

  it('UC63-BR-UT-M-2: Manager is blocked from re-targeting their own announcement to a different department', async () => {
    vi.mocked(ownerAnnouncementRepository.getAnnouncementOwner).mockResolvedValue({ user_id: 'mgr-1' } as never)
    vi.mocked(userService.getUserById).mockResolvedValue({ id: 'mgr-1', role: 'Manager', department_id: 'dept-1' } as never)

    await expect(ownerAnnouncementService.updateAnnouncement('ann-3', 'mgr-1', 'Updated Notice', 'Updated body.', 'dept-2'))
      .rejects.toThrow('Managers can only post announcements to their own department')
  })
})
