// ─── Form Types ───────────────────────────────────────────────────────────────
// These live in the manager/recruitment layer and extend the base domain types.

export type JobFormType = 'shift' | 'oneoff'

export interface ShiftForm {
  formType: 'shift'
  title: string
  description: string
  requirements: string
  location: string
  employment_type: string
  // Shift-specific
  shift_start_time: string
  shift_end_time: string
  shift_days: string[]
  is_recurring: boolean
  recurrence_interval: number
  recurrence_unit: string
  openings: number
  // Common
  company_name: string
  industry: string
  salary_amount: string
  salary_type: string
  benefits: string
  urgency: string
  expires_at: string       // ISO date string or ''
  expiry_preset: string    // '7d' | '14d' | '30d' | '60d' | 'custom' | 'none'
}

export interface OneOffForm {
  formType: 'oneoff'
  title: string
  description: string
  requirements: string
  location: string
  employment_type: string
  // One-off specific
  job_date: string
  job_end_date: string
  estimated_hours: string
  openings: number
  // Common
  company_name: string
  industry: string
  salary_amount: string
  salary_type: string
  benefits: string
  urgency: string
  expires_at: string
  expiry_preset: string
}

export type PostJobForm = ShiftForm | OneOffForm

export type ConfirmState = {
  message: string
  confirmLabel: string
  danger: boolean
  onConfirm: () => void
} | null

// ─── Constants ────────────────────────────────────────────────────────────────

export const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const

export const EXPIRY_PRESETS = [
  { value: 'none',   label: 'No expiry' },
  { value: '7d',     label: '7 days' },
  { value: '14d',    label: '14 days' },
  { value: '30d',    label: '30 days' },
  { value: '60d',    label: '60 days' },
  { value: 'custom', label: 'Custom date' },
] as const

export const defaultShiftForm: ShiftForm = {
  formType: 'shift',
  title: '', description: '', requirements: '', location: '',
  employment_type: 'casual',
  shift_start_time: '09:00', shift_end_time: '17:00',
  shift_days: [], is_recurring: false,
  recurrence_interval: 1, recurrence_unit: 'week', openings: 1,
  company_name: '', industry: '', salary_amount: '', salary_type: 'per hour',
  benefits: '', urgency: 'normal', expires_at: '', expiry_preset: 'none',
}

export const defaultOneOffForm: OneOffForm = {
  formType: 'oneoff',
  title: '', description: '', requirements: '', location: '',
  employment_type: 'casual',
  job_date: '', job_end_date: '', estimated_hours: '', openings: 1,
  company_name: '', industry: '', salary_amount: '', salary_type: 'flat rate',
  benefits: '', urgency: 'normal', expires_at: '', expiry_preset: 'none',
}
