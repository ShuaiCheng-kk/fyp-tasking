import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase', () => ({
  supabase: {},
  createClient: () => ({}),
}))

vi.mock('@/repositories/auth/authRepository', () => ({
  authRepository: {
    updateProfile: vi.fn(),
    findById: vi.fn(),
    deleteById: vi.fn(),
    deleteAuthUser: vi.fn(),
  },
}))

vi.mock('@/repositories/company/companyRepository', () => ({
  companyRepository: {
    nullifyUserCompanyId: vi.fn(),
    expireInvitationCodesForUser: vi.fn(),
  },
}))

import { userService } from './userService'
import { authRepository } from '@/repositories/auth/authRepository'

describe('userService — Edit Own Profile (UC86)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('delegates the profile patch to the repository', async () => {
    const updated = { id: 'user-1', full_name: 'Jane Doe', phone_number: '12345678', date_of_birth: '1990-01-01' }
    vi.mocked(authRepository.updateProfile).mockResolvedValue(updated as never)

    const result = await userService.updateProfile('user-1', {
      full_name: 'Jane Doe',
      phone_number: '12345678',
      date_of_birth: '1990-01-01',
    })

    expect(authRepository.updateProfile).toHaveBeenCalledWith('user-1', {
      full_name: 'Jane Doe',
      phone_number: '12345678',
      date_of_birth: '1990-01-01',
    })
    expect(result).toEqual(updated)
  })

  it('propagates a repository failure', async () => {
    vi.mocked(authRepository.updateProfile).mockRejectedValue(new Error('Failed to update profile: not found'))

    await expect(userService.updateProfile('missing-user', { full_name: 'X' })).rejects.toThrow(
      'Failed to update profile: not found',
    )
  })
})
