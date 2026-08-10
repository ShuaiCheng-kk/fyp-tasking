/**
 * scripts/perf-test-module5.js - Performance NFR verification, Module 5 (Attendance, UC50-UC61)
 *
 * Per-UC breakdown of the Performance Requirement (3s standard threshold). No AI-generation UCs
 * here - UC61 is labelled "AI Process" in the UI but is explicitly NOT an LLM call (see its
 * business rules: "fully deterministic code... running an LLM call per queue entry would make the
 * button slow for no benefit"), so it stays on the plain 3s bar like everything else.
 *
 * Guinea pig actors: Owner for the approve/decide/modify-side UCs (55/56/58/59/60/61); a
 * disposable Employee for the self-service UCs (50/51/52/53/54/57), fabricated via the Supabase
 * service-role key (same technique as Module 3/4) rather than touching the real seeded
 * employee1-8 accounts, since several of these UCs mutate real attendance/day-off/swap state.
 *
 * Attendance is the one module where "far in the future" isn't an option for dates - Clock In/Out
 * and Break In/Out are gated on the REAL current moment relative to a shift's start/end. Each pool
 * uses a wide-enough time window (or a deliberately already-elapsed one for Clock Out) that the
 * gate stays satisfied regardless of how long setup + earlier UCs in this run take. Shift Swap and
 * Day Off pools still use far-future dates like other modules, since only Clock In/Out/Break are
 * tied to the real clock.
 *
 * Output is printed as two separate blocks - "SINGLE-REQUEST RESULTS" then "CONCURRENT RESULTS" -
 * so each can be screenshotted on its own as evidence.
 *
 * Usage:
 *   npm run dev                        # in one terminal
 *   node scripts/perf-test-module5.js  # in another terminal
 *
 * Requires the database to be seeded (node scripts/seed.js) so owner@test.com exists with at
 * least one department. Requires .env.local (NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
 * for the disposable-account/state fabrication.
 */

require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')

const { printDatasetBanner, reprintDatasetBanner } = require('./lib/datasetBanner')

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000'
const THRESHOLD_MS = 3000
const SEQ_COUNT = 10
const CONC_COUNT = 20
const PASSWORD = '111111'
const DAY_MS = 86400000

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

function pad(str, len) {
  return String(str).padEnd(len)
}

function dateAt(offsetDays) {
  return new Date(Date.now() + offsetDays * DAY_MS).toISOString().slice(0, 10)
}

// Machine timezone for this run happens to be Asia/Shanghai (UTC+8, same offset the app always
// treats shift_date/start_time/end_time as - see src/lib/singaporeTime.ts's SGT_OFFSET), so local
// wall-clock time IS Singapore time here. UC51's shift end needed to be a few hours in the past -
// hmAt(minutes) alone returns just an HH:MM string and silently wraps across midnight without
// changing the paired date, so e.g. "6 hours before 2am" produced "8pm" paired with TODAY's date -
// hours in the FUTURE, not the past. dateKeyAt/hmAt below are still independently useful (most
// pools never cross midnight), but any offset that might cross a day boundary must read date and
// time from the SAME instant - see uc51's window below for the fix.
// Every date/time below is the MACHINE'S LOCAL clock, while the server resolves "today" and the
// open submission week in Singapore time (src/lib/singaporeTime.ts). Those agree only on a +08:00
// machine. On any other offset the day-off pools land in a different week than the one the service
// considers open and UC57/58/59/61 fail with a confusing "currently open week" error rather than a
// real performance problem - so say so up front instead of letting it look like a product defect.
const localOffsetMinutes = -new Date().getTimezoneOffset()
if (localOffsetMinutes !== 480) {
  console.log(`! WARNING: this machine is UTC${localOffsetMinutes >= 0 ? '+' : ''}${localOffsetMinutes / 60}, but the app resolves dates in Singapore time (UTC+8).`)
  console.log('  The day-off UCs (57/58/59/61) may fail on week-boundary mismatches that are not real performance issues.\n')
}

function dateTimeAt(minutes) {
  const d = new Date(Date.now() + minutes * 60000)
  return {
    date: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
    time: `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`,
  }
}
function hmAt(minutes) {
  return dateTimeAt(minutes).time
}
function todayKey() {
  return dateTimeAt(0).date
}
// Monday-start week, mirrors src/lib/schedulingConstants.ts weekStart() exactly.
function weekStart(dateKey) {
  const date = new Date(`${dateKey}T00:00:00`)
  const dow = (date.getDay() + 6) % 7
  date.setDate(date.getDate() - dow)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}
