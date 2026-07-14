import { test, expect } from '@playwright/test'
import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'
import { seedTestOwnerAndCompany, cleanupTestOwnerAndCompany, TestOwner } from '../helpers/seed'

config({ path: '.env.local' })

// Integration tests for the reworked apply flow: per-job answers (relevant experience + note),
// profile snapshot at apply time, and the hard gates — age, duplicates, schedule conflicts with
// a 2h travel buffer across companies. Hits route.ts -> service -> repository -> Supabase.

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

test.describe.configure({ mode: 'serial' })

let seeded: TestOwner
let departmentId: string
let employeeId: string
let adultAuthId: string
let adultUserId: string
let minorAuthId: string
let minorUserId: string
const createdJobIds: string[] = []
const createdAuthIds: string[] = []
const createdUserIds: string[] = []

async function seedGuest(label: string, dateOfBirth: string): Promise<{ authId: string; userId: string }> {
  const email = `test-apply-flow-${label}-${Date.now()}@tasking-tests.local`
  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email, password: 'Test-Password-123!', email_confirm: true,
  })
  if (authError || !authData.user) throw new Error(`Failed to create guest auth user: ${authError?.message}`)
  createdAuthIds.push(authData.user.id)

  const { data: guest, error: guestError } = await admin
    .from('users')
    .insert({
      supabase_auth_id: authData.user.id,
      full_name: `Test Applicant ${label}`,
      email_address: email,
      role: 'Guest User',
      date_of_birth: dateOfBirth,
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
      description: 'Apply-flow test posting.',
      status: 'open',
      ...overrides,
    },
  })
  expect(res.status()).toBe(201)
  const posting = (await res.json()).posting
  createdJobIds.push(posting.id)
  return posting
}

test.beforeAll(async () => {
  seeded = await seedTestOwnerAndCompany('apply-flow')

  const { data: department, error: deptError } = await admin
    .from('departments')
    .insert({ company_id: seeded.companyId, name: 'Events' })
    .select('id')
    .single()
  if (deptError || !department) throw new Error(`Failed to create department: ${deptError?.message}`)
  departmentId = department.id

  const employee = await seedGuest('employee', '1990-01-01')
  await admin.from('users').update({ role: 'Employee', company_id: seeded.companyId }).eq('id', employee.userId)
  employeeId = employee.userId

  const adult = await seedGuest('adult', '2000-05-01')
  adultAuthId = adult.authId
  adultUserId = adult.userId

  // 16 years old relative to the 2026 test clock
  const minor = await seedGuest('minor', '2010-05-01')
  minorAuthId = minor.authId
  minorUserId = minor.userId
})

test.afterAll(async () => {
  if (createdJobIds.length > 0) {
    await admin.from('job_applicants').delete().in('job_id', createdJobIds)
    await admin.from('job_postings').delete().in('id', createdJobIds)
  }
  for (const userId of createdUserIds) {
    await admin.from('user_certificates').delete().eq('user_id', userId)
    await admin.from('users').delete().eq('id', userId)
  }
  for (const authId of createdAuthIds) {
    await admin.auth.admin.deleteUser(authId).catch(() => undefined)
  }
  await admin.from('departments').delete().eq('id', departmentId)
  await cleanupTestOwnerAndCompany(seeded)
})

test('apply snapshots the worker profile (skills, certificates, resume, age) onto the application', async ({ request }) => {
  // Fill the profile first — this is what must get frozen onto the application.
  await request.patch('/api/guest/profile/skills', {
    data: { user_id: adultAuthId, skills: 'Customer service, Barista' },
  })
  await request.post('/api/guest/profile/certificates', {
    multipart: { user_id: adultAuthId, name: 'Food Hygiene Certificate' },
  })

  const job = await createJob(request, {
    title: 'Snapshot Role',
    formType: 'shift',
    shift_date: '2030-03-04',
    shift_start_time: '09:00',
    shift_end_time: '17:00',
  })

  const res = await request.post('/api/guest/applications', {
    data: {
      job_id: job.id,
      user_id: adultUserId,
      additional_note: 'I worked at Starbucks for one year.',
    },
  })
  expect(res.status()).toBe(200)
  const { application } = await res.json()
  expect(application.status).toBe('pending')
  expect(application.relevant_experience).toBeNull()
  expect(application.additional_note).toBe('I worked at Starbucks for one year.')
  expect(application.skills_snapshot).toBe('Customer service, Barista')
  expect(application.certificates_snapshot).toEqual([{ name: 'Food Hygiene Certificate', file_url: null }])
  expect(typeof application.age_at_apply).toBe('number')

  // Snapshot property: editing the profile afterwards must NOT change the application.
  await request.patch('/api/guest/profile/skills', {
    data: { user_id: adultAuthId, skills: 'Completely different skills' },
  })
  const { data: frozen } = await admin
    .from('job_applicants').select('skills_snapshot').eq('id', application.id).single()
  expect(frozen?.skills_snapshot).toBe('Customer service, Barista')
})

