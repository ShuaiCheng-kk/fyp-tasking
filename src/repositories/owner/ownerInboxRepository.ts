import { getSupabaseAdmin } from '@/lib/supabaseAdmin'

const supabase = getSupabaseAdmin()

export const ownerInboxRepository = {

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

  async deleteConversation(userId: string, otherUserId: string) {
    const { error } = await supabase
      .from('messages')
      .delete()
      .or(
        `and(from_user_id.eq.${userId},to_user_id.eq.${otherUserId}),and(from_user_id.eq.${otherUserId},to_user_id.eq.${userId})`
      )
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
      .is('audience_department_id', null)
    if (lastReadAt) {
      query = query.gt('created_at', lastReadAt)
    }
    const { count, error } = await query
    if (error) throw error
    return count ?? 0
  },

  async findUserById(id: string) {
    const { data } = await supabase
      .from('users')
      .select('*')
      .eq('id', id)
      .single()
    return data ?? null
  },

  // A Casual Worker's company membership lives in casualworker_departments, one row per
  // department, because the same worker can be hired by several companies. users.company_id is
  // not filled in for them by the hiring flow, so it must never be used to decide whether a
  // Casual Worker belongs to a company.
  async isCasualWorkerInCompany(userId: string, companyId: string): Promise<boolean> {
    const { data, error } = await supabase
      .from('casualworker_departments')
      .select('casual_worker_id')
      .eq('casual_worker_id', userId)
      .eq('company_id', companyId)
      .limit(1)
    if (error) throw new Error(error.message)
    return (data ?? []).length > 0
  },

  async findCompanyById(id: string) {
    const { data } = await supabase
      .from('companies')
      .select('*')
      .eq('id', id)
      .single()
    return data ?? null
  },

  async getLastSenderNameSnapshot(partnerId: string, companyId: string): Promise<string | null> {
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
  },

}
