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

    const memberCompanies = await this.findCompaniesByMembership(owner_id)
    for (const c of memberCompanies) {
      if (!owned.some((o) => o.id === c.id)) owned.push(c)
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

  async findCompanyMember(user_id: string, company_id: string): Promise<{ id: string } | null> {
    const { data, error } = await supabase
      .from('company_members')
      .select('id')
      .eq('user_id', user_id)
      .eq('company_id', company_id)
      .single()
    if (error) return null
    return data
  },

  async insertCompanyMember(user_id: string, company_id: string, role: string): Promise<void> {
    const { error } = await supabase
      .from('company_members')
      .insert({ user_id, company_id, role })
    if (error) throw new Error(error.message)
  },

  async findCompaniesByMembership(user_id: string): Promise<Company[]> {
    const { data, error } = await supabase
      .from('company_members')
      .select('companies(*)')
      .eq('user_id', user_id)
    if (error) throw new Error(error.message)
    return (data ?? []).map((row: any) => row.companies).filter(Boolean) as Company[]
  },

  async removeCompanyMember(user_id: string, company_id: string): Promise<boolean> {
    const { error, count } = await supabase
      .from('company_members')
      .delete({ count: 'exact' })
      .eq('user_id', user_id)
      .eq('company_id', company_id)
    if (error) throw new Error(error.message)
    return (count ?? 0) > 0
  },

  async countMemberCompanies(user_id: string): Promise<number> {
    const { count, error } = await supabase
      .from('company_members')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user_id)
    if (error) throw new Error(error.message)
    return count ?? 0
  },

  async deleteAllCompanyMembersByUserId(user_id: string): Promise<void> {
    const { error } = await supabase
      .from('company_members')
      .delete()
      .eq('user_id', user_id)
    if (error) throw new Error(error.message)
  },

  async findNonOwnerMembersByCompanyId(company_id: string): Promise<{ user_id: string; supabase_auth_id: string | null }[]> {
    const { data, error } = await supabase
      .from('company_members')
      .select('user_id, users!inner(supabase_auth_id)')
      .eq('company_id', company_id)
      .neq('role', 'Owner')
    if (error) throw new Error(error.message)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (data || []).map((row: any) => ({
      user_id: row.user_id as string,
      supabase_auth_id: (row.users?.supabase_auth_id ?? null) as string | null,
    }))
  },

  async deleteInboxByCompanyId(company_id: string): Promise<void> {
    const { error } = await supabase
      .from('inbox')
      .delete()
      .eq('company_id', company_id)
    if (error) throw new Error(error.message)
  },

  async deleteAnnouncementsByCompanyId(company_id: string): Promise<void> {
    const { error } = await supabase
      .from('announcements')
      .delete()
      .eq('company_id', company_id)
    if (error) throw new Error(error.message)
  },

  async deleteNotificationsByCompanyId(company_id: string): Promise<void> {
    const { error } = await supabase
      .from('notifications')
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

  async deleteManagerDepartmentsByCompanyId(company_id: string): Promise<void> {
    const { error } = await supabase
      .from('manager_departments')
      .delete()
      .eq('company_id', company_id)
    if (error) throw new Error(error.message)
  },

  async expireInvitationCodesForUser(user_id: string, company_id: string): Promise<void> {
    const { error } = await supabase
      .from('invitation_code')
      .update({ status: 'Expired' })
      .eq('company_id', company_id)
      .eq('used_by', user_id)
      .eq('status', 'Active')
    if (error) throw new Error(error.message)
  },

  async deleteInvitationCodeByCompanyId(company_id: string): Promise<void> {
    const { error } = await supabase
      .from('invitation_code')
      .delete()
      .eq('company_id', company_id)
    if (error) throw new Error(error.message)
  },

  async deleteCompanyMembersByCompanyId(company_id: string): Promise<void> {
    const { error } = await supabase
      .from('company_members')
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

  async nullifyUserCompanyId(user_id: string, company_id: string): Promise<boolean> {
    const { data: existing } = await supabase
      .from('users')
      .select('id')
      .eq('id', user_id)
      .eq('company_id', company_id)
      .single()
    if (!existing) return false
    const { error } = await supabase
      .from('users')
      .update({ company_id: null, department_id: null })
      .eq('id', user_id)
      .eq('company_id', company_id)
    if (error) throw new Error(error.message)
    return true
  },

}
