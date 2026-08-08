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
    getApplicantCounts: vi.fn(),
    getJobPostingById: vi.fn(),
    updateJobPosting: vi.fn(),
  },
}))

import { recruitmentService } from './recruitmentService'
import { recruitmentRepository } from '@/repositories/owner/recruitmentRepository'

describe('UC37 Archive Job Opening', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('UC37-M-UT-O: Owner archives a job posting with every application resolved', async () => {
    vi.mocked(recruitmentRepository.getApplicantCounts).mockResolvedValue([
      { status: 'accepted', invitation_status: 'accepted' },
      { status: 'rejected', invitation_status: null },
    ] as never)
    vi.mocked(recruitmentRepository.getJobPostingById).mockResolvedValue({ id: 'job-1', status: 'open' } as never)
    const archived = { id: 'job-1', status: 'archived', archived_from_status: 'open' }
    vi.mocked(recruitmentRepository.updateJobPosting).mockResolvedValue(archived as never)

    const result = await recruitmentService.archiveJobPosting('job-1')

    expect(result).toEqual(archived)
    expect(recruitmentRepository.updateJobPosting).toHaveBeenCalledWith('job-1', expect.objectContaining({
      status: 'archived', archived_from_status: 'open',
    }))
  })

  it('UC37-M-UT-P: Partner archives a job posting with every application resolved', async () => {
    vi.mocked(recruitmentRepository.getApplicantCounts).mockResolvedValue([
      { status: 'accepted', invitation_status: 'accepted' },
    ] as never)
    vi.mocked(recruitmentRepository.getJobPostingById).mockResolvedValue({ id: 'job-2', status: 'closed' } as never)
    const archived = { id: 'job-2', status: 'archived', archived_from_status: 'closed' }
    vi.mocked(recruitmentRepository.updateJobPosting).mockResolvedValue(archived as never)

    const result = await recruitmentService.archiveJobPosting('job-2')

    expect(result).toEqual(archived)
    expect(recruitmentRepository.updateJobPosting).toHaveBeenCalledWith('job-2', expect.objectContaining({
      status: 'archived', archived_from_status: 'closed',
    }))
  })

  it('UC37-A1-UT-O: Owner is blocked from archiving a job posting that still has a pending applicant', async () => {
    vi.mocked(recruitmentRepository.getApplicantCounts).mockResolvedValue([
      { status: 'pending', invitation_status: null },
    ] as never)

    await expect(recruitmentService.archiveJobPosting('job-3'))
      .rejects.toThrow('This job still has applications to resolve — decide the pending ones and wait for accepted workers to confirm before archiving')

    expect(recruitmentRepository.updateJobPosting).not.toHaveBeenCalled()
  })

  it('UC37-A1-UT-P: Partner is blocked from archiving a job posting that has an accepted worker who has not confirmed yet', async () => {
    vi.mocked(recruitmentRepository.getApplicantCounts).mockResolvedValue([
      { status: 'accepted', invitation_status: 'sent' },
    ] as never)

    await expect(recruitmentService.archiveJobPosting('job-4'))
      .rejects.toThrow('This job still has applications to resolve — decide the pending ones and wait for accepted workers to confirm before archiving')

    expect(recruitmentRepository.updateJobPosting).not.toHaveBeenCalled()
  })

  it('UC37-BR-UT-O: Owner unarchives a job posting back to Closed, since that is the status it was archived from', async () => {
    vi.mocked(recruitmentRepository.getJobPostingById).mockResolvedValue({
      id: 'job-5', status: 'archived', archived_from_status: 'closed',
    } as never)
    const restored = { id: 'job-5', status: 'closed', archived_from_status: null }
    vi.mocked(recruitmentRepository.updateJobPosting).mockResolvedValue(restored as never)

    const result = await recruitmentService.unarchiveJobPosting('job-5')

    expect(result).toEqual(restored)
    expect(recruitmentRepository.updateJobPosting).toHaveBeenCalledWith('job-5', expect.objectContaining({ status: 'closed' }))
  })
})
