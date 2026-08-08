import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabaseAdmin', () => ({
  getSupabaseAdmin: () => ({}),
}))

vi.mock('@/lib/supabase', () => ({
  supabase: {},
  createClient: () => ({}),
}))

vi.mock('@/repositories/invitation/invitationRepository', () => ({
  invitationRepository: {
    createCode: vi.fn(),
  },
}))

vi.mock('@/repositories/auth/authRepository', () => ({
  authRepository: {
    findByAuthIdOrInternalId: vi.fn(),
    findByEmail: vi.fn(),
  },
}))

vi.mock('@/repositories/company/companyRepository', () => ({
  companyRepository: {
    findById: vi.fn(),
  },
}))

vi.mock('@/services/email/emailService', () => ({
  emailService: {
    sendInviteEmail: vi.fn(),
  },
}))

import { invitationService } from './invitationService'
import { invitationRepository } from '@/repositories/invitation/invitationRepository'
import { authRepository } from '@/repositories/auth/authRepository'
import { companyRepository } from '@/repositories/company/companyRepository'
import { emailService } from '@/services/email/emailService'

describe('UC25 Send Direct Invitation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(companyRepository.findById).mockResolvedValue({ id: 'comp-1', name: 'Test Company' } as never)
    vi.mocked(emailService.sendInviteEmail).mockResolvedValue(undefined as never)
    vi.mocked(invitationRepository.createCode).mockResolvedValue({
      code: '12345', company_id: 'comp-1', department_id: 'dept-1', role: 'Manager',
      generated_by: 'owner-1', expired_at: '2026-08-13T00:00:00.000Z',
    } as never)
  })

  it('UC25-M-UT-O: Owner sends a direct invitation to a new Manager', async () => {
    vi.mocked(authRepository.findByAuthIdOrInternalId).mockResolvedValue({
      id: 'owner-1', email_address: 'owner@test.com', full_name: 'Test Owner',
    } as never)
    vi.mocked(authRepository.findByEmail).mockResolvedValue(null)

    await invitationService.sendInvite({
      email: 'new.manager@test.com', role: 'Manager', company_id: 'comp-1', department_id: 'dept-1', invited_by: 'owner-1',
    })

    expect(invitationRepository.createCode).toHaveBeenCalledTimes(1)
    expect(emailService.sendInviteEmail).toHaveBeenCalledWith(expect.objectContaining({ to: 'new.manager@test.com' }))
  })

  it('UC25-M-UT-P: Partner sends a direct invitation to a new Manager', async () => {
    vi.mocked(authRepository.findByAuthIdOrInternalId).mockResolvedValue({
      id: 'partner-1', email_address: 'partner@test.com', full_name: 'Test Partner',
    } as never)
    vi.mocked(authRepository.findByEmail).mockResolvedValue(null)

    await invitationService.sendInvite({
      email: 'new.manager2@test.com', role: 'Manager', company_id: 'comp-1', department_id: 'dept-1', invited_by: 'partner-1',
    })

    expect(invitationRepository.createCode).toHaveBeenCalledTimes(1)
    expect(emailService.sendInviteEmail).toHaveBeenCalledWith(expect.objectContaining({ to: 'new.manager2@test.com' }))
  })

  it('UC25-A1-UT-O-1: Owner is blocked from inviting an email that is already a member of the same company', async () => {
    vi.mocked(authRepository.findByAuthIdOrInternalId).mockResolvedValue({
      id: 'owner-1', email_address: 'owner@test.com', full_name: 'Test Owner',
    } as never)
    vi.mocked(authRepository.findByEmail).mockResolvedValue({ id: 'existing-1', company_id: 'comp-1' } as never)

    await expect(invitationService.sendInvite({
      email: 'existing@test.com', role: 'Manager', company_id: 'comp-1', department_id: 'dept-1', invited_by: 'owner-1',
    })).rejects.toThrow('This user is already a member of this company.')

    expect(invitationRepository.createCode).not.toHaveBeenCalled()
  })

  it('UC25-A1-UT-P-1: Partner is blocked from inviting an email that is already a member of the same company', async () => {
    vi.mocked(authRepository.findByAuthIdOrInternalId).mockResolvedValue({
      id: 'partner-1', email_address: 'partner@test.com', full_name: 'Test Partner',
    } as never)
    vi.mocked(authRepository.findByEmail).mockResolvedValue({ id: 'existing-2', company_id: 'comp-1' } as never)

    await expect(invitationService.sendInvite({
      email: 'existing2@test.com', role: 'Manager', company_id: 'comp-1', department_id: 'dept-1', invited_by: 'partner-1',
    })).rejects.toThrow('This user is already a member of this company.')

    expect(invitationRepository.createCode).not.toHaveBeenCalled()
  })

  it('UC25-A1-UT-O-2: Owner is blocked from inviting an email that already belongs to another company', async () => {
    vi.mocked(authRepository.findByAuthIdOrInternalId).mockResolvedValue({
      id: 'owner-1', email_address: 'owner@test.com', full_name: 'Test Owner',
    } as never)
    vi.mocked(authRepository.findByEmail).mockResolvedValue({ id: 'existing-3', company_id: 'other-comp' } as never)

    await expect(invitationService.sendInvite({
      email: 'existing3@test.com', role: 'Manager', company_id: 'comp-1', department_id: 'dept-1', invited_by: 'owner-1',
    })).rejects.toThrow('This user already has an account with another company and cannot be invited.')

    expect(invitationRepository.createCode).not.toHaveBeenCalled()
  })

  it('UC25-BR-UT-O: Owner is blocked from inviting their own email address', async () => {
    vi.mocked(authRepository.findByAuthIdOrInternalId).mockResolvedValue({
      id: 'owner-1', email_address: 'owner@test.com', full_name: 'Test Owner',
    } as never)

    await expect(invitationService.sendInvite({
      email: 'Owner@Test.com', role: 'Manager', company_id: 'comp-1', department_id: 'dept-1', invited_by: 'owner-1',
    })).rejects.toThrow('You cannot send an invitation to yourself.')

    expect(invitationRepository.createCode).not.toHaveBeenCalled()
  })
})
