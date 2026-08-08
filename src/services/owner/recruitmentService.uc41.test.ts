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
    approveJobPosting: vi.fn(),
  },
}))

import { recruitmentService } from './recruitmentService'
import { recruitmentRepository } from '@/repositories/owner/recruitmentRepository'

describe('UC41 Approve Job Posting', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('UC41-M-UT-O: Owner approves a Manager\'s pending job posting', async () => {
    vi.mocked(recruitmentRepository.getUserRole).mockResolvedValue('Owner')
    const approved = { id: 'job-1', status: 'open' }
    vi.mocked(recruitmentRepository.approveJobPosting).mockResolvedValue(approved as never)

    const result = await recruitmentService.approveJobPosting('job-1', 'owner-1')

    expect(result).toEqual(approved)
    expect(recruitmentRepository.approveJobPosting).toHaveBeenCalledWith('job-1')
  })

  it('UC41-M-UT-P: Partner approves a Manager\'s pending job posting', async () => {
    vi.mocked(recruitmentRepository.getUserRole).mockResolvedValue('Partner')
    const approved = { id: 'job-2', status: 'open' }
    vi.mocked(recruitmentRepository.approveJobPosting).mockResolvedValue(approved as never)

    const result = await recruitmentService.approveJobPosting('job-2', 'partner-1')

    expect(result).toEqual(approved)
    expect(recruitmentRepository.approveJobPosting).toHaveBeenCalledWith('job-2')
  })

  it('UC41-BR-UT-M: Manager is blocked from approving a job posting, since only Owner or Partner may decide', async () => {
    vi.mocked(recruitmentRepository.getUserRole).mockResolvedValue('Manager')

    await expect(recruitmentService.approveJobPosting('job-3', 'mgr-1'))
      .rejects.toThrow('Only Owner or Partner can approve or reject a job posting')

    expect(recruitmentRepository.approveJobPosting).not.toHaveBeenCalled()
  })
})
