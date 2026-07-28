// LAYER: Service (shared)
// RULE: Business logic only. No HTTP handling. No direct DB access.
//
// The hard gates a worker must clear to take a job — shared by BOTH routes into a posting:
//   1. the worker applies themselves      (workerApplicationService.submitApplication)
//   2. the Owner hand-picks them from the verified pool (recruitmentService.invitePoolWorkers)
// Keeping them here means a pool invite can never sneak past a check the public apply flow enforces
// (e.g. offering a shift to someone already booked elsewhere that day).

import { workerApplicationRepository } from '@/repositories/guest/workerApplicationRepository'

// Guest User is the applicant's starting role; a Casual Worker is the same person after their
// first job was confirmed, and they keep taking new jobs. No other role may work casual jobs.
export const APPLICANT_ROLES = ['Guest User', 'Casual Worker']

// Workers can stack jobs across different companies, but shifts must not collide — and since
// this platform is Singapore-wide, two hours is enough to travel between any two workplaces.
export const MIN_GAP_MINUTES = 120
export const DAY_END_MINUTES = 24 * 60 - 1
// How far ahead a recurring job's occurrences are expanded for conflict checking.
export const RECURRING_HORIZON_DAYS = 60

// The posting form's experience_required options that act as a hard apply gate, mapped to the
// wording used in the error/confirmation copy. 'Not Required' and 'Preferred' never gate.
export const HARD_EXPERIENCE_MINIMUMS: Record<string, string> = {
  '6+ Months': '6 months',
  '1+ Year': '1 year',
  '2+ Years': '2 years',
}

// A single occupied slot on the worker's timeline, dates and times both nominal wall-clock.
export type TimeWindow = { date: string; start: number; end: number }

export type ConflictSourceJob = {
  job_type: string | null
  job_date: string | null
  // Shift jobs: paired with job_end_time. One-off jobs: used alone as the start time.
  job_start_time: string | null
  job_end_time: string | null
}

type EligibilityJob = ConflictSourceJob & {
  company_id: string | null
  minimum_age: number | null
  experience_required: string | null
}

export type WorkerProfileForJob = {
  id: string
  role: string
  date_of_birth: string | null
  skills: string | null
  resume_url: string | null
}

export function computeAge(dateOfBirth: string): number {
  const dob = new Date(`${dateOfBirth.slice(0, 10)}T00:00:00`)
  const now = new Date()
  let age = now.getFullYear() - dob.getFullYear()
  const hadBirthday =
    now.getMonth() > dob.getMonth() ||
    (now.getMonth() === dob.getMonth() && now.getDate() >= dob.getDate())
  if (!hadBirthday) age -= 1
  return age
}

export function toMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + (m || 0)
}

export function localDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

// Expands a job posting into the concrete time slots it would occupy on the worker's timeline.
//   one-off      -> start time to end of day (no fixed finish, reserved conservatively)
//   single shift -> its date and times
//   recurring    -> every occurrence, weekly on job_date's weekday, within RECURRING_HORIZON_DAYS of `from`
// Only slots on/after `from`'s date are returned — earlier occurrences can't clash with anything.
export function jobPostingWindows(job: ConflictSourceJob, from: Date = new Date()): TimeWindow[] {
  const fromKey = localDateKey(from)

  if (job.job_type === 'oneoff') {
    if (!job.job_date || !job.job_start_time || job.job_date < fromKey) return []
    return [{ date: job.job_date, start: toMinutes(job.job_start_time), end: DAY_END_MINUTES }]
  }

  if (!job.job_start_time || !job.job_end_time) return []
  const start = toMinutes(job.job_start_time)
  let end = toMinutes(job.job_end_time)
  if (end <= start) end = DAY_END_MINUTES

  if (job.job_type !== 'shift') {
    if (!job.job_date || job.job_date < fromKey) return []
    return [{ date: job.job_date, start, end }]
  }

  const anchor = job.job_date ? new Date(`${job.job_date}T00:00:00`) : new Date(from)
  const anchorWeekday = anchor.getDay()

  const windows: TimeWindow[] = []
  const cursor = new Date(from)
  cursor.setHours(0, 0, 0, 0)
  if (anchor > cursor) cursor.setTime(anchor.getTime())
  for (let i = 0; i < RECURRING_HORIZON_DAYS; i++) {
    if (cursor.getDay() === anchorWeekday) windows.push({ date: localDateKey(cursor), start, end })
    cursor.setDate(cursor.getDate() + 1)
  }
  return windows
}

