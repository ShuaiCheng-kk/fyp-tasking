import { test, expect } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'
import { seedTestOwnerAndCompany, cleanupTestOwnerAndCompany, TestOwner } from '../helpers/seed'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

type SeededWorker = {
  authUserId: string
  userId: string
  email: string
}

let seeded: TestOwner
let departmentId: string
let assignmentId: string
let worker: SeededWorker
let replacement: SeededWorker

test.describe.configure({ mode: 'serial' })

async function createCasualWorker(label: string): Promise<SeededWorker> {
  const email = `test-module5-${label}-${Date.now()}@tasking-tests.local`
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
      full_name: `Module 5 Casual ${label}`,
      email_address: email,
      phone_number: null,
      role: 'Casual Worker',
      company_id: seeded.companyId,
      worker_status: 'active',
    })
    .select()
    .single()
  if (userError || !user) throw new Error(`Failed to create user row: ${userError?.message}`)

  return { authUserId: authData.user.id, userId: user.id as string, email }
}

test.beforeAll(async () => {
  seeded = await seedTestOwnerAndCompany('module5')

  const { data: department, error: deptError } = await admin
    .from('departments')
    .insert({ company_id: seeded.companyId, name: 'Events' })
    .select('id')
    .single()
  if (deptError || !department) throw new Error(`Failed to create department: ${deptError?.message}`)
  departmentId = department.id as string

  worker = await createCasualWorker('primary')
  replacement = await createCasualWorker('replacement')

  const { data: shift, error: shiftError } = await admin
    .from('shifts')
    .insert({
      company_id: seeded.companyId,
      department_id: departmentId,
      shift_date: '2030-02-01',
      start_time: '09:00',
      end_time: '17:00',
      title: 'Module 5 Test Shift',
      created_by: seeded.ownerId,
      publication_status: 'published',
    })
    .select('id')
    .single()
  if (shiftError || !shift) throw new Error(`Failed to create shift: ${shiftError?.message}`)

  const { data: assignment, error: assignmentError } = await admin
    .from('shift_assignments')
    .insert({
      shift_id: shift.id,
      user_id: worker.userId,
      assigned_by: seeded.ownerId,
    })
    .select('id')
    .single()
  if (assignmentError || !assignment) throw new Error(`Failed to create assignment: ${assignmentError?.message}`)
  assignmentId = assignment.id as string
})

test.afterAll(async () => {
  await admin.from('attendance_records').delete().eq('shift_assignment_id', assignmentId)
  await admin.from('shift_swap_requests').delete().eq('company_id', seeded.companyId)
  await admin.from('time_off_requests').delete().eq('company_id', seeded.companyId)
  await admin.from('employee_fixed_off_days').delete().eq('company_id', seeded.companyId)

  const { data: shiftRows } = await admin.from('shifts').select('id').eq('company_id', seeded.companyId)
  const shiftIds = (shiftRows ?? []).map((shift) => shift.id as string)
  if (shiftIds.length > 0) {
    await admin.from('shift_assignments').delete().in('shift_id', shiftIds)
    await admin.from('shifts').delete().in('id', shiftIds)
  }

  for (const member of [worker, replacement]) {
    await admin.from('users').delete().eq('id', member.userId)
    await admin.auth.admin.deleteUser(member.authUserId).catch(() => undefined)
  }

  await cleanupTestOwnerAndCompany(seeded)
})

test('UC49 clock in, clock out, and view own attendance overview', async ({ request }) => {
  const clockIn = await request.post('/api/casual/attendance', {
    data: {
      action: 'clock_in',
      user_id: worker.authUserId,
      shift_assignment_id: assignmentId,
      clock_time: '2030-02-01T09:04:00.000Z',
      notes: 'Arrived at venue desk.',
    },
  })
  expect(clockIn.status()).toBe(201)
  const clockInBody = await clockIn.json()
  expect(clockInBody).toMatchObject({ success: true, record: { status: 'clocked_in' } })

  const clockOut = await request.post('/api/casual/attendance', {
    data: {
      action: 'clock_out',
      user_id: worker.authUserId,
      shift_assignment_id: assignmentId,
      clock_time: '2030-02-01T17:02:00.000Z',
    },
  })
  expect(clockOut.status()).toBe(200)
  const clockOutBody = await clockOut.json()
  expect(clockOutBody).toMatchObject({ success: true, record: { status: 'submitted' } })
  expect(new Date(clockOutBody.record.clock_out_time).toISOString()).toBe('2030-02-01T17:02:00.000Z')

  const overview = await request.get(`/api/casual/attendance?user_id=${worker.authUserId}`)
  expect(overview.status()).toBe(200)
  const overviewBody = await overview.json()
  expect(overviewBody.success).toBe(true)
  expect(overviewBody.attendance.shifts).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        record: expect.objectContaining({ id: clockOutBody.record.id, status: 'submitted' }),
      }),
    ]),
  )
})

