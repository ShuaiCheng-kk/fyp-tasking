import { test, expect } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'
import { seedTestOwnerAndCompany, cleanupTestOwnerAndCompany, TestOwner } from '../helpers/seed'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

type SeededWorker = { authUserId: string; userId: string; email: string }

let seeded: TestOwner
let departmentId: string
let casual: SeededWorker
let shiftIds: string[] = []
let jobPostingId: string
let applicantId: string

test.describe.configure({ mode: 'serial' })

async function createUser(role: string, label: string): Promise<SeededWorker> {
  const email = `test-module7-${label}-${Date.now()}@tasking-tests.local`
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
      full_name: `Module 7 ${label}`,
      email_address: email,
      phone_number: null,
      role,
      company_id: seeded.companyId,
      worker_status: role === 'Casual Worker' ? 'active' : null,
      hourly_rate: 15,
    })
    .select()
    .single()
  if (userError || !user) throw new Error(`Failed to create user row: ${userError?.message}`)

  return { authUserId: authData.user.id, userId: user.id as string, email }
}

test.beforeAll(async () => {
  seeded = await seedTestOwnerAndCompany('module7')

  const { data: department, error: deptError } = await admin
    .from('departments')
    .insert({ company_id: seeded.companyId, name: 'Module 7 Dept' })
    .select('id')
    .single()
  if (deptError || !department) throw new Error(`Failed to create department: ${deptError?.message}`)
  departmentId = department.id as string

  await admin.from('manager_departments').insert({ manager_id: seeded.ownerId, department_id: departmentId, company_id: seeded.companyId }).select()

  casual = await createUser('Casual Worker', 'casual')

  // A shift already in the past so it is judgeable for attendance, with a real flat rate.
  const { data: shift, error: shiftError } = await admin
    .from('shifts')
    .insert({
      company_id: seeded.companyId,
      department_id: departmentId,
      shift_date: '2026-07-08',
      start_time: '09:00',
      end_time: '17:00',
      title: 'Module 7 Test Shift',
      created_by: seeded.ownerId,
      publication_status: 'published',
      flat_rate: 120,
    })
    .select('id')
    .single()
  if (shiftError || !shift) throw new Error(`Failed to create shift: ${shiftError?.message}`)
  shiftIds.push(shift.id as string)

  const { data: assignment, error: assignmentError } = await admin
    .from('shift_assignments')
    .insert({ shift_id: shift.id, user_id: casual.userId, assigned_by: seeded.ownerId, assignment_status: 'accepted' })
    .select('id')
    .single()
  if (assignmentError || !assignment) throw new Error(`Failed to create assignment: ${assignmentError?.message}`)

  // Clocked in on time, worked the full shift — a countable, present attendance record.
  await admin.from('attendance_records').insert({
    shift_assignment_id: assignment.id,
    casual_worker_id: casual.userId,
    clock_in_time: '2026-07-08T09:05:00Z',
    clock_out_time: '2026-07-08T17:00:00Z',
    confirmed_by_employee_id: seeded.ownerId,
    submitted_by_employee_id: seeded.ownerId,
    status: 'owner_approved',
    owner_status: 'approved',
  })

  // A shift attended BEFORE the period — makes the casual worker count as "rehired" in-range.
  const { data: priorShift, error: priorShiftError } = await admin
    .from('shifts')
    .insert({
      company_id: seeded.companyId,
      department_id: departmentId,
      shift_date: '2026-06-20',
      start_time: '09:00',
      end_time: '17:00',
      title: 'Module 7 Prior Shift',
      created_by: seeded.ownerId,
      publication_status: 'published',
      flat_rate: 120,
    })
    .select('id')
    .single()
  if (priorShiftError || !priorShift) throw new Error(`Failed to create prior shift: ${priorShiftError?.message}`)
  shiftIds.push(priorShift.id as string)

  const { data: priorAssignment, error: priorAssignmentError } = await admin
    .from('shift_assignments')
    .insert({ shift_id: priorShift.id, user_id: casual.userId, assigned_by: seeded.ownerId, assignment_status: 'accepted' })
    .select('id')
    .single()
  if (priorAssignmentError || !priorAssignment) throw new Error(`Failed to create prior assignment: ${priorAssignmentError?.message}`)

  await admin.from('attendance_records').insert({
    shift_assignment_id: priorAssignment.id,
    casual_worker_id: casual.userId,
    clock_in_time: '2026-06-20T09:00:00Z',
    clock_out_time: '2026-06-20T17:00:00Z',
    confirmed_by_employee_id: seeded.ownerId,
    submitted_by_employee_id: seeded.ownerId,
    status: 'owner_approved',
    owner_status: 'approved',
  })

  // A task in the same department, assigned to the casual worker, completed on time.
  await admin.from('tasks').insert({
    company_id: seeded.companyId,
    department_id: departmentId,
    title: 'Module 7 Test Task',
    status: 'Complete',
    percentage_complete: 100,
    due_at: '2026-07-09T17:00:00Z',
    completed_at: '2026-07-08T17:00:00Z',
    task_date: '2026-07-08',
    assigned_by: seeded.ownerId,
    assigned_user_id: casual.userId,
  })

  // A job posting created inside the period, with one accepted+confirmed applicant.
  const { data: posting, error: postingError } = await admin
    .from('job_postings')
    .insert({
      company_id: seeded.companyId,
      department_id: departmentId,
      created_by: seeded.ownerId,
      title: 'Module 7 Test Posting',
      description: 'Test posting for report module',
      status: 'open',
      openings: 1,
      created_at: '2026-07-07T09:00:00Z',
    })
    .select('id')
    .single()
  if (postingError || !posting) throw new Error(`Failed to create job posting: ${postingError?.message}`)
  jobPostingId = posting.id as string

  const { data: applicant, error: applicantError } = await admin
    .from('job_applicants')
    .insert({
      job_id: jobPostingId,
      user_id: casual.userId,
      status: 'accepted',
      applied_at: '2026-07-07T10:00:00Z',
    })
    .select('id')
    .single()
  if (applicantError || !applicant) throw new Error(`Failed to create applicant: ${applicantError?.message}`)
  applicantId = applicant.id as string

  await admin.from('job_invitations').insert({
    job_id: jobPostingId,
    applicant_id: applicantId,
    sent_by: seeded.ownerId,
    status: 'accepted',
    sent_at: '2026-07-07T12:00:00Z',
    responded_at: '2026-07-08T09:00:00Z',
  })
})

