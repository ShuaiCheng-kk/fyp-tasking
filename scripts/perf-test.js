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
 */

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000'
const THRESHOLD_MS = 3000
const REPEATS = 10
const CONCURRENCY = 20
const PASSWORD = '111111'

function pad(str, len) {
  return String(str).padEnd(len)
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

async function concurrentBenchmark(label, url, concurrency = CONCURRENCY) {
  const wallStart = performance.now()
  const settled = await Promise.all(
    Array.from({ length: concurrency }, () => timeRequest(url))
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
  }).then(r => r.json())
  if (!res.success) {
    console.error(`Sign-in failed for ${email}: ${res.message}`)
    process.exit(1)
  }
  return res.user
}

async function main() {
  console.log(`Performance test against ${BASE_URL}`)
  console.log(`Requirement: concurrent access without significant latency; clock-in/out and schedule retrieval within ${THRESHOLD_MS}ms.\n`)

  const owner = await signIn('owner@test.com')
  const casual = await signIn('casual1@test.com')

  const today = new Date()
  const dateFrom = new Date(today.getTime() - 14 * 86400000).toISOString().slice(0, 10)
  const dateTo = new Date(today.getTime() + 14 * 86400000).toISOString().slice(0, 10)

  const scheduleUrl = `${BASE_URL}/api/shift?company_id=${owner.company_id}&date_from=${dateFrom}&date_to=${dateTo}`

  console.log('--- Sequential, one endpoint per module ---')
  const results = []

  results.push(await benchmark(
    'Module 1 Shift: schedule retrieval',
    scheduleUrl,
  ))

  results.push(await benchmark(
    'Module 2 Task: kanban board',
    `${BASE_URL}/api/task?company_id=${owner.company_id}&kanban=true`,
  ))

  results.push(await benchmark(
    'Module 3 Team: member list',
    `${BASE_URL}/api/team/members?company_id=${owner.company_id}`,
  ))

  results.push(await benchmark(
    'Module 4 Recruitment: job postings',
    `${BASE_URL}/api/recruitment?company_id=${owner.company_id}`,
  ))

  results.push(await benchmark(
    'Module 5 Attendance: retrieval',
    `${BASE_URL}/api/casual/attendance?user_id=${casual.auth_id}`,
  ))

  results.push(await benchmark(
    'Module 6 Communication: announcements',
    `${BASE_URL}/api/inbox/announcements?company_id=${owner.company_id}`,
  ))

  results.push(await benchmark(
    'Module 7 Report: company report',
    `${BASE_URL}/api/report/company?company_id=${owner.company_id}&date_from=${dateFrom}&date_to=${dateTo}`,
  ))

  results.push(await benchmark(
    'Module 8 Auth: sign-in',
    `${BASE_URL}/api/auth/signin`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email_address: 'owner@test.com', password: PASSWORD }),
    },
    5,
  ))

  console.log('')
  console.log(`--- Clock-in/out (named explicitly in the requirement) ---`)
  const attendance = await fetch(`${BASE_URL}/api/casual/attendance?user_id=${casual.auth_id}`).then(r => r.json())
  const readyShift = attendance.attendance?.shifts?.find(s => !s.record?.clock_in_time)

  if (!readyShift) {
    console.log('! No un-clocked-in shift found for casual1@test.com. Run `node scripts/seed.js` again before this script, skipping the clock-in measurement.\n')
  } else {
    results.push(await benchmark(
      'Clock-in (POST /api/casual/attendance)',
      `${BASE_URL}/api/casual/attendance`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: casual.auth_id,
          shift_assignment_id: readyShift.assignment.id,
          action: 'clock_in',
        }),
      },
      1, // real write, can only run once per seed
    ))
  }

  console.log('')
  console.log(`--- Concurrent access: ${CONCURRENCY} simultaneous requests (schedule retrieval) ---`)
  results.push(await concurrentBenchmark('Concurrent schedule retrieval', scheduleUrl))

  console.log('')
  const allPass = results.map(report).every(Boolean)

  console.log('')
  console.log(allPass
    ? `RESULT: ALL PASS. Every endpoint responded within the ${THRESHOLD_MS}ms requirement, including under ${CONCURRENCY}-way concurrent load.`
    : `RESULT: FAIL. One or more endpoints exceeded the ${THRESHOLD_MS}ms requirement.`)
}

main()
