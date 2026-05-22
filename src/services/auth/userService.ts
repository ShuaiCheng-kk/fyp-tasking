import { authRepository } from '@/repositories/auth/authRepository'
import { companyRepository } from '@/repositories/company/companyRepository'
import { User } from '@/types/auth.types'

const ROLE_ORDER: Record<string, number> = { Owner: 0, Partner: 1, Manager: 2, Employee: 3, 'Casual Worker': 4, 'Guest User': 5 }

export const userService = {

  async getUserById(id: string): Promise<User> {
    const user = await authRepository.findByAuthIdOrInternalId(id)
    if (!user) throw new Error('User not found')
    return user
  },

  async getTeamByCompany(company_id: string): Promise<User[]> {
    const { supabase } = await import('@/lib/supabase')
    const { data, error } = await supabase
      .from('company_members')
      .select('users(*)')
      .eq('company_id', company_id)
    if (error) throw new Error(error.message)
    const members = ((data || []) as any[]).map(row => row.users).filter(Boolean) as User[]
    return members.sort((a, b) => (ROLE_ORDER[a.role] ?? 99) - (ROLE_ORDER[b.role] ?? 99))
  },

  async updateUserDepartment(user_id: string, department_id: string | null): Promise<void> {
    const { supabase } = await import('@/lib/supabase')
    const { error } = await supabase
      .from('users')
      .update({ department_id })
      .eq('id', user_id)
    if (error) throw new Error(error.message)
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

  async leaveCompany(user_id: string, company_id: string): Promise<{ accountDeleted: boolean }> {
    const user = await authRepository.findById(user_id)
    if (!user) throw new Error('User not found')

    await companyRepository.removeCompanyMember(user_id, company_id)
    await companyRepository.nullifyUserCompanyId(user_id, company_id)
    await companyRepository.expireInvitationCodesForUser(user_id, company_id)

    const remaining = await companyRepository.countMemberCompanies(user_id)
    if (remaining > 0) {
      return { accountDeleted: false }
    }

    const { supabase } = await import('@/lib/supabase')
    await supabase.from('inbox').delete().or(`recipient_user_id.eq.${user_id},sender_user_id.eq.${user_id}`)
    await supabase.from('messages').delete().or(`from_user_id.eq.${user_id},to_user_id.eq.${user_id}`)
    await supabase.from('notifications').delete().or(`to_user_id.eq.${user_id},from_user_id.eq.${user_id}`)
    await supabase.from('manager_departments').delete().eq('manager_id', user_id)
    await authRepository.deleteById(user_id)
    await authRepository.deleteAuthUser(user.supabase_auth_id)
    return { accountDeleted: true }
  },

}
