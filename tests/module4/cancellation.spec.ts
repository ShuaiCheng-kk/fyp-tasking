import { test, expect } from '@playwright/test'
import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'
import { seedTestOwnerAndCompany, cleanupTestOwnerAndCompany, TestOwner } from '../helpers/seed'

config({ path: '.env.local' })

// Integration tests for the post-confirmation exits: the worker's Cancel Shift, the employer's
// Remove Worker and Cancel Job (reason mandatory), the shift-started boundary where Attendance
// takes over, and the supervisor-removal guard. Hits route -> service -> repository -> Supabase.

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

test.describe.configure({ mode: 'serial' })

let seeded: TestOwner
let departmentId: string
let employeeId: string
const createdJobIds: string[] = []
const createdAuthIds: string[] = []
const createdUserIds: string[] = []

async function seedGuest(label: string): Promise<{ authId: string; userId: string }> {
  const email = `test-cancel-${label}-${Date.now()}@tasking-tests.local`
  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email, password: 'Test-Password-123!', email_confirm: true,
  })
  if (authError || !authData.user) throw new Error(`Failed to create auth user: ${authError?.message}`)
  createdAuthIds.push(authData.user.id)

  const { data: guest, error: guestError } = await admin
    .from('users')
    .insert({
      supabase_auth_id: authData.user.id,
      full_name: `Cancel ${label}`,
      email_address: email,
      role: 'Guest User',
      date_of_birth: '2000-01-01',
    })
    .select('id')
    .single()
  if (guestError || !guest) throw new Error(`Failed to create guest row: ${guestError?.message}`)
  createdUserIds.push(guest.id)
  return { authId: authData.user.id, userId: guest.id }
}

async function createJob(request: import('@playwright/test').APIRequestContext, overrides: Record<string, unknown>) {
  const res = await request.post('/api/recruitment', {
    data: {
      company_id: seeded.companyId,
      department_id: departmentId,
      created_by: seeded.ownerId,
      assigned_employee_id: employeeId,
      description: 'Cancellation test posting.',
      status: 'open',
      ...overrides,
    },
  })
  expect(res.status()).toBe(201)
  const posting = (await res.json()).posting
  createdJobIds.push(posting.id)
  return posting
}

// Seeds a fully confirmed engagement (applicant accepted + invitation accepted) through the real
// respond endpoint so the shift side effects run exactly like production.
async function confirmWorker(request: import('@playwright/test').APIRequestContext, jobId: string, userId: string) {
  const { data: applicant } = await admin
    .from('job_applicants')
    .insert({ job_id: jobId, user_id: userId, status: 'accepted' })
    .select('id')
    .single()
  const { data: invitation } = await admin
    .from('job_invitations')
    .insert({ job_id: jobId, applicant_id: applicant!.id, sent_by: seeded.ownerId, status: 'sent' })
    .select('id')
    .single()
  const res = await request.patch(`/api/guest/applications/${applicant!.id}/respond`, {
    data: { invitation_id: invitation!.id, response: 'accepted' },
  })
  expect(res.status()).toBe(200)
  return { applicantId: applicant!.id, invitationId: invitation!.id }
}

test.beforeAll(async () => {
  seeded = await seedTestOwnerAndCompany('cancellation')

  const { data: department } = await admin
    .from('departments')
    .insert({ company_id: seeded.companyId, name: 'Events' })
    .select('id')
    .single()
  departmentId = department!.id

  const supervisorEmail = `test-cancel-supervisor-${Date.now()}@tasking-tests.local`
  const { data: supervisorAuth } = await admin.auth.admin.createUser({
    email: supervisorEmail, password: 'Test-Password-123!', email_confirm: true,
  })
  createdAuthIds.push(supervisorAuth!.user!.id)
  const { data: supervisor } = await admin
    .from('users')
    .insert({
      supabase_auth_id: supervisorAuth!.user!.id,
      full_name: 'Cancel Supervisor',
      email_address: supervisorEmail,
      role: 'Employee',
      company_id: seeded.companyId,
    })
    .select('id')
    .single()
  employeeId = supervisor!.id
  createdUserIds.push(employeeId)
})

