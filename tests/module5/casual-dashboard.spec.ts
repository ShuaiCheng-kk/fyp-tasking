import { test, expect } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'
import { seedTestOwnerAndCompany, cleanupTestOwnerAndCompany, TestOwner } from '../helpers/seed'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

type SeededUser = { authUserId: string; userId: string; email: string }

let seeded: TestOwner
let departmentId: string
let supervisor: SeededUser
let otherEmployee: SeededUser
let worker: SeededUser

let assignmentEarlyId: string
let assignmentLateId: string
let oneOffAssignmentId: string
let oneOffRecordId: string

const shiftIds: string[] = []

test.describe.configure({ mode: 'serial' })

async function createUser(role: 'Employee' | 'Casual Worker', label: string): Promise<SeededUser> {
  const email = `test-m5-dash-${label}-${Date.now()}@tasking-tests.local`
  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email, password: 'Test-Password-123!', email_confirm: true,
  })
  if (authError || !authData.user) throw new Error(`Failed to create auth user: ${authError?.message}`)

  const { data: user, error: userError } = await admin
    .from('users')
    .insert({
      supabase_auth_id: authData.user.id,
      full_name: `Module5 Dashboard ${label}`,
      email_address: email,
      phone_number: null,
      role,
      company_id: seeded.companyId,
      worker_status: 'active',
    })
    .select()
    .single()
  if (userError || !user) throw new Error(`Failed to create user row: ${userError?.message}`)

  return { authUserId: authData.user.id, userId: user.id as string, email }
}

async function createShiftAssignment(input: {
  shiftDate: string
  startTime: string
  endTime: string
  isOpenEnded?: boolean
  supervisorEmployeeId?: string | null
}) {
  const { data: shift, error: shiftError } = await admin
    .from('shifts')
    .insert({
      company_id: seeded.companyId,
      department_id: departmentId,
      shift_date: input.shiftDate,
      start_time: input.startTime,
      end_time: input.endTime,
      title: 'Module 5 Dashboard Shift',
      created_by: seeded.ownerId,
      publication_status: 'published',
      is_open_ended: input.isOpenEnded ?? false,
    })
    .select('id')
    .single()
  if (shiftError || !shift) throw new Error(`Failed to create shift: ${shiftError?.message}`)
  shiftIds.push(shift.id as string)

  const { data: assignment, error: assignmentError } = await admin
    .from('shift_assignments')
    .insert({
      shift_id: shift.id,
      user_id: worker.userId,
      assigned_by: seeded.ownerId,
      supervisor_employee_id: input.supervisorEmployeeId ?? null,
    })
    .select('id')
    .single()
  if (assignmentError || !assignment) throw new Error(`Failed to create assignment: ${assignmentError?.message}`)
  return assignment.id as string
}

test.beforeAll(async () => {
  seeded = await seedTestOwnerAndCompany('module5-dash')

  const { data: department, error: deptError } = await admin
    .from('departments')
    .insert({ company_id: seeded.companyId, name: 'Dashboard Dept' })
    .select('id')
    .single()
  if (deptError || !department) throw new Error(`Failed to create department: ${deptError?.message}`)
  departmentId = department.id as string

  supervisor = await createUser('Employee', 'supervisor')
  otherEmployee = await createUser('Employee', 'other')
  worker = await createUser('Casual Worker', 'worker')

  await admin.from('employee_departments').insert({ employee_id: supervisor.userId, department_id: departmentId })
  await admin.from('users').update({ hourly_rate: 15 }).eq('id', worker.userId)

  // Two fixed shifts, earliest first — the dashboard's current-job resolution should surface the
  // earlier one until it's clocked out of, then fall through to the later one.
  assignmentEarlyId = await createShiftAssignment({
    shiftDate: '2030-05-01', startTime: '09:00', endTime: '17:00', supervisorEmployeeId: supervisor.userId,
  })
  assignmentLateId = await createShiftAssignment({
    shiftDate: '2030-05-02', startTime: '09:00', endTime: '17:00', supervisorEmployeeId: supervisor.userId,
  })
})

