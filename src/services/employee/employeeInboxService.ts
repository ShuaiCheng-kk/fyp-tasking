import { employeeInboxRepository } from '@/repositories/employee/employeeInboxRepository'

export const employeeInboxService = {

  async getContacts(auth_user_id: string): Promise<{
    id: string
    full_name: string
    role: string
    email_address: string
  }[]> {
    const user = await employeeInboxRepository.findUserByAuthIdOrInternalId(auth_user_id)
    if (!user) throw new Error('User not found')
    return employeeInboxRepository.getEmployeeContacts((user as any).id)
  },

  async getConversations(userId: string) {
    const messages = await employeeInboxRepository.getConversationPartners(userId)

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
          const user = await employeeInboxRepository.findUserById(conv.partnerId)
          if (user) {
            partnerName = (user as any).full_name ?? (user as any).email_address ?? 'Unknown'
            partnerRole = (user as any).role ?? ''
          } else {
            partnerDeleted = true
            partnerName = conv.lastKnownSenderName ?? 'Deleted User'
          }
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
    const messages = await employeeInboxRepository.getMessagesBetweenUsers(userId, otherUserId)
    await employeeInboxRepository.markMessagesAsRead(userId, otherUserId)
    return messages
  },

  async sendMessage(fromUserId: string, toUserId: string, companyId: string, content: string) {
    if (!content || !content.trim()) throw new Error('Message content cannot be empty')
    let senderName: string | undefined
    try {
      const sender = await employeeInboxRepository.findUserById(fromUserId)
      if (sender) senderName = (sender as any).full_name ?? undefined
    } catch {}
    return employeeInboxRepository.insertMessage(fromUserId, toUserId, companyId, content.trim(), senderName)
  },

  async getNotifications(userId: string) {
    // employees use same notification system
    const { supabase } = await import('@/lib/supabase')
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('to_user_id', userId)
      .order('created_at', { ascending: false })
    if (error) throw error
    return data
  },

  async getUnreadCount(userId: string, companyId: string | null, lastAnnouncementReadAt?: string | null) {
    const [unreadMessages, unreadAnnouncements, pendingInvitations] = await Promise.all([
      employeeInboxRepository.countUnreadMessages(userId),
      companyId ? employeeInboxRepository.countUnreadAnnouncements(companyId, lastAnnouncementReadAt ?? null) : Promise.resolve(0),
      employeeInboxRepository.countPendingInvitations(userId),
    ])
    return {
      unread_messages: Number(unreadMessages) + Number(pendingInvitations),
      unread_announcements: Number(unreadAnnouncements),
      count: Number(unreadMessages) + Number(pendingInvitations) + Number(unreadAnnouncements),
    }
  },

  async getInvitesByRecipient(user_id: string) {
    return employeeInboxRepository.getInvitesByRecipient(user_id)
  },

  async getInboxItemById(inbox_id: string) {
    return employeeInboxRepository.getInboxItemById(inbox_id)
  },

  async updateInboxStatus(inbox_id: string, status: string) {
    await employeeInboxRepository.updateInboxStatus(inbox_id, status)
  },

  async markMessagesAsRead(userId: string, otherUserId: string) {
    await employeeInboxRepository.markMessagesAsRead(userId, otherUserId)
  },

}
