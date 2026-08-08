/**
 * scripts/seed-scale-test.js - Scalability NFR fixture
 *
 * Creates a throwaway company sized for the Scalability Requirement's upper bound ("growing SMEs,
 * up to 50 employees") - completely separate from scripts/seed.js's demo dataset, so it never
 * touches the fixed expected-data counts the manual test plan (docs/testing/) depends on.
 *
 * Builds: 1 Owner, 4 departments, 50 Employees, ~150 shifts (3 per employee across a 2-week
 * window), ~150 tasks (3 per employee), 1 Casual Worker with an immediately-clockable shift
 * (mirrors seed.js's own clock-in fixture, for the same clock-in perf measurement), and a
 * handful of job postings so Recruitment has real volume too.
 *
 * Usage:
 *   node scripts/seed-scale-test.js          # create the fixture
 *   node scripts/seed-scale-test.js --delete # tear it down again
 *
 * Login after creating: scaleowner@test.com / 111111
 */

const { createClient } = require('@supabase/supabase-js')

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  require('dotenv').config({ path: '.env.local' })
}
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } },
)

const PASSWORD = '111111'
const OWNER_EMAIL = 'scaleowner@test.com'
const EMPLOYEE_COUNT = 50
const DEPARTMENTS = ['Operations', 'Marketing', 'Engineering', 'Customer Support']

function dateKey(d) {
  return d.toISOString().slice(0, 10)
}
function addDays(d, n) {
  const next = new Date(d)
  next.setDate(next.getDate() + n)
  return next
}
function toHM(d) {
  const sgt = new Date(d.getTime() + 8 * 60 * 60 * 1000)
  return `${String(sgt.getUTCHours()).padStart(2, '0')}:${String(sgt.getUTCMinutes()).padStart(2, '0')}`
}
function dateKeySGT(d) {
  const sgt = new Date(d.getTime() + 8 * 60 * 60 * 1000)
  return `${sgt.getUTCFullYear()}-${String(sgt.getUTCMonth() + 1).padStart(2, '0')}-${String(sgt.getUTCDate()).padStart(2, '0')}`
}

async function deleteFixture() {
  console.log('Looking up existing scale-test company...')
  const { data: owner } = await supabase.from('users').select('id, company_id').eq('email_address', OWNER_EMAIL).maybeSingle()
  if (!owner || !owner.company_id) {
    console.log('No scale-test fixture found, nothing to delete.')
    return
  }
  const companyId = owner.company_id
  console.log(`Deleting scale-test company ${companyId} and everything in it...`)

  const { data: users } = await supabase.from('users').select('id, supabase_auth_id').eq('company_id', companyId)
  const userIds = (users ?? []).map(u => u.id)

  await supabase.from('task_assignments').delete().in('user_id', userIds)
  await supabase.from('tasks').delete().eq('company_id', companyId)
  await supabase.from('attendance_records').delete().in('user_id', userIds)
  const { data: shifts } = await supabase.from('shifts').select('id').eq('company_id', companyId)
  const shiftIds = (shifts ?? []).map(s => s.id)
  if (shiftIds.length) await supabase.from('shift_assignments').delete().in('shift_id', shiftIds)
  await supabase.from('shifts').delete().eq('company_id', companyId)
  await supabase.from('job_postings').delete().eq('company_id', companyId)
  await supabase.from('employee_departments').delete().eq('company_id', companyId)
  await supabase.from('casualworker_departments').delete().eq('company_id', companyId)
  await supabase.from('departments').delete().eq('company_id', companyId)
  await supabase.from('users').delete().eq('company_id', companyId)
  await supabase.from('companies').delete().eq('id', companyId)

  for (const u of users ?? []) {
    if (u.supabase_auth_id) await supabase.auth.admin.deleteUser(u.supabase_auth_id).catch(() => {})
  }
  console.log('Deleted.')
}

