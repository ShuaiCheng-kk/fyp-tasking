import { test, expect } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'
import { seedTestOwnerAndCompany, cleanupTestOwnerAndCompany, TestOwner } from '../helpers/seed'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

let seeded: TestOwner
let departmentId: string
let managerId1: string
let managerId2: string
let assignmentId1: string
let assignmentId2: string
let swapRequestId: string

test.describe.configure({ mode: 'serial' })

async function createManager(label: string, companyId: string): Promise<string> {
  const email = `test-swap-mgr-${label}-${Date.now()}@tasking-tests.local`
  const { data: authData, error: authErr } = await admin.auth.admin.createUser({
    email, password: 'Test-Password-123!', email_confirm: true,
  })
  if (authErr || !authData.user) throw new Error(`Auth failed: ${authErr?.message}`)

  const { data: user, error: userErr } = await admin.from('users').insert({
    supabase_auth_id: authData.user.id,
    full_name: `Swap Manager ${label}`,
    email_address: email,
    role: 'Manager',
    company_id: companyId,
  }).select().single()
  if (userErr || !user) throw new Error(`User insert failed: ${userErr?.message}`)
  return user.id as string
}

async function createShiftAndAssignment(userId: string, companyId: string, deptId: string, shiftDate: string, startTime: string, endTime: string): Promise<{ shiftId: string; assignmentId: string }> {
  const { data: shift, error: shiftErr } = await admin.from('shifts').insert({
    company_id: companyId,
    department_id: deptId,
    title: 'Swap Test Shift',
    shift_date: shiftDate,
    start_time: startTime,
    end_time: endTime,
    status: 'active',
    publication_status: 'published',
    created_by: userId,
  }).select('id').single()
  if (shiftErr || !shift) throw new Error(`Shift insert failed: ${shiftErr?.message}`)

  const { data: assignment, error: assignErr } = await admin.from('shift_assignments').insert({
    shift_id: shift.id,
    user_id: userId,
    assigned_by: userId,
  }).select('id').single()
  if (assignErr || !assignment) throw new Error(`Assignment insert failed: ${assignErr?.message}`)

  return { shiftId: shift.id as string, assignmentId: assignment.id as string }
}

test.beforeAll(async () => {
  seeded = await seedTestOwnerAndCompany('shift-swap')

  const { data: dept, error: deptErr } = await admin.from('departments').insert({
    name: 'Swap Test Dept', color: '#3B82F6', company_id: seeded.companyId,
  }).select().single()
  if (deptErr || !dept) throw new Error(`Dept insert failed: ${deptErr?.message}`)
  departmentId = dept.id as string

  managerId1 = await createManager('M1', seeded.companyId)
  managerId2 = await createManager('M2', seeded.companyId)

  // Assign both managers to the same department
  await admin.from('manager_departments').insert([
    { manager_id: managerId1, department_id: departmentId, company_id: seeded.companyId, assigned_by: seeded.ownerId },
    { manager_id: managerId2, department_id: departmentId, company_id: seeded.companyId, assigned_by: seeded.ownerId },
  ])

  // Create shifts on different dates to avoid overlap
  const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1)
  const dayAfter = new Date(); dayAfter.setDate(dayAfter.getDate() + 2)
  const date1 = tomorrow.toISOString().slice(0, 10)
  const date2 = dayAfter.toISOString().slice(0, 10)

  const r1 = await createShiftAndAssignment(managerId1, seeded.companyId, departmentId, date1, '09:00', '17:00')
  const r2 = await createShiftAndAssignment(managerId2, seeded.companyId, departmentId, date2, '10:00', '18:00')
  assignmentId1 = r1.assignmentId
  assignmentId2 = r2.assignmentId
})

test.afterAll(async () => {
  await cleanupTestOwnerAndCompany(seeded)
})

test('POST /api/attendance — submit_shift_swap creates a pending request', async ({ request }) => {
  const res = await request.post('/api/attendance', {
    data: {
      action: 'submit_shift_swap',
      company_id: seeded.companyId,
      requester_id: managerId1,
      requester_assignment_id: assignmentId1,
      counterpart_id: managerId2,
      counterpart_assignment_id: assignmentId2,
      reason: 'Schedule conflict next week',
    },
  })
  expect(res.status()).toBe(200)
  const body = await res.json()
  expect(body.success).toBe(true)
  expect(body.request.status).toBe('pending')
  expect(body.request.counterpart_status).toBe('pending')
  swapRequestId = body.request.id
})

