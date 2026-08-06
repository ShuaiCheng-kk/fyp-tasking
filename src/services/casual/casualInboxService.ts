// LAYER: Service
// RULE: Business logic only. No HTTP handling. No direct DB access.

import { casualInboxRepository } from '@/repositories/casual/casualInboxRepository'
import { casualAttendanceRepository } from '@/repositories/casual/casualAttendanceRepository'
import { findCurrentAssignment } from '@/services/casual/casualDashboardService'
import { CLOCK_IN_WINDOW_MINUTES_BEFORE } from '@/services/casual/casualAttendanceService'
import { sgtInstant } from '@/lib/singaporeTime'

// The two people a Casual Worker may message about their current job: the Employee supervising
// it, and the job's poster (Owner/Manager) as the Backup Contact if the supervisor can't be
// reached — same "Backup Contact" concept the Dashboard/Attendance contact cards already show.
async function getAllowedRecipientIds(supervisorEmployeeId: string | null, jobPostingId: string | null): Promise<Set<string>> {
  const ids = new Set<string>()
  if (supervisorEmployeeId) ids.add(supervisorEmployeeId)
  if (jobPostingId) {
    const [posting] = await casualAttendanceRepository.getJobPostingsByIds([jobPostingId])
    if (posting?.created_by) ids.add(posting.created_by)
  }
  return ids
}

export const casualInboxService = {
  // A Casual Worker can only message the Employee supervising their current job, or that job's
  // Backup Contact — the caller (Dashboard) already knows both ids from the current-job payload,
  // so this just fetches/sends against whichever one thread was requested.
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
  //
  // findCurrentAssignment falls back to the most recently COMPLETED job once every one of today's
  // assignments is clocked out (so the Dashboard can still show "today's job" after it's done) —
  // that fallback is right for viewing, but wrong for sending, so this explicitly re-checks the
  // clock-out state on whatever assignment comes back rather than trusting "current" to mean "open."
  async sendMessage(authId: string, toUserId: string, companyId: string, content: string) {
    if (!content || !content.trim()) throw new Error('Message content cannot be empty')
    const user = await casualInboxRepository.getUserByAuthId(authId)
    if (!user) throw new Error('Casual worker not found')

    const current = await findCurrentAssignment(user.id)
    if (!current) throw new Error('Messaging is only available while you have an active job')
    if (current.record?.clock_out_time) {
      throw new Error('Messaging closes once you clock out of your job')
    }
    const allowedIds = await getAllowedRecipientIds(current.assignment.supervisor_employee_id, current.assignment.shift.source_job_posting_id)
    if (!allowedIds.has(toUserId)) {
      throw new Error('You can only message the supervisor or backup contact of your current job')
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
