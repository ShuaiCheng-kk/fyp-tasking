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

  /** Accept Supabase Auth id or public.users id */
  async findByAuthIdOrInternalId(ref: string): Promise<User | null> {
    const byAuth = await this.findByAuthId(ref)
    if (byAuth) return byAuth
    return await this.findById(ref)
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

  async findByPhone(phone_number: string): Promise<User | null> {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('phone_number', phone_number)
      .single()
    if (error) return null
    return data
  },

  /** Match stored phone despite formatting (+65 / spaces / leading 0). */
  async findByPhoneAnyFormat(raw: string): Promise<User | null> {
    const trimmed = raw.trim()
    if (!trimmed) return null
    const digits = trimmed.replace(/\D/g, '')
    const variants = new Set<string>([trimmed])
    if (digits.length >= 8) {
      variants.add(digits)
      variants.add(`+${digits}`)
    }
    for (const v of variants) {
      const u = await this.findByPhone(v)
      if (u) return u
    }
    return null
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

  async findManagersByCompany(company_id: string): Promise<{ id: string; full_name: string; department_id: string | null }[]> {
    const { data, error } = await supabase
      .from('users')
      .select('id, full_name, department_id')
      .eq('company_id', company_id)
      .eq('role', 'Manager')
    if (error) throw new Error(error.message)
    return data || []
  },

  async updateDepartmentId(user_id: string, department_id: string | null): Promise<void> {
    const { error } = await supabase
      .from('users')
      .update({ department_id })
      .eq('id', user_id)
    if (error) throw new Error(error.message)
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

  async findMembersByCompanyId(company_id: string): Promise<User[]> {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('company_id', company_id)
      .order('role', { ascending: true })
    if (error) throw new Error(error.message)
    const members: User[] = data || []

    const { data: companyData } = await supabase
      .from('companies')
      .select('owner_id')
      .eq('id', company_id)
      .single()

    if (companyData?.owner_id) {
      const { data: ownerUser } = await supabase
        .from('users')
        .select('*')
        .eq('id', companyData.owner_id)
        .single()

      if (ownerUser && !members.some((m) => m.id === ownerUser.id)) {
        members.unshift(ownerUser)
      }
    }

    return members
  },

  async countMembersAcrossOwnedCompanies(internal_owner_id: string): Promise<number> {
    const { data: ownedCompanies, error: compErr } = await supabase
      .from('companies')
      .select('id')
      .eq('owner_id', internal_owner_id)
    if (compErr || !ownedCompanies || ownedCompanies.length === 0) return 0

    const companyIds = ownedCompanies.map((c) => c.id)

    // Count all non-owner members (users whose company_id is one of the owned companies,
    // excluding the owner themselves who is linked via companies.owner_id, not users.company_id)
    const { count: memberCount, error: memberErr } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true })
      .in('company_id', companyIds)
      .neq('id', internal_owner_id)
    if (memberErr) throw new Error(memberErr.message)

    // Add 1 for the owner themselves
    return (memberCount ?? 0) + 1
  },

  async findNonOwnersByCompanyId(company_id: string): Promise<Pick<User, 'id' | 'supabase_auth_id'>[]> {
    const { data, error } = await supabase
      .from('users')
      .select('id, supabase_auth_id')
      .eq('company_id', company_id)
      .neq('role', 'Owner')
    if (error) throw new Error(error.message)
    return data || []
  },

  async deleteById(user_id: string): Promise<void> {
    const { error } = await supabase
      .from('users')
      .delete()
      .eq('id', user_id)
    if (error) throw new Error(error.message)
  },

  async deleteBySupabaseAuthId(supabase_auth_id: string): Promise<void> {
    const { error } = await supabase
      .from('users')
      .delete()
      .eq('supabase_auth_id', supabase_auth_id)
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
