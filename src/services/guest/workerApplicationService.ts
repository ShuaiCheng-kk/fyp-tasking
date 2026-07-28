// LAYER: Service
// RULE: Business logic only. No HTTP handling. No direct DB access.

import { workerApplicationRepository } from '@/repositories/guest/workerApplicationRepository'
import { shiftService } from '@/services/owner/shiftService'
import { recruitmentRepository } from '@/repositories/owner/recruitmentRepository'
import { emailService } from '@/services/email/emailService'
import {
  assertWorkerEligibleForJob,
  invitationHasExpired,
  type ConflictSourceJob,
} from '@/services/shared/workerEligibility'

type SubmitApplicationInput = {
  job_id: string
  user_id: string
  // Worker's explicit "I meet this requirement" confirmation — only meaningful when the job
  // has a hard experience minimum; ignored otherwise.
  meets_experience_requirement?: boolean
  additional_note?: string | null
}

const MAX_NOTE_LENGTH = 1000

export const workerApplicationService = {
  async submitApplication(input: SubmitApplicationInput) {
    if (!input.job_id) throw new Error('Job ID is required')
    if (!input.user_id) throw new Error('User ID is required')
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

    // Every hard gate (role, per-company ban, age, experience, schedule conflict) lives in the
    // shared eligibility module so an Owner-issued pool invite can't bypass a check this flow
    // enforces. See services/shared/workerEligibility.ts.
    const { profile } = await assertWorkerEligibleForJob({
      user_id: input.user_id,
      job,
      selfApply: true,
      meets_experience_requirement: input.meets_experience_requirement,
    })

    // Snapshot the profile at apply time — later profile edits must never change what the
    // employer saw on this application.
    const certificates = await workerApplicationRepository.getApplicantCertificates(input.user_id)

    return await workerApplicationRepository.createApplication({
      job_id: input.job_id,
      user_id: input.user_id,
      resume: profile.resume_url,
      additional_note: note,
      skills: profile.skills,
      certificates: certificates.map(cert => ({ name: cert.name, file_url: cert.certificate_url })),
    })
  },

  async getApplicationsByUser(userId: string) {
    if (!userId) throw new Error('User ID is required')

    const rows = await workerApplicationRepository.getApplicationsByUser(userId)

    return (rows ?? [])
      // Cases the worker should simply never see:
      // 1. The posting was hard-deleted by the employer — the join comes back null, and a card
      //    with placeholder text ("Job Opening" at "Company") tells the worker nothing.
      // 2. The application is still 'pending' but the posting's deadline has passed — the sweep
      //    archives the posting without resolving its applications, so without this filter the
      //    application would sit in "Pending Review" forever for a job that can no longer hire.
      // 3. The worker walked away themselves — 'withdrawn' covers withdrawing a pending
      //    application, declining an offer, AND cancelling a confirmed shift. It was their own
      //    decision, so it's just noise on their tracker; drop it rather than list an outcome.
      // 4. An offer the worker never confirmed before the shift began. The worker was emailed the
      //    moment the offer landed, so a missed offer is their own miss — it drops off the tracker
      //    rather than becoming a History card. Two shapes of the same thing:
      //      · invitation still 'sent' but the shift has since started — nothing marks these
      //        'expired' in the background (respondToInvitation only does it lazily, if they ever
      //        click Accept), so without this they'd sit in "Accept / Reject Job Offer" forever.
      //      · invitation already stamped 'expired' — same situation, just already discovered.
      // 5. The employer removed them from a job they'd confirmed. They're emailed the cancellation
      //    (and the shift itself is cancelled), so the tracker doesn't repeat it.
      //
      // What survives all this is exactly one kind of History card: applications the worker didn't
      // get — employer passed, role filled up, or the posting closed first ("Not Selected").
      .filter((row: Record<string, unknown>) => {
        const posting = row.job_postings as (ConflictSourceJob & { expires_at?: string | null }) | null
        if (!posting) return false
        if (row.status === 'withdrawn') return false
        if (row.status === 'cancelled_by_employer') return false
        if (row.status === 'pending' && posting.expires_at && new Date(posting.expires_at) < new Date()) return false

        const invitations = row.job_invitations as { status: string; sent_at: string }[] | { status: string; sent_at: string } | null
        const invitation = Array.isArray(invitations) ? invitations[0] : invitations
        if (invitation?.status === 'expired') return false
        if (invitation?.status === 'sent' && invitationHasExpired(posting, new Date(invitation.sent_at))) return false

        return true
      })
      // Flatten the joined department / company onto job_postings so an application renders with
      // the same shape (department_name, company_*) the public Job Board uses — same JobCard/detail view.
      .map((row: Record<string, unknown>) => {
        const posting = row.job_postings as Record<string, unknown>
        const departments = posting.departments as { name: string } | { name: string }[] | null
        const companies = posting.companies as
          | { location: string | null; description: string | null; size: string | null; address: string | null; industry: string | null }
          | Array<{ location: string | null; description: string | null; size: string | null; address: string | null; industry: string | null }>
          | null
        const dept = Array.isArray(departments) ? departments[0] : departments
        const company = Array.isArray(companies) ? companies[0] : companies
        const { departments: _d, companies: _c, ...rest } = posting
        return {
          ...row,
          job_postings: {
            ...rest,
            department_name: dept?.name ?? null,
            company_location: company?.location ?? null,
            company_description: company?.description ?? null,
            company_size: company?.size ?? null,
            company_address: company?.address ?? null,
            company_industry: company?.industry ?? null,
          },
        }
      })
  },

  // Only an application still awaiting the employer's decision can be pulled back — once they've
  // accepted or rejected it, withdrawing is no longer the worker's call to make.
  async withdrawApplication(applicationId: string) {
    if (!applicationId) throw new Error('Application ID is required')

    const withdrawn = await workerApplicationRepository.withdrawPendingApplication(applicationId)
    if (!withdrawn) throw new Error('Application not found or already processed.')
    return withdrawn
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
    if (job.job_type === 'shift' && job.job_start_time && job.job_end_time) {
      start_time = job.job_start_time
      end_time = job.job_end_time
    } else if (job.job_type === 'oneoff' && job.job_start_time) {
      start_time = job.job_start_time
      end_time = addOneHour(job.job_start_time)
      is_open_ended = true
    }
    if (job.department_id && job.job_date && start_time && end_time) {
      await shiftService.createShift({
        company_id: job.company_id,
        department_id: job.department_id,
        shift_date: job.job_date,
        start_time,
        end_time,
        created_by: job.created_by,
        publication_status: 'published',
        assigned_user_id: context.user_id,
        // The job posting's responsible employee becomes this shift's supervisor — the same
        // field taskRepository.getSupervisedCasualWorkerIds gates Employee->Casual Worker task
        // assignment on, so without it the worker's supervisor could never assign them tasks.
        supervisor_employee_id: job.assigned_employee_id ?? null,
        is_open_ended,
        source_job_posting_id: job.id,
        hourly_rate: job.salary_amount ?? null,
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
          shiftDate: job.job_date,
          startTime: (start_time ?? job.job_start_time)?.slice(0, 5) ?? null,
          location: job.company_location,
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