test('rejects a duplicate application to the same job', async ({ request }) => {
  const job = await createJob(request, {
    title: 'Duplicate Guard Role',
    formType: 'shift',
    shift_date: '2030-03-11',
    shift_start_time: '09:00',
    shift_end_time: '12:00',
  })

  const first = await request.post('/api/guest/applications', {
    data: { job_id: job.id, user_id: adultUserId },
  })
  expect(first.status()).toBe(200)

  const second = await request.post('/api/guest/applications', {
    data: { job_id: job.id, user_id: adultUserId },
  })
  expect(second.status()).toBe(400)
  expect((await second.json()).message).toContain('already applied')
})

test('a self-withdrawn application never blocks re-applying to the same job', async ({ request }) => {
  const job = await createJob(request, {
    title: 'Re-apply After Withdraw Role',
    formType: 'shift',
    shift_date: '2030-03-12',
    shift_start_time: '09:00',
    shift_end_time: '12:00',
  })

  const first = await request.post('/api/guest/applications', {
    data: { job_id: job.id, user_id: adultUserId },
  })
  expect(first.status()).toBe(200)
  const firstApplicationId = (await first.json()).application.id

  const withdrawRes = await request.patch(`/api/guest/applications/${firstApplicationId}/withdraw`)
  expect(withdrawRes.status()).toBe(200)

  const reapply = await request.post('/api/guest/applications', {
    data: { job_id: job.id, user_id: adultUserId },
  })
  expect(reapply.status()).toBe(200)
})

test('declining an accepted offer never blocks re-applying to the same job', async ({ request }) => {
  const job = await createJob(request, {
    title: 'Re-apply After Decline Role',
    formType: 'shift',
    shift_date: '2030-03-13',
    shift_start_time: '09:00',
    shift_end_time: '12:00',
  })

  const first = await request.post('/api/guest/applications', {
    data: { job_id: job.id, user_id: adultUserId },
  })
  expect(first.status()).toBe(200)
  const applicantId = (await first.json()).application.id

  const decideRes = await request.patch('/api/recruitment', {
    data: { action: 'decide_applicant', applicant_id: applicantId, decision: 'accepted', decided_by: seeded.ownerId },
  })
  expect(decideRes.status()).toBe(200)

  const { data: invitation, error: invitationError } = await admin
    .from('job_invitations')
    .select('id')
    .eq('job_id', job.id)
    .eq('applicant_id', applicantId)
    .single()
  if (invitationError || !invitation) throw new Error(`Failed to find invitation: ${invitationError?.message}`)

  const declineRes = await request.patch(`/api/guest/applications/${applicantId}/respond`, {
    data: { invitation_id: invitation.id, response: 'declined' },
  })
  expect(declineRes.status()).toBe(200)

  const reapply = await request.post('/api/guest/applications', {
    data: { job_id: job.id, user_id: adultUserId },
  })
  expect(reapply.status()).toBe(200)
})

test('age gate: a 16-year-old cannot apply to a 21+ job', async ({ request }) => {
  const job = await createJob(request, {
    title: 'Adults-Only Bar Role',
    formType: 'shift',
    shift_date: '2030-03-18',
    shift_start_time: '18:00',
    shift_end_time: '23:00',
    minimum_age: 21,
  })

  const res = await request.post('/api/guest/applications', {
    data: { job_id: job.id, user_id: minorUserId },
  })
  expect(res.status()).toBe(400)
  expect((await res.json()).message).toContain('at least 21 years old')
})

