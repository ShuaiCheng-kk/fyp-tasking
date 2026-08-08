import { getSupabaseAdmin } from '@/lib/supabaseAdmin'

const supabase = getSupabaseAdmin()

export const managerInboxRepository = {

  // A Manager's communication scope is Owner + Partner (company-wide), every other Manager in
  // the company regardless of department, and Employees within their own department only —
  // cross-department Employees are never returned, but cross-department Managers are.
  async getManagerContacts(manager_id: string): Promise<{
    id: string
    full_name: string
    role: string
    email_address: string
    profile_photo_url: string | null
  }[]> {
    const { data: mgrDept } = await supabase
      .from('manager_departments')
      .select('department_id, company_id')
      .eq('manager_id', manager_id)
      .limit(1)
      .single()
    if (!mgrDept?.department_id || !mgrDept?.company_id) return []

    const { department_id, company_id } = mgrDept
    const contacts: { id: string; full_name: string; role: string; email_address: string; profile_photo_url: string | null }[] = []

    const { data: topRoles } = await supabase
      .from('users')
      .select('id, full_name, role, email_address, profile_photo_url')
      .eq('company_id', company_id)
      .in('role', ['Owner', 'Partner'])
    for (const u of (topRoles ?? []) as any[]) contacts.push(u)

    const { data: allManagers } = await supabase
      .from('users')
      .select('id, full_name, role, email_address, profile_photo_url')
      .eq('company_id', company_id)
      .eq('role', 'Manager')
      .neq('id', manager_id)
    for (const u of (allManagers ?? []) as any[]) contacts.push(u)

    const { data: deptEmployees } = await supabase
      .from('employee_departments')
      .select('employee_id, users!inner(id, full_name, role, email_address, profile_photo_url)')
      .eq('department_id', department_id)
    for (const row of (deptEmployees ?? []) as any[]) if (row.users) contacts.push(row.users)

    return contacts
  },

  async findUserByAuthIdOrInternalId(ref: string) {
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

}
