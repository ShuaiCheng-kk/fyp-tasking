import { describe, it, expect, vi, beforeEach } from 'vitest'

const generateLinkMock = vi.fn()

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      signUp: vi.fn(),
    },
  },
  createClient: () => ({}),
}))

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    auth: { admin: { generateLink: generateLinkMock, deleteUser: vi.fn() } },
  }),
}))

vi.mock('@/repositories/auth/authRepository', () => ({
  authRepository: {
    createAuthUser: vi.fn(),
    deleteAuthUser: vi.fn(),
  },
}))

vi.mock('@/services/email/emailService', () => ({
  emailService: {
    sendConfirmationRequestEmail: vi.fn(),
  },
}))

import { authService } from './authService'
import { authRepository } from '@/repositories/auth/authRepository'
import { supabase } from '@/lib/supabase'
import { emailService } from '@/services/email/emailService'

describe('UC69 Register Account', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('UC69-M-UT-O: Owner registers, creating the Supabase Auth account and sending a confirmation email', async () => {
    vi.mocked(authRepository.createAuthUser).mockResolvedValue({ id: 'auth-owner-1' } as never)
    generateLinkMock.mockResolvedValue({ data: { properties: { action_link: 'https://app/confirm?token=abc' } }, error: null })

    const result = await authService.registerOwner({
      full_name: 'New Owner', email: 'owner@test.com', password: 'Password123!', phone: '+6591234567',
    })

    expect(result).toEqual({ user_id: 'auth-owner-1' })
    expect(authRepository.createAuthUser).toHaveBeenCalledWith('owner@test.com', 'Password123!', false)
    expect(emailService.sendConfirmationRequestEmail).toHaveBeenCalledWith(expect.objectContaining({ to: 'owner@test.com' }))
  })

  it('UC69-M-UT-GU: Guest User registers from the public job board with their profile details persisted', async () => {
    vi.mocked(supabase.auth.signUp).mockResolvedValue({
      data: { user: { id: 'auth-guest-1', email_confirmed_at: null } },
      error: null,
    } as never)

    const result = await authService.registerGuest({
      email: 'guest@test.com', password: 'Password123!', full_name: 'New Guest', phone: '+6598765432', date_of_birth: '2000-01-01',
    })

    expect(result).toEqual({ user_id: 'auth-guest-1', email_confirmed: false })
    expect(supabase.auth.signUp).toHaveBeenCalledWith(expect.objectContaining({
      email: 'guest@test.com',
      options: { data: { full_name: 'New Guest', phone_number: '+6598765432', date_of_birth: '2000-01-01' } },
    }))
  })
})