function addDaysToKey(dateKey, days) {
  const date = new Date(`${dateKey}T00:00:00`)
  date.setDate(date.getDate() + days)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
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
    if (status >= 400) { errors++; console.log(`  ! ${label} seq ${i + 1} HTTP ${status}: ${body?.message ?? ''}`) }
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
    if (r.status >= 400) { errors++; console.log(`  ! ${label} conc ${i + 1} HTTP ${r.status}: ${r.body?.message ?? ''}`) }
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
  const email = `perftest-m5-${role.toLowerCase().replace(/\s+/g, '')}-${seed}-${Date.now()}@example.com`
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
  } else if (role === 'Employee') {
    await admin.from('employee_departments').insert({ employee_id: userRow.id, department_id: departmentId, company_id: companyId })
  }
  const login = await signIn(email)
  return { id: userRow.id, authId: authData.user.id, email, cookie: login.cookie }
}

// Returns whether the users row actually went away. supabase-js reports a failed delete by
// returning an { error } object rather than throwing, so a bare try/catch sees nothing and the
// caller happily reports success — which is how earlier runs left 104 orphaned accounts behind
// while printing "Deleted 104 disposable accounts". The rows these users own must go first or the
// delete is refused by FK constraints.
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

// Creates `count` shifts for one staff member via the real bulk-assign endpoint, one per
// `shiftDateFor(i)`/`timesFor(i)`. Not timed - this is setup.
async function createShiftPool(ownerSession, companyId, departmentId, staffId, count, shiftDateFor, timesFor) {
  const assignments = Array.from({ length: count }, (_, i) => ({
    user_id: staffId, shift_date: shiftDateFor(i), start_time: timesFor(i).start, end_time: timesFor(i).end,
  }))
  const res = await fetch(`${BASE_URL}/api/shift/bulk`, jsonOpts('POST', { company_id: companyId, department_id: departmentId, assignments }, ownerSession.cookie))
  updateSessionCookie(ownerSession, res)
  const body = await res.json()
  if (!body.success) { console.error(`Shift pool creation failed: ${body.message}`); process.exit(1) }
  const created = body.result?.created ?? []
  if (created.length < count) {
    console.error(`Shift pool creation only made ${created.length}/${count} shifts: ${JSON.stringify(body.result?.failed?.slice(0, 2))}`)
    process.exit(1)
  }
  return created // [{ id: shift_id, ... }] - need assignment ids separately, see getAssignmentIds
}

async function getAssignmentIdsForShifts(shiftIds) {
  const { data, error } = await admin.from('shift_assignments').select('id, shift_id').in('shift_id', shiftIds)
  if (error) { console.error(`Fetching shift_assignments failed: ${error.message}`); process.exit(1) }
  const byShiftId = new Map(data.map(r => [r.shift_id, r.id]))
  return shiftIds.map(id => byShiftId.get(id))
}

async function fabricateAttendanceRecord(shiftAssignmentId, userId, fields) {
  const { data, error } = await admin.from('attendance_records').insert({
    shift_assignment_id: shiftAssignmentId, user_id: userId, ...fields,
  }).select().single()
  if (error) { console.error(`Attendance record fabrication failed: ${error.message}`); process.exit(1) }
  return data.id
}

