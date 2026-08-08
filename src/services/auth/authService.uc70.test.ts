import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabaseAdmin', () => ({
  getSupabaseAdmin: () => ({}),
}))

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      signInWithPassword: vi.fn(),
    },
  },
  createClient: () => ({}),
}))

vi.mock('@/repositories/auth/authRepository', () => ({
  authRepository: {
    findByAuthId: vi.fn(),
  },
}))

import { authService, classifySignInError } from './authService'
import { authRepository } from '@/repositories/auth/authRepository'
import { supabase } from '@/lib/supabase'

describe('UC70 Sign In', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('UC70-M-UT: Signing in with correct credentials authenticates and returns the account\'s role for redirect', async () => {
    vi.mocked(supabase.auth.signInWithPassword).mockResolvedValue({
      data: { user: { id: 'auth-1' } }, error: null,
    } as never)
    vi.mocked(authRepository.findByAuthId).mockResolvedValue({ id: 'user-1', role: 'Manager', full_name: 'Test Manager' } as never)

    const result = await authService.signIn('manager@test.com', 'Password123!')

    expect(result).toMatchObject({ id: 'user-1', role: 'Manager' })
  })

  it('UC70-A1-UT: Signing in with a wrong email/password combination shows "Invalid email or password"', async () => {
    vi.mocked(supabase.auth.signInWithPassword).mockResolvedValue({
      data: { user: null }, error: { message: 'Invalid login credentials' },
    } as never)

    await expect(authService.signIn('manager@test.com', 'WrongPassword'))
      .rejects.toThrow('Invalid email or password')
  })

  it('UC70-A2-UT: Signing in before confirming email shows the email-not-confirmed message', async () => {
    vi.mocked(supabase.auth.signInWithPassword).mockResolvedValue({
      data: { user: null }, error: { message: 'Email not confirmed' },
    } as never)

    await expect(authService.signIn('unconfirmed@test.com', 'Password123!'))
      .rejects.toThrow('Email not confirmed')
  })

  it('UC70-BR-UT: The error classifier distinguishes email-not-confirmed from every other sign-in failure', () => {
    expect(classifySignInError('Email not confirmed')).toBe('Email not confirmed')
    expect(classifySignInError('Invalid login credentials')).toBe('Invalid email or password')
    expect(classifySignInError(null)).toBe('Invalid email or password')
  })
})
