/**
 * RecruitmentService — business logic for the Recruitment module.
 *
 * Responsibilities:
 *   - Orchestrate job posting lifecycle (draft → open → closed)
 *   - Validate posting data before writing to the database
 *   - Trigger AI scoring when a new application arrives (via aiService)
 *   - Send notifications to relevant workers when a new job opens
 *   - Handle application review workflow (shortlist, reject, hire)
 *
 * This service calls:
 *   - jobRepository       for all database reads/writes
 *   - userRepository      to resolve workers for notifications
 *   - notificationService to dispatch notification events
 *   - aiService           to score incoming applications
 *
 * Never call the Supabase client directly here — always go through a repository.
 */

import {
  createPosting,
  updatePostingStatus,
  findPostingById,
  createApplication,
  updateApplicationStatus,
  findApplicationsByJob,
  type CreatePostingData,
  type PostingStatus,
  type ApplicationStatus,
} from '@/lib/repositories/jobRepository'
import { findUsersByRole } from '@/lib/repositories/userRepository'

// ---------------------------------------------------------------------------
// Job Posting management
// ---------------------------------------------------------------------------

/**
 * Create a new job posting in draft state.
 * Validates that slots > 0 and required_skills is non-empty before saving.
 */
export async function publishJobPosting(data: CreatePostingData) {
  if (data.slots < 1) throw new Error('Job posting must have at least 1 slot.')
  if (!data.required_skills.length) throw new Error('At least one required skill must be specified.')

  const posting = await createPosting(data)

  // Immediately open the posting after creation
  await updatePostingStatus(posting.id, 'open')

  // TODO: call notificationService.broadcastToWorkers({ jobId: posting.id })
  //       to notify all active casual workers about the new opening.

  return { ...posting, status: 'open' as PostingStatus }
}

/**
 * Close a job posting and optionally auto-reject all pending applications.
 */
export async function closeJobPosting(
  postingId: string,
  autoRejectPending = false,
) {
  const posting = await findPostingById(postingId)
  if (!posting) throw new Error('Job posting not found.')
  if (posting.status === 'closed') throw new Error('Posting is already closed.')

  await updatePostingStatus(postingId, 'closed')

  if (autoRejectPending) {
    const applications = await findApplicationsByJob(postingId)
    const pending = applications.filter((a) => a.status === 'pending')

    await Promise.all(
      pending.map((a) => updateApplicationStatus(a.id, 'rejected')),
    )
    // TODO: call notificationService to notify rejected applicants
  }
}

// ---------------------------------------------------------------------------
// Application workflow
// ---------------------------------------------------------------------------

/**
 * Submit a job application on behalf of a casual worker.
 * Checks that the posting is still open before inserting.
 * After insertion, triggers AI scoring asynchronously.
 */
export async function applyForJob(
  jobId: string,
  workerId: string,
  coverNote?: string,
) {
  const posting = await findPostingById(jobId)
  if (!posting) throw new Error('Job posting not found.')
  if (posting.status !== 'open') throw new Error('This job is no longer accepting applications.')

  const application = await createApplication(jobId, workerId, coverNote)

  // TODO: fire-and-forget AI scoring
  //   aiService.scoreApplication(application.id, posting.required_skills, workerId)
  //     .then((score) => updateApplicationStatus(application.id, 'pending', score))
  //     .catch(console.error)

  return application
}

/**
 * Shortlist an applicant.
 * Sends a notification to the worker informing them they have been shortlisted.
 */
export async function shortlistApplicant(applicationId: string) {
  await updateApplicationStatus(applicationId, 'shortlisted')
  // TODO: notificationService.sendApplicationUpdate(applicationId, 'shortlisted')
}

/**
 * Mark an applicant as hired and close remaining slots if headcount is reached.
 */
export async function hireApplicant(applicationId: string, jobId: string) {
  await updateApplicationStatus(applicationId, 'hired')

  const applications = await findApplicationsByJob(jobId)
  const hired = applications.filter((a) => a.status === 'hired')
  const posting = await findPostingById(jobId)

  if (posting && hired.length >= posting.slots) {
    await closeJobPosting(jobId, true)
  }
  // TODO: notificationService.sendApplicationUpdate(applicationId, 'hired')
}

/**
 * Reject an applicant and notify them.
 */
export async function rejectApplicant(applicationId: string) {
  await updateApplicationStatus(applicationId, 'rejected')
  // TODO: notificationService.sendApplicationUpdate(applicationId, 'rejected')
}
