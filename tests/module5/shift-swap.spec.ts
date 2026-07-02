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

async function createUser(label: string, companyId: string, role: 'Manager' | 'Employee' = 'Manager'): Promise<string> {
  const email = `test-swap-${role.toLowerCase()}-${label}-${Date.now()}@tasking-tests.local`
  const { data: authData, error: authErr } = await admin.auth.admin.createUser({
    email, password: 'Test-Password-123!', email_confirm: true,
  })
  if (authErr || !authData.user) throw new Error(`Auth failed: ${authErr?.message}`)

  const { data: user, error: userErr } = await admin.from('users').insert({
    supabase_auth_id: authData.user.id,
    full_name: `Swap ${role} ${label}`,
    email_address: email,
    role,
    company_id: companyId,
  }).select().single()
  if (userErr || !user) throw new Error(`User insert failed: ${userErr?.message}`)
  return user.id as string
}

async function createManager(label: string, companyId: string): Promise<string> {
  return createUser(label, companyId, 'Manager')
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

    // The blocked decision should have auto-closed the request as 'rejected' rather than leaving
    // it stuck as 'pending' forever with no way to ever approve it.
    const { data: swapRow } = await admin.from('shift_swap_requests').select('status').eq('id', staleSwapRequestId).single()
    expect(swapRow?.status).toBe('rejected')
  })
})

test.describe('Shift swap — request list auto-rejects a pending swap once a shift date arrives', () => {
  let seeded5: TestOwner
  let departmentId5: string
  let mgrG: string
  let mgrH: string
  let assignmentIdG: string
  let assignmentIdH: string
  let shiftIdG: string

  test.beforeAll(async () => {
    seeded5 = await seedTestOwnerAndCompany('shift-swap-expire')
    const { data: dept } = await admin.from('departments').insert({
      name: 'Swap Expire Dept', color: '#3B82F6', company_id: seeded5.companyId,
    }).select().single()
    departmentId5 = dept!.id as string

    mgrG = await createManager('EXP-G', seeded5.companyId)
    mgrH = await createManager('EXP-H', seeded5.companyId)
    await admin.from('manager_departments').insert([
      { manager_id: mgrG, department_id: departmentId5, company_id: seeded5.companyId, assigned_by: seeded5.ownerId },
      { manager_id: mgrH, department_id: departmentId5, company_id: seeded5.companyId, assigned_by: seeded5.ownerId },
    ])

    const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1)
    const dayAfter = new Date(); dayAfter.setDate(dayAfter.getDate() + 2)
    const r1 = await createShiftAndAssignment(mgrG, seeded5.companyId, departmentId5, tomorrow.toISOString().slice(0, 10), '09:00', '17:00')
    const r2 = await createShiftAndAssignment(mgrH, seeded5.companyId, departmentId5, dayAfter.toISOString().slice(0, 10), '10:00', '18:00')
    assignmentIdG = r1.assignmentId
    assignmentIdH = r2.assignmentId
    shiftIdG = r1.shiftId
  })

  test.afterAll(async () => {
    await cleanupTestOwnerAndCompany(seeded5)
  })

  test('GET resource=shift_swaps flips an expired pending request to rejected without anyone deciding it', async ({ request }) => {
    const submitRes = await request.post('/api/attendance', {
      data: {
        action: 'submit_shift_swap',
        company_id: seeded5.companyId,
        requester_id: mgrG,
        requester_assignment_id: assignmentIdG,
        counterpart_id: mgrH,
        counterpart_assignment_id: assignmentIdH,
        reason: 'Expiry test',
      },
    })
    expect(submitRes.status()).toBe(200)
    const expiredSwapRequestId = (await submitRes.json()).request.id as string

    // Simulate time passing: the requester's shift, tomorrow at submit time, is now today —
    // this swap can never be approved anymore and should not still show as 'pending'.
    await admin.from('shifts').update({ shift_date: new Date().toISOString().slice(0, 10) }).eq('id', shiftIdG)

    const listRes = await request.get(`/api/attendance?company_id=${seeded5.companyId}&resource=shift_swaps`)
    expect(listRes.status()).toBe(200)
    const listBody = await listRes.json()
    const found = listBody.requests.find((r: { id: string }) => r.id === expiredSwapRequestId)
    expect(found?.status).toBe('rejected')

    const { data: swapRow } = await admin.from('shift_swap_requests').select('status').eq('id', expiredSwapRequestId).single()
    expect(swapRow?.status).toBe('rejected')
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
  let reviewTaskOnE: string

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

    const { data: reviewTask } = await admin.from('tasks').insert({
      company_id: seeded4.companyId, department_id: departmentId4, shift_id: shiftIdE,
      title: 'Cash count (awaiting sign-off)', assigned_user_id: mgrE, assigned_by: seeded4.ownerId, status: 'Review',
    }).select('id').single()
    reviewTaskOnE = reviewTask!.id as string
  })

  test.afterAll(async () => {
    await cleanupTestOwnerAndCompany(seeded4)
  })

  test('moves the active task to the new assignee but keeps Review/Complete tasks with the original assignee', async ({ request }) => {
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
    expect(found.requester_movable_tasks.some((t: { id: string }) => t.id === reviewTaskOnE)).toBe(false)
    expect(found.counterpart_movable_tasks).toEqual([])

    const decideRes = await request.patch('/api/attendance', {
      data: { action: 'decide_shift_swap', id: swapId, reviewer_id: seeded4.ownerId, decision: 'approved' },
    })
    expect(decideRes.status()).toBe(200)

    const { data: activeTask } = await admin.from('tasks').select('assigned_user_id').eq('id', activeTaskOnE).single()
    const { data: doneTask } = await admin.from('tasks').select('assigned_user_id').eq('id', completeTaskOnE).single()
    const { data: reviewTask } = await admin.from('tasks').select('assigned_user_id').eq('id', reviewTaskOnE).single()
    expect(activeTask?.assigned_user_id).toBe(mgrF)
    expect(doneTask?.assigned_user_id).toBe(mgrE)
    expect(reviewTask?.assigned_user_id).toBe(mgrE)
  })
})

