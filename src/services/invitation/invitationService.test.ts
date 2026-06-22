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
    insertInboxInvite: vi.fn(),
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

const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

describe('invitationService.redeemCode — Accept Company Invitation (UC87)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  const baseInput = {
    code: '12345',
    full_name: 'New Employee',
    email_address: 'employee@test.com',
    password: 'Password123!',
    phone_number: null,
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
