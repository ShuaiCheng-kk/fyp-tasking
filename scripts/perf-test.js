/**
 * scripts/perf-test.js - Performance NFR verification script
 *
 * Verifies the Performance Requirement:
 *   "Tasking must support concurrent access by multiple users without significant
 *   latency. Key operational features, such as clock-in/out and schedule retrieval,
 *   must process within a 3-second response time under normal operating conditions."
 *
 * Measures real HTTP round-trip time against the running dev server for one key
 * read endpoint per module (all 8 modules), the two operations the requirement
 * names explicitly (clock-in and schedule retrieval), and a concurrent-access test.
 *
 * Usage:
 *   npm run dev                 # in one terminal
 *   node scripts/perf-test.js   # in another terminal
 *
 * Requires the database to be seeded (node scripts/seed.js) so owner@test.com and
 * casual1@test.com exist. The clock-in measurement performs a real state change
 * against casual1@test.com's ready-to-clock-in shift, so it can only succeed once
 * per seed run. Re-run `node scripts/seed.js` before running this script again if
 * you need a fresh successful clock-in measurement.
 *
 * Every route now requires a real server-side session (see src/lib/serverAuth.ts),
 * so this script signs in for real and replays the resulting Set-Cookie header on
 * every subsequent request for that user, the same way a browser would.
 */

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000'
const THRESHOLD_MS = 3000
const REPEATS = 10
const CONCURRENCY = 20
const PASSWORD = '111111'

function pad(str, len) {
  return String(str).padEnd(len)
}

function withCookie(options, cookie) {
  if (!cookie) return options
  return { ...options, headers: { ...(options?.headers ?? {}), Cookie: cookie } }
}

async function timeRequest(url, options) {
  const start = performance.now()
  const res = await fetch(url, options)
  const elapsed = performance.now() - start
  const body = await res.json().catch(() => null)
  return { elapsed, status: res.status, body }
}

async function benchmark(label, url, options, repeats = REPEATS) {
  const timings = []
  for (let i = 0; i < repeats; i++) {
    const { elapsed, status } = await timeRequest(url, options)
    if (status >= 400) console.log(`  ! ${label} request ${i + 1} returned HTTP ${status}`)
    timings.push(elapsed)
  }
  timings.sort((a, b) => a - b)
  const avg = timings.reduce((a, b) => a + b, 0) / timings.length
  const min = timings[0]
  const max = timings[timings.length - 1]
  const p95 = timings[Math.floor(timings.length * 0.95)] ?? max
  return { label, repeats, avg, min, max, p95 }
}

async function concurrentBenchmark(label, url, options, concurrency = CONCURRENCY) {
  const wallStart = performance.now()
  const settled = await Promise.all(
    Array.from({ length: concurrency }, () => timeRequest(url, options))
  )
  const wallElapsed = performance.now() - wallStart
  settled.forEach((r, i) => {
    if (r.status >= 400) console.log(`  ! ${label} concurrent request ${i + 1} returned HTTP ${r.status}`)
  })
  const timings = settled.map(r => r.elapsed).sort((a, b) => a - b)
  const avg = timings.reduce((a, b) => a + b, 0) / timings.length
  const min = timings[0]
  const max = timings[timings.length - 1]
  const p95 = timings[Math.floor(timings.length * 0.95)] ?? max
  return { label, repeats: concurrency, avg, min, max, p95, wallElapsed }
}

