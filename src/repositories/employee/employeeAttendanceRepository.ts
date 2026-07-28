import { supabase } from '@/lib/supabase'
import { AttendanceRecord, AttendanceRecordCreate, AttendanceRecordUpdate } from '@/types/Attendance'
import { Shift } from '@/types/Shift'
import { ShiftAssignment } from '@/types/ShiftAssignment'

type AssignmentWithShift = ShiftAssignment & { shifts: Shift | null }

export const employeeAttendanceRepository = {
  // Manager and Employee are both scheduled internal staff (CLAUDE.md: Manager ⊇ Employee) —
  // both clock in/out against their own shift_assignments row the same way, so this repository
  // (despite the "employee" name) is shared by both roles' clock-in/out flow.
  async getUserByAuthId(authId: string): Promise<{ id: string; full_name: string; role: string } | null> {
    const { data, error } = await supabase
      .from('users')
      .select('id, full_name, role')
      .or(`supabase_auth_id.eq.${authId},id.eq.${authId}`)
      .maybeSingle()
    if (error) throw error
    return data
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
        break_in_time: input.break_in_time ?? null,
        break_out_time: input.break_out_time ?? null,
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

  async getAttendanceRecords(auth_user_id: string) {
    // Resolve internal user id from auth id
    const { data: user, error: userErr } = await supabase
      .from('users')
      .select('id')
      .eq('supabase_auth_id', auth_user_id)
      .single()

    // Fall back: treat auth_user_id as internal id if lookup fails
    const internalId = user?.id ?? auth_user_id

    const { data, error } = await supabase
      .from('attendance_records')
      .select(`
        id,
        shift_assignment_id,
        clock_in_time,
        clock_out_time,
        shift_assignments!inner (
          id,
          user_id,
          shifts!inner (
            id,
            shift_date,
            start_time,
            end_time,
            departments ( name )
          )
        )
      `)
      .eq('shift_assignments.user_id', internalId)
      .order('created_at', { ascending: false })

    if (error) throw new Error(error.message)

    return (data ?? []).map((row: any) => {
      const assignment = row.shift_assignments
      const shift      = assignment?.shifts
      const dept       = shift?.departments

      return {
        id:                  row.id,
        shift_assignment_id: row.shift_assignment_id ?? assignment?.id ?? '',
        shift_id:            shift?.id ?? '',
        shift_title:         'Shift',
        shift_date:          shift?.shift_date ?? '',
        start_time:          shift?.start_time ?? '',
        end_time:            shift?.end_time ?? '',
        clock_in_time:       row.clock_in_time ?? null,
        clock_out_time:      row.clock_out_time ?? null,
        department_name:     dept?.name ?? null,
      }
    })
  },

  // Upcoming/today shift assignments for "My Shift" clock in/out — same shape as the casual
  // worker equivalent (casualAttendanceRepository.getUpcomingAssignments).
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

  // Casual Workers this Employee supervises who are clocked in to a one-off (open-ended) job and
  // waiting for their clock-out to be released — see casualAttendanceService.clockOut.
  async getPendingClockOutReleases(employeeId: string): Promise<{
    id: string
    user_id: string
    clock_in_time: string | null
    source_job_posting_id: string | null
    shift_date: string
    start_time: string
  }[]> {
    const { data, error } = await supabase
      .from('attendance_records')
      .select('id, user_id, clock_in_time, shift_assignments!inner(supervisor_employee_id, shifts!inner(shift_date, start_time, is_open_ended, source_job_posting_id))')
      .eq('shift_assignments.supervisor_employee_id', employeeId)
      .eq('shift_assignments.shifts.is_open_ended', true)
      .not('clock_in_time', 'is', null)
      .is('clock_out_time', null)
      .eq('clock_out_released', false)
    if (error) throw new Error(error.message)
    return (data ?? []).map((row: any) => ({
      id: row.id,
      user_id: row.user_id,
      clock_in_time: row.clock_in_time,
      source_job_posting_id: row.shift_assignments?.shifts?.source_job_posting_id ?? null,
      shift_date: row.shift_assignments?.shifts?.shift_date ?? '',
      start_time: row.shift_assignments?.shifts?.start_time ?? '',
    }))
  },

  async getJobPostingsByIds(ids: string[]): Promise<{ id: string; title: string }[]> {
    if (ids.length === 0) return []
    const { data, error } = await supabase.from('job_postings').select('id, title').in('id', ids)
    if (error) throw new Error(error.message)
    return data ?? []
  },

  async getAttendanceRecordWithSupervisor(id: string): Promise<(AttendanceRecord & {
    shift_assignments: { supervisor_employee_id: string | null; shifts: { is_open_ended: boolean } | null } | null
  }) | null> {
    const { data, error } = await supabase
      .from('attendance_records')
      .select('*, shift_assignments!inner(supervisor_employee_id, shifts!inner(is_open_ended))')
      .eq('id', id)
      .maybeSingle()
    if (error) throw new Error(error.message)
    return data as unknown as (AttendanceRecord & { shift_assignments: { supervisor_employee_id: string | null; shifts: { is_open_ended: boolean } | null } | null }) | null
  },

  async releaseClockOut(id: string): Promise<AttendanceRecord> {
    return this.updateAttendanceRecord(id, {
      clock_out_released: true,
    })
  },

  async getUsersByIds(ids: string[]): Promise<{ id: string; full_name: string }[]> {
    if (ids.length === 0) return []
    const { data, error } = await supabase.from('users').select('id, full_name').in('id', ids)
    if (error) throw new Error(error.message)
    return data ?? []
  },
}
