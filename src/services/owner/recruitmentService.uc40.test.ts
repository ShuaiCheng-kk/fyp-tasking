import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase', () => ({
  supabase: {},
  createClient: () => ({}),
}))

vi.mock('@/services/email/emailService', () => ({
  emailService: {
    sendInviteEmail: vi.fn(),
    sendRemovedFromCompanyEmail: vi.fn(),
  },
}))

vi.mock('@/repositories/owner/recruitmentRepository', () => ({
  recruitmentRepository: {
    createJobPosting: vi.fn(),
    getUserRole: vi.fn(),
    getEmployeeShiftOnDate: vi.fn(),
    getJobPostingById: vi.fn(),
    updateJobPosting: vi.fn(),
  },
}))

import { recruitmentService } from './recruitmentService'
import { recruitmentRepository } from '@/repositories/owner/recruitmentRepository'

const fullPostingInput = {
  company_id: 'comp-1',
  department_id: 'dept-1',
  created_by: 'mgr-1',
  title: 'Weekend Cashier',
  responsibilities: 'Handle checkout and restock shelves',
  skills: 'Basic maths, customer service',
  experience_required: 'None required',
  minimum_age: 18,
  uniform_type: 'Provided',
  salary_amount: 12,
  openings: 2,
  expires_at: '2026-09-01T00:00:00.000Z',
  job_type: 'shift',
  job_date: '2026-08-20',
  job_start_time: '09:00',
  job_end_time: '17:00',
  assigned_employee_id: 'emp-1',
  status: 'open',
}

describe('UC40 Submit Job Posting for Approval', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(recruitmentRepository.getEmployeeShiftOnDate).mockResolvedValue(null)
  })

  it('UC40-M-UT-M: Manager submits a completed job posting, which is forced to Pending Approval even though Open was requested', async () => {
    vi.mocked(recruitmentRepository.getUserRole).mockResolvedValue('Manager')
    const created = { id: 'job-1', ...fullPostingInput, status: 'pending_approval' }
    vi.mocked(recruitmentRepository.createJobPosting).mockResolvedValue(created as never)

    const result = await recruitmentService.createJobPosting(fullPostingInput as never)

    expect(result).toEqual(created)
    expect(recruitmentRepository.createJobPosting).toHaveBeenCalledWith(expect.objectContaining({ status: 'pending_approval' }))
  })

  it('UC40-A1-UT-M: Manager resubmits a previously rejected posting, clearing the old rejection and returning it to Pending Approval', async () => {
    vi.mocked(recruitmentRepository.getJobPostingById).mockResolvedValue({
      id: 'job-2', ...fullPostingInput, status: 'rejected',
    } as never)
    const resubmitted = { id: 'job-2', status: 'pending_approval', rejection_reason: null, rejected_by: null }
    vi.mocked(recruitmentRepository.updateJobPosting).mockResolvedValue(resubmitted as never)

    const result = await recruitmentService.submitForReview('job-2')

    expect(result).toEqual(resubmitted)
    expect(recruitmentRepository.updateJobPosting).toHaveBeenCalledWith('job-2', {
      status: 'pending_approval', rejection_reason: null, rejected_by: null,
    })
  })
})
