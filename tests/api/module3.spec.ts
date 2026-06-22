import { test, expect } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'
import { seedTestOwnerAndCompany, cleanupTestOwnerAndCompany, TestOwner } from '../helpers/seed'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

type SeededMember = {
  authUserId: string
  userId: string
  email: string
}

let seeded: TestOwner
let departments: { primary: string; secondary: string }
const members: SeededMember[] = []

async function createMember(role: 'Manager' | 'Employee', label: string, departmentId: string): Promise<SeededMember> {
  const email = `test-module3-${label}-${Date.now()}@tasking-tests.local`
  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email,
    password: 'Test-Password-123!',
    email_confirm: true,
  })
  if (authError || !authData.user) throw new Error(`Failed to create auth user: ${authError?.message}`)

  const { data: user, error: userError } = await admin
    .from('users')
    .insert({
      supabase_auth_id: authData.user.id,
      full_name: `Module 3 ${role} ${label}`,
      email_address: email,
      phone_number: null,
      role,
      company_id: seeded.companyId,
    })
    .select()
    .single()
  if (userError || !user) throw new Error(`Failed to create user row: ${userError?.message}`)

  if (role === 'Manager') {
    const { error } = await admin
      .from('manager_departments')
      .insert({ manager_id: user.id, company_id: seeded.companyId, department_id: departmentId, assigned_by: seeded.ownerId })
    if (error) throw new Error(`Failed to assign manager department: ${error.message}`)
  } else {
    const { error } = await admin
      .from('employee_departments')
      .insert({ employee_id: user.id, department_id: departmentId })
    if (error) throw new Error(`Failed to assign employee department: ${error.message}`)
  }

  const member = { authUserId: authData.user.id, userId: user.id as string, email }
  members.push(member)
  return member
}

test.beforeAll(async () => {
  seeded = await seedTestOwnerAndCompany('module3')

  const { data, error } = await admin
    .from('departments')
    .insert([
      { company_id: seeded.companyId, name: 'Front Desk' },
      { company_id: seeded.companyId, name: 'Kitchen' },
    ])
    .select('id, name')
  if (error || !data || data.length !== 2) throw new Error(`Failed to create departments: ${error?.message}`)

  departments = {
    primary: data.find((department) => department.name === 'Front Desk')!.id,
    secondary: data.find((department) => department.name === 'Kitchen')!.id,
  }
})

test.afterAll(async () => {
  await admin.from('company_activity_logs').delete().eq('company_id', seeded.companyId)
  await admin.from('invitation_code').delete().eq('company_id', seeded.companyId)
  const { data: shiftRows } = await admin.from('shifts').select('id').eq('company_id', seeded.companyId)
  const shiftIds = (shiftRows ?? []).map((shift) => shift.id as string)
  if (shiftIds.length > 0) {
    await admin.from('shift_assignments').delete().in('shift_id', shiftIds)
    await admin.from('shifts').delete().in('id', shiftIds)
  }
  await admin.from('manager_departments').delete().eq('company_id', seeded.companyId)
  for (const member of members) {
    await admin.from('employee_departments').delete().eq('employee_id', member.userId)
    await admin.from('users').delete().eq('id', member.userId)
    await admin.auth.admin.deleteUser(member.authUserId).catch(() => undefined)
  }
  await cleanupTestOwnerAndCompany(seeded)
})

test('UC30 generates an invitation code for a department role', async ({ request }) => {
  const res = await request.post('/api/invitation/generate', {
    data: {
      company_id: seeded.companyId,
      department_id: departments.primary,
      role: 'Employee',
      generated_by: seeded.ownerId,
    },
  })
  expect(res.status()).toBe(201)
  const body = await res.json()
  expect(body.success).toBe(true)
  expect(body.code).toMatch(/^\d{5}$/)
})

test('UC32 assigns, lists, and removes a department manager', async ({ request }) => {
  const manager = await createMember('Manager', 'assign', departments.primary)

  const assign = await request.patch('/api/team/department-manager', {
    data: {
      company_id: seeded.companyId,
      department_id: departments.secondary,
      manager_id: manager.userId,
      assigned_by: seeded.ownerId,
    },
  })
  expect(assign.status()).toBe(200)
  expect((await assign.json()).success).toBe(true)

  const list = await request.get(`/api/team/department-manager?company_id=${seeded.companyId}`)
  const listBody = await list.json()
  expect(list.status()).toBe(200)
  expect(listBody.assignments).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ department_id: departments.secondary, manager_id: manager.userId }),
    ]),
  )

  const remove = await request.delete('/api/team/department-manager', {
    data: { manager_id: manager.userId, department_id: departments.secondary },
  })
  expect(remove.status()).toBe(200)
  expect((await remove.json()).success).toBe(true)
})

