// LAYER: Service
// RULE: Business logic only. No HTTP handling. No direct DB access.

import { casualShiftCancellationRepository } from '@/repositories/casual/casualShiftCancellationRepository'
import { emailService } from '@/services/email/emailService'

export const casualShiftCancellationService = {
  // A confirmed Casual Worker may back out of a shift any time BEFORE it starts (reason is
  // optional on the worker side). Once the shift has started, Recruitment is over — no-shows,
  // lateness and early leaves belong to the Attendance module, never to a cancel button.
  async cancelShift(input: { auth_id: string; shift_id: string; reason?: string | null }): Promise<void> {
    if (!input.auth_id) throw new Error('user_id is required')
    if (!input.shift_id) throw new Error('shift_id is required')

    const worker = await casualShiftCancellationRepository.getWorkerByAuthId(input.auth_id)
    if (!worker) throw new Error('Worker not found')

    const shift = await casualShiftCancellationRepository.getAssignedShift(input.shift_id, worker.id)
    if (!shift) throw new Error('Shift not found or not assigned to you')
    if (shift.status === 'cancelled') throw new Error('This shift is already cancelled')

    const shiftStart = new Date(`${shift.shift_date}T${shift.start_time}`)
    if (shiftStart.getTime() <= Date.now()) {
      throw new Error('This shift has already started — it can no longer be cancelled')
    }

    await casualShiftCancellationRepository.cancelShift(shift.id)

    const reason = input.reason?.trim() || null
    const job = shift.source_job_posting_id
      ? await casualShiftCancellationRepository.getJobPosting(shift.source_job_posting_id)
      : null

    // Kept forever as history (count visible to employers) — deliberately NOT a rating system.
    let applicantId: string | null = null
    if (job) {
      const applicant = await casualShiftCancellationRepository.findApplicant(job.id, worker.id)
      if (applicant) {
        applicantId = applicant.id
        await casualShiftCancellationRepository.cancelAcceptedInvitation(applicant.id)
        await casualShiftCancellationRepository.setApplicantStatus(applicant.id, 'withdrawn')
      }
      await casualShiftCancellationRepository.insertCancellation({
        job_id: job.id,
        applicant_id: applicantId,
        cancelled_by: worker.id,
        cancelled_role: 'worker',
        scope: 'worker',
        reason,
      })

      // The opening is vacant again. A job that auto-closed on becoming full reopens onto the
      // public board — unless its application deadline has passed, in which case it must NOT
      // silently reappear; the employer is told to extend the deadline or repost instead.
      const expired = Boolean(job.expires_at && new Date(job.expires_at) < new Date())
      const reopened = job.status === 'closed' && !expired
      if (reopened) {
        await casualShiftCancellationRepository.reopenJobPosting(job.id)
      }

      // Notify the employer: in-app message (existing Communication module) + email.
      // Neither may fail the cancellation itself.
      try {
        const ownerContact = await casualShiftCancellationRepository.getUserContact(job.created_by)
        const summary = `${worker.full_name} cancelled their confirmed shift for "${job.title}" on ${shift.shift_date}.` +
          (reason ? ` Reason: ${reason}` : '') +
          (reopened ? ' The job has been reopened on the job board.' : (expired && job.status === 'closed' ? ' The job\'s deadline has passed — extend it or post again to keep hiring.' : ''))
        await casualShiftCancellationRepository.insertMessage(worker.id, job.created_by, job.company_id, summary, worker.full_name)
        if (ownerContact) {
          await emailService.sendWorkerCancelledEmail({
            to: ownerContact.email_address,
            ownerName: ownerContact.full_name,
            workerName: worker.full_name,
            jobTitle: job.title,
            reason,
            reopened,
          })
        }
      } catch (err) {
        console.error('[cancelShift] employer notification failed:', err)
      }
    }
  },
}
