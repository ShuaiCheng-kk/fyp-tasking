/**
 * scripts/perf-test-module8.js - Performance NFR verification, Module 8 (Account & Authentication, UC69-UC75)
 *
 * Per-UC breakdown of the Performance Requirement (3s threshold; UC69-O gets the same real-email
 * EXTERNAL_API_THRESHOLD_MS/CONCURRENT already established in Module 3 for Resend-backed writes).
 *
 * UC69 (Register Account) has three sub-flows (#UC69.1/.2/.3 in the doc) behind two DIFFERENT
 * endpoints - Owner (creates a standalone auth account + sends a real confirmation email via
 * emailService/Resend, before company details are ever collected - company creation is a separate
 * later step at /api/owner/complete-company-setup, gated behind email verification, and is not
 * itself one of the 75 numbered UCs, so it isn't measured here) and Guest User (self-registration,
 * Supabase's own built-in signUp - no explicit emailService call in our code). The Partner/Manager/
 * Employee sub-flow (#UC69.2) is mechanically identical to UC74's invitation-redemption endpoint -
 * measuring it again here would just be UC74 with a different label, so it is not duplicated; UC74
 * below is what covers it. Rows are labelled UC69-O and UC69-G.
 *
 * UC71 (Reset Password) is a two-step flow (request email, then submit new password via the
 * emailed link) but only the second step - POST /api/auth/reset-password, the account's actual
 * post-condition ("password is updated") - takes a data-changing write; it's what's measured. It
 * needs the token-holder's user_id only (this endpoint has no server-side token check at all - the
 * real recovery-link session is verified client-side before this route is ever called), so disposable
 * accounts are used directly without a real emailed link.
 *
 * UC72 (Verify Email) is measured via GET /api/auth/check-verified, the app's own poll-for-confirmed
 * endpoint (what "System shows Email verified!" is backed by) - the actual link click goes through
 * Supabase's own hosted /auth/v1/verify endpoint, not this app's API surface, so it's out of scope
 * the same way an OAuth provider's own redirect hop would be.
 *
 * UC74 (Accept Company Invitation) fabricates one single-use invitation_code row per call directly
 * via the service-role key (role Employee - Partner/Manager/Employee all redeem through the exact
 * same code path, so, per the Module 3 precedent of not re-measuring a permission-clone actor, only
 * one role is exercised) since invitation_code rows are single-use and there is no per-call way to
 * mint one through the real UI fast enough for a 30-call pool without also measuring UC25-style
 * email latency, which UC74's own business rule explicitly says does not apply to this flow.
 *
 * UC75 (Log Out) hits POST /api/auth/signout with a real session cookie attached for realism.
 *
 * Output is printed as two separate blocks - "SINGLE-REQUEST RESULTS" then "CONCURRENT RESULTS" -
 * so each can be screenshotted on its own as evidence.
 *
 * Usage:
 *   npm run dev                        # in one terminal
 *   node scripts/perf-test-module8.js  # in another terminal
 *
 * Requires the database to be seeded (node scripts/seed.js) so owner@test.com exists. Requires
 * .env.local (NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY) for disposable-account/invitation
 * fabrication.
 */

require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')

const { printDatasetBanner, reprintDatasetBanner } = require('./lib/datasetBanner')

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000'
const THRESHOLD_MS = 3000
// UC69-O makes a real Resend API call (sendConfirmationRequestEmail) before responding - same
// external-network-hop bucket already established for Module 3's UC25/UC29/UC31.
const EXTERNAL_API_THRESHOLD_MS = 10000
const EXTERNAL_API_CONCURRENT_THRESHOLD_MS = 30000
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
    if (status >= 400) { errors++; console.log(`  ! ${label} seq ${i + 1} HTTP ${status}: ${body?.message ?? ''}`) }
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
    if (r.status >= 400) { errors++; console.log(`  ! ${label} conc ${i + 1} HTTP ${r.status}: ${r.body?.message ?? ''}`) }
  })
  const timings = settled.map(r => r.elapsed)
  return { ...stats(timings), wallElapsed, bodies: settled.map(r => r.body), errors }
}