test('UC33 and UC34 list team members and remove a member', async ({ request }) => {
  const employee = await createMember('Employee', 'remove', departments.primary)
  const { data: shift, error: shiftError } = await admin
    .from('shifts')
    .insert({
      company_id: seeded.companyId,
      department_id: departments.primary,
      shift_date: '2030-01-15',
      start_time: '09:00',
      end_time: '17:00',
      title: 'Removal FK regression shift',
      created_by: seeded.ownerId,
      publication_status: 'draft',
    })
    .select('id')
    .single()
  expect(shiftError).toBeNull()

  const { error: assignmentError } = await admin
    .from('shift_assignments')
    .insert({
      shift_id: shift!.id,
      user_id: employee.userId,
      assigned_by: seeded.ownerId,
    })
  expect(assignmentError).toBeNull()

  const list = await request.get(`/api/team/members?company_id=${seeded.companyId}`)
  const listBody = await list.json()
  expect(list.status()).toBe(200)
  expect(listBody.members).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ id: seeded.ownerId, role: 'Owner' }),
      expect.objectContaining({ id: employee.userId, role: 'Employee' }),
    ]),
  )

  const remove = await request.delete('/api/team/remove-member', {
    data: {
      company_id: seeded.companyId,
      user_id_to_remove: employee.userId,
      requesting_user_id: seeded.ownerId,
    },
  })
  expect(remove.status()).toBe(200)
  expect(await remove.json()).toMatchObject({ success: true, accountDeleted: true })
})

test('UC34 removes a manager who created shifts without leaving a partial membership update', async ({ request }) => {
  const manager = await createMember('Manager', 'remove-manager', departments.primary)
  const { data: shift, error: shiftError } = await admin
    .from('shifts')
    .insert({
      company_id: seeded.companyId,
      department_id: departments.primary,
      shift_date: '2030-01-16',
      start_time: '10:00',
      end_time: '18:00',
      title: 'Manager-created removal regression shift',
      created_by: manager.userId,
      publication_status: 'draft',
    })
    .select('id')
    .single()
  expect(shiftError).toBeNull()

  const remove = await request.delete('/api/team/remove-member', {
    data: {
      company_id: seeded.companyId,
      user_id_to_remove: manager.userId,
      requesting_user_id: seeded.ownerId,
    },
  })
  expect(remove.status()).toBe(200)
  expect(await remove.json()).toMatchObject({ success: true, accountDeleted: true })

  const { data: updatedShift, error: updatedShiftError } = await admin
    .from('shifts')
    .select('created_by')
    .eq('id', shift!.id)
    .single()
  expect(updatedShiftError).toBeNull()
  expect(updatedShift!.created_by).toBe(seeded.ownerId)
})

test('UC35 changes an employee department in the employee department mapping', async ({ request }) => {
  const employee = await createMember('Employee', 'move', departments.primary)

  const res = await request.patch('/api/user/update-department', {
    data: {
      user_id: employee.userId,
      department_id: departments.secondary,
      company_id: seeded.companyId,
    },
  })
  expect(res.status()).toBe(200)
  expect((await res.json()).success).toBe(true)

  const { data: employeeDepartments, error } = await admin
    .from('employee_departments')
    .select('department_id')
    .eq('employee_id', employee.userId)
  expect(error).toBeNull()
  expect(employeeDepartments).toEqual([{ department_id: departments.secondary }])
})

test('UC37 imports departments and skips duplicates', async ({ request }) => {
  const res = await request.post('/api/import/departments', {
    data: {
      company_id: seeded.companyId,
      departments: ['Front Desk', '  Bar  ', 'Bar', 'Events'],
    },
  })
  expect(res.status()).toBe(200)
  const body = await res.json()
  expect(body.success).toBe(true)
  expect(body.result).toEqual({
    created: ['Bar', 'Events'],
    skipped: ['Front Desk'],
  })
})

test('UC39 writes and reads company activity logs', async ({ request }) => {
  const write = await request.post('/api/activity-log', {
    data: {
      company_id: seeded.companyId,
      actor_id: seeded.ownerId,
      action: 'module3_test',
      target_name: 'Module 3',
      detail: 'Activity log smoke test',
    },
  })
  expect(write.status()).toBe(200)
  expect((await write.json()).success).toBe(true)

  const read = await request.get(`/api/activity-log?company_id=${seeded.companyId}`)
  const body = await read.json()
  expect(read.status()).toBe(200)
  expect(body.logs).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ action: 'module3_test', target_name: 'Module 3' }),
    ]),
  )
})

test('UC40 edits company profile fields', async ({ request }) => {
  const res = await request.patch('/api/company/update-profile', {
    data: {
      company_id: seeded.companyId,
      name: 'Module 3 Company Updated',
      description: 'Updated through module 3 API test',
      location: 'Singapore',
      address: '1 Test Way',
      postal_code: '123456',
      industry: 'Hospitality',
      size: '20-30',
    },
  })
  expect(res.status()).toBe(200)
  const body = await res.json()
  expect(body.success).toBe(true)
  expect(body.company).toMatchObject({
    name: 'Module 3 Company Updated',
    postal_code: '123456',
    industry: 'Hospitality',
  })
})
