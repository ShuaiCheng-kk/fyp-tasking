import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase', () => ({
  supabase: {},
  createClient: () => ({}),
}))

vi.mock('@/repositories/guest/workerProfileRepository', () => ({
  workerProfileRepository: {
    getByAuthId: vi.fn(),
    updateByAuthId: vi.fn(),
    updateSkillsByAuthId: vi.fn(),
    updateResumeUrlByAuthId: vi.fn(),
    getCertificatesByUserId: vi.fn(),
    addCertificate: vi.fn(),
    deleteCertificate: vi.fn(),
    uploadProfileFile: vi.fn(),
  },
}))

import { workerProfileService } from './workerProfileService'
import { workerProfileRepository } from '@/repositories/guest/workerProfileRepository'

const baseUser = {
  id: 'user-1',
  full_name: 'John Tan',
  email_address: 'john@example.com',
  phone_number: null,
  date_of_birth: '2004-05-01',
  profile_photo_url: null,
  role: 'Guest User',
  supabase_auth_id: 'auth-1',
  skills: null,
  resume_url: null,
}

function makeFile(name: string, type: string, sizeBytes = 1024): File {
  const file = new File([new Uint8Array(1)], name, { type })
  Object.defineProperty(file, 'size', { value: sizeBytes })
  return file
}

