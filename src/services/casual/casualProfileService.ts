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

  async savePaymentInfo(userId: string, payment_method: string, payment_account: string): Promise<void> {
    if (!userId) throw new Error('user_id is required')
    const validMethods = ['paynow', 'bank_transfer']
    if (!validMethods.includes(payment_method)) throw new Error('payment_method must be paynow or bank_transfer')
    if (!payment_account.trim()) throw new Error('payment_account is required')
    await casualProfileRepository.updatePaymentInfo(userId, payment_method, payment_account.trim())
  },
}