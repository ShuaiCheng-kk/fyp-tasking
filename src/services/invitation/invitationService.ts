import { createClient } from '@supabase/supabase-js'
import { invitationRepository } from '@/repositories/invitation/invitationRepository'
import { authRepository } from '@/repositories/auth/authRepository'
import { companyRepository } from '@/repositories/company/companyRepository'
import { emailService } from '@/services/email/emailService'
import { InvitationCode } from '@/types/invitation.types'
import { User } from '@/types/auth.types'

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

const ROLE_MAP: Record<string, InvitationCode['role']> = {
  'owner': 'Owner',
  'partner': 'Partner',
  'manager': 'Manager',
  'employee': 'Employee',
  'Owner': 'Owner',
  'Partner': 'Partner',
  'Manager': 'Manager',
  'Employee': 'Employee',
}

export const invitationService = {

  async generateCode(data: {
    company_id: string
    department_id: string | null
    role: InvitationCode['role']
    generated_by: string
  }): Promise<InvitationCode> {
    const normalizedRole = ROLE_MAP[data.role] ?? data.role
    let code: string
    if (normalizedRole === 'Owner') {
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
      code = Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
    } else {
      const chars = '0123456789'
      code = Array.from({ length: 5 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
    }

    const expired_at = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()

    const generator = await authRepository.findByAuthIdOrInternalId(data.generated_by)
    if (!generator) throw new Error('User not found')

    return await invitationRepository.createCode({
      code,
      company_id: data.company_id,
      department_id: data.department_id,
      role: normalizedRole,
      generated_by: generator.id,
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
    const normalizedRole = ROLE_MAP[data.role] ?? (data.role as InvitationCode['role'])
    const inviter = await authRepository.findByAuthIdOrInternalId(data.invited_by)
    if (!inviter) throw new Error('User not found')
    if (inviter.role === 'Partner') {
      throw new Error('Partners cannot invite members.')
    }
    if (inviter.email_address.toLowerCase() === data.email.toLowerCase()) {
      throw new Error('You cannot send an invitation to yourself.')
    }

    const existingUser = await authRepository.findByEmail(data.email)

    if (existingUser) {
      if (existingUser.company_id === data.company_id) {
        throw new Error('This user is already a member of this company.')
      }
      await invitationRepository.insertInboxInvite({
        recipient_user_id: existingUser.id,
        sender_user_id: inviter.id,
        company_id: data.company_id,
        role: normalizedRole,
        department_id: data.department_id,
      })
      return
    }

    const expired_at = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
    const invitation = await invitationRepository.createCode({
      code: generateRandomCode(normalizedRole),
      company_id: data.company_id,
      department_id: data.department_id,
      role: normalizedRole,
      generated_by: inviter.id,
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
      inviterName: inviter.full_name,
    })
  },

  async redeemCode(data: {
    code: string
    full_name: string
    email_address: string
    password: string
    phone_number: string | null
  }): Promise<{ user: User; company_id: string }> {
    const invitation = await invitationRepository.findByCode(data.code)
    if (!invitation) throw new Error('Invalid or expired invitation code')

    if (new Date() > new Date(invitation.expired_at)) {
      throw new Error('This invitation has expired')
    }

    const existingByEmail = await authRepository.findByEmail(data.email_address)
    if (existingByEmail) {
      throw new Error('An account with this email already exists. Please sign in instead.')
    }

    if (data.phone_number && data.phone_number.trim()) {
      const { supabase } = await import('@/lib/supabase')
      const trimmed = data.phone_number.trim()
      const digits = trimmed.replace(/\D/g, '')
      const variants = new Set<string>([trimmed])
      if (digits.length >= 8) {
        variants.add(digits)
        variants.add(`+${digits}`)
      }
      for (const v of variants) {
        const { data: existing } = await supabase
          .from('users')
          .select('*')
          .eq('phone_number', v)
          .single()
        if (existing) throw new Error('This phone number is already registered')
      }
    }

    let authUserId: string
    try {
      const authUser = await authRepository.createAuthUser(data.email_address, data.password, true)
      authUserId = authUser.id
    } catch (err) {
      const msg = (err instanceof Error ? err.message : '').toLowerCase()
      if (msg.includes('already') || msg.includes('duplicate') || msg.includes('unique')) {
        throw new Error('An account with this email already exists. Please sign in instead.')
      }
      throw err
    }

    const roleMap: Record<string, User['role']> = {
      partner: 'Partner',
      manager: 'Manager',
      employee: 'Employee',
      casual_worker: 'Casual Worker',
      owner: 'Owner',
    }
    const normalizedRole = roleMap[invitation.role.toLowerCase()] ?? invitation.role

    try {
      const user = await authRepository.createUser({
        supabase_auth_id: authUserId,
        full_name: data.full_name,
        email_address: data.email_address,
        phone_number: data.phone_number,
        role: normalizedRole,
        company_id: invitation.company_id,
      })

      console.log('REDEEM DEBUG - role:', normalizedRole)
      console.log('REDEEM DEBUG - department_id:', invitation.department_id)
      if (normalizedRole === 'Manager' && invitation.department_id) {
        console.log('REDEEM DEBUG - inserting manager department')
        await invitationRepository.insertManagerDepartment(user.id, invitation.department_id)
        console.log('REDEEM DEBUG - insert complete')
      }
      if (normalizedRole === 'Employee' && invitation.department_id) {
        console.log('REDEEM DEBUG - inserting employee department')
        await invitationRepository.insertEmployeeDepartment(user.id, invitation.department_id)
        console.log('REDEEM DEBUG - insert complete')
      }

      await invitationRepository.markAsUsed(data.code, user.id)

      return { user, company_id: invitation.company_id }
    } catch (error) {
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
