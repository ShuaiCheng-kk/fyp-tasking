import { supabase } from '@/lib/supabase'

export const employeeInboxRepository = {

  async getEmployeeContacts(user_id: string): Promise<{
    id: string
    full_name: string
    role: string
    email_address: string
  }[]> {
    const { data: empDept } = await supabase
      .from('employee_departments')
      .select('department_id')
      .eq('employee_id', user_id)
      .single()
    if (!empDept?.department_id) return []

    const { department_id } = empDept
    const contacts: { id: string; full_name: string; role: string; email_address: string }[] = []

    const { data: mgrDept } = await supabase
      .from('manager_departments')
      .select('manager_id')
      .eq('department_id', department_id)
      .limit(1)
      .single()
    if (mgrDept?.manager_id) {
      const { data: mgrUser } = await supabase
        .from('users')
        .select('id, full_name, role, email_address')
        .eq('id', mgrDept.manager_id)
        .single()
      if (mgrUser) contacts.push(mgrUser as any)
    }

    const { data: teammates } = await supabase
      .from('employee_departments')
      .select('employee_id, users!inner(id, full_name, role, email_address)')
      .eq('department_id', department_id)
      .neq('employee_id', user_id)

    for (const row of (teammates ?? []) as any[]) {
      if (row.users) contacts.push(row.users)
    }

    // Casual Workers this Employee currently supervises (via shift_assignments.supervisor_employee_id,
    // the same link Task assignment gates on) — they can only message their supervisor, so the
    // supervisor must be able to see and reply to them.
    const { data: cwAssignments } = await supabase
      .from('shift_assignments')
      .select('user_id, shifts!inner(department_id)')
      .eq('supervisor_employee_id', user_id)
      .eq('shifts.department_id', department_id)
    const cwIds = [...new Set((cwAssignments ?? []).map((row: { user_id: string }) => row.user_id))]
    if (cwIds.length > 0) {
      const { data: cwUsers } = await supabase
        .from('users')
        .select('id, full_name, role, email_address')
        .in('id', cwIds)
      for (const u of (cwUsers ?? []) as any[]) contacts.push(u)
    }

    return contacts
  },

  async getConversationPartners(userId: string) {
    const { data, error } = await supabase
      .from('messages')
      .select('id, from_user_id, to_user_id, content, created_at, is_read, sender_name, company_id')
      .or(`from_user_id.eq.${userId},to_user_id.eq.${userId}`)
      .order('created_at', { ascending: false })
    if (error) throw error
    return data
  },

  async getMessagesBetweenUsers(userId: string, otherUserId: string) {
    const { data, error } = await supabase
      .from('messages')
      .select('id, from_user_id, to_user_id, content, created_at, is_read, company_id, sender_name, sender:users!messages_from_user_id_fkey!left(full_name)')
      .or(
        `and(from_user_id.eq.${userId},to_user_id.eq.${otherUserId}),and(from_user_id.eq.${otherUserId},to_user_id.eq.${userId})`
      )
      .order('created_at', { ascending: true })
    if (error) throw error
    return (data ?? []).map(({ sender, ...msg }: any) => msg)
  },

  async markMessagesAsRead(userId: string, otherUserId: string) {
    const { error } = await supabase
      .from('messages')
      .update({ is_read: true })
      .eq('to_user_id', userId)
      .eq('from_user_id', otherUserId)
      .eq('is_read', false)
    if (error) throw error
  },

  async insertMessage(fromUserId: string, toUserId: string, companyId: string, content: string, senderName?: string) {
    const { data, error } = await supabase
      .from('messages')
      .insert({ from_user_id: fromUserId, to_user_id: toUserId, company_id: companyId, content, is_read: false, sender_name: senderName ?? null })
      .select()
      .single()
    if (error) throw error
    return data
  },

  async countUnreadMessages(userId: string) {
    const { count, error } = await supabase
      .from('messages')
      .select('*', { count: 'exact', head: true })
      .eq('to_user_id', userId)
      .eq('is_read', false)
    if (error) throw error
    return count ?? 0
  },

  async countUnreadAnnouncements(companyId: string, lastReadAt: string | null) {
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
  },

  async countPendingInvitations(userId: string) {
    const { count, error } = await supabase
      .from('inbox')
      .select('*', { count: 'exact', head: true })
      .eq('recipient_user_id', userId)
      .eq('status', 'pending')
    if (error) throw error
    return count ?? 0
  },

  async getInvitesByRecipient(recipient_user_id: string) {
    const { data, error } = await supabase
      .from('inbox')
      .select(`*, sender:users!inbox_sender_user_id_fkey(full_name), companies(name)`)
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
  },

  async getInboxItemById(inbox_id: string) {
    const { data, error } = await supabase
      .from('inbox')
      .select('*')
      .eq('id', inbox_id)
      .single()
    if (error || !data) throw new Error('Inbox record not found')
    return data
  },

  async updateInboxStatus(inbox_id: string, status: string) {
    const { error } = await supabase
      .from('inbox')
      .update({ status })
      .eq('id', inbox_id)
    if (error) throw new Error(`Failed to update inbox status: ${error.message}`)
  },

  async findUserById(id: string) {
    const { data } = await supabase
      .from('users')
      .select('*')
      .eq('id', id)
      .single()
    return data ?? null
  },

  async findUserByAuthIdOrInternalId(ref: string) {
    const { data: byAuth } = await supabase
      .from('users')
      .select('*')
      .eq('supabase_auth_id', ref)
      .single()
    if (byAuth) return byAuth
    const { data: byId } = await supabase
      .from('users')
      .select('*')
      .eq('id', ref)
      .single()
    return byId ?? null
  },

}