test('UC50 and UC51 view the attendance dashboard, then review a record through manager and owner decisions', async ({ request }) => {
  const dashboard = await request.get(`/api/attendance?company_id=${seeded.companyId}`)
  expect(dashboard.status()).toBe(200)
  const dashboardBody = await dashboard.json()
  const row = dashboardBody.dashboard.records.find((record: { assignment: { id: string } }) => record.assignment.id === assignmentId)
  expect(row.record.status).toBe('submitted')

  const managerReview = await request.patch('/api/attendance', {
    data: {
      action: 'manager_review',
      id: row.record.id,
      manager_id: seeded.ownerId,
      manager_notes: 'Looks correct.',
    },
  })
  expect(managerReview.status()).toBe(200)
  expect(await managerReview.json()).toMatchObject({ success: true, record: { status: 'manager_reviewed' } })

  const ownerReview = await request.patch('/api/attendance', {
    data: {
      action: 'final_review',
      id: row.record.id,
      owner_id: seeded.ownerId,
      decision: 'approved',
      owner_notes: 'Approved for payroll.',
    },
  })
  expect(ownerReview.status()).toBe(200)
  expect(await ownerReview.json()).toMatchObject({ success: true, record: { owner_status: 'approved', status: 'owner_approved' } })
})

test('UC50/UC51 resource=range scopes records to the given date window, for the Past Attendance Record calendar', async ({ request }) => {
  const inRange = await request.get(`/api/attendance?company_id=${seeded.companyId}&resource=range&from_date=2030-02-01&to_date=2030-02-28`)
  expect(inRange.status()).toBe(200)
  const inRangeBody = await inRange.json()
  expect(inRangeBody.success).toBe(true)
  const row = inRangeBody.records.find((record: { assignment: { id: string } }) => record.assignment.id === assignmentId)
  expect(row).toBeTruthy()
  expect(row.shift.shift_date).toBe('2030-02-01')

  const outOfRange = await request.get(`/api/attendance?company_id=${seeded.companyId}&resource=range&from_date=2031-01-01&to_date=2031-01-31`)
  expect(outOfRange.status()).toBe(200)
  const outOfRangeBody = await outOfRange.json()
  expect(outOfRangeBody.records.find((record: { assignment: { id: string } }) => record.assignment.id === assignmentId)).toBeUndefined()

  const missingParams = await request.get(`/api/attendance?company_id=${seeded.companyId}&resource=range`)
  expect(missingParams.status()).toBe(400)
})

test('UC57 submit leave requests, all landing as pending', async ({ request }) => {
  const timeOff = await request.post('/api/user/leave-requests', {
    data: {
      user_id: worker.userId,
      company_id: seeded.companyId,
      shift_assignment_id: assignmentId,
      request_type: 'time_off',
      reason: 'Family appointment.',
    },
  })
  expect(timeOff.status()).toBe(200)
  expect(await timeOff.json()).toMatchObject({ success: true, request: { request_type: 'time_off', status: 'pending' } })

  const breakWaiver = await request.post('/api/user/leave-requests', {
    data: {
      user_id: worker.userId,
      company_id: seeded.companyId,
      shift_assignment_id: assignmentId,
      request_type: 'break_waiver',
      reason: 'Short event shift.',
    },
  })
  expect(breakWaiver.status()).toBe(200)
  expect(await breakWaiver.json()).toMatchObject({ success: true, request: { request_type: 'break_waiver', status: 'pending' } })

  const leave = await request.post('/api/user/leave-requests', {
    data: {
      user_id: worker.userId,
      company_id: seeded.companyId,
      shift_assignment_id: assignmentId,
      request_type: 'leave',
      reason: 'Personal leave.',
    },
  })
  expect(leave.status()).toBe(200)
  expect(await leave.json()).toMatchObject({ success: true, request: { request_type: 'leave', status: 'pending' } })

  const requests = await request.get(`/api/user/leave-requests?user_id=${worker.userId}`)
  expect(requests.status()).toBe(200)
  const requestsBody = await requests.json()
  expect(requestsBody.requests).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ request_type: 'time_off' }),
      expect.objectContaining({ request_type: 'break_waiver' }),
      expect.objectContaining({ request_type: 'leave' }),
    ]),
  )
})

