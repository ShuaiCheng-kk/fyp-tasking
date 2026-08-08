import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabaseAdmin', () => ({
  getSupabaseAdmin: () => ({}),
}))

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
    getJobPostingById: vi.fn(),
    createJobPosting: vi.fn(),
  },
}))

import { recruitmentService } from './recruitmentService'
import { recruitmentRepository } from '@/repositories/owner/recruitmentRepository'

const draftPosting = {
  id: 'job-1',
  company_id: 'comp-1',
  department_id: 'dept-1',
  title: 'Weekend Cashier',
  status: 'draft',
  job_type: 'shift',
  responsibilities: 'Handle checkout',
  skills: 'Basic maths',
  salary_amount: 12,
}

describe('UC38 Duplicate Draft Job', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('UC38-M-UT-O: Owner duplicates a draft job posting', async () => {
    vi.mocked(recruitmentRepository.getJobPostingById).mockResolvedValue(draftPosting as never)
    const duplicated = { id: 'job-2', ...draftPosting, title: 'Weekend Cashier (copy)', created_by: 'owner-1' }
    vi.mocked(recruitmentRepository.createJobPosting).mockResolvedValue(duplicated as never)

    const result = await recruitmentService.duplicateJobPosting('job-1', 'owner-1')

    expect(result).toEqual(duplicated)
    expect(recruitmentRepository.createJobPosting).toHaveBeenCalledWith(expect.objectContaining({
      status: 'draft', title: 'Weekend Cashier (copy)', created_by: 'owner-1',
    }))
  })

  it('UC38-M-UT-P: Partner duplicates a draft job posting', async () => {
    vi.mocked(recruitmentRepository.getJobPostingById).mockResolvedValue(draftPosting as never)
    const duplicated = { id: 'job-3', ...draftPosting, title: 'Weekend Cashier (copy)', created_by: 'partner-1' }
    vi.mocked(recruitmentRepository.createJobPosting).mockResolvedValue(duplicated as never)

    const result = await recruitmentService.duplicateJobPosting('job-1', 'partner-1')

    expect(result).toEqual(duplicated)
    expect(recruitmentRepository.createJobPosting).toHaveBeenCalledWith(expect.objectContaining({
      status: 'draft', title: 'Weekend Cashier (copy)', created_by: 'partner-1',
    }))
  })

  it('UC38-M-UT-M: Manager duplicates a draft job posting', async () => {
    vi.mocked(recruitmentRepository.getJobPostingById).mockResolvedValue(draftPosting as never)
    const duplicated = { id: 'job-4', ...draftPosting, title: 'Weekend Cashier (copy)', created_by: 'mgr-1' }
    vi.mocked(recruitmentRepository.createJobPosting).mockResolvedValue(duplicated as never)

    const result = await recruitmentService.duplicateJobPosting('job-1', 'mgr-1')

    expect(result).toEqual(duplicated)
    expect(recruitmentRepository.createJobPosting).toHaveBeenCalledWith(expect.objectContaining({
      status: 'draft', title: 'Weekend Cashier (copy)', created_by: 'mgr-1',
    }))
  })
})
