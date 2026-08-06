import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase', () => ({
  supabase: {},
  createClient: () => ({}),
}))

vi.mock('@/services/owner/shiftService', () => ({
  shiftService: {
    createShift: vi.fn(),
  },
}))

vi.mock('@/services/email/emailService', () => ({
  emailService: {
    sendJobConfirmationEmail: vi.fn(),
  },
}))

vi.mock('@/services/shared/workerEligibility', () => ({
  assertWorkerEligibleForJob: vi.fn(),
  invitationHasExpired: vi.fn(),
}))

vi.mock('@/repositories/guest/workerApplicationRepository', () => ({
  workerApplicationRepository: {
    getInvitationContext: vi.fn(),
    updateInvitationStatus: vi.fn(),
    updateApplicantStatusById: vi.fn(),
    claimJobOpening: vi.fn(),
    promoteGuestToWorker: vi.fn(),
    addCasualWorkerToDepartment: vi.fn(),
    countAcceptedInvitations: vi.fn(),
    closeJobPosting: vi.fn(),
    markSentInvitationsPositionFilled: vi.fn(),
    markPendingApplicantsJobClosed: vi.fn(),
    getUserContact: vi.fn(),
  },
}))

vi.mock('@/repositories/owner/recruitmentRepository', () => ({
  recruitmentRepository: {},
}))

import { workerApplicationService } from './workerApplicationService'
import { workerApplicationRepository } from '@/repositories/guest/workerApplicationRepository'
import { shiftService } from '@/services/owner/shiftService'
import { invitationHasExpired } from '@/services/shared/workerEligibility'

const job = {
  id: 'job-1',
  company_id: 'comp-1',
  department_id: 'dept-1',
  created_by: 'owner-1',
  assigned_employee_id: 'emp-1',
  job_type: 'shift',
  job_date: '2026-08-20',
  job_start_time: '09:00',
  job_end_time: '17:00',
  openings: 2,
  salary_amount: 12,
}

describe('UC46 Accept Job Offer', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(invitationHasExpired).mockReturnValue(false)
    vi.mocked(workerApplicationRepository.getInvitationContext).mockResolvedValue({
      job, user_id: 'guest-1', sent_at: '2026-08-01T00:00:00.000Z', applicant_id: 'app-1',
    } as never)
    vi.mocked(workerApplicationRepository.promoteGuestToWorker).mockResolvedValue(undefined as never)
    vi.mocked(workerApplicationRepository.addCasualWorkerToDepartment).mockResolvedValue(undefined as never)
    vi.mocked(shiftService.createShift).mockResolvedValue({ shift: {}, warning: null } as never)
    vi.mocked(workerApplicationRepository.getUserContact).mockResolvedValue(null as never)
  })

  it('UC46-M-UT-GU: Guest User accepts a job offer and is confirmed for the position', async () => {
    vi.mocked(workerApplicationRepository.claimJobOpening).mockResolvedValue('accepted' as never)
    vi.mocked(workerApplicationRepository.countAcceptedInvitations).mockResolvedValue(1)

    await workerApplicationService.respondToInvitation('inv-1', 'accepted')

    expect(workerApplicationRepository.promoteGuestToWorker).toHaveBeenCalledWith('guest-1')
    expect(workerApplicationRepository.addCasualWorkerToDepartment).toHaveBeenCalledWith('guest-1', 'dept-1', 'comp-1')
    expect(shiftService.createShift).toHaveBeenCalledWith(expect.objectContaining({
      assigned_user_id: 'guest-1', supervisor_employee_id: 'emp-1', publication_status: 'published',
    }))
    expect(workerApplicationRepository.closeJobPosting).not.toHaveBeenCalled()
  })

  it('UC46-A1-UT-GU: Guest User is blocked from accepting an offer whose last opening was already claimed by another worker', async () => {
    vi.mocked(workerApplicationRepository.claimJobOpening).mockResolvedValue('position_filled' as never)

    await expect(workerApplicationService.respondToInvitation('inv-2', 'accepted'))
      .rejects.toThrow('This position has already been filled by another worker')

    expect(workerApplicationRepository.promoteGuestToWorker).not.toHaveBeenCalled()
  })

  it('UC46-A2-UT-GU: Guest User is blocked from accepting an offer after the job\'s shift has already started', async () => {
    vi.mocked(invitationHasExpired).mockReturnValue(true)
    vi.mocked(workerApplicationRepository.updateInvitationStatus).mockResolvedValue(undefined as never)

    await expect(workerApplicationService.respondToInvitation('inv-3', 'accepted'))
      .rejects.toThrow('This offer has expired — the shift has already started')

    expect(workerApplicationRepository.updateInvitationStatus).toHaveBeenCalledWith('inv-3', 'expired')
    expect(workerApplicationRepository.claimJobOpening).not.toHaveBeenCalled()
  })

  it('UC46-BR-UT-GU: The job closes automatically once accepting this offer fills the last opening', async () => {
    vi.mocked(workerApplicationRepository.claimJobOpening).mockResolvedValue('accepted' as never)
    vi.mocked(workerApplicationRepository.countAcceptedInvitations).mockResolvedValue(2)
    vi.mocked(workerApplicationRepository.closeJobPosting).mockResolvedValue(undefined as never)
    vi.mocked(workerApplicationRepository.markSentInvitationsPositionFilled).mockResolvedValue(undefined as never)
    vi.mocked(workerApplicationRepository.markPendingApplicantsJobClosed).mockResolvedValue(undefined as never)

    await workerApplicationService.respondToInvitation('inv-4', 'accepted')

    expect(workerApplicationRepository.closeJobPosting).toHaveBeenCalledWith('job-1')
    expect(workerApplicationRepository.markSentInvitationsPositionFilled).toHaveBeenCalledWith('job-1')
    expect(workerApplicationRepository.markPendingApplicantsJobClosed).toHaveBeenCalledWith('job-1')
  })
})
