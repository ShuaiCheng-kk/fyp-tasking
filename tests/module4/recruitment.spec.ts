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
const createdTemplateIds: string[] = []

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
  if (createdTemplateIds.length > 0) {
    await admin.from('job_templates').delete().in('id', createdTemplateIds)
  }
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
  // Links the shift back to the job posting it was hired from — lets an Owner reviewing this
  // CW's attendance later open the exact posting (description, requirements, etc.) that was advertised.
  expect(shift.source_job_posting_id).toBe(jobId)
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
  expect(shift.source_job_posting_id).toBe(jobId)
})

test('GET /api/recruitment?resource=job_posting returns the full posting a shift was hired from', async ({ request }) => {
  const jobRes = await request.post('/api/recruitment', {
    data: {
      company_id: seeded.companyId,
      department_id: departmentId,
      created_by: seeded.ownerId,
      title: 'Stockroom Assistant',
      description: 'Organize incoming deliveries in the stockroom.',
      requirements: 'Able to lift boxes up to 10kg.',
      formType: 'oneoff',
      shift_date: '2030-03-04',
      job_start_time: '09:00',
      status: 'open',
    },
  })
  expect(jobRes.status()).toBe(201)
  const jobBody = await jobRes.json()
  const jobId = jobBody.posting.id as string
  createdJobIds.push(jobId)

  const getRes = await request.get(`/api/recruitment?resource=job_posting&job_id=${jobId}`)
  expect(getRes.status()).toBe(200)
  const getBody = await getRes.json()
  expect(getBody.success).toBe(true)
  expect(getBody.posting).toMatchObject({
    id: jobId,
    title: 'Stockroom Assistant',
    description: 'Organize incoming deliveries in the stockroom.',
    requirements: 'Able to lift boxes up to 10kg.',
  })
})

test('GET /api/recruitment?resource=job_posting 404s for an unknown job id', async ({ request }) => {
  const getRes = await request.get('/api/recruitment?resource=job_posting&job_id=00000000-0000-0000-0000-000000000000')
  expect(getRes.status()).toBe(404)
  const getBody = await getRes.json()
  expect(getBody.success).toBe(false)
})

test('UC36 creates, lists, edits, and deletes a job template', async ({ request }) => {
  const createRes = await request.post('/api/job-template', {
    data: {
      company_id: seeded.companyId,
      created_by: seeded.ownerId,
      name: 'Weekend Cashier Template',
      title: 'Cashier',
      description: 'Run the front register',
      requirements: 'Available weekends',
      employment_type: 'casual',
      form_type: 'shift',
    },
  })
  expect(createRes.status()).toBe(201)
  const created = (await createRes.json()).template
  createdTemplateIds.push(created.id)
  expect(created.name).toBe('Weekend Cashier Template')

  const listRes = await request.get(`/api/job-template?company_id=${seeded.companyId}`)
  expect(listRes.status()).toBe(200)
  const { templates } = await listRes.json()
  expect(templates.some((t: { id: string }) => t.id === created.id)).toBe(true)

  const editRes = await request.patch(`/api/job-template/${created.id}`, {
    data: { name: 'Renamed Template' },
  })
  expect(editRes.status()).toBe(200)
  expect((await editRes.json()).template.name).toBe('Renamed Template')

  const deleteRes = await request.delete(`/api/job-template/${created.id}`)
  expect(deleteRes.status()).toBe(200)
  createdTemplateIds.splice(createdTemplateIds.indexOf(created.id), 1)

  const listAfterDeleteRes = await request.get(`/api/job-template?company_id=${seeded.companyId}`)
  const { templates: templatesAfterDelete } = await listAfterDeleteRes.json()
  expect(templatesAfterDelete.some((t: { id: string }) => t.id === created.id)).toBe(false)
})

test('UC43 persists an application deadline on a job posting', async ({ request }) => {
  const res = await request.post('/api/recruitment', {
    data: {
      company_id: seeded.companyId,
      department_id: departmentId,
      created_by: seeded.ownerId,
      title: 'Holiday Warehouse Staff',
      description: 'Pack and sort seasonal orders.',
      formType: 'shift',
      shift_date: '2030-03-05',
      shift_start_time: '09:00',
      shift_end_time: '17:00',
      status: 'open',
      expires_at: '2030-04-01',
      expiry_preset: '30d',
    },
  })
  expect(res.status()).toBe(201)
  const body = await res.json()
  createdJobIds.push(body.posting.id)
  expect(body.posting.expires_at).toContain('2030-04-01')
  expect(body.posting.expiry_preset).toBe('30d')

  const editRes = await request.patch('/api/recruitment', {
    data: { action: 'edit_posting', job_id: body.posting.id, expires_at: '2030-05-01', expiry_preset: 'custom' },
  })
  expect(editRes.status()).toBe(200)
  const editBody = await editRes.json()
  expect(editBody.posting.expires_at).toContain('2030-05-01')
  expect(editBody.posting.expiry_preset).toBe('custom')
})