test('conflict gate: overlapping same-day jobs are blocked, 2h+ gaps are allowed, withdrawal frees the slot', async ({ request }) => {
  // The adult already has a pending application on 2030-03-04 09:00–17:00 from the snapshot test.
  const overlapping = await createJob(request, {
    title: 'Overlapping Role',
    formType: 'shift',
    shift_date: '2030-03-04',
    shift_start_time: '10:00',
    shift_end_time: '16:00',
  })
  const tooClose = await createJob(request, {
    title: 'Too-Close Evening Role',
    formType: 'shift',
    shift_date: '2030-03-04',
    shift_start_time: '18:00',
    shift_end_time: '22:00',
  })
  const farEnough = await createJob(request, {
    title: 'Far-Enough Evening Role',
    formType: 'shift',
    shift_date: '2030-03-04',
    shift_start_time: '19:00',
    shift_end_time: '22:00',
  })

  const overlapRes = await request.post('/api/guest/applications', {
    data: { job_id: overlapping.id, user_id: adultUserId },
  })
  expect(overlapRes.status()).toBe(400)
  expect((await overlapRes.json()).message).toContain('clashes')

  // ends 17:00 -> starting 18:00 leaves only 1h to travel
  const tooCloseRes = await request.post('/api/guest/applications', {
    data: { job_id: tooClose.id, user_id: adultUserId },
  })
  expect(tooCloseRes.status()).toBe(400)

  // 19:00 start = exactly the 2h buffer
  const farEnoughRes = await request.post('/api/guest/applications', {
    data: { job_id: farEnough.id, user_id: adultUserId },
  })
  expect(farEnoughRes.status()).toBe(200)

  // Withdraw the 09:00–17:00 application — its slot frees, so the overlapping job now accepts.
  const { data: firstApp } = await admin
    .from('job_applicants')
    .select('id, job_postings!inner(title)')
    .eq('user_id', adultUserId)
    .eq('job_postings.title', 'Snapshot Role')
    .single()
  const withdrawRes = await request.patch(`/api/guest/applications/${firstApp!.id}/withdraw`)
  expect(withdrawRes.status()).toBe(200)

  const retryRes = await request.post('/api/guest/applications', {
    data: { job_id: overlapping.id, user_id: adultUserId },
  })
  expect(retryRes.status()).toBe(200)
})

test('conflict gate: a one-off job reserves its start time to end of day', async ({ request }) => {
  const oneOff = await createJob(request, {
    title: 'Afternoon One-Off',
    formType: 'oneoff',
    shift_date: '2030-03-25',
    job_start_time: '14:00',
  })
  const evening = await createJob(request, {
    title: 'Evening Shift Same Day',
    formType: 'shift',
    shift_date: '2030-03-25',
    shift_start_time: '20:00',
    shift_end_time: '23:00',
  })

  const oneOffRes = await request.post('/api/guest/applications', {
    data: { job_id: oneOff.id, user_id: adultUserId },
  })
  expect(oneOffRes.status()).toBe(200)

  // 20:00 is after 14:00 with no declared finish — conservatively reserved, so this clashes.
  const eveningRes = await request.post('/api/guest/applications', {
    data: { job_id: evening.id, user_id: adultUserId },
  })
  expect(eveningRes.status()).toBe(400)
  expect((await eveningRes.json()).message).toContain('clashes')
})

test('GET applications returns the posting with company/department flattened (JobCard shape)', async ({ request }) => {
  const job = await createJob(request, {
    title: 'Flattened Shape Role',
    formType: 'shift',
    shift_date: '2031-01-15',
    shift_start_time: '09:00',
    shift_end_time: '17:00',
  })

  const applyRes = await request.post('/api/guest/applications', {
    data: { job_id: job.id, user_id: adultUserId },
  })
  expect(applyRes.status()).toBe(200)

  const res = await request.get(`/api/guest/applications?user_id=${adultUserId}`)
  expect(res.status()).toBe(200)
  const { applications } = await res.json()
  const row = applications.find((a: { job_postings?: { title?: string } }) => a.job_postings?.title === 'Flattened Shape Role')
  expect(row).toBeTruthy()
  // Nested joins must be flattened away so the shared JobCard/JobDetailPanel can read flat fields.
  expect(row.job_postings.departments).toBeUndefined()
  expect(row.job_postings.companies).toBeUndefined()
  expect(row.job_postings).toHaveProperty('department_name')
  expect(row.job_postings).toHaveProperty('company_location')
  expect(row.job_postings).toHaveProperty('company_industry')
})

