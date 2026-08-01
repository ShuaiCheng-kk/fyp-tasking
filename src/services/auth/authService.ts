import { createClient } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { authRepository } from '@/repositories/auth/authRepository'
import { companyRepository } from '@/repositories/company/companyRepository'
import { departmentRepository } from '@/repositories/department/departmentRepository'
import { User } from '@/types/auth.types'
import { DEPT_COLORS } from '@/lib/deptColor'

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

export const authService = {

  async deleteOrphanedAuthUser(email_address: string): Promise<void> {
    const admin = getAdminClient()
    const { data, error } = await admin.auth.admin.listUsers()
    if (error || !data) return
    const match = data.users.find((u) => u.email === email_address)
    if (match) {
      await admin.auth.admin.deleteUser(match.id)
    }
  },

  async signIn(email_address: string, password: string): Promise<User> {
    const { data: authData, error: authError } =
      await supabase.auth.signInWithPassword({
        email: email_address,
        password,
      })
    if (authError) throw new Error('Invalid email or password')
    if (!authData.user) throw new Error('Sign in failed')

    const user = await authRepository.findByAuthId(authData.user.id)
    if (!user) throw new Error('User profile not found')
    return user
  },

  async getUserProfile(authId: string): Promise<User> {
    const user = await authRepository.findByAuthId(authId)
    if (!user) throw new Error('User profile not found')
    return user
  },

  async signOut(): Promise<void> {
    const { error } = await supabase.auth.signOut()
    if (error) throw new Error(error.message)
  },

  async resendConfirmation(email: string): Promise<void> {
    const { error } = await supabase.auth.resend({ type: 'signup', email })
    if (error) throw new Error(error.message)
  },

  async forgotPassword(email: string): Promise<void> {
    const redirectTo = process.env.NODE_ENV === 'production'
      ? 'https://fyp-tasking.vercel.app/reset-password'
      : 'http://localhost:3000/reset-password'
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo })
    if (error) throw new Error(error.message)
  },

  // BUG-071: this used to call the client-side `supabase.auth.updateUser({password})` against the
  // recovery-link session — that only rotates the token for the tab that clicked the link. A
  // device that was already signed in before the reset stayed signed in indefinitely. Going
  // through the admin API instead invalidates every refresh token this user already holds.
  async resetPassword(auth_user_id: string, password: string): Promise<void> {
    // M8-CHAIN-01: reset accepted the same password the account already had, which defeats the
    // point of a reset (nothing actually changes, and it silently no-ops BUG-071's session
    // revocation from the user's point of view since nothing looks different). Can't compare
    // plaintext directly — verify by attempting to sign in with the "new" password against the
    // account's CURRENT credentials; if that succeeds, it's the same password.
    const admin = getAdminClient()
    const { data: userData, error: userErr } = await admin.auth.admin.getUserById(auth_user_id)
    if (userErr || !userData.user?.email) throw new Error('User not found')

    const verifyClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } }
    )
    const { data: signInData } = await verifyClient.auth.signInWithPassword({ email: userData.user.email, password })
    if (signInData.user) throw new Error('New password must be different from your current password')

    await authRepository.updateAuthPassword(auth_user_id, password)
  },

  async changePassword(email: string, currentPassword: string, newPassword: string): Promise<void> {
    const verifyClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } }
    )
    const { data, error: signInErr } = await verifyClient.auth.signInWithPassword({ email, password: currentPassword })
    if (signInErr || !data.user) throw new Error('Current password is incorrect')

    const admin = getAdminClient()
    const { error: updateErr } = await admin.auth.admin.updateUserById(data.user.id, { password: newPassword })
    if (updateErr) throw new Error(updateErr.message)
  },

  async registerOwner(data: {
    full_name: string
    email: string
    password: string
    phone: string
  }): Promise<{ user_id: string }> {
    const admin = getAdminClient()

    const authUser = await authRepository.createAuthUser(data.email, data.password, false)
    const authUserId = authUser.id

    try {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://fyp-tasking.vercel.app'
      const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
        type: 'signup',
        email: data.email,
        password: data.password,
        options: { redirectTo: `${appUrl}/auth/confirm` },
      })
      const confirmLink = linkData?.properties?.action_link
      if (!linkError && confirmLink) {
        const { emailService } = await import('@/services/email/emailService')
        await emailService.sendConfirmationRequestEmail({ to: data.email, fullName: data.full_name, confirmLink })
      }

      return { user_id: authUserId }
    } catch (err) {
      try { await authRepository.deleteAuthUser(authUserId) } catch {}
      throw err
    }
  },

  async registerGuest(data: {
    email: string
    password: string
    full_name?: string | null
    phone?: string | null
    date_of_birth?: string | null
    job_id?: string | null
  }): Promise<{ user_id: string; email_confirmed: boolean }> {
    const { data: authData, error } = await supabase.auth.signUp({
      email: data.email,
      password: data.password,
      // Persist the profile fields on the auth user immediately so they survive even if the
      // worker clicks the email-verification link on a different device (where localStorage is
      // empty). completeGuestRegistration reads these back as the source of truth.
      options: {
        data: {
          full_name: data.full_name ?? null,
          phone_number: data.phone ?? null,
          date_of_birth: data.date_of_birth ?? null,
        },
      },
    })
    if (error) throw new Error(error.message)
    if (!authData.user) throw new Error('Registration failed')
    return {
      user_id: authData.user.id,
      email_confirmed: !!authData.user.email_confirmed_at,
    }
  },

  async completeGuestRegistration(data: {
    user_id: string
    full_name: string
    email_address: string
    phone_number: string
    date_of_birth: string
    profile_photo_url: string
  }): Promise<User> {
    // Fall back to the metadata captured at signUp when the client-side values are missing
    // (e.g. the verification link was opened on a different device from registration).
    let meta: Record<string, unknown> = {}
    try {
      const admin = getAdminClient()
      const { data: authUser } = await admin.auth.admin.getUserById(data.user_id)
      meta = (authUser?.user?.user_metadata as Record<string, unknown>) ?? {}
    } catch { /* metadata is a best-effort backup — never block registration on it */ }

    const pick = (value: string, key: string): string =>
      value || (typeof meta[key] === 'string' ? (meta[key] as string) : value)

    const user = await authRepository.createUser({
      supabase_auth_id: data.user_id,
      full_name: data.full_name || (typeof meta.full_name === 'string' ? meta.full_name : data.full_name),
      email_address: data.email_address,
      phone_number: pick(data.phone_number, 'phone_number'),
      date_of_birth: pick(data.date_of_birth, 'date_of_birth'),
      profile_photo_url: data.profile_photo_url,
      role: 'Guest User',
    })
    return user
  },

  async isEmailVerified(email: string): Promise<boolean> {
    const admin = getAdminClient()
    const { data, error } = await admin.auth.admin.listUsers()
    if (error || !data) return false
    const user = data.users.find(u => u.email === email)
    return !!(user?.email_confirmed_at)
  },

  async completeCompanySetup(data: {
    user_id: string
    full_name: string
    email_address: string
    phone_number: string
    date_of_birth: string
    profile_photo_url: string
    company_name: string
    company_description: string
    company_location: string | null
    company_address: string | null
    company_postal_code: string | null
    company_industry: string | null
    company_size: string | null
    departments: string[]
    plan: string
  }): Promise<{ company_id: string }> {
    let user = await authRepository.findByAuthId(data.user_id)
    if (!user) {
      user = await authRepository.createUser({
        supabase_auth_id: data.user_id,
        full_name: data.full_name,
        email_address: data.email_address,
        phone_number: data.phone_number,
        date_of_birth: data.date_of_birth,
        profile_photo_url: data.profile_photo_url,
        role: 'Owner',
      })
    }

    if (user.company_id) return { company_id: user.company_id }

    const nameClash = await companyRepository.findByName(data.company_name)
    if (nameClash) throw new Error(`A company named "${data.company_name.trim()}" already exists`)

    const company = await companyRepository.createCompany({
      name: data.company_name,
      description: data.company_description || null,
      owner_id: user.id,
      plan: data.plan === 'Paid' ? 'Paid' : 'Free',
      location: data.company_location,
      address: data.company_address,
      postal_code: data.company_postal_code,
      industry: data.company_industry,
      size: data.company_size,
    })

    await authRepository.updateCompanyId(user.id, company.id)

    // BUG-010: two Step-4 department fields could both be "Operations" with no warning, producing
    // two indistinguishable departments in every later dropdown — dedupe case-insensitively within
    // this batch (mirrors importService's CSV-import dedup, the one path that already got this
    // right) instead of creating every entry verbatim.
    const seenDeptNames = new Set<string>()
    let deptColorIndex = 0
    for (const deptName of data.departments) {
      const normalized = deptName?.trim().replace(/\s+/g, ' ').slice(0, 100)
      if (!normalized) continue
      const key = normalized.toLowerCase()
      if (seenDeptNames.has(key)) continue
      seenDeptNames.add(key)
      await departmentRepository.createDepartment({
        name: normalized,
        company_id: company.id,
        color: DEPT_COLORS[deptColorIndex % DEPT_COLORS.length],
      })
      deptColorIndex++
    }

    return { company_id: company.id }
  },

}
