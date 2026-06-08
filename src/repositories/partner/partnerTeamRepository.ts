import { supabase } from '@/lib/supabase'
import { User } from '@/types/auth.types'

export const partnerTeamRepository = {

  async findMembersByCompanyId(company_id: string): Promise<User[]> {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('company_id', company_id)
    if (error) throw new Error(error.message)
    return (data || []) as User[]
  },

  async findUserByAuthIdOrInternalId(ref: string): Promise<User | null> {
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
