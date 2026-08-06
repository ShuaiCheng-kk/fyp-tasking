import { test, expect } from '@playwright/test'
import { seedTestOwnerAndCompany, cleanupTestOwnerAndCompany, TestOwner } from '../helpers/seed'
import { createDepartment, createCompanyMember, cleanupCompanyMember, signInAs, ownerCreds, memberCreds, SeededMember } from '../module1/shift-e2e-helpers'

test.describe.configure({ mode: 'serial' })

let seeded: TestOwner
let partner: SeededMember
let manager: SeededMember
let employee: SeededMember
let departmentId: string

test.beforeAll(async () => {
  seeded = await seedTestOwnerAndCompany('uc26e2e')
  departmentId = await createDepartment(seeded.companyId, 'UC26 E2E Department')
  partner = await createCompanyMember({ companyId: seeded.companyId, role: 'Partner', label: 'partner-uc26' })
  manager = await createCompanyMember({ companyId: seeded.companyId, departmentId, role: 'Manager', label: 'AlphaManager-uc26' })
  employee = await createCompanyMember({ companyId: seeded.companyId, departmentId, role: 'Employee', label: 'BetaEmployee-uc26' })
})

test.afterAll(async () => {
  await cleanupCompanyMember(partner)
  await cleanupCompanyMember(manager)
  await cleanupCompanyMember(employee)
  await cleanupTestOwnerAndCompany(seeded)
})

// The "Internal Members" search box has no distinguishing placeholder text — verified via a DOM
// dump that on the Team page it is always the second of the two visible search inputs (the first
// belongs to the Casual Workers panel).
async function searchInternalMembers(page: import('@playwright/test').Page, query: string) {
  await page.locator('input').nth(1).fill(query)
}

// The card's dimmed/highlighted state is written as part of a long inline `style` attribute
// string (opacity is one of many properties set together) — asserting on that raw attribute is
// more reliable here than toHaveCSS, which reads the computed style and was observed to report a
// stale value immediately after the transition-bearing style attribute had already updated.
function dimmed(card: import('@playwright/test').Locator) {
  return expect(card).toHaveAttribute('style', /opacity: 0\.35/)
}
function notDimmed(card: import('@playwright/test').Locator) {
  return expect(card).not.toHaveAttribute('style', /opacity: 0\.35/)
}

test('UC26-M-E2E-O: Owner searches the Internal Members list by name', async ({ page }) => {
  await signInAs(page, 'Owner', ownerCreds(seeded))
  await page.goto('/owner/team')

  const managerCard = page.locator('.internal-member-card').filter({ hasText: manager.full_name })
  const employeeCard = page.locator('.internal-member-card').filter({ hasText: employee.full_name })
  await notDimmed(managerCard)
  await notDimmed(employeeCard)

  await searchInternalMembers(page, 'AlphaManager')

  await notDimmed(managerCard)
  await dimmed(employeeCard)

  await searchInternalMembers(page, '')

  await notDimmed(managerCard)
  await notDimmed(employeeCard)
})

test('UC26-M-E2E-P: Partner searches the Internal Members list by role', async ({ page }) => {
  await signInAs(page, 'Partner', memberCreds(partner, seeded.companyId))
  await page.goto('/partner/team')

  const managerCard = page.locator('.internal-member-card').filter({ hasText: manager.full_name })
  const employeeCard = page.locator('.internal-member-card').filter({ hasText: employee.full_name })

  await searchInternalMembers(page, 'employee')

  await notDimmed(employeeCard)
  await dimmed(managerCard)

  await searchInternalMembers(page, '')

  await notDimmed(managerCard)
  await notDimmed(employeeCard)
})
