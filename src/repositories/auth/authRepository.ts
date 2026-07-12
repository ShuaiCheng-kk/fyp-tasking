import { createClient } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { User } from '@/types/auth.types'

export const authRepository = {

  async findByAuthId(supabase_auth_id: string): Promise<User | null> {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('supabase_auth_id', supabase_auth_id)
      .single()
    if (error) return null
    return data
  },

  async findByEmail(email_address: string): Promise<User | null> {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('email_address', email_address)
      .single()
    if (error) return null
    return data
  },

  async findByPhoneNumber(phone_number: string): Promise<User | null> {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('phone_number', phone_number)
      .single()
    if (error) return null
    return data
  },

  async createUser(data: {
    supabase_auth_id: string
    full_name: string
    email_address: string
    phone_number: string | null
    date_of_birth?: string | null
    profile_photo_url?: string | null
    home_location?: string | null
    role: User['role']
    company_id?: string | null
  }): Promise<User> {
    const tryInsert = async (payload: typeof data) => {
      const { data: user, error } = await supabase
        .from('users')
        .insert(payload)
        .select()
        .single()
      return { user, error }
    }

    let insertResult = await tryInsert(data)
    if (insertResult.error && /profile_photo_url/i.test(insertResult.error.message)) {
      const { profile_photo_url: _ignored, ...fallbackData } = data
      insertResult = await tryInsert(fallbackData)
    }

    const { user, error } = insertResult
    if (error) throw new Error(`Failed to create user record: ${error.message}`)

    const { data: verify, error: verifyError } = await supabase
      .from('users')
      .select('id')
      .eq('id', user.id)
      .single()
    if (verifyError || !verify) throw new Error('User record was not created successfully')

    return user
  },

  async findById(id: string): Promise<User | null> {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', id)
      .single()
    if (error) return null
    return data
  },

  async findByAuthIdOrInternalId(ref: string): Promise<User | null> {
    const byAuth = await authRepository.findByAuthId(ref)
    if (byAuth) return byAuth
    return await authRepository.findById(ref)
  },

  async deleteBySupabaseAuthId(supabase_auth_id: string): Promise<void> {
    const { error } = await supabase
      .from('users')
      .delete()
      .eq('supabase_auth_id', supabase_auth_id)
    if (error) throw new Error(error.message)
  },

  async deleteById(user_id: string): Promise<void> {
    const { error } = await supabase
      .from('users')
      .delete()
      .eq('id', user_id)
    if (error) throw new Error(error.message)
  },

  async updateProfile(id: string, patch: { full_name?: string; phone_number?: string | null; date_of_birth?: string | null; profile_photo_url?: string | null }): Promise<User> {
    const { data, error } = await supabase
      .from('users')
      .update(patch)
      .eq('id', id)
      .select()
      .single()
    if (error) throw new Error(`Failed to update profile: ${error.message}`)
    return data
  },

  async createAuthUser(email: string, password: string, emailConfirm = false) {
    const adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    )
    const { data, error } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: emailConfirm,
    })
    if (error) throw new Error(error.message)
    if (!data.user) throw new Error('Registration failed')
    return data.user
  },

  async deleteAuthUser(user_id: string): Promise<void> {
    const adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    )
    const { error } = await adminClient.auth.admin.deleteUser(user_id)
    if (error) throw new Error(error.message)
  },

  async updateCompanyId(user_id: string, company_id: string): Promise<void> {
    const { error } = await supabase
      .from('users')
      .update({ company_id })
      .eq('id', user_id)
    if (error) throw new Error(error.message)
  },

}
