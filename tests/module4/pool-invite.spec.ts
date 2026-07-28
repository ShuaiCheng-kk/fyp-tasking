import { test, expect } from '@playwright/test'
import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'
import { seedTestOwnerAndCompany, cleanupTestOwnerAndCompany, TestOwner } from '../helpers/seed'

config({ path: '.env.local' })

// "Just call the regulars back": a company's verified worker pool is everyone who actually clocked
// in AND out for it at least once and isn't banned. Postings still go on the public board as
// normal — this is an extra path where the Owner hands one straight to a pool worker, and every
// hard gate a public application clears (ban, age, schedule clash) is re-checked for the invite.
// Hits route.ts -> service -> repository -> Supabase.

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

test.describe.configure({ mode: 'serial' })

let seeded: TestOwner
let departmentId: string
let employeeId: string
// Worked a shift here before -> in the pool.
let regular: { authId: string; userId: string }
// Worked here AND is banned -> must never be offered anything.
let banned: { authId: string; userId: string }
// Confirmed via recruitment but never showed up -> NOT in the pool.
let noShow: { authId: string; userId: string }

const createdJobIds: string[] = []
const createdAuthIds: string[] = []
const createdUserIds: string[] = []
const createdShiftIds: string[] = []

async function seedWorker(label: string, dateOfBirth: string): Promise<{ authId: string; userId: string }> {
  const email = `test-pool-${label}-${Date.now()}@tasking-tests.local`
  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email, password: 'Test-Password-123!', email_confirm: true,
  })
  if (authError || !authData.user) throw new Error(`Failed to create auth user: ${authError?.message}`)
  createdAuthIds.push(authData.user.id)

  const { data: user, error: userError } = await admin
    .from('users')
    .insert({
      supabase_auth_id: authData.user.id,
      full_name: `Pool ${label}`,
      email_address: email,
      role: 'Casual Worker',
      date_of_birth: dateOfBirth,
      skills: 'Barista, Cash register',
    })
    .select('id')
    .single()
  if (userError || !user) throw new Error(`Failed to create user row: ${userError?.message}`)
  createdUserIds.push(user.id)
  return { authId: authData.user.id, userId: user.id }
}

// Puts a worker in the company (the membership row the pool + ban are stamped on).
async function joinCompany(userId: string, opts: { verified: boolean; inactive?: boolean }) {
  const { error } = await admin.from('casualworker_departments').insert({
    casual_worker_id: userId,
    department_id: departmentId,
    company_id: seeded.companyId,
    verified_at: opts.verified ? new Date().toISOString() : null,
    inactive_at: opts.inactive ? new Date().toISOString() : null,
  })
  if (error) throw new Error(`Failed to add to company: ${error.message}`)
}

// A completed past shift (clock in + clock out) — what "has actually worked here" means.
async function recordCompletedShift(userId: string, shiftDate: string) {
  const { data: shift, error: shiftError } = await admin
    .from('shifts')
    .insert({
      company_id: seeded.companyId,
      department_id: departmentId,
      shift_date: shiftDate,
      start_time: '09:00',
      end_time: '17:00',
      title: 'Past completed shift',
      created_by: seeded.ownerId,
      publication_status: 'published',
    })
    .select('id')
    .single()
  if (shiftError || !shift) throw new Error(`Failed to create shift: ${shiftError?.message}`)
  createdShiftIds.push(shift.id)

  const { data: assignment, error: assignmentError } = await admin
    .from('shift_assignments')
    .insert({ shift_id: shift.id, user_id: userId, assigned_by: seeded.ownerId })
    .select('id')
    .single()
  if (assignmentError || !assignment) throw new Error(`Failed to assign shift: ${assignmentError?.message}`)

  // Mirrors what casualAttendanceService.clockIn/clockOut writes: the Casual Worker is recorded as
  // the one who confirmed and submitted their own clock times.
  const { error: attendanceError } = await admin.from('attendance_records').insert({
    shift_assignment_id: assignment.id,
    casual_worker_id: userId,
    clock_in_time: `${shiftDate}T09:00:00.000Z`,
    clock_out_time: `${shiftDate}T17:00:00.000Z`,
    confirmed_by_employee_id: userId,
    submitted_by_employee_id: userId,
    status: 'submitted',
    owner_status: 'approved',
  })
  if (attendanceError) throw new Error(`Failed to record attendance: ${attendanceError.message}`)
}

