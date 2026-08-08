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
    findByCode: vi.fn(),
    insertManagerDepartment: vi.fn(),
    insertEmployeeDepartment: vi.fn(),
    markAsUsed: vi.fn(),
  },
}))

vi.mock('@/repositories/auth/authRepository', () => ({
  authRepository: {
    findByEmail: vi.fn(),
    findByPhoneNumber: vi.fn(),
    createAuthUser: vi.fn(),
    createUser: vi.fn(),
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

const futureExpiry = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString()
const pastExpiry = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

function redeemInput(overrides: Partial<{ code: string; full_name: string; email_address: string }> = {}) {
  return {
    code: 'ABC12345', full_name: 'New Member', email_address: 'newmember@test.com', password: 'Password123!',
    phone_number: '+6591234567', date_of_birth: '2000-01-01', profile_photo_url: '',
    ...overrides,
  }
}

describe('UC74 Accept Company Invitation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(authRepository.findByEmail).mockResolvedValue(null)
    vi.mocked(authRepository.findByPhoneNumber).mockResolvedValue(null)
    vi.mocked(authRepository.createAuthUser).mockResolvedValue({ id: 'auth-new-1' } as never)
    vi.mocked(invitationRepository.markAsUsed).mockResolvedValue(undefined as never)
  })

  it('UC74-M-UT-P: Partner redeems a valid invitation code and joins the inviting company', async () => {
    vi.mocked(invitationRepository.findByCode).mockResolvedValue({ code: 'ABC12345', role: 'partner', company_id: 'comp-1', department_id: null, expired_at: futureExpiry } as never)
    vi.mocked(authRepository.createUser).mockResolvedValue({ id: 'user-1', role: 'Partner', company_id: 'comp-1' } as never)

    const result = await invitationService.redeemCode(redeemInput())

    expect(result).toMatchObject({ user: { role: 'Partner' }, company_id: 'comp-1' })
    expect(invitationRepository.insertManagerDepartment).not.toHaveBeenCalled()
    expect(invitationRepository.markAsUsed).toHaveBeenCalledWith('ABC12345', 'user-1')
  })

  it('UC74-M-UT-M: Manager redeems a valid invitation code and joins with their role and department already set', async () => {
    vi.mocked(invitationRepository.findByCode).mockResolvedValue({ code: 'ABC12345', role: 'manager', company_id: 'comp-1', department_id: 'dept-1', expired_at: futureExpiry } as never)
    vi.mocked(authRepository.createUser).mockResolvedValue({ id: 'user-2', role: 'Manager', company_id: 'comp-1' } as never)

    const result = await invitationService.redeemCode(redeemInput())

    expect(result).toMatchObject({ user: { role: 'Manager' } })
    expect(invitationRepository.insertManagerDepartment).toHaveBeenCalledWith('user-2', 'dept-1', 'comp-1')
  })

  it('UC74-M-UT-E: Employee redeems a valid invitation code and joins with their role and department already set', async () => {
    vi.mocked(invitationRepository.findByCode).mockResolvedValue({ code: 'ABC12345', role: 'employee', company_id: 'comp-1', department_id: 'dept-1', expired_at: futureExpiry } as never)
    vi.mocked(authRepository.createUser).mockResolvedValue({ id: 'user-3', role: 'Employee', company_id: 'comp-1' } as never)

    const result = await invitationService.redeemCode(redeemInput())

    expect(result).toMatchObject({ user: { role: 'Employee' } })
    expect(invitationRepository.insertEmployeeDepartment).toHaveBeenCalledWith('user-3', 'dept-1')
  })

  it('UC74-A1-UT-1: Blocked from registering with a code that does not exist', async () => {
    vi.mocked(invitationRepository.findByCode).mockResolvedValue(null as never)

    await expect(invitationService.redeemCode(redeemInput()))
      .rejects.toThrow('Invalid or expired invitation code')
  })

  it('UC74-A1-UT-2: Blocked from registering with a code that is past its 7-day expiry', async () => {
    vi.mocked(invitationRepository.findByCode).mockResolvedValue({ code: 'ABC12345', role: 'employee', company_id: 'comp-1', department_id: 'dept-1', expired_at: pastExpiry } as never)

    await expect(invitationService.redeemCode(redeemInput()))
      .rejects.toThrow('This invitation has expired')
  })

  it('UC74-A2-UT-1: Blocked from registering when the email already has an account', async () => {
    vi.mocked(invitationRepository.findByCode).mockResolvedValue({ code: 'ABC12345', role: 'employee', company_id: 'comp-1', department_id: 'dept-1', expired_at: futureExpiry } as never)
    vi.mocked(authRepository.findByEmail).mockResolvedValue({ id: 'existing-user' } as never)

    await expect(invitationService.redeemCode(redeemInput()))
      .rejects.toThrow('An account with this email already exists. Please sign in instead.')
  })

  it('UC74-A2-UT-2: Blocked from registering when the phone number is already registered to someone else', async () => {
    vi.mocked(invitationRepository.findByCode).mockResolvedValue({ code: 'ABC12345', role: 'employee', company_id: 'comp-1', department_id: 'dept-1', expired_at: futureExpiry } as never)
    vi.mocked(authRepository.findByPhoneNumber).mockResolvedValue({ id: 'existing-user' } as never)

    await expect(invitationService.redeemCode(redeemInput()))
      .rejects.toThrow('This phone number is already registered')
  })

  it('UC74-BR-UT: The account is auto-confirmed immediately, with no separate email verification step', async () => {
    vi.mocked(invitationRepository.findByCode).mockResolvedValue({ code: 'ABC12345', role: 'employee', company_id: 'comp-1', department_id: 'dept-1', expired_at: futureExpiry } as never)
    vi.mocked(authRepository.createUser).mockResolvedValue({ id: 'user-4', role: 'Employee', company_id: 'comp-1' } as never)

    await invitationService.redeemCode(redeemInput())

    expect(authRepository.createAuthUser).toHaveBeenCalledWith('newmember@test.com', 'Password123!', true)
  })
})
