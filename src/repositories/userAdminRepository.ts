// LAYER: Repository
// RULE: Supabase queries only. No business logic. No HTTP handling.

import { supabase } from '@/lib/supabase'
import { UACompany, UACompanyDetail, UACompanyMember, UAUser, UAReportStats } from '@/types/UserAdmin'

export async function getAllCompanies(search?: string): Promise<UACompany[]> {
  let query = supabase
    .from('companies')
    .select('id,name,description,plan,industry,size,location,website,logo_url,is_suspended,suspended_at,suspended_reason,created_at,owner_id')
    .order('created_at', { ascending: false })

  if (search) {
    query = query.ilike('name', `%${search}%`)
  }

  const { data, error } = await query
  if (error) throw new Error(error.message)
  return (data ?? []) as UACompany[]
}

export async function getCompanyDetail(companyId: string): Promise<UACompanyDetail | null> {
  const { data: company, error } = await supabase
    .from('companies')
    .select('id,name,description,plan,industry,size,location,website,address,postal_code,logo_url,plan_started_at,plan_next_billing_at,plan_cancel_at,is_suspended,suspended_at,suspended_reason,created_at,owner_id')
    .eq('id', companyId)
    .single()

  if (error || !company) return null

  const [{ data: memberRows }, ownerResult] = await Promise.all([
    supabase
      .from('users')
      .select('id,full_name,email_address,profile_photo_url,role,is_suspended,suspended_reason')
      .eq('company_id', companyId),
    company.owner_id
      ? supabase.from('users').select('full_name,email_address').eq('id', company.owner_id).single()
      : Promise.resolve({ data: null }),
  ])

  const ROLE_ORDER: Record<string, number> = { Owner: 0, Partner: 1, Manager: 2, Employee: 3, 'Casual Worker': 4 }
  const members: UACompanyMember[] = ((memberRows ?? []) as UACompanyMember[])
    .sort((a, b) => (ROLE_ORDER[a.role] ?? 99) - (ROLE_ORDER[b.role] ?? 99) || a.full_name.localeCompare(b.full_name))
  const ownerName: string | null = ownerResult.data?.full_name ?? null
  const ownerEmail: string | null = ownerResult.data?.email_address ?? null

  return {
    ...(company as UACompany),
    member_count: members.length,
    owner_name: ownerName,
    owner_email: ownerEmail,
    members,
  }
}

const PLATFORM_ADMIN_ROLES = ['User Admin', 'Marketing Admin']

export async function getAllUsers(search?: string, roles?: string[], statuses?: string[]): Promise<UAUser[]> {
  let query = supabase
    .from('users')
    .select('id,supabase_auth_id,full_name,email_address,profile_photo_url,role,company_id,is_suspended,suspended_at,suspended_reason,created_at')
    .not('role', 'in', `(${PLATFORM_ADMIN_ROLES.map(r => `"${r}"`).join(',')})`)
    .order('created_at', { ascending: false })

  if (search) {
    query = query.or(`full_name.ilike.%${search}%,email_address.ilike.%${search}%`)
  }
  if (roles && roles.length > 0) {
    query = query.in('role', roles)
  }
  if (statuses && statuses.length === 1) {
    query = query.eq('is_suspended', statuses[0] === 'suspended')
  }

  const { data, error } = await query
  if (error) throw new Error(error.message)

  const users = data ?? []
  const companyIds = [...new Set(users.map((u: { company_id: string | null }) => u.company_id).filter(Boolean))] as string[]

  let companyNames: Record<string, string> = {}
  if (companyIds.length > 0) {
    const { data: companies } = await supabase
      .from('companies')
      .select('id,name')
      .in('id', companyIds)
    companyNames = Object.fromEntries((companies ?? []).map((c: { id: string; name: string }) => [c.id, c.name]))
  }

  return users.map((u: { company_id: string | null; [key: string]: unknown }) => ({
    ...u,
    company_name: u.company_id ? (companyNames[u.company_id] ?? null) : null,
  })) as UAUser[]
}

export async function suspendCompany(companyId: string, reason: string): Promise<void> {
  const { error } = await supabase
    .from('companies')
    .update({ is_suspended: true, suspended_at: new Date().toISOString(), suspended_reason: reason })
    .eq('id', companyId)
  if (error) throw new Error(error.message)
}

export async function unsuspendCompany(companyId: string): Promise<void> {
  const { error } = await supabase
    .from('companies')
    .update({ is_suspended: false, suspended_at: null, suspended_reason: null })
    .eq('id', companyId)
  if (error) throw new Error(error.message)
}

export async function getUserById(userId: string): Promise<{ role: string } | null> {
  const { data } = await supabase.from('users').select('role').eq('id', userId).single()
  return data ?? null
}

export async function suspendUser(userId: string, reason: string): Promise<void> {
  const { error } = await supabase
    .from('users')
    .update({ is_suspended: true, suspended_at: new Date().toISOString(), suspended_reason: reason })
    .eq('id', userId)
  if (error) throw new Error(error.message)
}

export async function unsuspendUser(userId: string): Promise<void> {
  const { error } = await supabase
    .from('users')
    .update({ is_suspended: false, suspended_at: null, suspended_reason: null })
    .eq('id', userId)
  if (error) throw new Error(error.message)
}

