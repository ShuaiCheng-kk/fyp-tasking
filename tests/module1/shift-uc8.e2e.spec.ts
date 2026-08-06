import { test, expect } from '@playwright/test'
import { seedTestOwnerAndCompany, cleanupTestOwnerAndCompany, TestOwner } from '../helpers/seed'
import {
  createDepartment, createCompanyMember, cleanupCompanyMember, signInAs, ownerCreds, memberCreds, SeededMember,
} from './shift-e2e-helpers'

test.describe.configure({ mode: 'serial' })

let seeded: TestOwner
let partner: SeededMember
let employee: SeededMember
let departmentId: string

test.beforeAll(async () => {
  seeded = await seedTestOwnerAndCompany('uc8e2e')
  departmentId = await createDepartment(seeded.companyId, 'UC8 E2E Department')
  partner = await createCompanyMember({ companyId: seeded.companyId, role: 'Partner', label: 'partner-uc8' })
  employee = await createCompanyMember({ companyId: seeded.companyId, departmentId, role: 'Employee', label: 'employee-uc8' })
})

test.afterAll(async () => {
  await cleanupCompanyMember(partner)
  await cleanupCompanyMember(employee)
  await cleanupTestOwnerAndCompany(seeded)
})

// The Assign Shift window opened from a member's row pre-selects a single date, which is when
// the Splitting option is offered. Adding a second date on the mini calendar should hide it.
async function pickASecondDate(page: import('@playwright/test').Page) {
  const today = new Date()
  const otherDay = today.getDate() > 15 ? today.getDate() - 2 : today.getDate() + 2
  await page.getByRole('button', { name: String(otherDay), exact: true }).click()
}

test('UC8-A1-E2E-O: for the Owner, the Splitting option is hidden once a second date is selected', async ({ page }) => {
  await signInAs(page, 'Owner', ownerCreds(seeded))
  await page.goto('/owner/shifts')
  await page.locator('.shift-dept-card').filter({ hasText: 'UC8 E2E Department' }).click()
  await page.locator('.member-card').filter({ hasText: employee.full_name }).getByTitle('Assign Shift').click()

  await expect(page.getByText('Splitting')).toBeVisible()
  await pickASecondDate(page)
  await expect(page.getByText('Splitting')).not.toBeVisible()
})

test('UC8-A1-E2E-P: for the Partner, the Splitting option is hidden once a second date is selected', async ({ page }) => {
  await signInAs(page, 'Partner', memberCreds(partner, seeded.companyId))
  await page.goto('/partner/shifts')
  await page.locator('.shift-dept-card').filter({ hasText: 'UC8 E2E Department' }).click()
  await page.locator('.member-card').filter({ hasText: employee.full_name }).getByTitle('Assign Shift').click()

  await expect(page.getByText('Splitting')).toBeVisible()
  await pickASecondDate(page)
  await expect(page.getByText('Splitting')).not.toBeVisible()
})