async function buildFixture() {
  console.log(`Creating scale-test company: 1 Owner + ${EMPLOYEE_COUNT} Employees across ${DEPARTMENTS.length} departments...\n`)

  const { data: ownerAuth, error: ownerAuthErr } = await supabase.auth.admin.createUser({
    email: OWNER_EMAIL, password: PASSWORD, email_confirm: true,
  })
  if (ownerAuthErr) { console.error('owner auth create failed:', ownerAuthErr.message); process.exit(1) }

  const { data: ownerUser, error: ownerUserErr } = await supabase.from('users').insert({
    supabase_auth_id: ownerAuth.user.id, full_name: 'Scale Test Owner', email_address: OWNER_EMAIL,
    phone_number: '+65 9500 0000', date_of_birth: '1980-01-01', profile_photo_url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=scaleowner', role: 'Owner', company_id: null,
  }).select().single()
  if (ownerUserErr) { console.error('owner user insert failed:', ownerUserErr.message); process.exit(1) }

  const { data: company, error: companyErr } = await supabase.from('companies').insert({
    name: 'Scale-Test-Co', owner_id: ownerUser.id, plan: 'Paid', size: '51-200',
  }).select().single()
  if (companyErr) { console.error('company insert failed:', companyErr.message); process.exit(1) }
  await supabase.from('users').update({ company_id: company.id }).eq('id', ownerUser.id)
  console.log(`Company: ${company.name} (${company.id})`)

  const deptRows = []
  for (const name of DEPARTMENTS) {
    const { data } = await supabase.from('departments').insert({ company_id: company.id, name }).select().single()
    deptRows.push(data)
  }
  console.log(`${deptRows.length} departments created`)

  console.log(`Creating ${EMPLOYEE_COUNT} employee accounts (this takes a while, one auth call each)...`)
  const employees = []
  for (let i = 0; i < EMPLOYEE_COUNT; i++) {
    const email = `scale-emp-${i + 1}@test.com`
    const { data: auth, error: authErr } = await supabase.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true })
    if (authErr) { console.warn(`  ! auth create failed for ${email}: ${authErr.message}`); continue }
    const dept = deptRows[i % deptRows.length]
    const { data: user, error: userErr } = await supabase.from('users').insert({
      supabase_auth_id: auth.user.id, full_name: `Scale Employee ${i + 1}`, email_address: email,
      phone_number: '+65 9500 ' + String(1000 + i), date_of_birth: '1995-01-01', profile_photo_url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=scaleemp' + i, role: 'Employee', company_id: company.id,
    }).select().single()
    if (userErr) { console.warn(`  ! user insert failed for ${email}: ${userErr.message}`); continue }
    await supabase.from('employee_departments').insert({ employee_id: user.id, department_id: dept.id, company_id: company.id })
    employees.push({ user, dept })
    if ((i + 1) % 10 === 0) console.log(`  ...${i + 1}/${EMPLOYEE_COUNT}`)
  }
  console.log(`${employees.length} employees created\n`)

  console.log('Creating shifts (3 per employee across a 2-week window) + tasks (3 per employee)...')
  const today = new Date()
  let shiftCount = 0, taskCount = 0
  for (const { user, dept } of employees) {
    for (let d = 0; d < 3; d++) {
      const shiftDate = dateKey(addDays(today, d * 4 - 3))
      const { data: shift, error: shiftErr } = await supabase.from('shifts').insert({
        company_id: company.id, department_id: dept.id, shift_date: shiftDate,
        start_time: '09:00', end_time: '17:00', created_by: ownerUser.id, publication_status: 'published',
      }).select().single()
      if (shiftErr) continue
      await supabase.from('shift_assignments').insert({ shift_id: shift.id, user_id: user.id, assigned_by: ownerUser.id })
      shiftCount++
    }
    for (let t = 0; t < 3; t++) {
      const { error: taskErr } = await supabase.from('tasks').insert({
        company_id: company.id, department_id: dept.id, title: `Scale test task ${t + 1} for ${user.full_name}`,
        assigned_user_id: user.id, assigned_by: ownerUser.id, status: 'Assigned', priority: 'Medium',
        due_at: addDays(today, t + 1).toISOString(), task_date: dateKey(addDays(today, t)),
      })
      if (!taskErr) taskCount++
    }
  }
  console.log(`${shiftCount} shifts, ${taskCount} tasks created\n`)

  console.log('Creating a Casual Worker with an immediately-clockable shift (for the clock-in benchmark)...')
  const { data: casualAuth } = await supabase.auth.admin.createUser({ email: 'scale-casual1@test.com', password: PASSWORD, email_confirm: true })
  const { data: casualUser } = await supabase.from('users').insert({
    supabase_auth_id: casualAuth.user.id, full_name: 'Scale Casual Worker', email_address: 'scale-casual1@test.com',
    phone_number: '+65 9500 9999', date_of_birth: '1998-01-01', profile_photo_url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=scalecasual', role: 'Casual Worker', company_id: null,
  }).select().single()
  const openStart = new Date(Date.now() - 10 * 60000)
  const openEnd = new Date(Date.now() + 4 * 60 * 60000)
  const { data: openShift } = await supabase.from('shifts').insert({
    company_id: company.id, department_id: deptRows[0].id, shift_date: dateKeySGT(openStart),
    start_time: toHM(openStart), end_time: toHM(openEnd), created_by: ownerUser.id,
    publication_status: 'published', is_open_ended: true,
  }).select().single()
  await supabase.from('shift_assignments').insert({
    shift_id: openShift.id, user_id: casualUser.id, assigned_by: ownerUser.id,
    supervisor_employee_id: employees[0]?.user.id ?? null,
  })
  console.log('Casual worker ready: scale-casual1@test.com\n')

  console.log('Creating a few job postings for Recruitment volume...')
  for (let i = 0; i < 5; i++) {
    await supabase.from('job_postings').insert({
      company_id: company.id, department_id: deptRows[i % deptRows.length].id, created_by: ownerUser.id,
      title: `Scale test posting ${i + 1}`, responsibilities: 'Scale test', status: 'open',
      job_type: 'shift', openings: 1, salary_amount: 15,
    })
  }

  console.log('\nDone. Login: ' + OWNER_EMAIL + ' / ' + PASSWORD)
  console.log('Company: ' + company.id)
}

const shouldDelete = process.argv.includes('--delete')
;(shouldDelete ? deleteFixture() : buildFixture()).catch(err => {
  console.error(err)
  process.exit(1)
})
