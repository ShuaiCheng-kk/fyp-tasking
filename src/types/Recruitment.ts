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
  archived_at: string | null
  // Status the posting had right before it was archived ('open' or 'closed') — lets Unarchive
  // restore it to where it came from instead of always reopening it.
  archived_from_status: string | null
  created_at: string
  updated_at: string
  company_name: string | null
  company_location: string | null
  company_description: string | null
  company_size: string | null
  company_address: string | null
  company_industry: string | null
  salary_amount: number | null
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
  salary_amount?: number | null
  urgency?: string | null
  estimated_hours?: string | null
  is_recurring?: boolean
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
  phone_number: string | null
  profile_photo_url: string | null
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
  // Cached AI match analysis — computed once per application, not on every page open.
  ai_summary: string | null
  ai_computed_at: string | null
  // Latest invitation status, joined in for the employer's list ('accepted' = worker confirmed).
  invitation_status?: string | null
  // When the accepted invitation was issued — used as the "Confirmed" timestamp on confirmed hires.
  confirmed_at?: string | null
  // Times this worker has cancelled a confirmed shift before (history, not a rating).
  worker_cancellation_count?: number
}

export interface JobInvitation {
  id: string
  job_id: string
  applicant_id: string
  sent_by: string
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

// A Casual Worker in the company's verified pool — they already clocked in AND out for this
// company at least once, and have not been banned. These are the people an Owner can hand a new
// job straight to, instead of posting it publicly and waiting for strangers to apply.
export interface PoolWorker {
  id: string
  full_name: string
  email_address: string
  phone_number: string | null
  profile_photo_url: string | null
  skills: string | null
  department_id: string | null
  department_name: string | null
  // When they first completed work here — what put them in the pool.
  verified_at: string
  // How many shifts they have actually completed for this company ("done it N times before").
  completed_shifts: number
  last_worked_date: string | null
}

// Outcome of hand-inviting one pool worker to a posting. Invites are attempted per worker so one
// ineligible pick (clash, ban, age) never blocks the rest of the batch.
export interface PoolInviteResult {
  user_id: string
  full_name: string
  invited: boolean
  // Why this worker was skipped — the same hard-gate messages the public apply flow produces.
  reason: string | null
}