test.afterAll(async () => {
  await admin.from('messages').delete().eq('company_id', seeded.companyId)
  await admin.from('attendance_records').delete().in('shift_assignment_id', [assignmentEarlyId, assignmentLateId, oneOffAssignmentId].filter(Boolean))
  if (shiftIds.length > 0) {
    await admin.from('shift_assignments').delete().in('shift_id', shiftIds)
    await admin.from('shifts').delete().in('id', shiftIds)
  }
  await admin.from('employee_departments').delete().eq('department_id', departmentId)
  for (const member of [supervisor, otherEmployee, worker]) {
    await admin.from('users').delete().eq('id', member.userId)
    await admin.auth.admin.deleteUser(member.authUserId).catch(() => undefined)
  }
  await cleanupTestOwnerAndCompany(seeded)
})

test('dashboard surfaces the earliest not-yet-clocked-out assignment as the current job', async ({ request }) => {
  const res = await request.get(`/api/casual/dashboard?user_id=${worker.authUserId}`)
  expect(res.status()).toBe(200)
  const body = await res.json()
  expect(body.success).toBe(true)
  expect(body.dashboard.current_job).toMatchObject({
    assignment_id: assignmentEarlyId,
    shift_date: '2030-05-01',
    supervisor: expect.objectContaining({ id: supervisor.userId }),
  })
  // The timeline covers the next 7 days plus the current job itself — both seeded shifts are far
  // beyond the window, so only the current one appears on it.
  expect(body.dashboard.upcoming_jobs.map((j: { assignment_id: string }) => j.assignment_id)).toEqual([assignmentEarlyId])
})

test('clocking out of the current job switches the dashboard to the next chronological job', async ({ request }) => {
  const clockIn = await request.post('/api/casual/attendance', {
    data: {
      action: 'clock_in', user_id: worker.authUserId, shift_assignment_id: assignmentEarlyId,
      clock_time: '2030-05-01T09:00:00.000Z',
    },
  })
  expect(clockIn.status()).toBe(201)

  const clockOut = await request.post('/api/casual/attendance', {
    data: {
      action: 'clock_out', user_id: worker.authUserId, shift_assignment_id: assignmentEarlyId,
      clock_time: '2030-05-01T17:00:00.000Z',
    },
  })
  expect(clockOut.status()).toBe(200)

  const res = await request.get(`/api/casual/dashboard?user_id=${worker.authUserId}`)
  const body = await res.json()
  expect(body.dashboard.current_job.assignment_id).toBe(assignmentLateId)
  // The clocked-out early job is outside the 7-day window, so the timeline moves on with it.
  expect(body.dashboard.upcoming_jobs.map((j: { assignment_id: string }) => j.assignment_id)).toEqual([assignmentLateId])
})

test('attendance history reports the completed job with hours and hourly-rate pay, no approval-chain fields', async ({ request }) => {
  const res = await request.get(`/api/casual/attendance?resource=history&user_id=${worker.authUserId}`)
  expect(res.status()).toBe(200)
  const body = await res.json()
  expect(body.success).toBe(true)
  const entry = body.history.find((h: { id: string }) => h.id === assignmentEarlyId)
  // status here is the worker-facing working/completed flag, not the employer approval chain —
  // approval-chain fields (owner_status etc.) must never leak to the worker.
  expect(entry).toMatchObject({ hours: 8, pay: 120, status: 'completed' })
  expect(entry.owner_status).toBeUndefined()
})

