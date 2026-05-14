// LAYER: Service
// RULE: Only contains business logic. No HTTP handling. No direct DB access.

import { supabase } from '@/lib/supabase'
import { userRepository } from '@/repositories/userRepository'
import { User } from '@/types'

export const authService = {

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

    const user = await userRepository.createUser({
      supabase_auth_id: authData.user.id,
      full_name: data.full_name,
      email_address: data.email_address,
      phone_number: data.phone_number,
      role: data.role,
    })
    return user
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

}
