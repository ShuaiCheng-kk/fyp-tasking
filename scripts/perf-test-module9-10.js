/**
 * scripts/perf-test-module9-10.js - Performance NFR verification, Module 9 (Marketing CMS, UC76)
 * and Module 10 (User & Company Admin, UC77-UC78).
 *
 * These two modules only have 3 UCs written up to testable detail in docs/Use_Cases_List.md - the
 * rest of Module 9/10 (marketing page list view, content block editing, public page view, company/
 * user list/search, company detail view) still only exist as one-line summaries and haven't been
 * written to a testable level yet, so there is nothing further to measure here. Combined into one
 * script (rather than two near-empty ones) since both modules are tiny platform-admin roles outside
 * the company hierarchy.
 *
 * UC76 (Edit Marketing Page) is measured via GET /api/marketingadmin/pages?slug=home - "System loads
 * and displays that page's content blocks" (the Main Flow step this UC's post-condition describes),
 * signed in as the real madmin@tasking.com account. Read-only, no fabrication needed.
 *
 * UC77 (Suspend Company) and UC78 (Suspend User Account) both hit POST /api/useradmin/suspend, signed
 * in as the real uadmin@tasking.com account. suspendCompany/suspendUser unconditionally overwrite
 * suspended_at/suspended_reason rather than validating a state transition (same "idempotent action"
 * shape as Module 3's casual-worker-status endpoint), so one disposable company and one disposable
 * user - fabricated via the service-role key so the real seeded company/users are never touched -
 * are each repeatedly suspended across all 30 calls instead of needing a fresh throwaway target per call.
 *
 * Output is printed as two separate blocks - "SINGLE-REQUEST RESULTS" then "CONCURRENT RESULTS" -
 * so each can be screenshotted on its own as evidence.
 *
 * Usage:
 *   npm run dev                            # in one terminal
 *   node scripts/perf-test-module9-10.js   # in another terminal
 *
 * Requires the database to be seeded (node scripts/seed.js, which keeps madmin@tasking.com and
 * uadmin@tasking.com regardless) and .env.local (NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
 * for the disposable company/user fabrication.
 */

require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000'
const THRESHOLD_MS = 3000
const SEQ_COUNT = 10
const CONC_COUNT = 20
const PASSWORD = '111111'

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

function pad(str, len) {
  return String(str).padEnd(len)
}

function withCookie(options, cookie) {
  return { ...options, headers: { ...(options?.headers ?? {}), Cookie: cookie } }
}

function jsonOpts(method, body, cookie) {
  return withCookie({
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }, cookie)
}

function updateSessionCookie(session, res) {
  const setCookies = res.headers.getSetCookie?.() ?? []
  if (setCookies.length === 0) return
  const jar = new Map(session.cookie.split('; ').filter(Boolean).map(p => {
    const i = p.indexOf('=')
    return [p.slice(0, i), p.slice(i + 1)]
  }))
  for (const sc of setCookies) {
    const pair = sc.split(';')[0]
    const i = pair.indexOf('=')
    if (i > 0) jar.set(pair.slice(0, i), pair.slice(i + 1))
  }
  session.cookie = [...jar].map(([k, v]) => `${k}=${v}`).join('; ')
}

async function timeRequest(url, options, session) {
  const start = performance.now()
  const res = await fetch(url, options)
  const elapsed = performance.now() - start
  if (session) updateSessionCookie(session, res)
  const body = await res.json().catch(() => null)
  return { elapsed, status: res.status, body }
}

function stats(timings) {
  const sorted = [...timings].sort((a, b) => a - b)
  const avg = sorted.reduce((a, b) => a + b, 0) / sorted.length
  const min = sorted[0]
  const max = sorted[sorted.length - 1]
  const p95 = sorted[Math.floor(sorted.length * 0.95)] ?? max
  return { repeats: sorted.length, avg, min, max, p95 }
}

function report(label, result, threshold = THRESHOLD_MS) {
  const pass = result.max <= threshold && result.errors === 0
  const wallNote = result.wallElapsed !== undefined ? ` wall=${result.wallElapsed.toFixed(0)}ms` : ''
  const thresholdNote = threshold !== THRESHOLD_MS ? ` (${threshold}ms threshold)` : ''
  const errorNote = result.errors > 0 ? ` [${result.errors}/${result.repeats} FAILED]` : ''
  console.log(
    `${pad(label, 42)} n=${pad(result.repeats, 3)} ` +
    `avg=${pad(result.avg.toFixed(0) + 'ms', 8)} min=${pad(result.min.toFixed(0) + 'ms', 8)} ` +
    `max=${pad(result.max.toFixed(0) + 'ms', 8)} p95=${pad(result.p95.toFixed(0) + 'ms', 8)} ` +
    (pass ? 'PASS' : 'FAIL') + thresholdNote + wallNote + errorNote
  )
  return pass
}

