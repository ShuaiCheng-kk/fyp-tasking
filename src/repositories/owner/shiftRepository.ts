// LAYER: Repository
// RULE: Supabase queries only. No business logic.

import { supabase } from '@/lib/supabase'
import { Shift, ShiftInput } from '@/types/Shift'

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
      })
      .select()
      .single()
    if (error) throw new Error(error.message)
    return data as Shift
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

  async deleteShift(id: string): Promise<void> {
    const { error } = await supabase.from('shifts').delete().eq('id', id)
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
