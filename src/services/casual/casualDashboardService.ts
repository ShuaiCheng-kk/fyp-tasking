import { casualDashboardRepository } from '@/repositories/casual/casualDashboardRepository'

export const casualDashboardService = {
  async getDashboard(authId: string) {
    if (!authId) throw new Error('Missing user id')

    const user = await casualDashboardRepository.getUserByAuthId(authId)

    if (!user) {
      throw new Error('Casual worker not found')
    }

    return {
      user,
      message: 'No data available yet.',
    }
  },
}