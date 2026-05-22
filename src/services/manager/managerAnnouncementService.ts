import { managerAnnouncementRepository } from '@/repositories/manager/managerAnnouncementRepository'

export const managerAnnouncementService = {

  async getAnnouncements(companyId: string, departmentId?: string | null, requestingUserId?: string | null) {
    return managerAnnouncementRepository.getAnnouncements(companyId, departmentId, requestingUserId)
  },

  async postAnnouncement(fromUserId: string, companyId: string, departmentId: string | null, title: string, content: string) {
    if (!title || !title.trim()) throw new Error('Title cannot be empty')
    if (!content || !content.trim()) throw new Error('Content cannot be empty')
    if (departmentId === null) {
      throw new Error('Managers can only post department-specific announcements')
    }
    return managerAnnouncementRepository.insertAnnouncement(fromUserId, companyId, departmentId, title.trim(), content.trim())
  },

  async updateAnnouncement(announcementId: string, requestingUserId: string, title: string, content: string, departmentId: string | null) {
    if (!title || !title.trim()) throw new Error('Title cannot be empty')
    if (!content || !content.trim()) throw new Error('Content cannot be empty')
    return managerAnnouncementRepository.updateAnnouncement(announcementId, requestingUserId, title.trim(), content.trim(), departmentId)
  },

  async deleteAnnouncement(announcementId: string, requestingUserId: string) {
    await managerAnnouncementRepository.deleteAnnouncement(announcementId, requestingUserId)
  },

}
