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

  async registerAuthOnly(data: {
    email_address: string
    password: string
  }): Promise<string> {
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: data.email_address,
      password: data.password,
    })
    if (authError) throw new Error(authError.message)
    if (!authData.user) throw new Error('Registration failed')
    return authData.user.id
  },

  async createUserProfile(data: {
    user_id: string
    full_name: string
    email_address: string
    phone_number: string | null
    date_of_birth?: string | null
    profile_photo_url?: string | null
    role: User['role']
    company_id?: string | null
  }): Promise<void> {
    await authRepository.createUser({
      supabase_auth_id: data.user_id,
      full_name: data.full_name,
      email_address: data.email_address,
      phone_number: data.phone_number,
      date_of_birth: data.date_of_birth ?? null,
      profile_photo_url: data.profile_photo_url ?? null,
      role: data.role,
      company_id: data.company_id ?? null,
    })
  },

  async register(data: {
    full_name: string
    email_address: string
    password: string
    phone_number: string | null
    date_of_birth?: string | null
    profile_photo_url?: string | null
    role: User['role']
  }): Promise<User> {
    const admin = getAdminClient()

    const { data: authData, error: authError } =
      await admin.auth.admin.createUser({
        email: data.email_address,
        password: data.password,
        email_confirm: true,
      })

    if (authError) throw new Error(authError.message)
    if (!authData.user) throw new Error('Registration failed')

    const authUserId = authData.user.id
    try {
      const user = await authRepository.createUser({
        supabase_auth_id: authUserId,
        full_name: data.full_name,
        email_address: data.email_address,
        phone_number: data.phone_number,
        date_of_birth: data.date_of_birth ?? null,
        profile_photo_url: data.profile_photo_url ?? null,
        role: data.role,
      })
      return user
    } catch (dbError) {
      await getAdminClient().auth.admin.deleteUser(authUserId)
      throw dbError
    }
  },

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

  async resetPassword(password: string): Promise<void> {
    const { error } = await supabase.auth.updateUser({ password })
    if (error) throw new Error(error.message)
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
    job_id?: string | null
  }): Promise<{ user_id: string; email_confirmed: boolean }> {
    const { data: authData, error } = await supabase.auth.signUp({
      email: data.email,
      password: data.password,
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
    phone_number: string | null
    date_of_birth: string | null
    profile_photo_url: string | null
  }): Promise<User> {
    const user = await authRepository.createUser({
      supabase_auth_id: data.user_id,
      full_name: data.full_name,
      email_address: data.email_address,
      phone_number: data.phone_number,
      date_of_birth: data.date_of_birth,
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
    phone_number: string | null
    date_of_birth?: string | null
    profile_photo_url?: string | null
    company_name: string
    company_description: string
    company_location: string | null
    company_address: string | null
    company_postal_code: string | null
    company_industry: string | null
    company_size: string | null
    company_website: string | null
    company_logo_url: string | null
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
        date_of_birth: data.date_of_birth ?? null,
        profile_photo_url: data.profile_photo_url ?? null,
        role: 'Owner',
      })
    }

    if (user.company_id) return { company_id: user.company_id }

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
      logo_url: data.company_logo_url,
      website: data.company_website,
    })

    await authRepository.updateCompanyId(user.id, company.id)

    for (const [index, deptName] of data.departments.entries()) {
      if (deptName && deptName.trim()) {
        await departmentRepository.createDepartment({
          name: deptName.trim(),
          company_id: company.id,
          color: DEPT_COLORS[index % DEPT_COLORS.length],
        })
      }
    }

    return { company_id: company.id }
  },

  async completeOwnerSetup(data: {
    full_name: string
    email: string
    password: string
    phone: string
    company_name: string
    company_description: string
    company_location: string | null
    company_address: string | null
    company_postal_code: string | null
    company_industry: string | null
    company_size: string | null
    company_website: string | null
    company_logo_url: string | null
    departments: string[]
    plan: string
  }): Promise<{ user_id: string; company_id: string }> {
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('SUPABASE_SERVICE_ROLE_KEY is not configured')
    }

    let authUserId: string | null = null

    try {
      console.log('Step 1: Creating auth user...')
      const authUser = await authRepository.createAuthUser(data.email, data.password)
      authUserId = authUser.id

      console.log('Step 2: Creating users record...')
      const user = await authRepository.createUser({
        supabase_auth_id: authUser.id,
        full_name: data.full_name,
        email_address: data.email,
        phone_number: data.phone || null,
        role: 'Owner',
      })
      console.log('Step 2 complete: user record created for', authUser.id, '-> public.users.id:', user.id)

      const userCheck = await authRepository.findByAuthId(authUser.id)
      if (!userCheck) throw new Error('User record not found before company creation - aborting')
      console.log('Step 2 verified: user exists in users table')

      console.log('Step 3: Creating company...')
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
        logo_url: data.company_logo_url,
        website: data.company_website,
      })

      console.log('Step 4: Updating company_id...')
      await authRepository.updateCompanyId(user.id, company.id)

      console.log('Step 5: Creating departments...')
      for (const [index, deptName] of data.departments.entries()) {
        if (deptName && deptName.trim()) {
          await departmentRepository.createDepartment({
            name: deptName.trim(),
            company_id: company.id,
            color: DEPT_COLORS[index % DEPT_COLORS.length],
          })
        }
      }

      console.log('All steps complete, user_id:', authUser.id)
      return { user_id: authUser.id, company_id: company.id }

    } catch (error) {
      console.error('completeOwnerSetup failed, rolling back:', error)

      if (authUserId) {
        try {
          await authRepository.deleteBySupabaseAuthId(authUserId)
        } catch (e) {
          console.error('Rollback: failed to delete users record:', e)
        }

        try {
          await authRepository.deleteAuthUser(authUserId)
        } catch (e) {
          console.error('Rollback: failed to delete auth user:', e)
        }
      }

      throw error
    }
  },

}
