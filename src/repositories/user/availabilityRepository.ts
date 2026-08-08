// LAYER: Repository
// RULE: Supabase queries only. No business logic.

import { getSupabaseAdmin } from '@/lib/supabaseAdmin'

const supabase = getSupabaseAdmin()
import { ShiftSwapRequest, ShiftSwapRequestCreateInput } from '@/types/Attendance'

export const availabilityRepository = {
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
