import { supabase } from '@/lib/supabase'

export const managerInboxRepository = {

  // A Manager's communication scope is Owner + Partner (company-wide) plus Managers and
  // Employees within their own department only — cross-department peers are never returned.
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

    const { data: deptManagers } = await supabase
      .from('manager_departments')
      .select('manager_id, users!inner(id, full_name, role, email_address, profile_photo_url)')
      .eq('department_id', department_id)
      .neq('manager_id', manager_id)
    for (const row of (deptManagers ?? []) as any[]) if (row.users) contacts.push(row.users)

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
