// LAYER: Repository
// RULE: Supabase queries only. No business logic.

import { getSupabaseAdmin } from '@/lib/supabaseAdmin'

const supabase = getSupabaseAdmin()

export const casualInboxRepository = {
  async getUserByAuthId(authId: string): Promise<{ id: string; full_name: string } | null> {
    const { data, error } = await supabase
      .from('users')
      .select('id, full_name')
      .eq('supabase_auth_id', authId)
      .eq('role', 'Casual Worker')
      .maybeSingle()
    if (error) throw error
    return data
  },

  async getMessagesBetweenUsers(userId: string, otherUserId: string) {
    const { data, error } = await supabase
      .from('messages')
      .select('id, from_user_id, to_user_id, content, created_at, is_read, company_id, sender_name')
      .or(`and(from_user_id.eq.${userId},to_user_id.eq.${otherUserId}),and(from_user_id.eq.${otherUserId},to_user_id.eq.${userId})`)
      .order('created_at', { ascending: true })
    if (error) throw error
    return data ?? []
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
}
