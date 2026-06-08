import { test, expect } from '@playwright/test'

test.describe('Owner — Authentication', () => {
  test('正确密码登录后跳转到 /owner/dashboard', async ({ page }) => {
    await page.goto('/signin')
    await page.waitForLoadState('networkidle')

    await page.getByLabel('Email').fill('owner@test.com')
    await page.getByLabel('Password').fill('111111')
    await page.getByRole('button', { name: 'Sign In' }).click()

    await page.waitForURL('**/owner/dashboard', { timeout: 15000 })
    expect(page.url()).toContain('/owner/dashboard')
  })

  test('错误密码显示错误提示', async ({ page }) => {
    await page.goto('/signin')
    await page.waitForLoadState('networkidle')

    await page.getByLabel('Email').fill('owner@test.com')
    await page.getByLabel('Password').fill('wrongpassword')
    await page.getByRole('button', { name: 'Sign In' }).click()

    await expect(page.getByText('Invalid email or password')).toBeVisible({ timeout: 8000 })
    expect(page.url()).toContain('/signin')
  })

  test('未登录直接访问 /owner/dashboard 被重定向', async ({ page }) => {
    await page.goto('/owner/dashboard')
    await page.waitForURL(url => !url.pathname.includes('/owner/dashboard'), { timeout: 10000 })
    expect(page.url()).not.toContain('/owner/dashboard')
  })

  test('登录后点击 Logout 退出登录', async ({ page }) => {
    await page.goto('/signin')
    await page.waitForLoadState('networkidle')

    await page.getByLabel('Email').fill('owner@test.com')
    await page.getByLabel('Password').fill('111111')
    await page.getByRole('button', { name: 'Sign In' }).click()
    await page.waitForURL('**/owner/dashboard', { timeout: 15000 })

    // Hover sidebar to expand it, then click Logout
    const sidebar = page.locator('aside').first()
    await sidebar.hover()
    await page.waitForTimeout(300)

    const logoutBtn = page.locator('button').filter({ hasText: 'Logout' })
    await logoutBtn.click({ force: true })

    // After logout, redirected to /signout or /signin or /
    await page.waitForURL(url => !url.pathname.startsWith('/owner'), { timeout: 15000 })
    expect(page.url()).not.toContain('/owner/')
  })
})
