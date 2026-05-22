import { supabase } from '@/lib/supabase'

export type InboxItem = {
  id: string
  recipient_user_id: string
  sender_user_id: string
  company_id: string
  role: string
  department_id: string | null
  type: string
  status: string
  created_at: string
  sender_name: string
  company_name: string
}

export async function getInvitesByRecipient(recipient_user_id: string): Promise<InboxItem[]> {
  const { data, error } = await supabase
    .from('inbox')
    .select(`
      *,
      sender:users!inbox_sender_user_id_fkey(full_name),
      companies(name)
    `)
    .eq('recipient_user_id', recipient_user_id)
    .eq('type', 'company_invite')
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
  if (error) throw new Error(`Failed to fetch invites: ${error.message}`)
  return (data ?? []).map((row: any) => ({
    ...row,
    sender_name: row.sender?.full_name ?? 'Unknown',
    company_name: row.companies?.name ?? 'Unknown',
  }))
}

export async function getInboxItemById(inbox_id: string) {
  const { data, error } = await supabase
    .from('inbox')
    .select('*')
    .eq('id', inbox_id)
    .single()
  if (error || !data) throw new Error('Inbox record not found')
  return data
}

export async function updateInboxStatus(inbox_id: string, status: string) {
  const { error } = await supabase
    .from('inbox')
    .update({ status })
    .eq('id', inbox_id)
  if (error) throw new Error(`Failed to update inbox status: ${error.message}`)
}

export async function createInviteNotification(data: {
  recipient_user_id: string
  sender_user_id: string
  company_id: string
  role: string
  department_id: string | null
  type: 'company_invite'
  status: 'pending'
}): Promise<void> {
  const { error } = await supabase
    .from('inbox')
    .insert({
      recipient_user_id: data.recipient_user_id,
      sender_user_id: data.sender_user_id,
      company_id: data.company_id,
      role: data.role,
      department_id: data.department_id,
      type: data.type,
      status: data.status,
    })
  if (error) throw new Error(`Failed to create inbox notification: ${error.message}`)
}

export async function getMessagesBetweenUsers(userId: string, otherUserId: string) {
  const { data, error } = await supabase
    .from('messages')
    .select('id, from_user_id, to_user_id, content, created_at, is_read, company_id, sender_name, sender:users!messages_from_user_id_fkey!left(full_name)')
    .or(
      `and(from_user_id.eq.${userId},to_user_id.eq.${otherUserId}),and(from_user_id.eq.${otherUserId},to_user_id.eq.${userId})`
    )
    .order('created_at', { ascending: true })
  if (error) throw error
  return (data ?? []).map(({ sender, ...msg }: any) => msg)
}

export async function getConversationPartners(userId: string) {
  const { data, error } = await supabase
    .from('messages')
    .select('id, from_user_id, to_user_id, content, created_at, is_read, sender_name, company_id')
    .or(`from_user_id.eq.${userId},to_user_id.eq.${userId}`)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data
}

export async function checkUserExists(userId: string): Promise<boolean> {
  const { data } = await supabase
    .from('users')
    .select('id')
    .eq('id', userId)
    .single()
  return data !== null
}

