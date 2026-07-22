import { test, expect } from '@playwright/test'
import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'
import { seedTestOwnerAndCompany, cleanupTestOwnerAndCompany, TestOwner } from '../helpers/seed'

config({ path: '.env.local' })

// Integration test for the day-before shift-reminder cron (GET /api/cron/shift-reminders).
// Hits route -> service -> repository -> real dev Supabase, same as the rest of this suite. The
// route also calls the real Resend API (same as sendOfferConfirmedEmail already does elsewhere
// in this test suite, e.g. tests/module4/confirm-chain.spec.ts) — email failures are swallowed
// inside shiftReminderService per-shift, so this test only asserts on reminder_sent_at, never on
// whether an email was actually delivered.

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

test.describe.configure({ mode: 'serial' })

let seeded: TestOwner
let departmentId: string
let supervisorAuthId: string
let supervisorId: string
let workerAuthId: string
let workerId: string
const createdShiftIds: string[] = []

function utcDateKey(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`
}
const TOMORROW_KEY = utcDateKey(new Date(Date.now() + 24 * 60 * 60 * 1000))

test.beforeAll(async () => {
  seeded = await seedTestOwnerAndCompany('shift-reminder')

  const { data: department } = await admin
    .from('departments')
    .insert({ company_id: seeded.companyId, name: 'Events' })
    .select('id')
    .single()
  departmentId = department!.id

  const supervisorEmail = `test-reminder-supervisor-${Date.now()}@tasking-tests.local`
  const { data: supervisorAuth } = await admin.auth.admin.createUser({
    email: supervisorEmail, password: 'Test-Password-123!', email_confirm: true,
  })
  supervisorAuthId = supervisorAuth!.user!.id
  const { data: supervisor } = await admin
    .from('users')
    .insert({
      supabase_auth_id: supervisorAuthId,
      full_name: 'Reminder Supervisor',
      email_address: supervisorEmail,
      phone_number: '+65 9000 0002',
      role: 'Employee',
      company_id: seeded.companyId,
    })
    .select('id')
    .single()
  supervisorId = supervisor!.id

  const workerEmail = `test-reminder-worker-${Date.now()}@tasking-tests.local`
  const { data: workerAuth } = await admin.auth.admin.createUser({
    email: workerEmail, password: 'Test-Password-123!', email_confirm: true,
  })
  workerAuthId = workerAuth!.user!.id
  const { data: worker } = await admin
    .from('users')
    .insert({
      supabase_auth_id: workerAuthId,
      full_name: 'Reminder Worker',
      email_address: workerEmail,
      phone_number: null,
      role: 'Casual Worker',
      company_id: seeded.companyId,
      worker_status: 'active',
    })
    .select('id')
    .single()
  workerId = worker!.id
})

test.afterAll(async () => {
  if (createdShiftIds.length > 0) {
    await admin.from('shift_assignments').delete().in('shift_id', createdShiftIds)
    await admin.from('shifts').delete().in('id', createdShiftIds)
  }
  await admin.from('users').delete().eq('id', workerId)
  await admin.from('users').delete().eq('id', supervisorId)
  await admin.auth.admin.deleteUser(workerAuthId).catch(() => undefined)
  await admin.auth.admin.deleteUser(supervisorAuthId).catch(() => undefined)
  await admin.from('departments').delete().eq('id', departmentId)
  await cleanupTestOwnerAndCompany(seeded)
})

test('rejects a call without the cron secret', async ({ request }) => {
  const res = await request.get('/api/cron/shift-reminders')
  expect(res.status()).toBe(401)
})

test('sends the reminder for a shift starting tomorrow and marks it sent', async ({ request }) => {
  const { data: shift } = await admin
    .from('shifts')
    .insert({
      company_id: seeded.companyId,
      department_id: departmentId,
      shift_date: TOMORROW_KEY,
      start_time: '09:00',
      end_time: '17:00',
      title: 'Reminder Test Shift',
      created_by: seeded.ownerId,
      publication_status: 'published',
    })
    .select('id')
    .single()
  createdShiftIds.push(shift!.id)

  await admin.from('shift_assignments').insert({
    shift_id: shift!.id,
    user_id: workerId,
    assigned_by: seeded.ownerId,
    supervisor_employee_id: supervisorId,
  })

  const res = await request.get('/api/cron/shift-reminders', {
    headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` },
  })
  expect(res.status()).toBe(200)
  const body = await res.json()
  expect(body.success).toBe(true)
  expect(body.sent).toBeGreaterThanOrEqual(1)

  const { data: updated } = await admin.from('shifts').select('reminder_sent_at').eq('id', shift!.id).single()
  expect(updated?.reminder_sent_at).toBeTruthy()
})

test('a second run does not re-send for a shift already marked reminded', async ({ request }) => {
  const { data: before } = await admin.from('shifts').select('reminder_sent_at').eq('id', createdShiftIds[0]).single()
  const firstSentAt = before?.reminder_sent_at

  const res = await request.get('/api/cron/shift-reminders', {
    headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` },
  })
  expect(res.status()).toBe(200)

  const { data: after } = await admin.from('shifts').select('reminder_sent_at').eq('id', createdShiftIds[0]).single()
  expect(after?.reminder_sent_at).toBe(firstSentAt)
})
