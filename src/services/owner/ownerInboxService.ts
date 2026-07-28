import { ownerInboxRepository } from '@/repositories/owner/ownerInboxRepository'
import { managerInboxRepository } from '@/repositories/manager/managerInboxRepository'

export const ownerInboxService = {

  async getConversations(userId: string) {
    const messages = await ownerInboxRepository.getConversationPartners(userId)

    const partnerMap = new Map<string, {
      partnerId: string
      lastMessage: string
      lastTime: string
      unreadCount: number
      lastKnownSenderName: string | null
      companyId: string | null
    }>()

    for (const msg of messages) {
      const partnerId = msg.from_user_id === userId ? msg.to_user_id : msg.from_user_id
      const senderIsPartner = msg.from_user_id === partnerId
      if (!partnerMap.has(partnerId)) {
        partnerMap.set(partnerId, {
          partnerId,
          lastMessage: msg.content,
          lastTime: msg.created_at,
          unreadCount: 0,
          lastKnownSenderName: senderIsPartner ? ((msg as any).sender_name ?? null) : null,
          companyId: (msg as any).company_id ?? null,
        })
      } else if (senderIsPartner && (msg as any).sender_name && !(partnerMap.get(partnerId)!.lastKnownSenderName)) {
        partnerMap.get(partnerId)!.lastKnownSenderName = (msg as any).sender_name
      }
      if (msg.to_user_id === userId && !msg.is_read) {
        const entry = partnerMap.get(partnerId)!
        entry.unreadCount += 1
      }
    }

    const conversations = await Promise.all(
      Array.from(partnerMap.values()).map(async (conv) => {
        let partnerName = 'Unknown'
        let partnerRole = ''
        let partnerDeleted = false
        let companyName: string | null = null
        try {
          const [user, company] = await Promise.all([
            ownerInboxRepository.findUserById(conv.partnerId),
            conv.companyId ? ownerInboxRepository.findCompanyById(conv.companyId) : Promise.resolve(null),
          ])
          if (user) {
            partnerName = (user as any).full_name ?? (user as any).email_address ?? 'Unknown'
            partnerRole = (user as any).role ?? ''
          } else {
            partnerDeleted = true
            partnerName = conv.lastKnownSenderName ?? 'Deleted User'
          }
          if (company) companyName = (company as any).name ?? null
        } catch {
          partnerDeleted = true
          partnerName = conv.lastKnownSenderName ?? 'Deleted User'
        }
        const { lastKnownSenderName, ...rest } = conv
        return { ...rest, partnerName, partnerRole, partnerDeleted, companyName }
      })
    )

    return conversations
  },

  async getMessages(userId: string, otherUserId: string) {
    const messages = await ownerInboxRepository.getMessagesBetweenUsers(userId, otherUserId)
    await ownerInboxRepository.markMessagesAsRead(userId, otherUserId)
    return messages
  },

  async sendMessage(fromUserId: string, toUserId: string, companyId: string, content: string) {
    if (!content || !content.trim()) throw new Error('Message content cannot be empty')
    let senderName: string | undefined
    let senderRole: string | undefined
    try {
      const sender = await ownerInboxRepository.findUserById(fromUserId)
      if (sender) {
        senderName = (sender as any).full_name ?? undefined
        senderRole = (sender as any).role ?? undefined
      }
    } catch {}
    // Managers may only message the Owner, Partner, or Managers/Employees in their own department.
    if (senderRole === 'Manager') {
      const contacts = await managerInboxRepository.getManagerContacts(fromUserId)
      if (!contacts.some(c => c.id === toUserId)) {
        throw new Error('Managers can only message the Owner, Partner, or members of their own department')
      }
    }
    return ownerInboxRepository.insertMessage(fromUserId, toUserId, companyId, content.trim(), senderName)
  },

  async getUnreadCount(userId: string, companyId: string | null, lastAnnouncementReadAt?: string | null) {
    const [unreadMessages, unreadAnnouncements] = await Promise.all([
      ownerInboxRepository.countUnreadMessages(userId),
      companyId ? ownerInboxRepository.countUnreadAnnouncements(companyId, lastAnnouncementReadAt ?? null) : Promise.resolve(0),
    ])
    return {
      unread_messages: Number(unreadMessages),
      unread_announcements: Number(unreadAnnouncements),
      count: Number(unreadMessages) + Number(unreadAnnouncements),
    }
  },

  async markMessagesAsRead(userId: string, otherUserId: string) {
    await ownerInboxRepository.markMessagesAsRead(userId, otherUserId)
  },

  async deleteConversation(userId: string, otherUserId: string) {
    await ownerInboxRepository.deleteConversation(userId, otherUserId)
  },

}
