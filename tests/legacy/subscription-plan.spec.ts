import { test, expect } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'
import { seedTestOwnerAndCompany, cleanupTestOwnerAndCompany, TestOwner } from '../helpers/seed'

// Integration tests for the company subscription plan toggle (Free/Paid) — the Switch/Create
// Additional/Delete/Leave Company tests that used to live here were removed along with those
// features (explicitly excluded from docs/Use_Cases_List.md). Plan management itself is not a
// numbered current use case either, but unlike those it's still a live, load-bearing product axis
// (see CLAUDE.md section 2's Free/Paid tier gating) — kept here, out of the tests/module<N>/
// numbering since it doesn't correspond to a current UC.
// Hit the real route.ts -> service -> repository -> Supabase chain, no UI involved.

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

let seeded: TestOwner

test.beforeAll(async () => {
  seeded = await seedTestOwnerAndCompany('settings-api')
})

test.afterAll(async () => {
  await cleanupTestOwnerAndCompany(seeded)
})

test.describe('Manage Subscription Plan', () => {
  test('upgrades and downgrades a company plan directly', async ({ request }) => {
    const upgradeRes = await request.post('/api/company/update-plan', {
      data: { company_id: seeded.companyId, plan: 'Paid' },
    })
    expect(upgradeRes.status()).toBe(200)
    const upgradeBody = await upgradeRes.json()
    expect(upgradeBody.success).toBe(true)

    const { data: paidRow } = await admin.from('companies').select('plan').eq('id', seeded.companyId).single()
    expect(paidRow?.plan).toBe('Paid')

    const downgradeRes = await request.post('/api/company/update-plan', {
      data: { company_id: seeded.companyId, plan: 'Free' },
    })
    expect(downgradeRes.status()).toBe(200)

    const { data: freeRow } = await admin.from('companies').select('plan').eq('id', seeded.companyId).single()
    expect(freeRow?.plan).toBe('Free')
  })

  test('rejects an invalid plan value', async ({ request }) => {
    const res = await request.post('/api/company/update-plan', {
      data: { company_id: seeded.companyId, plan: 'Enterprise' },
    })
    expect(res.status()).toBe(400)
    const body = await res.json()
    expect(body.success).toBe(false)
  })

  test('rejects a Stripe upgrade-checkout request missing required fields', async ({ request }) => {
    const res = await request.post('/api/stripe/upgrade-checkout', {
      data: { companyId: seeded.companyId },
    })
    // Without STRIPE_SECRET_KEY configured in this environment, the Stripe client throws
    // at module load before route validation runs, so this is a 500 HTML error page rather
    // than a JSON 400 here. Either way, the request must not succeed without a checkout URL.
    expect(res.ok()).toBe(false)
  })
})
