import { test, expect } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'
import { seedTestOwnerAndCompany, cleanupTestOwnerAndCompany, TestOwner } from '../helpers/seed'

// Integration tests for Module 1 — Shift (UC4 Create Shift Template).
// Hits the real route.ts -> service -> repository -> Supabase chain, no UI involved.

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

let seeded: TestOwner

test.beforeAll(async () => {
  seeded = await seedTestOwnerAndCompany('shift-template-api')
})

test.afterAll(async () => {
  await admin.from('shift_templates').delete().eq('company_id', seeded.companyId)
  await cleanupTestOwnerAndCompany(seeded)
})

let templateId: string

test('creates a shift template', async ({ request }) => {
  const res = await request.post('/api/shift-template', {
    data: {
      company_id: seeded.companyId,
      name: 'Morning Shift',
      start_time: '09:00',
      end_time: '17:00',
      created_by: seeded.ownerId,
    },
  })
  expect(res.status()).toBe(201)
  const body = await res.json()
  expect(body.success).toBe(true)
  expect(body.template.name).toBe('Morning Shift')
  templateId = body.template.id
})

test('rejects a template where start_time is after end_time', async ({ request }) => {
  const res = await request.post('/api/shift-template', {
    data: {
      company_id: seeded.companyId,
      name: 'Bad Template',
      start_time: '18:00',
      end_time: '09:00',
      created_by: seeded.ownerId,
    },
  })
  expect(res.status()).toBe(400)
  const body = await res.json()
  expect(body.success).toBe(false)
})

test('lists templates for a company without any department scoping', async ({ request }) => {
  const { data: deptA } = await admin.from('departments').insert({ company_id: seeded.companyId, name: 'Kitchen' }).select('id').single()
  const { data: deptB } = await admin.from('departments').insert({ company_id: seeded.companyId, name: 'Front of House' }).select('id').single()

  const res = await request.get(`/api/shift-template?company_id=${seeded.companyId}`)
  expect(res.status()).toBe(200)
  const body = await res.json()
  expect(body.success).toBe(true)
  expect(body.templates.some((t: { id: string }) => t.id === templateId)).toBe(true)
  expect(body.templates.every((t: object) => !('department_id' in t))).toBe(true)

  await admin.from('departments').delete().in('id', [deptA!.id, deptB!.id])
})

test('deletes a template', async ({ request }) => {
  const res = await request.delete(`/api/shift-template/${templateId}`)
  expect(res.status()).toBe(200)
  const body = await res.json()
  expect(body.success).toBe(true)
})

test('returns an error when deleting a non-existent template', async ({ request }) => {
  const res = await request.delete(`/api/shift-template/${templateId}`)
  expect(res.status()).toBe(400)
  const body = await res.json()
  expect(body.success).toBe(false)
})