test.afterAll(async () => {
  await admin.from('job_invitations').delete().eq('job_id', jobPostingId)
  await admin.from('job_applicants').delete().eq('job_id', jobPostingId)
  await admin.from('job_postings').delete().eq('id', jobPostingId)
  await admin.from('tasks').delete().eq('company_id', seeded.companyId)

  if (shiftIds.length > 0) {
    const { data: assignmentRows } = await admin.from('shift_assignments').select('id').in('shift_id', shiftIds)
    const assignmentIds = (assignmentRows ?? []).map(a => a.id as string)
    if (assignmentIds.length > 0) await admin.from('attendance_records').delete().in('shift_assignment_id', assignmentIds)
    await admin.from('shift_assignments').delete().in('shift_id', shiftIds)
    await admin.from('shifts').delete().in('id', shiftIds)
  }

  await admin.from('manager_departments').delete().eq('company_id', seeded.companyId)
  await admin.from('users').delete().eq('id', casual.userId)
  await admin.auth.admin.deleteUser(casual.authUserId).catch(() => undefined)

  await cleanupTestOwnerAndCompany(seeded)
})

test('UC62 GET /api/report/company returns real, computed workforce analytics for the period', async ({ request }) => {
  const res = await request.get(
    `/api/report/company?company_id=${seeded.companyId}&date_from=2026-07-07&date_to=2026-07-13`,
  )
  expect(res.ok()).toBeTruthy()
  const body = await res.json()
  expect(body.success).toBe(true)

  const { report } = body
  expect(report.period).toEqual({ date_from: '2026-07-07', date_to: '2026-07-13' })
  expect(report.previous_period).toEqual({ date_from: '2026-06-30', date_to: '2026-07-06' })

  // Overview: one countable, on-time, present casual attendance → 100%; one on-time task → 100%;
  // one opening fully confirmed → 100% fill rate; real flat-rate labor cost of 120.
  expect(report.overview.attendance_rate).toBe(100)
  expect(report.overview.on_time_completion_rate).toBe(100)
  expect(report.overview.recruitment_fill_rate).toBe(100)
  expect(report.overview.labor_cost).toBe(120)
  expect(report.overview.uncosted_assignments).toBe(0)

  // Department row must exist, be attributed to the seeded department, and show the same
  // real cost and completion numbers rolled up by department. (UC64 Export Report reuses this
  // same report data client-side to build a PDF — see tests/module7/report-ui.spec.ts.)
  const dept = report.departments.find((d: { department_id: string }) => d.department_id === departmentId)
  expect(dept).toBeTruthy()
  expect(dept.tasks_total).toBe(1)
  expect(dept.tasks_completed).toBe(1)
  expect(dept.on_time_rate).toBe(100)
  expect(dept.labor_cost).toBe(120)
  expect(dept.manager_names).toContain(`Test Owner module7`)

  // Casual-worker block: the funnel and fill rate reflect the seeded posting/applicant/invitation,
  // and the worked casual worker shows up as reliable (no late/absent/rejected).
  expect(report.casual.funnel).toEqual({ applied: 1, accepted: 1, confirmed: 1 })
  expect(report.casual.fill_rate).toBe(100)
  const worker = report.casual.workers.find((w: { user_id: string }) => w.user_id === casual.userId)
  expect(worker).toMatchObject({ worked: 1, late: 0, absent: 0, rejected_shifts: 0 })
  const posting = report.casual.postings.find((p: { posting_id: string }) => p.posting_id === jobPostingId)
  expect(posting).toMatchObject({ applicants: 1, accepted: 1, confirmed: 1, openings: 1 })
  expect(posting.days_to_fill).not.toBeNull()

  // Casual Worker Pool Analytics — per-worker KPIs. The one worked casual worker attended a
  // shift before the period (rehired), was never late/absent, and completed his one
  // deadline-in-period task on time → all four rates are 100.
  expect(report.overview.casual_rehire_rate).toBe(100)
  expect(report.overview.casual_on_time_attendance_rate).toBe(100)
  expect(report.overview.casual_reliable_worker_rate).toBe(100)
  expect(report.overview.casual_on_time_task_completion_rate).toBe(100)
  // Nobody worked in the previous period → null, never a fake 0%.
  expect(report.previous_overview.casual_rehire_rate).toBeNull()
})

