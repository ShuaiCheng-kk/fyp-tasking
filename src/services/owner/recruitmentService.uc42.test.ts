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
    getUserRole: vi.fn(),
    rejectJobPosting: vi.fn(),
  },
}))

import { recruitmentService } from './recruitmentService'
import { recruitmentRepository } from '@/repositories/owner/recruitmentRepository'

describe('UC42 Reject Job Posting', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(recruitmentRepository.getUserRole).mockResolvedValue('Owner')
  })

  it('UC42-M-UT-O: Owner rejects a Manager\'s pending job posting with a reason', async () => {
    const rejected = { id: 'job-1', status: 'rejected', rejection_reason: 'Pay rate is below company minimum' }
    vi.mocked(recruitmentRepository.rejectJobPosting).mockResolvedValue(rejected as never)

    const result = await recruitmentService.rejectJobPosting('job-1', 'Pay rate is below company minimum', 'owner-1')

    expect(result).toEqual(rejected)
    expect(recruitmentRepository.rejectJobPosting).toHaveBeenCalledWith('job-1', 'Pay rate is below company minimum', 'owner-1')
  })

  it('UC42-M-UT-P: Partner rejects a Manager\'s pending job posting with a reason', async () => {
    vi.mocked(recruitmentRepository.getUserRole).mockResolvedValue('Partner')
    const rejected = { id: 'job-2', status: 'rejected', rejection_reason: 'Missing supervisor details' }
    vi.mocked(recruitmentRepository.rejectJobPosting).mockResolvedValue(rejected as never)

    const result = await recruitmentService.rejectJobPosting('job-2', 'Missing supervisor details', 'partner-1')

    expect(result).toEqual(rejected)
    expect(recruitmentRepository.rejectJobPosting).toHaveBeenCalledWith('job-2', 'Missing supervisor details', 'partner-1')
  })

  it('UC42-A1-UT-O: Owner is blocked from rejecting a posting with no reason entered', async () => {
    await expect(recruitmentService.rejectJobPosting('job-3', '', 'owner-1'))
      .rejects.toThrow('rejection_reason is required')

    expect(recruitmentRepository.rejectJobPosting).not.toHaveBeenCalled()
  })

  it('UC42-A1-UT-P: Partner is blocked from rejecting a posting with no reason entered', async () => {
    vi.mocked(recruitmentRepository.getUserRole).mockResolvedValue('Partner')

    await expect(recruitmentService.rejectJobPosting('job-4', '   ', 'partner-1'))
      .rejects.toThrow('rejection_reason is required')

    expect(recruitmentRepository.rejectJobPosting).not.toHaveBeenCalled()
  })
})
