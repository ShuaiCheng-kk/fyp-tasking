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
}
