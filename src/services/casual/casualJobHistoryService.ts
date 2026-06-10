import { casualJobHistoryRepository } from '@/repositories/casual/casualJobHistoryRepository'

export const casualJobHistoryService = {
  async getJobHistory(authId: string) {
    if (!authId) throw new Error('Missing user id')

    const user = await casualJobHistoryRepository.getUserByAuthId(authId)

    if (!user) {
      throw new Error('Casual worker not found')
    }

    return {
      user,
      message: 'No completed jobs yet.',
    }
  },
}