/**
 * scripts/security-cross-tenant-api-test.js - Security NFR verification: API-layer identity mismatch
 *
 * Verifies the other half of the API-layer Security Requirement that scripts/security-auth-test.js
 * can't reach: security-auth-test.js only proves a protected route rejects requests with NO session.
 * It says nothing about whether the route checks that the SESSION belongs to the company/user it's
 * being asked to act on. A route that checks "is someone logged in?" but not "is this the right
 * someone?" still passes security-auth-test.js while leaking data across tenants.
 *
 * This script creates a throwaway second company + a real Supabase Auth user in it, signs in as
 * that user through the actual /api/auth/signin route (a real session cookie, not a forged one),
 * and uses it to call a sample of company/user-scoped protected routes with ids belonging to
 * owner@test.com's (different) company. Every one of these must return 403, not 200/404 — a 404
 * would mean the route silently found nothing instead of recognizing the caller has no right to ask.
 *
 * Usage:
 *   npm run dev                                    # in one terminal
 *   node scripts/security-cross-tenant-api-test.js # in another terminal
 *
 * Requires .env.local (NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY,
 * SUPABASE_SERVICE_ROLE_KEY) and the database seeded (node scripts/seed.js) so owner@test.com's
 * company/task/job data exists as the "victim" resources.
 */

require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000'
const PASSWORD = '111111'
const FIXTURE_EMAIL = `cross-tenant-fixture-${Date.now()}@test.com`

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

function pad(str, len) {
  return String(str).padEnd(len)
}

async function buildFixtureIdentity() {
  const { data: authUser, error: authErr } = await admin.auth.admin.createUser({
    email: FIXTURE_EMAIL,
    password: PASSWORD,
    email_confirm: true,
  })
  if (authErr) throw new Error('failed to create fixture auth user: ' + authErr.message)

  // companies.owner_id is NOT NULL, so the user row has to exist before the company row does
  // (users.company_id is nullable, so the user can be created first with no company).
  const { data: user, error: userErr } = await admin.from('users')
    .insert({ supabase_auth_id: authUser.user.id, full_name: 'Fixture Intruder', email_address: FIXTURE_EMAIL, phone_number: '00000000', date_of_birth: '2000-01-01', profile_photo_url: 'https://placehold.co/64', role: 'Owner', company_id: null })
    .select().single()
  if (userErr) throw new Error('failed to create fixture user row: ' + userErr.message)
  const { data: company, error: companyErr } = await admin.from('companies').insert({ name: 'Cross-Tenant-Fixture-Co', owner_id: user.id, plan: 'Free' }).select().single()
  if (companyErr) throw new Error('failed to create fixture company: ' + companyErr.message)
  await admin.from('users').update({ company_id: company.id }).eq('id', user.id)

  return {
    authUserId: authUser.user.id,
    company, user,
    async cleanup() {
      await admin.from('companies').delete().eq('id', company.id)
      await admin.from('users').delete().eq('id', user.id)
      await admin.auth.admin.deleteUser(authUser.user.id)
    },
  }
}

async function signInForCookie(email) {
  const res = await fetch(`${BASE_URL}/api/auth/signin`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email_address: email, password: PASSWORD }),
  })
  const body = await res.json()
  if (!body.success) throw new Error(`Sign-in failed for ${email}: ${body.message}`)
  const cookie = res.headers.getSetCookie().map(c => c.split(';')[0]).join('; ')
  return { cookie, user: body.user }
}

