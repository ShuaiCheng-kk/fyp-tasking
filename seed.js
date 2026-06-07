// seed.js — Tasking test data seeder
// Usage: node seed.js
// Requires: npm install @supabase/supabase-js
// Fill in your SUPABASE_URL and SERVICE_ROLE_KEY below before running.

const { createClient } = require('@supabase/supabase-js')

const SUPABASE_URL = 'https://qnpwuipwyidslxndgewg.supabase.co'         // e.g. https://xxxx.supabase.co
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFucHd1aXB3eWlkc2x4bmRnZXdnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODA2MDE3NCwiZXhwIjoyMDkzNjM2MTc0fQ.YSQMxKFiAmSlBcQ0tAtU07MnuViwpalADYhpfGxOskU'  // Settings → API → service_role key

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
})

const PASSWORD = 'Test123!'

// ─── Account definitions ──────────────────────────────────────────────────────

const accounts = [
  // Owner
  { email: 'owner@testing.com',      full_name: 'Alex Owner',      role: 'Owner' },
  // Partners
  { email: 'partner1@testing.com',   full_name: 'Ben Partner',     role: 'Partner' },
  { email: 'partner2@testing.com',   full_name: 'Clara Partner',   role: 'Partner' },
  // Managers (one per department)
  { email: 'manager1@testing.com',   full_name: 'David Mgr',       role: 'Manager' },
  { email: 'manager2@testing.com',   full_name: 'Eva Mgr',         role: 'Manager' },
  { email: 'manager3@testing.com',   full_name: 'Frank Mgr',       role: 'Manager' },
  { email: 'manager4@testing.com',   full_name: 'Grace Mgr',       role: 'Manager' },
  // Employees — 3 per manager (12 total)
  { email: 'emp1a@testing.com',      full_name: 'Harry Emp',       role: 'Employee' },
  { email: 'emp1b@testing.com',      full_name: 'Isla Emp',        role: 'Employee' },
  { email: 'emp1c@testing.com',      full_name: 'Jack Emp',        role: 'Employee' },
  { email: 'emp2a@testing.com',      full_name: 'Karen Emp',       role: 'Employee' },
  { email: 'emp2b@testing.com',      full_name: 'Leo Emp',         role: 'Employee' },
  { email: 'emp2c@testing.com',      full_name: 'Mia Emp',         role: 'Employee' },
  { email: 'emp3a@testing.com',      full_name: 'Noah Emp',        role: 'Employee' },
  { email: 'emp3b@testing.com',      full_name: 'Olivia Emp',      role: 'Employee' },
  { email: 'emp3c@testing.com',      full_name: 'Paul Emp',        role: 'Employee' },
  { email: 'emp4a@testing.com',      full_name: 'Quinn Emp',       role: 'Employee' },
  { email: 'emp4b@testing.com',      full_name: 'Rachel Emp',      role: 'Employee' },
  { email: 'emp4c@testing.com',      full_name: 'Sam Emp',         role: 'Employee' },
]

const departmentNames = ['Operations', 'Marketing', 'Logistics', 'Events']

// ─── Helper ───────────────────────────────────────────────────────────────────

