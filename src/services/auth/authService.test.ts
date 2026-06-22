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

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({}),
}))

vi.mock('@/repositories/auth/authRepository', () => ({
  authRepository: {
    findByAuthId: vi.fn(),
    createUser: vi.fn(),
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
    it('updates the authenticated user password', async () => {
      mockSupabase.auth.updateUser.mockResolvedValue({ error: null })

      await authService.resetPassword('NewPassword123!')

      expect(mockSupabase.auth.updateUser).toHaveBeenCalledWith({ password: 'NewPassword123!' })
    })

    it('throws when Supabase rejects the new password', async () => {
      mockSupabase.auth.updateUser.mockResolvedValue({ error: { message: 'Password too weak' } })

      await expect(authService.resetPassword('123')).rejects.toThrow('Password too weak')
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
})
