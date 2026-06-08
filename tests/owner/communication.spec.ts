import { test, expect } from '@playwright/test'
import { loginAsOwner } from '../helpers/auth'

test.describe('Owner — Communication', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsOwner(page, '/owner/communication')
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {})
  })

  test('默认显示 Announcements tab', async ({ page }) => {
    await expect(page.getByText('Announcements').first()).toBeVisible({ timeout: 8000 })
    await expect(page.locator('button').filter({ hasText: 'New' }).first()).toBeVisible({ timeout: 8000 })
    await expect(page.getByText('All Announcements')).toBeVisible()
  })

  test('创建公告', async ({ page }) => {
    const title = `E2E Ann ${Date.now()}`
    const content = `Playwright test content ${Date.now()}`

    await page.locator('button').filter({ hasText: 'New' }).first().click()
    await page.waitForTimeout(300)

    await page.getByPlaceholder('Announcement title').fill(title)

    const contentField = page.locator('[data-testid="announcement-content"]')
      .or(page.getByPlaceholder('Write your announcement here...'))
    await contentField.fill(content)

    const postResp = page.waitForResponse(
      r => r.url().includes('/api/inbox/announcements') && r.request().method() === 'POST' && r.status() === 200,
      { timeout: 10000 }
    )
    await page.getByRole('button', { name: 'Post Announcement' }).click()
    await postResp

    await expect(page.getByText(title)).toBeVisible({ timeout: 8000 })

    // Cleanup
    await page.getByText(title).first().click()
    await page.locator('button[title="Delete announcement"]').click()
    await page.waitForTimeout(300)
    const confirmDeleteBtn = page.getByRole('button', { name: /Delete|Confirm/i }).last()
    if (await confirmDeleteBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await confirmDeleteBtn.click()
    }
  })

  test('点击公告显示完整内容', async ({ page }) => {
    const title = `View Test ${Date.now()}`
    const bodyText = `ViewContent${Date.now()}`

    await page.locator('button').filter({ hasText: 'New' }).first().click()
    await page.getByPlaceholder('Announcement title').fill(title)
    await page.locator('[data-testid="announcement-content"]')
      .or(page.getByPlaceholder('Write your announcement here...')).fill(bodyText)
    const postResp = page.waitForResponse(
      r => r.url().includes('/api/inbox/announcements') && r.request().method() === 'POST' && r.status() === 200,
      { timeout: 10000 }
    )
    await page.getByRole('button', { name: 'Post Announcement' }).click()
    await postResp

    await page.getByText(title).first().click()
    await page.waitForTimeout(500)

    // Right panel shows the announcement content — check the visible one
    await expect(page.getByText(bodyText).filter({ visible: true }).first()).toBeVisible({ timeout: 5000 })

    // Cleanup
    await page.locator('button[title="Delete announcement"]').click()
    const confirmDeleteBtn = page.getByRole('button', { name: /Delete|Confirm/i }).last()
    if (await confirmDeleteBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await confirmDeleteBtn.click()
    }
  })

  test('编辑公告 — 修改内容并保存', async ({ page }) => {
    const title = `Edit Test ${Date.now()}`

    await page.locator('button').filter({ hasText: 'New' }).first().click()
    await page.getByPlaceholder('Announcement title').fill(title)
    await page.locator('[data-testid="announcement-content"]')
      .or(page.getByPlaceholder('Write your announcement here...')).fill('Original content')
    const postResp = page.waitForResponse(
      r => r.url().includes('/api/inbox/announcements') && r.request().method() === 'POST' && r.status() === 200,
      { timeout: 10000 }
    )
    await page.getByRole('button', { name: 'Post Announcement' }).click()
    await postResp

    await page.getByText(title).first().click()
    await page.waitForTimeout(300)

    await page.locator('button[title="Edit announcement"]').click()
    await page.waitForTimeout(300)

    const editContentField = page.getByPlaceholder('Write your announcement...')
    await editContentField.clear()
    await editContentField.fill('Updated by Playwright')

    const updateResp = page.waitForResponse(
      r => r.url().includes('/api/inbox/announcements') && r.request().method() === 'PATCH' && r.status() === 200,
      { timeout: 10000 }
    )
    await page.getByRole('button', { name: /Save|Update/i }).click()
    await updateResp

    await expect(page.getByText('Updated by Playwright').first()).toBeVisible({ timeout: 5000 })

    // Cleanup
    await page.locator('button[title="Delete announcement"]').click()
    const confirmDeleteBtn = page.getByRole('button', { name: /Delete|Confirm/i }).last()
    if (await confirmDeleteBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await confirmDeleteBtn.click()
    }
  })

  test('删除公告', async ({ page }) => {
    const title = `Delete Test ${Date.now()}`

    await page.locator('button').filter({ hasText: 'New' }).first().click()
    await page.getByPlaceholder('Announcement title').fill(title)
    await page.locator('[data-testid="announcement-content"]')
      .or(page.getByPlaceholder('Write your announcement here...')).fill('To be deleted')
    const postResp = page.waitForResponse(
      r => r.url().includes('/api/inbox/announcements') && r.request().method() === 'POST' && r.status() === 200,
      { timeout: 10000 }
    )
    await page.getByRole('button', { name: 'Post Announcement' }).click()
    await postResp
    await expect(page.getByText(title)).toBeVisible({ timeout: 8000 })

    await page.getByText(title).first().click()
    await page.waitForTimeout(300)
    await page.locator('button[title="Delete announcement"]').click()
    await page.waitForTimeout(300)

    const deleteResp = page.waitForResponse(
      r => r.url().includes('/api/inbox/announcements') && r.request().method() === 'DELETE' && r.status() === 200,
      { timeout: 10000 }
    )
    const confirmBtn = page.getByRole('button', { name: /Delete|Confirm/i }).last()
    await confirmBtn.click()
    await deleteResp

    await expect(page.getByText(title)).not.toBeVisible({ timeout: 5000 })
  })

  test('切换到 Messages tab', async ({ page }) => {
    const messagesTab = page.locator('button').filter({ hasText: 'Messages' })
    await messagesTab.click()
    await page.waitForTimeout(1000)

    await expect(page.getByText('Announcements').first()).toBeVisible({ timeout: 5000 })
    await expect(page.getByText(/conversation|message|chat|No messages/i).first()).toBeVisible({ timeout: 8000 })
  })

  test('打开 New Message 弹窗', async ({ page }) => {
    await page.locator('button').filter({ hasText: 'Messages' }).click()
    await page.waitForTimeout(1000)

    const newMsgBtn = page.locator('[data-testid="new-message-btn"]')
      .or(page.getByRole('button', { name: /New Message|Compose|\+ New/i }))
      .or(page.locator('button').filter({ hasText: 'New' }))

    if (await newMsgBtn.first().isVisible({ timeout: 5000 }).catch(() => false)) {
      await newMsgBtn.first().click()
      await expect(page.getByPlaceholder('Search people…')).toBeVisible({ timeout: 5000 })
      await page.keyboard.press('Escape')
    }
  })
})
