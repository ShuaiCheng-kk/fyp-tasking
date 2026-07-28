import { supabase } from '@/lib/supabase'
import { sgtTodayKey } from '@/lib/singaporeTime'

export const employeeDashboardRepository = {
  async getEmployeeDashboard(
    user_id: string
  ): Promise<{ company_id: string; company_name: string; department_id: string; department_name: string } | null> {
    const { data: user, error: userErr } = await supabase
      .from('users')
      .select('company_id, companies!users_company_id_fkey(name)')
      .eq('id', user_id)
      .single()

    if (userErr || !user?.company_id) return null

    const { data: empDept } = await supabase
      .from('employee_departments')
      .select('department_id')
      .eq('employee_id', user_id)
      .single()

    let department_name = ''
    if (empDept?.department_id) {
      const { data: dept } = await supabase
        .from('departments')
        .select('name')
        .eq('id', empDept.department_id)
        .single()
      department_name = dept?.name ?? ''
    }

    return {
      company_id: user.company_id,
      company_name: (user.companies as any)?.name ?? '',
      department_id: empDept?.department_id ?? '',
      department_name,
    }
  },

  // Casual Workers this Employee supervises TODAY (supervisor_employee_id on the CW's own
  // shift_assignment — the live mechanism also used by task assignment eligibility, the
  // clock-out release queue, and messaging contacts). Replaces the old assigned_cw_id lookup,
  // which pointed at a column on the Employee's OWN assignment row from before this mechanism
  // existed and was never kept in sync (dead per CLAUDE.md's stale-schema warning).
  async getSupervisedWorkersToday(employee_id: string, company_id: string) {
    // Shift dates are Singapore-nominal (see src/lib/singaporeTime) — "today" must be the
    // Singapore calendar day, not raw UTC, or this misses/mismatches shifts for ~8 hours a day.
    const today = sgtTodayKey()
    const { data, error } = await supabase
      .from('shift_assignments')
      .select(`
        id,
        user_id,
        shifts!inner (
          id,
          shift_date,
          start_time,
          end_time,
          is_open_ended,
          company_id,
          source_job_posting_id
        )
      `)
      .eq('supervisor_employee_id', employee_id)
      .eq('shifts.company_id', company_id)
      .eq('shifts.shift_date', today)

    if (error) throw new Error(error.message)

    const workerIds = [...new Set((data ?? []).map((row: any) => row.user_id))]
    const postingIds = [...new Set((data ?? []).map((row: any) => row.shifts?.source_job_posting_id).filter(Boolean))]
    const [{ data: workers }, { data: postings }] = await Promise.all([
      workerIds.length
        ? supabase.from('users').select('id, full_name, email_address, phone_number, profile_photo_url').in('id', workerIds)
        : Promise.resolve({ data: [] }),
      postingIds.length
        ? supabase.from('job_postings').select('id, title').in('id', postingIds)
        : Promise.resolve({ data: [] }),
    ])
    const workerMap = new Map(((workers ?? []) as any[]).map(w => [w.id, w]))
    const postingMap = new Map(((postings ?? []) as any[]).map(j => [j.id, j]))

    return (data ?? []).map((row: any) => {
      const worker = workerMap.get(row.user_id)
      const posting = row.shifts?.source_job_posting_id ? postingMap.get(row.shifts.source_job_posting_id) : null
      return {
        shift_assignment_id: row.id,
        id: row.user_id,
        full_name: worker?.full_name ?? 'Casual Worker',
        email_address: worker?.email_address ?? '',
        phone_number: worker?.phone_number ?? '',
        profile_photo_url: worker?.profile_photo_url ?? null,
        shift_id: row.shifts?.id ?? '',
        shift_title: posting?.title ?? 'Shift',
        start_time: row.shifts?.start_time ?? '',
        end_time: row.shifts?.end_time ?? '',
        is_open_ended: row.shifts?.is_open_ended ?? false,
      }
    })
  },
}