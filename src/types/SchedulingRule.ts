export type SchedulingRuleKey =
  | 'approved_leave_block'
  | 'fixed_off_day_block'
  | 'weekly_hours_limit'
  | 'min_managers_per_department_day'
  | 'min_employees_per_department_day'
  | 'max_consecutive_working_days'
  | 'fair_weekend_rotation'
  | 'fair_workload_distribution'

export type SchedulingRuleType = 'Hard Rule' | 'Soft Rule'
export type SchedulingRuleValueType = 'number' | 'boolean' | 'text'

export type SchedulingRuleValue = number | boolean | string

export interface SchedulingRule {
  key: SchedulingRuleKey
  name: string
  description: string
  rule_type: SchedulingRuleType
  value_type: SchedulingRuleValueType
  value: SchedulingRuleValue
  editable: boolean
  active: boolean
  system_protected: boolean
}

export interface SchedulingRuleSetting {
  company_id: string
  rule_key: SchedulingRuleKey
  value: SchedulingRuleValue
  active: boolean
  updated_by: string | null
}

export interface ScheduleValidationItem {
  department_id: string
  shift_date: string
  start_time: string
  end_time: string
  user_id?: string | null
}

export interface ScheduleRuleViolation {
  rule_key: SchedulingRuleKey
  rule_name: string
  severity: 'error' | 'warning'
  message: string
  user_id?: string | null
  department_id?: string | null
  shift_date?: string | null
}

export interface ScheduleValidationResult {
  valid: boolean
  errors: ScheduleRuleViolation[]
  warnings: ScheduleRuleViolation[]
}

export type ShiftTypeInput = {
  label?: string
  start_time: string
  end_time: string
}

export type AiShiftSlot = {
  shift_label: string
  start_time: string
  end_time: string
  assigned_user_id: string | null
  assigned_user_name: string | null
  reason: string
  role: 'Manager' | 'Employee'
}
