// LAYER: Service
// RULE: Business logic only. No HTTP handling. No direct DB access.

import { recruitmentRepository } from '@/repositories/owner/recruitmentRepository'
import { workerApplicationRepository } from '@/repositories/guest/workerApplicationRepository'
import { emailService } from '@/services/email/emailService'
import { assertWorkerEligibleForJob } from '@/services/shared/workerEligibility'
import { sgtInstant } from '@/lib/singaporeTime'
import { JobApplicant, JobPosting, JobPostingInput, JobPostingPendingApproval, JobPostingSummary, PoolInviteResult, PoolWorker } from '@/types/Recruitment'

// A "confirmed" hire needs both sides: the Owner accepted the application AND the worker
// confirmed the invitation. Accepted-but-not-yet-confirmed sits in a separate "awaiting" bucket
// so the Owner can tell a filled position from one still waiting on the worker to respond.
function confirmedCount(rows: { status: string; invitation_status: string | null }[]): number {
  return rows.filter(r => r.status === 'accepted' && r.invitation_status === 'accepted').length
}
function awaitingConfirmationCount(rows: { status: string; invitation_status: string | null }[]): number {
  return rows.filter(r => r.status === 'accepted' && r.invitation_status !== 'accepted').length
}

// Candidate Management follows the Recruitment Owner principle: viewing a job (Job Visibility,
// department-wide) never implies permission to manage its applicants. A Manager may only view
// applicants, decide on them, or hand out offers for jobs THEY created — Owner/Partner postings
// and other Managers' postings in the same department stay view-only. Owner/Partner are never
// restricted (they own everything below them).
async function assertCanManageApplicants(job_id: string, actor_id: string): Promise<JobPosting> {
  const job = await recruitmentRepository.getJobPostingById(job_id)
  if (!job) throw new Error('Job posting not found')
  const role = await recruitmentRepository.getUserRole(actor_id)
  if (role === 'Manager' && job.created_by !== actor_id) {
    throw new Error('Only the recruitment owner can manage applicants for this job')
  }
  return job
}

// UC41/UC42: a Manager's Pending Approval submission can only be decided (approved or rejected)
// by Owner or Partner — a Manager, even the one who submitted it, is never a valid decider.
async function assertCanDecidePosting(actor_id: string): Promise<void> {
  const role = await recruitmentRepository.getUserRole(actor_id)
  if (role !== 'Owner' && role !== 'Partner') {
    throw new Error('Only Owner or Partner can approve or reject a job posting')
  }
}

// Shared by every "list of live/closed postings" entry point (company-wide, department-scoped) —
// resolves department names, applicant counts, and the handful of user names (creator, assigned
// employee, whoever rejected it) each summary card needs.
async function buildJobPostingSummaries(postings: JobPosting[]): Promise<JobPostingSummary[]> {
  const applicantRows = await recruitmentRepository.getApplicantCounts(postings.map(posting => posting.id))
  const deptIds = [...new Set(postings.map(posting => posting.department_id).filter((id): id is string => Boolean(id)))]
  const departments = await recruitmentRepository.getDepartmentsByIds(deptIds)
  const deptMap = new Map(departments.map(department => [department.id, department.name]))
  const empIds = [...new Set(postings.flatMap(posting => [posting.assigned_employee_id, posting.created_by, posting.rejected_by]).filter((id): id is string => Boolean(id)))]
  const employees = await recruitmentRepository.getUsersByIds(empIds)
  const empMap = new Map(employees.map(e => [e.id, e]))
  return postings.map(posting => {
    const rows = applicantRows.filter(row => row.job_id === posting.id)
    return {
      ...posting,
      department_name: posting.department_id ? deptMap.get(posting.department_id) ?? null : null,
      applicant_count: rows.length,
      pending_count: rows.filter(row => row.status === 'pending').length,
      accepted_count: rows.filter(row => row.status === 'accepted').length,
      confirmed_count: confirmedCount(rows),
      awaiting_confirmation_count: awaitingConfirmationCount(rows),
      assigned_employee_name: posting.assigned_employee_id ? empMap.get(posting.assigned_employee_id)?.full_name ?? null : null,
      assigned_employee_photo_url: posting.assigned_employee_id ? empMap.get(posting.assigned_employee_id)?.profile_photo_url ?? null : null,
      created_by_name: empMap.get(posting.created_by)?.full_name ?? null,
      rejected_by_name: posting.rejected_by ? empMap.get(posting.rejected_by)?.full_name ?? null : null,
    }
  })
}

