// LAYER: Repository
// RULE: Supabase queries only. No business logic.

import { getSupabaseAdmin } from '@/lib/supabaseAdmin'

const supabase = getSupabaseAdmin()
import { ScheduleValidationItem } from '@/types/SchedulingRule'
import { Shift } from '@/types/Shift'
import { ShiftAssignment } from '@/types/ShiftAssignment'

export type RuleValidationUser = {
  id: string
  full_name: string
  role: string
  company_id: string | null
  department_ids: string[]
}

export const schedulingRuleRepository = {
  async getCompanyUsers(company_id: string): Promise<RuleValidationUser[]> {
    const { data, error } = await supabase
      .from('users')
      .select('*, manager_departments!manager_departments_manager_id_fkey(department_id), employee_departments(department_id)')
      .eq('company_id', company_id)
    if (error) throw new Error(error.message)
    // A Manager can be assigned to more than one department (manager_departments is many-to-many) —
    // collapsing to a single department_id would silently drop them from every department but the first.
    return (data ?? []).map((row: any) => ({
      ...row,
      department_ids: [
        ...new Set([
          ...(row.manager_departments ?? []).map((d: any) => d.department_id),
          ...(row.employee_departments ?? []).map((d: any) => d.department_id),
        ]),
      ] as string[],
      manager_departments: undefined,
      employee_departments: undefined,
    })) as RuleValidationUser[]
  },

  async getPublishedOrDraftScheduleItems(
    company_id: string,
    date_from: string,
    date_to: string,
  ): Promise<ScheduleValidationItem[]> {
    const { data: shifts, error } = await supabase
      .from('shifts')
      .select('*')
      .eq('company_id', company_id)
      .gte('shift_date', date_from)
      .lte('shift_date', date_to)
    if (error) throw new Error(error.message)
    const shiftRows = (shifts ?? []) as Shift[]
    const ids = shiftRows.map(shift => shift.id)
    const assignments = ids.length > 0
      ? await this.getAssignmentsByShiftIds(ids)
      : []
    const byShift = new Map(assignments.map(item => [item.shift_id, item.user_id]))
    return shiftRows.map(shift => ({
      department_id: shift.department_id,
      shift_date: shift.shift_date,
      start_time: shift.start_time,
      end_time: shift.end_time,
      user_id: byShift.get(shift.id) ?? null,
    }))
  },

  async getAssignmentsByShiftIds(ids: string[]): Promise<ShiftAssignment[]> {
    if (ids.length === 0) return []
    // AI schedule generation pulls a whole company's shifts across a 28-day lookback plus the
    // requested range, which can push this past a few hundred ids — a single .in() GET request
    // encodes every id into the URL and a long enough one fails at the transport level (a raw
    // "TypeError: fetch failed" with no HTTP status), so batch it instead of sending it as one call.
    const CHUNK_SIZE = 200
    const chunks: string[][] = []
    for (let i = 0; i < ids.length; i += CHUNK_SIZE) chunks.push(ids.slice(i, i + CHUNK_SIZE))
    const results = await Promise.all(chunks.map(async chunk => {
      const { data, error } = await supabase
        .from('shift_assignments')
        .select('*')
        .in('shift_id', chunk)
      if (error) throw new Error(error.message)
      return (data ?? []) as ShiftAssignment[]
    }))
    return results.flat()
  },

  async getOffDayRequests(company_id: string, date_from: string, date_to: string): Promise<Array<{ user_id: string; requested_date: string }>> {
    const { data, error } = await supabase
      .from('off_day_requests')
      .select('user_id, requested_date')
      .eq('company_id', company_id)
      .in('status', ['approved', 'modified'])
      .gte('requested_date', date_from)
      .lte('requested_date', date_to)
    if (error) {
      if (/off_day_requests|does not exist|schema cache/i.test(error.message)) return []
      throw new Error(error.message)
    }
    return (data ?? []) as Array<{ user_id: string; requested_date: string }>
  },
}
