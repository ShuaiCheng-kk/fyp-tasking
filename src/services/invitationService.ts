// LAYER: Service
// RULE: Only contains business logic. No HTTP handling. No direct DB access.

import { createClient } from '@supabase/supabase-js'
import { invitationRepository } from '@/repositories/invitationRepository'
import { userRepository } from '@/repositories/userRepository'
import { companyRepository } from '@/repositories/companyRepository'
import { emailService } from '@/services/emailService'
import { InvitationCode, User } from '@/types'

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

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
    full_name: string
    email_address: string
    password: string
    phone_number: string | null
  }): Promise<{ user: User; company_id: string }> {
    // 1. Validate invitation code (not expired, not used)
    const invitation = await invitationRepository.findByCode(data.code)
    if (!invitation) throw new Error('Invalid or expired invitation code')

    if (new Date() > new Date(invitation.expired_at)) {
      throw new Error('This invitation has expired')
    }

    // 2. Check email not already registered
    const existingByEmail = await userRepository.findByEmail(data.email_address)
    if (existingByEmail) {
      throw new Error('An account with this email already exists. Please sign in instead.')
    }

    // 3. Check phone not already registered
    if (data.phone_number) {
      const existingByPhone = await userRepository.findByPhone(data.phone_number)
      if (existingByPhone) {
        throw new Error('This phone number is already registered')
      }
    }

    // 4. Create Supabase Auth user
    let authUserId: string
    try {
      const authUser = await userRepository.createAuthUser(data.email_address, data.password)
      authUserId = authUser.id
    } catch (err) {
      const msg = (err instanceof Error ? err.message : '').toLowerCase()
      if (msg.includes('already') || msg.includes('duplicate') || msg.includes('unique')) {
        throw new Error('An account with this email already exists. Please sign in instead.')
      }
      throw err
    }

    try {
      // 5. Insert into users table
      const user = await userRepository.createUser({
        supabase_auth_id: authUserId,
        full_name: data.full_name,
        email_address: data.email_address,
        phone_number: data.phone_number,
        role: invitation.role,
        company_id: invitation.company_id,
        department_id: invitation.department_id,
      })

      // 6. Mark invitation code as used
      await invitationRepository.markAsUsed(data.code, user.id)

      return { user, company_id: invitation.company_id }
    } catch (error) {
      // Rollback: delete the auth user just created
      try { await getAdminClient().auth.admin.deleteUser(authUserId) } catch { /* ignore */ }

      const msg = (error instanceof Error ? error.message : '').toLowerCase()
      if (msg.includes('phone') && (msg.includes('duplicate') || msg.includes('unique'))) {
        throw new Error('This phone number is already registered')
      }
      if (msg.includes('foreign key')) {
        throw new Error('Setup failed. Please try again.')
      }
      throw error
    }
  },

}
