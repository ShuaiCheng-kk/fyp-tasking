import { test, expect } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'
import { seedTestOwnerAndCompany, cleanupTestOwnerAndCompany, TestOwner } from '../helpers/seed'

// Integration tests for Module 1 — Shift (UC1-8, UC10, UC12).
// Hits the real route.ts -> service -> repository -> Supabase chain, no UI involved.

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

let seeded: TestOwner
let departmentId: string
let employeeId: string
let employeeAuthId: string
let managerId: string
let managerAuthId: string

test.beforeAll(async () => {
  seeded = await seedTestOwnerAndCompany('shift-api')

  const { data: department, error: deptError } = await admin
    .from('departments')
    .insert({ company_id: seeded.companyId, name: 'Kitchen' })
    .select('id')
    .single()
  if (deptError || !department) throw new Error(`Failed to create department: ${deptError?.message}`)
  departmentId = department.id

  const email = `test-shift-employee-${Date.now()}@tasking-tests.local`
  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email,
    password: 'Test-Password-123!',
    email_confirm: true,
  })
  if (authError || !authData.user) throw new Error(`Failed to create auth user: ${authError?.message}`)
  employeeAuthId = authData.user.id

  const { data: employee, error: employeeError } = await admin
    .from('users')
    .insert({
      supabase_auth_id: authData.user.id,
      full_name: 'Shift Test Employee',
      email_address: email,
      phone_number: null,
      role: 'Employee',
      company_id: seeded.companyId,
    })
    .select()
    .single()
  if (employeeError || !employee) throw new Error(`Failed to create employee row: ${employeeError?.message}`)
  employeeId = employee.id

  const { error: deptLinkError } = await admin
    .from('employee_departments')
    .insert({ employee_id: employeeId, department_id: departmentId })
  if (deptLinkError) throw new Error(`Failed to assign employee department: ${deptLinkError.message}`)

  const managerEmail = `test-shift-manager-${Date.now()}@tasking-tests.local`
  const { data: managerAuth, error: managerAuthError } = await admin.auth.admin.createUser({
    email: managerEmail,
    password: 'Test-Password-123!',
    email_confirm: true,
  })
  if (managerAuthError || !managerAuth.user) throw new Error(`Failed to create manager auth user: ${managerAuthError?.message}`)
  managerAuthId = managerAuth.user.id

  const { data: manager, error: managerError } = await admin
    .from('users')
    .insert({
      supabase_auth_id: managerAuth.user.id,
      full_name: 'Shift Test Manager',
      email_address: managerEmail,
      phone_number: null,
      role: 'Manager',
      company_id: seeded.companyId,
    })
    .select()
    .single()
  if (managerError || !manager) throw new Error(`Failed to create manager row: ${managerError?.message}`)
  managerId = manager.id

  const { error: managerDeptLinkError } = await admin
    .from('manager_departments')
    .insert({ manager_id: managerId, company_id: seeded.companyId, department_id: departmentId, assigned_by: seeded.ownerId })
  if (managerDeptLinkError) throw new Error(`Failed to assign manager department: ${managerDeptLinkError.message}`)
})

test.afterAll(async () => {
  const { data: shiftRows } = await admin.from('shifts').select('id').eq('company_id', seeded.companyId)
  const shiftIds = (shiftRows ?? []).map((shift) => shift.id as string)
  if (shiftIds.length > 0) {
    await admin.from('shift_assignments').delete().in('shift_id', shiftIds)
    await admin.from('shifts').delete().in('id', shiftIds)
  }
  await admin.from('employee_departments').delete().eq('employee_id', employeeId)
  await admin.from('users').delete().eq('id', employeeId)
  await admin.auth.admin.deleteUser(employeeAuthId).catch(() => undefined)
  await admin.from('manager_departments').delete().eq('manager_id', managerId)
  await admin.from('users').delete().eq('id', managerId)
  await admin.auth.admin.deleteUser(managerAuthId).catch(() => undefined)
  await admin.from('departments').delete().eq('id', departmentId)
  await cleanupTestOwnerAndCompany(seeded)
})

let shiftId: string

test('UC3 creates a shift', async ({ request }) => {
  const res = await request.post('/api/shift', {
    data: {
      company_id: seeded.companyId,
      department_id: departmentId,
      shift_date: '2026-07-01',
      start_time: '09:00',
      end_time: '17:00',
      created_by: seeded.ownerId,
    },
  })
  expect(res.status()).toBe(201)
  const body = await res.json()
  expect(body.success).toBe(true)
  expect(body.shift.department_id).toBe(departmentId)
  shiftId = body.shift.id
})

test('UC3 rejects a shift where start_time is after end_time', async ({ request }) => {
  const res = await request.post('/api/shift', {
    data: {
      company_id: seeded.companyId,
      department_id: departmentId,
      shift_date: '2026-07-01',
      start_time: '17:00',
      end_time: '09:00',
      created_by: seeded.ownerId,
    },
  })
  expect(res.status()).toBe(400)
  const body = await res.json()
  expect(body.success).toBe(false)
})

