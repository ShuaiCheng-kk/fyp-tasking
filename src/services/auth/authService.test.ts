import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockSupabase = vi.hoisted(() => ({
  auth: {
    signInWithPassword: vi.fn(),
    signOut: vi.fn(),
    resetPasswordForEmail: vi.fn(),
    updateUser: vi.fn(),
    resend: vi.fn(),
    signUp: vi.fn(),
  },
}))

vi.mock('@/lib/supabase', () => ({
  supabase: mockSupabase,
  createClient: () => ({}),
}))

const mockAdminClient = vi.hoisted(() => ({
  auth: {
    admin: {
      getUserById: vi.fn(),
      updateUserById: vi.fn(),
    },
    signInWithPassword: vi.fn(),
  },
}))

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => mockAdminClient,
}))

vi.mock('@/repositories/auth/authRepository', () => ({
  authRepository: {
    findByAuthId: vi.fn(),
    createUser: vi.fn(),
    updateAuthPassword: vi.fn(),
  },
}))

vi.mock('@/repositories/company/companyRepository', () => ({
  companyRepository: {},
}))

vi.mock('@/repositories/department/departmentRepository', () => ({
  departmentRepository: {},
}))

import { authService } from './authService'
import { authRepository } from '@/repositories/auth/authRepository'

