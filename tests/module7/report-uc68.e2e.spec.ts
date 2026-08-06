import { test, expect } from '@playwright/test'
import { seedTestOwnerAndCompany, cleanupTestOwnerAndCompany, TestOwner } from '../helpers/seed'
import { createCompanyMember, cleanupCompanyMember, signInAs, ownerCreds, memberCreds, SeededMember } from '../module1/shift-e2e-helpers'

// UC68 (Export Report) is implemented entirely client-side — the "Export Report" button on
// src/app/owner|partner/report/page.tsx builds a PDF in-browser with jsPDF from data already
// fetched via UC66's /api/report/company, with no server endpoint of its own. There is nothing
// for a Vitest unit test to hit, so this is a Playwright page-fixture E2E test.

test.describe.configure({ mode: 'serial' })

let seeded: TestOwner
let partner: SeededMember

test.beforeAll(async () => {
  seeded = await seedTestOwnerAndCompany('uc68e2e')
  partner = await createCompanyMember({ companyId: seeded.companyId, role: 'Partner', label: 'partner-uc68' })
})

test.afterAll(async () => {
  await cleanupCompanyMember(partner)
  await cleanupTestOwnerAndCompany(seeded)
})

test('UC68-M-E2E-O: Owner exports the currently viewed report as a PDF', async ({ page }) => {
  await signInAs(page, 'Owner', ownerCreds(seeded))
  await page.goto('/owner/report')

  const exportButton = page.getByRole('button', { name: 'Export Report' })
  await expect(exportButton).toBeEnabled({ timeout: 15000 })

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    exportButton.click(),
  ])
  expect(download.suggestedFilename()).toMatch(/^tasking-report-\d{4}-\d{2}-\d{2}-to-\d{4}-\d{2}-\d{2}\.pdf$/)
})

test('UC68-M-E2E-P: Partner exports the currently viewed report as a PDF', async ({ page }) => {
  await signInAs(page, 'Partner', memberCreds(partner, seeded.companyId))
  await page.goto('/partner/report')

  const exportButton = page.getByRole('button', { name: 'Export Report' })
  await expect(exportButton).toBeEnabled({ timeout: 15000 })

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    exportButton.click(),
  ])
  expect(download.suggestedFilename()).toMatch(/^tasking-report-\d{4}-\d{2}-\d{2}-to-\d{4}-\d{2}-\d{2}\.pdf$/)
})
