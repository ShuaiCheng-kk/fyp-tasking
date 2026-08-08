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
    insertAnnouncement: vi.fn(),
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

describe('UC62 Post Announcement', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(ownerAnnouncementRepository.insertAnnouncement).mockImplementation(async (fromUserId, companyId, departmentId, title, content) =>
      ({ id: 'ann-1', user_id: fromUserId, company_id: companyId, audience_department_id: departmentId, title, content } as never))
  })

  it('UC62-M-UT-O: Owner posts a company-wide announcement', async () => {
    vi.mocked(userService.getUserById).mockResolvedValue({ id: 'owner-1', role: 'Owner', department_id: null } as never)

    const result = await ownerAnnouncementService.postAnnouncement('owner-1', 'comp-1', null, 'Holiday Notice', 'The office is closed Monday.')

    expect(result).toMatchObject({ audience_department_id: null, title: 'Holiday Notice' })
  })

  it('UC62-M-UT-P: Partner posts an announcement to a specific department', async () => {
    vi.mocked(userService.getUserById).mockResolvedValue({ id: 'partner-1', role: 'Partner', department_id: null } as never)

    const result = await ownerAnnouncementService.postAnnouncement('partner-1', 'comp-1', 'dept-1', 'Retail Update', 'New POS system next week.')

    expect(result).toMatchObject({ audience_department_id: 'dept-1', title: 'Retail Update' })
  })

  it('UC62-M-UT-M: Manager posts an announcement to their own department', async () => {
    vi.mocked(userService.getUserById).mockResolvedValue({ id: 'mgr-1', role: 'Manager', department_id: 'dept-1' } as never)

    const result = await ownerAnnouncementService.postAnnouncement('mgr-1', 'comp-1', 'dept-1', 'Team Meeting', 'Meeting moved to 3pm.')

    expect(result).toMatchObject({ audience_department_id: 'dept-1', title: 'Team Meeting' })
  })

  it('UC62-BR-UT-E: Employee is blocked from posting announcements at all', async () => {
    vi.mocked(userService.getUserById).mockResolvedValue({ id: 'emp-1', role: 'Employee', department_id: 'dept-1' } as never)

    await expect(ownerAnnouncementService.postAnnouncement('emp-1', 'comp-1', 'dept-1', 'Notice', 'Body'))
      .rejects.toThrow('Employees cannot post announcements')
  })

  it('UC62-BR-UT-M-1: Manager is blocked from posting a company-wide announcement', async () => {
    vi.mocked(userService.getUserById).mockResolvedValue({ id: 'mgr-1', role: 'Manager', department_id: 'dept-1' } as never)

    await expect(ownerAnnouncementService.postAnnouncement('mgr-1', 'comp-1', null, 'Notice', 'Body'))
      .rejects.toThrow('Managers can only post announcements to their own department')
  })

  it('UC62-BR-UT-M-2: Manager is blocked from posting to a department other than their own', async () => {
    vi.mocked(userService.getUserById).mockResolvedValue({ id: 'mgr-1', role: 'Manager', department_id: 'dept-1' } as never)

    await expect(ownerAnnouncementService.postAnnouncement('mgr-1', 'comp-1', 'dept-2', 'Notice', 'Body'))
      .rejects.toThrow('Managers can only post announcements to their own department')
  })
})
