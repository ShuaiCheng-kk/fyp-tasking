// LAYER: Service
// RULE: Business logic only. No HTTP handling. No direct DB access.

import { shiftReminderRepository } from '@/repositories/casual/shiftReminderRepository'
import { casualDashboardRepository } from '@/repositories/casual/casualDashboardRepository'
import { emailService } from '@/services/email/emailService'
import { sgtDateKeyPlusDays } from '@/lib/singaporeTime'

export const shiftReminderService = {
  // Sends the day-before reminder email to every Casual Worker assigned to a shift starting
  // tomorrow that hasn't been reminded yet. Called once daily by the Vercel Cron route — never
  // rolls back or throws on a single email/shift failure, so one bad address can't block the rest.
  // Shift dates are Singapore-nominal by design (see src/lib/singaporeTime) — "tomorrow" must be
  // computed on that same Singapore calendar day, or a shift could get skipped a day early or
  // reminded a day late.
  async sendDueShiftReminders(): Promise<{ sent: number; skipped: number }> {
    const tomorrowKey = sgtDateKeyPlusDays(1)
    const shifts = await shiftReminderRepository.getShiftsStartingOn(tomorrowKey)
    if (shifts.length === 0) return { sent: 0, skipped: 0 }

    const postingIds = [...new Set(shifts.map(s => s.source_job_posting_id).filter((id): id is string => !!id))]
    const userIds = [...new Set([
      ...shifts.flatMap(s => s.assignedUserIds),
      ...shifts.map(s => s.supervisor_employee_id).filter((id): id is string => !!id),
    ])]

    const [postings, users] = await Promise.all([
      casualDashboardRepository.getJobPostingsByIds(postingIds),
      casualDashboardRepository.getUsersByIds(userIds),
    ])
    const postingById = new Map(postings.map(p => [p.id, p]))
    const userById = new Map(users.map(u => [u.id, u]))

    let sent = 0
    let skipped = 0
    const remindedShiftIds: string[] = []

    for (const shift of shifts) {
      const posting = shift.source_job_posting_id ? postingById.get(shift.source_job_posting_id) ?? null : null
      const supervisor = shift.supervisor_employee_id ? userById.get(shift.supervisor_employee_id) ?? null : null

      let shiftHadSuccess = false
      for (const userId of shift.assignedUserIds) {
        const worker = userById.get(userId)
        // Only the externally-recruited Casual Worker needs this fallback — Employees/Managers
        // already use the app day-to-day and aren't in scope for this reminder.
        if (!worker || worker.role !== 'Casual Worker') {
          skipped++
          continue
        }
        try {
          await emailService.sendShiftReminderEmail({
            to: worker.email_address,
            fullName: worker.full_name,
            jobTitle: posting?.title ?? 'Job',
            companyName: posting?.company_name ?? 'the company',
            shiftDate: shift.shift_date,
            startTime: shift.start_time.slice(0, 5),
            location: posting?.location ?? null,
            supervisorName: supervisor?.full_name ?? null,
            supervisorPhone: supervisor?.phone_number ?? null,
            supervisorEmail: supervisor?.email_address ?? null,
          })
          sent++
          shiftHadSuccess = true
        } catch {
          // A failed send for this worker must not block reminders for other workers/shifts —
          // the shift stays unmarked below and retries on tomorrow's cron run.
        }
      }
      if (shiftHadSuccess) remindedShiftIds.push(shift.id)
    }

    await shiftReminderRepository.markReminderSent(remindedShiftIds)
    return { sent, skipped }
  },
}
