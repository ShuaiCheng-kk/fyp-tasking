// LAYER: Repository
// RULE: Supabase queries only. No business logic.

import { getSupabaseAdmin } from '@/lib/supabaseAdmin'

const supabase = getSupabaseAdmin()

export const casualDashboardRepository = {
  async getUserByAuthId(authId: string) {
    const { data, error } = await supabase
      .from('users')
      .select('id, full_name, role')
      .eq('supabase_auth_id', authId)
      .eq('role', 'Casual Worker')
      .maybeSingle()

    if (error) throw error
    return data
  },

  // Every not-yet-cancelled shift assignment from today onward, earliest first — the caller picks
  // whichever one is still "open" (never clocked out) as the single current job.
  async getUpcomingAssignments(userId: string, fromDateKey: string): Promise<{
    id: string
    supervisor_employee_id: string | null
    shift: {
      id: string
      company_id: string
      department_id: string
      shift_date: string
      start_time: string
      end_time: string
      is_open_ended: boolean
      source_job_posting_id: string | null
    }
  }[]> {
    const { data, error } = await supabase
      .from('shift_assignments')
      .select('id, supervisor_employee_id, shifts!inner(id, company_id, department_id, shift_date, start_time, end_time, is_open_ended, status, source_job_posting_id)')
      .eq('user_id', userId)
      .gte('shifts.shift_date', fromDateKey)
      .neq('shifts.status', 'cancelled')
      .order('shift_date', { referencedTable: 'shifts', ascending: true })
      .order('start_time', { referencedTable: 'shifts', ascending: true })
    if (error) throw new Error(error.message)
    return (data ?? []).map(row => {
      const r = row as unknown as { id: string; supervisor_employee_id: string | null; shifts: never }
      return { id: r.id, supervisor_employee_id: r.supervisor_employee_id, shift: r.shifts }
    })
  },

  async getJobPostingsByIds(ids: string[]): Promise<{
    id: string
    title: string
    company_name: string | null
    location: string | null
    address: string | null
    created_by: string | null
  }[]> {
    if (ids.length === 0) return []
    // job_postings has no location/address columns of its own — both are the company's, via the
    // companies join (matches the "Location" field on the confirmation email, which reads from
    // companies.location too). location is the area/neighbourhood (e.g. "Raffles Place"), address
    // is the full street address — same split JobPresentation.tsx uses for the public job board.
    const { data, error } = await supabase
      .from('job_postings')
      .select('id, title, created_by, companies(name, location, address)')
      .in('id', ids)
    if (error) throw new Error(error.message)
    return (data ?? []).map((row: any) => {
      const { companies, ...rest } = row
      const co = Array.isArray(companies) ? companies[0] : companies
      return { ...rest, company_name: co?.name ?? null, location: co?.location ?? null, address: co?.address ?? null }
    })
  },

  async getDepartmentsByIds(ids: string[]): Promise<{ id: string; name: string }[]> {
    if (ids.length === 0) return []
    const { data, error } = await supabase
      .from('departments')
      .select('id, name')
      .in('id', ids)
    if (error) throw new Error(error.message)
    return data ?? []
  },

  async getUsersByIds(ids: string[]): Promise<{
    id: string
    full_name: string
    role: string
    phone_number: string | null
    email_address: string
    profile_photo_url: string | null
  }[]> {
    if (ids.length === 0) return []
    const { data, error } = await supabase
      .from('users')
      .select('id, full_name, role, phone_number, email_address, profile_photo_url')
      .in('id', ids)
    if (error) throw new Error(error.message)
    return data ?? []
  },
}
