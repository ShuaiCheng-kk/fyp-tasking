import { workerApplicationRepository } from '@/repositories/guest/workerApplicationRepository'

type SubmitApplicationInput = {
  job_id: string
  user_id: string
  resume_file: File
  cover_letter_file: File
}

const allowedFileTypes = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]

const MAX_FILE_SIZE = 5 * 1024 * 1024

function validateFile(file: File, label: string) {
  if (!allowedFileTypes.includes(file.type)) {
    throw new Error(`${label} must be PDF, DOC, or DOCX`)
  }

  if (file.size > MAX_FILE_SIZE) {
    throw new Error(`${label} must be smaller than 5MB`)
  }
}

function cleanFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9.\-_]/g, '_')
}

export const workerApplicationService = {
  async submitApplication(input: SubmitApplicationInput) {
    if (!input.job_id) throw new Error('Job ID is required')
    if (!input.user_id) throw new Error('User ID is required')

    validateFile(input.resume_file, 'Resume')
    validateFile(input.cover_letter_file, 'Cover letter')

    const existing = await workerApplicationRepository.checkExistingApplication(
      input.job_id,
      input.user_id
    )

    if (existing) {
      throw new Error('You have already applied for this job.')
    }

    const timestamp = Date.now()

    const resumePath = `applications/${input.user_id}/${input.job_id}/${timestamp}-resume-${cleanFileName(input.resume_file.name)}`
    const coverLetterPath = `applications/${input.user_id}/${input.job_id}/${timestamp}-cover-letter-${cleanFileName(input.cover_letter_file.name)}`

    const resumeUrl = await workerApplicationRepository.uploadApplicationFile(
      input.resume_file,
      resumePath
    )

    const coverLetterUrl = await workerApplicationRepository.uploadApplicationFile(
      input.cover_letter_file,
      coverLetterPath
    )

    return await workerApplicationRepository.createApplication({
      job_id: input.job_id,
      user_id: input.user_id,
      resume_url: resumeUrl,
      cover_letter: coverLetterUrl,
    })
  },

  async getApplicationsByUser(userId: string) {
    if (!userId) throw new Error('User ID is required')

    return await workerApplicationRepository.getApplicationsByUser(userId)
  },
}