async function getVictimIds() {
  const owner = await signInForCookie('owner@test.com')
  const [{ data: task }, { data: dept }, { data: job }, { data: shift }, { data: attendance }, { data: swaps }, { data: offDay }, { data: manager }] = await Promise.all([
    admin.from('tasks').select('id').eq('company_id', owner.user.company_id).limit(1).maybeSingle(),
    admin.from('departments').select('id').eq('company_id', owner.user.company_id).limit(1).maybeSingle(),
    admin.from('job_postings').select('id').eq('company_id', owner.user.company_id).limit(1).maybeSingle(),
    admin.from('shifts').select('id').eq('company_id', owner.user.company_id).limit(1).maybeSingle(),
    admin.from('attendance_records').select('id, shift_assignments!inner(shifts!inner(company_id))').eq('shift_assignments.shifts.company_id', owner.user.company_id).limit(1).maybeSingle(),
    // Not .limit(1) here: decideShiftSwapRequest only reaches the company check for a MANAGER's
    // own swap (an Employee's swap is decided by a Manager, not Owner/Partner, and fails on that
    // role check first) — pick the requester's role in JS below rather than trust row order.
    admin.from('shift_swap_requests').select('id, requester_id, status, counterpart_status').eq('company_id', owner.user.company_id).eq('status', 'pending').eq('counterpart_status', 'approved'),
    admin.from('off_day_requests').select('id').eq('company_id', owner.user.company_id).limit(1).maybeSingle(),
    admin.from('users').select('id').eq('company_id', owner.user.company_id).eq('role', 'Manager').limit(1).maybeSingle(),
  ])
  let swap = null
  if (swaps?.length) {
    const requesterIds = [...new Set(swaps.map(s => s.requester_id))]
    const { data: requesters } = await admin.from('users').select('id, role').in('id', requesterIds)
    const managerIds = new Set((requesters ?? []).filter(u => u.role === 'Manager').map(u => u.id))
    swap = swaps.find(s => managerIds.has(s.requester_id)) ?? null
  }
  return {
    companyId: owner.user.company_id, taskId: task?.id, deptId: dept?.id, jobId: job?.id,
    shiftId: shift?.id, attendanceId: attendance?.id, swapId: swap?.id, offDayId: offDay?.id,
    managerId: manager?.id, ownerUserId: owner.user.id,
  }
}

async function requestWithCookie(method, url, cookie, body) {
  const opts = { method, headers: { Cookie: cookie } }
  if (body !== undefined) {
    opts.headers['Content-Type'] = 'application/json'
    opts.body = JSON.stringify(body)
  }
  const res = await fetch(url, opts)
  return res.status
}

