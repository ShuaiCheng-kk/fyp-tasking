export interface ShiftTemplate {
  id: string
  company_id: string
  name: string
  start_time: string
  end_time: string
  created_by: string
  created_at: string
}

export interface ShiftTemplateInput {
  company_id: string
  name: string
  start_time: string
  end_time: string
  created_by: string
}