test('UC44 view applicant list resolves full_name and email_address from the applicant\'s user account', async ({ request }) => {
  const jobRes = await request.post('/api/recruitment', {
    data: {
      company_id: seeded.companyId,
      department_id: departmentId,
      created_by: seeded.ownerId,
      title: 'Front Desk Assistant',
      description: 'Greet visitors and manage bookings.',
      formType: 'oneoff',
      shift_date: '2030-03-06',
      job_start_time: '09:00',
      status: 'open',
    },
  })
  expect(jobRes.status()).toBe(201)
  const jobId = (await jobRes.json()).posting.id as string
  createdJobIds.push(jobId)

  const guest = await seedGuest('applicant-identity')
  const { data: applicant, error: applicantError } = await admin
    .from('job_applicants')
    .insert({ job_id: jobId, user_id: guest.userId, status: 'pending' })
    .select()
    .single()
  if (applicantError || !applicant) throw new Error(`Failed to seed applicant: ${applicantError?.message}`)

  const listRes = await request.get(`/api/recruitment?resource=applicants&job_id=${jobId}`)
  expect(listRes.status()).toBe(200)
  const { applicants } = await listRes.json()
  expect(applicants).toHaveLength(1)
  expect(applicants[0].full_name).toBe(`Test Guest applicant-identity`)
  expect(applicants[0].email_address).toContain('test-recruitment-guest-applicant-identity')
})

test('UC41/UC42: manager submits a job for approval, owner approves it', async ({ request }) => {
  const jobRes = await request.post('/api/recruitment', {
    data: {
      company_id: seeded.companyId,
      department_id: departmentId,
      created_by: seeded.ownerId,
      title: 'Pending Review Role',
      description: 'Needs owner sign-off before going live.',
      formType: 'oneoff',
      shift_date: '2030-03-07',
      job_start_time: '09:00',
      status: 'pending_approval',
    },
  })
  expect(jobRes.status()).toBe(201)
  const jobId = (await jobRes.json()).posting.id as string
  createdJobIds.push(jobId)

  const pendingRes = await request.get(`/api/recruitment?company_id=${seeded.companyId}&resource=pending_approval`)
  expect(pendingRes.status()).toBe(200)
  const { pendingPostings } = await pendingRes.json()
  expect(pendingPostings.some((p: { id: string }) => p.id === jobId)).toBe(true)

  const approveRes = await request.patch('/api/recruitment', {
    data: { action: 'approve_posting', job_id: jobId },
  })
  expect(approveRes.status()).toBe(200)
  expect((await approveRes.json()).posting.status).toBe('open')
})

test('UC42: owner rejects a pending job posting with a reason', async ({ request }) => {
  const jobRes = await request.post('/api/recruitment', {
    data: {
      company_id: seeded.companyId,
      department_id: departmentId,
      created_by: seeded.ownerId,
      title: 'Needs More Detail Role',
      description: 'Missing pay information.',
      formType: 'oneoff',
      shift_date: '2030-03-08',
      job_start_time: '09:00',
      status: 'pending_approval',
    },
  })
  const jobId = (await jobRes.json()).posting.id as string
  createdJobIds.push(jobId)

  const rejectRes = await request.patch('/api/recruitment', {
    data: { action: 'reject_posting', job_id: jobId, rejection_reason: 'Please add the salary details.' },
  })
  expect(rejectRes.status()).toBe(200)
  const rejectBody = await rejectRes.json()
  expect(rejectBody.posting.status).toBe('rejected')
  expect(rejectBody.posting.rejection_reason).toBe('Please add the salary details.')
})

test('UC37 edits an existing job posting\'s fields', async ({ request }) => {
  const jobRes = await request.post('/api/recruitment', {
    data: {
      company_id: seeded.companyId,
      department_id: departmentId,
      created_by: seeded.ownerId,
      title: 'Title Before Edit',
      description: 'Original description.',
      formType: 'oneoff',
      shift_date: '2030-03-09',
      job_start_time: '09:00',
      status: 'open',
    },
  })
  expect(jobRes.status()).toBe(201)
  const jobId = (await jobRes.json()).posting.id as string
  createdJobIds.push(jobId)

  const editRes = await request.patch('/api/recruitment', {
    data: {
      action: 'edit_posting',
      job_id: jobId,
      title: 'Title After Edit',
      description: 'Updated description.',
      job_start_time: '10:30',
    },
  })
  expect(editRes.status()).toBe(200)
  const editBody = await editRes.json()
  expect(editBody.posting.title).toBe('Title After Edit')
  expect(editBody.posting.description).toBe('Updated description.')
  expect(editBody.posting.job_start_time).toBe('10:30:00')
})

