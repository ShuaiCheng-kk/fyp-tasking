/**
 * scripts/compat-lib.js - shared runner for the per-role compatibility scripts.
 *
 * Verifies the Compatibility Requirement: the app stays fully responsive across screen sizes and
 * functions correctly across standard browsers, with no page-level scrollbar breaking the layout
 * (the "自适应" rule in CLAUDE.md section 4 - every page locks to one viewport and lets its own
 * panels scroll internally instead).
 *
 * Every role has a different page set (CLAUDE.md section 2), so each role gets its own thin
 * scripts/compat-<role>.js that just declares its account + real sidebar-nav pages and calls
 * runRole() here. This file is not run directly - see compat-owner.js etc, or compatibility-test.js
 * to run every role back to back.
 *
 * For each (page) x 3 viewport widths (desktop / laptop / mobile) x 3 browser engines (Chromium,
 * Firefox, WebKit), this loads the page as a real signed-in user of that role and asserts the page
 * never scrolls at the page level:
 *   document.documentElement.scrollHeight === clientHeight (no vertical page scroll)
 *   document.documentElement.scrollWidth  === clientWidth  (no horizontal page scroll)
 * A screenshot is saved per combination as visual evidence, under .compat-screenshots/.
 *
 * Requires the database to be seeded (node scripts/seed.js) so the test account exists.
 * Requires the dev server running (npm run dev) in another terminal.
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

function pad(str, len) {
  return String(str).padEnd(len)
}

/**
 * @param {{ role: string, urlRole?: string, email: string, pages: [string, string][] }} roleConfig
 * @returns {Promise<Array>} results, one per (engine, viewport, page) check
 */
async function runRole({ role, urlRole = role, email, pages }) {
  console.log(`Compatibility test - role: ${role} (${email}) against ${BASE_URL}`)
  console.log(`${pages.length} pages x ${VIEWPORTS.length} viewports x ${ENGINES.length} browser engines = ${pages.length * VIEWPORTS.length * ENGINES.length} checks\n`)
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

      // Sign in once per (engine, viewport) combination, reused across all of this role's pages.
      // Verified, not just attempted: a known race (CLAUDE.md §7 - signin redirect can fire before
      // the session cookie is fully written, worse under concurrent load from other scripts) can
      // leave the browser unauthenticated even after the URL leaves /signin, silently landing on
      // the public marketing homepage instead of the role's dashboard. That page legitimately
      // scrolls, which used to masquerade as a page-layout FAIL on every one of this role's pages
      // instead of the sign-in failure it actually was. One retry, then fail loudly and skip pages.
      const signIn = async () => {
        await page.goto(`${BASE_URL}/signin`)
        await page.fill('input[type="email"]', email)
        await page.fill('input[type="password"]', PASSWORD)
        await page.click('button[type="submit"]')
        await page.waitForURL(url => !url.pathname.includes('/signin'), { timeout: 15000 }).catch(() => {})
        await page.waitForTimeout(500)
        return page.url().startsWith(`${BASE_URL}/${urlRole}/`)
      }

      let signedIn = await signIn()
      if (!signedIn) signedIn = await signIn()

      if (!signedIn) {
        const label = `${engineName} | ${viewportName} | (sign-in)`
        console.log(`  ${pad(label, 42)} SIGN-IN FAILED (landed on ${page.url()} instead of /${urlRole}/... - skipping this role's pages for this run)`)
        results.push({ engineName, viewportName, role, pageName: '(sign-in)', pass: false, error: `sign-in did not reach /${urlRole}/ - landed on ${page.url()}` })
        await context.close().catch(() => {})
        continue
      }

      for (const [pageName, pagePath] of pages) {
        const label = `${engineName} | ${viewportName} | ${pageName}`
        try {
          try {
            await page.goto(`${BASE_URL}${pagePath}`, { waitUntil: 'load', timeout: 20000 })
          } catch (navErr) {
            // A client-side redirect (e.g. a role's own auth/gate check - Casual Worker's payment
            // gate does this on every route until payment info is on file) can fire while this
            // goto() is still in flight. Playwright then reports the goto() itself as aborted
            // ("NS_BINDING_ABORTED" on Firefox, "interrupted by another navigation" on WebKit) even
            // though the browser is correctly settled on wherever the app actually sent it. That's
            // not a layout bug - let the redirect finish landing and measure the real result.
            if (!/NS_BINDING_ABORTED|interrupted by another navigation|ERR_ABORTED/i.test(navErr.message)) throw navErr
            await page.waitForLoadState('load', { timeout: 20000 }).catch(() => {})
          }
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

          const screenshotPath = path.join(SCREENSHOT_DIR, `${engineName}_${viewportName}_${role}_${pageName}.png`)
          await page.screenshot({ path: screenshotPath }).catch(() => {})

          results.push({ engineName, viewportName, role, pageName, pass, dims })
          console.log(
            `  ${pad(label, 42)} ${pass ? 'PASS' : 'FAIL'}` +
            (pass ? '' : ` (scroll ${dims.scrollHeight}x${dims.scrollWidth} vs viewport ${dims.clientHeight}x${dims.clientWidth})`)
          )
        } catch (err) {
          results.push({ engineName, viewportName, role, pageName, pass: false, error: err.message })
          console.log(`  ${pad(label, 42)} ERROR: ${err.message.split('\n')[0]}`)
        }
      }
      // context.close() can throw a Playwright/Firefox driver-internal protocol error
      // ("_maybeDontRestoreTabs") on some Windows setups - harmless (results/screenshots for this
      // context are already captured above), but left unguarded it was an uncaught rejection that
      // killed the whole run partway through. Swallow it and move on to the next context.
      await context.close().catch(() => {})
    }
    await browser.close().catch(() => {})
  }

  const failures = results.filter(r => !r.pass)
  console.log(`\nScreenshots saved to ${SCREENSHOT_DIR}\n`)
  console.log(summaryLine(role, results, failures))
  return results
}

function summaryLine(role, results, failures) {
  if (results.length === 0) return `RESULT (${role}): NO CHECKS RAN (no browser engines available).`
  return failures.length === 0
    ? `RESULT (${role}): ALL PASS. ${results.length} page/viewport/browser combinations, zero page-level scroll detected.`
    : `RESULT (${role}): FAIL. ${failures.length}/${results.length} combinations had a page-level scrollbar.`
}

module.exports = { runRole, ENGINES, VIEWPORTS, BASE_URL, PASSWORD, SCREENSHOT_DIR }