test.afterAll(async () => {
  if (createdJobIds.length > 0) {
    const { data: shiftRows } = await admin.from('shifts').select('id').in('source_job_posting_id', createdJobIds)
    const shiftIds = (shiftRows ?? []).map(r => r.id as string)
    if (shiftIds.length > 0) {
      await admin.from('shift_assignments').delete().in('shift_id', shiftIds)
      await admin.from('shifts').delete().in('id', shiftIds)
    }
    await admin.from('recruitment_cancellations').delete().in('job_id', createdJobIds)
    await admin.from('job_invitations').delete().in('job_id', createdJobIds)
    await admin.from('job_applicants').delete().in('job_id', createdJobIds)
    await admin.from('job_postings').delete().in('id', createdJobIds)
  }
  for (const userId of createdUserIds) {
    await admin.from('messages').delete().or(`from_user_id.eq.${userId},to_user_id.eq.${userId}`)
    await admin.from('casualworker_departments').delete().eq('casual_worker_id', userId)
    await admin.from('users').delete().eq('id', userId)
  }
  for (const authId of createdAuthIds) await admin.auth.admin.deleteUser(authId).catch(() => undefined)
  await admin.from('departments').delete().eq('id', departmentId)
  await cleanupTestOwnerAndCompany(seeded)
})

test('worker Cancel Shift: shift voided, application withdrawn, full job reopens, owner notified in-app', async ({ request }) => {
  const job = await createJob(request, {
    title: 'Worker Cancel Role',
    formType: 'shift',
    shift_date: '2030-06-01',
    shift_start_time: '09:00',
    shift_end_time: '17:00',
    openings: 1,
  })
  const worker = await seedGuest('worker')
  const { applicantId, invitationId } = await confirmWorker(request, job.id, worker.userId)

  // Filled -> auto-closed. The cancel must reopen it.
  const { data: closedJob } = await admin.from('job_postings').select('status').eq('id', job.id).single()
  expect(closedJob?.status).toBe('closed')

  const { data: shiftRow } = await admin
    .from('shifts').select('id').eq('source_job_posting_id', job.id).single()

  const res = await request.post('/api/casual/shift-cancel', {
    data: { user_id: worker.authId, shift_id: shiftRow!.id, reason: 'Family emergency' },
  })
  expect(res.status()).toBe(200)

  const { data: cancelledShift } = await admin.from('shifts').select('status').eq('id', shiftRow!.id).single()
  expect(cancelledShift?.status).toBe('cancelled')
  const { data: applicant } = await admin.from('job_applicants').select('status').eq('id', applicantId).single()
  expect(applicant?.status).toBe('withdrawn')
  const { data: invitation } = await admin.from('job_invitations').select('status').eq('id', invitationId).single()
  expect(invitation?.status).toBe('cancelled')

  // Opening freed -> job back on the board.
  const { data: reopened } = await admin.from('job_postings').select('status').eq('id', job.id).single()
  expect(reopened?.status).toBe('open')

  // History kept + in-app message to the employer.
  const { data: history } = await admin
    .from('recruitment_cancellations').select('cancelled_role, scope, reason').eq('job_id', job.id)
  expect(history).toHaveLength(1)
  expect(history![0]).toMatchObject({ cancelled_role: 'worker', scope: 'worker', reason: 'Family emergency' })
  const { data: messages } = await admin
    .from('messages').select('content').eq('to_user_id', seeded.ownerId).eq('from_user_id', worker.userId)
  expect(messages!.length).toBeGreaterThan(0)
  expect(messages![0].content).toContain('cancelled their confirmed shift')
})

test('worker Cancel Shift is refused once the shift has started', async ({ request }) => {
  const job = await createJob(request, {
    title: 'Started Shift Role',
    formType: 'shift',
    shift_date: '2030-06-02',
    shift_start_time: '09:00',
    shift_end_time: '17:00',
    openings: 1,
  })
  const worker = await seedGuest('started')
  await confirmWorker(request, job.id, worker.userId)

  // Backdate the created shift so it has already started.
  const { data: shiftRow } = await admin.from('shifts').select('id').eq('source_job_posting_id', job.id).single()
  await admin.from('shifts').update({ shift_date: '2020-01-01' }).eq('id', shiftRow!.id)

  const res = await request.post('/api/casual/shift-cancel', {
    data: { user_id: worker.authId, shift_id: shiftRow!.id },
  })
  expect(res.status()).toBe(400)
  expect((await res.json()).message).toContain('already started')
})

