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

test('UC62 and UC64 clock in, clock out, and view attendance status', async ({ request }) => {
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

test('UC63 reviews attendance through manager and owner decisions', async ({ request }) => {
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

test('UC65, UC66, UC71, and UC72 submit availability and leave requests', async ({ request }) => {
  const fixed = await request.post('/api/user/fixed-off-days', {
    data: {
      user_id: worker.userId,
      company_id: seeded.companyId,
      weekdays: [0, 6, 6],
    },
  })
  expect(fixed.status()).toBe(200)
  expect(await fixed.json()).toMatchObject({ success: true })

  const fixedRead = await request.get(`/api/user/fixed-off-days?user_id=${worker.userId}`)
  expect(fixedRead.status()).toBe(200)
  const fixedReadBody = await fixedRead.json()
  expect(fixedReadBody.days.map((day: { weekday: number }) => day.weekday).sort()).toEqual([0, 6])

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

  const requests = await request.get(`/api/user/leave-requests?user_id=${worker.userId}`)
  expect(requests.status()).toBe(200)
  const requestsBody = await requests.json()
  expect(requestsBody.requests).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ request_type: 'time_off' }),
      expect.objectContaining({ request_type: 'break_waiver' }),
    ]),
  )
})

test('UC67 and UC68 submit and approve a shift swap request', async ({ request }) => {
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

test('UC69 and UC70 review timesheets with auto-approval settings', async ({ request }) => {
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
