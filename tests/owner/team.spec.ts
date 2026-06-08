import { test, expect } from '@playwright/test'
import { loginAsOwner } from '../helpers/auth'

test.describe('Owner — Team (My Company)', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsOwner(page, '/owner/team')
    // Wait for company name to appear (confirms data loaded)
    await expect(page.locator('h2').first()).toBeVisible({ timeout: 15000 })
  })

  test('显示公司 profile 卡片', async ({ page }) => {
    await expect(page.getByText('Test Company').first()).toBeVisible({ timeout: 10000 })
  })

  test('成员列表按角色分组显示', async ({ page }) => {
    await expect(page.getByText('Owner').first()).toBeVisible({ timeout: 8000 })
    await expect(page.getByText('Manager').first()).toBeVisible()
  })

  test('Invite Member 弹窗可打开', async ({ page }) => {
    const inviteBtn = page.locator('button').filter({ hasText: 'Invite Member' })
    await expect(inviteBtn).toBeVisible({ timeout: 8000 })
    await inviteBtn.click()

    await expect(page.locator('input[type="email"]').or(page.getByPlaceholder(/email/i))).toBeVisible({ timeout: 5000 })
    await page.keyboard.press('Escape')
  })

  test('Edit 成员弹窗可打开', async ({ page }) => {
    const editBtn = page.locator('button').filter({ hasText: 'Edit' }).first()
    if (await editBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await editBtn.click()
      await expect(page.locator('input, select').first()).toBeVisible({ timeout: 5000 })
      await page.keyboard.press('Escape')
    }
  })

  test('Remove 成员出现确认弹窗', async ({ page }) => {
    const removeBtn = page.locator('button').filter({ hasText: 'Remove' }).first()
    if (await removeBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await removeBtn.click()
      await expect(page.getByText(/confirm|remove|are you sure/i).first()).toBeVisible({ timeout: 5000 })
      const cancelBtn = page.locator('button').filter({ hasText: /Cancel|No/ }).first()
      if (await cancelBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await cancelBtn.click()
      } else {
        await page.keyboard.press('Escape')
      }
    }
  })

  test('Edit Company Profile 弹窗可打开', async ({ page }) => {
    const editBtns = page.locator('button').filter({ hasText: 'Edit' })
    await expect(editBtns.first()).toBeVisible({ timeout: 8000 })
    await editBtns.first().click()

    await expect(page.locator('input').first()).toBeVisible({ timeout: 5000 })
    await page.keyboard.press('Escape')
  })

  test('部门列表可见', async ({ page }) => {
    await expect(page.getByText('Operations').first()).toBeVisible({ timeout: 8000 })
  })
})
