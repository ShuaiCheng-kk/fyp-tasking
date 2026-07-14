// LAYER: Service
// RULE: Business logic only. No HTTP handling. No direct DB access.

import { casualInboxRepository } from '@/repositories/casual/casualInboxRepository'

export const casualInboxService = {
  // A Casual Worker can only message the Employee supervising their current job — the caller
  // (Dashboard) already knows that supervisor's id from the current-job payload, so this just
  // fetches/sends against that one thread.
  async getMessages(authId: string, otherUserId: string) {
    const user = await casualInboxRepository.getUserByAuthId(authId)
    if (!user) throw new Error('Casual worker not found')

    const messages = await casualInboxRepository.getMessagesBetweenUsers(user.id, otherUserId)
    await casualInboxRepository.markMessagesAsRead(user.id, otherUserId)
    return { messages, self_id: user.id }
  },

  async sendMessage(authId: string, toUserId: string, companyId: string, content: string) {
    if (!content || !content.trim()) throw new Error('Message content cannot be empty')
    const user = await casualInboxRepository.getUserByAuthId(authId)
    if (!user) throw new Error('Casual worker not found')

    return casualInboxRepository.insertMessage(user.id, toUserId, companyId, content.trim(), user.full_name)
  },
}
