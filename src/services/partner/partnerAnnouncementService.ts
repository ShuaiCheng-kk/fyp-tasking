import { partnerAnnouncementRepository } from '@/repositories/partner/partnerAnnouncementRepository'

export const partnerAnnouncementService = {

  async getAnnouncements(companyId: string, requestingUserId?: string | null) {
    return partnerAnnouncementRepository.getAnnouncements(companyId, requestingUserId)
  },

  async postAnnouncement(fromUserId: string, companyId: string, departmentId: string | null, title: string, content: string) {
    if (!title || !title.trim()) throw new Error('Title cannot be empty')
    if (!content || !content.trim()) throw new Error('Content cannot be empty')
    return partnerAnnouncementRepository.insertAnnouncement(fromUserId, companyId, departmentId, title.trim(), content.trim())
  },

  async updateAnnouncement(announcementId: string, requestingUserId: string, title: string, content: string, departmentId: string | null) {
    if (!title || !title.trim()) throw new Error('Title cannot be empty')
    if (!content || !content.trim()) throw new Error('Content cannot be empty')
    return partnerAnnouncementRepository.updateAnnouncement(announcementId, requestingUserId, title.trim(), content.trim(), departmentId)
  },

  async deleteAnnouncement(announcementId: string, requestingUserId: string) {
    await partnerAnnouncementRepository.deleteAnnouncement(announcementId, requestingUserId)
  },

}
