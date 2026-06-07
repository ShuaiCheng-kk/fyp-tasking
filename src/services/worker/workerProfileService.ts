import { workerProfileRepository } from '@/repositories/worker/workerProfileRepository'

export const workerProfileService = {
  async getProfile(userId: string) {
    if (!userId) {
      throw new Error('User ID is required')
    }

    return await workerProfileRepository.getProfileByAuthId(userId)
  },
}