import { authRepository } from '@/repositories/auth/authRepository'
import { companyRepository } from '@/repositories/company/companyRepository'
import { User } from '@/types/auth.types'

const ROLE_ORDER: Record<string, number> = { Owner: 0, Partner: 1, Manager: 2, Employee: 3, 'Casual Worker': 4, 'Guest User': 5 }

export const userService = {

  async getUserById(id: string): Promise<User & { department_id: string | null }> {
    const { supabase } = await import('@/lib/supabase')
    const { data: user, error } = await supabase
      .from('users')
      .select('*, manager_departments!manager_departments_manager_id_fkey(department_id), employee_departments(department_id), casualworker_departments(department_id)')
      .or(`id.eq.${id},supabase_auth_id.eq.${id}`)
      .single()
    if (error || !user) throw new Error('User not found')
    return {
      ...user,
      department_id: user.manager_departments?.[0]?.department_id ?? user.employee_departments?.[0]?.department_id ?? user.casualworker_departments?.[0]?.department_id ?? null,
      manager_departments: undefined,
      employee_departments: undefined,
      casualworker_departments: undefined,
    } as User & { department_id: string | null }
  },

  async getTeamByCompany(company_id: string): Promise<(User & { department_id: string | null })[]> {
    const { supabase } = await import('@/lib/supabase')
    const { data, error } = await supabase
      .from('users')
      .select('*, manager_departments!manager_departments_manager_id_fkey(department_id), employee_departments(department_id), casualworker_departments(department_id)')
      .eq('company_id', company_id)
    if (error) throw new Error(error.message)
    const members = (data || []).map((row: any) => ({
      ...row,
      department_id: row.manager_departments?.[0]?.department_id ?? row.employee_departments?.[0]?.department_id ?? row.casualworker_departments?.[0]?.department_id ?? null,
      manager_departments: undefined,
      employee_departments: undefined,
      casualworker_departments: undefined,
    })) as (User & { department_id: string | null })[]
    return members.sort((a, b) => (ROLE_ORDER[a.role] ?? 99) - (ROLE_ORDER[b.role] ?? 99))
  },

  async getTeamByDepartment(company_id: string, department_id: string): Promise<(User & { department_id: string | null })[]> {
    const { supabase } = await import('@/lib/supabase')
    // Get employee IDs in this department via employee_departments (column is employee_id)
    const { data: edRows, error: edErr } = await supabase
      .from('employee_departments')
      .select('employee_id')
      .eq('department_id', department_id)
    if (edErr) throw new Error(edErr.message)
    const empIds = (edRows ?? []).map((r: any) => r.employee_id as string)

    // Get manager IDs for this department via manager_departments
    const { data: mdRows, error: mdErr } = await supabase
      .from('manager_departments')
      .select('manager_id')
      .eq('department_id', department_id)
      .eq('company_id', company_id)
    if (mdErr) throw new Error(mdErr.message)
    const mgrIds = (mdRows ?? []).map((r: any) => r.manager_id as string)

    // Get CW IDs in this department via casualworker_departments (mirrors employee_departments)
    const { data: cwdRows, error: cwdErr } = await supabase
      .from('casualworker_departments')
      .select('casual_worker_id')
      .eq('department_id', department_id)
    if (cwdErr) throw new Error(cwdErr.message)
    const cwIds = (cwdRows ?? []).map((r: any) => r.casual_worker_id as string)

    const allIds = [...new Set([...empIds, ...mgrIds, ...cwIds])]
    if (allIds.length === 0) return []

    const { data, error } = await supabase
      .from('users')
      .select('*, employee_departments(department_id), manager_departments!manager_departments_manager_id_fkey(department_id), casualworker_departments(department_id)')
      .in('id', allIds)
    if (error) throw new Error(error.message)
    const members = (data || []).map((row: any) => ({
      ...row,
      department_id: row.manager_departments?.[0]?.department_id ?? row.employee_departments?.[0]?.department_id ?? row.casualworker_departments?.[0]?.department_id ?? null,
      manager_departments: undefined,
      employee_departments: undefined,
      casualworker_departments: undefined,
    })) as (User & { department_id: string | null })[]
    return members.sort((a, b) => (ROLE_ORDER[a.role] ?? 99) - (ROLE_ORDER[b.role] ?? 99))
  },

  async countMembersForOwner(internal_owner_id: string): Promise<number> {
    const { supabase } = await import('@/lib/supabase')
    const { data: ownedCompanies, error: compErr } = await supabase
      .from('companies')
      .select('id')
      .eq('owner_id', internal_owner_id)
    if (compErr || !ownedCompanies || ownedCompanies.length === 0) return 0

    const companyIds = ownedCompanies.map((c: any) => c.id)
    const { count: memberCount, error: memberErr } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true })
      .in('company_id', companyIds)
      .neq('id', internal_owner_id)
    if (memberErr) throw new Error(memberErr.message)
    return (memberCount ?? 0) + 1
  },

  async updateProfile(id: string, patch: { full_name?: string; phone_number?: string | null; date_of_birth?: string | null; profile_photo_url?: string | null }): Promise<User> {
    return authRepository.updateProfile(id, patch)
  },

  async leaveCompany(user_id: string, company_id: string): Promise<{ accountDeleted: boolean }> {
    const user = await authRepository.findById(user_id)
    if (!user) throw new Error('User not found')

    await companyRepository.nullifyUserCompanyId(user_id, company_id)
    await companyRepository.expireInvitationCodesForUser(user_id, company_id)

    const { supabase } = await import('@/lib/supabase')
    const { data: remaining } = await supabase
      .from('users')
      .select('company_id')
      .eq('id', user_id)
      .single()

    if (remaining?.company_id) {
      return { accountDeleted: false }
    }

    await supabase.from('inbox').delete().or(`recipient_user_id.eq.${user_id},sender_user_id.eq.${user_id}`)
    await supabase.from('messages').delete().or(`from_user_id.eq.${user_id},to_user_id.eq.${user_id}`)
    await supabase.from('manager_departments').delete().eq('manager_id', user_id)
    await authRepository.deleteById(user_id)
    await authRepository.deleteAuthUser(user.supabase_auth_id)
    return { accountDeleted: true }
  },

}
