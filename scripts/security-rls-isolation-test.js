/**
 * scripts/security-rls-isolation-test.js - Security NFR verification: database-level isolation
 *
 * Verifies the other half of the Security Requirement that scripts/security-auth-test.js can't
 * reach: even if the Next.js API layer were bypassed entirely (someone calling Supabase directly
 * with the public anon key, or a signed-in user's own JWT), Row Level Security must still stop
 * them from reading another company's data.
 *
 * Creates a second, throwaway company with one row in each RLS-protected table that matters for
 * multi-tenant isolation, signs in as a real user from a DIFFERENT company, and asserts every one
 * of those rows is unreadable - via a listing query (no filter) and a direct by-id lookup. Cleans
 * up the throwaway company afterward regardless of outcome.
 *
 * Usage:
 *   node scripts/security-rls-isolation-test.js
 *
 * Requires .env.local (NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY,
 * SUPABASE_SERVICE_ROLE_KEY) and the database seeded (node scripts/seed.js) so owner@test.com
 * exists as the "other company" test subject.
 */

require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
const PASSWORD = '111111'

function pad(str, len) {
  return String(str).padEnd(len)
}

async function buildFixtureCompany() {
  const { data: anyUser } = await admin.from('users').select('id').limit(1).single()
  const { data: company } = await admin.from('companies').insert({ name: 'RLS-Isolation-Fixture-Co', owner_id: anyUser.id, plan: 'Free' }).select().single()
  const { data: dept } = await admin.from('departments').insert({ company_id: company.id, name: 'Fixture Dept' }).select().single()
  const { data: task } = await admin.from('tasks').insert({ company_id: company.id, department_id: dept.id, title: 'SECRET', status: 'Assigned' }).select().single()
  const { data: announcement } = await admin.from('announcements').insert({ company_id: company.id, user_id: anyUser.id, title: 'SECRET', content: 'SECRET' }).select().single()
  const { data: shift } = await admin.from('shifts').insert({ company_id: company.id, department_id: dept.id, shift_date: '2026-01-01', start_time: '09:00', end_time: '17:00', created_by: anyUser.id }).select().single()
  return {
    company, dept, task, announcement, shift,
    async cleanup() {
      await admin.from('shifts').delete().eq('id', shift.id)
      await admin.from('announcements').delete().eq('id', announcement.id)
      await admin.from('tasks').delete().eq('id', task.id)
      await admin.from('departments').delete().eq('id', dept.id)
      await admin.from('companies').delete().eq('id', company.id)
    },
  }
}

async function main() {
  console.log('RLS cross-tenant isolation test\n')
  const results = []

  console.log('--- Building a throwaway "other company" with one secret row per table ---')
  const fixture = await buildFixtureCompany()
  console.log(`fixture company: ${fixture.company.id}\n`)

  try {
    console.log('--- 1. Fully anonymous (no session at all) ---')
    const anonTask = await anon.from('tasks').select('id').limit(5)
    const anonPass = (anonTask.data ?? []).length === 0
    results.push(['Anonymous key sees 0 rows in tasks', anonPass])

    console.log('--- 2. Signed in as owner@test.com (a different company) ---')
    const { data: authData, error: authErr } = await anon.auth.signInWithPassword({ email: 'owner@test.com', password: PASSWORD })
    if (authErr) throw new Error('signin failed: ' + authErr.message)
    const { data: ownerRow } = await anon.from('users').select('company_id').eq('supabase_auth_id', authData.user.id).single()
    const ownerCompanyId = ownerRow.company_id

    // Listing query, no filter - RLS alone must keep the fixture company's row out of the result.
    const taskList = await anon.from('tasks').select('id, company_id').limit(200)
    const leakedTasks = (taskList.data ?? []).filter(r => r.company_id === fixture.company.id)
    results.push(['Listing tasks with no filter leaks 0 rows from fixture company', leakedTasks.length === 0])

    // Direct by-id lookups - the stricter test, since a listing query could coincidentally miss
    // the row for unrelated reasons (pagination, ordering) even if RLS were broken.
    const directTask = await anon.from('tasks').select('id').eq('id', fixture.task.id).maybeSingle()
    results.push(['Direct by-id read of fixture task blocked', !directTask.data])

    const directAnnouncement = await anon.from('announcements').select('id').eq('id', fixture.announcement.id).maybeSingle()
    results.push(['Direct by-id read of fixture announcement blocked', !directAnnouncement.data])

    const directShift = await anon.from('shifts').select('id').eq('id', fixture.shift.id).maybeSingle()
    results.push(['Direct by-id read of fixture shift blocked', !directShift.data])

    const directCompany = await anon.from('companies').select('id').eq('id', fixture.company.id).maybeSingle()
    results.push(['Direct by-id read of fixture company row blocked', !directCompany.data])

    const directDept = await anon.from('departments').select('id').eq('id', fixture.dept.id).maybeSingle()
    results.push(['Direct by-id read of fixture department blocked', !directDept.data])

    // Positive control - the same signed-in user must still be able to read THEIR OWN company's
    // data, proving the policy scopes rather than blanket-denying everyone.
    const ownTasks = await anon.from('tasks').select('id, company_id').eq('company_id', ownerCompanyId).limit(1)
    results.push(['Owner can still read their own company\'s tasks (positive control)', (ownTasks.data ?? []).length > 0])

    console.log('--- 3. Service-role key (the app\'s own internal client) is unaffected by RLS ---')
    const adminRead = await admin.from('tasks').select('id').eq('id', fixture.task.id).maybeSingle()
    results.push(['service-role key can still read the fixture task (app itself unaffected)', !!adminRead.data])
  } finally {
    await fixture.cleanup()
    console.log('\n--- cleaned up fixture company ---\n')
  }

  let allPass = true
  for (const [label, pass] of results) {
    console.log(`${pad(label, 65)} ${pass ? 'PASS' : 'FAIL'}`)
    allPass = allPass && pass
  }

  console.log('')
  console.log(allPass
    ? 'RESULT: ALL PASS. RLS correctly isolates every table tested, with no impact on legitimate same-company access or the app\'s own service-role client.'
    : 'RESULT: FAIL. At least one isolation check did not hold.')
}

main()
