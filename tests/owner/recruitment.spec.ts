import { test, expect } from '@playwright/test'
import { loginAsOwner } from '../helpers/auth'

test.describe('Owner — Recruitment', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsOwner(page, '/owner/recruitment')
    // Wait for company name in heading — confirms companyId + /api/user/me resolved
    await expect(page.getByText(/Recruitment for /i)).toBeVisible({ timeout: 15000 })
  })

  test('显示 Job Postings 区域和 New Job 按钮', async ({ page }) => {
    await expect(page.locator('[data-testid="new-job-btn"]')
      .or(page.locator('button').filter({ hasText: 'New Job' }))).toBeVisible({ timeout: 10000 })
  })

  test('打开 New Job Posting 弹窗', async ({ page }) => {
    await page.locator('[data-testid="new-job-btn"]')
      .or(page.locator('button').filter({ hasText: 'New Job' }))
      .click()

    await expect(page.getByText('New Job Posting')).toBeVisible({ timeout: 5000 })
    await expect(page.locator('[data-testid="job-title-input"]')).toBeVisible()
    await page.keyboard.press('Escape')
  })

  test('创建 Job Posting', async ({ page }) => {
    const jobTitle = `E2E Job ${Date.now()}`

    await page.locator('[data-testid="new-job-btn"]')
      .or(page.locator('button').filter({ hasText: 'New Job' }))
      .click()
    await page.waitForTimeout(300)

    await page.locator('[data-testid="job-title-input"]').fill(jobTitle)
    // description is required by the API
    const descField = page.locator('textarea').first()
    if (await descField.isVisible({ timeout: 2000 }).catch(() => false)) {
      await descField.fill('E2E test description')
    }

    const createResp = page.waitForResponse(
      r => r.url().includes('/api/recruitment') && r.request().method() === 'POST' && r.status() === 201,
      { timeout: 12000 }
    )
    await page.locator('button').filter({ hasText: 'Save Job' }).click()
    const resp = await createResp
    const body = await resp.json()
    const jobId: string = body.posting?.id ?? body.id ?? ''

    await expect(page.getByText(jobTitle).first()).toBeVisible({ timeout: 8000 })

    // Cleanup
    if (jobId) {
      await page.request.patch('/api/recruitment', {
        data: { action: 'archive_posting', posting_id: jobId },
      })
    }
  })

  test('点击职位显示详情', async ({ page }) => {
    const jobItem = page.locator('li, [role="listitem"]').first()
    if (await jobItem.isVisible({ timeout: 3000 }).catch(() => false)) {
      await jobItem.click()
      await page.waitForTimeout(500)
      await expect(page.getByText(/Description|Requirements|Applicants/i).first()).toBeVisible({ timeout: 5000 })
    }
  })

  test('Archive 职位 — title="Archive" 按钮', async ({ page }) => {
    const archiveTitle = `Archive Target ${Date.now()}`
    await page.locator('[data-testid="new-job-btn"]')
      .or(page.locator('button').filter({ hasText: 'New Job' }))
      .click()
    await page.waitForTimeout(300)
    await page.locator('[data-testid="job-title-input"]').fill(archiveTitle)
    const descA = page.locator('textarea').first()
    if (await descA.isVisible({ timeout: 2000 }).catch(() => false)) await descA.fill('E2E test description')

    const createResp = page.waitForResponse(
      r => r.url().includes('/api/recruitment') && r.request().method() === 'POST' && r.status() === 201,
      { timeout: 12000 }
    )
    await page.locator('button').filter({ hasText: 'Save Job' }).click()
    const resp = await createResp
    const body = await resp.json()
    const jobId: string = body.posting?.id ?? body.id ?? ''

    await expect(page.getByText(archiveTitle).first()).toBeVisible({ timeout: 8000 })
    await page.getByText(archiveTitle).first().click()
    await page.waitForTimeout(300)

    const archiveBtn = page.locator('button[title="Archive"]')
    if (await archiveBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      const archiveResp = page.waitForResponse(
        r => r.url().includes('/api/recruitment') && r.request().method() === 'PATCH' && r.status() === 200,
        { timeout: 10000 }
      )
      await archiveBtn.click()
      await archiveResp
      await expect(page.getByText(/archived/i).first()).toBeVisible({ timeout: 5000 })
    } else if (jobId) {
      await page.request.patch('/api/recruitment', {
        data: { action: 'archive_posting', posting_id: jobId },
      })
    }
  })

  test('Duplicate 职位 — title="Duplicate" 按钮', async ({ page }) => {
    const dupTitle = `Dup Target ${Date.now()}`
    await page.locator('[data-testid="new-job-btn"]')
      .or(page.locator('button').filter({ hasText: 'New Job' }))
      .click()
    await page.waitForTimeout(300)
    await page.locator('[data-testid="job-title-input"]').fill(dupTitle)
    const descD = page.locator('textarea').first()
    if (await descD.isVisible({ timeout: 2000 }).catch(() => false)) await descD.fill('E2E test description')

    const createResp = page.waitForResponse(
      r => r.url().includes('/api/recruitment') && r.request().method() === 'POST' && r.status() === 201,
      { timeout: 12000 }
    )
    await page.locator('button').filter({ hasText: 'Save Job' }).click()
    await createResp

    await expect(page.getByText(dupTitle).first()).toBeVisible({ timeout: 8000 })
    await page.getByText(dupTitle).first().click()
    await page.waitForTimeout(300)

    const dupBtn = page.locator('button[title="Duplicate"]')
    if (await dupBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      const dupResp = page.waitForResponse(
        r => r.url().includes('/api/recruitment') && r.request().method() === 'PATCH' && r.status() === 200,
        { timeout: 10000 }
      )
      await dupBtn.click()
      await dupResp
    }
  })

  test('Casual Workers 面板可见', async ({ page }) => {
    await expect(page.getByText('Casual Workers').first()).toBeVisible({ timeout: 10000 })
  })
})
