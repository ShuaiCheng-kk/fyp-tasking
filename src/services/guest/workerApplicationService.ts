// LAYER: Service
// RULE: Business logic only. No HTTP handling. No direct DB access.

import { workerApplicationRepository } from '@/repositories/guest/workerApplicationRepository'
import { shiftService } from '@/services/owner/shiftService'
import { recruitmentRepository } from '@/repositories/owner/recruitmentRepository'
import { emailService } from '@/services/email/emailService'

export type RelevantExperience = 'none' | 'less_than_1' | '1_to_2' | 'more_than_2'

type SubmitApplicationInput = {
  job_id: string
  user_id: string
  relevant_experience: RelevantExperience
  additional_note?: string | null
}

const RELEVANT_EXPERIENCE_VALUES: RelevantExperience[] = ['none', 'less_than_1', '1_to_2', 'more_than_2']

// Guest User is the applicant's starting role; a Casual Worker is the same person after their
// first job was confirmed, and they keep applying to new jobs. No other role may apply.
const APPLICANT_ROLES = ['Guest User', 'Casual Worker']
const MAX_NOTE_LENGTH = 1000

// Workers can stack jobs across different companies, but shifts must not collide — and since
// this platform is Singapore-wide, two hours is enough to travel between any two workplaces.
const MIN_GAP_MINUTES = 120
const DAY_END_MINUTES = 24 * 60 - 1
// How far ahead a recurring job's occurrences are expanded for conflict checking.
const RECURRING_HORIZON_DAYS = 60

// A single occupied slot on the worker's timeline, dates and times both nominal wall-clock.
type TimeWindow = { date: string; start: number; end: number }

type ConflictSourceJob = {
  form_type: string | null
  is_recurring: boolean | null
  shift_date: string | null
  shift_days: string[] | null
  shift_start_time: string | null
  shift_end_time: string | null
  job_start_time: string | null
}