async function signIn(email, password = PASSWORD) {
  const res = await fetch(`${BASE_URL}/api/auth/signin`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email_address: email, password }),
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
  console.log(`Performance test (Module 8: Account & Authentication, UC69-UC75) against ${BASE_URL}`)
  console.log(`Guinea pig actor: Owner (owner@test.com) for setup + UC70/72/75; disposable accounts fabricated for UC69/71/73/74.\n`)

  const owner = await signIn(process.env.OWNER_EMAIL || 'owner@test.com')
  const companyId = owner.user.company_id
  await printDatasetBanner(companyId, process.env.OWNER_EMAIL || 'owner@test.com')
  const ownerId = owner.user.id
  const ownerSession = { cookie: owner.cookie }

  console.log('--- Setup: resolving a real department, fabricating disposable pools ---')
  const deptsRes0 = await fetch(`${BASE_URL}/api/company/departments?company_id=${companyId}`, withCookie({}, ownerSession.cookie))
  updateSessionCookie(ownerSession, deptsRes0)
  const deptsRes = await deptsRes0.json()
  const realDepartments = (deptsRes.departments ?? []).filter(d => !d.name.startsWith('PerfTest'))
  if (realDepartments.length < 1) {
    console.error('Need at least 1 non-PerfTest department for owner@test.com\'s company. Run `node scripts/seed.js` first.')
    process.exit(1)
  }
  const departmentA = realDepartments[0]

  // UC71 pool: 30 bare disposable auth users (no public.users row needed - resetPassword only
  // touches auth.users) each starting on a known OLD password, reset to a fresh one per call.
  const UC71_OLD_PASSWORD = 'PerfOldPass1!'
  const uc71Pool = []
  for (let i = 0; i < SEQ_COUNT + CONC_COUNT; i++) {
    const email = `perftest-uc71-${i}-${Date.now()}@example.com`
    const { data, error } = await admin.auth.admin.createUser({ email, password: UC71_OLD_PASSWORD, email_confirm: true })
    if (error || !data.user) { console.error(`UC71 pool user create failed at ${i}: ${error?.message}`); process.exit(1) }
    uc71Pool.push({ authId: data.user.id, email })
  }

  // UC73 pool: one disposable Employee, reused across all 30 update-profile calls (idempotent write).
  const uc73Email = `perftest-uc73-${Date.now()}@example.com`
  const { data: uc73Auth, error: uc73AuthErr } = await admin.auth.admin.createUser({ email: uc73Email, password: PASSWORD, email_confirm: true })
  if (uc73AuthErr || !uc73Auth.user) { console.error(`UC73 disposable auth create failed: ${uc73AuthErr?.message}`); process.exit(1) }
  const { data: uc73UserRow, error: uc73UserErr } = await admin.from('users').insert({
    supabase_auth_id: uc73Auth.user.id,
    full_name: 'PerfTest UC73 Employee',
    email_address: uc73Email,
    phone_number: nextPhone(),
    date_of_birth: '1990-01-01',
    profile_photo_url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=perftest-uc73',
    role: 'Employee',
    company_id: companyId,
  }).select().single()
  if (uc73UserErr) { console.error(`UC73 disposable users row insert failed: ${uc73UserErr.message}`); process.exit(1) }
  const uc73 = await signIn(uc73Email)
  const uc73Session = { cookie: uc73.cookie }

  // UC74 pool: 30 single-use invitation_code rows fabricated directly (role Employee - Partner/
  // Manager are the same redeem code path, not re-measured per the Module 3 permission-clone note).
  const uc74Pool = []
  const uc74Expiry = new Date(Date.now() + 7 * 86400000).toISOString()
  for (let i = 0; i < SEQ_COUNT + CONC_COUNT; i++) {
    const code = `${(Date.now() % 100000).toString().padStart(5, '0')}${i}`.slice(-8).toUpperCase()
    const { error } = await admin.from('invitation_code').insert({
      code, company_id: companyId, department_id: departmentA.id, role: 'Employee',
      generated_by: ownerId, status: 'Active', expired_at: uc74Expiry,
    })
    if (error) { console.error(`UC74 invitation_code insert failed at ${i}: ${error.message}`); process.exit(1) }
    uc74Pool.push(code)
  }
  console.log(`Setup complete: ${uc71Pool.length} UC71 accounts, 1 UC73 employee, ${uc74Pool.length} UC74 invitation codes.\n`)

  const uc69OwnerCreated = [] // {authId}
  const uc69GuestCreated = [] // {authId}
  const uc74Created = [] // {internalId}

  // --- Per-UC request builders -------------------------------------------------------------
  const ucs = [
    {
      label: 'UC69-O Register Account (Owner)',
      threshold: EXTERNAL_API_THRESHOLD_MS, concThreshold: EXTERNAL_API_CONCURRENT_THRESHOLD_MS,
      seq: i => ({ url: `${BASE_URL}/api/auth/register-owner`, options: jsonOpts('POST', {
        full_name: `PerfTest Owner S${i}`, email: `perftest-uc69o-s${i}-${Date.now()}@example.com`,
        password: PASSWORD, phone: nextPhone(),
      }) }),
      conc: i => ({ url: `${BASE_URL}/api/auth/register-owner`, options: jsonOpts('POST', {
        full_name: `PerfTest Owner C${i}`, email: `perftest-uc69o-c${i}-${Date.now()}-${Math.random()}@example.com`,
        password: PASSWORD, phone: nextPhone(),
      }) }),
      collect: body => body?.user_id ? [{ authId: body.user_id }] : [],
      collectInto: uc69OwnerCreated,
    },
    {
      label: 'UC69-G Register Account (Guest)',
      seq: i => ({ url: `${BASE_URL}/api/auth/register-guest`, options: jsonOpts('POST', {
        full_name: `PerfTest Guest S${i}`, email: `perftest-uc69g-s${i}-${Date.now()}@example.com`,
        password: PASSWORD, phone: nextPhone(), date_of_birth: '1995-05-05',
      }) }),
      conc: i => ({ url: `${BASE_URL}/api/auth/register-guest`, options: jsonOpts('POST', {
        full_name: `PerfTest Guest C${i}`, email: `perftest-uc69g-c${i}-${Date.now()}-${Math.random()}@example.com`,
        password: PASSWORD, phone: nextPhone(), date_of_birth: '1995-05-05',
      }) }),
      collect: body => body?.user_id ? [{ authId: body.user_id }] : [],
      collectInto: uc69GuestCreated,
    },
    {
      label: 'UC70 Sign In',
      seq: () => ({ url: `${BASE_URL}/api/auth/signin`, options: jsonOpts('POST', {
        email_address: process.env.OWNER_EMAIL || 'owner@test.com', password: PASSWORD,
      }) }),
      conc: () => ({ url: `${BASE_URL}/api/auth/signin`, options: jsonOpts('POST', {
        email_address: process.env.OWNER_EMAIL || 'owner@test.com', password: PASSWORD,
      }) }),
    },
    {
      label: 'UC71 Reset Password',
      seq: i => ({ url: `${BASE_URL}/api/auth/reset-password`, options: jsonOpts('POST', {
        user_id: uc71Pool[i].authId, password: `PerfNewPass${i}A!`,
      }) }),
      conc: i => ({ url: `${BASE_URL}/api/auth/reset-password`, options: jsonOpts('POST', {
        user_id: uc71Pool[SEQ_COUNT + i].authId, password: `PerfNewPass${i}B!`,
      }) }),
    },
    {
      label: 'UC72 Verify Email',
      seq: () => ({ url: `${BASE_URL}/api/auth/check-verified?email=${encodeURIComponent(process.env.OWNER_EMAIL || 'owner@test.com')}`, options: {} }),
      conc: () => ({ url: `${BASE_URL}/api/auth/check-verified?email=${encodeURIComponent(process.env.OWNER_EMAIL || 'owner@test.com')}`, options: {} }),
    },
    {
      label: 'UC73 Edit Profile',
      seq: i => ({ url: `${BASE_URL}/api/user/update-profile`, options: jsonOpts('PATCH', {
        user_id: uc73UserRow.id, full_name: `PerfTest UC73 Employee Updated S${i}`,
        phone_number: uc73UserRow.phone_number, date_of_birth: '1990-01-01', profile_photo_url: uc73UserRow.profile_photo_url,
      }, uc73Session.cookie) }),
      conc: i => ({ url: `${BASE_URL}/api/user/update-profile`, options: jsonOpts('PATCH', {
        user_id: uc73UserRow.id, full_name: `PerfTest UC73 Employee Updated C${i}`,
        phone_number: uc73UserRow.phone_number, date_of_birth: '1990-01-01', profile_photo_url: uc73UserRow.profile_photo_url,
      }, uc73Session.cookie) }),
    },
    {
      label: 'UC74 Accept Company Invitation',
      seq: i => ({ url: `${BASE_URL}/api/invitation/redeem`, options: jsonOpts('POST', {
        code: uc74Pool[i], full_name: `PerfTest UC74 S${i}`, email: `perftest-uc74-s${i}-${Date.now()}@example.com`,
        password: PASSWORD, phone_number: nextPhone(), date_of_birth: '1995-05-05',
        profile_photo_url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=perftest-uc74',
      }) }),
      conc: i => ({ url: `${BASE_URL}/api/invitation/redeem`, options: jsonOpts('POST', {
        code: uc74Pool[SEQ_COUNT + i], full_name: `PerfTest UC74 C${i}`, email: `perftest-uc74-c${i}-${Date.now()}-${Math.random()}@example.com`,
        password: PASSWORD, phone_number: nextPhone(), date_of_birth: '1995-05-05',
        profile_photo_url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=perftest-uc74',
      }) }),
      collect: body => body?.user?.id ? [{ internalId: body.user.id }] : [],
      collectInto: uc74Created,
    },
    {
      label: 'UC75 Log Out',
      seq: () => ({ url: `${BASE_URL}/api/auth/signout`, options: withCookie({ method: 'POST' }, ownerSession.cookie) }),
      conc: () => ({ url: `${BASE_URL}/api/auth/signout`, options: withCookie({ method: 'POST' }, ownerSession.cookie) }),
    },
  ]

  // --- Phase A: single-request block (screenshot #1) ---------------------------------------
  reprintDatasetBanner()
  console.log('=== SINGLE-REQUEST RESULTS (n=10 sequential per UC) ===\n')
  let allPass = true
  for (const uc of ucs) {
    const result = await runSequential(uc.label, SEQ_COUNT, uc.seq, uc.session)
    allPass = report(uc.label, result, uc.threshold) && allPass
    if (uc.collect) uc.collectInto.push(...result.bodies.flatMap(uc.collect))
  }

  // --- Phase B: concurrent block (screenshot #2) --------------------------------------------
  reprintDatasetBanner()
  console.log(`\n=== CONCURRENT RESULTS (${CONC_COUNT} simultaneous requests per UC) ===\n`)
  for (const uc of ucs) {
    const result = await runConcurrent(uc.label, CONC_COUNT, uc.conc, uc.session)
    allPass = report(uc.label, result, uc.concThreshold ?? uc.threshold) && allPass
    if (uc.collect) uc.collectInto.push(...result.bodies.flatMap(uc.collect))
  }

  // --- Cleanup -------------------------------------------------------------------------------
  console.log('\n--- Cleanup ---')
  for (const u of uc69OwnerCreated) { try { await admin.auth.admin.deleteUser(u.authId) } catch { /* best-effort */ } }
  console.log(`Deleted ${uc69OwnerCreated.length}/${SEQ_COUNT + CONC_COUNT} UC69-O disposable owner auth accounts.`)

  for (const u of uc69GuestCreated) { try { await admin.auth.admin.deleteUser(u.authId) } catch { /* best-effort */ } }
  console.log(`Deleted ${uc69GuestCreated.length}/${SEQ_COUNT + CONC_COUNT} UC69-G disposable guest auth accounts.`)

  for (const u of uc71Pool) { try { await admin.auth.admin.deleteUser(u.authId) } catch { /* best-effort */ } }
  console.log(`Deleted ${uc71Pool.length} UC71 disposable auth accounts.`)

  // supabase-js reports a failed delete by returning { error }, not by throwing, so a bare
  // try/catch would report success while the row survives - report what actually happened.
  await admin.from('employee_departments').delete().eq('employee_id', uc73UserRow.id)
  await admin.from('manager_departments').delete().eq('manager_id', uc73UserRow.id)
  const { error: uc73DeleteErr } = await admin.from('users').delete().eq('id', uc73UserRow.id)
  if (!uc73DeleteErr) await admin.auth.admin.deleteUser(uc73Auth.user.id).catch(() => {})
  console.log(`Deleted UC73 disposable employee: ${uc73DeleteErr ? 'FAILED - ' + uc73DeleteErr.message : 'ok'}.`)

  let uc74Deleted = 0
  for (const u of uc74Created) {
    try {
      const { data } = await admin.from('users').select('supabase_auth_id').eq('id', u.internalId).single()
      await admin.from('users').delete().eq('id', u.internalId)
      if (data?.supabase_auth_id) await admin.auth.admin.deleteUser(data.supabase_auth_id)
      uc74Deleted++
    } catch { /* best-effort */ }
  }
  console.log(`Deleted ${uc74Deleted}/${SEQ_COUNT + CONC_COUNT} UC74 disposable accounts (their consumed invitation_code rows go with them via cascade/orphaning - harmless either way, already Expired).`)
  console.log()

  console.log(allPass
    ? `RESULT: ALL PASS. Every Module 8 UC responded within its threshold, single-request and under ${CONC_COUNT}-way concurrent load.`
    : `RESULT: FAIL. One or more Module 8 UCs exceeded their threshold.`)
}

main()
