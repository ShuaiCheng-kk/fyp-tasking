import { supabase } from '@/lib/supabase'
import { User } from '@/types/auth.types'
import { Company } from '@/types/company.types'

export const ownerDashboardRepository = {

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

  async findCompaniesByOwnerId(owner_id: string): Promise<Company[]> {
    const { data, error } = await supabase
      .from('companies')
      .select('*')
      .eq('owner_id', owner_id)
    if (error) throw error
    return data || []
  },

  async countMembersAcrossOwnedCompanies(internal_owner_id: string): Promise<number> {
    const { data: ownedCompanies, error: compErr } = await supabase
      .from('companies')
      .select('id')
      .eq('owner_id', internal_owner_id)
    if (compErr || !ownedCompanies || ownedCompanies.length === 0) return 0

    const companyIds = ownedCompanies.map((c) => c.id)
    const { count: memberCount, error: memberErr } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true })
      .in('company_id', companyIds)
      .neq('id', internal_owner_id)
    if (memberErr) throw new Error(memberErr.message)

    return (memberCount ?? 0) + 1
  },

}
