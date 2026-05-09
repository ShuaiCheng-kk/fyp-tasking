/**
 * NotificationService — business logic for in-app notifications.
 *
 * Responsibilities:
 *   - Provide typed helper functions for each notification scenario
 *     so callers never have to construct raw notification payloads.
 *   - Abstract broadcast logic (fan-out to multiple recipients).
 *   - Future: integrate with external push (FCM, email) without changing callers.
 *
 * This service calls:
 *   - notificationRepository  for all database reads/writes
 *
 * Caller examples:
 *   - recruitmentService  → notifyApplicationUpdate(applicationId, 'shortlisted')
 *   - attendanceService   → notifyAttendanceAlert(workerId, shiftId, 'late')
 *   - system cron jobs    → notifyShiftReminder(shiftId) 24 h before shift
 *
 * Never call the Supabase client directly here — always go through a repository.
 */

import {
  createNotification,
  broadcastNotification,
  markAsRead,
  markAllAsRead,
  findNotificationsByUser,
  countUnread,
} from '@/lib/repositories/notificationRepository'

// ---------------------------------------------------------------------------
// Typed event helpers
// Each function maps a domain event to a notification row.
// ---------------------------------------------------------------------------

/**
 * Notify a worker that their application status has changed.
 *
 * @param workerId    - recipient
 * @param jobTitle    - for a human-readable message
 * @param status      - new application status
 * @param metadata    - { job_id, application_id } for deep-linking in the UI
 */
export async function notifyApplicationUpdate(
  workerId: string,
  jobTitle: string,
  status: 'shortlisted' | 'rejected' | 'hired',
  metadata: Record<string, string>,
) {
  const messages: Record<typeof status, { title: string; body: string }> = {
    shortlisted: {
      title: 'You have been shortlisted!',
      body: `Great news — you've been shortlisted for "${jobTitle}". Check your applications for next steps.`,
    },
    rejected: {
      title: 'Application update',
      body: `Thank you for applying to "${jobTitle}". We have moved forward with other candidates.`,
    },
    hired: {
      title: 'Congratulations — you're hired!',
      body: `You have been selected for "${jobTitle}". Your manager will share shift details soon.`,
    },
  }

  await createNotification({
    recipient_id: workerId,
    type: 'application_update',
    ...messages[status],
    metadata,
  })
}

/**
 * Notify a worker about an upcoming shift (send 24 h before shift start).
 * Should be called from a scheduled cron job or a Supabase Edge Function.
 */
export async function notifyShiftReminder(
  workerId: string,
  shiftDate: string,
  startTime: string,
  metadata: Record<string, string>,
) {
  await createNotification({
    recipient_id: workerId,
    type: 'shift_reminder',
    title: 'Shift reminder',
    body: `You have a shift on ${shiftDate} at ${startTime}. Don't forget to clock in with photo verification.`,
    metadata,
  })
}

/**
 * Alert a manager that a worker is late or absent on a shift.
 */
export async function notifyAttendanceAlert(
  managerId: string,
  workerName: string,
  status: 'late' | 'absent',
  metadata: Record<string, string>,
) {
  await createNotification({
    recipient_id: managerId,
    type: 'attendance_alert',
    title: `Attendance alert — ${workerName}`,
    body:
      status === 'late'
        ? `${workerName} clocked in late for their shift.`
        : `${workerName} has not clocked in. Shift has started.`,
    metadata,
  })
}

/**
 * Broadcast a new job posting notification to all eligible workers.
 *
 * @param workerIds  - list of casual_worker user IDs to notify
 * @param jobTitle   - job title for the notification body
 * @param metadata   - { job_id } for deep-linking
 */
export async function notifyNewJobPosting(
  workerIds: string[],
  jobTitle: string,
  metadata: Record<string, string>,
) {
  await broadcastNotification(workerIds, {
    type: 'job_posted',
    title: 'New job opening',
    body: `A new position "${jobTitle}" has been posted. Apply before slots fill up!`,
    metadata,
  })
}

// ---------------------------------------------------------------------------
// Read / mark-as-read (thin wrappers kept here for a single import surface)
// ---------------------------------------------------------------------------

export { findNotificationsByUser, countUnread, markAsRead, markAllAsRead }
