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
  status: 'open' | 'archived' | 'closed' | 'expired' | 'pending_approval' | 'rejected' | 'draft'
  is_recurring: boolean
  recurrence_interval: number | null
  recurrence_unit: string | null
  archived_at: string | null
  created_at: string
  updated_at: string
  company_name: string | null
  company_location: string | null
  company_description: string | null
  company_size: string | null
  company_address: string | null
  company_industry: string | null
  industry: string | null
  salary_amount: number | null
  salary_type: string | null
  urgency: string | null
  estimated_hours: string | null
  shift_date: string | null
  shift_start_time: string | null
  shift_end_time: string | null
  break_start_time: string | null
  break_end_time: string | null
  job_start_time: string | null
  assigned_employee_id: string | null
  rejection_reason: string | null
  expires_at: string | null
  template_id: string | null
  experience_required: string | null
  minimum_age: string | null
  uniform_required: boolean
  uniform_details: string | null
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
  urgency?: string | null
  estimated_hours?: string | null
  is_recurring?: boolean
  recurrence_interval?: number | null
  recurrence_unit?: string | null
  status?: string
  shift_date?: string | null
  shift_start_time?: string | null
  shift_end_time?: string | null
  break_start_time?: string | null
  break_end_time?: string | null
  job_start_time?: string | null
  assigned_employee_id?: string | null
  form_type?: string | null
  expires_at?: string | null
  template_id?: string | null
  experience_required?: string | null
  minimum_age?: string | null
  uniform_required?: boolean
  uniform_details?: string | null
}

export interface JobPostingSummary extends JobPosting {
  department_name: string | null
  applicant_count: number
  pending_count: number
  accepted_count: number
  assigned_employee_name: string | null
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

export interface JobPostingPendingApproval extends JobPosting {
  department_name: string | null
  submitter_name: string | null
  submitter_photo_url: string | null
  assigned_employee_name: string | null
}

export interface CasualWorkerStatus {
  id: string
  full_name: string
  email_address: string
  department_id: string | null
  department_name: string | null
  worker_status: 'active' | 'inactive' | 'blocked'
}
