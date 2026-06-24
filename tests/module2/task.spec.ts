import { test, expect, APIRequestContext } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'
import { seedTestOwnerAndCompany, cleanupTestOwnerAndCompany, TestOwner } from '../helpers/seed'

// Integration tests for Module 2 - Task (UC15-21, UC23-28). UC22 Create Sub Task is not yet covered.
// Hits route.ts -> service -> repository -> Supabase, keeping AI assignment deterministic through service fallback.

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

test.describe.configure({ mode: 'serial' })

type SeededMember = {
  authUserId: string
  userId: string
}

let seeded: TestOwner
let departmentId: string
let shiftId: string
let taskId: string
let dependencyTaskId: string
let managerA: SeededMember
let managerB: SeededMember

async function createManager(label: string): Promise<SeededMember> {
  const email = `test-module2-manager-${label}-${Date.now()}@tasking-tests.local`
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
      full_name: `Module 2 Manager ${label}`,
      email_address: email,
      phone_number: null,
      role: 'Manager',
      company_id: seeded.companyId,
    })
    .select()
    .single()
  if (userError || !user) throw new Error(`Failed to create manager row: ${userError?.message}`)

  const { error: managerDeptError } = await admin
    .from('manager_departments')
    .insert({ manager_id: user.id, company_id: seeded.companyId, department_id: departmentId, assigned_by: seeded.ownerId })
  if (managerDeptError) throw new Error(`Failed to assign manager department: ${managerDeptError.message}`)

  return { authUserId: authData.user.id, userId: user.id as string }
}

async function createTask(request: APIRequestContext, overrides: Record<string, unknown> = {}) {
  const res = await request.post('/api/task', {
    data: {
      company_id: seeded.companyId,
      department_id: departmentId,
      shift_id: shiftId,
      title: 'Prep opening checklist',
      description: 'Make sure all stations are ready.',
      assigned_user_id: managerA.userId,
      assigned_by: seeded.ownerId,
      priority: 'High',
      task_date: '2026-07-01',
      due_at: '2026-07-01T18:00:00.000Z',
      ...overrides,
    },
  })
  expect(res.status()).toBe(201)
  const body = await res.json()
  expect(body.success).toBe(true)
  return body.task as { id: string }
}

test.beforeAll(async () => {
  seeded = await seedTestOwnerAndCompany('module2')

  const { data: department, error: deptError } = await admin
    .from('departments')
    .insert({ company_id: seeded.companyId, name: 'Operations' })
    .select('id')
    .single()
  if (deptError || !department) throw new Error(`Failed to create department: ${deptError?.message}`)
  departmentId = department.id

  managerA = await createManager('a')
  managerB = await createManager('b')

  const { data: shift, error: shiftError } = await admin
    .from('shifts')
    .insert({
      company_id: seeded.companyId,
      department_id: departmentId,
      shift_date: '2026-07-01',
      start_time: '09:00',
      end_time: '17:00',
      title: 'Module 2 Test Shift',
      created_by: seeded.ownerId,
      publication_status: 'draft',
    })
    .select('id')
    .single()
  if (shiftError || !shift) throw new Error(`Failed to create shift: ${shiftError?.message}`)
  shiftId = shift.id
})

test.afterAll(async () => {
  await admin.from('tasks').delete().eq('company_id', seeded.companyId)
  await admin.from('shift_assignments').delete().eq('shift_id', shiftId)
  await admin.from('shifts').delete().eq('id', shiftId)
  await admin.from('manager_departments').delete().eq('company_id', seeded.companyId)
  for (const member of [managerA, managerB]) {
    await admin.from('users').delete().eq('id', member.userId)
    await admin.auth.admin.deleteUser(member.authUserId).catch(() => undefined)
  }
  await cleanupTestOwnerAndCompany(seeded)
})

test('UC15 assigns a task on a shift', async ({ request }) => {
  const task = await createTask(request)
  taskId = task.id

  const byShift = await request.get(`/api/task?company_id=${seeded.companyId}&shift_id=${shiftId}`)
  expect(byShift.status()).toBe(200)
  const body = await byShift.json()
  expect(body.tasks).toEqual(expect.arrayContaining([expect.objectContaining({ id: taskId, shift_id: shiftId })]))
})

test('UC16 views the task Kanban board', async ({ request }) => {
  const res = await request.get(`/api/task?company_id=${seeded.companyId}&kanban=true`)
  expect(res.status()).toBe(200)
  const body = await res.json()
  expect(body.groups.Assigned).toEqual(expect.arrayContaining([expect.objectContaining({ id: taskId })]))
})

test('UC17 edits a task', async ({ request }) => {
  const res = await request.patch('/api/task', {
    data: {
      id: taskId,
      title: 'Prep closing checklist',
      percentage_complete: 25,
    },
  })
  expect(res.status()).toBe(200)
  const body = await res.json()
  expect(body.task).toMatchObject({ id: taskId, title: 'Prep closing checklist', percentage_complete: 25 })
})

