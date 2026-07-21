import { test, expect } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'
import { seedTestOwnerAndCompany, cleanupTestOwnerAndCompany, TestOwner } from '../helpers/seed'

// Integration tests for Module 1 — Shift (UC2 Create Shift Template).
// Hits the real route.ts -> service -> repository -> Supabase chain, no UI involved.
//
// Shift templates are shared across the whole company — any Owner/Partner can list, edit, or
// delete any template regardless of who created it (same policy as Task Templates).

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

test('lists every template in the company, without department scoping', async ({ request }) => {
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

test('another user in the same company can see and use this template', async ({ request }) => {
  const res = await request.get(`/api/shift-template?company_id=${seeded.companyId}`)
  expect(res.status()).toBe(200)
  const body = await res.json()
  expect(body.success).toBe(true)
  expect(body.templates.some((t: { id: string }) => t.id === templateId)).toBe(true)
})

test('updates a template name and times', async ({ request }) => {
  const res = await request.patch(`/api/shift-template/${templateId}`, {
    data: {
      name: 'Late Morning Shift',
      start_time: '10:00',
      end_time: '18:00',
    },
  })
  expect(res.status()).toBe(200)
  const body = await res.json()
  expect(body.success).toBe(true)
  expect(body.template.name).toBe('Late Morning Shift')
  expect(body.template.start_time.slice(0, 5)).toBe('10:00')
  expect(body.template.end_time.slice(0, 5)).toBe('18:00')
})

test('rejects an update where start_time is after end_time', async ({ request }) => {
  const res = await request.patch(`/api/shift-template/${templateId}`, {
    data: {
      start_time: '18:00',
      end_time: '09:00',
    },
  })
  expect(res.status()).toBe(400)
  const body = await res.json()
  expect(body.success).toBe(false)
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
