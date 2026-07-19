import { test, expect, APIRequestContext } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'
import { seedTestOwnerAndCompany, cleanupTestOwnerAndCompany, TestOwner } from '../helpers/seed'

// Integration tests for Module 2 - Task (UC12-23).
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
let createdShiftIds: string[] = []
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

async function createShiftAssignmentsForDate(shiftDate: string, userIds = [managerA.userId, managerB.userId]) {
  const { data: shift, error: shiftError } = await admin
    .from('shifts')
    .insert({
      company_id: seeded.companyId,
      department_id: departmentId,
      shift_date: shiftDate,
      start_time: '09:00',
      end_time: '17:00',
      title: `Module 2 Test Shift ${shiftDate}`,
      created_by: seeded.ownerId,
      publication_status: 'published',
    })
    .select('id')
    .single()
  if (shiftError || !shift) throw new Error(`Failed to create shift for ${shiftDate}: ${shiftError?.message}`)
  createdShiftIds.push(shift.id as string)

  const { error: assignmentError } = await admin
    .from('shift_assignments')
    .insert(userIds.map(user_id => ({ shift_id: shift.id, user_id, assigned_by: seeded.ownerId })))
  if (assignmentError) throw new Error(`Failed to create shift assignments for ${shiftDate}: ${assignmentError.message}`)

  return shift.id as string
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
      publication_status: 'published',
    })
    .select('id')
    .single()
  if (shiftError || !shift) throw new Error(`Failed to create shift: ${shiftError?.message}`)
  shiftId = shift.id
  createdShiftIds.push(shiftId)

  // Task assignment now requires the assignee to have a shift on the task's date — both managers
  // need a shift_assignments row on shiftId's date for createTask() to succeed in the tests below.
  const { error: assignmentError } = await admin
    .from('shift_assignments')
    .insert([
      { shift_id: shiftId, user_id: managerA.userId, assigned_by: seeded.ownerId },
      { shift_id: shiftId, user_id: managerB.userId, assigned_by: seeded.ownerId },
    ])
  if (assignmentError) throw new Error(`Failed to create shift assignments: ${assignmentError.message}`)

  for (const date of ['2026-08-01', '2026-08-10', '2026-09-01', '2026-09-07']) {
    await createShiftAssignmentsForDate(date, [managerA.userId])
  }
})

test.afterAll(async () => {
  await admin.from('tasks').delete().eq('company_id', seeded.companyId)
  if (createdShiftIds.length > 0) {
    await admin.from('shift_assignments').delete().in('shift_id', createdShiftIds)
    await admin.from('shifts').delete().in('id', createdShiftIds)
  }
  await admin.from('manager_departments').delete().eq('company_id', seeded.companyId)
  for (const member of [managerA, managerB]) {
    await admin.from('users').delete().eq('id', member.userId)
    await admin.auth.admin.deleteUser(member.authUserId).catch(() => undefined)
  }
  await cleanupTestOwnerAndCompany(seeded)
})

test('UC12 assigns a task on a shift', async ({ request }) => {
  const task = await createTask(request)
  taskId = task.id

  const byShift = await request.get(`/api/task?company_id=${seeded.companyId}&shift_id=${shiftId}`)
  expect(byShift.status()).toBe(200)
  const body = await byShift.json()
  expect(body.tasks).toEqual(expect.arrayContaining([expect.objectContaining({ id: taskId, shift_id: shiftId })]))
})

test('views the task Kanban board', async ({ request }) => {
  const res = await request.get(`/api/task?company_id=${seeded.companyId}&kanban=true`)
  expect(res.status()).toBe(200)
  const body = await res.json()
  expect(body.groups.Assigned).toEqual(expect.arrayContaining([expect.objectContaining({ id: taskId })]))
})

