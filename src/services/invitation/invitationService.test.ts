import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase', () => ({
  supabase: {},
  createClient: () => ({}),
}))

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({ auth: { admin: { deleteUser: vi.fn() } } }),
}))

vi.mock('@/repositories/invitation/invitationRepository', () => ({
  invitationRepository: {
    findByCode: vi.fn(),
    markAsUsed: vi.fn(),
    insertManagerDepartment: vi.fn(),
    insertEmployeeDepartment: vi.fn(),
    createCode: vi.fn(),
  },
}))

vi.mock('@/repositories/auth/authRepository', () => ({
  authRepository: {
    findByEmail: vi.fn(),
    findByPhoneNumber: vi.fn(),
    createAuthUser: vi.fn(),
    createUser: vi.fn(),
    findByAuthIdOrInternalId: vi.fn(),
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

const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

describe('invitationService.redeemCode — Accept Company Invitation (UC70)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  const baseInput = {
    code: '12345',
    full_name: 'New Employee',
    email_address: 'employee@test.com',
    password: 'Password123!',
    phone_number: '91234567',
    date_of_birth: '1995-01-01',
    profile_photo_url: 'https://cdn/photo.jpg',
  }

  it('rejects an invitation code that does not exist', async () => {
    vi.mocked(invitationRepository.findByCode).mockResolvedValue(null)

    await expect(invitationService.redeemCode(baseInput)).rejects.toThrow('Invalid or expired invitation code')
    expect(authRepository.createAuthUser).not.toHaveBeenCalled()
  })

  it('rejects an expired invitation code', async () => {
    vi.mocked(invitationRepository.findByCode).mockResolvedValue({
      code: '12345', company_id: 'company-1', department_id: null, role: 'Employee',
      generated_by: 'gen-1', expired_at: pastDate, status: 'Active',
    } as never)

    await expect(invitationService.redeemCode(baseInput)).rejects.toThrow('This invitation has expired')
  })

  it('rejects when an account with the email already exists', async () => {
    vi.mocked(invitationRepository.findByCode).mockResolvedValue({
      code: '12345', company_id: 'company-1', department_id: null, role: 'Employee',
      generated_by: 'gen-1', expired_at: futureDate, status: 'Active',
    } as never)
    vi.mocked(authRepository.findByEmail).mockResolvedValue({ id: 'existing-user' } as never)

    await expect(invitationService.redeemCode(baseInput)).rejects.toThrow(
      'An account with this email already exists. Please sign in instead.',
    )
  })

  it('rejects when the phone number is already registered', async () => {
    vi.mocked(invitationRepository.findByCode).mockResolvedValue({
      code: '12345', company_id: 'company-1', department_id: null, role: 'Employee',
      generated_by: 'gen-1', expired_at: futureDate, status: 'Active',
    } as never)
    vi.mocked(authRepository.findByEmail).mockResolvedValue(null)
    vi.mocked(authRepository.findByPhoneNumber).mockResolvedValue({ id: 'phone-owner' } as never)

    await expect(invitationService.redeemCode({ ...baseInput, phone_number: '12345678' })).rejects.toThrow(
      'This phone number is already registered',
    )
    expect(authRepository.createAuthUser).not.toHaveBeenCalled()
  })

  it('creates the auth user and profile, links the employee department, and marks the code used', async () => {
    vi.mocked(invitationRepository.findByCode).mockResolvedValue({
      code: '12345', company_id: 'company-1', department_id: 'dept-1', role: 'Employee',
      generated_by: 'gen-1', expired_at: futureDate, status: 'Active',
    } as never)
    vi.mocked(authRepository.findByEmail).mockResolvedValue(null)
    vi.mocked(authRepository.createAuthUser).mockResolvedValue({ id: 'auth-1' } as never)
    const createdUser = { id: 'user-1', email_address: baseInput.email_address, role: 'Employee' }
    vi.mocked(authRepository.createUser).mockResolvedValue(createdUser as never)

    const result = await invitationService.redeemCode(baseInput)

    expect(authRepository.createAuthUser).toHaveBeenCalledWith(baseInput.email_address, baseInput.password, true)
    expect(authRepository.createUser).toHaveBeenCalledWith(
      expect.objectContaining({ supabase_auth_id: 'auth-1', role: 'Employee', company_id: 'company-1' }),
    )
    expect(invitationRepository.insertEmployeeDepartment).toHaveBeenCalledWith('user-1', 'dept-1')
    expect(invitationRepository.markAsUsed).toHaveBeenCalledWith('12345', 'user-1')
    expect(result).toEqual({ user: createdUser, company_id: 'company-1' })
  })

  it('rolls back the auth user when profile creation fails', async () => {
    vi.mocked(invitationRepository.findByCode).mockResolvedValue({
      code: '12345', company_id: 'company-1', department_id: null, role: 'Employee',
      generated_by: 'gen-1', expired_at: futureDate, status: 'Active',
    } as never)
    vi.mocked(authRepository.findByEmail).mockResolvedValue(null)
    vi.mocked(authRepository.createAuthUser).mockResolvedValue({ id: 'auth-1' } as never)
    vi.mocked(authRepository.createUser).mockRejectedValue(new Error('foreign key violation'))

    await expect(invitationService.redeemCode(baseInput)).rejects.toThrow('Setup failed. Please try again.')
  })
})

describe('invitationService.sendInvite — Send Direct Invitation (UC27)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  const inviter = { id: 'inviter-1', role: 'Owner', email_address: 'owner@test.com', full_name: 'Test Owner' }
  const baseInput = {
    email: 'invitee@test.com',
    role: 'Employee',
    company_id: 'company-1',
    department_id: null,
    invited_by: 'inviter-1',
  }

  it('rejects a Partner sending an invitation', async () => {
    vi.mocked(authRepository.findByAuthIdOrInternalId).mockResolvedValue({ ...inviter, role: 'Partner' } as never)

    await expect(invitationService.sendInvite(baseInput)).rejects.toThrow('Partners cannot invite members.')
    expect(invitationRepository.createCode).not.toHaveBeenCalled()
  })

  it('rejects inviting your own email address', async () => {
    vi.mocked(authRepository.findByAuthIdOrInternalId).mockResolvedValue(inviter as never)

    await expect(invitationService.sendInvite({ ...baseInput, email: 'OWNER@test.com' }))
      .rejects.toThrow('You cannot send an invitation to yourself.')
  })

  it('rejects when the invited email is already a member of this company', async () => {
    vi.mocked(authRepository.findByAuthIdOrInternalId).mockResolvedValue(inviter as never)
    vi.mocked(authRepository.findByEmail).mockResolvedValue({ id: 'existing-1', company_id: 'company-1' } as never)

    await expect(invitationService.sendInvite(baseInput)).rejects.toThrow('This user is already a member of this company.')
  })

  it('rejects when the invited email already has an account with a different company', async () => {
    vi.mocked(authRepository.findByAuthIdOrInternalId).mockResolvedValue(inviter as never)
    vi.mocked(authRepository.findByEmail).mockResolvedValue({ id: 'existing-1', company_id: 'company-2' } as never)

    await expect(invitationService.sendInvite(baseInput))
      .rejects.toThrow('This user already has an account with another company and cannot be invited.')
    expect(invitationRepository.createCode).not.toHaveBeenCalled()
    expect(emailService.sendInviteEmail).not.toHaveBeenCalled()
  })

  it('a brand-new email gets a fresh invitation code and an email', async () => {
    vi.mocked(authRepository.findByAuthIdOrInternalId).mockResolvedValue(inviter as never)
    vi.mocked(authRepository.findByEmail).mockResolvedValue(null)
    vi.mocked(invitationRepository.createCode).mockResolvedValue({
      code: '54321', company_id: 'company-1', department_id: null, role: 'Employee',
      generated_by: 'inviter-1', expired_at: futureDate,
    } as never)
    vi.mocked(companyRepository.findById).mockResolvedValue({ id: 'company-1', name: 'Acme Co' } as never)

    await invitationService.sendInvite(baseInput)

    expect(invitationRepository.createCode).toHaveBeenCalledWith(
      expect.objectContaining({ company_id: 'company-1', role: 'Employee', generated_by: 'inviter-1' })
    )
    expect(emailService.sendInviteEmail).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'invitee@test.com', role: 'Employee', companyName: 'Acme Co', inviterName: 'Test Owner' })
    )
  })
})
