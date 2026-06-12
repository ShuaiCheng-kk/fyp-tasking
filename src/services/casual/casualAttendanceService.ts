import { casualAttendanceRepository } from '@/repositories/casual/casualAttendanceRepository'

export const casualAttendanceService = {
  async getAttendance(authId: string) {
    if (!authId) throw new Error('Missing user id')

    const user = await casualAttendanceRepository.getUserByAuthId(authId)

    if (!user) {
      throw new Error('Casual worker not found')
    }

    return {
      user,
      message: 'No active shift.',
    }
  },
}