export function windowsConflict(a: TimeWindow, b: TimeWindow): boolean {
  if (a.date !== b.date) return false
  const gap = Math.max(b.start - a.end, a.start - b.end)
  return gap < MIN_GAP_MINUTES
}

// The invitation deadline is the FIRST shift occurrence after the invitation was sent — not
// whatever occurrence happens to be next today. A weekly-Saturday offer sent on Tuesday is for
// THIS Saturday; once that shift starts unconfirmed, the offer is dead and the employer re-sends
// for the following week if they still want the worker. Jobs with no schedule never auto-expire.
export function invitationHasExpired(job: ConflictSourceJob, sentAt: Date): boolean {
  if (!job.job_date) return false
  const windows = jobPostingWindows(job, sentAt)

  const sentKey = localDateKey(sentAt)
  const sentMinutes = sentAt.getHours() * 60 + sentAt.getMinutes()
  const deadline = windows.find(window =>
    window.date > sentKey || (window.date === sentKey && window.start > sentMinutes)
  )
  if (!deadline) return true

  const now = new Date()
  const nowKey = localDateKey(now)
  const nowMinutes = now.getHours() * 60 + now.getMinutes()
  return deadline.date < nowKey || (deadline.date === nowKey && deadline.start <= nowMinutes)
}

// Runs every hard gate for (worker, job) and throws the worker-facing reason on the first failure.
// `selfApply` distinguishes the two routes: a worker applying themselves must tick the experience
// requirement, while an Owner hand-picking a pool worker they've already employed vouches for it.
export async function assertWorkerEligibleForJob(input: {
  user_id: string
  job: EligibilityJob
  selfApply: boolean
  meets_experience_requirement?: boolean
}): Promise<{ profile: WorkerProfileForJob; age: number | null }> {
  const { user_id, job, selfApply } = input

  const profile = await workerApplicationRepository.getApplicantProfile(user_id)
  if (!profile) throw new Error('Worker profile not found')

  // Company staff (Owner/Partner/Manager/Employee) and platform admins run the business — they
  // never take casual jobs.
  if (!APPLICANT_ROLES.includes(profile.role)) {
    throw new Error('Company staff accounts cannot apply for jobs')
  }

  // Per-company ban: a company that marked this worker "inactive" can neither receive their
  // application nor hand them an offer.
  const blockingCompanyIds = await workerApplicationRepository.getBlockingCompanyIds(user_id)
  if (job.company_id && blockingCompanyIds.includes(job.company_id)) {
    throw new Error('This job is no longer accepting applications')
  }

  // Hard age gate — deterministic code against date of birth, never left to the AI matcher.
  const age = profile.date_of_birth ? computeAge(profile.date_of_birth) : null
  if (job.minimum_age != null) {
    if (age == null) {
      throw new Error('Add your date of birth to your profile to apply for this job')
    }
    if (age < job.minimum_age) {
      throw new Error(`This job requires applicants to be at least ${job.minimum_age} years old`)
    }
  }

  // Hard experience gate — the posting already states its minimum, so the worker confirms it
  // rather than re-declaring how much they have.
  if (selfApply) {
    const experienceMinimum = job.experience_required ? HARD_EXPERIENCE_MINIMUMS[job.experience_required] : undefined
    if (experienceMinimum && input.meets_experience_requirement !== true) {
      throw new Error(`This job requires at least ${experienceMinimum} of relevant experience`)
    }
  }

  // Schedule-conflict gate: the job's slots must not clash (with a 2h travel buffer) with the
  // worker's confirmed shifts or their other active applications — across ALL companies, which
  // only the platform can see.
  const candidateWindows = jobPostingWindows(job)
  if (candidateWindows.length > 0) {
    const [activeJobs, shiftRows] = await Promise.all([
      workerApplicationRepository.getActiveApplicationJobs(user_id),
      workerApplicationRepository.getFutureShiftWindows(user_id),
    ])
    const occupied: TimeWindow[] = [
      ...activeJobs.flatMap(activeJob => jobPostingWindows(activeJob)),
      ...shiftRows.map(shift => ({
        date: shift.shift_date,
        start: toMinutes(shift.start_time),
        end: shift.is_open_ended ? DAY_END_MINUTES : toMinutes(shift.end_time),
      })),
    ]
    for (const candidate of candidateWindows) {
      const clash = occupied.find(window => windowsConflict(candidate, window))
      if (clash) {
        throw new Error(
          `This job clashes with a shift or application you already have on ${clash.date}. Keep at least 2 hours between jobs.`
        )
      }
    }
  }

  return { profile, age }
}