test.describe('Shift swap — Employee<->Employee swaps route to the department Manager, not the Owner', () => {
  let seeded6: TestOwner
  let departmentId6: string
  let mgrI: string
  let empJ: string
  let empK: string
  let assignmentIdJ: string
  let assignmentIdK: string

  test.beforeAll(async () => {
    seeded6 = await seedTestOwnerAndCompany('shift-swap-emp-routing')
    const { data: dept } = await admin.from('departments').insert({
      name: 'Swap Routing Dept', color: '#3B82F6', company_id: seeded6.companyId,
    }).select().single()
    departmentId6 = dept!.id as string

    mgrI = await createUser('RT-I', seeded6.companyId, 'Manager')
    empJ = await createUser('RT-J', seeded6.companyId, 'Employee')
    empK = await createUser('RT-K', seeded6.companyId, 'Employee')
    await admin.from('manager_departments').insert({
      manager_id: mgrI, department_id: departmentId6, company_id: seeded6.companyId, assigned_by: seeded6.ownerId,
    })
    await admin.from('employee_departments').insert([
      { employee_id: empJ, department_id: departmentId6 },
      { employee_id: empK, department_id: departmentId6 },
    ])

    const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1)
    const dayAfter = new Date(); dayAfter.setDate(dayAfter.getDate() + 2)
    const r1 = await createShiftAndAssignment(empJ, seeded6.companyId, departmentId6, tomorrow.toISOString().slice(0, 10), '09:00', '17:00')
    const r2 = await createShiftAndAssignment(empK, seeded6.companyId, departmentId6, dayAfter.toISOString().slice(0, 10), '10:00', '18:00')
    assignmentIdJ = r1.assignmentId
    assignmentIdK = r2.assignmentId
  })

  test.afterAll(async () => {
    await cleanupTestOwnerAndCompany(seeded6)
  })

  test('is hidden from the Owner queue but visible + decidable in the department Manager queue', async ({ request }) => {
    const submitRes = await request.post('/api/attendance', {
      data: {
        action: 'submit_shift_swap',
        company_id: seeded6.companyId,
        requester_id: empJ,
        requester_assignment_id: assignmentIdJ,
        counterpart_id: empK,
        counterpart_assignment_id: assignmentIdK,
        reason: 'Routing test',
      },
    })
    expect(submitRes.status()).toBe(200)
    const swapId = (await submitRes.json()).request.id as string

    const respondRes = await request.patch('/api/attendance', {
      data: { action: 'respond_shift_swap', id: swapId, counterpart_id: empK, decision: 'approved' },
    })
    expect(respondRes.status()).toBe(200)

    // Owner queue (no manager_id) must not surface an Employee<->Employee swap.
    const ownerListRes = await request.get(`/api/attendance?company_id=${seeded6.companyId}&resource=shift_swaps`)
    expect(ownerListRes.status()).toBe(200)
    const ownerListBody = await ownerListRes.json()
    expect(ownerListBody.requests.some((r: { id: string }) => r.id === swapId)).toBe(false)

    // The department's Manager queue must surface it.
    const mgrListRes = await request.get(`/api/attendance?company_id=${seeded6.companyId}&resource=shift_swaps&manager_id=${mgrI}`)
    expect(mgrListRes.status()).toBe(200)
    const mgrListBody = await mgrListRes.json()
    expect(mgrListBody.requests.some((r: { id: string }) => r.id === swapId)).toBe(true)

    // That Manager can decide it.
    const decideRes = await request.patch('/api/attendance', {
      data: { action: 'decide_shift_swap', id: swapId, reviewer_id: mgrI, decision: 'approved' },
    })
    expect(decideRes.status()).toBe(200)
    const decideBody = await decideRes.json()
    expect(decideBody.request.status).toBe('approved')

    const { data: asnJ } = await admin.from('shift_assignments').select('user_id').eq('id', assignmentIdJ).single()
    const { data: asnK } = await admin.from('shift_assignments').select('user_id').eq('id', assignmentIdK).single()
    expect(asnJ?.user_id).toBe(empK)
    expect(asnK?.user_id).toBe(empJ)
  })
})

