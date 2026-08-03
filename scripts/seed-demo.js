/**
 * scripts/seed-demo.js — Tasking DEMO / User-Manual seed script
 *
 * Independent of scripts/seed.js (the testing-phase seed) and scripts/reset.js. This script
 * exists for a different purpose: producing a dataset that looks like a real SME actually used
 * the product, so every role's every page has full, realistic content for a live demo and for
 * User Manual screenshots — not a minimal fixture aimed at one feature under test.
 *
 * Primary company: "Sunrise Hospitality Group" — Owner on the Paid plan, 4 departments, each
 * with 3 Managers + 3 Employees + 5 Casual Workers, plus 2 Partners. 9 Guest Users cover every
 * recruitment-application end-state (2 of them get promoted to Casual Worker mid-script, exactly
 * like a real accepted job offer would).
 *
 * Two small secondary companies exist purely so the User Admin (Module 10) pages have real
 * cross-company data: "Bright Leaf Cafe" (Free plan, one user suspended) and "Coastal Logistics
 * Pte Ltd" (Free plan, the whole company suspended).
 *
 * Marketing CMS content (marketing_pages/content_blocks/reviews) is intentionally left empty —
 * out of scope this round (see BUG-007).
 *
 * All dates are computed relative to real "now" at run time (reuses the SGT-aware date helpers
 * proven in scripts/seed.js), so re-running this right before a demo always looks current.
 *
 * Usage: node scripts/seed-demo.js
 */

const { createClient } = require('@supabase/supabase-js')

// ─── Config ─────────────────────────────────────────────────────────────────

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
  || 'https://qnpwuipwyidslxndgewg.supabase.co'

const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_SERVICE_ROLE_KEY environment variable. Set it before running this script.')
  process.exit(1)
}

const PASSWORD = '111111'

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const DEMO_PHOTO_URL = 'https://api.dicebear.com/7.x/avataaars/svg?seed=tasking'

// ─── Date helpers (SGT-aware, same convention as scripts/seed.js) ──────────

function dateKey(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}
function addDays(d, n) {
  const next = new Date(d)
  next.setDate(next.getDate() + n)
  return next
}
function mondayOf(d) {
  const day = d.getDay()
  return addDays(d, day === 0 ? -6 : 1 - day)
}
function nextWeekday(from, targetDow) {
  const diff = (targetDow - from.getDay() + 7) % 7 || 7
  return addDays(from, diff)
}
const TODAY = new Date()
TODAY.setHours(0, 0, 0, 0)
const NEXT_MON = nextWeekday(TODAY, 1)

