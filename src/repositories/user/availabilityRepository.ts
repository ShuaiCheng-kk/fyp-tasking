// LAYER: Repository
// RULE: Supabase queries only. No business logic.

import { supabase } from '@/lib/supabase'
import { ShiftSwapRequest, ShiftSwapRequestCreateInput, TimeOffRequestCreateInput } from '@/types/Attendance'

export type FixedOffDay = {
  user_id: string
  company_id: string
  weekday: number
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

export const availabilityRepository = {
  async getFixedOffDaysByUser(user_id: string): Promise<FixedOffDay[]> {
    const { data, error } = await supabase
      .from('employee_fixed_off_days')
      .select('user_id, company_id, weekday')
      .eq('user_id', user_id)
    if (error) throw new Error(error.message)
    return (data ?? []) as FixedOffDay[]
  },

  async setFixedOffDays(user_id: string, company_id: string, weekdays: number[]): Promise<void> {
    const { error: delError } = await supabase
      .from('employee_fixed_off_days')
      .delete()
      .eq('user_id', user_id)
      .eq('company_id', company_id)
    if (delError) throw new Error(delError.message)

    if (weekdays.length === 0) return

    const rows = weekdays.map(weekday => ({ user_id, company_id, weekday }))
    const { error: insError } = await supabase
      .from('employee_fixed_off_days')
      .insert(rows)
    if (insError) throw new Error(insError.message)
  },

  async getLeaveRequestsByUser(user_id: string): Promise<LeaveRequest[]> {
    const { data, error } = await supabase
      .from('time_off_requests')
      .select('id, company_id, requester_id, shift_assignment_id, request_type, reason, status, reviewed_by, reviewed_at, created_at, updated_at')
      .eq('requester_id', user_id)
      .order('created_at', { ascending: false })
    if (error) throw new Error(error.message)
    return (data ?? []) as LeaveRequest[]
  },

  async createLeaveRequest(input: TimeOffRequestCreateInput): Promise<LeaveRequest> {
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
        shift_assignment_id: input.shift_assignment_id,
        requester_id: input.requester_id,
        replacement_user_id: input.replacement_user_id,
        reason: input.reason,
        status: 'pending',
      })
      .select('id, company_id, shift_assignment_id, requester_id, replacement_user_id, reason, status, reviewed_by, reviewed_at, created_at, updated_at')
      .single()
    if (error) throw new Error(error.message)
    return data as ShiftSwapRequest
  },
}
