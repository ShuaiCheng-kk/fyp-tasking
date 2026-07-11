import { test, expect } from '@playwright/test'
import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'
import { seedTestOwnerAndCompany, cleanupTestOwnerAndCompany, TestOwner } from '../helpers/seed'

config({ path: '.env.local' })

// Integration tests for the two-way confirm chain (UC45/UC46): first-come-first-served claims,
// auto-close on the last confirmed opening, offer expiry at shift start, and the worker-decline
// path hiding the application from the employer. Hits route -> service -> repository -> Supabase.

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
  const email = `test-confirm-${label}-${Date.now()}@tasking-tests.local`
  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email, password: 'Test-Password-123!', email_confirm: true,
  })
  if (authError || !authData.user) throw new Error(`Failed to create auth user: ${authError?.message}`)
  createdAuthIds.push(authData.user.id)

  const { data: guest, error: guestError } = await admin
    .from('users')
    .insert({
      supabase_auth_id: authData.user.id,
      full_name: `Confirm ${label}`,
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

async function seedApplicantAndInvitation(jobId: string, userId: string): Promise<{ applicantId: string; invitationId: string }> {
  const { data: applicant, error: appErr } = await admin
    .from('job_applicants')
    .insert({ job_id: jobId, user_id: userId, status: 'accepted' })
    .select('id')
    .single()
  if (appErr || !applicant) throw new Error(`Failed to seed applicant: ${appErr?.message}`)

  const { data: invitation, error: invErr } = await admin
    .from('job_invitations')
    .insert({ job_id: jobId, applicant_id: applicant.id, sent_by: seeded.ownerId, status: 'sent' })
    .select('id')
    .single()
  if (invErr || !invitation) throw new Error(`Failed to seed invitation: ${invErr?.message}`)
  return { applicantId: applicant.id, invitationId: invitation.id }
}

test.beforeAll(async () => {
  seeded = await seedTestOwnerAndCompany('confirm-chain')

  const { data: department } = await admin
    .from('departments')
    .insert({ company_id: seeded.companyId, name: 'Events' })
    .select('id')
    .single()
  departmentId = department!.id

  const supervisorEmail = `test-confirm-supervisor-${Date.now()}@tasking-tests.local`
  const { data: supervisorAuth } = await admin.auth.admin.createUser({
    email: supervisorEmail, password: 'Test-Password-123!', email_confirm: true,
  })
  createdAuthIds.push(supervisorAuth!.user!.id)
  const { data: supervisor } = await admin
    .from('users')
    .insert({
      supabase_auth_id: supervisorAuth!.user!.id,
      full_name: 'Confirm Supervisor',
      email_address: supervisorEmail,
      phone_number: '+65 9000 0001',
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
    await admin.from('job_invitations').delete().in('job_id', createdJobIds)
    await admin.from('job_applicants').delete().in('job_id', createdJobIds)
    await admin.from('job_postings').delete().in('id', createdJobIds)
  }
  for (const userId of createdUserIds) {
    await admin.from('casualworker_departments').delete().eq('casual_worker_id', userId)
    await admin.from('users').delete().eq('id', userId)
  }
  for (const authId of createdAuthIds) await admin.auth.admin.deleteUser(authId).catch(() => undefined)
  await admin.from('departments').delete().eq('id', departmentId)
  await cleanupTestOwnerAndCompany(seeded)
})

async function createJob(request: import('@playwright/test').APIRequestContext, overrides: Record<string, unknown>) {
  const res = await request.post('/api/recruitment', {
    data: {
      company_id: seeded.companyId,
      department_id: departmentId,
      created_by: seeded.ownerId,
      assigned_employee_id: employeeId,
      description: 'Confirm-chain test posting.',
      status: 'open',
      ...overrides,
    },
  })
  expect(res.status()).toBe(201)
  const posting = (await res.json()).posting
  createdJobIds.push(posting.id)
  return posting
}

test('FCFS: first confirmation wins the single opening, the job auto-closes, losers and pending applicants are resolved', async ({ request }) => {
  const job = await createJob(request, {
    title: 'One Opening Role',
    formType: 'shift',
    shift_date: '2030-05-04',
    shift_start_time: '09:00',
    shift_end_time: '17:00',
    openings: 1,
  })

  const winner = await seedGuest('winner')
  const loser = await seedGuest('loser')
  const pending = await seedGuest('pending')

  const winnerSeed = await seedApplicantAndInvitation(job.id, winner.userId)
  const loserSeed = await seedApplicantAndInvitation(job.id, loser.userId)
  // A third applicant still waiting on the employer — must be resolved when the job fills.
  const { data: pendingApp } = await admin
    .from('job_applicants')
    .insert({ job_id: job.id, user_id: pending.userId, status: 'pending' })
    .select('id')
    .single()

  // Winner confirms first.
  const winRes = await request.patch(`/api/guest/applications/${winnerSeed.applicantId}/respond`, {
    data: { invitation_id: winnerSeed.invitationId, response: 'accepted' },
  })
  expect(winRes.status()).toBe(200)

  // Promotion + shift side effects ran for the winner.
  const { data: promoted } = await admin.from('users').select('role').eq('id', winner.userId).single()
  expect(promoted?.role).toBe('Casual Worker')

  // The single opening is now confirmed: job closed and off the public board.
  const { data: closedJob } = await admin.from('job_postings').select('status').eq('id', job.id).single()
  expect(closedJob?.status).toBe('closed')
  const publicRes = await request.get('/api/jobs/public')
  const { jobs } = await publicRes.json()
  expect(jobs.some((j: { id: string }) => j.id === job.id)).toBe(false)

  // Remaining offer voided as position_filled...
  const { data: loserInv } = await admin.from('job_invitations').select('status').eq('id', loserSeed.invitationId).single()
  expect(loserInv?.status).toBe('position_filled')
  // ...and the untouched pending application resolved as job_closed.
  const { data: resolvedPending } = await admin.from('job_applicants').select('status').eq('id', pendingApp!.id).single()
  expect(resolvedPending?.status).toBe('job_closed')

  // The loser trying to confirm afterwards gets a clear rejection.
  const loseRes = await request.patch(`/api/guest/applications/${loserSeed.applicantId}/respond`, {
    data: { invitation_id: loserSeed.invitationId, response: 'accepted' },
  })
  expect(loseRes.status()).toBe(400)
  expect((await loseRes.json()).message).toContain('no longer available')
})

test('the confirmed worker sees the shift with the supervisor contact on their dashboard', async ({ request }) => {
  // The winner from the previous test is now a Casual Worker with one confirmed shift.
  const { data: winnerRow } = await admin
    .from('users')
    .select('supabase_auth_id')
    .eq('full_name', 'Confirm winner')
    .single()

  const res = await request.get(`/api/casual/dashboard?user_id=${winnerRow!.supabase_auth_id}`)
  expect(res.status()).toBe(200)
  const { dashboard } = await res.json()
  expect(dashboard.upcoming_shifts.length).toBeGreaterThan(0)
  const shift = dashboard.upcoming_shifts[0]
  expect(shift.title).toBe('One Opening Role')
  expect(shift.shift_date).toBe('2030-05-04')
  expect(shift.supervisor.full_name).toBe('Confirm Supervisor')
  expect(shift.supervisor.phone_number).toBe('+65 9000 0001')
})

test('an offer expires once its shift has started; the invitation is voided', async ({ request }) => {
  const job = await createJob(request, {
    title: 'Already Started Role',
    formType: 'shift',
    shift_date: '2020-01-01',
    shift_start_time: '09:00',
    shift_end_time: '17:00',
    openings: 1,
  })
  const late = await seedGuest('late')
  const lateSeed = await seedApplicantAndInvitation(job.id, late.userId)

  const res = await request.patch(`/api/guest/applications/${lateSeed.applicantId}/respond`, {
    data: { invitation_id: lateSeed.invitationId, response: 'accepted' },
  })
  expect(res.status()).toBe(400)
  expect((await res.json()).message).toContain('expired')

  const { data: invitation } = await admin.from('job_invitations').select('status').eq('id', lateSeed.invitationId).single()
  expect(invitation?.status).toBe('expired')
  // No promotion happened.
  const { data: user } = await admin.from('users').select('role').eq('id', late.userId).single()
  expect(user?.role).toBe('Guest User')
})

test('declining an offer withdraws the application and drops it from the employer applicant list', async ({ request }) => {
  const job = await createJob(request, {
    title: 'Declined Offer Role',
    formType: 'shift',
    shift_date: '2030-05-11',
    shift_start_time: '09:00',
    shift_end_time: '17:00',
    openings: 1,
  })
  const decliner = await seedGuest('decliner')
  const declinerSeed = await seedApplicantAndInvitation(job.id, decliner.userId)

  const res = await request.patch(`/api/guest/applications/${declinerSeed.applicantId}/respond`, {
    data: { invitation_id: declinerSeed.invitationId, response: 'declined' },
  })
  expect(res.status()).toBe(200)

  const { data: applicant } = await admin.from('job_applicants').select('status').eq('id', declinerSeed.applicantId).single()
  expect(applicant?.status).toBe('withdrawn')

  const listRes = await request.get(`/api/recruitment?resource=applicants&job_id=${job.id}`)
  const { applicants } = await listRes.json()
  expect(applicants.some((a: { id: string }) => a.id === declinerSeed.applicantId)).toBe(false)
})
