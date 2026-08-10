/**
 * scripts/perf-test-module6.js - Performance NFR verification, Module 6 (Communication, UC62-UC65)
 *
 * Per-UC breakdown of the Performance Requirement (3s threshold - no AI, no real external API calls
 * anywhere in this module, so no exceptions needed). Owner plays the guinea pig for all four UCs
 * (Owner is eligible for every one of them). Recipient for UC65's messages is one disposable
 * Manager, fabricated via the Supabase service-role key, so the real seeded accounts' inboxes are
 * never touched.
 *
 * Output is printed as two separate blocks - "SINGLE-REQUEST RESULTS" then "CONCURRENT RESULTS" -
 * so each can be screenshotted on its own as evidence.
 *
 * Usage:
 *   npm run dev                        # in one terminal
 *   node scripts/perf-test-module6.js  # in another terminal
 *
 * Requires the database to be seeded (node scripts/seed.js) so owner@test.com exists with at
 * least one department. Requires .env.local (NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
 * for the disposable-account fabrication.
 */

require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')

const { printDatasetBanner, reprintDatasetBanner } = require('./lib/datasetBanner')

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
  const errorNote = result.errors > 0 ? ` [${result.errors}/${result.repeats} FAILED]` : ''
  console.log(
    `${pad(label, 42)} n=${pad(result.repeats, 3)} ` +
    `avg=${pad(result.avg.toFixed(0) + 'ms', 8)} min=${pad(result.min.toFixed(0) + 'ms', 8)} ` +
    `max=${pad(result.max.toFixed(0) + 'ms', 8)} p95=${pad(result.p95.toFixed(0) + 'ms', 8)} ` +
    (pass ? 'PASS' : 'FAIL') + wallNote + errorNote
  )
  return pass
}

async function runSequential(label, count, buildRequest) {
  const timings = []
  const bodies = []
  let errors = 0
  for (let i = 0; i < count; i++) {
    const { url, options, session } = buildRequest(i)
    const { elapsed, status, body } = await timeRequest(url, options, session)
    if (status >= 400) { errors++; console.log(`  ! ${label} seq ${i + 1} HTTP ${status}: ${body?.error ?? body?.message ?? ''}`) }
    timings.push(elapsed)
    bodies.push(body)
  }
  return { ...stats(timings), bodies, errors }
}

async function runConcurrent(label, count, buildRequest) {
  const wallStart = performance.now()
  const settled = await Promise.all(
    Array.from({ length: count }, (_, i) => {
      const { url, options, session } = buildRequest(i)
      return timeRequest(url, options, session)
    })
  )
  const wallElapsed = performance.now() - wallStart
  let errors = 0
  settled.forEach((r, i) => {
    if (r.status >= 400) { errors++; console.log(`  ! ${label} conc ${i + 1} HTTP ${r.status}: ${r.body?.error ?? r.body?.message ?? ''}`) }
  })
  const timings = settled.map(r => r.elapsed)
  return { ...stats(timings), wallElapsed, bodies: settled.map(r => r.body), errors }
}

async function signIn(email, attempt = 1) {
  const res = await fetch(`${BASE_URL}/api/auth/signin`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email_address: email, password: PASSWORD }),
  })
  const body = await res.json()
  if (!body.success) {
    if (attempt < 4) {
      await new Promise(resolve => setTimeout(resolve, 500 * attempt))
      return signIn(email, attempt + 1)
    }
    console.error(`Sign-in failed for ${email} after ${attempt} attempts: ${body.message}`)
    process.exit(1)
  }
  const setCookies = res.headers.getSetCookie?.() ?? []
  const cookie = setCookies.map(c => c.split(';')[0]).join('; ')
  return { user: body.user, cookie }
}

let disposablePhoneCounter = 0
async function createDisposableUser(role, companyId, departmentId, seed) {
  const email = `perftest-m6-${role.toLowerCase().replace(/\s+/g, '')}-${seed}-${Date.now()}@example.com`
  const { data: authData, error: authErr } = await admin.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true })
  if (authErr || !authData.user) { console.error(`Disposable ${role} auth create failed: ${authErr?.message}`); process.exit(1) }
  disposablePhoneCounter++
  const phoneNumber = `+65 8${(Date.now() % 1000000).toString().padStart(6, '0')}${disposablePhoneCounter}`.slice(0, 15)
  const { data: userRow, error: userErr } = await admin.from('users').insert({
    supabase_auth_id: authData.user.id,
    full_name: `PerfTest ${role} ${seed}`,
    email_address: email,
    phone_number: phoneNumber,
    date_of_birth: '1995-01-01',
    profile_photo_url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=perftest',
    role,
    company_id: companyId,
  }).select().single()
  if (userErr) { console.error(`Disposable ${role} row insert failed: ${userErr.message}`); process.exit(1) }
  if (role === 'Manager') {
    await admin.from('manager_departments').insert({ manager_id: userRow.id, department_id: departmentId, company_id: companyId })
  }
  return { id: userRow.id, authId: authData.user.id, email }
}

