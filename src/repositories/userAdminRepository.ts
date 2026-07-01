import { supabase } from '@/lib/supabase'
import { UACompany, UACompanyDetail, UAUser } from '@/types/UserAdmin'

export async function getAllCompanies(search?: string): Promise<UACompany[]> {
  let query = supabase
    .from('companies')
    .select('id,name,description,plan,industry,size,location,website,is_suspended,suspended_at,suspended_reason,created_at,owner_id')
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
    .select('id,name,description,plan,industry,size,location,website,is_suspended,suspended_at,suspended_reason,created_at,owner_id')
    .eq('id', companyId)
    .single()

  if (error || !company) return null

  const { count: memberCount } = await supabase
    .from('users')
    .select('id', { count: 'exact', head: true })
    .eq('company_id', companyId)

  let ownerName: string | null = null
  let ownerEmail: string | null = null
  if (company.owner_id) {
    const { data: owner } = await supabase
      .from('users')
      .select('full_name,email_address')
      .eq('id', company.owner_id)
      .single()
    ownerName = owner?.full_name ?? null
    ownerEmail = owner?.email_address ?? null
  }

  return {
    ...(company as UACompany),
    member_count: memberCount ?? 0,
    owner_name: ownerName,
    owner_email: ownerEmail,
  }
}

export async function getAllUsers(search?: string, roles?: string[], statuses?: string[]): Promise<UAUser[]> {
  let query = supabase
    .from('users')
    .select('id,supabase_auth_id,full_name,email_address,role,company_id,is_suspended,suspended_at,suspended_reason,created_at')
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
