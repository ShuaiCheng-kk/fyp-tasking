export interface JobTemplate {
  id: string
  company_id: string
  name: string
  title: string
  description: string | null
  requirements: string | null
  employment_type: string | null
  form_type: string | null
  created_by: string
  created_at: string
}

export interface JobTemplateInput {
  company_id: string
  name: string
  title: string
  description?: string | null
  requirements?: string | null
  employment_type?: string | null
  form_type?: string | null
  created_by: string
}

export interface JobTemplateUpdateInput {
  name?: string
  title?: string
  description?: string | null
  requirements?: string | null
  employment_type?: string | null
  form_type?: string | null
}
