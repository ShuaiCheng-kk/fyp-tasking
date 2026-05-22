import { supabase } from '@/lib/supabase'
import { User } from '@/types/auth.types'

export const ownerTeamRepository = {

  async findMembersByCompanyId(company_id: string): Promise<User[]> {
    const { data, error } = await supabase
      .from('company_members')
      .select('users(*)')
      .eq('company_id', company_id)
    if (error) throw new Error(error.message)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (data || []).map((row: any) => row.users).filter(Boolean) as User[]
  },

  async findManagersByCompany(company_id: string): Promise<{ id: string; full_name: string; department_id: string | null }[]> {
    const { data, error } = await supabase
      .from('users')
      .select('id, full_name, department_id')
      .eq('company_id', company_id)
      .eq('role', 'Manager')
    if (error) throw new Error(error.message)
    return data || []
  },

  async findManagersByDepartment(company_id: string, department_id: string): Promise<{ id: string; full_name: string }[]> {
    const { data, error } = await supabase
      .from('users')
      .select('id, full_name')
      .eq('company_id', company_id)
      .eq('department_id', department_id)
      .eq('role', 'Manager')
    if (error) throw new Error(error.message)
    return data || []
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

  async findUserById(id: string): Promise<User | null> {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', id)
      .single()
    if (error) return null
    return data
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

  async removeCompanyMember(user_id: string, company_id: string): Promise<boolean> {
    const { error, count } = await supabase
      .from('company_members')
      .delete({ count: 'exact' })
      .eq('user_id', user_id)
      .eq('company_id', company_id)
    if (error) throw new Error(error.message)
    return (count ?? 0) > 0
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

  async deleteUserById(user_id: string): Promise<void> {
    const { error } = await supabase
      .from('users')
      .delete()
      .eq('id', user_id)
    if (error) throw new Error(error.message)
  },

  async deleteInboxByUserId(user_id: string): Promise<void> {
    const { error } = await supabase
      .from('inbox')
      .delete()
      .or(`recipient_user_id.eq.${user_id},sender_user_id.eq.${user_id}`)
    if (error) throw new Error(error.message)
  },

  async deleteMessagesByUserId(user_id: string): Promise<void> {
    const { error } = await supabase
      .from('messages')
      .delete()
      .or(`from_user_id.eq.${user_id},to_user_id.eq.${user_id}`)
    if (error) throw new Error(error.message)
  },

  async deleteNotificationsByUserId(user_id: string): Promise<void> {
    const { error } = await supabase
      .from('notifications')
      .delete()
      .or(`to_user_id.eq.${user_id},from_user_id.eq.${user_id}`)
    if (error) throw new Error(error.message)
  },

  async deleteManagerDepartmentsByUserId(user_id: string): Promise<void> {
    const { error } = await supabase
      .from('manager_departments')
      .delete()
      .eq('manager_id', user_id)
    if (error) throw new Error(error.message)
  },

  async findManagerDepartments(manager_id: string, company_id: string): Promise<{ department_id: string; department_name: string }[]> {
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

  async assignManagerDepartment(manager_id: string, company_id: string, department_id: string, assigned_by: string): Promise<void> {
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