test('UC1/UC2 views the allocation timeline filtered by date range', async ({ request }) => {
  const res = await request.get(
    `/api/shift?company_id=${seeded.companyId}&date_from=2026-07-01&date_to=2026-07-01`,
  )
  expect(res.status()).toBe(200)
  const body = await res.json()
  expect(body.success).toBe(true)
  const deptRows = body.rows.filter((row: { department_id: string }) => row.department_id === departmentId)
  expect(deptRows.length).toBeGreaterThan(0)
  const hasShift = deptRows.some((row: { shifts: { id: string }[] }) => row.shifts.some((s) => s.id === shiftId))
  expect(hasShift).toBe(true)
})

test('UC4 edits the shift and assigns it to an employee', async ({ request }) => {
  const res = await request.patch(`/api/shift/${shiftId}`, {
    data: {
      title: 'Morning Prep',
      assigned_user_id: employeeId,
      assigned_by: seeded.ownerId,
    },
  })
  expect(res.status()).toBe(200)
  const body = await res.json()
  expect(body.success).toBe(true)
  expect(body.shift.title).toBe('Morning Prep')
})

test('UC10 surfaces a clopening conflict warning and blocks it without override', async ({ request }) => {
  const res = await request.post('/api/shift', {
    data: {
      company_id: seeded.companyId,
      department_id: departmentId,
      shift_date: '2026-07-02',
      start_time: '00:00',
      end_time: '04:00',
      created_by: seeded.ownerId,
      assigned_user_id: employeeId,
    },
  })
  expect(res.status()).toBe(400)
  const body = await res.json()
  expect(body.success).toBe(false)
  expect(body.message).toContain('CLOPENING_CONFLICT')
})

test('UC10 allows the conflicting shift through when override_clopening is set', async ({ request }) => {
  const res = await request.post('/api/shift', {
    data: {
      company_id: seeded.companyId,
      department_id: departmentId,
      shift_date: '2026-07-02',
      start_time: '00:00',
      end_time: '04:00',
      created_by: seeded.ownerId,
      assigned_user_id: employeeId,
      override_clopening: true,
    },
  })
  expect(res.status()).toBe(201)
  const body = await res.json()
  expect(body.success).toBe(true)
  expect(body.warning).toBeTruthy()
})

test('UC7 duplicates the shift as a new draft shift', async ({ request }) => {
  const res = await request.post(`/api/shift/${shiftId}/duplicate`, {
    data: {
      shift_date: '2026-07-08',
      start_time: '09:00',
      end_time: '17:00',
      created_by: seeded.ownerId,
    },
  })
  expect(res.status()).toBe(201)
  const body = await res.json()
  expect(body.success).toBe(true)
  expect(body.shift.source_shift_id).toBe(shiftId)
  expect(body.shift.publication_status).toBe('draft')
})

test('UC8 creates weekly recurring shifts from the original shift', async ({ request }) => {
  const res = await request.post(`/api/shift/${shiftId}/recurrence`, {
    data: {
      recurrence_rule: 'weekly',
      recurrence_end_date: '2026-07-22',
      created_by: seeded.ownerId,
    },
  })
  expect(res.status()).toBe(201)
  const body = await res.json()
  expect(body.success).toBe(true)
  expect(body.shifts.length).toBeGreaterThan(0)
  expect(body.shifts.every((s: { recurrence_rule: string }) => s.recurrence_rule === 'weekly')).toBe(true)
})

test('UC12 bulk-assigns shifts and reports per-row failures', async ({ request }) => {
  const res = await request.post('/api/shift/bulk', {
    data: {
      company_id: seeded.companyId,
      department_id: departmentId,
      created_by: seeded.ownerId,
      assignments: [
        { user_id: employeeId, shift_date: '2026-07-15', start_time: '09:00', end_time: '17:00' },
        { user_id: '', shift_date: '2026-07-15', start_time: '09:00', end_time: '17:00' },
      ],
    },
  })
  expect(res.status()).toBe(201)
  const body = await res.json()
  expect(body.success).toBe(true)
  expect(body.result.created).toHaveLength(1)
  expect(body.result.failed).toHaveLength(1)
})

test('UC6 publishes the schedule for the date range', async ({ request }) => {
  // Satisfy the min-managers-per-department-day hard rule before publishing (UC6 gates on schedule validation).
  const managerShiftRes = await request.post('/api/shift', {
    data: {
      company_id: seeded.companyId,
      department_id: departmentId,
      shift_date: '2026-07-01',
      start_time: '09:00',
      end_time: '17:00',
      created_by: seeded.ownerId,
      assigned_user_id: managerId,
    },
  })
  expect(managerShiftRes.status()).toBe(201)

  const res = await request.patch('/api/shift/schedule', {
    data: {
      company_id: seeded.companyId,
      date_from: '2026-07-01',
      date_to: '2026-07-01',
      publication_status: 'published',
    },
  })
  expect(res.status()).toBe(200)
  const body = await res.json()
  expect(body.success).toBe(true)
  expect(body.shifts.some((s: { id: string; publication_status: string }) => s.id === shiftId && s.publication_status === 'published')).toBe(true)
})

