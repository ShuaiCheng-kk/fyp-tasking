/**
 * Seed for the tutorial VIDEO demo (Part 2 storyline). Separate from seed.js and seed-demo.js.
 *
 *   node scripts/video-demo-seed.js
 *
 * The video walks one job from posting to payroll, so the screen has to stay readable: every
 * count on screen should be a number the audience can hold in their head. That means the
 * opposite of seed.js — as little data as possible.
 *
 *   · 4 accounts only: Owner, Manager, Employee, Guest User
 *   · ZERO job postings — the Manager creates all of them on camera
 *   · ZERO casual workers — the pool starts empty so the guest appearing in it lands visually
 *   · 3 job templates ready to apply, so posting three jobs is three clicks, not three forms
 *   · Shifts on the 15th/16th so a supervisor can actually be picked when posting
 *
 * Companion script: video-demo-forward.js jumps the clock to the 15th without destroying
 * anything done on camera.
 */
const { createClient } = require('@supabase/supabase-js')

require('dotenv').config({ path: '.env.local' })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SERVICE_ROLE_KEY) {
  console.error('SUPABASE_SERVICE_ROLE_KEY is required (set it in .env.local)')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } })

const PASSWORD = '111111'
const DEMO_PHOTO_URL = 'https://api.dicebear.com/7.x/avataaars/svg?seed=demo'

// ── Dates ────────────────────────────────────────────────────────────────────
const TODAY = new Date()
const pad = n => String(n).padStart(2, '0')
const dateKey = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const addDays = (d, n) => { const c = new Date(d); c.setDate(c.getDate() + n); return c }
const toHM = d => `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`

const TODAY_KEY = dateKey(TODAY)
const DAY1_KEY = dateKey(addDays(TODAY, 1))   // the One-Off job's day
const DAY2_KEY = dateKey(addDays(TODAY, 2))   // the two Shift jobs' day

const accounts = [
  { email: 'owner@test.com',     full_name: 'Sarah Mitchell', role: 'Owner',      phone: '+65 9123 4567', dob: '1985-04-12' },
  { email: 'manager1@test.com',  full_name: 'David Lim',      role: 'Manager',    phone: '+65 8123 4567', dob: '1990-07-08' },
  { email: 'employee1@test.com', full_name: 'Ben Seah',       role: 'Employee',   phone: '+65 8234 5678', dob: '1995-02-19' },
  { email: 'guest1@test.com',    full_name: 'Wei Jie Lim',    role: 'Guest User', phone: '+65 8345 6789', dob: '2001-06-03' },
]

// Everything that stays the same every time this role is hired lives on the template; the day,
// the supervisor, the start time and the headcount are filled in per posting.
const templates = [
  {
    title: 'Event One-Off Job',
    job_type: 'oneoff',
    responsibilities: 'Help set up and run a one-day company event: lay out the floor, guide guests to their seats, keep the service area tidy, and pack down afterwards.',
    skills: 'Comfortable on your feet for a full shift, tidy presentation, works well in a team, able to follow a run sheet.',
    salary_amount: 90,
    estimated_hours: '5',
    urgency: 'high',
    experience_required: 'Not Required',
    minimum_age: 16,
    uniform_type: 'dress_code',
    uniform_details: 'Black polo T-shirt, dark trousers, covered shoes.',
  },
  {
    title: 'Cleaning Shift Job',
    job_type: 'shift',
    responsibilities: 'Cover a cleaning shift across the front of house and back of house: wipe down surfaces, restock consumables, clear waste, and reset the floor before close.',
    skills: 'Thorough and consistent, comfortable with cleaning chemicals, able to work unsupervised once briefed.',
    salary_amount: 14,
    experience_required: 'Not Required',
    minimum_age: 16,
    uniform_type: 'none',
    uniform_details: null,
  },
  {
    title: 'Barista Shift Job',
    job_type: 'shift',
    responsibilities: 'Run the coffee bar during a shift: take orders, pull espresso, steam milk, keep the counter clean, and cash up at the end.',
    skills: 'Barista basics, comfortable with a busy counter, food handling awareness, friendly with customers.',
    salary_amount: 16,
    experience_required: 'Preferred',
    minimum_age: 18,
    uniform_type: 'dress_code',
    uniform_details: 'Black apron provided, plain dark shirt underneath.',
  },
]