// Returns whether the users row actually went away. supabase-js reports a failed delete by
// returning an { error } object rather than throwing, so a bare try/catch sees nothing and the
// caller happily reports success while the row is still there. The rows this user owns must go
// first or the delete is refused by FK constraints.
async function deleteDisposableUser(user) {
  await admin.from('attendance_records').delete().eq('user_id', user.id)
  await admin.from('task_assignments').delete().eq('user_id', user.id)
  await admin.from('shift_assignments').delete().eq('user_id', user.id)
  await admin.from('employee_departments').delete().eq('employee_id', user.id)
  await admin.from('manager_departments').delete().eq('manager_id', user.id)
  await admin.from('casualworker_departments').delete().eq('casual_worker_id', user.id)

  const { error } = await admin.from('users').delete().eq('id', user.id)
  if (error) {
    console.log(`  ! failed to delete disposable user ${user.email}: ${error.message}`)
    return false
  }
  await admin.auth.admin.deleteUser(user.authId).catch(() => {})
  return true
}

async function main() {
  console.log(`Performance test (Module 6: Communication, UC62-UC65) against ${BASE_URL}`)
  console.log(`Guinea pig actor: Owner (eligible for every Module 6 UC).\n`)

  const owner = await signIn(process.env.OWNER_EMAIL || 'owner@test.com')
  const companyId = owner.user.company_id
  await printDatasetBanner(companyId, process.env.OWNER_EMAIL || 'owner@test.com')
  const session = { cookie: owner.cookie }

  console.log('--- Setup: resolving department, fabricating a message recipient, creating announcement pools ---')
  const deptsRes0 = await fetch(`${BASE_URL}/api/company/departments?company_id=${companyId}`, withCookie({}, session.cookie))
  updateSessionCookie(session, deptsRes0)
  const deptsRes = await deptsRes0.json()
  const departmentA = (deptsRes.departments ?? []).find(d => !d.name.startsWith('PerfTest'))
  if (!departmentA) { console.error('Need a real department. Run `node scripts/seed.js` first.'); process.exit(1) }

  const recipient = await createDisposableUser('Manager', companyId, departmentA.id, 'uc65')
  console.log(`Using department "${departmentA.name}", message recipient "${recipient.email}"`)

  const N = SEQ_COUNT + CONC_COUNT
  async function createAnnouncement(title) {
    const res = await fetch(`${BASE_URL}/api/inbox/announcements`, jsonOpts('POST', {
      company_id: companyId, title, content: 'PerfTest announcement content', audience_department_id: null,
    }, session.cookie))
    updateSessionCookie(session, res)
    const body = await res.json()
    if (!body.success) { console.error(`Announcement pool creation failed: ${body.error}`); process.exit(1) }
    return body.announcement.id
  }
  const uc63Pool = []
  for (let i = 0; i < N; i++) uc63Pool.push(await createAnnouncement(`PerfTest UC63 Pool ${i}-${Date.now()}`))
  const uc64Pool = []
  for (let i = 0; i < N; i++) uc64Pool.push(await createAnnouncement(`PerfTest UC64 Pool ${i}-${Date.now()}`))
  console.log('UC63/UC64 announcement pools ready.\n')

  const createdAnnouncementIds = [...uc63Pool]

  // --- Per-UC request builders -------------------------------------------------------------
  const ucs = [
    {
      label: 'UC62 Post Announcement',
      seq: i => ({ url: `${BASE_URL}/api/inbox/announcements`, options: jsonOpts('POST', {
        company_id: companyId, title: `PerfTest UC62 S${i}-${Date.now()}`, content: 'PerfTest content', audience_department_id: null,
      }, session.cookie), session }),
      conc: i => ({ url: `${BASE_URL}/api/inbox/announcements`, options: jsonOpts('POST', {
        company_id: companyId, title: `PerfTest UC62 C${i}-${Date.now()}-${Math.random()}`, content: 'PerfTest content', audience_department_id: null,
      }, session.cookie), session }),
      collect: body => body?.announcement?.id ? [body.announcement.id] : [],
    },
    {
      label: 'UC63 Edit Announcement',
      seq: i => ({ url: `${BASE_URL}/api/inbox/announcements`, options: jsonOpts('PATCH', {
        announcement_id: uc63Pool[i], title: `PerfTest UC63 Edited S${i}-${Date.now()}`, content: 'PerfTest edited content',
      }, session.cookie), session }),
      conc: i => ({ url: `${BASE_URL}/api/inbox/announcements`, options: jsonOpts('PATCH', {
        announcement_id: uc63Pool[SEQ_COUNT + i], title: `PerfTest UC63 Edited C${i}-${Date.now()}`, content: 'PerfTest edited content',
      }, session.cookie), session }),
    },
    {
      label: 'UC64 Delete Announcement',
      seq: i => ({ url: `${BASE_URL}/api/inbox/announcements`, options: jsonOpts('DELETE', { announcement_id: uc64Pool[i] }, session.cookie), session }),
      conc: i => ({ url: `${BASE_URL}/api/inbox/announcements`, options: jsonOpts('DELETE', { announcement_id: uc64Pool[SEQ_COUNT + i] }, session.cookie), session }),
    },
    {
      label: 'UC65 Send Direct Message',
      seq: i => ({ url: `${BASE_URL}/api/inbox/messages`, options: jsonOpts('POST', {
        to_user_id: recipient.id, company_id: companyId, content: `PerfTest message S${i}`,
      }, session.cookie), session }),
      conc: i => ({ url: `${BASE_URL}/api/inbox/messages`, options: jsonOpts('POST', {
        to_user_id: recipient.id, company_id: companyId, content: `PerfTest message C${i}`,
      }, session.cookie), session }),
    },
  ]

  // --- Phase A: single-request block (screenshot #1) ---------------------------------------
  reprintDatasetBanner()
  console.log('=== SINGLE-REQUEST RESULTS (n=10 sequential per UC) ===\n')
  let allPass = true
  for (const uc of ucs) {
    const result = await runSequential(uc.label, SEQ_COUNT, uc.seq)
    allPass = report(uc.label, result) && allPass
    if (uc.collect) createdAnnouncementIds.push(...result.bodies.flatMap(uc.collect))
  }

  // --- Phase B: concurrent block (screenshot #2) --------------------------------------------
  reprintDatasetBanner()
  console.log(`\n=== CONCURRENT RESULTS (${CONC_COUNT} simultaneous requests per UC) ===\n`)
  for (const uc of ucs) {
    const result = await runConcurrent(uc.label, CONC_COUNT, uc.conc)
    allPass = report(uc.label, result) && allPass
    if (uc.collect) createdAnnouncementIds.push(...result.bodies.flatMap(uc.collect))
  }

  // --- Cleanup -------------------------------------------------------------------------------
  console.log('\n--- Cleanup ---')
  let deletedAnnouncements = 0
  for (const id of [...new Set(createdAnnouncementIds)]) {
    const res = await fetch(`${BASE_URL}/api/inbox/announcements`, jsonOpts('DELETE', { announcement_id: id }, session.cookie))
    updateSessionCookie(session, res)
    if (res.ok) deletedAnnouncements++
  }
  console.log(`Deleted ${deletedAnnouncements}/${createdAnnouncementIds.length} throwaway announcements (UC64's own pool was already deleted by the measured calls).`)

  await admin.from('messages').delete().eq('to_user_id', recipient.id)
  await admin.from('messages').delete().eq('from_user_id', recipient.id)
  const recipientGone = await deleteDisposableUser(recipient)
  console.log(`Deleted throwaway messages and the disposable recipient account: ${recipientGone ? 'ok' : 'FAILED - left behind'}.\n`)

  console.log(allPass
    ? `RESULT: ALL PASS. Every Module 6 UC responded within the ${THRESHOLD_MS}ms requirement, single-request and under ${CONC_COUNT}-way concurrent load.`
    : `RESULT: FAIL. One or more Module 6 UCs exceeded the ${THRESHOLD_MS}ms requirement.`)
}

main()