describe('authService — Account & Authentication (UC82-85, UC88)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('signIn (UC83)', () => {
    it('signs in and returns the matching user profile', async () => {
      mockSupabase.auth.signInWithPassword.mockResolvedValue({
        data: { user: { id: 'auth-1' } },
        error: null,
      })
      const user = { id: 'user-1', supabase_auth_id: 'auth-1', role: 'Owner' }
      vi.mocked(authRepository.findByAuthId).mockResolvedValue(user as never)

      const result = await authService.signIn('owner@test.com', 'password123')

      expect(mockSupabase.auth.signInWithPassword).toHaveBeenCalledWith({
        email: 'owner@test.com',
        password: 'password123',
      })
      expect(authRepository.findByAuthId).toHaveBeenCalledWith('auth-1')
      expect(result).toEqual(user)
    })

    it('throws a generic invalid-credentials error when Supabase rejects the login', async () => {
      mockSupabase.auth.signInWithPassword.mockResolvedValue({
        data: { user: null },
        error: { message: 'Invalid login credentials' },
      })

      await expect(authService.signIn('owner@test.com', 'wrong')).rejects.toThrow('Invalid email or password')
      expect(authRepository.findByAuthId).not.toHaveBeenCalled()
    })

    it('throws when the auth user has no matching profile row', async () => {
      mockSupabase.auth.signInWithPassword.mockResolvedValue({
        data: { user: { id: 'auth-1' } },
        error: null,
      })
      vi.mocked(authRepository.findByAuthId).mockResolvedValue(null)

      await expect(authService.signIn('owner@test.com', 'password123')).rejects.toThrow('User profile not found')
    })
  })

  describe('signOut (UC88)', () => {
    it('calls Supabase signOut', async () => {
      mockSupabase.auth.signOut.mockResolvedValue({ error: null })

      await authService.signOut()

      expect(mockSupabase.auth.signOut).toHaveBeenCalled()
    })

    it('propagates a Supabase signOut error', async () => {
      mockSupabase.auth.signOut.mockResolvedValue({ error: { message: 'Network error' } })

      await expect(authService.signOut()).rejects.toThrow('Network error')
    })
  })

  describe('forgotPassword (UC84)', () => {
    it('requests a password reset email with a redirect URL', async () => {
      mockSupabase.auth.resetPasswordForEmail.mockResolvedValue({ error: null })

      await authService.forgotPassword('owner@test.com')

      expect(mockSupabase.auth.resetPasswordForEmail).toHaveBeenCalledWith(
        'owner@test.com',
        expect.objectContaining({ redirectTo: expect.stringContaining('/reset-password') }),
      )
    })

    it('throws when Supabase fails to send the reset email', async () => {
      mockSupabase.auth.resetPasswordForEmail.mockResolvedValue({ error: { message: 'Rate limited' } })

      await expect(authService.forgotPassword('owner@test.com')).rejects.toThrow('Rate limited')
    })
  })

  describe('resetPassword (UC84)', () => {
    beforeEach(() => {
      mockAdminClient.auth.admin.getUserById.mockResolvedValue({
        data: { user: { email: 'owner@test.com' } },
        error: null,
      })
    })

    it('updates the password via the admin API, invalidating other sessions', async () => {
      // Signing in with the "new" password fails — it genuinely differs from the current one.
      mockAdminClient.auth.signInWithPassword.mockResolvedValue({ data: { user: null }, error: { message: 'Invalid login credentials' } })
      vi.mocked(authRepository.updateAuthPassword).mockResolvedValue(undefined)

      await authService.resetPassword('auth-user-1', 'NewPassword123!')

      expect(authRepository.updateAuthPassword).toHaveBeenCalledWith('auth-user-1', 'NewPassword123!')
    })

    it('throws when the admin API rejects the new password', async () => {
      mockAdminClient.auth.signInWithPassword.mockResolvedValue({ data: { user: null }, error: { message: 'Invalid login credentials' } })
      vi.mocked(authRepository.updateAuthPassword).mockRejectedValue(new Error('Password too weak'))

      await expect(authService.resetPassword('auth-user-1', '123')).rejects.toThrow('Password too weak')
    })

    it('throws when the new password is the same as the current one (M8-CHAIN-01)', async () => {
      // Signing in with the "new" password succeeds — it's identical to the current password.
      mockAdminClient.auth.signInWithPassword.mockResolvedValue({ data: { user: { id: 'auth-user-1' } }, error: null })

      await expect(authService.resetPassword('auth-user-1', 'SamePassword123!')).rejects.toThrow(
        'New password must be different from your current password'
      )
      expect(authRepository.updateAuthPassword).not.toHaveBeenCalled()
    })
  })

  describe('resendConfirmation (UC85)', () => {
    it('asks Supabase to resend the signup confirmation email', async () => {
      mockSupabase.auth.resend.mockResolvedValue({ error: null })

      await authService.resendConfirmation('owner@test.com')

      expect(mockSupabase.auth.resend).toHaveBeenCalledWith({ type: 'signup', email: 'owner@test.com' })
    })

    it('throws when Supabase fails to resend the confirmation', async () => {
      mockSupabase.auth.resend.mockResolvedValue({ error: { message: 'Email already confirmed' } })

      await expect(authService.resendConfirmation('owner@test.com')).rejects.toThrow('Email already confirmed')
    })
  })

  describe('registerGuest (UC65 — Register Account, Guest User / Casual Worker path)', () => {
    const baseInput = {
      email: 'guest@test.com',
      password: 'Password123!',
      full_name: 'New Guest',
      phone: '91234567',
      date_of_birth: '2000-01-01',
      home_location: 'Singapore',
      job_id: null,
    }

    it('signs up via Supabase auth and returns the new user id + confirmation status', async () => {
      mockSupabase.auth.signUp.mockResolvedValue({
        data: { user: { id: 'auth-guest-1', email_confirmed_at: null } },
        error: null,
      })

      const result = await authService.registerGuest(baseInput)

      expect(mockSupabase.auth.signUp).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'guest@test.com',
          password: 'Password123!',
          options: expect.objectContaining({
            data: expect.objectContaining({ full_name: 'New Guest', phone_number: '91234567' }),
          }),
        })
      )
      expect(result).toEqual({ user_id: 'auth-guest-1', email_confirmed: false })
    })

    it('throws when Supabase signUp errors (e.g. duplicate email)', async () => {
      mockSupabase.auth.signUp.mockResolvedValue({ data: { user: null }, error: { message: 'User already registered' } })

      await expect(authService.registerGuest(baseInput)).rejects.toThrow('User already registered')
    })

    it('throws when Supabase returns no user and no error', async () => {
      mockSupabase.auth.signUp.mockResolvedValue({ data: { user: null }, error: null })

      await expect(authService.registerGuest(baseInput)).rejects.toThrow('Registration failed')
    })
  })
})
