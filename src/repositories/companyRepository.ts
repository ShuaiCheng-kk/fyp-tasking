// LAYER: Repository
// RULE: Only handles database queries. No business logic.

import { supabase } from '@/lib/supabase'
import { Company } from '@/types'

export const companyRepository = {

  async createCompany(data: {
    name: string
    description: string | null
    owner_id: string
    plan: Company['plan']
  }): Promise<Company> {
    const { data: company, error } = await supabase
      .from('companies')
      .insert(data)
      .select()
      .single()
    if (error) throw new Error(error.message)
    return company
  },

  async findByOwnerId(owner_id: string): Promise<Company | null> {
    const { data, error } = await supabase
      .from('companies')
      .select('*')
      .eq('owner_id', owner_id)
      .single()
    if (error) return null
    return data
  },

  async updatePlan(id: string, plan: Company['plan']): Promise<void> {
    const { error } = await supabase
      .from('companies')
      .update({ plan })
      .eq('id', id)
    if (error) throw new Error(error.message)
  },

  async findById(id: string): Promise<Company | null> {
    const { data, error } = await supabase
      .from('companies')
      .select('*')
      .eq('id', id)
      .single()
    if (error) return null
    return data
  },

  async findAllByOwnerId(owner_id: string): Promise<Company[]> {
    const { data, error } = await supabase
      .from('companies')
      .select('*')
      .eq('owner_id', owner_id)
    if (error) throw error
    return data || []
  },

  async updateCompany(id: string, data: { name: string; description: string | null }): Promise<Company> {
    const { data: company, error } = await supabase
      .from('companies')
      .update(data)
      .eq('id', id)
      .select()
      .single()
    if (error) throw new Error(error.message)
    return company
  },

  async createCompanyForOwner(data: {
    name: string
    description: string | null
    owner_id: string
    plan: Company['plan']
  }): Promise<Company> {
    const { data: company, error } = await supabase
      .from('companies')
      .insert(data)
      .select()
      .single()
    if (error) throw new Error(error.message)
    return company
  },

}