// shifts.shift_date/start_time/end_time are Singapore-nominal wall-clock values (see
// src/lib/singaporeTime.ts) — the app parses them with a fixed +08:00 offset, not literal UTC.
function dateKeySGT(d) {
  const sgt = new Date(d.getTime() + 8 * 60 * 60 * 1000)
  const y = sgt.getUTCFullYear()
  const m = String(sgt.getUTCMonth() + 1).padStart(2, '0')
  const day = String(sgt.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}
function toHM(d) {
  const sgt = new Date(d.getTime() + 8 * 60 * 60 * 1000)
  return `${String(sgt.getUTCHours()).padStart(2, '0')}:${String(sgt.getUTCMinutes()).padStart(2, '0')}`
}
function sgtInstantISO(dateStr, hm) {
  return new Date(`${dateStr}T${hm}:00.000+08:00`).toISOString()
}
// tasks.due_at / completed_at are read back via LOCAL wall-clock getters (unlike shift times).
function localInstantOn(dateObj, hour, minute = 0) {
  const d = new Date(dateObj)
  d.setHours(hour, minute, 0, 0)
  return d.toISOString()
}
function isWeekday(d) {
  const dow = d.getDay()
  return dow !== 0 && dow !== 6
}
function minutesAgo(n) { return new Date(Date.now() - n * 60 * 1000).toISOString() }
function daysAgoISO(n) { return new Date(Date.now() - n * 24 * 60 * 60 * 1000).toISOString() }
function daysFromNowISO(n) { return new Date(Date.now() + n * 24 * 60 * 60 * 1000).toISOString() }
function pick(arr, i) { return arr[i % arr.length] }
function rand(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min }

// ─── Generic insert helpers ─────────────────────────────────────────────────

async function insertOne(table, row, label) {
  const { data, error } = await supabase.from(table).insert(row).select().single()
  if (error) { console.warn(`  ⚠ insert ${table} failed (${label ?? ''}): ${error.message}`); return null }
  return data
}
async function insertMany(table, rows, label) {
  if (!rows.length) return []
  const { data, error } = await supabase.from(table).insert(rows).select()
  if (error) { console.warn(`  ⚠ bulk insert ${table} failed (${label ?? ''}): ${error.message}`); return [] }
  return data
}
async function upsertOne(table, row, onConflict, label) {
  const { data, error } = await supabase.from(table).upsert(row, { onConflict }).select().single()
  if (error) { console.warn(`  ⚠ upsert ${table} failed (${label ?? ''}): ${error.message}`); return null }
  return data
}

// ─── Company / department / account roster ──────────────────────────────────

const DEPT_DEFS = [
  { key: 'ops', name: 'Operations', color: '#3B82F6' },
  { key: 'mkt', name: 'Marketing', color: '#EC4899' },
  { key: 'eng', name: 'Engineering', color: '#10B981' },
  { key: 'cs', name: 'Customer Support', color: '#F59E0B' },
]

// index within each dept: 0 = veteran, 1 = pendingRequests, 2 = recruitmentSubmitter
const MANAGER_NAMES = [
  ['David Lim', 'Wendy Ho', 'Melissa Goh'],
  ['Rachel Koh', 'Kelvin Ang', 'Jonathan Teo'],
  ['Aaron Wong', 'Natalie Goh', 'Priya Shankar'],
  ['Fiona Chen', 'Samuel Ng', 'Marcus Chia'],
]
const MANAGER_TAGS = ['veteran', 'pendingRequests', 'recruitmentSubmitter']

// index within each dept: 0 = normal, 1 = pendingRequests, 2 = taskHeavy
const EMPLOYEE_NAMES = [
  ['Ben Seah', 'Grace Lim', 'Nurul Huda'],
  ['Chloe Yeo', 'Hannah Lee', 'Kevin Sim'],
  ['Daniel Tay', 'Ivan Koh', 'Sherlyn Ho'],
  ['Elaine Chua', 'Sophia Tan', 'Tariq Rahman'],
]
const EMPLOYEE_TAGS = ['normal', 'pendingRequests', 'taskHeavy']

const CW_NAMES = [
  ['Marcus Lee', 'Farah Aziz', 'Wei Ming Tan', 'Siti Rahman', 'Joel Fernandez'],
  ['Aisha Rahim', 'Brandon Koh', 'Cheryl Ong', 'Daryl Sim', 'Eunice Tan'],
  ['Faizal Rashid', 'Gwen Lau', 'Harith Zulkifli', 'Isabelle Ng', 'Jaslyn Wee'],
  ['Kenny Loh', 'Lydia Poh', 'Muhammad Firdaus', 'Nadia Yusof', 'Oscar Tan'],
]
// liveOnBreak / liveOpenEnded / liveReleased / liveAwaitingRelease = today's "clockable right
// now" demo states (one per department, all different). crossDept = also verified in another
// dept. inactive = banned in this company. correctedAttendance = has a Manager-modified record.
const CW_TAGS = [
  ['liveOnBreak', 'crossDept', 'normal', 'normal', 'correctedAttendance'],
  ['liveOpenEnded', 'normal', 'normal', 'inactive', 'normal'],
  ['liveReleased', 'normal', 'normal', 'normal', 'normal'],
  ['liveAwaitingRelease', 'normal', 'normal', 'inactive', 'normal'],
]

const CW_SKILLS = [
  'Forklift operation, Inventory management, Heavy lifting',
  'Customer service, Cash handling, POS systems',
  'Event setup, Sound equipment, Stage rigging',
  'Photography, Social media content, Retail merchandising',
  'F&B service, Barista skills, Food handling',
]
const CW_PAYMENT_METHODS = ['PayNow', 'Bank Transfer']

// Per-person shift pattern, keyed by the person's tag-index (0/1/2 — the same index that already
// picks their MANAGER_TAGS/EMPLOYEE_TAGS narrative role), so "the veteran Manager" is always the
// day-shift person, "pendingRequests" is always early, "taskHeavy"/"recruitmentSubmitter" is
// always late — consistent identity across the whole roster instead of one shared uniform block.
const SHIFT_PATTERNS = [
  { start: '09:00', end: '17:00', label: 'day' },
  { start: '06:00', end: '14:00', label: 'early' },
  { start: '14:00', end: '22:00', label: 'late' },
]
// Day-shift people cover Mon-Sat, early covers Mon-Fri, late covers Tue-Sat — every department
// has weekend coverage from at least one of its three Managers/Employees, and Sunday is the one
// common rest day for everyone (rather than a blanket Sat+Sun gap for the whole roster).
function isWorkingDayFor(patternIdx, d) {
  const dow = d.getDay() // 0=Sun..6=Sat
  if (dow === 0) return false
  if (patternIdx === 0) return true
  if (patternIdx === 1) return dow >= 1 && dow <= 5
  return dow >= 2 && dow <= 6
}

const GUESTS = [
  { email: 'guest1@test.com', full_name: 'Wei Jie Lim', phone: '+65 8200 2001', dob: '2000-01-15',
    skills: 'Forklift operation, Inventory management, Heavy lifting', tag: 'pending' },
  { email: 'guest2@test.com', full_name: 'Priyanka Das', phone: '+65 8200 2002', dob: '1999-05-22',
    skills: 'Customer service, Social media content, Copywriting', tag: 'awaitingConfirmation' },
  { email: 'guest3@test.com', full_name: 'Kai Xuan Ong', phone: '+65 8200 2003', dob: '2001-09-10',
    skills: 'Event setup, Sound equipment, Stage rigging', tag: 'confirmedOps' },
  { email: 'guest4@test.com', full_name: 'Amirah Yusof', phone: '+65 8200 2004', dob: '1998-12-03',
    skills: 'Photography, Canva, Retail merchandising', tag: 'declined' },
  { email: 'guest5@test.com', full_name: 'Ryan Teo', phone: '+65 8200 2005', dob: '2002-03-28',
    skills: 'PC hardware, Networking basics, Troubleshooting', tag: 'withdrawn' },
  { email: 'guest6@test.com', full_name: 'Charmaine Goh', phone: '+65 8200 2006', dob: '2000-06-18',
    skills: 'Customer service, Complaint handling, CRM tools', tag: 'jobClosed' },
  { email: 'guest7@test.com', full_name: 'Zulfadli Hassan', phone: '+65 8200 2007', dob: '1997-08-25',
    skills: 'Graphic design, Adobe Illustrator, Copywriting', tag: 'rejected' },
  { email: 'guest8@test.com', full_name: 'Michelle Ang', phone: '+65 8200 2008', dob: '1999-02-14',
    skills: 'Event hosting, Public speaking, Mandarin-English translation', tag: 'browsingOnly' },
  { email: 'guest9@test.com', full_name: 'Adrian Foo', phone: '+65 8200 2009', dob: '2001-11-30',
    skills: 'Technical support, Hardware troubleshooting, Documentation', tag: 'confirmedEng' },
]

const platformAdmins = [
  { email: 'madmin@tasking.com', full_name: 'Marketing Admin', role: 'Marketing Admin' },
  { email: 'uadmin@tasking.com', full_name: 'User Admin', role: 'User Admin' },
]

// ─── Wipe list (all emails this script ever creates, so reruns are idempotent) ──

function buildAllDemoEmails() {
  const emails = ['owner@test.com', 'partner1@test.com', 'partner2@test.com']
  for (let i = 1; i <= 12; i++) emails.push(`manager${i}@test.com`, `employee${i}@test.com`)
  for (let i = 1; i <= 20; i++) emails.push(`casual${i}@test.com`)
  for (const g of GUESTS) emails.push(g.email)
  emails.push(
    'ownerb@test.com', 'managerb1@test.com', 'employeeb1@test.com', 'employeeb2@test.com', 'casualb1@test.com', 'casualb2@test.com',
    'ownerc@test.com', 'managerc1@test.com', 'employeec1@test.com', 'employeec2@test.com', 'casualc1@test.com', 'casualc2@test.com',
  )
  return emails
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════════

async function main() {
  console.log('═══════════════════════════════════════════')
  console.log('  Tasking Demo Seed Script')
  console.log('═══════════════════════════════════════════\n')

  const allDemoEmails = buildAllDemoEmails()

  // ── Step 1: wipe business data tables ─────────────────────────────────────
  console.log('Step 1: clearing business data tables...')
  const tablesToClear = [
    'announcement_reads',
    'attendance_records',
    'shift_action_history',
    'shift_swap_requests',
    'shift_assignments',
    'shifts',
    'shift_templates',
    'task_assignments',
    'task_templates',
    'tasks',
    'messages',
    'announcements',
    'job_invitations',
    'job_cancellations',
    'job_applicants',
    'job_postings',
    'job_templates',
    'off_day_requests',
    'off_day_quota_settings',
    'user_certificates',
    'manager_departments',
    'employee_departments',
    'casualworker_departments',
    'company_activity_logs',
  ]
  for (const table of tablesToClear) {
    const { error } = await supabase.from(table).delete().neq('id', '00000000-0000-0000-0000-000000000000')
    if (error) console.warn(`  ⚠ clear ${table} failed: ${error.message}`)
  }
  await supabase.from('task_delay_alert_reads').delete().neq('task_id', '00000000-0000-0000-0000-000000000000')
  await supabase.from('invitation_code').delete().neq('code', '')
  await supabase.from('off_day_submission_deadline').delete().neq('company_id', '00000000-0000-0000-0000-000000000000')
  await supabase.from('task_delay_alert_settings').delete().neq('company_id', '00000000-0000-0000-0000-000000000000')
  await supabase.from('shift_swap_settings').delete().neq('company_id', '00000000-0000-0000-0000-000000000000')
  await supabase.from('shift_swap_department_settings').delete().neq('company_id', '00000000-0000-0000-0000-000000000000')
  await supabase.from('casual_worker_profiles').delete().neq('user_id', '00000000-0000-0000-0000-000000000000')
  const { error: uErr } = await supabase.from('users').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    .not('role', 'in', '("User Admin","Marketing Admin")')
  if (uErr) console.warn(`  ⚠ clear users failed: ${uErr.message}`)
  await supabase.from('departments').delete().neq('id', '00000000-0000-0000-0000-000000000000')
  await supabase.from('companies').delete().neq('id', '00000000-0000-0000-0000-000000000000')
  console.log('  ✓ business tables cleared\n')

  // ── Step 2: delete old auth accounts (this script's own + any stray test garbage) ──
  console.log('Step 2: clearing old auth accounts...')
  const allAuthUsers = []
  for (let page = 1; ; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 })
    if (error) { console.warn(`  ⚠ listUsers page ${page} failed: ${error.message}`); break }
    allAuthUsers.push(...(data?.users ?? []))
    if (!data?.users?.length || data.users.length < 1000) break
  }
  const emailSet = new Set(allDemoEmails)
  for (const u of allAuthUsers) {
    if (emailSet.has(u.email) || (u.email || '').endsWith('@tasking-tests.local')) {
      await supabase.auth.admin.deleteUser(u.id)
    }
  }
  console.log(`  ✓ cleared (${allAuthUsers.length} auth users scanned)\n`)

  // ── Step 2b: ensure platform admins exist ──────────────────────────────────
  console.log('Step 2b: ensuring platform admin accounts exist...')
  for (const [i, admin] of platformAdmins.entries()) {
    let authId = allAuthUsers.find(u => u.email === admin.email)?.id
    if (!authId) {
      const { data, error } = await supabase.auth.admin.createUser({ email: admin.email, password: PASSWORD, email_confirm: true })
      if (error || !data.user) { console.error(`  ✗ auth create failed ${admin.email}: ${error?.message}`); process.exit(1) }
      authId = data.user.id
    }
    const { data: existing } = await supabase.from('users').select('id').eq('email_address', admin.email).maybeSingle()
    if (!existing) {
      await supabase.from('users').insert({
        supabase_auth_id: authId, full_name: admin.full_name, email_address: admin.email,
        phone_number: `+65 9000 000${i}`, date_of_birth: '1990-01-01', profile_photo_url: DEMO_PHOTO_URL,
        role: admin.role, company_id: null,
      })
    }
  }
  console.log('  ✓ platform admins ready\n')

  const userMap = {} // email -> { authId, id }

  async function createAccount({ email, full_name, role, phone, dob, company_id = null }) {
    const { data: authData, error: authErr } = await supabase.auth.admin.createUser({
      email, password: PASSWORD, email_confirm: true,
    })
    if (authErr || !authData.user) { console.error(`  ✗ auth create failed ${email}: ${authErr?.message}`); process.exit(1) }
    const { data: userRow, error: userErr } = await supabase.from('users').insert({
      supabase_auth_id: authData.user.id, full_name, email_address: email, phone_number: phone,
      date_of_birth: dob, profile_photo_url: DEMO_PHOTO_URL, role, company_id,
    }).select().single()
    if (userErr) { console.error(`  ✗ users insert failed ${email}: ${userErr.message}`); process.exit(1) }
    userMap[email] = { authId: authData.user.id, id: userRow.id }
    return userRow
  }

  // ── Step 3: primary company + departments ──────────────────────────────────
  console.log('Step 3: creating primary company...')
  const ownerRow = await createAccount({
    email: 'owner@test.com', full_name: 'Sarah Mitchell', role: 'Owner',
    phone: '+65 9123 4567', dob: '1980-03-15',
  })
  const { data: company, error: compErr } = await supabase.from('companies').insert({
    name: 'Sunrise Hospitality Group',
    owner_id: ownerRow.id,
    description: 'A full-service hospitality and events staffing company serving corporate and retail clients across Singapore, running scheduling, task allocation, recruitment and attendance for four departments.',
    location: 'Raffles Place',
    address: '1 Raffles Place, Singapore 048616',
    postal_code: '048616',
    industry: 'Hospitality',
    size: '51-200',
    plan: 'Paid',
    plan_started_at: daysAgoISO(90),
    plan_next_billing_at: daysFromNowISO(15),
    stripe_customer_id: 'cus_demo_sunrise01',
    stripe_subscription_id: 'sub_demo_sunrise01',
  }).select().single()
  if (compErr) { console.error('  ✗ create company failed:', compErr.message); process.exit(1) }
  await supabase.from('users').update({ company_id: company.id }).eq('id', ownerRow.id)
  console.log(`  ✓ ${company.name} (${company.id})`)

  const depts = []
  for (const def of DEPT_DEFS) {
    const dept = await insertOne('departments', { name: def.name, color: def.color, company_id: company.id }, def.name)
    depts.push(dept)
    console.log(`  ✓ Department: ${dept.name}`)
  }

  console.log('\nStep 4: creating Partners...')
  await createAccount({ email: 'partner1@test.com', full_name: 'James Tan', role: 'Partner', phone: '+65 9234 5678', dob: '1982-07-22', company_id: company.id })
  await createAccount({ email: 'partner2@test.com', full_name: 'Michelle Wong', role: 'Partner', phone: '+65 9245 6789', dob: '1984-11-09', company_id: company.id })
  console.log('  ✓ 2 Partners created')

  console.log('\nStep 5: creating Managers, Employees, Casual Workers...')
  const managers = [] // flat list of { userRow, deptIdx, tag }
  const employees = []
  const casuals = []
  for (let d = 0; d < 4; d++) {
    for (let i = 0; i < 3; i++) {
      const idx = d * 3 + i + 1
      const row = await createAccount({
        email: `manager${idx}@test.com`, full_name: MANAGER_NAMES[d][i], role: 'Manager',
        phone: `+65 94${String(idx).padStart(2, '0')} ${1000 + idx}`, dob: `198${(idx % 9)}-0${(i % 9) + 1}-1${idx % 9}`,
        company_id: company.id,
      })
      managers.push({ row, deptIdx: d, tag: MANAGER_TAGS[i], email: `manager${idx}@test.com` })
    }
    for (let i = 0; i < 3; i++) {
      const idx = d * 3 + i + 1
      const row = await createAccount({
        email: `employee${idx}@test.com`, full_name: EMPLOYEE_NAMES[d][i], role: 'Employee',
        phone: `+65 81${String(idx).padStart(2, '0')} ${2000 + idx}`, dob: `199${(idx % 9)}-0${(i % 9) + 1}-2${idx % 9}`,
        company_id: company.id,
      })
      employees.push({ row, deptIdx: d, tag: EMPLOYEE_TAGS[i], email: `employee${idx}@test.com` })
    }
    for (let i = 0; i < 5; i++) {
      const idx = d * 5 + i + 1
      const row = await createAccount({
        email: `casual${idx}@test.com`, full_name: CW_NAMES[d][i], role: 'Casual Worker',
        phone: `+65 83${String(idx).padStart(2, '0')} ${3000 + idx}`, dob: `199${(idx % 9)}-0${(i % 9) + 1}-0${(idx % 9) + 1}`,
        company_id: company.id,
      })
      casuals.push({ row, deptIdx: d, tag: CW_TAGS[d][i], email: `casual${idx}@test.com` })
    }
  }
  console.log(`  ✓ ${managers.length} Managers, ${employees.length} Employees, ${casuals.length} Casual Workers created`)

  // ── Step 6: department memberships ──────────────────────────────────────
  console.log('\nStep 6: assigning department memberships...')
  await insertMany('manager_departments', managers.map(m => ({ manager_id: m.row.id, department_id: depts[m.deptIdx].id, company_id: company.id })), 'managers')
  await insertMany('employee_departments', employees.map(e => ({ employee_id: e.row.id, department_id: depts[e.deptIdx].id, company_id: company.id })), 'employees')
  for (const c of casuals) {
    const isVerifiedFromStart = c.tag !== 'crossDept' // crossDept gets verified via history loop below like everyone else too; all direct-seed CWs get verified via first-attendance postprocessing
    await upsertOne('casualworker_departments', {
      casual_worker_id: c.row.id, department_id: depts[c.deptIdx].id, company_id: company.id,
      inactive_at: c.tag === 'inactive' ? daysAgoISO(3) : null,
      inactive_reason: c.tag === 'inactive' ? 'Repeated no-shows without notice over the past month; deactivated pending review.' : null,
    }, 'casual_worker_id,department_id', c.email)
  }
  // casual2 (Operations, crossDept) also verified in Marketing
  const crossDeptCw = casuals.find(c => c.tag === 'crossDept')
  if (crossDeptCw) {
    await upsertOne('casualworker_departments', {
      casual_worker_id: crossDeptCw.row.id, department_id: depts[1].id, company_id: company.id,
    }, 'casual_worker_id,department_id', 'crossDept-secondary')
  }
  console.log('  ✓ department memberships assigned')

  // ── Step 6b: casual worker profiles + certificates ─────────────────────────
  console.log('\nStep 6b: seeding Casual Worker profiles + certificates...')
  for (const [i, c] of casuals.entries()) {
    await insertOne('casual_worker_profiles', {
      user_id: c.row.id,
      payment_method: pick(CW_PAYMENT_METHODS, i),
      payment_account: pick(CW_PAYMENT_METHODS, i) === 'PayNow' ? c.row.phone_number : `OCBC-${100000000 + i}`,
      skills: pick(CW_SKILLS, i),
      resume_url: `https://example.com/demo-resumes/${c.email.split('@')[0]}-resume.pdf`,
    }, c.email)
    await insertOne('user_certificates', {
      user_id: c.row.id, name: i % 3 === 0 ? 'Food Handler\'s Certificate' : 'First Aid Certificate',
      certificate_url: `https://example.com/demo-certs/${c.email.split('@')[0]}-cert.pdf`,
    }, c.email)
  }
  console.log('  ✓ Casual Worker profiles + certificates seeded')

  // ═════════════════════════════════════════════════════════════════════════
  // Step 7: Shift + Attendance history (5 weeks back, weekdays, internal staff)
  // ═════════════════════════════════════════════════════════════════════════
  console.log('\nStep 7: generating 5-week shift + attendance history for Managers/Employees...')
  const HISTORY_WEEKS = 5
  const historyStart = addDays(TODAY, -7 * HISTORY_WEEKS)
  const weekdaysInHistory = [] // Mon-Fri only — still used below for CW history & secondary companies
  const mondaySatInHistory = [] // Mon-Sat — internal-staff patterned schedule (see SHIFT_PATTERNS)
  for (let d = new Date(historyStart); d < TODAY; d = addDays(d, 1)) {
    if (isWeekday(d)) weekdaysInHistory.push(new Date(d))
    if (d.getDay() !== 0) mondaySatInHistory.push(new Date(d))
  }

  function breakTimesFor(pattern, dateStr) {
    const [sh, sm] = pattern.start.split(':').map(Number)
    const mid = new Date(`${dateStr}T00:00:00.000+08:00`)
    mid.setUTCHours(sh + 3, sm, 0, 0)
    const midEnd = new Date(mid.getTime() + 30 * 60000)
    return { break_in_time: mid.toISOString(), break_out_time: midEnd.toISOString() }
  }

  async function seedInternalStaffHistory(staffList, tagList) {
    for (const staff of staffList) {
      const patternIdx = tagList.indexOf(staff.tag)
      const pattern = SHIFT_PATTERNS[patternIdx]
      const dept = depts[staff.deptIdx]
      const myDates = mondaySatInHistory.filter(d => isWorkingDayFor(patternIdx, d))
      const shiftRows = myDates.map(d => ({
        company_id: company.id, department_id: dept.id, shift_date: dateKey(d),
        start_time: pattern.start, end_time: pattern.end, status: 'active', publication_status: 'published',
        created_by: ownerRow.id,
      }))
      const shifts = await insertMany('shifts', shiftRows, `${staff.email} history`)
      const assignRows = shifts.map(s => ({ shift_id: s.id, user_id: staff.row.id, assigned_by: ownerRow.id }))
      const assignments = await insertMany('shift_assignments', assignRows, `${staff.email} assignments`)
      const attRows = []
      for (const [idx, a] of assignments.entries()) {
        const roll = (idx + staff.email.length) % 20
        const dateStr = shifts[idx].shift_date
        if (roll === 0) continue // ~5% absent — no attendance row at all
        const late = roll >= 1 && roll <= 3 ? rand(5, 35) : 0
        const clockIn = new Date(sgtInstantISO(dateStr, pattern.start))
        clockIn.setUTCMinutes(clockIn.getUTCMinutes() + late)
        const clockOut = new Date(sgtInstantISO(dateStr, pattern.end))
        const row = {
          shift_assignment_id: a.id, user_id: staff.row.id,
          clock_in_time: clockIn.toISOString(), clock_out_time: clockOut.toISOString(),
          ...breakTimesFor(pattern, dateStr),
        }
        attRows.push(row)
      }
      await insertMany('attendance_records', attRows, `${staff.email} attendance`)
    }
  }
  await seedInternalStaffHistory(managers, MANAGER_TAGS)
  await seedInternalStaffHistory(employees, EMPLOYEE_TAGS)
  console.log(`  ✓ history seeded for ${managers.length + employees.length} internal staff (day/early/late patterns) across ${mondaySatInHistory.length} calendar days`)

  // one Manager-corrected historical record — Fiona Chen (manager, CS veteran) corrects Elaine
  // Chua's (CS normal employee) late clock-in from three weekdays ago.
  {
    const csVeteranManager = managers.find(m => m.deptIdx === 3 && m.tag === 'veteran')
    const csNormalEmployee = employees.find(e => e.deptIdx === 3 && e.tag === 'normal')
    const targetDate = dateKey(weekdaysInHistory[weekdaysInHistory.length - 3])
    const { data: targetAssignment } = await supabase
      .from('shift_assignments').select('id, shifts!inner(shift_date)')
      .eq('user_id', csNormalEmployee.row.id).eq('shifts.shift_date', targetDate).maybeSingle()
    if (targetAssignment) {
      const { data: rec } = await supabase.from('attendance_records').select('id').eq('shift_assignment_id', targetAssignment.id).maybeSingle()
      if (rec) {
        await supabase.from('attendance_records').update({
          modified_clock_in_time: sgtInstantISO(targetDate, '09:00'),
          modified_by: csVeteranManager.row.id,
          modified_at: daysAgoISO(2),
          modified_reason: 'Employee was on an approved errand for the department; adjusted clock-in to scheduled start time.',
        }).eq('id', rec.id)
      }
    }
  }

  // ── Step 7b: Casual Worker history (intermittent, ~2x/week, hourly-paid) ──
  console.log('\nStep 7b: generating Casual Worker shift + attendance history...')
  const cwHistoryDates = weekdaysInHistory.filter((_, i) => i % 3 !== 2) // ~2/3 of weekdays available as CW shift days
  // Every non-inactive CW always gets the last 3 available weekdays PLUS their own spread across
  // the rest of the window — guarantees the Report page's default last-7-days view always has
  // several Casual Workers with real attendance (Top Reliable Workers needs 2+ to show a ranking),
  // not just whichever single worker's sparse bucket happened to land recently.
  const recentBoostDates = cwHistoryDates.slice(-3)
  for (const [ci, c] of casuals.entries()) {
    if (c.tag === 'inactive') continue // handled separately below (history then ban)
    const dept = depts[c.deptIdx]
    const bucketed = cwHistoryDates.filter((_, i) => i % 3 === ci % 3)
    const seen = new Set()
    const myDates = [...bucketed, ...recentBoostDates].filter(d => {
      const key = dateKey(d)
      if (seen.has(key)) return false
      seen.add(key)
      return true
    }).sort((a, b) => a - b)
    const shiftRows = myDates.map(d => ({
      company_id: company.id, department_id: dept.id, shift_date: dateKey(d),
      start_time: '10:00', end_time: '16:00', status: 'active', publication_status: 'published',
      created_by: ownerRow.id, hourly_rate: 12 + (ci % 6),
    }))
    const shifts = await insertMany('shifts', shiftRows, `${c.email} history`)
    const assignments = await insertMany('shift_assignments', shifts.map(s => ({ shift_id: s.id, user_id: c.row.id, assigned_by: ownerRow.id })), `${c.email} assignments`)
    const attRows = assignments.map((a, idx) => {
      const dateStr = shifts[idx].shift_date
      const late = idx % 6 === 0 ? rand(5, 20) : 0
      const clockIn = new Date(`${dateStr}T10:00:00.000+08:00`)
      clockIn.setUTCMinutes(clockIn.getUTCMinutes() + late)
      return { shift_assignment_id: a.id, user_id: c.row.id, clock_in_time: clockIn.toISOString(), clock_out_time: sgtInstantISO(dateStr, '16:00') }
    }).filter((_, idx) => idx % 9 !== 8) // occasional absence
    await insertMany('attendance_records', attRows, `${c.email} attendance`)

    // First completed shift's clock-out verifies them in this department (matches the app's own
    // invariant: casualworker_departments.verified_at = first completed clock-out).
    if (attRows.length) {
      const first = attRows[0]
      await supabase.from('casualworker_departments').update({ verified_at: first.clock_out_time })
        .eq('casual_worker_id', c.row.id).eq('department_id', dept.id)
    }
  }
  // crossDept CW's Marketing verification lands a bit later than their home-department one
  if (crossDeptCw) {
    await supabase.from('casualworker_departments').update({ verified_at: daysAgoISO(6) })
      .eq('casual_worker_id', crossDeptCw.row.id).eq('department_id', depts[1].id)
  }
  // inactive CWs: short history (3 shifts) then banned — verified before being banned
  for (const c of casuals.filter(c => c.tag === 'inactive')) {
    const dept = depts[c.deptIdx]
    const myDates = weekdaysInHistory.slice(0, 6).filter((_, i) => i % 2 === 0)
    const shifts = await insertMany('shifts', myDates.map(d => ({
      company_id: company.id, department_id: dept.id, shift_date: dateKey(d), start_time: '10:00', end_time: '16:00',
      status: 'active', publication_status: 'published', created_by: ownerRow.id, hourly_rate: 13,
    })), `${c.email} short history`)
    const assignments = await insertMany('shift_assignments', shifts.map(s => ({ shift_id: s.id, user_id: c.row.id, assigned_by: ownerRow.id })), `${c.email} assignments`)
    const attRows = assignments.map((a, idx) => ({
      shift_assignment_id: a.id, user_id: c.row.id,
      clock_in_time: sgtInstantISO(shifts[idx].shift_date, '10:00'), clock_out_time: sgtInstantISO(shifts[idx].shift_date, '16:00'),
    }))
    await insertMany('attendance_records', attRows, `${c.email} attendance`)
    if (attRows.length) {
      await supabase.from('casualworker_departments').update({ verified_at: attRows[0].clock_out_time })
        .eq('casual_worker_id', c.row.id).eq('department_id', dept.id)
    }
  }
  console.log('  ✓ Casual Worker history seeded')

  // ═════════════════════════════════════════════════════════════════════════
  // Step 8: "Today" — mixed live states (in progress, on break, finished, later)
  // ═════════════════════════════════════════════════════════════════════════
  console.log('\nStep 8: seeding today\'s mixed shift states...')
  const now = new Date()

  // 8a. Manager veteran (Operations, David Lim) — clocked in 3h ago, currently mid-shift, no break yet.
  {
    const staff = managers.find(m => m.deptIdx === 0 && m.tag === 'veteran')
    const start = new Date(now.getTime() - 3 * 60 * 60000)
    const shift = await insertOne('shifts', {
      company_id: company.id, department_id: depts[0].id, shift_date: dateKeySGT(start),
      start_time: toHM(start), end_time: toHM(new Date(start.getTime() + 8 * 60 * 60000)),
      status: 'active', publication_status: 'published', created_by: ownerRow.id,
    }, 'today-manager-inprogress')
    const assignment = await insertOne('shift_assignments', { shift_id: shift.id, user_id: staff.row.id, assigned_by: ownerRow.id }, 'today-manager-inprogress')
    await insertOne('attendance_records', { shift_assignment_id: assignment.id, user_id: staff.row.id, clock_in_time: start.toISOString() }, 'today-manager-inprogress')
  }

  // 8b. casual1 (Operations, liveOnBreak) — clocked in 2h ago, on break right now.
  {
    const cw = casuals.find(c => c.tag === 'liveOnBreak')
    const start = new Date(now.getTime() - 2 * 60 * 60000)
    const breakStart = new Date(now.getTime() - 10 * 60000)
    const shift = await insertOne('shifts', {
      company_id: company.id, department_id: depts[cw.deptIdx].id, shift_date: dateKeySGT(start),
      start_time: toHM(start), end_time: toHM(new Date(start.getTime() + 6 * 60 * 60000)),
      status: 'active', publication_status: 'published', created_by: ownerRow.id, hourly_rate: 14,
    }, 'today-cw-onbreak')
    const assignment = await insertOne('shift_assignments', { shift_id: shift.id, user_id: cw.row.id, assigned_by: ownerRow.id }, 'today-cw-onbreak')
    await insertOne('attendance_records', {
      shift_assignment_id: assignment.id, user_id: cw.row.id, clock_in_time: start.toISOString(), break_in_time: breakStart.toISOString(),
    }, 'today-cw-onbreak')
  }

  // 8c. casual6 (Marketing, liveOpenEnded) — open-ended one-off job, immediately clock-in-able,
  // supervised by Chloe Yeo (Marketing normal employee).
  {
    const cw = casuals.find(c => c.tag === 'liveOpenEnded')
    const supervisor = employees.find(e => e.deptIdx === 1 && e.tag === 'normal')
    const start = new Date(now.getTime() - 10 * 60000)
    const shift = await insertOne('shifts', {
      company_id: company.id, department_id: depts[1].id, shift_date: dateKeySGT(start),
      start_time: toHM(start), end_time: toHM(new Date(start.getTime() + 4 * 60 * 60000)),
      status: 'active', publication_status: 'published', created_by: ownerRow.id, is_open_ended: true, hourly_rate: 15,
    }, 'today-cw-openended')
    await insertOne('shift_assignments', { shift_id: shift.id, user_id: cw.row.id, assigned_by: ownerRow.id, supervisor_employee_id: supervisor.row.id }, 'today-cw-openended')
  }

  // 8d. casual11 (Engineering, liveReleased) — completed a one-off job earlier today, already released.
  {
    const cw = casuals.find(c => c.tag === 'liveReleased')
    const supervisor = employees.find(e => e.deptIdx === 2 && e.tag === 'normal')
    const start = new Date(now.getTime() - 5 * 60 * 60000)
    const end = new Date(now.getTime() - 30 * 60000)
    const shift = await insertOne('shifts', {
      company_id: company.id, department_id: depts[2].id, shift_date: dateKeySGT(start),
      start_time: toHM(start), end_time: toHM(end), status: 'active', publication_status: 'published',
      created_by: ownerRow.id, is_open_ended: true, hourly_rate: 15,
    }, 'today-cw-released')
    const assignment = await insertOne('shift_assignments', { shift_id: shift.id, user_id: cw.row.id, assigned_by: ownerRow.id, supervisor_employee_id: supervisor.row.id }, 'today-cw-released')
    await insertOne('attendance_records', {
      shift_assignment_id: assignment.id, user_id: cw.row.id, clock_in_time: start.toISOString(),
      clock_out_time: end.toISOString(), clock_out_released: true,
    }, 'today-cw-released')
  }

  // 8e. casual16 (Customer Support, liveAwaitingRelease) — finished, waiting on supervisor to release.
  {
    const cw = casuals.find(c => c.tag === 'liveAwaitingRelease')
    const supervisor = employees.find(e => e.deptIdx === 3 && e.tag === 'normal')
    const start = new Date(now.getTime() - 4 * 60 * 60000)
    const end = new Date(now.getTime() - 5 * 60000)
    const shift = await insertOne('shifts', {
      company_id: company.id, department_id: depts[3].id, shift_date: dateKeySGT(start),
      start_time: toHM(start), end_time: toHM(end), status: 'active', publication_status: 'published',
      created_by: ownerRow.id, is_open_ended: true, hourly_rate: 14,
    }, 'today-cw-awaiting-release')
    const assignment = await insertOne('shift_assignments', { shift_id: shift.id, user_id: cw.row.id, assigned_by: ownerRow.id, supervisor_employee_id: supervisor.row.id }, 'today-cw-awaiting-release')
    await insertOne('attendance_records', {
      shift_assignment_id: assignment.id, user_id: cw.row.id, clock_in_time: start.toISOString(),
      clock_out_time: end.toISOString(), clock_out_released: false,
    }, 'today-cw-awaiting-release')
  }

  // 8f. Everyone else's "today" — each person's OWN day/early/late pattern (round hours), with
  // attendance state derived from the real current time: an early-shift person already clocked
  // out, a day-shift person clocked in mid-shift, a late-shift person's shift hasn't started yet.
  // Whoever's pattern says today is their day off (see isWorkingDayFor) simply gets no shift.
  {
    const todaySGTKey = dateKeySGT(now)
    const restStaff = [...managers, ...employees].filter(s => !(s.deptIdx === 0 && s.tag === 'veteran'))
    for (const staff of restStaff) {
      const tagList = managers.includes(staff) ? MANAGER_TAGS : EMPLOYEE_TAGS
      const patternIdx = tagList.indexOf(staff.tag)
      if (!isWorkingDayFor(patternIdx, now)) continue
      const pattern = SHIFT_PATTERNS[patternIdx]
      const shift = await insertOne('shifts', {
        company_id: company.id, department_id: depts[staff.deptIdx].id, shift_date: todaySGTKey,
        start_time: pattern.start, end_time: pattern.end, status: 'active', publication_status: 'published',
        created_by: ownerRow.id,
      }, `today-${staff.email}`)
      if (!shift) continue
      const assignment = await insertOne('shift_assignments', { shift_id: shift.id, user_id: staff.row.id, assigned_by: ownerRow.id }, `today-${staff.email}-assignment`)
      if (!assignment) continue
      const shiftStart = new Date(sgtInstantISO(todaySGTKey, pattern.start))
      const shiftEnd = new Date(sgtInstantISO(todaySGTKey, pattern.end))
      if (now >= shiftEnd) {
        await insertOne('attendance_records', {
          shift_assignment_id: assignment.id, user_id: staff.row.id,
          clock_in_time: shiftStart.toISOString(), clock_out_time: shiftEnd.toISOString(),
          ...breakTimesFor(pattern, todaySGTKey),
        }, `today-${staff.email}-attendance-done`)
      } else if (now >= shiftStart) {
        const midPassed = now.getTime() - shiftStart.getTime() >= 3 * 60 * 60000
        await insertOne('attendance_records', {
          shift_assignment_id: assignment.id, user_id: staff.row.id, clock_in_time: shiftStart.toISOString(),
          ...(midPassed ? breakTimesFor(pattern, todaySGTKey) : {}),
        }, `today-${staff.email}-attendance-inprogress`)
      }
      // else: shift hasn't started yet — published shift with no attendance row, as expected.
    }
  }
  console.log('  ✓ today\'s mixed live states seeded')

  // ═════════════════════════════════════════════════════════════════════════
  // Step 9: Future shifts (~3 weeks) — regular roster + special scenarios
  // ═════════════════════════════════════════════════════════════════════════
  console.log('\nStep 9: generating future shift roster + special scenarios...')
  const futureWeekdays = []
  const futureMonSat = []
  for (let d = addDays(TODAY, 1); d <= addDays(TODAY, 21); d = addDays(d, 1)) {
    if (isWeekday(d)) futureWeekdays.push(new Date(d))
    if (d.getDay() !== 0) futureMonSat.push(new Date(d))
  }
  // Regular published future roster, ~2 weeks, each person on their own day/early/late pattern.
  const twoWeeksFutureMonSat = futureMonSat.slice(0, 12)
  for (let d = 0; d < 4; d++) {
    const staffInDept = [...managers, ...employees].filter(s => s.deptIdx === d)
    for (const staff of staffInDept) {
      const tagList = managers.includes(staff) ? MANAGER_TAGS : EMPLOYEE_TAGS
      const patternIdx = tagList.indexOf(staff.tag)
      const pattern = SHIFT_PATTERNS[patternIdx]
      const myDates = twoWeeksFutureMonSat.filter(dt => isWorkingDayFor(patternIdx, dt))
      const shiftRows = myDates.map(dt => ({
        company_id: company.id, department_id: depts[d].id, shift_date: dateKey(dt),
        start_time: pattern.start, end_time: pattern.end, status: 'active', publication_status: 'published',
        created_by: ownerRow.id,
      }))
      const shifts = await insertMany('shifts', shiftRows, `${staff.email} future`)
      await insertMany('shift_assignments', shifts.map(s => ({ shift_id: s.id, user_id: staff.row.id, assigned_by: ownerRow.id })), `${staff.email} future-assignments`)
    }
    // A handful of draft (unpublished) shifts 3 weeks out, still being planned — the veteran
    // Manager's own pattern, so it reads as "next iteration of their usual roster, not yet published".
    const draftDates = futureWeekdays.slice(10, 13)
    const vetIdx = MANAGER_TAGS.indexOf('veteran')
    const vetPattern = SHIFT_PATTERNS[vetIdx]
    const shiftRows = draftDates.map(dt => ({
      company_id: company.id, department_id: depts[d].id, shift_date: dateKey(dt),
      start_time: vetPattern.start, end_time: vetPattern.end, status: 'active', publication_status: 'draft',
      created_by: ownerRow.id,
    }))
    await insertMany('shifts', shiftRows, `dept${d} draft-future`)
  }

  // Shift template + a shift built from it (Paid, UC2). Placed well past the ~2-week patterned
  // roster window (offset 22+) so it never double-books someone who already has a regular shift
  // that day.
  const shiftTemplate = await insertOne('shift_templates', {
    company_id: company.id, name: 'Standard Morning Shift', start_time: '09:00', end_time: '17:00', created_by: ownerRow.id,
  }, 'shift-template')
  const templatedShift = await insertOne('shifts', {
    company_id: company.id, department_id: depts[0].id, shift_date: dateKey(addDays(TODAY, 22)),
    start_time: '09:00', end_time: '17:00', status: 'active', publication_status: 'published',
    created_by: ownerRow.id, template_id: shiftTemplate?.id ?? null,
  }, 'templated-shift')
  const opsTaskHeavyEmp = employees.find(e => e.deptIdx === 0 && e.tag === 'taskHeavy')
  if (templatedShift) await insertOne('shift_assignments', { shift_id: templatedShift.id, user_id: opsTaskHeavyEmp.row.id, assigned_by: ownerRow.id }, 'templated-shift-assignment')

  // Recurring weekly shift group (UC7, Paid) — 3 consecutive Wednesdays, Rachel Koh (Marketing veteran).
  {
    const mktVeteran = managers.find(m => m.deptIdx === 1 && m.tag === 'veteran')
    const wednesdays = []
    for (let d = addDays(TODAY, 23), found = 0; found < 3; d = addDays(d, 1)) {
      if (d.getDay() === 3) { wednesdays.push(new Date(d)); found++ }
    }
    const groupId = require('crypto').randomUUID()
    let sourceId = null
    for (const [i, dt] of wednesdays.entries()) {
      const shift = await insertOne('shifts', {
        company_id: company.id, department_id: depts[1].id, shift_date: dateKey(dt), start_time: '09:00', end_time: '17:00',
        status: 'active', publication_status: 'published', created_by: ownerRow.id,
        recurrence_group_id: groupId, recurrence_rule: 'weekly', source_shift_id: i === 0 ? null : sourceId,
      }, `recurring-week${i}`)
      if (i === 0 && shift) sourceId = shift.id
      if (shift) await insertOne('shift_assignments', { shift_id: shift.id, user_id: mktVeteran.row.id, assigned_by: ownerRow.id }, `recurring-week${i}-assignment`)
    }
  }

  // Split shift (UC8) — Daniel Tay (Engineering normal employee), two blocks same day.
  {
    const engNormalEmp = employees.find(e => e.deptIdx === 2 && e.tag === 'normal')
    const splitDate = dateKey(futureWeekdays[5])
    const splitGroupId = require('crypto').randomUUID()
    const blockA = await insertOne('shifts', {
      company_id: company.id, department_id: depts[2].id, shift_date: splitDate, start_time: '08:00', end_time: '12:00',
      status: 'active', publication_status: 'published', created_by: ownerRow.id, split_group_id: splitGroupId,
    }, 'split-block-a')
    const blockB = await insertOne('shifts', {
      company_id: company.id, department_id: depts[2].id, shift_date: splitDate, start_time: '16:00', end_time: '20:00',
      status: 'active', publication_status: 'published', created_by: ownerRow.id, split_group_id: splitGroupId,
    }, 'split-block-b')
    if (blockA) await insertOne('shift_assignments', { shift_id: blockA.id, user_id: engNormalEmp.row.id, assigned_by: ownerRow.id }, 'split-a-assignment')
    if (blockB) await insertOne('shift_assignments', { shift_id: blockB.id, user_id: engNormalEmp.row.id, assigned_by: ownerRow.id }, 'split-b-assignment')
  }

  // Clopening conflict pair (UC9, Paid) — Elaine Chua (Customer Support normal employee): closes
  // late one night, opens early the next morning (7h rest).
  {
    const csNormalEmp = employees.find(e => e.deptIdx === 3 && e.tag === 'normal')
    const closeDate = dateKey(futureWeekdays[7])
    const openDate = dateKey(futureWeekdays[8])
    const closingShift = await insertOne('shifts', {
      company_id: company.id, department_id: depts[3].id, shift_date: closeDate, start_time: '15:00', end_time: '23:00',
      status: 'active', publication_status: 'published', created_by: ownerRow.id,
    }, 'clopening-close')
    const openingShift = await insertOne('shifts', {
      company_id: company.id, department_id: depts[3].id, shift_date: openDate, start_time: '06:00', end_time: '14:00',
      status: 'active', publication_status: 'published', created_by: ownerRow.id,
    }, 'clopening-open')
    if (closingShift) await insertOne('shift_assignments', { shift_id: closingShift.id, user_id: csNormalEmp.row.id, assigned_by: ownerRow.id }, 'clopening-close-assignment')
    if (openingShift) await insertOne('shift_assignments', { shift_id: openingShift.id, user_id: csNormalEmp.row.id, assigned_by: ownerRow.id }, 'clopening-open-assignment')
  }
  console.log('  ✓ future shift roster + special scenarios seeded')

  // ═════════════════════════════════════════════════════════════════════════
  // Step 10: Shift Swap Requests + settings
  // ═════════════════════════════════════════════════════════════════════════
  console.log('\nStep 10: seeding Shift Swap settings + requests...')
  await upsertOne('shift_swap_settings', {
    company_id: company.id, auto_approval_enabled: false, monthly_swap_limit: 3,
    require_review_on_limit_exceeded: true, require_review_on_deadline_exceeded: true,
    updated_by: ownerRow.id, deadline_hours_before_shift: 24,
  }, 'company_id', 'company-swap-settings')
  await insertMany('shift_swap_department_settings', depts.map((dept, i) => ({
    company_id: company.id, department_id: dept.id, auto_approval_enabled: false, monthly_swap_limit: 3,
    deadline_hours_before_shift: 24, require_review_on_limit_exceeded: true, require_review_on_deadline_exceeded: true,
    updated_by: managers.find(m => m.deptIdx === i && m.tag === 'veteran').row.id,
  })), 'dept-swap-settings')

  let swapDayOffset = 30
  async function makeSwapPair(deptIdx, requesterId, counterpartId, timesA, timesB) {
    const dA = addDays(TODAY, swapDayOffset++)
    const dB = addDays(TODAY, swapDayOffset++)
    const shiftA = await insertOne('shifts', {
      company_id: company.id, department_id: depts[deptIdx].id, shift_date: dateKey(dA),
      start_time: timesA[0], end_time: timesA[1], status: 'active', publication_status: 'published', created_by: ownerRow.id,
    }, 'swap-shift-a')
    const shiftB = await insertOne('shifts', {
      company_id: company.id, department_id: depts[deptIdx].id, shift_date: dateKey(dB),
      start_time: timesB[0], end_time: timesB[1], status: 'active', publication_status: 'published', created_by: ownerRow.id,
    }, 'swap-shift-b')
    const assignA = shiftA && await insertOne('shift_assignments', { shift_id: shiftA.id, user_id: requesterId, assigned_by: ownerRow.id }, 'swap-assign-a')
    const assignB = shiftB && await insertOne('shift_assignments', { shift_id: shiftB.id, user_id: counterpartId, assigned_by: ownerRow.id }, 'swap-assign-b')
    return { assignA, assignB }
  }
  async function makeSwap({ deptIdx, requesterId, counterpartId, reason, status, counterpartStatus, reviewedBy = null, reviewedAt = null, ownerReviewReason = null, createdAt }) {
    const { assignA, assignB } = await makeSwapPair(deptIdx, requesterId, counterpartId, ['09:00', '13:00'], ['13:30', '17:30'])
    if (!assignA || !assignB) return
    await insertOne('shift_swap_requests', {
      company_id: company.id, requester_id: requesterId, requester_assignment_id: assignA.id,
      counterpart_id: counterpartId, counterpart_assignment_id: assignB.id, reason,
      counterpart_status: counterpartStatus, counterpart_reviewed_at: counterpartStatus === 'approved' ? minutesAgo(rand(30, 150)) : null,
      status, reviewed_by: reviewedBy, reviewed_at: reviewedAt, owner_review_reason: ownerReviewReason, created_at: createdAt,
    }, 'swap-request')
  }

  const opsMgrVeteran = managers.find(m => m.deptIdx === 0 && m.tag === 'veteran')
  const opsMgrPending = managers.find(m => m.deptIdx === 0 && m.tag === 'pendingRequests')
  const opsEmpNormal = employees.find(e => e.deptIdx === 0 && e.tag === 'normal')
  const opsEmpPending = employees.find(e => e.deptIdx === 0 && e.tag === 'pendingRequests')

  // Operations gets the full status spread on both tiers (Employee-tier reviewed by their
  // Manager; Manager-tier reviewed by Owner/Partner, per the confirmed approval-routing split).
  await makeSwap({ deptIdx: 0, requesterId: opsEmpPending.row.id, counterpartId: opsEmpNormal.row.id, reason: 'Grace needs the afternoon free for a family appointment and Ben already agreed to trade.', status: 'pending', counterpartStatus: 'approved', createdAt: minutesAgo(60) })
  await makeSwap({ deptIdx: 0, requesterId: opsEmpNormal.row.id, counterpartId: opsEmpPending.row.id, reason: 'Ben and Grace swapped to balance opening and closing coverage.', status: 'approved', counterpartStatus: 'approved', reviewedBy: opsMgrVeteran.row.id, reviewedAt: minutesAgo(70), createdAt: minutesAgo(120) })
  await makeSwap({ deptIdx: 0, requesterId: opsEmpPending.row.id, counterpartId: opsEmpNormal.row.id, reason: 'Grace wanted to move her service shift to Ben.', status: 'rejected', counterpartStatus: 'approved', reviewedBy: opsMgrVeteran.row.id, reviewedAt: minutesAgo(62), ownerReviewReason: 'Coverage would be too light during the Friday service window.', createdAt: minutesAgo(115) })
  {
    const { assignA, assignB } = await makeSwapPair(0, opsEmpNormal.row.id, opsEmpPending.row.id, ['09:00', '13:00'], ['13:30', '17:30'])
    if (assignA && assignB) {
      await insertOne('shift_swap_requests', {
        company_id: company.id, requester_id: opsEmpNormal.row.id, requester_assignment_id: assignA.id,
        counterpart_id: opsEmpPending.row.id, counterpart_assignment_id: assignB.id,
        reason: 'Still waiting for Grace to respond, so this should not show up in the Manager queue yet.',
        counterpart_status: 'pending', status: 'pending', created_at: minutesAgo(20),
      }, 'swap-hidden-employee')
    }
  }
  await makeSwap({ deptIdx: 0, requesterId: opsMgrPending.row.id, counterpartId: opsMgrVeteran.row.id, reason: 'Wendy has a supplier meeting that morning and David already agreed to trade.', status: 'pending', counterpartStatus: 'approved', createdAt: minutesAgo(55) })
  await makeSwap({ deptIdx: 0, requesterId: opsMgrVeteran.row.id, counterpartId: opsMgrPending.row.id, reason: 'David and Wendy swapped to balance opening and closing coverage.', status: 'approved', counterpartStatus: 'approved', reviewedBy: ownerRow.id, reviewedAt: minutesAgo(75), createdAt: minutesAgo(130) })
  await makeSwap({ deptIdx: 0, requesterId: opsMgrPending.row.id, counterpartId: opsMgrVeteran.row.id, reason: 'Wendy wanted to move her service shift to David.', status: 'rejected', counterpartStatus: 'approved', reviewedBy: ownerRow.id, reviewedAt: minutesAgo(65), ownerReviewReason: 'Coverage would be too light during the Friday service window.', createdAt: minutesAgo(118) })
  {
    const { assignA, assignB } = await makeSwapPair(0, opsMgrVeteran.row.id, opsMgrPending.row.id, ['09:00', '13:00'], ['13:30', '17:30'])
    if (assignA && assignB) {
      await insertOne('shift_swap_requests', {
        company_id: company.id, requester_id: opsMgrVeteran.row.id, requester_assignment_id: assignA.id,
        counterpart_id: opsMgrPending.row.id, counterpart_assignment_id: assignB.id,
        reason: 'Still waiting on Wendy, so the Owner/Partner queue should not show this yet.',
        counterpart_status: 'pending', status: 'pending', created_at: minutesAgo(15),
      }, 'swap-hidden-manager')
    }
  }
  // Other 3 departments — one pending Employee-tier swap each, so no department is empty.
  for (const d of [1, 2, 3]) {
    const empN = employees.find(e => e.deptIdx === d && e.tag === 'normal')
    const empP = employees.find(e => e.deptIdx === d && e.tag === 'pendingRequests')
    await makeSwap({ deptIdx: d, requesterId: empP.row.id, counterpartId: empN.row.id, reason: `${empP.row.full_name.split(' ')[0]} needs coverage and ${empN.row.full_name.split(' ')[0]} agreed to trade.`, status: 'pending', counterpartStatus: 'approved', createdAt: minutesAgo(rand(20, 80)) })
  }
  console.log('  ✓ Shift Swap Requests seeded')

  // ═════════════════════════════════════════════════════════════════════════
  // Step 11: Fixed Day Off — quotas, deadline, requests
  // ═════════════════════════════════════════════════════════════════════════
  console.log('\nStep 11: seeding Fixed Day Off settings + requests...')
  await insertMany('off_day_quota_settings', [
    { company_id: company.id, user_id: null, role: 'Manager', max_days_per_week: 2 },
    { company_id: company.id, user_id: null, role: 'Employee', max_days_per_week: 2 },
  ], 'off-day-quota')
  await upsertOne('off_day_submission_deadline', { company_id: company.id, deadline_weekday: 0, deadline_time: '08:00' }, 'company_id', 'off-day-deadline')

  // One historical approved Fixed Day Off (Operations veteran manager).
  await insertOne('off_day_requests', {
    user_id: opsMgrVeteran.row.id, company_id: company.id, requested_date: dateKey(addDays(TODAY, -10)),
    requested_week: dateKey(mondayOf(addDays(TODAY, -10))), status: 'approved', source: 'submitted',
    reviewed_by: ownerRow.id, reviewed_at: daysAgoISO(12), created_at: daysAgoISO(16),
  }, 'off-day-approved')

  // Pending Fixed Day Off for each department's "pendingRequests" Manager and Employee.
  let offDayOffset = 25
  for (let d = 0; d < 4; d++) {
    const mgr = managers.find(m => m.deptIdx === d && m.tag === 'pendingRequests')
    const emp = employees.find(e => e.deptIdx === d && e.tag === 'pendingRequests')
    const mgrDate = addDays(TODAY, offDayOffset++)
    const empDate = addDays(TODAY, offDayOffset++)
    await insertOne('off_day_requests', {
      user_id: mgr.row.id, company_id: company.id, requested_date: dateKey(mgrDate),
      requested_week: dateKey(mondayOf(mgrDate)), status: 'pending', source: 'submitted', created_at: minutesAgo(rand(30, 200)),
    }, `off-day-pending-mgr-${d}`)
    await insertOne('off_day_requests', {
      user_id: emp.row.id, company_id: company.id, requested_date: dateKey(empDate),
      requested_week: dateKey(mondayOf(empDate)), status: 'pending', source: 'submitted', created_at: minutesAgo(rand(30, 200)),
    }, `off-day-pending-emp-${d}`)
  }
  console.log('  ✓ Fixed Day Off settings + requests seeded')

  // ═════════════════════════════════════════════════════════════════════════
  // Step 12: Tasks (all assignment directions, statuses, sub-tasks, recurring, archived)
  // ═════════════════════════════════════════════════════════════════════════
  console.log('\nStep 12: seeding Task Templates + Tasks...')
  async function createTask(fields) {
    const task = await insertOne('tasks', fields, fields.title)
    if (task && fields.assigned_user_id) {
      await insertOne('task_assignments', { task_id: task.id, user_id: fields.assigned_user_id, assigned_by: fields.assigned_by ?? null }, `${fields.title}-assignment`)
    }
    return task
  }
  await insertOne('task_templates', {
    company_id: company.id, title: 'Weekly Stock Count', description: 'Count and reconcile stock levels against the inventory system.',
    priority: 'Medium', created_by: ownerRow.id, sub_task_titles: ['Count front-of-house stock', 'Count storeroom stock', 'Reconcile against POS system'],
    department_id: depts[0].id,
  }, 'task-template')

  for (let d = 0; d < 4; d++) {
    const dept = depts[d]
    const partner = pick(['partner1@test.com', 'partner2@test.com'], d)
    const partnerRow = (await supabase.from('users').select('id').eq('email_address', partner).single()).data
    const mgrVeteran = managers.find(m => m.deptIdx === d && m.tag === 'veteran')
    const mgrPending = managers.find(m => m.deptIdx === d && m.tag === 'pendingRequests')
    const empNormal = employees.find(e => e.deptIdx === d && e.tag === 'normal')
    const empPending = employees.find(e => e.deptIdx === d && e.tag === 'pendingRequests')
    const empHeavy = employees.find(e => e.deptIdx === d && e.tag === 'taskHeavy')
    const cwNormal = casuals.find(c => c.deptIdx === d && c.tag === 'normal')

    // Owner -> veteran Manager (Complete, on time)
    await createTask({
      company_id: company.id, department_id: dept.id, title: `${dept.name} Monthly Compliance Review`,
      description: 'Review department compliance checklist against company policy and file the signed report.',
      assigned_user_id: mgrVeteran.row.id, assigned_by: ownerRow.id, status: 'Complete', priority: 'High',
      due_at: localInstantOn(addDays(TODAY, -3), 17), created_at: daysAgoISO(8), completed_at: localInstantOn(addDays(TODAY, -4), 15),
      task_date: dateKey(addDays(TODAY, -3)),
    })
    // Partner -> pendingRequests Manager (In Progress)
    await createTask({
      company_id: company.id, department_id: dept.id, title: `${dept.name} Vendor Contract Renewal`,
      description: 'Review the annual vendor contract terms and negotiate renewal pricing before it lapses.',
      assigned_user_id: mgrPending.row.id, assigned_by: partnerRow?.id ?? ownerRow.id, status: 'In Progress', priority: 'High',
      due_at: localInstantOn(addDays(TODAY, 5), 17), created_at: daysAgoISO(4), task_date: dateKey(addDays(TODAY, 5)),
    })
    // Owner -> veteran Manager: Review status (the Kanban board's Review column needs real content).
    await createTask({
      company_id: company.id, department_id: dept.id, title: `${dept.name} Annual Budget Proposal`,
      description: 'Draft next year\'s department budget proposal for Owner sign-off.',
      assigned_user_id: mgrVeteran.row.id, assigned_by: ownerRow.id, status: 'Review', priority: 'High',
      due_at: localInstantOn(addDays(TODAY, 2), 17), created_at: daysAgoISO(5), task_date: dateKey(addDays(TODAY, 2)),
    })
    // Owner -> pendingRequests Manager: this manager is the deliberate workload-imbalance /
    // delay-alert outlier on the OWNER'S OWN board (Owner Tasks only shows assigned_by=Owner/
    // Partner tasks) — overdue+unread (delay alert active), an extra Assigned, a rework
    // (rejected-in-Review, sent back to In Progress), a recurring group, and a parent+subtasks.
    await createTask({
      company_id: company.id, department_id: dept.id, title: `${dept.name} Q3 Budget Submission`,
      description: 'Submit the finalised Q3 department budget figures to Finance.',
      assigned_user_id: mgrPending.row.id, assigned_by: ownerRow.id, status: 'Assigned', priority: 'High',
      due_at: localInstantOn(addDays(TODAY, -2), 17), created_at: daysAgoISO(10), task_date: dateKey(addDays(TODAY, -2)),
    })
    await createTask({
      company_id: company.id, department_id: dept.id, title: `${dept.name} Staff Training Compliance Audit`,
      description: 'Audit staff training records against the annual compliance checklist.',
      assigned_user_id: mgrPending.row.id, assigned_by: ownerRow.id, status: 'Assigned', priority: 'Medium',
      due_at: localInstantOn(addDays(TODAY, 6), 17), created_at: daysAgoISO(3), task_date: dateKey(addDays(TODAY, 6)),
    })
    await createTask({
      company_id: company.id, department_id: dept.id, title: `${dept.name} Break Room Renovation Proposal`,
      description: 'Owner sent this back — the cost estimate needs a second, more detailed quote before resubmission.',
      assigned_user_id: mgrPending.row.id, assigned_by: ownerRow.id, status: 'In Progress', priority: 'Low',
      due_at: localInstantOn(addDays(TODAY, 8), 17), created_at: daysAgoISO(9),
      rejection_reason: 'Needs a second contractor quote before Owner can approve the spend.',
      rejected_at: daysAgoISO(1), reviewed_by: ownerRow.id, task_date: dateKey(addDays(TODAY, 8)),
    })
    {
      const groupId = require('crypto').randomUUID()
      const dates = [addDays(TODAY, -7), TODAY, addDays(TODAY, 7)]
      let sourceId = null
      for (const [i, dt] of dates.entries()) {
        const t = await createTask({
          company_id: company.id, department_id: dept.id, title: `${dept.name} Monthly Safety Walkthrough`,
          description: 'Walk the floor and file the monthly safety checklist with Owner.',
          assigned_user_id: mgrPending.row.id, assigned_by: ownerRow.id,
          status: i === 0 ? 'Complete' : i === 1 ? 'In Progress' : 'Assigned', priority: 'Medium',
          due_at: localInstantOn(dt, 16), created_at: i === 0 ? daysAgoISO(8) : (i === 1 ? daysAgoISO(1) : daysAgoISO(0)),
          completed_at: i === 0 ? localInstantOn(dt, 15) : null,
          recurrence_group_id: groupId, source_task_id: i === 0 ? null : sourceId, task_date: dateKey(dt),
        })
        if (i === 0 && t) sourceId = t.id
      }
    }
    const opParent = await createTask({
      company_id: company.id, department_id: dept.id, title: `${dept.name} New Regional Compliance Rollout`,
      description: 'Roll out the new regional compliance checklist across the department, step by step.',
      assigned_user_id: mgrPending.row.id, assigned_by: ownerRow.id, status: 'In Progress', priority: 'High',
      due_at: localInstantOn(addDays(TODAY, 9), 17), created_at: daysAgoISO(3), task_date: dateKey(addDays(TODAY, 9)),
    })
    if (opParent) {
      await createTask({
        company_id: company.id, department_id: dept.id, parent_task_id: opParent.id, title: 'Distribute updated compliance checklist',
        description: 'Send the new checklist to every Employee in the department.',
        assigned_user_id: mgrPending.row.id, assigned_by: ownerRow.id, status: 'Complete', priority: 'High',
        due_at: localInstantOn(addDays(TODAY, 1), 17), created_at: daysAgoISO(3), completed_at: daysAgoISO(1),
        sequence_order: 1, task_date: dateKey(addDays(TODAY, 1)),
      })
      await createTask({
        company_id: company.id, department_id: dept.id, parent_task_id: opParent.id, title: 'Collect signed acknowledgement forms',
        description: 'Must happen after the checklist is distributed — collect a signed acknowledgement from every Employee.',
        assigned_user_id: mgrPending.row.id, assigned_by: ownerRow.id, status: 'Assigned', priority: 'High',
        due_at: localInstantOn(addDays(TODAY, 9), 17), created_at: daysAgoISO(3), sequence_order: 2, task_date: dateKey(addDays(TODAY, 9)),
      })
    }
    // Owner -> recruitmentSubmitter Manager: one light, low-priority, far-out task — the
    // deliberate low-workload counterpart to mgrPending above (workload rebalancing outlier pair).
    const mgrRecruit = managers.find(m => m.deptIdx === d && m.tag === 'recruitmentSubmitter')
    await createTask({
      company_id: company.id, department_id: dept.id, title: `${dept.name} Annual Policy Acknowledgement`,
      description: 'Re-read and acknowledge the updated company handbook.',
      assigned_user_id: mgrRecruit.row.id, assigned_by: ownerRow.id, status: 'Assigned', priority: 'Low',
      due_at: localInstantOn(addDays(TODAY, 20), 17), created_at: daysAgoISO(1), task_date: dateKey(addDays(TODAY, 20)),
    })
    // Manager -> normal Employee (Complete, on time) + Employee -> CW
    await createTask({
      company_id: company.id, department_id: dept.id, title: `${dept.name} Weekly Roster Handout`,
      description: 'Print and distribute the confirmed weekly roster to all on-floor staff before shift start.',
      assigned_user_id: empNormal.row.id, assigned_by: mgrVeteran.row.id, status: 'Complete', priority: 'Low',
      due_at: localInstantOn(addDays(TODAY, -1), 12), created_at: daysAgoISO(3), completed_at: localInstantOn(addDays(TODAY, -1), 10),
      task_date: dateKey(addDays(TODAY, -1)),
    })
    if (cwNormal) {
      await createTask({
        company_id: company.id, department_id: dept.id, title: `${dept.name} Floor Restocking`,
        description: 'Restock front-of-house supplies and report any shortages to your supervising Employee.',
        assigned_user_id: cwNormal.row.id, assigned_by: empNormal.row.id, status: 'In Progress', priority: 'Medium',
        due_at: localInstantOn(TODAY, 20), created_at: daysAgoISO(1), task_date: dateKey(TODAY),
      })
    }
    // Manager -> pendingRequests Employee: overdue + due-soon
    await createTask({
      company_id: company.id, department_id: dept.id, title: `${dept.name} Customer Feedback Summary`,
      description: 'Compile last week\'s customer feedback forms into a summary for the Manager.',
      assigned_user_id: empPending.row.id, assigned_by: mgrVeteran.row.id, status: 'In Progress', priority: 'Medium',
      due_at: localInstantOn(addDays(TODAY, -2), 17), created_at: daysAgoISO(6), task_date: dateKey(addDays(TODAY, -2)),
    })
    await createTask({
      company_id: company.id, department_id: dept.id, title: `${dept.name} End-of-Day Cash Reconciliation`,
      description: 'Reconcile the day\'s cash drawer against POS totals and log any discrepancy.',
      assigned_user_id: empPending.row.id, assigned_by: mgrVeteran.row.id, status: 'Assigned', priority: 'High',
      due_at: localInstantOn(TODAY, 21), created_at: daysAgoISO(0), task_date: dateKey(TODAY),
    })
    // Manager -> taskHeavy Employee: rejected, archived, parent+subtasks, recurring group, plus
    // enough extra active tasks to be the clear workload-imbalance outlier vs empNormal above.
    await createTask({
      company_id: company.id, department_id: dept.id, title: `${dept.name} Supplier Site Visit`,
      description: 'Visit the new supplier\'s warehouse to verify hygiene and safety standards before onboarding.',
      assigned_user_id: empHeavy.row.id, assigned_by: mgrVeteran.row.id, status: 'In Progress', priority: 'Medium',
      due_at: localInstantOn(addDays(TODAY, 3), 17), created_at: daysAgoISO(2), task_date: dateKey(addDays(TODAY, 3)),
      rejection_reason: 'Site visit clashes with my confirmed shift that day — please reassign or reschedule.',
      rejected_at: daysAgoISO(1), reviewed_by: mgrVeteran.row.id,
    })
    const archived = await createTask({
      company_id: company.id, department_id: dept.id, title: `${dept.name} Q1 Training Records Cleanup`,
      description: 'Archive last quarter\'s completed training sign-off sheets into the shared drive.',
      assigned_user_id: empHeavy.row.id, assigned_by: mgrVeteran.row.id, status: 'Complete', priority: 'Low',
      due_at: localInstantOn(addDays(TODAY, -20), 17), created_at: daysAgoISO(25), completed_at: daysAgoISO(21), is_archived: true,
      task_date: dateKey(addDays(TODAY, -20)),
    })
    const parent = await createTask({
      company_id: company.id, department_id: dept.id, title: `${dept.name} New Hire Onboarding Checklist`,
      description: 'Walk the new hire through orientation, systems access, and floor training in order.',
      assigned_user_id: empHeavy.row.id, assigned_by: mgrVeteran.row.id, status: 'In Progress', priority: 'High',
      due_at: localInstantOn(addDays(TODAY, 4), 17), created_at: daysAgoISO(2), task_date: dateKey(addDays(TODAY, 4)),
    })
    if (parent) {
      await createTask({
        company_id: company.id, department_id: dept.id, parent_task_id: parent.id, title: 'Complete systems access setup',
        description: 'Set up email, POS login, and rostering app access for the new hire.',
        assigned_user_id: empHeavy.row.id, assigned_by: mgrVeteran.row.id, status: 'Complete', priority: 'High',
        due_at: localInstantOn(addDays(TODAY, 2), 17), created_at: daysAgoISO(2), completed_at: daysAgoISO(1),
        sequence_order: 1, task_date: dateKey(addDays(TODAY, 2)),
      })
      await createTask({
        company_id: company.id, department_id: dept.id, parent_task_id: parent.id, title: 'Shadow a full shift on the floor',
        description: 'Must happen after systems access is set up — pairs the new hire with a veteran Employee for a full shift.',
        assigned_user_id: empHeavy.row.id, assigned_by: mgrVeteran.row.id, status: 'Assigned', priority: 'High',
        due_at: localInstantOn(addDays(TODAY, 4), 17), created_at: daysAgoISO(2), sequence_order: 2, task_date: dateKey(addDays(TODAY, 4)),
      })
    }
    // Recurring task group — daily opening checklist, past/today/future instances.
    {
      const groupId = require('crypto').randomUUID()
      const dates = [addDays(TODAY, -7), TODAY, addDays(TODAY, 7)]
      let sourceId = null
      for (const [i, dt] of dates.entries()) {
        const t = await createTask({
          company_id: company.id, department_id: dept.id, title: `${dept.name} Daily Opening Checklist`,
          description: 'Complete the opening safety and readiness checklist before the first customer.',
          assigned_user_id: empHeavy.row.id, assigned_by: mgrVeteran.row.id,
          status: i === 0 ? 'Complete' : i === 1 ? 'In Progress' : 'Assigned', priority: 'Low',
          due_at: localInstantOn(dt, 10), created_at: i === 0 ? daysAgoISO(8) : (i === 1 ? daysAgoISO(1) : daysAgoISO(0)),
          completed_at: i === 0 ? localInstantOn(dt, 9) : null,
          recurrence_group_id: groupId, source_task_id: i === 0 ? null : sourceId, task_date: dateKey(dt),
        })
        if (i === 0 && t) sourceId = t.id
      }
    }
  }
  // Task Delay Alert settings + a read/unread pair (Owner has seen one, not the other).
  await upsertOne('task_delay_alert_settings', { company_id: company.id, threshold_percent: 50, updated_by: ownerRow.id }, 'company_id', 'delay-alert-settings')
  {
    // Only the Operations "Q3 Budget Submission" delay alert is dismissed (demonstrates the
    // checkmark/read state) — the same overdue task in Marketing/Engineering/Customer Support is
    // left unread on purpose, so the bell shows real active alerts too.
    const { data: dismissedTask } = await supabase.from('tasks').select('id')
      .eq('company_id', company.id).eq('title', `${depts[0].name} Q3 Budget Submission`).maybeSingle()
    if (dismissedTask) await insertOne('task_delay_alert_reads', { task_id: dismissedTask.id, user_id: ownerRow.id, read_at: minutesAgo(30) }, 'delay-alert-read')
  }

  // A task tied to the Operations pending Employee-tier swap's shift_id + assigned_user_id, so
  // the Shift Swap review panel's "Current Task Assignment" / "Task Assignment After Swap" boxes
  // actually show something moving (attendanceRepository.getMovableTasksByShiftIds matches on
  // exactly those two fields, status Assigned/In Progress, not archived, no parent_task_id).
  {
    const { data: targetSwap } = await supabase.from('shift_swap_requests').select('id, requester_assignment_id')
      .eq('company_id', company.id).eq('requester_id', opsEmpPending.row.id).eq('status', 'pending').eq('counterpart_status', 'approved')
      .limit(1).maybeSingle()
    if (targetSwap) {
      const { data: assignment } = await supabase.from('shift_assignments').select('shift_id').eq('id', targetSwap.requester_assignment_id).maybeSingle()
      if (assignment) {
        await createTask({
          company_id: company.id, department_id: depts[0].id, shift_id: assignment.shift_id,
          title: 'Operations Opening Float Count', description: 'Count and log the opening cash float before the floor opens for that shift.',
          assigned_user_id: opsEmpPending.row.id, assigned_by: opsMgrVeteran.row.id, status: 'Assigned', priority: 'Medium',
          due_at: localInstantOn(addDays(TODAY, 3), 9), created_at: minutesAgo(50), task_date: dateKey(addDays(TODAY, 3)),
        })
      }
    }
  }
  console.log('  ✓ Tasks + Task Templates seeded')

  // ═════════════════════════════════════════════════════════════════════════
  // Step 13: Recruitment — job templates, postings, applicants, invitations, guests
  // ═════════════════════════════════════════════════════════════════════════
  console.log('\nStep 13: creating Guest User accounts...')
  const guestRows = {}
  for (const g of GUESTS) {
    const row = await createAccount({ email: g.email, full_name: g.full_name, role: 'Guest User', phone: g.phone, dob: g.dob, company_id: null })
    guestRows[g.email] = row
    await insertOne('casual_worker_profiles', {
      user_id: row.id, skills: g.skills, resume_url: `https://example.com/demo-resumes/${g.email.split('@')[0]}-resume.pdf`,
    }, g.email)
    await insertOne('user_certificates', { user_id: row.id, name: 'First Aid Certificate', certificate_url: `https://example.com/demo-certs/${g.email.split('@')[0]}-cert.pdf` }, g.email)
  }
  console.log(`  ✓ ${GUESTS.length} Guest User accounts created`)

  console.log('\nStep 13b: seeding Job Templates + Job Postings...')
  const jobTemplates = []
  const jobTemplateDefs = [
    { deptIdx: 0, title: 'Event Server', responsibilities: 'Set up event floor, serve food and beverages to guests, clear tables, assist with breakdown after the event.', skills: 'Customer service, Food handling, Teamwork', job_type: 'shift', salary_amount: 12, experience_required: 'No experience needed, training provided', minimum_age: 18, uniform_type: 'company', uniform_details: 'Black polo and black pants provided on-site.', estimated_hours: '6', urgency: 'normal', createdByEmail: 'owner@test.com' },
    { deptIdx: 1, title: 'Promotional Booth Staff', responsibilities: 'Engage passing customers at the promotional booth, distribute flyers and samples, log lead contact details.', skills: 'Communication, Sales pitch, Basic Excel', job_type: 'oneoff', salary_amount: 13, experience_required: '6 months in retail or promotions preferred', minimum_age: 18, uniform_type: 'dress_code', uniform_details: 'Smart casual, company polo provided.', estimated_hours: '4', urgency: 'high', createdByEmail: 'partner1@test.com' },
    { deptIdx: 2, title: 'IT Support Assistant', responsibilities: 'Assist with hardware setup, cable management, and basic troubleshooting for office IT equipment.', skills: 'PC hardware, Networking basics, Documentation', job_type: 'oneoff', salary_amount: 15, experience_required: '1 year IT support experience', minimum_age: 18, uniform_type: 'none', uniform_details: null, estimated_hours: '8', urgency: 'normal', createdByEmail: null },
    { deptIdx: 3, title: 'Customer Service Officer', responsibilities: 'Handle walk-in customer enquiries, process refund requests, and escalate complaints to the duty Manager.', skills: 'Customer service, CRM tools, Conflict resolution', job_type: 'shift', salary_amount: 12.5, experience_required: 'No experience needed, training provided', minimum_age: 18, uniform_type: 'company', uniform_details: 'Company vest provided.', estimated_hours: '8', urgency: 'normal', createdByEmail: null },
  ]
  for (const def of jobTemplateDefs) {
    const creatorId = def.createdByEmail ? userMap[def.createdByEmail].id : managers.find(m => m.deptIdx === def.deptIdx && m.tag === 'recruitmentSubmitter').row.id
    const tpl = await insertOne('job_templates', {
      company_id: company.id, department_id: depts[def.deptIdx].id, title: def.title, responsibilities: def.responsibilities,
      skills: def.skills, job_type: def.job_type, created_by: creatorId, salary_amount: def.salary_amount,
      experience_required: def.experience_required, minimum_age: def.minimum_age, uniform_type: def.uniform_type,
      uniform_details: def.uniform_details, estimated_hours: def.estimated_hours, urgency: def.urgency,
    }, def.title)
    jobTemplates.push(tpl)
  }

  async function createPosting(def) {
    return insertOne('job_postings', {
      company_id: company.id, department_id: depts[def.deptIdx].id, created_by: def.createdBy, title: def.title,
      responsibilities: def.responsibilities, skills: def.skills, status: def.status, job_type: def.job_type,
      salary_amount: def.salary_amount, openings: def.openings ?? 1, urgency: def.urgency ?? 'normal',
      job_date: def.job_date ?? null, job_start_time: def.job_start_time ?? null, job_end_time: def.job_end_time ?? null,
      break_start_time: def.break_start_time ?? null, break_end_time: def.break_end_time ?? null,
      estimated_hours: def.estimated_hours ?? null, expires_at: def.expires_at ?? null,
      experience_required: def.experience_required, minimum_age: def.minimum_age ?? 18,
      uniform_type: def.uniform_type ?? 'none', uniform_details: def.uniform_details ?? null,
      template_id: def.template_id ?? null, rejection_reason: def.rejection_reason ?? null, rejected_by: def.rejected_by ?? null,
      archived_at: def.archived_at ?? null, archived_from_status: def.archived_from_status ?? null,
      assigned_employee_id: def.assigned_employee_id ?? null,
      // Report's Hiring Success Rate / Average Time to Fill filter job_postings by created_at
      // falling inside the selected date range — default to "a few days ago" so these land inside
      // whatever recent window the Report page opens to, instead of "right now" (script run time).
      created_at: def.createdAt ?? daysAgoISO(rand(2, 6)),
    }, def.title)
  }

  const opsMgrRecruit = managers.find(m => m.deptIdx === 0 && m.tag === 'recruitmentSubmitter')
  const mktMgrRecruit = managers.find(m => m.deptIdx === 1 && m.tag === 'recruitmentSubmitter')

  const p1 = await createPosting({
    deptIdx: 0, createdBy: ownerRow.id, title: 'Weekend Event Servers', template_id: jobTemplates[0]?.id ?? null,
    responsibilities: 'Set up event floor, serve food and beverages to guests, clear tables, assist with breakdown after the event.',
    skills: 'Customer service, Food handling, Teamwork', status: 'open', job_type: 'shift', salary_amount: 12,
    openings: 3, urgency: 'high', job_date: dateKey(addDays(TODAY, 6)), job_start_time: '17:00', job_end_time: '23:00',
    break_start_time: '19:30', break_end_time: '20:00', experience_required: 'No experience needed, training provided',
    expires_at: dateKey(addDays(TODAY, 5)), uniform_type: 'company', uniform_details: 'Black polo and black pants provided on-site.',
  })
  const p2 = await createPosting({
    deptIdx: 0, createdBy: opsMgrRecruit.row.id, title: 'Warehouse Stocktake Assistant', status: 'draft', job_type: 'oneoff',
    responsibilities: 'Assist with the quarterly warehouse stocktake — counting, labelling and data entry.',
    skills: 'Attention to detail, Basic Excel', salary_amount: 13, estimated_hours: '6',
    experience_required: 'No experience needed', job_date: dateKey(addDays(TODAY, 12)), job_start_time: '09:00',
  })
  const p3 = await createPosting({
    deptIdx: 1, createdBy: mktMgrRecruit.row.id, title: 'Social Media Content Creator', status: 'pending_approval', job_type: 'shift',
    responsibilities: 'Film and edit short-form video content for the company\'s social media channels during the campaign week.',
    skills: 'Video editing, Canva, TikTok/Instagram Reels', salary_amount: 16, job_date: dateKey(addDays(TODAY, 9)),
    job_start_time: '10:00', job_end_time: '18:00', experience_required: '6 months content creation experience',
    expires_at: dateKey(addDays(TODAY, 8)),
  })
  const p4 = await createPosting({
    deptIdx: 1, createdBy: mktMgrRecruit.row.id, title: 'Promotional Event Staff', status: 'rejected', job_type: 'oneoff',
    responsibilities: 'Engage passing customers at the mall promotional booth, distribute flyers and samples.',
    skills: 'Communication, Sales pitch', salary_amount: 13, estimated_hours: '4', job_date: dateKey(addDays(TODAY, 10)),
    job_start_time: '11:00', rejection_reason: 'Budget for this campaign was cut — please resubmit if it gets re-approved next quarter.',
    rejected_by: ownerRow.id,
  })
  const p5 = await createPosting({
    deptIdx: 2, createdBy: ownerRow.id, title: 'IT Support Assistant', status: 'open', job_type: 'oneoff',
    responsibilities: 'Assist with hardware setup, cable management, and basic troubleshooting for a new office rollout.',
    skills: 'PC hardware, Networking basics, Documentation', salary_amount: 15, estimated_hours: '8',
    job_date: dateKey(addDays(TODAY, 4)), job_start_time: '09:00', experience_required: '1 year IT support experience',
    expires_at: dateKey(addDays(TODAY, 3)),
  })
  // p6/p7/p8/p10's whole lifecycle (created -> applied -> confirmed -> closed) is deliberately
  // compressed into the Report page's default 7-day window (today-7 .. yesterday, see
  // ReportView.tsx DEFAULT_FROM/YESTERDAY) so Hiring Success Rate / Average Time to Fill have
  // real numbers to show the moment Owner opens the page, without changing the date pickers.
  const p6 = await createPosting({
    deptIdx: 2, createdBy: ownerRow.id, title: 'Server Room Cabling Project', status: 'closed', job_type: 'oneoff',
    responsibilities: 'Ran structured cabling for the new server room and labelled every port.',
    skills: 'Networking, Cable management', salary_amount: 16, estimated_hours: '10', job_date: dateKey(addDays(TODAY, -2)),
    job_start_time: '09:00', experience_required: '1 year IT support experience', archived_at: daysAgoISO(2),
    createdAt: daysAgoISO(7),
  })
  const p7 = await createPosting({
    deptIdx: 3, createdBy: ownerRow.id, title: 'Holiday Season Support Officers', status: 'closed', job_type: 'shift',
    responsibilities: 'Handle the seasonal spike in walk-in customer enquiries and refund requests.',
    skills: 'Customer service, CRM tools', salary_amount: 12.5, openings: 2, job_date: dateKey(addDays(TODAY, -1)),
    job_start_time: '10:00', job_end_time: '18:00', experience_required: 'No experience needed, training provided',
    archived_at: daysAgoISO(2), createdAt: daysAgoISO(6),
  })
  const p8 = await createPosting({
    deptIdx: 3, createdBy: ownerRow.id, title: 'Year-End Sale Extra Hands', status: 'archived', job_type: 'oneoff',
    responsibilities: 'Extra floor support for the year-end clearance sale — restocking and queue management.',
    skills: 'Customer service, Retail merchandising', salary_amount: 13, estimated_hours: '6', job_date: dateKey(addDays(TODAY, -3)),
    job_start_time: '09:00', experience_required: 'No experience needed', archived_at: daysAgoISO(2), archived_from_status: 'closed',
    createdAt: daysAgoISO(7),
  })
  const p9 = await createPosting({
    deptIdx: 3, createdBy: ownerRow.id, title: 'Weekend Inventory Counter', status: 'open', job_type: 'oneoff',
    responsibilities: 'Count and reconcile back-of-house inventory against the system before the weekend sale.',
    skills: 'Attention to detail, Basic Excel', salary_amount: 13, estimated_hours: '5', job_date: dateKey(addDays(TODAY, -2)),
    job_start_time: '09:00', experience_required: 'No experience needed', expires_at: dateKey(addDays(TODAY, -1)),
  })
  console.log('  ✓ 9 Job Postings + 4 Job Templates seeded')

  console.log('\nStep 13c: seeding Job Applicants + Invitations + promotions...')
  async function applyTo(posting, guestEmail, status, extra = {}) {
    const guest = guestRows[guestEmail]
    const gDef = GUESTS.find(g => g.email === guestEmail)
    return insertOne('job_applicants', {
      job_id: posting.id, user_id: guest.id, resume: `https://example.com/demo-resumes/${guestEmail.split('@')[0]}-resume.pdf`,
      status, applied_at: extra.applied_at ?? daysAgoISO(rand(1, 5)), additional_note: extra.additional_note ?? 'Available to start immediately, flexible with hours.',
      skills: gDef.skills, certificates: [{ name: 'First Aid Certificate', certificate_url: `https://example.com/demo-certs/${guestEmail.split('@')[0]}-cert.pdf` }],
      ai_summary: extra.ai_summary ?? null, ai_computed_at: extra.ai_computed_at ?? null, decided_at: extra.decided_at ?? null,
    }, `${guestEmail}->${posting.title}`)
  }
  async function promoteGuestToCw(guestEmail, deptIdx) {
    const guest = guestRows[guestEmail]
    await supabase.from('users').update({ role: 'Casual Worker', company_id: company.id }).eq('id', guest.id)
    await upsertOne('casualworker_departments', { casual_worker_id: guest.id, department_id: depts[deptIdx].id, company_id: company.id }, 'casual_worker_id,department_id', `${guestEmail}-promoted`)
    const firstShiftDate = addDays(TODAY, 3)
    const shift = await insertOne('shifts', {
      company_id: company.id, department_id: depts[deptIdx].id, shift_date: dateKey(firstShiftDate), start_time: '17:00', end_time: '23:00',
      status: 'active', publication_status: 'published', created_by: ownerRow.id, hourly_rate: 12,
    }, `${guestEmail}-first-shift`)
    if (shift) await insertOne('shift_assignments', { shift_id: shift.id, user_id: guest.id, assigned_by: ownerRow.id }, `${guestEmail}-first-assignment`)
  }

  // P1 (Operations OPEN) — full applicant-list variety on one popular posting.
  await applyTo(p1, 'guest1@test.com', 'pending', { ai_summary: 'Strong fit: prior event-floor experience and forklift certification exceed requirements.', ai_computed_at: minutesAgo(120) })
  const p1g2 = await applyTo(p1, 'guest2@test.com', 'accepted')
  if (p1g2) await insertOne('job_invitations', { job_id: p1.id, applicant_id: p1g2.id, sent_by: ownerRow.id, status: 'sent', sent_at: daysAgoISO(1) }, 'guest2-invite')
  const p1g3 = await applyTo(p1, 'guest3@test.com', 'accepted', { ai_summary: 'Excellent fit: event setup and stage rigging experience directly match the role.', ai_computed_at: minutesAgo(90) })
  if (p1g3) await insertOne('job_invitations', { job_id: p1.id, applicant_id: p1g3.id, sent_by: ownerRow.id, status: 'accepted', sent_at: daysAgoISO(2), responded_at: daysAgoISO(1) }, 'guest3-invite')
  await promoteGuestToCw('guest3@test.com', 0)
  await applyTo(p1, 'guest5@test.com', 'withdrawn', { decided_at: daysAgoISO(1) })
  await applyTo(p1, 'guest7@test.com', 'rejected', { decided_at: daysAgoISO(1) })

  // P5 (Engineering OPEN) — accepted-then-declined, and confirmed-hire promotion.
  const p5g4 = await applyTo(p5, 'guest4@test.com', 'accepted')
  if (p5g4) await insertOne('job_invitations', { job_id: p5.id, applicant_id: p5g4.id, sent_by: ownerRow.id, status: 'declined', sent_at: daysAgoISO(3), responded_at: daysAgoISO(2) }, 'guest4-invite')
  const p5g9 = await applyTo(p5, 'guest9@test.com', 'accepted', { ai_summary: 'Strong fit: technical support background matches the IT project scope.', ai_computed_at: minutesAgo(200) })
  if (p5g9) await insertOne('job_invitations', { job_id: p5.id, applicant_id: p5g9.id, sent_by: ownerRow.id, status: 'accepted', sent_at: daysAgoISO(2), responded_at: daysAgoISO(1) }, 'guest9-invite')
  await promoteGuestToCw('guest9@test.com', 2)

  // P6 / P8 — historical confirmed hires on already-closed/archived postings (existing CWs).
  const engLiveCw = casuals.find(c => c.tag === 'liveReleased') // casual11, Engineering
  const csLiveCw = casuals.find(c => c.tag === 'liveAwaitingRelease') // casual16, Customer Support
  const p6applicant = await insertOne('job_applicants', {
    job_id: p6.id, user_id: engLiveCw.row.id, resume: `https://example.com/demo-resumes/${engLiveCw.email.split('@')[0]}-resume.pdf`,
    status: 'accepted', applied_at: daysAgoISO(6), skills: pick(CW_SKILLS, 2), certificates: [],
  }, 'p6-historical-applicant')
  if (p6applicant) await insertOne('job_invitations', { job_id: p6.id, applicant_id: p6applicant.id, sent_by: ownerRow.id, status: 'accepted', sent_at: daysAgoISO(5), responded_at: daysAgoISO(4) }, 'p6-historical-invite')
  const p8applicant = await insertOne('job_applicants', {
    job_id: p8.id, user_id: csLiveCw.row.id, resume: `https://example.com/demo-resumes/${csLiveCw.email.split('@')[0]}-resume.pdf`,
    status: 'accepted', applied_at: daysAgoISO(6), skills: pick(CW_SKILLS, 3), certificates: [],
  }, 'p8-historical-applicant')
  if (p8applicant) await insertOne('job_invitations', { job_id: p8.id, applicant_id: p8applicant.id, sent_by: ownerRow.id, status: 'accepted', sent_at: daysAgoISO(5), responded_at: daysAgoISO(3) }, 'p8-historical-invite')

  // P7 — employer closed the posting while guest6 was still pending.
  await applyTo(p7, 'guest6@test.com', 'job_closed', { applied_at: daysAgoISO(6), decided_at: daysAgoISO(3) })

  // guest8 — rich profile, browses the job board, never applies to anything (no job_applicants row).

  // job_cancellations — Remove Worker (employer) vs Cancel Job (worker), on two confirmed hires
  // from a separate closed Marketing posting so it never collides with P1-P9's live states.
  const p10 = await createPosting({
    deptIdx: 1, createdBy: ownerRow.id, title: 'Weekend Promo Booth Staff', status: 'closed', job_type: 'shift',
    responsibilities: 'Staff the weekend promotional booth at the mall atrium, engage shoppers and log leads.',
    skills: 'Communication, Sales pitch', salary_amount: 13, openings: 2, job_date: dateKey(addDays(TODAY, -2)),
    job_start_time: '11:00', job_end_time: '19:00', experience_required: 'No experience needed', archived_at: daysAgoISO(2),
    createdAt: daysAgoISO(6),
  })
  const mktCw1 = casuals.find(c => c.deptIdx === 1 && c.tag === 'normal')
  const mktCw2 = casuals[casuals.findIndex(c => c === mktCw1) + 1] ?? casuals.find(c => c.deptIdx === 1)
  const p10applicant1 = await insertOne('job_applicants', { job_id: p10.id, user_id: mktCw1.row.id, resume: `https://example.com/demo-resumes/${mktCw1.email.split('@')[0]}-resume.pdf`, status: 'cancelled_by_employer', applied_at: daysAgoISO(5), decided_at: daysAgoISO(3), skills: pick(CW_SKILLS, 1), certificates: [] }, 'p10-applicant1')
  const p10applicant2 = await insertOne('job_applicants', { job_id: p10.id, user_id: mktCw2.row.id, resume: `https://example.com/demo-resumes/${mktCw2.email.split('@')[0]}-resume.pdf`, status: 'cancelled_by_employer', applied_at: daysAgoISO(5), decided_at: daysAgoISO(3), skills: pick(CW_SKILLS, 4), certificates: [] }, 'p10-applicant2')
  if (p10applicant1) await insertOne('job_cancellations', { job_id: p10.id, applicant_id: p10applicant1.id, cancelled_by: opsMgrRecruit.row.id, cancelled_role: 'employer', reason: 'Booth footprint was reduced by the mall — one fewer position needed.' }, 'cancellation-employer')
  if (p10applicant2) await insertOne('job_cancellations', { job_id: p10.id, applicant_id: p10applicant2.id, cancelled_by: mktCw2.row.id, cancelled_role: 'worker', reason: 'Worker found a scheduling conflict with another confirmed shift.' }, 'cancellation-worker')

  console.log('  ✓ Job Applicants + Invitations + Cancellations seeded, 2 Guests promoted to Casual Worker')

  // ═════════════════════════════════════════════════════════════════════════
  // Step 14: Communication — announcements, reads, messages
  // ═════════════════════════════════════════════════════════════════════════
  console.log('\nStep 14: seeding Announcements + Messages...')
  const partner1Row = (await supabase.from('users').select('id, full_name').eq('email_address', 'partner1@test.com').single()).data
  const partner2Row = (await supabase.from('users').select('id, full_name').eq('email_address', 'partner2@test.com').single()).data

  const annCompanyWide1 = await insertOne('announcements', {
    user_id: ownerRow.id, company_id: company.id, audience_department_id: null,
    title: 'Public Holiday Roster Reminder', content: 'Please submit your Fixed Day Off requests for the upcoming public holiday week by this Sunday 8am. Rosters will be finalised and published Monday morning.',
    created_at: daysAgoISO(4),
  }, 'ann-company-1')
  await insertOne('announcements', {
    user_id: partner1Row.id, company_id: company.id, audience_department_id: null,
    title: 'New Employee Benefits Portal Live', content: 'The new employee benefits self-service portal is now live. Log in with your company email to view leave balances and claim forms.',
    created_at: daysAgoISO(10), updated_at: daysAgoISO(2),
  }, 'ann-company-2')
  const deptAnnouncements = []
  for (let d = 0; d < 4; d++) {
    const mgr = managers.find(m => m.deptIdx === d && m.tag === 'veteran')
    const ann = await insertOne('announcements', {
      user_id: mgr.row.id, company_id: company.id, audience_department_id: depts[d].id,
      title: `${depts[d].name} Team Huddle This Friday`, content: `Quick 15-minute huddle this Friday before shift start to walk through next week's priorities and any open coverage gaps. Attendance for all ${depts[d].name} staff is expected.`,
      created_at: daysAgoISO(rand(1, 6)),
    }, `ann-dept-${d}`)
    deptAnnouncements.push(ann)
  }
  // Mixed read/unread: everyone in Operations has read the company-wide announcement, Marketing has not.
  if (annCompanyWide1) {
    const opsReaders = [...managers, ...employees].filter(s => s.deptIdx === 0)
    await insertMany('announcement_reads', opsReaders.map(s => ({ user_id: s.row.id, announcement_id: annCompanyWide1.id })), 'ann-reads')
  }

  const messagePairs = [
    { fromEmail: 'owner@test.com', fromId: ownerRow.id, fromName: ownerRow.full_name, toId: partner1Row.id, toName: partner1Row.full_name, content: 'Can you review the Marketing job posting rejection before end of day? Budget question came up.', isRead: true, createdAt: daysAgoISO(2) },
    { fromId: partner1Row.id, fromName: partner1Row.full_name, toId: ownerRow.id, toName: ownerRow.full_name, content: 'Reviewed — agree with the rejection, let\'s revisit next quarter.', isRead: false, createdAt: daysAgoISO(2) },
    { fromId: opsMgrVeteran.row.id, fromName: opsMgrVeteran.row.full_name, toId: opsEmpNormal.row.id, toName: opsEmpNormal.row.full_name, content: 'Can you cover the floor briefing tomorrow morning? I have a supplier call.', isRead: true, createdAt: daysAgoISO(1) },
    { fromId: opsEmpNormal.row.id, fromName: opsEmpNormal.row.full_name, toId: opsMgrVeteran.row.id, toName: opsMgrVeteran.row.full_name, content: 'Sure, no problem — I\'ll open the briefing at 9am.', isRead: false, createdAt: daysAgoISO(1) },
    { fromId: opsEmpNormal.row.id, fromName: opsEmpNormal.row.full_name, toId: casuals.find(c => c.tag === 'liveOnBreak').row.id, toName: casuals.find(c => c.tag === 'liveOnBreak').row.full_name, content: 'Reminder to log your break times accurately on the app today, thanks!', isRead: false, createdAt: minutesAgo(90) },
    { fromId: partner2Row.id, fromName: partner2Row.full_name, toId: managers.find(m => m.deptIdx === 2 && m.tag === 'recruitmentSubmitter').row.id, toName: managers.find(m => m.deptIdx === 2 && m.tag === 'recruitmentSubmitter').row.full_name, content: 'The IT Support Assistant posting looks good — go ahead and publish once you confirm the start date.', isRead: true, createdAt: daysAgoISO(3) },
  ]
  await insertMany('messages', messagePairs.map(m => ({ from_user_id: m.fromId, to_user_id: m.toId, company_id: company.id, content: m.content, is_read: m.isRead, created_at: m.createdAt, sender_name: m.fromName })), 'messages')
  console.log('  ✓ Announcements + Messages seeded')

  // ═════════════════════════════════════════════════════════════════════════
  // Step 15: Company Activity Log
  // ═════════════════════════════════════════════════════════════════════════
  console.log('\nStep 15: seeding Company Activity Log...')
  // Only 5 action values are actually recognized by the Activity Log renderer
  // (src/components/team/TeamView.tsx describeActivityLog) — invite_member / remove_member /
  // set_active / set_inactive / change_department. Anything else renders as a generic untitled
  // gray entry, so every row here must use one of these exact strings.
  const inactiveCw1 = casuals.find(c => c.deptIdx === 1 && c.tag === 'inactive')
  const inactiveCw2 = casuals.find(c => c.deptIdx === 3 && c.tag === 'inactive')
  const reactivatedCw = casuals.find(c => c.deptIdx === 2 && c.tag === 'normal')
  const movedEmployee = employees.find(e => e.deptIdx === 3 && e.tag === 'normal')
  const activityRows = [
    { action: 'invite_member', target_name: 'partner2@test.com', detail: 'Sent Partner invitation code.', actor_id: ownerRow.id, created_at: daysAgoISO(60) },
    { action: 'invite_member', target_name: 'manager1@test.com', detail: 'Sent Manager invitation code for Operations.', actor_id: ownerRow.id, created_at: daysAgoISO(75) },
    { action: 'invite_member', target_name: 'unfilled.applicant@example.com', detail: 'Sent Employee invitation code for Marketing — code expired unused.', actor_id: managers.find(m => m.deptIdx === 1 && m.tag === 'veteran').row.id, created_at: daysAgoISO(9) },
    { action: 'remove_member', target_name: 'Wei Siong Lam', detail: 'Removed from Engineering — resigned.', actor_id: ownerRow.id, created_at: daysAgoISO(40) },
    { action: 'change_department', target_name: movedEmployee.row.full_name, detail: 'Moved from Marketing to Customer Support.', actor_id: ownerRow.id, target_id: movedEmployee.row.id, created_at: daysAgoISO(45) },
    { action: 'set_inactive', target_name: inactiveCw1.row.full_name, detail: 'Marked inactive after repeated no-shows without notice.', actor_id: ownerRow.id, target_id: inactiveCw1.row.id, created_at: daysAgoISO(3) },
    { action: 'set_inactive', target_name: inactiveCw2.row.full_name, detail: 'Marked inactive after repeated no-shows without notice.', actor_id: ownerRow.id, target_id: inactiveCw2.row.id, created_at: daysAgoISO(3) },
    { action: 'set_active', target_name: reactivatedCw.row.full_name, detail: 'Reactivated after a short break — cleared for scheduling again.', actor_id: ownerRow.id, target_id: reactivatedCw.row.id, created_at: daysAgoISO(30) },
  ]
  await insertMany('company_activity_logs', activityRows.map(r => ({ ...r, company_id: company.id })), 'activity-log')
  console.log('  ✓ Company Activity Log seeded')

  // ═════════════════════════════════════════════════════════════════════════
  // Step 16: Invitation codes (open, used, expired)
  // ═════════════════════════════════════════════════════════════════════════
  console.log('\nStep 16: seeding invitation codes...')
  await insertOne('invitation_code', { code: '48291', company_id: company.id, department_id: depts[0].id, role: 'Employee', status: 'Active', generated_by: opsMgrVeteran.row.id, created_at: daysAgoISO(1), expired_at: daysFromNowISO(6) }, 'invite-employee-active')
  await insertOne('invitation_code', { code: '73650', company_id: company.id, department_id: depts[1].id, role: 'Manager', status: 'Active', generated_by: ownerRow.id, created_at: daysAgoISO(2), expired_at: daysFromNowISO(5) }, 'invite-manager-active')
  await insertOne('invitation_code', { code: 'A1B2C3D4', company_id: company.id, department_id: null, role: 'Partner', status: 'Expired', generated_by: ownerRow.id, used_by: partner2Row.id, created_at: daysAgoISO(60), expired_at: daysAgoISO(53) }, 'invite-partner-used')
  await insertOne('invitation_code', { code: '19204', company_id: company.id, department_id: depts[2].id, role: 'Employee', status: 'Active', generated_by: ownerRow.id, created_at: daysAgoISO(9), expired_at: daysAgoISO(2) }, 'invite-expired')
  console.log('  ✓ Invitation codes seeded')

  // ═════════════════════════════════════════════════════════════════════════
  // Step 17: Secondary companies (Module 10 / User Admin demo data)
  // ═════════════════════════════════════════════════════════════════════════
  console.log('\nStep 17: seeding secondary companies for User Admin (Module 10)...')

  async function createSecondaryCompany({ slug, name, description, location, address, postalCode, industry, deptName, deptColor, suspendCompany, suspendUserSlot }) {
    const ownerRow2 = await createAccount({ email: `owner${slug}@test.com`, full_name: `${name.split(' ')[0]} Owner`, role: 'Owner', phone: `+65 9${slug.charCodeAt(0)}00 1000`, dob: '1985-04-10' })
    const comp = await insertOne('companies', {
      name, owner_id: ownerRow2.id, description, location, address, postal_code: postalCode, industry, size: '1-10', plan: 'Free',
      plan_started_at: daysAgoISO(30),
      suspended_at: suspendCompany ? daysAgoISO(2) : null,
      suspended_reason: suspendCompany ? 'Payment failure — subscription invoice unpaid for over 45 days.' : null,
    }, name)
    await supabase.from('users').update({ company_id: comp.id }).eq('id', ownerRow2.id)
    const dept = await insertOne('departments', { name: deptName, color: deptColor, company_id: comp.id }, deptName)

    const mgr = await createAccount({ email: `manager${slug}1@test.com`, full_name: `${deptName} Manager`, role: 'Manager', phone: `+65 9${slug.charCodeAt(0)}00 2000`, dob: '1988-06-14', company_id: comp.id })
    const emp1 = await createAccount({ email: `employee${slug}1@test.com`, full_name: `${deptName} Staff One`, role: 'Employee', phone: `+65 8${slug.charCodeAt(0)}00 3000`, dob: '1994-02-20', company_id: comp.id })
    const emp2 = await createAccount({ email: `employee${slug}2@test.com`, full_name: `${deptName} Staff Two`, role: 'Employee', phone: `+65 8${slug.charCodeAt(0)}00 3001`, dob: '1996-09-05', company_id: comp.id })
    const cw1 = await createAccount({ email: `casual${slug}1@test.com`, full_name: `${deptName} Casual One`, role: 'Casual Worker', phone: `+65 8${slug.charCodeAt(0)}00 4000`, dob: '1999-01-12', company_id: comp.id })
    const cw2 = await createAccount({ email: `casual${slug}2@test.com`, full_name: `${deptName} Casual Two`, role: 'Casual Worker', phone: `+65 8${slug.charCodeAt(0)}00 4001`, dob: '2000-07-23', company_id: comp.id })

    if (suspendUserSlot === 'emp2') {
      await supabase.from('users').update({ is_suspended: true, suspended_at: daysAgoISO(1), suspended_reason: 'Suspended pending investigation into a customer complaint.' }).eq('id', emp2.id)
    }

    await insertOne('manager_departments', { manager_id: mgr.id, department_id: dept.id, company_id: comp.id }, `${slug}-mgr-dept`)
    await insertMany('employee_departments', [emp1, emp2].map(e => ({ employee_id: e.id, department_id: dept.id, company_id: comp.id })), `${slug}-emp-dept`)
    await insertMany('casualworker_departments', [cw1, cw2].map(c => ({ casual_worker_id: c.id, department_id: dept.id, company_id: comp.id, verified_at: daysAgoISO(10) })), `${slug}-cw-dept`)
    for (const cw of [cw1, cw2]) {
      await insertOne('casual_worker_profiles', { user_id: cw.id, payment_method: 'PayNow', payment_account: cw.phone_number, skills: 'General labour, Customer service', resume_url: `https://example.com/demo-resumes/${cw.email_address.split('@')[0]}-resume.pdf` }, cw.email_address)
    }

    const weekDates = weekdaysInHistory.slice(-5)
    const staff = [mgr, emp1, emp2]
    for (const s of staff) {
      const shifts = await insertMany('shifts', weekDates.map(d => ({ company_id: comp.id, department_id: dept.id, shift_date: dateKey(d), start_time: '09:00', end_time: '17:00', status: 'active', publication_status: 'published', created_by: ownerRow2.id })), `${slug}-${s.email_address}-shifts`)
      const assignments = await insertMany('shift_assignments', shifts.map(sh => ({ shift_id: sh.id, user_id: s.id, assigned_by: ownerRow2.id })), `${slug}-${s.email_address}-assignments`)
      await insertMany('attendance_records', assignments.map((a, i) => ({ shift_assignment_id: a.id, user_id: s.id, clock_in_time: sgtInstantISO(shifts[i].shift_date, '09:00'), clock_out_time: sgtInstantISO(shifts[i].shift_date, '17:00') })), `${slug}-${s.email_address}-attendance`)
    }
    for (const cw of [cw1, cw2]) {
      const shifts = await insertMany('shifts', weekDates.slice(0, 2).map(d => ({ company_id: comp.id, department_id: dept.id, shift_date: dateKey(d), start_time: '10:00', end_time: '16:00', status: 'active', publication_status: 'published', created_by: ownerRow2.id, hourly_rate: 12 })), `${slug}-${cw.email_address}-shifts`)
      const assignments = await insertMany('shift_assignments', shifts.map(sh => ({ shift_id: sh.id, user_id: cw.id, assigned_by: ownerRow2.id })), `${slug}-${cw.email_address}-assignments`)
      await insertMany('attendance_records', assignments.map((a, i) => ({ shift_assignment_id: a.id, user_id: cw.id, clock_in_time: sgtInstantISO(shifts[i].shift_date, '10:00'), clock_out_time: sgtInstantISO(shifts[i].shift_date, '16:00') })), `${slug}-${cw.email_address}-attendance`)
    }

    const secTask1 = await insertOne('tasks', { company_id: comp.id, department_id: dept.id, title: `${deptName} Opening Checklist`, description: 'Complete the opening safety and readiness checklist.', assigned_user_id: emp1.id, assigned_by: mgr.id, status: 'Complete', priority: 'Medium', due_at: localInstantOn(addDays(TODAY, -1), 10), completed_at: localInstantOn(addDays(TODAY, -1), 9), task_date: dateKey(addDays(TODAY, -1)) }, `${slug}-task1`)
    if (secTask1) await insertOne('task_assignments', { task_id: secTask1.id, user_id: emp1.id, assigned_by: mgr.id }, `${slug}-task1-assignment`)
    const secTask2 = await insertOne('tasks', { company_id: comp.id, department_id: dept.id, title: `${deptName} Stock Reorder`, description: 'Review low-stock items and place the weekly reorder.', assigned_user_id: emp2.id, assigned_by: mgr.id, status: 'In Progress', priority: 'High', due_at: localInstantOn(TODAY, 18), task_date: dateKey(TODAY) }, `${slug}-task2`)
    if (secTask2) await insertOne('task_assignments', { task_id: secTask2.id, user_id: emp2.id, assigned_by: mgr.id }, `${slug}-task2-assignment`)

    const posting = await insertOne('job_postings', { company_id: comp.id, department_id: dept.id, created_by: ownerRow2.id, title: `${deptName} Weekend Helper`, responsibilities: 'General weekend support across the floor and back-of-house.', skills: 'Customer service, Teamwork', status: 'open', job_type: 'oneoff', salary_amount: 11, openings: 1, estimated_hours: '5', job_date: dateKey(addDays(TODAY, 5)), job_start_time: '10:00', experience_required: 'No experience needed', minimum_age: 18, uniform_type: 'none' }, `${slug}-posting`)
    if (posting) {
      await insertOne('job_applicants', { job_id: posting.id, user_id: cw1.id, resume: `https://example.com/demo-resumes/${cw1.email_address.split('@')[0]}-resume.pdf`, status: 'pending', skills: 'General labour, Customer service', certificates: [] }, `${slug}-applicant`)
    }

    await insertOne('announcements', { user_id: ownerRow2.id, company_id: comp.id, audience_department_id: null, title: 'Welcome to the Team', content: `Welcome aboard! Please review the ${deptName} handbook and reach out to your Manager with any questions.`, created_at: daysAgoISO(20) }, `${slug}-announcement`)
    await insertMany('company_activity_logs', [
      { company_id: comp.id, actor_id: ownerRow2.id, action: 'department_created', target_name: deptName, detail: 'Department created during company setup.', created_at: daysAgoISO(30) },
      { company_id: comp.id, actor_id: ownerRow2.id, action: 'invitation_sent', target_name: mgr.email_address, detail: 'Sent Manager invitation code.', created_at: daysAgoISO(28) },
    ], `${slug}-activity`)

    return comp
  }

  await createSecondaryCompany({
    slug: 'b', name: 'Bright Leaf Cafe', description: 'An independent neighbourhood cafe running weekend brunch service with a small casual-worker pool.',
    location: 'Tiong Bahru', address: '78 Yong Siak Street, Singapore 168645', postalCode: '168645', industry: 'Food & Beverage',
    deptName: 'Cafe Operations', deptColor: '#8B5CF6', suspendCompany: false, suspendUserSlot: 'emp2',
  })
  await createSecondaryCompany({
    slug: 'c', name: 'Coastal Logistics Pte Ltd', description: 'A small last-mile delivery and warehousing operation.',
    location: 'Tuas', address: '12 Tuas Avenue 8, Singapore 639231', postalCode: '639231', industry: 'Logistics',
    deptName: 'Logistics', deptColor: '#64748B', suspendCompany: true, suspendUserSlot: null,
  })
  console.log('  ✓ 2 secondary companies seeded (Bright Leaf Cafe, Coastal Logistics Pte Ltd)')

  // ═════════════════════════════════════════════════════════════════════════
  // Step 18: Summary
  // ═════════════════════════════════════════════════════════════════════════
  console.log('\n═══════════════════════════════════════════')
  console.log('  DEMO SEED COMPLETE — quick reference')
  console.log('═══════════════════════════════════════════')
  console.log('All passwords: 111111\n')
  console.log('Primary company: Sunrise Hospitality Group (Paid plan)')
  console.log('  owner@test.com          Sarah Mitchell (Owner)')
  console.log('  partner1@test.com       James Tan (Partner)')
  console.log('  partner2@test.com       Michelle Wong (Partner)')
  console.log('  manager1/5/9@test.com   Operations Managers (veteran / pendingRequests / recruitmentSubmitter)')
  console.log('  employee1/2/3@test.com  Operations Employees (normal / pendingRequests / taskHeavy)')
  console.log('  casual1@test.com        Currently ON BREAK right now (Operations)')
  console.log('  casual6@test.com        Open-ended job, clock-in-able right now (Marketing)')
  console.log('  casual9@test.com        Deactivated/banned Casual Worker (Marketing)')
  console.log('  manager6/10@test.com    Marketing Manager with a job posting pending Owner approval / rejected')
  console.log('  guest1-9@test.com       Every recruitment applicant end-state (see Step 13c)')
  console.log('\nSecondary companies (User Admin / Module 10 demo):')
  console.log('  ownerb@test.com   Bright Leaf Cafe (Free) — employeeb2@test.com is a suspended USER')
  console.log('  ownerc@test.com   Coastal Logistics Pte Ltd (Free) — the COMPANY itself is suspended')
  console.log('\nPlatform admins: madmin@tasking.com / uadmin@tasking.com')

}

main().catch(err => { console.error(err); process.exit(1) })