async function main() {
  console.log(`Cross-tenant API identity-mismatch sweep against ${BASE_URL}\n`)

  console.log('--- Building a throwaway "other company" + real auth user ---')
  const fixture = await buildFixtureIdentity()
  console.log(`fixture company: ${fixture.company.id}, fixture user: ${FIXTURE_EMAIL}\n`)

  try {
    const { cookie } = await signInForCookie(FIXTURE_EMAIL)
    const victim = await getVictimIds()
    console.log(`victim company (owner@test.com): ${victim.companyId}`)
    console.log('victim ids:', victim, '\n')

    // Each of these is called WITH a real, valid session (the fixture company's Owner) but
    // pointed at owner@test.com's company/resources. A correctly-scoped route must return 403
    // (recognizes the caller but denies the cross-tenant action), not 200 (leaked) or 404 (silently
    // pretends the resource doesn't exist, which would also pass a naive "not 200" check).
    const checks = [
      ['GET', `/api/task?company_id=${victim.companyId}`],
      // Not /api/company/current: it never honors an arbitrary company_id — it only lets the
      // caller pick among companies THEY already own/belong to, silently falling back to their
      // own default otherwise, so a mismatched company_id there is a no-op, not a leak.
      ['GET', `/api/company/owner?company_id=${victim.companyId}`],
      ['GET', `/api/company/departments?company_id=${victim.companyId}`],
      ['GET', `/api/team/members?company_id=${victim.companyId}`],
      ['GET', `/api/shift?company_id=${victim.companyId}&date_from=2026-01-01&date_to=2026-01-02`],
      ['GET', `/api/recruitment?company_id=${victim.companyId}`],
      ['GET', `/api/attendance?company_id=${victim.companyId}`],
      ['GET', `/api/report/company?company_id=${victim.companyId}&date_from=2026-01-01&date_to=2026-01-02`],
      ['PATCH', '/api/company/update-department', { department_id: victim.deptId, name: 'hijacked' }],
      ['DELETE', `/api/company/delete-department`, { department_id: victim.deptId }],
      ...(victim.jobId ? [
        ['GET', `/api/ai/candidates?job_id=${victim.jobId}`],
        ['GET', `/api/recruitment?resource=applicants&job_id=${victim.jobId}`],
      ] : []),
      ...(victim.taskId ? [
        ['PATCH', '/api/task', { id: victim.taskId, status: 'In Progress' }],
        ['GET', `/api/task?company_id=${victim.companyId}&suggestion=reassignment&task_id=${victim.taskId}`],
      ] : []),
      ...(victim.shiftId ? [
        ['PATCH', `/api/shift/${victim.shiftId}`, { status: 'inactive' }],
        ['POST', `/api/shift/${victim.shiftId}/duplicate`, { shift_date: '2027-01-01', start_time: '09:00', end_time: '17:00' }],
        ['POST', `/api/shift/${victim.shiftId}/recurrence`, { recurrence_rule: 'daily', recurrence_end_date: '2027-01-05' }],
        ['DELETE', `/api/shift/${victim.shiftId}`],
      ] : []),
      ...(victim.attendanceId ? [
        ['PATCH', '/api/attendance', { action: 'modify_times', id: victim.attendanceId, reason: 'hijack', clock_in_time: '2027-01-01T09:00:00.000Z' }],
      ] : []),
      ...(victim.swapId ? [
        ['PATCH', '/api/attendance', { action: 'decide_shift_swap', id: victim.swapId, decision: 'approved' }],
      ] : []),
      ...(victim.offDayId ? [
        ['PATCH', '/api/attendance', { action: 'decide_fixed_off_day', id: victim.offDayId, decision: 'approved' }],
      ] : []),
      ...(victim.jobId ? [
        ['PATCH', '/api/recruitment', { action: 'publish_draft', job_id: victim.jobId }],
        ['PATCH', '/api/recruitment', { action: 'delete_draft', job_id: victim.jobId }],
        ['PATCH', '/api/recruitment', { action: 'unarchive_posting', job_id: victim.jobId }],
        ['PATCH', '/api/recruitment', { action: 'approve_posting', job_id: victim.jobId }],
        ['PATCH', '/api/recruitment', { action: 'reject_posting', job_id: victim.jobId, rejection_reason: 'hijack' }],
        ['PATCH', '/api/recruitment', { action: 'duplicate_posting', job_id: victim.jobId }],
      ] : []),
      ...(victim.managerId ? [
        ['DELETE', '/api/team/department-manager', { manager_id: victim.managerId, department_id: victim.deptId }],
        ['DELETE', '/api/manager/departments', { manager_id: victim.managerId, department_id: victim.deptId }],
      ] : []),
      // Own real company_id passes the route's top-level check, but the recipient is in the
      // victim company — sendMessage's recipient-company check must still reject it.
      ...(victim.ownerUserId ? [
        ['POST', '/api/inbox/messages', { to_user_id: victim.ownerUserId, company_id: fixture.company.id, content: 'cross-tenant message' }],
      ] : []),
    ]

    let pass = 0
    const failures = []
    for (const [method, path, body] of checks) {
      const status = await requestWithCookie(method, `${BASE_URL}${path}`, cookie, body)
      const ok = status === 403
      if (ok) pass++
      else failures.push({ method, path, status })
      console.log(`  ${ok ? ' ' : '!'} ${pad(method, 7)} ${pad(path, 70)} got ${status}${ok ? '' : ', expected 403'}`)
    }

    // shift/bulk-edit is a different shape: the caller's OWN real company_id passes the route's
    // top-level check (as it must, for the request to reach the batch at all), so the per-item
    // cross-tenant rejection shows up as a 200 with that one item in result.failed, not a 4xx
    // status — doesn't fit the uniform "assert 403" loop above, so it's checked separately here.
    let totalChecks = checks.length
    if (victim.shiftId) {
      totalChecks++
      const res = await fetch(`${BASE_URL}/api/shift/bulk-edit`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Cookie: cookie },
        body: JSON.stringify({ company_id: fixture.company.id, items: [{ id: victim.shiftId, start_time: '08:00' }] }),
      })
      const json = await res.json().catch(() => null)
      const itemFailed = json?.result?.failed?.some(f => f.id === victim.shiftId)
      const itemUpdated = json?.result?.updated?.some(s => s.id === victim.shiftId)
      const ok = res.status === 200 && itemFailed && !itemUpdated
      if (ok) pass++
      else failures.push({ method: 'PATCH', path: '/api/shift/bulk-edit (own company_id, victim item id)', status: res.status })
      console.log(`  ${ok ? ' ' : '!'} ${pad('PATCH', 7)} ${pad('/api/shift/bulk-edit (own company_id, victim item id)', 70)} ${ok ? 'victim item correctly rejected per-item' : `got status ${res.status}, itemFailed=${itemFailed}, itemUpdated=${itemUpdated}`}`)
    }

    console.log(`\n${pass}/${totalChecks} cross-tenant calls correctly rejected\n`)
    console.log(failures.length === 0
      ? `RESULT: ALL PASS. A valid session for one company cannot act on another company's data through any of these ${totalChecks} routes.`
      : `RESULT: FAIL. ${failures.length} route(s) allowed a cross-tenant call through.`)
  } finally {
    await fixture.cleanup()
    console.log('\n--- cleaned up fixture company + fixture auth user ---')
  }
}

main()