export const recruitmentService = {
  async getPublicJobPostings(): Promise<JobPosting[]> {
    return recruitmentRepository.getPublicJobPostings()
  },

  // Lets any internal-staff view (e.g. an Owner reviewing a Casual Worker's attendance record)
  // look up the exact job posting a shift originated from, via Shift.source_job_posting_id.
  async getJobPostingById(id: string): Promise<JobPosting | null> {
    if (!id) throw new Error('id is required')
    return recruitmentRepository.getJobPostingById(id)
  },

  // UC43 Auto-Close: closes any 'open' posting whose application deadline has already passed.
  // Lazily run on-read (there is no cron/job-runner in this app — same pattern as
  // autoExpireSwapRequestIfNeeded in attendanceService), not a separate manual step.
  async sweepExpiredJobPostings(company_id?: string): Promise<void> {
    const ids = await recruitmentRepository.getExpiredOpenJobPostingIds(company_id)
    if (ids.length === 0) return
    await recruitmentRepository.closeJobPostingsByIds(ids)
  },

  async getJobPostingsByDepartment(company_id: string, department_id: string): Promise<JobPostingSummary[]> {
    if (!company_id || !department_id) throw new Error('company_id and department_id are required')
    await this.sweepExpiredJobPostings(company_id)
    const postings = await recruitmentRepository.getJobPostingsByDepartment(company_id, department_id)
    return buildJobPostingSummaries(postings)
  },

  async getJobPostings(company_id: string): Promise<JobPostingSummary[]> {
    if (!company_id) throw new Error('company_id is required')
    await this.sweepExpiredJobPostings(company_id)
    const postings = await recruitmentRepository.getJobPostingsByCompany(company_id)
    return buildJobPostingSummaries(postings)
  },

  // UC44 view applicants. Viewing is department-wide (same as Job Visibility) for any internal
  // viewer — deciding on them is what's Recruitment-Owner-only (see assertCanManageApplicants,
  // used by decideApplicant/removeConfirmedWorker instead). A Manager who didn't create this job
  // still sees who applied, just without Accept/Reject/Remove — those endpoints re-check ownership
  // themselves, so a client-side omission of the buttons isn't the only thing stopping a direct call.
  async getApplicants(job_id: string, viewer_id: string): Promise<JobApplicant[]> {
    if (!job_id) throw new Error('job_id is required')
    if (!viewer_id) throw new Error('viewer_id is required')
    const job = await recruitmentRepository.getJobPostingById(job_id)
    if (!job) throw new Error('Job posting not found')
    const applicants = await recruitmentRepository.getApplicantsByJob(job_id)
    const userIds = [...new Set(applicants.map(a => a.user_id).filter((id): id is string => Boolean(id)))]
    const cancellationCounts = await recruitmentRepository.getWorkerCancellationCounts(userIds)
    return applicants.map(applicant => ({
      ...applicant,
      worker_cancellation_count: applicant.user_id ? cancellationCounts.get(applicant.user_id) ?? 0 : 0,
    }))
  },

  // Removes ONE confirmed worker while the job itself keeps hiring: the opening is freed, the
  // job reopens if it had auto-closed on becoming full, and the worker is told why. Distinct
  // from cancelJob, where the work itself no longer exists.
  async removeConfirmedWorker(input: {
    job_id: string
    applicant_id: string
    removed_by: string
    reason: string
  }): Promise<void> {
    if (!input.job_id || !input.applicant_id || !input.removed_by) {
      throw new Error('job_id, applicant_id, and removed_by are required')
    }
    // Employer-side cancellation hits a worker who already committed — the reason is mandatory
    // and kept on record (worker-side cancellations only need a reason optionally).
    const reason = input.reason?.trim()
    if (!reason) throw new Error('A reason is required to remove a confirmed worker')

    const job = await assertCanManageApplicants(input.job_id, input.removed_by)
    const applicant = await recruitmentRepository.getApplicantById(input.applicant_id)
    if (!applicant || applicant.job_id !== input.job_id) throw new Error('Applicant not found on this job')
    if (!applicant.user_id) throw new Error('Applicant has no linked worker account')

    // Once the shift has started, Recruitment is over — no-shows and early leaves are the
    // Attendance module's business.
    const shifts = (await recruitmentRepository.getShiftsForJobWorker(input.job_id, applicant.user_id))
      .filter(shift => shift.status !== 'cancelled')
    const started = shifts.some(shift => new Date(`${shift.shift_date}T${shift.start_time}`).getTime() <= Date.now())
    if (started) throw new Error('This worker\'s shift has already started — handle it through Attendance instead')

    await recruitmentRepository.cancelShiftsByIds(shifts.map(shift => shift.id))
    await recruitmentRepository.cancelAcceptedInvitationByApplicant(input.applicant_id)
    // NOT "rejected" — the worker WAS hired and then cancelled on; the record must say so.
    await recruitmentRepository.setApplicantStatus(input.applicant_id, 'cancelled_by_employer')
    await recruitmentRepository.insertJobCancellation({
      job_id: input.job_id,
      applicant_id: input.applicant_id,
      cancelled_by: input.removed_by,
      cancelled_role: 'employer',
      reason,
    })

    // The opening is vacant again — reopen an auto-closed job unless its deadline has passed
    // (an expired posting must never silently reappear on the public board).
    const expired = Boolean(job.expires_at && new Date(job.expires_at) < new Date())
    if (job.status === 'closed' && !expired) {
      await recruitmentRepository.reopenJobPosting(input.job_id)
    }

    try {
      const contact = await recruitmentRepository.getUsersByIds([applicant.user_id])
      if (applicant.email_address) {
        await emailService.sendEngagementCancelledEmail({
          to: applicant.email_address,
          fullName: contact[0]?.full_name ?? applicant.full_name,
          jobTitle: job.title,
          companyName: job.company_name ?? 'the company',
          reason,
        })
      }
    } catch (err) {
      console.error('[removeConfirmedWorker] worker notification failed:', err)
    }
  },

  async createJobPosting(input: JobPostingInput): Promise<JobPosting> {
    validateJobPostingInput(input)
    // UC41: a Manager's posting must go through Owner/Partner approval — enforced here, not just
    // by the Manager UI omitting a "publish directly" button, since that client-side omission
    // alone can't stop a direct API call from publishing straight to 'open'.
    let status = input.status
    if (status !== 'draft') {
      const creatorRole = await recruitmentRepository.getUserRole(input.created_by)
      status = creatorRole === 'Manager' ? 'pending_approval' : status
    }
    const finalInput = { ...input, status }
    if (finalInput.status !== 'draft') await assertWithinSupervisorShift(finalInput)
    return recruitmentRepository.createJobPosting(finalInput)
  },

  // Owner/Partner's own drafts are shared only between the two of them (same as Templates).
  // A Manager's drafts are NOT shared even within their own department, unlike Templates — a
  // draft is a private in-progress scratchpad, not something ready to hand a peer (confirmed
  // 2026-07-23) — so a Manager only ever sees drafts they created themselves.
  // department_ids omitted (Owner/Partner viewer) → every draft created by Owner/Partner.
  // Passed (Manager viewer) → only drafts BOTH department-scoped to the manager AND created by
  // this exact viewer (viewer_id) — never a fellow Manager's.
  async getDraftPostings(company_id: string, department_ids?: string[], viewer_id?: string): Promise<JobPostingSummary[]> {
    if (!company_id) throw new Error('company_id is required')
    let postings = await recruitmentRepository.getDraftPostings(company_id, department_ids)
    if (department_ids) {
      postings = postings.filter(p => p.created_by === viewer_id)
    } else {
      const roleMap = await recruitmentRepository.getUserRolesByIds([...new Set(postings.map(p => p.created_by))])
      postings = postings.filter(p => {
        const role = roleMap.get(p.created_by)
        return role === 'Owner' || role === 'Partner'
      })
    }
    const deptIds = [...new Set(postings.map(p => p.department_id).filter((id): id is string => Boolean(id)))]
    const empIds = [...new Set(postings.flatMap(p => [p.assigned_employee_id, p.created_by]).filter((id): id is string => Boolean(id)))]
    const [departments, employees] = await Promise.all([
      recruitmentRepository.getDepartmentsByIds(deptIds),
      recruitmentRepository.getUsersByIds(empIds),
    ])
    const deptMap = new Map(departments.map(d => [d.id, d.name]))
    const empMap = new Map(employees.map(e => [e.id, e]))
    return postings.map(p => ({
      ...p,
      department_name: p.department_id ? deptMap.get(p.department_id) ?? null : null,
      applicant_count: 0,
      pending_count: 0,
      accepted_count: 0,
      confirmed_count: 0,
      awaiting_confirmation_count: 0,
      assigned_employee_name: p.assigned_employee_id ? empMap.get(p.assigned_employee_id)?.full_name ?? null : null,
      assigned_employee_photo_url: p.assigned_employee_id ? empMap.get(p.assigned_employee_id)?.profile_photo_url ?? null : null,
      created_by_name: empMap.get(p.created_by)?.full_name ?? null,
      // A draft was never submitted, so it can never carry a rejection record.
      rejected_by_name: null,
    }))
  },

  async publishDraft(id: string): Promise<JobPosting> {
    if (!id) throw new Error('job_id is required')
    const posting = await assertPublishable(id)
    // UC41: a Manager's draft must go to Owner/Partner approval (submitForReview), never straight
    // to 'open' — the Manager UI only offers "Submit for Review", but that's a client-side
    // omission alone; this stops a Manager's draft being published directly via this action too.
    const creatorRole = await recruitmentRepository.getUserRole(posting.created_by)
    if (creatorRole === 'Manager') {
      throw new Error('A Manager-created job must be submitted for Owner/Partner approval, not published directly')
    }
    return recruitmentRepository.updateJobPosting(id, { status: 'open' })
  },

  async submitForReview(id: string): Promise<JobPosting> {
    if (!id) throw new Error('job_id is required')
    await assertPublishable(id)
    // Resubmitting (e.g. after fixing a rejected posting) clears the old rejection record — a
    // fresh submission must not still show the previous reviewer's reason while it's pending again.
    return recruitmentRepository.updateJobPosting(id, { status: 'pending_approval', rejection_reason: null, rejected_by: null })
  },

  async deleteDraft(id: string): Promise<void> {
    if (!id) throw new Error('job_id is required')
    await recruitmentRepository.deleteJobPosting(id)
  },

  // actor_id: same rule as applicant management (assertCanManageApplicants) — a Manager may only
  // edit a posting they created themselves; Owner/Partner postings are view-only to them. Optional
  // so system/internal callers without a viewer context (e.g. tests) are unaffected.
  async editJobPosting(id: string, input: Partial<JobPostingInput>, actor_id?: string): Promise<JobPosting> {
    if (!id) throw new Error('job_id is required')
    if (input.title !== undefined && !input.title.trim()) throw new Error('title is required')
    if (input.responsibilities !== undefined && !input.responsibilities.trim()) throw new Error('responsibilities is required')
    if (input.minimum_age !== undefined) validateMinimumAge(input.minimum_age)
    if (input.openings !== undefined) validateOpenings(input.openings)

    const posting = actor_id ? await assertCanManageApplicants(id, actor_id) : await recruitmentRepository.getJobPostingById(id)
    if (!posting) throw new Error('Job posting not found')

    // Published jobs are immutable: applicants must never see different terms (pay, times,
    // requirements) than what they applied to. Only drafts and rejected postings — neither of
    // which was ever publicly visible — can be edited. To change a live job: archive it and
    // post a new one (or duplicate).
    const editable = posting.status === 'draft' || posting.status === 'rejected'
    if (!editable) {
      // Single exception: changing the application deadline (UC43) misleads no one
      // — existing applications are unaffected — and re-opening an expired job depends on it.
      const keys = Object.keys(input).filter(key => input[key as keyof JobPostingInput] !== undefined)
      const onlyDeadline = keys.length > 0 && keys.every(key => key === 'expires_at')
      if (!(posting.status === 'open' && onlyDeadline)) {
        throw new Error('A published job cannot be edited — archive it and post a new one, or duplicate it')
      }
    }

    return recruitmentRepository.updateJobPosting(id, input)
  },

  // Archiving closes the posting to applicants, so every application on it must already be
  // resolved: nothing left pending the Owner's decision, and nobody accepted who hasn't answered
  // their invitation yet. Archiving mid-decision would strand those applicants with no outcome.
  async archiveJobPosting(id: string, actor_id?: string): Promise<JobPosting> {
    if (!id) throw new Error('job_id is required')
    if (actor_id) await assertCanManageApplicants(id, actor_id)
    const rows = await recruitmentRepository.getApplicantCounts([id])
    const pending = rows.filter(row => row.status === 'pending').length
    const awaiting = awaitingConfirmationCount(rows)
    if (pending > 0 || awaiting > 0) {
      throw new Error('This job still has applications to resolve — decide the pending ones and wait for accepted workers to confirm before archiving')
    }
    const posting = await recruitmentRepository.getJobPostingById(id)
    if (!posting) throw new Error('Job posting not found')
    return recruitmentRepository.updateJobPosting(id, {
      status: 'archived',
      archived_at: new Date().toISOString(),
      // Remember whether this was Open or Closed so Unarchive can restore it, instead of
      // always reopening it to hiring.
      archived_from_status: posting.status,
    })
  },

  async unarchiveJobPosting(id: string): Promise<JobPosting> {
    if (!id) throw new Error('job_id is required')
    const posting = await recruitmentRepository.getJobPostingById(id)
    if (!posting) throw new Error('Job posting not found')
    return recruitmentRepository.updateJobPosting(id, {
      status: posting.archived_from_status === 'closed' ? 'closed' : 'open',
      archived_at: null,
      archived_from_status: null,
    })
  },

  // Permanently removes a posting. If workers were already confirmed on it, their scheduled
  // shifts are cancelled and they're emailed first — otherwise deleting the posting would strand
  // them with a live shift for work that no longer exists (the posting row is gone but the shift
  // survives via source_job_posting_id ON DELETE SET NULL).
  async deleteJobPosting(id: string, actor_id?: string): Promise<void> {
    if (!id) throw new Error('job_id is required')
    if (actor_id) await assertCanManageApplicants(id, actor_id)

    const job = await recruitmentRepository.getJobPostingById(id)
    const confirmedWorkers = job ? await recruitmentRepository.getConfirmedWorkersByJob(id) : []
    if (job && confirmedWorkers.length > 0) {
      const today = new Date()
      const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
      await recruitmentRepository.cancelFutureShiftsForJob(id, todayKey)

      // Notify each confirmed worker; a failed email must never block the deletion.
      for (const worker of confirmedWorkers) {
        try {
          if (worker.email_address) {
            await emailService.sendEngagementCancelledEmail({
              to: worker.email_address,
              fullName: worker.full_name,
              jobTitle: job.title,
              companyName: job.company_name ?? 'the company',
              reason: 'The job posting has been cancelled by the employer.',
            })
          }
        } catch (err) {
          console.error('[deleteJobPosting] worker notification failed:', err)
        }
      }
    }

    await recruitmentRepository.deleteJobPosting(id)
  },

  async duplicateJobPosting(id: string, created_by: string): Promise<JobPosting> {
    if (!id || !created_by) throw new Error('job_id and created_by are required')
    const original = await recruitmentRepository.getJobPostingById(id)
    if (!original) throw new Error('Job posting not found')
    // Duplicating a draft yields another draft; anything else republishes as a fresh open
    // posting — unless the duplicating user is a Manager, in which case it's UC41's approval
    // flow again (see createJobPosting's comment), not a direct publish.
    let duplicateStatus: 'draft' | 'open' | 'pending_approval' = original.status === 'draft' ? 'draft' : 'open'
    if (duplicateStatus !== 'draft') {
      const creatorRole = await recruitmentRepository.getUserRole(created_by)
      if (creatorRole === 'Manager') duplicateStatus = 'pending_approval'
    }
    return recruitmentRepository.createJobPosting({
      status: duplicateStatus,
      company_id: original.company_id,
      department_id: original.department_id,
      created_by,
      title: `${original.title} (copy)`,
      job_type: original.job_type,
      responsibilities: original.responsibilities,
      skills: original.skills,
      salary_amount: original.salary_amount,
      urgency: original.urgency,
      estimated_hours: original.estimated_hours,
      job_date: original.job_date,
      job_start_time: original.job_start_time,
      job_end_time: original.job_end_time,
      break_start_time: original.break_start_time,
      break_end_time: original.break_end_time,
      assigned_employee_id: original.assigned_employee_id,
      experience_required: original.experience_required,
      minimum_age: original.minimum_age,
      openings: original.openings,
      uniform_type: original.uniform_type,
      uniform_details: original.uniform_details,
    })
  },

  async decideApplicant(input: {
    applicant_id: string
    decision: 'accepted' | 'rejected'
    decided_by: string
  }): Promise<JobApplicant> {
    if (!input.applicant_id || !input.decision || !input.decided_by) {
      throw new Error('applicant_id, decision, and decided_by are required')
    }
    const applicant = await recruitmentRepository.getApplicantById(input.applicant_id)
    if (!applicant) throw new Error('Applicant not found')
    await assertCanManageApplicants(applicant.job_id, input.decided_by)
    // A worker who already confirmed the offer is a committed hire — reversing or re-deciding that
    // goes through removeConfirmedWorker (mandatory reason, shift cancellation, opening reopened),
    // not this quick accept/reject (re-accepting would duplicate the invitation and re-send email).
    if (applicant.invitation_status === 'accepted') {
      throw new Error('This worker already confirmed the offer — use Remove Worker instead')
    }
    const updated = await recruitmentRepository.updateApplicantStatus(input.applicant_id, input.decision)
    if (input.decision === 'accepted') {
      await recruitmentRepository.createJobInvitation({
        job_id: applicant.job_id,
        applicant_id: applicant.id,
        sent_by: input.decided_by,
      })

      // The worker isn't online 24/7 — an email closes the gap until they log in and confirm
      // the offer. A failed send must never roll back the acceptance itself.
      try {
        const job = await recruitmentRepository.getJobPostingById(applicant.job_id)
        if (applicant.email_address) {
          await emailService.sendApplicationAcceptedEmail({
            to: applicant.email_address,
            fullName: applicant.full_name,
            jobTitle: job?.title ?? 'a job',
            companyName: job?.company_name ?? 'the company',
          })
        }
      } catch (err) {
        console.error('[decideApplicant] acceptance email failed:', err)
      }
    } else if (input.decision === 'rejected') {
      // If the applicant had already been Accepted (an invitation sent, awaiting the worker's
      // reply), rescind it — a rejected applicant must not be able to still confirm a stale offer.
      // A no-op for a first-time pending -> rejected decision (no invitation exists yet).
      await recruitmentRepository.cancelSentInvitationByApplicant(input.applicant_id)

      // Close the loop so the worker isn't left waiting on "pending" forever. Never let an email
      // failure roll back the rejection.
      try {
        const job = await recruitmentRepository.getJobPostingById(applicant.job_id)
        if (applicant.email_address) {
          await emailService.sendApplicationRejectedEmail({
            to: applicant.email_address,
            fullName: applicant.full_name,
            jobTitle: job?.title ?? 'a job',
            companyName: job?.company_name ?? 'the company',
          })
        }
      } catch (err) {
        console.error('[decideApplicant] rejection email failed:', err)
      }
    }
    return updated
  },

  async getPendingApprovalPostings(company_id: string, include_rejected = false, department_ids?: string[]): Promise<JobPostingPendingApproval[]> {
    if (!company_id) throw new Error('company_id is required')
    return recruitmentRepository.getPendingApprovalPostings(company_id, include_rejected, department_ids)
  },

  // UC41: only Owner/Partner decide a Manager's pending submission — Manager (even the one who
  // submitted it) is not a valid approver.
  async approveJobPosting(id: string, approved_by: string): Promise<JobPosting> {
    if (!id) throw new Error('job_id is required')
    if (!approved_by) throw new Error('approved_by is required')
    await assertCanDecidePosting(approved_by)
    return recruitmentRepository.approveJobPosting(id)
  },

  // UC42: same approver restriction as approveJobPosting.
  async rejectJobPosting(id: string, rejection_reason: string, rejected_by: string): Promise<JobPosting> {
    if (!id) throw new Error('job_id is required')
    if (!rejection_reason?.trim()) throw new Error('rejection_reason is required')
    if (!rejected_by) throw new Error('rejected_by is required')
    await assertCanDecidePosting(rejected_by)
    return recruitmentRepository.rejectJobPosting(id, rejection_reason.trim(), rejected_by)
  },

  // The verified worker pool — people who already showed up and finished a shift here. These are
  // the regulars an Owner can hand a new job to directly instead of posting it publicly.
  // department_ids: a Manager only sees workers verified in their own department(s); undefined
  // (Owner/Partner) sees the whole company pool.
  async getPoolWorkers(company_id: string, department_ids?: string[]): Promise<PoolWorker[]> {
    if (!company_id) throw new Error('company_id is required')
    return recruitmentRepository.getVerifiedPoolWorkers(company_id, department_ids)
  },

  // Hand a posting straight to hand-picked pool workers. Each worker still has to clear every hard
  // gate the public apply flow enforces (ban, age, schedule clash) — an Owner must not be able to
  // offer a shift to someone already booked elsewhere that day. Workers are processed
  // independently so one ineligible pick never sinks the rest of the batch.
  //
  // The offer is not a booking: it lands as an invitation the worker still has to confirm, and
  // openings stay first-come-first-served (invite 5 for 2 slots and the first 2 to confirm win).
  async invitePoolWorkers(input: {
    job_id: string
    user_ids: string[]
    sent_by: string
  }): Promise<PoolInviteResult[]> {
    if (!input.job_id) throw new Error('job_id is required')
    if (!input.sent_by) throw new Error('sent_by is required')
    if (!input.user_ids?.length) throw new Error('At least one worker must be selected')

    const job = await assertCanManageApplicants(input.job_id, input.sent_by)
    if (job.status !== 'open') throw new Error('This job is not open for offers')

    const results: PoolInviteResult[] = []
    for (const user_id of input.user_ids) {
      const contact = await workerApplicationRepository.getUserContact(user_id)
      const full_name = contact?.full_name ?? ''
      try {
        const { profile } = await assertWorkerEligibleForJob({
          user_id,
          job,
          selfApply: false, // the Owner already employed them — they vouch for the experience
        })

        // They may have already applied to this posting on their own — reuse that row rather than
        // recording a second application for the same person.
        const existing = await recruitmentRepository.getApplicantByJobAndUser(input.job_id, user_id)
        if (existing && existing.status === 'accepted') {
          results.push({ user_id, full_name, invited: false, reason: 'Already offered this job' })
          continue
        }

        let applicantId: string
        if (existing) {
          await recruitmentRepository.updateApplicantStatus(existing.id, 'accepted')
          applicantId = existing.id
        } else {
          const certificates = await workerApplicationRepository.getApplicantCertificates(user_id)
          const created = await recruitmentRepository.createDirectApplicant({
            job_id: input.job_id,
            user_id,
            resume: profile.resume_url,
            skills: profile.skills,
            certificates: certificates.map(cert => ({ name: cert.name, file_url: cert.certificate_url })),
          })
          applicantId = created.id
        }

        await recruitmentRepository.createJobInvitation({
          job_id: input.job_id,
          applicant_id: applicantId,
          sent_by: input.sent_by,
        })

        // The worker isn't online 24/7; the email is what actually reaches them. Never let a failed
        // send roll back the offer itself.
        try {
          if (contact?.email_address) {
            await emailService.sendApplicationAcceptedEmail({
              to: contact.email_address,
              fullName: full_name,
              jobTitle: job.title,
              companyName: job.company_name ?? 'the company',
            })
          }
        } catch (err) {
          console.error('[invitePoolWorkers] offer email failed:', err)
        }

        results.push({ user_id, full_name, invited: true, reason: null })
      } catch (err) {
        results.push({
          user_id,
          full_name,
          invited: false,
          reason: err instanceof Error ? err.message : 'Could not offer this job',
        })
      }
    }
    return results
  },

}