export const workerApplicationService = {
  async submitApplication(input: SubmitApplicationInput) {
    if (!input.job_id) throw new Error('Job ID is required')
    if (!input.user_id) throw new Error('User ID is required')
    if (!RELEVANT_EXPERIENCE_VALUES.includes(input.relevant_experience)) {
      throw new Error('Please select your relevant experience for this role')
    }
    const note = input.additional_note?.trim() || null
    if (note && note.length > MAX_NOTE_LENGTH) {
      throw new Error(`Additional note must be at most ${MAX_NOTE_LENGTH} characters`)
    }

    // Guards against a stale/bookmarked apply link — the job board itself already hides
    // archived/expired postings, but a direct link could still reach this far.
    const job = await recruitmentRepository.getJobPostingById(input.job_id)
    if (!job || job.status !== 'open' || (job.expires_at && new Date(job.expires_at) < new Date())) {
      throw new Error('This job is no longer accepting applications')
    }

    const existing = await workerApplicationRepository.checkExistingApplication(
      input.job_id,
      input.user_id
    )
    if (existing) {
      throw new Error('You have already applied for this job.')
    }

    const profile = await workerApplicationRepository.getApplicantProfile(input.user_id)
    if (!profile) throw new Error('Worker profile not found')

    // Only the two worker roles may apply. Company staff (Owner/Partner/Manager/Employee) and
    // platform admins run the business — they never take casual jobs. The job board hides the
    // Apply button from them, and this backs that up against a direct API call.
    if (!APPLICANT_ROLES.includes(profile.role)) {
      throw new Error('Company staff accounts cannot apply for jobs')
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

    // Schedule-conflict gate: the applied job's time slots must not clash (with a 2h travel
    // buffer) with the worker's confirmed shifts or their other active applications — checked
    // across ALL companies, which only the platform can see.
    const candidateWindows = jobPostingWindows(job)
    if (candidateWindows.length > 0) {
      const [activeJobs, shiftRows] = await Promise.all([
        workerApplicationRepository.getActiveApplicationJobs(input.user_id),
        workerApplicationRepository.getFutureShiftWindows(input.user_id),
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

    // Snapshot the profile at apply time — later profile edits must never change what the
    // employer saw on this application.
    const certificates = await workerApplicationRepository.getApplicantCertificates(input.user_id)

    return await workerApplicationRepository.createApplication({
      job_id: input.job_id,
      user_id: input.user_id,
      resume_url: profile.resume_url,
      relevant_experience: input.relevant_experience,
      additional_note: note,
      skills_snapshot: profile.skills,
      certificates_snapshot: certificates.map(cert => ({ name: cert.name, file_url: cert.file_url })),
      age_at_apply: age,
    })
  },

  async getApplicationsByUser(userId: string) {
    if (!userId) throw new Error('User ID is required')

    return await workerApplicationRepository.getApplicationsByUser(userId)
  },

  async respondToInvitation(invitationId: string, response: 'accepted' | 'declined'): Promise<void> {
    if (!invitationId) throw new Error('Invitation ID is required')
    if (response !== 'accepted' && response !== 'declined') throw new Error('Invalid response')

    if (response === 'declined') {
      await workerApplicationRepository.updateInvitationStatus(invitationId, 'declined')
      // The worker walked away from the offer — mark the application withdrawn so the employer's
      // applicant list drops it (no point keeping a declined offer on screen).
      const invitation = await workerApplicationRepository.getInvitationBasic(invitationId)
      if (invitation) {
        await workerApplicationRepository.updateApplicantStatusById(invitation.applicant_id, 'withdrawn')
      }
      return
    }

    const context = await workerApplicationRepository.getInvitationContext(invitationId)
    if (!context) throw new Error('Invitation not found')
    const { job } = context

    // An offer nobody confirmed before the work begins is worthless — void it. For recurring
    // jobs the deadline is the first occurrence after the invitation was sent.
    if (invitationHasExpired(job, new Date(context.sent_at))) {
      await workerApplicationRepository.updateInvitationStatus(invitationId, 'expired')
      throw new Error('This offer has expired — the shift has already started')
    }

    // First-come-first-served: the owner may have accepted more applicants than openings, so
    // the confirmations race. The claim is atomic at the DB level (posting row lock).
    const claim = await workerApplicationRepository.claimJobOpening(invitationId)
    if (claim === 'position_filled') {
      throw new Error('This position has already been filled by another worker')
    }
    if (claim !== 'accepted') {
      throw new Error('This offer is no longer available')
    }

    await workerApplicationRepository.promoteGuestToWorker(context.user_id)
    if (job.department_id) {
      await workerApplicationRepository.addCasualWorkerToDepartment(context.user_id, job.department_id, job.company_id)
    }

    // UC49 gates Clock In/Out off a real shifts row — the moment the Casual Worker accepts,
    // create that shift (published immediately, since both sides already agreed to the work)
    // and assign them to it, mirroring how Manager/Employee shifts already work.
    let start_time: string | null = null
    let end_time: string | null = null
    let is_open_ended = false
    if (job.form_type === 'shift' && job.shift_start_time && job.shift_end_time) {
      start_time = job.shift_start_time
      end_time = job.shift_end_time
    } else if (job.form_type === 'oneoff' && job.job_start_time) {
      start_time = job.job_start_time
      end_time = addOneHour(job.job_start_time)
      is_open_ended = true
    }
    if (job.department_id && job.shift_date && start_time && end_time) {
      await shiftService.createShift({
        company_id: job.company_id,
        department_id: job.department_id,
        title: job.title,
        shift_date: job.shift_date,
        start_time,
        end_time,
        created_by: job.created_by,
        publication_status: 'published',
        assigned_user_id: context.user_id,
        is_open_ended,
        source_job_posting_id: job.id,
      })
    }

    // Last opening confirmed -> the job is filled: close it, take it off the public board, void
    // the remaining offers as position_filled, and resolve still-pending applications so nobody
    // is left waiting on a job that no longer exists.
    const acceptedCount = await workerApplicationRepository.countAcceptedInvitations(job.id)
    if (acceptedCount >= (job.openings ?? 1)) {
      await workerApplicationRepository.closeJobPosting(job.id)
      await workerApplicationRepository.markSentInvitationsPositionFilled(job.id)
      await workerApplicationRepository.markPendingApplicantsJobClosed(job.id)
    }

    // Confirmation email with everything needed to show up: when, where, and who to report to.
    // Email failures must never roll back a successful confirmation.
    try {
      const [worker, supervisor] = await Promise.all([
        workerApplicationRepository.getUserContact(context.user_id),
        job.assigned_employee_id
          ? workerApplicationRepository.getUserContact(job.assigned_employee_id)
          : Promise.resolve(null),
      ])
      if (worker) {
        await emailService.sendOfferConfirmedEmail({
          to: worker.email_address,
          fullName: worker.full_name,
          jobTitle: job.title,
          companyName: job.company_name ?? 'the company',
          shiftDate: job.shift_date,
          startTime: (start_time ?? job.job_start_time)?.slice(0, 5) ?? null,
          location: job.location,
          supervisorName: supervisor?.full_name ?? null,
          supervisorPhone: supervisor?.phone_number ?? null,
          supervisorEmail: supervisor?.email_address ?? null,
        })
      }
    } catch (err) {
      console.error('[respondToInvitation] confirmation email failed:', err)
    }
  },
}

// One-off jobs have an open-ended finish (the worker decides when the task is done, pay is
// flat-rate regardless), but the shifts table requires a non-null end_time — this is only a
// structural placeholder, never used to gate or limit Clock Out.
function addOneHour(time: string): string {
  const [h, m] = time.split(':').map(Number)
  const next = (h + 1) % 24
  return `${String(next).padStart(2, '0')}:${String(m ?? 0).padStart(2, '0')}`
}

function computeAge(dateOfBirth: string): number {
  const dob = new Date(`${dateOfBirth.slice(0, 10)}T00:00:00`)
  const now = new Date()
  let age = now.getFullYear() - dob.getFullYear()
  const hadBirthday =
    now.getMonth() > dob.getMonth() ||
    (now.getMonth() === dob.getMonth() && now.getDate() >= dob.getDate())
  if (!hadBirthday) age -= 1
  return age
}

function toMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + (m || 0)
}

function localDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

const WEEKDAY_INDEX: Record<string, number> = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 }

// Expands a job posting into the concrete time slots it would occupy on the worker's timeline.
//   one-off      -> start time to end of day (no fixed finish, reserved conservatively)
//   single shift -> its date and times
//   recurring    -> every occurrence (by shift_days weekdays, else weekly from shift_date)
//                   within RECURRING_HORIZON_DAYS of `from`
// Only slots on/after `from`'s date are returned — earlier occurrences can't clash with anything.
function jobPostingWindows(job: ConflictSourceJob, from: Date = new Date()): TimeWindow[] {
  const fromKey = localDateKey(from)

  if (job.form_type === 'oneoff') {
    if (!job.shift_date || !job.job_start_time || job.shift_date < fromKey) return []
    return [{ date: job.shift_date, start: toMinutes(job.job_start_time), end: DAY_END_MINUTES }]
  }

  if (!job.shift_start_time || !job.shift_end_time) return []
  const start = toMinutes(job.shift_start_time)
  let end = toMinutes(job.shift_end_time)
  if (end <= start) end = DAY_END_MINUTES

  if (!job.is_recurring) {
    if (!job.shift_date || job.shift_date < fromKey) return []
    return [{ date: job.shift_date, start, end }]
  }

  const weekdays = (job.shift_days ?? [])
    .map(day => WEEKDAY_INDEX[day.toLowerCase().slice(0, 3)])
    .filter((idx): idx is number => idx !== undefined)
  const anchor = job.shift_date ? new Date(`${job.shift_date}T00:00:00`) : new Date(from)
  const anchorWeekday = anchor.getDay()

  const windows: TimeWindow[] = []
  const cursor = new Date(from)
  cursor.setHours(0, 0, 0, 0)
  if (anchor > cursor) cursor.setTime(anchor.getTime())
  for (let i = 0; i < RECURRING_HORIZON_DAYS; i++) {
    const matches = weekdays.length > 0
      ? weekdays.includes(cursor.getDay())
      : cursor.getDay() === anchorWeekday
    if (matches) windows.push({ date: localDateKey(cursor), start, end })
    cursor.setDate(cursor.getDate() + 1)
  }
  return windows
}

function windowsConflict(a: TimeWindow, b: TimeWindow): boolean {
  if (a.date !== b.date) return false
  const gap = Math.max(b.start - a.end, a.start - b.end)
  return gap < MIN_GAP_MINUTES
}

// The invitation deadline is the FIRST shift occurrence after the invitation was sent — not
// whatever occurrence happens to be next today. A weekly-Saturday offer sent on Tuesday is for
// THIS Saturday; once that shift starts unconfirmed, the offer is dead and the employer re-sends
// for the following week if they still want the worker. Jobs with no schedule never auto-expire.
function invitationHasExpired(job: ConflictSourceJob, sentAt: Date): boolean {
  if (!job.shift_date) return false
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
