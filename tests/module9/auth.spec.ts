import { test, expect } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'
import { seedTestOwnerAndCompany, cleanupTestOwnerAndCompany, TestOwner } from '../helpers/seed'

// Integration tests for Module 9 — Account & Authentication (UC85-91).
// Hit the real route.ts -> service -> repository -> Supabase chain, no UI involved.

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

let seeded: TestOwner

test.beforeAll(async () => {
  seeded = await seedTestOwnerAndCompany('auth-api')
})

test.afterAll(async () => {
  await cleanupTestOwnerAndCompany(seeded)
})

test.describe('UC85 — Register Account', () => {
  let registeredAuthId: string | null = null
  let registeredEmail: string

  test.afterEach(async () => {
    if (registeredAuthId) {
      await admin.from('users').delete().eq('supabase_auth_id', registeredAuthId)
      await admin.auth.admin.deleteUser(registeredAuthId)
      registeredAuthId = null
    }
  })

  test('registers a new Owner account', async ({ request }) => {
    registeredEmail = `test-register-${Date.now()}@tasking-tests.local`
    const res = await request.post('/api/auth/register', {
      data: {
        email_address: registeredEmail,
        password: 'Test-Password-123!',
        full_name: 'New Owner',
        phone_number: null,
        role: 'Owner',
      },
    })
    expect(res.status()).toBe(201)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.user.full_name).toBe('New Owner')

    const { data: row } = await admin.from('users').select('supabase_auth_id').eq('email_address', registeredEmail).single()
    registeredAuthId = row?.supabase_auth_id ?? null
  })

  test('rejects registration with a missing password', async ({ request }) => {
    const res = await request.post('/api/auth/register', {
      data: { email_address: 'missing-password@tasking-tests.local', full_name: 'No Password', role: 'Owner' },
    })
    expect(res.status()).toBe(400)
    const body = await res.json()
    expect(body.success).toBe(false)
  })

  test('rejects registration with an invalid role', async ({ request }) => {
    const res = await request.post('/api/auth/register', {
      data: {
        email_address: 'bad-role@tasking-tests.local',
        password: 'Test-Password-123!',
        full_name: 'Bad Role',
        role: 'Manager',
      },
    })
    expect(res.status()).toBe(400)
  })
})

test.describe('UC86 — Sign In', () => {
  test('signs in with valid credentials and returns the user profile', async ({ request }) => {
    const res = await request.post('/api/auth/signin', {
      data: { email_address: seeded.email, password: seeded.password },
    })
    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.user.role).toBe('Owner')
    expect(body.user.company_id).toBe(seeded.companyId)
  })

  test('rejects an incorrect password', async ({ request }) => {
    const res = await request.post('/api/auth/signin', {
      data: { email_address: seeded.email, password: 'wrong-password' },
    })
    expect(res.status()).toBe(401)
    const body = await res.json()
    expect(body.success).toBe(false)
  })
})

test.describe('UC87 — Forgot Password', () => {
  test('accepts a forgot-password request for an existing email', async ({ request }) => {
    const res = await request.post('/api/auth/forgot-password', {
      data: { email: seeded.email },
    })
    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
  })

  test('rejects a forgot-password request with no email', async ({ request }) => {
    const res = await request.post('/api/auth/forgot-password', { data: {} })
    expect(res.status()).toBe(400)
  })
})

