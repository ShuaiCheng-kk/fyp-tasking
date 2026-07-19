import { test, expect } from '@playwright/test'
import { seedTestOwnerAndCompany, cleanupTestOwnerAndCompany, TestOwner } from '../helpers/seed'

// UC64 (Export Report) is implemented entirely client-side — the "Export Report" button on
// src/app/owner/report/page.tsx builds a PDF in-browser with jsPDF from data already fetched via
// UC62's /api/report/company, with no server endpoint of its own. There is nothing for a unit or
// Playwright `request`-fixture integration test to hit, so this is the one place a Playwright
// `page`-fixture E2E test is the only way to get any coverage at all for this UC.

let seeded: TestOwner

test.beforeAll(async () => {
  seeded = await seedTestOwnerAndCompany('module7-report-ui')
})

test.afterAll(async () => {
  await cleanupTestOwnerAndCompany(seeded)
})

async function signInOwner(page: import('@playwright/test').Page) {
  const res = await page.request.post('/api/auth/signin', {
    data: { email_address: seeded.email, password: seeded.password },
  })
  expect(res.status()).toBe(200)
  await page.addInitScript(({ authUserId, companyId }) => {
    localStorage.setItem('tasking_user_id', authUserId)
    localStorage.setItem('tasking_user_role', 'Owner')
    localStorage.setItem(`tasking_company_id_${authUserId}`, companyId)
  }, { authUserId: seeded.authUserId, companyId: seeded.companyId })
}

test('UC64 Owner exports the Company Report as a PDF', async ({ page }) => {
  await signInOwner(page)
  await page.goto('/owner/report')

  const exportButton = page.getByRole('button', { name: 'Export Report' })
  await expect(exportButton).toBeEnabled({ timeout: 15000 })

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    exportButton.click(),
  ])
  expect(download.suggestedFilename()).toMatch(/\.pdf$/i)
})
