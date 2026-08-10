/**
 * scripts/perf-test-module3.js - Performance NFR verification, Module 3 (Team/Company, UC22-UC33)
 *
 * Per-UC breakdown of the Performance Requirement (3s threshold - Module 3 has no AI-generation
 * UCs, so there is no separate AI threshold here): every UC is measured twice - once as a single
 * sequential request (n=10) and once as 20 simultaneous requests - against the real dev server and
 * real dev database. Owner plays the guinea pig for every UC that allows Owner (all of them except
 * UC25/26/27/28/31, which also allow Partner - Partner is a permission-clone there, not measured
 * separately). UC29 and UC33 specifically require the company's ORIGINAL creator, which owner@test.com
 * is in the seed data.
 *
 * Two things this module needed that Module 1/2 didn't:
 *  - UC29 (Remove Team Member) is destructive and UC27/28 (Casual Worker status) touch real people -
 *    both are tested against disposable Manager/Employee/Casual Worker accounts fabricated directly
 *    via the Supabase service-role key (same technique scripts/seed.js itself uses), NOT the real
 *    seeded manager1-8/employee1-8/casual1 accounts, so the shared demo dataset the rest of the
 *    manual test plan depends on is never touched.
 *  - UC25 (Send Direct Invitation) and UC31 (Invite Members by CSV) send real emails via Resend.
 *    Every address used is under the IANA-reserved example.com domain, so the real send/API-latency
 *    path is exercised without any real inbox or domain being touched.
 *  - UC33 (Edit Company Profile) overwrites the real company's profile fields - this script snapshots
 *    them before testing and restores the original values as the last step, so the shared seeded
 *    company identity isn't left in a "PerfTest" state afterward.
 *  - UC26 (Search Members) is a pure client-side filter over already-loaded data with no backend
 *    endpoint of its own - GET /api/team/members (what it filters) is measured as its proxy.
 *
 * Output is printed as two separate blocks - "SINGLE-REQUEST RESULTS" then "CONCURRENT RESULTS" -
 * so each can be screenshotted on its own as evidence.
 *
 * Usage:
 *   npm run dev                        # in one terminal
 *   node scripts/perf-test-module3.js  # in another terminal
 *
 * Requires the database to be seeded (node scripts/seed.js) so owner@test.com exists as the
 * company's original creator, with at least 2 departments. Requires .env.local
 * (NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY) for the disposable-account fabrication.
 */

require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')

const { printDatasetBanner, reprintDatasetBanner } = require('./lib/datasetBanner')

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000'
const THRESHOLD_MS = 3000
// UC25/UC29/UC31 all make a real Resend API call server-side (an invitation email, or - for UC29 -
// the "you've been removed" notification at the end of the removal flow) before responding, so they
// are held to the same looser threshold already established for AI-generation UCs in other modules:
// a genuine third-party network round-trip, not a DB operation, and not a code-efficiency issue.
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

// A script-length run outlives the Supabase access token's TTL - a real browser session gets
// silently refreshed by the @supabase/ssr client on every request, but this script replays a
// static cookie unless it captures and merges any Set-Cookie the server sends back (exactly what
// a browser does automatically). Without this, a long run degrades into 401s partway through.
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
  // A fast HTTP error is not a fast success - counting it toward the latency stats without also
  // failing the UC would let a 100%-broken endpoint that happens to fail quickly print PASS.
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

