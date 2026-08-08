import { describe, it, expect, vi, beforeEach } from 'vitest'

const getUserByIdMock = vi.fn()
const signInWithPasswordMock = vi.fn()

vi.mock('@/lib/supabaseAdmin', () => ({
  getSupabaseAdmin: () => ({}),
}))

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      resetPasswordForEmail: vi.fn(),
    },
  },
  createClient: () => ({}),
}))

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    auth: {
      admin: { getUserById: getUserByIdMock },
      signInWithPassword: signInWithPasswordMock,
    },
  }),
}))

vi.mock('@/repositories/auth/authRepository', () => ({
  authRepository: {
    updateAuthPassword: vi.fn(),
  },
}))

import { authService } from './authService'
import { authRepository } from '@/repositories/auth/authRepository'
import { supabase } from '@/lib/supabase'

describe('UC71 Reset Password', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getUserByIdMock.mockResolvedValue({ data: { user: { email: 'user@test.com' } }, error: null })
  })

  it('UC71-M-UT-1: Requesting a reset link sends a reset email to the account', async () => {
    vi.mocked(supabase.auth.resetPasswordForEmail).mockResolvedValue({ error: null } as never)

    await authService.forgotPassword('user@test.com')

    expect(supabase.auth.resetPasswordForEmail).toHaveBeenCalledWith('user@test.com', expect.objectContaining({ redirectTo: expect.any(String) }))
  })

  it('UC71-M-UT-2: Submitting a new password via the reset link updates the account\'s password', async () => {
    signInWithPasswordMock.mockResolvedValue({ data: { user: null } })
    vi.mocked(authRepository.updateAuthPassword).mockResolvedValue(undefined as never)

    await authService.resetPassword('auth-1', 'BrandNewPassword123!')

    expect(authRepository.updateAuthPassword).toHaveBeenCalledWith('auth-1', 'BrandNewPassword123!')
  })

  it('UC71-BR-UT: Submitting the same password the account already has is rejected as no real change', async () => {
    // Verified by attempting to sign in with the "new" password against the account's current
    // credentials — succeeding means it's unchanged.
    signInWithPasswordMock.mockResolvedValue({ data: { user: { id: 'auth-1' } } })

    await expect(authService.resetPassword('auth-1', 'SamePasswordAsBefore123!'))
      .rejects.toThrow('New password must be different from your current password')
    expect(authRepository.updateAuthPassword).not.toHaveBeenCalled()
  })
})
