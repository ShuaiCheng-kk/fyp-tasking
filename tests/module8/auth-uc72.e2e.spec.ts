import { test, expect } from '@playwright/test'

// UC72-A1: an expired/already-used confirmation link is detected entirely client-side — the
// email-confirmation redirect itself is handled by Supabase's own /auth/v1/verify endpoint, which
// appends ?error=1 to this app's /email-verified landing page on failure. The page itself carries
// no actor identity at all (same markup regardless of whether an Owner or a Guest User is
// registering), so one test covers both UC72-A1-E2E-O and UC72-A1-E2E-GU.

test('UC72-A1-E2E: An expired or already-used confirmation link shows Link Expired', async ({ page }) => {
  await page.goto('/email-verified?error=1')

  await expect(page.getByRole('heading', { name: 'Link expired' })).toBeVisible()
  await expect(page.getByText('This confirmation link is invalid or has expired. Please go back and request a new one.')).toBeVisible()
  await expect(page.getByRole('link', { name: 'Back to registration' })).toBeVisible()
})