function log(msg) { console.log(`[seed] ${msg}`) }
function err(msg, e) { console.error(`[seed] ERROR — ${msg}:`, e?.message || e); process.exit(1) }

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {

  // 1. Create auth users + public.users rows
  log('Creating auth users...')
  const userMap = {} // email → { auth_id, user_id }

  for (const acc of accounts) {
    // Create in auth.users via Admin API
    const { data: authData, error: authErr } = await supabase.auth.admin.createUser({
      email: acc.email,
      password: PASSWORD,
      email_confirm: true,  // skip email confirmation
    })
    if (authErr) err(`auth.createUser ${acc.email}`, authErr)
    const auth_id = authData.user.id
    log(`  ✓ auth user: ${acc.email} (${auth_id})`)

    // Insert into public.users (no company/dept yet — set after company created)
    const { data: userData, error: userErr } = await supabase
      .from('users')
      .insert({
        supabase_auth_id: auth_id,
        full_name: acc.full_name,
        email_address: acc.email,
        role: acc.role,
      })
      .select('id')
      .single()
    if (userErr) err(`insert public.users ${acc.email}`, userErr)

    userMap[acc.email] = { auth_id, user_id: userData.id }
    log(`  ✓ public.users: ${acc.full_name} → ${userData.id}`)
  }

  const ownerUserId = userMap['owner@testing.com'].user_id

  // 2. Create company
  log('Creating company...')
  const { data: company, error: compErr } = await supabase
    .from('companies')
    .insert({
      name: 'Testing Company',
      description: 'Seed data company for testing all roles and features.',
      owner_id: ownerUserId,
      plan: 'Paid',
      location: 'Singapore',
      industry: 'Retail',
      size: '11-50',
    })
    .select('id')
    .single()
  if (compErr) err('insert companies', compErr)
  const companyId = company.id
  log(`  ✓ company: Testing Company → ${companyId}`)

  // 3. Create departments
  log('Creating departments...')
  const deptMap = {} // name → dept_id
  for (const deptName of departmentNames) {
    const { data: dept, error: deptErr } = await supabase
      .from('departments')
      .insert({ name: deptName, company_id: companyId })
      .select('id')
      .single()
    if (deptErr) err(`insert department ${deptName}`, deptErr)
    deptMap[deptName] = dept.id
    log(`  ✓ department: ${deptName} → ${dept.id}`)
  }

  // 4. Add all internal users to company_members + update users.company_id
  log('Adding members to company...')
  const internalRoles = ['Owner', 'Partner', 'Manager', 'Employee']
  for (const acc of accounts.filter(a => internalRoles.includes(a.role))) {
    const uid = userMap[acc.email].user_id

    // company_members
    const { error: cmErr } = await supabase
      .from('company_members')
      .insert({ user_id: uid, company_id: companyId, role: acc.role })
    if (cmErr) err(`company_members ${acc.email}`, cmErr)

    // update users.company_id
    const { error: updErr } = await supabase
      .from('users')
      .update({ company_id: companyId })
      .eq('id', uid)
    if (updErr) err(`update users.company_id ${acc.email}`, updErr)
  }
  log('  ✓ all members added to company')

  // 5. Assign managers to departments (one manager per dept)
  log('Assigning managers to departments...')
  const managerEmails = [
    'manager1@testing.com',
    'manager2@testing.com',
    'manager3@testing.com',
    'manager4@testing.com',
  ]
  const deptNames = departmentNames // ['Operations','Marketing','Logistics','Events']

  for (let i = 0; i < managerEmails.length; i++) {
    const mgr_email = managerEmails[i]
    const dept_name = deptNames[i]
    const mgr_id   = userMap[mgr_email].user_id
    const dept_id  = deptMap[dept_name]

    const { error: mdErr } = await supabase
      .from('manager_departments')
      .insert({
        manager_id:   mgr_id,
        company_id:   companyId,
        department_id: dept_id,
        assigned_by:  ownerUserId,
      })
    if (mdErr) err(`manager_departments ${mgr_email}`, mdErr)

    // update users.department_id for manager
    await supabase.from('users').update({ department_id: dept_id }).eq('id', mgr_id)
    log(`  ✓ ${mgr_email} → ${dept_name}`)
  }

  // 6. Assign employees to departments (3 per department)
  log('Assigning employees to departments...')
  const empGroups = [
    { dept: 'Operations', emails: ['emp1a@testing.com','emp1b@testing.com','emp1c@testing.com'] },
    { dept: 'Marketing',  emails: ['emp2a@testing.com','emp2b@testing.com','emp2c@testing.com'] },
    { dept: 'Logistics',  emails: ['emp3a@testing.com','emp3b@testing.com','emp3c@testing.com'] },
    { dept: 'Events',     emails: ['emp4a@testing.com','emp4b@testing.com','emp4c@testing.com'] },
  ]

  for (const group of empGroups) {
    const dept_id = deptMap[group.dept]
    for (const email of group.emails) {
      const emp_id = userMap[email].user_id
      const { error: edErr } = await supabase
        .from('employee_departments')
        .insert({ employee_id: emp_id, department_id: dept_id, company_id: companyId })
      if (edErr) err(`employee_departments ${email}`, edErr)

      await supabase.from('users').update({ department_id: dept_id }).eq('id', emp_id)
      log(`  ✓ ${email} → ${group.dept}`)
    }
  }

  // 7. Create some shifts (today + tomorrow, across departments)
  log('Creating shifts...')
  const today = new Date().toISOString().split('T')[0]
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0]

  const shiftDefs = [
    { dept: 'Operations', date: today,    start: '07:00', end: '15:00', title: 'Morning Operations' },
    { dept: 'Operations', date: today,    start: '15:00', end: '23:00', title: 'Evening Operations' },
    { dept: 'Marketing',  date: today,    start: '09:00', end: '17:00', title: 'Marketing Day Shift' },
    { dept: 'Logistics',  date: today,    start: '07:00', end: '15:00', title: 'Morning Logistics' },
    { dept: 'Events',     date: today,    start: '12:00', end: '20:00', title: 'Events Afternoon' },
    { dept: 'Operations', date: tomorrow, start: '07:00', end: '15:00', title: 'Ops Tomorrow AM' },
    { dept: 'Marketing',  date: tomorrow, start: '09:00', end: '17:00', title: 'Marketing Tomorrow' },
  ]

  const shiftIds = {}
  for (const s of shiftDefs) {
    const { data: shift, error: shiftErr } = await supabase
      .from('shifts')
      .insert({
        company_id:         companyId,
        department_id:      deptMap[s.dept],
        title:              s.title,
        shift_date:         s.date,
        start_time:         s.start,
        end_time:           s.end,
        status:             'active',
        publication_status: 'published',
        created_by:         ownerUserId,
      })
      .select('id')
      .single()
    if (shiftErr) err(`insert shift ${s.title}`, shiftErr)
    shiftIds[s.title] = shift.id
    log(`  ✓ shift: ${s.title} (${s.date})`)
  }

  // 8. Assign managers to their department's shifts
  log('Creating shift assignments...')
  const assignDefs = [
    { shift_title: 'Morning Operations',  email: 'manager1@testing.com' },
    { shift_title: 'Evening Operations',  email: 'emp1a@testing.com'    },
    { shift_title: 'Marketing Day Shift', email: 'manager2@testing.com' },
    { shift_title: 'Morning Logistics',   email: 'manager3@testing.com' },
    { shift_title: 'Events Afternoon',    email: 'manager4@testing.com' },
    { shift_title: 'Ops Tomorrow AM',     email: 'emp1b@testing.com'    },
    { shift_title: 'Marketing Tomorrow',  email: 'emp2a@testing.com'    },
  ]

  const assignmentIds = {}
  for (const a of assignDefs) {
    const { data: asgn, error: asgnErr } = await supabase
      .from('shift_assignments')
      .insert({
        shift_id:          shiftIds[a.shift_title],
        user_id:           userMap[a.email].user_id,
        assigned_by:       ownerUserId,
        assignment_status: 'assigned',
      })
      .select('id')
      .single()
    if (asgnErr) err(`shift_assignments ${a.shift_title} → ${a.email}`, asgnErr)
    assignmentIds[a.shift_title] = asgn.id
    log(`  ✓ assigned ${a.email} to "${a.shift_title}"`)
  }

  // 9. Create some tasks
  log('Creating tasks...')
  const taskDefs = [
    {
      dept: 'Operations', assigned_to: 'manager1@testing.com',
      title: 'Review daily inventory', status: 'In Progress',
      priority: 'High', percentage_complete: 40,
    },
    {
      dept: 'Operations', assigned_to: 'emp1a@testing.com',
      title: 'Restock shelves A-C', status: 'Assigned',
      priority: 'Medium', percentage_complete: 0,
    },
    {
      dept: 'Marketing', assigned_to: 'manager2@testing.com',
      title: 'Approve campaign brief', status: 'Review',
      priority: 'High', percentage_complete: 80,
    },
    {
      dept: 'Marketing', assigned_to: 'emp2a@testing.com',
      title: 'Schedule social posts', status: 'Complete',
      priority: 'Low', percentage_complete: 100,
    },
    {
      dept: 'Logistics', assigned_to: 'manager3@testing.com',
      title: 'Coordinate morning delivery', status: 'In Progress',
      priority: 'Urgent', percentage_complete: 60,
    },
    {
      dept: 'Events', assigned_to: 'manager4@testing.com',
      title: 'Confirm venue setup', status: 'Assigned',
      priority: 'High', percentage_complete: 0,
    },
    {
      dept: 'Events', assigned_to: 'emp4a@testing.com',
      title: 'Prepare registration desk', status: 'In Progress',
      priority: 'Medium', percentage_complete: 30,
    },
  ]

  for (const t of taskDefs) {
    const { error: taskErr } = await supabase
      .from('tasks')
      .insert({
        company_id:          companyId,
        department_id:       deptMap[t.dept],
        title:               t.title,
        assigned_user_id:    userMap[t.assigned_to].user_id,
        assigned_by:         ownerUserId,
        status:              t.status,
        priority:            t.priority,
        percentage_complete: t.percentage_complete,
      })
    if (taskErr) err(`insert task "${t.title}"`, taskErr)
    log(`  ✓ task: "${t.title}" → ${t.assigned_to} [${t.status}]`)
  }

  // ─── Summary ──────────────────────────────────────────────────────────────
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('  SEED COMPLETE')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('  Company : Testing Company')
  console.log('  Password: Test123!  (same for everyone)')
  console.log('')
  console.log('  ACCOUNTS:')
  console.log('  owner@testing.com        → Owner')
  console.log('  partner1@testing.com     → Partner')
  console.log('  partner2@testing.com     → Partner')
  console.log('  manager1@testing.com     → Manager (Operations)')
  console.log('  manager2@testing.com     → Manager (Marketing)')
  console.log('  manager3@testing.com     → Manager (Logistics)')
  console.log('  manager4@testing.com     → Manager (Events)')
  console.log('  emp1a/1b/1c@testing.com  → Employee (Operations)')
  console.log('  emp2a/2b/2c@testing.com  → Employee (Marketing)')
  console.log('  emp3a/3b/3c@testing.com  → Employee (Logistics)')
  console.log('  emp4a/4b/4c@testing.com  → Employee (Events)')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')
}

main().catch(e => { console.error(e); process.exit(1) })
