// LAYER: Repository
// RULE: Only handles database queries. No business logic.

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
  }): Promise<User> {
    const { data: user, error } = await supabase
      .from('users')
      .insert(data)
      .select()
      .single()
    if (error) throw new Error(error.message)
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

}