test('GET /api/attendance?resource=shift_swaps — returns the request with both shift details', async ({ request }) => {
  const res = await request.get(`/api/attendance?company_id=${seeded.companyId}&resource=shift_swaps`)
  expect(res.status()).toBe(200)
  const body = await res.json()
  expect(body.success).toBe(true)
  const found = body.requests.find((r: { id: string }) => r.id === swapRequestId)
  expect(found).toBeTruthy()
  expect(found.requester_name).toBeTruthy()
  expect(found.counterpart_name).toBeTruthy()
  expect(found.requester_shift_date).toBeTruthy()
  expect(found.counterpart_shift_date).toBeTruthy()
})

test('PATCH /api/attendance — respond_shift_swap counterpart approves', async ({ request }) => {
  const res = await request.patch('/api/attendance', {
    data: { action: 'respond_shift_swap', id: swapRequestId, counterpart_id: managerId2, decision: 'approved' },
  })
  expect(res.status()).toBe(200)
  const body = await res.json()
  expect(body.success).toBe(true)
  expect(body.request.counterpart_status).toBe('approved')
  expect(body.request.status).toBe('pending')
})

test('PATCH /api/attendance — decide_shift_swap owner approves and swaps assignments', async ({ request }) => {
  const res = await request.patch('/api/attendance', {
    data: { action: 'decide_shift_swap', id: swapRequestId, reviewer_id: seeded.ownerId, decision: 'approved' },
  })
  expect(res.status()).toBe(200)
  const body = await res.json()
  expect(body.success).toBe(true)
  expect(body.request.status).toBe('approved')

  // Verify DB: assignments should now be swapped
  const { data: asn1 } = await admin.from('shift_assignments').select('user_id').eq('id', assignmentId1).single()
  const { data: asn2 } = await admin.from('shift_assignments').select('user_id').eq('id', assignmentId2).single()
  expect(asn1?.user_id).toBe(managerId2)
  expect(asn2?.user_id).toBe(managerId1)
})

test.describe('Shift swap — same-day restriction', () => {
  let seeded2: TestOwner
  let departmentId2: string
  let mgrA: string
  let mgrB: string
  let todayAssignmentId: string
  let futureAssignmentId: string

  test.beforeAll(async () => {
    seeded2 = await seedTestOwnerAndCompany('shift-swap-sameday')
    const { data: dept } = await admin.from('departments').insert({
      name: 'Swap Sameday Dept', color: '#3B82F6', company_id: seeded2.companyId,
    }).select().single()
    departmentId2 = dept!.id as string

    mgrA = await createManager('SD-A', seeded2.companyId)
    mgrB = await createManager('SD-B', seeded2.companyId)
    await admin.from('manager_departments').insert([
      { manager_id: mgrA, department_id: departmentId2, company_id: seeded2.companyId, assigned_by: seeded2.ownerId },
      { manager_id: mgrB, department_id: departmentId2, company_id: seeded2.companyId, assigned_by: seeded2.ownerId },
    ])

    const today = new Date().toISOString().slice(0, 10)
    const dayAfterTomorrow = new Date(); dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 2)
    const futureDate = dayAfterTomorrow.toISOString().slice(0, 10)

    const r1 = await createShiftAndAssignment(mgrA, seeded2.companyId, departmentId2, today, '09:00', '17:00')
    const r2 = await createShiftAndAssignment(mgrB, seeded2.companyId, departmentId2, futureDate, '10:00', '18:00')
    todayAssignmentId = r1.assignmentId
    futureAssignmentId = r2.assignmentId
  })

  test.afterAll(async () => {
    await cleanupTestOwnerAndCompany(seeded2)
  })

  test('rejects submit_shift_swap when the requester\'s shift is today', async ({ request }) => {
    const res = await request.post('/api/attendance', {
      data: {
        action: 'submit_shift_swap',
        company_id: seeded2.companyId,
        requester_id: mgrA,
        requester_assignment_id: todayAssignmentId,
        counterpart_id: mgrB,
        counterpart_assignment_id: futureAssignmentId,
        reason: null,
      },
    })
    expect(res.status()).toBe(400)
    const body = await res.json()
    expect(body.success).toBe(false)
  })
})

