/**
 * UserRepository — data access layer for user profiles and roles.
 *
 * Supabase tables touched:
 *   - profiles          (id, full_name, email, role, department_id, avatar_url, is_active, created_at)
 *   - departments       (id, name, manager_id)
 *
 * This file must ONLY contain database queries — no business logic.
 * Import this from a service, never directly from a page or API route.
 *
 * Role values: 'owner' | 'manager' | 'employee' | 'casual_worker' | 'guest'
 */

import { supabase } from '@/lib/supabase'

// ---------------------------------------------------------------------------
// Types (replace with shared types from @/lib/types once defined)
// ---------------------------------------------------------------------------

export type UserRole = 'owner' | 'manager' | 'employee' | 'casual_worker' | 'guest'

export interface Profile {
  id: string
  full_name: string
  email: string
  role: UserRole
  department_id: string | null
  avatar_url: string | null
  is_active: boolean
  created_at: string
}

export interface CreateProfileData {
  id: string            // must match auth.users.id from Supabase Auth
  full_name: string
  email: string
  role: UserRole
  department_id?: string
}

export interface UpdateProfileData {
  full_name?: string
  department_id?: string | null
  avatar_url?: string | null
  is_active?: boolean
}

// ---------------------------------------------------------------------------
// Read
// ---------------------------------------------------------------------------

/** Fetch a single profile by its auth user ID. */
export async function findUserById(id: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', id)
    .single()

  if (error) throw new Error(error.message)
  return data
}

/** Fetch all active profiles, optionally filtered by role. */
export async function findUsersByRole(role?: UserRole): Promise<Profile[]> {
  let query = supabase.from('profiles').select('*').eq('is_active', true)
  if (role) query = query.eq('role', role)

  const { data, error } = await query
  if (error) throw new Error(error.message)
  return data ?? []
}

/** Fetch all profiles belonging to a department. */
export async function findUsersByDepartment(departmentId: string): Promise<Profile[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('department_id', departmentId)
    .eq('is_active', true)

  if (error) throw new Error(error.message)
  return data ?? []
}

// ---------------------------------------------------------------------------
// Write
// ---------------------------------------------------------------------------

/** Insert a new profile row after Supabase Auth user creation. */
export async function createProfile(data: CreateProfileData): Promise<Profile> {
  const { data: created, error } = await supabase
    .from('profiles')
    .insert(data)
    .select()
    .single()

  if (error) throw new Error(error.message)
  return created
}

/** Partial update of a profile (name, department, avatar, etc.). */
export async function updateProfile(
  id: string,
  updates: UpdateProfileData,
): Promise<Profile> {
  const { data, error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) throw new Error(error.message)
  return data
}

/**
 * Soft-delete a profile by marking it inactive.
 * Do NOT hard-delete rows — auth.users still references the ID.
 */
export async function deactivateUser(id: string): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .update({ is_active: false })
    .eq('id', id)

  if (error) throw new Error(error.message)
}
