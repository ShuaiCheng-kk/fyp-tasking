/**
 * Playwright global setup — signs in as Owner once, saves storage state.
 * All owner tests reuse this state so the middleware auth check passes.
 */

import { chromium } from '@playwright/test'

const BASE = 'http://localhost:3000'

async function globalSetup() {
  const browser = await chromium.launch()
  const page    = await browser.newPage()

  // Navigate to sign-in
  await page.goto(`${BASE}/signin`)
  await page.fill('input[type="email"]',    'owner@testing.com')
  await page.fill('input[type="password"]', 'Test123!')
  await page.click('button[type="submit"]')

  // Wait for redirect to owner dashboard
  await page.waitForURL('**/owner/**', { timeout: 20000 })

  // Save auth state (cookies + localStorage) for reuse in tests
  await page.context().storageState({ path: 'tests/.auth/owner.json' })

  await browser.close()
}

export default globalSetup
