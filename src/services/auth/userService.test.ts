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

describe('userService — Edit Own Profile (UC69)', () => {
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

describe('userService — assertOwnerRole (Owner-only UC guard)', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('resolves when the requester is an Owner', async () => {
    vi.spyOn(userService, 'getUserById').mockResolvedValue({ id: 'u1', role: 'Owner' } as never)
    await expect(userService.assertOwnerRole('u1')).resolves.toBeUndefined()
  })

  it('rejects when the requester is a Partner', async () => {
    vi.spyOn(userService, 'getUserById').mockResolvedValue({ id: 'u2', role: 'Partner' } as never)
    await expect(userService.assertOwnerRole('u2')).rejects.toThrow('Only an Owner can perform this action')
  })

  it('rejects when the requester does not exist', async () => {
    vi.spyOn(userService, 'getUserById').mockRejectedValue(new Error('User not found'))
    await expect(userService.assertOwnerRole('missing')).rejects.toThrow('User not found')
  })
})
