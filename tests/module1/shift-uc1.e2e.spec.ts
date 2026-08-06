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
  seeded = await seedTestOwnerAndCompany('uc1e2e')
  departmentId = await createDepartment(seeded.companyId, 'UC1 E2E Department')
  partner = await createCompanyMember({ companyId: seeded.companyId, role: 'Partner', label: 'partner-uc1' })
  employee = await createCompanyMember({ companyId: seeded.companyId, departmentId, role: 'Employee', label: 'employee-uc1' })
})

test.afterAll(async () => {
  await cleanupCompanyMember(partner)
  await cleanupCompanyMember(employee)
  await cleanupTestOwnerAndCompany(seeded)
})

test('UC1-A1-E2E-O: Owner is blocked from submitting the Assign Shift window with no date selected', async ({ page }) => {
  await signInAs(page, 'Owner', ownerCreds(seeded))
  await page.goto('/owner/shifts')
  await page.locator('.shift-dept-card').filter({ hasText: 'UC1 E2E Department' }).click()
  await page.locator('.member-card').filter({ hasText: employee.full_name }).getByTitle('Assign Shift').click()

  // Opening the modal from a member's row pre-selects today's date as one enabled cell —
  // deselect it on the mini calendar so no cell is enabled, matching UC1's Alt Flow A1 precondition.
  const todayNum = String(new Date().getDate())
  await page.getByRole('button', { name: todayNum, exact: true }).click()

  await page.getByRole('button', { name: /Create.*Draft/i }).click()

  await expect(page.getByText('Select at least one enabled shift cell.')).toBeVisible()
})

test('UC1-A1-E2E-P: Partner is blocked from submitting the Assign Shift window with no date selected', async ({ page }) => {
  await signInAs(page, 'Partner', memberCreds(partner, seeded.companyId))
  await page.goto('/partner/shifts')
  await page.locator('.shift-dept-card').filter({ hasText: 'UC1 E2E Department' }).click()
  await page.locator('.member-card').filter({ hasText: employee.full_name }).getByTitle('Assign Shift').click()

  // Opening the modal from a member's row pre-selects today's date as one enabled cell —
  // deselect it on the mini calendar so no cell is enabled, matching UC1's Alt Flow A1 precondition.
  const todayNum = String(new Date().getDate())
  await page.getByRole('button', { name: todayNum, exact: true }).click()

  await page.getByRole('button', { name: /Create.*Draft/i }).click()

  await expect(page.getByText('Select at least one enabled shift cell.')).toBeVisible()
})
