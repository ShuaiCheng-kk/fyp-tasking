import { authRepository } from '@/repositories/auth/authRepository'
import { companyRepository } from '@/repositories/company/companyRepository'
import { User } from '@/types/auth.types'

const ROLE_ORDER: Record<string, number> = { Owner: 0, Partner: 1, Manager: 2, Employee: 3, 'Casual Worker': 4, 'Guest User': 5 }

// A team member row carries the CW-specific per-company flags (worked-a-shift + banned) so the
// Team page can gate the pool and flag bans without extra round-trips.
type TeamMemberRow = User & {
  department_id: string | null
  casual_worker_verified_at: string | null
  casual_worker_inactive_at: string | null
  casual_worker_inactive_reason: string | null
}

type CwMeta = { verified_at: string | null; inactive_at: string | null; inactive_reason: string | null }

function buildCwMeta(rows: any[] | null): Map<string, CwMeta> {
  return new Map((rows ?? []).map((r: any) => [
    r.casual_worker_id as string,
    { verified_at: r.verified_at ?? null, inactive_at: r.inactive_at ?? null, inactive_reason: r.inactive_reason ?? null },
  ]))
}

function mapTeamMemberRow(row: any, cwMeta: Map<string, CwMeta>): TeamMemberRow {
  const meta = cwMeta.get(row.id)
  return {
    ...row,
    department_id: row.manager_departments?.[0]?.department_id ?? row.employee_departments?.[0]?.department_id ?? row.casualworker_departments?.[0]?.department_id ?? null,
    casual_worker_verified_at: meta?.verified_at ?? null,
    casual_worker_inactive_at: meta?.inactive_at ?? null,
    casual_worker_inactive_reason: meta?.inactive_reason ?? null,
    manager_departments: undefined,
    employee_departments: undefined,
    casualworker_departments: undefined,
  } as TeamMemberRow
}

export const userService = {

  // Server-side guard for Owner-only use cases (UC24-26, UC30, UC31, UC33, UC34): the UI hides
  // these actions from other roles, but the API must reject them too.
  async assertOwnerRole(user_id: string): Promise<void> {
    const user = await userService.getUserById(user_id)
    if (user.role !== 'Owner') throw new Error('Only an Owner can perform this action')
  },

  // Server-side guard for Owner-or-Partner use cases (e.g. UC32 Invite Members by CSV) —
  // Partner is a clone of Owner for this one, unlike the strictly Owner-only set above.
  async assertOwnerOrPartnerRole(user_id: string): Promise<void> {
    const user = await userService.getUserById(user_id)
    if (user.role !== 'Owner' && user.role !== 'Partner') throw new Error('Only an Owner or Partner can perform this action')
  },

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

  async getTeamByCompany(company_id: string): Promise<TeamMemberRow[]> {
    const { supabase } = await import('@/lib/supabase')
    // Owner/Partner/Manager/Employee are linked via users.company_id. Recruited Casual Workers
    // never get that column set (they join via recruitment two-way-confirm, not invite-code) — the
    // authoritative link for them is casualworker_departments, so that's unioned in below on top of
    // the company_id query (which still covers any CW row that does have company_id set). Every
    // confirmed CW is returned either way — this is a shared "who belongs to this company" lookup
    // used by pickers (e.g. shift-swap replacement) that need to see everyone regardless of pool
    // status. casual_worker_verified_at (worked a shift) and casual_worker_inactive_at (banned by
    // this company) are exposed so the Team page can filter/flag without re-querying.
    const { data, error } = await supabase
      .from('users')
      .select('*, manager_departments!manager_departments_manager_id_fkey(department_id), employee_departments(department_id), casualworker_departments(department_id)')
      .eq('company_id', company_id)
    if (error) throw new Error(error.message)

    const { data: cwdRows, error: cwdErr } = await supabase
      .from('casualworker_departments')
      .select('casual_worker_id, verified_at, inactive_at, inactive_reason')
      .eq('company_id', company_id)
    if (cwdErr) throw new Error(cwdErr.message)
    const cwMeta = buildCwMeta(cwdRows)
    const knownIds = new Set((data ?? []).map((row: any) => row.id as string))
    const missingCwIds = [...cwMeta.keys()].filter(id => !knownIds.has(id))

    let cwUsers: any[] = []
    if (missingCwIds.length > 0) {
      const { data: cwData, error: cwErr } = await supabase
        .from('users')
        .select('*, casualworker_departments(department_id)')
        .in('id', missingCwIds)
      if (cwErr) throw new Error(cwErr.message)
      cwUsers = cwData ?? []
    }

    const members = [...(data || []), ...cwUsers].map((row: any) => mapTeamMemberRow(row, cwMeta))
    return members.sort((a, b) => (ROLE_ORDER[a.role] ?? 99) - (ROLE_ORDER[b.role] ?? 99))
  },

  async getTeamByDepartment(company_id: string, department_id: string): Promise<TeamMemberRow[]> {
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

    // Get CW IDs in this department via casualworker_departments (mirrors employee_departments).
    // Every confirmed CW is included — pickers that reuse this lookup need everyone, not just the
    // verified pool. verified_at/inactive_at are carried through for callers that filter/flag on them.
    const { data: cwdRows, error: cwdErr } = await supabase
      .from('casualworker_departments')
      .select('casual_worker_id, verified_at, inactive_at, inactive_reason')
      .eq('department_id', department_id)
    if (cwdErr) throw new Error(cwdErr.message)
    const cwMeta = buildCwMeta(cwdRows)
    const cwIds = [...cwMeta.keys()]

    const allIds = [...new Set([...empIds, ...mgrIds, ...cwIds])]
    if (allIds.length === 0) return []

    const { data, error } = await supabase
      .from('users')
      .select('*, employee_departments(department_id), manager_departments!manager_departments_manager_id_fkey(department_id), casualworker_departments(department_id)')
      .in('id', allIds)
    if (error) throw new Error(error.message)
    const members = (data || []).map((row: any) => mapTeamMemberRow(row, cwMeta))
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

    await supabase.from('messages').delete().or(`from_user_id.eq.${user_id},to_user_id.eq.${user_id}`)
    await supabase.from('manager_departments').delete().eq('manager_id', user_id)
    await authRepository.deleteById(user_id)
    await authRepository.deleteAuthUser(user.supabase_auth_id)
    return { accountDeleted: true }
  },

}
