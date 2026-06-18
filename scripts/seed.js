/**
 * scripts/seed.js — Tasking 测试数据完整重建脚本
 *
 * 功能：
 *   1. 清空所有业务数据表
 *   2. 删除 auth.users 里的旧测试账号
 *   3. 在 Supabase Auth 创建真实账号（密码统一 111111）
 *   4. 插入 public.users、companies、departments 及所有关联数据
 *   5. 插入 Casual Workers（含 date_of_birth, phone_number, worker_status 等）
 *
 * 测试账号结构：
 *   1 Owner, 2 Partner, 8 Manager, 8 Employee, 10 Casual Worker
 *   1 Company, 4 Department, 2 Manager/dept, 2 Employee/dept
 *
 * 使用方法：
 *   node scripts/seed.js
 *
 * 需要：node_modules 已安装（npm install）
 */

const { createClient } = require('@supabase/supabase-js')

// ─── 配置 ──────────────────────────────────────────────────────────────────────

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
  || 'https://qnpwuipwyidslxndgewg.supabase.co'

const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
  || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFucHd1aXB3eWlkc2x4bmRnZXdnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODA2MDE3NCwiZXhwIjoyMDkzNjM2MTc0fQ.YSQMxKFiAmSlBcQ0tAtU07MnuViwpalADYhpfGxOskU'

const PASSWORD = '111111'

function addDays(date, n) {
  const d = new Date(date)
  d.setDate(d.getDate() + n)
  return d
}

