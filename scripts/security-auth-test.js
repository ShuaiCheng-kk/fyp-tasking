/**
 * scripts/security-auth-test.js - Security NFR verification: API-layer session enforcement
 *
 * Verifies the Security Requirement's "Role-Based Access Control enforced at the API layer"
 * claim: every route that should require a session rejects a request with no session, and every
 * route that is intentionally public still works without one.
 *
 * For each protected route this sends a request with a realistic, validly-shaped body/query
 * (using real ids from a throwaway signin so the request gets past basic field-presence checks)
 * but WITHOUT any session cookie, and asserts the response is 401. This is stricter than just
 * checking "does an empty request get rejected" - a route whose session check runs after its
 * own field-validation would pass that weaker test by accident (400 before ever reaching the
 * session check) without actually being protected.
 *
 * Usage:
 *   npm run dev                        # in one terminal
 *   node scripts/security-auth-test.js # in another terminal
 *
 * Requires the database to be seeded (node scripts/seed.js).
 */

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000'
const PASSWORD = '111111'

function pad(str, len) {
  return String(str).padEnd(len)
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
  return body.user
}

async function getFixtureIds() {
  const owner = await signIn('owner@test.com')
  const casual = await signIn('casual1@test.com')
  const deptRes = await fetch(`${BASE_URL}/api/company/departments?company_id=${owner.company_id}`, {
    // This one call is allowed a session, purely to discover a real department id to use as a
    // realistic fixture elsewhere - not part of the test itself.
  }).then(r => r.json()).catch(() => null)
  return {
    companyId: owner.company_id,
    ownerId: owner.id,
    ownerAuthId: owner.auth_id,
    casualId: casual.id,
    casualAuthId: casual.auth_id,
    deptId: deptRes?.departments?.[0]?.id || '00000000-0000-0000-0000-000000000001',
    fakeId: '00000000-0000-0000-0000-0000000000ff',
  }
}

async function noSessionRequest(method, url, body) {
  const opts = { method, headers: {} }
  if (body !== undefined) {
    opts.headers['Content-Type'] = 'application/json'
    opts.body = JSON.stringify(body)
  }
  const res = await fetch(url, opts)
  return res.status
}

