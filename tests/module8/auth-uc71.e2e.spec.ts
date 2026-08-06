import { test, expect } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'
import { seedTestOwnerAndCompany, cleanupTestOwnerAndCompany, TestOwner } from '../helpers/seed'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

test.describe.configure({ mode: 'serial' })

let seeded: TestOwner

test.beforeAll(async () => {
  seeded = await seedTestOwnerAndCompany('uc71e2e')
})

test.afterAll(async () => {
  await cleanupTestOwnerAndCompany(seeded)
})

test('UC71-A1-E2E: The two password fields not matching blocks submission', async ({ page, baseURL }) => {
  const { data, error } = await admin.auth.admin.generateLink({
    type: 'recovery',
    email: seeded.email,
    options: { redirectTo: `${baseURL}/reset-password` },
  })
  if (error || !data.properties?.action_link) throw new Error(`Failed to generate recovery link: ${error?.message}`)

  await page.goto(data.properties.action_link)
  await expect(page.getByRole('button', { name: 'Update Password' })).toBeVisible({ timeout: 15000 })

  const passwordInputs = page.locator('input[type="password"]')
  await passwordInputs.nth(0).fill('FirstPassword123!')
  await passwordInputs.nth(1).fill('DifferentPassword456!')
  await page.getByRole('button', { name: 'Update Password' }).click()

  await expect(page.getByText('Passwords do not match')).toBeVisible()
})

test('UC71-A2-E2E: Opening an already-used or expired reset link is rejected', async ({ page }) => {
  await page.goto('/reset-password#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired')

  await expect(page.getByText('This reset link is invalid or has expired. Request a new one from the sign-in page.')).toBeVisible()
})
