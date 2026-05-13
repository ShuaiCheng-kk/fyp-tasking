// LAYER: Repository
// RULE: Only handles database queries. No business logic.

import { supabase } from '@/lib/supabase'
import { InvitationCode } from '@/types'

export const invitationRepository = {

  async createCode(data: {
    code: string
    company_id: string
    department_id: string | null
    role: InvitationCode['role']
    generated_by: string
    expired_at: string
  }): Promise<InvitationCode> {
    const { data: invitation, error } = await supabase
      .from('invitation_code')
      .insert(data)
      .select()
      .single()
    if (error) throw new Error(error.message)
    return invitation
  },

  async findByCode(code: string): Promise<InvitationCode | null> {
    const { data, error } = await supabase
      .from('invitation_code')
      .select('*')
      .eq('code', code)
      .eq('status', 'Active')
      .single()
    if (error) return null
    return data
  },

  async markAsUsed(code: string, used_by: string): Promise<void> {
    const { error } = await supabase
      .from('invitation_code')
      .update({
        status: 'Expired',
        used_by,
      })
      .eq('code', code)
    if (error) throw new Error(error.message)
  },

  async expireOldCodes(): Promise<void> {
    const { error } = await supabase
      .from('invitation_code')
      .update({ status: 'Expired' })
      .eq('status', 'Active')
      .lt('expired_at', new Date().toISOString())
    if (error) throw new Error(error.message)
  },

  async findByCompanyId(company_id: string): Promise<InvitationCode[]> {
    const { data, error } = await supabase
      .from('invitation_code')
      .select('*')
      .eq('company_id', company_id)
    if (error) throw new Error(error.message)
    return data || []
  },

}