async function main() {
  console.log(`Security auth sweep against ${BASE_URL}\n`)
  const ids = await getFixtureIds()
  const { companyId, ownerId, ownerAuthId, casualId, casualAuthId, deptId, fakeId } = ids

  // Every route believed to require a real session, with a realistically-shaped request (using
  // real fixture ids) so the request gets past field-presence validation before hitting the
  // session check. GET routes carry their params in the query string; everything else sends a
  // JSON body. All of these are called with NO cookie - a correctly-protected route returns 401
  // regardless of how well-formed the rest of the request is.
  const protectedRoutes = [
    // Module 8 Account
    ['GET', `/api/user/me?user_id=${ownerAuthId}`],
    ['GET', `/api/user/profile-summary?user_id=${ownerAuthId}`],
    ['PATCH', '/api/user/update-department', { user_id: ownerId, department_id: deptId, company_id: companyId }],
    ['PATCH', '/api/user/update-profile', { user_id: ownerAuthId, full_name: 'x' }],
    ['GET', `/api/company/current?user_id=${ownerAuthId}&company_id=${companyId}`],
    ['GET', `/api/company/by-owner?owner_id=${ownerAuthId}`],
    ['GET', `/api/company/my-companies?owner_id=${ownerAuthId}`],
    ['GET', `/api/company/owner?company_id=${companyId}`],
    ['PATCH', '/api/company/update-profile', { company_id: companyId, name: 'x' }],

    // Module 3 Team/Company
    ['GET', `/api/team/members?company_id=${companyId}`],
    ['GET', `/api/team/member-count?owner_id=${ownerAuthId}`],
    ['DELETE', '/api/team/remove-member', { company_id: companyId, user_id_to_remove: fakeId }],
    ['GET', `/api/team/casual-worker-certificates?user_id=${casualId}`],
    ['PATCH', '/api/team/casual-worker-status', { user_id: casualId, company_id: companyId, worker_status: 'active' }],
    ['GET', `/api/team/department-manager?company_id=${companyId}`],
    ['DELETE', '/api/team/department-manager', { manager_id: fakeId, department_id: deptId }],
    ['PATCH', '/api/team/department-manager', { company_id: companyId, department_id: deptId, manager_id: fakeId }],
    ['POST', '/api/invitation/generate', { company_id: companyId, role: 'Employee' }],
    ['POST', '/api/invitation/send-invite', { email: 'x@x.com', role: 'Employee', company_id: companyId }],
    ['POST', '/api/import/departments', { company_id: companyId, departments: ['x'] }],
    ['POST', '/api/import/members', { company_id: companyId, members: [] }],
    ['POST', '/api/company/create-department', { company_id: companyId, name: 'x' }],
    ['DELETE', '/api/company/delete-department', { department_id: deptId }],
    ['PATCH', '/api/company/update-department', { department_id: deptId, name: 'x' }],
    ['GET', `/api/company/departments?company_id=${companyId}`],
    ['GET', `/api/company/managers?company_id=${companyId}`],
    ['DELETE', '/api/company/delete', { company_id: companyId }],
    ['GET', `/api/manager/departments?manager_id=${fakeId}&company_id=${companyId}`],
    ['POST', '/api/manager/departments', { manager_id: fakeId, company_id: companyId, department_id: deptId }],
    ['DELETE', '/api/manager/departments', { manager_id: fakeId, department_id: deptId }],
    ['GET', `/api/manager/contacts?user_id=${ownerAuthId}`],
    ['GET', `/api/activity-log?company_id=${companyId}`],
    ['POST', '/api/activity-log', { company_id: companyId, action: 'x' }],

    // Module 1 Shift
    ['GET', `/api/shift?company_id=${companyId}&date_from=2026-01-01&date_to=2026-01-02`],
    ['POST', '/api/shift', { company_id: companyId, department_id: deptId, shift_date: '2026-01-01', start_time: '09:00', end_time: '17:00' }],
    ['PATCH', `/api/shift/${fakeId}`, { status: 'active' }],
    ['DELETE', `/api/shift/${fakeId}`],
    ['POST', `/api/shift/${fakeId}/duplicate`, { shift_date: '2026-01-01', start_time: '09:00', end_time: '17:00' }],
    ['POST', `/api/shift/${fakeId}/recurrence`, { recurrence_rule: 'daily', recurrence_end_date: '2026-01-05' }],
    ['POST', '/api/shift/bulk', { company_id: companyId, department_id: deptId, assignments: [] }],
    ['POST', '/api/shift/bulk-create', { company_id: companyId, items: [] }],
    ['PATCH', '/api/shift/bulk-edit', { company_id: companyId, items: [{ id: fakeId }] }],
    ['POST', '/api/shift/redo', { company_id: companyId }],
    ['POST', '/api/shift/undo', { company_id: companyId }],
    ['PATCH', '/api/shift/schedule', { company_id: companyId, date_from: '2026-01-01', date_to: '2026-01-02', publication_status: 'published' }],
    ['POST', '/api/shift/split', { company_id: companyId, department_id: deptId, shift_date: '2026-01-01', blocks: [{ start_time: '09:00', end_time: '12:00' }, { start_time: '13:00', end_time: '17:00' }] }],
    ['POST', `/api/shift/split/${fakeId}/recurrence`, { recurrence_rule: 'daily', recurrence_end_date: '2026-01-05' }],
    ['GET', `/api/shift-template?company_id=${companyId}`],
    ['POST', '/api/shift-template', { company_id: companyId, name: 'x', start_time: '09:00', end_time: '17:00' }],
    ['DELETE', `/api/shift-template/${fakeId}`],
    ['PATCH', `/api/shift-template/${fakeId}`, { name: 'x' }],
    ['DELETE', `/api/shift-assignment/${fakeId}`],
    ['GET', `/api/shifts/department-employees?company_id=${companyId}&department_id=${deptId}`],

    // Module 2 Task
    ['GET', `/api/task?company_id=${companyId}`],
    ['POST', '/api/task', { company_id: companyId, department_id: deptId, title: 'x' }],
    ['PATCH', '/api/task', { id: fakeId, status: 'Assigned' }],
    ['DELETE', `/api/task?id=${fakeId}`],
    ['GET', `/api/task-template?company_id=${companyId}`],
    ['POST', '/api/task-template', { company_id: companyId, title: 'x' }],
    ['DELETE', `/api/task-template/${fakeId}`],
    ['PATCH', `/api/task-template/${fakeId}`, { title: 'x' }],
    ['POST', '/api/ai/assign', { company_id: companyId, title: 'x', priority: 'High' }],
    ['POST', '/api/ai/shift-scheduling', { context: 'x', date_from: '2026-01-01', date_to: '2026-01-02' }],

    // Module 5 Attendance
    ['GET', `/api/attendance?company_id=${companyId}`],
    ['PATCH', '/api/attendance', { action: 'modify_times', id: fakeId }],
    ['POST', '/api/attendance', { action: 'submit_fixed_off_day', company_id: companyId, dates: ['2026-01-01'] }],
    ['GET', `/api/employee/attendance?user_id=${ownerAuthId}`],
    ['POST', '/api/employee/attendance', { user_id: ownerAuthId, action: 'clock_in', shift_assignment_id: fakeId }],
    ['GET', `/api/casual/attendance?user_id=${casualAuthId}`],
    ['POST', '/api/casual/attendance', { user_id: casualAuthId, shift_assignment_id: fakeId, action: 'clock_in' }],
    ['GET', `/api/attendance/off-day-settings?company_id=${companyId}&resource=my_quota&user_id=${ownerAuthId}`],
    ['POST', '/api/attendance/off-day-settings', { action: 'set_deadline', company_id: companyId, deadline_weekday: 1, deadline_time: '17:00' }],
    ['GET', `/api/attendance/shift-swap-settings?company_id=${companyId}&owner_id=${ownerAuthId}`],
    ['POST', '/api/attendance/shift-swap-settings', { action: 'set_settings', company_id: companyId, auto_approval_enabled: true, monthly_swap_limit: null, deadline_hours_before_shift: null, require_review_on_limit_exceeded: false, require_review_on_deadline_exceeded: false }],
    ['GET', `/api/attendance/shift-swap-department-settings?company_id=${companyId}&department_id=${deptId}&manager_id=${ownerAuthId}`],
    ['POST', '/api/attendance/shift-swap-department-settings', { action: 'set_settings', company_id: companyId, department_id: deptId, auto_approval_enabled: true, monthly_swap_limit: null, deadline_hours_before_shift: null, require_review_on_limit_exceeded: false, require_review_on_deadline_exceeded: false }],
    ['POST', '/api/attendance/ai-suggest', { request_type: 'fixed_off_day_queue', company_id: companyId }],
    ['GET', `/api/casual/dashboard?user_id=${casualAuthId}`],
    ['GET', `/api/casual/profile?user_id=${casualAuthId}`],
    ['PATCH', '/api/casual/profile', { user_id: casualAuthId, payment_method: 'bank', payment_account: 'x' }],
    ['POST', '/api/casual/shift-cancel', { user_id: casualAuthId, shift_id: fakeId }],
    ['GET', `/api/employee/dashboard?user_id=${ownerAuthId}`],
    ['POST', '/api/user/shift-swap-requests', { company_id: companyId, requester_assignment_id: fakeId, counterpart_id: fakeId, counterpart_assignment_id: fakeId }],

    // Module 4 Recruitment
    ['GET', `/api/recruitment?company_id=${companyId}`],
    ['POST', '/api/recruitment', { company_id: companyId, title: 'x', responsibilities: 'x' }],
    ['PATCH', '/api/recruitment', { action: 'delete_draft', job_id: fakeId }],
    ['GET', `/api/job-template?company_id=${companyId}`],
    ['POST', '/api/job-template', { company_id: companyId, title: 'x' }],
    ['DELETE', `/api/job-template/${fakeId}`],
    ['PATCH', `/api/job-template/${fakeId}`, { title: 'x' }],
    ['GET', `/api/job-template/${fakeId}/usage`],
    ['GET', `/api/ai/candidates?job_id=${fakeId}`],
    ['POST', '/api/ai/job-description', { title: 'x' }],
    ['GET', `/api/report/recruitment?company_id=${companyId}&date_from=2026-01-01&date_to=2026-01-02`],
    ['PATCH', '/api/guest/profile/skills', { user_id: casualAuthId, skills: 'x' }],
    ['DELETE', `/api/guest/profile/resume?user_id=${casualAuthId}`],
    ['DELETE', `/api/guest/profile/certificates?user_id=${casualAuthId}&certificate_id=${fakeId}`],
    ['POST', '/api/guest/applications', { job_id: fakeId, user_id: casualAuthId }],
    ['GET', `/api/guest/applications?user_id=${casualAuthId}`],
    ['PATCH', `/api/guest/applications/${fakeId}/respond`, { invitation_id: fakeId, response: 'accepted' }],
    ['PATCH', `/api/guest/applications/${fakeId}/withdraw`],
    ['GET', `/api/guest/profile?user_id=${casualAuthId}`],
    ['PATCH', `/api/guest/profile?user_id=${casualAuthId}`, {}],

    // Module 6 Communication
    ['GET', `/api/inbox/announcements?company_id=${companyId}`],
    ['POST', '/api/inbox/announcements', { company_id: companyId, title: 'x', content: 'x' }],
    ['DELETE', '/api/inbox/announcements', { announcement_id: fakeId }],
    ['PATCH', '/api/inbox/announcements', { announcement_id: fakeId, title: 'x', content: 'x' }],
    ['GET', `/api/inbox/announcements/read?user_id=${ownerAuthId}&company_id=${companyId}`],
    ['POST', '/api/inbox/announcements/read', { user_id: ownerAuthId, announcement_ids: [] }],
    ['GET', `/api/inbox/messages?user_id=${ownerAuthId}`],
    ['POST', '/api/inbox/messages', { to_user_id: fakeId, company_id: companyId, content: 'x' }],
    ['GET', `/api/inbox/messages/${fakeId}?user_id=${ownerAuthId}`],
    ['PATCH', `/api/inbox/messages/${fakeId}`, { user_id: ownerAuthId }],
    ['DELETE', `/api/inbox/messages/${fakeId}?user_id=${ownerAuthId}`],
    ['GET', `/api/inbox/unread-count?user_id=${ownerAuthId}`],
    ['GET', `/api/employee/announcements?user_id=${ownerAuthId}`],
    ['GET', `/api/employee/contacts?user_id=${ownerAuthId}`],
    ['GET', `/api/employee/team?user_id=${ownerAuthId}`],
    ['GET', `/api/employee/inbox?user_id=${ownerAuthId}`],
    ['GET', `/api/casual/messages?user_id=${casualAuthId}&other_user_id=${fakeId}`],
    ['POST', '/api/casual/messages', { user_id: casualAuthId, other_user_id: fakeId, company_id: companyId, content: 'x' }],

    // Module 7 Report
    ['GET', `/api/report/company?company_id=${companyId}&date_from=2026-01-01&date_to=2026-01-02`],
    ['GET', `/api/ai/anomalies?company_id=${companyId}&date_from=2026-01-01&date_to=2026-01-02`],

    // Module 9 Marketing CMS
    ['GET', '/api/marketingadmin/pages'],
    ['PUT', '/api/marketingadmin/pages', { updates: [] }],
    ['PATCH', '/api/marketingadmin/pages', { block_id: fakeId, value: 'x' }],
    ['POST', '/api/marketingadmin/blocks', { page_id: fakeId, block_key: 'x', block_type: 'text', label: 'x' }],
    ['DELETE', `/api/marketingadmin/blocks?id=${fakeId}`],

    // Module 10 User/Company Admin
    ['GET', '/api/useradmin/companies'],
    ['GET', `/api/useradmin/companies/${fakeId}`],
    ['GET', '/api/useradmin/reports'],
    ['GET', '/api/useradmin/users'],
    ['POST', '/api/useradmin/suspend', { action: 'suspend_company', company_id: companyId, reason: 'x' }],

    // Billing / misc
    ['GET', `/api/owner/dashboard?company_id=${companyId}&owner_id=${ownerAuthId}`],
    ['GET', `/api/owner/scheduling-rules?company_id=${companyId}`],
    ['PATCH', '/api/owner/scheduling-rules', { company_id: companyId, rule_key: 'x', value: 'x' }],
    ['POST', '/api/owner/scheduling-rules/validate', { company_id: companyId, date_from: '2026-01-01', date_to: '2026-01-02' }],
    ['GET', `/api/owner/scheduling-rules/context?company_id=${companyId}&date_from=2026-01-01&date_to=2026-01-02`],
    ['POST', '/api/owner/scheduling-rules/generate', { company_id: companyId, date_from: '2026-01-01', date_to: '2026-01-02', department_ids: [deptId], shift_types: [{ start_time: '09:00', end_time: '17:00' }] }],
    ['POST', '/api/owner/complete-company-setup', { user_id: ownerAuthId, company_name: 'x', phone_number: 'x', date_of_birth: '2000-01-01', profile_photo_url: 'x' }],
    ['POST', '/api/company/setup', { owner_id: ownerAuthId, name: 'x', plan: 'Free' }],
    ['POST', '/api/company/create-additional', { owner_id: ownerAuthId, name: 'x' }],
    ['POST', '/api/company/update-plan', { company_id: companyId, plan: 'Paid' }],
    ['POST', '/api/stripe/create-checkout-session', { companyId, email: 'x@x.com' }],
    ['GET', `/api/stripe/subscription?companyId=${companyId}`],
    ['POST', '/api/stripe/cancel-subscription', { companyId }],
    ['POST', '/api/stripe/resume-subscription', { companyId }],
    ['POST', '/api/stripe/upgrade-checkout', { companyId, email: 'x@x.com' }],
  ]

  // Deliberately public routes (pre-auth flows, public pages, webhooks, cron) - these must NOT
  // return 401 with no session. A 400 (missing optional param) or 200/404/500 downstream is fine;
  // only 401 fails this check.
  const publicRoutes = [
    ['POST', '/api/auth/check-email', { email: 'x@x.com' }],
    ['POST', '/api/auth/check-phone', { phone_number: 'x' }],
    ['POST', '/api/auth/forgot-password', { email: 'x@x.com' }],
    ['POST', '/api/auth/register-owner', {}],
    ['POST', '/api/auth/register-guest', {}],
    ['POST', '/api/auth/resend-confirmation', { email: 'x@x.com' }],
    ['GET', `/api/auth/check-verified?email=x@x.com`],
    ['GET', `/api/job-board`],
    ['GET', `/api/jobs/public`],
    ['GET', `/api/jobs/public/filters`],
    ['GET', `/api/guest/jobs/${fakeId}`],
    ['GET', `/api/marketing/pages`],
    ['GET', '/api/health'],
  ]

  console.log('--- Protected routes: expect 401 with no session ---')
  let protectedPass = 0
  const protectedFailures = []
  for (const [method, path, body] of protectedRoutes) {
    const status = await noSessionRequest(method, `${BASE_URL}${path}`, body)
    const pass = status === 401
    if (pass) protectedPass++
    else protectedFailures.push({ method, path, status })
    if (!pass) console.log(`  ! ${pad(method, 7)} ${pad(path, 70)} got ${status}, expected 401`)
  }
  console.log(`${protectedPass}/${protectedRoutes.length} protected routes correctly rejected an unauthenticated request\n`)

  console.log('--- Public routes: must NOT return 401 with no session ---')
  let publicPass = 0
  const publicFailures = []
  for (const [method, path, body] of publicRoutes) {
    const status = await noSessionRequest(method, `${BASE_URL}${path}`, body)
    const pass = status !== 401
    if (pass) publicPass++
    else publicFailures.push({ method, path, status })
    if (!pass) console.log(`  ! ${pad(method, 7)} ${pad(path, 70)} got 401, should be reachable without a session`)
  }
  console.log(`${publicPass}/${publicRoutes.length} public routes remained reachable without a session\n`)

  const allPass = protectedFailures.length === 0 && publicFailures.length === 0
  console.log(allPass
    ? `RESULT: ALL PASS. ${protectedRoutes.length} protected routes reject unauthenticated requests; ${publicRoutes.length} public routes remain open.`
    : `RESULT: FAIL. ${protectedFailures.length} protected route(s) not enforcing auth, ${publicFailures.length} public route(s) unexpectedly blocked.`)
}

main()
