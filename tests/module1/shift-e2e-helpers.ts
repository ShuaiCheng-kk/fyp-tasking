import { createClient } from '@supabase/supabase-js'
import { Page } from '@playwright/test'
import { TestOwner } from '../helpers/seed'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

export type SeededMember = {
  authUserId: string
  userId: string
  email: string
  password: string
  full_name: string
}

// UC6 (Duplicate Shift) and UC9 (Bulk Edit Shifts) are Paid-only features (src/lib/paidFeatures.ts) —
// their buttons don't render at all for a Free-plan company, and seedTestOwnerAndCompany defaults to Free.
export async function setCompanyPlan(companyId: string, plan: 'Free' | 'Paid'): Promise<void> {
  const { error } = await admin.from('companies').update({ plan }).eq('id', companyId)
  if (error) throw new Error(`Failed to set company plan: ${error.message}`)
}

export async function createDepartment(companyId: string, name: string): Promise<string> {
  const { data, error } = await admin
    .from('departments')
    .insert({ company_id: companyId, name })
    .select('id')
    .single()
  if (error || !data) throw new Error(`Failed to create department: ${error?.message}`)
  return data.id as string
}

export async function createCompanyMember(input: {
  companyId: string
  departmentId?: string
  role: 'Partner' | 'Manager' | 'Employee'
  label: string
}): Promise<SeededMember> {
  const email = `test-module1-e2e-${input.label}-${Date.now()}-${Math.floor(Math.random() * 10000)}@tasking-tests.local`
  const password = 'Test-Password-123!'
  const full_name = `Module1 E2E ${input.label}`

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
      full_name,
      email_address: email,
      phone_number: `T${Date.now()}${Math.floor(Math.random() * 1000)}`.slice(0, 20),
      role: input.role,
      company_id: input.companyId,
      date_of_birth: '2000-01-01',
      profile_photo_url: '',
    })
    .select('id')
    .single()
  if (userError || !user) throw new Error(`Failed to create ${input.role} row: ${userError?.message}`)

  if (input.departmentId && input.role === 'Manager') {
    const { error } = await admin.from('manager_departments').insert({
      manager_id: user.id, company_id: input.companyId, department_id: input.departmentId,
    })
    if (error) throw new Error(`Failed to assign manager department: ${error.message}`)
  }
  if (input.departmentId && input.role === 'Employee') {
    const { error } = await admin.from('employee_departments').insert({
      employee_id: user.id, company_id: input.companyId, department_id: input.departmentId,
    })
    if (error) throw new Error(`Failed to assign employee department: ${error.message}`)
  }

  return { authUserId: authData.user.id, userId: user.id as string, email, password, full_name }
}

export async function cleanupCompanyMember(member: SeededMember) {
  await admin.from('users').delete().eq('id', member.userId)
  await admin.auth.admin.deleteUser(member.authUserId)
}

export async function createShiftRow(input: {
  companyId: string
  departmentId: string
  userId: string
  shift_date: string
  start_time: string
  end_time: string
  publication_status?: 'draft' | 'published'
}): Promise<string> {
  const { data: shift, error } = await admin
    .from('shifts')
    .insert({
      company_id: input.companyId,
      department_id: input.departmentId,
      shift_date: input.shift_date,
      start_time: input.start_time,
      end_time: input.end_time,
      publication_status: input.publication_status ?? 'published',
      created_by: input.userId,
    })
    .select('id')
    .single()
  if (error || !shift) throw new Error(`Failed to create shift: ${error?.message}`)

  const { error: assignError } = await admin.from('shift_assignments').insert({
    shift_id: shift.id, user_id: input.userId, assigned_by: input.userId,
  })
  if (assignError) throw new Error(`Failed to create shift assignment: ${assignError.message}`)

  return shift.id as string
}

export async function signInAs(
  page: Page,
  role: 'Owner' | 'Partner' | 'Manager' | 'Employee',
  creds: { email: string; password: string; authUserId: string; companyId: string },
) {
  const res = await page.request.post('/api/auth/signin', {
    data: { email_address: creds.email, password: creds.password },
  })
  if (res.status() !== 200) throw new Error(`Sign-in failed with status ${res.status()}: ${await res.text()}`)
  await page.addInitScript(({ authUserId, companyId, role }) => {
    localStorage.setItem('tasking_user_id', authUserId)
    localStorage.setItem('tasking_user_role', role)
    localStorage.setItem(`tasking_company_id_${authUserId}`, companyId)
  }, { authUserId: creds.authUserId, companyId: creds.companyId, role })
}

export function ownerCreds(seeded: TestOwner) {
  return { email: seeded.email, password: seeded.password, authUserId: seeded.authUserId, companyId: seeded.companyId }
}

export function memberCreds(member: SeededMember, companyId: string) {
  return { email: member.email, password: member.password, authUserId: member.authUserId, companyId }
}
