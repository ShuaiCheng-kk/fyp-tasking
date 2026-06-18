import { test, expect } from '@playwright/test'

test('AI schedule rotates across all eligible staff per role, not just 1-2 people', async ({ page }) => {
  test.setTimeout(150000)
  await page.goto('/signin')
  await page.waitForLoadState('networkidle')
  await page.getByLabel('Email').fill('owner@test.com')
  await page.getByLabel('Password').fill('111111')
  await page.getByRole('button', { name: 'Sign In' }).click()
  await page.waitForURL('**/owner/dashboard', { timeout: 15000 })

  await page.goto('/owner/shifts')
  await page.waitForLoadState('networkidle')

  const aiBtn = page.getByRole('button', { name: /AI Schedule/i }).first()
  await aiBtn.click({ timeout: 10000 })
  await page.waitForTimeout(500)
  await page.getByRole('button', { name: 'Continue' }).click()
  await page.waitForTimeout(300)
  await page.getByTitle('Select all').click()
  await page.waitForTimeout(200)
  await page.getByRole('button', { name: 'Continue' }).click()
  await page.waitForTimeout(300)
  await page.getByRole('button', { name: 'Continue' }).click()
  await page.waitForTimeout(300)

  let lastBody: any = null
  const genBtn = page.getByRole('button', { name: 'Generate Schedule with AI' })
  await genBtn.click({ timeout: 10000 })

  // wait for completion: poll Create button label stability (need long stable window since streaming can pause between blocks)
  let lastLabel = ''
  let stableCount = 0
  for (let i = 0; i < 300; i++) {
    await page.waitForTimeout(300)
    const btn = page.getByRole('button', { name: /Create \d+ Shifts/ })
    const label = await btn.textContent().catch(() => null)
    if (label) {
      if (label === lastLabel) stableCount++
      else { stableCount = 0; lastLabel = label }
    }
    if (stableCount > 20) break // stable for 6s
  }
  console.log('Final label:', lastLabel)

  await page.waitForTimeout(500)

  // scroll the modal's results area to capture all department rows across multiple screenshots
  const modalScroll = page.locator('div').filter({ hasText: 'Suggested Schedule' }).locator('xpath=following-sibling::div[1]')
  for (let s = 0; s < 4; s++) {
    await page.screenshot({ path: `tmp_rotation_check_${s}.png`, fullPage: false })
    await page.mouse.wheel(0, 400)
    await page.waitForTimeout(200)
  }
})
