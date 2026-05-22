import { ownerAnnouncementRepository } from '@/repositories/owner/ownerAnnouncementRepository'

export const ownerAnnouncementService = {

  async getAnnouncements(companyId: string, requestingUserId?: string | null) {
    return ownerAnnouncementRepository.getAnnouncements(companyId, requestingUserId)
  },

  async postAnnouncement(fromUserId: string, companyId: string, departmentId: string | null, title: string, content: string) {
    if (!title || !title.trim()) throw new Error('Title cannot be empty')
    if (!content || !content.trim()) throw new Error('Content cannot be empty')
    return ownerAnnouncementRepository.insertAnnouncement(fromUserId, companyId, departmentId, title.trim(), content.trim())
  },

  async updateAnnouncement(announcementId: string, requestingUserId: string, title: string, content: string, departmentId: string | null) {
    if (!title || !title.trim()) throw new Error('Title cannot be empty')
    if (!content || !content.trim()) throw new Error('Content cannot be empty')
    return ownerAnnouncementRepository.updateAnnouncement(announcementId, requestingUserId, title.trim(), content.trim(), departmentId)
  },

  async deleteAnnouncement(announcementId: string, requestingUserId: string) {
    await ownerAnnouncementRepository.deleteAnnouncement(announcementId, requestingUserId)
  },

}