test('one-off job: clock-out is blocked until the supervising Employee releases it, and only that Employee may release it', async ({ request }) => {
  oneOffAssignmentId = await createShiftAssignment({
    shiftDate: '2030-05-05', startTime: '10:00', endTime: '11:00', isOpenEnded: true, supervisorEmployeeId: supervisor.userId,
  })

  const clockIn = await request.post('/api/casual/attendance', {
    data: {
      action: 'clock_in', user_id: worker.authUserId, shift_assignment_id: oneOffAssignmentId,
      clock_time: '2030-05-05T10:00:00.000Z',
    },
  })
  expect(clockIn.status()).toBe(201)
  oneOffRecordId = (await clockIn.json()).record.id

  const blockedClockOut = await request.post('/api/casual/attendance', {
    data: {
      action: 'clock_out', user_id: worker.authUserId, shift_assignment_id: oneOffAssignmentId,
      clock_time: '2030-05-05T10:05:00.000Z',
    },
  })
  expect(blockedClockOut.status()).toBe(400)
  expect((await blockedClockOut.json()).message).toContain('Waiting for your supervisor')

  // The queue should list it for the supervisor...
  const queue = await request.get(`/api/employee/attendance?user_id=${supervisor.authUserId}&resource=clockout_release_queue`)
  expect(queue.status()).toBe(200)
  const queueBody = await queue.json()
  expect(queueBody.queue).toEqual(
    expect.arrayContaining([expect.objectContaining({ id: oneOffRecordId, worker_name: expect.any(String) })]),
  )

  // ...but not for an unrelated Employee, and that Employee cannot release it either.
  const otherQueue = await request.get(`/api/employee/attendance?user_id=${otherEmployee.authUserId}&resource=clockout_release_queue`)
  expect((await otherQueue.json()).queue).toEqual([])

  const unauthorizedRelease = await request.post('/api/employee/attendance', {
    data: { action: 'release_clockout', user_id: otherEmployee.authUserId, attendance_record_id: oneOffRecordId },
  })
  expect(unauthorizedRelease.status()).toBe(400)
  expect((await unauthorizedRelease.json()).message).toContain('not the supervisor')

  const release = await request.post('/api/employee/attendance', {
    data: { action: 'release_clockout', user_id: supervisor.authUserId, attendance_record_id: oneOffRecordId },
  })
  expect(release.status()).toBe(200)
  expect((await release.json()).record.clock_out_released_at).toBeTruthy()

  const clockOut = await request.post('/api/casual/attendance', {
    data: {
      action: 'clock_out', user_id: worker.authUserId, shift_assignment_id: oneOffAssignmentId,
      clock_time: '2030-05-05T10:10:00.000Z',
    },
  })
  expect(clockOut.status()).toBe(200)
})

test('messaging is a work action: blocked before the Clock In window, wrong recipient rejected, open once the window starts', async ({ request }) => {
  // At this point the current job is the far-future 2030-05-02 assignment — its Clock In window
  // is closed, so sending must be rejected.
  const blockedEarly = await request.post('/api/casual/messages', {
    data: { user_id: worker.authUserId, other_user_id: supervisor.userId, company_id: seeded.companyId, content: 'Too early' },
  })
  expect(blockedEarly.status()).toBe(400)
  expect((await blockedEarly.json()).message).toContain('30 minutes before your job starts')

  // A shift that started 5 minutes ago becomes the current job (earlier than 2030-05-02) with an
  // open window. Times are UTC-nominal like the app's own clock-in parsing; as with the other
  // attendance specs this can misbehave when local-date and UTC-date disagree (00:00–08:00 SGT).
  const startedJustNow = new Date(Date.now() - 5 * 60000)
  const windowAssignmentId = await createShiftAssignment({
    shiftDate: startedJustNow.toISOString().slice(0, 10),
    startTime: startedJustNow.toISOString().slice(11, 19),
    endTime: new Date(startedJustNow.getTime() + 8 * 3600000).toISOString().slice(11, 19),
    supervisorEmployeeId: supervisor.userId,
  })
  const dash = await request.get(`/api/casual/dashboard?user_id=${worker.authUserId}`)
  expect((await dash.json()).dashboard.current_job.assignment_id).toBe(windowAssignmentId)

  // Only the current job's supervisor is a valid recipient.
  const blockedRecipient = await request.post('/api/casual/messages', {
    data: { user_id: worker.authUserId, other_user_id: otherEmployee.userId, company_id: seeded.companyId, content: 'Wrong person' },
  })
  expect(blockedRecipient.status()).toBe(400)
  expect((await blockedRecipient.json()).message).toContain('supervisor of your current job')

  const send = await request.post('/api/casual/messages', {
    data: { user_id: worker.authUserId, other_user_id: supervisor.userId, company_id: seeded.companyId, content: 'On my way!' },
  })
  expect(send.status()).toBe(201)

  const thread = await request.get(`/api/casual/messages?user_id=${worker.authUserId}&other_user_id=${supervisor.userId}`)
  expect(thread.status()).toBe(200)
  const threadBody = await thread.json()
  expect(threadBody.messages).toEqual(
    expect.arrayContaining([expect.objectContaining({ content: 'On my way!', from_user_id: worker.userId })]),
  )

  // The supervising Employee's contact list must include this Casual Worker so they can reply.
  const contacts = await request.get(`/api/employee/contacts?user_id=${supervisor.authUserId}`)
  expect(contacts.status()).toBe(200)
  const contactsBody = await contacts.json()
  expect(contactsBody.contacts).toEqual(
    expect.arrayContaining([expect.objectContaining({ id: worker.userId, role: 'Casual Worker' })]),
  )
})
