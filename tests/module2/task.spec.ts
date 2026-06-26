import { test, expect, APIRequestContext } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'
import { seedTestOwnerAndCompany, cleanupTestOwnerAndCompany, TestOwner } from '../helpers/seed'

// Integration tests for Module 2 - Task (UC15-28).
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
let existingSubTaskId: string
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
      assigned_by: seeded.ownerId,
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

test('workload and stalled insights scope to a single department when department_id is passed', async ({ request }) => {
  const { data: otherDept, error: otherDeptError } = await admin
    .from('departments')
    .insert({ company_id: seeded.companyId, name: 'Other Department' })
    .select('id')
    .single()
  if (otherDeptError || !otherDept) throw new Error(`Failed to create other department: ${otherDeptError?.message}`)

  const otherDeptTask = await createTask(request, {
    title: 'Other department balanced task',
    shift_id: null,
    department_id: otherDept.id,
  })

  const workloadOther = await request.get(`/api/task?company_id=${seeded.companyId}&suggestion=workload&department_id=${otherDept.id}`)
  expect(workloadOther.status()).toBe(200)
  const workloadOtherBody = await workloadOther.json()
  expect(workloadOtherBody.suggestion.type).toBe('balanced')

  const workloadOriginal = await request.get(`/api/task?company_id=${seeded.companyId}&suggestion=workload&department_id=${departmentId}`)
  expect(workloadOriginal.status()).toBe(200)
  const workloadOriginalBody = await workloadOriginal.json()
  expect(workloadOriginalBody.suggestion.type).toBe('rebalance')

  const stalledOther = await request.get(`/api/task?company_id=${seeded.companyId}&suggestion=stalled&stale_after_days=-1&department_id=${otherDept.id}`)
  expect(stalledOther.status()).toBe(200)
  const stalledOtherBody = await stalledOther.json()
  expect(stalledOtherBody.alerts).toEqual([expect.objectContaining({ task_id: otherDeptTask.id })])

  await admin.from('tasks').delete().eq('id', otherDeptTask.id)
  await admin.from('departments').delete().eq('id', otherDept.id)
})

test('UC22 creates a sub-task under a parent task', async ({ request }) => {
  const res = await request.post('/api/task', {
    data: {
      company_id: seeded.companyId,
      department_id: departmentId,
      parent_task_id: taskId,
      title: 'Wipe down counters',
      assigned_by: seeded.ownerId,
    },
  })
  expect(res.status()).toBe(201)
  const body = await res.json()
  expect(body.task).toMatchObject({ parent_task_id: taskId, sequence_order: null })
  existingSubTaskId = body.task.id
})

test('UC22 creates a main task together with its sub-tasks in one request', async ({ request }) => {
  const res = await request.post('/api/task', {
    data: {
      company_id: seeded.companyId,
      department_id: departmentId,
      title: 'Open the store',
      assigned_by: seeded.ownerId,
      task_date: '2026-07-02',
      sub_tasks: [{ title: 'Unlock doors' }, { title: 'Turn on lights' }],
    },
  })
  expect(res.status()).toBe(201)
  const body = await res.json()
  const mainTaskId = body.task.id

  const kanban = await request.get(`/api/task?company_id=${seeded.companyId}&kanban=true`)
  const kanbanBody = await kanban.json()
  const allTasks = [...kanbanBody.groups.Assigned, ...kanbanBody.groups['In Progress'], ...kanbanBody.groups.Review, ...kanbanBody.groups.Complete]
  const subTasks = allTasks.filter((t: { parent_task_id: string | null }) => t.parent_task_id === mainTaskId)
  expect(subTasks).toHaveLength(2)
  expect(subTasks.map((t: { title: string }) => t.title).sort()).toEqual(['Turn on lights', 'Unlock doors'])
  expect(subTasks.every((t: { sequence_order: number | null }) => t.sequence_order === 0 || t.sequence_order === 1)).toBe(true)

  await admin.from('tasks').delete().eq('id', mainTaskId)
})

