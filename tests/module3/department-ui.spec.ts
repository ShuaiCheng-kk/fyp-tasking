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