test('the applicant timeline is stamped: applied → offer sent → confirmed', async ({ request }) => {
  const job = await createJob(request, {
    title: 'Timeline Stamp Role',
    formType: 'shift',
    shift_date: '2031-05-05',
    shift_start_time: '09:00',
    shift_end_time: '17:00',
  })

  const applyRes = await request.post('/api/guest/applications', {
    data: { job_id: job.id, user_id: adultUserId },
  })
  expect(applyRes.status()).toBe(200)
  const applicantId = (await applyRes.json()).application.id

  // Applied is stamped on insert; nothing is resolved yet.
  const { data: afterApply } = await admin
    .from('job_applicants').select('applied_at, decided_at').eq('id', applicantId).single()
  expect(afterApply!.applied_at).toBeTruthy()
  expect(afterApply!.decided_at).toBeNull()

  // Employer accepts → the offer carries the "employer said yes" moment as sent_at.
  const decideRes = await request.patch('/api/recruitment', {
    data: { action: 'decide_applicant', applicant_id: applicantId, decision: 'accepted', decided_by: seeded.ownerId },
  })
  expect(decideRes.status()).toBe(200)

  const { data: invitation } = await admin
    .from('job_invitations').select('id, sent_at, responded_at').eq('applicant_id', applicantId).single()
  expect(invitation!.sent_at).toBeTruthy()
  expect(invitation!.responded_at).toBeNull()   // worker hasn't answered yet

  // Worker confirms → responded_at is stamped inside the FCFS RPC.
  const confirmRes = await request.patch(`/api/guest/applications/${applicantId}/respond`, {
    data: { invitation_id: invitation!.id, response: 'accepted' },
  })
  expect(confirmRes.status()).toBe(200)

  const { data: confirmed } = await admin
    .from('job_invitations').select('status, responded_at').eq('id', invitation!.id).single()
  expect(confirmed!.status).toBe('accepted')
  expect(confirmed!.responded_at).toBeTruthy()
})

test('rejecting an application stamps decided_at (the "Not selected" moment)', async ({ request }) => {
  const job = await createJob(request, {
    title: 'Rejection Stamp Role',
    formType: 'shift',
    shift_date: '2031-05-12',
    shift_start_time: '09:00',
    shift_end_time: '17:00',
  })

  const applyRes = await request.post('/api/guest/applications', {
    data: { job_id: job.id, user_id: minorUserId },
  })
  expect(applyRes.status()).toBe(200)
  const applicantId = (await applyRes.json()).application.id

  const rejectRes = await request.patch('/api/recruitment', {
    data: { action: 'decide_applicant', applicant_id: applicantId, decision: 'rejected', decided_by: seeded.ownerId },
  })
  expect(rejectRes.status()).toBe(200)

  const { data: rejected } = await admin
    .from('job_applicants').select('status, decided_at').eq('id', applicantId).single()
  expect(rejected!.status).toBe('rejected')
  expect(rejected!.decided_at).toBeTruthy()
})

test('GET applications hides a self-withdrawn application entirely', async ({ request }) => {
  const job = await createJob(request, {
    title: 'Withdraw Then Hidden Role',
    formType: 'shift',
    shift_date: '2031-03-20',
    shift_start_time: '09:00',
    shift_end_time: '12:00',
  })

  const applyRes = await request.post('/api/guest/applications', {
    data: { job_id: job.id, user_id: adultUserId },
  })
  expect(applyRes.status()).toBe(200)
  const applicationId = (await applyRes.json()).application.id

  const before = await request.get(`/api/guest/applications?user_id=${adultUserId}`)
  expect((await before.json()).applications.some((a: { id: string }) => a.id === applicationId)).toBe(true)

  const withdrawRes = await request.patch(`/api/guest/applications/${applicationId}/withdraw`)
  expect(withdrawRes.status()).toBe(200)

  const after = await request.get(`/api/guest/applications?user_id=${adultUserId}`)
  expect((await after.json()).applications.some((a: { id: string }) => a.id === applicationId)).toBe(false)
})