// Wiped in FK-safe order.
const tablesToClear = [
  'attendance_records', 'shift_action_history', 'shift_swap_requests', 'shift_assignments',
  'shifts', 'shift_templates', 'task_templates', 'tasks', 'messages', 'announcement_reads',
  'announcements', 'job_invitations', 'job_applicants', 'job_cancellations', 'job_postings',
  'job_templates', 'off_day_requests', 'off_day_quota_settings', 'user_certificates',
  'manager_departments', 'employee_departments', 'casualworker_departments',
  'company_activity_logs',
]

async function main() {
  console.log('\n═══════════════════════════════════════════')
  console.log('  Video Demo Seed — minimal, 4 roles')
  console.log('═══════════════════════════════════════════\n')

  // ── Wipe ───────────────────────────────────────────────────────────────────
  console.log('Step 1: clearing tables...')
  for (const table of tablesToClear) {
    const { error } = await supabase.from(table).delete().neq('id', '00000000-0000-0000-0000-000000000000')
    if (error) console.warn(`  ⚠ ${table}: ${error.message}`)
  }
  // Both of these carry an updated_by FK to users and block the users delete if left behind.
  for (const [table, col] of [['invitation_code', 'code'], ['shift_swap_settings', 'company_id'], ['shift_swap_department_settings', 'department_id'], ['off_day_submission_deadline', 'company_id']]) {
    const { error } = await supabase.from(table).delete().neq(col, col === 'code' ? '' : '00000000-0000-0000-0000-000000000000')
    if (error) console.warn(`  ⚠ ${table}: ${error.message}`)
  }
  await supabase.from('casual_worker_profiles').delete().neq('user_id', '00000000-0000-0000-0000-000000000000')
  // Same shape as seed.js: the .neq() has to come first or PostgREST won't run the delete at all.
  // Platform admins are excluded because the protect_admin_accounts trigger rejects deleting them,
  // which would fail the whole statement.
  const { error: uErr } = await supabase.from('users').delete()
    .neq('id', '00000000-0000-0000-0000-000000000000')
    .not('role', 'in', '("User Admin","Marketing Admin")')
  if (uErr) console.warn(`  ⚠ users: ${uErr.message}`)
  await supabase.from('departments').delete().neq('id', '00000000-0000-0000-0000-000000000000')
  const { error: cErr } = await supabase.from('companies').delete().neq('id', '00000000-0000-0000-0000-000000000000')
  if (cErr) console.warn(`  ⚠ companies: ${cErr.message}`)
  console.log('  ✓ cleared\n')

  // ── Auth accounts ──────────────────────────────────────────────────────────
  console.log('Step 2: auth accounts...')
  const { data: authList } = await supabase.auth.admin.listUsers({ perPage: 1000 })
  const existing = new Map((authList?.users ?? []).map(u => [u.email, u.id]))
  const ids = {}

  for (const acc of accounts) {
    let authId = existing.get(acc.email)
    if (authId) {
      await supabase.auth.admin.updateUserById(authId, { password: PASSWORD, email_confirm: true })
    } else {
      const { data, error } = await supabase.auth.admin.createUser({
        email: acc.email, password: PASSWORD, email_confirm: true,
      })
      if (error || !data.user) { console.error(`  ✗ ${acc.email}: ${error?.message}`); process.exit(1) }
      authId = data.user.id
    }
    ids[acc.email] = { authId }
    console.log(`  ✓ ${acc.email}`)
  }

  // Auth users from previous seeds that no longer have a users row would linger; drop them so
  // the job board's applicant list can't surface a stranger.
  for (const u of (authList?.users ?? [])) {
    if (!u.email) continue
    if (accounts.some(a => a.email === u.email)) continue
    if (u.email.endsWith('@tasking.com')) continue // platform admins
    await supabase.auth.admin.deleteUser(u.id)
  }
  console.log('  ✓ removed auth accounts from earlier seeds\n')

  // ── Company + department ───────────────────────────────────────────────────
  // companies.owner_id is NOT NULL, so the Owner's users row has to exist first. It gets its
  // company_id filled in below, once there's a company to point at.
  console.log('Step 3: company and department...')
  const { data: ownerRow, error: ownerErr } = await supabase.from('users').insert({
    supabase_auth_id: ids['owner@test.com'].authId,
    full_name: 'Sarah Mitchell',
    email_address: 'owner@test.com',
    phone_number: '+65 9123 4567',
    date_of_birth: '1985-04-12',
    profile_photo_url: DEMO_PHOTO_URL,
    role: 'Owner',
    company_id: null,
  }).select().single()
  if (ownerErr) { console.error(ownerErr.message); process.exit(1) }
  ids['owner@test.com'].internalId = ownerRow.id

  const { data: company, error: coErr } = await supabase.from('companies').insert({
    owner_id: ownerRow.id,
    name: 'Sunrise Hospitality Group',
    description: 'A small hospitality group running cafés and event catering across Singapore.',
    location: 'Singapore',
    address: '1 Raffles Place, Singapore 048616',
    postal_code: '048616',
    industry: 'Food & Beverage',
    size: '11-50',
    plan: 'Paid',
  }).select().single()
  if (coErr) { console.error(coErr.message); process.exit(1) }

  const { data: dept, error: deptErr } = await supabase.from('departments').insert({
    company_id: company.id, name: 'Operations', color: '#3B82F6',
  }).select().single()
  if (deptErr) { console.error(deptErr.message); process.exit(1) }
  console.log(`  ✓ ${company.name} / ${dept.name} (Paid plan)\n`)

  // ── users rows ─────────────────────────────────────────────────────────────
  console.log('Step 4: user profiles...')
  await supabase.from('users').update({ company_id: company.id }).eq('id', ownerRow.id)
  console.log('  ✓ Sarah Mitchell (Owner)')

  for (const acc of accounts) {
    if (acc.role === 'Owner') continue // created above, so the company could reference them
    // A Guest User belongs to no company — that's what makes them an outside applicant.
    const isGuest = acc.role === 'Guest User'
    const { data: row, error } = await supabase.from('users').insert({
      supabase_auth_id: ids[acc.email].authId,
      full_name: acc.full_name,
      email_address: acc.email,
      phone_number: acc.phone,
      date_of_birth: acc.dob,
      profile_photo_url: DEMO_PHOTO_URL,
      role: acc.role,
      company_id: isGuest ? null : company.id,
    }).select().single()
    if (error) { console.error(`  ✗ ${acc.email}: ${error.message}`); process.exit(1) }
    ids[acc.email].internalId = row.id
    console.log(`  ✓ ${acc.full_name} (${acc.role})`)
  }

  await supabase.from('manager_departments').insert({
    manager_id: ids['manager1@test.com'].internalId, department_id: dept.id, company_id: company.id,
  })
  await supabase.from('employee_departments').insert({
    employee_id: ids['employee1@test.com'].internalId, department_id: dept.id,
  })

  // The guest needs a profile for AI Assessment to have anything to compare. demo-fill-applicants
  // rewrites these skills to mirror whichever job is posted, so the starting text barely matters.
  await supabase.from('casual_worker_profiles').insert({
    user_id: ids['guest1@test.com'].internalId,
    skills: 'Customer service, event setup, comfortable on my feet for long shifts.',
    resume_url: 'https://example.com/demo-resumes/guest1-resume.pdf',
  })
  await supabase.from('user_certificates').insert({
    user_id: ids['guest1@test.com'].internalId,
    name: 'Food Hygiene Certificate',
    certificate_url: 'https://example.com/demo-certs/food-hygiene.pdf',
  })
  console.log('  ✓ guest profile + certificate\n')

  // ── Shifts ─────────────────────────────────────────────────────────────────
  // Two jobs of work here. Today's shifts exist purely so Manager/Employee pages are never in the
  // "clocked out, read-only" state. The 15th/16th shifts exist so the Supervisor dropdown has
  // somebody in it when the Manager posts — a casual worker is never on site unsupervised, so the
  // posting form refuses to publish without one.
  console.log('Step 5: shifts...')

  const liveStart = new Date(Date.now() - 45 * 60000)
  const liveEnd = new Date(Date.now() + 10 * 60000)
  const { data: todayShift } = await supabase.from('shifts').insert({
    company_id: company.id, department_id: dept.id, shift_date: TODAY_KEY,
    start_time: toHM(liveStart), end_time: toHM(liveEnd),
    created_by: ids['owner@test.com'].internalId,
    publication_status: 'published',
    is_open_ended: true,
  }).select().single()
  for (const email of ['manager1@test.com', 'employee1@test.com']) {
    await supabase.from('shift_assignments').insert({
      shift_id: todayShift.id, user_id: ids[email].internalId, assigned_by: ids['owner@test.com'].internalId,
    })
  }
  console.log(`  ✓ today ${TODAY_KEY} — David Lim + Ben Seah, open-ended, unclocked`)

  for (const [dayKey, label] of [[DAY1_KEY, 'One-Off day'], [DAY2_KEY, 'Shift-jobs day']]) {
    const { data: sup } = await supabase.from('shifts').insert({
      company_id: company.id, department_id: dept.id, shift_date: dayKey,
      start_time: '09:00', end_time: '21:00',
      created_by: ids['owner@test.com'].internalId,
      publication_status: 'published',
      is_open_ended: false,
    }).select().single()
    await supabase.from('shift_assignments').insert({
      shift_id: sup.id, user_id: ids['employee1@test.com'].internalId, assigned_by: ids['owner@test.com'].internalId,
    })
    console.log(`  ✓ ${dayKey} — Ben Seah 09:00-21:00 (${label}, selectable as Supervisor)`)
  }
  console.log()

  // ── Job templates ──────────────────────────────────────────────────────────
  console.log('Step 6: job templates...')
  for (const t of templates) {
    const { error } = await supabase.from('job_templates').insert({
      company_id: company.id,
      created_by: ids['manager1@test.com'].internalId,
      department_id: dept.id,
      title: t.title,
      responsibilities: t.responsibilities,
      skills: t.skills,
      job_type: t.job_type,
      salary_amount: t.salary_amount,
      estimated_hours: t.job_type === 'oneoff' ? t.estimated_hours : null,
      urgency: t.job_type === 'oneoff' ? t.urgency : null,
      experience_required: t.experience_required,
      minimum_age: t.minimum_age,
      uniform_type: t.uniform_type,
      uniform_details: t.uniform_details,
    })
    if (error) console.warn(`  ⚠ ${t.title}: ${error.message}`)
    else console.log(`  ✓ ${t.title} (${t.job_type === 'oneoff' ? 'One-Off' : 'Shift'})`)
  }

  // ── Summary ────────────────────────────────────────────────────────────────
  console.log('\n═══════════════════════════════════════════')
  console.log('  Ready to record (password: 111111)')
  console.log('═══════════════════════════════════════════')
  console.log('  owner@test.com      Sarah Mitchell   Owner')
  console.log('  manager1@test.com   David Lim        Manager, Operations')
  console.log('  employee1@test.com  Ben Seah         Employee, Operations')
  console.log('  guest1@test.com     Wei Jie Lim      Guest User (no company)')
  console.log('')
  console.log('  Job postings ........ 0   (Manager creates them on camera)')
  console.log('  Casual workers ...... 0   (pool is empty — the guest fills it)')
  console.log('  Job templates ....... 3   Event One-Off / Cleaning Shift / Barista Shift')
  console.log('')
  console.log(`  Supervisor available on ${DAY1_KEY} and ${DAY2_KEY}: Ben Seah, 09:00-21:00`)
  console.log('  → post the One-Off for the 15th, both Shift jobs for the 16th')
  console.log('  → the casual worker\'s start time must fall inside 09:00-21:00')
  console.log('')
  console.log('  Nobody has clocked out, so no page is locked read-only.')
  console.log('')
  console.log('  Mid-recording:  node scripts/demo-fill-applicants.js')
  console.log('  Fast forward:   node scripts/video-demo-forward.js')
  console.log('═══════════════════════════════════════════\n')
}

main().catch(err => { console.error(err); process.exit(1) })
