import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase', () => ({
  supabase: {},
  createClient: () => ({}),
}))

vi.mock('@/repositories/company/companyRepository', () => ({
  companyRepository: {
    updateCompany: vi.fn(),
  },
}))

vi.mock('@/repositories/auth/authRepository', () => ({
  authRepository: {
    getUserById: vi.fn(),
  },
}))

vi.mock('@/services/auth/userService', () => ({
  userService: {
    assertOwnerRole: vi.fn(),
  },
}))

import { companyService } from './companyService'
import { companyRepository } from '@/repositories/company/companyRepository'
import { userService } from '@/services/auth/userService'

const validProfile = {
  name: 'Test Company',
  description: 'A great place to work',
  postal_code: '123456',
  location: 'Singapore',
  address: '1 Test Street',
  industry: 'Retail',
  size: '20-30',
}

describe('UC33 Edit Company Profile', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('UC33-M-UT-O: Owner edits the company profile with all fields filled in correctly', async () => {
    vi.mocked(userService.assertOwnerRole).mockResolvedValue(undefined as never)
    const updated = { id: 'comp-1', owner_id: 'owner-1', plan: 'Free', ...validProfile }
    vi.mocked(companyRepository.updateCompany).mockResolvedValue(updated as never)

    const result = await companyService.updateCompany('comp-1', 'owner-1', validProfile)

    expect(result).toEqual(updated)
    expect(companyRepository.updateCompany).toHaveBeenCalledWith('comp-1', validProfile)
  })

  it('UC33-A1-UT-O-1: Owner is blocked from saving the profile with a required field left blank', async () => {
    vi.mocked(userService.assertOwnerRole).mockResolvedValue(undefined as never)

    await expect(companyService.updateCompany('comp-1', 'owner-1', { ...validProfile, description: '' }))
      .rejects.toThrow('Company description is required.')

    expect(companyRepository.updateCompany).not.toHaveBeenCalled()
  })

  it('UC33-A1-UT-O-2: Owner is blocked from saving the profile with a postal code that is not exactly 6 digits', async () => {
    vi.mocked(userService.assertOwnerRole).mockResolvedValue(undefined as never)

    await expect(companyService.updateCompany('comp-1', 'owner-1', { ...validProfile, postal_code: '12345' }))
      .rejects.toThrow('Postal code must be exactly 6 digits.')

    expect(companyRepository.updateCompany).not.toHaveBeenCalled()
  })

  it('UC33-A1-UT-O-3: Owner is blocked from saving the profile with Number of Staff set to 0', async () => {
    vi.mocked(userService.assertOwnerRole).mockResolvedValue(undefined as never)

    await expect(companyService.updateCompany('comp-1', 'owner-1', { ...validProfile, size: '0' }))
      .rejects.toThrow('Number of staff cannot be 0.')

    expect(companyRepository.updateCompany).not.toHaveBeenCalled()
  })

  it('UC33-BR-UT-P: Partner is blocked from editing the company profile, since only the original creator may edit it', async () => {
    vi.mocked(userService.assertOwnerRole).mockRejectedValue(new Error('Only an Owner can perform this action'))

    await expect(companyService.updateCompany('comp-1', 'partner-1', validProfile))
      .rejects.toThrow('Only an Owner can perform this action')

    expect(companyRepository.updateCompany).not.toHaveBeenCalled()
  })
})