test('UC58 approves a leave request', async ({ request }) => {
  const list = await request.get(`/api/attendance?company_id=${seeded.companyId}&resource=time_off`)
  expect(list.status()).toBe(200)
  const listBody = await list.json()
  const pendingLeave = listBody.requests.find((r: { request_type: string; status: string }) => r.request_type === 'leave' && r.status === 'pending')
  expect(pendingLeave).toBeTruthy()

  const decide = await request.patch('/api/attendance', {
    data: {
      action: 'decide_time_off',
      id: pendingLeave.id,
      reviewer_id: seeded.ownerId,
      decision: 'approved',
    },
  })
  expect(decide.status()).toBe(200)
  expect(await decide.json()).toMatchObject({ success: true, request: { status: 'approved' } })
})

test('UC52 and UC53 submit and approve a shift swap request', async ({ request }) => {
  const submit = await request.post('/api/user/shift-swap-requests', {
    data: {
      company_id: seeded.companyId,
      shift_assignment_id: assignmentId,
      requester_id: worker.userId,
      replacement_user_id: replacement.userId,
      reason: 'Coverage arranged with replacement.',
    },
  })
  expect(submit.status()).toBe(201)
  const submitBody = await submit.json()
  expect(submitBody).toMatchObject({ success: true, request: { status: 'pending' } })

  const list = await request.get(`/api/attendance?company_id=${seeded.companyId}&resource=shift_swaps`)
  expect(list.status()).toBe(200)
  const listBody = await list.json()
  expect(listBody.requests).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ id: submitBody.request.id, requester_name: 'Module 5 Casual primary' }),
    ]),
  )

  const approve = await request.patch('/api/attendance', {
    data: {
      action: 'decide_shift_swap',
      id: submitBody.request.id,
      reviewer_id: seeded.ownerId,
      decision: 'approved',
    },
  })
  expect(approve.status()).toBe(200)
  expect(await approve.json()).toMatchObject({ success: true, request: { status: 'approved' } })

  const { data: assignment, error } = await admin
    .from('shift_assignments')
    .select('user_id')
    .eq('id', assignmentId)
    .single()
  expect(error).toBeNull()
  expect(assignment!.user_id).toBe(replacement.userId)
})

test('UC54 generates an AI timesheet auto-approval suggestion', async ({ request }) => {
  const res = await request.post('/api/ai/timesheets', {
    data: {
      company_id: seeded.companyId,
      apply: false,
      min_confidence: 95,
    },
  })
  expect(res.status()).toBe(200)
  expect(await res.json()).toEqual({ success: true, decisions: [] })

  const invalid = await request.post('/api/ai/timesheets', {
    data: {
      company_id: seeded.companyId,
      apply: true,
      owner_id: seeded.ownerId,
      min_confidence: 101,
    },
  })
  expect(invalid.status()).toBe(400)
  expect(await invalid.json()).toMatchObject({ success: false, message: 'min_confidence must be between 0 and 100' })
})

// ── Employee / Manager break + absence API tests (UC49 extension) ────────────

let employeeAssignmentId: string
let employeeAuthId: string

test('setup — create internal employee shift for break/absence tests', async () => {
  const empEmail = `test-module5-emp-${Date.now()}@tasking-tests.local`
  const { data: authData } = await admin.auth.admin.createUser({
    email: empEmail, password: 'Test-Password-123!', email_confirm: true,
  })
  employeeAuthId = authData!.user!.id

  const { data: empUser } = await admin.from('users').insert({
    supabase_auth_id: employeeAuthId,
    full_name: 'Module5 Employee',
    email_address: empEmail,
    phone_number: null,
    role: 'Employee',
    company_id: seeded.companyId,
    worker_status: 'active',
  }).select().single()

  const { data: empShift } = await admin.from('shifts').insert({
    company_id: seeded.companyId,
    department_id: departmentId,
    shift_date: '2030-03-01',
    start_time: '09:00',
    end_time: '17:00',
    title: 'Employee Break Test Shift',
    created_by: seeded.ownerId,
    publication_status: 'published',
  }).select('id').single()

  const { data: empAssignment } = await admin.from('shift_assignments').insert({
    shift_id: empShift!.id,
    user_id: empUser!.id as string,
    assigned_by: seeded.ownerId,
  }).select('id').single()
  employeeAssignmentId = empAssignment!.id as string
})

test('UC49 employee break_in and break_out via /api/employee/attendance', async ({ request }) => {
  // Clock in first
  const clockIn = await request.post('/api/employee/attendance', {
    data: { action: 'clock_in', user_id: employeeAuthId, shift_assignment_id: employeeAssignmentId, clock_time: '2030-03-01T09:05:00Z' },
  })
  expect(clockIn.status()).toBe(201)

  // Break in
  const breakIn = await request.post('/api/employee/attendance', {
    data: { action: 'break_in', user_id: employeeAuthId, shift_assignment_id: employeeAssignmentId },
  })
  expect(breakIn.status()).toBe(200)
  const breakInBody = await breakIn.json()
  expect(breakInBody.success).toBe(true)
  expect(breakInBody.record.break_in_time).toBeTruthy()

  // Break out
  const breakOut = await request.post('/api/employee/attendance', {
    data: { action: 'break_out', user_id: employeeAuthId, shift_assignment_id: employeeAssignmentId },
  })
  expect(breakOut.status()).toBe(200)
  const breakOutBody = await breakOut.json()
  expect(breakOutBody.success).toBe(true)
  expect(breakOutBody.record.break_out_time).toBeTruthy()
})

