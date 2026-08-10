// LAYER: Repository
// RULE: Supabase queries only. No business logic.

import { getSupabaseAdmin } from '@/lib/supabaseAdmin'

const supabase = getSupabaseAdmin()
import { Shift, ShiftInput } from '@/types/Shift'
import { ShiftAssignment } from '@/types/ShiftAssignment'
import { ShiftActionHistory, ShiftActionHistoryInput, ShiftActionRedoPayload } from '@/types/ShiftActionHistory'
import { User } from '@/types/auth.types'

function blockedByAttendanceMessage(context: 'reassign' | 'delete'): string {
  return context === 'delete'
    ? 'Cannot delete this shift — attendance has already been recorded against it.'
    : 'Cannot reassign this shift — attendance has already been recorded against it.'
}

export const shiftRepository = {

  async createShift(input: ShiftInput): Promise<Shift> {
    const { data, error } = await supabase
      .from('shifts')
      .insert({
        company_id: input.company_id,
        department_id: input.department_id,
        shift_date: input.shift_date,
        start_time: input.start_time,
        end_time: input.end_time,
        created_by: input.created_by,
        publication_status: input.publication_status ?? 'draft',
        recurrence_group_id: input.recurrence_group_id ?? null,
        recurrence_rule: input.recurrence_rule ?? null,
        source_shift_id: input.source_shift_id ?? null,
        split_group_id: input.split_group_id ?? null,
        template_id: input.template_id ?? null,
        source_job_posting_id: input.source_job_posting_id ?? null,
        is_open_ended: input.is_open_ended ?? false,
        hourly_rate: input.hourly_rate ?? null,
      })
      .select()
      .single()
    if (error) throw new Error(error.message)
    return data as Shift
  },

  async getShiftsBySplitGroupId(split_group_id: string): Promise<Shift[]> {
    const { data, error } = await supabase
      .from('shifts')
      .select('*')
      .eq('split_group_id', split_group_id)
      .order('start_time', { ascending: true })
    if (error) throw new Error(error.message)
    return (data ?? []) as Shift[]
  },

  async getShiftsByRecurrenceGroupId(recurrence_group_id: string): Promise<Shift[]> {
    const { data, error } = await supabase
      .from('shifts')
      .select('*')
      .eq('recurrence_group_id', recurrence_group_id)
      .order('shift_date', { ascending: true })
    if (error) throw new Error(error.message)
    return (data ?? []) as Shift[]
  },

  async restoreShift(shift: Shift): Promise<Shift> {
    const { data, error } = await supabase
      .from('shifts')
      .insert(shift)
      .select()
      .single()
    if (error) throw new Error(error.message)
    return data as Shift
  },

  async createShiftAssignment(input: {
    shift_id: string
    user_id: string
    assigned_by: string
    supervisor_employee_id?: string | null
  }): Promise<ShiftAssignment> {
    const { data, error } = await supabase
      .from('shift_assignments')
      .insert({
        shift_id: input.shift_id,
        user_id: input.user_id,
        assigned_by: input.assigned_by,
        supervisor_employee_id: input.supervisor_employee_id ?? null,
      })
      .select()
      .single()
    if (error) throw new Error(error.message)
    return data as ShiftAssignment
  },

  async restoreShiftAssignments(assignments: ShiftAssignment[]): Promise<void> {
    if (assignments.length === 0) return
    const { error } = await supabase
      .from('shift_assignments')
      .insert(assignments)
    if (error) throw new Error(error.message)
  },

  async getShiftsByCompanyAndDateRange(
    company_id: string,
    from: string,
    to: string,
    department_id?: string,
  ): Promise<Shift[]> {
    let query = supabase
      .from('shifts')
      .select('*')
      .eq('company_id', company_id)
      .gte('shift_date', from)
      .lte('shift_date', to)
    if (department_id) query = query.eq('department_id', department_id)
    const { data, error } = await query
      .order('shift_date', { ascending: true })
      .order('start_time', { ascending: true })
    if (error) throw new Error(error.message)
    return (data ?? []) as Shift[]
  },

  async getShiftById(id: string): Promise<Shift | null> {
    const { data, error } = await supabase
      .from('shifts')
      .select('*')
      .eq('id', id)
      .single()
    // PGRST116 = no row matched — a genuine "not found". Any other error (network, RLS, etc.)
    // must not be silently reported as "not found", or real failures become undiagnosable.
    if (error && error.code !== 'PGRST116') throw new Error(error.message)
    return (data as Shift) ?? null
  },

  async getShiftsByIds(ids: string[]): Promise<Shift[]> {
    if (ids.length === 0) return []
    const { data, error } = await supabase
      .from('shifts')
      .select('*')
      .in('id', ids)
    if (error) throw new Error(error.message)
    return (data ?? []) as Shift[]
  },

  async upsertShifts(shifts: Shift[]): Promise<Shift[]> {
    if (shifts.length === 0) return []
    const { data, error } = await supabase
      .from('shifts')
      .upsert(shifts, { onConflict: 'id' })
      .select()
    if (error) throw new Error(error.message)
    return (data ?? []) as Shift[]
  },

  async restoreShifts(shifts: Shift[]): Promise<Shift[]> {
    if (shifts.length === 0) return []
    const { data, error } = await supabase
      .from('shifts')
      .insert(shifts)
      .select()
    if (error) throw new Error(error.message)
    return (data ?? []) as Shift[]
  },

  async deleteShiftsByIds(ids: string[]): Promise<void> {
    if (ids.length === 0) return
    const { error } = await supabase.from('shifts').delete().in('id', ids)
    if (error) throw new Error(error.message)
  },

  async updatePublicationStatusByIds(ids: string[], publication_status: 'draft' | 'published'): Promise<void> {
    if (ids.length === 0) return
    const { error } = await supabase
      .from('shifts')
      .update({ publication_status })
      .in('id', ids)
    if (error) throw new Error(error.message)
  },

  async updateShift(
    id: string,
    fields: Partial<Omit<Shift, 'id' | 'company_id' | 'created_by'>>,
  ): Promise<Shift> {
    const { data, error } = await supabase
      .from('shifts')
      .update(fields)
      .eq('id', id)
      .select()
      .single()
    if (error) throw new Error(error.message)
    return data as Shift
  },

  async updateSchedulePublication(input: {
    company_id: string
    date_from: string
    date_to: string
    publication_status: 'draft' | 'published'
    department_id?: string
  }): Promise<Shift[]> {
    // Uses the publish_schedule_range() DB function (see migrations) instead of a plain
    // UPDATE ... WHERE, because a bulk range update has no guaranteed row-lock order and
    // concurrent overlapping publish/unpublish calls deadlock (Postgres 40P01). The function
    // locks matching rows in a consistent order (ORDER BY id FOR UPDATE) so concurrent callers
    // block/wait on each other instead of deadlocking.
    const { data, error } = await supabase.rpc('publish_schedule_range', {
      p_company_id: input.company_id,
      p_date_from: input.date_from,
      p_date_to: input.date_to,
      p_department_id: input.department_id ?? null,
      p_publication_status: input.publication_status,
    })
    if (error) throw new Error(error.message)
    return (data ?? []) as Shift[]
  },

  async deleteShift(id: string): Promise<void> {
    const { error } = await supabase.from('shifts').delete().eq('id', id)
    if (error) throw new Error(error.message)
  },

  // context picks the FK-violation wording — the same shift_assignments delete underlies both
  // "give this shift to someone else" (reassign) and "remove this shift" (delete) call sites,
  // and the two need different user-facing wording for the same 23503 (attendance_records FK).
  async deleteAssignmentsByShiftId(shift_id: string, context: 'reassign' | 'delete' = 'reassign'): Promise<void> {
    const { error } = await supabase
      .from('shift_assignments')
      .delete()
      .eq('shift_id', shift_id)
    if (error) throw new Error(error.code === '23503' ? blockedByAttendanceMessage(context) : error.message)
  },

  async deleteAssignmentsByShiftIds(shift_ids: string[], context: 'reassign' | 'delete' = 'reassign'): Promise<void> {
    if (shift_ids.length === 0) return
    const { error } = await supabase
      .from('shift_assignments')
      .delete()
      .in('shift_id', shift_ids)
    if (error) throw new Error(error.code === '23503' ? blockedByAttendanceMessage(context) : error.message)
  },

  async deleteAssignmentById(assignment_id: string): Promise<void> {
    const { error } = await supabase
      .from('shift_assignments')
      .delete()
      .eq('id', assignment_id)
    if (error) throw new Error(error.code === '23503' ? 'Cannot remove this assignment — attendance has already been recorded against it.' : error.message)
  },

  async getAssignmentById(assignment_id: string): Promise<ShiftAssignment | null> {
    const { data, error } = await supabase
      .from('shift_assignments')
      .select('*')
      .eq('id', assignment_id)
      .single()
    if (error) return null
    return data as ShiftAssignment
  },

  async getUsersByIds(
    ids: string[],
  ): Promise<{ id: string; full_name: string; role: string; profile_photo_url: string | null }[]> {
    if (ids.length === 0) return []
    const { data, error } = await supabase
      .from('users')
      .select('id, full_name, role, profile_photo_url')
      .in('id', ids)
    if (error) throw new Error(error.message)
    return (data ?? []) as { id: string; full_name: string; role: string; profile_photo_url: string | null }[]
  },

  async getAssignmentsByShiftIds(ids: string[]): Promise<ShiftAssignment[]> {
    if (ids.length === 0) return []
    // A wide date range (e.g. Bulk Edit's up-to-31-day window, or a large company's Timeline) can
    // push this past a few hundred ids — a single .in() GET request encodes every id into the URL
    // and a long enough one fails at the transport level (a raw "TypeError: fetch failed" with no
    // HTTP status), so batch it instead of sending it as one call.
    const CHUNK_SIZE = 200
    const chunks: string[][] = []
    for (let i = 0; i < ids.length; i += CHUNK_SIZE) chunks.push(ids.slice(i, i + CHUNK_SIZE))
    const results = await Promise.all(chunks.map(async chunk => {
      const { data, error } = await supabase
        .from('shift_assignments')
        .select('*')
        .in('shift_id', chunk)
        .order('created_at', { ascending: true })
      if (error) throw new Error(error.message)
      return (data ?? []) as ShiftAssignment[]
    }))
    return results.flat().sort((a, b) => a.created_at.localeCompare(b.created_at))
  },

  async getAssignmentsByUserAndDateRange(
    user_id: string,
    from: string,
    to: string,
    exclude_shift_id?: string,
  ): Promise<Array<ShiftAssignment & { shifts: Shift | null }>> {
    let query = supabase
      .from('shift_assignments')
      .select('*, shifts(*)')
      .eq('user_id', user_id)
      .gte('shifts.shift_date', from)
      .lte('shifts.shift_date', to)
    if (exclude_shift_id) query = query.neq('shift_id', exclude_shift_id)
    const { data, error } = await query
    if (error) throw new Error(error.message)
    return (data ?? []) as Array<ShiftAssignment & { shifts: Shift | null }>
  },

  async getCompanyMembers(company_id: string): Promise<(User & { department_id: string | null })[]> {
    const { data, error } = await supabase
      .from('users')
      .select('*, manager_departments!manager_departments_manager_id_fkey(department_id), employee_departments(department_id), casualworker_departments(department_id)')
      .eq('company_id', company_id)
    if (error) throw new Error(error.message)
    return (data ?? []).map((row: any) => ({
      ...row,
      // Casual Worker's home department lives in casualworker_departments, not
      // employee_departments — without this branch every CW came back department_id: null and
      // was silently dropped from every department-grouped view (Shift Timeline/Calendar).
      department_id: row.manager_departments?.[0]?.department_id ?? row.employee_departments?.[0]?.department_id ?? row.casualworker_departments?.[0]?.department_id ?? null,
      manager_departments: undefined,
      employee_departments: undefined,
      casualworker_departments: undefined,
    })) as (User & { department_id: string | null })[]
  },

  async getDepartmentsByIds(
    ids: string[],
  ): Promise<{ id: string; name: string }[]> {
    if (ids.length === 0) return []
    const { data, error } = await supabase
      .from('departments')
      .select('id, name')
      .in('id', ids)
    if (error) throw new Error(error.message)
    return (data ?? []) as { id: string; name: string }[]
  },

  async createActionHistory(input: ShiftActionHistoryInput): Promise<ShiftActionHistory> {
    const { data, error } = await supabase
      .from('shift_action_history')
      .insert({
        company_id: input.company_id,
        performed_by: input.performed_by,
        action_type: input.action_type,
        affected_shift_ids: input.affected_shift_ids,
        undo_payload: input.undo_payload,
      })
      .select()
      .single()
    if (error) throw new Error(error.message)
    return data as ShiftActionHistory
  },

  async getLatestUndoableAction(company_id: string, performed_by: string): Promise<ShiftActionHistory | null> {
    const { data, error } = await supabase
      .from('shift_action_history')
      .select('*')
      .eq('company_id', company_id)
      .eq('performed_by', performed_by)
      .eq('undone', false)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (error) throw new Error(error.message)
    return (data as ShiftActionHistory) ?? null
  },

  async getLatestRedoableAction(company_id: string, performed_by: string): Promise<ShiftActionHistory | null> {
    const { data, error } = await supabase
      .from('shift_action_history')
      .select('*')
      .eq('company_id', company_id)
      .eq('performed_by', performed_by)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (error) throw new Error(error.message)
    const action = (data as ShiftActionHistory) ?? null
    return action && action.undone ? action : null
  },

  async markActionUndone(id: string, redo_payload: ShiftActionRedoPayload): Promise<void> {
    const { error } = await supabase
      .from('shift_action_history')
      .update({ undone: true, redo_payload })
      .eq('id', id)
    if (error) throw new Error(error.message)
  },

  async markActionRedone(id: string): Promise<void> {
    const { error } = await supabase
      .from('shift_action_history')
      .update({ undone: false })
      .eq('id', id)
    if (error) throw new Error(error.message)
  },

}