test('UC13 edits a task', async ({ request }) => {
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

test('UC16 duplicates a task', async ({ request }) => {
  const res = await request.post('/api/task', {
    data: { action: 'duplicate', id: taskId, assigned_by: seeded.ownerId },
  })
  expect(res.status()).toBe(201)
  const body = await res.json()
  expect(body.task).toMatchObject({ title: 'Prep closing checklist (copy)', status: 'Assigned', percentage_complete: 0 })
})

test('UC17 creates recurring task copies', async ({ request }) => {
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

test('returns tasks in calendar range', async ({ request }) => {
  const res = await request.get(`/api/task?company_id=${seeded.companyId}&calendar=true&date_from=2026-07-01&date_to=2026-07-08`)
  expect(res.status()).toBe(200)
  const body = await res.json()
  expect(body.tasks).toEqual(expect.arrayContaining([
    expect.objectContaining({ id: taskId, calendar_date: '2026-07-01' }),
  ]))
})

test('UC20 generates an AI task assignment suggestion', async ({ request }) => {
  const res = await request.post('/api/ai/assign', {
    data: {
      company_id: seeded.companyId,
      title: 'Prepare VIP booking',
      description: 'Coordinate staffing and room setup.',
      priority: 'High',
      want_sub_tasks: false,
      task_date: '2026-07-01',
    },
  })
  expect(res.status()).toBe(200)
  const body = await res.json()
  expect(body.success).toBe(true)
  expect(body.suggestion.department_id).toBe(departmentId)
  // recommended_manager_id is whichever of the seeded managers currently has the lighter
  // workload (depends on tasks created by earlier tests in this serial suite), so assert
  // it's a valid candidate rather than hardcoding which one. Both have a published shift on
  // 2026-07-01 (seeded in beforeAll), so both remain eligible candidates.
  expect([managerA.userId, managerB.userId]).toContain(body.suggestion.recommended_manager_id)
  expect(body.suggestion.reason).toBeTruthy()
  expect(body.suggestion.description).toBeTruthy()
  expect(body.suggestion.sub_tasks).toEqual([])
})

test('UC20 excludes managers with no published shift on the given task_date', async ({ request }) => {
  // Only managerA has a shift_assignments row on 2026-08-01 (seeded in beforeAll); managerB
  // never does, so they must never appear as a candidate or be recommended for this date.
  const res = await request.post('/api/ai/assign', {
    data: {
      company_id: seeded.companyId,
      title: 'Restock supplies',
      description: '',
      priority: 'Medium',
      want_sub_tasks: false,
      task_date: '2026-08-01',
    },
  })
  expect(res.status()).toBe(200)
  const body = await res.json()
  expect(body.success).toBe(true)
  expect(body.suggestion.candidates.map((c: { id: string }) => c.id)).toEqual([managerA.userId])
  expect(body.suggestion.recommended_manager_id).toBe(managerA.userId)
})

test('UC20 returns AI-generated sub-tasks when want_sub_tasks is true', async ({ request }) => {
  const res = await request.post('/api/ai/assign', {
    data: {
      company_id: seeded.companyId,
      title: 'Plan and run the quarterly marketing campaign',
      description: 'Coordinate content, channels, and budget across the team.',
      priority: 'High',
      want_sub_tasks: true,
    },
  })
  expect(res.status()).toBe(200)
  const body = await res.json()
  expect(body.success).toBe(true)
  expect(Array.isArray(body.suggestion.sub_tasks)).toBe(true)
})

test('UC21 shows a workload rebalancing suggestion', async ({ request }) => {
  // Urgent + overdue scores far higher than Low + due-in-a-month, so managerA clears the
  // 2x-the-lightest-person threshold regardless of whatever else accumulated earlier in this
  // serial suite.
  const overdue = new Date(Date.now() - 60 * 60 * 1000).toISOString()
  const farOut = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
  await createTask(request, { title: 'Urgent overdue task', shift_id: null, priority: 'Urgent', due_at: overdue })
  await createTask(request, { title: 'Lightly loaded manager task', shift_id: null, assigned_user_id: managerB.userId, priority: 'Low', due_at: farOut })

  const res = await request.get(`/api/task?company_id=${seeded.companyId}&suggestion=workload`)
  expect(res.status()).toBe(200)
  const body = await res.json()
  expect(body.suggestion).toMatchObject({
    type: 'rebalance',
    overloaded_user_id: managerA.userId,
    recommended_user_id: managerB.userId,
  })
  expect(body.suggestions).toEqual(expect.arrayContaining([
    expect.objectContaining({
      type: 'rebalance',
      department_id: departmentId,
      suggested_task_id: expect.any(String),
      reason: expect.any(String),
    }),
  ]))
})

test('UC21 shows a task reassignment suggestion', async ({ request }) => {
  const res = await request.get(`/api/task?company_id=${seeded.companyId}&suggestion=reassignment&task_id=${taskId}`)
  expect(res.status()).toBe(200)
  const body = await res.json()
  expect(body.suggestion).toMatchObject({
    task_id: taskId,
    current_assignee_id: managerA.userId,
    recommended_assignee_id: managerB.userId,
  })
})

test('UC22 shows task delay alerts for tasks still sitting in Assigned', async ({ request }) => {
  // created_at isn't client-settable through the API (DB default) — set it directly so taskId is
  // deterministically past the default 50% threshold of its assigned-to-deadline window.
  const pastHalfway = new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString()
  const dueIn3Hours = new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString()
  await admin.from('tasks').update({ created_at: pastHalfway, due_at: dueIn3Hours, status: 'Assigned' }).eq('id', taskId)

  const res = await request.get(`/api/task?company_id=${seeded.companyId}&suggestion=delay`)
  expect(res.status()).toBe(200)
  const body = await res.json()
  expect(body.alerts).toEqual(expect.arrayContaining([expect.objectContaining({ task_id: taskId })]))
})

test('task delay alert threshold is configurable per company and changes what gets flagged', async ({ request }) => {
  // Default threshold is 50 when the company never customised it.
  const defaults = await request.get(`/api/task?company_id=${seeded.companyId}&delay_threshold=true`)
  expect(defaults.status()).toBe(200)
  expect((await defaults.json()).settings).toEqual({ threshold_percent: 50 })

  // taskId sits at ~62.5% elapsed (set up in UC22 above) — raising the threshold to 80 unflags it.
  const raise = await request.post('/api/task', {
    data: { action: 'set_delay_threshold', company_id: seeded.companyId, threshold_percent: 80, updated_by: seeded.ownerId },
  })
  expect(raise.status()).toBe(200)
  expect((await raise.json()).settings).toEqual({ threshold_percent: 80 })

  const flaggedAt80 = await request.get(`/api/task?company_id=${seeded.companyId}&suggestion=delay`)
  const flaggedAt80Body = await flaggedAt80.json()
  expect(flaggedAt80Body.alerts).not.toEqual(expect.arrayContaining([expect.objectContaining({ task_id: taskId })]))

  // An In Progress task never triggers the alert — the whole point is "hasn't been started".
  await admin.from('tasks').update({ status: 'In Progress' }).eq('id', taskId)
  await request.post('/api/task', {
    data: { action: 'set_delay_threshold', company_id: seeded.companyId, threshold_percent: 10, updated_by: seeded.ownerId },
  })
  const inProgressCheck = await request.get(`/api/task?company_id=${seeded.companyId}&suggestion=delay`)
  const inProgressBody = await inProgressCheck.json()
  expect(inProgressBody.alerts).not.toEqual(expect.arrayContaining([expect.objectContaining({ task_id: taskId })]))
  await admin.from('tasks').update({ status: 'Assigned' }).eq('id', taskId)

  // Out-of-range values are rejected.
  const invalid = await request.post('/api/task', {
    data: { action: 'set_delay_threshold', company_id: seeded.companyId, threshold_percent: 0, updated_by: seeded.ownerId },
  })
  expect(invalid.status()).toBe(400)

  // Restore the default so later tests see the standard behavior.
  await request.post('/api/task', {
    data: { action: 'set_delay_threshold', company_id: seeded.companyId, threshold_percent: 50, updated_by: seeded.ownerId },
  })
})

test('workload and delay insights scope to a single department when department_id is passed', async ({ request }) => {
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

  // created_at isn't client-settable through the API (DB default) — set it directly so the task
  // is deterministically past the halfway point to its deadline, instead of racing real wall-clock
  // time against a short window.
  const pastHalfway = new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString()
  const dueIn3Hours = new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString()
  await admin.from('tasks').update({ created_at: pastHalfway, due_at: dueIn3Hours }).eq('id', otherDeptTask.id)

  const delayOther = await request.get(`/api/task?company_id=${seeded.companyId}&suggestion=delay&department_id=${otherDept.id}`)
  expect(delayOther.status()).toBe(200)
  const delayOtherBody = await delayOther.json()
  expect(delayOtherBody.alerts).toEqual([expect.objectContaining({ task_id: otherDeptTask.id })])

  await admin.from('tasks').delete().eq('id', otherDeptTask.id)
  await admin.from('departments').delete().eq('id', otherDept.id)
})

test('marking a delay alert as read dismisses it until the deadline changes', async ({ request }) => {
  // taskId is Assigned and past the default 50% threshold (set up in UC22 above) — flagged.
  const before = await request.get(`/api/task?company_id=${seeded.companyId}&suggestion=delay`)
  expect((await before.json()).alerts).toEqual(expect.arrayContaining([expect.objectContaining({ task_id: taskId })]))

  // Mark as read → the alert disappears even though the task is still sitting in Assigned.
  const markRead = await request.post('/api/task', {
    data: { action: 'mark_delay_alerts_read', task_ids: [taskId] },
  })
  expect(markRead.status()).toBe(200)
  expect((await markRead.json()).success).toBe(true)

  const after = await request.get(`/api/task?company_id=${seeded.companyId}&suggestion=delay`)
  expect((await after.json()).alerts).not.toEqual(expect.arrayContaining([expect.objectContaining({ task_id: taskId })]))

  // An empty task_ids list is rejected.
  const invalid = await request.post('/api/task', { data: { action: 'mark_delay_alerts_read', task_ids: [] } })
  expect(invalid.status()).toBe(400)

  // Editing the deadline clears the read mark — a new delay window can re-raise the alert.
  const newDue = new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString()
  const edit = await request.patch('/api/task', {
    data: { id: taskId, due_at: newDue, assigned_by: seeded.ownerId },
  })
  expect(edit.status()).toBe(200)

  const reflagged = await request.get(`/api/task?company_id=${seeded.companyId}&suggestion=delay`)
  expect((await reflagged.json()).alerts).toEqual(expect.arrayContaining([expect.objectContaining({ task_id: taskId })]))
})

test('UC19 creates a sub-task under a parent task', async ({ request }) => {
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

test('UC19 creates a main task together with its sub-tasks in one request', async ({ request }) => {
  const res = await request.post('/api/task', {
    data: {
      company_id: seeded.companyId,
      department_id: departmentId,
      title: 'Open the store',
      assigned_user_id: managerA.userId,
      assigned_by: seeded.ownerId,
      task_date: '2026-07-01',
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

test('UC23 reorders sub-tasks to set their execution dependency', async ({ request }) => {
  // taskId already has "Wipe down counters" from the UC19 sub-task test above —
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

test('UC18 archives a task without changing its status, and hides it from the Kanban board', async ({ request }) => {
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

test('UC15 deletes a task', async ({ request }) => {
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

test('completes sub-tasks in order while In Progress, and auto-promotes the parent on the last one', async ({ request }) => {
  const parent = await createTask(request, { title: 'Restock shelves', shift_id: null })
  const subA = await createTask(request, { title: 'Count inventory', shift_id: null, parent_task_id: parent.id })
  const subB = await createTask(request, { title: 'Place orders', shift_id: null, parent_task_id: parent.id })

  // Sub-tasks can't be completed until the parent is In Progress.
  const tooEarly = await request.patch('/api/task', {
    data: { id: subA.id, action: 'complete_subtask', assigned_by: managerA.userId },
  })
  expect(tooEarly.status()).toBe(400)

  const moveToInProgress = await request.patch('/api/task', {
    data: { id: parent.id, status: 'In Progress', percentage_complete: 33 },
  })
  expect(moveToInProgress.status()).toBe(200)

  // Only the parent's assignee may tick a sub-task.
  const wrongUser = await request.patch('/api/task', {
    data: { id: subA.id, action: 'complete_subtask', assigned_by: managerB.userId },
  })
  expect(wrongUser.status()).toBe(400)

  // Ticking out of order is rejected — subB before subA.
  const outOfOrder = await request.patch('/api/task', {
    data: { id: subB.id, action: 'complete_subtask', assigned_by: managerA.userId },
  })
  expect(outOfOrder.status()).toBe(400)

  const firstTick = await request.patch('/api/task', {
    data: { id: subA.id, action: 'complete_subtask', assigned_by: managerA.userId },
  })
  expect(firstTick.status()).toBe(200)
  const firstBody = await firstTick.json()
  expect(firstBody.subTask.is_completed).toBe(true)
  expect(firstBody.parent.status).toBe('In Progress')

  const lastTick = await request.patch('/api/task', {
    data: { id: subB.id, action: 'complete_subtask', assigned_by: managerA.userId },
  })
  expect(lastTick.status()).toBe(200)
  const lastBody = await lastTick.json()
  expect(lastBody.subTask.is_completed).toBe(true)
  expect(lastBody.parent.status).toBe('Review')

  const kanban = await request.get(`/api/task?company_id=${seeded.companyId}&kanban=true`)
  const kanbanBody = await kanban.json()
  const allTasks = [...kanbanBody.groups.Assigned, ...kanbanBody.groups['In Progress'], ...kanbanBody.groups.Review, ...kanbanBody.groups.Complete]
  const refreshedSubA = allTasks.find((t: { id: string }) => t.id === subA.id)
  expect(refreshedSubA.status).toBe('Review')

  await admin.from('tasks').delete().in('id', [subA.id, subB.id, parent.id])
})

test('a task is always assigned to exactly one person — multi-assign and unassign both reject', async ({ request }) => {
  // Creating with two managers is rejected outright.
  const createRes = await request.post('/api/task', {
    data: {
      company_id: seeded.companyId, department_id: departmentId, shift_id: null,
      title: 'Shared prep task', assigned_by: seeded.ownerId,
      task_date: '2026-07-01',
      assigned_user_ids: [managerA.userId, managerB.userId],
    },
  })
  expect(createRes.status()).toBe(400)
  const createBody = await createRes.json()
  expect(createBody.message).toContain('one person')

  // Creating with no assignee at all is rejected too.
  const unassignedRes = await request.post('/api/task', {
    data: {
      company_id: seeded.companyId, department_id: departmentId, shift_id: null,
      title: 'Unassigned prep task', assigned_by: seeded.ownerId,
      task_date: '2026-07-01',
    },
  })
  expect(unassignedRes.status()).toBe(400)
  const unassignedBody = await unassignedRes.json()
  expect(unassignedBody.message).toContain('must be assigned')

  // A single-manager task cannot be edited onto two managers either.
  const task = await createTask(request, { title: 'Single-manager task', shift_id: null })
  const editRes = await request.patch('/api/task', {
    data: { id: task.id, assigned_by: seeded.ownerId, assigned_user_ids: [managerA.userId, managerB.userId] },
  })
  expect(editRes.status()).toBe(400)
  const editBody = await editRes.json()
  expect(editBody.message).toContain('one person')

  // Nor can it be edited into an unassigned task.
  const unassignEditRes = await request.patch('/api/task', {
    data: { id: task.id, assigned_by: seeded.ownerId, assigned_user_ids: [] },
  })
  expect(unassignEditRes.status()).toBe(400)

  // Reassigning to a different single manager still works, and task_assignments follows.
  const reassignRes = await request.patch('/api/task', {
    data: { id: task.id, assigned_by: seeded.ownerId, assigned_user_ids: [managerB.userId] },
  })
  expect(reassignRes.status()).toBe(200)
  const reassignBody = await reassignRes.json()
  expect(reassignBody.task.assigned_user_id).toBe(managerB.userId)
  const { data: afterReassign } = await admin.from('task_assignments').select('user_id').eq('task_id', task.id)
  expect((afterReassign ?? []).map((a: { user_id: string }) => a.user_id)).toEqual([managerB.userId])

  await admin.from('task_assignments').delete().eq('task_id', task.id)
  await admin.from('tasks').delete().eq('id', task.id)
})

test('review flow: work submitted to Review can only leave via the assigner\'s Approve or Reject', async ({ request }) => {
  const task = await createTask(request, { title: 'Review flow task', shift_id: null })

  // Assignee works the task forward: Assigned -> In Progress -> Review (the drag path).
  for (const step of [{ status: 'In Progress', percentage_complete: 33 }, { status: 'Review', percentage_complete: 66 }]) {
    const res = await request.patch('/api/task', { data: { id: task.id, ...step } })
    expect(res.status()).toBe(200)
  }

  // Once in Review the drag path is locked — no plain status move can touch it.
  const dragOutOfReview = await request.patch('/api/task', {
    data: { id: task.id, status: 'Complete', percentage_complete: 100 },
  })
  expect(dragOutOfReview.status()).toBe(400)

  // Reject requires a reason, and only the assigner may do it.
  const rejectNoReason = await request.patch('/api/task', {
    data: { id: task.id, action: 'reject', assigned_by: seeded.ownerId },
  })
  expect(rejectNoReason.status()).toBe(400)
  const rejectWrongUser = await request.patch('/api/task', {
    data: { id: task.id, action: 'reject', reason: 'Not the assigner', assigned_by: managerA.userId },
  })
  expect(rejectWrongUser.status()).toBe(400)

  // A valid reject sends it back to In Progress carrying the reason as a rework notice.
  const rejectRes = await request.patch('/api/task', {
    data: { id: task.id, action: 'reject', reason: 'Checklist section is incomplete', assigned_by: seeded.ownerId },
  })
  expect(rejectRes.status()).toBe(200)
  const rejectBody = await rejectRes.json()
  expect(rejectBody.task).toMatchObject({ status: 'In Progress', rejection_reason: 'Checklist section is incomplete' })

  // The rework notice travels with the Kanban payload so the assignee's board can show it.
  const kanban = await request.get(`/api/task?company_id=${seeded.companyId}&kanban=true`)
  const kanbanBody = await kanban.json()
  const reworkTask = kanbanBody.groups['In Progress'].find((t: { id: string }) => t.id === task.id)
  expect(reworkTask.rejection_reason).toBe('Checklist section is incomplete')

  // Assignee re-submits, and only the assigner may approve — approval completes the task
  // and clears the old rejection reason.
  const resubmit = await request.patch('/api/task', {
    data: { id: task.id, status: 'Review', percentage_complete: 66 },
  })
  expect(resubmit.status()).toBe(200)
  const approveWrongUser = await request.patch('/api/task', {
    data: { id: task.id, action: 'approve', assigned_by: managerA.userId },
  })
  expect(approveWrongUser.status()).toBe(400)
  const approveRes = await request.patch('/api/task', {
    data: { id: task.id, action: 'approve', assigned_by: seeded.ownerId },
  })
  expect(approveRes.status()).toBe(200)
  const approveBody = await approveRes.json()
  expect(approveBody.task).toMatchObject({ status: 'Complete', percentage_complete: 100, rejection_reason: null })
  // Approval stamps the Completed Time shown in the task's Details.
  expect(approveBody.task.completed_at).toEqual(expect.any(String))

  // Approve/Reject only apply while the task is actually in Review.
  const approveAgain = await request.patch('/api/task', {
    data: { id: task.id, action: 'approve', assigned_by: seeded.ownerId },
  })
  expect(approveAgain.status()).toBe(400)

  await admin.from('task_assignments').delete().eq('task_id', task.id)
  await admin.from('tasks').delete().eq('id', task.id)
})
