import { casualAvailabilityRepository } from '@/repositories/casual/casualAvailabilityRepository'

export const casualAvailabilityService = {
  async getAvailability(authId: string) {
    if (!authId) throw new Error('Missing user id')

    const user = await casualAvailabilityRepository.getUserByAuthId(authId)

    if (!user) {
      throw new Error('Casual worker not found')
    }

    return {
      user,
      message: 'You have not set your availability yet.',
    }
  },
}