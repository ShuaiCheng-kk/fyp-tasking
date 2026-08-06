import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase', () => ({
  supabase: {},
  createClient: () => ({}),
}))

vi.mock('@/services/email/emailService', () => ({
  emailService: {
    sendInviteEmail: vi.fn(),
    sendRemovedFromCompanyEmail: vi.fn(),
    sendApplicationAcceptedEmail: vi.fn(),
    sendApplicationRejectedEmail: vi.fn(),
  },
}))

vi.mock('@/repositories/owner/recruitmentRepository', () => ({
  recruitmentRepository: {
    getApplicantById: vi.fn(),
    getUserRole: vi.fn(),
    getJobPostingById: vi.fn(),
    updateApplicantStatus: vi.fn(),
    cancelSentInvitationByApplicant: vi.fn(),
  },
}))

import { recruitmentService } from './recruitmentService'
import { recruitmentRepository } from '@/repositories/owner/recruitmentRepository'
import { emailService } from '@/services/email/emailService'

const pendingApplicant = {
  id: 'app-1',
  job_id: 'job-1',
  full_name: 'Alex Applicant',
  email_address: 'alex@test.com',
  status: 'pending',
  invitation_status: null,
}

describe('UC45 Reject Applicant', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(recruitmentRepository.getJobPostingById).mockResolvedValue({ id: 'job-1', created_by: 'mgr-1', title: 'Weekend Cashier', company_name: 'Test Co' } as never)
    vi.mocked(recruitmentRepository.cancelSentInvitationByApplicant).mockResolvedValue(undefined as never)
    vi.mocked(emailService.sendApplicationRejectedEmail).mockResolvedValue(undefined as never)
  })

  it('UC45-M-UT-O: Owner rejects a pending applicant', async () => {
    vi.mocked(recruitmentRepository.getUserRole).mockResolvedValue('Owner')
    vi.mocked(recruitmentRepository.getApplicantById).mockResolvedValue(pendingApplicant as never)
    const updated = { ...pendingApplicant, status: 'rejected' }
    vi.mocked(recruitmentRepository.updateApplicantStatus).mockResolvedValue(updated as never)

    const result = await recruitmentService.decideApplicant({ applicant_id: 'app-1', decision: 'rejected', decided_by: 'owner-1' })

    expect(result).toEqual(updated)
    expect(emailService.sendApplicationRejectedEmail).toHaveBeenCalledWith(expect.objectContaining({ to: 'alex@test.com' }))
  })

  it('UC45-M-UT-P: Partner rejects a pending applicant', async () => {
    vi.mocked(recruitmentRepository.getUserRole).mockResolvedValue('Partner')
    vi.mocked(recruitmentRepository.getApplicantById).mockResolvedValue(pendingApplicant as never)
    const updated = { ...pendingApplicant, status: 'rejected' }
    vi.mocked(recruitmentRepository.updateApplicantStatus).mockResolvedValue(updated as never)

    const result = await recruitmentService.decideApplicant({ applicant_id: 'app-1', decision: 'rejected', decided_by: 'partner-1' })

    expect(result).toEqual(updated)
  })

  it('UC45-M-UT-M: Manager rejects a pending applicant for their own department\'s posting', async () => {
    vi.mocked(recruitmentRepository.getUserRole).mockResolvedValue('Manager')
    vi.mocked(recruitmentRepository.getApplicantById).mockResolvedValue(pendingApplicant as never)
    const updated = { ...pendingApplicant, status: 'rejected' }
    vi.mocked(recruitmentRepository.updateApplicantStatus).mockResolvedValue(updated as never)

    const result = await recruitmentService.decideApplicant({ applicant_id: 'app-1', decision: 'rejected', decided_by: 'mgr-1' })

    expect(result).toEqual(updated)
  })

  it('UC45-A1-UT-O: Owner rejects an already-accepted-but-unconfirmed applicant, rescinding their pending invitation', async () => {
    vi.mocked(recruitmentRepository.getUserRole).mockResolvedValue('Owner')
    vi.mocked(recruitmentRepository.getApplicantById).mockResolvedValue({
      ...pendingApplicant, status: 'accepted', invitation_status: 'sent',
    } as never)
    const updated = { ...pendingApplicant, status: 'rejected' }
    vi.mocked(recruitmentRepository.updateApplicantStatus).mockResolvedValue(updated as never)

    const result = await recruitmentService.decideApplicant({ applicant_id: 'app-1', decision: 'rejected', decided_by: 'owner-1' })

    expect(result).toEqual(updated)
    expect(recruitmentRepository.cancelSentInvitationByApplicant).toHaveBeenCalledWith('app-1')
  })

  it('UC45-A1-UT-P: Partner rejects an already-accepted-but-unconfirmed applicant, rescinding their pending invitation', async () => {
    vi.mocked(recruitmentRepository.getUserRole).mockResolvedValue('Partner')
    vi.mocked(recruitmentRepository.getApplicantById).mockResolvedValue({
      ...pendingApplicant, status: 'accepted', invitation_status: 'sent',
    } as never)
    const updated = { ...pendingApplicant, status: 'rejected' }
    vi.mocked(recruitmentRepository.updateApplicantStatus).mockResolvedValue(updated as never)

    const result = await recruitmentService.decideApplicant({ applicant_id: 'app-1', decision: 'rejected', decided_by: 'partner-1' })

    expect(result).toEqual(updated)
    expect(recruitmentRepository.cancelSentInvitationByApplicant).toHaveBeenCalledWith('app-1')
  })

  it('UC45-A1-UT-M: Manager rejects an already-accepted-but-unconfirmed applicant, rescinding their pending invitation', async () => {
    vi.mocked(recruitmentRepository.getUserRole).mockResolvedValue('Manager')
    vi.mocked(recruitmentRepository.getApplicantById).mockResolvedValue({
      ...pendingApplicant, status: 'accepted', invitation_status: 'sent',
    } as never)
    const updated = { ...pendingApplicant, status: 'rejected' }
    vi.mocked(recruitmentRepository.updateApplicantStatus).mockResolvedValue(updated as never)

    const result = await recruitmentService.decideApplicant({ applicant_id: 'app-1', decision: 'rejected', decided_by: 'mgr-1' })

    expect(result).toEqual(updated)
    expect(recruitmentRepository.cancelSentInvitationByApplicant).toHaveBeenCalledWith('app-1')
  })

  it('UC45-BR-UT-O: Owner is blocked from rejecting an applicant who has already confirmed the offer', async () => {
    vi.mocked(recruitmentRepository.getUserRole).mockResolvedValue('Owner')
    vi.mocked(recruitmentRepository.getApplicantById).mockResolvedValue({
      ...pendingApplicant, status: 'accepted', invitation_status: 'accepted',
    } as never)

    await expect(recruitmentService.decideApplicant({ applicant_id: 'app-1', decision: 'rejected', decided_by: 'owner-1' }))
      .rejects.toThrow('This worker already confirmed the offer — use Remove Worker instead')

    expect(recruitmentRepository.updateApplicantStatus).not.toHaveBeenCalled()
  })
})
