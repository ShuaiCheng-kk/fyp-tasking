import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabaseAdmin', () => ({
  getSupabaseAdmin: () => ({}),
}))

vi.mock('@/lib/supabase', () => ({
  supabase: {},
  createClient: () => ({}),
}))

vi.mock('@/repositories/guest/workerProfileRepository', () => ({
  workerProfileRepository: {
    getByAuthId: vi.fn(),
    updateByAuthId: vi.fn(),
    updateSkillsByAuthId: vi.fn(),
    uploadProfileFile: vi.fn(),
    addCertificate: vi.fn(),
    updateResumeUrlByAuthId: vi.fn(),
  },
}))

import { workerProfileService } from './workerProfileService'
import { workerProfileRepository } from '@/repositories/guest/workerProfileRepository'

function makeFile(name: string, type: string, size: number): File {
  return { name, type, size } as unknown as File
}

describe('UC73 Edit Profile (Guest User / Casual Worker Worker Profile)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(workerProfileRepository.getByAuthId).mockResolvedValue({ id: 'worker-1' } as never)
  })

  it('UC73-M-UT-2: Casual Worker edits their name, phone number, date of birth, and profile photo', async () => {
    vi.mocked(workerProfileRepository.updateByAuthId).mockResolvedValue({ full_name: 'Casual Chris' } as never)

    const result = await workerProfileService.updateProfile('auth-cw-1', {
      full_name: 'Casual Chris', phone_number: '+6598889999', date_of_birth: '1998-03-03', profile_photo_url: 'photo.jpg',
    })

    expect(result).toMatchObject({ full_name: 'Casual Chris' })
    expect(workerProfileRepository.updateByAuthId).toHaveBeenCalledWith('auth-cw-1', expect.objectContaining({ full_name: 'Casual Chris' }))
  })

  it('UC73-BR-UT: Blocked from saving the profile with the name field left blank', async () => {
    await expect(workerProfileService.updateProfile('auth-cw-1', {
      full_name: '   ', phone_number: null, date_of_birth: null, profile_photo_url: null,
    })).rejects.toThrow('Full name is required')
    expect(workerProfileRepository.updateByAuthId).not.toHaveBeenCalled()
  })

  it('UC73-A1-UT-GU: Guest User adds a skills entry to their Worker Profile', async () => {
    vi.mocked(workerProfileRepository.updateSkillsByAuthId).mockResolvedValue({ skills: 'Cash handling, forklift certified' } as never)

    const result = await workerProfileService.updateSkills('auth-guest-1', 'Cash handling, forklift certified')

    expect(result).toMatchObject({ skills: 'Cash handling, forklift certified' })
  })

  it('UC73-A1-UT-CW: Casual Worker adds a certificate with a proof file to their Worker Profile', async () => {
    vi.mocked(workerProfileRepository.uploadProfileFile).mockResolvedValue('https://files/cert.pdf' as never)
    vi.mocked(workerProfileRepository.addCertificate).mockResolvedValue({ id: 'cert-1', name: 'Food Hygiene Certificate' } as never)

    const result = await workerProfileService.addCertificate('auth-cw-1', 'Food Hygiene Certificate', makeFile('cert.pdf', 'application/pdf', 1024))

    expect(result).toMatchObject({ id: 'cert-1', name: 'Food Hygiene Certificate' })
  })

  it('UC73-A1-BR-UT-1: Blocked from saving skills text over the character limit', async () => {
    const tooLong = 'a'.repeat(2001)

    await expect(workerProfileService.updateSkills('auth-guest-1', tooLong))
      .rejects.toThrow('Skills must be at most 2000 characters')
  })

  it('UC73-A1-BR-UT-2: Blocked from uploading a resume that is not PDF, DOC, or DOCX', async () => {
    await expect(workerProfileService.uploadResume('auth-guest-1', makeFile('resume.png', 'image/png', 1024)))
      .rejects.toThrow('Resume must be PDF, DOC, or DOCX')
  })

  it('UC73-A1-BR-UT-3: Blocked from attaching a certificate file larger than 5MB', async () => {
    await expect(workerProfileService.addCertificate('auth-cw-1', 'Food Hygiene Certificate', makeFile('cert.pdf', 'application/pdf', 6 * 1024 * 1024)))
      .rejects.toThrow('Certificate file must be smaller than 5MB')
  })
})
