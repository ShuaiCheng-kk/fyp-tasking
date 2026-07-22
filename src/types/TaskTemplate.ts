export interface TaskTemplate {
  id: string
  company_id: string
  department_id: string | null
  title: string
  description: string | null
  priority: string | null
  sub_task_titles: string[]
  created_by: string
  created_at: string
}

export interface TaskTemplateInput {
  company_id: string
  department_id?: string | null
  title: string
  description?: string | null
  priority?: string | null
  sub_task_titles?: string[]
  created_by: string
}

export interface TaskTemplateUpdateInput {
  department_id?: string | null
  title?: string
  description?: string | null
  priority?: string | null
  sub_task_titles?: string[]
}
