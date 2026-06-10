import { casualProfileRepository } from '@/repositories/casual/casualProfileRepository'

export const casualProfileService = {
  async getProfile(authId: string) {
    if (!authId) throw new Error('Missing user id')

    const user = await casualProfileRepository.getUserByAuthId(authId)

    if (!user) {
      throw new Error('Casual worker not found')
    }

    return {
      user,
      message: 'Profile and skills editing will be available here.',
    }
  },
}