// LAYER: Repository
// RULE: Only handles database queries. No business logic.

import { createClient } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { User } from '@/types'

export const userRepository = {

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

    // Verify the record was actually written and is queryable
    const { data: verify, error: verifyError } = await supabase
      .from('users')
      .select('id')
      .eq('id', user.id)
      .single()
    if (verifyError || !verify) throw new Error('User record was not created successfully')

    return user
  },

  async updateRole(id: string, role: User['role']): Promise<void> {
    const { error } = await supabase
      .from('users')
      .update({ role })
      .eq('id', id)
    if (error) throw new Error(error.message)
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

  async findManagersByDepartment(company_id: string, department_id: string): Promise<{ id: string; full_name: string }[]> {
    const { data, error } = await supabase
      .from('users')
      .select('id, full_name')
      .eq('company_id', company_id)
      .eq('department_id', department_id)
      .eq('role', 'Manager')
    if (error) throw new Error(error.message)
    return data || []
  },

  async updateCompanyId(user_id: string, company_id: string): Promise<void> {
    const { error } = await supabase
      .from('users')
      .update({ company_id })
      .eq('id', user_id)
    if (error) throw new Error(error.message)
  },

  async updateCompanyAndDepartment(
    user_id: string,
    company_id: string,
    department_id: string | null
  ): Promise<void> {
    const { error } = await supabase
      .from('users')
      .update({ company_id, department_id })
      .eq('id', user_id)
    if (error) throw new Error(error.message)
  },

  async createAuthUser(email: string, password: string) {
    const adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    )
    const { data, error } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    })
    if (error) throw new Error(error.message)
    if (!data.user) throw new Error('Registration failed')
    return data.user
  },

  async deleteById(user_id: string): Promise<void> {
    const { error } = await supabase
      .from('users')
      .delete()
      .eq('id', user_id)
    if (error) throw new Error(error.message)
  },

  async deleteAuthUser(user_id: string): Promise<void> {
    const adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    )
    const { error } = await adminClient.auth.admin.deleteUser(user_id)
    if (error) throw new Error(error.message)
  },

}
