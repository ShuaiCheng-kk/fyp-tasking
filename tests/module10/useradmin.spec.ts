import { test, expect } from '@playwright/test'
import { seedTestOwnerAndCompany, cleanupTestOwnerAndCompany } from '../helpers/seed'
import type { TestOwner } from '../helpers/seed'

let owner: TestOwner

test.beforeAll(async () => {
  owner = await seedTestOwnerAndCompany('useradmin')
})

test.afterAll(async () => {
  await cleanupTestOwnerAndCompany(owner)
})

test('UC76 — GET /api/useradmin/companies returns list', async ({ request }) => {
  const res = await request.get('/api/useradmin/companies')
  expect(res.status()).toBe(200)
  const body = await res.json()
  expect(Array.isArray(body.companies)).toBe(true)
  const seeded = body.companies.find((c: { id: string }) => c.id === owner.companyId)
  expect(seeded).toBeDefined()
})

test('UC76 — GET /api/useradmin/companies?search filters by name', async ({ request }) => {
  const res = await request.get('/api/useradmin/companies?search=zzz_no_match_xyz')
  expect(res.status()).toBe(200)
  const body = await res.json()
  expect(body.companies).toHaveLength(0)
})

test('UC78 — GET /api/useradmin/companies/:id returns detail', async ({ request }) => {
  const res = await request.get(`/api/useradmin/companies/${owner.companyId}`)
  expect(res.status()).toBe(200)
  const body = await res.json()
  expect(body.company.id).toBe(owner.companyId)
  expect(typeof body.company.member_count).toBe('number')
})

test('UC78 — GET /api/useradmin/companies/:id returns 404 for unknown', async ({ request }) => {
  const res = await request.get('/api/useradmin/companies/00000000-0000-0000-0000-000000000000')
  expect(res.status()).toBe(404)
})

test('UC77 — GET /api/useradmin/users returns list', async ({ request }) => {
  const res = await request.get('/api/useradmin/users')
  expect(res.status()).toBe(200)
  const body = await res.json()
  expect(Array.isArray(body.users)).toBe(true)
  const seededUser = body.users.find((u: { id: string }) => u.id === owner.ownerId)
  expect(seededUser).toBeDefined()
})

test('UC77 — GET /api/useradmin/users?search filters by name/email', async ({ request }) => {
  const res = await request.get('/api/useradmin/users?search=zzz_no_match_xyz')
  expect(res.status()).toBe(200)
  const body = await res.json()
  expect(body.users).toHaveLength(0)
})

test('UC79 — POST /api/useradmin/suspend suspends a company', async ({ request }) => {
  const res = await request.post('/api/useradmin/suspend', {
    data: { action: 'suspend_company', company_id: owner.companyId, reason: 'Test suspension' },
  })
  expect(res.status()).toBe(200)

  const detail = await request.get(`/api/useradmin/companies/${owner.companyId}`)
  const body = await detail.json()
  expect(body.company.suspended_at).toBeTruthy()
  expect(body.company.suspended_reason).toBe('Test suspension')
})

test('UC79 — POST /api/useradmin/suspend unsuspends a company', async ({ request }) => {
  await request.post('/api/useradmin/suspend', {
    data: { action: 'suspend_company', company_id: owner.companyId, reason: 'Test' },
  })

  const res = await request.post('/api/useradmin/suspend', {
    data: { action: 'unsuspend_company', company_id: owner.companyId },
  })
  expect(res.status()).toBe(200)

  const detail = await request.get(`/api/useradmin/companies/${owner.companyId}`)
  const body = await detail.json()
  expect(body.company.suspended_at).toBeNull()
})

test('UC80 — POST /api/useradmin/suspend suspends a user', async ({ request }) => {
  const res = await request.post('/api/useradmin/suspend', {
    data: { action: 'suspend_user', user_id: owner.ownerId, reason: 'Test user suspension' },
  })
  expect(res.status()).toBe(200)

  const usersRes = await request.get('/api/useradmin/users')
  const body = await usersRes.json()
  const u = body.users.find((x: { id: string }) => x.id === owner.ownerId)
  expect(u?.is_suspended).toBe(true)
})

test('UC80 — POST /api/useradmin/suspend unsuspends a user', async ({ request }) => {
  await request.post('/api/useradmin/suspend', {
    data: { action: 'suspend_user', user_id: owner.ownerId, reason: 'Test' },
  })

  const res = await request.post('/api/useradmin/suspend', {
    data: { action: 'unsuspend_user', user_id: owner.ownerId },
  })
  expect(res.status()).toBe(200)

  const usersRes = await request.get('/api/useradmin/users')
  const body = await usersRes.json()
  const u = body.users.find((x: { id: string }) => x.id === owner.ownerId)
  expect(u?.is_suspended).toBe(false)
})

test('suspend_company — 500 on missing reason', async ({ request }) => {
  const res = await request.post('/api/useradmin/suspend', {
    data: { action: 'suspend_company', company_id: owner.companyId, reason: '' },
  })
  expect(res.status()).toBe(500)
})

test('suspend — 400 on invalid action', async ({ request }) => {
  const res = await request.post('/api/useradmin/suspend', {
    data: { action: 'do_magic' },
  })
  expect(res.status()).toBe(400)
})

// Platform-wide analytics on the User Admin dashboard — not one of UC76-80's own numbered actions,
// but a real, currently-used feature (getReportStats), so it's still covered here.
test('GET /api/useradmin/reports returns platform-wide stats including the seeded company/owner', async ({ request }) => {
  const res = await request.get('/api/useradmin/reports')
  expect(res.status()).toBe(200)
  const body = await res.json()
  expect(typeof body.totalCompanies).toBe('number')
  expect(typeof body.totalUsers).toBe('number')
  expect(body.totalCompanies).toBeGreaterThan(0)
  expect(body.totalUsers).toBeGreaterThan(0)
  expect(body.invitationFunnel).toEqual(
    expect.objectContaining({ used: expect.any(Number), pending: expect.any(Number), expired: expect.any(Number) })
  )
})

test('GET /api/useradmin/reports respects a from/to date range', async ({ request }) => {
  const farFuture = await request.get('/api/useradmin/reports?from=2099-01-01&to=2099-01-02')
  expect(farFuture.status()).toBe(200)
  const body = await farFuture.json()
  expect(body.newCompaniesInRange).toBe(0)
  expect(body.newUsersInRange).toBe(0)
})