export async function getReportStats(from?: string, to?: string): Promise<UAReportStats> {
  const [{ data: companies, error: ce }, { data: users, error: ue }, { data: invitations, error: ie }] = await Promise.all([
    supabase.from('companies').select('id,name,plan,industry,size,is_suspended,created_at'),
    supabase.from('users').select('id,role,company_id,is_suspended,created_at'),
    supabase.from('invitation_code').select('status,used_by'),
  ])
  if (ce) throw new Error(ce.message)
  if (ue) throw new Error(ue.message)
  if (ie) throw new Error(ie.message)

  const invs = invitations ?? []
  const invitationFunnel = {
    used: invs.filter((i: { used_by: string | null }) => i.used_by).length,
    pending: invs.filter((i: { status: string; used_by: string | null }) => i.status === 'Active' && !i.used_by).length,
    expired: invs.filter((i: { status: string; used_by: string | null }) => i.status === 'Expired' && !i.used_by).length,
  }
  const pendingInvitations = invitationFunnel.pending

  const now = new Date()
  const ago7 = new Date(now.getTime() - 7 * 86400000).toISOString()
  const ago30 = new Date(now.getTime() - 30 * 86400000).toISOString()
  const rangeFrom = from ? new Date(from).toISOString() : ago30
  const rangeTo = to ? new Date(new Date(to).getTime() + 86399999).toISOString() : now.toISOString()

  const cos = companies ?? []
  const usr = users ?? []

  const planBreakdown: Record<string, number> = {}
  const industryBreakdown: Record<string, number> = {}
  const companySizeBreakdown: Record<string, number> = {}
  for (const c of cos) {
    const p = c.plan ?? 'Unknown'
    planBreakdown[p] = (planBreakdown[p] ?? 0) + 1
    const ind = c.industry ?? 'Other'
    industryBreakdown[ind] = (industryBreakdown[ind] ?? 0) + 1
    const sz = c.size ?? 'Unknown'
    companySizeBreakdown[sz] = (companySizeBreakdown[sz] ?? 0) + 1
  }

  const roleBreakdown: Record<string, number> = {}
  for (const u of usr) {
    const r = u.role ?? 'Unknown'
    roleBreakdown[r] = (roleBreakdown[r] ?? 0) + 1
  }

  // Last 6 months growth
  const months: { month: string; companies: number; users: number }[] = []
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const start = new Date(d.getFullYear(), d.getMonth(), 1).toISOString()
    const end = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59).toISOString()
    const label = d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
    months.push({
      month: label,
      companies: cos.filter((c: { created_at: string }) => c.created_at >= start && c.created_at <= end).length,
      users: usr.filter((u: { created_at: string }) => u.created_at >= start && u.created_at <= end).length,
    })
  }

  // Top companies by member count
  const memberCountMap: Record<string, number> = {}
  for (const u of usr) {
    if (u.company_id) memberCountMap[u.company_id] = (memberCountMap[u.company_id] ?? 0) + 1
  }
  const companyNameMap: Record<string, string> = Object.fromEntries(cos.map((c: { id: string; name: string }) => [c.id, c.name]))
  const topCompaniesByMemberCount = Object.entries(memberCountMap)
    .map(([id, count]) => ({ name: companyNameMap[id] ?? 'Unknown', count }))
    .sort((a, b) => b.count - a.count)

  const avgUsersPerCompany = cos.length > 0 ? Math.round((usr.length / cos.length) * 10) / 10 : 0

  const companyPlanMap: Record<string, string> = Object.fromEntries(cos.map((c: { id: string; plan: string }) => [c.id, c.plan]))
  const usersByCompanyPlan = { free: 0, paid: 0 }
  for (const u of usr as { company_id: string | null }[]) {
    if (!u.company_id) continue
    const plan = companyPlanMap[u.company_id]
    if (plan === 'Paid') usersByCompanyPlan.paid += 1
    else if (plan === 'Free') usersByCompanyPlan.free += 1
  }

  return {
    totalCompanies: cos.length,
    totalUsers: usr.length,
    activeCompanies: cos.filter((c: { is_suspended: boolean }) => !c.is_suspended).length,
    activeUsers: usr.filter((u: { is_suspended: boolean }) => !u.is_suspended).length,
    suspendedCompanies: cos.filter((c: { is_suspended: boolean }) => c.is_suspended).length,
    suspendedUsers: usr.filter((u: { is_suspended: boolean }) => u.is_suspended).length,
    newCompaniesLast7Days: cos.filter((c: { created_at: string }) => c.created_at >= ago7).length,
    newUsersLast7Days: usr.filter((u: { created_at: string }) => u.created_at >= ago7).length,
    newCompaniesLast30Days: cos.filter((c: { created_at: string }) => c.created_at >= ago30).length,
    newUsersLast30Days: usr.filter((u: { created_at: string }) => u.created_at >= ago30).length,
    newCompaniesInRange: cos.filter((c: { created_at: string }) => c.created_at >= rangeFrom && c.created_at <= rangeTo).length,
    newUsersInRange: usr.filter((u: { created_at: string }) => u.created_at >= rangeFrom && u.created_at <= rangeTo).length,
    avgUsersPerCompany,
    pendingInvitationCount: pendingInvitations,
    invitationFunnel,
    usersWithCompany: usr.filter((u: { company_id: string | null }) => u.company_id).length,
    usersWithoutCompany: usr.filter((u: { company_id: string | null }) => !u.company_id).length,
    usersByCompanyPlan,
    topCompaniesByMemberCount,
    planBreakdown,
    roleBreakdown,
    industryBreakdown,
    companySizeBreakdown,
    growthByMonth: months,
  }
}
