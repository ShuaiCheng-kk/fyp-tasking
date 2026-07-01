// LAYER: Repository
// RULE: Supabase queries only. No business logic.

import { supabase } from '@/lib/supabase'
import {
  AttendanceRecord,
  AttendanceRecordUpdate,
  FixedOffDayRequest,
  ShiftSwapRequest,
} from '@/types/Attendance'
import { Shift } from '@/types/Shift'
import { ShiftAssignment } from '@/types/ShiftAssignment'

type AssignmentWithShift = ShiftAssignment & { shifts: Shift | null }

export const attendanceRepository = {
  async getAssignmentsByCompany(company_id: string): Promise<AssignmentWithShift[]> {
    const { data, error } = await supabase
      .from('shift_assignments')
      .select('*, shifts!inner(*)')
      .eq('shifts.company_id', company_id)
      .order('created_at', { ascending: false })
    if (error) throw new Error(error.message)
    return (data ?? []) as AssignmentWithShift[]
  },

  // UC50/UC51 — Today's ratio + the Past Attendance Record calendar both need assignments
  // scoped to a date window (today only, or a full month) rather than the company's entire
  // history that getAssignmentsByCompany returns.
  async getAssignmentsByCompanyAndDateRange(company_id: string, from_date: string, to_date: string): Promise<AssignmentWithShift[]> {
    const { data, error } = await supabase
      .from('shift_assignments')
      .select('*, shifts!inner(*)')
      .eq('shifts.company_id', company_id)
      .gte('shifts.shift_date', from_date)
      .lte('shifts.shift_date', to_date)
      .order('created_at', { ascending: false })
    if (error) throw new Error(error.message)
    return (data ?? []) as AssignmentWithShift[]
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

  async getAttendanceRecordById(id: string): Promise<AttendanceRecord | null> {
    const { data, error } = await supabase
      .from('attendance_records')
      .select('*')
      .eq('id', id)
      .maybeSingle()
    if (error) throw new Error(error.message)
    return (data as AttendanceRecord | null) ?? null
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

  async getUsersByIds(ids: string[]): Promise<Array<{ id: string; full_name: string; role: string; profile_photo_url: string | null; worker_status: string | null; hourly_rate: number | null }>> {
    if (ids.length === 0) return []
    const { data, error } = await supabase
      .from('users')
      .select('id, full_name, role, profile_photo_url, worker_status, hourly_rate')
      .in('id', ids)
    if (error) throw new Error(error.message)
    return (data ?? []) as Array<{ id: string; full_name: string; role: string; profile_photo_url: string | null; worker_status: string | null; hourly_rate: number | null }>
  },

  async getDepartmentsByIds(ids: string[]): Promise<Array<{ id: string; name: string }>> {
    if (ids.length === 0) return []
    const { data, error } = await supabase
      .from('departments')
      .select('id, name')
      .in('id', ids)
    if (error) throw new Error(error.message)
    return (data ?? []) as Array<{ id: string; name: string }>
  },

  async getShiftSwapRequestsByCompany(company_id: string): Promise<ShiftSwapRequest[]> {
    const { data, error } = await supabase
      .from('shift_swap_requests')
      .select('*')
      .eq('company_id', company_id)
      .eq('counterpart_status', 'approved')
      .order('created_at', { ascending: false })
    if (error) throw new Error(error.message)
    return (data ?? []) as ShiftSwapRequest[]
  },

  async getShiftSwapRequestById(id: string): Promise<ShiftSwapRequest | null> {
    const { data, error } = await supabase
      .from('shift_swap_requests')
      .select('*')
      .eq('id', id)
      .maybeSingle()
    if (error) throw new Error(error.message)
    return (data as ShiftSwapRequest | null) ?? null
  },

  async updateShiftSwapRequest(
    id: string,
    fields: Partial<Pick<ShiftSwapRequest, 'status' | 'reviewed_by' | 'reviewed_at' | 'counterpart_status' | 'counterpart_reviewed_at' | 'ai_recommendation' | 'ai_reason'>>,
  ): Promise<ShiftSwapRequest> {
    const { data, error } = await supabase
      .from('shift_swap_requests')
      .update({ ...fields, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()
    if (error) throw new Error(error.message)
    return data as ShiftSwapRequest
  },

  async getPendingSwapRequestsByAssignment(assignment_id: string): Promise<ShiftSwapRequest[]> {
    const { data, error } = await supabase
      .from('shift_swap_requests')
      .select('*')
      .or(`requester_assignment_id.eq.${assignment_id},counterpart_assignment_id.eq.${assignment_id}`)
      .eq('status', 'pending')
    if (error) throw new Error(error.message)
    return (data ?? []) as ShiftSwapRequest[]
  },

  async getAssignmentsByUserDateRange(user_id: string, from_date: string, to_date: string): Promise<AssignmentWithShift[]> {
    const { data, error } = await supabase
      .from('shift_assignments')
      .select('*, shifts!inner(*)')
      .eq('user_id', user_id)
      .gte('shifts.shift_date', from_date)
      .lte('shifts.shift_date', to_date)
    if (error) throw new Error(error.message)
    return (data ?? []) as AssignmentWithShift[]
  },

  async getTasksByShiftAssignment(assignment_id: string): Promise<Array<{ id: string; title: string; status: string }>> {
    // Tasks link to a shift via shift_id, not shift_assignment_id.
    // Resolve assignment → shift_id first, then query tasks.
    const { data: assignment, error: aErr } = await supabase
      .from('shift_assignments')
      .select('shift_id')
      .eq('id', assignment_id)
      .maybeSingle()
    if (aErr) throw new Error(aErr.message)
    if (!assignment?.shift_id) return []

    const { data, error } = await supabase
      .from('tasks')
      .select('id, title, status')
      .eq('shift_id', assignment.shift_id)
      .is('parent_task_id', null)
    if (error) throw new Error(error.message)
    return (data ?? []) as Array<{ id: string; title: string; status: string }>
  },

  async updateShiftAssignmentUser(assignment_id: string, user_id: string): Promise<ShiftAssignment> {
    const { data, error } = await supabase
      .from('shift_assignments')
      .update({ user_id, updated_at: new Date().toISOString() })
      .eq('id', assignment_id)
      .select()
      .single()
    if (error) throw new Error(error.message)
    return data as ShiftAssignment
  },

  async getFixedOffDayRequestsByCompany(company_id: string): Promise<FixedOffDayRequest[]> {
    const { data, error } = await supabase
      .from('employee_fixed_off_days')
      .select('id, user_id, company_id, weekday, status, reviewed_by, reviewed_at, created_at')
      .eq('company_id', company_id)
      .order('created_at', { ascending: false })
    if (error) throw new Error(error.message)
    return (data ?? []) as FixedOffDayRequest[]
  },

  async getFixedOffDayRequestById(id: string): Promise<FixedOffDayRequest | null> {
    const { data, error } = await supabase
      .from('employee_fixed_off_days')
      .select('id, user_id, company_id, weekday, status, reviewed_by, reviewed_at, created_at')
      .eq('id', id)
      .maybeSingle()
    if (error) throw new Error(error.message)
    return (data as FixedOffDayRequest | null) ?? null
  },

  async updateFixedOffDayRequest(
    id: string,
    fields: Pick<FixedOffDayRequest, 'status' | 'reviewed_by' | 'reviewed_at'>,
  ): Promise<FixedOffDayRequest> {
    const { data, error } = await supabase
      .from('employee_fixed_off_days')
      .update(fields)
      .eq('id', id)
      .select('id, user_id, company_id, weekday, status, reviewed_by, reviewed_at, created_at')
      .single()
    if (error) throw new Error(error.message)
    return data as FixedOffDayRequest
  },

  async createShiftSwapRequest(input: {
    company_id: string
    requester_id: string
    requester_assignment_id: string
    counterpart_id: string
    counterpart_assignment_id: string
    reason: string | null
  }): Promise<ShiftSwapRequest> {
    const { data, error } = await supabase
      .from('shift_swap_requests')
      .insert({ ...input, status: 'pending', counterpart_status: 'pending' })
      .select()
      .single()
    if (error) throw new Error(error.message)
    return data as ShiftSwapRequest
  },

  async createFixedOffDayRequest(input: {
    user_id: string
    company_id: string
    weekday: number
  }): Promise<FixedOffDayRequest> {
    const { data, error } = await supabase
      .from('employee_fixed_off_days')
      .insert({ ...input, status: 'pending' })
      .select('id, user_id, company_id, weekday, status, reviewed_by, reviewed_at, created_at')
      .single()
    if (error) throw new Error(error.message)
    return data as FixedOffDayRequest
  },

  async getShiftSwapRequestsByUser(user_id: string): Promise<ShiftSwapRequest[]> {
    const { data, error } = await supabase
      .from('shift_swap_requests')
      .select('*')
      .or(`requester_id.eq.${user_id},counterpart_id.eq.${user_id}`)
      .order('created_at', { ascending: false })
    if (error) throw new Error(error.message)
    return (data ?? []) as ShiftSwapRequest[]
  },

  async getFixedOffDayRequestsByUser(user_id: string): Promise<FixedOffDayRequest[]> {
    const { data, error } = await supabase
      .from('employee_fixed_off_days')
      .select('id, user_id, company_id, weekday, status, reviewed_by, reviewed_at, created_at')
      .eq('user_id', user_id)
      .order('created_at', { ascending: false })
    if (error) throw new Error(error.message)
    return (data ?? []) as FixedOffDayRequest[]
  },

  async getShiftAssignmentById(assignment_id: string): Promise<AssignmentWithShift | null> {
    const { data, error } = await supabase
      .from('shift_assignments')
      .select('*, shifts!inner(*)')
      .eq('id', assignment_id)
      .maybeSingle()
    if (error) throw new Error(error.message)
    return (data as AssignmentWithShift | null) ?? null
  },

  async getAssignmentsByUserAndDate(user_id: string, shift_date: string): Promise<AssignmentWithShift[]> {
    const { data, error } = await supabase
      .from('shift_assignments')
      .select('*, shifts!inner(*)')
      .eq('user_id', user_id)
      .eq('shifts.shift_date', shift_date)
    if (error) throw new Error(error.message)
    return (data ?? []) as AssignmentWithShift[]
  },

  async getFixedOffDaysByCompanyAndWeekday(company_id: string, weekday: number): Promise<FixedOffDayRequest[]> {
    const { data, error } = await supabase
      .from('employee_fixed_off_days')
      .select('id, user_id, company_id, weekday, status, reviewed_by, reviewed_at, created_at')
      .eq('company_id', company_id)
      .eq('weekday', weekday)
      .in('status', ['pending', 'approved'])
    if (error) throw new Error(error.message)
    return (data ?? []) as FixedOffDayRequest[]
  },

  async getUserCompanyId(user_id: string): Promise<string | null> {
    const { data, error } = await supabase
      .from('users')
      .select('company_id')
      .eq('id', user_id)
      .maybeSingle()
    if (error) throw new Error(error.message)
    return (data as { company_id: string | null } | null)?.company_id ?? null
  },

  async getAssignmentsByDeptAndDate(department_id: string, shift_date: string): Promise<AssignmentWithShift[]> {
    const { data, error } = await supabase
      .from('shift_assignments')
      .select('*, shifts!inner(*)')
      .eq('shifts.department_id', department_id)
      .eq('shifts.shift_date', shift_date)
    if (error) throw new Error(error.message)
    return (data ?? []) as AssignmentWithShift[]
  },

  async getApprovedFixedOffDaysByDept(company_id: string, department_id: string): Promise<Array<{ user_id: string; weekday: number }>> {
    const { data: members, error: memberError } = await supabase
      .from('employee_departments')
      .select('employee_id')
      .eq('department_id', department_id)
    if (memberError) throw new Error(memberError.message)
    const employeeIds = (members ?? []).map((m: { employee_id: string }) => m.employee_id)
    if (employeeIds.length === 0) return []
    const { data, error } = await supabase
      .from('employee_fixed_off_days')
      .select('user_id, weekday')
      .eq('company_id', company_id)
      .in('user_id', employeeIds)
      .eq('status', 'approved')
    if (error) throw new Error(error.message)
    return (data ?? []) as Array<{ user_id: string; weekday: number }>
  },
}