test.describe('Shift swap — approval blocked if a shift becomes today before the decision', () => {
  let seeded3: TestOwner
  let departmentId3: string
  let mgrC: string
  let mgrD: string
  let assignmentIdC: string
  let assignmentIdD: string
  let shiftIdC: string
  let staleSwapRequestId: string

  test.beforeAll(async () => {
    seeded3 = await seedTestOwnerAndCompany('shift-swap-stale')
    const { data: dept } = await admin.from('departments').insert({
      name: 'Swap Stale Dept', color: '#3B82F6', company_id: seeded3.companyId,
    }).select().single()
    departmentId3 = dept!.id as string

    mgrC = await createManager('ST-C', seeded3.companyId)
    mgrD = await createManager('ST-D', seeded3.companyId)
    await admin.from('manager_departments').insert([
      { manager_id: mgrC, department_id: departmentId3, company_id: seeded3.companyId, assigned_by: seeded3.ownerId },
      { manager_id: mgrD, department_id: departmentId3, company_id: seeded3.companyId, assigned_by: seeded3.ownerId },
    ])

    const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1)
    const dayAfter = new Date(); dayAfter.setDate(dayAfter.getDate() + 2)
    const r1 = await createShiftAndAssignment(mgrC, seeded3.companyId, departmentId3, tomorrow.toISOString().slice(0, 10), '09:00', '17:00')
    const r2 = await createShiftAndAssignment(mgrD, seeded3.companyId, departmentId3, dayAfter.toISOString().slice(0, 10), '10:00', '18:00')
    assignmentIdC = r1.assignmentId
    assignmentIdD = r2.assignmentId
    shiftIdC = r1.shiftId
  })

  test.afterAll(async () => {
    await cleanupTestOwnerAndCompany(seeded3)
  })

  test('blocks decide_shift_swap once a shift has aged into today, leaving assignments untouched', async ({ request }) => {
    const submitRes = await request.post('/api/attendance', {
      data: {
        action: 'submit_shift_swap',
        company_id: seeded3.companyId,
        requester_id: mgrC,
        requester_assignment_id: assignmentIdC,
        counterpart_id: mgrD,
        counterpart_assignment_id: assignmentIdD,
        reason: 'Stale request test',
      },
    })
    expect(submitRes.status()).toBe(200)
    staleSwapRequestId = (await submitRes.json()).request.id

    const respondRes = await request.patch('/api/attendance', {
      data: { action: 'respond_shift_swap', id: staleSwapRequestId, counterpart_id: mgrD, decision: 'approved' },
    })
    expect(respondRes.status()).toBe(200)

    // Simulate time passing: the requester's shift, tomorrow at submit time, is now today.
    await admin.from('shifts').update({ shift_date: new Date().toISOString().slice(0, 10) }).eq('id', shiftIdC)

    const decideRes = await request.patch('/api/attendance', {
      data: { action: 'decide_shift_swap', id: staleSwapRequestId, reviewer_id: seeded3.ownerId, decision: 'approved' },
    })
    expect(decideRes.status()).toBe(400)
    const decideBody = await decideRes.json()
    expect(decideBody.success).toBe(false)

    const { data: asnC } = await admin.from('shift_assignments').select('user_id').eq('id', assignmentIdC).single()
    const { data: asnD } = await admin.from('shift_assignments').select('user_id').eq('id', assignmentIdD).single()
    expect(asnC?.user_id).toBe(mgrC)
    expect(asnD?.user_id).toBe(mgrD)
  })
})

