import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase', () => ({
  supabase: {},
  createClient: () => ({}),
}))

vi.mock('@/repositories/invitation/invitationRepository', () => ({
  invitationRepository: {
    findByCode: vi.fn(),
  },
}))

vi.mock('@/repositories/auth/authRepository', () => ({
  authRepository: {
    findByEmail: vi.fn(),
  },
}))

vi.mock('@/services/email/emailService', () => ({
  emailService: {
    sendInviteEmail: vi.fn(),
  },
}))

import { invitationService } from './invitationService'
import { invitationRepository } from '@/repositories/invitation/invitationRepository'

describe('UC69 Register Account (invited role, Alt Flow A1)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('UC69-A1-UT-M: A Manager entering an invalid or expired invitation code is blocked from registering', async () => {
    vi.mocked(invitationRepository.findByCode).mockResolvedValue(null as never)

    await expect(invitationService.redeemCode({
      code: 'BADCODE', full_name: 'New Manager', email_address: 'manager@test.com', password: 'Password123!',
      phone_number: '+6591112222', date_of_birth: '2000-01-01', profile_photo_url: '',
    })).rejects.toThrow('Invalid or expired invitation code')
  })
})
