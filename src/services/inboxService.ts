import * as inboxRepo from '@/repositories/inboxRepository'
import { userRepository } from '@/repositories/userRepository'

export async function getConversations(userId: string, companyId: string) {
  const messages = await inboxRepo.getConversationPartners(userId, companyId)

  const partnerMap = new Map<string, {
    partnerId: string
    lastMessage: string
    lastTime: string
    unreadCount: number
  }>()

  for (const msg of messages) {
    const partnerId = msg.from_user_id === userId ? msg.to_user_id : msg.from_user_id
    if (!partnerMap.has(partnerId)) {
      partnerMap.set(partnerId, {
        partnerId,
        lastMessage: msg.content,
        lastTime: msg.created_at,
        unreadCount: 0,
      })
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
      try {
        const user = await userRepository.findById(conv.partnerId)
        if (user) {
          partnerName = (user as any).name ?? (user as any).email_address ?? 'Unknown'
          partnerRole = (user as any).role ?? ''
        }
      } catch {}
      return { ...conv, partnerName, partnerRole }
    })
  )

  return conversations
}

export async function getMessages(userId: string, otherUserId: string, companyId: string) {
  const messages = await inboxRepo.getMessagesBetweenUsers(userId, otherUserId, companyId)
  await inboxRepo.markMessagesAsRead(userId, otherUserId, companyId)
  return messages
}

export async function sendMessage(fromUserId: string, toUserId: string, companyId: string, content: string) {
  if (!content || !content.trim()) throw new Error('Message content cannot be empty')
  return inboxRepo.insertMessage(fromUserId, toUserId, companyId, content.trim())
}

export async function getAnnouncements(
  companyId: string,
  role: string,
  departmentId?: string | null
) {
  return inboxRepo.getAnnouncements(companyId, role, departmentId)
}

export async function deleteAnnouncement(announcementId: string, requestingUserId: string) {
  await inboxRepo.deleteAnnouncement(announcementId, requestingUserId)
}

export async function postAnnouncement(
  fromUserId: string,
  companyId: string,
  departmentId: string | null,
  title: string,
  content: string,
  userRole: string
) {
  if (!title || !title.trim()) throw new Error('Title cannot be empty')
  if (!content || !content.trim()) throw new Error('Content cannot be empty')

  const role = userRole?.toLowerCase()
  if (departmentId === null && role === 'manager') {
    throw new Error('Managers can only post department-specific announcements')
  }

  return inboxRepo.insertAnnouncement(fromUserId, companyId, departmentId ?? null, title.trim(), content.trim())
}

export async function getNotifications(userId: string) {
  return inboxRepo.getNotifications(userId)
}

export async function updateNotificationStatus(notificationId: string, status: string) {
  if (!['accepted', 'rejected'].includes(status)) throw new Error('Invalid status')
  return inboxRepo.updateNotificationStatus(notificationId, status)
}

export async function getUnreadCount(userId: string, companyId: string, lastAnnouncementReadAt?: string | null) {
  const [unreadMessages, unreadAnnouncements] = await Promise.all([
    inboxRepo.countUnreadMessages(userId, companyId),
    inboxRepo.countUnreadAnnouncements(companyId, lastAnnouncementReadAt ?? null),
  ])
  return {
    unread_messages: Number(unreadMessages),
    unread_announcements: Number(unreadAnnouncements),
    count: Number(unreadMessages) + Number(unreadAnnouncements),
  }
}
