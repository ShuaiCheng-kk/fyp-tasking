import { workerProfileRepository } from '@/repositories/guest/workerProfileRepository'

export const workerProfileService = {
  async getProfile(authId: string) {
    if (!authId) throw new Error('Missing user id')
    return workerProfileRepository.getByAuthId(authId)
  },
}