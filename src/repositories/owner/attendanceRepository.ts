// LAYER: Repository
// RULE: Supabase queries only. No business logic.

import { supabase } from '@/lib/supabase'
import {
  AttendanceRecord,
  AttendanceRecordUpdate,
  ShiftSwapRequest,
  TimeOffRequest,
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

  async getUsersByIds(ids: string[]): Promise<Array<{ id: string; full_name: string; role: string }>> {
    if (ids.length === 0) return []
    const { data, error } = await supabase
      .from('users')
      .select('id, full_name, role')
      .in('id', ids)
    if (error) throw new Error(error.message)
    return (data ?? []) as Array<{ id: string; full_name: string; role: string }>
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

  async getTimeOffRequestsByCompany(company_id: string): Promise<TimeOffRequest[]> {
    const { data, error } = await supabase
      .from('time_off_requests')
      .select('*')
      .eq('company_id', company_id)
      .order('created_at', { ascending: false })
    if (error) throw new Error(error.message)
    return (data ?? []) as TimeOffRequest[]
  },

  async updateTimeOffRequest(
    id: string,
    fields: Pick<TimeOffRequest, 'status' | 'reviewed_by' | 'reviewed_at'>,
  ): Promise<TimeOffRequest> {
    const { data, error } = await supabase
      .from('time_off_requests')
      .update(fields)
      .eq('id', id)
      .select()
      .single()
    if (error) throw new Error(error.message)
    return data as TimeOffRequest
  },

  async getShiftSwapRequestsByCompany(company_id: string): Promise<ShiftSwapRequest[]> {
    const { data, error } = await supabase
      .from('shift_swap_requests')
      .select('*')
      .eq('company_id', company_id)
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
    fields: Pick<ShiftSwapRequest, 'status' | 'reviewed_by' | 'reviewed_at'>,
  ): Promise<ShiftSwapRequest> {
    const { data, error } = await supabase
      .from('shift_swap_requests')
      .update(fields)
      .eq('id', id)
      .select()
      .single()
    if (error) throw new Error(error.message)
    return data as ShiftSwapRequest
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
}
