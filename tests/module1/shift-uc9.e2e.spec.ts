import { test, expect } from '@playwright/test'
import { seedTestOwnerAndCompany, cleanupTestOwnerAndCompany, TestOwner } from '../helpers/seed'
import {
  createDepartment, createCompanyMember, cleanupCompanyMember, signInAs, ownerCreds, memberCreds, setCompanyPlan, SeededMember,
} from './shift-e2e-helpers'

test.describe.configure({ mode: 'serial' })

let seeded: TestOwner
let partner: SeededMember
let departmentId: string

test.beforeAll(async () => {
  seeded = await seedTestOwnerAndCompany('uc9e2e')
  await setCompanyPlan(seeded.companyId, 'Paid')
  departmentId = await createDepartment(seeded.companyId, 'UC9 E2E Department')
  partner = await createCompanyMember({ companyId: seeded.companyId, role: 'Partner', label: 'partner-uc9' })
})

test.afterAll(async () => {
  await cleanupCompanyMember(partner)
  await cleanupTestOwnerAndCompany(seeded)
})

// No shifts exist anywhere in this freshly seeded company, so the Bulk Shift Editor's default
// filter matches nothing the moment it opens.
test('UC9-A1-E2E-O: for the Owner, the Bulk Shift Editor shows an empty state when there are no matching shifts', async ({ page }) => {
  await signInAs(page, 'Owner', ownerCreds(seeded))
  await page.goto('/owner/shifts')
  await page.getByRole('button', { name: 'Bulk Edit' }).click()

  await expect(page.getByText('No shifts found for this date range.')).toBeVisible()
})

test('UC9-A1-E2E-P: for the Partner, the Bulk Shift Editor shows an empty state when there are no matching shifts', async ({ page }) => {
  await signInAs(page, 'Partner', memberCreds(partner, seeded.companyId))
  await page.goto('/partner/shifts')
  await page.getByRole('button', { name: 'Bulk Edit' }).click()

  await expect(page.getByText('No shifts found for this date range.')).toBeVisible()
})