export async function getLastSenderNameSnapshot(partnerId: string, companyId: string): Promise<string | null> {
  const { data } = await supabase
    .from('messages')
    .select('sender_name')
    .eq('from_user_id', partnerId)
    .eq('company_id', companyId)
    .not('sender_name', 'is', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()
  return (data as any)?.sender_name ?? null
}

export async function markMessagesAsRead(userId: string, otherUserId: string) {
  const { error } = await supabase
    .from('messages')
    .update({ is_read: true })
    .eq('to_user_id', userId)
    .eq('from_user_id', otherUserId)
    .eq('is_read', false)
  if (error) throw error
}

export async function insertMessage(fromUserId: string, toUserId: string, companyId: string, content: string, senderName?: string) {
  const { data, error } = await supabase
    .from('messages')
    .insert({ from_user_id: fromUserId, to_user_id: toUserId, company_id: companyId, content, is_read: false, sender_name: senderName ?? null })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function countUnreadMessages(userId: string) {
  const { count, error } = await supabase
    .from('messages')
    .select('*', { count: 'exact', head: true })
    .eq('to_user_id', userId)
    .eq('is_read', false)
  if (error) throw error
  return count ?? 0
}

export async function countUnreadAnnouncements(companyId: string, lastReadAt: string | null) {
  let query = supabase
    .from('announcements')
    .select('*', { count: 'exact', head: true })
    .eq('company_id', companyId)
    .is('department_id', null)

  if (lastReadAt) {
    query = query.gt('created_at', lastReadAt)
  }

  const { count, error } = await query
  if (error) throw error
  return count ?? 0
}

export async function getAnnouncements(
  companyId: string,
  role: string,
  departmentId?: string | null
) {
  const roleLower = role?.toLowerCase()

  let query = supabase
    .from('announcements')
    .select('*, users!announcements_from_user_id_fkey(full_name)')
    .eq('company_id', companyId)
    .order('created_at', { ascending: false })

  if (roleLower === 'owner' || roleLower === 'partner') {
    // no audience filter — return all announcements for the company
  } else if (roleLower === 'manager') {
    if (departmentId) {
      query = query.or(`department_id.is.null,department_id.eq.${departmentId}`)
    } else {
      query = query.is('department_id', null)
    }
  } else {
    if (departmentId) {
      query = query.eq('department_id', departmentId)
    } else {
      query = query.eq('department_id', 'none')
    }
  }

  const { data, error } = await query
  if (error) throw error

  return (data ?? []).map((row: any) => {
    const { users, ...rest } = row
    return { ...rest, created_by_name: users?.full_name ?? null }
  })
}

export async function updateAnnouncement(
  announcementId: string,
  requestingUserId: string,
  title: string,
  content: string,
  departmentId: string | null
) {
  const { data: existing, error: fetchError } = await supabase
    .from('announcements')
    .select('from_user_id')
    .eq('id', announcementId)
    .single()
  if (fetchError || !existing) throw new Error('Announcement not found')
  if (existing.from_user_id !== requestingUserId) throw new Error('You can only edit your own announcements')

  const { data, error } = await supabase
    .from('announcements')
    .update({ title, content, department_id: departmentId })
    .eq('id', announcementId)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function insertAnnouncement(fromUserId: string, companyId: string, departmentId: string | null, title: string, content: string) {
  const { data, error } = await supabase
    .from('announcements')
    .insert({ from_user_id: fromUserId, company_id: companyId, department_id: departmentId ?? null, title, content })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteAnnouncement(announcementId: string, requestingUserId: string) {
  // Verify ownership before deleting
  const { data: existing, error: fetchError } = await supabase
    .from('announcements')
    .select('from_user_id')
    .eq('id', announcementId)
    .single()
  if (fetchError || !existing) throw new Error('Announcement not found')
  if (existing.from_user_id !== requestingUserId) throw new Error('You can only delete your own announcements')
  const { error } = await supabase
    .from('announcements')
    .delete()
    .eq('id', announcementId)
  if (error) throw error
}

export async function getNotifications(userId: string) {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('to_user_id', userId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data
}

export async function countPendingNotifications(userId: string) {
  const { count, error } = await supabase
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('to_user_id', userId)
    .eq('status', 'pending')
  if (error) throw error
  return count ?? 0
}

export async function countPendingInvitations(userId: string) {
  const { count, error } = await supabase
    .from('inbox')
    .select('*', { count: 'exact', head: true })
    .eq('recipient_user_id', userId)
    .eq('status', 'pending')
  if (error) throw error
  return count ?? 0
}

export async function updateNotificationStatus(notificationId: string, status: string) {
  const { data, error } = await supabase
    .from('notifications')
    .update({ status })
    .eq('id', notificationId)
    .select()
    .single()
  if (error) throw error
  return data
}
