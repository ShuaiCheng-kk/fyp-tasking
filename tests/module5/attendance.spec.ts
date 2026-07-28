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
let historyAssignmentId: string
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
  await admin.from('shift_swap_requests').delete().eq('company_id', seeded.companyId)

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

test('UC49 resource=history lists completed and still-working records with supervisor details', async ({ request }) => {
  // A second shift the worker has clocked in to but not out of — must surface as "working".
  const { data: liveShift, error: liveShiftError } = await admin
    .from('shifts')
    .insert({
      company_id: seeded.companyId,
      department_id: departmentId,
      shift_date: '2030-02-02',
      start_time: '09:00',
      end_time: '17:00',
      title: 'Module 5 Live Shift',
      created_by: seeded.ownerId,
      publication_status: 'published',
    })
    .select('id')
    .single()
  if (liveShiftError || !liveShift) throw new Error(`Failed to create live shift: ${liveShiftError?.message}`)

  const { data: liveAssignment, error: liveAssignmentError } = await admin
    .from('shift_assignments')
    .insert({
      shift_id: liveShift.id,
      user_id: worker.userId,
      assigned_by: seeded.ownerId,
      supervisor_employee_id: seeded.ownerId,
    })
    .select('id')
    .single()
  if (liveAssignmentError || !liveAssignment) throw new Error(`Failed to create live assignment: ${liveAssignmentError?.message}`)
  historyAssignmentId = liveAssignment.id as string

  const { error: recordError } = await admin.from('attendance_records').insert({
    shift_assignment_id: historyAssignmentId,
    casual_worker_id: worker.userId,
    clock_in_time: '2030-02-02T09:01:00.000Z',
    confirmed_by_employee_id: worker.userId,
    submitted_by_employee_id: worker.userId,
    status: 'clocked_in',
    owner_status: 'pending',
  })
  if (recordError) throw new Error(`Failed to create attendance record: ${recordError.message}`)

  const res = await request.get(`/api/casual/attendance?resource=history&user_id=${worker.authUserId}`)
  expect(res.status()).toBe(200)
  const body = await res.json()
  expect(body.success).toBe(true)

  // Clock-in at 09:04 falls inside the 10-minute grace period, so it was stored as 09:00.
  const completed = body.history.find((entry: { id: string }) => entry.id === assignmentId)
  expect(completed).toMatchObject({ status: 'completed', hours: 8.03 })
  expect(new Date(completed.clock_in_time).toISOString()).toBe('2030-02-01T09:00:00.000Z')
  expect(new Date(completed.clock_out_time).toISOString()).toBe('2030-02-01T17:02:00.000Z')

  const working = body.history.find((entry: { id: string }) => entry.id === historyAssignmentId)
  expect(working).toMatchObject({
    status: 'working',
    clock_out_time: null,
    hours: null,
    pay: null,
    supervisor_name: 'Test Owner module5',
  })

  // Most recent date first — the working 02-02 shift sits above the completed 02-01 one.
  expect(body.history.map((entry: { id: string }) => entry.id).indexOf(historyAssignmentId))
    .toBeLessThan(body.history.map((entry: { id: string }) => entry.id).indexOf(assignmentId))

  // Leave no trace for later tests in this file.
  await admin.from('attendance_records').delete().eq('shift_assignment_id', historyAssignmentId)
  await admin.from('shift_assignments').delete().eq('id', historyAssignmentId)
  await admin.from('shifts').delete().eq('id', liveShift.id)
})

