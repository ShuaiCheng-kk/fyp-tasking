import { supabase } from '@/lib/supabase'
import { User } from '@/types/auth.types'
import { Company } from '@/types/company.types'

export const partnerDashboardRepository = {

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

  async findCompaniesByMembership(user_id: string): Promise<Company[]> {
    const { data, error } = await supabase
      .from('users')
      .select('company_id, companies(*)')
      .eq('id', user_id)
      .not('company_id', 'is', null)
    if (error) throw new Error(error.message)
    return ((data ?? []) as any[]).map(row => row.companies).filter(Boolean) as Company[]
  },

}