test('UC19 duplicates a task', async ({ request }) => {
  const res = await request.post('/api/task', {
    data: { action: 'duplicate', id: taskId, assigned_by: seeded.ownerId },
  })
  expect(res.status()).toBe(201)
  const body = await res.json()
  expect(body.task).toMatchObject({ title: 'Prep closing checklist (copy)', status: 'Assigned', percentage_complete: 0 })
})

test('UC20 creates recurring task copies', async ({ request }) => {
  const res = await request.post('/api/task', {
    data: {
      action: 'recurring',
      id: taskId,
      recurrence_rule: 'weekly',
      recurrence_end_date: '2026-07-15',
      assigned_by: seeded.ownerId,
    },
  })
  expect(res.status()).toBe(201)
  const body = await res.json()
  expect(body.tasks.map((task: { task_date: string }) => task.task_date)).toEqual(['2026-07-08', '2026-07-15'])
})

test('UC23 returns tasks in calendar range', async ({ request }) => {
  const res = await request.get(`/api/task?company_id=${seeded.companyId}&calendar=true&date_from=2026-07-01&date_to=2026-07-08`)
  expect(res.status()).toBe(200)
  const body = await res.json()
  expect(body.tasks).toEqual(expect.arrayContaining([
    expect.objectContaining({ id: taskId, calendar_date: '2026-07-01' }),
  ]))
})

test('UC24 generates an AI task assignment suggestion', async ({ request }) => {
  const res = await request.post('/api/ai/assign', {
    data: {
      company_id: seeded.companyId,
      title: 'Prepare VIP booking',
      description: 'Coordinate staffing and room setup.',
      priority: 'High',
      people_needed: 1,
      task_date: '2026-07-01',
    },
  })
  expect(res.status()).toBe(200)
  const body = await res.json()
  expect(body.success).toBe(true)
  expect(body.suggestion.department_id).toBe(departmentId)
  expect(body.suggestion.suggested_manager_ids).toContain(managerB.userId)
  expect(body.suggestion.steps.length).toBeGreaterThan(0)
})

test('UC25 shows a workload rebalancing suggestion', async ({ request }) => {
  await createTask(request, { title: 'Extra active task', shift_id: null })
  await createTask(request, { title: 'Lightly loaded manager task', shift_id: null, assigned_user_id: managerB.userId })

  const res = await request.get(`/api/task?company_id=${seeded.companyId}&suggestion=workload`)
  expect(res.status()).toBe(200)
  const body = await res.json()
  expect(body.suggestion).toMatchObject({
    type: 'rebalance',
    overloaded_user_id: managerA.userId,
    recommended_user_id: managerB.userId,
  })
})

test('UC26 shows a task reassignment suggestion', async ({ request }) => {
  const res = await request.get(`/api/task?company_id=${seeded.companyId}&suggestion=reassignment&task_id=${taskId}`)
  expect(res.status()).toBe(200)
  const body = await res.json()
  expect(body.suggestion).toMatchObject({
    task_id: taskId,
    current_assignee_id: managerA.userId,
    recommended_assignee_id: managerB.userId,
  })
})

test('UC27 shows stalled task alerts', async ({ request }) => {
  const res = await request.get(`/api/task?company_id=${seeded.companyId}&suggestion=stalled&stale_after_days=-1`)
  expect(res.status()).toBe(200)
  const body = await res.json()
  expect(body.alerts).toEqual(expect.arrayContaining([expect.objectContaining({ task_id: taskId })]))
})

test('UC28 sets task dependencies', async ({ request }) => {
  const dependency = await createTask(request, { title: 'Dependency task', shift_id: null, assigned_user_id: managerB.userId })
  dependencyTaskId = dependency.id

  const res = await request.patch('/api/task', {
    data: {
      id: taskId,
      action: 'dependencies',
      dependency_ids: [dependencyTaskId],
    },
  })
  expect(res.status()).toBe(200)
  const body = await res.json()
  expect(body.dependencies).toEqual(expect.arrayContaining([
    expect.objectContaining({ id: dependencyTaskId, parent_task_id: taskId }),
  ]))
})

test('UC21 archives a task', async ({ request }) => {
  const res = await request.patch('/api/task', {
    data: { id: taskId, action: 'archive' },
  })
  expect(res.status()).toBe(200)
  const body = await res.json()
  expect(body.task).toMatchObject({ id: taskId, status: 'Complete', percentage_complete: 100 })
})

test('UC18 deletes a task', async ({ request }) => {
  const res = await request.delete(`/api/task?id=${taskId}`)
  expect(res.status()).toBe(200)
  expect(await res.json()).toMatchObject({ success: true })

  const list = await request.get(`/api/task?company_id=${seeded.companyId}`)
  const body = await list.json()
  expect(body.tasks.some((task: { id: string }) => task.id === taskId)).toBe(false)
})
