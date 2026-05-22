// LAYER: Controller
// RULE: Only handles request/response. No business logic. No DB access.
// Employee inbox fetches conversations by user_id (delegates to shared inbox infrastructure).

import { NextRequest, NextResponse } from 'next/server'
import { employeeService } from '@/services/employeeService'
import { userRepository } from '@/repositories/userRepository'
import { getConversationPartners, getMessagesBetweenUsers, insertMessage, markMessagesAsRead, countUnreadMessages } from '@/repositories/inboxRepository'

export async function GET(req: NextRequest) {
  const user_id = req.nextUrl.searchParams.get('user_id')
  if (!user_id) {
    return NextResponse.json({ success: false, message: 'user_id is required' }, { status: 400 })
  }

  try {
    const user = await userRepository.findByAuthIdOrInternalId(user_id)
    if (!user) return NextResponse.json({ success: false, message: 'User not found' }, { status: 404 })

    const allMessages = await getConversationPartners(user.id)
    if (!allMessages) return NextResponse.json({ success: true, conversations: [] })

    // Build conversation list
    const seenPartners = new Map<string, {
      partnerId: string; partnerName: string; partnerRole: string;
      lastMessage: string; lastTime: string; unreadCount: number; companyName: string | null
    }>()

    for (const msg of allMessages as any[]) {
      const partnerId = msg.from_user_id === user.id ? msg.to_user_id : msg.from_user_id
      if (seenPartners.has(partnerId)) continue

      const partnerUser = await userRepository.findById(partnerId)
      const unreadCount = (allMessages as any[]).filter(
        (m: any) => m.from_user_id === partnerId && m.to_user_id === user.id && !m.is_read
      ).length

      seenPartners.set(partnerId, {
        partnerId,
        partnerName: partnerUser?.full_name ?? msg.sender_name ?? 'Unknown',
        partnerRole: partnerUser?.role ?? '',
        lastMessage: msg.content,
        lastTime: msg.created_at,
        unreadCount,
        companyName: null,
      })
    }

    return NextResponse.json({ success: true, conversations: [...seenPartners.values()] })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch inbox'
    return NextResponse.json({ success: false, message }, { status: 500 })
  }
}
