import { managerInboxRepository } from '@/repositories/manager/managerInboxRepository'

export const managerInboxService = {

  async getContacts(auth_user_id: string): Promise<{
    id: string
    full_name: string
    role: string
    email_address: string
    profile_photo_url: string | null
  }[]> {
    const user = await managerInboxRepository.findUserByAuthIdOrInternalId(auth_user_id)
    if (!user) throw new Error('User not found')
    return managerInboxRepository.getManagerContacts((user as any).id)
  },

}
