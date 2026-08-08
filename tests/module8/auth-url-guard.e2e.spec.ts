import { test, expect, Page } from '@playwright/test'

// Regression coverage for the URL-layer RBAC gaps closed on 2026-08-07 (CLAUDE.md section 10.5
// pre-launch blockers): owner/partner layout guards used a blacklist (ROLE_DASHBOARD map) that let
// any unmapped role fall through and render the shell, and admin/useradmin had no server-side
// guard at all (admin trusted a client-editable localStorage value; useradmin had none). These
// tests sign in as a real seeded account via the actual /signin form and assert the target shell
// is never reached by the wrong role.

const PASSWORD = '111111'

async function signInViaUI(page: Page, email: string) {
  await page.goto('/signin')
  await page.fill('input[type="email"]', email)
  await page.fill('input[type="password"]', PASSWORD)
  await page.click('button[type="submit"]')
  await page.waitForURL(url => !url.pathname.includes('/signin'), { timeout: 15000 }).catch(() => {})
}

test.describe('Owner/Partner layout guard rejects unmapped roles', () => {
  test('AUTH-URLGUARD-E2E-01: Guest User hitting /owner/dashboard is redirected away, not rendered', async ({ page }) => {
    await signInViaUI(page, 'guest1@test.com')
    await page.goto('/owner/dashboard', { waitUntil: 'load' }).catch(() => {})
    await expect(page).not.toHaveURL(/\/owner\/dashboard/, { timeout: 10000 })
  })

  test('AUTH-URLGUARD-E2E-02: Marketing Admin hitting /owner/dashboard is redirected away, not rendered', async ({ page }) => {
    await signInViaUI(page, 'madmin@tasking.com')
    await page.goto('/owner/dashboard', { waitUntil: 'load' }).catch(() => {})
    await expect(page).not.toHaveURL(/\/owner\/dashboard/, { timeout: 10000 })
  })

  test('AUTH-URLGUARD-E2E-03: User Admin hitting /partner/dashboard is redirected away, not rendered', async ({ page }) => {
    await signInViaUI(page, 'uadmin@tasking.com')
    await page.goto('/partner/dashboard', { waitUntil: 'load' }).catch(() => {})
    await expect(page).not.toHaveURL(/\/partner\/dashboard/, { timeout: 10000 })
  })

  test('AUTH-URLGUARD-E2E-04 (positive control): Owner can still reach /owner/dashboard', async ({ page }) => {
    await signInViaUI(page, 'owner@test.com')
    await expect(page).toHaveURL(/\/owner\/dashboard/, { timeout: 10000 })
  })
})

test.describe('Admin/UserAdmin server-side session guard', () => {
  test('AUTH-URLGUARD-E2E-05: Unauthenticated request to /admin/dashboard is redirected to /signin', async ({ page }) => {
    await page.goto('/admin/dashboard', { waitUntil: 'load' }).catch(() => {})
    await expect(page).toHaveURL(/\/signin/, { timeout: 10000 })
  })

  test('AUTH-URLGUARD-E2E-06: Unauthenticated request to /useradmin/dashboard is redirected to /signin', async ({ page }) => {
    await page.goto('/useradmin/dashboard', { waitUntil: 'load' }).catch(() => {})
    await expect(page).toHaveURL(/\/signin/, { timeout: 10000 })
  })

  test('AUTH-URLGUARD-E2E-07: Owner session hitting /admin/dashboard is redirected to /signin, not rendered', async ({ page }) => {
    await signInViaUI(page, 'owner@test.com')
    await page.goto('/admin/dashboard', { waitUntil: 'load' }).catch(() => {})
    await expect(page).toHaveURL(/\/signin/, { timeout: 10000 })
  })

  test('AUTH-URLGUARD-E2E-08: Owner session hitting /useradmin/dashboard is redirected to /signin, not rendered', async ({ page }) => {
    await signInViaUI(page, 'owner@test.com')
    await page.goto('/useradmin/dashboard', { waitUntil: 'load' }).catch(() => {})
    await expect(page).toHaveURL(/\/signin/, { timeout: 10000 })
  })

  test('AUTH-URLGUARD-E2E-09 (positive control): Marketing Admin can still reach /admin/dashboard', async ({ page }) => {
    await signInViaUI(page, 'madmin@tasking.com')
    await expect(page).toHaveURL(/\/admin\/dashboard/, { timeout: 10000 })
  })

  test('AUTH-URLGUARD-E2E-10 (positive control): User Admin can still reach /useradmin/dashboard', async ({ page }) => {
    await signInViaUI(page, 'uadmin@tasking.com')
    await expect(page).toHaveURL(/\/useradmin\/dashboard/, { timeout: 10000 })
  })
})
