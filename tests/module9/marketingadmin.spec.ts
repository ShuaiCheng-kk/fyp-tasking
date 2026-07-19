import { test, expect } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'

// Integration tests for Module 9 — Marketing CMS (UC72-75).
// Hits the real route.ts -> service -> repository -> Supabase chain, no UI involved.
// Marketing Admin is a platform-level role (not scoped to a company), so there's no
// seedTestOwnerAndCompany helper involved here — just a standalone auth user + users row.

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

let marketingAdminAuthId: string
let marketingAdminUserId: string
let ownerAuthId: string
let ownerUserId: string
let pageId: string
let blockId: string
const pageSlug = `test-module9-page-${Date.now()}`

test.beforeAll(async () => {
  const maEmail = `test-module9-ma-${Date.now()}@tasking-tests.local`
  const { data: maAuth, error: maAuthError } = await admin.auth.admin.createUser({
    email: maEmail, password: 'Test-Password-123!', email_confirm: true,
  })
  if (maAuthError || !maAuth.user) throw new Error(`Failed to create Marketing Admin auth user: ${maAuthError?.message}`)
  marketingAdminAuthId = maAuth.user.id
  const { data: maUser, error: maUserError } = await admin
    .from('users')
    .insert({ supabase_auth_id: marketingAdminAuthId, full_name: 'Module 9 Marketing Admin', email_address: maEmail, role: 'Marketing Admin' })
    .select('id')
    .single()
  if (maUserError || !maUser) throw new Error(`Failed to create Marketing Admin user row: ${maUserError?.message}`)
  marketingAdminUserId = maUser.id

  // A non-Marketing-Admin account, to prove the access gate actually rejects someone else's role.
  const ownerEmail = `test-module9-owner-${Date.now()}@tasking-tests.local`
  const { data: ownerAuth, error: ownerAuthError } = await admin.auth.admin.createUser({
    email: ownerEmail, password: 'Test-Password-123!', email_confirm: true,
  })
  if (ownerAuthError || !ownerAuth.user) throw new Error(`Failed to create Owner auth user: ${ownerAuthError?.message}`)
  ownerAuthId = ownerAuth.user.id
  const { data: ownerUser, error: ownerUserError } = await admin
    .from('users')
    .insert({ supabase_auth_id: ownerAuthId, full_name: 'Module 9 Non-Admin Owner', email_address: ownerEmail, role: 'Owner' })
    .select('id')
    .single()
  if (ownerUserError || !ownerUser) throw new Error(`Failed to create Owner user row: ${ownerUserError?.message}`)
  ownerUserId = ownerUser.id

  const { data: page, error: pageError } = await admin
    .from('marketing_pages')
    .insert({ slug: pageSlug, title: 'Module 9 Test Page', route_path: `/${pageSlug}`, is_editable: true })
    .select('id')
    .single()
  if (pageError || !page) throw new Error(`Failed to create marketing page: ${pageError?.message}`)
  pageId = page.id

  const { data: block, error: blockError } = await admin
    .from('marketing_content_blocks')
    .insert({ page_id: pageId, block_key: 'hero_title', block_type: 'text', label: 'Hero Title', value: 'Original Title', sort_order: 0 })
    .select('id')
    .single()
  if (blockError || !block) throw new Error(`Failed to create content block: ${blockError?.message}`)
  blockId = block.id
})

test.afterAll(async () => {
  await admin.from('marketing_content_blocks').delete().eq('page_id', pageId)
  await admin.from('marketing_pages').delete().eq('id', pageId)
  await admin.from('users').delete().eq('id', marketingAdminUserId)
  await admin.auth.admin.deleteUser(marketingAdminAuthId).catch(() => undefined)
  await admin.from('users').delete().eq('id', ownerUserId)
  await admin.auth.admin.deleteUser(ownerAuthId).catch(() => undefined)
})

test('UC72 GET /api/marketingadmin/pages lists editable marketing pages with block counts', async ({ request }) => {
  const res = await request.get(`/api/marketingadmin/pages?admin_user_id=${marketingAdminAuthId}`)
  expect(res.status()).toBe(200)
  const body = await res.json()
  expect(body.success).toBe(true)
  const listed = body.pages.find((p: { id: string }) => p.id === pageId)
  expect(listed).toMatchObject({ slug: pageSlug, title: 'Module 9 Test Page', block_count: 1 })
})

test('UC72/UC73 GET /api/marketingadmin/pages?slug rejects a non-Marketing-Admin account', async ({ request }) => {
  const res = await request.get(`/api/marketingadmin/pages?admin_user_id=${ownerAuthId}&slug=${pageSlug}`)
  expect(res.status()).toBe(403)
  expect((await res.json()).success).toBe(false)
})