test('GET applications hides an offer the worker never confirmed before the shift started', async ({ request }) => {
  // Shift is in the past, so an invitation still sitting on 'sent' is a missed offer. Nothing
  // stamps it 'expired' in the background, so the list itself has to drop it.
  const job = await createJob(request, {
    title: 'Missed Offer Role',
    formType: 'shift',
    shift_date: '2020-06-01',
    shift_start_time: '09:00',
    shift_end_time: '17:00',
  })

  const { data: applicant } = await admin
    .from('job_applicants')
    .insert({ job_id: job.id, user_id: adultUserId, status: 'accepted' })
    .select('id')
    .single()
  await admin.from('job_invitations').insert({
    job_id: job.id,
    applicant_id: applicant!.id,
    sent_by: seeded.ownerId,
    status: 'sent',
    sent_at: '2020-05-25T00:00:00.000Z',
  })

  const res = await request.get(`/api/guest/applications?user_id=${adultUserId}`)
  expect(res.status()).toBe(200)
  const { applications } = await res.json()
  expect(applications.some((a: { id: string }) => a.id === applicant!.id)).toBe(false)
})

test('GET applications hides a job the employer removed the worker from after confirming', async ({ request }) => {
  // The worker is emailed the cancellation (and their shift is cancelled), so the tracker
  // doesn't repeat it — History is only ever "you weren't selected".
  const job = await createJob(request, {
    title: 'Removed After Confirm Role',
    formType: 'shift',
    shift_date: '2031-04-10',
    shift_start_time: '09:00',
    shift_end_time: '17:00',
  })

  const { data: applicant } = await admin
    .from('job_applicants')
    .insert({ job_id: job.id, user_id: adultUserId, status: 'cancelled_by_employer' })
    .select('id')
    .single()

  const res = await request.get(`/api/guest/applications?user_id=${adultUserId}`)
  expect(res.status()).toBe(200)
  const { applications } = await res.json()
  expect(applications.some((a: { id: string }) => a.id === applicant!.id)).toBe(false)
})

test('GET applications hides a still-pending application once its posting deadline passes', async ({ request }) => {
  const job = await createJob(request, {
    title: 'Expiring Deadline Role',
    formType: 'shift',
    shift_date: '2031-02-10',
    shift_start_time: '09:00',
    shift_end_time: '17:00',
    expires_at: '2031-02-01T00:00:00.000Z',
  })

  const applyRes = await request.post('/api/guest/applications', {
    data: { job_id: job.id, user_id: adultUserId },
  })
  expect(applyRes.status()).toBe(200)

  const before = await request.get(`/api/guest/applications?user_id=${adultUserId}`)
  const beforeRows = (await before.json()).applications
  expect(beforeRows.some((a: { job_postings?: { title?: string } }) => a.job_postings?.title === 'Expiring Deadline Role')).toBe(true)

  // Deadline passes without the job filling — the sweep archives the posting but leaves the
  // application 'pending'; the worker must simply stop seeing it.
  await admin.from('job_postings').update({ expires_at: '2020-01-01T00:00:00.000Z' }).eq('id', job.id)

  const after = await request.get(`/api/guest/applications?user_id=${adultUserId}`)
  const afterRows = (await after.json()).applications
  expect(afterRows.some((a: { job_postings?: { title?: string } }) => a.job_postings?.title === 'Expiring Deadline Role')).toBe(false)
})

test('experience gate: a hard minimum blocks apply until the worker confirms meeting it', async ({ request }) => {
  const job = await createJob(request, {
    title: 'Experienced-Only Role',
    formType: 'shift',
    shift_date: '2030-05-01',
    shift_start_time: '09:00',
    shift_end_time: '17:00',
    experience_required: '1+ Year',
  })

  const unconfirmed = await request.post('/api/guest/applications', {
    data: { job_id: job.id, user_id: adultUserId },
  })
  expect(unconfirmed.status()).toBe(400)
  expect((await unconfirmed.json()).message).toContain('at least 1 year of relevant experience')

  const confirmed = await request.post('/api/guest/applications', {
    data: { job_id: job.id, user_id: adultUserId, meets_experience_requirement: true },
  })
  expect(confirmed.status()).toBe(200)
})