async function createPoolJob(request: import('@playwright/test').APIRequestContext, overrides: Record<string, unknown>) {
  const res = await request.post('/api/recruitment', {
    data: {
      company_id: seeded.companyId,
      department_id: departmentId,
      created_by: seeded.ownerId,
      assigned_employee_id: employeeId,
      description: 'Pool invite test posting.',
      status: 'open',
      formType: 'shift',
      ...overrides,
    },
  })
  expect(res.status()).toBe(201)
  const posting = (await res.json()).posting
  createdJobIds.push(posting.id)
  return posting
}

test.beforeAll(async () => {
  seeded = await seedTestOwnerAndCompany('pool-invite')

  const { data: department, error: deptError } = await admin
    .from('departments')
    .insert({ company_id: seeded.companyId, name: 'Cafe' })
    .select('id')
    .single()
  if (deptError || !department) throw new Error(`Failed to create department: ${deptError?.message}`)
  departmentId = department.id

  const employee = await seedWorker('supervisor', '1990-01-01')
  await admin.from('users').update({ role: 'Employee', company_id: seeded.companyId }).eq('id', employee.userId)
  employeeId = employee.userId

  regular = await seedWorker('regular', '1998-03-03')
  await joinCompany(regular.userId, { verified: true })
  await recordCompletedShift(regular.userId, '2026-01-10')

  banned = await seedWorker('banned', '1997-04-04')
  await joinCompany(banned.userId, { verified: true, inactive: true })
  await recordCompletedShift(banned.userId, '2026-01-11')

  noShow = await seedWorker('noshow', '1996-05-05')
  await joinCompany(noShow.userId, { verified: false })
})

test.afterAll(async () => {
  if (createdJobIds.length > 0) {
    const { data: invitationRows } = await admin.from('job_invitations').select('id').in('job_id', createdJobIds)
    if ((invitationRows ?? []).length > 0) {
      await admin.from('job_invitations').delete().in('job_id', createdJobIds)
    }
    await admin.from('job_applicants').delete().in('job_id', createdJobIds)
  }
  // Shifts the confirm flow auto-created for the posting, plus the seeded past shifts.
  const { data: allShifts } = await admin.from('shifts').select('id').eq('company_id', seeded.companyId)
  const shiftIds = [...new Set([...(allShifts ?? []).map(s => s.id as string), ...createdShiftIds])]
  if (shiftIds.length > 0) {
    const { data: assignments } = await admin.from('shift_assignments').select('id').in('shift_id', shiftIds)
    const assignmentIds = (assignments ?? []).map(a => a.id as string)
    if (assignmentIds.length > 0) {
      await admin.from('attendance_records').delete().in('shift_assignment_id', assignmentIds)
    }
    await admin.from('shift_assignments').delete().in('shift_id', shiftIds)
    await admin.from('shifts').delete().in('id', shiftIds)
  }
  if (createdJobIds.length > 0) {
    await admin.from('job_postings').delete().in('id', createdJobIds)
  }
  for (const userId of createdUserIds) {
    await admin.from('users').delete().eq('id', userId)
  }
  for (const authId of createdAuthIds) {
    await admin.auth.admin.deleteUser(authId).catch(() => undefined)
  }
  await admin.from('departments').delete().eq('id', departmentId)
  await cleanupTestOwnerAndCompany(seeded)
})

