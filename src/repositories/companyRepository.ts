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
    location?: string | null
    industry?: string | null
    size?: string | null
    logo_url?: string | null
    website?: string | null
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

  async updatePlanByOwnerId(owner_id: string, plan: Company['plan']): Promise<void> {
    const { error } = await supabase
      .from('companies')
      .update({ plan })
      .eq('owner_id', owner_id)
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
    const owned: Company[] = data || []

    const { data: userData } = await supabase
      .from('users')
      .select('company_id')
      .eq('id', owner_id)
      .single()

    if (userData?.company_id && !owned.some((c) => c.id === userData.company_id)) {
      const { data: invitedCompany } = await supabase
        .from('companies')
        .select('*')
        .eq('id', userData.company_id)
        .single()
      if (invitedCompany) owned.push(invitedCompany)
    }

    return owned
  },

  async updateCompany(id: string, data: {
    name: string
    description: string | null
    location?: string | null
    industry?: string | null
    size?: string | null
    logo_url?: string | null
    website?: string | null
  }): Promise<Company> {
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
    location?: string | null
    industry?: string | null
    size?: string | null
    logo_url?: string | null
    website?: string | null
  }): Promise<Company> {
    const { data: company, error } = await supabase
      .from('companies')
      .insert(data)
      .select()
      .single()
    if (error) throw new Error(error.message)
    return company
  },

  async deleteById(company_id: string): Promise<void> {
    const { error } = await supabase
      .from('companies')
      .delete()
      .eq('id', company_id)
    if (error) throw error
  },

  async removeUserFromCompany(user_id: string, company_id: string): Promise<void> {
    const { error } = await supabase
      .from('users')
      .update({ company_id: null, department_id: null })
      .eq('id', user_id)
      .eq('company_id', company_id)
    if (error) throw new Error(error.message)
  },

  async findManagerDepartments(
    manager_id: string,
    company_id: string,
  ): Promise<{ department_id: string; department_name: string }[]> {
    const { data, error } = await supabase
      .from('manager_departments')
      .select('department_id, departments(name)')
      .eq('manager_id', manager_id)
      .eq('company_id', company_id)
    if (error) throw new Error(error.message)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (data || []).map((row: any) => ({
      department_id: row.department_id as string,
      department_name: (Array.isArray(row.departments) ? row.departments[0]?.name : row.departments?.name) ?? '',
    }))
  },

  async assignManagerDepartment(
    manager_id: string,
    company_id: string,
    department_id: string,
    assigned_by: string,
  ): Promise<void> {
    const { error } = await supabase
      .from('manager_departments')
      .insert({ manager_id, company_id, department_id, assigned_by })
    if (error) {
      if (error.code === '23505') throw new Error('ALREADY_ASSIGNED')
      throw new Error(error.message)
    }
  },

  async removeManagerDepartment(manager_id: string, department_id: string): Promise<void> {
    const { error } = await supabase
      .from('manager_departments')
      .delete()
      .eq('manager_id', manager_id)
      .eq('department_id', department_id)
    if (error) throw new Error(error.message)
  },

}
