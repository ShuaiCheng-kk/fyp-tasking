import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase', () => ({
  supabase: {},
  createClient: () => ({}),
}))

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    auth: { admin: { getUserById: vi.fn().mockResolvedValue({ data: { user: { user_metadata: {} } } }) } },
  }),
}))

vi.mock('@/repositories/auth/authRepository', () => ({
  authRepository: {
    findByAuthId: vi.fn(),
    createUser: vi.fn(),
    updateCompanyId: vi.fn(),
  },
}))

vi.mock('@/repositories/company/companyRepository', () => ({
  companyRepository: {
    findByName: vi.fn(),
    createCompany: vi.fn(),
  },
}))

vi.mock('@/repositories/department/departmentRepository', () => ({
  departmentRepository: {
    createDepartment: vi.fn(),
  },
}))

import { authService } from './authService'
import { authRepository } from '@/repositories/auth/authRepository'
import { companyRepository } from '@/repositories/company/companyRepository'
import { departmentRepository } from '@/repositories/department/departmentRepository'

const ownerSetupInput = {
  user_id: 'auth-owner-1', full_name: 'New Owner', email_address: 'owner@test.com',
  phone_number: '+6591234567', date_of_birth: '2000-01-01', profile_photo_url: '',
  company_name: 'Test Co', company_description: '', company_location: null, company_address: null,
  company_postal_code: null, company_industry: null, company_size: null, departments: ['Retail'], plan: 'Free',
}

describe('UC72 Verify Email', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('UC72-M-UT-O: Owner clicks Continue Registration after verifying, finishing company setup', async () => {
    vi.mocked(authRepository.findByAuthId).mockResolvedValue(null)
    vi.mocked(authRepository.createUser).mockResolvedValue({ id: 'user-1', company_id: null } as never)
    vi.mocked(companyRepository.findByName).mockResolvedValue(null)
    vi.mocked(companyRepository.createCompany).mockResolvedValue({ id: 'comp-1' } as never)
    vi.mocked(authRepository.updateCompanyId).mockResolvedValue(undefined as never)
    vi.mocked(departmentRepository.createDepartment).mockResolvedValue(undefined as never)

    const result = await authService.completeCompanySetup(ownerSetupInput)

    expect(result).toEqual({ company_id: 'comp-1' })
    expect(authRepository.createUser).toHaveBeenCalledWith(expect.objectContaining({ role: 'Owner' }))
    expect(companyRepository.createCompany).toHaveBeenCalledWith(expect.objectContaining({ name: 'Test Co' }))
  })

  it('UC72-M-UT-GU: Guest User clicks Continue Registration after verifying, finishing their account', async () => {
    vi.mocked(authRepository.createUser).mockResolvedValue({ id: 'user-guest-1', role: 'Guest User', full_name: 'New Guest' } as never)

    const result = await authService.completeGuestRegistration({
      user_id: 'auth-guest-1', full_name: 'New Guest', email_address: 'guest@test.com',
      phone_number: '+6598765432', date_of_birth: '2000-01-01', profile_photo_url: '',
    })

    expect(authRepository.createUser).toHaveBeenCalledWith(expect.objectContaining({ role: 'Guest User', full_name: 'New Guest' }))
    expect(result).toMatchObject({ id: 'user-guest-1', role: 'Guest User' })
  })

  it('UC72-BR-UT-O: Owner is blocked from finishing company setup with a name already used by another company', async () => {
    vi.mocked(authRepository.findByAuthId).mockResolvedValue(null)
    vi.mocked(authRepository.createUser).mockResolvedValue({ id: 'user-1', company_id: null } as never)
    vi.mocked(companyRepository.findByName).mockResolvedValue({ id: 'existing-comp' } as never)

    await expect(authService.completeCompanySetup(ownerSetupInput))
      .rejects.toThrow('A company named "Test Co" already exists')
    expect(companyRepository.createCompany).not.toHaveBeenCalled()
  })
})
