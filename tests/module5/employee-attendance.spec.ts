import { test, expect } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'
import { seedTestOwnerAndCompany, cleanupTestOwnerAndCompany, TestOwner } from '../helpers/seed'

// Integration tests for UC49 Clock In / Clock Out, the Manager/Employee side (shared via
// employeeAttendanceService — see that file for why one service covers both roles). Casual
// Worker's clock in/out is covered separately in attendance.spec.ts.

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

test.describe.configure({ mode: 'serial' })

type SeededStaff = { authUserId: string; userId: string }

let seeded: TestOwner
let departmentId: string
let employee: SeededStaff
let manager: SeededStaff
let employeeAssignmentId: string
let managerAssignmentId: string
let openEndedAssignmentId: string

async function createStaff(label: string, role: 'Employee' | 'Manager'): Promise<SeededStaff> {
  const email = `test-module5-emp-${label}-${Date.now()}@tasking-tests.local`
  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email, password: 'Test-Password-123!', email_confirm: true,
  })
  if (authError || !authData.user) throw new Error(`Failed to create auth user: ${authError?.message}`)

  const { data: user, error: userError } = await admin
    .from('users')
    .insert({
      supabase_auth_id: authData.user.id,
      full_name: `Module 5 ${role} ${label}`,
      email_address: email,
      phone_number: null,
      role,
      company_id: seeded.companyId,
    })
    .select()
    .single()
  if (userError || !user) throw new Error(`Failed to create user row: ${userError?.message}`)
  return { authUserId: authData.user.id, userId: user.id as string }
}

async function createPublishedShiftAssignment(userId: string, opts: { start_time: string; end_time: string; is_open_ended?: boolean }) {
  const { data: shift, error: shiftError } = await admin
    .from('shifts')
    .insert({
      company_id: seeded.companyId,
      department_id: departmentId,
      shift_date: '2030-04-01',
      start_time: opts.start_time,
      end_time: opts.end_time,
      title: 'Module 5 Employee Test Shift',
      created_by: seeded.ownerId,
      publication_status: 'published',
      is_open_ended: opts.is_open_ended ?? false,
    })
    .select('id')
    .single()
  if (shiftError || !shift) throw new Error(`Failed to create shift: ${shiftError?.message}`)

  const { data: assignment, error: assignmentError } = await admin
    .from('shift_assignments')
    .insert({ shift_id: shift.id, user_id: userId, assigned_by: seeded.ownerId })
    .select('id')
    .single()
  if (assignmentError || !assignment) throw new Error(`Failed to create assignment: ${assignmentError?.message}`)
  return assignment.id as string
}

test.beforeAll(async () => {
  seeded = await seedTestOwnerAndCompany('module5-employee')

  const { data: department, error: deptError } = await admin
    .from('departments')
    .insert({ company_id: seeded.companyId, name: 'Operations' })
    .select('id')
    .single()
  if (deptError || !department) throw new Error(`Failed to create department: ${deptError?.message}`)
  departmentId = department.id as string

  employee = await createStaff('primary', 'Employee')
  manager = await createStaff('primary', 'Manager')

  employeeAssignmentId = await createPublishedShiftAssignment(employee.userId, { start_time: '09:00', end_time: '17:00' })
  managerAssignmentId = await createPublishedShiftAssignment(manager.userId, { start_time: '09:00', end_time: '17:00' })
  openEndedAssignmentId = await createPublishedShiftAssignment(employee.userId, { start_time: '14:00', end_time: '15:00', is_open_ended: true })
})

test.afterAll(async () => {
  for (const id of [employeeAssignmentId, managerAssignmentId, openEndedAssignmentId]) {
    await admin.from('attendance_records').delete().eq('shift_assignment_id', id)
  }
  const { data: shiftRows } = await admin.from('shifts').select('id').eq('company_id', seeded.companyId)
  const shiftIds = (shiftRows ?? []).map(row => row.id as string)
  if (shiftIds.length > 0) {
    await admin.from('shift_assignments').delete().in('shift_id', shiftIds)
    await admin.from('shifts').delete().in('id', shiftIds)
  }
  for (const staff of [employee, manager]) {
    await admin.from('users').delete().eq('id', staff.userId)
    await admin.auth.admin.deleteUser(staff.authUserId).catch(() => undefined)
  }
  await cleanupTestOwnerAndCompany(seeded)
})