test.describe('Shift swap — approval moves active tasks but leaves Complete tasks with their original owner', () => {
  let seeded4: TestOwner
  let departmentId4: string
  let mgrE: string
  let mgrF: string
  let assignmentIdE: string
  let assignmentIdF: string
  let shiftIdE: string
  let shiftIdF: string
  let activeTaskOnE: string
  let completeTaskOnE: string

  test.beforeAll(async () => {
    seeded4 = await seedTestOwnerAndCompany('shift-swap-tasks')
    const { data: dept } = await admin.from('departments').insert({
      name: 'Swap Tasks Dept', color: '#3B82F6', company_id: seeded4.companyId,
    }).select().single()
    departmentId4 = dept!.id as string

    mgrE = await createManager('TK-E', seeded4.companyId)
    mgrF = await createManager('TK-F', seeded4.companyId)
    await admin.from('manager_departments').insert([
      { manager_id: mgrE, department_id: departmentId4, company_id: seeded4.companyId, assigned_by: seeded4.ownerId },
      { manager_id: mgrF, department_id: departmentId4, company_id: seeded4.companyId, assigned_by: seeded4.ownerId },
    ])

    const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1)
    const dayAfter = new Date(); dayAfter.setDate(dayAfter.getDate() + 2)
    const r1 = await createShiftAndAssignment(mgrE, seeded4.companyId, departmentId4, tomorrow.toISOString().slice(0, 10), '09:00', '17:00')
    const r2 = await createShiftAndAssignment(mgrF, seeded4.companyId, departmentId4, dayAfter.toISOString().slice(0, 10), '10:00', '18:00')
    assignmentIdE = r1.assignmentId
    assignmentIdF = r2.assignmentId
    shiftIdE = r1.shiftId
    shiftIdF = r2.shiftId

    const { data: activeTask } = await admin.from('tasks').insert({
      company_id: seeded4.companyId, department_id: departmentId4, shift_id: shiftIdE,
      title: 'Restock shelves', assigned_user_id: mgrE, assigned_by: seeded4.ownerId, status: 'Assigned',
    }).select('id').single()
    activeTaskOnE = activeTask!.id as string

    const { data: doneTask } = await admin.from('tasks').insert({
      company_id: seeded4.companyId, department_id: departmentId4, shift_id: shiftIdE,
      title: 'Close register (already done)', assigned_user_id: mgrE, assigned_by: seeded4.ownerId, status: 'Complete',
    }).select('id').single()
    completeTaskOnE = doneTask!.id as string
  })

  test.afterAll(async () => {
    await cleanupTestOwnerAndCompany(seeded4)
  })

  test('moves the active task to the new assignee but keeps the Complete task with the original assignee', async ({ request }) => {
    const submitRes = await request.post('/api/attendance', {
      data: {
        action: 'submit_shift_swap',
        company_id: seeded4.companyId,
        requester_id: mgrE,
        requester_assignment_id: assignmentIdE,
        counterpart_id: mgrF,
        counterpart_assignment_id: assignmentIdF,
        reason: 'Task reassignment test',
      },
    })
    expect(submitRes.status()).toBe(200)
    const swapId = (await submitRes.json()).request.id

    await request.patch('/api/attendance', {
      data: { action: 'respond_shift_swap', id: swapId, counterpart_id: mgrF, decision: 'approved' },
    })

    const listRes = await request.get(`/api/attendance?company_id=${seeded4.companyId}&resource=shift_swaps`)
    expect(listRes.status()).toBe(200)
    const listBody = await listRes.json()
    const found = listBody.requests.find((r: { id: string }) => r.id === swapId)
    expect(found.requester_movable_tasks).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: activeTaskOnE, title: 'Restock shelves', status: 'Assigned' })]),
    )
    expect(found.requester_movable_tasks.some((t: { id: string }) => t.id === completeTaskOnE)).toBe(false)
    expect(found.counterpart_movable_tasks).toEqual([])

    const decideRes = await request.patch('/api/attendance', {
      data: { action: 'decide_shift_swap', id: swapId, reviewer_id: seeded4.ownerId, decision: 'approved' },
    })
    expect(decideRes.status()).toBe(200)

    const { data: activeTask } = await admin.from('tasks').select('assigned_user_id').eq('id', activeTaskOnE).single()
    const { data: doneTask } = await admin.from('tasks').select('assigned_user_id').eq('id', completeTaskOnE).single()
    expect(activeTask?.assigned_user_id).toBe(mgrF)
    expect(doneTask?.assigned_user_id).toBe(mgrE)
  })
})
