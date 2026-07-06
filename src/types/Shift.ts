export interface Shift {
  id: string
  company_id: string
  department_id: string
  title: string | null
  instruction: string | null
  shift_date: string
  start_time: string
  end_time: string
  status: 'active' | 'inactive'
  publication_status: 'draft' | 'published'
  acceptance_deadline_at: string | null
  recurrence_group_id: string | null
  recurrence_rule: 'daily' | 'weekly' | 'custom' | null
  source_shift_id: string | null
  split_group_id: string | null
  template_id: string | null
  source_job_posting_id: string | null
  is_open_ended: boolean
  flat_rate: number | null
  created_by: string
  created_at: string
  updated_at: string
}

export interface ShiftInput {
  company_id: string
  department_id: string
  title?: string | null
  instruction?: string | null
  shift_date: string
  start_time: string
  end_time: string
  created_by: string
  publication_status?: 'draft' | 'published'
  acceptance_deadline_at?: string | null
  recurrence_group_id?: string | null
  recurrence_rule?: 'daily' | 'weekly' | 'custom' | null
  source_shift_id?: string | null
  split_group_id?: string | null
  template_id?: string | null
  source_job_posting_id?: string | null
  is_open_ended?: boolean
}

export interface SplitShiftBlockInput {
  start_time: string
  end_time: string
}

export interface SplitShiftInput {
  company_id: string
  department_id: string
  title?: string | null
  instruction?: string | null
  shift_date: string
  blocks: SplitShiftBlockInput[]
  created_by: string
  publication_status?: 'draft' | 'published'
  assigned_user_id?: string | null
  supervisor_employee_id?: string | null
}

export interface DuplicateShiftInput {
  shift_date: string
  start_time: string
  end_time: string
  created_by: string
  assigned_user_id?: string | null
  template_id?: string | null
}

export interface RecurringShiftInput {
  recurrence_rule: 'daily' | 'weekly' | 'custom'
  recurrence_end_date: string
  custom_interval_days?: number
  created_by: string
  assigned_user_id?: string | null
}

export interface RecurringSplitShiftInput {
  recurrence_rule: 'daily' | 'weekly' | 'custom'
  recurrence_end_date: string
  custom_interval_days?: number
  created_by: string
  assigned_user_id?: string | null
}

export interface BulkShiftAssignmentInput {
  user_id: string
  shift_date: string
  start_time: string
  end_time: string
  supervisor_employee_id?: string | null
  template_id?: string | null
}

export interface BulkShiftAssignmentPayload {
  company_id: string
  department_id: string
  created_by: string
  assignments: BulkShiftAssignmentInput[]
}

export interface BulkShiftAssignmentResult {
  created: Shift[]
  failed: { user_id: string; shift_date: string; start_time: string; end_time: string; message: string }[]
  warnings: { user_id: string; shift_date: string; start_time: string; end_time: string; message: string }[]
}

export interface BulkCreateShiftInput {
  department_id: string
  title?: string | null
  instruction?: string | null
  shift_date: string
  start_time: string
  end_time: string
  assigned_user_id?: string | null
  template_id?: string | null
}

export interface BulkCreateShiftsPayload {
  company_id: string
  created_by: string
  items: BulkCreateShiftInput[]
}

export interface BulkCreateShiftsResult {
  created: Shift[]
  failed: { shift_date: string; start_time: string; end_time: string; message: string }[]
}

export interface BulkEditShiftItem {
  id: string
  shift_date?: string
  start_time?: string
  end_time?: string
  department_id?: string
  assigned_user_id?: string | null
}

export interface BulkEditShiftsResult {
  updated: Shift[]
  failed: { id: string; message: string }[]
}

export interface ClopeningConflict {
  conflicting_shift_id: string
  conflicting_shift_date: string
  conflicting_start_time: string
  conflicting_end_time: string
  rest_hours: number
  message: string
}

export interface ShiftMutationResult {
  shift: Shift
  warning: ClopeningConflict | null
}

export interface SplitShiftResult {
  shifts: Shift[]
  warning: ClopeningConflict | null
}
