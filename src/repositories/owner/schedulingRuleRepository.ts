// LAYER: Repository
// RULE: Supabase queries only. No business logic.

import { supabase } from '@/lib/supabase'
import { ScheduleValidationItem, SchedulingRuleKey, SchedulingRuleSetting, SchedulingRuleValue } from '@/types/SchedulingRule'
import { Shift } from '@/types/Shift'
import { ShiftAssignment } from '@/types/ShiftAssignment'

type RuleSettingRow = {
  company_id: string
  rule_key: SchedulingRuleKey
  value: SchedulingRuleValue
  active: boolean
  updated_by: string | null
}

export type RuleValidationUser = {
  id: string
  full_name: string
  role: string
  company_id: string | null
  worker_status?: string | null
  status?: string | null
  employment_status?: string | null
  weekly_working_hours?: number | null
  max_weekly_hours?: number | null
  contracted_weekly_hours?: number | null
  department_id: string | null
}

export type ApprovedTimeOffRow = {
  id: string
  requester_id: string
  shift_assignment_id: string | null
  status: string
  request_type: string
  shifts?: Shift | null
}

export type TimeOffContextRow = ApprovedTimeOffRow & {
  created_at?: string | null
}

export const schedulingRuleRepository = {
  async getRuleSettings(company_id: string): Promise<SchedulingRuleSetting[]> {
    const { data, error } = await supabase
      .from('scheduling_rule_settings')
      .select('company_id, rule_key, value, active, updated_by')
      .eq('company_id', company_id)
    if (error) throw new Error(error.message)
    return (data ?? [])
      .filter((row: RuleSettingRow) => String(row.rule_key) !== 'inactive_employee_block')
      .map((row: RuleSettingRow) => ({
        company_id: row.company_id,
        rule_key: row.rule_key,
        value: row.value,
        active: row.active,
        updated_by: row.updated_by,
      }))
  },

  async upsertRuleSetting(input: {
    company_id: string
    rule_key: SchedulingRuleKey
    value: SchedulingRuleValue
    active: boolean
    updated_by: string
  }): Promise<SchedulingRuleSetting> {
    const { data, error } = await supabase
      .from('scheduling_rule_settings')
      .upsert({
        company_id: input.company_id,
        rule_key: input.rule_key,
        value: input.value,
        active: input.active,
        updated_by: input.updated_by,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'company_id,rule_key' })
      .select('company_id, rule_key, value, active, updated_by')
      .single()
    if (error) throw new Error(error.message)
    return data as SchedulingRuleSetting
  },

  async getCompanyUsers(company_id: string): Promise<RuleValidationUser[]> {
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
    const { data, error } = await supabase
      .from('shift_assignments')
      .select('*')
      .in('shift_id', ids)
    if (error) throw new Error(error.message)
    return (data ?? []) as ShiftAssignment[]
  },

  async getApprovedTimeOffByCompany(company_id: string): Promise<ApprovedTimeOffRow[]> {
    const { data, error } = await supabase
      .from('time_off_requests')
      .select('id, requester_id, shift_assignment_id, status, request_type, shift_assignments(shifts(*))')
      .eq('company_id', company_id)
      .eq('status', 'approved')
    if (error) throw new Error(error.message)
    return (data ?? []).map((row: any) => ({
      id: row.id,
      requester_id: row.requester_id,
      shift_assignment_id: row.shift_assignment_id,
      status: row.status,
      request_type: row.request_type,
      shifts: Array.isArray(row.shift_assignments)
        ? row.shift_assignments[0]?.shifts ?? null
        : row.shift_assignments?.shifts ?? null,
    })) as ApprovedTimeOffRow[]
  },

  async getTimeOffRequestsByCompany(company_id: string): Promise<TimeOffContextRow[]> {
    const { data, error } = await supabase
      .from('time_off_requests')
      .select('id, requester_id, shift_assignment_id, status, request_type, created_at, shift_assignments(shifts(*))')
      .eq('company_id', company_id)
    if (error) {
      if (/time_off_requests|does not exist|schema cache/i.test(error.message)) return []
      throw new Error(error.message)
    }
    return (data ?? []).map((row: any) => ({
      id: row.id,
      requester_id: row.requester_id,
      shift_assignment_id: row.shift_assignment_id,
      status: row.status,
      request_type: row.request_type,
      created_at: row.created_at ?? null,
      shifts: Array.isArray(row.shift_assignments)
        ? row.shift_assignments[0]?.shifts ?? null
        : row.shift_assignments?.shifts ?? null,
    })) as TimeOffContextRow[]
  },

  async getFixedOffDays(company_id: string): Promise<Array<{ user_id: string; weekday: number }>> {
    const { data, error } = await supabase
      .from('employee_fixed_off_days')
      .select('user_id, weekday')
      .eq('company_id', company_id)
      .eq('status', 'approved')
    if (error) {
      if (/employee_fixed_off_days|does not exist|schema cache/i.test(error.message)) return []
      throw new Error(error.message)
    }
    return (data ?? []) as Array<{ user_id: string; weekday: number }>
  },
}