test('UC49: rejects clocking in more than 30 minutes before the shift starts', async ({ request }) => {
  const res = await request.post('/api/employee/attendance', {
    data: {
      action: 'clock_in',
      user_id: employee.authUserId,
      shift_assignment_id: employeeAssignmentId,
      clock_time: '2030-04-01T08:00:00.000Z',
    },
  })
  expect(res.status()).toBe(400)
  const body = await res.json()
  expect(body.message).toContain('Too early to clock in')
})

test('UC49: Employee clocks in within the grace period and the time is rounded down to the scheduled start', async ({ request }) => {
  const res = await request.post('/api/employee/attendance', {
    data: {
      action: 'clock_in',
      user_id: employee.authUserId,
      shift_assignment_id: employeeAssignmentId,
      clock_time: '2030-04-01T09:07:00.000Z',
    },
  })
  expect(res.status()).toBe(201)
  const body = await res.json()
  expect(new Date(body.record.clock_in_time).toISOString()).toBe('2030-04-01T09:00:00.000Z')
})

test('UC49: Employee cannot clock out before the shift reaches its scheduled end time', async ({ request }) => {
  const res = await request.post('/api/employee/attendance', {
    data: {
      action: 'clock_out',
      user_id: employee.authUserId,
      shift_assignment_id: employeeAssignmentId,
      clock_time: '2030-04-01T16:00:00.000Z',
    },
  })
  expect(res.status()).toBe(400)
  const body = await res.json()
  expect(body.message).toContain('Too early to clock out')
})

test('UC49: Employee clocks out once the shift has reached its end time', async ({ request }) => {
  const res = await request.post('/api/employee/attendance', {
    data: {
      action: 'clock_out',
      user_id: employee.authUserId,
      shift_assignment_id: employeeAssignmentId,
      clock_time: '2030-04-01T17:00:00.000Z',
    },
  })
  expect(res.status()).toBe(200)
  const body = await res.json()
  expect(body.record.status).toBe('submitted')
})

test('UC49: Manager clocks in and out against their own shift the same way as Employee', async ({ request }) => {
  const clockIn = await request.post('/api/employee/attendance', {
    data: {
      action: 'clock_in',
      user_id: manager.authUserId,
      shift_assignment_id: managerAssignmentId,
      clock_time: '2030-04-01T09:00:00.000Z',
    },
  })
  expect(clockIn.status()).toBe(201)

  const clockOut = await request.post('/api/employee/attendance', {
    data: {
      action: 'clock_out',
      user_id: manager.authUserId,
      shift_assignment_id: managerAssignmentId,
      clock_time: '2030-04-01T17:00:00.000Z',
    },
  })
  expect(clockOut.status()).toBe(200)
  const body = await clockOut.json()
  expect(body.record.status).toBe('submitted')
})

test('UC49: Clock Out is not gated by end time for an open-ended (one-off job) shift', async ({ request }) => {
  const clockIn = await request.post('/api/employee/attendance', {
    data: {
      action: 'clock_in',
      user_id: employee.authUserId,
      shift_assignment_id: openEndedAssignmentId,
      clock_time: '2030-04-01T14:00:00.000Z',
    },
  })
  expect(clockIn.status()).toBe(201)

  // Clocking out well before the placeholder end_time (15:00) must still succeed.
  const clockOut = await request.post('/api/employee/attendance', {
    data: {
      action: 'clock_out',
      user_id: employee.authUserId,
      shift_assignment_id: openEndedAssignmentId,
      clock_time: '2030-04-01T14:20:00.000Z',
    },
  })
  expect(clockOut.status()).toBe(200)
  const body = await clockOut.json()
  expect(body.record.status).toBe('submitted')
})

test('UC50: GET returns the attendance record history with department and shift detail', async ({ request }) => {
  const res = await request.get(`/api/employee/attendance?user_id=${employee.authUserId}`)
  expect(res.status()).toBe(200)
  const body = await res.json()
  expect(body.success).toBe(true)
  expect(body.records.length).toBeGreaterThanOrEqual(2)
  expect(body.records.some((r: { status: string }) => r.status === 'submitted')).toBe(true)
})

test('UC49: GET my_shift returns upcoming shifts with their assignment id for clocking in', async ({ request }) => {
  const res = await request.get(`/api/employee/attendance?user_id=${manager.authUserId}&resource=my_shift`)
  expect(res.status()).toBe(200)
  const body = await res.json()
  expect(body.success).toBe(true)
  expect(body.myShift.shifts.some((s: { assignment: { id: string } }) => s.assignment.id === managerAssignmentId)).toBe(true)
})