test('UC28 reorders sub-tasks to set their execution dependency', async ({ request }) => {
  // taskId already has "Wipe down counters" from the UC22 sub-task test above —
  // reorder_subtasks requires the full existing set, so it's included here too.
  const subA = await createTask(request, { title: 'Sub A', shift_id: null, parent_task_id: taskId })
  const subB = await createTask(request, { title: 'Sub B', shift_id: null, parent_task_id: taskId })

  const res = await request.patch('/api/task', {
    data: {
      id: taskId,
      action: 'reorder_subtasks',
      sub_task_ids: [subB.id, subA.id, existingSubTaskId],
      assigned_by: seeded.ownerId,
    },
  })
  expect(res.status()).toBe(200)
  const body = await res.json()
  expect(body.subTasks).toEqual(expect.arrayContaining([
    expect.objectContaining({ id: subB.id, sequence_order: 0 }),
    expect.objectContaining({ id: subA.id, sequence_order: 1 }),
    expect.objectContaining({ id: existingSubTaskId, sequence_order: 2 }),
  ]))

  const rejected = await request.patch('/api/task', {
    data: { id: taskId, action: 'reorder_subtasks', sub_task_ids: [subA.id], assigned_by: seeded.ownerId },
  })
  expect(rejected.status()).toBe(400)
})

test('UC21 archives a task without changing its status, and hides it from the Kanban board', async ({ request }) => {
  const before = await request.get(`/api/task?company_id=${seeded.companyId}&kanban=true`)
  const beforeBody = await before.json()
  const statusBeforeArchive = (Object.values(beforeBody.groups).flat() as { id: string; status: string }[])
    .find(t => t.id === taskId)?.status

  const res = await request.patch('/api/task', {
    data: { id: taskId, action: 'archive', assigned_by: seeded.ownerId },
  })
  expect(res.status()).toBe(200)
  const body = await res.json()
  expect(body.task).toMatchObject({ id: taskId, is_archived: true, status: statusBeforeArchive })

  const kanban = await request.get(`/api/task?company_id=${seeded.companyId}&kanban=true`)
  const kanbanBody = await kanban.json()
  const allKanbanIds = (Object.values(kanbanBody.groups).flat() as { id: string }[]).map(t => t.id)
  expect(allKanbanIds).not.toContain(taskId)
})

test('lists the archived task via the archived=true filter', async ({ request }) => {
  const res = await request.get(`/api/task?company_id=${seeded.companyId}&archived=true`)
  expect(res.status()).toBe(200)
  const body = await res.json()
  expect(body.tasks).toEqual(expect.arrayContaining([expect.objectContaining({ id: taskId, is_archived: true })]))
})

test('unarchives a task without changing its status, restoring it to the Kanban board', async ({ request }) => {
  const res = await request.patch('/api/task', {
    data: { id: taskId, action: 'unarchive', assigned_by: seeded.ownerId },
  })
  expect(res.status()).toBe(200)
  const body = await res.json()
  expect(body.task).toMatchObject({ id: taskId, is_archived: false })

  const kanban = await request.get(`/api/task?company_id=${seeded.companyId}&kanban=true`)
  const kanbanBody = await kanban.json()
  const allKanbanIds = (Object.values(kanbanBody.groups).flat() as { id: string }[]).map(t => t.id)
  expect(allKanbanIds).toContain(taskId)
})

test('deleting a main task also deletes its sub-tasks', async ({ request }) => {
  const main = await createTask(request, { title: 'Main task with sub-tasks', shift_id: null })
  const sub1 = await createTask(request, { title: 'Sub 1', shift_id: null, parent_task_id: main.id })
  const sub2 = await createTask(request, { title: 'Sub 2', shift_id: null, parent_task_id: main.id })

  const res = await request.delete(`/api/task?id=${main.id}&assigned_by=${seeded.ownerId}`)
  expect(res.status()).toBe(200)

  const list = await request.get(`/api/task?company_id=${seeded.companyId}`)
  const body = await list.json()
  const remainingIds = body.tasks.map((t: { id: string }) => t.id)
  expect(remainingIds).not.toContain(main.id)
  expect(remainingIds).not.toContain(sub1.id)
  expect(remainingIds).not.toContain(sub2.id)
})

