import { supabase } from '@/lib/supabase'
import { User } from '@/types/auth.types'

export const managerTeamRepository = {

  async findMembersByCompanyId(company_id: string): Promise<User[]> {
    const { data, error } = await supabase
      .from('company_members')
      .select('users(*)')
      .eq('company_id', company_id)
    if (error) throw new Error(error.message)
    return (data || []).map((row: any) => row.users).filter(Boolean) as User[]
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

  async findUserById(id: string): Promise<User | null> {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', id)
      .single()
    if (error) return null
    return data
  },

  async findManagerDepartments(manager_id: string, company_id: string): Promise<{ department_id: string; department_name: string }[]> {
    const { data, error } = await supabase
      .from('manager_departments')
      .select('department_id, departments(name)')
      .eq('manager_id', manager_id)
      .eq('company_id', company_id)
    if (error) throw new Error(error.message)
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
