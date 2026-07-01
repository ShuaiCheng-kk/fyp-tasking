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