test('deleting the original of a recurring series deletes every sibling occurrence', async ({ request }) => {
  const original = await createTask(request, { title: 'Recurring original', shift_id: null, task_date: '2026-08-01', due_at: '2026-08-01T18:00:00.000Z' })

  const recurRes = await request.post('/api/task', {
    data: {
      action: 'recurring',
      id: original.id,
      recurrence_rule: 'daily',
      recurrence_end_date: '2026-08-03',
      assigned_by: seeded.ownerId,
    },
  })
  expect(recurRes.status()).toBe(201)
  const recurBody = await recurRes.json()
  const siblingIds = recurBody.tasks.map((t: { id: string }) => t.id)
  expect(siblingIds).toHaveLength(2)

  const res = await request.delete(`/api/task?id=${original.id}&assigned_by=${seeded.ownerId}`)
  expect(res.status()).toBe(200)

  const list = await request.get(`/api/task?company_id=${seeded.companyId}`)
  const body = await list.json()
  const remainingIds = body.tasks.map((t: { id: string }) => t.id)
  expect(remainingIds).not.toContain(original.id)
  for (const siblingId of siblingIds) expect(remainingIds).not.toContain(siblingId)
})

test('deleting a sibling occurrence only removes that one occurrence', async ({ request }) => {
  const original = await createTask(request, { title: 'Recurring original 2', shift_id: null, task_date: '2026-08-10', due_at: '2026-08-10T18:00:00.000Z' })

  const recurRes = await request.post('/api/task', {
    data: {
      action: 'recurring',
      id: original.id,
      recurrence_rule: 'daily',
      recurrence_end_date: '2026-08-12',
      assigned_by: seeded.ownerId,
    },
  })
  const recurBody = await recurRes.json()
  const siblingIds = recurBody.tasks.map((t: { id: string }) => t.id)
  expect(siblingIds).toHaveLength(2)

  const res = await request.delete(`/api/task?id=${siblingIds[0]}&assigned_by=${seeded.ownerId}`)
  expect(res.status()).toBe(200)

  const list = await request.get(`/api/task?company_id=${seeded.companyId}`)
  const body = await list.json()
  const remainingIds = body.tasks.map((t: { id: string }) => t.id)
  expect(remainingIds).toContain(original.id)
  expect(remainingIds).not.toContain(siblingIds[0])
  expect(remainingIds).toContain(siblingIds[1])
})

test('recurring with deadline_rule same_day: every occurrence is due the same day at the given time', async ({ request }) => {
  const original = await createTask(request, { title: 'Daily cleaning', shift_id: null, task_date: '2026-09-01', due_at: null })

  const recurRes = await request.post('/api/task', {
    data: {
      action: 'recurring',
      id: original.id,
      recurrence_rule: 'daily',
      recurrence_end_date: '2026-09-02',
      assigned_by: seeded.ownerId,
      deadline_rule: { type: 'same_day', time: '21:00' },
    },
  })
  expect(recurRes.status()).toBe(201)
  const recurBody = await recurRes.json()
  expect(new Date(recurBody.tasks[0].due_at).getTime()).toBe(new Date('2026-09-02T21:00:00').getTime())

  const list = await request.get(`/api/task?company_id=${seeded.companyId}`)
  const body = await list.json()
  const updatedOriginal = body.tasks.find((t: { id: string }) => t.id === original.id)
  expect(new Date(updatedOriginal.due_at).getTime()).toBe(new Date('2026-09-01T21:00:00').getTime())
})

test('recurring with deadline_rule fixed_day: weekly recurrence due every chosen weekday', async ({ request }) => {
  // 2026-09-07 is a Monday
  const original = await createTask(request, { title: 'Weekly report', shift_id: null, task_date: '2026-09-07', due_at: null })

  const recurRes = await request.post('/api/task', {
    data: {
      action: 'recurring',
      id: original.id,
      recurrence_rule: 'weekly',
      recurrence_end_date: '2026-09-14',
      assigned_by: seeded.ownerId,
      deadline_rule: { type: 'fixed_day', weekday: 5, time: '17:00' }, // Friday
    },
  })
  expect(recurRes.status()).toBe(201)
  const recurBody = await recurRes.json()
  expect(new Date(recurBody.tasks[0].due_at).getTime()).toBe(new Date('2026-09-18T17:00:00').getTime())

  const list = await request.get(`/api/task?company_id=${seeded.companyId}`)
  const body = await list.json()
  const updatedOriginal = body.tasks.find((t: { id: string }) => t.id === original.id)
  expect(new Date(updatedOriginal.due_at).getTime()).toBe(new Date('2026-09-11T17:00:00').getTime())
})

