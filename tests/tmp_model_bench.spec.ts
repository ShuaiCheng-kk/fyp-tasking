import { test } from '@playwright/test'

test('benchmark current model generation time (28 slots)', async ({ page }) => {
  test.setTimeout(120000)
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

  const genBtn = page.getByRole('button', { name: 'Generate Schedule with AI' })
  const start = Date.now()
  const [response] = await Promise.all([
    page.waitForResponse(res => res.url().includes('scheduling-rules/generate'), { timeout: 100000 }),
    genBtn.click({ timeout: 10000 }),
  ])
  const elapsed = Date.now() - start
  const body = await response.json()
  console.log('MODEL_BENCH_RESULT', JSON.stringify({ elapsedMs: elapsed, status: response.status(), success: body.success, blocks: body.suggestions?.length }))
})