test('UC49 employee clock_in with late_reason stores reason on record', async ({ request }) => {
  // Create a new shift/assignment for late clock-in test
  const { data: lateShift } = await admin.from('shifts').insert({
    company_id: seeded.companyId,
    department_id: departmentId,
    shift_date: '2030-03-02',
    start_time: '09:00',
    end_time: '17:00',
    title: 'Late Clock-In Test',
    created_by: seeded.ownerId,
    publication_status: 'published',
  }).select('id').single()

  const lateEmpEmail = `test-m5-late-${Date.now()}@tasking-tests.local`
  const { data: lateAuth } = await admin.auth.admin.createUser({
    email: lateEmpEmail, password: 'Test-Password-123!', email_confirm: true,
  })
  const { data: lateUser } = await admin.from('users').insert({
    supabase_auth_id: lateAuth!.user!.id,
    full_name: 'Module5 Late Employee',
    email_address: lateEmpEmail,
    phone_number: null,
    role: 'Employee',
    company_id: seeded.companyId,
    worker_status: 'active',
  }).select().single()

  const { data: lateAssign } = await admin.from('shift_assignments').insert({
    shift_id: lateShift!.id,
    user_id: lateUser!.id as string,
    assigned_by: seeded.ownerId,
  }).select('id').single()

  const clockIn = await request.post('/api/employee/attendance', {
    data: {
      action: 'clock_in',
      user_id: lateAuth!.user!.id,
      shift_assignment_id: lateAssign!.id as string,
      clock_time: '2030-03-02T09:25:00Z',
      late_reason: 'Train delay',
    },
  })
  expect(clockIn.status()).toBe(201)
  const body = await clockIn.json()
  expect(body.success).toBe(true)
  expect(body.record.late_reason).toBe('Train delay')
})

test('UC49 employee record_absence stores absence_reason', async ({ request }) => {
  const absEmail = `test-m5-abs-${Date.now()}@tasking-tests.local`
  const { data: absAuth } = await admin.auth.admin.createUser({
    email: absEmail, password: 'Test-Password-123!', email_confirm: true,
  })
  const { data: absUser } = await admin.from('users').insert({
    supabase_auth_id: absAuth!.user!.id,
    full_name: 'Module5 Absent Employee',
    email_address: absEmail,
    phone_number: null,
    role: 'Employee',
    company_id: seeded.companyId,
    worker_status: 'active',
  }).select().single()

  const { data: absShift } = await admin.from('shifts').insert({
    company_id: seeded.companyId,
    department_id: departmentId,
    shift_date: '2030-03-03',
    start_time: '09:00',
    end_time: '17:00',
    title: 'Absence Test',
    created_by: seeded.ownerId,
    publication_status: 'published',
  }).select('id').single()

  const { data: absAssign } = await admin.from('shift_assignments').insert({
    shift_id: absShift!.id,
    user_id: absUser!.id as string,
    assigned_by: seeded.ownerId,
  }).select('id').single()

  const absence = await request.post('/api/employee/attendance', {
    data: {
      action: 'record_absence',
      user_id: absAuth!.user!.id,
      shift_assignment_id: absAssign!.id as string,
      absence_reason: 'Doctor appointment',
    },
  })
  expect(absence.status()).toBe(200)
  const body = await absence.json()
  expect(body.success).toBe(true)
  expect(body.record.absence_reason).toBe('Doctor appointment')
  expect(body.record.clock_in_time).toBeNull()
  expect(body.record.status).toBe('submitted')
})

test('UC54 ai_suggestions resource returns expected shape', async ({ request }) => {
  const res = await request.get(`/api/attendance?company_id=${seeded.companyId}&resource=ai_suggestions`)
  expect(res.status()).toBe(200)
  const body = await res.json()
  expect(body.success).toBe(true)
  expect(Array.isArray(body.suggestions)).toBe(true)
})

test('UC54 apply_ai_approvals action returns decisions array', async ({ request }) => {
  const res = await request.patch('/api/attendance', {
    data: {
      action: 'apply_ai_approvals',
      company_id: seeded.companyId,
      owner_id: seeded.ownerId,
      min_confidence: 95,
    },
  })
  expect(res.status()).toBe(200)
  const body = await res.json()
  expect(body.success).toBe(true)
  expect(Array.isArray(body.decisions)).toBe(true)
})
