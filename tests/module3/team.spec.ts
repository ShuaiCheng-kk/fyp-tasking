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

async function createMember(role: 'Manager' | 'Employee' | 'Partner', label: string, departmentId?: string): Promise<SeededMember> {
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
      .insert({ manager_id: user.id, company_id: seeded.companyId, department_id: departmentId })
    if (error) throw new Error(`Failed to assign manager department: ${error.message}`)
  } else if (role === 'Employee') {
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
    const { data: assignmentRows } = await admin.from('shift_assignments').select('id').in('shift_id', shiftIds)
    const assignmentIds = (assignmentRows ?? []).map((assignment) => assignment.id as string)
    if (assignmentIds.length > 0) {
      await admin.from('attendance_records').delete().in('shift_assignment_id', assignmentIds)
    }
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

test('generates an invitation code for a department role', async ({ request }) => {
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

test('UC27 sends a direct invitation by email to a new address', async ({ request }) => {
  const res = await request.post('/api/invitation/send-invite', {
    data: {
      email: `test-module3-direct-invite-${Date.now()}@tasking-tests.local`,
      role: 'Employee',
      company_id: seeded.companyId,
      department_id: departments.primary,
      invited_by: seeded.ownerId,
    },
  })
  expect(res.status()).toBe(200)
  const body = await res.json()
  expect(body.success).toBe(true)

  const missingFields = await request.post('/api/invitation/send-invite', {
    data: { email: 'nobody@tasking-tests.local' },
  })
  expect(missingFields.status()).toBe(400)
})

test('UC27 rejects inviting an existing member of another company', async ({ request }) => {
  const outsider = await createMember('Employee', 'outsider-invite', departments.secondary)
  // Move the outsider to a separate company so they're a genuine "existing user elsewhere" case.
  const { data: otherCompany, error: otherCompanyError } = await admin
    .from('companies')
    .insert({ name: 'Module 3 Other Co', owner_id: seeded.ownerId, plan: 'Free' })
    .select('id')
    .single()
  if (otherCompanyError || !otherCompany) throw new Error(`Failed to create other company: ${otherCompanyError?.message}`)
  await admin.from('users').update({ company_id: otherCompany.id }).eq('id', outsider.userId)

  const res = await request.post('/api/invitation/send-invite', {
    data: {
      email: outsider.email,
      role: 'Employee',
      company_id: seeded.companyId,
      department_id: departments.primary,
      invited_by: seeded.ownerId,
    },
  })
  const body = await res.json()
  expect(body.success).toBe(false)
  expect(body.message).toBe('This user already has an account with another company and cannot be invited.')

  await admin.from('companies').delete().eq('id', otherCompany.id)
})

test('UC31 assigns, lists, and removes a department manager', async ({ request }) => {
  const manager = await createMember('Manager', 'assign', departments.primary)

  const assign = await request.patch('/api/team/department-manager', {
    data: {
      company_id: seeded.companyId,
      department_id: departments.secondary,
      manager_id: manager.userId,
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

test('UC28/UC30 list team members and remove a member', async ({ request }) => {
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

test('UC30 removes a manager who created shifts without leaving a partial membership update', async ({ request }) => {
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

test('UC30 a Partner cannot remove any member — not another Partner, not a Manager, not an Employee', async ({ request }) => {
  const partner = await createMember('Partner', 'remover')
  const otherPartner = await createMember('Partner', 'remove-target')
  const manager = await createMember('Manager', 'remove-target-mgr', departments.primary)
  const employee = await createMember('Employee', 'remove-target-emp', departments.primary)

  for (const target of [otherPartner, manager, employee]) {
    const remove = await request.delete('/api/team/remove-member', {
      data: {
        company_id: seeded.companyId,
        user_id_to_remove: target.userId,
        requesting_user_id: partner.userId,
      },
    })
    expect(remove.status()).toBe(400)
    expect(await remove.json()).toMatchObject({ success: false, message: 'Insufficient permissions to remove a member' })
  }
})

test('UC31 changes an employee department in the employee department mapping', async ({ request }) => {
  const employee = await createMember('Employee', 'move', departments.primary)

  const res = await request.patch('/api/user/update-department', {
    data: {
      user_id: employee.userId,
      department_id: departments.secondary,
      company_id: seeded.companyId,
      requester_user_id: seeded.ownerId,
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

test('UC33 imports departments and skips duplicates', async ({ request }) => {
  const res = await request.post('/api/import/departments', {
    data: {
      company_id: seeded.companyId,
      departments: ['Front Desk', '  Bar  ', 'Bar', 'Events'],
      requester_user_id: seeded.ownerId,
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

test('writes and reads company activity logs', async ({ request }) => {
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

test('UC28 returns member data with full_name and role fields the UI search filters on', async ({ request }) => {
  await createMember('Employee', 'search-target', departments.primary)

  const res = await request.get(`/api/team/members?company_id=${seeded.companyId}`)
  expect(res.status()).toBe(200)
  const body = await res.json()
  expect(body.success).toBe(true)
  expect(body.members).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ full_name: expect.stringContaining('Module 3 Employee search-target'), role: 'Employee' }),
    ]),
  )

  const scoped = await request.get(`/api/team/members?company_id=${seeded.companyId}&department_id=${departments.primary}`)
  expect(scoped.status()).toBe(200)
  const scopedBody = await scoped.json()
  expect(scopedBody.members).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ full_name: expect.stringContaining('Module 3 Employee search-target') }),
    ]),
  )
})

test('UC29 toggles a casual worker between active and inactive', async ({ request }) => {
  const email = `test-module3-casual-${Date.now()}@tasking-tests.local`
  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email,
    password: 'Test-Password-123!',
    email_confirm: true,
  })
  if (authError || !authData.user) throw new Error(`Failed to create auth user: ${authError?.message}`)

  const { data: worker, error: workerError } = await admin
    .from('users')
    .insert({
      supabase_auth_id: authData.user.id,
      full_name: 'Module 3 Casual Worker',
      email_address: email,
      phone_number: null,
      role: 'Casual Worker',
      company_id: seeded.companyId,
      worker_status: 'active',
    })
    .select()
    .single()
  if (workerError || !worker) throw new Error(`Failed to create casual worker row: ${workerError?.message}`)
  members.push({ authUserId: authData.user.id, userId: worker.id as string, email })

  // The ban is per-company, so the status toggle now requires company_id.
  const deactivate = await request.patch('/api/team/casual-worker-status', {
    data: { user_id: worker.id, company_id: seeded.companyId, worker_status: 'inactive', inactivate_reason: 'No longer available' },
  })
  expect(deactivate.status()).toBe(200)
  const deactivateBody = await deactivate.json()
  expect(deactivateBody).toMatchObject({ success: true, user: { worker_status: 'inactive', inactivate_reason: 'No longer available' } })

  const reactivate = await request.patch('/api/team/casual-worker-status', {
    data: { user_id: worker.id, company_id: seeded.companyId, worker_status: 'active' },
  })
  expect(reactivate.status()).toBe(200)
  const reactivateBody = await reactivate.json()
  expect(reactivateBody).toMatchObject({ success: true, user: { worker_status: 'active', inactivate_reason: null } })

  const invalid = await request.patch('/api/team/casual-worker-status', {
    data: { user_id: worker.id, company_id: seeded.companyId, worker_status: 'on-leave' },
  })
  expect(invalid.status()).toBe(400)
  expect((await invalid.json()).success).toBe(false)

  const missingCompany = await request.patch('/api/team/casual-worker-status', {
    data: { user_id: worker.id, worker_status: 'inactive' },
  })
  expect(missingCompany.status()).toBe(400)
  expect((await missingCompany.json()).message).toContain('company_id')
})

test('casual worker certificates endpoint returns the worker profile certificates for the CW detail card', async ({ request }) => {
  const email = `test-module3-certs-${Date.now()}@tasking-tests.local`
  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email,
    password: 'Test-Password-123!',
    email_confirm: true,
  })
  if (authError || !authData.user) throw new Error(`Failed to create auth user: ${authError?.message}`)

  const { data: worker, error: workerError } = await admin
    .from('users')
    .insert({
      supabase_auth_id: authData.user.id,
      full_name: 'Module 3 Certificate Worker',
      email_address: email,
      phone_number: null,
      role: 'Casual Worker',
      company_id: seeded.companyId,
      worker_status: 'active',
      skills: 'Barista, Cash register',
      resume_url: 'https://example.com/demo-resumes/cert-worker.pdf',
    })
    .select()
    .single()
  if (workerError || !worker) throw new Error(`Failed to create casual worker row: ${workerError?.message}`)
  members.push({ authUserId: authData.user.id, userId: worker.id as string, email })

  // Profile-level certificates (user_certificates), the same data the Guest fills in during
  // recruitment — one with a proof file, one without — cascade-deleted with the user in afterAll.
  const { error: certError } = await admin.from('user_certificates').insert([
    { user_id: worker.id, name: 'Food Hygiene Certificate', file_url: 'https://example.com/demo-certs/food-hygiene.pdf' },
    { user_id: worker.id, name: 'First Aid Certificate (CPR + AED)', file_url: null },
  ])
  expect(certError).toBeNull()

  const res = await request.get(`/api/team/casual-worker-certificates?user_id=${worker.id}`)
  expect(res.status()).toBe(200)
  const body = await res.json()
  expect(body.success).toBe(true)
  expect(body.certificates).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ name: 'Food Hygiene Certificate', file_url: 'https://example.com/demo-certs/food-hygiene.pdf' }),
      expect.objectContaining({ name: 'First Aid Certificate (CPR + AED)', file_url: null }),
    ]),
  )

  const missing = await request.get('/api/team/casual-worker-certificates')
  expect(missing.status()).toBe(400)
  expect((await missing.json()).success).toBe(false)
})

test('recruited casual worker is only marked verified into the company Casual Worker pool after a completed clock-in + clock-out', async ({ request }) => {
  // Mirrors what respondToInvitation actually writes at two-way-confirm time: role flipped to
  // Casual Worker + a casualworker_departments row, but users.company_id is deliberately left
  // unset (that's the pre-existing bug this feature also fixes).
  const email = `test-module3-verify-${Date.now()}@tasking-tests.local`
  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email,
    password: 'Test-Password-123!',
    email_confirm: true,
  })
  if (authError || !authData.user) throw new Error(`Failed to create auth user: ${authError?.message}`)

  const { data: worker, error: workerError } = await admin
    .from('users')
    .insert({
      supabase_auth_id: authData.user.id,
      full_name: 'Module 3 Recruited Casual Worker',
      email_address: email,
      phone_number: null,
      role: 'Casual Worker',
      worker_status: 'active',
    })
    .select()
    .single()
  if (workerError || !worker) throw new Error(`Failed to create casual worker row: ${workerError?.message}`)
  members.push({ authUserId: authData.user.id, userId: worker.id as string, email })

  const { error: cwdError } = await admin
    .from('casualworker_departments')
    .insert({ casual_worker_id: worker.id, department_id: departments.primary, company_id: seeded.companyId })
  expect(cwdError).toBeNull()

  // Confirmed but never clocked in — still visible to pickers (e.g. shift-swap replacement,
  // task assignment) that reuse this same endpoint, but not yet part of the verified pool.
  const notYetVerified = await request.get(`/api/team/members?company_id=${seeded.companyId}`)
  const notYetVerifiedBody = await notYetVerified.json()
  expect(notYetVerifiedBody.members).toEqual(
    expect.arrayContaining([expect.objectContaining({ id: worker.id, casual_worker_verified_at: null })]),
  )

  const { data: shift, error: shiftError } = await admin
    .from('shifts')
    .insert({
      company_id: seeded.companyId,
      department_id: departments.primary,
      shift_date: '2030-03-01',
      start_time: '09:00',
      end_time: '17:00',
      title: 'Verification regression shift',
      created_by: seeded.ownerId,
      publication_status: 'published',
    })
    .select('id')
    .single()
  expect(shiftError).toBeNull()

  const { data: assignment, error: assignmentError } = await admin
    .from('shift_assignments')
    .insert({ shift_id: shift!.id, user_id: worker.id, assigned_by: seeded.ownerId })
    .select('id')
    .single()
  expect(assignmentError).toBeNull()

  const clockIn = await request.post('/api/casual/attendance', {
    data: {
      action: 'clock_in',
      user_id: authData.user.id,
      shift_assignment_id: assignment!.id,
      clock_time: '2030-03-01T09:00:00.000Z',
    },
  })
  expect(clockIn.status()).toBe(201)

  const clockOut = await request.post('/api/casual/attendance', {
    data: {
      action: 'clock_out',
      user_id: authData.user.id,
      shift_assignment_id: assignment!.id,
      clock_time: '2030-03-01T17:00:00.000Z',
    },
  })
  expect(clockOut.status()).toBe(200)

  const verified = await request.get(`/api/team/members?company_id=${seeded.companyId}`)
  const verifiedBody = await verified.json()
  const verifiedMember = verifiedBody.members.find((m: { id: string }) => m.id === worker.id)
  expect(verifiedMember).toMatchObject({ role: 'Casual Worker' })
  expect(verifiedMember.casual_worker_verified_at).toBeTruthy()

  const verifiedByDepartment = await request.get(`/api/team/members?company_id=${seeded.companyId}&department_id=${departments.primary}`)
  const verifiedByDepartmentBody = await verifiedByDepartment.json()
  const verifiedByDepartmentMember = verifiedByDepartmentBody.members.find((m: { id: string }) => m.id === worker.id)
  expect(verifiedByDepartmentMember).toMatchObject({ role: 'Casual Worker' })
  expect(verifiedByDepartmentMember.casual_worker_verified_at).toBeTruthy()
})

test('UC32 invites members by CSV row and reports per-row failures', async ({ request }) => {
  const goodEmail = `test-module3-csv-${Date.now()}@tasking-tests.local`
  const res = await request.post('/api/import/members', {
    data: {
      company_id: seeded.companyId,
      invited_by: seeded.ownerId,
      members: [
        { email: goodEmail, role: 'Employee', department_name: 'Front Desk' },
        { email: 'bad-email', role: 'Employee', department_name: 'Front Desk' },
        { email: `test-module3-csv-nodept-${Date.now()}@tasking-tests.local`, role: 'Employee', department_name: 'Nonexistent Dept' },
      ],
    },
  })
  expect(res.status()).toBe(200)
  const body = await res.json()
  expect(body.success).toBe(true)
  expect(body.result.invited).toEqual([goodEmail])
  expect(body.result.failed).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ email: 'bad-email', message: 'Invalid email address' }),
      expect.objectContaining({ message: 'Department not found' }),
    ]),
  )

  await admin.from('invitation_code').delete().eq('company_id', seeded.companyId).eq('email', goodEmail)
})