async function main() {
  console.log(`Performance test (Module 5: Attendance, UC50-UC61) against ${BASE_URL}`)
  console.log(`Guinea pig actors: Owner for approve/decide/modify UCs; disposable Employees/Managers (service-role fabricated) for self-service UCs.\n`)

  const owner = await signIn(process.env.OWNER_EMAIL || 'owner@test.com')
  const companyId = owner.user.company_id
  await printDatasetBanner(companyId, process.env.OWNER_EMAIL || 'owner@test.com')
  const ownerId = owner.user.id
  const session = { cookie: owner.cookie }

  console.log('--- Setup: resolving department, fabricating disposable accounts and attendance state ---')
  const deptsRes0 = await fetch(`${BASE_URL}/api/company/departments?company_id=${companyId}`, withCookie({}, session.cookie))
  updateSessionCookie(session, deptsRes0)
  const deptsRes = await deptsRes0.json()
  const departmentA = (deptsRes.departments ?? []).find(d => !d.name.startsWith('PerfTest'))
  if (!departmentA) { console.error('Need a real department. Run `node scripts/seed.js` first.'); process.exit(1) }
  console.log(`Using department "${departmentA.name}"`)

  const N = SEQ_COUNT + CONC_COUNT // 30

  // UC50 Clock In pool: one disposable Employee, 30 shifts today, wide-open window
  // (start 20min ago, end 6h from now) so clock-in stays valid no matter how long this whole run takes.
  const emp50 = await createDisposableUser('Employee', companyId, departmentA.id, 'uc50')
  const shifts50 = await createShiftPool(session, companyId, departmentA.id, emp50.id, N, () => todayKey(), () => ({ start: hmAt(-20), end: hmAt(360) }))
  const assign50 = await getAssignmentIdsForShifts(shifts50.map(s => s.id))

  // UC51 Clock Out pool: shift already ended (end 15min ago) so it stays "ended" for the rest of
  // this run, pre-fabricated as already clocked-in (no break) so only clock-out itself is measured.
  // shift_date is anchored to whichever calendar day start_time actually falls on - a -380 minute
  // offset routinely crosses midnight, and the app's own overnight-shift convention (end_time <=
  // start_time means "ends the following day") only works if shift_date matches the START, not
  // today's date unconditionally.
  const uc51Start = dateTimeAt(-380)
  const emp51 = await createDisposableUser('Employee', companyId, departmentA.id, 'uc51')
  const shifts51 = await createShiftPool(session, companyId, departmentA.id, emp51.id, N, () => uc51Start.date, () => ({ start: uc51Start.time, end: hmAt(-15) }))
  const assign51 = await getAssignmentIdsForShifts(shifts51.map(s => s.id))
  for (const assignmentId of assign51) {
    await fabricateAttendanceRecord(assignmentId, emp51.id, { clock_in_time: new Date(Date.now() - 300 * 60000).toISOString() })
  }

  // UC52 Break In pool: wide-open window like UC50, pre-fabricated as clocked-in, no break yet.
  const emp52 = await createDisposableUser('Employee', companyId, departmentA.id, 'uc52')
  const shifts52 = await createShiftPool(session, companyId, departmentA.id, emp52.id, N, () => todayKey(), () => ({ start: hmAt(-20), end: hmAt(360) }))
  const assign52 = await getAssignmentIdsForShifts(shifts52.map(s => s.id))
  for (const assignmentId of assign52) {
    await fabricateAttendanceRecord(assignmentId, emp52.id, { clock_in_time: new Date(Date.now() - 10 * 60000).toISOString() })
  }

  // UC53 Break Out pool: wide-open window, pre-fabricated as clocked-in AND on break.
  const emp53 = await createDisposableUser('Employee', companyId, departmentA.id, 'uc53')
  const shifts53 = await createShiftPool(session, companyId, departmentA.id, emp53.id, N, () => todayKey(), () => ({ start: hmAt(-20), end: hmAt(360) }))
  const assign53 = await getAssignmentIdsForShifts(shifts53.map(s => s.id))
  for (const assignmentId of assign53) {
    await fabricateAttendanceRecord(assignmentId, emp53.id, {
      clock_in_time: new Date(Date.now() - 10 * 60000).toISOString(),
      break_in_time: new Date(Date.now() - 5 * 60000).toISOString(),
    })
  }
  console.log('UC50-53 clock/break pools ready.')

  // UC54 Submit Shift Swap pool: two disposable Employees, same department, each with 30 upcoming
  // (far-future, disjoint-day) shifts on matching dates so day i's pair is swappable.
  const emp54a = await createDisposableUser('Employee', companyId, departmentA.id, 'uc54a')
  const emp54b = await createDisposableUser('Employee', companyId, departmentA.id, 'uc54b')
  const shifts54a = await createShiftPool(session, companyId, departmentA.id, emp54a.id, N, i => dateAt(700 + i), () => ({ start: '09:00', end: '17:00' }))
  const shifts54b = await createShiftPool(session, companyId, departmentA.id, emp54b.id, N, i => dateAt(700 + i), () => ({ start: '09:00', end: '17:00' }))
  const assign54a = await getAssignmentIdsForShifts(shifts54a.map(s => s.id))
  const assign54b = await getAssignmentIdsForShifts(shifts54b.map(s => s.id))
  console.log('UC54 swap-submission pool ready.')

  // UC55/UC56 Approve/Reject Shift Swap pools: two disposable Managers (Owner decides Manager-level
  // swaps), 30+30 far-future shift pairs, with pending swap requests fabricated directly already at
  // "counterpart agreed" stage (the real precondition for decide_shift_swap) - the two-step
  // submit-then-counterpart-accept dance isn't itself being measured here, only the final decision.
  const mgr55a = await createDisposableUser('Manager', companyId, departmentA.id, 'uc55a')
  const mgr55b = await createDisposableUser('Manager', companyId, departmentA.id, 'uc55b')
  const shifts55a = await createShiftPool(session, companyId, departmentA.id, mgr55a.id, N * 2, i => dateAt(1200 + i), () => ({ start: '09:00', end: '17:00' }))
  const shifts55b = await createShiftPool(session, companyId, departmentA.id, mgr55b.id, N * 2, i => dateAt(1200 + i), () => ({ start: '09:00', end: '17:00' }))
  const assign55a = await getAssignmentIdsForShifts(shifts55a.map(s => s.id))
  const assign55b = await getAssignmentIdsForShifts(shifts55b.map(s => s.id))
  async function fabricateSwapRequest(reqAssignmentId, ctrAssignmentId) {
    const { data, error } = await admin.from('shift_swap_requests').insert({
      company_id: companyId, requester_id: mgr55a.id, requester_assignment_id: reqAssignmentId,
      counterpart_id: mgr55b.id, counterpart_assignment_id: ctrAssignmentId,
      reason: 'PerfTest', status: 'pending', counterpart_status: 'approved',
    }).select().single()
    if (error) { console.error(`Swap request fabrication failed: ${error.message}`); process.exit(1) }
    return data.id
  }
  const uc55Pool = []
  for (let i = 0; i < N; i++) uc55Pool.push(await fabricateSwapRequest(assign55a[i], assign55b[i]))
  const uc56Pool = []
  for (let i = 0; i < N; i++) uc56Pool.push(await fabricateSwapRequest(assign55a[N + i], assign55b[N + i]))
  console.log('UC55/UC56 swap-decision pools ready.')

  // UC57 Submit Day Off pool: needs 30 DISTINCT disposable Employees, one submission each - a
  // second submission for the same user/week is blocked ("already submitted"), so this can't reuse
  // one account across all 30 calls the way most other pools do.
  const uc57Employees = []
  for (let i = 0; i < N; i++) uc57Employees.push(await createDisposableUser('Employee', companyId, departmentA.id, `uc57-${i}`))
  console.log('UC57 day-off submitters ready.')

  // Mirrors resolveActiveSubmissionWeekStart with no custom deadline configured (default seed
  // state) - the currently open week is always next week's Monday.
  const activeWeekStart = addDaysToKey(weekStart(todayKey()), 7)
  const dayOffDate1 = addDaysToKey(activeWeekStart, 0) // Monday of the open week
  const dayOffDate2 = addDaysToKey(activeWeekStart, 1) // Tuesday - used by UC59's "different dates"

  // UC58/UC59 Approve/Modify Day Off pools: fabricated directly as pending single-date requests
  // (bypassing the exact-quota submission flow, which isn't what's being measured here).
  const uc58Employees = []
  const uc58Pool = []
  for (let i = 0; i < N; i++) {
    const emp = await createDisposableUser('Employee', companyId, departmentA.id, `uc58-${i}`)
    uc58Employees.push(emp)
    const { data, error } = await admin.from('off_day_requests').insert({
      user_id: emp.id, company_id: companyId, requested_date: dayOffDate1, requested_week: activeWeekStart, status: 'pending', source: 'submitted',
    }).select().single()
    if (error) { console.error(`UC58 off-day fabrication failed: ${error.message}`); process.exit(1) }
    uc58Pool.push(data.id)
  }
  const uc59Employees = []
  const uc59Pool = []
  for (let i = 0; i < N; i++) {
    const emp = await createDisposableUser('Employee', companyId, departmentA.id, `uc59-${i}`)
    uc59Employees.push(emp)
    const { data, error } = await admin.from('off_day_requests').insert({
      user_id: emp.id, company_id: companyId, requested_date: dayOffDate1, requested_week: activeWeekStart, status: 'pending', source: 'submitted',
    }).select().single()
    if (error) { console.error(`UC59 off-day fabrication failed: ${error.message}`); process.exit(1) }
    uc59Pool.push(data.id)
  }
  console.log('UC58/UC59 day-off decision pools ready.')

  // UC61 AI Day Off Queue Sweep: a small, never-decided pending set (separate from UC58/59's pools,
  // which get consumed) so all 30 test calls have real pending data to sweep every time.
  const uc61Employees = []
  for (let i = 0; i < 5; i++) {
    const emp = await createDisposableUser('Employee', companyId, departmentA.id, `uc61-${i}`)
    uc61Employees.push(emp)
    const { error } = await admin.from('off_day_requests').insert({
      user_id: emp.id, company_id: companyId, requested_date: dayOffDate2, requested_week: activeWeekStart, status: 'pending', source: 'submitted',
    })
    if (error) { console.error(`UC61 off-day fabrication failed: ${error.message}`); process.exit(1) }
  }
  console.log('UC61 sweep pool ready.')

  // UC60 Modify Clock Time pool: 30 disposable-Employee shifts today (any window - no time-gate on
  // this action), pre-fabricated as clocked-in so there is something to modify.
  const emp60 = await createDisposableUser('Employee', companyId, departmentA.id, 'uc60')
  const shifts60 = await createShiftPool(session, companyId, departmentA.id, emp60.id, N, () => todayKey(), () => ({ start: hmAt(-20), end: hmAt(360) }))
  const assign60 = await getAssignmentIdsForShifts(shifts60.map(s => s.id))
  const uc60Pool = []
  for (const assignmentId of assign60) {
    uc60Pool.push(await fabricateAttendanceRecord(assignmentId, emp60.id, { clock_in_time: new Date(Date.now() - 15 * 60000).toISOString() }))
  }
  console.log('UC60 modify-time pool ready.\n')

  // --- Per-UC request builders -------------------------------------------------------------
  const ucs = [
    {
      label: 'UC50 Clock In',
      seq: i => ({ url: `${BASE_URL}/api/employee/attendance`, options: jsonOpts('POST', { user_id: emp50.authId, shift_assignment_id: assign50[i], action: 'clock_in' }, emp50.cookie), session: { cookie: emp50.cookie } }),
      conc: i => ({ url: `${BASE_URL}/api/employee/attendance`, options: jsonOpts('POST', { user_id: emp50.authId, shift_assignment_id: assign50[SEQ_COUNT + i], action: 'clock_in' }, emp50.cookie), session: { cookie: emp50.cookie } }),
    },
    {
      label: 'UC51 Clock Out',
      seq: i => ({ url: `${BASE_URL}/api/employee/attendance`, options: jsonOpts('POST', { user_id: emp51.authId, shift_assignment_id: assign51[i], action: 'clock_out' }, emp51.cookie), session: { cookie: emp51.cookie } }),
      conc: i => ({ url: `${BASE_URL}/api/employee/attendance`, options: jsonOpts('POST', { user_id: emp51.authId, shift_assignment_id: assign51[SEQ_COUNT + i], action: 'clock_out' }, emp51.cookie), session: { cookie: emp51.cookie } }),
    },
    {
      label: 'UC52 Break In',
      seq: i => ({ url: `${BASE_URL}/api/employee/attendance`, options: jsonOpts('POST', { user_id: emp52.authId, shift_assignment_id: assign52[i], action: 'break_in' }, emp52.cookie), session: { cookie: emp52.cookie } }),
      conc: i => ({ url: `${BASE_URL}/api/employee/attendance`, options: jsonOpts('POST', { user_id: emp52.authId, shift_assignment_id: assign52[SEQ_COUNT + i], action: 'break_in' }, emp52.cookie), session: { cookie: emp52.cookie } }),
    },
    {
      label: 'UC53 Break Out',
      seq: i => ({ url: `${BASE_URL}/api/employee/attendance`, options: jsonOpts('POST', { user_id: emp53.authId, shift_assignment_id: assign53[i], action: 'break_out' }, emp53.cookie), session: { cookie: emp53.cookie } }),
      conc: i => ({ url: `${BASE_URL}/api/employee/attendance`, options: jsonOpts('POST', { user_id: emp53.authId, shift_assignment_id: assign53[SEQ_COUNT + i], action: 'break_out' }, emp53.cookie), session: { cookie: emp53.cookie } }),
    },
    {
      label: 'UC54 Submit Shift Swap Request',
      seq: i => ({ url: `${BASE_URL}/api/attendance`, options: jsonOpts('POST', {
        action: 'submit_shift_swap', company_id: companyId, requester_assignment_id: assign54a[i], counterpart_id: emp54b.id, counterpart_assignment_id: assign54b[i], reason: 'PerfTest',
      }, emp54a.cookie), session: { cookie: emp54a.cookie } }),
      conc: i => ({ url: `${BASE_URL}/api/attendance`, options: jsonOpts('POST', {
        action: 'submit_shift_swap', company_id: companyId, requester_assignment_id: assign54a[SEQ_COUNT + i], counterpart_id: emp54b.id, counterpart_assignment_id: assign54b[SEQ_COUNT + i], reason: 'PerfTest',
      }, emp54a.cookie), session: { cookie: emp54a.cookie } }),
    },
    {
      label: 'UC55 Approve Shift Swap Request',
      seq: i => ({ url: `${BASE_URL}/api/attendance`, options: jsonOpts('PATCH', { action: 'decide_shift_swap', id: uc55Pool[i], decision: 'approved' }, session.cookie), session }),
      conc: i => ({ url: `${BASE_URL}/api/attendance`, options: jsonOpts('PATCH', { action: 'decide_shift_swap', id: uc55Pool[SEQ_COUNT + i], decision: 'approved' }, session.cookie), session }),
    },
    {
      label: 'UC56 Reject Shift Swap Request',
      seq: i => ({ url: `${BASE_URL}/api/attendance`, options: jsonOpts('PATCH', { action: 'decide_shift_swap', id: uc56Pool[i], decision: 'rejected', reason: 'PerfTest' }, session.cookie), session }),
      conc: i => ({ url: `${BASE_URL}/api/attendance`, options: jsonOpts('PATCH', { action: 'decide_shift_swap', id: uc56Pool[SEQ_COUNT + i], decision: 'rejected', reason: 'PerfTest' }, session.cookie), session }),
    },
    {
      label: 'UC57 Submit Day Off Request',
      seq: i => { const e = uc57Employees[i]; return { url: `${BASE_URL}/api/attendance`, options: jsonOpts('POST', { action: 'submit_fixed_off_day', company_id: companyId, dates: [dayOffDate1, dayOffDate2] }, e.cookie), session: { cookie: e.cookie } } },
      conc: i => { const e = uc57Employees[SEQ_COUNT + i]; return { url: `${BASE_URL}/api/attendance`, options: jsonOpts('POST', { action: 'submit_fixed_off_day', company_id: companyId, dates: [dayOffDate1, dayOffDate2] }, e.cookie), session: { cookie: e.cookie } } },
    },
    {
      label: 'UC58 Approve Day Off Request',
      seq: i => ({ url: `${BASE_URL}/api/attendance`, options: jsonOpts('PATCH', { action: 'decide_fixed_off_day', id: uc58Pool[i], decision: 'approved' }, session.cookie), session }),
      conc: i => ({ url: `${BASE_URL}/api/attendance`, options: jsonOpts('PATCH', { action: 'decide_fixed_off_day', id: uc58Pool[SEQ_COUNT + i], decision: 'approved' }, session.cookie), session }),
    },
    {
      label: 'UC59 Modify Day Off Request',
      seq: i => ({ url: `${BASE_URL}/api/attendance`, options: jsonOpts('PATCH', { action: 'decide_fixed_off_day', id: uc59Pool[i], decision: 'modified', new_date: dayOffDate2 }, session.cookie), session }),
      conc: i => ({ url: `${BASE_URL}/api/attendance`, options: jsonOpts('PATCH', { action: 'decide_fixed_off_day', id: uc59Pool[SEQ_COUNT + i], decision: 'modified', new_date: dayOffDate2 }, session.cookie), session }),
    },
    {
      label: 'UC60 Modify Clock Time',
      seq: i => ({ url: `${BASE_URL}/api/attendance`, options: jsonOpts('PATCH', { action: 'modify_times', id: uc60Pool[i], reason: 'PerfTest', clock_in_time: new Date(Date.now() - 14 * 60000).toISOString() }, session.cookie), session }),
      conc: i => ({ url: `${BASE_URL}/api/attendance`, options: jsonOpts('PATCH', { action: 'modify_times', id: uc60Pool[SEQ_COUNT + i], reason: 'PerfTest', clock_in_time: new Date(Date.now() - 13 * 60000).toISOString() }, session.cookie), session }),
    },
    {
      label: 'UC61 Generate AI Day Off Suggestion',
      seq: () => ({ url: `${BASE_URL}/api/attendance/ai-suggest`, options: jsonOpts('POST', { request_type: 'fixed_off_day_queue', company_id: companyId }, session.cookie), session }),
      conc: () => ({ url: `${BASE_URL}/api/attendance/ai-suggest`, options: jsonOpts('POST', { request_type: 'fixed_off_day_queue', company_id: companyId }, session.cookie), session }),
    },
  ]

  // --- Phase A: single-request block (screenshot #1) ---------------------------------------
  reprintDatasetBanner()
  console.log('=== SINGLE-REQUEST RESULTS (n=10 sequential per UC) ===\n')
  let allPass = true
  for (const uc of ucs) {
    const result = await runSequential(uc.label, SEQ_COUNT, uc.seq)
    allPass = report(uc.label, result) && allPass
  }

  // --- Phase B: concurrent block (screenshot #2) --------------------------------------------
  reprintDatasetBanner()
  console.log(`\n=== CONCURRENT RESULTS (${CONC_COUNT} simultaneous requests per UC) ===\n`)
  for (const uc of ucs) {
    const result = await runConcurrent(uc.label, CONC_COUNT, uc.conc)
    allPass = report(uc.label, result) && allPass
  }

  // --- Cleanup -------------------------------------------------------------------------------
  console.log('\n--- Cleanup ---')
  const allShiftIds = [
    ...shifts50, ...shifts51, ...shifts52, ...shifts53, ...shifts54a, ...shifts54b,
    ...shifts55a, ...shifts55b, ...shifts60,
  ].map(s => s.id)
  let deletedShifts = 0
  for (const id of [...new Set(allShiftIds)]) {
    try {
      await admin.from('attendance_records').delete().eq('shift_assignment_id', (await admin.from('shift_assignments').select('id').eq('shift_id', id).maybeSingle()).data?.id ?? '00000000-0000-0000-0000-000000000000')
      await admin.from('shift_swap_requests').delete().or(`requester_assignment_id.eq.${id},counterpart_assignment_id.eq.${id}`)
      await admin.from('shift_assignments').delete().eq('shift_id', id)
      const { error } = await admin.from('shifts').delete().eq('id', id)
      if (!error) deletedShifts++
    } catch { /* best-effort */ }
  }
  console.log(`Deleted ${deletedShifts}/${allShiftIds.length} throwaway shifts (and their assignments/attendance/swap rows).`)

  let deletedOffDay = 0
  for (const id of [...uc58Pool, ...uc59Pool]) {
    const { error } = await admin.from('off_day_requests').delete().eq('id', id)
    if (!error) deletedOffDay++
  }
  await admin.from('off_day_requests').delete().eq('requested_week', activeWeekStart).eq('requested_date', dayOffDate2).in('user_id', uc61Employees.map(e => e.id))
  await admin.from('off_day_requests').delete().in('user_id', uc57Employees.map(e => e.id))
  console.log(`Deleted ${deletedOffDay}/${uc58Pool.length + uc59Pool.length} fabricated day-off requests (plus UC57/UC61's own).`)

  const allDisposableUsers = [
    emp50, emp51, emp52, emp53, emp54a, emp54b, mgr55a, mgr55b,
    ...uc57Employees, ...uc58Employees, ...uc59Employees, ...uc61Employees, emp60,
  ]
  let deletedUsers = 0
  for (const u of allDisposableUsers) { if (await deleteDisposableUser(u)) deletedUsers++ }
  console.log(`Deleted ${deletedUsers}/${allDisposableUsers.length} disposable accounts.\n`)

  console.log(allPass
    ? `RESULT: ALL PASS. Every Module 5 UC responded within the ${THRESHOLD_MS}ms requirement, single-request and under ${CONC_COUNT}-way concurrent load.`
    : `RESULT: FAIL. One or more Module 5 UCs exceeded the ${THRESHOLD_MS}ms requirement.`)
}

main()
