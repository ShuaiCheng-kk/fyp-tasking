// LAYER: Service
// RULE: Only contains business logic. No HTTP handling. No direct DB access.

import { createClient } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { userRepository } from '@/repositories/userRepository'
import { companyRepository } from '@/repositories/companyRepository'
import { departmentRepository } from '@/repositories/departmentRepository'
import { User } from '@/types'

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
    role: User['role']
    company_id?: string | null
    department_id?: string | null
  }): Promise<void> {
    await userRepository.createUser({
      supabase_auth_id: data.user_id,
      full_name: data.full_name,
      email_address: data.email_address,
      phone_number: data.phone_number,
      role: data.role,
      company_id: data.company_id ?? null,
      department_id: data.department_id ?? null,
    })
  },

  async register(data: {
    full_name: string
    email_address: string
    password: string
    phone_number: string | null
    role: User['role']
  }): Promise<User> {
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: data.email_address,
      password: data.password,
    })
    if (authError) throw new Error(authError.message)
    if (!authData.user) throw new Error('Registration failed')

    const authUserId = authData.user.id
    try {
      const user = await userRepository.createUser({
        supabase_auth_id: authUserId,
        full_name: data.full_name,
        email_address: data.email_address,
        phone_number: data.phone_number,
        role: data.role,
      })
      return user
    } catch (dbError) {
      // Roll back the Auth user so the registration can be retried cleanly
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

    const user = await userRepository.findByAuthId(authData.user.id)
    if (!user) throw new Error('User profile not found')
    return user
  },

  async getUserProfile(authId: string): Promise<User> {
    const user = await userRepository.findByAuthId(authId)
    if (!user) throw new Error('User profile not found')
    return user
  },

  async signOut(): Promise<void> {
    const { error } = await supabase.auth.signOut()
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

  async completeOwnerSetup(data: {
    full_name: string
    email: string
    password: string
    phone: string
    company_name: string
    company_description: string
    company_location: string | null
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
      const authUser = await userRepository.createAuthUser(data.email, data.password)
      authUserId = authUser.id

      console.log('Step 2: Creating users record...')
      const user = await userRepository.createUser({
        supabase_auth_id: authUser.id,
        full_name: data.full_name,
        email_address: data.email,
        phone_number: data.phone || null,
        role: 'Owner',
      })
      console.log('Step 2 complete: user record created for', authUser.id, '-> public.users.id:', user.id)

      const userCheck = await userRepository.findByAuthId(authUser.id)
      if (!userCheck) throw new Error('User record not found before company creation - aborting')
      console.log('Step 2 verified: user exists in users table')

      console.log('Step 3: Creating company...')
      const company = await companyRepository.createCompany({
        name: data.company_name,
        description: data.company_description || null,
        owner_id: user.id,
        plan: data.plan === 'Paid' ? 'Paid' : 'Free',
        location: data.company_location,
        industry: data.company_industry,
        size: data.company_size,
        logo_url: data.company_logo_url,
        website: data.company_website,
      })

      console.log('Step 4: Updating company_id...')
      await userRepository.updateCompanyId(user.id, company.id)

      console.log('Step 5: Creating departments...')
      for (const deptName of data.departments) {
        if (deptName && deptName.trim()) {
          await departmentRepository.createDepartment({
            name: deptName.trim(),
            company_id: company.id,
          })
        }
      }

      console.log('All steps complete, user_id:', authUser.id)
      return { user_id: authUser.id, company_id: company.id }

    } catch (error) {
      console.error('completeOwnerSetup failed, rolling back:', error)

      if (authUserId) {
        try {
          await userRepository.deleteBySupabaseAuthId(authUserId)
        } catch (e) {
          console.error('Rollback: failed to delete users record:', e)
        }

        try {
          await userRepository.deleteAuthUser(authUserId)
        } catch (e) {
          console.error('Rollback: failed to delete auth user:', e)
        }
      }

      throw error
    }
  },

}