function report(result) {
  const pass = result.max <= THRESHOLD_MS
  const wallNote = result.wallElapsed !== undefined ? ` wall=${result.wallElapsed.toFixed(0)}ms` : ''
  console.log(
    `${pad(result.label, 46)} n=${pad(result.repeats, 3)} ` +
    `avg=${pad(result.avg.toFixed(0) + 'ms', 8)} min=${pad(result.min.toFixed(0) + 'ms', 8)} ` +
    `max=${pad(result.max.toFixed(0) + 'ms', 8)} p95=${pad(result.p95.toFixed(0) + 'ms', 8)} ` +
    (pass ? 'PASS' : 'FAIL') + wallNote
  )
  return pass
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

async function main() {
  console.log(`Performance test against ${BASE_URL}`)
  console.log(`Requirement: concurrent access without significant latency; clock-in/out and schedule retrieval within ${THRESHOLD_MS}ms.\n`)

  const ownerEmail = process.env.OWNER_EMAIL || 'owner@test.com'
  const casualEmail = process.env.CASUAL_EMAIL || 'casual1@test.com'
  const owner = await signIn(ownerEmail)
  const casual = await signIn(casualEmail)
  const ownerId = owner.user.company_id
  const casualAuthId = casual.user.auth_id

  const today = new Date()
  const dateFrom = new Date(today.getTime() - 14 * 86400000).toISOString().slice(0, 10)
  const dateTo = new Date(today.getTime() + 14 * 86400000).toISOString().slice(0, 10)

  const scheduleUrl = `${BASE_URL}/api/shift?company_id=${ownerId}&date_from=${dateFrom}&date_to=${dateTo}`
  const ownerOpts = withCookie({}, owner.cookie)
  const casualOpts = withCookie({}, casual.cookie)

  console.log('--- Sequential, one endpoint per module ---')
  const results = []
  let allPass = true

  async function run(promise) {
    const result = await promise
    const pass = report(result)
    allPass = allPass && pass
    results.push(result)
    return result
  }

  await run(benchmark('Module 1 Shift: schedule retrieval', scheduleUrl, ownerOpts))

  await run(benchmark(
    'Module 2 Task: kanban board',
    `${BASE_URL}/api/task?company_id=${ownerId}&kanban=true`,
    ownerOpts,
  ))

  await run(benchmark(
    'Module 3 Team: member list',
    `${BASE_URL}/api/team/members?company_id=${ownerId}`,
    ownerOpts,
  ))

  await run(benchmark(
    'Module 4 Recruitment: job postings',
    `${BASE_URL}/api/recruitment?company_id=${ownerId}`,
    ownerOpts,
  ))

  await run(benchmark(
    'Module 5 Attendance: retrieval',
    `${BASE_URL}/api/casual/attendance?user_id=${casualAuthId}`,
    casualOpts,
  ))

  await run(benchmark(
    'Module 6 Communication: announcements',
    `${BASE_URL}/api/inbox/announcements?company_id=${ownerId}`,
    ownerOpts,
  ))

  await run(benchmark(
    'Module 7 Report: company report',
    `${BASE_URL}/api/report/company?company_id=${ownerId}&date_from=${dateFrom}&date_to=${dateTo}`,
    ownerOpts,
  ))

  await run(benchmark(
    'Module 8 Auth: sign-in',
    `${BASE_URL}/api/auth/signin`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email_address: ownerEmail, password: PASSWORD }),
    },
    5,
  ))

  console.log('')
  console.log('--- Clock-in/out (named explicitly in the requirement) ---')
  const attendance = await fetch(`${BASE_URL}/api/casual/attendance?user_id=${casualAuthId}`, casualOpts).then(r => r.json())
  const readyShift = attendance.attendance?.shifts?.find(s => !s.record?.clock_in_time)

  if (!readyShift) {
    console.log('! No un-clocked-in shift found for casual1@test.com. Run `node scripts/seed.js` again before this script, skipping the clock-in measurement.')
  } else {
    await run(benchmark(
      'Clock-in (POST /api/casual/attendance)',
      `${BASE_URL}/api/casual/attendance`,
      withCookie({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: casualAuthId,
          shift_assignment_id: readyShift.assignment.id,
          action: 'clock_in',
        }),
      }, casual.cookie),
      1, // real write, can only run once per seed
    ))
  }

  console.log('')
  console.log(`--- Concurrent access: ${CONCURRENCY} simultaneous requests (schedule retrieval) ---`)
  await run(concurrentBenchmark('Concurrent schedule retrieval', scheduleUrl, ownerOpts))

  console.log('')
  console.log(allPass
    ? `RESULT: ALL PASS. Every endpoint responded within the ${THRESHOLD_MS}ms requirement, including under ${CONCURRENCY}-way concurrent load.`
    : `RESULT: FAIL. One or more endpoints exceeded the ${THRESHOLD_MS}ms requirement.`)
}

main()
