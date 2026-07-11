import { test, expect } from '@playwright/test'
import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'

config({ path: '.env.local' })

// Integration tests for the Worker Profile (Module 4 supporting infrastructure — the profile a
// Guest User / Casual Worker fills in once, whose skills/certificates/resume get snapshotted
// into every job application). Hits route.ts -> service -> repository -> Supabase, no UI.

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

test.describe.configure({ mode: 'serial' })

let authId: string
let userId: string

test.beforeAll(async () => {
  const email = `test-worker-profile-${Date.now()}@tasking-tests.local`
  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email, password: 'Test-Password-123!', email_confirm: true,
  })
  if (authError || !authData.user) throw new Error(`Failed to create auth user: ${authError?.message}`)
  authId = authData.user.id

  const { data: user, error: userError } = await admin
    .from('users')
    .insert({
      supabase_auth_id: authId,
      full_name: 'Test Worker Profile',
      email_address: email,
      role: 'Guest User',
      date_of_birth: '2004-05-01',
    })
    .select('id')
    .single()
  if (userError || !user) throw new Error(`Failed to create user row: ${userError?.message}`)
  userId = user.id
})

test.afterAll(async () => {
  if (userId) {
    await admin.from('user_certificates').delete().eq('user_id', userId)
    // best-effort storage cleanup of anything the tests uploaded under this profile
    const { data: files } = await admin.storage.from('worker-documents').list(`profiles/${userId}`)
    if (files && files.length > 0) {
      await admin.storage.from('worker-documents').remove(files.map(f => `profiles/${userId}/${f.name}`))
    }
    const { data: certFiles } = await admin.storage.from('worker-documents').list(`profiles/${userId}/certificates`)
    if (certFiles && certFiles.length > 0) {
      await admin.storage.from('worker-documents').remove(certFiles.map(f => `profiles/${userId}/certificates/${f.name}`))
    }
    await admin.from('users').delete().eq('id', userId)
  }
  if (authId) await admin.auth.admin.deleteUser(authId).catch(() => undefined)
})

test('GET profile returns skills, resume_url, and an (initially empty) certificates list', async ({ request }) => {
  const res = await request.get(`/api/guest/profile?user_id=${authId}`)
  expect(res.status()).toBe(200)
  const { profile } = await res.json()
  expect(profile.id).toBe(userId)
  expect(profile.skills).toBeNull()
  expect(profile.resume_url).toBeNull()
  expect(profile.certificates).toEqual([])
})

test('PATCH skills saves free-text skills and clears them again', async ({ request }) => {
  const res = await request.patch('/api/guest/profile/skills', {
    data: { user_id: authId, skills: '  Customer service, Barista, Cash handling ' },
  })
  expect(res.status()).toBe(200)
  expect((await res.json()).profile.skills).toBe('Customer service, Barista, Cash handling')

  const clearRes = await request.patch('/api/guest/profile/skills', {
    data: { user_id: authId, skills: '' },
  })
  expect(clearRes.status()).toBe(200)
  expect((await clearRes.json()).profile.skills).toBeNull()
})

test('resume upload stores a URL on the profile; DELETE clears it', async ({ request }) => {
  const uploadRes = await request.post('/api/guest/profile/resume', {
    multipart: {
      user_id: authId,
      resume: { name: 'cv.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4 test resume') },
    },
  })
  expect(uploadRes.status()).toBe(200)
  const uploaded = (await uploadRes.json()).profile
  expect(uploaded.resume_url).toContain('worker-documents')
  expect(uploaded.resume_url).toContain(`profiles/${userId}`)

  const deleteRes = await request.delete(`/api/guest/profile/resume?user_id=${authId}`)
  expect(deleteRes.status()).toBe(200)
  expect((await deleteRes.json()).profile.resume_url).toBeNull()
})

test('resume upload rejects non-document file types', async ({ request }) => {
  const res = await request.post('/api/guest/profile/resume', {
    multipart: {
      user_id: authId,
      resume: { name: 'cv.png', mimeType: 'image/png', buffer: Buffer.from('not a pdf') },
    },
  })
  expect(res.status()).toBe(400)
  expect((await res.json()).message).toContain('PDF, DOC, or DOCX')
})

test('certificates: add text-only, add with proof image, then delete', async ({ request }) => {
  // Text-only claim — no file required by design.
  const textOnlyRes = await request.post('/api/guest/profile/certificates', {
    multipart: { user_id: authId, name: 'Food Hygiene Certificate' },
  })
  expect(textOnlyRes.status()).toBe(201)
  const textOnly = (await textOnlyRes.json()).certificate
  expect(textOnly.name).toBe('Food Hygiene Certificate')
  expect(textOnly.file_url).toBeNull()

  // Custom name with an uploaded proof image.
  const withFileRes = await request.post('/api/guest/profile/certificates', {
    multipart: {
      user_id: authId,
      name: 'Forklift Licence',
      file: { name: 'licence.jpg', mimeType: 'image/jpeg', buffer: Buffer.from('fake-jpeg-bytes') },
    },
  })
  expect(withFileRes.status()).toBe(201)
  const withFile = (await withFileRes.json()).certificate
  expect(withFile.file_url).toContain('worker-documents')

  // Both show up on the profile.
  const profileRes = await request.get(`/api/guest/profile?user_id=${authId}`)
  const { profile } = await profileRes.json()
  expect(profile.certificates).toHaveLength(2)

  // Delete one — scoped to the owning user.
  const deleteRes = await request.delete(
    `/api/guest/profile/certificates?user_id=${authId}&certificate_id=${textOnly.id}`,
  )
  expect(deleteRes.status()).toBe(200)

  const afterRes = await request.get(`/api/guest/profile?user_id=${authId}`)
  const after = (await afterRes.json()).profile
  expect(after.certificates).toHaveLength(1)
  expect(after.certificates[0].name).toBe('Forklift Licence')
})

test('certificates: rejects a missing name and an unsupported file type', async ({ request }) => {
  const noNameRes = await request.post('/api/guest/profile/certificates', {
    multipart: { user_id: authId, name: '   ' },
  })
  expect(noNameRes.status()).toBe(400)

  const badFileRes = await request.post('/api/guest/profile/certificates', {
    multipart: {
      user_id: authId,
      name: 'Security Officer Licence',
      file: { name: 'cert.gif', mimeType: 'image/gif', buffer: Buffer.from('gif-bytes') },
    },
  })
  expect(badFileRes.status()).toBe(400)
  expect((await badFileRes.json()).message).toContain('PDF, DOC, DOCX, JPG, or PNG')
})
