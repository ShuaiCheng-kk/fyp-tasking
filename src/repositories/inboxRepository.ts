import { supabase } from '@/lib/supabase'

export async function getMessagesBetweenUsers(userId: string, otherUserId: string, companyId: string) {
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('company_id', companyId)
    .or(
      `and(from_user_id.eq.${userId},to_user_id.eq.${otherUserId}),and(from_user_id.eq.${otherUserId},to_user_id.eq.${userId})`
    )
    .order('created_at', { ascending: true })
  if (error) throw error
  return data
}

export async function getConversationPartners(userId: string, companyId: string) {
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('company_id', companyId)
    .or(`from_user_id.eq.${userId},to_user_id.eq.${userId}`)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data
}

export async function markMessagesAsRead(userId: string, otherUserId: string, companyId: string) {
  const { error } = await supabase
    .from('messages')
    .update({ is_read: true })
    .eq('to_user_id', userId)
    .eq('from_user_id', otherUserId)
    .eq('company_id', companyId)
    .eq('is_read', false)
  if (error) throw error
}

export async function insertMessage(fromUserId: string, toUserId: string, companyId: string, content: string) {
  const { data, error } = await supabase
    .from('messages')
    .insert({ from_user_id: fromUserId, to_user_id: toUserId, company_id: companyId, content, is_read: false })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function countUnreadMessages(userId: string, companyId: string) {
  const { count, error } = await supabase
    .from('messages')
    .select('*', { count: 'exact', head: true })
    .eq('to_user_id', userId)
    .eq('company_id', companyId)
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
    .select('*')
    .eq('company_id', companyId)
    .order('created_at', { ascending: false })

  if (roleLower === 'owner' || roleLower === 'partner') {
    // Owner/Partner: company-wide only (dept IS NULL)
    query = query.is('department_id', null)
  } else if (roleLower === 'manager') {
    // Manager: company-wide + their own dept announcements
    if (departmentId) {
      query = query.or(`department_id.is.null,department_id.eq.${departmentId}`)
    } else {
      query = query.is('department_id', null)
    }
  } else {
    // Employee: only their department announcements
    if (departmentId) {
      query = query.eq('department_id', departmentId)
    } else {
      query = query.eq('department_id', 'none')
    }
  }

  const { data, error } = await query
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
