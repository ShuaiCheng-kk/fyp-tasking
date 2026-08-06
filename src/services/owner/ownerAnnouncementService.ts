import { ownerAnnouncementRepository } from '@/repositories/owner/ownerAnnouncementRepository'
import { userService } from '@/services/auth/userService'

export const ownerAnnouncementService = {

  async getAnnouncements(companyId: string, requestingUserId?: string | null, role?: string | null, departmentId?: string | null) {
    return ownerAnnouncementRepository.getAnnouncements(companyId, requestingUserId, role, departmentId)
  },

  async postAnnouncement(fromUserId: string, companyId: string, departmentId: string | null, title: string, content: string) {
    if (!title || !title.trim()) throw new Error('Title cannot be empty')
    if (!content || !content.trim()) throw new Error('Content cannot be empty')
    const poster = await userService.getUserById(fromUserId)
    if (poster.role === 'Employee') throw new Error('Employees cannot post announcements')
    // Managers may only broadcast within their own department — never company-wide, never another department.
    if (poster.role === 'Manager' && (!departmentId || departmentId !== poster.department_id)) {
      throw new Error('Managers can only post announcements to their own department')
    }
    return ownerAnnouncementRepository.insertAnnouncement(fromUserId, companyId, departmentId, title.trim(), content.trim())
  },

  async updateAnnouncement(announcementId: string, requestingUserId: string, title: string, content: string, departmentId: string | null) {
    if (!title || !title.trim()) throw new Error('Title cannot be empty')
    if (!content || !content.trim()) throw new Error('Content cannot be empty')
    // Ownership is checked before the department-lock rule so a non-owner edit attempt still
    // fails with "not your own announcement" rather than a confusing department error.
    const existing = await ownerAnnouncementRepository.getAnnouncementOwner(announcementId)
    if (existing.user_id !== requestingUserId) throw new Error('You can only edit your own announcements')
    const requester = await userService.getUserById(requestingUserId)
    if (requester.role === 'Manager' && (!departmentId || departmentId !== requester.department_id)) {
      throw new Error('Managers can only post announcements to their own department')
    }
    return ownerAnnouncementRepository.updateAnnouncement(announcementId, title.trim(), content.trim(), departmentId)
  },

  async deleteAnnouncement(announcementId: string, requestingUserId: string) {
    const existing = await ownerAnnouncementRepository.getAnnouncementOwner(announcementId)
    if (existing.user_id !== requestingUserId) throw new Error('You can only delete your own announcements')
    await ownerAnnouncementRepository.deleteAnnouncement(announcementId)
  },

  async markAnnouncementsRead(userId: string, announcementIds: string[]) {
    await ownerAnnouncementRepository.markAnnouncementsRead(userId, announcementIds)
  },

  async getReadAnnouncementIds(userId: string, companyId: string): Promise<string[]> {
    return ownerAnnouncementRepository.getReadAnnouncementIds(userId, companyId)
  },

}
