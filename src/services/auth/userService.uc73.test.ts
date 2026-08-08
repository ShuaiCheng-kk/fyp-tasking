import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabaseAdmin', () => ({
  getSupabaseAdmin: () => ({}),
}))

vi.mock('@/lib/supabase', () => ({
  supabase: {},
  createClient: () => ({}),
}))

vi.mock('@/repositories/auth/authRepository', () => ({
  authRepository: {
    updateProfile: vi.fn(),
  },
}))

import { userService } from './userService'
import { authRepository } from '@/repositories/auth/authRepository'

describe('UC73 Edit Profile (Owner/Partner/Manager/Employee)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('UC73-M-UT-1: Employee edits their name, phone number, date of birth, and profile photo', async () => {
    vi.mocked(authRepository.updateProfile).mockResolvedValue({
      id: 'emp-1', full_name: 'Updated Name', phone_number: '+6599990000', date_of_birth: '1995-05-05', profile_photo_url: 'photo.jpg',
    } as never)

    const result = await userService.updateProfile('emp-1', {
      full_name: 'Updated Name', phone_number: '+6599990000', date_of_birth: '1995-05-05', profile_photo_url: 'photo.jpg',
    })

    expect(result).toMatchObject({ full_name: 'Updated Name', phone_number: '+6599990000' })
    expect(authRepository.updateProfile).toHaveBeenCalledWith('emp-1', expect.objectContaining({ full_name: 'Updated Name' }))
  })
})
