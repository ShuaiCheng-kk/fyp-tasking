import { workerProfileRepository } from '@/repositories/guest/workerProfileRepository'

export const workerProfileService = {
  async getProfile(authId: string) {
    if (!authId) throw new Error('Missing user id')
    return workerProfileRepository.getByAuthId(authId)
  },

  async updateProfile(authId: string, values: {
    full_name: string
    phone_number: string | null
  }) {
    if (!authId) throw new Error('Missing user id')
    if (!values.full_name.trim()) throw new Error('Full name is required')

    return workerProfileRepository.updateByAuthId(authId, {
      full_name: values.full_name.trim(),
      phone_number: values.phone_number?.trim() || null,
    })
  },
}