test('UC9 creates a split shift with two linked time blocks', async ({ request }) => {
  const res = await request.post('/api/shift/split', {
    data: {
      company_id: seeded.companyId,
      department_id: departmentId,
      shift_date: '2026-07-20',
      blocks: [
        { start_time: '09:00', end_time: '12:00' },
        { start_time: '14:00', end_time: '18:00' },
      ],
      created_by: seeded.ownerId,
      assigned_user_id: employeeId,
    },
  })
  expect(res.status()).toBe(201)
  const body = await res.json()
  expect(body.success).toBe(true)
  expect(body.shifts).toHaveLength(2)
  expect(body.shifts[0].split_group_id).toBe(body.shifts[1].split_group_id)
  expect(body.shifts[0].split_group_id).toBeTruthy()
})

test('UC9 rejects a split shift with overlapping blocks', async ({ request }) => {
  const res = await request.post('/api/shift/split', {
    data: {
      company_id: seeded.companyId,
      department_id: departmentId,
      shift_date: '2026-07-21',
      blocks: [
        { start_time: '09:00', end_time: '15:00' },
        { start_time: '14:00', end_time: '18:00' },
      ],
      created_by: seeded.ownerId,
    },
  })
  expect(res.status()).toBe(400)
  const body = await res.json()
  expect(body.success).toBe(false)
})

test('UC11 undoes the most recent create action by deleting the shift it created', async ({ request }) => {
  const createRes = await request.post('/api/shift', {
    data: {
      company_id: seeded.companyId,
      department_id: departmentId,
      shift_date: '2026-07-25',
      start_time: '09:00',
      end_time: '17:00',
      created_by: seeded.ownerId,
    },
  })
  expect(createRes.status()).toBe(201)
  const createBody = await createRes.json()
  const undoableShiftId = createBody.shift.id

  const undoRes = await request.post('/api/shift/undo', {
    data: { company_id: seeded.companyId, performed_by: seeded.ownerId },
  })
  expect(undoRes.status()).toBe(200)
  const undoBody = await undoRes.json()
  expect(undoBody.success).toBe(true)
  expect(undoBody.action_type).toBe('create')

  const list = await (
    await request.get(`/api/shift?company_id=${seeded.companyId}&date_from=2026-07-25&date_to=2026-07-25`)
  ).json()
  const stillPresent = list.rows.some((row: { shifts: { id: string }[] }) =>
    row.shifts.some((s) => s.id === undoableShiftId),
  )
  expect(stillPresent).toBe(false)
})

test('UC11 undoes a delete action by restoring the deleted shift', async ({ request }) => {
  const createRes = await request.post('/api/shift', {
    data: {
      company_id: seeded.companyId,
      department_id: departmentId,
      shift_date: '2026-07-26',
      start_time: '09:00',
      end_time: '17:00',
      created_by: seeded.ownerId,
    },
  })
  const createBody = await createRes.json()
  const tempShiftId = createBody.shift.id

  const deleteRes = await request.delete(`/api/shift/${tempShiftId}?performed_by=${seeded.ownerId}`)
  expect(deleteRes.status()).toBe(200)

  const undoRes = await request.post('/api/shift/undo', {
    data: { company_id: seeded.companyId, performed_by: seeded.ownerId },
  })
  expect(undoRes.status()).toBe(200)
  const undoBody = await undoRes.json()
  expect(undoBody.action_type).toBe('delete')

  const list = await (
    await request.get(`/api/shift?company_id=${seeded.companyId}&date_from=2026-07-26&date_to=2026-07-26`)
  ).json()
  const restored = list.rows.some((row: { shifts: { id: string }[] }) =>
    row.shifts.some((s) => s.id === tempShiftId),
  )
  expect(restored).toBe(true)

  // clean up the restored shift so it doesn't leak into afterAll's bulk cleanup ordering
  await request.delete(`/api/shift/${tempShiftId}`)
})

test('UC11 rejects undo when there is no recent action for that user', async ({ request }) => {
  const res = await request.post('/api/shift/undo', {
    data: { company_id: seeded.companyId, performed_by: employeeId },
  })
  expect(res.status()).toBe(400)
  const body = await res.json()
  expect(body.success).toBe(false)
})

test('UC5 deletes the shift', async ({ request }) => {
  const res = await request.delete(`/api/shift/${shiftId}`)
  expect(res.status()).toBe(200)
  const body = await res.json()
  expect(body.success).toBe(true)

  const list = await (
    await request.get(`/api/shift?company_id=${seeded.companyId}&date_from=2026-07-01&date_to=2026-07-01`)
  ).json()
  const stillPresent = list.rows.some((row: { shifts: { id: string }[] }) =>
    row.shifts.some((s) => s.id === shiftId),
  )
  expect(stillPresent).toBe(false)
})