test('UC73 GET /api/marketingadmin/pages?slug returns the full page with its content blocks', async ({ request }) => {
  const res = await request.get(`/api/marketingadmin/pages?admin_user_id=${marketingAdminAuthId}&slug=${pageSlug}`)
  expect(res.status()).toBe(200)
  const body = await res.json()
  expect(body.page.slug).toBe(pageSlug)
  expect(body.page.blocks).toEqual([
    expect.objectContaining({ id: blockId, block_key: 'hero_title', value: 'Original Title' }),
  ])
})

test('UC74 PATCH /api/marketingadmin/pages edits a content block\'s value', async ({ request }) => {
  const res = await request.patch('/api/marketingadmin/pages', {
    data: { admin_user_id: marketingAdminAuthId, block_id: blockId, value: '  Updated Hero Title  ' },
  })
  expect(res.status()).toBe(200)
  const body = await res.json()
  expect(body.success).toBe(true)
  expect(body.block.value).toBe('Updated Hero Title')

  const { data: row } = await admin.from('marketing_content_blocks').select('value').eq('id', blockId).single()
  expect(row?.value).toBe('Updated Hero Title')
})

test('UC74 PATCH /api/marketingadmin/pages rejects a non-Marketing-Admin account', async ({ request }) => {
  const res = await request.patch('/api/marketingadmin/pages', {
    data: { admin_user_id: ownerAuthId, block_id: blockId, value: 'Hijacked' },
  })
  expect(res.status()).toBe(403)
})

test('UC74 POST /api/marketingadmin/blocks creates a new content block on the page', async ({ request }) => {
  const res = await request.post('/api/marketingadmin/blocks', {
    data: {
      admin_user_id: marketingAdminAuthId, page_id: pageId,
      block_key: 'hero_subtitle', block_type: 'text', label: 'Hero Subtitle', value: 'A subtitle', sort_order: 1,
    },
  })
  expect(res.status()).toBe(201)
  const body = await res.json()
  expect(body.success).toBe(true)
  expect(body.block.block_key).toBe('hero_subtitle')

  await admin.from('marketing_content_blocks').delete().eq('id', body.block.id)
})

test('UC74 DELETE /api/marketingadmin/blocks removes a content block', async ({ request }) => {
  const { data: disposable, error } = await admin
    .from('marketing_content_blocks')
    .insert({ page_id: pageId, block_key: 'disposable', block_type: 'text', label: 'Disposable', value: '', sort_order: 2 })
    .select('id')
    .single()
  if (error || !disposable) throw new Error(`Failed to seed disposable block: ${error?.message}`)

  const res = await request.delete(`/api/marketingadmin/blocks?admin_user_id=${marketingAdminAuthId}&id=${disposable.id}`)
  expect(res.status()).toBe(200)

  const { data: gone } = await admin.from('marketing_content_blocks').select('id').eq('id', disposable.id).maybeSingle()
  expect(gone).toBeNull()
})

test('UC73/UC74 PUT /api/marketingadmin/pages reorders content blocks', async ({ request }) => {
  const { data: secondBlock, error } = await admin
    .from('marketing_content_blocks')
    .insert({ page_id: pageId, block_key: 'reorder_target', block_type: 'text', label: 'Reorder Target', value: '', sort_order: 5 })
    .select('id')
    .single()
  if (error || !secondBlock) throw new Error(`Failed to seed second block: ${error?.message}`)

  const res = await request.put('/api/marketingadmin/pages', {
    data: {
      admin_user_id: marketingAdminAuthId,
      updates: [{ id: blockId, sort_order: 5 }, { id: secondBlock.id, sort_order: 0 }],
    },
  })
  expect(res.status()).toBe(200)
  expect((await res.json()).success).toBe(true)

  const { data: reordered } = await admin.from('marketing_content_blocks').select('id, sort_order').eq('id', secondBlock.id).single()
  expect(reordered?.sort_order).toBe(0)

  await admin.from('marketing_content_blocks').delete().eq('id', secondBlock.id)
  await admin.from('marketing_content_blocks').update({ sort_order: 0 }).eq('id', blockId)
})

test('UC75 GET /api/marketing/pages returns the public page (no admin_user_id needed)', async ({ request }) => {
  const res = await request.get(`/api/marketing/pages?slug=${pageSlug}`)
  expect(res.status()).toBe(200)
  const body = await res.json()
  expect(body.success).toBe(true)
  expect(body.page.slug).toBe(pageSlug)
})

test('UC75 GET /api/marketing/pages returns a null page for an unknown slug (not an error)', async ({ request }) => {
  const res = await request.get('/api/marketing/pages?slug=zzz-does-not-exist')
  expect(res.status()).toBe(200)
  expect((await res.json()).page).toBeNull()
})

test('UC75 GET /api/marketing/pages rejects a request with no slug', async ({ request }) => {
  const res = await request.get('/api/marketing/pages')
  expect(res.status()).toBe(400)
})
