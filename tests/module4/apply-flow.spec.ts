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
      relevant_experience: '1_to_2',
      additional_note: 'I worked at Starbucks for one year.',
    },
  })
  expect(res.status()).toBe(200)
  const { application } = await res.json()
  expect(application.status).toBe('pending')
  expect(application.relevant_experience).toBe('1_to_2')
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
    data: { job_id: job.id, user_id: adultUserId, relevant_experience: 'none' },
  })
  expect(first.status()).toBe(200)

  const second = await request.post('/api/guest/applications', {
    data: { job_id: job.id, user_id: adultUserId, relevant_experience: 'none' },
  })
  expect(second.status()).toBe(400)
  expect((await second.json()).message).toContain('already applied')
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
    data: { job_id: job.id, user_id: minorUserId, relevant_experience: 'none' },
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
    data: { job_id: overlapping.id, user_id: adultUserId, relevant_experience: 'none' },
  })
  expect(overlapRes.status()).toBe(400)
  expect((await overlapRes.json()).message).toContain('clashes')

  // ends 17:00 -> starting 18:00 leaves only 1h to travel
  const tooCloseRes = await request.post('/api/guest/applications', {
    data: { job_id: tooClose.id, user_id: adultUserId, relevant_experience: 'none' },
  })
  expect(tooCloseRes.status()).toBe(400)

  // 19:00 start = exactly the 2h buffer
  const farEnoughRes = await request.post('/api/guest/applications', {
    data: { job_id: farEnough.id, user_id: adultUserId, relevant_experience: 'none' },
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
    data: { job_id: overlapping.id, user_id: adultUserId, relevant_experience: 'none' },
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
    data: { job_id: oneOff.id, user_id: adultUserId, relevant_experience: 'none' },
  })
  expect(oneOffRes.status()).toBe(200)

  // 20:00 is after 14:00 with no declared finish — conservatively reserved, so this clashes.
  const eveningRes = await request.post('/api/guest/applications', {
    data: { job_id: evening.id, user_id: adultUserId, relevant_experience: 'none' },
  })
  expect(eveningRes.status()).toBe(400)
  expect((await eveningRes.json()).message).toContain('clashes')
})

test('rejects an invalid relevant_experience value at the controller', async ({ request }) => {
  const res = await request.post('/api/guest/applications', {
    data: { job_id: '00000000-0000-0000-0000-000000000000', user_id: adultUserId, relevant_experience: 'expert' },
  })
  expect(res.status()).toBe(400)
  expect((await res.json()).message).toContain('relevant_experience')
})
