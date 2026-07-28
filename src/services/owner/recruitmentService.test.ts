import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase', () => ({
  supabase: {},
  createClient: () => ({}),
}))

vi.mock('@/services/email/emailService', () => ({
  emailService: {
    sendApplicationAcceptedEmail: vi.fn(),
    sendApplicationRejectedEmail: vi.fn(),
    sendOfferConfirmedEmail: vi.fn(),
    sendEngagementCancelledEmail: vi.fn(),
  },
}))

vi.mock('@/repositories/owner/recruitmentRepository', () => ({
  recruitmentRepository: {
    getPublicJobPostings: vi.fn(),
    getJobPostingsByDepartment: vi.fn(),
    getJobPostingsByCompany: vi.fn(),
    getApplicantCounts: vi.fn(),
    getDepartmentsByIds: vi.fn(),
    getUsersByIds: vi.fn(),
    getUserRole: vi.fn(),
    getApplicantsByJob: vi.fn(),
    createJobPosting: vi.fn(),
    getDraftPostings: vi.fn(),
    getUserRolesByIds: vi.fn(),
    updateJobPosting: vi.fn(),
    deleteJobPosting: vi.fn(),
    getJobPostingById: vi.fn(),
    getApplicantById: vi.fn(),
    updateApplicantStatus: vi.fn(),
    createJobInvitation: vi.fn(),
    getPendingApprovalPostings: vi.fn(),
    approveJobPosting: vi.fn(),
    rejectJobPosting: vi.fn(),
    sweepExpiredJobPostings: vi.fn(),
    getWorkerCancellationCounts: vi.fn(),
    getConfirmedWorkersByJob: vi.fn(),
    setApplicantStatus: vi.fn(),
    cancelAcceptedInvitationByApplicant: vi.fn(),
    cancelSentInvitationByApplicant: vi.fn(),
    cancelOpenInvitationsForJob: vi.fn(),
    markPendingApplicantsJobClosed: vi.fn(),
    getEmployeeShiftOnDate: vi.fn(),
    getShiftsForJobWorker: vi.fn(),
    cancelShiftsByIds: vi.fn(),
    cancelFutureShiftsForJob: vi.fn(),
    insertJobCancellation: vi.fn(),
    reopenJobPosting: vi.fn(),
    getVerifiedPoolWorkers: vi.fn(),
    getApplicantByJobAndUser: vi.fn(),
    createDirectApplicant: vi.fn(),
  },
}))

vi.mock('@/repositories/guest/workerApplicationRepository', () => ({
  workerApplicationRepository: {
    getUserContact: vi.fn(),
    getApplicantCertificates: vi.fn(),
  },
}))

vi.mock('@/services/shared/workerEligibility', () => ({
  assertWorkerEligibleForJob: vi.fn(),
}))

import { recruitmentService } from './recruitmentService'
import { recruitmentRepository } from '@/repositories/owner/recruitmentRepository'
import { workerApplicationRepository } from '@/repositories/guest/workerApplicationRepository'
import { assertWorkerEligibleForJob } from '@/services/shared/workerEligibility'
import { emailService } from '@/services/email/emailService'
import { JobPosting, JobApplicant, JobPostingInput } from '@/types/Recruitment'

const basePosting: JobPosting = {
  id: 'job-1',
  company_id: 'company-1',
  department_id: 'dept-1',
  created_by: 'owner-1',
  title: 'Weekend Cashier',
  responsibilities: 'Run the front register',
  skills: null,
  status: 'open',
  archived_at: null,
  archived_from_status: null,
  created_at: '2026-06-01T00:00:00.000Z',
  updated_at: '2026-06-01T00:00:00.000Z',
  company_name: null,
  company_location: null,
  company_description: null,
  company_size: null,
  company_address: null,
  company_industry: null,
  salary_amount: null,
  urgency: null,
  estimated_hours: null,
  job_date: null,
  job_start_time: null,
  job_end_time: null,
  break_start_time: null,
  break_end_time: null,
  assigned_employee_id: 'emp-1',
  rejection_reason: null,
  rejected_by: null,
  expires_at: null,
  template_id: null,
  experience_required: null,
  minimum_age: null,
  openings: 1,
  job_type: null,
  uniform_type: 'none',
  uniform_details: null,
}

const baseApplicant: JobApplicant = {
  id: 'applicant-1',
  job_id: 'job-1',
  user_id: 'user-1',
  full_name: 'Jane Applicant',
  email_address: 'jane@example.com',
  phone_number: null,
  profile_photo_url: null,
  resume: null,
  status: 'pending',
  applied_at: '2026-06-01T00:00:00.000Z',
  additional_note: null,
  skills: null,
  certificates: null,
  ai_summary: null,
  ai_computed_at: null,
}

const baseInput: JobPostingInput = {
  company_id: 'company-1',
  created_by: 'owner-1',
  title: 'Weekend Cashier',
  responsibilities: 'Run the front register',
  assigned_employee_id: 'emp-1',
}

