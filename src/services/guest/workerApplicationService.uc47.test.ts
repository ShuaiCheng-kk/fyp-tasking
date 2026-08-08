import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabaseAdmin', () => ({
  getSupabaseAdmin: () => ({}),
}))

vi.mock('@/lib/supabase', () => ({
  supabase: {},
  createClient: () => ({}),
}))

vi.mock('@/repositories/guest/workerApplicationRepository', () => ({
  workerApplicationRepository: {
    updateInvitationStatus: vi.fn(),
    getInvitationBasic: vi.fn(),
    updateApplicantStatusById: vi.fn(),
    getApplicationOwner: vi.fn(),
  },
}))

vi.mock('@/services/owner/shiftService', () => ({ shiftService: { createShift: vi.fn() } }))
vi.mock('@/services/email/emailService', () => ({ emailService: {} }))
vi.mock('@/services/shared/workerEligibility', () => ({
  assertWorkerEligibleForJob: vi.fn(),
  invitationHasExpired: vi.fn(),
}))
vi.mock('@/repositories/owner/recruitmentRepository', () => ({ recruitmentRepository: {} }))

import { workerApplicationService } from './workerApplicationService'
import { workerApplicationRepository } from '@/repositories/guest/workerApplicationRepository'

describe('UC47 Reject Job Offer', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('UC47-M-UT-GU: Guest User declines a pending job invitation', async () => {
    vi.mocked(workerApplicationRepository.updateInvitationStatus).mockResolvedValue(undefined as never)
    vi.mocked(workerApplicationRepository.getInvitationBasic).mockResolvedValue({ applicant_id: 'app-1' } as never)
    vi.mocked(workerApplicationRepository.getApplicationOwner).mockResolvedValue({ user_id: 'guest-1' } as never)
    vi.mocked(workerApplicationRepository.updateApplicantStatusById).mockResolvedValue(undefined as never)

    await workerApplicationService.respondToInvitation('inv-1', 'declined', 'guest-1')

    expect(workerApplicationRepository.updateInvitationStatus).toHaveBeenCalledWith('inv-1', 'declined')
    expect(workerApplicationRepository.updateApplicantStatusById).toHaveBeenCalledWith('app-1', 'withdrawn')
  })
})
