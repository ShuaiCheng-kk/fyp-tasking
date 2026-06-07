export interface JobPosting {
  id: string
  company_id: string
  department_id: string | null
  created_by: string
  title: string
  description: string
  requirements: string | null
  location: string | null
  employment_type: string | null
  status: 'open' | 'archived' | 'closed'
  is_recurring: boolean
  recurrence_interval: number | null
  recurrence_unit: string | null
  archived_at: string | null
  created_at: string
  updated_at: string
  company_name: string | null
  industry: string | null
  salary_amount: number | null
  salary_type: string | null
}

export interface JobPostingInput {
  company_id: string
  department_id?: string | null
  created_by: string
  title: string
  description: string
  requirements?: string | null
  location?: string | null
  employment_type?: string | null
  company_name?: string | null
  industry?: string | null
  salary_amount?: number | null
  salary_type?: string | null
  is_recurring?: boolean
  recurrence_interval?: number | null
  recurrence_unit?: string | null
}

export interface JobPostingSummary extends JobPosting {
  department_name: string | null
  applicant_count: number
  pending_count: number
}

export interface JobApplicant {
  id: string
  job_id: string
  user_id: string | null
  full_name: string
  email_address: string
  resume_url: string | null
  cover_letter: string | null
  status: 'pending' | 'accepted' | 'rejected'
  applied_at: string
}

export interface JobInvitation {
  id: string
  job_id: string
  applicant_id: string
  sent_by: string
  message: string | null
  status: 'sent' | 'accepted' | 'declined'
  sent_at: string
}

export interface CasualWorkerStatus {
  id: string
  full_name: string
  email_address: string
  department_id: string | null
  department_name: string | null
  worker_status: 'active' | 'inactive' | 'blocked'
}
