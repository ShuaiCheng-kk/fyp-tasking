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
  minimum_age: number | null
  openings: number | null
  form_type: string | null
  shift_days: string[] | null
  uniform_required: boolean
  uniform_type: string | null
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
  minimum_age?: number | null
  openings?: number | null
  uniform_required?: boolean
  uniform_type?: string | null
  uniform_details?: string | null
}

export interface JobPostingSummary extends JobPosting {
  department_name: string | null
  applicant_count: number
  pending_count: number
  accepted_count: number
  // Owner accepted, worker hasn't confirmed the invitation yet.
  awaiting_confirmation_count: number
  // Both sides accepted — a real, filled position. Compared against openings on the card.
  confirmed_count: number
  assigned_employee_name: string | null
  assigned_employee_photo_url: string | null
  // Who published the posting (Owner / Partner / Manager) — shown as "Posted by" in the detail.
  created_by_name: string | null
}

export interface ApplicantCertificateSnapshot {
  name: string
  file_url: string | null
}

export interface JobApplicant {
  id: string
  job_id: string
  user_id: string | null
  full_name: string
  email_address: string
  resume_url: string | null
  cover_letter: string | null
  status: 'pending' | 'accepted' | 'rejected' | 'withdrawn' | 'cancelled_by_employer' | 'job_closed'
  applied_at: string
  // Per-job answers + the profile snapshot taken at apply time (later profile edits never
  // change what the employer sees on this application).
  relevant_experience: 'none' | 'less_than_1' | '1_to_2' | 'more_than_2' | null
  additional_note: string | null
  skills_snapshot: string | null
  certificates_snapshot: ApplicantCertificateSnapshot[] | null
  age_at_apply: number | null
  // Cached AI match analysis — computed once per application, not on every page open.
  ai_score: number | null
  ai_summary: string | null
  ai_computed_at: string | null
  // Latest invitation status, joined in for the employer's list ('accepted' = worker confirmed).
  invitation_status?: string | null
  // Times this worker has cancelled a confirmed shift before (history, not a rating).
  worker_cancellation_count?: number
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