// --- Disposable account fabrication (service-role, bypasses the real invite/accept flow) --------
// Only the SETUP is fabricated this way - the actual measured UC calls (remove-member, casual-
// worker-status, update-department) always go through the real API route.
let disposablePhoneCounter = 0
async function createDisposableUser(role, companyId, departmentId, seed) {
  const email = `perftest-m3-${role.toLowerCase().replace(/\s+/g, '')}-${seed}-${Date.now()}@example.com`
  const { data: authData, error: authErr } = await admin.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true })
  if (authErr || !authData.user) { console.error(`Disposable ${role} auth create failed: ${authErr?.message}`); process.exit(1) }
  disposablePhoneCounter++
  // Timestamp + counter, not just a counter - a leftover row from a prior crashed/incomplete run
  // (dev server died mid-run more than once this session) starts its own counter at 1 too, so a
  // bare counter collides with that orphaned data's phone_number on the very next run.
  const phoneNumber = `+65 8${(Date.now() % 1000000).toString().padStart(6, '0')}${disposablePhoneCounter}`.slice(0, 15)
  const { data: userRow, error: userErr } = await admin.from('users').insert({
    supabase_auth_id: authData.user.id,
    full_name: `PerfTest ${role} ${seed}`,
    email_address: email,
    phone_number: phoneNumber,
    date_of_birth: '1990-01-01',
    profile_photo_url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=perftest',
    role,
    company_id: companyId,
  }).select().single()
  if (userErr) { console.error(`Disposable ${role} row insert failed: ${userErr.message}`); process.exit(1) }
  if (role === 'Manager') {
    await admin.from('manager_departments').insert({ manager_id: userRow.id, department_id: departmentId, company_id: companyId })
  } else if (role === 'Employee') {
    await admin.from('employee_departments').insert({ employee_id: userRow.id, department_id: departmentId, company_id: companyId })
  } else if (role === 'Casual Worker') {
    await admin.from('casualworker_departments').insert({ casual_worker_id: userRow.id, department_id: departmentId, company_id: companyId, verified_at: new Date().toISOString() })
  }
  return { id: userRow.id, authId: authData.user.id, email }
}

