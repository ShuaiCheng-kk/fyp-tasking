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
let shiftId: string
let assignmentId: string
let worker: SeededWorker
let replacement: SeededWorker

test.describe.configure({ mode: 'serial' })

async function createCasualWorker(label: string): Promise<SeededWorker> {
  const email = `test-module5-ui-${label}-${Date.now()}@tasking-tests.local`
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
      full_name: `Module 5 UI ${label}`,
      email_address: email,
      phone_number: null,
      role: 'Casual Worker',
      company_id: seeded.companyId,
      worker_status: 'active',
    })
    .select('id')
    .single()
  if (userError || !user) throw new Error(`Failed to create user row: ${userError?.message}`)

  return { authUserId: authData.user.id, userId: user.id as string, email }
}

async function signInForUi(page: import('@playwright/test').Page, input: {
  email: string
  password: string
  authUserId: string
  companyId?: string
}) {
  const res = await page.request.post('/api/auth/signin', {
    data: {
      email_address: input.email,
      password: input.password,
    },
  })
  expect(res.status()).toBe(200)
  await page.addInitScript(({ authUserId, companyId }) => {
    localStorage.setItem('tasking_user_id', authUserId)
    if (companyId) localStorage.setItem(`tasking_company_id_${authUserId}`, companyId)
  }, { authUserId: input.authUserId, companyId: input.companyId ?? '' })
}

test.beforeAll(async () => {
  seeded = await seedTestOwnerAndCompany('module5-ui')

  const { data: department, error: departmentError } = await admin
    .from('departments')
    .insert({ company_id: seeded.companyId, name: 'Module 5 UI Events' })
    .select('id')
    .single()
  if (departmentError || !department) throw new Error(`Failed to create department: ${departmentError?.message}`)
  departmentId = department.id as string

  worker = await createCasualWorker('Worker')
  replacement = await createCasualWorker('Replacement')

  // UC49 gates Clock In to within 30 minutes before the shift starts, and Clock Out to once the
  // shift has reached its end time — so for a real-browser E2E run (no clock_time override like
  // the API tests have), the shift must be scheduled in the recent past relative to wall-clock
  // "now", not a fixed future date, or both buttons would be hidden the whole test run.
  const now = new Date()
  const shiftStart = new Date(now.getTime() - 20 * 60000)
  const shiftEnd = new Date(now.getTime() - 5 * 60000)
  const shiftDateKey = shiftStart.toISOString().slice(0, 10)
  const toHms = (d: Date) => d.toISOString().slice(11, 19)

  const { data: shift, error: shiftError } = await admin
    .from('shifts')
    .insert({
      company_id: seeded.companyId,
      department_id: departmentId,
      shift_date: shiftDateKey,
      start_time: toHms(shiftStart),
      end_time: toHms(shiftEnd),
      is_open_ended: true,
      title: 'Module 5 UI Shift',
      created_by: seeded.ownerId,
      publication_status: 'published',
    })
    .select('id')
    .single()
  if (shiftError || !shift) throw new Error(`Failed to create shift: ${shiftError?.message}`)
  shiftId = shift.id as string

  const { data: assignment, error: assignmentError } = await admin
    .from('shift_assignments')
    .insert({ shift_id: shiftId, user_id: worker.userId, assigned_by: seeded.ownerId })
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
  await admin.from('shift_assignments').delete().eq('id', assignmentId)
  await admin.from('shifts').delete().eq('id', shiftId)
  await admin.from('departments').delete().eq('id', departmentId)

  for (const member of [worker, replacement]) {
    await admin.from('users').delete().eq('id', member.userId)
    await admin.auth.admin.deleteUser(member.authUserId).catch(() => undefined)
  }
  await cleanupTestOwnerAndCompany(seeded)
})

