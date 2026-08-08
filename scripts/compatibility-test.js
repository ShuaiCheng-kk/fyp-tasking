/**
 * scripts/compatibility-test.js - Compatibility NFR verification
 *
 * Verifies the Compatibility Requirement: the app stays fully responsive across screen sizes and
 * functions correctly across standard browsers, with no page-level scrollbar breaking the layout
 * (the "自适应" rule in CLAUDE.md section 4 - every page locks to one viewport and lets its own
 * panels scroll internally instead).
 *
 * For each of the 6 reference owner pages (attendance, shifts, communication, tasks, team,
 * recruitment - the pages CLAUDE.md names as already converted to this pattern) x 3 viewport
 * widths (desktop / laptop / mobile) x 3 browser engines (Chromium, Firefox, WebKit), this loads
 * the page as a real signed-in Owner and asserts the page itself never scrolls:
 *   document.documentElement.scrollHeight === clientHeight (no vertical page scroll)
 *   document.documentElement.scrollWidth  === clientWidth  (no horizontal page scroll)
 * A screenshot is saved per combination as visual evidence.
 *
 * Usage:
 *   npm run dev                         # in one terminal
 *   node scripts/compatibility-test.js  # in another terminal
 *
 * Requires the database to be seeded (node scripts/seed.js) so owner@test.com exists.
 */

const { chromium, firefox, webkit } = require('@playwright/test')
const fs = require('fs')
const path = require('path')

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000'
const PASSWORD = '111111'
const SCREENSHOT_DIR = path.join(__dirname, '..', '.compat-screenshots')

const ENGINES = [
  ['chromium', chromium],
  ['firefox', firefox],
  ['webkit', webkit],
]

const VIEWPORTS = [
  ['desktop-1920x1080', 1920, 1080],
  ['laptop-1366x768', 1366, 768],
  ['mobile-390x844', 390, 844],
]

const PAGES = [
  ['shifts', '/owner/shifts'],
  ['tasks', '/owner/tasks'],
  ['team', '/owner/team'],
  ['attendance', '/owner/attendance'],
  ['communication', '/owner/communication'],
  ['recruitment', '/owner/recruitment'],
]

function pad(str, len) {
  return String(str).padEnd(len)
}

async function main() {
  console.log(`Compatibility test against ${BASE_URL}`)
  console.log(`${PAGES.length} pages x ${VIEWPORTS.length} viewports x ${ENGINES.length} browser engines = ${PAGES.length * VIEWPORTS.length * ENGINES.length} checks\n`)
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true })

  const results = []

  for (const [engineName, engine] of ENGINES) {
    console.log(`--- ${engineName} ---`)
    let browser
    try {
      browser = await engine.launch()
    } catch (err) {
      console.log(`  ! Could not launch ${engineName}: ${err.message}`)
      console.log(`    (run "npx playwright install ${engineName}" if this browser engine isn't installed)`)
      continue
    }

    for (const [viewportName, width, height] of VIEWPORTS) {
      const context = await browser.newContext({ viewport: { width, height } })
      const page = await context.newPage()

      // Sign in once per (engine, viewport) combination, reused across all 6 pages.
      await page.goto(`${BASE_URL}/signin`)
      await page.fill('input[type="email"]', 'owner@test.com')
      await page.fill('input[type="password"]', PASSWORD)
      await page.click('button[type="submit"]')
      await page.waitForURL(url => !url.pathname.includes('/signin'), { timeout: 15000 }).catch(() => {})

      for (const [pageName, pagePath] of PAGES) {
        const label = `${engineName} | ${viewportName} | ${pageName}`
        try {
          await page.goto(`${BASE_URL}${pagePath}`, { waitUntil: 'load', timeout: 20000 })
          await page.waitForTimeout(1500)
          // A late client-side redirect (auth/session re-check) can still be in flight right after
          // "load" fires - settle once more before reading layout, so we measure the real page,
          // not a checkpoint mid-navigation.
          await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {})

          const dims = await page.evaluate(() => ({
            scrollHeight: document.documentElement.scrollHeight,
            clientHeight: document.documentElement.clientHeight,
            scrollWidth: document.documentElement.scrollWidth,
            clientWidth: document.documentElement.clientWidth,
          }))
          const noVerticalScroll = dims.scrollHeight <= dims.clientHeight + 2 // +2px rounding tolerance
          const noHorizontalScroll = dims.scrollWidth <= dims.clientWidth + 2
          const pass = noVerticalScroll && noHorizontalScroll

          const screenshotPath = path.join(SCREENSHOT_DIR, `${engineName}_${viewportName}_${pageName}.png`)
          await page.screenshot({ path: screenshotPath }).catch(() => {})

          results.push({ engineName, viewportName, pageName, pass, dims })
          console.log(
            `  ${pad(label, 42)} ${pass ? 'PASS' : 'FAIL'}` +
            (pass ? '' : ` (scroll ${dims.scrollHeight}x${dims.scrollWidth} vs viewport ${dims.clientHeight}x${dims.clientWidth})`)
          )
        } catch (err) {
          results.push({ engineName, viewportName, pageName, pass: false, error: err.message })
          console.log(`  ${pad(label, 42)} ERROR: ${err.message.split('\n')[0]}`)
        }
      }
      await context.close()
    }
    await browser.close()
  }

  const failures = results.filter(r => !r.pass)
  console.log(`\nScreenshots saved to ${SCREENSHOT_DIR}\n`)
  console.log(allPassLine(results, failures))
}

function allPassLine(results, failures) {
  if (results.length === 0) return 'RESULT: NO CHECKS RAN (no browser engines available).'
  return failures.length === 0
    ? `RESULT: ALL PASS. ${results.length} page/viewport/browser combinations, zero page-level scroll detected.`
    : `RESULT: FAIL. ${failures.length}/${results.length} combinations had a page-level scrollbar.`
}

main()
