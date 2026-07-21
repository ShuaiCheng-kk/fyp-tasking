import { test, expect } from '@playwright/test'
import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'
import { seedTestOwnerAndCompany, cleanupTestOwnerAndCompany, TestOwner } from '../helpers/seed'

config({ path: '.env.local' })

// Integration tests for UC44 (applicant list shows the apply-time snapshot) and UC48's cached /
// deterministic paths (cache hit and insufficient-info applicants never call OpenAI, so these
// tests are fast and run without an API key).

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

test.describe.configure({ mode: 'serial' })

let seeded: TestOwner
let departmentId: string
let employeeId: string
let jobId: string
const createdAuthIds: string[] = []
const createdUserIds: string[] = []

async function seedGuest(label: string): Promise<string> {
  const email = `test-airec-${label}-${Date.now()}@tasking-tests.local`
  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email, password: 'Test-Password-123!', email_confirm: true,
  })
  if (authError || !authData.user) throw new Error(`Failed to create auth user: ${authError?.message}`)
  createdAuthIds.push(authData.user.id)

  const { data: guest, error: guestError } = await admin
    .from('users')
    .insert({
      supabase_auth_id: authData.user.id,
      full_name: `AI Rec ${label}`,
      email_address: email,
      role: 'Guest User',
      date_of_birth: '2000-01-01',
    })
    .select('id')
    .single()
  if (guestError || !guest) throw new Error(`Failed to create guest row: ${guestError?.message}`)
  createdUserIds.push(guest.id)
  return guest.id
}

test.beforeAll(async ({ request }) => {
  seeded = await seedTestOwnerAndCompany('airec')

  const { data: department } = await admin
    .from('departments')
    .insert({ company_id: seeded.companyId, name: 'Events' })
    .select('id')
    .single()
  departmentId = department!.id

  const employeeEmail = `test-airec-employee-${Date.now()}@tasking-tests.local`
  const { data: employeeAuth } = await admin.auth.admin.createUser({
    email: employeeEmail, password: 'Test-Password-123!', email_confirm: true,
  })
  createdAuthIds.push(employeeAuth!.user!.id)
  const { data: employee } = await admin
    .from('users')
    .insert({
      supabase_auth_id: employeeAuth!.user!.id,
      full_name: 'AI Rec Supervisor',
      email_address: employeeEmail,
      role: 'Employee',
      company_id: seeded.companyId,
    })
    .select('id')
    .single()
  employeeId = employee!.id
  createdUserIds.push(employeeId)

  const jobRes = await request.post('/api/recruitment', {
    data: {
      company_id: seeded.companyId,
      department_id: departmentId,
      created_by: seeded.ownerId,
      assigned_employee_id: employeeId,
      title: 'AI Rec Role',
      description: 'Role used for cached recommendation tests.',
      formType: 'oneoff',
      shift_date: '2030-04-01',
      job_start_time: '09:00',
      status: 'open',
    },
  })
  expect(jobRes.status()).toBe(201)
  jobId = (await jobRes.json()).posting.id
})

test.afterAll(async () => {
  if (jobId) {
    await admin.from('job_applicants').delete().eq('job_id', jobId)
    await admin.from('job_postings').delete().eq('id', jobId)
  }
  for (const userId of createdUserIds) await admin.from('users').delete().eq('id', userId)
  for (const authId of createdAuthIds) await admin.auth.admin.deleteUser(authId).catch(() => undefined)
  await admin.from('departments').delete().eq('id', departmentId)
  await cleanupTestOwnerAndCompany(seeded)
})

