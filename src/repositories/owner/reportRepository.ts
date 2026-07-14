// LAYER: Repository
// RULE: Supabase queries only. No business logic.

import { supabase } from '@/lib/supabase'
import { AttendanceRecord } from '@/types/Attendance'
import { Shift } from '@/types/Shift'
import { ShiftAssignment } from '@/types/ShiftAssignment'
import { Task } from '@/types/Task'
import { ReportFilters } from '@/types/Report'

export interface ReportUserRow {
  id: string
  full_name: string
  role: string
  hourly_rate: number | null
  skills: string | null
}

export interface ReportDepartmentManagerRow {
  department_id: string
  manager_name: string
}

export interface ReportJobPostingRow {
  id: string
  title: string
  department_id: string | null
  status: string
  openings: number | null
  created_at: string
}

export interface ReportApplicantRow {
  id: string
  job_id: string
  status: string
}

export interface ReportInvitationRow {
  job_id: string
  applicant_id: string
  status: string
  sent_at: string
  responded_at: string | null
}

export const reportRepository = {
  async getDepartments(company_id: string): Promise<Array<{ id: string; name: string }>> {
    const { data, error } = await supabase
      .from('departments')
      .select('id, name')
      .eq('company_id', company_id)
    if (error) throw new Error(error.message)
    return (data ?? []) as Array<{ id: string; name: string }>
  },

  async getDepartmentManagers(company_id: string): Promise<ReportDepartmentManagerRow[]> {
    const { data, error } = await supabase
      .from('manager_departments')
      .select('department_id, users!manager_departments_manager_id_fkey!inner(full_name)')
      .eq('company_id', company_id)
    if (error) throw new Error(error.message)
    return (data ?? []).map(row => {
      const user = row.users as unknown as { full_name: string } | { full_name: string }[] | null
      const full_name = Array.isArray(user) ? user[0]?.full_name : user?.full_name
      return { department_id: row.department_id as string, manager_name: full_name ?? '' }
    }).filter(row => row.manager_name)
  },

  async getShifts(filters: ReportFilters): Promise<Shift[]> {
    let query = supabase
      .from('shifts')
      .select('*')
      .eq('company_id', filters.company_id)
      .gte('shift_date', filters.date_from)
      .lte('shift_date', filters.date_to)
      .order('shift_date', { ascending: false })
    if (filters.department_id) query = query.eq('department_id', filters.department_id)
    const { data, error } = await query
    if (error) throw new Error(error.message)
    return (data ?? []) as Shift[]
  },

  async getAssignmentsByShiftIds(shiftIds: string[]): Promise<ShiftAssignment[]> {
    if (shiftIds.length === 0) return []
    const { data, error } = await supabase
      .from('shift_assignments')
      .select('*')
      .in('shift_id', shiftIds)
    if (error) throw new Error(error.message)
    return (data ?? []) as ShiftAssignment[]
  },

  // Tasks belonging to the period: task_date inside the range, or — for tasks without a
  // task_date — created inside the range. Never filtered on created_at alone (a task created
  // earlier but scheduled for this period must count here).
  async getTasksInRange(filters: ReportFilters): Promise<Task[]> {
    let query = supabase
      .from('tasks')
      .select('*')
      .eq('company_id', filters.company_id)
      .or(
        `and(task_date.gte.${filters.date_from},task_date.lte.${filters.date_to}),` +
        `and(task_date.is.null,created_at.gte.${filters.date_from}T00:00:00,created_at.lte.${filters.date_to}T23:59:59)`
      )
    if (filters.department_id) query = query.eq('department_id', filters.department_id)
    const { data, error } = await query
    if (error) throw new Error(error.message)
    return (data ?? []) as Task[]
  },

  // On-time Task Completion Rate KPI (internal staff): fetched by a due_at window padded ±1 day
  // so the service can filter precisely by the task's LOCAL calendar deadline date (formatDateKey),
  // not by a UTC slice or by when the task was created.
  async getTasksByDeadlineRange(filters: ReportFilters): Promise<Task[]> {
    const pad = (dateStr: string, days: number) => {
      const d = new Date(`${dateStr}T00:00:00Z`)
      d.setUTCDate(d.getUTCDate() + days)
      return d.toISOString().slice(0, 10)
    }
    let query = supabase
      .from('tasks')
      .select('*')
      .eq('company_id', filters.company_id)
      .not('due_at', 'is', null)
      .gte('due_at', `${pad(filters.date_from, -1)}T00:00:00`)
      .lte('due_at', `${pad(filters.date_to, 1)}T23:59:59`)
    if (filters.department_id) query = query.eq('department_id', filters.department_id)
    const { data, error } = await query
    if (error) throw new Error(error.message)
    return (data ?? []) as Task[]
  },

  async getAttendanceByAssignmentIds(assignmentIds: string[]): Promise<AttendanceRecord[]> {
    if (assignmentIds.length === 0) return []
    const { data, error } = await supabase
      .from('attendance_records')
      .select('*')
      .in('shift_assignment_id', assignmentIds)
    if (error) throw new Error(error.message)
    return (data ?? []) as AttendanceRecord[]
  },

  // Rehire Rate KPI: of the given casual workers, which ones actually attended (clocked in on)
  // at least one non-rejected shift of this company dated BEFORE the period started.
  async getPriorAttendedCasualUserIds(company_id: string, user_ids: string[], before_date: string): Promise<string[]> {
    if (user_ids.length === 0) return []
    const { data, error } = await supabase
      .from('shift_assignments')
      .select('user_id, shifts!inner(id), attendance_records!inner(id)')
      .in('user_id', user_ids)
      .neq('assignment_status', 'rejected')
      .eq('shifts.company_id', company_id)
      .lt('shifts.shift_date', before_date)
      .not('attendance_records.clock_in_time', 'is', null)
    if (error) throw new Error(error.message)
    return [...new Set((data ?? []).map(row => row.user_id as string))]
  },

  async getUsersByIds(ids: string[]): Promise<ReportUserRow[]> {
    if (ids.length === 0) return []
    const { data, error } = await supabase
      .from('users')
      .select('id, full_name, role, hourly_rate, skills')
      .in('id', ids)
    if (error) throw new Error(error.message)
    return (data ?? []) as ReportUserRow[]
  },

  // "Rehire Count by Worker" chart: lifetime (all-time, not period-scoped) shifts a casual
  // worker has actually attended (clocked in AND out) for this company — same attendance-based
  // definition recruitmentRepository.getVerifiedPoolWorkers uses, but for an arbitrary id list
  // rather than only verified pool members.
  async getLifetimeCompletedShiftsByUserIds(company_id: string, user_ids: string[]): Promise<Array<{ user_id: string; completed_shifts: number }>> {
    if (user_ids.length === 0) return []
    const { data, error } = await supabase
      .from('attendance_records')
      .select('casual_worker_id, shift_assignments!inner(shifts!inner(company_id))')
      .in('casual_worker_id', user_ids)
      .not('clock_out_time', 'is', null)
      .eq('shift_assignments.shifts.company_id', company_id)
    if (error) throw new Error(error.message)
    const counts = new Map<string, number>()
    for (const row of (data ?? []) as Array<{ casual_worker_id: string }>) {
      counts.set(row.casual_worker_id, (counts.get(row.casual_worker_id) ?? 0) + 1)
    }
    return [...counts.entries()].map(([user_id, completed_shifts]) => ({ user_id, completed_shifts }))
  },

  // Postings that went live (drafts / pending-approval / rejected never reached applicants)
  // and were created inside the period.
  async getJobPostingsCreatedInRange(filters: ReportFilters): Promise<ReportJobPostingRow[]> {
    let query = supabase
      .from('job_postings')
      .select('id, title, department_id, status, openings, created_at')
      .eq('company_id', filters.company_id)
      .not('status', 'in', '("draft","pending_approval","rejected")')
      .gte('created_at', `${filters.date_from}T00:00:00`)
      .lte('created_at', `${filters.date_to}T23:59:59`)
      .order('created_at', { ascending: false })
    if (filters.department_id) query = query.eq('department_id', filters.department_id)
    const { data, error } = await query
    if (error) throw new Error(error.message)
    return (data ?? []) as ReportJobPostingRow[]
  },

  async getApplicantsByJobIds(jobIds: string[]): Promise<ReportApplicantRow[]> {
    if (jobIds.length === 0) return []
    const { data, error } = await supabase
      .from('job_applicants')
      .select('id, job_id, status')
      .in('job_id', jobIds)
    if (error) throw new Error(error.message)
    return (data ?? []) as ReportApplicantRow[]
  },

  async getInvitationsByJobIds(jobIds: string[]): Promise<ReportInvitationRow[]> {
    if (jobIds.length === 0) return []
    const { data, error } = await supabase
      .from('job_invitations')
      .select('job_id, applicant_id, status, sent_at, responded_at')
      .in('job_id', jobIds)
    if (error) throw new Error(error.message)
    return (data ?? []) as ReportInvitationRow[]
  },

  // ── LEGACY — only the old Partner/Manager report shape still uses these. ──
  // Delete together with reportService.getWorkforceAnalytics when they inherit
  // the new CompanyReport page.

  async getTasks(filters: ReportFilters): Promise<Task[]> {
    let query = supabase
      .from('tasks')
      .select('*')
      .eq('company_id', filters.company_id)
      .gte('created_at', `${filters.date_from}T00:00:00`)
      .lte('created_at', `${filters.date_to}T23:59:59`)
      .order('created_at', { ascending: false })
    if (filters.department_id) query = query.eq('department_id', filters.department_id)
    const { data, error } = await query
    if (error) throw new Error(error.message)
    return (data ?? []) as Task[]
  },

  async getTimeOffRequests(company_id: string, date_from: string, date_to: string): Promise<{ id: string; status: string }[]> {
    const { data, error } = await supabase
      .from('time_off_requests')
      .select('id, status')
      .eq('company_id', company_id)
      .gte('created_at', `${date_from}T00:00:00`)
      .lte('created_at', `${date_to}T23:59:59`)
    if (error) throw new Error(error.message)
    return (data ?? []) as { id: string; status: string }[]
  },

  async getSwapRequests(company_id: string, date_from: string, date_to: string): Promise<{ id: string; status: string }[]> {
    const { data, error } = await supabase
      .from('shift_swap_requests')
      .select('id, status')
      .eq('company_id', company_id)
      .gte('created_at', `${date_from}T00:00:00`)
      .lte('created_at', `${date_to}T23:59:59`)
    if (error) throw new Error(error.message)
    return (data ?? []) as { id: string; status: string }[]
  },
}
