// LAYER: Repository
// RULE: Supabase queries only. No business logic.

import { supabase } from '@/lib/supabase'

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

  async getUpcomingShifts(userId: string, fromDateKey: string): Promise<{
    id: string
    title: string
    shift_date: string
    start_time: string
    end_time: string
    is_open_ended: boolean
    source_job_posting_id: string | null
  }[]> {
    const { data, error } = await supabase
      .from('shift_assignments')
      .select('shifts!inner(id, title, shift_date, start_time, end_time, is_open_ended, status, source_job_posting_id)')
      .eq('user_id', userId)
      .gte('shifts.shift_date', fromDateKey)
      .neq('shifts.status', 'cancelled')
    if (error) throw new Error(error.message)
    return (data ?? []).map(row => (row as unknown as { shifts: never }).shifts)
  },

  async getJobPostingsByIds(ids: string[]): Promise<{
    id: string
    company_name: string | null
    location: string | null
    assigned_employee_id: string | null
  }[]> {
    if (ids.length === 0) return []
    const { data, error } = await supabase
      .from('job_postings')
      .select('id, company_name, location, assigned_employee_id')
      .in('id', ids)
    if (error) throw new Error(error.message)
    return data ?? []
  },

  async getUsersByIds(ids: string[]): Promise<{
    id: string
    full_name: string
    phone_number: string | null
    email_address: string
  }[]> {
    if (ids.length === 0) return []
    const { data, error } = await supabase
      .from('users')
      .select('id, full_name, phone_number, email_address')
      .in('id', ids)
    if (error) throw new Error(error.message)
    return data ?? []
  },
}
