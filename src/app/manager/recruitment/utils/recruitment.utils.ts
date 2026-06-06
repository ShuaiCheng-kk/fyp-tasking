import { JobPosting } from '@/types/recruitment.types'
import { PostJobForm, ShiftForm, OneOffForm } from '@/types/recruitment.form.types'

// ─── Date helpers ─────────────────────────────────────────────────────────────

export function addDays(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toISOString().split('T')[0]
}

// ─── Expiry helpers ───────────────────────────────────────────────────────────

export function isExpired(job: JobPosting & Record<string, any>): boolean {
  if (!job.expires_at) return false
  return new Date(job.expires_at) < new Date()
}

export function expiryLabel(job: JobPosting & Record<string, any>): string | null {
  if (!job.expires_at) return null
  const exp = new Date(job.expires_at)
  const now = new Date()
  const diffMs = exp.getTime() - now.getTime()
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24))
  if (diffDays < 0)  return 'Expired'
  if (diffDays === 0) return 'Expires today'
  if (diffDays === 1) return 'Expires tomorrow'
  if (diffDays <= 7)  return `Expires in ${diffDays} days`
  return `Expires ${exp.toLocaleDateString('en-SG', { day: 'numeric', month: 'short' })}`
}

// ─── Posted-ago label ─────────────────────────────────────────────────────────

export function postedAgoLabel(createdAt: string): string {
  const daysAgo = Math.floor((Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60 * 24))
  if (daysAgo === 0) return 'Posted today'
  if (daysAgo === 1) return 'Posted yesterday'
  return `Posted ${daysAgo} days ago`
}

// ─── Domain → Form mapper (for edit mode) ────────────────────────────────────

export function jobToForm(job: JobPosting & Record<string, any>): PostJobForm {
  const base = {
    title:           job.title ?? '',
    description:     job.description ?? '',
    requirements:    job.requirements ?? '',
    location:        job.location ?? '',
    employment_type: job.employment_type ?? 'casual',
    company_name:    job.company_name ?? '',
    industry:        job.industry ?? '',
    salary_amount:   job.salary_amount != null ? String(job.salary_amount) : '',
    salary_type:     job.salary_type ?? 'per hour',
    benefits:        job.benefits ?? '',
    urgency:         job.urgency ?? 'normal',
    openings:        job.openings ?? 1,
    expires_at:      job.expires_at ?? '',
    expiry_preset:   job.expiry_preset ?? 'none',
  }

  if (job.is_recurring || job.formType === 'shift') {
    return {
      ...base,
      formType: 'shift',
      shift_start_time:    job.shift_start_time ?? '09:00',
      shift_end_time:      job.shift_end_time ?? '17:00',
      shift_days:          job.shift_days ?? [],
      is_recurring:        job.is_recurring ?? false,
      recurrence_interval: job.recurrence_interval ?? 1,
      recurrence_unit:     job.recurrence_unit ?? 'week',
    }
  }

  return {
    ...base,
    formType:        'oneoff',
    job_date:        job.job_date ?? '',
    job_end_date:    job.job_end_date ?? '',
    estimated_hours: job.estimated_hours ?? '',
  }
}

// ─── Form → API request body builder ─────────────────────────────────────────

export function buildJobBody(
  form: PostJobForm,
  context: { companyId: string; departmentId: string | null; userId: string },
  extra?: Record<string, any>,
) {
  const { companyId, departmentId, userId } = context
  return {
    company_id:          companyId,
    department_id:       departmentId,
    created_by:          userId,
    title:               form.title,
    description:         form.description,
    requirements:        form.requirements || null,
    location:            form.location || null,
    employment_type:     form.employment_type,
    is_recurring:        form.formType === 'shift' ? (form as ShiftForm).is_recurring : false,
    recurrence_interval: form.formType === 'shift' && (form as ShiftForm).is_recurring
      ? (form as ShiftForm).recurrence_interval : null,
    recurrence_unit:     form.formType === 'shift' && (form as ShiftForm).is_recurring
      ? (form as ShiftForm).recurrence_unit : null,
    company_name:        form.company_name || null,
    industry:            form.industry || null,
    salary_amount:       form.salary_amount ? Number(form.salary_amount) : null,
    salary_type:         form.salary_type,
    benefits:            form.benefits || null,
    urgency:             form.urgency || null,
    openings:            form.openings || 1,
    expires_at:          form.expires_at || null,
    expiry_preset:       form.expiry_preset || 'none',
    formType:            form.formType,
    // Shift-specific
    ...(form.formType === 'shift' ? {
      shift_start_time: (form as ShiftForm).shift_start_time,
      shift_end_time:   (form as ShiftForm).shift_end_time,
      shift_days:       (form as ShiftForm).shift_days,
    } : {}),
    // One-off specific
    ...(form.formType === 'oneoff' ? {
      job_date:        (form as OneOffForm).job_date || null,
      job_end_date:    (form as OneOffForm).job_end_date || null,
      estimated_hours: (form as OneOffForm).estimated_hours || null,
    } : {}),
    ...extra,
  }
}
