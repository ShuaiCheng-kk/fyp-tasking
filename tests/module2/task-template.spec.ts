import { test, expect } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'
import { seedTestOwnerAndCompany, cleanupTestOwnerAndCompany, TestOwner } from '../helpers/seed'

// Integration tests for Module 2 — Task (Create Task Template).
// Hits the real route.ts -> service -> repository -> Supabase chain, no UI involved.

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

let seeded: TestOwner

test.beforeAll(async () => {
  seeded = await seedTestOwnerAndCompany('task-template-api')
})

test.afterAll(async () => {
  await admin.from('task_templates').delete().eq('company_id', seeded.companyId)
  await cleanupTestOwnerAndCompany(seeded)
})

let templateId: string

test('creates a task template', async ({ request }) => {
  const res = await request.post('/api/task-template', {
    data: {
      company_id: seeded.companyId,
      name: 'Daily Cleaning Checklist',
      title: 'Clean front desk',
      description: 'Wipe down and restock',
      priority: 'Medium',
      created_by: seeded.ownerId,
    },
  })
  expect(res.status()).toBe(201)
  const body = await res.json()
  expect(body.success).toBe(true)
  expect(body.template.name).toBe('Daily Cleaning Checklist')
  expect(body.template.title).toBe('Clean front desk')
  templateId = body.template.id
})

test('creates a template with sub-task titles, trimming blanks, then updates them', async ({ request }) => {
  const createRes = await request.post('/api/task-template', {
    data: {
      company_id: seeded.companyId,
      name: 'Opening Checklist',
      title: 'Open the store',
      sub_task_titles: ['  Unlock doors  ', '   ', 'Turn on lights'],
      created_by: seeded.ownerId,
    },
  })
  expect(createRes.status()).toBe(201)
  const created = await createRes.json()
  expect(created.template.sub_task_titles).toEqual(['Unlock doors', 'Turn on lights'])

  const updateRes = await request.patch(`/api/task-template/${created.template.id}`, {
    data: { sub_task_titles: ['Unlock doors', 'Turn on lights', 'Count register'] },
  })
  expect(updateRes.status()).toBe(200)
  const updated = await updateRes.json()
  expect(updated.template.sub_task_titles).toEqual(['Unlock doors', 'Turn on lights', 'Count register'])

  await admin.from('task_templates').delete().eq('id', created.template.id)
})

test('rejects a template missing a title', async ({ request }) => {
  const res = await request.post('/api/task-template', {
    data: {
      company_id: seeded.companyId,
      name: 'Bad Template',
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

  const res = await request.get(`/api/task-template?company_id=${seeded.companyId}`)
  expect(res.status()).toBe(200)
  const body = await res.json()
  expect(body.success).toBe(true)
  expect(body.templates.some((t: { id: string }) => t.id === templateId)).toBe(true)
  expect(body.templates.every((t: object) => !('department_id' in t))).toBe(true)

  await admin.from('departments').delete().in('id', [deptA!.id, deptB!.id])
})

test('updates a template name, title, description, and priority', async ({ request }) => {
  const res = await request.patch(`/api/task-template/${templateId}`, {
    data: {
      name: 'Weekly Cleaning Checklist',
      title: 'Deep clean front desk',
      description: 'Wipe down, restock, and polish',
      priority: 'High',
    },
  })
  expect(res.status()).toBe(200)
  const body = await res.json()
  expect(body.success).toBe(true)
  expect(body.template.name).toBe('Weekly Cleaning Checklist')
  expect(body.template.title).toBe('Deep clean front desk')
  expect(body.template.priority).toBe('High')
})

test('rejects an update with a blank title', async ({ request }) => {
  const res = await request.patch(`/api/task-template/${templateId}`, {
    data: { title: '   ' },
  })
  expect(res.status()).toBe(400)
  const body = await res.json()
  expect(body.success).toBe(false)
})

test('deletes a template', async ({ request }) => {
  const res = await request.delete(`/api/task-template/${templateId}`)
  expect(res.status()).toBe(200)
  const body = await res.json()
  expect(body.success).toBe(true)
})

test('returns an error when deleting a non-existent template', async ({ request }) => {
  const res = await request.delete(`/api/task-template/${templateId}`)
  expect(res.status()).toBe(400)
  const body = await res.json()
  expect(body.success).toBe(false)
})