test.describe('Shift swap — same-department and same-role restrictions', () => {
  let seeded7: TestOwner
  let deptA: string
  let deptB: string
  let mgrL: string
  let mgrM: string
  let empN: string
  let assignmentIdL: string
  let assignmentIdM: string
  let assignmentIdN: string

  test.beforeAll(async () => {
    seeded7 = await seedTestOwnerAndCompany('shift-swap-restrictions')
    const { data: dA } = await admin.from('departments').insert({
      name: 'Restrictions Dept A', color: '#3B82F6', company_id: seeded7.companyId,
    }).select().single()
    const { data: dB } = await admin.from('departments').insert({
      name: 'Restrictions Dept B', color: '#10B981', company_id: seeded7.companyId,
    }).select().single()
    deptA = dA!.id as string
    deptB = dB!.id as string

    mgrL = await createUser('RS-L', seeded7.companyId, 'Manager')
    mgrM = await createUser('RS-M', seeded7.companyId, 'Manager')
    empN = await createUser('RS-N', seeded7.companyId, 'Employee')
    await admin.from('manager_departments').insert([
      { manager_id: mgrL, department_id: deptA, company_id: seeded7.companyId, assigned_by: seeded7.ownerId },
      { manager_id: mgrM, department_id: deptB, company_id: seeded7.companyId, assigned_by: seeded7.ownerId },
    ])
    await admin.from('employee_departments').insert({ employee_id: empN, department_id: deptA })

    const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1)
    const dayAfter = new Date(); dayAfter.setDate(dayAfter.getDate() + 2)
    const rL = await createShiftAndAssignment(mgrL, seeded7.companyId, deptA, tomorrow.toISOString().slice(0, 10), '09:00', '17:00')
    const rM = await createShiftAndAssignment(mgrM, seeded7.companyId, deptB, dayAfter.toISOString().slice(0, 10), '10:00', '18:00')
    const rN = await createShiftAndAssignment(empN, seeded7.companyId, deptA, dayAfter.toISOString().slice(0, 10), '10:00', '18:00')
    assignmentIdL = rL.assignmentId
    assignmentIdM = rM.assignmentId
    assignmentIdN = rN.assignmentId
  })

  test.afterAll(async () => {
    await cleanupTestOwnerAndCompany(seeded7)
  })

  test('rejects a swap between two Managers in different departments', async ({ request }) => {
    const res = await request.post('/api/attendance', {
      data: {
        action: 'submit_shift_swap',
        company_id: seeded7.companyId,
        requester_id: mgrL,
        requester_assignment_id: assignmentIdL,
        counterpart_id: mgrM,
        counterpart_assignment_id: assignmentIdM,
        reason: 'Cross-department attempt',
      },
    })
    expect(res.status()).toBe(400)
    const body = await res.json()
    expect(body.success).toBe(false)
    expect(body.message).toContain('same department')
  })

  test('rejects a swap between a Manager and an Employee even within the same department', async ({ request }) => {
    const res = await request.post('/api/attendance', {
      data: {
        action: 'submit_shift_swap',
        company_id: seeded7.companyId,
        requester_id: mgrL,
        requester_assignment_id: assignmentIdL,
        counterpart_id: empN,
        counterpart_assignment_id: assignmentIdN,
        reason: 'Cross-role attempt',
      },
    })
    expect(res.status()).toBe(400)
    const body = await res.json()
    expect(body.success).toBe(false)
    expect(body.message).toContain('same role')
  })
})