function validateJobPostingInput(input: JobPostingInput): void {
  const isDraft = input.status === 'draft'
  if (!input.company_id || !input.created_by || !input.title?.trim()) {
    throw new Error('company_id, created_by, and title are required')
  }
  if (!isDraft && !input.responsibilities?.trim()) {
    throw new Error('responsibilities is required to publish a job')
  }
  if (input.salary_amount !== undefined && input.salary_amount !== null && input.salary_amount < 0) {
    throw new Error('salary_amount cannot be negative')
  }
  // One-off jobs have no fixed end time (the worker decides when the task is done), but they
  // still need a start time so UC49's Clock In gating has something to compare against — same
  // role job_start_time plays for Shift jobs.
  if (!isDraft && input.job_type === 'oneoff' && !input.job_start_time) {
    throw new Error('job_start_time is required to publish a one-off job')
  }
  // Shift jobs (unlike one-off) need a scheduled end time — that's the "schedule" half of the
  // required-field list alongside job_start_time.
  if (!isDraft && input.job_type !== 'oneoff' && !input.job_end_time) {
    throw new Error('job_end_time is required to publish a shift job')
  }
  // BUG-030: the date picker already refuses a past date, but the paired time field had no
  // matching check — picking today's date with an earlier-than-now start time (Shift Job or
  // One-off) published a job that was already expired the moment it went live.
  if (!isDraft && input.job_date && input.job_start_time) {
    if (sgtInstant(input.job_date, input.job_start_time).getTime() < Date.now()) {
      throw new Error('The job\'s start time cannot be in the past')
    }
  }
  // Every published casual-worker posting must name a responsible employee: the on-site contact
  // the worker reports to, and the supervising Employee the attendance approval chain starts at.
  if (!isDraft && !input.assigned_employee_id) {
    throw new Error('A responsible employee is required to publish a job')
  }
  // UC34: the rest of the "required to publish" field list — department, skills, experience,
  // minimum age, uniform, pay, and number of positions. Draft only ever needs a Title.
  if (!isDraft) {
    if (!input.department_id) throw new Error('department_id is required to publish a job')
    if (!input.skills?.trim()) throw new Error('skills is required to publish a job')
    if (!input.experience_required?.trim()) throw new Error('experience_required is required to publish a job')
    if (input.minimum_age === undefined || input.minimum_age === null) {
      throw new Error('minimum_age is required to publish a job')
    }
    if (!input.uniform_type?.trim()) throw new Error('uniform_type is required to publish a job')
    if (input.salary_amount === undefined || input.salary_amount === null) {
      throw new Error('salary_amount is required to publish a job')
    }
    if (input.openings === undefined || input.openings === null) {
      throw new Error('openings is required to publish a job')
    }
    // UC43: an explicit deadline choice is required to publish — expires_at alone can't tell
    // "chose No Deadline" apart from "hasn't chosen yet", so no_deadline carries that intent.
    if (!input.expires_at && !input.no_deadline) {
      throw new Error('Application deadline is required to publish — choose a date or "No Deadline"')
    }
  }
  validateMinimumAge(input.minimum_age)
  validateOpenings(input.openings)
}

