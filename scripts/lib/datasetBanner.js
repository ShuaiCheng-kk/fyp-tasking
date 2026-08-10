/**
 * scripts/lib/datasetBanner.js - Identifies WHICH dataset a perf run measured.
 *
 * The perf-test-module*.js scripts are the same scripts for both NFRs: run them against
 * owner@test.com and they measure the Performance Requirement (small seed dataset); run them
 * against scaleowner@test.com and they measure the Scalability Requirement (the 50-employee
 * upper-bound fixture from seed-scale-test.js). Nothing in the timing output itself says which
 * one happened, so a Scalability screenshot is otherwise indistinguishable from a Performance
 * one - the whole point of the Scalability evidence is that it was taken at the upper bound.
 *
 * This prints the real measured row counts (not just the account name, which proves nothing about
 * what is actually in the database) so the terminal screenshot is self-evidence.
 */

const { createClient } = require('@supabase/supabase-js')

let cachedBanner = null

function admin() {
  // Self-sufficient: several perf scripts talk only to the HTTP API and never load .env.local
  // themselves, so the banner cannot assume the env is already populated.
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    require('dotenv').config({ path: '.env.local' })
  }
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

async function countIn(db, table, companyId) {
  const { count, error } = await db.from(table).select('id', { count: 'exact', head: true }).eq('company_id', companyId)
  return error ? '?' : count
}

// Measures the dataset once, at the start of the run, and caches the rendered banner - it does not
// print. reprintDatasetBanner() below does the printing, immediately before each results block, so
// every screenshot carries the dataset identity. Measuring once rather than per-block keeps both
// blocks labelled with the same starting numbers even though a module's own setup adds rows as it
// runs.
//
// Employees is the number the Scalability Requirement is actually stated in terms of ("growing
// SMEs, up to 50 employees"), so it is broken out from the total headcount rather than buried in it.
async function printDatasetBanner(companyId, accountEmail) {
  const db = admin()
  const [{ data: company }, { data: users }] = await Promise.all([
    db.from('companies').select('name').eq('id', companyId).maybeSingle(),
    db.from('users').select('role').eq('company_id', companyId),
  ])
  const roles = (users ?? []).reduce((acc, u) => { acc[u.role] = (acc[u.role] ?? 0) + 1; return acc }, {})
  const employees = roles['Employee'] ?? 0
  const [departments, shifts, tasks, postings] = await Promise.all([
    countIn(db, 'departments', companyId),
    countIn(db, 'shifts', companyId),
    countIn(db, 'tasks', companyId),
    countIn(db, 'job_postings', companyId),
  ])

  // Labelled off the measured employee count, not the account name - the count is the thing that
  // actually makes it a scalability run.
  const isUpperBound = employees >= 50
  const label = isUpperBound
    ? 'SCALABILITY RUN - 50-employee upper bound'
    : 'PERFORMANCE RUN - small-scale baseline'
  const roleBreakdown = Object.entries(roles).sort().map(([r, n]) => `${n} ${r}`).join(', ')

  const line = '='.repeat(78)
  cachedBanner = [
    line,
    `  DATASET UNDER TEST: ${label}`,
    line,
    `  Company    : ${company?.name ?? '(unknown)'}  [${companyId}]`,
    `  Account    : ${accountEmail}`,
    `  Employees  : ${employees}`,
    `  Headcount  : ${(users ?? []).length}  (${roleBreakdown})`,
    `  Departments: ${departments}`,
    `  Shifts     : ${shifts}     Tasks: ${tasks}     Job postings: ${postings}`,
    line,
  ].join('\n')
}

// Re-prints the banner captured by printDatasetBanner. The single-request and concurrent result
// blocks are screenshotted separately as evidence, and a screenshot only proves which dataset was
// measured if the dataset identity is inside that same screenshot - so each block repeats it rather
// than relying on one banner at the top of the run. Re-prints from cache: no extra DB round trip,
// and the counts stay those measured at the start of the run rather than drifting mid-run.
function reprintDatasetBanner() {
  if (cachedBanner) console.log(cachedBanner + '\n')
}

module.exports = { printDatasetBanner, reprintDatasetBanner }
