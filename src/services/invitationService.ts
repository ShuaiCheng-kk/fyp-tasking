// LAYER: Service
// RULE: Only contains business logic. No HTTP handling. No direct DB access.

import { invitationRepository } from '@/repositories/invitationRepository'
import { userRepository } from '@/repositories/userRepository'
import { companyRepository } from '@/repositories/companyRepository'
import { emailService } from '@/services/emailService'
import { InvitationCode, User } from '@/types'

function generateRandomCode(role: string): string {
  if (role === 'Owner') {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
    return Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
  }
  return Math.floor(10000 + Math.random() * 90000).toString()
}

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

  async sendInvite(data: {
    email: string
    role: string
    company_id: string
    department_id: string | null
    invited_by: string
    reporting_manager_id?: string | null
  }): Promise<void> {
    const inviter = await userRepository.findById(data.invited_by)
    if (inviter?.email_address.toLowerCase() === data.email.toLowerCase()) {
      throw new Error('You cannot send an invitation to yourself.')
    }

    const expired_at = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
    const invitation = await invitationRepository.createCode({
      code: generateRandomCode(data.role),
      company_id: data.company_id,
      department_id: data.department_id,
      role: data.role as InvitationCode['role'],
      generated_by: data.invited_by,
      expired_at,
      reporting_manager_id: data.reporting_manager_id || null,
    })

    const company = await companyRepository.findById(data.company_id)
    const companyName = company?.name || 'a company'

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://fyp-tasking.vercel.app'
    const inviteLink = `${appUrl}/get-started?code=${invitation.code}`
    await emailService.sendInviteEmail({
      to: data.email,
      role: data.role,
      companyName,
      inviteLink,
    })
  },

  async redeemCode(data: {
    code: string
    supabase_auth_id: string
    full_name: string
    email_address: string
    phone_number: string | null
  }): Promise<{ role: User['role']; company_id: string; department_id: string | null }> {
    const invitation = await invitationRepository.findByCode(data.code)
    if (!invitation) throw new Error('Invalid or expired invitation code')

    const now = new Date()
    if (now > new Date(invitation.expired_at)) {
      throw new Error('Invitation code has expired')
    }

    // Create the public.users record with role/company from the invitation.
    // This must happen before markAsUsed because invitation_code.used_by
    // has a FK constraint referencing public.users.id.
    const user = await userRepository.createUser({
      supabase_auth_id: data.supabase_auth_id,
      full_name: data.full_name,
      email_address: data.email_address,
      phone_number: data.phone_number,
      role: invitation.role,
      company_id: invitation.company_id,
      department_id: invitation.department_id,
    })

    await invitationRepository.markAsUsed(data.code, user.id)
    return { role: invitation.role, company_id: invitation.company_id, department_id: invitation.department_id }
  },

}