// Minimum age is a hard eligibility gate compared against the applicant's date of birth, so it
// must be a plausible whole number — never free text like "21+".
function validateMinimumAge(minimum_age: number | null | undefined): void {
  if (minimum_age === undefined || minimum_age === null) return
  if (!Number.isInteger(minimum_age) || minimum_age < 13 || minimum_age > 99) {
    throw new Error('minimum_age must be a whole number between 13 and 99')
  }
}

function validateOpenings(openings: number | null | undefined): void {
  if (openings === undefined || openings === null) return
  if (!Number.isInteger(openings) || openings < 1) {
    throw new Error('openings must be a whole number of at least 1')
  }
}

// Guards the draft -> open / draft -> pending_approval transitions with the same rules
// createJobPosting applies to directly-published postings.
async function assertPublishable(id: string): Promise<JobPosting> {
  const posting = await recruitmentRepository.getJobPostingById(id)
  if (!posting) throw new Error('Job posting not found')
  if (!posting.responsibilities?.trim()) throw new Error('responsibilities is required to publish a job')
  if (!posting.assigned_employee_id) throw new Error('A responsible employee is required to publish a job')
  if (posting.job_type === 'oneoff' && !posting.job_start_time) {
    throw new Error('job_start_time is required to publish a one-off job')
  }
  if (posting.job_type !== 'oneoff' && !posting.job_end_time) {
    throw new Error('job_end_time is required to publish a shift job')
  }
  if (posting.job_date && posting.job_start_time && sgtInstant(posting.job_date, posting.job_start_time).getTime() < Date.now()) {
    throw new Error('The job\'s start time cannot be in the past')
  }
  // UC34: same required-to-publish field list as validateJobPostingInput — a draft only ever
  // needed a Title, so these are unchecked until the draft -> open/pending_approval transition.
  if (!posting.department_id) throw new Error('department_id is required to publish a job')
  if (!posting.skills?.trim()) throw new Error('skills is required to publish a job')
  if (!posting.experience_required?.trim()) throw new Error('experience_required is required to publish a job')
  if (posting.minimum_age === undefined || posting.minimum_age === null) {
    throw new Error('minimum_age is required to publish a job')
  }
  if (!posting.uniform_type?.trim()) throw new Error('uniform_type is required to publish a job')
  if (posting.salary_amount === undefined || posting.salary_amount === null) {
    throw new Error('salary_amount is required to publish a job')
  }
  if (posting.openings === undefined || posting.openings === null) {
    throw new Error('openings is required to publish a job')
  }
  if (!posting.expires_at && !posting.no_deadline) {
    throw new Error('Application deadline is required to publish — choose a date or "No Deadline"')
  }
  await assertWithinSupervisorShift(posting)
  return posting
}