test('org chart data: members carry department_id and role so the UI can group by department', async ({ request }) => {
  const manager = await createMember('Manager', 'orgchart', departments.secondary)

  const members_ = await request.get(`/api/team/members?company_id=${seeded.companyId}`)
  expect(members_.status()).toBe(200)
  const membersBody = await members_.json()
  expect(membersBody.members).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ id: manager.userId, role: 'Manager', department_id: departments.secondary }),
      expect.objectContaining({ id: seeded.ownerId, role: 'Owner' }),
    ]),
  )

  const depts = await request.get(`/api/company/departments?company_id=${seeded.companyId}`)
  expect(depts.status()).toBe(200)
  const deptsBody = await depts.json()
  expect(deptsBody.departments).toEqual(
    expect.arrayContaining([expect.objectContaining({ id: departments.secondary, name: 'Kitchen' })]),
  )
})

test('UC34 edits company profile fields', async ({ request }) => {
  const res = await request.patch('/api/company/update-profile', {
    data: {
      company_id: seeded.companyId,
      requester_user_id: seeded.ownerId,
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

test('Owner-only routes reject a non-Owner requester with 403', async ({ request }) => {
  const employee = await createMember('Employee', 'guard403', departments.primary)

  const res = await request.post('/api/company/create-department', {
    data: { company_id: seeded.companyId, name: 'Should Not Exist', requester_user_id: employee.userId },
  })
  expect(res.status()).toBe(403)
  expect((await res.json()).success).toBe(false)
})
