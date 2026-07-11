export interface JobTemplate {
  id: string
  company_id: string
  name: string
  title: string
  description: string | null
  requirements: string | null
  employment_type: string | null
  form_type: string | null
  department_id: string | null
  salary_amount: number | null
  salary_type: string | null
  uniform_required: boolean
  uniform_type: string | null
  uniform_details: string | null
  experience_required: string | null
  minimum_age: number | null
  estimated_hours: string | null
  urgency: string | null
  created_by: string
  created_at: string
  updated_at: string
}

export interface JobTemplateInput {
  company_id: string
  name: string
  title: string
  description?: string | null
  requirements?: string | null
  employment_type?: string | null
  form_type?: string | null
  department_id?: string | null
  salary_amount?: number | null
  salary_type?: string | null
  uniform_required?: boolean
  uniform_type?: string | null
  uniform_details?: string | null
  experience_required?: string | null
  minimum_age?: number | null
  estimated_hours?: string | null
  urgency?: string | null
  created_by: string
}

export interface JobTemplateUsageStats {
  used_in_jobs: number
  published_jobs: number
  draft_jobs: number
  last_used_at: string | null
}

export interface JobTemplateUpdateInput {
  name?: string
  title?: string
  description?: string | null
  requirements?: string | null
  employment_type?: string | null
  form_type?: string | null
  department_id?: string | null
  salary_amount?: number | null
  salary_type?: string | null
  uniform_required?: boolean
  uniform_type?: string | null
  uniform_details?: string | null
  experience_required?: string | null
  minimum_age?: number | null
  estimated_hours?: string | null
  urgency?: string | null
}
