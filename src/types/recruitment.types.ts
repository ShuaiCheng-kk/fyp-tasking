// ─── Job Posting ────────────────────────────────────────────────────────────

export type JobStatus = 'open' | 'closed' | 'archived'
export type RecurrenceUnit = 'day' | 'week' | 'month'

export interface JobPosting {
  id: string
  company_id: string
  department_id: string | null
  created_by: string           // internal user id (manager)
  title: string
  description: string
  requirements: string | null
  location: string | null
  employment_type: string | null  // e.g. 'casual', 'part-time', 'full-time'
  status: JobStatus
  is_recurring: boolean
  recurrence_interval: number | null   // e.g. 2
  recurrence_unit: RecurrenceUnit | null  // e.g. 'week'
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
  salary_type: string | null   // 'per hour' | 'per day' | 'per month'
  // Extended fields
  benefits: string | null
  urgency: string | null        // 'normal' | 'high' | 'urgent'
  openings: number | null
  expires_at: string | null     // ISO date string
  expiry_preset: string | null  // '7d' | '14d' | '30d' | '60d' | 'custom' | 'none'
  form_type: string | null      // 'shift' | 'oneoff'
  department_name: string | null
  // Shift-specific
  shift_start_time: string | null
  shift_end_time: string | null
  shift_days: string[] | null
  // One-off specific
  job_date: string | null
  job_end_date: string | null
  estimated_hours: string | null
}

export type CreateJobPostingInput = Pick<
  JobPosting,
  | 'company_id'
  | 'department_id'
  | 'created_by'
  | 'title'
  | 'description'
  | 'requirements'
  | 'location'
  | 'employment_type'
  | 'is_recurring'
  | 'recurrence_interval'
  | 'recurrence_unit'
  | 'company_name'
  | 'industry'
  | 'salary_amount'
  | 'salary_type'
  | 'benefits'
  | 'urgency'
  | 'openings'
  | 'expires_at'
  | 'expiry_preset'
  | 'form_type'
  | 'shift_start_time'
  | 'shift_end_time'
  | 'shift_days'
  | 'job_date'
  | 'job_end_date'
  | 'estimated_hours'
>

export type UpdateJobPostingInput = Partial<
  Pick<
    JobPosting,
    | 'title'
    | 'description'
    | 'requirements'
    | 'location'
    | 'employment_type'
    | 'status'
    | 'is_recurring'
    | 'recurrence_interval'
    | 'recurrence_unit'
    | 'company_name'
    | 'industry'
    | 'salary_amount'
    | 'salary_type'
    | 'benefits'
    | 'urgency'
    | 'openings'
    | 'expires_at'
    | 'expiry_preset'
    | 'form_type'
    | 'shift_start_time'
    | 'shift_end_time'
    | 'shift_days'
    | 'job_date'
    | 'job_end_date'
    | 'estimated_hours'
  >
>

// ─── Applicant ───────────────────────────────────────────────────────────────

export type ApplicantStatus = 'pending' | 'reviewed' | 'shortlisted' | 'rejected' | 'invited'

export interface JobApplicant {
  id: string
  job_id: string
  user_id: string
  full_name: string
  email_address: string
  resume_url: string | null
  cover_letter: string | null
  status: ApplicantStatus
  applied_at: string
}

// ─── Invitation ──────────────────────────────────────────────────────────────

export type InvitationStatus = 'sent' | 'accepted' | 'declined' | 'expired'

export interface JobInvitation {
  id: string
  job_id: string
  applicant_id: string
  sent_by: string        // manager's internal user id
  message: string | null
  status: InvitationStatus
  sent_at: string
}