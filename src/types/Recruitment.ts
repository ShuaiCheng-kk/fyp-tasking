export interface JobPosting {
  id: string
  company_id: string
  department_id: string | null
  created_by: string
  title: string
  responsibilities: string
  skills: string | null
  status: 'open' | 'archived' | 'closed' | 'pending_approval' | 'rejected' | 'draft'
  archived_at: string | null
  // Status the posting had right before it was archived ('open' or 'closed') — lets Unarchive
  // restore it to where it came from instead of always reopening it.
  archived_from_status: string | null
  created_at: string
  updated_at: string
  // company_name/location/description/size/address/industry are not columns on job_postings —
  // joined live from companies at read time (see recruitmentRepository.getJobPostingById and
  // /api/jobs/public).
  company_name: string | null
  company_location: string | null
  company_description: string | null
  company_size: string | null
  company_address: string | null
  company_industry: string | null
  salary_amount: number | null
  urgency: string | null
  estimated_hours: string | null
  job_date: string | null
  // Shift jobs: paired with job_end_time as the shift's start/end. One-off jobs: used alone as
  // the job's start time (job_type decides which reading applies — no separate column for either).
  job_start_time: string | null
  job_end_time: string | null
  break_start_time: string | null
  break_end_time: string | null
  assigned_employee_id: string | null
  rejection_reason: string | null
  // Who rejected the posting (Owner/Partner) — set alongside rejection_reason, cleared on
  // approve/resubmit so a fresh submission never carries a stale rejection record.
  rejected_by: string | null
  expires_at: string | null
  // Set when the creator explicitly picked "No Deadline" — expires_at alone can't tell that
  // apart from a deadline nobody has chosen yet (both leave expires_at null).
  no_deadline: boolean
  template_id: string | null
  experience_required: string | null
  minimum_age: number | null
  openings: number | null
  job_type: string | null
  // 'company' = employer provides uniform. 'dress_code' = no uniform, but a specific dress code
  // applies (see uniform_details). 'none' = no requirement.
  uniform_type: string
  uniform_details: string | null
}

export interface JobPostingInput {
  company_id: string
  department_id?: string | null
  created_by: string
  title: string
  responsibilities: string
  skills?: string | null
  salary_amount?: number | null
  urgency?: string | null
  estimated_hours?: string | null
  status?: string
  job_date?: string | null
  job_start_time?: string | null
  job_end_time?: string | null
  break_start_time?: string | null
  break_end_time?: string | null
  assigned_employee_id?: string | null
  job_type?: string | null
  expires_at?: string | null
  no_deadline?: boolean
  template_id?: string | null
  experience_required?: string | null
  minimum_age?: number | null
  openings?: number | null
  uniform_type?: string
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
  // Who rejected the posting, resolved for display next to rejection_reason.
  rejected_by_name: string | null
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
  resume: string | null
  status: 'pending' | 'accepted' | 'rejected' | 'withdrawn' | 'cancelled_by_employer' | 'job_closed'
  applied_at: string
  // Per-job answers + the profile snapshot taken at apply time (later profile edits never
  // change what the employer sees on this application).
  additional_note: string | null
  skills: string | null
  certificates: ApplicantCertificateSnapshot[] | null
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
  // Only resolved when this list was fetched with include_rejected — a Manager's "Waiting For
  // Review" merges in their own rejected submissions to show the reason next to it.
  rejected_by_name: string | null
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
