import * as inboxRepo from '@/repositories/inboxRepository'
import { userRepository } from '@/repositories/userRepository'
import { companyRepository } from '@/repositories/companyRepository'

export async function getConversations(userId: string) {
  const messages = await inboxRepo.getConversationPartners(userId)

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
          userRepository.findById(conv.partnerId),
          conv.companyId ? companyRepository.findById(conv.companyId) : Promise.resolve(null),
        ])
        if (user) {
          partnerName = (user as any).full_name ?? (user as any).name ?? (user as any).email_address ?? 'Unknown'
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
}

export async function getMessages(userId: string, otherUserId: string) {
  const messages = await inboxRepo.getMessagesBetweenUsers(userId, otherUserId)
  await inboxRepo.markMessagesAsRead(userId, otherUserId)
  return messages
}

export async function sendMessage(fromUserId: string, toUserId: string, companyId: string, content: string) {
  if (!content || !content.trim()) throw new Error('Message content cannot be empty')
  let senderName: string | undefined
  try {
    const sender = await userRepository.findById(fromUserId)
    if (sender) senderName = (sender as any).full_name ?? undefined
  } catch {}
  return inboxRepo.insertMessage(fromUserId, toUserId, companyId, content.trim(), senderName)
}

export async function getAnnouncements(
  companyId: string,
  role: string,
  departmentId?: string | null,
  requestingUserId?: string | null
) {
  return inboxRepo.getAnnouncements(companyId, role, departmentId, requestingUserId)
}

export async function deleteAnnouncement(announcementId: string, requestingUserId: string) {
  await inboxRepo.deleteAnnouncement(announcementId, requestingUserId)
}

export async function updateAnnouncement(
  announcementId: string,
  requestingUserId: string,
  title: string,
  content: string,
  departmentId: string | null
) {
  if (!title || !title.trim()) throw new Error('Title cannot be empty')
  if (!content || !content.trim()) throw new Error('Content cannot be empty')
  return inboxRepo.updateAnnouncement(announcementId, requestingUserId, title.trim(), content.trim(), departmentId)
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

export async function getUnreadCount(userId: string, companyId: string | null, lastAnnouncementReadAt?: string | null) {
  const [unreadMessages, unreadAnnouncements, pendingInvitations] = await Promise.all([
    inboxRepo.countUnreadMessages(userId),
    companyId ? inboxRepo.countUnreadAnnouncements(companyId, lastAnnouncementReadAt ?? null) : Promise.resolve(0),
    inboxRepo.countPendingInvitations(userId),
  ])
  return {
    unread_messages: Number(unreadMessages) + Number(pendingInvitations),
    unread_announcements: Number(unreadAnnouncements),
    count: Number(unreadMessages) + Number(pendingInvitations) + Number(unreadAnnouncements),
  }
}