function formatDate(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

// ─── 账号定义 ──────────────────────────────────────────────────────────────────

const DEMO_PHOTO_URL = 'https://api.dicebear.com/7.x/avataaars/svg?seed=tasking'
const DEMO_RESUME_URL = 'https://www.w3.org/WAI/WCAG21/Techniques/pdf/PDF17.pdf'
const DEMO_COVER_LETTER_URL = 'https://www.w3.org/WAI/WCAG21/Techniques/pdf/PDF17.pdf'

const accounts = [
  // Owner
  {
    email: 'owner@test.com',
    full_name: 'Sarah Mitchell',
    role: 'Owner',
    phone_number: '+65 9123 4567',
    date_of_birth: '1980-03-15',
  },
  // Partners
  {
    email: 'partner1@test.com',
    full_name: 'James Tan',
    role: 'Partner',
    phone_number: '+65 9234 5678',
    date_of_birth: '1982-07-22',
  },
  {
    email: 'partner2@test.com',
    full_name: 'Priya Nair',
    role: 'Partner',
    phone_number: '+65 9345 6789',
    date_of_birth: '1985-11-08',
  },
  // Managers (8, 2 per department)
  { email: 'manager1@test.com', full_name: 'David Lim',      role: 'Manager', phone_number: '+65 9456 7890', date_of_birth: '1988-04-12' },
  { email: 'manager2@test.com', full_name: 'Rachel Koh',     role: 'Manager', phone_number: '+65 9567 8901', date_of_birth: '1990-09-28' },
  { email: 'manager3@test.com', full_name: 'Aaron Wong',     role: 'Manager', phone_number: '+65 9678 9012', date_of_birth: '1987-01-17' },
  { email: 'manager4@test.com', full_name: 'Fiona Chen',     role: 'Manager', phone_number: '+65 9789 0123', date_of_birth: '1991-06-03' },
  { email: 'manager5@test.com', full_name: 'Ethan Goh',      role: 'Manager', phone_number: '+65 9890 1234', date_of_birth: '1986-12-25' },
  { email: 'manager6@test.com', full_name: 'Jasmine Lee',    role: 'Manager', phone_number: '+65 9901 2345', date_of_birth: '1992-03-09' },
  { email: 'manager7@test.com', full_name: 'Marcus Ong',     role: 'Manager', phone_number: '+65 9012 3456', date_of_birth: '1989-08-14' },
  { email: 'manager8@test.com', full_name: 'Vivian Ho',      role: 'Manager', phone_number: '+65 9123 4560', date_of_birth: '1993-05-21' },
  // Employees (8, 2 per department)
  { email: 'employee1@test.com', full_name: 'Ben Seah',       role: 'Employee', phone_number: '+65 8123 4567', date_of_birth: '1995-02-18' },
  { email: 'employee2@test.com', full_name: 'Chloe Yeo',      role: 'Employee', phone_number: '+65 8234 5678', date_of_birth: '1997-10-05' },
  { email: 'employee3@test.com', full_name: 'Daniel Tay',     role: 'Employee', phone_number: '+65 8345 6789', date_of_birth: '1994-07-30' },
  { email: 'employee4@test.com', full_name: 'Elaine Chua',    role: 'Employee', phone_number: '+65 8456 7890', date_of_birth: '1996-04-11' },
  { email: 'employee5@test.com', full_name: 'Felix Ng',       role: 'Employee', phone_number: '+65 8567 8901', date_of_birth: '1998-01-24' },
  { email: 'employee6@test.com', full_name: 'Grace Lau',      role: 'Employee', phone_number: '+65 8678 9012', date_of_birth: '1995-09-16' },
  { email: 'employee7@test.com', full_name: 'Henry Sim',      role: 'Employee', phone_number: '+65 8789 0123', date_of_birth: '1997-06-07' },
  { email: 'employee8@test.com', full_name: 'Irene Tan',      role: 'Employee', phone_number: '+65 8890 1234', date_of_birth: '1999-03-29' },
]

// Casual Workers — these get worker_status, date_of_birth, resume/cover letter URLs
const casualWorkers = [
  { email: 'cw1@test.com',  full_name: 'Alicia Tan',     phone_number: '+65 8100 1001', date_of_birth: '1998-05-12', worker_status: 'active',   inactivate_reason: null },
  { email: 'cw2@test.com',  full_name: 'Nadia Wong',     phone_number: '+65 8100 1002', date_of_birth: '2000-08-22', worker_status: 'active',   inactivate_reason: null },
  { email: 'cw3@test.com',  full_name: 'Hui Min Lee',    phone_number: '+65 8100 1003', date_of_birth: '1999-03-17', worker_status: 'active',   inactivate_reason: null },
  { email: 'cw4@test.com',  full_name: 'Farah Hassan',   phone_number: '+65 8100 1004', date_of_birth: '2001-11-05', worker_status: 'active',   inactivate_reason: null },
  { email: 'cw5@test.com',  full_name: 'Ethan Ong',      phone_number: '+65 8100 1005', date_of_birth: '1997-07-30', worker_status: 'active',   inactivate_reason: null },
  { email: 'cw6@test.com',  full_name: 'Daniel Goh',     phone_number: '+65 8100 1006', date_of_birth: '2002-02-14', worker_status: 'active',   inactivate_reason: null },
  { email: 'cw7@test.com',  full_name: 'Siti Nur',       phone_number: '+65 8100 1007', date_of_birth: '1996-09-09', worker_status: 'active',   inactivate_reason: null },
  { email: 'cw8@test.com',  full_name: 'Marcus Lim',     phone_number: '+65 8100 1008', date_of_birth: '2000-04-25', worker_status: 'inactive', inactivate_reason: 'Repeated no-shows without prior notice.' },
  { email: 'cw9@test.com',  full_name: 'Jasper Koh',     phone_number: '+65 8100 1009', date_of_birth: '1999-12-01', worker_status: 'inactive', inactivate_reason: 'Violated workplace conduct policy.' },
  { email: 'cw10@test.com', full_name: 'Mei Xin Teo',    phone_number: '+65 8100 1010', date_of_birth: '1998-06-18', worker_status: 'inactive', inactivate_reason: 'Unable to meet shift requirements.' },
]

const legacyTestEmailsToDelete = [
  ...accounts.map(a => a.email),
  ...casualWorkers.map(cw => cw.email),
]

// ─── 主流程 ────────────────────────────────────────────────────────────────────

async function main() {
  console.log('═══════════════════════════════════════════')
  console.log('  Tasking Seed Script')
  console.log('═══════════════════════════════════════════\n')

  // ── Step 1: 清空业务数据表 ─────────────────────────────────────────────────
  console.log('Step 1: 清空所有业务数据表...')
  const tablesToClear = [
    'attendance_records',
    'shift_assignments',
    'shifts',
    'tasks',
    'messages',
    'announcements',
    'inbox',
    'job_invitations',
    'job_applicants',
    'job_postings',
    'time_off_requests',
    'shift_swap_requests',
    'manager_departments',
    'employee_departments',
  ]
  for (const table of tablesToClear) {
    const { error } = await supabase.from(table).delete().neq('id', '00000000-0000-0000-0000-000000000000')
    if (error) console.warn(`  ⚠ 清空 ${table} 失败: ${error.message}`)
    else console.log(`  ✓ 清空 ${table}`)
  }
  const { error: icErr } = await supabase.from('invitation_code').delete().neq('code', '')
  if (icErr) console.warn(`  ⚠ 清空 invitation_code 失败: ${icErr.message}`)
  else console.log('  ✓ 清空 invitation_code')
  const { error: uErr } = await supabase.from('users').delete().neq('id', '00000000-0000-0000-0000-000000000000')
  if (uErr) console.warn(`  ⚠ 清空 users 失败: ${uErr.message}`)
  else console.log('  ✓ 清空 users')
  const { error: dErr } = await supabase.from('departments').delete().neq('id', '00000000-0000-0000-0000-000000000000')
  if (dErr) console.warn(`  ⚠ 清空 departments 失败: ${dErr.message}`)
  else console.log('  ✓ 清空 departments')
  const { error: cErr } = await supabase.from('companies').delete().neq('id', '00000000-0000-0000-0000-000000000000')
  if (cErr) console.warn(`  ⚠ 清空 companies 失败: ${cErr.message}`)
  else console.log('  ✓ 清空 companies')

  // ── Step 2: 删除旧 auth 账号 ──────────────────────────────────────────────
  console.log('\nStep 2: 删除旧 auth 账号...')
  const { data: existingUsers } = await supabase.auth.admin.listUsers({ perPage: 1000 })
  const testEmails = new Set(legacyTestEmailsToDelete)
  for (const u of (existingUsers?.users ?? [])) {
    if (testEmails.has(u.email)) {
      await supabase.auth.admin.deleteUser(u.id)
      console.log(`  ✓ 删除 auth: ${u.email}`)
    }
  }

  // ── Step 3: 创建 auth 账号（internal + CW）──────────────────────────────
  console.log('\nStep 3: 创建 auth 账号...')
  const userIdMap = {} // email → { authId, internalId }

  const allAuthAccounts = [...accounts, ...casualWorkers]
  for (const account of allAuthAccounts) {
    const { data, error } = await supabase.auth.admin.createUser({
      email: account.email,
      password: PASSWORD,
      email_confirm: true,
    })
    if (error || !data.user) {
      console.error(`  ✗ auth 创建失败 ${account.email}: ${error?.message}`)
      process.exit(1)
    }
    userIdMap[account.email] = { authId: data.user.id }
    console.log(`  ✓ auth 创建: ${account.email} → ${data.user.id}`)
  }

  // ── Step 4: 创建 Owner public.users + Company ──────────────────────────
  console.log('\nStep 4: 创建 Company...')
  const ownerAccount = accounts.find(a => a.email === 'owner@test.com')
  const ownerAuthId = userIdMap['owner@test.com'].authId

  const { data: ownerUser, error: ownerErr } = await supabase
    .from('users')
    .insert({
      supabase_auth_id: ownerAuthId,
      full_name: ownerAccount.full_name,
      email_address: ownerAccount.email,
      phone_number: ownerAccount.phone_number,
      date_of_birth: ownerAccount.date_of_birth,
      profile_photo_url: DEMO_PHOTO_URL,
      role: 'Owner',
      company_id: null,
    })
    .select()
    .single()
  if (ownerErr) { console.error('  ✗ 插入 owner users 失败:', ownerErr.message); process.exit(1) }
  userIdMap['owner@test.com'].internalId = ownerUser.id

  const { data: company, error: compErr } = await supabase
    .from('companies')
    .insert({
      name: 'Sunrise Hospitality Group',
      owner_id: ownerUser.id,
      description: 'A leading hospitality and events management company serving corporate and retail clients across Singapore.',
      location: 'Raffles Place',
      address: '1 Raffles Place, Singapore 048616',
      postal_code: '048616',
      industry: 'Hospitality',
      size: '51-200',
      plan: 'Free',
    })
    .select()
    .single()
  if (compErr) { console.error('  ✗ 创建 company 失败:', compErr.message); process.exit(1) }
  console.log(`  ✓ Company: ${company.name} (${company.id})`)

  await supabase.from('users').update({ company_id: company.id }).eq('id', ownerUser.id)

  // ── Step 5: 创建 Departments ───────────────────────────────────────────
  console.log('\nStep 5: 创建 Departments...')
  const deptNames = ['Operations', 'Marketing', 'Engineering', 'Customer Support']
  const depts = []
  for (const name of deptNames) {
    const { data: dept, error: deptErr } = await supabase
      .from('departments')
      .insert({ name, company_id: company.id })
      .select()
      .single()
    if (deptErr) { console.error(`  ✗ 创建 dept ${name} 失败:`, deptErr.message); process.exit(1) }
    depts.push(dept)
    console.log(`  ✓ Department: ${dept.name} (${dept.id})`)
  }

  // ── Step 6: 插入 internal public.users（非 Owner）────────────────────
  console.log('\nStep 6: 插入 public.users (internal)...')
  for (const account of accounts) {
    if (account.email === 'owner@test.com') continue
    const authId = userIdMap[account.email].authId
    const { data: u, error: uErr } = await supabase
      .from('users')
      .insert({
        supabase_auth_id: authId,
        full_name: account.full_name,
        email_address: account.email,
        phone_number: account.phone_number,
        date_of_birth: account.date_of_birth,
        profile_photo_url: DEMO_PHOTO_URL,
        role: account.role,
        company_id: company.id,
      })
      .select()
      .single()
    if (uErr) { console.error(`  ✗ 插入 users 失败 ${account.email}:`, uErr.message); process.exit(1) }
    userIdMap[account.email].internalId = u.id
    console.log(`  ✓ users: ${account.full_name} (${u.id})`)
  }

  // ── Step 7: 插入 Casual Workers ────────────────────────────────────────
  console.log('\nStep 7: 插入 public.users (Casual Workers)...')
  for (const cw of casualWorkers) {
    const authId = userIdMap[cw.email].authId
    const { data: u, error: uErr } = await supabase
      .from('users')
      .insert({
        supabase_auth_id: authId,
        full_name: cw.full_name,
        email_address: cw.email,
        phone_number: cw.phone_number,
        date_of_birth: cw.date_of_birth,
        profile_photo_url: DEMO_PHOTO_URL,
        role: 'Casual Worker',
        company_id: company.id,
        worker_status: cw.worker_status,
        inactivate_reason: cw.inactivate_reason,
      })
      .select()
      .single()
    if (uErr) { console.error(`  ✗ 插入 CW users 失败 ${cw.email}:`, uErr.message); process.exit(1) }
    userIdMap[cw.email].internalId = u.id
    console.log(`  ✓ CW: ${cw.full_name} (${cw.worker_status}) → ${u.id}`)
  }

  // ── Step 8: manager_departments ────────────────────────────────────────
  console.log('\nStep 8: 分配 manager_departments...')
  // dept[0]=Operations: manager1,2  dept[1]=Marketing: manager3,4
  // dept[2]=Engineering: manager5,6  dept[3]=Customer Support: manager7,8
  const managerEmails = [
    'manager1@test.com', 'manager2@test.com',
    'manager3@test.com', 'manager4@test.com',
    'manager5@test.com', 'manager6@test.com',
    'manager7@test.com', 'manager8@test.com',
  ]
  for (let i = 0; i < managerEmails.length; i++) {
    const deptIndex = Math.floor(i / 2)
    const managerId = userIdMap[managerEmails[i]].internalId
    const dept = depts[deptIndex]
    const { error: mdErr } = await supabase.from('manager_departments').insert({
      manager_id: managerId,
      department_id: dept.id,
      company_id: company.id,
      assigned_by: ownerUser.id,
    })
    if (mdErr) console.warn(`  ⚠ manager_departments 失败: ${mdErr.message}`)
    else console.log(`  ✓ ${managerEmails[i]} → ${dept.name}`)
  }

  // ── Step 9: employee_departments ───────────────────────────────────────
  console.log('\nStep 9: 分配 employee_departments...')
  const employeeEmails = [
    'employee1@test.com', 'employee2@test.com',
    'employee3@test.com', 'employee4@test.com',
    'employee5@test.com', 'employee6@test.com',
    'employee7@test.com', 'employee8@test.com',
  ]
  for (let i = 0; i < employeeEmails.length; i++) {
    const deptIndex = Math.floor(i / 2)
    const employeeId = userIdMap[employeeEmails[i]].internalId
    const dept = depts[deptIndex]
    const { error: edErr } = await supabase.from('employee_departments').insert({
      employee_id: employeeId,
      department_id: dept.id,
      company_id: company.id,
    })
    if (edErr) console.warn(`  ⚠ employee_departments 失败: ${edErr.message}`)
    else console.log(`  ✓ ${employeeEmails[i]} → ${dept.name}`)
  }

  // ── Step 10: Shifts + Shift Assignments ────────────────────────────────
  console.log('\nStep 10: 创建 Shifts + Shift Assignments...')

  const todayStr = formatDate(new Date())
  const dayOffset = (n) => formatDate(addDays(new Date(), n))

  // helper: internal id lookups
  const mgrId = (n) => userIdMap[`manager${n}@test.com`].internalId
  const empId = (n) => userIdMap[`employee${n}@test.com`].internalId
  const cwId = (n) => userIdMap[`cw${n}@test.com`].internalId
  const managerIdsByDept = [
    new Set([mgrId(1), mgrId(2)]),
    new Set([mgrId(3), mgrId(4)]),
    new Set([mgrId(5), mgrId(6)]),
    new Set([mgrId(7), mgrId(8)]),
  ]

  // dept[0]=Operations dept[1]=Marketing dept[2]=Engineering dept[3]=Customer Support.
  // Demo week is Mon dayOffset(-3) .. Sun dayOffset(3), i.e. day index i = 0..6.
  // Keep the demo timeline light: every department gets one manager and one employee
  // per day, rotated across two managers and two employees.
  const deptStaffing = [
    { dept: 0, mgrs: [1, 2], emps: [1, 2], title: 'Operations Coverage' },
    { dept: 1, mgrs: [3, 4], emps: [3, 4], title: 'Marketing Coverage' },
    { dept: 2, mgrs: [5, 6], emps: [5, 6], title: 'Engineering Coverage' },
    { dept: 3, mgrs: [7, 8], emps: [7, 8], title: 'Support Coverage' },
  ]

  const shiftDefs = []

  // Full week coverage: 4 departments x 7 days x 2 assignees. Each staff member gets
  // only 3-4 baseline shifts this week, well under the max of 5.
  for (let dayIdx = -3; dayIdx <= 3; dayIdx++) {
    const i = dayIdx + 3 // 0=Mon .. 6=Sun
    for (const staffing of deptStaffing) {
      const managerNo = staffing.mgrs[i % staffing.mgrs.length]
      const employeeNo = staffing.emps[(i + Math.floor(i / 2)) % staffing.emps.length]
      const manager = mgrId(managerNo)

      shiftDefs.push({
        dept: staffing.dept, date: dayOffset(dayIdx), start: '09:00', end: '17:00',
        title: staffing.title, instruction: 'Baseline department coverage shift.', pub: 'published',
        creator: manager,
        assignees: [
          { u: manager, by: manager },
          { u: empId(employeeNo), by: manager },
        ],
      })
    }
  }

  // ── Special-case overrides for the demo narrative (today/tomorrow variety) ──
  shiftDefs.push(
    // Today: one uncovered hotline shift to trigger the red anomaly highlight
    { dept: 3, date: dayOffset(0), start: '13:00', end: '21:00', title: 'Customer Hotline (Overflow)', instruction: 'Cover overflow calls.', pub: 'published', creator: mgrId(7), assignees: [] },
    // Tomorrow: extra draft for variety (unassigned, so no double-booking risk)
    { dept: 2, date: dayOffset(1), start: '15:00', end: '23:00', title: 'Release Deployment', instruction: 'Deploy v2.3 after QA sign-off.', pub: 'draft', creator: mgrId(6), assignees: [] },
    // Further out: draft shifts awaiting publish
    { dept: 0, date: dayOffset(4), start: '09:00', end: '17:00', title: 'Inventory Audit', instruction: 'Full warehouse count.', pub: 'published', creator: mgrId(2), assignees: [{ u: cwId(1), by: mgrId(2) }, { u: cwId(2), by: mgrId(2) }] },
    { dept: 1, date: dayOffset(5), start: '09:00', end: '17:00', title: 'Client Pitch Prep', instruction: 'Finalize deck for Friday pitch.', pub: 'draft', creator: mgrId(3), assignees: [] },
    { dept: 2, date: dayOffset(6), start: '07:00', end: '15:00', title: 'Server Maintenance', instruction: 'Patch window, notify on-call first.', pub: 'published', creator: mgrId(5), assignees: [{ u: empId(5), by: mgrId(5) }] },
  )

  const createdShifts = [] // { shift, deptIndex, assignmentIds: [{id, userId}] }
  for (const def of shiftDefs) {
    const dept = depts[def.dept]
    const { data: shift, error: shiftErr } = await supabase
      .from('shifts')
      .insert({
        company_id: company.id,
        department_id: dept.id,
        title: def.title,
        instruction: def.instruction,
        shift_date: def.date,
        start_time: def.start,
        end_time: def.end,
        status: 'active',
        publication_status: def.pub,
        created_by: def.creator,
      })
      .select()
      .single()
    if (shiftErr) { console.warn(`  ⚠ shift 创建失败 (${def.title}): ${shiftErr.message}`); continue }

    const assignmentRecords = []
    for (const a of def.assignees) {
      const { data: sa, error: saErr } = await supabase
        .from('shift_assignments')
        .insert({
          shift_id: shift.id,
          user_id: a.u,
          assigned_by: a.by,
          assignment_status: 'assigned',
        })
        .select()
        .single()
      if (saErr) { console.warn(`  ⚠ shift_assignment 创建失败: ${saErr.message}`); continue }
      assignmentRecords.push({ id: sa.id, userId: a.u })
    }
    createdShifts.push({ shift, deptIndex: def.dept, assignments: assignmentRecords })
    console.log(`  ✓ Shift: ${def.title} @ ${def.date} (${dept.name}, ${def.pub}) — ${assignmentRecords.length} assignee(s)`)
  }

  // ── Step 11: Tasks (varied statuses/priorities, some sub-tasks) ─────────
  console.log('\nStep 11: 创建 Tasks...')

  // find the first created shift matching a department + date, for linking tasks to a shift
  const findShift = (deptIdx, date) => createdShifts.find(cs => cs.deptIndex === deptIdx && cs.shift.shift_date === date)?.shift ?? null

  const taskDefs = [
    { dept: 0, shiftDate: dayOffset(0), title: 'Restock front shelves',        desc: 'Pull from backroom inventory and restock aisle 1-3.', assignee: mgrId(1), by: mgrId(1), status: 'Complete',    pct: 100, priority: 'Medium', due: dayOffset(0) },
    { dept: 0, shiftDate: dayOffset(0), title: 'Clean and sanitize counters',  desc: null,                                                   assignee: mgrId(2), by: mgrId(1), status: 'In Progress', pct: 60,  priority: 'Low',    due: dayOffset(0) },
    { dept: 0, shiftDate: dayOffset(0), title: 'Closing cash reconciliation',  desc: 'Match till totals against POS report.',               assignee: mgrId(1), by: mgrId(1), status: 'Assigned',    pct: 0,   priority: 'High',   due: dayOffset(0) },
    { dept: 1, shiftDate: dayOffset(0), title: 'Review ad spend report',       desc: 'Flag any campaign over budget by 10%.',               assignee: mgrId(3), by: mgrId(3), status: 'Review',      pct: 90,  priority: 'High',   due: dayOffset(0) },
    { dept: 1, shiftDate: null, title: 'Draft Q3 social calendar',  desc: 'Cover all 4 platforms, 3 posts/week.',                assignee: mgrId(4), by: mgrId(4), status: 'In Progress', pct: 40,  priority: 'Medium', due: dayOffset(2) },
    { dept: 2, shiftDate: dayOffset(0), title: 'Triage incident queue',        desc: 'Clear P3/P4 tickets, escalate P1/P2.',                assignee: mgrId(5), by: mgrId(5), status: 'In Progress', pct: 50,  priority: 'Urgent', due: dayOffset(0) },
    { dept: 2, shiftDate: dayOffset(0), title: 'Update on-call runbook',       desc: null,                                                   assignee: mgrId(6), by: mgrId(5), status: 'Assigned',    pct: 0,   priority: 'Low',    due: dayOffset(3) },
    { dept: 2, shiftDate: null, title: 'Code review backlog',       desc: 'Clear 5 pending PRs.',                                assignee: mgrId(5), by: mgrId(6), status: 'Complete',    pct: 100, priority: 'Medium', due: dayOffset(-1) },
    { dept: 3, shiftDate: null, title: 'Respond to escalated ticket #4821', desc: 'Customer requesting refund.',                 assignee: mgrId(7), by: mgrId(7), status: 'Review',      pct: 85,  priority: 'Urgent', due: dayOffset(0) },
    { dept: 3, shiftDate: null, title: 'Update FAQ knowledge base', desc: null,                                                   assignee: mgrId(8), by: mgrId(8), status: 'Assigned',    pct: 0,   priority: 'Low',    due: dayOffset(5) },
    { dept: 0, shiftDate: null, title: 'Quarterly inventory audit', desc: 'Full count across all storage zones.',                assignee: mgrId(2), by: mgrId(2), status: 'Assigned',    pct: 0,   priority: 'High',   due: dayOffset(3) },
    { dept: 1, shiftDate: null, title: 'Finalize client pitch deck', desc: 'Incorporate feedback from last review.',             assignee: mgrId(3), by: mgrId(3), status: 'In Progress', pct: 70,  priority: 'High',   due: dayOffset(4) },
    // ── Tomorrow: heavier task load across all departments ──
    { dept: 0, shiftDate: dayOffset(1), title: 'Open floor and check stock',     desc: 'Verify shelves are stocked before doors open.',       assignee: mgrId(1), by: mgrId(1), status: 'Assigned',    pct: 0,   priority: 'Medium', due: dayOffset(1) },
    { dept: 0, shiftDate: dayOffset(1), title: 'Evening cash count',             desc: 'Reconcile till against POS report.',                  assignee: mgrId(2), by: mgrId(2), status: 'Assigned',    pct: 0,   priority: 'High',   due: dayOffset(1) },
    { dept: 0, shiftDate: dayOffset(1), title: 'Restock backroom for next day',  desc: null,                                                   assignee: mgrId(2), by: mgrId(2), status: 'Assigned',    pct: 0,   priority: 'Low',    due: dayOffset(1) },
    { dept: 1, shiftDate: dayOffset(1), title: 'Shoot product photos',           desc: 'Studio booked 9-1pm, 20 SKUs to cover.',               assignee: mgrId(4), by: mgrId(4), status: 'Assigned',    pct: 0,   priority: 'Medium', due: dayOffset(1) },
    { dept: 1, shiftDate: dayOffset(1), title: 'Review evening ad performance',  desc: 'Pull CTR/CPC numbers for the 1pm-9pm slot.',           assignee: mgrId(3), by: mgrId(3), status: 'Review',      pct: 90,  priority: 'High',   due: dayOffset(1) },
    { dept: 1, shiftDate: null, title: 'Finalize product photo selects', desc: 'Pick the best 5 shots for the catalog.',             assignee: mgrId(4), by: mgrId(4), status: 'Complete',    pct: 100, priority: 'Medium', due: dayOffset(1) },
    { dept: 2, shiftDate: dayOffset(1), title: 'Prepare sprint backlog',         desc: 'Groom top 15 tickets before planning.',                assignee: mgrId(6), by: mgrId(6), status: 'In Progress', pct: 30,  priority: 'Medium', due: dayOffset(1) },
    { dept: 2, shiftDate: dayOffset(1), title: 'QA sign-off for v2.3',           desc: 'Run regression suite before deployment window.',      assignee: mgrId(5), by: mgrId(5), status: 'Review',      pct: 95,  priority: 'Urgent', due: dayOffset(1) },
    { dept: 2, shiftDate: null, title: 'Merge hotfix branch',          desc: 'Hotfix for the login redirect bug.',                   assignee: mgrId(6), by: mgrId(6), status: 'Complete',    pct: 100, priority: 'High',   due: dayOffset(1) },
    { dept: 3, shiftDate: dayOffset(1), title: 'Morning ticket triage',          desc: 'Clear overnight backlog before 9am.',                  assignee: mgrId(7), by: mgrId(7), status: 'Complete',    pct: 100, priority: 'High',   due: dayOffset(1) },
    { dept: 3, shiftDate: dayOffset(1), title: 'Evening hotline coverage notes', desc: null,                                                   assignee: mgrId(8), by: mgrId(8), status: 'Review',      pct: 80,  priority: 'Medium', due: dayOffset(1) },
    { dept: 3, shiftDate: null, title: 'Prep tomorrow\'s FAQ updates', desc: 'Add macros for the 3 most common ticket types.',      assignee: mgrId(8), by: mgrId(8), status: 'In Progress', pct: 20,  priority: 'Low',    due: dayOffset(1) },
    { dept: 0, shiftDate: null, title: 'Submit weekly headcount report', desc: 'Send to Owner for sign-off.',                       assignee: mgrId(1), by: mgrId(1), status: 'Review',      pct: 90,  priority: 'Medium', due: dayOffset(1) },
    { dept: 0, shiftDate: null, title: 'Label and shelve new delivery', desc: null,                                                  assignee: mgrId(1), by: mgrId(1), status: 'Complete',    pct: 100, priority: 'Low',    due: dayOffset(1) },
  ]

  const createdTasks = []
  for (const t of taskDefs) {
    const dept = depts[t.dept]
    const shift = t.shiftDate ? findShift(t.dept, t.shiftDate) : null
    if (!managerIdsByDept[t.dept]?.has(t.assignee)) {
      console.error(`  ✗ task assignee must be a manager in the same department: ${t.title}`)
      process.exit(1)
    }
    const { data: task, error: taskErr } = await supabase
      .from('tasks')
      .insert({
        shift_id: shift ? shift.id : null,
        company_id: company.id,
        department_id: dept.id,
        title: t.title,
        description: t.desc,
        assigned_user_id: t.assignee,
        assigned_by: t.by,
        status: t.status,
        percentage_complete: t.pct,
        priority: t.priority,
        due_at: new Date(`${t.due}T18:00:00`).toISOString(),
        task_date: t.due,
      })
      .select()
      .single()
    if (taskErr) { console.warn(`  ⚠ task 创建失败 (${t.title}): ${taskErr.message}`); continue }
    createdTasks.push(task)
    console.log(`  ✓ Task: ${t.title} [${t.status}, ${t.priority}] (${dept.name})`)
  }

  // sub-tasks under "Triage incident queue"
  const parentTask = createdTasks.find(t => t.title === 'Triage incident queue')
  if (parentTask) {
    const subTasks = [
      { title: 'Escalate P1 outage ticket #991', status: 'Complete', pct: 100 },
      { title: 'Reply to P2 billing ticket #1004', status: 'In Progress', pct: 50 },
    ]
    for (const st of subTasks) {
      const { error: subErr } = await supabase.from('tasks').insert({
        shift_id: parentTask.shift_id,
        company_id: company.id,
        department_id: parentTask.department_id,
        parent_task_id: parentTask.id,
        title: st.title,
        assigned_user_id: parentTask.assigned_user_id,
        assigned_by: parentTask.assigned_by,
        status: st.status,
        percentage_complete: st.pct,
        priority: 'Medium',
        task_date: parentTask.task_date,
      })
      if (subErr) console.warn(`  ⚠ sub-task 创建失败: ${subErr.message}`)
      else console.log(`    ↳ Sub-task: ${st.title} [${st.status}]`)
    }
  }

  // ── Step 12: Recruitment (job_postings + applicants + invitations) ──────
  console.log('\nStep 12: 创建 Recruitment 数据...')

  const jobDefs = [
    {
      dept: 0, creator: mgrId(1), title: 'Weekend Retail Assistant', form_type: 'shift',
      description: 'Looking for energetic casual workers to help on the retail floor during weekend rushes.',
      requirements: 'Able to stand for long periods, customer-facing experience a plus.',
      location: 'Raffles Place', employment_type: 'casual', status: 'open', approval_status: 'approved',
      approved_by: ownerUser.id, salary_amount: 12, salary_type: 'per hour', urgency: 'normal', openings: 3,
      shift_start_time: '09:00', shift_end_time: '17:00', shift_days: ['Saturday', 'Sunday'],
      expiry_preset: '30d', expires_at: dayOffset(30),
    },
    {
      dept: 2, creator: mgrId(5), title: 'Urgent: Overnight Server Support', form_type: 'shift',
      description: 'Need a casual worker to cover overnight monitoring shifts this week due to staff shortage.',
      requirements: 'Basic IT literacy, must be contactable by phone.',
      location: 'Remote', employment_type: 'casual', status: 'open', approval_status: 'approved',
      approved_by: ownerUser.id, salary_amount: 18, salary_type: 'per hour', urgency: 'urgent', openings: 1,
      shift_start_time: '23:00', shift_end_time: '07:00', shift_days: ['Monday', 'Tuesday', 'Wednesday'],
      expiry_preset: '7d', expires_at: dayOffset(7),
    },
    {
      dept: 3, creator: mgrId(7), title: 'Event Day Customer Support Crew', form_type: 'oneoff',
      description: 'One-off event on Saturday needs 5 casual workers to help manage the customer help desk.',
      requirements: 'Friendly attitude, prior event experience preferred.',
      location: 'Marina Bay', employment_type: 'casual', status: 'open', approval_status: 'pending',
      approved_by: null, salary_amount: 100, salary_type: 'per day', urgency: 'high', openings: 5,
      job_date: dayOffset(6), job_end_date: dayOffset(6), estimated_hours: '8',
      expiry_preset: '14d', expires_at: dayOffset(14),
    },
    {
      dept: 1, creator: mgrId(3), title: 'Social Media Content Helper', form_type: 'oneoff',
      description: 'Help shoot and edit short-form video content for an upcoming campaign launch.',
      requirements: 'Experience with phone videography and basic editing apps.',
      location: 'Raffles Place', employment_type: 'casual', status: 'closed', approval_status: 'approved',
      approved_by: ownerUser.id, salary_amount: 150, salary_type: 'per day', urgency: 'normal', openings: 2,
      job_date: dayOffset(-10), job_end_date: dayOffset(-9), estimated_hours: '6',
      expiry_preset: 'none', expires_at: null,
    },
    {
      dept: 0, creator: mgrId(2), title: 'Inventory Count Support (Rejected Draft)', form_type: 'shift',
      description: 'Casual workers needed to assist with the quarterly stock count.',
      requirements: 'Attention to detail.',
      location: 'Raffles Place', employment_type: 'casual', status: 'open', approval_status: 'rejected',
      approved_by: ownerUser.id, rejection_reason: 'Budget not approved for this quarter — resubmit next cycle.',
      salary_amount: 13, salary_type: 'per hour', urgency: 'normal', openings: 4,
      shift_start_time: '09:00', shift_end_time: '17:00', shift_days: ['Monday'],
      expiry_preset: '30d', expires_at: dayOffset(30),
    },
    {
      dept: 2, creator: mgrId(6), title: 'Holiday Coverage Developer (Archived)', form_type: 'shift',
      description: 'Casual developer support needed to cover the December holiday period.',
      requirements: 'Familiarity with our stack preferred.',
      location: 'Remote', employment_type: 'casual', status: 'archived', approval_status: 'approved',
      approved_by: ownerUser.id, archived_at: dayOffset(-30), salary_amount: 20, salary_type: 'per hour', urgency: 'normal', openings: 1,
      shift_start_time: '09:00', shift_end_time: '17:00', shift_days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
      expiry_preset: 'none', expires_at: null,
    },
    {
      dept: 3, creator: mgrId(8), title: 'Seasonal Support Crew (Archived)', form_type: 'oneoff',
      description: 'Extra hands needed for the year-end customer support surge.',
      requirements: 'Available for full-day shifts during peak week.',
      location: 'Raffles Place', employment_type: 'casual', status: 'archived', approval_status: 'approved',
      approved_by: ownerUser.id, archived_at: dayOffset(-60), salary_amount: 90, salary_type: 'per day', urgency: 'normal', openings: 6,
      job_date: dayOffset(-65), job_end_date: dayOffset(-60), estimated_hours: '8',
      expiry_preset: 'none', expires_at: null,
    },
    {
      dept: 1, creator: mgrId(4), title: 'Brand Photography Assistant', form_type: 'oneoff',
      description: 'Awaiting Owner review before this can go live for applicants.',
      requirements: 'Portfolio of past shoots required.',
      location: 'Raffles Place', employment_type: 'casual', status: 'open', approval_status: 'pending',
      approved_by: null, salary_amount: 120, salary_type: 'per day', urgency: 'normal', openings: 1,
      job_date: dayOffset(10), job_end_date: dayOffset(10), estimated_hours: '6',
      expiry_preset: '14d', expires_at: dayOffset(14),
    },
    {
      dept: 2, creator: mgrId(5), title: 'Weekend QA Tester', form_type: 'shift',
      description: 'Submitted for Owner review — needs sign-off before publishing externally.',
      requirements: 'Manual QA experience, mobile + web.',
      location: 'Raffles Place', employment_type: 'casual', status: 'open', approval_status: 'pending',
      approved_by: null, salary_amount: 16, salary_type: 'per hour', urgency: 'normal', openings: 2,
      shift_start_time: '09:00', shift_end_time: '17:00', shift_days: ['Saturday'],
      expiry_preset: '7d', expires_at: dayOffset(7),
    },
  ]

  const createdJobs = []
  for (const j of jobDefs) {
    const dept = depts[j.dept]
    const { data: job, error: jobErr } = await supabase
      .from('job_postings')
      .insert({
        company_id: company.id,
        department_id: dept.id,
        created_by: j.creator,
        title: j.title,
        description: j.description,
        requirements: j.requirements,
        location: j.location,
        employment_type: j.employment_type,
        status: j.status,
        archived_at: j.archived_at ? new Date(`${j.archived_at}T12:00:00`).toISOString() : null,
        company_name: company.name,
        industry: company.industry,
        salary_amount: j.salary_amount,
        salary_type: j.salary_type,
        approval_status: j.approval_status,
        approved_by: j.approved_by,
        rejection_reason: j.rejection_reason ?? null,
        benefits: 'Flexible hours, weekly pay, meal allowance.',
        urgency: j.urgency,
        openings: j.openings,
        form_type: j.form_type,
        shift_start_time: j.shift_start_time ?? null,
        shift_end_time: j.shift_end_time ?? null,
        shift_days: j.shift_days ?? null,
        job_date: j.job_date ?? null,
        job_end_date: j.job_end_date ?? null,
        estimated_hours: j.estimated_hours ?? null,
        expiry_preset: j.expiry_preset,
        expires_at: j.expires_at,
      })
      .select()
      .single()
    if (jobErr) { console.warn(`  ⚠ job_posting 创建失败 (${j.title}): ${jobErr.message}`); continue }
    createdJobs.push(job)
    console.log(`  ✓ Job: ${j.title} [${j.status}/${j.approval_status}] (${dept.name})`)
  }

  // Applicants — only against open/approved jobs (index 0,1,2)
  const applicantDefs = [
    { jobIdx: 0, user: cwId(1), status: 'pending' },
    { jobIdx: 0, user: cwId(2), status: 'shortlisted' },
    { jobIdx: 0, user: cwId(3), status: 'rejected' },
    { jobIdx: 1, user: cwId(5), status: 'invited' },
    { jobIdx: 2, user: cwId(6), status: 'pending' },
    { jobIdx: 2, user: cwId(7), status: 'shortlisted' },
    { jobIdx: 3, user: cwId(4), status: 'rejected' },
  ]
  const createdApplicants = []
  for (const a of applicantDefs) {
    const job = createdJobs[a.jobIdx]
    if (!job) continue
    const { data: applicant, error: appErr } = await supabase
      .from('job_applicants')
      .insert({
        job_id: job.id,
        user_id: a.user,
        resume_url: DEMO_RESUME_URL,
        cover_letter: 'I am very interested in this opportunity and available for all listed shifts.',
        status: a.status,
      })
      .select()
      .single()
    if (appErr) { console.warn(`  ⚠ job_applicant 创建失败: ${appErr.message}`); continue }
    createdApplicants.push({ ...applicant, jobIdx: a.jobIdx })
    console.log(`  ✓ Applicant → ${job.title} [${a.status}]`)
  }

  // Invitations — sent to the 'invited' applicant plus one shortlisted one
  const invitationDefs = [
    { applicantStatus: 'invited',     by: mgrId(5), message: 'We would like to invite you to join this overnight support role — please confirm availability.', status: 'sent' },
    { applicantStatus: 'shortlisted', by: mgrId(7), message: 'You have been shortlisted for the event crew — confirm if you can make Saturday.',               status: 'accepted' },
  ]
  for (const inv of invitationDefs) {
    const applicant = createdApplicants.find(a => a.status === inv.applicantStatus)
    if (!applicant) continue
    const job = createdJobs[applicant.jobIdx]
    const { error: invErr } = await supabase.from('job_invitations').insert({
      job_id: job.id,
      applicant_id: applicant.id,
      sent_by: inv.by,
      message: inv.message,
      status: inv.status,
    })
    if (invErr) console.warn(`  ⚠ job_invitation 创建失败: ${invErr.message}`)
    else console.log(`  ✓ Invitation → ${job.title} [${inv.status}]`)
  }

  // ── Step 13: Messages ────────────────────────────────────────────────────
  console.log('\nStep 13: 创建 Messages...')

  const messageDefs = [
    { from: ownerUser.id,  to: mgrId(1), content: 'Can you send me this week\'s headcount for Operations?', read: true },
    { from: mgrId(1),      to: ownerUser.id, content: 'Sure — I\'ll have it ready by end of day.', read: true },
    { from: mgrId(3),      to: empId(3), content: 'Please double check the ad spend numbers before the 3pm review.', read: true },
    { from: empId(3),      to: mgrId(3), content: 'Done, numbers look good. Sent the report to your inbox.', read: false },
    { from: mgrId(5),      to: empId(5), content: 'Heads up — there\'s an overnight job posting open if you know anyone interested.', read: false },
    { from: ownerUser.id,  to: userIdMap['partner1@test.com'].internalId, content: 'Can you review the rejected inventory job posting? Need your sign-off.', read: false },
    { from: mgrId(7),      to: empId(7), content: 'Great work resolving ticket #4821 so quickly.', read: true },
    { from: empId(7),      to: mgrId(7), content: 'Thanks! Customer was happy with the refund turnaround.', read: false },
    { from: mgrId(2),      to: ownerUser.id, content: 'The inventory audit job posting got rejected — should I resubmit with a lower budget?', read: false },
  ]
  for (const m of messageDefs) {
    const { error: msgErr } = await supabase.from('messages').insert({
      from_user_id: m.from,
      to_user_id: m.to,
      company_id: company.id,
      content: m.content,
      is_read: m.read,
    })
    if (msgErr) console.warn(`  ⚠ message 创建失败: ${msgErr.message}`)
    else console.log(`  ✓ Message sent`)
  }

  // ── Step 14: Announcements ───────────────────────────────────────────────
  console.log('\nStep 14: 创建 Announcements...')

  const announcementDefs = [
    { from: ownerUser.id, dept: null, title: 'Company-wide: Updated Attendance Policy', content: 'Starting next month, all clock-ins must be confirmed within 24 hours by your supervising Employee. Please review the updated handbook.' },
    { from: ownerUser.id, dept: null, title: 'Office Closed — Public Holiday', content: 'We will be closed this Friday for the public holiday. Shifts have been adjusted accordingly — check the Timeline for changes.' },
    { from: mgrId(1), dept: depts[0].id, title: 'Operations: New Stock Intake Procedure', content: 'All new stock must be logged in the inventory sheet before being placed on the floor, effective immediately.' },
    { from: mgrId(5), dept: depts[2].id, title: 'Engineering: Scheduled Maintenance Window', content: 'Server maintenance is scheduled for this weekend 7am-3pm. Please plan deployments accordingly.' },
    { from: mgrId(7), dept: depts[3].id, title: 'Customer Support: New FAQ Macros Available', content: 'We\'ve added 10 new response macros to speed up common ticket replies — check the knowledge base.' },
  ]
  for (const a of announcementDefs) {
    const { error: anErr } = await supabase.from('announcements').insert({
      from_user_id: a.from,
      company_id: company.id,
      department_id: a.dept,
      title: a.title,
      content: a.content,
    })
    if (anErr) console.warn(`  ⚠ announcement 创建失败: ${anErr.message}`)
    else console.log(`  ✓ Announcement: ${a.title}`)
  }

  // ── 完成 ───────────────────────────────────────────────────────────────
  console.log('\n═══════════════════════════════════════════')
  console.log('  ✅ Seed 完成！')
  console.log('═══════════════════════════════════════════')
  console.log('\n测试账号（密码统一：111111）')
  console.log('  Owner:    owner@test.com')
  console.log('  Partner:  partner1@test.com / partner2@test.com')
  console.log('  Manager:  manager1~8@test.com')
  console.log('  Employee: employee1~8@test.com')
  console.log('  CW:       cw1~10@test.com')
  console.log('\n公司：Sunrise Hospitality Group')
  console.log('\n部门分配：')
  console.log('  Operations:       manager1,2 / employee1,2')
  console.log('  Marketing:        manager3,4 / employee3,4')
  console.log('  Engineering:      manager5,6 / employee5,6')
  console.log('  Customer Support: manager7,8 / employee7,8')
  console.log('\nCasual Workers：')
  console.log('  Active (7):   cw1~7@test.com')
  console.log('  Inactive (3): cw8~10@test.com（含 inactivate_reason）')
  console.log('\n注意：job_applicants 中的 resume_url / cover_letter 字段')
  console.log('  resume_url: ' + DEMO_RESUME_URL)
  console.log('  cover_letter: (text field, not URL)')
  console.log(`\nDemo 数据：`)
  console.log(`  Shifts: ${createdShifts.length} (draft + published, today/past/future, 含未覆盖班次)`)
  console.log(`  Tasks: ${createdTasks.length}+ (Assigned/In Progress/Review/Complete，含子任务)`)
  console.log(`  Job Postings: ${createdJobs.length} (open/closed, approved/pending/rejected)`)
  console.log(`  Job Applicants: ${createdApplicants.length} (pending/shortlisted/rejected/invited)`)
  console.log(`  Messages + Announcements: 已插入`)
}

main().catch(err => {
  console.error('\n✗ 脚本异常:', err.message)
  process.exit(1)
})
