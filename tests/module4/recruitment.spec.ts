import { test, expect } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'
import { seedTestOwnerAndCompany, cleanupTestOwnerAndCompany, TestOwner } from '../helpers/seed'

// Integration tests for Module 4 — Recruitment, scoped to what UC49 (Module 5 Attendance)
// needed from this module: a one-off job posting's job_start_time, and the side effect of a
// Casual Worker accepting an invitation — a real published shift + shift_assignment is created
// so UC49's Clock In/Out gating has something to compare against, the same way Manager/Employee
// shifts already do. Hits route.ts -> service -> repository -> Supabase, no UI involved.

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

test.describe.configure({ mode: 'serial' })

let seeded: TestOwner
let departmentId: string
const createdJobIds: string[] = []
const createdGuestAuthIds: string[] = []
const createdGuestUserIds: string[] = []

test.beforeAll(async () => {
  seeded = await seedTestOwnerAndCompany('recruitment-api')

  const { data: department, error: deptError } = await admin
    .from('departments')
    .insert({ company_id: seeded.companyId, name: 'Events' })
    .select('id')
    .single()
  if (deptError || !department) throw new Error(`Failed to create department: ${deptError?.message}`)
  departmentId = department.id
})

test.afterAll(async () => {
  if (createdJobIds.length > 0) {
    const { data: shiftRows } = await admin.from('shifts').select('id').eq('company_id', seeded.companyId)
    const shiftIds = (shiftRows ?? []).map(row => row.id as string)
    if (shiftIds.length > 0) {
      await admin.from('shift_assignments').delete().in('shift_id', shiftIds)
      await admin.from('shifts').delete().in('id', shiftIds)
    }
    await admin.from('job_invitations').delete().in('job_id', createdJobIds)
    await admin.from('job_applicants').delete().in('job_id', createdJobIds)
    await admin.from('job_postings').delete().in('id', createdJobIds)
  }
  for (const userId of createdGuestUserIds) {
    await admin.from('users').delete().eq('id', userId)
  }
  for (const authId of createdGuestAuthIds) {
    await admin.auth.admin.deleteUser(authId).catch(() => undefined)
  }
  await admin.from('departments').delete().eq('id', departmentId)
  await cleanupTestOwnerAndCompany(seeded)
})

async function seedGuest(label: string): Promise<{ authId: string; userId: string }> {
  const email = `test-recruitment-guest-${label}-${Date.now()}@tasking-tests.local`
  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email, password: 'Test-Password-123!', email_confirm: true,
  })
  if (authError || !authData.user) throw new Error(`Failed to create guest auth user: ${authError?.message}`)
  createdGuestAuthIds.push(authData.user.id)

  const { data: guest, error: guestError } = await admin
    .from('users')
    .insert({
      supabase_auth_id: authData.user.id,
      full_name: `Test Guest ${label}`,
      email_address: email,
      phone_number: null,
      role: 'Guest User',
    })
    .select()
    .single()
  if (guestError || !guest) throw new Error(`Failed to create guest row: ${guestError?.message}`)
  createdGuestUserIds.push(guest.id)
  return { authId: authData.user.id, userId: guest.id }
}

test('UC35 rejects publishing a one-off job without a job_start_time', async ({ request }) => {
  const res = await request.post('/api/recruitment', {
    data: {
      company_id: seeded.companyId,
      department_id: departmentId,
      created_by: seeded.ownerId,
      title: 'Event Setup Crew',
      description: 'Help set up chairs and tables.',
      formType: 'oneoff',
      shift_date: '2030-03-01',
      status: 'open',
    },
  })
  expect(res.status()).toBe(400)
  const body = await res.json()
  expect(body.message).toContain('job_start_time')
})

test('UC35 publishes a one-off job with a job_start_time', async ({ request }) => {
  const res = await request.post('/api/recruitment', {
    data: {
      company_id: seeded.companyId,
      department_id: departmentId,
      created_by: seeded.ownerId,
      title: 'Event Setup Crew',
      description: 'Help set up chairs and tables.',
      formType: 'oneoff',
      shift_date: '2030-03-01',
      job_start_time: '14:00',
      status: 'open',
    },
  })
  expect(res.status()).toBe(201)
  const body = await res.json()
  expect(body.posting.job_start_time).toBe('14:00:00')
  createdJobIds.push(body.posting.id)
})

