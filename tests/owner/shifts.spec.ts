import { test, expect } from '@playwright/test'
import { loginAsOwner } from '../helpers/auth'

test.describe('Owner — Shifts (Shift Planning)', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsOwner(page, '/owner/shifts')
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {})
  })

  test('页面标题包含 "Shift Planning"', async ({ page }) => {
    await expect(page.getByText(/Shift Planning/i).first()).toBeVisible({ timeout: 10000 })
  })

  test('左侧 Departments 面板可见', async ({ page }) => {
    await expect(page.getByText('Departments')).toBeVisible({ timeout: 20000 })
  })

  test('右侧 Shift Timeline 面板可见', async ({ page }) => {
    await expect(page.getByText('Shift Timeline')).toBeVisible({ timeout: 20000 })
  })

  test('Add 部门按钮可见', async ({ page }) => {
    const addBtn = page.locator('button').filter({ hasText: 'Add' }).first()
    await expect(addBtn).toBeVisible({ timeout: 20000 })
  })

  test('点击部门卡片进入部门详情视图', async ({ page }) => {
    const deptCard = page.locator('article.dept-card, article').filter({ hasText: /Operations|Engineering|Marketing/ }).first()
    const hasDept = await deptCard.isVisible({ timeout: 5000 }).catch(() => false)
    if (!hasDept) {
      await expect(page.getByText('Departments')).toBeVisible()
      return
    }
    await deptCard.click()
    await page.waitForTimeout(300)
    await expect(page.getByText('All Departments')).toBeVisible({ timeout: 5000 })
  })

  test('部门详情视图 — "Schedule shifts" 按钮可见', async ({ page }) => {
    const deptCard = page.locator('article').first()
    const hasDept = await deptCard.isVisible({ timeout: 5000 }).catch(() => false)
    if (!hasDept) return

    await deptCard.click()
    await page.waitForTimeout(300)

    const scheduleBtn = page.locator('button').filter({ hasText: 'Schedule shifts' })
    await expect(scheduleBtn.or(page.getByText('No Manager or Employee yet.'))).toBeVisible({ timeout: 5000 })
  })

  test('部门 MoreHorizontal 菜单 — 包含 Edit / Delete / Assign Manager', async ({ page }) => {
    const moreBtn = page.locator('button[aria-label*="actions"]').first()
    const visible = await moreBtn.isVisible({ timeout: 5000 }).catch(() => false)
    if (!visible) return

    await moreBtn.click()
    await page.waitForTimeout(300)

    await expect(
      page.getByText(/Edit Department|Edit|Delete Department|Delete|Assign Manager/i).first()
    ).toBeVisible({ timeout: 5000 })

    await page.keyboard.press('Escape')
  })

  test('Add 部门弹窗 — 手动创建部门', async ({ page }) => {
    await page.locator('button').filter({ hasText: 'Add' }).first().click()
    await page.waitForTimeout(300)

    const modal = page.getByText(/Add Department|New Department|Department Name/i).first()
    await expect(modal).toBeVisible({ timeout: 20000 })
    await page.keyboard.press('Escape')
  })

  test('Timeline 日期导航 — Today 按钮', async ({ page }) => {
    const todayBtn = page.locator('button').filter({ hasText: 'Today' })
    await expect(todayBtn).toBeVisible({ timeout: 8000 })
    await todayBtn.click()
    await page.waitForTimeout(300)
    await expect(page.getByText('Shift Timeline')).toBeVisible()
  })

  test('Timeline 日期导航 — ChevronRight 前进一天', async ({ page }) => {
    // The ChevronRight (next day) button is right after the Today button
    const todayBtn = page.locator('button').filter({ hasText: 'Today' })
    await expect(todayBtn).toBeVisible({ timeout: 8000 })

    // Next button is the button immediately after Today in the same row
    const nextBtn = todayBtn.locator('..').locator('button').last()
    if (await nextBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await nextBtn.click()
      await page.waitForTimeout(300)
      await expect(page.getByText('Shift Timeline')).toBeVisible()
    }
  })

  test('点击 "Assign" 按钮打开排班抽屉', async ({ page }) => {
    const deptCard = page.locator('article').first()
    const hasDept = await deptCard.isVisible({ timeout: 5000 }).catch(() => false)
    if (!hasDept) return

    await deptCard.click()
    await page.waitForTimeout(300)

    const assignBtn = page.locator('button').filter({ hasText: 'Assign' }).first()
    const hasAssign = await assignBtn.isVisible({ timeout: 3000 }).catch(() => false)
    if (!hasAssign) return

    await assignBtn.click()
    await page.waitForTimeout(400)
    await expect(page.getByText(/Schedule|Assign Shifts|Select dates/i).first()).toBeVisible({ timeout: 5000 })
  })

  test('Timeline MoreHorizontal 菜单 (data-testid="shift-timeline-menu") 可打开', async ({ page }) => {
    const menuBtn = page.locator('[data-testid="shift-timeline-menu"]')
    await expect(menuBtn).toBeVisible({ timeout: 8000 })
    await menuBtn.click()
    await page.waitForTimeout(500)
    // Menu contains "Time window" label and Auto-fit / Full day options
    await expect(page.getByText('Time window').or(page.getByText('Auto-fit')).or(page.getByText('Full day')).first()).toBeVisible({ timeout: 5000 })
    await page.keyboard.press('Escape')
  })
})