describe('workerProfileService — Worker Profile', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(workerProfileRepository.getByAuthId).mockResolvedValue(baseUser)
  })

  describe('getProfile', () => {
    it('returns the user merged with their certificates', async () => {
      vi.mocked(workerProfileRepository.getCertificatesByUserId).mockResolvedValue([
        { id: 'cert-1', user_id: 'user-1', name: 'Food Hygiene Certificate', file_url: null, created_at: '2026-07-01T00:00:00Z' },
      ])

      const profile = await workerProfileService.getProfile('auth-1')

      expect(profile?.id).toBe('user-1')
      expect(profile?.certificates).toHaveLength(1)
      expect(profile?.certificates[0].name).toBe('Food Hygiene Certificate')
    })

    it('returns null when no user matches the auth id', async () => {
      vi.mocked(workerProfileRepository.getByAuthId).mockResolvedValue(null)

      expect(await workerProfileService.getProfile('auth-x')).toBeNull()
    })

    it('throws when auth id is missing', async () => {
      await expect(workerProfileService.getProfile('')).rejects.toThrow('Missing user id')
    })
  })

  describe('updateSkills', () => {
    it('trims skills and persists them', async () => {
      vi.mocked(workerProfileRepository.updateSkillsByAuthId).mockResolvedValue({ ...baseUser, skills: 'Barista, Cash handling' })

      await workerProfileService.updateSkills('auth-1', '  Barista, Cash handling  ')

      expect(workerProfileRepository.updateSkillsByAuthId).toHaveBeenCalledWith('auth-1', 'Barista, Cash handling')
    })

    it('stores empty skills as null', async () => {
      vi.mocked(workerProfileRepository.updateSkillsByAuthId).mockResolvedValue(baseUser)

      await workerProfileService.updateSkills('auth-1', '   ')

      expect(workerProfileRepository.updateSkillsByAuthId).toHaveBeenCalledWith('auth-1', null)
    })

    it('rejects skills over 2000 characters', async () => {
      await expect(workerProfileService.updateSkills('auth-1', 'x'.repeat(2001)))
        .rejects.toThrow('at most 2000 characters')
    })
  })

  describe('uploadResume', () => {
    it('uploads a PDF and stores the returned URL on the profile', async () => {
      vi.mocked(workerProfileRepository.uploadProfileFile).mockResolvedValue('https://cdn/resume.pdf')
      vi.mocked(workerProfileRepository.updateResumeUrlByAuthId).mockResolvedValue({ ...baseUser, resume_url: 'https://cdn/resume.pdf' })

      const profile = await workerProfileService.uploadResume('auth-1', makeFile('cv.pdf', 'application/pdf'))

      expect(workerProfileRepository.uploadProfileFile).toHaveBeenCalledWith(
        expect.any(File),
        expect.stringMatching(/^profiles\/user-1\/\d+-resume-cv\.pdf$/),
      )
      expect(workerProfileRepository.updateResumeUrlByAuthId).toHaveBeenCalledWith('auth-1', 'https://cdn/resume.pdf')
      expect(profile.resume_url).toBe('https://cdn/resume.pdf')
    })

    it('rejects non-document file types', async () => {
      await expect(workerProfileService.uploadResume('auth-1', makeFile('cv.png', 'image/png')))
        .rejects.toThrow('Resume must be PDF, DOC, or DOCX')
    })

    it('rejects files over 5MB', async () => {
      await expect(workerProfileService.uploadResume('auth-1', makeFile('cv.pdf', 'application/pdf', 6 * 1024 * 1024)))
        .rejects.toThrow('smaller than 5MB')
    })
  })

  describe('removeResume', () => {
    it('clears the resume URL', async () => {
      vi.mocked(workerProfileRepository.updateResumeUrlByAuthId).mockResolvedValue(baseUser)

      await workerProfileService.removeResume('auth-1')

      expect(workerProfileRepository.updateResumeUrlByAuthId).toHaveBeenCalledWith('auth-1', null)
    })
  })

  describe('addCertificate', () => {
    it('adds a text-only certificate without any upload', async () => {
      vi.mocked(workerProfileRepository.addCertificate).mockResolvedValue({
        id: 'cert-1', user_id: 'user-1', name: 'First Aid Certificate (CPR + AED)', file_url: null, created_at: '2026-07-11T00:00:00Z',
      })

      const cert = await workerProfileService.addCertificate('auth-1', '  First Aid Certificate (CPR + AED) ', null)

      expect(workerProfileRepository.uploadProfileFile).not.toHaveBeenCalled()
      expect(workerProfileRepository.addCertificate).toHaveBeenCalledWith({
        user_id: 'user-1', name: 'First Aid Certificate (CPR + AED)', file_url: null,
      })
      expect(cert.file_url).toBeNull()
    })

    it('uploads the optional proof file and stores its URL', async () => {
      vi.mocked(workerProfileRepository.uploadProfileFile).mockResolvedValue('https://cdn/cert.jpg')
      vi.mocked(workerProfileRepository.addCertificate).mockResolvedValue({
        id: 'cert-2', user_id: 'user-1', name: 'Forklift Licence', file_url: 'https://cdn/cert.jpg', created_at: '2026-07-11T00:00:00Z',
      })

      await workerProfileService.addCertificate('auth-1', 'Forklift Licence', makeFile('licence.jpg', 'image/jpeg'))

      expect(workerProfileRepository.uploadProfileFile).toHaveBeenCalledWith(
        expect.any(File),
        expect.stringMatching(/^profiles\/user-1\/certificates\/\d+-licence\.jpg$/),
      )
      expect(workerProfileRepository.addCertificate).toHaveBeenCalledWith(
        expect.objectContaining({ file_url: 'https://cdn/cert.jpg' }),
      )
    })

    it('rejects an empty certificate name', async () => {
      await expect(workerProfileService.addCertificate('auth-1', '   ', null))
        .rejects.toThrow('Certificate name is required')
    })

    it('rejects unsupported proof file types', async () => {
      await expect(workerProfileService.addCertificate('auth-1', 'Forklift Licence', makeFile('cert.gif', 'image/gif')))
        .rejects.toThrow('Certificate file must be PDF, DOC, DOCX, JPG, or PNG')
    })
  })

  describe('removeCertificate', () => {
    it('deletes the certificate scoped to the resolved user', async () => {
      await workerProfileService.removeCertificate('auth-1', 'cert-1')

      expect(workerProfileRepository.deleteCertificate).toHaveBeenCalledWith('cert-1', 'user-1')
    })

    it('throws when certificate_id is missing', async () => {
      await expect(workerProfileService.removeCertificate('auth-1', ''))
        .rejects.toThrow('certificate_id is required')
    })
  })
})