async function runSequential(label, count, buildRequest, session) {
  const timings = []
  const bodies = []
  let errors = 0
  for (let i = 0; i < count; i++) {
    const { url, options } = buildRequest(i)
    const { elapsed, status, body } = await timeRequest(url, options, session)
    if (status >= 400) { errors++; console.log(`  ! ${label} seq ${i + 1} HTTP ${status}: ${body?.message ?? body?.error ?? ''}`) }
    timings.push(elapsed)
    bodies.push(body)
  }
  return { ...stats(timings), bodies, errors }
}

async function runConcurrent(label, count, buildRequest, session) {
  const wallStart = performance.now()
  const settled = await Promise.all(
    Array.from({ length: count }, (_, i) => {
      const { url, options } = buildRequest(i)
      return timeRequest(url, options, session)
    })
  )
  const wallElapsed = performance.now() - wallStart
  let errors = 0
  settled.forEach((r, i) => {
    if (r.status >= 400) { errors++; console.log(`  ! ${label} conc ${i + 1} HTTP ${r.status}: ${r.body?.message ?? r.body?.error ?? ''}`) }
  })
  const timings = settled.map(r => r.elapsed)
  return { ...stats(timings), wallElapsed, bodies: settled.map(r => r.body), errors }
}

async function signIn(email) {
  const res = await fetch(`${BASE_URL}/api/auth/signin`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email_address: email, password: PASSWORD }),
  })
  const body = await res.json()
  if (!body.success) {
    console.error(`Sign-in failed for ${email}: ${body.message}`)
    process.exit(1)
  }
  const setCookies = res.headers.getSetCookie?.() ?? []
  const cookie = setCookies.map(c => c.split(';')[0]).join('; ')
  return { user: body.user, cookie }
}

let disposablePhoneCounter = 0
function nextPhone() {
  disposablePhoneCounter++
  return `+65 8${(Date.now() % 1000000).toString().padStart(6, '0')}${disposablePhoneCounter}`.slice(0, 15)
}

