export interface JobTemplate {
  id: string
  company_id: string
  title: string
  responsibilities: string | null
  skills: string | null
  job_type: string | null
  department_id: string | null
  salary_amount: number | null
  // 'company' = employer provides uniform. 'dress_code' = no uniform, but a specific dress code
  // applies (see uniform_details). 'none' = no requirement.
  uniform_type: string
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
  title: string
  responsibilities?: string | null
  skills?: string | null
  job_type?: string | null
  department_id?: string | null
  salary_amount?: number | null
  uniform_type?: string
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
  title?: string
  responsibilities?: string | null
  skills?: string | null
  job_type?: string | null
  department_id?: string | null
  salary_amount?: number | null
  uniform_type?: string
  uniform_details?: string | null
  experience_required?: string | null
  minimum_age?: number | null
  estimated_hours?: string | null
  urgency?: string | null
}
