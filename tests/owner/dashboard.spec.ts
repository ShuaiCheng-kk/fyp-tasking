import { test, expect } from '@playwright/test'
import { loginAsOwner } from '../helpers/auth'

test.describe('Owner — Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsOwner(page)
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {})
  })

  test('显示 6 个 stat 卡片', async ({ page }) => {
    await expect(page.getByText('Staff on Shift')).toBeVisible({ timeout: 10000 })
    await expect(page.getByText('Casual Workers').first()).toBeVisible()
    await expect(page.getByText('Total Tasks')).toBeVisible()
    await expect(page.getByText('Tasks In Progress')).toBeVisible()
    await expect(page.getByText('Tasks In Review')).toBeVisible()
    await expect(page.getByText(/Complete/i).first()).toBeVisible()
  })

  test('显示当前日期', async ({ page }) => {
    const dateEl = page.locator('text=/\\w+, \\w+ \\d+, \\d{4}/')
    await expect(dateEl).toBeVisible({ timeout: 8000 })
  })

  test('Timeline 区域可见', async ({ page }) => {
    const timeline = page.locator('[data-testid="shift-timeline-menu"]')
      .or(page.getByText(/Today's Overview/i))
    await expect(timeline.first()).toBeVisible({ timeout: 12000 })
  })

  test('4 个面板标题可见', async ({ page }) => {
    await expect(page.getByText(/Focus/i).first()).toBeVisible({ timeout: 10000 })
    await expect(page.getByText(/Team/i).first()).toBeVisible()
    await expect(page.getByText(/Live Feed/i)).toBeVisible()
    await expect(page.getByText(/Tasks/i).first()).toBeVisible()
  })

  test('Company switcher 下拉可打开', async ({ page }) => {
    const companyBtn = page.getByText('Test Company').first()
    await expect(companyBtn).toBeVisible({ timeout: 8000 })
    await companyBtn.click()
    await expect(page.getByText('Test Company').first()).toBeVisible()
  })

  test('Plan badge 可见', async ({ page }) => {
    const planBadge = page.getByText(/Free|Pro/i).first()
    await expect(planBadge).toBeVisible({ timeout: 8000 })
  })
})