test('casual worker can use Module 5 attendance actions from the UI', async ({ page }) => {
  await signInForUi(page, {
    email: worker.email,
    password: 'Test-Password-123!',
    authUserId: worker.authUserId,
    companyId: seeded.companyId,
  })

  await page.goto('/casual/attendance')
  await expect(page.getByRole('heading', { name: 'Attendance' })).toBeVisible()
  const card = page.getByText('Module 5 UI Shift').locator('xpath=ancestor::section[1]')
  await expect(card).toBeVisible()

  await card.getByRole('button', { name: 'Clock In' }).click()
  await expect(page.getByText('Clocked in successfully.')).toBeVisible()
  await expect(card.getByText('Clocked in')).toBeVisible()

  await card.getByRole('button', { name: 'Clock Out' }).click()
  await expect(page.getByText('Timesheet submitted.')).toBeVisible()
  await expect(card.getByText('Submitted')).toBeVisible()

  await card.getByPlaceholder('Request reason').fill('UI needs time off')
  await card.getByRole('button', { name: 'Submit' }).click()
  await expect(page.getByText('Time-off request submitted.')).toBeVisible()

  await card.getByRole('combobox').nth(1).selectOption({ label: 'Module 5 UI Replacement' })
  await card.getByPlaceholder('Swap reason').fill('Replacement confirmed in UI')
  await card.getByRole('button', { name: 'Request' }).click()
  await expect(page.getByText('Shift swap request submitted.')).toBeVisible()
})

test('casual worker can manage availability from the UI', async ({ page }) => {
  await signInForUi(page, {
    email: worker.email,
    password: 'Test-Password-123!',
    authUserId: worker.authUserId,
    companyId: seeded.companyId,
  })

  await page.goto('/casual/availability')
  await expect(page.getByRole('heading', { name: 'Availability' })).toBeVisible()

  await page.getByRole('combobox').selectOption('break_waiver')
  await page.getByPlaceholder('Reason').fill('UI break waiver')
  await page.getByRole('button', { name: 'Submit Request' }).click()
  await expect(page.getByText('Break waiver request submitted.')).toBeVisible()
  await expect(page.getByText('UI break waiver')).toBeVisible()
})

test('owner can review Module 5 work from the attendance UI', async ({ page }) => {
  const today = new Date()
  const start = new Date(today.getTime() - 20 * 60000)
  const end = new Date(today.getTime() - 5 * 60000)
  const shiftDateKey = start.toISOString().slice(0, 10)
  const toHms = (d: Date) => d.toISOString().slice(11, 19)
  await admin.from('shift_swap_requests').delete().eq('company_id', seeded.companyId)
  await admin.from('shift_assignments').delete().eq('shift_id', shiftId).neq('id', assignmentId)
  await admin.from('shifts').update({
    shift_date: shiftDateKey,
    start_time: toHms(start),
    end_time: toHms(end),
    is_open_ended: true,
    publication_status: 'published',
  }).eq('id', shiftId)
  await admin.from('shift_assignments').update({ user_id: worker.userId }).eq('id', assignmentId)
  await admin.from('attendance_records').upsert({
    shift_assignment_id: assignmentId,
    casual_worker_id: worker.userId,
    clock_in_time: new Date(Date.now() - 15 * 60000).toISOString(),
    clock_out_time: new Date(Date.now() - 5 * 60000).toISOString(),
    confirmed_by_employee_id: worker.userId,
    submitted_by_employee_id: worker.userId,
    status: 'submitted',
    owner_status: 'pending',
  }, { onConflict: 'shift_assignment_id' })

  await signInForUi(page, {
    email: seeded.email,
    password: seeded.password,
    authUserId: seeded.authUserId,
    companyId: seeded.companyId,
  })

  await page.goto('/owner/attendance')
  await expect(page.getByRole('heading', { name: 'Attendance' })).toBeVisible()
  await page.getByText('All').click()
  // UC51: today's live timeline shows the worker who already clocked in/out today
  await expect(page.getByText('Module 5 UI Worker').first()).toBeVisible()

  // UC50: Review Attendance Record — click today's record pill for this worker, then Approve.
  await page.getByRole('button', { name: /\d{1,2}:\d{2}(am|pm).*\d{1,2}:\d{2}(am|pm)/i }).first().click()
  await expect(page.getByRole('heading', { name: 'Attendance Record' })).toBeVisible()
  await page.getByRole('button', { name: /Save/ }).click()
  await expect(page.getByRole('heading', { name: 'Attendance Record' })).toBeHidden()

  // Close the Past Attendance Record modal before moving to the other tabs.
  await expect(page.getByText('Casual Worker — Past Attendance Record')).toBeHidden()

  // UC53: Approve Shift Swap Request

  // UC56: Approve Fixed Day Off
})
