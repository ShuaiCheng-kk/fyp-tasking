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

  async createUser(data: {
    supabase_auth_id: string
    full_name: string
    email_address: string
    phone_number: string | null
    role: User['role']
    company_id?: string | null
    department_id?: string | null
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
