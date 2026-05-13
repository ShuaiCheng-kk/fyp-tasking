// LAYER: Service
// RULE: Only contains business logic. No HTTP handling. No direct DB access.

import { invitationRepository } from '@/repositories/invitationRepository'
import { userRepository } from '@/repositories/userRepository'
import { InvitationCode, User } from '@/types'

export const invitationService = {

  async generateCode(data: {
    company_id: string
    department_id: string | null
    role: InvitationCode['role']
    generated_by: string
  }): Promise<InvitationCode> {
    let code: string
    if (data.role === 'Owner') {
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
      code = Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
    } else {
      const chars = '0123456789'
      code = Array.from({ length: 5 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
    }

    const expired_at = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()

    return await invitationRepository.createCode({
      code,
      company_id: data.company_id,
      department_id: data.department_id,
      role: data.role,
      generated_by: data.generated_by,
      expired_at,
    })
  },

  async redeemCode(data: {
    code: string
    user_id: string
  }): Promise<{ role: User['role'] }> {
    const invitation = await invitationRepository.findByCode(data.code)
    if (!invitation) throw new Error('Invalid or expired invitation code')

    const now = new Date()
    const expiredAt = new Date(invitation.expired_at)
    if (now > expiredAt) {
      await invitationRepository.markAsUsed(data.code, data.user_id)
      throw new Error('Invitation code has expired')
    }

    await userRepository.updateRole(data.user_id, invitation.role)
    await invitationRepository.markAsUsed(data.code, data.user_id)
    return { role: invitation.role }
  },

}