test('recurring with deadline_rule fixed_day is rejected outside weekly recurrence', async ({ request }) => {
  const original = await createTask(request, { title: 'Should reject', shift_id: null, task_date: '2026-09-07', due_at: null })

  const recurRes = await request.post('/api/task', {
    data: {
      action: 'recurring',
      id: original.id,
      recurrence_rule: 'daily',
      recurrence_end_date: '2026-09-09',
      assigned_by: seeded.ownerId,
      deadline_rule: { type: 'fixed_day', weekday: 5, time: '17:00' },
    },
  })
  expect(recurRes.status()).toBe(400)
})

test('recurring with deadline_rule relative: due within X days after the occurrence is generated', async ({ request }) => {
  const original = await createTask(request, { title: 'Monthly stock order', shift_id: null, task_date: '2026-09-01', due_at: null })

  const recurRes = await request.post('/api/task', {
    data: {
      action: 'recurring',
      id: original.id,
      recurrence_rule: 'custom',
      custom_interval_days: 30,
      recurrence_end_date: '2026-10-02',
      assigned_by: seeded.ownerId,
      deadline_rule: { type: 'relative', offset_amount: 3, offset_unit: 'days' },
    },
  })
  expect(recurRes.status()).toBe(201)
  const recurBody = await recurRes.json()
  expect(new Date(recurBody.tasks[0].due_at).getTime()).toBe(new Date('2026-10-04T00:00:00').getTime())

  const list = await request.get(`/api/task?company_id=${seeded.companyId}`)
  const body = await list.json()
  const updatedOriginal = body.tasks.find((t: { id: string }) => t.id === original.id)
  expect(new Date(updatedOriginal.due_at).getTime()).toBe(new Date('2026-09-04T00:00:00').getTime())
})

test('UC18 deletes a task', async ({ request }) => {
  const res = await request.delete(`/api/task?id=${taskId}&assigned_by=${seeded.ownerId}`)
  expect(res.status()).toBe(200)
  expect(await res.json()).toMatchObject({ success: true })

  const list = await request.get(`/api/task?company_id=${seeded.companyId}`)
  const body = await list.json()
  expect(body.tasks.some((task: { id: string }) => task.id === taskId)).toBe(false)
})

test('only the user who assigned a task may edit, archive, duplicate, recur, reorder its sub-tasks, or delete it', async ({ request }) => {
  const task = await createTask(request, { title: 'Ownership-locked task', shift_id: null })

  const editRes = await request.patch('/api/task', {
    data: { id: task.id, assigned_by: managerB.userId, title: 'Hijacked title' },
  })
  expect(editRes.status()).toBe(400)

  const archiveRes = await request.patch('/api/task', {
    data: { id: task.id, action: 'archive', assigned_by: managerB.userId },
  })
  expect(archiveRes.status()).toBe(400)

  const duplicateRes = await request.post('/api/task', {
    data: { action: 'duplicate', id: task.id, assigned_by: managerB.userId },
  })
  expect(duplicateRes.status()).toBe(400)

  const recurringRes = await request.post('/api/task', {
    data: { action: 'recurring', id: task.id, recurrence_rule: 'daily', recurrence_end_date: '2026-07-10', assigned_by: managerB.userId },
  })
  expect(recurringRes.status()).toBe(400)

  const reorderRes = await request.patch('/api/task', {
    data: { id: task.id, action: 'reorder_subtasks', sub_task_ids: [], assigned_by: managerB.userId },
  })
  expect(reorderRes.status()).toBe(400)

  const subTaskRes = await request.post('/api/task', {
    data: { company_id: seeded.companyId, department_id: departmentId, parent_task_id: task.id, title: 'Sneaky sub-task', assigned_by: managerB.userId },
  })
  expect(subTaskRes.status()).toBe(400)

  const deleteRes = await request.delete(`/api/task?id=${task.id}&assigned_by=${managerB.userId}`)
  expect(deleteRes.status()).toBe(500)

  // The rightful assigner can still operate on it.
  const ownerEditRes = await request.patch('/api/task', {
    data: { id: task.id, assigned_by: seeded.ownerId, title: 'Legit edit' },
  })
  expect(ownerEditRes.status()).toBe(200)

  await admin.from('tasks').delete().eq('id', task.id)
})
