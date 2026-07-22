// LAYER: Repository
// RULE: Supabase queries only. No business logic.

import { supabase } from '@/lib/supabase'

export const shiftReminderRepository = {
  // Every not-yet-reminded, not-cancelled shift starting on the given date, with the ids of
  // everyone assigned to it (a shift can have more than one assignment).
  async getShiftsStartingOn(dateKey: string): Promise<{
    id: string
    company_id: string
    title: string | null
    shift_date: string
    start_time: string
    supervisor_employee_id: string | null
    source_job_posting_id: string | null
    assignedUserIds: string[]
  }[]> {
    const { data, error } = await supabase
      .from('shifts')
      .select('id, company_id, title, shift_date, start_time, source_job_posting_id, shift_assignments!inner(user_id, supervisor_employee_id)')
      .eq('shift_date', dateKey)
      .neq('status', 'cancelled')
      .is('reminder_sent_at', null)
    if (error) throw new Error(error.message)

    return (data ?? []).map(row => {
      const r = row as unknown as {
        id: string
        company_id: string
        title: string | null
        shift_date: string
        start_time: string
        source_job_posting_id: string | null
        shift_assignments: { user_id: string; supervisor_employee_id: string | null }[]
      }
      return {
        id: r.id,
        company_id: r.company_id,
        title: r.title,
        shift_date: r.shift_date,
        start_time: r.start_time,
        supervisor_employee_id: r.shift_assignments[0]?.supervisor_employee_id ?? null,
        source_job_posting_id: r.source_job_posting_id,
        assignedUserIds: r.shift_assignments.map(a => a.user_id),
      }
    })
  },

  async markReminderSent(shiftIds: string[]): Promise<void> {
    if (shiftIds.length === 0) return
    const { error } = await supabase
      .from('shifts')
      .update({ reminder_sent_at: new Date().toISOString() })
      .in('id', shiftIds)
    if (error) throw new Error(error.message)
  },
}
