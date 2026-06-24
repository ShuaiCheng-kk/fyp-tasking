// LAYER: Repository
// RULE: Supabase queries only. No business logic.

import { supabase } from '@/lib/supabase'
import { Shift, ShiftInput } from '@/types/Shift'
import { ShiftAssignment } from '@/types/ShiftAssignment'
import { ShiftActionHistory, ShiftActionHistoryInput, ShiftActionRedoPayload } from '@/types/ShiftActionHistory'
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
        split_group_id: input.split_group_id ?? null,
        template_id: input.template_id ?? null,
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

  async deleteAssignmentById(assignment_id: string): Promise<void> {
    const { error } = await supabase
      .from('shift_assignments')
      .delete()
      .eq('id', assignment_id)
    if (error) throw new Error(error.message)
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

  async getCompanyMembers(company_id: string): Promise<(User & { department_id: string | null })[]> {
    const { data, error } = await supabase
      .from('users')
      .select('*, manager_departments!manager_departments_manager_id_fkey(department_id), employee_departments(department_id)')
      .eq('company_id', company_id)
    if (error) throw new Error(error.message)
    return (data ?? []).map((row: any) => ({
      ...row,
      department_id: row.manager_departments?.[0]?.department_id ?? row.employee_departments?.[0]?.department_id ?? null,
      manager_departments: undefined,
      employee_departments: undefined,
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
