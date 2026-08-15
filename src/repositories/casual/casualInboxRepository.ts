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

  // Unread count per sender, WITHOUT marking anything read — the panel needs to know a thread it
  // isn't currently showing has something new, and reading getMessagesBetweenUsers for that would
  // mark those messages read as a side effect (markMessagesAsRead runs right after it), silently
  // clearing the very badge we're trying to raise.
  async countUnreadFromSenders(userId: string, senderIds: string[]): Promise<Record<string, number>> {
    if (senderIds.length === 0) return {}
    const { data, error } = await supabase
      .from('messages')
      .select('from_user_id')
      .eq('to_user_id', userId)
      .eq('is_read', false)
      .in('from_user_id', senderIds)
    if (error) throw error
    const counts: Record<string, number> = {}
    for (const row of (data ?? []) as { from_user_id: string }[]) {
      counts[row.from_user_id] = (counts[row.from_user_id] ?? 0) + 1
    }
    return counts
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
