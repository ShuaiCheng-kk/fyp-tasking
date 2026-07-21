import { test, expect } from '@playwright/test'
import { seedTestOwnerAndCompany, cleanupTestOwnerAndCompany, TestOwner } from '../helpers/seed'

// Integration test for UC29-31 — Create / Edit / Delete Department.
// Hits the real route.ts -> service -> repository -> Supabase chain, no UI involved.

let seeded: TestOwner
let departmentId: string

test.beforeAll(async () => {
  seeded = await seedTestOwnerAndCompany('dept-api')
})

test.afterAll(async () => {
  await cleanupTestOwnerAndCompany(seeded)
})

test('creates a department', async ({ request }) => {
  const res = await request.post('/api/company/create-department', {
    data: { company_id: seeded.companyId, name: 'Operations', requester_user_id: seeded.ownerId },
  })
  expect(res.status()).toBe(201)
  const body = await res.json()
  expect(body.success).toBe(true)
  expect(body.department.name).toBe('Operations')
  departmentId = body.department.id
})

test('rejects creation with a missing name', async ({ request }) => {
  const res = await request.post('/api/company/create-department', {
    data: { company_id: seeded.companyId, requester_user_id: seeded.ownerId },
  })
  expect(res.status()).toBe(400)
  const body = await res.json()
  expect(body.success).toBe(false)
})

test('lists the created department for the company', async ({ request }) => {
  const res = await request.get(`/api/company/departments?company_id=${seeded.companyId}`)
  expect(res.status()).toBe(200)
  const body = await res.json()
  expect(body.success).toBe(true)
  expect(body.departments.some((d: { id: string; name: string }) => d.id === departmentId && d.name === 'Operations')).toBe(true)
})

test('renames the department', async ({ request }) => {
  const res = await request.patch('/api/company/update-department', {
    data: { department_id: departmentId, name: 'Logistics', requester_user_id: seeded.ownerId },
  })
  expect(res.status()).toBe(200)
  const body = await res.json()
  expect(body.success).toBe(true)

  const list = await (await request.get(`/api/company/departments?company_id=${seeded.companyId}`)).json()
  expect(list.departments.find((d: { id: string }) => d.id === departmentId).name).toBe('Logistics')
})

test('deletes the department once it has no members', async ({ request }) => {
  const res = await request.delete('/api/company/delete-department', {
    data: { department_id: departmentId, requester_user_id: seeded.ownerId },
  })
  expect(res.status()).toBe(200)
  const body = await res.json()
  expect(body.success).toBe(true)

  const list = await (await request.get(`/api/company/departments?company_id=${seeded.companyId}`)).json()
  expect(list.departments.some((d: { id: string }) => d.id === departmentId)).toBe(false)
})