test('UC38 archives and unarchives a job posting', async ({ request }) => {
  const jobRes = await request.post('/api/recruitment', {
    data: {
      company_id: seeded.companyId,
      department_id: departmentId,
      created_by: seeded.ownerId,
      title: 'To Be Archived',
      description: 'Will be archived then restored.',
      formType: 'oneoff',
      shift_date: '2030-03-10',
      job_start_time: '09:00',
      status: 'open',
    },
  })
  const jobId = (await jobRes.json()).posting.id as string
  createdJobIds.push(jobId)

  const archiveRes = await request.patch('/api/recruitment', {
    data: { action: 'archive_posting', job_id: jobId },
  })
  expect(archiveRes.status()).toBe(200)
  const archiveBody = await archiveRes.json()
  expect(archiveBody.posting.status).toBe('archived')
  expect(archiveBody.posting.archived_at).toBeTruthy()

  const unarchiveRes = await request.patch('/api/recruitment', {
    data: { action: 'unarchive_posting', job_id: jobId },
  })
  expect(unarchiveRes.status()).toBe(200)
  const unarchiveBody = await unarchiveRes.json()
  expect(unarchiveBody.posting.status).toBe('open')
  expect(unarchiveBody.posting.archived_at).toBeNull()
})

test('UC39 duplicates a job posting as a new, independently-published copy', async ({ request }) => {
  const jobRes = await request.post('/api/recruitment', {
    data: {
      company_id: seeded.companyId,
      department_id: departmentId,
      created_by: seeded.ownerId,
      title: 'Original Posting To Copy',
      description: 'Source posting for duplication.',
      formType: 'oneoff',
      shift_date: '2030-03-11',
      job_start_time: '09:00',
      status: 'open',
    },
  })
  const jobId = (await jobRes.json()).posting.id as string
  createdJobIds.push(jobId)

  const dupRes = await request.patch('/api/recruitment', {
    data: { action: 'duplicate_posting', job_id: jobId, created_by: seeded.ownerId },
  })
  expect(dupRes.status()).toBe(200)
  const dupBody = await dupRes.json()
  expect(dupBody.posting.id).not.toBe(jobId)
  expect(dupBody.posting.title).toBe('Original Posting To Copy (copy)')
  expect(dupBody.posting.description).toBe('Source posting for duplication.')
  createdJobIds.push(dupBody.posting.id)

  // Archiving the original must not affect the duplicate — they are independent rows.
  await request.patch('/api/recruitment', { data: { action: 'archive_posting', job_id: jobId } })
  const dupAfter = await request.get(`/api/recruitment?resource=job_posting&job_id=${dupBody.posting.id}`)
  expect((await dupAfter.json()).posting.status).toBe('open')
})

test('UC40 saves a job posting as a draft, lists it, then publishes it', async ({ request }) => {
  const draftRes = await request.post('/api/recruitment', {
    data: {
      company_id: seeded.companyId,
      department_id: departmentId,
      created_by: seeded.ownerId,
      title: 'Draft To Publish Later',
      description: 'Not ready to post yet.',
      formType: 'oneoff',
      shift_date: '2030-03-12',
      job_start_time: '09:00',
      status: 'draft',
    },
  })
  expect(draftRes.status()).toBe(201)
  const draftBody = await draftRes.json()
  expect(draftBody.posting.status).toBe('draft')
  const jobId = draftBody.posting.id as string
  createdJobIds.push(jobId)

  const listRes = await request.get(`/api/recruitment?company_id=${seeded.companyId}&resource=drafts&user_id=${seeded.ownerId}`)
  expect(listRes.status()).toBe(200)
  const { drafts } = await listRes.json()
  expect(drafts.some((d: { id: string }) => d.id === jobId)).toBe(true)

  const publishRes = await request.patch('/api/recruitment', {
    data: { action: 'publish_draft', job_id: jobId },
  })
  expect(publishRes.status()).toBe(200)
  expect((await publishRes.json()).posting.status).toBe('open')
})

test('UC40 deletes a draft job posting without publishing it', async ({ request }) => {
  const draftRes = await request.post('/api/recruitment', {
    data: {
      company_id: seeded.companyId,
      department_id: departmentId,
      created_by: seeded.ownerId,
      title: 'Draft To Delete',
      description: 'Will be deleted before publishing.',
      formType: 'oneoff',
      shift_date: '2030-03-13',
      job_start_time: '09:00',
      status: 'draft',
    },
  })
  const jobId = (await draftRes.json()).posting.id as string

  const deleteRes = await request.patch('/api/recruitment', {
    data: { action: 'delete_draft', job_id: jobId },
  })
  expect(deleteRes.status()).toBe(200)

  const listRes = await request.get(`/api/recruitment?company_id=${seeded.companyId}&resource=drafts&user_id=${seeded.ownerId}`)
  const { drafts } = await listRes.json()
  expect(drafts.some((d: { id: string }) => d.id === jobId)).toBe(false)
})