async function main() {
  console.log(`Performance test (Module 9-10: Marketing CMS UC76, User & Company Admin UC77-78) against ${BASE_URL}`)
  console.log(`Guinea pig actors: madmin@tasking.com (UC76), uadmin@tasking.com (UC77/78).\n`)

  const madmin = await signIn('madmin@tasking.com')
  const madminSession = { cookie: madmin.cookie }

  const uadmin = await signIn('uadmin@tasking.com')
  const uadminSession = { cookie: uadmin.cookie }

  console.log('--- Setup: fabricating disposable company + user as suspend targets ---')
  // Disposable Owner + disposable company (UC77 target) - never touches the real seeded company.
  const ownerEmail = `perftest-m910-owner-${Date.now()}@example.com`
  const { data: ownerAuth, error: ownerAuthErr } = await admin.auth.admin.createUser({ email: ownerEmail, password: PASSWORD, email_confirm: true })
  if (ownerAuthErr || !ownerAuth.user) { console.error(`Disposable owner auth create failed: ${ownerAuthErr?.message}`); process.exit(1) }
  const { data: ownerRow, error: ownerRowErr } = await admin.from('users').insert({
    supabase_auth_id: ownerAuth.user.id,
    full_name: 'PerfTest M9-10 Owner',
    email_address: ownerEmail,
    phone_number: nextPhone(),
    date_of_birth: '1990-01-01',
    profile_photo_url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=perftest-m910',
    role: 'Owner',
  }).select().single()
  if (ownerRowErr) { console.error(`Disposable owner row insert failed: ${ownerRowErr.message}`); process.exit(1) }

  const { data: disposableCompany, error: companyErr } = await admin.from('companies').insert({
    name: `PerfTest UC77 Company ${Date.now()}`,
    description: 'Perf test disposable company',
    owner_id: ownerRow.id,
    plan: 'Free',
  }).select().single()
  if (companyErr) { console.error(`Disposable company insert failed: ${companyErr.message}`); process.exit(1) }
  await admin.from('users').update({ company_id: disposableCompany.id }).eq('id', ownerRow.id)

  // Disposable Employee (UC78 target) - a non-platform-admin account, so suspendUser never hits
  // the "platform admin accounts cannot be suspended" guard.
  const empEmail = `perftest-m910-emp-${Date.now()}@example.com`
  const { data: empAuth, error: empAuthErr } = await admin.auth.admin.createUser({ email: empEmail, password: PASSWORD, email_confirm: true })
  if (empAuthErr || !empAuth.user) { console.error(`Disposable employee auth create failed: ${empAuthErr?.message}`); process.exit(1) }
  const { data: empRow, error: empRowErr } = await admin.from('users').insert({
    supabase_auth_id: empAuth.user.id,
    full_name: 'PerfTest M9-10 Employee',
    email_address: empEmail,
    phone_number: nextPhone(),
    date_of_birth: '1990-01-01',
    profile_photo_url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=perftest-m910-emp',
    role: 'Employee',
    company_id: disposableCompany.id,
  }).select().single()
  if (empRowErr) { console.error(`Disposable employee row insert failed: ${empRowErr.message}`); process.exit(1) }
  console.log(`Setup complete: disposable company ${disposableCompany.id}, disposable employee ${empRow.id}.\n`)

  // --- Per-UC request builders -------------------------------------------------------------
  const ucs = [
    {
      label: 'UC76 Edit Marketing Page',
      session: madminSession,
      seq: () => ({ url: `${BASE_URL}/api/marketingadmin/pages?slug=home`, options: withCookie({}, madminSession.cookie) }),
      conc: () => ({ url: `${BASE_URL}/api/marketingadmin/pages?slug=home`, options: withCookie({}, madminSession.cookie) }),
    },
    {
      label: 'UC77 Suspend Company',
      session: uadminSession,
      seq: i => ({ url: `${BASE_URL}/api/useradmin/suspend`, options: jsonOpts('POST', {
        action: 'suspend_company', company_id: disposableCompany.id, reason: `PerfTest reason S${i}`,
      }, uadminSession.cookie) }),
      conc: i => ({ url: `${BASE_URL}/api/useradmin/suspend`, options: jsonOpts('POST', {
        action: 'suspend_company', company_id: disposableCompany.id, reason: `PerfTest reason C${i}`,
      }, uadminSession.cookie) }),
    },
    {
      label: 'UC78 Suspend User Account',
      session: uadminSession,
      seq: i => ({ url: `${BASE_URL}/api/useradmin/suspend`, options: jsonOpts('POST', {
        action: 'suspend_user', user_id: empRow.id, reason: `PerfTest reason S${i}`,
      }, uadminSession.cookie) }),
      conc: i => ({ url: `${BASE_URL}/api/useradmin/suspend`, options: jsonOpts('POST', {
        action: 'suspend_user', user_id: empRow.id, reason: `PerfTest reason C${i}`,
      }, uadminSession.cookie) }),
    },
  ]

  // --- Phase A: single-request block (screenshot #1) ---------------------------------------
  console.log('=== SINGLE-REQUEST RESULTS (n=10 sequential per UC) ===\n')
  let allPass = true
  for (const uc of ucs) {
    const result = await runSequential(uc.label, SEQ_COUNT, uc.seq, uc.session)
    allPass = report(uc.label, result, uc.threshold) && allPass
  }

  // --- Phase B: concurrent block (screenshot #2) --------------------------------------------
  console.log(`\n=== CONCURRENT RESULTS (${CONC_COUNT} simultaneous requests per UC) ===\n`)
  for (const uc of ucs) {
    const result = await runConcurrent(uc.label, CONC_COUNT, uc.conc, uc.session)
    allPass = report(uc.label, result, uc.concThreshold ?? uc.threshold) && allPass
  }

  // --- Cleanup -------------------------------------------------------------------------------
  console.log('\n--- Cleanup ---')
  try { await admin.from('users').delete().eq('id', empRow.id) } catch { /* best-effort */ }
  try { await admin.auth.admin.deleteUser(empAuth.user.id) } catch { /* best-effort */ }
  try { await admin.from('companies').delete().eq('id', disposableCompany.id) } catch { /* best-effort */ }
  try { await admin.from('users').delete().eq('id', ownerRow.id) } catch { /* best-effort */ }
  try { await admin.auth.admin.deleteUser(ownerAuth.user.id) } catch { /* best-effort */ }
  console.log('Deleted disposable company, disposable owner, and disposable employee.\n')

  console.log(allPass
    ? `RESULT: ALL PASS. Every Module 9-10 UC responded within its threshold, single-request and under ${CONC_COUNT}-way concurrent load.`
    : `RESULT: FAIL. One or more Module 9-10 UCs exceeded their threshold.`)
}

main()