test('UC44: applicant list returns the apply-time snapshot fields', async ({ request }) => {
  const userId = await seedGuest('snapshot')
  await admin.from('job_applicants').insert({
    job_id: jobId,
    user_id: userId,
    status: 'pending',
    relevant_experience: 'more_than_2',
    additional_note: 'Weekend availability.',
    skills_snapshot: 'Cash handling, Customer service',
    certificates_snapshot: [{ name: 'Food Hygiene Certificate', file_url: null }],
  })

  const res = await request.get(`/api/recruitment?resource=applicants&job_id=${jobId}&viewer_id=${seeded.ownerId}`)
  expect(res.status()).toBe(200)
  const { applicants } = await res.json()
  const applicant = applicants.find((a: { user_id: string }) => a.user_id === userId)
  expect(applicant).toBeTruthy()
  expect(applicant.full_name).toBe('AI Rec snapshot')
  expect(applicant.skills_snapshot).toBe('Cash handling, Customer service')
  expect(applicant.certificates_snapshot).toEqual([{ name: 'Food Hygiene Certificate', file_url: null }])
  expect(applicant.relevant_experience).toBe('more_than_2')
})

test('UC48: cached AI results are served without recomputation, insufficient profiles are flagged', async ({ request }) => {
  // Applicant 1 — pre-cached score, must be returned as-is.
  const cachedUserId = await seedGuest('cached')
  const cachedRec = {
    applicant_id: '', applicant_name: 'AI Rec cached', score: 82, recommendation: 'strong',
    reasons: ['Strong skill overlap'], risks: [], suggested_next_step: 'Interview',
  }
  const { data: cachedApp } = await admin.from('job_applicants').insert({
    job_id: jobId,
    user_id: cachedUserId,
    status: 'pending',
    skills_snapshot: 'Barista',
    relevant_experience: '1_to_2',
    ai_computed_at: new Date().toISOString(),
  }).select('id').single()
  cachedRec.applicant_id = cachedApp!.id
  await admin.from('job_applicants').update({ ai_summary: JSON.stringify(cachedRec) }).eq('id', cachedApp!.id)

  // Applicant 2 — zero profile signal, must be flagged insufficient (never sent to the AI).
  const emptyUserId = await seedGuest('empty')
  const { data: emptyApp } = await admin.from('job_applicants').insert({
    job_id: jobId,
    user_id: emptyUserId,
    status: 'pending',
  }).select('id').single()

  const res = await request.get(`/api/ai/candidates?job_id=${jobId}`)
  expect(res.status()).toBe(200)
  const { recommendations } = await res.json()

  const cached = recommendations.find((r: { applicant_id: string }) => r.applicant_id === cachedApp!.id)
  expect(cached).toBeTruthy()
  expect(cached.score).toBe(82)
  expect(cached.reasons).toEqual(['Strong skill overlap'])

  const insufficient = recommendations.find((r: { applicant_id: string }) => r.applicant_id === emptyApp!.id)
  expect(insufficient).toBeTruthy()
  expect(insufficient.insufficient).toBe(true)

  // Insufficient verdicts also get cached so later loads stay deterministic.
  const { data: persisted } = await admin
    .from('job_applicants').select('ai_computed_at').eq('id', emptyApp!.id).single()
  expect(persisted?.ai_computed_at).not.toBeNull()

  // Scored applicants sort above insufficient ones.
  const ids = recommendations.map((r: { applicant_id: string }) => r.applicant_id)
  expect(ids.indexOf(cachedApp!.id)).toBeLessThan(ids.indexOf(emptyApp!.id))
})

// Note: the snapshot-test applicant from UC44 above has skills but no cache, so it WOULD go to
// OpenAI — the UC48 test runs against the same job, so that applicant must be cached first.
test.beforeEach(async () => {
  await admin
    .from('job_applicants')
    .update({
      ai_summary: JSON.stringify({
        applicant_id: '', applicant_name: 'AI Rec snapshot', score: 50, recommendation: 'review',
        reasons: ['Pre-cached for test isolation'], risks: [], suggested_next_step: 'Review',
      }),
      ai_computed_at: new Date().toISOString(),
    })
    .eq('job_id', jobId)
    .is('ai_computed_at', null)
})
