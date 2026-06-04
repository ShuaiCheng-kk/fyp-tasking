// LAYER: Repository
// RULE: Supabase queries only. No business logic.

import { supabase } from '@/lib/supabase'
import { Shift, ShiftActionHistory, ShiftInput, ShiftSnapshot } from '@/types/Shift'
import { ShiftAssignment } from '@/types/ShiftAssignment'
import { User } from '@/types/auth.types'

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
        title: input.title ?? null,
        instruction: input.instruction ?? null,
        created_by: input.created_by,
        publication_status: input.publication_status ?? 'draft',
        acceptance_deadline_at: input.acceptance_deadline_at ?? null,
        recurrence_group_id: input.recurrence_group_id ?? null,
        recurrence_rule: input.recurrence_rule ?? null,
        source_shift_id: input.source_shift_id ?? null,
      })
      .select()
      .single()
    if (error) throw new Error(error.message)
    return data as Shift
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

  async restoreShiftAssignments(assignments: Array<Record<string, unknown>>): Promise<void> {
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
  ): Promise<Shift[]> {
    const { data, error } = await supabase
      .from('shifts')
      .select('*')
      .eq('company_id', company_id)
      .gte('shift_date', from)
      .lte('shift_date', to)
      .order('shift_date', { ascending: true })
      .order('start_time', { ascending: true })
    if (error) throw new Error(error.message)
    return (data ?? []) as Shift[]
  },

  async getShiftById(id: string): Promise<Shift | null> {
    const { data } = await supabase
      .from('shifts')
      .select('*')
      .eq('id', id)
      .single()
    return (data as Shift) ?? null
  },

  async updateShift(
    id: string,
    fields: Partial<Omit<Shift, 'id' | 'company_id' | 'created_by' | 'created_at'>>,
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
  }): Promise<Shift[]> {
    const { data, error } = await supabase
      .from('shifts')
      .update({ publication_status: input.publication_status })
      .eq('company_id', input.company_id)
      .gte('shift_date', input.date_from)
      .lte('shift_date', input.date_to)
      .select()
    if (error) throw new Error(error.message)
    return (data ?? []) as Shift[]
  },

  async deleteShift(id: string): Promise<void> {
    const { error } = await supabase.from('shifts').delete().eq('id', id)
    if (error) throw new Error(error.message)
  },

  async deleteAssignmentsByShiftId(shift_id: string): Promise<void> {
    const { error } = await supabase
      .from('shift_assignments')
      .delete()
      .eq('shift_id', shift_id)
    if (error) throw new Error(error.message)
  },

  async getUsersByIds(
    ids: string[],
  ): Promise<{ id: string; full_name: string; role: string; department_id: string | null }[]> {
    if (ids.length === 0) return []
    const { data, error } = await supabase
      .from('users')
      .select('id, full_name, role, department_id')
      .in('id', ids)
    if (error) throw new Error(error.message)
    return (data ?? []) as { id: string; full_name: string; role: string; department_id: string | null }[]
  },

  async getAssignmentsByShiftIds(ids: string[]): Promise<ShiftAssignment[]> {
    if (ids.length === 0) return []
    const { data, error } = await supabase
      .from('shift_assignments')
      .select('*')
      .in('shift_id', ids)
      .order('created_at', { ascending: true })
    if (error) throw new Error(error.message)
    return (data ?? []) as ShiftAssignment[]
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

  async createShiftActionHistory(input: {
    company_id: string
    actor_id: string
    action_type: 'create' | 'edit' | 'delete'
    shift_id: string
    before_data: ShiftSnapshot | null
    after_data: ShiftSnapshot | null
  }): Promise<void> {
    const { error } = await supabase
      .from('shift_action_history')
      .insert(input)
    if (error) throw new Error(error.message)
  },

  async getLastUndoableShiftAction(company_id: string, actor_id: string): Promise<ShiftActionHistory | null> {
    const { data, error } = await supabase
      .from('shift_action_history')
      .select('*')
      .eq('company_id', company_id)
      .eq('actor_id', actor_id)
      .is('undone_at', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (error) throw new Error(error.message)
    return (data as ShiftActionHistory | null) ?? null
  },

  async markShiftActionUndone(id: string): Promise<void> {
    const { error } = await supabase
      .from('shift_action_history')
      .update({ undone_at: new Date().toISOString() })
      .eq('id', id)
    if (error) throw new Error(error.message)
  },

  async getCompanyMembers(company_id: string): Promise<User[]> {
    const { data, error } = await supabase
      .from('company_members')
      .select('users(*)')
      .eq('company_id', company_id)
    if (error) throw new Error(error.message)
    return ((data ?? []) as unknown as { users: User | null }[])
      .map(row => row.users)
      .filter((user): user is User => Boolean(user))
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

}
