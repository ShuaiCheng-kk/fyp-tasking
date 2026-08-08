import { getSupabaseAdmin } from '@/lib/supabaseAdmin'

const supabase = getSupabaseAdmin()
import { Company } from '@/types/company.types'

export const companyRepository = {

  async createCompany(data: {
    name: string
    description: string | null
    owner_id: string
    plan: Company['plan']
    location?: string | null
    address?: string | null
    postal_code?: string | null
    industry?: string | null
    size?: string | null
  }): Promise<Company> {
    const { data: company, error } = await supabase
      .from('companies')
      .insert(data)
      .select()
      .single()
    if (error) throw new Error(error.message)
    return company
  },

  async findByName(name: string): Promise<Company | null> {
    const { data, error } = await supabase
      .from('companies')
      .select('*')
      .ilike('name', name.trim())
      .maybeSingle()
    if (error) throw new Error(error.message)
    return data
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

    const memberCompanies = await companyRepository.findCompaniesByMembership(owner_id)
    for (const c of memberCompanies) {
      if (!owned.some((o) => o.id === c.id)) owned.push(c)
    }

    return owned
  },

  async updateCompany(id: string, data: {
    name: string
    description: string | null
    location?: string | null
    address?: string | null
    postal_code?: string | null
    industry?: string | null
    size?: string | null
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
    address?: string | null
    postal_code?: string | null
    industry?: string | null
    size?: string | null
  }): Promise<Company> {
    const { data: company, error } = await supabase
      .from('companies')
      .insert(data)
      .select()
      .single()
    if (error) throw new Error(error.message)
    return company
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

  async deleteById(company_id: string): Promise<void> {
    const { error } = await supabase
      .from('companies')
      .delete()
      .eq('id', company_id)
    if (error) throw error
  },

  async findCompaniesByMembership(user_id: string): Promise<Company[]> {
    const { data: userRow, error: userErr } = await supabase
      .from('users')
      .select('company_id')
      .eq('id', user_id)
      .single()
    if (userErr || !userRow?.company_id) return []
    const { data, error } = await supabase
      .from('companies')
      .select('*')
      .eq('id', userRow.company_id)
    if (error) throw new Error(error.message)
    return (data ?? []) as Company[]
  },

  async findNonOwnerMembersByCompanyId(company_id: string): Promise<{ user_id: string; supabase_auth_id: string | null }[]> {
    const { data, error } = await supabase
      .from('users')
      .select('id, supabase_auth_id')
      .eq('company_id', company_id)
      .neq('role', 'Owner')
    if (error) throw new Error(error.message)
    return (data || []).map((row: any) => ({
      user_id: row.id as string,
      supabase_auth_id: (row.supabase_auth_id ?? null) as string | null,
    }))
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
  ): Promise<void> {
    const { error } = await supabase
      .from('manager_departments')
      .insert({ manager_id, company_id, department_id })
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

  async deleteAnnouncementsByCompanyId(company_id: string): Promise<void> {
    const { error } = await supabase
      .from('announcements')
      .delete()
      .eq('company_id', company_id)
    if (error) throw new Error(error.message)
  },

  async deleteMessagesByCompanyId(company_id: string): Promise<void> {
    const { error } = await supabase
      .from('messages')
      .delete()
      .eq('company_id', company_id)
    if (error) throw new Error(error.message)
  },

  async getDistinctIndustriesAndLocations(): Promise<{ industries: string[]; locations: string[] }> {
    const { data, error } = await supabase
      .from('companies')
      .select('industry, location')
    if (error) throw new Error(error.message)
    const industries = [...new Set((data ?? []).map((r: any) => r.industry).filter(Boolean) as string[])].sort()
    const locations  = [...new Set((data ?? []).map((r: any) => r.location).filter(Boolean) as string[])].sort()
    return { industries, locations }
  },

  async deleteManagerDepartmentsByCompanyId(company_id: string): Promise<void> {
    const { error } = await supabase
      .from('manager_departments')
      .delete()
      .eq('company_id', company_id)
    if (error) throw new Error(error.message)
  },

  async deleteInvitationCodeByCompanyId(company_id: string): Promise<void> {
    const { error } = await supabase
      .from('invitation_code')
      .delete()
      .eq('company_id', company_id)
    if (error) throw new Error(error.message)
  },

  async deleteDepartmentsByCompanyId(company_id: string): Promise<void> {
    const { error } = await supabase
      .from('departments')
      .delete()
      .eq('company_id', company_id)
    if (error) throw new Error(error.message)
  },

}
