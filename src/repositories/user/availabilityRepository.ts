// LAYER: Repository
// RULE: Supabase queries only. No business logic.

import { supabase } from '@/lib/supabase'
import { ShiftSwapRequest, ShiftSwapRequestCreateInput } from '@/types/Attendance'

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

type LeaveRequestCreateInput = {
  user_id: string
  company_id: string
  request_type: 'time_off' | 'break_waiver' | 'leave'
  reason: string | null
  shift_assignment_id: string | null
}

export const availabilityRepository = {
  async getLeaveRequestsByUser(user_id: string): Promise<LeaveRequest[]> {
    const { data, error } = await supabase
      .from('time_off_requests')
      .select('id, company_id, requester_id, shift_assignment_id, request_type, reason, status, reviewed_by, reviewed_at, created_at, updated_at')
      .eq('requester_id', user_id)
      .order('created_at', { ascending: false })
    if (error) throw new Error(error.message)
    return (data ?? []) as LeaveRequest[]
  },

  async createLeaveRequest(input: LeaveRequestCreateInput): Promise<LeaveRequest> {
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

  async createShiftSwapRequest(input: ShiftSwapRequestCreateInput & { counterpart_status?: 'pending' | 'approved' | 'rejected'; counterpart_reviewed_at?: string | null }): Promise<ShiftSwapRequest> {
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
        counterpart_status: input.counterpart_status ?? 'pending',
        counterpart_reviewed_at: input.counterpart_reviewed_at ?? null,
      })
      .select()
      .single()
    if (error) throw new Error(error.message)
    return data as ShiftSwapRequest
  },

  async getShiftAssignmentById(id: string): Promise<{ id: string; shift_id: string; user_id: string; assigned_by: string | null } | null> {
    const { data, error } = await supabase
      .from('shift_assignments')
      .select('id, shift_id, user_id, assigned_by')
      .eq('id', id)
      .maybeSingle()
    if (error) throw new Error(error.message)
    return data as { id: string; shift_id: string; user_id: string; assigned_by: string | null } | null
  },

  async getShiftAssignmentForUser(shift_id: string, user_id: string): Promise<{ id: string; shift_id: string; user_id: string } | null> {
    const { data, error } = await supabase
      .from('shift_assignments')
      .select('id, shift_id, user_id')
      .eq('shift_id', shift_id)
      .eq('user_id', user_id)
      .maybeSingle()
    if (error) throw new Error(error.message)
    return data as { id: string; shift_id: string; user_id: string } | null
  },

  async createShiftAssignment(input: { shift_id: string; user_id: string; assigned_by: string | null }): Promise<{ id: string; shift_id: string; user_id: string }> {
    const { data, error } = await supabase
      .from('shift_assignments')
      .insert({ shift_id: input.shift_id, user_id: input.user_id, assigned_by: input.assigned_by })
      .select('id, shift_id, user_id')
      .single()
    if (error) throw new Error(error.message)
    return data as { id: string; shift_id: string; user_id: string }
  },
}
