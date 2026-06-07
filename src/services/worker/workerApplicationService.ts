import { workerApplicationRepository } from '@/repositories/worker/workerApplicationRepository'

export const workerApplicationService = {
  async submitApplication(input: {
    job_id: string
    user_id: string
    resume_url: string
    cover_letter: string
  }) {
    if (!input.job_id) throw new Error('Job ID is required')
    if (!input.user_id) throw new Error('User ID is required')
    if (!input.resume_url.trim()) throw new Error('Resume URL is required')
    if (!input.cover_letter.trim()) throw new Error('Cover letter is required')

    const existing = await workerApplicationRepository.checkExistingApplication(
      input.job_id,
      input.user_id
    )

    if (existing) {
      throw new Error('You have already applied for this job.')
    }

    return await workerApplicationRepository.createApplication(input)
  },
}