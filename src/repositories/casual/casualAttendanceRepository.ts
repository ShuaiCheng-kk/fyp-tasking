import { supabase } from '@/lib/supabase'
import { AttendanceRecord, AttendanceRecordCreate, AttendanceRecordUpdate } from '@/types/Attendance'
import { Shift } from '@/types/Shift'
import { ShiftAssignment } from '@/types/ShiftAssignment'

type AssignmentWithShift = ShiftAssignment & { shifts: Shift | null }

export const casualAttendanceRepository = {
  async getUserByAuthId(authId: string): Promise<{ id: string; full_name: string; role: string } | null> {
    const { data, error } = await supabase
      .from('users')
      .select('id, full_name, role')
      .or(`supabase_auth_id.eq.${authId},id.eq.${authId}`)
      .eq('role', 'Casual Worker')
      .maybeSingle()

    if (error) throw error
    return data
  },

  // Every shift assignment for this worker, most recent first — the Attendance page's history.
  // The service keeps only the ones with an attendance record (clocked in or fully clocked out).
  async getHistoryAssignments(userId: string): Promise<{
    id: string
    supervisor_employee_id: string | null
    shift: {
      id: string
      shift_date: string
      start_time: string
      end_time: string
      is_open_ended: boolean
      source_job_posting_id: string | null
      hourly_rate: number | null
    }
  }[]> {
    const { data, error } = await supabase
      .from('shift_assignments')
      .select('id, supervisor_employee_id, shifts!inner(id, shift_date, start_time, end_time, is_open_ended, source_job_posting_id, hourly_rate)')
      .eq('user_id', userId)
      .order('shift_date', { referencedTable: 'shifts', ascending: false })
    if (error) throw new Error(error.message)
    return (data ?? []).map(row => {
      const r = row as unknown as { id: string; supervisor_employee_id: string | null; shifts: never }
      return { id: r.id, supervisor_employee_id: r.supervisor_employee_id, shift: r.shifts }
    })
  },

  async getJobPostingsByIds(ids: string[]): Promise<{ id: string; title: string; company_name: string | null; location: string | null; created_by: string | null }[]> {
    if (ids.length === 0) return []
    // job_postings has no location column of its own — pull it from the companies join instead
    // (same fix as casualDashboardRepository.getJobPostingsByIds — see that file for the schema-drift note).
    const { data, error } = await supabase.from('job_postings').select('id, title, created_by, companies(name, location)').in('id', ids)
    if (error) throw new Error(error.message)
    return (data ?? []).map((row: any) => {
      const { companies, ...rest } = row
      const co = Array.isArray(companies) ? companies[0] : companies
      return { ...rest, company_name: co?.name ?? null, location: co?.location ?? null }
    })
  },

  async getUsersByIds(ids: string[]): Promise<{ id: string; full_name: string; role: string; phone_number: string | null; email_address: string | null; profile_photo_url: string | null }[]> {
    if (ids.length === 0) return []
    const { data, error } = await supabase.from('users').select('id, full_name, role, phone_number, email_address, profile_photo_url').in('id', ids)
    if (error) throw new Error(error.message)
    return data ?? []
  },

  // Completed tasks this worker did on the given shifts — the Attendance detail's "what I
  // actually delivered" list. Covers both single-assignee tasks (assigned_user_id) and
  // multi-assignee ones (task_assignments rows).
  async getCompletedTasksByShiftIds(shiftIds: string[], userId: string): Promise<{ id: string; shift_id: string | null; title: string }[]> {
    if (shiftIds.length === 0) return []
    const { data, error } = await supabase
      .from('tasks')
      .select('id, shift_id, title, assigned_user_id')
      .in('shift_id', shiftIds)
      .eq('status', 'Complete')
      .eq('is_archived', false)
    if (error) throw new Error(error.message)
    const tasks = (data ?? []) as { id: string; shift_id: string | null; title: string; assigned_user_id: string | null }[]

    const otherIds = tasks.filter(t => t.assigned_user_id !== userId).map(t => t.id)
    const assignedTaskIds = new Set<string>()
    if (otherIds.length > 0) {
      const { data: assignments, error: assignError } = await supabase
        .from('task_assignments')
        .select('task_id')
        .in('task_id', otherIds)
        .eq('user_id', userId)
      if (assignError) throw new Error(assignError.message)
      for (const row of assignments ?? []) assignedTaskIds.add(row.task_id as string)
    }

    return tasks
      .filter(t => t.assigned_user_id === userId || assignedTaskIds.has(t.id))
      .map(({ id, shift_id, title }) => ({ id, shift_id, title }))
  },

  async getUpcomingAssignments(userId: string, fromDate: string): Promise<AssignmentWithShift[]> {
    const { data, error } = await supabase
      .from('shift_assignments')
      .select('*, shifts!inner(*)')
      .eq('user_id', userId)
      .gte('shifts.shift_date', fromDate)
      .eq('shifts.publication_status', 'published')
      .order('created_at', { ascending: false })
    if (error) throw new Error(error.message)
    return (data ?? []) as AssignmentWithShift[]
  },

  async getAssignmentById(id: string): Promise<AssignmentWithShift | null> {
    const { data, error } = await supabase
      .from('shift_assignments')
      .select('*, shifts!inner(*)')
      .eq('id', id)
      .maybeSingle()
    if (error) throw new Error(error.message)
    return (data as AssignmentWithShift | null) ?? null
  },

  // A company can ban a Casual Worker per-company (casualWorkerStatusService, Team page) — the same
  // worker can be banned by one company and stay active for another. Used to stop them clocking into
  // a shift for a company that's since banned them, without touching their access to other companies.
  async isBannedByCompany(casual_worker_id: string, company_id: string): Promise<boolean> {
    const { data, error } = await supabase
      .from('casualworker_departments')
      .select('inactive_at')
      .eq('casual_worker_id', casual_worker_id)
      .eq('company_id', company_id)
      .not('inactive_at', 'is', null)
      .maybeSingle()
    if (error) throw new Error(error.message)
    return !!data
  },

  async getAttendanceRecordsByAssignmentIds(assignmentIds: string[]): Promise<AttendanceRecord[]> {
    if (assignmentIds.length === 0) return []
    const { data, error } = await supabase
      .from('attendance_records')
      .select('*')
      .in('shift_assignment_id', assignmentIds)
    if (error) throw new Error(error.message)
    return (data ?? []) as AttendanceRecord[]
  },

  // shift_assignment_id is unique on attendance_records, so at most one row can ever match.
  async getAttendanceRecordByAssignmentId(assignmentId: string): Promise<AttendanceRecord | null> {
    const { data, error } = await supabase
      .from('attendance_records')
      .select('*')
      .eq('shift_assignment_id', assignmentId)
      .maybeSingle()
    if (error) throw new Error(error.message)
    return (data as AttendanceRecord | null) ?? null
  },

  async createAttendanceRecord(input: AttendanceRecordCreate): Promise<AttendanceRecord> {
    const { data, error } = await supabase
      .from('attendance_records')
      .insert({
        shift_assignment_id: input.shift_assignment_id,
        user_id: input.user_id,
        clock_in_time: input.clock_in_time,
        clock_out_time: input.clock_out_time ?? null,
      })
      .select()
      .single()
    if (error) throw new Error(error.message)
    return data as AttendanceRecord
  },

  async updateAttendanceRecord(id: string, fields: AttendanceRecordUpdate): Promise<AttendanceRecord> {
    const { data, error } = await supabase
      .from('attendance_records')
      .update(fields)
      .eq('id', id)
      .select()
      .single()
    if (error) throw new Error(error.message)
    return data as AttendanceRecord
  },

  // Proof the worker actually showed up and did the job — the only thing that promotes them into
  // the company's verified Casual Worker pool. No-op after the first clock-out (verified_at stays).
  async markCasualWorkerDepartmentVerified(casual_worker_id: string, department_id: string): Promise<void> {
    const { error } = await supabase
      .from('casualworker_departments')
      .update({ verified_at: new Date().toISOString() })
      .eq('casual_worker_id', casual_worker_id)
      .eq('department_id', department_id)
      .is('verified_at', null)
    if (error) throw new Error(error.message)
  },
}