test('rejects an application from a company-staff account (server-side backstop)', async ({ request }) => {
  const job = await createJob(request, {
    title: 'Staff Cannot Apply Role',
    formType: 'shift',
    shift_date: '2030-04-02',
    shift_start_time: '09:00',
    shift_end_time: '17:00',
  })
  // employeeId is a role='Employee' user seeded in beforeAll.
  const res = await request.post('/api/guest/applications', {
    data: { job_id: job.id, user_id: employeeId },
  })
  expect(res.status()).toBe(400)
  expect((await res.json()).message).toContain('Company staff accounts cannot apply')
})

test('per-company ban: hides the company from the board, withdraws pending, blocks apply; reactivate restores', async ({ request }) => {
  // A worker who belongs to this company (a casualworker_departments row is what the ban is stamped
  // on) and has a live pending application to one of its open jobs.
  const banned = await seedGuest('banned', '1998-06-06')
  await admin.from('users').update({ role: 'Casual Worker' }).eq('id', banned.userId)
  const { error: cwdError } = await admin
    .from('casualworker_departments')
    .insert({ casual_worker_id: banned.userId, department_id: departmentId, company_id: seeded.companyId })
  expect(cwdError).toBeNull()

  const job = await createJob(request, {
    title: 'Ban Flow Role',
    formType: 'shift',
    shift_date: '2030-05-20',
    shift_start_time: '09:00',
    shift_end_time: '17:00',
  })

  const applied = await request.post('/api/guest/applications', {
    data: { job_id: job.id, user_id: banned.userId },
  })
  expect(applied.status()).toBe(200)
  const applicationId = (await applied.json()).application.id

  // Board shows this company's job to the worker before any ban.
  const boardBefore = await request.get(`/api/jobs/public?user_id=${banned.authId}`)
  const boardBeforeJobs = (await boardBefore.json()).jobs
  expect(boardBeforeJobs.some((j: { id: string }) => j.id === job.id)).toBe(true)

  // Owner bans the worker (Team page "Inactive").
  const ban = await request.patch('/api/team/casual-worker-status', {
    data: { user_id: banned.userId, company_id: seeded.companyId, worker_status: 'inactive', inactivate_reason: 'Repeated no-shows' },
  })
  expect(ban.status()).toBe(200)

  // Per-company block stamped, and the pending application auto-withdrawn.
  const { data: cwd } = await admin
    .from('casualworker_departments')
    .select('blocked_at, blocked_reason')
    .eq('casual_worker_id', banned.userId)
    .eq('company_id', seeded.companyId)
    .single()
  expect(cwd?.blocked_at).toBeTruthy()
  expect(cwd?.blocked_reason).toBe('Repeated no-shows')
  const { data: withdrawn } = await admin
    .from('job_applicants').select('status').eq('id', applicationId).single()
  expect(withdrawn?.status).toBe('withdrawn')

  // Board now hides every posting from the banning company for this worker.
  const boardAfter = await request.get(`/api/jobs/public?user_id=${banned.authId}`)
  const boardAfterJobs = (await boardAfter.json()).jobs
  expect(boardAfterJobs.some((j: { id: string }) => j.id === job.id)).toBe(false)

  // Applying via a stale link is hard-blocked server-side.
  const blockedApply = await request.post('/api/guest/applications', {
    data: { job_id: job.id, user_id: banned.userId },
  })
  expect(blockedApply.status()).toBe(400)
  expect((await blockedApply.json()).message).toContain('no longer accepting applications')

  // Reactivating lifts the ban — board and apply work again.
  const unban = await request.patch('/api/team/casual-worker-status', {
    data: { user_id: banned.userId, company_id: seeded.companyId, worker_status: 'active' },
  })
  expect(unban.status()).toBe(200)
  const { data: cleared } = await admin
    .from('casualworker_departments')
    .select('blocked_at, blocked_reason')
    .eq('casual_worker_id', banned.userId)
    .eq('company_id', seeded.companyId)
    .single()
  expect(cleared?.blocked_at).toBeNull()
  expect(cleared?.blocked_reason).toBeNull()

  const boardRestored = await request.get(`/api/jobs/public?user_id=${banned.authId}`)
  const boardRestoredJobs = (await boardRestored.json()).jobs
  expect(boardRestoredJobs.some((j: { id: string }) => j.id === job.id)).toBe(true)

  const reapply = await request.post('/api/guest/applications', {
    data: { job_id: job.id, user_id: banned.userId },
  })
  expect(reapply.status()).toBe(200)
})
