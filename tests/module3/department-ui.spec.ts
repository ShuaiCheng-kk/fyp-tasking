import { test, expect } from '@playwright/test'
import { seedTestOwnerAndCompany, cleanupTestOwnerAndCompany, TestOwner } from '../helpers/seed'

// End-to-end test for UC29-31 — Create / Edit / Delete Department, driven entirely through the real UI.

let seeded: TestOwner

test.beforeAll(async () => {
  seeded = await seedTestOwnerAndCompany('dept-e2e')
})

test.afterAll(async () => {
  await cleanupTestOwnerAndCompany(seeded)
})

test('owner can sign in and add, rename, then delete a department', async ({ page }) => {
  await page.goto('/signin')
  await page.fill('#signin-email', seeded.email)
  await page.fill('#signin-password', seeded.password)
  await page.click('button:has-text("Sign In")')
  await page.waitForURL('**/owner/dashboard', { timeout: 15000 })

  await page.goto('/owner/team')

  // Add department
  await page.locator('.all-block-dept button:has-text("Add")').first().click()
  await page.getByPlaceholder('Operations').fill('Operations')
  await page.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByText('Department created successfully.')).toBeVisible({ timeout: 10000 })
  await expect(page.locator('.dept-card-item', { hasText: 'Operations' }).first()).toBeVisible()

  // Rename department
  await page.locator('.dept-card-item', { hasText: 'Operations' }).first().locator('button').click()
  await page.getByPlaceholder('Operations').fill('Logistics')
  await page.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByText('Department updated successfully.')).toBeVisible({ timeout: 10000 })
  await expect(page.locator('.dept-card-item', { hasText: 'Logistics' }).first()).toBeVisible()

  // Delete department
  await page.locator('.dept-card-item', { hasText: 'Logistics' }).first().locator('button').click()
  await page.getByRole('button', { name: 'Delete' }).click()
  await expect(page.getByText('Department deleted successfully.')).toBeVisible({ timeout: 10000 })
  await expect(page.locator('.dept-card-item', { hasText: 'Logistics' })).toHaveCount(0)
})

// Regression for a bug found during manual testing (2026-07-29): switching the Add Department
// modal to its "Import" tab and then closing without importing left `departmentModalTab` stuck
// on 'import'. The next Edit Department save then ran the CSV-import code path instead of the
// update path — silently no-opping the rename and, because the stale import-rows list still
// referenced already-deleted department names, resurrecting them. Fixed by scoping the import
// branch to `departmentModal === 'add'` and resetting the tab when opening Edit.
test('switching Add Department to the Import tab does not hijack a later Edit Department save', async ({ page }) => {
  await page.goto('/signin')
  await page.fill('#signin-email', seeded.email)
  await page.fill('#signin-password', seeded.password)
  await page.click('button:has-text("Sign In")')
  await page.waitForURL('**/owner/dashboard', { timeout: 15000 })

  await page.goto('/owner/team')

  // Create a department to edit later.
  await page.locator('.all-block-dept button:has-text("Add")').first().click()
  await page.getByPlaceholder('Operations').fill('Alpha')
  await page.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByText('Department created successfully.')).toBeVisible({ timeout: 10000 })

  // Open Add Department again, switch to Import, then close without importing anything.
  await page.locator('.all-block-dept button:has-text("Add")').first().click()
  await page.getByRole('button', { name: 'Import' }).click()
  await page.getByLabel('Close').click()

  // Now edit the existing department and save — this must take the update path, not import.
  await page.locator('.dept-card-item', { hasText: 'Alpha' }).first().locator('button').click()
  await page.getByPlaceholder('Operations').fill('Beta')
  await page.getByRole('button', { name: 'Save' }).click()

  await expect(page.getByText('Department updated successfully.')).toBeVisible({ timeout: 10000 })
  await expect(page.locator('.dept-card-item', { hasText: 'Beta' }).first()).toBeVisible()
  await expect(page.locator('.dept-card-item', { hasText: 'Alpha' })).toHaveCount(0)
  await expect(page.getByText(/imported successfully/)).toHaveCount(0)
})
