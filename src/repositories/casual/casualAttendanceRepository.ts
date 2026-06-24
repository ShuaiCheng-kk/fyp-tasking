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

  async getAttendanceRecordsByAssignmentIds(assignmentIds: string[]): Promise<AttendanceRecord[]> {
    if (assignmentIds.length === 0) return []
    const { data, error } = await supabase
      .from('attendance_records')
      .select('*')
      .in('shift_assignment_id', assignmentIds)
      .order('created_at', { ascending: false })
    if (error) throw new Error(error.message)
    return (data ?? []) as AttendanceRecord[]
  },

  async getAttendanceRecordByAssignmentId(assignmentId: string): Promise<AttendanceRecord | null> {
    const { data, error } = await supabase
      .from('attendance_records')
      .select('*')
      .eq('shift_assignment_id', assignmentId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (error) throw new Error(error.message)
    return (data as AttendanceRecord | null) ?? null
  },

  async createAttendanceRecord(input: AttendanceRecordCreate): Promise<AttendanceRecord> {
    const { data, error } = await supabase
      .from('attendance_records')
      .insert({
        shift_assignment_id: input.shift_assignment_id,
        casual_worker_id: input.casual_worker_id,
        clock_in_time: input.clock_in_time,
        clock_out_time: input.clock_out_time ?? null,
        confirmed_by_employee_id: input.confirmed_by_employee_id,
        submitted_by_employee_id: input.submitted_by_employee_id,
        status: input.status,
        employee_notes: input.employee_notes ?? null,
        manager_notes: input.manager_notes ?? null,
        owner_status: input.owner_status ?? 'pending',
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
}
