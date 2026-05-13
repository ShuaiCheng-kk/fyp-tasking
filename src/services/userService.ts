// LAYER: Service
// RULE: Only contains business logic. No HTTP handling. No direct DB access.

import { userRepository } from '@/repositories/userRepository'
import { User } from '@/types'

export const userService = {

  async getUserById(id: string): Promise<User> {
    const user = await userRepository.findById(id)
    if (!user) throw new Error('User not found')
    return user
  },

}
