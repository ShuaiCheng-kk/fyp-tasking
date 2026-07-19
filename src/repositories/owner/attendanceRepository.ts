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

export type TimeOffRequestRow = {
  id: string
  company_id: string
  requester_id: string
  shift_assignment_id: string | null
  request_type: string
  reason: string | null
  status: string
  reviewed_by: string | null
  reviewed_at: string | null
  created_at: string
  updated_at: string
}

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
    // No counterpart_status filter here — the service needs awaiting-counterpart rows too, to
    // lazily auto-expire them on read. It then hides them from the approval queues (the reviewer
    // only sees requests both parties have agreed on, plus decided ones for the Processed list).
    const { data, error } = await supabase
      .from('shift_swap_requests')
      .select('*')
      .eq('company_id', company_id)
      .order('created_at', { ascending: false })
    if (error) throw new Error(error.message)
    return (data ?? []) as ShiftSwapRequest[]
  },

  async getTimeOffRequestsByCompany(company_id: string): Promise<TimeOffRequestRow[]> {
    const { data, error } = await supabase
      .from('time_off_requests')
      .select('id, company_id, requester_id, shift_assignment_id, request_type, reason, status, reviewed_by, reviewed_at, created_at, updated_at')
      .eq('company_id', company_id)
      .order('created_at', { ascending: false })
    if (error) throw new Error(error.message)
    return (data ?? []) as TimeOffRequestRow[]
  },

  async getTimeOffRequestsByUser(user_id: string): Promise<TimeOffRequestRow[]> {
    const { data, error } = await supabase
      .from('time_off_requests')
      .select('id, company_id, requester_id, shift_assignment_id, request_type, reason, status, reviewed_by, reviewed_at, created_at, updated_at')
      .eq('requester_id', user_id)
      .order('created_at', { ascending: false })
    if (error) throw new Error(error.message)
    return (data ?? []) as TimeOffRequestRow[]
  },

  async updateTimeOffRequest(id: string, fields: Partial<Pick<TimeOffRequestRow, 'status' | 'reviewed_by' | 'reviewed_at'>>): Promise<TimeOffRequestRow> {
    const { data, error } = await supabase
      .from('time_off_requests')
      .update({ ...fields, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('id, company_id, requester_id, shift_assignment_id, request_type, reason, status, reviewed_by, reviewed_at, created_at, updated_at')
      .single()
    if (error) throw new Error(error.message)
    return data as TimeOffRequestRow
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
    fields: Partial<Pick<ShiftSwapRequest, 'status' | 'reviewed_by' | 'reviewed_at' | 'counterpart_status' | 'counterpart_reviewed_at' | 'requires_owner_review' | 'owner_review_reason'>>,
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

  // Movable tasks currently owned by this assignment's user on this shift — only 'Assigned' and
  // 'In Progress' truly transfer on a swap; 'Review' work is awaiting sign-off on what THIS person
  // did and 'Complete' is done, so both stay with the original owner. Non-archived only.
  // Top-level tasks only: sub-tasks travel with their parent on approval (reassignTasksForShiftSwap
  // moves them too) but are not listed as separate cards in the swap preview.
  async getMovableTasksByShiftAssignment(assignment_id: string): Promise<Array<{ id: string; title: string; description: string | null; status: string; priority: string | null; due_at: string | null; created_at: string }>> {
    const { data: assignment, error: aErr } = await supabase
      .from('shift_assignments')
      .select('shift_id, user_id')
      .eq('id', assignment_id)
      .maybeSingle()
    if (aErr) throw new Error(aErr.message)
    if (!assignment?.shift_id) return []

    const { data, error } = await supabase
      .from('tasks')
      .select('id, title, description, status, priority, due_at, created_at')
      .eq('shift_id', assignment.shift_id)
      .eq('assigned_user_id', assignment.user_id)
      .in('status', ['Assigned', 'In Progress'])
      .eq('is_archived', false)
      .is('parent_task_id', null)
    if (error) throw new Error(error.message)
    return (data ?? []) as Array<{ id: string; title: string; description: string | null; status: string; priority: string | null; due_at: string | null; created_at: string }>
  },

  // Batched counterpart of getTasksByShiftAssignment — one query across all shift_ids instead of
  // one round-trip per assignment. Caller groups the flat rows by shift_id.
  async getTasksByShiftIds(shift_ids: string[]): Promise<Array<{ id: string; title: string; status: string; shift_id: string }>> {
    if (shift_ids.length === 0) return []
    const { data, error } = await supabase
      .from('tasks')
      .select('id, title, status, shift_id')
      .in('shift_id', shift_ids)
      .is('parent_task_id', null)
    if (error) throw new Error(error.message)
    return (data ?? []) as Array<{ id: string; title: string; status: string; shift_id: string }>
  },

  // Batched counterpart of getMovableTasksByShiftAssignment — one query across all shift_ids;
  // caller filters/groups by (shift_id, assigned_user_id) per assignment.
  async getMovableTasksByShiftIds(shift_ids: string[]): Promise<Array<{ id: string; title: string; description: string | null; status: string; priority: string | null; due_at: string | null; created_at: string; shift_id: string; assigned_user_id: string | null }>> {
    if (shift_ids.length === 0) return []
    const { data, error } = await supabase
      .from('tasks')
      .select('id, title, description, status, priority, due_at, created_at, shift_id, assigned_user_id')
      .in('shift_id', shift_ids)
      .in('status', ['Assigned', 'In Progress'])
      .eq('is_archived', false)
      .is('parent_task_id', null)
    if (error) throw new Error(error.message)
    return (data ?? []) as Array<{ id: string; title: string; description: string | null; status: string; priority: string | null; due_at: string | null; created_at: string; shift_id: string; assigned_user_id: string | null }>
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

  async getOffDayRequestsByCompany(company_id: string): Promise<FixedOffDayRequest[]> {
    const { data, error } = await supabase
      .from('employee_off_day_requests')
      .select('id, user_id, company_id, request_date, week_start, status, source, reviewed_by, reviewed_at, created_at')
      .eq('company_id', company_id)
      .order('created_at', { ascending: false })
    if (error) throw new Error(error.message)
    return (data ?? []) as FixedOffDayRequest[]
  },

  async getFixedOffDayRequestById(id: string): Promise<FixedOffDayRequest | null> {
    const { data, error } = await supabase
      .from('employee_off_day_requests')
      .select('id, user_id, company_id, request_date, week_start, status, source, reviewed_by, reviewed_at, created_at')
      .eq('id', id)
      .maybeSingle()
    if (error) throw new Error(error.message)
    return (data as FixedOffDayRequest | null) ?? null
  },

  async getFixedOffDayRequestsByIds(ids: string[]): Promise<FixedOffDayRequest[]> {
    if (ids.length === 0) return []
    const { data, error } = await supabase
      .from('employee_off_day_requests')
      .select('id, user_id, company_id, request_date, week_start, status, source, reviewed_by, reviewed_at, created_at')
      .in('id', ids)
    if (error) throw new Error(error.message)
    return (data ?? []) as FixedOffDayRequest[]
  },

  async updateFixedOffDayRequest(
    id: string,
    fields: Partial<Pick<FixedOffDayRequest, 'status' | 'reviewed_by' | 'reviewed_at' | 'request_date'>>,
  ): Promise<FixedOffDayRequest> {
    const { data, error } = await supabase
      .from('employee_off_day_requests')
      .update(fields)
      .eq('id', id)
      .select('id, user_id, company_id, request_date, week_start, status, source, reviewed_by, reviewed_at, created_at')
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

  // Counts this user's SUCCESSFUL shift swaps (as either side) decided within [fromISO, toISO) —
  // used to enforce the Owner's monthly swap limit. Only approved swaps use up quota; rejected,
  // withdrawn, and auto-expired requests don't count (Owner-confirmed business rule). The window
  // filters on reviewed_at (when the swap actually succeeded), not created_at.
  async countApprovedShiftSwapsForUser(company_id: string, user_id: string, fromISO: string, toISO: string): Promise<number> {
    const { count, error } = await supabase
      .from('shift_swap_requests')
      .select('id', { count: 'exact', head: true })
      .eq('company_id', company_id)
      .eq('status', 'approved')
      .gte('reviewed_at', fromISO)
      .lt('reviewed_at', toISO)
      .or(`requester_id.eq.${user_id},counterpart_id.eq.${user_id}`)
    if (error) throw new Error(error.message)
    return count ?? 0
  },

  async createFixedOffDayRequests(input: {
    user_id: string
    company_id: string
    dates: string[]
    week_start: string
    source: 'submitted' | 'auto_assigned'
  }): Promise<FixedOffDayRequest[]> {
    const rows = input.dates.map(request_date => ({
      user_id: input.user_id,
      company_id: input.company_id,
      request_date,
      week_start: input.week_start,
      source: input.source,
      status: input.source === 'auto_assigned' ? 'approved' : 'pending',
      reviewed_by: input.source === 'auto_assigned' ? null : undefined,
      reviewed_at: input.source === 'auto_assigned' ? new Date().toISOString() : undefined,
    }))
    const { data, error } = await supabase
      .from('employee_off_day_requests')
      .insert(rows)
      .select('id, user_id, company_id, request_date, week_start, status, source, reviewed_by, reviewed_at, created_at')
    if (error) throw new Error(error.message)
    return (data ?? []) as FixedOffDayRequest[]
  },

  async deleteFixedOffDayRequestsByUserAndWeek(user_id: string, company_id: string, week_start: string, statuses: string[]): Promise<void> {
    const { error } = await supabase
      .from('employee_off_day_requests')
      .delete()
      .eq('user_id', user_id)
      .eq('company_id', company_id)
      .eq('week_start', week_start)
      .in('status', statuses)
    if (error) throw new Error(error.message)
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
      .from('employee_off_day_requests')
      .select('id, user_id, company_id, request_date, week_start, status, source, reviewed_by, reviewed_at, created_at')
      .eq('user_id', user_id)
      .order('created_at', { ascending: false })
    if (error) throw new Error(error.message)
    return (data ?? []) as FixedOffDayRequest[]
  },

  async getFixedOffDayRequestsByUserAndWeek(user_id: string, company_id: string, week_start: string): Promise<FixedOffDayRequest[]> {
    const { data, error } = await supabase
      .from('employee_off_day_requests')
      .select('id, user_id, company_id, request_date, week_start, status, source, reviewed_by, reviewed_at, created_at')
      .eq('user_id', user_id)
      .eq('company_id', company_id)
      .eq('week_start', week_start)
    if (error) throw new Error(error.message)
    return (data ?? []) as FixedOffDayRequest[]
  },

  async getOffDayRequestsByCompanyAndWeek(company_id: string, week_start: string): Promise<FixedOffDayRequest[]> {
    const { data, error } = await supabase
      .from('employee_off_day_requests')
      .select('id, user_id, company_id, request_date, week_start, status, source, reviewed_by, reviewed_at, created_at')
      .eq('company_id', company_id)
      .eq('week_start', week_start)
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

  async getShiftAssignmentsByIds(assignment_ids: string[]): Promise<AssignmentWithShift[]> {
    if (assignment_ids.length === 0) return []
    const { data, error } = await supabase
      .from('shift_assignments')
      .select('*, shifts!inner(*)')
      .in('id', assignment_ids)
    if (error) throw new Error(error.message)
    return (data ?? []) as AssignmentWithShift[]
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

  async getEmployeeIdsByDepartments(department_ids: string[]): Promise<string[]> {
    if (department_ids.length === 0) return []
    const { data, error } = await supabase
      .from('employee_departments')
      .select('employee_id')
      .in('department_id', department_ids)
    if (error) throw new Error(error.message)
    return [...new Set((data ?? []).map((m: { employee_id: string }) => m.employee_id))]
  },

  async getManagersByCompany(company_id: string): Promise<Array<{ id: string; full_name: string }>> {
    const { data, error } = await supabase
      .from('users')
      .select('id, full_name')
      .eq('company_id', company_id)
      .eq('role', 'Manager')
    if (error) throw new Error(error.message)
    return (data ?? []) as Array<{ id: string; full_name: string }>
  },

  async getEmployeesByCompany(company_id: string): Promise<Array<{ id: string; full_name: string; department_id: string | null }>> {
    const { data, error } = await supabase
      .from('users')
      .select('id, full_name, employee_departments(department_id)')
      .eq('company_id', company_id)
      .eq('role', 'Employee')
    if (error) throw new Error(error.message)
    return (data ?? []).map((row: any) => ({
      id: row.id,
      full_name: row.full_name,
      department_id: row.employee_departments?.[0]?.department_id ?? null,
    }))
  },

  async getScheduledHeadcountForDeptDate(company_id: string, department_id: string, date: string): Promise<{ managers: number; employees: number }> {
    const { data: shifts, error: shiftError } = await supabase
      .from('shifts')
      .select('id')
      .eq('company_id', company_id)
      .eq('department_id', department_id)
      .eq('shift_date', date)
    if (shiftError) throw new Error(shiftError.message)
    const shiftIds = (shifts ?? []).map((s: { id: string }) => s.id)
    if (shiftIds.length === 0) return { managers: 0, employees: 0 }

    const { data: assignments, error: assignError } = await supabase
      .from('shift_assignments')
      .select('user_id')
      .in('shift_id', shiftIds)
    if (assignError) throw new Error(assignError.message)
    const userIds = [...new Set((assignments ?? []).map((a: { user_id: string }) => a.user_id))]
    if (userIds.length === 0) return { managers: 0, employees: 0 }

    const { data: users, error: userError } = await supabase
      .from('users')
      .select('id, role')
      .in('id', userIds)
    if (userError) throw new Error(userError.message)
    const managers = (users ?? []).filter((u: { role: string }) => u.role === 'Manager').length
    const employees = (users ?? []).filter((u: { role: string }) => u.role === 'Employee').length
    return { managers, employees }
  },
}
