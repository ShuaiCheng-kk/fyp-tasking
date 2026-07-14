// LAYER: Service
// RULE: Business logic only. No HTTP handling. No direct DB access.

import { workerProfileRepository } from '@/repositories/guest/workerProfileRepository'
import { WorkerCertificate, WorkerProfile } from '@/types/WorkerProfile'

const MAX_FILE_SIZE = 5 * 1024 * 1024
const MAX_SKILLS_LENGTH = 2000
const MAX_CERTIFICATE_NAME_LENGTH = 100

const DOCUMENT_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]

// Certificates are often photos/scans, so images are accepted on top of documents.
const CERTIFICATE_FILE_TYPES = [...DOCUMENT_TYPES, 'image/jpeg', 'image/png']

function cleanFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9.\-_]/g, '_')
}

export const workerProfileService = {
  async getProfile(authId: string): Promise<WorkerProfile | null> {
    if (!authId) throw new Error('Missing user id')
    const user = await workerProfileRepository.getByAuthId(authId)
    if (!user) return null
    const certificates = await workerProfileRepository.getCertificatesByUserId(user.id)
    return { ...user, certificates }
  },

  async updateProfile(authId: string, values: {
    full_name: string
    phone_number: string | null
    date_of_birth: string | null
    profile_photo_url: string | null
  }) {
    if (!authId) throw new Error('Missing user id')
    if (!values.full_name.trim()) throw new Error('Full name is required')

    return workerProfileRepository.updateByAuthId(authId, {
      full_name: values.full_name.trim(),
      phone_number: values.phone_number?.trim() || null,
      date_of_birth: values.date_of_birth || null,
      profile_photo_url: values.profile_photo_url || null,
    })
  },

  // Skills are deliberately free text — the AI candidate matcher does the fuzzy comparison, so
  // the worker is not forced into a preset vocabulary.
  async updateSkills(authId: string, skills: string | null) {
    if (!authId) throw new Error('Missing user id')
    const trimmed = skills?.trim() || null
    if (trimmed && trimmed.length > MAX_SKILLS_LENGTH) {
      throw new Error(`Skills must be at most ${MAX_SKILLS_LENGTH} characters`)
    }
    return workerProfileRepository.updateSkillsByAuthId(authId, trimmed)
  },

  async uploadResume(authId: string, file: File) {
    if (!authId) throw new Error('Missing user id')
    if (!file) throw new Error('Resume file is required')
    if (!DOCUMENT_TYPES.includes(file.type)) throw new Error('Resume must be PDF, DOC, or DOCX')
    if (file.size > MAX_FILE_SIZE) throw new Error('Resume must be smaller than 5MB')

    const user = await workerProfileRepository.getByAuthId(authId)
    if (!user) throw new Error('Worker not found')

    const path = `profiles/${user.id}/${Date.now()}-resume-${cleanFileName(file.name)}`
    const resumeUrl = await workerProfileRepository.uploadProfileFile(file, path)
    return workerProfileRepository.updateResumeUrlByAuthId(authId, resumeUrl)
  },

  async removeResume(authId: string) {
    if (!authId) throw new Error('Missing user id')
    return workerProfileRepository.updateResumeUrlByAuthId(authId, null)
  },

  async addCertificate(authId: string, name: string, file: File | null): Promise<WorkerCertificate> {
    if (!authId) throw new Error('Missing user id')
    const trimmedName = name?.trim()
    if (!trimmedName) throw new Error('Certificate name is required')
    if (trimmedName.length > MAX_CERTIFICATE_NAME_LENGTH) {
      throw new Error(`Certificate name must be at most ${MAX_CERTIFICATE_NAME_LENGTH} characters`)
    }
    if (file) {
      if (!CERTIFICATE_FILE_TYPES.includes(file.type)) {
        throw new Error('Certificate file must be PDF, DOC, DOCX, JPG, or PNG')
      }
      if (file.size > MAX_FILE_SIZE) throw new Error('Certificate file must be smaller than 5MB')
    }

    const user = await workerProfileRepository.getByAuthId(authId)
    if (!user) throw new Error('Worker not found')

    let fileUrl: string | null = null
    if (file) {
      const path = `profiles/${user.id}/certificates/${Date.now()}-${cleanFileName(file.name)}`
      fileUrl = await workerProfileRepository.uploadProfileFile(file, path)
    }

    return workerProfileRepository.addCertificate({
      user_id: user.id,
      name: trimmedName,
      file_url: fileUrl,
    })
  },

  // Swaps the proof file on an existing certificate (e.g. the worker attached the wrong scan)
  // without losing the certificate row itself.
  async replaceCertificateFile(authId: string, certificateId: string, file: File): Promise<WorkerCertificate> {
    if (!authId) throw new Error('Missing user id')
    if (!certificateId) throw new Error('certificate_id is required')
    if (!file) throw new Error('Certificate file is required')
    if (!CERTIFICATE_FILE_TYPES.includes(file.type)) {
      throw new Error('Certificate file must be PDF, DOC, DOCX, JPG, or PNG')
    }
    if (file.size > MAX_FILE_SIZE) throw new Error('Certificate file must be smaller than 5MB')

    const user = await workerProfileRepository.getByAuthId(authId)
    if (!user) throw new Error('Worker not found')

    const path = `profiles/${user.id}/certificates/${Date.now()}-${cleanFileName(file.name)}`
    const fileUrl = await workerProfileRepository.uploadProfileFile(file, path)
    return workerProfileRepository.updateCertificateFileUrl(certificateId, user.id, fileUrl)
  },

  async removeCertificate(authId: string, certificateId: string): Promise<void> {
    if (!authId) throw new Error('Missing user id')
    if (!certificateId) throw new Error('certificate_id is required')

    const user = await workerProfileRepository.getByAuthId(authId)
    if (!user) throw new Error('Worker not found')

    await workerProfileRepository.deleteCertificate(certificateId, user.id)
  },
}
