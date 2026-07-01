// LAYER: Repository
// RULE: Supabase queries only. No business logic.

import { supabase } from '@/lib/supabase'
import { AttendanceRequestStatus, ShiftSwapRequest, ShiftSwapRequestCreateInput } from '@/types/Attendance'

export type FixedOffDay = {
  id: string
  user_id: string
  company_id: string
  weekday: number
  status: AttendanceRequestStatus
  reviewed_by: string | null
  reviewed_at: string | null
}

export type LeaveRequest = {
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

type BreakWaiverCreateInput = {
  user_id: string
  company_id: string
  request_type: 'break_waiver'
  reason: string | null
  shift_assignment_id: string | null
}

export const availabilityRepository = {
  async getFixedOffDaysByUser(user_id: string): Promise<FixedOffDay[]> {
    const { data, error } = await supabase
      .from('employee_fixed_off_days')
      .select('id, user_id, company_id, weekday, status, reviewed_by, reviewed_at')
      .eq('user_id', user_id)
    if (error) throw new Error(error.message)
    return (data ?? []) as FixedOffDay[]
  },

  // UC55: submitting fixed days off no longer takes effect immediately — it (re)submits
  // the full set as pending requests for the supervising role to approve (UC56).
  async setFixedOffDays(user_id: string, company_id: string, weekdays: number[]): Promise<void> {
    const { error: delError } = await supabase
      .from('employee_fixed_off_days')
      .delete()
      .eq('user_id', user_id)
      .eq('company_id', company_id)
    if (delError) throw new Error(delError.message)

    if (weekdays.length === 0) return

    const rows = weekdays.map(weekday => ({ user_id, company_id, weekday, status: 'pending' }))
    const { error: insError } = await supabase
      .from('employee_fixed_off_days')
      .insert(rows)
    if (insError) throw new Error(insError.message)
  },

  async getBreakWaiverRequestsByUser(user_id: string): Promise<LeaveRequest[]> {
    const { data, error } = await supabase
      .from('time_off_requests')
      .select('id, company_id, requester_id, shift_assignment_id, request_type, reason, status, reviewed_by, reviewed_at, created_at, updated_at')
      .eq('requester_id', user_id)
      .eq('request_type', 'break_waiver')
      .order('created_at', { ascending: false })
    if (error) throw new Error(error.message)
    return (data ?? []) as LeaveRequest[]
  },

  async createBreakWaiverRequest(input: BreakWaiverCreateInput): Promise<LeaveRequest> {
    const { data, error } = await supabase
      .from('time_off_requests')
      .insert({
        company_id: input.company_id,
        requester_id: input.user_id,
        shift_assignment_id: input.shift_assignment_id ?? null,
        request_type: input.request_type,
        reason: input.reason,
        status: 'pending',
      })
      .select('id, company_id, requester_id, shift_assignment_id, request_type, reason, status, reviewed_by, reviewed_at, created_at, updated_at')
      .single()
    if (error) throw new Error(error.message)
    return data as LeaveRequest
  },

  async createShiftSwapRequest(input: ShiftSwapRequestCreateInput): Promise<ShiftSwapRequest> {
    const { data, error } = await supabase
      .from('shift_swap_requests')
      .insert({
        company_id: input.company_id,
        requester_id: input.requester_id,
        requester_assignment_id: input.requester_assignment_id,
        counterpart_id: input.counterpart_id,
        counterpart_assignment_id: input.counterpart_assignment_id,
        reason: input.reason,
        status: 'pending',
        counterpart_status: 'pending',
      })
      .select()
      .single()
    if (error) throw new Error(error.message)
    return data as ShiftSwapRequest
  },
}