test('the pool lists only workers who actually completed a shift here, and never the banned ones', async ({ request }) => {
  const res = await request.get(`/api/recruitment?resource=pool_workers&company_id=${seeded.companyId}`)
  expect(res.status()).toBe(200)
  const { poolWorkers } = await res.json()

  const ids = poolWorkers.map((w: { id: string }) => w.id)
  expect(ids).toContain(regular.userId)
  // Confirmed a job but never showed up — not proven, so not in the pool.
  expect(ids).not.toContain(noShow.userId)
  // Banned — must never be offered work again.
  expect(ids).not.toContain(banned.userId)

  // The pool card carries the "done it N times before" signal the Owner picks on.
  const me = poolWorkers.find((w: { id: string }) => w.id === regular.userId)
  expect(me.completed_shifts).toBe(1)
  expect(me.last_worked_date).toBe('2026-01-10')
  expect(me.skills).toBe('Barista, Cash register')
})

test('inviting a pool worker records the application for them and they confirm it into a real shift', async ({ request }) => {
  const job = await createPoolJob(request, {
    title: 'Regulars Only Shift',
    shift_date: '2030-06-15',
    shift_start_time: '10:00',
    shift_end_time: '18:00',
    openings: 1,
  })

  const invite = await request.patch('/api/recruitment', {
    data: {
      action: 'invite_pool_workers',
      job_id: job.id,
      user_ids: [regular.userId],
      sent_by: seeded.ownerId,
      message: 'You have worked with us before — come back?',
    },
  })
  expect(invite.status()).toBe(200)
  const { results } = await invite.json()
  expect(results).toEqual([
    expect.objectContaining({ user_id: regular.userId, invited: true, reason: null }),
  ])

  // The offer lands as an application already accepted by the Owner, plus an invitation to confirm.
  const { data: applicant } = await admin
    .from('job_applicants')
    .select('id, status, skills')
    .eq('job_id', job.id).eq('user_id', regular.userId).single()
  expect(applicant?.status).toBe('accepted')
  expect(applicant?.skills).toBe('Barista, Cash register')

  const { data: invitation } = await admin
    .from('job_invitations')
    .select('id, status')
    .eq('job_id', job.id).eq('applicant_id', applicant!.id).single()
  expect(invitation?.status).toBe('sent')

  // Worker confirms — the existing two-way-confirm chain takes over and schedules the shift.
  const confirm = await request.patch(`/api/guest/applications/${applicant!.id}/respond`, {
    data: { invitation_id: invitation!.id, response: 'accepted' },
  })
  expect(confirm.status()).toBe(200)

  const { data: confirmed } = await admin
    .from('job_invitations').select('status').eq('id', invitation!.id).single()
  expect(confirmed?.status).toBe('accepted')

  const { data: shift } = await admin
    .from('shifts')
    .select('id, shift_date')
    .eq('source_job_posting_id', job.id)
    .maybeSingle()
  expect(shift?.shift_date).toBe('2030-06-15')
})

test('a pool invite is refused for a banned worker and for one already booked at that time', async ({ request }) => {
  // regular is now confirmed on 2030-06-15 10:00-18:00 from the previous test.
  const clashing = await createPoolJob(request, {
    title: 'Clashing Pool Shift',
    shift_date: '2030-06-15',
    shift_start_time: '12:00',
    shift_end_time: '20:00',
  })

  const invite = await request.patch('/api/recruitment', {
    data: {
      action: 'invite_pool_workers',
      job_id: clashing.id,
      user_ids: [regular.userId, banned.userId],
      sent_by: seeded.ownerId,
    },
  })
  expect(invite.status()).toBe(200)
  const { results } = await invite.json()

  // Already working that day for this very company — the Owner cannot double-book them.
  const regularResult = results.find((r: { user_id: string }) => r.user_id === regular.userId)
  expect(regularResult.invited).toBe(false)
  expect(regularResult.reason).toContain('clashes')

  // Banned workers are refused outright.
  const bannedResult = results.find((r: { user_id: string }) => r.user_id === banned.userId)
  expect(bannedResult.invited).toBe(false)

  // Neither got an invitation.
  const { data: invitations } = await admin
    .from('job_invitations').select('id').eq('job_id', clashing.id)
  expect(invitations ?? []).toHaveLength(0)
})