test.describe('UC88 — Email Verification / Resend Confirmation', () => {
  let unverifiedAuthId: string | null = null
  let unverifiedEmail: string

  test.afterAll(async () => {
    if (unverifiedAuthId) {
      await admin.auth.admin.deleteUser(unverifiedAuthId)
    }
  })

  test('reports false for an unconfirmed account, then resends the confirmation email', async ({ request }) => {
    unverifiedEmail = `test-unverified-${Date.now()}@tasking-tests.local`
    const { data: authData, error: authError } = await admin.auth.admin.createUser({
      email: unverifiedEmail,
      password: 'Test-Password-123!',
      email_confirm: false,
    })
    if (authError || !authData.user) throw new Error(`Failed to create unconfirmed user: ${authError?.message}`)
    unverifiedAuthId = authData.user.id

    const checkUnverified = await request.get(`/api/auth/check-verified?email=${encodeURIComponent(unverifiedEmail)}`)
    expect(checkUnverified.status()).toBe(200)
    const checkUnverifiedBody = await checkUnverified.json()
    expect(checkUnverifiedBody).toMatchObject({ success: true, verified: false })

    const resend = await request.post('/api/auth/resend-confirmation', {
      data: { email: unverifiedEmail },
    })
    expect(resend.status()).toBe(200)
    const resendBody = await resend.json()
    expect(resendBody.success).toBe(true)
  })

  test('reports true once an account has email_confirmed_at set', async ({ request }) => {
    const checkVerified = await request.get(`/api/auth/check-verified?email=${encodeURIComponent(seeded.email)}`)
    expect(checkVerified.status()).toBe(200)
    const checkVerifiedBody = await checkVerified.json()
    expect(checkVerifiedBody).toMatchObject({ success: true, verified: true })
  })

  test('rejects a resend-confirmation request with no email', async ({ request }) => {
    const res = await request.post('/api/auth/resend-confirmation', { data: {} })
    expect(res.status()).toBe(400)
    const body = await res.json()
    expect(body.success).toBe(false)
  })
})

test.describe('UC89 — Edit Own Profile', () => {
  test('updates the profile fields and persists them', async ({ request }) => {
    const res = await request.patch('/api/user/update-profile', {
      data: {
        user_id: seeded.ownerId,
        full_name: 'Updated Owner Name',
        phone_number: '98765432',
        date_of_birth: '1985-05-05',
        profile_photo_url: 'https://example.com/avatars/owner.png',
      },
    })
    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.user.full_name).toBe('Updated Owner Name')
    expect(body.user.phone_number).toBe('98765432')
    expect(body.user.profile_photo_url).toBe('https://example.com/avatars/owner.png')
  })

  test('rejects an update with an empty full_name', async ({ request }) => {
    const res = await request.patch('/api/user/update-profile', {
      data: { user_id: seeded.ownerId, full_name: '   ' },
    })
    expect(res.status()).toBe(400)
  })
})

test.describe('UC90 — Accept Company Invitation', () => {
  let invitedAuthId: string | null = null

  test.afterAll(async () => {
    if (invitedAuthId) {
      await admin.from('users').delete().eq('supabase_auth_id', invitedAuthId)
      await admin.auth.admin.deleteUser(invitedAuthId)
    }
  })

  test('generates a code and redeems it into a new Employee account', async ({ request }) => {
    const genRes = await request.post('/api/invitation/generate', {
      data: { company_id: seeded.companyId, role: 'Employee', generated_by: seeded.ownerId },
    })
    expect(genRes.status()).toBe(201)
    const { code } = await genRes.json()
    expect(code).toBeTruthy()

    const invitedEmail = `test-invitee-${Date.now()}@tasking-tests.local`
    const redeemRes = await request.post('/api/invitation/redeem', {
      data: {
        code,
        full_name: 'Invited Employee',
        email: invitedEmail,
        password: 'Test-Password-123!',
        phone_number: '55512345',
      },
    })
    expect(redeemRes.status()).toBe(200)
    const body = await redeemRes.json()
    expect(body.success).toBe(true)
    expect(body.user.role).toBe('Employee')
    expect(body.company_id).toBe(seeded.companyId)

    const { data: row } = await admin.from('users').select('supabase_auth_id').eq('email_address', invitedEmail).single()
    invitedAuthId = row?.supabase_auth_id ?? null
  })

  test('rejects an invalid invitation code', async ({ request }) => {
    const res = await request.post('/api/invitation/redeem', {
      data: {
        code: 'NOPE',
        full_name: 'Nobody',
        email: 'nobody@tasking-tests.local',
        password: 'Test-Password-123!',
        phone_number: '00000000',
      },
    })
    expect(res.status()).toBe(400)
    const body = await res.json()
    expect(body.success).toBe(false)
  })
})

test.describe('UC91 — Logout', () => {
  test('signs out successfully', async ({ request }) => {
    const res = await request.post('/api/auth/signout')
    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
  })
})