test('UC49: accepting an invitation to a one-off job creates a published, open-ended shift', async ({ request }) => {
  const jobRes = await request.post('/api/recruitment', {
    data: {
      company_id: seeded.companyId,
      department_id: departmentId,
      created_by: seeded.ownerId,
      title: 'Promo Table Staff',
      description: 'Hand out flyers at the entrance.',
      formType: 'oneoff',
      shift_date: '2030-03-02',
      job_start_time: '09:00',
      status: 'open',
    },
  })
  expect(jobRes.status()).toBe(201)
  const jobBody = await jobRes.json()
  const jobId = jobBody.posting.id as string
  createdJobIds.push(jobId)

  const guest = await seedGuest('oneoff')
  const { data: applicant, error: applicantError } = await admin
    .from('job_applicants')
    .insert({ job_id: jobId, user_id: guest.userId, status: 'pending' })
    .select()
    .single()
  if (applicantError || !applicant) throw new Error(`Failed to seed applicant: ${applicantError?.message}`)

  const decideRes = await request.patch('/api/recruitment', {
    data: { action: 'decide_applicant', applicant_id: applicant.id, decision: 'accepted', decided_by: seeded.ownerId },
  })
  expect(decideRes.status()).toBe(200)

  const { data: invitation, error: invitationError } = await admin
    .from('job_invitations')
    .select('id')
    .eq('job_id', jobId)
    .eq('applicant_id', applicant.id)
    .single()
  if (invitationError || !invitation) throw new Error(`Failed to find invitation: ${invitationError?.message}`)

  const respondRes = await request.patch(`/api/guest/applications/${applicant.id}/respond`, {
    data: { invitation_id: invitation.id, response: 'accepted' },
  })
  expect(respondRes.status()).toBe(200)

  const { data: promoted } = await admin.from('users').select('role, worker_status').eq('id', guest.userId).single()
  expect(promoted?.role).toBe('Casual Worker')
  expect(promoted?.worker_status).toBe('active')

  const { data: assignment } = await admin
    .from('shift_assignments')
    .select('id, shifts!inner(*)')
    .eq('user_id', guest.userId)
    .single()
  expect(assignment).toBeTruthy()
  const shift = (assignment as any).shifts
  expect(shift.shift_date).toBe('2030-03-02')
  expect(shift.start_time.slice(0, 5)).toBe('09:00')
  expect(shift.end_time.slice(0, 5)).toBe('10:00')
  expect(shift.is_open_ended).toBe(true)
  expect(shift.publication_status).toBe('published')
})

test('UC49: accepting an invitation to a shift job creates a published shift with the real end time, not open-ended', async ({ request }) => {
  const jobRes = await request.post('/api/recruitment', {
    data: {
      company_id: seeded.companyId,
      department_id: departmentId,
      created_by: seeded.ownerId,
      title: 'Weekend Cashier',
      description: 'Run the front register on Saturdays.',
      formType: 'shift',
      is_recurring: true,
      shift_date: '2030-03-03',
      shift_start_time: '08:00',
      shift_end_time: '16:00',
      status: 'open',
    },
  })
  expect(jobRes.status()).toBe(201)
  const jobBody = await jobRes.json()
  const jobId = jobBody.posting.id as string
  createdJobIds.push(jobId)

  const guest = await seedGuest('shift')
  const { data: applicant, error: applicantError } = await admin
    .from('job_applicants')
    .insert({ job_id: jobId, user_id: guest.userId, status: 'pending' })
    .select()
    .single()
  if (applicantError || !applicant) throw new Error(`Failed to seed applicant: ${applicantError?.message}`)

  await request.patch('/api/recruitment', {
    data: { action: 'decide_applicant', applicant_id: applicant.id, decision: 'accepted', decided_by: seeded.ownerId },
  })

  const { data: invitation } = await admin
    .from('job_invitations')
    .select('id')
    .eq('job_id', jobId)
    .eq('applicant_id', applicant.id)
    .single()

  const respondRes = await request.patch(`/api/guest/applications/${applicant.id}/respond`, {
    data: { invitation_id: invitation!.id, response: 'accepted' },
  })
  expect(respondRes.status()).toBe(200)

  const { data: assignment } = await admin
    .from('shift_assignments')
    .select('id, shifts!inner(*)')
    .eq('user_id', guest.userId)
    .single()
  const shift = (assignment as any).shifts
  expect(shift.start_time.slice(0, 5)).toBe('08:00')
  expect(shift.end_time.slice(0, 5)).toBe('16:00')
  expect(shift.is_open_ended).toBe(false)
})