describe('recruitmentService — Recruitment', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(recruitmentRepository.getWorkerCancellationCounts).mockResolvedValue(new Map())
    // vi.clearAllMocks() clears call history but NOT a mockResolvedValue set by an earlier test —
    // without this reset, one test's getUserRole.mockResolvedValue('Manager') silently leaks into
    // every later test that calls a Candidate-Management-guarded action and never re-sets it.
    vi.mocked(recruitmentRepository.getUserRole).mockResolvedValue(null)
  })

  describe('createJobPosting (UC35)', () => {
    it('creates a job posting with valid input', async () => {
      vi.mocked(recruitmentRepository.createJobPosting).mockResolvedValue(basePosting)

      const result = await recruitmentService.createJobPosting(baseInput)

      expect(recruitmentRepository.createJobPosting).toHaveBeenCalledWith(baseInput)
      expect(result).toEqual(basePosting)
    })

    it('throws when title is missing', async () => {
      await expect(recruitmentService.createJobPosting({ ...baseInput, title: '' }))
        .rejects.toThrow('company_id, created_by, and title are required')
    })

    it('throws when responsibilities is missing and not a draft', async () => {
      await expect(recruitmentService.createJobPosting({ ...baseInput, responsibilities: '' }))
        .rejects.toThrow('responsibilities is required to publish a job')
    })

    it('allows a blank responsibilities for a draft', async () => {
      vi.mocked(recruitmentRepository.createJobPosting).mockResolvedValue(basePosting)

      await recruitmentService.createJobPosting({ ...baseInput, responsibilities: '', status: 'draft' })

      expect(recruitmentRepository.createJobPosting).toHaveBeenCalled()
    })

    it('throws when salary_amount is negative', async () => {
      await expect(recruitmentService.createJobPosting({ ...baseInput, salary_amount: -5 }))
        .rejects.toThrow('salary_amount cannot be negative')
    })

    it('throws when publishing a one-off job without job_start_time', async () => {
      await expect(recruitmentService.createJobPosting({ ...baseInput, job_type: 'oneoff' }))
        .rejects.toThrow('job_start_time is required to publish a one-off job')
    })

    it('persists expires_at when provided (UC43)', async () => {
      vi.mocked(recruitmentRepository.createJobPosting).mockResolvedValue({
        ...basePosting, expires_at: '2026-07-10T23:59:00.000Z',
      })

      await recruitmentService.createJobPosting({ ...baseInput, expires_at: '2026-07-10T23:59:00.000Z' })

      expect(recruitmentRepository.createJobPosting).toHaveBeenCalledWith(
        expect.objectContaining({ expires_at: '2026-07-10T23:59:00.000Z' })
      )
    })

    it('persists template_id when the posting was created from a template', async () => {
      vi.mocked(recruitmentRepository.createJobPosting).mockResolvedValue({
        ...basePosting, template_id: 'template-1',
      })

      await recruitmentService.createJobPosting({ ...baseInput, template_id: 'template-1' })

      expect(recruitmentRepository.createJobPosting).toHaveBeenCalledWith(
        expect.objectContaining({ template_id: 'template-1' })
      )
    })

    it('throws when publishing without a responsible employee', async () => {
      await expect(recruitmentService.createJobPosting({ ...baseInput, assigned_employee_id: null }))
        .rejects.toThrow('A responsible employee is required to publish a job')
    })

    it('allows a draft without a responsible employee', async () => {
      vi.mocked(recruitmentRepository.createJobPosting).mockResolvedValue(basePosting)

      await recruitmentService.createJobPosting({ ...baseInput, assigned_employee_id: null, status: 'draft' })

      expect(recruitmentRepository.createJobPosting).toHaveBeenCalled()
    })

    it('throws when minimum_age is not a plausible whole number', async () => {
      await expect(recruitmentService.createJobPosting({ ...baseInput, minimum_age: 7 }))
        .rejects.toThrow('minimum_age must be a whole number between 13 and 99')
      await expect(recruitmentService.createJobPosting({ ...baseInput, minimum_age: 21.5 }))
        .rejects.toThrow('minimum_age must be a whole number between 13 and 99')
    })

    it('throws when openings is below 1', async () => {
      await expect(recruitmentService.createJobPosting({ ...baseInput, openings: 0 }))
        .rejects.toThrow('openings must be a whole number of at least 1')
    })

    it('UC41: forces a Manager-created posting to pending_approval even if the caller asked for open', async () => {
      vi.mocked(recruitmentRepository.getUserRole).mockResolvedValue('Manager')
      vi.mocked(recruitmentRepository.createJobPosting).mockResolvedValue({ ...basePosting, status: 'pending_approval' })

      await recruitmentService.createJobPosting({ ...baseInput, status: 'open' })

      expect(recruitmentRepository.getUserRole).toHaveBeenCalledWith(baseInput.created_by)
      expect(recruitmentRepository.createJobPosting).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'pending_approval' })
      )
    })

    it('leaves an Owner-created posting as open', async () => {
      vi.mocked(recruitmentRepository.getUserRole).mockResolvedValue('Owner')
      vi.mocked(recruitmentRepository.createJobPosting).mockResolvedValue(basePosting)

      await recruitmentService.createJobPosting({ ...baseInput, status: 'open' })

      expect(recruitmentRepository.createJobPosting).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'open' })
      )
    })

    it('does not look up the creator role for a draft', async () => {
      vi.mocked(recruitmentRepository.createJobPosting).mockResolvedValue(basePosting)

      await recruitmentService.createJobPosting({ ...baseInput, responsibilities: '', assigned_employee_id: null, status: 'draft' })

      expect(recruitmentRepository.getUserRole).not.toHaveBeenCalled()
    })
  })

  describe('createJobPosting — worker times must sit inside the supervisor shift', () => {
    const supervisorShift = { start_time: '11:00:00', end_time: '20:00:00' }
    const shiftInput: JobPostingInput = {
      ...baseInput,
      job_type: 'shift',
      job_date: '2030-03-01',
      job_start_time: '11:00',
      job_end_time: '20:00',
    }

    it('rejects a shift job starting before the supervisor shift starts', async () => {
      vi.mocked(recruitmentRepository.getEmployeeShiftOnDate).mockResolvedValue(supervisorShift)
      await expect(recruitmentService.createJobPosting({ ...shiftInput, job_start_time: '10:30' }))
        .rejects.toThrow("Start time cannot be earlier than the supervisor's shift start (11:00 AM)")
    })

    it('rejects a shift job ending after the supervisor shift ends', async () => {
      vi.mocked(recruitmentRepository.getEmployeeShiftOnDate).mockResolvedValue(supervisorShift)
      await expect(recruitmentService.createJobPosting({ ...shiftInput, job_end_time: '20:30' }))
        .rejects.toThrow("End time cannot be later than the supervisor's shift end (8:00 PM)")
    })

    it('allows a shift job starting later and ending earlier than the supervisor', async () => {
      vi.mocked(recruitmentRepository.getEmployeeShiftOnDate).mockResolvedValue(supervisorShift)
      vi.mocked(recruitmentRepository.createJobPosting).mockResolvedValue(basePosting)
      await recruitmentService.createJobPosting({ ...shiftInput, job_start_time: '11:30', job_end_time: '19:00' })
      expect(recruitmentRepository.createJobPosting).toHaveBeenCalled()
      expect(recruitmentRepository.getEmployeeShiftOnDate).toHaveBeenCalledWith('emp-1', 'company-1', '2030-03-01')
    })

    it('rejects a one-off job starting outside the supervisor shift', async () => {
      vi.mocked(recruitmentRepository.getEmployeeShiftOnDate).mockResolvedValue(supervisorShift)
      const oneoffInput: JobPostingInput = { ...baseInput, job_type: 'oneoff', job_date: '2030-03-01', job_start_time: '10:30' }
      await expect(recruitmentService.createJobPosting(oneoffInput))
        .rejects.toThrow("Start time must be within the supervisor's shift (11:00 AM – 8:00 PM)")
      await expect(recruitmentService.createJobPosting({ ...oneoffInput, job_start_time: '20:30' }))
        .rejects.toThrow("Start time must be within the supervisor's shift (11:00 AM – 8:00 PM)")
    })

    it('allows a one-off job starting inside the supervisor shift', async () => {
      vi.mocked(recruitmentRepository.getEmployeeShiftOnDate).mockResolvedValue(supervisorShift)
      vi.mocked(recruitmentRepository.createJobPosting).mockResolvedValue(basePosting)
      await recruitmentService.createJobPosting({ ...baseInput, job_type: 'oneoff', job_date: '2030-03-01', job_start_time: '12:00' })
      expect(recruitmentRepository.createJobPosting).toHaveBeenCalled()
    })

    it('skips the check when the supervisor has no shift on that date', async () => {
      vi.mocked(recruitmentRepository.getEmployeeShiftOnDate).mockResolvedValue(null)
      vi.mocked(recruitmentRepository.createJobPosting).mockResolvedValue(basePosting)
      await recruitmentService.createJobPosting({ ...shiftInput, job_start_time: '08:00' })
      expect(recruitmentRepository.createJobPosting).toHaveBeenCalled()
    })

    it('skips the check for drafts', async () => {
      vi.mocked(recruitmentRepository.createJobPosting).mockResolvedValue(basePosting)
      await recruitmentService.createJobPosting({ ...shiftInput, status: 'draft', job_start_time: '08:00' })
      expect(recruitmentRepository.getEmployeeShiftOnDate).not.toHaveBeenCalled()
    })

    it('enforces the same window when publishing a draft', async () => {
      vi.mocked(recruitmentRepository.getJobPostingById).mockResolvedValue({
        ...basePosting, status: 'draft', job_type: 'shift',
        job_date: '2030-03-01', job_start_time: '10:00', job_end_time: '19:00',
      })
      vi.mocked(recruitmentRepository.getEmployeeShiftOnDate).mockResolvedValue(supervisorShift)
      await expect(recruitmentService.publishDraft('job-1'))
        .rejects.toThrow("Start time cannot be earlier than the supervisor's shift start (11:00 AM)")
    })
  })

  describe('editJobPosting — published jobs are immutable', () => {
    it('edits a draft posting', async () => {
      vi.mocked(recruitmentRepository.getJobPostingById).mockResolvedValue({ ...basePosting, status: 'draft' })
      vi.mocked(recruitmentRepository.updateJobPosting).mockResolvedValue({ ...basePosting, status: 'draft', title: 'Updated' })

      const result = await recruitmentService.editJobPosting('job-1', { title: 'Updated' })

      expect(recruitmentRepository.updateJobPosting).toHaveBeenCalledWith('job-1', { title: 'Updated' })
      expect(result.title).toBe('Updated')
    })

    it('edits a rejected posting so it can be fixed and resubmitted', async () => {
      vi.mocked(recruitmentRepository.getJobPostingById).mockResolvedValue({ ...basePosting, status: 'rejected' })
      vi.mocked(recruitmentRepository.updateJobPosting).mockResolvedValue({ ...basePosting, status: 'rejected', salary_amount: 18 })

      await recruitmentService.editJobPosting('job-1', { salary_amount: 18 })

      expect(recruitmentRepository.updateJobPosting).toHaveBeenCalled()
    })

    it('rejects any edit to an open (published) posting — applicants must never see changed terms', async () => {
      vi.mocked(recruitmentRepository.getJobPostingById).mockResolvedValue(basePosting)

      await expect(recruitmentService.editJobPosting('job-1', { salary_amount: 5 }))
        .rejects.toThrow('A published job cannot be edited')
      await expect(recruitmentService.editJobPosting('job-1', { title: 'Different Role' }))
        .rejects.toThrow('A published job cannot be edited')
      expect(recruitmentRepository.updateJobPosting).not.toHaveBeenCalled()
    })

    it('rejects edits to archived and pending_approval postings', async () => {
      vi.mocked(recruitmentRepository.getJobPostingById).mockResolvedValue({ ...basePosting, status: 'archived' })
      await expect(recruitmentService.editJobPosting('job-1', { responsibilities: 'x' }))
        .rejects.toThrow('A published job cannot be edited')

      vi.mocked(recruitmentRepository.getJobPostingById).mockResolvedValue({ ...basePosting, status: 'pending_approval' })
      await expect(recruitmentService.editJobPosting('job-1', { responsibilities: 'x' }))
        .rejects.toThrow('A published job cannot be edited')
    })

    it('allows extending only the application deadline on an open posting (UC43)', async () => {
      vi.mocked(recruitmentRepository.getJobPostingById).mockResolvedValue(basePosting)
      vi.mocked(recruitmentRepository.updateJobPosting).mockResolvedValue({ ...basePosting, expires_at: '2026-09-01T00:00:00.000Z' })

      await recruitmentService.editJobPosting('job-1', { expires_at: '2026-09-01T00:00:00.000Z' })

      expect(recruitmentRepository.updateJobPosting).toHaveBeenCalledWith('job-1', { expires_at: '2026-09-01T00:00:00.000Z' })

      // …but not the deadline bundled with anything else
      await expect(recruitmentService.editJobPosting('job-1', { expires_at: '2026-09-01T00:00:00.000Z', salary_amount: 5 }))
        .rejects.toThrow('A published job cannot be edited')
    })

    it('throws when job_id is missing', async () => {
      await expect(recruitmentService.editJobPosting('', {})).rejects.toThrow('job_id is required')
    })

    it('throws when title is provided but blank', async () => {
      await expect(recruitmentService.editJobPosting('job-1', { title: '   ' })).rejects.toThrow('title is required')
    })
  })

  describe('archive / unarchive / delete (UC38)', () => {
    it('archives a job posting and sets archived_at once every application is resolved', async () => {
      vi.mocked(recruitmentRepository.getApplicantCounts).mockResolvedValue([
        { job_id: 'job-1', status: 'rejected', invitation_status: null },
        { job_id: 'job-1', status: 'accepted', invitation_status: 'accepted' },
      ])
      vi.mocked(recruitmentRepository.getJobPostingById).mockResolvedValue({ ...basePosting, status: 'open' })
      vi.mocked(recruitmentRepository.updateJobPosting).mockResolvedValue({ ...basePosting, status: 'archived' })

      await recruitmentService.archiveJobPosting('job-1')

      expect(recruitmentRepository.updateJobPosting).toHaveBeenCalledWith('job-1', expect.objectContaining({ status: 'archived', archived_from_status: 'open' }))
    })

    it('refuses to archive while an application is still pending the Owner decision', async () => {
      vi.mocked(recruitmentRepository.getApplicantCounts).mockResolvedValue([
        { job_id: 'job-1', status: 'rejected', invitation_status: null },
        { job_id: 'job-1', status: 'pending', invitation_status: null },
      ])

      await expect(recruitmentService.archiveJobPosting('job-1'))
        .rejects.toThrow('This job still has applications to resolve')
      expect(recruitmentRepository.updateJobPosting).not.toHaveBeenCalled()
    })

    it('refuses to archive while an accepted worker has not confirmed their invitation yet', async () => {
      vi.mocked(recruitmentRepository.getApplicantCounts).mockResolvedValue([
        { job_id: 'job-1', status: 'accepted', invitation_status: 'sent' },
      ])

      await expect(recruitmentService.archiveJobPosting('job-1'))
        .rejects.toThrow('This job still has applications to resolve')
      expect(recruitmentRepository.updateJobPosting).not.toHaveBeenCalled()
    })

    it('archives a job nobody applied to', async () => {
      vi.mocked(recruitmentRepository.getApplicantCounts).mockResolvedValue([])
      vi.mocked(recruitmentRepository.getJobPostingById).mockResolvedValue({ ...basePosting, status: 'open' })
      vi.mocked(recruitmentRepository.updateJobPosting).mockResolvedValue({ ...basePosting, status: 'archived' })

      await recruitmentService.archiveJobPosting('job-1')

      expect(recruitmentRepository.updateJobPosting).toHaveBeenCalledWith('job-1', expect.objectContaining({ status: 'archived', archived_from_status: 'open' }))
    })

    it('archives a closed job, recording archived_from_status so it can be restored to Closed later', async () => {
      vi.mocked(recruitmentRepository.getApplicantCounts).mockResolvedValue([])
      vi.mocked(recruitmentRepository.getJobPostingById).mockResolvedValue({ ...basePosting, status: 'closed' })
      vi.mocked(recruitmentRepository.updateJobPosting).mockResolvedValue({ ...basePosting, status: 'archived', archived_from_status: 'closed' })

      await recruitmentService.archiveJobPosting('job-1')

      expect(recruitmentRepository.updateJobPosting).toHaveBeenCalledWith('job-1', expect.objectContaining({ status: 'archived', archived_from_status: 'closed' }))
    })

    it('unarchives a job posting back to open when it was open before archiving', async () => {
      vi.mocked(recruitmentRepository.getJobPostingById).mockResolvedValue({ ...basePosting, status: 'archived', archived_from_status: 'open' })
      vi.mocked(recruitmentRepository.updateJobPosting).mockResolvedValue({ ...basePosting, status: 'open' })

      await recruitmentService.unarchiveJobPosting('job-1')

      expect(recruitmentRepository.updateJobPosting).toHaveBeenCalledWith('job-1', { status: 'open', archived_at: null, archived_from_status: null })
    })

    it('unarchives a job posting back to closed when it was closed before archiving (regression: used to always reopen it)', async () => {
      vi.mocked(recruitmentRepository.getJobPostingById).mockResolvedValue({ ...basePosting, status: 'archived', archived_from_status: 'closed' })
      vi.mocked(recruitmentRepository.updateJobPosting).mockResolvedValue({ ...basePosting, status: 'closed' })

      await recruitmentService.unarchiveJobPosting('job-1')

      expect(recruitmentRepository.updateJobPosting).toHaveBeenCalledWith('job-1', { status: 'closed', archived_at: null, archived_from_status: null })
    })
  })

  describe('duplicateJobPosting (UC39)', () => {
    it('throws when the original posting is not found', async () => {
      vi.mocked(recruitmentRepository.getJobPostingById).mockResolvedValue(null)

      await expect(recruitmentService.duplicateJobPosting('job-1', 'owner-1')).rejects.toThrow('Job posting not found')
    })

    it('creates a copy with a "(copy)" suffix', async () => {
      vi.mocked(recruitmentRepository.getJobPostingById).mockResolvedValue(basePosting)
      vi.mocked(recruitmentRepository.createJobPosting).mockResolvedValue({ ...basePosting, id: 'job-2', title: 'Weekend Cashier (copy)' })

      const result = await recruitmentService.duplicateJobPosting('job-1', 'owner-1')

      expect(recruitmentRepository.createJobPosting).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Weekend Cashier (copy)', created_by: 'owner-1' })
      )
      expect(result.title).toBe('Weekend Cashier (copy)')
    })

    it('republishes a copy of a live posting as open', async () => {
      vi.mocked(recruitmentRepository.getJobPostingById).mockResolvedValue({ ...basePosting, status: 'open' })
      vi.mocked(recruitmentRepository.createJobPosting).mockResolvedValue({ ...basePosting, id: 'job-2' })

      await recruitmentService.duplicateJobPosting('job-1', 'owner-1')

      expect(recruitmentRepository.createJobPosting).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'open' })
      )
    })

    it('keeps a duplicated draft as a draft', async () => {
      vi.mocked(recruitmentRepository.getJobPostingById).mockResolvedValue({ ...basePosting, status: 'draft' })
      vi.mocked(recruitmentRepository.createJobPosting).mockResolvedValue({ ...basePosting, id: 'job-2', status: 'draft' })

      await recruitmentService.duplicateJobPosting('job-1', 'owner-1')

      expect(recruitmentRepository.createJobPosting).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'draft' })
      )
    })

    it('UC41: a Manager duplicating a live posting lands as pending_approval, not open', async () => {
      vi.mocked(recruitmentRepository.getJobPostingById).mockResolvedValue({ ...basePosting, status: 'open' })
      vi.mocked(recruitmentRepository.getUserRole).mockResolvedValue('Manager')
      vi.mocked(recruitmentRepository.createJobPosting).mockResolvedValue({ ...basePosting, id: 'job-2', status: 'pending_approval' })

      await recruitmentService.duplicateJobPosting('job-1', 'mgr-1')

      expect(recruitmentRepository.getUserRole).toHaveBeenCalledWith('mgr-1')
      expect(recruitmentRepository.createJobPosting).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'pending_approval' })
      )
    })
  })

  describe('draft lifecycle (UC40)', () => {
    it('publishes a draft', async () => {
      vi.mocked(recruitmentRepository.getJobPostingById).mockResolvedValue(basePosting)
      vi.mocked(recruitmentRepository.getUserRole).mockResolvedValue('Owner')
      vi.mocked(recruitmentRepository.updateJobPosting).mockResolvedValue({ ...basePosting, status: 'open' })
      await recruitmentService.publishDraft('job-1')
      expect(recruitmentRepository.updateJobPosting).toHaveBeenCalledWith('job-1', { status: 'open' })
    })

    it('UC41: refuses to publish a Manager-created draft directly, leaving it unpublished', async () => {
      vi.mocked(recruitmentRepository.getJobPostingById).mockResolvedValue(basePosting)
      vi.mocked(recruitmentRepository.getUserRole).mockResolvedValue('Manager')

      await expect(recruitmentService.publishDraft('job-1'))
        .rejects.toThrow('A Manager-created job must be submitted for Owner/Partner approval, not published directly')
      expect(recruitmentRepository.updateJobPosting).not.toHaveBeenCalled()
    })

    it('refuses to publish a draft without a responsible employee', async () => {
      vi.mocked(recruitmentRepository.getJobPostingById).mockResolvedValue({ ...basePosting, assigned_employee_id: null })

      await expect(recruitmentService.publishDraft('job-1'))
        .rejects.toThrow('A responsible employee is required to publish a job')
      expect(recruitmentRepository.updateJobPosting).not.toHaveBeenCalled()
    })

    it('deletes a draft', async () => {
      await recruitmentService.deleteDraft('job-1')
      expect(recruitmentRepository.deleteJobPosting).toHaveBeenCalledWith('job-1')
    })
  })

  describe('submitForReview (UC41)', () => {
    it('sets status to pending_approval and clears any earlier rejection record', async () => {
      vi.mocked(recruitmentRepository.getJobPostingById).mockResolvedValue(basePosting)
      vi.mocked(recruitmentRepository.updateJobPosting).mockResolvedValue({ ...basePosting, status: 'pending_approval' })
      await recruitmentService.submitForReview('job-1')
      expect(recruitmentRepository.updateJobPosting).toHaveBeenCalledWith('job-1', { status: 'pending_approval', rejection_reason: null, rejected_by: null })
    })

    it('refuses to submit for review without a responsible employee', async () => {
      vi.mocked(recruitmentRepository.getJobPostingById).mockResolvedValue({ ...basePosting, assigned_employee_id: null })

      await expect(recruitmentService.submitForReview('job-1'))
        .rejects.toThrow('A responsible employee is required to publish a job')
    })
  })

  describe('approve / reject (UC42)', () => {
    it('approves a pending job posting', async () => {
      vi.mocked(recruitmentRepository.approveJobPosting).mockResolvedValue({ ...basePosting, status: 'open' })
      await recruitmentService.approveJobPosting('job-1')
      expect(recruitmentRepository.approveJobPosting).toHaveBeenCalledWith('job-1')
    })

    it('rejects a pending job posting with a reason, recording who rejected it', async () => {
      vi.mocked(recruitmentRepository.rejectJobPosting).mockResolvedValue({ ...basePosting, status: 'rejected', rejection_reason: 'Missing details', rejected_by: 'owner-1' })
      await recruitmentService.rejectJobPosting('job-1', 'Missing details', 'owner-1')
      expect(recruitmentRepository.rejectJobPosting).toHaveBeenCalledWith('job-1', 'Missing details', 'owner-1')
    })

    it('throws when rejecting without a reason', async () => {
      await expect(recruitmentService.rejectJobPosting('job-1', '  ', 'owner-1')).rejects.toThrow('rejection_reason is required')
    })

    it('throws when rejecting without a rejected_by', async () => {
      await expect(recruitmentService.rejectJobPosting('job-1', 'Missing details', '')).rejects.toThrow('rejected_by is required')
    })
  })

  describe('getJobPostings — pending / confirmed / awaiting-confirmation counts', () => {
    it('splits applicants into pending, confirmed (both sides accepted), and awaiting worker confirmation', async () => {
      vi.mocked(recruitmentRepository.getJobPostingsByCompany).mockResolvedValue([{ ...basePosting, openings: 2 }])
      vi.mocked(recruitmentRepository.getApplicantCounts).mockResolvedValue([
        { job_id: 'job-1', status: 'pending', invitation_status: null },
        { job_id: 'job-1', status: 'pending', invitation_status: null },
        { job_id: 'job-1', status: 'accepted', invitation_status: 'accepted' },
        { job_id: 'job-1', status: 'accepted', invitation_status: 'sent' },
        { job_id: 'job-1', status: 'rejected', invitation_status: null },
      ])
      vi.mocked(recruitmentRepository.getDepartmentsByIds).mockResolvedValue([])
      vi.mocked(recruitmentRepository.getUsersByIds).mockResolvedValue([])

      const [result] = await recruitmentService.getJobPostings('company-1')

      expect(result.applicant_count).toBe(5)
      expect(result.pending_count).toBe(2)
      expect(result.confirmed_count).toBe(1)
      expect(result.awaiting_confirmation_count).toBe(1)
    })
  })

  describe('getApplicants (UC44)', () => {
    it('returns applicants with resolved full_name, email_address, and cancellation history count', async () => {
      vi.mocked(recruitmentRepository.getJobPostingById).mockResolvedValue(basePosting)
      vi.mocked(recruitmentRepository.getApplicantsByJob).mockResolvedValue([baseApplicant])
      vi.mocked(recruitmentRepository.getWorkerCancellationCounts).mockResolvedValue(new Map([['user-1', 2]]))

      const result = await recruitmentService.getApplicants('job-1', 'owner-1')

      expect(result[0].full_name).toBe('Jane Applicant')
      expect(result[0].email_address).toBe('jane@example.com')
      expect(result[0].worker_cancellation_count).toBe(2)
    })

    it('throws when job_id is missing', async () => {
      await expect(recruitmentService.getApplicants('', 'owner-1')).rejects.toThrow('job_id is required')
    })

    it('throws when viewer_id is missing', async () => {
      await expect(recruitmentService.getApplicants('job-1', '')).rejects.toThrow('viewer_id is required')
    })
  })

  describe('getPendingApprovalPostings — Waiting For Review (Manager Recruitment rules)', () => {
    it('defaults to pending_approval only (Owner/Partner queue)', async () => {
      vi.mocked(recruitmentRepository.getPendingApprovalPostings).mockResolvedValue([])

      await recruitmentService.getPendingApprovalPostings('company-1')

      expect(recruitmentRepository.getPendingApprovalPostings).toHaveBeenCalledWith('company-1', false)
    })

    it('passes include_rejected through for a Manager viewer (merges in their own rejected submissions)', async () => {
      vi.mocked(recruitmentRepository.getPendingApprovalPostings).mockResolvedValue([])

      await recruitmentService.getPendingApprovalPostings('company-1', true)

      expect(recruitmentRepository.getPendingApprovalPostings).toHaveBeenCalledWith('company-1', true)
    })

    it('throws when company_id is missing', async () => {
      await expect(recruitmentService.getPendingApprovalPostings('')).rejects.toThrow('company_id is required')
    })
  })

  describe('getDraftPostings — Drafts sharing (Manager Recruitment rules)', () => {
    const draftByOwner = { ...basePosting, id: 'draft-owner', status: 'draft' as const, created_by: 'owner-1' }
    const draftByManager = { ...basePosting, id: 'draft-mgr', status: 'draft' as const, created_by: 'mgr-1' }
    const draftByPeerManager = { ...basePosting, id: 'draft-mgr-2', status: 'draft' as const, created_by: 'mgr-2' }

    beforeEach(() => {
      vi.mocked(recruitmentRepository.getDepartmentsByIds).mockResolvedValue([])
      vi.mocked(recruitmentRepository.getUsersByIds).mockResolvedValue([])
    })

    it('returns only Owner/Partner-created drafts when no department scope is given (Owner/Partner viewer)', async () => {
      vi.mocked(recruitmentRepository.getDraftPostings).mockResolvedValue([draftByOwner, draftByManager])
      vi.mocked(recruitmentRepository.getUserRolesByIds).mockResolvedValue(new Map([['owner-1', 'Owner'], ['mgr-1', 'Manager']]))

      const result = await recruitmentService.getDraftPostings('company-1')

      expect(recruitmentRepository.getDraftPostings).toHaveBeenCalledWith('company-1', undefined)
      expect(result.map(d => d.id)).toEqual(['draft-owner'])
    })

    // Unlike Templates, Drafts are never shared even within the same department — a Manager only
    // ever sees drafts they created themselves, not a fellow Manager's, even department-scoped.
    it('keeps only the viewing Manager\'s own drafts, dropping both Owner/Partner and a peer Manager\'s', async () => {
      vi.mocked(recruitmentRepository.getDraftPostings).mockResolvedValue([draftByOwner, draftByManager, draftByPeerManager])

      const result = await recruitmentService.getDraftPostings('company-1', ['dept-1'], 'mgr-1')

      expect(recruitmentRepository.getDraftPostings).toHaveBeenCalledWith('company-1', ['dept-1'])
      expect(recruitmentRepository.getUserRolesByIds).not.toHaveBeenCalled()
      expect(result.map(d => d.id)).toEqual(['draft-mgr'])
    })
  })

  describe('Candidate Management is Recruitment-Owner-only (Manager Recruitment rules)', () => {
    // basePosting.created_by = 'owner-1'. Viewing applicants is department-wide, same as Job
    // Visibility — a Manager who didn't create the job still sees who applied. It's DECIDING on
    // them (accept/reject/remove/edit/archive/delete) that's Recruitment-Owner-only.
    it('allows a Manager to view applicants on a job they did not create', async () => {
      vi.mocked(recruitmentRepository.getJobPostingById).mockResolvedValue(basePosting)
      vi.mocked(recruitmentRepository.getApplicantsByJob).mockResolvedValue([baseApplicant])

      const result = await recruitmentService.getApplicants('job-1', 'mgr-2')

      expect(result).toHaveLength(1)
    })

    it('allows a Manager to view applicants on their own job', async () => {
      vi.mocked(recruitmentRepository.getJobPostingById).mockResolvedValue({ ...basePosting, created_by: 'mgr-1' })
      vi.mocked(recruitmentRepository.getUserRole).mockResolvedValue('Manager')
      vi.mocked(recruitmentRepository.getApplicantsByJob).mockResolvedValue([baseApplicant])

      const result = await recruitmentService.getApplicants('job-1', 'mgr-1')

      expect(result).toHaveLength(1)
    })

    it('never restricts an Owner/Partner viewer, regardless of who created the job', async () => {
      vi.mocked(recruitmentRepository.getJobPostingById).mockResolvedValue({ ...basePosting, created_by: 'mgr-1' })
      vi.mocked(recruitmentRepository.getUserRole).mockResolvedValue('Owner')
      vi.mocked(recruitmentRepository.getApplicantsByJob).mockResolvedValue([baseApplicant])

      const result = await recruitmentService.getApplicants('job-1', 'owner-1')

      expect(result).toHaveLength(1)
    })

    it('blocks a Manager from deciding on an applicant for a job they did not create', async () => {
      vi.mocked(recruitmentRepository.getApplicantById).mockResolvedValue(baseApplicant)
      vi.mocked(recruitmentRepository.getJobPostingById).mockResolvedValue(basePosting)
      vi.mocked(recruitmentRepository.getUserRole).mockResolvedValue('Manager')

      await expect(recruitmentService.decideApplicant({ applicant_id: 'applicant-1', decision: 'accepted', decided_by: 'mgr-2' }))
        .rejects.toThrow('Only the recruitment owner can manage applicants for this job')
      expect(recruitmentRepository.updateApplicantStatus).not.toHaveBeenCalled()
    })

    it('blocks a Manager from removing a confirmed worker on a job they did not create', async () => {
      vi.mocked(recruitmentRepository.getJobPostingById).mockResolvedValue(basePosting)
      vi.mocked(recruitmentRepository.getApplicantById).mockResolvedValue({ ...baseApplicant, status: 'accepted' })
      vi.mocked(recruitmentRepository.getUserRole).mockResolvedValue('Manager')

      await expect(recruitmentService.removeConfirmedWorker({
        job_id: 'job-1', applicant_id: 'applicant-1', removed_by: 'mgr-2', reason: 'Requirements changed',
      })).rejects.toThrow('Only the recruitment owner can manage applicants for this job')
      expect(recruitmentRepository.setApplicantStatus).not.toHaveBeenCalled()
    })

    it('blocks a Manager from inviting pool workers to a job they did not create', async () => {
      vi.mocked(recruitmentRepository.getJobPostingById).mockResolvedValue({ ...basePosting, status: 'open' })
      vi.mocked(recruitmentRepository.getUserRole).mockResolvedValue('Manager')

      await expect(recruitmentService.invitePoolWorkers({
        job_id: 'job-1', user_ids: ['cw-1'], sent_by: 'mgr-2',
      })).rejects.toThrow('Only the recruitment owner can manage applicants for this job')
      expect(recruitmentRepository.createDirectApplicant).not.toHaveBeenCalled()
    })

    it('blocks a Manager from editing a job they did not create when an actor_id is given', async () => {
      vi.mocked(recruitmentRepository.getJobPostingById).mockResolvedValue({ ...basePosting, status: 'draft' })
      vi.mocked(recruitmentRepository.getUserRole).mockResolvedValue('Manager')

      await expect(recruitmentService.editJobPosting('job-1', { title: 'New Title' }, 'mgr-2'))
        .rejects.toThrow('Only the recruitment owner can manage applicants for this job')
      expect(recruitmentRepository.updateJobPosting).not.toHaveBeenCalled()
    })

    it('blocks a Manager from archiving a job they did not create when an actor_id is given', async () => {
      vi.mocked(recruitmentRepository.getJobPostingById).mockResolvedValue(basePosting)
      vi.mocked(recruitmentRepository.getApplicantCounts).mockResolvedValue([])
      vi.mocked(recruitmentRepository.getUserRole).mockResolvedValue('Manager')

      await expect(recruitmentService.archiveJobPosting('job-1', 'mgr-2'))
        .rejects.toThrow('Only the recruitment owner can manage applicants for this job')
      expect(recruitmentRepository.updateJobPosting).not.toHaveBeenCalled()
    })

    it('blocks a Manager from deleting a job they did not create when an actor_id is given', async () => {
      vi.mocked(recruitmentRepository.getJobPostingById).mockResolvedValue(basePosting)
      vi.mocked(recruitmentRepository.getUserRole).mockResolvedValue('Manager')

      await expect(recruitmentService.deleteJobPosting('job-1', 'mgr-2'))
        .rejects.toThrow('Only the recruitment owner can manage applicants for this job')
      expect(recruitmentRepository.deleteJobPosting).not.toHaveBeenCalled()
    })

    it('allows editJobPosting/archiveJobPosting/deleteJobPosting when no actor_id is given (internal/system callers)', async () => {
      vi.mocked(recruitmentRepository.getJobPostingById).mockResolvedValue({ ...basePosting, status: 'draft' })
      vi.mocked(recruitmentRepository.updateJobPosting).mockResolvedValue({ ...basePosting, status: 'draft' })

      await expect(recruitmentService.editJobPosting('job-1', { title: 'New Title' })).resolves.toBeDefined()
      expect(recruitmentRepository.getUserRole).not.toHaveBeenCalled()
    })
  })

  describe('removeConfirmedWorker / cancelJob — employer-side exits', () => {
    const confirmedApplicant = { ...baseApplicant, status: 'accepted' as const }

    beforeEach(() => {
      vi.mocked(recruitmentRepository.getJobPostingById).mockResolvedValue(basePosting)
      vi.mocked(recruitmentRepository.getApplicantById).mockResolvedValue(confirmedApplicant)
      vi.mocked(recruitmentRepository.getShiftsForJobWorker).mockResolvedValue([
        { id: 'shift-1', shift_date: '2030-05-04', start_time: '09:00', status: 'active' },
      ])
      vi.mocked(recruitmentRepository.getUsersByIds).mockResolvedValue([{ id: 'user-1', full_name: 'Jane Applicant' } as never])
      vi.mocked(recruitmentRepository.getConfirmedWorkersByJob).mockResolvedValue([
        { invitation_id: 'inv-1', applicant_id: 'applicant-1', user_id: 'user-1', full_name: 'Jane Applicant', email_address: 'jane@example.com' },
      ])
    })

    it('removeConfirmedWorker requires a reason', async () => {
      await expect(recruitmentService.removeConfirmedWorker({
        job_id: 'job-1', applicant_id: 'applicant-1', removed_by: 'owner-1', reason: '   ',
      })).rejects.toThrow('A reason is required')
    })

    it('removeConfirmedWorker cancels the shift, marks the applicant cancelled_by_employer, and records history', async () => {
      await recruitmentService.removeConfirmedWorker({
        job_id: 'job-1', applicant_id: 'applicant-1', removed_by: 'owner-1', reason: 'Requirements changed',
      })

      expect(recruitmentRepository.cancelShiftsByIds).toHaveBeenCalledWith(['shift-1'])
      expect(recruitmentRepository.cancelAcceptedInvitationByApplicant).toHaveBeenCalledWith('applicant-1')
      // NOT 'rejected' — the worker WAS hired, then cancelled on.
      expect(recruitmentRepository.setApplicantStatus).toHaveBeenCalledWith('applicant-1', 'cancelled_by_employer')
      expect(recruitmentRepository.insertJobCancellation).toHaveBeenCalledWith(
        expect.objectContaining({ cancelled_role: 'employer', reason: 'Requirements changed' }),
      )
    })

    it('removeConfirmedWorker reopens a job that had auto-closed on becoming full', async () => {
      vi.mocked(recruitmentRepository.getJobPostingById).mockResolvedValue({ ...basePosting, status: 'closed' })

      await recruitmentService.removeConfirmedWorker({
        job_id: 'job-1', applicant_id: 'applicant-1', removed_by: 'owner-1', reason: 'Requirements changed',
      })

      expect(recruitmentRepository.reopenJobPosting).toHaveBeenCalledWith('job-1')
    })

    it('removeConfirmedWorker never reopens an expired job', async () => {
      vi.mocked(recruitmentRepository.getJobPostingById).mockResolvedValue({
        ...basePosting, status: 'closed', expires_at: '2020-01-01T00:00:00.000Z',
      })

      await recruitmentService.removeConfirmedWorker({
        job_id: 'job-1', applicant_id: 'applicant-1', removed_by: 'owner-1', reason: 'Requirements changed',
      })

      expect(recruitmentRepository.reopenJobPosting).not.toHaveBeenCalled()
    })

    it('removeConfirmedWorker refuses once the shift has started — Attendance owns it', async () => {
      vi.mocked(recruitmentRepository.getShiftsForJobWorker).mockResolvedValue([
        { id: 'shift-1', shift_date: '2020-01-01', start_time: '09:00', status: 'active' },
      ])

      await expect(recruitmentService.removeConfirmedWorker({
        job_id: 'job-1', applicant_id: 'applicant-1', removed_by: 'owner-1', reason: 'Too late',
      })).rejects.toThrow('Attendance')
      expect(recruitmentRepository.cancelShiftsByIds).not.toHaveBeenCalled()
    })

    // Deleting a posting is the "the whole job is off" action. Confirmed workers keep a real
    // shift after the posting row is gone (source_job_posting_id is ON DELETE SET NULL), so they
    // must be cancelled and told before the row disappears — otherwise they'd turn up for work.
    it('deleteJobPosting cancels confirmed workers\' shifts and emails them before deleting', async () => {
      await recruitmentService.deleteJobPosting('job-1')

      expect(recruitmentRepository.cancelFutureShiftsForJob).toHaveBeenCalledWith('job-1', expect.any(String))
      expect(emailService.sendEngagementCancelledEmail).toHaveBeenCalledWith(
        expect.objectContaining({ to: 'jane@example.com', jobTitle: 'Weekend Cashier' }),
      )
      expect(recruitmentRepository.deleteJobPosting).toHaveBeenCalledWith('job-1')
    })

    it('deleteJobPosting skips the cancellation side effects when nobody was confirmed', async () => {
      vi.mocked(recruitmentRepository.getConfirmedWorkersByJob).mockResolvedValue([])

      await recruitmentService.deleteJobPosting('job-1')

      expect(recruitmentRepository.cancelFutureShiftsForJob).not.toHaveBeenCalled()
      expect(emailService.sendEngagementCancelledEmail).not.toHaveBeenCalled()
      expect(recruitmentRepository.deleteJobPosting).toHaveBeenCalledWith('job-1')
    })
  })

  describe('decideApplicant (UC45)', () => {
    it('accepts an applicant and sends a job invitation', async () => {
      vi.mocked(recruitmentRepository.getApplicantById).mockResolvedValue(baseApplicant)
      vi.mocked(recruitmentRepository.getJobPostingById).mockResolvedValue(basePosting)
      vi.mocked(recruitmentRepository.updateApplicantStatus).mockResolvedValue({ ...baseApplicant, status: 'accepted' })

      await recruitmentService.decideApplicant({ applicant_id: 'applicant-1', decision: 'accepted', decided_by: 'owner-1' })

      expect(recruitmentRepository.updateApplicantStatus).toHaveBeenCalledWith('applicant-1', 'accepted')
      expect(recruitmentRepository.createJobInvitation).toHaveBeenCalledWith(
        expect.objectContaining({ job_id: 'job-1', applicant_id: 'applicant-1', sent_by: 'owner-1' })
      )
    })

    it('rejects an applicant without sending an invitation, but emails them the outcome', async () => {
      vi.mocked(recruitmentRepository.getApplicantById).mockResolvedValue(baseApplicant)
      vi.mocked(recruitmentRepository.updateApplicantStatus).mockResolvedValue({ ...baseApplicant, status: 'rejected' })
      vi.mocked(recruitmentRepository.getJobPostingById).mockResolvedValue(basePosting)

      await recruitmentService.decideApplicant({ applicant_id: 'applicant-1', decision: 'rejected', decided_by: 'owner-1' })

      expect(recruitmentRepository.createJobInvitation).not.toHaveBeenCalled()
      expect(emailService.sendApplicationRejectedEmail).toHaveBeenCalledWith(
        expect.objectContaining({ to: 'jane@example.com', jobTitle: 'Weekend Cashier' }),
      )
    })

    it('rescinds a still-open invitation when rejecting an applicant the owner had already accepted', async () => {
      // Accepted, but the worker hasn't confirmed yet — invitation_status is 'sent', not 'accepted'.
      const awaitingWorker = { ...baseApplicant, status: 'accepted' as const, invitation_status: 'sent' }
      vi.mocked(recruitmentRepository.getApplicantById).mockResolvedValue(awaitingWorker)
      vi.mocked(recruitmentRepository.updateApplicantStatus).mockResolvedValue({ ...awaitingWorker, status: 'rejected' })
      vi.mocked(recruitmentRepository.getJobPostingById).mockResolvedValue(basePosting)

      await recruitmentService.decideApplicant({ applicant_id: 'applicant-1', decision: 'rejected', decided_by: 'owner-1' })

      expect(recruitmentRepository.cancelSentInvitationByApplicant).toHaveBeenCalledWith('applicant-1')
    })

    it('refuses to reject an applicant who already confirmed the offer — must use Remove Worker', async () => {
      const confirmed = { ...baseApplicant, status: 'accepted' as const, invitation_status: 'accepted' }
      vi.mocked(recruitmentRepository.getApplicantById).mockResolvedValue(confirmed)
      vi.mocked(recruitmentRepository.getJobPostingById).mockResolvedValue(basePosting)

      await expect(recruitmentService.decideApplicant({ applicant_id: 'applicant-1', decision: 'rejected', decided_by: 'owner-1' }))
        .rejects.toThrow('use Remove Worker instead')
      expect(recruitmentRepository.updateApplicantStatus).not.toHaveBeenCalled()
    })

    it('throws when the applicant is not found', async () => {
      vi.mocked(recruitmentRepository.getApplicantById).mockResolvedValue(null)

      await expect(recruitmentService.decideApplicant({ applicant_id: 'missing', decision: 'accepted', decided_by: 'owner-1' }))
        .rejects.toThrow('Applicant not found')
    })
  })

  describe('invitePoolWorkers — hand-offering a job to workers who already worked here', () => {
    const poolJob = { id: 'job-1', status: 'open', title: 'Weekend Barista', company_name: 'Acme' }

    beforeEach(() => {
      vi.mocked(recruitmentRepository.getJobPostingById).mockResolvedValue(poolJob as never)
      vi.mocked(recruitmentRepository.getApplicantByJobAndUser).mockResolvedValue(null)
      vi.mocked(recruitmentRepository.createDirectApplicant).mockResolvedValue({ id: 'applicant-new' } as never)
      vi.mocked(workerApplicationRepository.getApplicantCertificates).mockResolvedValue([])
      vi.mocked(workerApplicationRepository.getUserContact).mockImplementation(
        async (userId: string) => ({ full_name: `Worker ${userId}`, email_address: `${userId}@x.com`, phone_number: null }),
      )
      vi.mocked(assertWorkerEligibleForJob).mockResolvedValue({
        profile: { id: 'cw-1', role: 'Casual Worker', date_of_birth: '2000-01-01', skills: 'Barista', resume_url: null },
        age: 26,
      } as never)
    })

    it('records the application on the worker\'s behalf and sends them an invitation', async () => {
      const results = await recruitmentService.invitePoolWorkers({
        job_id: 'job-1', user_ids: ['cw-1'], sent_by: 'owner-1',
      })

      expect(recruitmentRepository.createDirectApplicant).toHaveBeenCalledWith(expect.objectContaining({
        job_id: 'job-1', user_id: 'cw-1', skills: 'Barista',
      }))
      expect(recruitmentRepository.createJobInvitation).toHaveBeenCalledWith(expect.objectContaining({
        job_id: 'job-1', applicant_id: 'applicant-new', sent_by: 'owner-1',
      }))
      expect(emailService.sendApplicationAcceptedEmail).toHaveBeenCalled()
      expect(results).toEqual([{ user_id: 'cw-1', full_name: 'Worker cw-1', invited: true, reason: null }])
    })

    // The Owner must not be able to offer a shift to someone already booked elsewhere that day —
    // the pool invite runs the exact same hard gates as the public apply flow.
    it('skips a worker who fails a hard gate, reports why, and still invites the rest of the batch', async () => {
      vi.mocked(assertWorkerEligibleForJob).mockImplementation(async ({ user_id }) => {
        if (user_id === 'cw-clash') throw new Error('This job clashes with a shift or application you already have on 2030-05-20.')
        return { profile: { id: user_id, role: 'Casual Worker', date_of_birth: null, skills: null, resume_url: null }, age: null }
      })

      const results = await recruitmentService.invitePoolWorkers({
        job_id: 'job-1', user_ids: ['cw-clash', 'cw-ok'], sent_by: 'owner-1',
      })

      expect(results[0]).toMatchObject({ user_id: 'cw-clash', invited: false })
      expect(results[0].reason).toContain('clashes')
      expect(results[1]).toMatchObject({ user_id: 'cw-ok', invited: true, reason: null })
      // The clashing worker never got an application or an invitation.
      expect(recruitmentRepository.createDirectApplicant).toHaveBeenCalledTimes(1)
      expect(recruitmentRepository.createJobInvitation).toHaveBeenCalledTimes(1)
    })

    it('reuses an application the worker already submitted instead of recording a second one', async () => {
      vi.mocked(recruitmentRepository.getApplicantByJobAndUser).mockResolvedValue({ id: 'applicant-existing', status: 'pending' } as never)

      const results = await recruitmentService.invitePoolWorkers({
        job_id: 'job-1', user_ids: ['cw-1'], sent_by: 'owner-1',
      })

      expect(recruitmentRepository.createDirectApplicant).not.toHaveBeenCalled()
      expect(recruitmentRepository.updateApplicantStatus).toHaveBeenCalledWith('applicant-existing', 'accepted')
      expect(recruitmentRepository.createJobInvitation).toHaveBeenCalledWith(expect.objectContaining({
        applicant_id: 'applicant-existing',
      }))
      expect(results[0].invited).toBe(true)
    })

    it('does not re-offer a job the worker has already been offered', async () => {
      vi.mocked(recruitmentRepository.getApplicantByJobAndUser).mockResolvedValue({ id: 'applicant-1', status: 'accepted' } as never)

      const results = await recruitmentService.invitePoolWorkers({
        job_id: 'job-1', user_ids: ['cw-1'], sent_by: 'owner-1',
      })

      expect(results[0]).toMatchObject({ invited: false, reason: 'Already offered this job' })
      expect(recruitmentRepository.createJobInvitation).not.toHaveBeenCalled()
    })

    it('rejects an empty selection and a job that is not open', async () => {
      await expect(recruitmentService.invitePoolWorkers({ job_id: 'job-1', user_ids: [], sent_by: 'owner-1' }))
        .rejects.toThrow('At least one worker must be selected')

      vi.mocked(recruitmentRepository.getJobPostingById).mockResolvedValue({ ...poolJob, status: 'closed' } as never)
      await expect(recruitmentService.invitePoolWorkers({ job_id: 'job-1', user_ids: ['cw-1'], sent_by: 'owner-1' }))
        .rejects.toThrow('not open for offers')
    })
  })

})
