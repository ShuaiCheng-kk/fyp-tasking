// LAYER: Service
// RULE: Business logic only. No HTTP handling. No direct DB access.

import { casualInboxRepository } from '@/repositories/casual/casualInboxRepository'
import { findCurrentAssignment } from '@/services/casual/casualDashboardService'
import { CLOCK_IN_WINDOW_MINUTES_BEFORE } from '@/services/casual/casualAttendanceService'
import { sgtInstant } from '@/lib/singaporeTime'

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

  // Sending is a work action: it only exists from the moment the Clock In window opens
  // (30 minutes before the scheduled start) until the worker clocks out — the same availability
  // rule as Clock In and the task board. Once clocked out, the next chronological job becomes
  // current and its own window applies; no current job at all means nobody to message.
  async sendMessage(authId: string, toUserId: string, companyId: string, content: string) {
    if (!content || !content.trim()) throw new Error('Message content cannot be empty')
    const user = await casualInboxRepository.getUserByAuthId(authId)
    if (!user) throw new Error('Casual worker not found')

    const current = await findCurrentAssignment(user.id)
    if (!current) throw new Error('Messaging is only available while you have an active job')
    if (current.assignment.supervisor_employee_id !== toUserId) {
      throw new Error('You can only message the supervisor of your current job')
    }

    const shift = current.assignment.shift
    const windowOpensAt =
      sgtInstant(shift.shift_date, shift.start_time).getTime() - CLOCK_IN_WINDOW_MINUTES_BEFORE * 60000
    if (Date.now() < windowOpensAt) {
      throw new Error('Messaging opens 30 minutes before your job starts')
    }

    return casualInboxRepository.insertMessage(user.id, toUserId, companyId, content.trim(), user.full_name)
  },
}
