import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase', () => ({
  supabase: {},
  createClient: () => ({}),
}))

vi.mock('@/repositories/owner/recruitmentRepository', () => ({
  recruitmentRepository: {
    getPublicJobPostings: vi.fn(),
    getJobPostingsByDepartment: vi.fn(),
    getJobPostingsForManager: vi.fn(),
    getJobPostingsByCompany: vi.fn(),
    getJobPostingsByManagerDepts: vi.fn(),
    getManagerDepartmentIds: vi.fn(),
    getApplicantCounts: vi.fn(),
    getDepartmentsByIds: vi.fn(),
    getUsersByIds: vi.fn(),
    getApplicantsByJob: vi.fn(),
    createJobPosting: vi.fn(),
    getDraftPostings: vi.fn(),
    updateJobPosting: vi.fn(),
    deleteJobPosting: vi.fn(),
    getJobPostingById: vi.fn(),
    getApplicantById: vi.fn(),
    updateApplicantStatus: vi.fn(),
    createJobInvitation: vi.fn(),
    getPendingApprovalPostings: vi.fn(),
    approveJobPosting: vi.fn(),
    rejectJobPosting: vi.fn(),
    getCasualWorkersByCompany: vi.fn(),
    getAcceptedCasualWorkersByAssignedEmployee: vi.fn(),
    updateCasualWorkerStatus: vi.fn(),
    sweepExpiredJobPostings: vi.fn(),
  },
}))

import { recruitmentService } from './recruitmentService'
import { recruitmentRepository } from '@/repositories/owner/recruitmentRepository'
import { JobPosting, JobApplicant, JobPostingInput } from '@/types/Recruitment'

const basePosting: JobPosting = {
  id: 'job-1',
  company_id: 'company-1',
  department_id: 'dept-1',
  created_by: 'owner-1',
  title: 'Weekend Cashier',
  description: 'Run the front register',
  requirements: null,
  location: null,
  employment_type: 'casual',
  status: 'open',
  is_recurring: false,
  recurrence_interval: null,
  recurrence_unit: null,
  archived_at: null,
  created_at: '2026-06-01T00:00:00.000Z',
  updated_at: '2026-06-01T00:00:00.000Z',
  company_name: null,
  company_location: null,
  company_description: null,
  company_size: null,
  company_address: null,
  company_industry: null,
  industry: null,
  salary_amount: null,
  salary_type: null,
  urgency: null,
  estimated_hours: null,
  shift_date: null,
  shift_start_time: null,
  shift_end_time: null,
  break_start_time: null,
  break_end_time: null,
  job_start_time: null,
  assigned_employee_id: null,
  rejection_reason: null,
  expires_at: null,
  template_id: null,
  experience_required: null,
  minimum_age: null,
  uniform_required: false,
  uniform_details: null,
}

const baseApplicant: JobApplicant = {
  id: 'applicant-1',
  job_id: 'job-1',
  user_id: 'user-1',
  full_name: 'Jane Applicant',
  email_address: 'jane@example.com',
  resume_url: null,
  cover_letter: null,
  status: 'pending',
  applied_at: '2026-06-01T00:00:00.000Z',
}

const baseInput: JobPostingInput = {
  company_id: 'company-1',
  created_by: 'owner-1',
  title: 'Weekend Cashier',
  description: 'Run the front register',
}