test('owner Remove Worker: reason mandatory; cancels the engagement and reopens the job', async ({ request }) => {
  const job = await createJob(request, {
    title: 'Remove Worker Role',
    formType: 'shift',
    shift_date: '2030-06-03',
    shift_start_time: '09:00',
    shift_end_time: '17:00',
    openings: 1,
  })
  const worker = await seedGuest('removed')
  const { applicantId, invitationId } = await confirmWorker(request, job.id, worker.userId)

  const noReason = await request.patch('/api/recruitment', {
    data: { action: 'remove_worker', job_id: job.id, applicant_id: applicantId, removed_by: seeded.ownerId, reason: '  ' },
  })
  expect(noReason.status()).toBe(400)
  expect((await noReason.json()).message).toContain('reason is required')

  const res = await request.patch('/api/recruitment', {
    data: { action: 'remove_worker', job_id: job.id, applicant_id: applicantId, removed_by: seeded.ownerId, reason: 'Requirements changed' },
  })
  expect(res.status()).toBe(200)

  const { data: applicant } = await admin.from('job_applicants').select('status').eq('id', applicantId).single()
  expect(applicant?.status).toBe('cancelled_by_employer')
  const { data: invitation } = await admin.from('job_invitations').select('status').eq('id', invitationId).single()
  expect(invitation?.status).toBe('cancelled')
  const { data: shiftRow } = await admin.from('shifts').select('status').eq('source_job_posting_id', job.id).single()
  expect(shiftRow?.status).toBe('cancelled')
  const { data: reopened } = await admin.from('job_postings').select('status').eq('id', job.id).single()
  expect(reopened?.status).toBe('open')
  const { data: history } = await admin
    .from('recruitment_cancellations').select('cancelled_role, scope').eq('job_id', job.id)
  expect(history![0]).toMatchObject({ cancelled_role: 'employer', scope: 'worker' })
})

// Deleting a posting is how an employer calls the whole job off. The posting row disappears, but
// a confirmed worker's shift does NOT (source_job_posting_id is ON DELETE SET NULL) — so the
// delete must cancel that shift first, or the worker would turn up for work that no longer exists.
test('deleting a job cancels confirmed workers\' shifts so nobody is left scheduled', async ({ request }) => {
  const job = await createJob(request, {
    title: 'Deleted Whole Job Role',
    formType: 'shift',
    shift_date: '2030-06-04',
    shift_start_time: '09:00',
    shift_end_time: '17:00',
    openings: 2,
  })
  const confirmed = await seedGuest('confirmed')
  await confirmWorker(request, job.id, confirmed.userId)

  // The confirmed worker has a real, live shift before the delete.
  const { data: shiftBefore } = await admin
    .from('shifts').select('id, status').eq('source_job_posting_id', job.id).single()
  expect(shiftBefore!.status).not.toBe('cancelled')

  const res = await request.patch('/api/recruitment', {
    data: { action: 'delete_posting', job_id: job.id },
  })
  expect(res.status()).toBe(200)

  // Posting gone…
  const { data: deletedJob } = await admin.from('job_postings').select('id').eq('id', job.id).maybeSingle()
  expect(deletedJob).toBeNull()

  // …and the worker's shift was cancelled, not left dangling.
  const { data: shiftAfter } = await admin
    .from('shifts').select('status').eq('id', shiftBefore!.id).single()
  expect(shiftAfter?.status).toBe('cancelled')

  // The shift is orphaned from the deleted posting, so clean it up explicitly.
  await admin.from('shift_assignments').delete().eq('shift_id', shiftBefore!.id)
  await admin.from('shifts').delete().eq('id', shiftBefore!.id)
})

test('an Employee supervising live jobs cannot be removed until reassigned', async ({ request }) => {
  // The supervisor is on every open posting created above.
  const res = await request.delete('/api/team/remove-member', {
    data: { company_id: seeded.companyId, user_id_to_remove: employeeId, requesting_user_id: seeded.ownerId },
  })
  expect(res.status()).toBe(400)
  expect((await res.json()).message).toContain('Assign another supervisor')

  const { data: stillThere } = await admin.from('users').select('id').eq('id', employeeId).single()
  expect(stillThere).toBeTruthy()
})
