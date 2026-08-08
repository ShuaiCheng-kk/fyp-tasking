import { createClient } from '@supabase/supabase-js'
import { getSupabaseAdmin } from '@/lib/supabaseAdmin'

const supabase = getSupabaseAdmin()
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
    phone_number: string
    date_of_birth: string
    profile_photo_url: string
    role: User['role']
    company_id?: string | null
  }): Promise<User> {
    const { data: user, error } = await supabase
      .from('users')
      .insert(data)
      .select()
      .single()
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

  // Admin-level password update. updateUserById alone (the original BUG-071 fix) rotates the
  // password but does NOT revoke the user's other existing sessions/refresh tokens — confirmed by
  // retest, a device signed in before the reset stayed signed in. Also delete the user's rows in
  // auth.sessions via the revoke_user_sessions() SECURITY DEFINER function (ON DELETE CASCADE takes
  // auth.refresh_tokens with them), so any other device can no longer silently refresh to a new
  // access token — it will be forced back to sign-in once its current access token expires.
  async updateAuthPassword(auth_user_id: string, password: string): Promise<void> {
    const adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    )
    const { error } = await adminClient.auth.admin.updateUserById(auth_user_id, { password })
    if (error) throw new Error(error.message)

    const { error: revokeError } = await adminClient.rpc('revoke_user_sessions', { target_user_id: auth_user_id })
    if (revokeError) throw new Error(revokeError.message)
  },

  async updateCompanyId(user_id: string, company_id: string): Promise<void> {
    const { error } = await supabase
      .from('users')
      .update({ company_id })
      .eq('id', user_id)
    if (error) throw new Error(error.message)
  },

}
