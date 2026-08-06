import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'

config({ path: '.env.local' })

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export interface TestOwner {
  authUserId: string
  ownerId: string
  companyId: string
  email: string
  password: string
}

/**
 * Seeds a confirmed Owner + Company directly via the Supabase service role,
 * bypassing the UI registration flow so API/E2E tests have a real company_id to act on.
 */
export async function seedTestOwnerAndCompany(label: string): Promise<TestOwner> {
  const email = `test-${label}-${Date.now()}@tasking-tests.local`
  const password = 'Test-Password-123!'

  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })
  if (authError || !authData.user) throw new Error(`Failed to create auth user: ${authError?.message}`)

  const { data: owner, error: ownerError } = await admin
    .from('users')
    .insert({
      supabase_auth_id: authData.user.id,
      full_name: `Test Owner ${label}`,
      email_address: email,
      // phone_number is unique+NOT NULL — derive a distinct value per row (see the
      // 20260728330000 migration's own backfill for the same pattern).
      phone_number: `T${Date.now()}${Math.floor(Math.random() * 1000)}`.slice(0, 20),
      date_of_birth: '2000-01-01',
      profile_photo_url: '',
      role: 'Owner',
    })
    .select()
    .single()
  if (ownerError || !owner) throw new Error(`Failed to create owner row: ${ownerError?.message}`)

  const { data: company, error: companyError } = await admin
    .from('companies')
    .insert({
      name: `Test Company ${label}`,
      description: null,
      owner_id: owner.id,
      plan: 'Free',
    })
    .select()
    .single()
  if (companyError || !company) throw new Error(`Failed to create company row: ${companyError?.message}`)

  await admin.from('users').update({ company_id: company.id }).eq('id', owner.id)

  return { authUserId: authData.user.id, ownerId: owner.id, companyId: company.id, email, password }
}

export async function cleanupTestOwnerAndCompany(seeded: TestOwner) {
  await admin.from('departments').delete().eq('company_id', seeded.companyId)
  await admin.from('companies').delete().eq('id', seeded.companyId)
  await admin.from('users').delete().eq('id', seeded.ownerId)
  await admin.auth.admin.deleteUser(seeded.authUserId)
}

export interface TestUserAdmin {
  authUserId: string
  userId: string
  email: string
  password: string
}

// Platform-level role (Module 10) — not scoped to any company, so no companies/departments
// cleanup needed, only the users row and its auth user.
export async function seedTestUserAdmin(label: string): Promise<TestUserAdmin> {
  const email = `test-${label}-${Date.now()}@tasking-tests.local`
  const password = 'Test-Password-123!'

  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })
  if (authError || !authData.user) throw new Error(`Failed to create auth user: ${authError?.message}`)

  const { data: user, error: userError } = await admin
    .from('users')
    .insert({
      supabase_auth_id: authData.user.id,
      full_name: `Test User Admin ${label}`,
      email_address: email,
      phone_number: `T${Date.now()}${Math.floor(Math.random() * 1000)}`.slice(0, 20),
      date_of_birth: '1990-01-01',
      profile_photo_url: '',
      role: 'User Admin',
    })
    .select()
    .single()
  if (userError || !user) throw new Error(`Failed to create user admin row: ${userError?.message}`)

  return { authUserId: authData.user.id, userId: user.id, email, password }
}

export async function cleanupTestUserAdmin(seeded: TestUserAdmin) {
  await admin.from('users').delete().eq('id', seeded.userId)
  await admin.auth.admin.deleteUser(seeded.authUserId)
}