test('UC62 department filter scopes the report to a single department', async ({ request }) => {
  const res = await request.get(
    `/api/report/company?company_id=${seeded.companyId}&date_from=2026-07-07&date_to=2026-07-13&department_id=${departmentId}`,
  )
  const body = await res.json()
  expect(body.success).toBe(true)
  expect(body.report.departments.every((d: { department_id: string | null }) => d.department_id === departmentId)).toBe(true)
})

test('rejects a range where date_from is after date_to', async ({ request }) => {
  const res = await request.get(
    `/api/report/company?company_id=${seeded.companyId}&date_from=2026-07-13&date_to=2026-07-07`,
  )
  expect(res.status()).toBe(400)
})

test('UC63 GET /api/ai/anomalies analyzes the same real report data and returns structured anomalies', async ({ request }) => {
  const res = await request.get(
    `/api/ai/anomalies?company_id=${seeded.companyId}&date_from=2026-07-07&date_to=2026-07-13`,
  )
  expect(res.ok()).toBeTruthy()
  const body = await res.json()
  expect(body.success).toBe(true)
  expect(Array.isArray(body.anomalies)).toBe(true)
  for (const anomaly of body.anomalies) {
    expect(anomaly).toHaveProperty('id')
    expect(['Dashboard', 'Report', 'Attendance', 'Recruitment']).toContain(anomaly.area)
    expect(['low', 'medium', 'high']).toContain(anomaly.severity)
    expect(typeof anomaly.title).toBe('string')
    expect(Array.isArray(anomaly.evidence)).toBe(true)
    expect(typeof anomaly.recommended_action).toBe('string')
  }
})