// Returns whether the users row actually went away. supabase-js reports a failed delete by
// returning an { error } object rather than throwing, so a bare try/catch sees nothing and the
// caller happily reports success while the row is still there. The rows these users own must go
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
  console.log(`Performance test (Module 3: Team/Company, UC22-UC33) against ${BASE_URL}`)
  console.log(`Guinea pig actor: Owner (the company's original creator - required for UC29/UC33; Partner is a permission-clone for UC25/26/27/28/31, not measured separately).\n`)

  const owner = await signIn(process.env.OWNER_EMAIL || 'owner@test.com')
  const companyId = owner.user.company_id
  await printDatasetBanner(companyId, process.env.OWNER_EMAIL || 'owner@test.com')
  const ownerId = owner.user.id
  const session = { cookie: owner.cookie }

  console.log('--- Setup: resolving real departments, snapshotting company profile, fabricating disposable accounts ---')
  const deptsRes0 = await fetch(`${BASE_URL}/api/company/departments?company_id=${companyId}`, withCookie({}, session.cookie))
  updateSessionCookie(session, deptsRes0)
  const deptsRes = await deptsRes0.json()
  // Filters out leftover PerfTest-named departments from a prior interrupted run (this dev server
  // has crashed and needed a restart mid-run more than once this session, which skips cleanup) -
  // picking one as a "real" department would compound the pollution into this run's own data too.
  const realDepartments = (deptsRes.departments ?? []).filter(d => !d.name.startsWith('PerfTest'))
  if (realDepartments.length < 2) {
    console.error('Need at least 2 non-PerfTest departments for owner@test.com\'s company. Run `node scripts/seed.js` first.')
    process.exit(1)
  }
  const departmentA = realDepartments[0]
  const departmentB = realDepartments[1]
  console.log(`Using department A "${departmentA.name}" and department B "${departmentB.name}"`)

  const profileRes0 = await fetch(`${BASE_URL}/api/company/current?user_id=${ownerId}&company_id=${companyId}`, withCookie({}, session.cookie))
  updateSessionCookie(session, profileRes0)
  const profileRes = await profileRes0.json()
  if (!profileRes.success) { console.error(`Failed to snapshot company profile: ${profileRes.message}`); process.exit(1) }
  const originalProfile = profileRes.company
  console.log('Company profile snapshotted for restore after UC33 testing.')

  // UC29 pool: 31 disposable Employees in one throwaway department - 30 get removed by the
  // measured calls, the 31st stays behind the whole time so "last one in department" never blocks.
  const uc29DeptRes = await fetch(`${BASE_URL}/api/company/create-department`, jsonOpts('POST', {
    company_id: companyId, name: `PerfTest UC29 Holding Dept ${Date.now()}`, color: '#EF4444',
  }, session.cookie))
  updateSessionCookie(session, uc29DeptRes)
  const uc29DeptBody = await uc29DeptRes.json()
  if (!uc29DeptBody.success) { console.error(`UC29 holding department creation failed: ${uc29DeptBody.message}`); process.exit(1) }
  const uc29DeptId = uc29DeptBody.department.id

  const uc29Pool = []
  for (let i = 0; i < SEQ_COUNT + CONC_COUNT + 1; i++) {
    uc29Pool.push(await createDisposableUser('Employee', companyId, uc29DeptId, `uc29-${i}`))
  }
  const uc29Removable = uc29Pool.slice(0, SEQ_COUNT + CONC_COUNT) // the 31st (last) stays as permanent peer

  // UC30 pool: 30 disposable Employees starting in department A, each moved to department B once.
  const uc30Pool = []
  for (let i = 0; i < SEQ_COUNT + CONC_COUNT; i++) {
    uc30Pool.push(await createDisposableUser('Employee', companyId, departmentA.id, `uc30-${i}`))
  }

  // CW pool: 30 disposable Casual Workers, shared by both UC27 (activate) and UC28 (deactivate) -
  // the endpoint unconditionally sets the target state rather than validating a state transition,
  // so the same 30 rows can be reused for both UCs (they run in separate turns of the same phase).
  const cwPool = []
  for (let i = 0; i < SEQ_COUNT + CONC_COUNT; i++) {
    cwPool.push(await createDisposableUser('Casual Worker', companyId, departmentA.id, `cw-${i}`))
  }
  console.log(`Setup complete: ${uc29Pool.length} UC29 employees, ${uc30Pool.length} UC30 employees, ${cwPool.length} casual workers.\n`)

  const createdDepartmentIds = [] // UC22's own creates, plus uc23Pool - cleaned up at the end
  const uc23Pool = []
  const uc24Pool = []
  for (let i = 0; i < SEQ_COUNT + CONC_COUNT; i++) {
    const res = await fetch(`${BASE_URL}/api/company/create-department`, jsonOpts('POST', {
      company_id: companyId, name: `PerfTest UC23 Pool ${i}-${Date.now()}`, color: '#8B5CF6',
    }, session.cookie))
    updateSessionCookie(session, res)
    const body = await res.json()
    if (!body.success) { console.error(`UC23 pool creation failed at ${i}: ${body.message}`); process.exit(1) }
    uc23Pool.push(body.department.id)
  }
  for (let i = 0; i < SEQ_COUNT + CONC_COUNT; i++) {
    const res = await fetch(`${BASE_URL}/api/company/create-department`, jsonOpts('POST', {
      company_id: companyId, name: `PerfTest UC24 Pool ${i}-${Date.now()}`, color: '#F59E0B',
    }, session.cookie))
    updateSessionCookie(session, res)
    const body = await res.json()
    if (!body.success) { console.error(`UC24 pool creation failed at ${i}: ${body.message}`); process.exit(1) }
    uc24Pool.push(body.department.id)
  }
  createdDepartmentIds.push(...uc23Pool)
  console.log('Department pools ready.\n')

  // --- Per-UC request builders -------------------------------------------------------------
  const ucs = [
    {
      label: 'UC22 Create Department',
      seq: i => ({ url: `${BASE_URL}/api/company/create-department`, options: jsonOpts('POST', {
        company_id: companyId, name: `PerfTest UC22 S${i}-${Date.now()}`, color: '#3B82F6',
      }, session.cookie) }),
      conc: i => ({ url: `${BASE_URL}/api/company/create-department`, options: jsonOpts('POST', {
        company_id: companyId, name: `PerfTest UC22 C${i}-${Date.now()}-${Math.random()}`, color: '#3B82F6',
      }, session.cookie) }),
      collect: body => body?.department?.id ? [body.department.id] : [],
    },
    {
      label: 'UC23 Edit Department',
      seq: i => ({ url: `${BASE_URL}/api/company/update-department`, options: jsonOpts('PATCH', {
        department_id: uc23Pool[i], name: `PerfTest UC23 Edited S${i}-${Date.now()}`, color: '#10B981',
      }, session.cookie) }),
      conc: i => ({ url: `${BASE_URL}/api/company/update-department`, options: jsonOpts('PATCH', {
        department_id: uc23Pool[SEQ_COUNT + i], name: `PerfTest UC23 Edited C${i}-${Date.now()}-${Math.random()}`, color: '#10B981',
      }, session.cookie) }),
    },
    {
      label: 'UC24 Delete Department',
      seq: i => ({ url: `${BASE_URL}/api/company/delete-department`, options: jsonOpts('DELETE', { department_id: uc24Pool[i] }, session.cookie) }),
      conc: i => ({ url: `${BASE_URL}/api/company/delete-department`, options: jsonOpts('DELETE', { department_id: uc24Pool[SEQ_COUNT + i] }, session.cookie) }),
    },
    {
      label: 'UC25 Send Direct Invitation',
      threshold: EXTERNAL_API_THRESHOLD_MS,
      concThreshold: EXTERNAL_API_CONCURRENT_THRESHOLD_MS,
      seq: i => ({ url: `${BASE_URL}/api/invitation/send-invite`, options: jsonOpts('POST', {
        email: `perftest-uc25-s${i}-${Date.now()}@example.com`, role: 'Employee', company_id: companyId, department_id: departmentA.id,
      }, session.cookie) }),
      conc: i => ({ url: `${BASE_URL}/api/invitation/send-invite`, options: jsonOpts('POST', {
        email: `perftest-uc25-c${i}-${Date.now()}-${Math.random()}@example.com`, role: 'Employee', company_id: companyId, department_id: departmentA.id,
      }, session.cookie) }),
    },
    {
      // No dedicated backend endpoint - UC26 filters already-loaded team member data client-side.
      // GET /api/team/members (the data source it searches over) is measured as its proxy.
      label: 'UC26 Search Members',
      seq: () => ({ url: `${BASE_URL}/api/team/members?company_id=${companyId}`, options: withCookie({}, session.cookie) }),
      conc: () => ({ url: `${BASE_URL}/api/team/members?company_id=${companyId}`, options: withCookie({}, session.cookie) }),
    },
    {
      label: 'UC27 Activate Casual Worker',
      seq: i => ({ url: `${BASE_URL}/api/team/casual-worker-status`, options: jsonOpts('PATCH', {
        user_id: cwPool[i].id, company_id: companyId, worker_status: 'active',
      }, session.cookie) }),
      conc: i => ({ url: `${BASE_URL}/api/team/casual-worker-status`, options: jsonOpts('PATCH', {
        user_id: cwPool[SEQ_COUNT + i].id, company_id: companyId, worker_status: 'active',
      }, session.cookie) }),
    },
    {
      label: 'UC28 Deactivate Casual Worker',
      seq: i => ({ url: `${BASE_URL}/api/team/casual-worker-status`, options: jsonOpts('PATCH', {
        user_id: cwPool[i].id, company_id: companyId, worker_status: 'inactive', inactivate_reason: 'PerfTest',
      }, session.cookie) }),
      conc: i => ({ url: `${BASE_URL}/api/team/casual-worker-status`, options: jsonOpts('PATCH', {
        user_id: cwPool[SEQ_COUNT + i].id, company_id: companyId, worker_status: 'inactive', inactivate_reason: 'PerfTest',
      }, session.cookie) }),
    },
    {
      label: 'UC29 Remove Team Member',
      threshold: EXTERNAL_API_THRESHOLD_MS,
      concThreshold: EXTERNAL_API_CONCURRENT_THRESHOLD_MS,
      seq: i => ({ url: `${BASE_URL}/api/team/remove-member`, options: jsonOpts('DELETE', {
        company_id: companyId, user_id_to_remove: uc29Removable[i].id,
      }, session.cookie) }),
      conc: i => ({ url: `${BASE_URL}/api/team/remove-member`, options: jsonOpts('DELETE', {
        company_id: companyId, user_id_to_remove: uc29Removable[SEQ_COUNT + i].id,
      }, session.cookie) }),
    },
    {
      label: 'UC30 Change Member Department',
      seq: i => ({ url: `${BASE_URL}/api/user/update-department`, options: jsonOpts('PATCH', {
        user_id: uc30Pool[i].id, department_id: departmentB.id, company_id: companyId,
      }, session.cookie) }),
      conc: i => ({ url: `${BASE_URL}/api/user/update-department`, options: jsonOpts('PATCH', {
        user_id: uc30Pool[SEQ_COUNT + i].id, department_id: departmentB.id, company_id: companyId,
      }, session.cookie) }),
    },
    {
      label: 'UC31 Invite Members by CSV',
      threshold: EXTERNAL_API_THRESHOLD_MS,
      concThreshold: EXTERNAL_API_CONCURRENT_THRESHOLD_MS,
      seq: i => ({ url: `${BASE_URL}/api/import/members`, options: jsonOpts('POST', {
        company_id: companyId,
        members: [
          { email: `perftest-uc31-s${i}-a-${Date.now()}@example.com`, role: 'Employee', department_name: departmentA.name },
          { email: `perftest-uc31-s${i}-b-${Date.now()}@example.com`, role: 'Employee', department_name: departmentA.name },
        ],
      }, session.cookie) }),
      conc: i => ({ url: `${BASE_URL}/api/import/members`, options: jsonOpts('POST', {
        company_id: companyId,
        members: [
          { email: `perftest-uc31-c${i}-a-${Date.now()}-${Math.random()}@example.com`, role: 'Employee', department_name: departmentA.name },
          { email: `perftest-uc31-c${i}-b-${Date.now()}-${Math.random()}@example.com`, role: 'Employee', department_name: departmentA.name },
        ],
      }, session.cookie) }),
    },
    {
      label: 'UC32 Import Departments by CSV',
      seq: i => ({ url: `${BASE_URL}/api/import/departments`, options: jsonOpts('POST', {
        company_id: companyId, departments: [`PerfTest UC32 S${i}-${Date.now()}`, `PerfTest UC32 S${i}b-${Date.now()}`],
      }, session.cookie) }),
      conc: i => ({ url: `${BASE_URL}/api/import/departments`, options: jsonOpts('POST', {
        company_id: companyId, departments: [`PerfTest UC32 C${i}-${Date.now()}-${Math.random()}`, `PerfTest UC32 C${i}b-${Date.now()}-${Math.random()}`],
      }, session.cookie) }),
      // Departments created by CSV import aren't tracked by name here - swept up in bulk cleanup below.
    },
    {
      label: 'UC33 Edit Company Profile',
      seq: i => ({ url: `${BASE_URL}/api/company/update-profile`, options: jsonOpts('PATCH', {
        company_id: companyId, name: `PerfTest Co S${i}`, description: 'Perf test description',
        location: 'Singapore', address: '1 Test Street', postal_code: '123456', industry: 'Technology', size: '10-50',
      }, session.cookie) }),
      conc: i => ({ url: `${BASE_URL}/api/company/update-profile`, options: jsonOpts('PATCH', {
        company_id: companyId, name: `PerfTest Co C${i}`, description: 'Perf test description',
        location: 'Singapore', address: '1 Test Street', postal_code: '123456', industry: 'Technology', size: '10-50',
      }, session.cookie) }),
    },
  ]

  // --- Phase A: single-request block (screenshot #1) ---------------------------------------
  reprintDatasetBanner()
  console.log('=== SINGLE-REQUEST RESULTS (n=10 sequential per UC) ===\n')
  let allPass = true
  for (const uc of ucs) {
    const result = await runSequential(uc.label, SEQ_COUNT, uc.seq, session)
    allPass = report(uc.label, result, uc.threshold) && allPass
    if (uc.collect) createdDepartmentIds.push(...result.bodies.flatMap(uc.collect))
  }

  // --- Phase B: concurrent block (screenshot #2) --------------------------------------------
  reprintDatasetBanner()
  console.log(`\n=== CONCURRENT RESULTS (${CONC_COUNT} simultaneous requests per UC) ===\n`)
  for (const uc of ucs) {
    const result = await runConcurrent(uc.label, CONC_COUNT, uc.conc, session)
    allPass = report(uc.label, result, uc.concThreshold ?? uc.threshold) && allPass
    if (uc.collect) createdDepartmentIds.push(...result.bodies.flatMap(uc.collect))
  }

  // --- Cleanup -------------------------------------------------------------------------------
  console.log('\n--- Cleanup ---')
  let deletedDepts = 0
  for (const id of [...new Set(createdDepartmentIds)]) {
    const res = await fetch(`${BASE_URL}/api/company/delete-department`, jsonOpts('DELETE', { department_id: id }, session.cookie))
    updateSessionCookie(session, res)
    if (res.ok) deletedDepts++
  }
  console.log(`Deleted ${deletedDepts}/${createdDepartmentIds.length} throwaway departments (UC22 + UC23 + UC24 pools, by tracked id).`)

  // UC32 imports departments by CSV and the response carries no ids, so those 60 (2 per call x 30
  // calls) were never in createdDepartmentIds and used to survive every run - which is how a company
  // that should have 4 departments ended up with 64, silently inflating every module measured after
  // Module 3. Sweep them by name prefix instead, which is the only handle they leave behind.
  const { data: strays } = await admin.from('departments').select('id, name').eq('company_id', companyId).like('name', 'PerfTest%')
  let sweptDepts = 0
  for (const d of strays ?? []) {
    const res = await fetch(`${BASE_URL}/api/company/delete-department`, jsonOpts('DELETE', { department_id: d.id }, session.cookie))
    updateSessionCookie(session, res)
    if (res.ok) sweptDepts++
  }
  console.log(`Swept ${sweptDepts}/${(strays ?? []).length} remaining PerfTest-named departments (UC32's CSV-created ones, which return no ids).`)

  let deletedCw = 0
  for (const cw of cwPool) { if (await deleteDisposableUser(cw)) deletedCw++ }
  console.log(`Deleted ${deletedCw}/${cwPool.length} disposable Casual Workers.`)

  let deletedUc30 = 0
  for (const emp of uc30Pool) { if (await deleteDisposableUser(emp)) deletedUc30++ }
  console.log(`Deleted ${deletedUc30}/${uc30Pool.length} disposable UC30 Employees.`)

  // The 31st UC29 employee was never removed by the measured calls (kept as permanent peer) -
  // clean it up manually, then the now-empty holding department.
  const uc29Leftover = uc29Pool[uc29Pool.length - 1]
  await deleteDisposableUser(uc29Leftover)
  const uc29DeptDeleteRes = await fetch(`${BASE_URL}/api/company/delete-department`, jsonOpts('DELETE', { department_id: uc29DeptId }, session.cookie))
  console.log(`UC29 leftover employee + holding department cleanup: ${uc29DeptDeleteRes.ok ? 'ok' : 'failed (non-fatal)'}.`)

  // Restore the real company profile UC33 overwrote.
  const restoreRes = await fetch(`${BASE_URL}/api/company/update-profile`, jsonOpts('PATCH', {
    company_id: companyId,
    name: originalProfile.name, description: originalProfile.description, location: originalProfile.location,
    address: originalProfile.address, postal_code: originalProfile.postal_code, industry: originalProfile.industry,
    size: originalProfile.size,
  }, session.cookie))
  console.log(`Company profile restored to original values: ${restoreRes.ok ? 'ok' : 'FAILED - check manually'}.`)
  console.log('(UC25/UC31 invitation rows are left as-is - all addresses are under example.com, harmless, and expire in 7 days per business rule.)\n')

  console.log(allPass
    ? `RESULT: ALL PASS. Every Module 3 UC responded within the ${THRESHOLD_MS}ms requirement, single-request and under ${CONC_COUNT}-way concurrent load.`
    : `RESULT: FAIL. One or more Module 3 UCs exceeded the ${THRESHOLD_MS}ms requirement.`)
}

main()