test('UC49 casual worker break_in/break_out, then UC56 owner modifies the break times', async ({ request }) => {
  const { data: breakShift, error: breakShiftError } = await admin
    .from('shifts')
    .insert({
      company_id: seeded.companyId,
      department_id: departmentId,
      shift_date: '2030-02-03',
      start_time: '09:00',
      end_time: '17:00',
      title: 'Module 5 Break Shift',
      created_by: seeded.ownerId,
      publication_status: 'published',
    })
    .select('id')
    .single()
  if (breakShiftError || !breakShift) throw new Error(`Failed to create break shift: ${breakShiftError?.message}`)

  const { data: breakAssignment, error: breakAssignmentError } = await admin
    .from('shift_assignments')
    .insert({ shift_id: breakShift.id, user_id: worker.userId, assigned_by: seeded.ownerId })
    .select('id')
    .single()
  if (breakAssignmentError || !breakAssignment) throw new Error(`Failed to create break assignment: ${breakAssignmentError?.message}`)
  const breakAssignmentId = breakAssignment.id as string

  // Break In before clocking in is rejected.
  const tooEarly = await request.post('/api/casual/attendance', {
    data: { action: 'break_in', user_id: worker.authUserId, shift_assignment_id: breakAssignmentId },
  })
  expect(tooEarly.status()).toBe(400)

  const clockIn = await request.post('/api/casual/attendance', {
    data: { action: 'clock_in', user_id: worker.authUserId, shift_assignment_id: breakAssignmentId, clock_time: '2030-02-03T09:00:00.000Z' },
  })
  expect(clockIn.status()).toBe(201)

  const breakIn = await request.post('/api/casual/attendance', {
    data: { action: 'break_in', user_id: worker.authUserId, shift_assignment_id: breakAssignmentId, clock_time: '2030-02-03T12:00:00.000Z' },
  })
  expect(breakIn.status()).toBe(200)
  const breakInBody = await breakIn.json()
  expect(new Date(breakInBody.record.break_in_time).toISOString()).toBe('2030-02-03T12:00:00.000Z')

  // A second Break In while already on a break is rejected.
  const doubleBreak = await request.post('/api/casual/attendance', {
    data: { action: 'break_in', user_id: worker.authUserId, shift_assignment_id: breakAssignmentId },
  })
  expect(doubleBreak.status()).toBe(400)

  const breakOut = await request.post('/api/casual/attendance', {
    data: { action: 'break_out', user_id: worker.authUserId, shift_assignment_id: breakAssignmentId, clock_time: '2030-02-03T12:30:00.000Z' },
  })
  expect(breakOut.status()).toBe(200)
  const breakOutBody = await breakOut.json()
  expect(new Date(breakOutBody.record.break_out_time).toISOString()).toBe('2030-02-03T12:30:00.000Z')

  const clockOut = await request.post('/api/casual/attendance', {
    data: { action: 'clock_out', user_id: worker.authUserId, shift_assignment_id: breakAssignmentId, clock_time: '2030-02-03T17:00:00.000Z' },
  })
  expect(clockOut.status()).toBe(200)

  // History hours subtract the 30-minute break: 8h span − 0.5h = 7.5h.
  const history = await request.get(`/api/casual/attendance?resource=history&user_id=${worker.authUserId}`)
  expect(history.status()).toBe(200)
  const historyBody = await history.json()
  const entry = historyBody.history.find((row: { id: string }) => row.id === breakAssignmentId)
  expect(entry.hours).toBe(7.5)
  expect(new Date(entry.break_in_time).toISOString()).toBe('2030-02-03T12:00:00.000Z')

  // UC56: the Owner adjusts the break pair directly through final_review (decision: modified).
  const ownerModify = await request.patch('/api/attendance', {
    data: {
      action: 'final_review',
      id: breakOutBody.record.id,
      owner_id: seeded.ownerId,
      decision: 'modified',
      break_in_time: '2030-02-03T12:15:00.000Z',
      break_out_time: '2030-02-03T13:00:00.000Z',
    },
  })
  expect(ownerModify.status()).toBe(200)
  const ownerModifyBody = await ownerModify.json()
  expect(ownerModifyBody.record.status).toBe('owner_modified')
  expect(new Date(ownerModifyBody.record.break_in_time).toISOString()).toBe('2030-02-03T12:15:00.000Z')
  expect(new Date(ownerModifyBody.record.break_out_time).toISOString()).toBe('2030-02-03T13:00:00.000Z')
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


