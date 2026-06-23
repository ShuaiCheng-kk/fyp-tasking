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

test('UC10 surfaces a clopening conflict as a non-blocking warning', async ({ request }) => {
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
  expect(res.status()).toBe(201)
  const body = await res.json()
  expect(body.success).toBe(true)
  expect(body.warning).toBeTruthy()
  expect(body.warning.message).toContain('Clopening warning')

  await request.delete(`/api/shift/${body.shift.id}`)
})

test('UC10 does not warn when rest between shifts is 8 hours or more', async ({ request }) => {
  const res = await request.post('/api/shift', {
    data: {
      company_id: seeded.companyId,
      department_id: departmentId,
      shift_date: '2026-07-02',
      start_time: '01:00',
      end_time: '05:00',
      created_by: seeded.ownerId,
      assigned_user_id: employeeId,
    },
  })
  expect(res.status()).toBe(201)
  const body = await res.json()
  expect(body.success).toBe(true)
  expect(body.warning).toBeNull()

  await request.delete(`/api/shift/${body.shift.id}`)
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
  expect(body.shift.source_shift_id).toBeNull()
  expect(body.shift.recurrence_group_id).toBeNull()
  expect(body.shift.publication_status).toBe('draft')
})

test('UC7 duplicating a recurring original does not pull the duplicate into the recurring series', async ({ request }) => {
  const createRes = await request.post('/api/shift', {
    data: { company_id: seeded.companyId, department_id: departmentId, shift_date: '2026-08-05', start_time: '09:00', end_time: '17:00', created_by: seeded.ownerId },
  })
  const originalId = (await createRes.json()).shift.id

  await request.post(`/api/shift/${originalId}/recurrence`, {
    data: { recurrence_rule: 'weekly', recurrence_end_date: '2026-08-19', created_by: seeded.ownerId },
  })

  const dupRes = await request.post(`/api/shift/${originalId}/duplicate`, {
    data: { shift_date: '2026-08-06', start_time: '09:00', end_time: '17:00', created_by: seeded.ownerId },
  })
  const dupBody = await dupRes.json()
  expect(dupBody.success).toBe(true)
  expect(dupBody.shift.recurrence_group_id).toBeNull()
  expect(dupBody.shift.recurrence_rule).toBeNull()
  expect(dupBody.shift.source_shift_id).toBeNull()

  // clean up: deleting the original cascades and removes the recurring occurrences; the duplicate is independent and needs its own cleanup
  await request.delete(`/api/shift/${originalId}`)
  await request.delete(`/api/shift/${dupBody.shift.id}`)
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

test('UC8 editing the original recurring shift cascades the time change to all occurrences, but editing an occurrence does not', async ({ request }) => {
  const createRes = await request.post('/api/shift', {
    data: { company_id: seeded.companyId, department_id: departmentId, shift_date: '2026-08-03', start_time: '09:00', end_time: '17:00', created_by: seeded.ownerId },
  })
  const originalId = (await createRes.json()).shift.id

  const recRes = await request.post(`/api/shift/${originalId}/recurrence`, {
    data: { recurrence_rule: 'weekly', recurrence_end_date: '2026-08-17', created_by: seeded.ownerId },
  })
  const recBody = await recRes.json()
  expect(recBody.shifts).toHaveLength(2)
  const [occurrence1Id, occurrence2Id] = recBody.shifts.map((s: { id: string }) => s.id)

  const editOriginalRes = await request.patch(`/api/shift/${originalId}`, {
    data: { start_time: '10:00', end_time: '18:00', performed_by: seeded.ownerId },
  })
  expect(editOriginalRes.status()).toBe(200)

  const checkRes = await request.get(`/api/shift?company_id=${seeded.companyId}&date_from=2026-08-03&date_to=2026-08-17`)
  const checkBody = await checkRes.json()
  const allShifts = checkBody.rows.flatMap((row: { shifts: { id: string; start_time: string; end_time: string }[] }) => row.shifts)
  for (const id of [originalId, occurrence1Id, occurrence2Id]) {
    const shift = allShifts.find((s: { id: string }) => s.id === id)
    expect(shift?.start_time).toBe('10:00:00')
    expect(shift?.end_time).toBe('18:00:00')
  }

  const editOccurrenceRes = await request.patch(`/api/shift/${occurrence1Id}`, {
    data: { start_time: '11:00', end_time: '19:00', performed_by: seeded.ownerId },
  })
  expect(editOccurrenceRes.status()).toBe(200)

  const checkRes2 = await request.get(`/api/shift?company_id=${seeded.companyId}&date_from=2026-08-03&date_to=2026-08-17`)
  const checkBody2 = await checkRes2.json()
  const allShifts2 = checkBody2.rows.flatMap((row: { shifts: { id: string; start_time: string; end_time: string }[] }) => row.shifts)
  expect(allShifts2.find((s: { id: string }) => s.id === occurrence1Id)?.start_time).toBe('11:00:00')
  expect(allShifts2.find((s: { id: string }) => s.id === originalId)?.start_time).toBe('10:00:00')
  expect(allShifts2.find((s: { id: string }) => s.id === occurrence2Id)?.start_time).toBe('10:00:00')

  // clean up: deleting the original cascades and removes all occurrences in this group
  await request.delete(`/api/shift/${originalId}`)
})

test('UC8 reassigning the original recurring shift cascades the new assignee to all occurrences', async ({ request }) => {
  const createRes = await request.post('/api/shift', {
    data: { company_id: seeded.companyId, department_id: departmentId, shift_date: '2026-08-10', start_time: '09:00', end_time: '17:00', created_by: seeded.ownerId, assigned_user_id: employeeId },
  })
  const originalId = (await createRes.json()).shift.id

  const recRes = await request.post(`/api/shift/${originalId}/recurrence`, {
    data: { recurrence_rule: 'weekly', recurrence_end_date: '2026-08-24', created_by: seeded.ownerId },
  })
  const recBody = await recRes.json()
  expect(recBody.shifts).toHaveLength(2)
  const occurrenceIds = recBody.shifts.map((s: { id: string }) => s.id)

  const reassignRes = await request.patch(`/api/shift/${originalId}`, {
    data: { assigned_user_id: managerId, assigned_by: seeded.ownerId, performed_by: seeded.ownerId },
  })
  expect(reassignRes.status()).toBe(200)

  const checkRes = await request.get(`/api/shift?company_id=${seeded.companyId}&date_from=2026-08-10&date_to=2026-08-24`)
  const checkBody = await checkRes.json()
  const allRows = checkBody.rows as { user_id: string | null; shifts: { id: string }[] }[]
  for (const id of [originalId, ...occurrenceIds]) {
    const row = allRows.find(r => r.shifts.some(s => s.id === id))
    expect(row?.user_id).toBe(managerId)
  }

  // clean up: deleting the original cascades and removes all occurrences in this group
  await request.delete(`/api/shift/${originalId}`)
})

test('UC5/UC8 deleting the original recurring shift cascades to delete all occurrences', async ({ request }) => {
  const createRes = await request.post('/api/shift', {
    data: { company_id: seeded.companyId, department_id: departmentId, shift_date: '2026-08-04', start_time: '09:00', end_time: '17:00', created_by: seeded.ownerId },
  })
  const originalId = (await createRes.json()).shift.id

  const recRes = await request.post(`/api/shift/${originalId}/recurrence`, {
    data: { recurrence_rule: 'weekly', recurrence_end_date: '2026-08-18', created_by: seeded.ownerId },
  })
  const recBody = await recRes.json()
  const occurrenceIds = recBody.shifts.map((s: { id: string }) => s.id)

  const deleteRes = await request.delete(`/api/shift/${originalId}?performed_by=${seeded.ownerId}`)
  expect(deleteRes.status()).toBe(200)

  const checkRes = await request.get(`/api/shift?company_id=${seeded.companyId}&date_from=2026-08-04&date_to=2026-08-18`)
  const checkBody = await checkRes.json()
  const allShifts = checkBody.rows.flatMap((row: { shifts: { id: string }[] }) => row.shifts)
  for (const id of [originalId, ...occurrenceIds]) {
    expect(allShifts.some((s: { id: string }) => s.id === id)).toBe(false)
  }
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

test('UC14 bulk-creates AI-generated shifts in one request and records a single undoable action', async ({ request }) => {
  const res = await request.post('/api/shift/bulk-create', {
    data: {
      company_id: seeded.companyId,
      created_by: seeded.ownerId,
      items: [
        { department_id: departmentId, shift_date: '2026-07-16', start_time: '09:00', end_time: '17:00', assigned_user_id: employeeId },
        { department_id: departmentId, shift_date: '2026-07-17', start_time: '09:00', end_time: '17:00', assigned_user_id: null },
        { department_id: departmentId, shift_date: '2026-07-17', start_time: '17:00', end_time: '09:00' },
      ],
    },
  })
  expect(res.status()).toBe(201)
  const body = await res.json()
  expect(body.success).toBe(true)
  expect(body.result.created).toHaveLength(2)
  expect(body.result.failed).toHaveLength(1)
  const createdIds: string[] = body.result.created.map((s: { id: string }) => s.id)

  const undoRes = await request.post('/api/shift/undo', {
    data: { company_id: seeded.companyId, performed_by: seeded.ownerId },
  })
  expect(undoRes.status()).toBe(200)
  const undoBody = await undoRes.json()
  expect(undoBody.action_type).toBe('bulk')

  const list = await (
    await request.get(`/api/shift?company_id=${seeded.companyId}&date_from=2026-07-16&date_to=2026-07-17`)
  ).json()
  const stillPresent = list.rows.some((row: { shifts: { id: string }[] }) =>
    row.shifts.some((s) => createdIds.includes(s.id)),
  )
  expect(stillPresent).toBe(false)
})

test('Bulk Shift Editor updates multiple existing shifts in one request', async ({ request }) => {
  const createA = await request.post('/api/shift', {
    data: { company_id: seeded.companyId, department_id: departmentId, shift_date: '2026-07-20', start_time: '09:00', end_time: '17:00', created_by: seeded.ownerId },
  })
  const createB = await request.post('/api/shift', {
    data: { company_id: seeded.companyId, department_id: departmentId, shift_date: '2026-07-21', start_time: '09:00', end_time: '17:00', created_by: seeded.ownerId },
  })
  const shiftAId = (await createA.json()).shift.id
  const shiftBId = (await createB.json()).shift.id

  const res = await request.patch('/api/shift/bulk-edit', {
    data: {
      company_id: seeded.companyId,
      performed_by: seeded.ownerId,
      items: [
        { id: shiftAId, start_time: '10:00', end_time: '18:00' },
        { id: shiftBId, start_time: '11:00', end_time: '19:00' },
      ],
    },
  })
  expect(res.status()).toBe(200)
  const body = await res.json()
  expect(body.success).toBe(true)
  expect(body.result.updated).toHaveLength(2)
  expect(body.result.failed).toHaveLength(0)
})

test('Bulk Shift Editor reports a per-row failure without aborting the batch', async ({ request }) => {
  const createC = await request.post('/api/shift', {
    data: { company_id: seeded.companyId, department_id: departmentId, shift_date: '2026-07-22', start_time: '09:00', end_time: '17:00', created_by: seeded.ownerId },
  })
  const shiftCId = (await createC.json()).shift.id

  const res = await request.patch('/api/shift/bulk-edit', {
    data: {
      company_id: seeded.companyId,
      performed_by: seeded.ownerId,
      items: [
        { id: shiftCId, start_time: '10:00', end_time: '18:00' },
        { id: '00000000-0000-0000-0000-000000000000', start_time: '10:00', end_time: '18:00' },
      ],
    },
  })
  expect(res.status()).toBe(200)
  const body = await res.json()
  expect(body.success).toBe(true)
  expect(body.result.updated).toHaveLength(1)
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

test('UC7/UC11 publishing with performed_by records history that can be undone and redone', async ({ request }) => {
  // Satisfy the min-managers/min-employees-per-department-day hard rule before publishing.
  const employeeShiftRes = await request.post('/api/shift', {
    data: {
      company_id: seeded.companyId,
      department_id: departmentId,
      shift_date: '2026-07-02',
      start_time: '09:00',
      end_time: '17:00',
      created_by: seeded.ownerId,
      assigned_user_id: employeeId,
    },
  })
  const employeeShiftId = (await employeeShiftRes.json()).shift.id

  const createRes = await request.post('/api/shift', {
    data: {
      company_id: seeded.companyId,
      department_id: departmentId,
      shift_date: '2026-07-02',
      start_time: '09:00',
      end_time: '17:00',
      created_by: seeded.ownerId,
      assigned_user_id: managerId,
    },
  })
  const createBody = await createRes.json()
  const publishShiftId = createBody.shift.id

  const publishRes = await request.patch('/api/shift/schedule', {
    data: {
      company_id: seeded.companyId,
      date_from: '2026-07-02',
      date_to: '2026-07-02',
      publication_status: 'published',
      performed_by: seeded.ownerId,
    },
  })
  expect(publishRes.status()).toBe(200)

  const undoRes = await request.post('/api/shift/undo', {
    data: { company_id: seeded.companyId, performed_by: seeded.ownerId },
  })
  expect(undoRes.status()).toBe(200)
  const undoBody = await undoRes.json()
  expect(undoBody.action_type).toBe('publish')

  let list = await (
    await request.get(`/api/shift?company_id=${seeded.companyId}&date_from=2026-07-02&date_to=2026-07-02`)
  ).json()
  let row = list.rows.flatMap((r: { shifts: { id: string; publication_status: string }[] }) => r.shifts).find((s: { id: string }) => s.id === publishShiftId)
  expect(row.publication_status).toBe('draft')

  const redoRes = await request.post('/api/shift/redo', {
    data: { company_id: seeded.companyId, performed_by: seeded.ownerId },
  })
  expect(redoRes.status()).toBe(200)
  const redoBody = await redoRes.json()
  expect(redoBody.action_type).toBe('publish')

  list = await (
    await request.get(`/api/shift?company_id=${seeded.companyId}&date_from=2026-07-02&date_to=2026-07-02`)
  ).json()
  row = list.rows.flatMap((r: { shifts: { id: string; publication_status: string }[] }) => r.shifts).find((s: { id: string }) => s.id === publishShiftId)
  expect(row.publication_status).toBe('published')

  await request.delete(`/api/shift/${publishShiftId}`)
  await request.delete(`/api/shift/${employeeShiftId}`)
})

test('UC6/UC7 hides draft shifts from Manager and Employee viewers, visible only to Owner/Partner', async ({ request }) => {
  const createRes = await request.post('/api/shift', {
    data: {
      company_id: seeded.companyId,
      department_id: departmentId,
      shift_date: '2026-07-15',
      start_time: '09:00',
      end_time: '17:00',
      created_by: seeded.ownerId,
    },
  })
  expect(createRes.status()).toBe(201)
  const draftShift = (await createRes.json()).shift
  expect(draftShift.publication_status).toBe('draft')

  const employeeRes = await request.get(
    `/api/shift?company_id=${seeded.companyId}&date_from=2026-07-15&date_to=2026-07-15&viewer_role=Employee`,
  )
  const employeeBody = await employeeRes.json()
  const employeeSeesDraft = employeeBody.rows.some((row: { shifts: { id: string }[] }) =>
    row.shifts.some((s) => s.id === draftShift.id),
  )
  expect(employeeSeesDraft).toBe(false)

  const managerRes = await request.get(
    `/api/shift?company_id=${seeded.companyId}&date_from=2026-07-15&date_to=2026-07-15&viewer_role=Manager&viewer_user_id=${managerId}`,
  )
  const managerBody = await managerRes.json()
  const managerSeesDraft = managerBody.rows.some((row: { shifts: { id: string }[] }) =>
    row.shifts.some((s) => s.id === draftShift.id),
  )
  expect(managerSeesDraft).toBe(false)

  const ownerRes = await request.get(
    `/api/shift?company_id=${seeded.companyId}&date_from=2026-07-15&date_to=2026-07-15&viewer_role=Owner`,
  )
  const ownerBody = await ownerRes.json()
  const ownerSeesDraft = ownerBody.rows.some((row: { shifts: { id: string }[] }) =>
    row.shifts.some((s) => s.id === draftShift.id),
  )
  expect(ownerSeesDraft).toBe(true)
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

test('UC9 editing one block of a split shift does not flag a clopening conflict against its own other block', async ({ request }) => {
  const splitRes = await request.post('/api/shift/split', {
    data: {
      company_id: seeded.companyId,
      department_id: departmentId,
      shift_date: '2026-09-23',
      blocks: [
        { start_time: '09:00', end_time: '14:00' },
        { start_time: '17:00', end_time: '20:00' },
      ],
      created_by: seeded.ownerId,
      assigned_user_id: employeeId,
    },
  })
  expect(splitRes.status()).toBe(201)
  const [firstBlock] = (await splitRes.json()).shifts

  const editRes = await request.patch(`/api/shift/${firstBlock.id}`, {
    data: {
      start_time: '10:00',
      end_time: '14:00',
      assigned_user_id: employeeId,
      assigned_by: seeded.ownerId,
    },
  })
  expect(editRes.status()).toBe(200)
  const editBody = await editRes.json()
  expect(editBody.success).toBe(true)
  expect(editBody.warning).toBeNull()
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

test('UC9 repeats a split shift weekly, creating a matching two-block pair per occurrence', async ({ request }) => {
  const splitRes = await request.post('/api/shift/split', {
    data: {
      company_id: seeded.companyId,
      department_id: departmentId,
      shift_date: '2026-09-02',
      blocks: [
        { start_time: '09:00', end_time: '12:00' },
        { start_time: '14:00', end_time: '18:00' },
      ],
      created_by: seeded.ownerId,
      assigned_user_id: employeeId,
    },
  })
  expect(splitRes.status()).toBe(201)
  const splitBody = await splitRes.json()
  const splitGroupId = splitBody.shifts[0].split_group_id

  const recRes = await request.post(`/api/shift/split/${splitGroupId}/recurrence`, {
    data: {
      recurrence_rule: 'weekly',
      recurrence_end_date: '2026-09-16',
      created_by: seeded.ownerId,
    },
  })
  expect(recRes.status()).toBe(201)
  const recBody = await recRes.json()
  expect(recBody.success).toBe(true)
  // 2 weekly occurrences (09-09, 09-16) x 2 blocks each
  expect(recBody.shifts).toHaveLength(4)
  const groupedBySplitGroup = new Map<string, { start_time: string; end_time: string }[]>()
  for (const s of recBody.shifts as { split_group_id: string; start_time: string; end_time: string }[]) {
    groupedBySplitGroup.set(s.split_group_id, [...(groupedBySplitGroup.get(s.split_group_id) ?? []), s])
  }
  expect(groupedBySplitGroup.size).toBe(2)
  for (const pair of groupedBySplitGroup.values()) {
    expect(pair).toHaveLength(2)
    const times = pair.map(p => `${p.start_time}-${p.end_time}`).sort()
    expect(times).toEqual(['09:00:00-12:00:00', '14:00:00-18:00:00'])
  }

  // Deleting either original block cascades and deletes all recurring occurrences of that block.
  await request.delete(`/api/shift/${splitBody.shifts[0].id}`)
  await request.delete(`/api/shift/${splitBody.shifts[1].id}`)
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

test('UC11 redoes an undone create action by recreating the shift', async ({ request }) => {
  const createRes = await request.post('/api/shift', {
    data: {
      company_id: seeded.companyId,
      department_id: departmentId,
      shift_date: '2026-07-27',
      start_time: '09:00',
      end_time: '17:00',
      created_by: seeded.ownerId,
    },
  })
  const createBody = await createRes.json()
  const redoableShiftId = createBody.shift.id

  const undoRes = await request.post('/api/shift/undo', {
    data: { company_id: seeded.companyId, performed_by: seeded.ownerId },
  })
  expect(undoRes.status()).toBe(200)

  const redoRes = await request.post('/api/shift/redo', {
    data: { company_id: seeded.companyId, performed_by: seeded.ownerId },
  })
  expect(redoRes.status()).toBe(200)
  const redoBody = await redoRes.json()
  expect(redoBody.success).toBe(true)
  expect(redoBody.action_type).toBe('create')

  const list = await (
    await request.get(`/api/shift?company_id=${seeded.companyId}&date_from=2026-07-27&date_to=2026-07-27`)
  ).json()
  const recreated = list.rows.some((row: { shifts: { id: string }[] }) =>
    row.shifts.some((s) => s.id === redoableShiftId),
  )
  expect(recreated).toBe(true)

  // clean up the recreated shift so it doesn't leak into afterAll's bulk cleanup ordering
  await request.delete(`/api/shift/${redoableShiftId}`)
})

test('UC11 rejects redo when there is no recently undone action for that user', async ({ request }) => {
  const res = await request.post('/api/shift/redo', {
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

test('Shift Template — creating a shift from a template persists template_id, and editing without changing time keeps it', async ({ request }) => {
  const templateRes = await request.post('/api/shift-template', {
    data: {
      company_id: seeded.companyId,
      name: 'Morning Shift',
      start_time: '09:00',
      end_time: '17:00',
      created_by: seeded.ownerId,
    },
  })
  const templateBody = await templateRes.json()
  const templateId = templateBody.template.id

  const createRes = await request.post('/api/shift', {
    data: {
      company_id: seeded.companyId,
      department_id: departmentId,
      shift_date: '2026-08-01',
      start_time: '09:00',
      end_time: '17:00',
      created_by: seeded.ownerId,
      template_id: templateId,
    },
  })
  const createBody = await createRes.json()
  expect(createBody.shift.template_id).toBe(templateId)
  const newShiftId = createBody.shift.id

  const fetchRes = await request.get(`/api/shift?company_id=${seeded.companyId}&date_from=2026-08-01&date_to=2026-08-01`)
  const fetchBody = await fetchRes.json()
  const found = fetchBody.rows.flatMap((row: { shifts: { id: string; template_id: string | null }[] }) => row.shifts).find((s: { id: string }) => s.id === newShiftId)
  expect(found.template_id).toBe(templateId)

  const editRes = await request.patch(`/api/shift/${newShiftId}`, {
    data: { title: 'Same template, no time change' },
  })
  expect(editRes.status()).toBe(200)

  const refetchRes = await request.get(`/api/shift?company_id=${seeded.companyId}&date_from=2026-08-01&date_to=2026-08-01`)
  const refetchBody = await refetchRes.json()
  const stillFound = refetchBody.rows.flatMap((row: { shifts: { id: string; template_id: string | null }[] }) => row.shifts).find((s: { id: string }) => s.id === newShiftId)
  expect(stillFound.template_id).toBe(templateId)

  await request.delete(`/api/shift/${newShiftId}`)
  await request.delete(`/api/shift-template/${templateId}`)
})

test('Shift Template — bulk-assigning from the Assign Shift modal persists template_id per shift', async ({ request }) => {
  const templateRes = await request.post('/api/shift-template', {
    data: {
      company_id: seeded.companyId,
      name: 'Afternoon Shift',
      start_time: '13:00',
      end_time: '21:00',
      created_by: seeded.ownerId,
    },
  })
  const templateId = (await templateRes.json()).template.id

  const bulkRes = await request.post('/api/shift/bulk', {
    data: {
      company_id: seeded.companyId,
      department_id: departmentId,
      created_by: seeded.ownerId,
      assignments: [
        { user_id: employeeId, shift_date: '2026-08-05', start_time: '13:00', end_time: '21:00', template_id: templateId },
      ],
    },
  })
  const bulkBody = await bulkRes.json()
  expect(bulkBody.result.created).toHaveLength(1)
  expect(bulkBody.result.created[0].template_id).toBe(templateId)

  await request.delete(`/api/shift/${bulkBody.result.created[0].id}`)
  await request.delete(`/api/shift-template/${templateId}`)
})

test('Shift Template — duplicating a shift can carry over or override the template', async ({ request }) => {
  const templateRes = await request.post('/api/shift-template', {
    data: {
      company_id: seeded.companyId,
      name: 'Evening Shift',
      start_time: '17:00',
      end_time: '23:00',
      created_by: seeded.ownerId,
    },
  })
  const templateId = (await templateRes.json()).template.id

  const originalRes = await request.post('/api/shift', {
    data: {
      company_id: seeded.companyId,
      department_id: departmentId,
      shift_date: '2026-08-10',
      start_time: '17:00',
      end_time: '23:00',
      created_by: seeded.ownerId,
      template_id: templateId,
    },
  })
  const originalId = (await originalRes.json()).shift.id

  const dupWithTemplateRes = await request.post(`/api/shift/${originalId}/duplicate`, {
    data: {
      shift_date: '2026-08-11',
      start_time: '17:00',
      end_time: '23:00',
      created_by: seeded.ownerId,
      assigned_user_id: employeeId,
      template_id: templateId,
    },
  })
  const dupWithTemplateBody = await dupWithTemplateRes.json()
  expect(dupWithTemplateBody.shift.template_id).toBe(templateId)

  const dupCustomRes = await request.post(`/api/shift/${originalId}/duplicate`, {
    data: {
      shift_date: '2026-08-12',
      start_time: '18:00',
      end_time: '22:00',
      created_by: seeded.ownerId,
      assigned_user_id: employeeId,
    },
  })
  const dupCustomBody = await dupCustomRes.json()
  expect(dupCustomBody.shift.template_id).toBeNull()

  await request.delete(`/api/shift/${originalId}`)
  await request.delete(`/api/shift/${dupWithTemplateBody.shift.id}`)
  await request.delete(`/api/shift/${dupCustomBody.shift.id}`)
  await request.delete(`/api/shift-template/${templateId}`)
})
