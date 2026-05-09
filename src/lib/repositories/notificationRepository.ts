/**
 * NotificationRepository — data access layer for in-app notifications.
 *
 * Supabase tables touched:
 *   - notifications  (id, recipient_id, type, title, body, metadata,
 *                     is_read, created_at)
 *
 * Type values: 'job_posted' | 'application_update' | 'shift_reminder' |
 *              'attendance_alert' | 'system'
 *
 * metadata: flexible JSONB column for type-specific data
 *   e.g. for 'application_update': { job_id, application_id, new_status }
 *   e.g. for 'shift_reminder':     { shift_id, shift_date, start_time }
 */

import { supabase } from '@/lib/supabase'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type NotificationType =
  | 'job_posted'
  | 'application_update'
  | 'shift_reminder'
  | 'attendance_alert'
  | 'system'

export interface Notification {
  id: string
  recipient_id: string
  type: NotificationType
  title: string
  body: string
  metadata: Record<string, unknown> | null
  is_read: boolean
  created_at: string
}

export interface CreateNotificationData {
  recipient_id: string
  type: NotificationType
  title: string
  body: string
  metadata?: Record<string, unknown>
}

// ---------------------------------------------------------------------------
// Read
// ---------------------------------------------------------------------------

/** Fetch all notifications for a user, newest first. */
export async function findNotificationsByUser(
  userId: string,
  unreadOnly = false,
): Promise<Notification[]> {
  let query = supabase
    .from('notifications')
    .select('*')
    .eq('recipient_id', userId)
    .order('created_at', { ascending: false })

  if (unreadOnly) query = query.eq('is_read', false)

  const { data, error } = await query
  if (error) throw new Error(error.message)
  return data ?? []
}

/** Count unread notifications (for the bell badge in the navbar). */
export async function countUnread(userId: string): Promise<number> {
  const { count, error } = await supabase
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('recipient_id', userId)
    .eq('is_read', false)

  if (error) throw new Error(error.message)
  return count ?? 0
}

// ---------------------------------------------------------------------------
// Write
// ---------------------------------------------------------------------------

/** Insert a single notification row. */
export async function createNotification(
  data: CreateNotificationData,
): Promise<Notification> {
  const { data: created, error } = await supabase
    .from('notifications')
    .insert({ ...data, is_read: false })
    .select()
    .single()

  if (error) throw new Error(error.message)
  return created
}

/**
 * Batch-insert notifications for multiple recipients (e.g. broadcast to all workers).
 * Pass an array of recipient IDs; the same title/body/type goes to each.
 */
export async function broadcastNotification(
  recipientIds: string[],
  payload: Omit<CreateNotificationData, 'recipient_id'>,
): Promise<void> {
  const rows = recipientIds.map((id) => ({
    recipient_id: id,
    ...payload,
    is_read: false,
  }))

  const { error } = await supabase.from('notifications').insert(rows)
  if (error) throw new Error(error.message)
}

/** Mark a single notification as read. */
export async function markAsRead(id: string): Promise<void> {
  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('id', id)

  if (error) throw new Error(error.message)
}

/** Mark all of a user's notifications as read (used by "Mark all read" button). */
export async function markAllAsRead(userId: string): Promise<void> {
  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('recipient_id', userId)
    .eq('is_read', false)

  if (error) throw new Error(error.message)
}

/** Hard-delete a notification (user dismisses it permanently). */
export async function deleteNotification(id: string): Promise<void> {
  const { error } = await supabase.from('notifications').delete().eq('id', id)
  if (error) throw new Error(error.message)
}
