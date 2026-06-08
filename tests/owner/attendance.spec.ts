import { test, expect } from '@playwright/test'
import { loginAsOwner } from '../helpers/auth'

test.describe('Owner — Attendance', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsOwner(page, '/owner/attendance')
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {})
  })

  test('显示 6 个统计卡片', async ({ page }) => {
    await expect(page.getByText('Assignments')).toBeVisible({ timeout: 10000 })
    await expect(page.getByText('Pending').first()).toBeVisible()
    await expect(page.getByText('Approved').first()).toBeVisible()
    await expect(page.getByText('Late').first()).toBeVisible()
    await expect(page.getByText('Absent').first()).toBeVisible()
    await expect(page.getByText('Overtime')).toBeVisible()
  })

  test('显示 Attendance Records 区域', async ({ page }) => {
    await expect(page.getByText('Attendance Records').first()).toBeVisible({ timeout: 10000 })
  })

  test('显示 AI Timesheet Review 区域', async ({ page }) => {
    await expect(page.getByText('AI Timesheet Review')).toBeVisible({ timeout: 10000 })
    await expect(page.locator('button').filter({ hasText: 'Review' }).first()).toBeVisible()
    await expect(page.getByText('Apply clean approvals')).toBeVisible()
  })

  test('显示 Time-off / Break-waiver 侧边面板', async ({ page }) => {
    await expect(page.getByText('Time-off / Break-waiver')).toBeVisible({ timeout: 10000 })
  })

  test('显示 Shift Swaps 侧边面板', async ({ page }) => {
    await expect(page.getByText('Shift Swaps')).toBeVisible({ timeout: 10000 })
  })

  test('Approve 按钮 — title="Approve" 图标按钮打开 Review modal', async ({ page }) => {
    const approveBtn = page.locator('button[title="Approve"]').first()
    const hasPending = await approveBtn.isVisible({ timeout: 5000 }).catch(() => false)
    if (!hasPending) {
      await expect(page.getByText('Attendance Records').first()).toBeVisible()
      return
    }
    await approveBtn.click()
    await expect(page.getByText('Final Attendance Review')).toBeVisible({ timeout: 5000 })
    await expect(page.locator('select')).toHaveValue('approved')
    await expect(page.locator('button').filter({ hasText: 'Save Review' })).toBeVisible()
    await page.locator('button').filter({ hasText: 'Cancel' }).click()
  })

  test('Modify 按钮 — title="Modify" 打开 modal 并显示 Clock In/Out 字段', async ({ page }) => {
    const modifyBtn = page.locator('button[title="Modify"]').first()
    const visible = await modifyBtn.isVisible({ timeout: 5000 }).catch(() => false)
    if (!visible) return

    await modifyBtn.click()
    await expect(page.getByText('Final Attendance Review')).toBeVisible({ timeout: 5000 })
    await expect(page.locator('select')).toHaveValue('modified')
    await expect(page.getByText('Clock In')).toBeVisible()
    await expect(page.getByText('Clock Out')).toBeVisible()
    await page.locator('button').filter({ hasText: 'Cancel' }).click()
  })

  test('Reject 按钮 — title="Reject" 打开 modal 决策预设为 rejected', async ({ page }) => {
    const rejectBtn = page.locator('button[title="Reject"]').first()
    const visible = await rejectBtn.isVisible({ timeout: 5000 }).catch(() => false)
    if (!visible) return

    await rejectBtn.click()
    await expect(page.getByText('Final Attendance Review')).toBeVisible({ timeout: 5000 })
    await expect(page.locator('select')).toHaveValue('rejected')
    await page.locator('button').filter({ hasText: 'Cancel' }).click()
  })

  test('Refresh 按钮重新加载数据', async ({ page }) => {
    await expect(page.locator('button').filter({ hasText: 'Refresh' })).toBeVisible({ timeout: 8000 })
    const refreshResp = page.waitForResponse(
      r => r.url().includes('/api/attendance') && r.status() === 200,
      { timeout: 10000 }
    )
    await page.locator('button').filter({ hasText: 'Refresh' }).click()
    await refreshResp
  })
})
