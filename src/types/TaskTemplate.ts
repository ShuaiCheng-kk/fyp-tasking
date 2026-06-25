export interface TaskTemplate {
  id: string
  company_id: string
  name: string
  title: string
  description: string | null
  priority: string | null
  created_by: string
  created_at: string
}

export interface TaskTemplateInput {
  company_id: string
  name: string
  title: string
  description?: string | null
  priority?: string | null
  created_by: string
}

export interface TaskTemplateUpdateInput {
  name?: string
  title?: string
  description?: string | null
  priority?: string | null
}