describe('recruitmentService — Recruitment', () => {
  beforeEach(() => {
    vi.clearAllMocks()
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

    it('throws when description is missing and not a draft', async () => {
      await expect(recruitmentService.createJobPosting({ ...baseInput, description: '' }))
        .rejects.toThrow('description is required to publish a job')
    })

    it('allows a blank description for a draft', async () => {
      vi.mocked(recruitmentRepository.createJobPosting).mockResolvedValue(basePosting)

      await recruitmentService.createJobPosting({ ...baseInput, description: '', status: 'draft' })

      expect(recruitmentRepository.createJobPosting).toHaveBeenCalled()
    })

    it('throws when salary_amount is negative', async () => {
      await expect(recruitmentService.createJobPosting({ ...baseInput, salary_amount: -5 }))
        .rejects.toThrow('salary_amount cannot be negative')
    })

    it('throws when publishing a one-off job without job_start_time', async () => {
      await expect(recruitmentService.createJobPosting({ ...baseInput, form_type: 'oneoff' }))
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
  })

  describe('editJobPosting (UC37)', () => {
    it('edits an existing job posting', async () => {
      vi.mocked(recruitmentRepository.updateJobPosting).mockResolvedValue({ ...basePosting, title: 'Updated' })

      const result = await recruitmentService.editJobPosting('job-1', { title: 'Updated' })

      expect(recruitmentRepository.updateJobPosting).toHaveBeenCalledWith('job-1', { title: 'Updated' })
      expect(result.title).toBe('Updated')
    })

    it('throws when job_id is missing', async () => {
      await expect(recruitmentService.editJobPosting('', {})).rejects.toThrow('job_id is required')
    })

    it('throws when title is provided but blank', async () => {
      await expect(recruitmentService.editJobPosting('job-1', { title: '   ' })).rejects.toThrow('title is required')
    })
  })

  describe('archive / unarchive / delete (UC38)', () => {
    it('archives a job posting and sets archived_at', async () => {
      vi.mocked(recruitmentRepository.updateJobPosting).mockResolvedValue({ ...basePosting, status: 'archived' })

      await recruitmentService.archiveJobPosting('job-1')

      expect(recruitmentRepository.updateJobPosting).toHaveBeenCalledWith('job-1', expect.objectContaining({ status: 'archived' }))
    })

    it('unarchives a job posting back to open', async () => {
      vi.mocked(recruitmentRepository.updateJobPosting).mockResolvedValue({ ...basePosting, status: 'open' })

      await recruitmentService.unarchiveJobPosting('job-1')

      expect(recruitmentRepository.updateJobPosting).toHaveBeenCalledWith('job-1', { status: 'open', archived_at: null })
    })

    it('deletes a job posting', async () => {
      await recruitmentService.deleteJobPosting('job-1')
      expect(recruitmentRepository.deleteJobPosting).toHaveBeenCalledWith('job-1')
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
  })

  describe('draft lifecycle (UC40)', () => {
    it('publishes a draft', async () => {
      vi.mocked(recruitmentRepository.updateJobPosting).mockResolvedValue({ ...basePosting, status: 'open' })
      await recruitmentService.publishDraft('job-1')
      expect(recruitmentRepository.updateJobPosting).toHaveBeenCalledWith('job-1', { status: 'open' })
    })

    it('deletes a draft', async () => {
      await recruitmentService.deleteDraft('job-1')
      expect(recruitmentRepository.deleteJobPosting).toHaveBeenCalledWith('job-1')
    })
  })

  describe('submitForReview (UC41)', () => {
    it('sets status to pending_approval', async () => {
      vi.mocked(recruitmentRepository.updateJobPosting).mockResolvedValue({ ...basePosting, status: 'pending_approval' })
      await recruitmentService.submitForReview('job-1')
      expect(recruitmentRepository.updateJobPosting).toHaveBeenCalledWith('job-1', { status: 'pending_approval' })
    })
  })

  describe('approve / reject (UC42)', () => {
    it('approves a pending job posting', async () => {
      vi.mocked(recruitmentRepository.approveJobPosting).mockResolvedValue({ ...basePosting, status: 'open' })
      await recruitmentService.approveJobPosting('job-1')
      expect(recruitmentRepository.approveJobPosting).toHaveBeenCalledWith('job-1')
    })

    it('rejects a pending job posting with a reason', async () => {
      vi.mocked(recruitmentRepository.rejectJobPosting).mockResolvedValue({ ...basePosting, status: 'rejected', rejection_reason: 'Missing details' })
      await recruitmentService.rejectJobPosting('job-1', 'Missing details')
      expect(recruitmentRepository.rejectJobPosting).toHaveBeenCalledWith('job-1', 'Missing details')
    })

    it('throws when rejecting without a reason', async () => {
      await expect(recruitmentService.rejectJobPosting('job-1', '  ')).rejects.toThrow('rejection_reason is required')
    })
  })

  describe('getApplicants (UC44)', () => {
    it('returns applicants with resolved full_name and email_address', async () => {
      vi.mocked(recruitmentRepository.getApplicantsByJob).mockResolvedValue([baseApplicant])

      const result = await recruitmentService.getApplicants('job-1')

      expect(result).toEqual([baseApplicant])
      expect(result[0].full_name).toBe('Jane Applicant')
      expect(result[0].email_address).toBe('jane@example.com')
    })

    it('throws when job_id is missing', async () => {
      await expect(recruitmentService.getApplicants('')).rejects.toThrow('job_id is required')
    })
  })

  describe('decideApplicant (UC45)', () => {
    it('accepts an applicant and sends a job invitation', async () => {
      vi.mocked(recruitmentRepository.getApplicantById).mockResolvedValue(baseApplicant)
      vi.mocked(recruitmentRepository.updateApplicantStatus).mockResolvedValue({ ...baseApplicant, status: 'accepted' })

      await recruitmentService.decideApplicant({ applicant_id: 'applicant-1', decision: 'accepted', decided_by: 'owner-1' })

      expect(recruitmentRepository.updateApplicantStatus).toHaveBeenCalledWith('applicant-1', 'accepted')
      expect(recruitmentRepository.createJobInvitation).toHaveBeenCalledWith(
        expect.objectContaining({ job_id: 'job-1', applicant_id: 'applicant-1', sent_by: 'owner-1' })
      )
    })

    it('rejects an applicant without sending an invitation', async () => {
      vi.mocked(recruitmentRepository.getApplicantById).mockResolvedValue(baseApplicant)
      vi.mocked(recruitmentRepository.updateApplicantStatus).mockResolvedValue({ ...baseApplicant, status: 'rejected' })

      await recruitmentService.decideApplicant({ applicant_id: 'applicant-1', decision: 'rejected', decided_by: 'owner-1' })

      expect(recruitmentRepository.createJobInvitation).not.toHaveBeenCalled()
    })

    it('throws when the applicant is not found', async () => {
      vi.mocked(recruitmentRepository.getApplicantById).mockResolvedValue(null)

      await expect(recruitmentService.decideApplicant({ applicant_id: 'missing', decision: 'accepted', decided_by: 'owner-1' }))
        .rejects.toThrow('Applicant not found')
    })
  })

  describe('updateCasualWorkerStatus', () => {
    it('throws on an invalid worker_status', async () => {
      await expect(recruitmentService.updateCasualWorkerStatus({ user_id: 'user-1', worker_status: 'bogus' as never }))
        .rejects.toThrow('worker_status must be active, inactive, or blocked')
    })

    it('updates a valid worker_status', async () => {
      await recruitmentService.updateCasualWorkerStatus({ user_id: 'user-1', worker_status: 'blocked' })
      expect(recruitmentRepository.updateCasualWorkerStatus).toHaveBeenCalledWith('user-1', 'blocked')
    })
  })
})
