import { supabase } from '@/lib/supabase'
import { User } from '@/types/auth.types'

export const ownerTeamRepository = {

  async findCompanyById(company_id: string): Promise<{ id: string; owner_id: string } | null> {
    const { data, error } = await supabase
      .from('companies')
      .select('id, owner_id')
      .eq('id', company_id)
      .single()
    if (error) return null
    return data
  },

  async findMembersByCompanyId(company_id: string): Promise<User[]> {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('company_id', company_id)
    if (error) throw new Error(error.message)
    return (data || []) as User[]
  },

  async findManagersByCompany(company_id: string): Promise<{ id: string; full_name: string }[]> {
    const { data, error } = await supabase
      .from('users')
      .select('id, full_name')
      .eq('company_id', company_id)
      .eq('role', 'Manager')
    if (error) throw new Error(error.message)
    return data || []
  },

  async findManagersByDepartment(company_id: string, department_id: string): Promise<{ id: string; full_name: string }[]> {
    const { data, error } = await supabase
      .from('manager_departments')
      .select('manager_id, users!inner(id, full_name)')
      .eq('company_id', company_id)
      .eq('department_id', department_id)
    if (error) throw new Error(error.message)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (data || []).map((row: any) => ({ id: row.users.id, full_name: row.users.full_name }))
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
      .update({ company_id: null })
      .eq('id', user_id)
      .eq('company_id', company_id)
    if (error) throw new Error(error.message)
    return true
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

  async findDepartmentManagers(company_id: string): Promise<{
    department_id: string
    manager_id: string
    manager_name: string
  }[]> {
    const { data, error } = await supabase
      .from('manager_departments')
      .select('department_id, manager_id')
      .eq('company_id', company_id)
    if (error) throw new Error(error.message)

    const assignments = (data ?? []) as { department_id: string; manager_id: string }[]
    const managerIds = [...new Set(assignments.map(row => row.manager_id))]
    if (managerIds.length === 0) return []

    const { data: users, error: userError } = await supabase
      .from('users')
      .select('id, full_name')
      .in('id', managerIds)
    if (userError) throw new Error(userError.message)

    const userMap = new Map((users ?? []).map(user => [user.id as string, user.full_name as string]))
    return assignments.map(row => ({
      department_id: row.department_id,
      manager_id: row.manager_id,
      manager_name: userMap.get(row.manager_id) ?? '',
    }))
  },

  async assignManagerDepartment(manager_id: string, company_id: string, department_id: string, assigned_by: string): Promise<void> {
    const { error } = await supabase
      .from('manager_departments')
      .insert({ manager_id, company_id, department_id, assigned_by })
    if (error) {
      if (error.code === '23505') {
        const { error: updateError } = await supabase
          .from('manager_departments')
          .update({ company_id, department_id, assigned_by, assigned_at: new Date().toISOString() })
          .eq('manager_id', manager_id)
        if (updateError) throw new Error(updateError.message)
        return
      }
      throw new Error(error.message)
    }
  },

  async removeManagerDepartmentsByCompany(manager_id: string, company_id: string): Promise<void> {
    const { error } = await supabase
      .from('manager_departments')
      .delete()
      .eq('manager_id', manager_id)
      .or(`company_id.eq.${company_id},company_id.is.null`)
    if (error) throw new Error(error.message)
  },

  async removeManagersFromDepartment(company_id: string, department_id: string): Promise<void> {
    const { error } = await supabase
      .from('manager_departments')
      .delete()
      .eq('department_id', department_id)
    if (error) throw new Error(error.message)
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