// A casual worker must never be on site while their supervising employee is not: the worker's
// times must sit inside the supervisor's own shift that day (they may start later / finish
// earlier, never outside it). One-off jobs have no end time, so only their start is bounded.
// If the supervisor has no shift on the date the check is skipped — the posting UI only offers
// supervisors already scheduled that day, so this only happens for data created outside the UI.
async function assertWithinSupervisorShift(posting: {
  company_id: string
  job_type?: string | null
  assigned_employee_id?: string | null
  job_date?: string | null
  job_start_time?: string | null
  job_end_time?: string | null
}): Promise<void> {
  if (!posting.assigned_employee_id || !posting.job_date) return
  const supervisorShift = await recruitmentRepository.getEmployeeShiftOnDate(
    posting.assigned_employee_id, posting.company_id, posting.job_date,
  )
  if (!supervisorShift) return
  const hm = (t: string) => t.slice(0, 5)
  const fmt12 = (t: string) => {
    const [h, m] = hm(t).split(':').map(Number)
    const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h
    return `${h12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`
  }
  const supStart = hm(supervisorShift.start_time)
  const supEnd = hm(supervisorShift.end_time)
  if (posting.job_type === 'oneoff') {
    if (posting.job_start_time) {
      const start = hm(posting.job_start_time)
      if (start < supStart || start > supEnd) {
        throw new Error(`Start time must be within the supervisor's shift (${fmt12(supStart)} – ${fmt12(supEnd)})`)
      }
    }
  } else {
    if (posting.job_start_time && hm(posting.job_start_time) < supStart) {
      throw new Error(`Start time cannot be earlier than the supervisor's shift start (${fmt12(supStart)})`)
    }
    if (posting.job_end_time && hm(posting.job_end_time) > supEnd) {
      throw new Error(`End time cannot be later than the supervisor's shift end (${fmt12(supEnd)})`)
    }
  }
}

