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
    sendApplicationAcceptedEmail: vi.fn(),
    sendApplicationRejectedEmail: vi.fn(),
  },
}))

vi.mock('@/repositories/owner/recruitmentRepository', () => ({
  recruitmentRepository: {
    getApplicantById: vi.fn(),
    getUserRole: vi.fn(),
    getUserRoleAndCompany: vi.fn(),
    getJobPostingById: vi.fn(),
    updateApplicantStatus: vi.fn(),
    createJobInvitation: vi.fn(),
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

describe('UC44 Accept Applicant', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(recruitmentRepository.getJobPostingById).mockResolvedValue({ id: 'job-1', company_id: 'comp-1', created_by: 'mgr-1', title: 'Weekend Cashier', company_name: 'Test Co' } as never)
    vi.mocked(recruitmentRepository.createJobInvitation).mockResolvedValue(undefined as never)
    vi.mocked(emailService.sendApplicationAcceptedEmail).mockResolvedValue(undefined as never)
  })

  it('UC44-M-UT-O: Owner accepts a pending applicant, sending them an offer invitation', async () => {
    vi.mocked(recruitmentRepository.getUserRole).mockResolvedValue('Owner')
    vi.mocked(recruitmentRepository.getUserRoleAndCompany).mockResolvedValue({ role: 'Owner', company_id: 'comp-1' } as never)
    vi.mocked(recruitmentRepository.getApplicantById).mockResolvedValue(pendingApplicant as never)
    const updated = { ...pendingApplicant, status: 'accepted' }
    vi.mocked(recruitmentRepository.updateApplicantStatus).mockResolvedValue(updated as never)

    const result = await recruitmentService.decideApplicant({ applicant_id: 'app-1', decision: 'accepted', decided_by: 'owner-1' })

    expect(result).toEqual(updated)
    expect(recruitmentRepository.createJobInvitation).toHaveBeenCalledWith({ job_id: 'job-1', applicant_id: 'app-1', sent_by: 'owner-1' })
    expect(emailService.sendApplicationAcceptedEmail).toHaveBeenCalledWith(expect.objectContaining({ to: 'alex@test.com' }))
  })

  it('UC44-M-UT-P: Partner accepts a pending applicant, sending them an offer invitation', async () => {
    vi.mocked(recruitmentRepository.getUserRole).mockResolvedValue('Partner')
    vi.mocked(recruitmentRepository.getUserRoleAndCompany).mockResolvedValue({ role: 'Partner', company_id: 'comp-1' } as never)
    vi.mocked(recruitmentRepository.getApplicantById).mockResolvedValue(pendingApplicant as never)
    const updated = { ...pendingApplicant, status: 'accepted' }
    vi.mocked(recruitmentRepository.updateApplicantStatus).mockResolvedValue(updated as never)

    const result = await recruitmentService.decideApplicant({ applicant_id: 'app-1', decision: 'accepted', decided_by: 'partner-1' })

    expect(result).toEqual(updated)
    expect(recruitmentRepository.createJobInvitation).toHaveBeenCalledWith({ job_id: 'job-1', applicant_id: 'app-1', sent_by: 'partner-1' })
  })

  it('UC44-M-UT-M: Manager accepts a pending applicant for their own department\'s posting', async () => {
    vi.mocked(recruitmentRepository.getUserRole).mockResolvedValue('Manager')
    vi.mocked(recruitmentRepository.getUserRoleAndCompany).mockResolvedValue({ role: 'Manager', company_id: 'comp-1' } as never)
    vi.mocked(recruitmentRepository.getApplicantById).mockResolvedValue(pendingApplicant as never)
    const updated = { ...pendingApplicant, status: 'accepted' }
    vi.mocked(recruitmentRepository.updateApplicantStatus).mockResolvedValue(updated as never)

    const result = await recruitmentService.decideApplicant({ applicant_id: 'app-1', decision: 'accepted', decided_by: 'mgr-1' })

    expect(result).toEqual(updated)
    expect(recruitmentRepository.createJobInvitation).toHaveBeenCalledWith({ job_id: 'job-1', applicant_id: 'app-1', sent_by: 'mgr-1' })
  })

  it('UC44-BR-UT-O: Owner is blocked from accepting an applicant who has already confirmed the offer', async () => {
    vi.mocked(recruitmentRepository.getUserRole).mockResolvedValue('Owner')
    vi.mocked(recruitmentRepository.getUserRoleAndCompany).mockResolvedValue({ role: 'Owner', company_id: 'comp-1' } as never)
    vi.mocked(recruitmentRepository.getApplicantById).mockResolvedValue({
      ...pendingApplicant, status: 'accepted', invitation_status: 'accepted',
    } as never)

    await expect(recruitmentService.decideApplicant({ applicant_id: 'app-1', decision: 'accepted', decided_by: 'owner-1' }))
      .rejects.toThrow('This worker already confirmed the offer — use Remove Worker instead')

    expect(recruitmentRepository.updateApplicantStatus).not.toHaveBeenCalled()
  })
})
