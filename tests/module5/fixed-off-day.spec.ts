import { test, expect } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'
import { seedTestOwnerAndCompany, cleanupTestOwnerAndCompany, TestOwner } from '../helpers/seed'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

async function createUser(label: string, companyId: string, role: 'Manager' | 'Employee'): Promise<string> {
  const email = `test-offday-${role.toLowerCase()}-${label}-${Date.now()}@tasking-tests.local`
  const { data: authData, error: authErr } = await admin.auth.admin.createUser({
    email, password: 'Test-Password-123!', email_confirm: true,
  })
  if (authErr || !authData.user) throw new Error(`Auth failed: ${authErr?.message}`)

  const { data: user, error: userErr } = await admin.from('users').insert({
    supabase_auth_id: authData.user.id,
    full_name: `OffDay ${role} ${label}`,
    email_address: email,
    role,
    company_id: companyId,
  }).select().single()
  if (userErr || !user) throw new Error(`User insert failed: ${userErr?.message}`)
  return user.id as string
}

// Monday-start convention matching weekStart() in src/lib/schedulingConstants.ts.
function weekStartOf(dateKey: string): string {
  const d = new Date(`${dateKey}T00:00:00`)
  const dow = (d.getDay() + 6) % 7
  d.setDate(d.getDate() - dow)
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function addDaysLocal(dateKey: string, days: number): string {
  const d = new Date(`${dateKey}T00:00:00`)
  d.setDate(d.getDate() + days)
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

test.describe('Fixed Day Off — submission, routing, quota, deadline', () => {
  let seeded: TestOwner
  let departmentId: string
  let managerId: string
  let employeeId: string
  let upcomingMonday: string
  let upcomingTuesday: string

  test.beforeAll(async () => {
    seeded = await seedTestOwnerAndCompany('offday')

    const { data: dept, error: deptErr } = await admin.from('departments').insert({
      name: 'Off Day Dept', color: '#3B82F6', company_id: seeded.companyId,
    }).select().single()
    if (deptErr || !dept) throw new Error(`Dept insert failed: ${deptErr?.message}`)
    departmentId = dept.id as string

    managerId = await createUser('M1', seeded.companyId, 'Manager')
    employeeId = await createUser('E1', seeded.companyId, 'Employee')

    const { error: mgrDeptErr } = await admin.from('manager_departments').insert({
      manager_id: managerId, department_id: departmentId, company_id: seeded.companyId, assigned_by: seeded.ownerId,
    })
    if (mgrDeptErr) throw new Error(`manager_departments insert failed: ${mgrDeptErr.message}`)
    const { error: empDeptErr } = await admin.from('employee_departments').insert({
      employee_id: employeeId, department_id: departmentId, company_id: seeded.companyId,
    })
    if (empDeptErr) throw new Error(`employee_departments insert failed: ${empDeptErr.message}`)

    const todayKey = new Date().toISOString().slice(0, 10)
    const thisWeekStart = weekStartOf(todayKey)
    upcomingMonday = addDaysLocal(thisWeekStart, 7)
    upcomingTuesday = addDaysLocal(upcomingMonday, 1)
  })

  test.afterAll(async () => {
    await admin.from('employee_off_day_requests').delete().eq('company_id', seeded.companyId)
    await admin.from('off_day_quota_settings').delete().eq('company_id', seeded.companyId)
    await admin.from('off_day_submission_deadline').delete().eq('company_id', seeded.companyId)
    await admin.from('manager_departments').delete().eq('company_id', seeded.companyId)
    await admin.from('employee_departments').delete().eq('company_id', seeded.companyId)
    for (const id of [managerId, employeeId]) {
      const { data: u } = await admin.from('users').select('supabase_auth_id').eq('id', id).single()
      await admin.from('users').delete().eq('id', id)
      if (u?.supabase_auth_id) await admin.auth.admin.deleteUser(u.supabase_auth_id).catch(() => undefined)
    }
    await cleanupTestOwnerAndCompany(seeded)
  })

  test('Owner sets the Manager and Employee default quotas to 1 day/week', async ({ request }) => {
    const setEmployee = await request.post('/api/attendance/off-day-settings', {
      data: { action: 'set_default_quota', company_id: seeded.companyId, owner_id: seeded.ownerId, role: 'Employee', max_days_per_week: 1 },
    })
    expect(setEmployee.status()).toBe(200)
    const setManager = await request.post('/api/attendance/off-day-settings', {
      data: { action: 'set_default_quota', company_id: seeded.companyId, owner_id: seeded.ownerId, role: 'Manager', max_days_per_week: 1 },
    })
    expect(setManager.status()).toBe(200)
  })

  test('Employee submits a fixed day off request for the upcoming week — lands as pending', async ({ request }) => {
    const res = await request.post('/api/attendance', {
      data: {
        action: 'submit_fixed_off_day',
        user_id: employeeId,
        company_id: seeded.companyId,
        dates: [upcomingMonday],
      },
    })
    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.request[0]).toMatchObject({ status: 'pending', source: 'submitted', request_date: upcomingMonday })
  })

  test('Manager submits their own fixed day off request', async ({ request }) => {
    const res = await request.post('/api/attendance', {
      data: {
        action: 'submit_fixed_off_day',
        user_id: managerId,
        company_id: seeded.companyId,
        dates: [upcomingTuesday],
      },
    })
    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
  })

  test('Owner queue shows both the Manager- and Employee-submitted requests directly (no Manager review step)', async ({ request }) => {
    const res = await request.get(`/api/attendance?company_id=${seeded.companyId}&resource=fixed_off_days`)
    expect(res.status()).toBe(200)
    const body = await res.json()
    const ids = body.requests.map((r: { user_id: string }) => r.user_id)
    expect(ids).toContain(managerId)
    expect(ids).toContain(employeeId)
  })

  test('Owner approves the Employee off-day request', async ({ request }) => {
    const list = await request.get(`/api/attendance?company_id=${seeded.companyId}&resource=fixed_off_days`)
    const listBody = await list.json()
    const pending = listBody.requests.find((r: { user_id: string; status: string }) => r.user_id === employeeId && r.status === 'pending')
    expect(pending).toBeTruthy()

    const decide = await request.patch('/api/attendance', {
      data: { action: 'decide_fixed_off_day', id: pending.id, reviewer_id: seeded.ownerId, decision: 'approved' },
    })
    expect(decide.status()).toBe(200)
    expect(await decide.json()).toMatchObject({ success: true, request: { status: 'approved' } })
  })

  test('rejects a submission that does not exactly match the configured Employee default quota', async ({ request }) => {
    const setQuota = await request.post('/api/attendance/off-day-settings', {
      data: { action: 'set_default_quota', company_id: seeded.companyId, owner_id: seeded.ownerId, role: 'Employee', max_days_per_week: 1 },
    })
    expect(setQuota.status()).toBe(200)

    const nextWed = addDaysLocal(upcomingMonday, 2)
    const nextThu = addDaysLocal(upcomingMonday, 3)
    const res = await request.post('/api/attendance', {
      data: { action: 'submit_fixed_off_day', user_id: employeeId, company_id: seeded.companyId, dates: [nextWed, nextThu] },
    })
    expect(res.status()).toBe(400)
    const body = await res.json()
    expect(body.message).toContain('exactly 1')
  })

  test('a per-user quota override allows a different day count than the role default', async ({ request }) => {
    const override = await request.post('/api/attendance/off-day-settings', {
      data: { action: 'set_user_quota_override', company_id: seeded.companyId, owner_id: seeded.ownerId, user_id: managerId, max_days_per_week: 2 },
    })
    expect(override.status()).toBe(200)

    const nextWed = addDaysLocal(upcomingMonday, 2)
    const res = await request.post('/api/attendance', {
      data: { action: 'submit_fixed_off_day', user_id: managerId, company_id: seeded.companyId, dates: [upcomingTuesday, nextWed] },
    })
    expect(res.status()).toBe(200)
    expect((await res.json()).success).toBe(true)
  })

  test('Owner batch-approves a Manager weekly submission covering multiple dates with one decision', async ({ request }) => {
    // The Manager submitted [upcomingTuesday, nextWed] in the previous test, landing as two
    // separate rows sharing the same week_start — Owner decides on the whole group at once via ids.
    const list = await request.get(`/api/attendance?company_id=${seeded.companyId}&resource=fixed_off_days`)
    const listBody = await list.json()
    const groupRows = listBody.requests.filter((r: { user_id: string; status: string }) => r.user_id === managerId && r.status === 'pending')
    expect(groupRows.length).toBe(2)
    const ids = groupRows.map((r: { id: string }) => r.id)

    const decide = await request.patch('/api/attendance', {
      data: { action: 'decide_fixed_off_day', ids, reviewer_id: seeded.ownerId, decision: 'approved' },
    })
    expect(decide.status()).toBe(200)
    const decideBody = await decide.json()
    expect(decideBody.success).toBe(true)
    expect(decideBody.requests).toHaveLength(2)
    expect(decideBody.requests.every((r: { status: string }) => r.status === 'approved')).toBe(true)

    const after = await request.get(`/api/attendance?company_id=${seeded.companyId}&resource=fixed_off_days`)
    const afterBody = await after.json()
    const afterRows = afterBody.requests.filter((r: { user_id: string }) => r.user_id === managerId)
    expect(afterRows.every((r: { status: string }) => r.status === 'approved')).toBe(true)
  })

  test('Owner modifies a weekly submission to different dates in the same week', async ({ request }) => {
    const setQuota = await request.post('/api/attendance/off-day-settings', {
      data: { action: 'set_default_quota', company_id: seeded.companyId, owner_id: seeded.ownerId, role: 'Employee', max_days_per_week: 1 },
    })
    expect(setQuota.status()).toBe(200)

    const nextFri = addDaysLocal(upcomingMonday, 4)
    const submit = await request.post('/api/attendance', {
      data: { action: 'submit_fixed_off_day', user_id: employeeId, company_id: seeded.companyId, dates: [nextFri] },
    })
    expect(submit.status()).toBe(200)
    const submitBody = await submit.json()
    const id = submitBody.request[0].id

    const nextSat = addDaysLocal(upcomingMonday, 5)
    const modify = await request.patch('/api/attendance', {
      data: { action: 'decide_fixed_off_day', id, reviewer_id: seeded.ownerId, decision: 'modified', new_date: nextSat },
    })
    expect(modify.status()).toBe(200)
    const modifyBody = await modify.json()
    expect(modifyBody.success).toBe(true)
    expect(modifyBody.request).toMatchObject({ status: 'modified', request_date: nextSat })
  })

  test('Owner modifies a weekly submission to a bonus day in the following week', async ({ request }) => {
    // Isolated user so this doesn't interact with the shared employeeId/managerId state built up by
    // the surrounding tests in this file.
    const spillEmployeeId = await createUser('spill', seeded.companyId, 'Employee')
    const { error: deptErr } = await admin.from('employee_departments').insert({
      employee_id: spillEmployeeId, department_id: departmentId, company_id: seeded.companyId,
    })
    expect(deptErr).toBeNull()

    const setQuota = await request.post('/api/attendance/off-day-settings', {
      data: { action: 'set_default_quota', company_id: seeded.companyId, owner_id: seeded.ownerId, role: 'Employee', max_days_per_week: 1 },
    })
    expect(setQuota.status()).toBe(200)

    const nextWed = addDaysLocal(upcomingMonday, 2)
    const submit = await request.post('/api/attendance', {
      data: { action: 'submit_fixed_off_day', user_id: spillEmployeeId, company_id: seeded.companyId, dates: [nextWed] },
    })
    expect(submit.status()).toBe(200)
    const submitBody = await submit.json()
    const id = submitBody.request[0].id

    const followingMonday = addDaysLocal(upcomingMonday, 7)
    const bonusDay = addDaysLocal(followingMonday, 1)
    const modify = await request.patch('/api/attendance', {
      data: { action: 'decide_fixed_off_day', id, reviewer_id: seeded.ownerId, decision: 'modified', new_date: bonusDay },
    })
    expect(modify.status()).toBe(200)
    const modifyBody = await modify.json()
    expect(modifyBody.success).toBe(true)
    expect(modifyBody.request).toMatchObject({ status: 'modified', request_date: bonusDay })

    // The week-lock is gone entirely — Owner can pick a replacement arbitrarily far out.
    const farOut = addDaysLocal(followingMonday, 30)
    const farModify = await request.patch('/api/attendance', {
      data: { action: 'decide_fixed_off_day', id, reviewer_id: seeded.ownerId, decision: 'modified', new_date: farOut },
    })
    expect(farModify.status()).toBe(200)
    const farModifyBody = await farModify.json()
    expect(farModifyBody.request).toMatchObject({ status: 'modified', request_date: farOut })

    // "Modifying" to the date it already has is really just approving it as requested.
    const reapprove = await request.patch('/api/attendance', {
      data: { action: 'decide_fixed_off_day', id, reviewer_id: seeded.ownerId, decision: 'modified', new_date: farOut },
    })
    expect(reapprove.status()).toBe(200)
    const reapproveBody = await reapprove.json()
    expect(reapproveBody.request).toMatchObject({ status: 'approved', request_date: farOut })

    await admin.from('employee_off_day_requests').delete().eq('user_id', spillEmployeeId)
    await admin.from('employee_departments').delete().eq('employee_id', spillEmployeeId)
    const { data: u } = await admin.from('users').select('supabase_auth_id').eq('id', spillEmployeeId).single()
    await admin.from('users').delete().eq('id', spillEmployeeId)
    if (u?.supabase_auth_id) await admin.auth.admin.deleteUser(u.supabase_auth_id).catch(() => undefined)
  })

  test('AI-suggest analyzes every date in a weekly group together', async ({ request }) => {
    const nextThu = addDaysLocal(upcomingMonday, 3)
    const nextFri = addDaysLocal(upcomingMonday, 4)
    const setQuota = await request.post('/api/attendance/off-day-settings', {
      data: { action: 'set_default_quota', company_id: seeded.companyId, owner_id: seeded.ownerId, role: 'Manager', max_days_per_week: 2 },
    })
    expect(setQuota.status()).toBe(200)
    const removeOverride = await request.post('/api/attendance/off-day-settings', {
      data: { action: 'remove_user_quota_override', company_id: seeded.companyId, owner_id: seeded.ownerId, user_id: managerId },
    })
    expect(removeOverride.status()).toBe(200)
    const managerSubmit = await request.post('/api/attendance', {
      data: { action: 'submit_fixed_off_day', user_id: managerId, company_id: seeded.companyId, dates: [nextThu, nextFri] },
    })
    expect(managerSubmit.status()).toBe(200)
    const managerSubmitBody = await managerSubmit.json()
    const ids = managerSubmitBody.request.map((r: { id: string }) => r.id)

    const ai = await request.post('/api/attendance/ai-suggest', {
      data: { request_type: 'fixed_off_day', ids, company_id: seeded.companyId },
    })
    expect(ai.status()).toBe(200)
    const aiBody = await ai.json()
    expect(aiBody.success).toBe(true)
    expect(['approve', 'modify']).toContain(aiBody.suggestion.recommendation)
    expect(Array.isArray(aiBody.suggestion.alternatives)).toBe(true)
  })

  test('rejects submission once the currently open week has shifted past a closed deadline', async ({ request }) => {
    const todayDow = new Date().getDay()
    const pastDeadlineDow = (todayDow + 6) % 7 // a weekday that already passed this week

    const setDeadline = await request.post('/api/attendance/off-day-settings', {
      data: { action: 'set_deadline', company_id: seeded.companyId, owner_id: seeded.ownerId, deadline_weekday: pastDeadlineDow, deadline_time: '17:00' },
    })
    expect(setDeadline.status()).toBe(200)

    // upcomingMonday's own deadline (this week) has now passed, so the open week has shifted to
    // the week after — submitting for upcomingMonday should be rejected as no longer open.
    const res = await request.post('/api/attendance', {
      data: { action: 'submit_fixed_off_day', user_id: employeeId, company_id: seeded.companyId, dates: [upcomingMonday] },
    })
    expect(res.status()).toBe(400)
    const body = await res.json()
    expect(body.message).toContain('currently open week')
  })
})

test.describe('Fixed Day Off — Owner quota/deadline settings CRUD', () => {
  let seeded: TestOwner
  let managerId: string

  test.beforeAll(async () => {
    seeded = await seedTestOwnerAndCompany('offday-settings')
    managerId = await createUser('M1', seeded.companyId, 'Manager')
  })

  test.afterAll(async () => {
    await admin.from('off_day_quota_settings').delete().eq('company_id', seeded.companyId)
    await admin.from('off_day_submission_deadline').delete().eq('company_id', seeded.companyId)
    const { data: u } = await admin.from('users').select('supabase_auth_id').eq('id', managerId).single()
    await admin.from('users').delete().eq('id', managerId)
    if (u?.supabase_auth_id) await admin.auth.admin.deleteUser(u.supabase_auth_id).catch(() => undefined)
    await cleanupTestOwnerAndCompany(seeded)
  })

  test('sets and reads the Manager and Employee default quotas independently', async ({ request }) => {
    const setManager = await request.post('/api/attendance/off-day-settings', {
      data: { action: 'set_default_quota', company_id: seeded.companyId, owner_id: seeded.ownerId, role: 'Manager', max_days_per_week: 2 },
    })
    expect(setManager.status()).toBe(200)
    const setEmployee = await request.post('/api/attendance/off-day-settings', {
      data: { action: 'set_default_quota', company_id: seeded.companyId, owner_id: seeded.ownerId, role: 'Employee', max_days_per_week: 3 },
    })
    expect(setEmployee.status()).toBe(200)

    const get = await request.get(`/api/attendance/off-day-settings?company_id=${seeded.companyId}&owner_id=${seeded.ownerId}&resource=quota`)
    expect(get.status()).toBe(200)
    const body = await get.json()
    expect(body.settings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ user_id: null, role: 'Manager', max_days_per_week: 2 }),
        expect.objectContaining({ user_id: null, role: 'Employee', max_days_per_week: 3 }),
      ]),
    )
  })

  test('sets a per-user override then resets to the role default by removing it', async ({ request }) => {
    const override = await request.post('/api/attendance/off-day-settings', {
      data: { action: 'set_user_quota_override', company_id: seeded.companyId, owner_id: seeded.ownerId, user_id: managerId, max_days_per_week: 4 },
    })
    expect(override.status()).toBe(200)

    const afterOverride = await request.get(`/api/attendance/off-day-settings?company_id=${seeded.companyId}&owner_id=${seeded.ownerId}&user_id=${managerId}&resource=my_quota`)
    expect((await afterOverride.json()).max_days_per_week).toBe(4)

    const remove = await request.post('/api/attendance/off-day-settings', {
      data: { action: 'remove_user_quota_override', company_id: seeded.companyId, owner_id: seeded.ownerId, user_id: managerId },
    })
    expect(remove.status()).toBe(200)

    const afterRemove = await request.get(`/api/attendance/off-day-settings?company_id=${seeded.companyId}&owner_id=${seeded.ownerId}&user_id=${managerId}&resource=my_quota`)
    const afterRemoveBody = await afterRemove.json()
    expect(afterRemoveBody.max_days_per_week).not.toBe(4)
  })

  test('sets and reads the weekly submission deadline (weekday + time)', async ({ request }) => {
    const set = await request.post('/api/attendance/off-day-settings', {
      data: { action: 'set_deadline', company_id: seeded.companyId, owner_id: seeded.ownerId, deadline_weekday: 2, deadline_time: '17:00' },
    })
    expect(set.status()).toBe(200)

    const get = await request.get(`/api/attendance/off-day-settings?company_id=${seeded.companyId}&owner_id=${seeded.ownerId}&resource=deadline`)
    expect(get.status()).toBe(200)
    const body = await get.json()
    expect(body.deadline).toMatchObject({ deadline_weekday: 2, deadline_time: '17:00' })
  })

  test('rejects quota/deadline changes from a non-Owner', async ({ request }) => {
    const res = await request.post('/api/attendance/off-day-settings', {
      data: { action: 'set_default_quota', company_id: seeded.companyId, owner_id: managerId, role: 'Manager', max_days_per_week: 2 },
    })
    expect(res.status()).toBe(400)
  })
})
