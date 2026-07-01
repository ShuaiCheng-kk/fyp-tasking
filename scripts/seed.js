/**
 * scripts/seed.js — Tasking 完整开发数据重建脚本
 *
 * 功能：
 *   1. 清空账户/公司/部门及所有业务数据表
 *   2. 删除 auth.users 里的旧测试账号
 *   3. 在 Supabase Auth 创建真实账号（密码统一 111111）
 *   4. 插入 public.users、companies、departments 及部门分配
 *   5. 插入 Casual Workers（含 date_of_birth, phone_number, worker_status 等）
 *   6. 生成 Shifts（过去7天 + 未来7天，每个 Employee/Manager 每天一个班）
 *   7. 生成 Attendance Records（仅对过去的 shift，混合准时/迟到/缺勤/各审批状态）
 *   8. 生成 Tasks（每个部门若干条，混合状态：Assigned/In Progress/Review/Complete）
 *   9. 生成 Communication 数据（Announcements + Manager-Employee 对话）
 *
 * 测试账号结构：
 *   1 Owner, 2 Partner, 8 Manager, 8 Employee, 10 Casual Worker
 *   1 Company, 4 Department, 2 Manager/dept, 2 Employee/dept
 *
 * 日期全部基于脚本运行当天动态推算，没有任何写死的绝对日期 —— 每次运行都会以
 * "今天"为锚点重新生成过去/未来的 Shift、Attendance、Task 数据。
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

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

// ─── 日期工具（全部基于"今天"动态推算，禁止写死绝对日期）──────────────────────

function dateKey(d) {
  return d.toISOString().slice(0, 10)
}
function addDays(d, n) {
  const next = new Date(d)
  next.setDate(next.getDate() + n)
  return next
}
function isWeekend(d) {
  const day = d.getDay()
  return day === 0 || day === 6
}
const TODAY = new Date()
TODAY.setHours(0, 0, 0, 0)

// ─── 账号定义 ──────────────────────────────────────────────────────────────────

const DEMO_PHOTO_URL = 'https://api.dicebear.com/7.x/avataaars/svg?seed=tasking'

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
  { email: 'cw1@test.com',  full_name: 'Alicia Tan',     phone_number: '+65 8100 1001', date_of_birth: '1998-05-12', worker_status: 'active',   inactivate_reason: null, hourly_rate: 15.50 },
  { email: 'cw2@test.com',  full_name: 'Nadia Wong',     phone_number: '+65 8100 1002', date_of_birth: '2000-08-22', worker_status: 'active',   inactivate_reason: null, hourly_rate: 14.00 },
  { email: 'cw3@test.com',  full_name: 'Hui Min Lee',    phone_number: '+65 8100 1003', date_of_birth: '1999-03-17', worker_status: 'active',   inactivate_reason: null, hourly_rate: 16.00 },
  { email: 'cw4@test.com',  full_name: 'Farah Hassan',   phone_number: '+65 8100 1004', date_of_birth: '2001-11-05', worker_status: 'active',   inactivate_reason: null, hourly_rate: 13.50 },
  { email: 'cw5@test.com',  full_name: 'Ethan Ong',      phone_number: '+65 8100 1005', date_of_birth: '1997-07-30', worker_status: 'active',   inactivate_reason: null, hourly_rate: 17.00 },
  { email: 'cw6@test.com',  full_name: 'Daniel Goh',     phone_number: '+65 8100 1006', date_of_birth: '2002-02-14', worker_status: 'active',   inactivate_reason: null, hourly_rate: 14.50 },
  { email: 'cw7@test.com',  full_name: 'Siti Nur',       phone_number: '+65 8100 1007', date_of_birth: '1996-09-09', worker_status: 'active',   inactivate_reason: null, hourly_rate: 15.00 },
  { email: 'cw8@test.com',  full_name: 'Marcus Lim',     phone_number: '+65 8100 1008', date_of_birth: '2000-04-25', worker_status: 'inactive', inactivate_reason: 'Repeated no-shows without prior notice.', hourly_rate: null },
  { email: 'cw9@test.com',  full_name: 'Jasper Koh',     phone_number: '+65 8100 1009', date_of_birth: '1999-12-01', worker_status: 'inactive', inactivate_reason: 'Violated workplace conduct policy.',     hourly_rate: null },
  { email: 'cw10@test.com', full_name: 'Mei Xin Teo',    phone_number: '+65 8100 1010', date_of_birth: '1998-06-18', worker_status: 'inactive', inactivate_reason: 'Unable to meet shift requirements.',     hourly_rate: null },
]

const legacyTestEmailsToDelete = [
  ...accounts.map(a => a.email),
  ...casualWorkers.map(cw => cw.email),
]

// ─── 业务数据生成参数 ──────────────────────────────────────────────────────────

const SHIFT_DAYS_PAST = 7
const SHIFT_DAYS_FUTURE = 7
const TASK_PRIORITIES = ['Low', 'Medium', 'High', 'Urgent']
const TASK_STATUSES = ['Assigned', 'In Progress', 'Review', 'Complete']

const TASK_TITLES_BY_DEPT = {
  Operations: ['Restock supply room', 'Audit equipment checklist', 'Update SOP document', 'Coordinate vendor delivery', 'Prepare weekly ops report'],
  Marketing: ['Draft social media calendar', 'Review campaign analytics', 'Design promo banner', 'Schedule email newsletter', 'Brief design freelancer'],
  Engineering: ['Fix login page bug', 'Review pull request', 'Update API documentation', 'Investigate performance issue', 'Deploy hotfix to staging'],
  'Customer Support': ['Resolve escalated ticket', 'Update FAQ article', 'Follow up with unhappy customer', 'Review support macros', 'Train new support agent'],
}

const ANNOUNCEMENT_TEMPLATES = [
  { title: 'Office closed for public holiday', content: 'Reminder that the office will be closed next week for the public holiday. Please plan your shifts accordingly.' },
  { title: 'New attendance policy rollout', content: 'Starting this month, clock-in is graced by 10 minutes past shift start. Please review the updated attendance guide.' },
  { title: 'Town hall this Friday', content: 'Join us this Friday at 3pm for the quarterly town hall. We will be covering company updates and Q&A.' },
]

const MESSAGE_TEMPLATES = [
  'Hey, can you cover my shift this Thursday?',
  'Sure, I can take it. Just let me know the time.',
  'Thanks! It is the 2pm to 6pm slot.',
  'Got it, I will clock in on time.',
  'Appreciate it — let me know if anything changes.',
]

function pick(arr, i) {
  return arr[i % arr.length]
}

// ─── 主流程 ────────────────────────────────────────────────────────────────────

async function main() {
  console.log('═══════════════════════════════════════════')
  console.log('  Tasking Seed Script')
  console.log('═══════════════════════════════════════════\n')

  // ── Step 1: 清空数据表（含历史业务数据，避免外键阻塞 users/companies 删除）──
  console.log('Step 1: 清空数据表...')
  const tablesToClear = [
    'attendance_records',
    'shift_action_history',
    'shift_swap_requests',
    'shift_assignments',
    'shifts',
    'shift_templates',
    'tasks',
    'messages',
    'announcements',
    'inbox',
    'job_invitations',
    'job_applicants',
    'job_postings',
    'time_off_requests',
    'employee_fixed_off_days',
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
  const deptDefs = [
    { name: 'Operations',       color: '#3B82F6' }, // blue
    { name: 'Marketing',        color: '#EC4899' }, // pink
    { name: 'Engineering',      color: '#10B981' }, // emerald
    { name: 'Customer Support', color: '#F59E0B' }, // amber
  ]
  const depts = []
  for (const def of deptDefs) {
    const { data: dept, error: deptErr } = await supabase
      .from('departments')
      .insert({ name: def.name, color: def.color, company_id: company.id })
      .select()
      .single()
    const name = def.name
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
        hourly_rate: cw.hourly_rate ?? null,
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

  // Helper maps for the business-data steps below
  const deptByIndex = depts // [Operations, Marketing, Engineering, Customer Support]
  const managersByDept = [
    [managerEmails[0], managerEmails[1]],
    [managerEmails[2], managerEmails[3]],
    [managerEmails[4], managerEmails[5]],
    [managerEmails[6], managerEmails[7]],
  ]
  const employeesByDept = [
    [employeeEmails[0], employeeEmails[1]],
    [employeeEmails[2], employeeEmails[3]],
    [employeeEmails[4], employeeEmails[5]],
    [employeeEmails[6], employeeEmails[7]],
  ]

  // ── Step 10: Shifts + Shift Assignments ─────────────────────────────────
  // 过去 SHIFT_DAYS_PAST 天 + 未来 SHIFT_DAYS_FUTURE 天，每个 Employee/Manager
  // 每个工作日一个班（周末跳过），全部 published。日期锚点是脚本运行时的"今天"。
  console.log('\nStep 10: 生成 Shifts + Shift Assignments...')
  const allStaffEmails = [...managerEmails, ...employeeEmails]
  // assignmentInfo: shiftAssignmentId -> { date, start_time, end_time, userEmail, isPast }
  const assignmentInfo = []

  for (let dayOffset = -SHIFT_DAYS_PAST; dayOffset <= SHIFT_DAYS_FUTURE; dayOffset++) {
    const shiftDate = addDays(TODAY, dayOffset)
    if (isWeekend(shiftDate)) continue
    const shiftDateStr = dateKey(shiftDate)
    const isPast = dayOffset < 0

    for (let deptIdx = 0; deptIdx < deptByIndex.length; deptIdx++) {
      const dept = deptByIndex[deptIdx]
      const staffEmails = [...managersByDept[deptIdx], ...employeesByDept[deptIdx]]
      for (const email of staffEmails) {
        const isManager = managerEmails.includes(email)
        const startTime = isManager ? '09:00' : '11:00'
        const endTime = isManager ? '17:00' : '18:00'
        const userId = userIdMap[email].internalId

        const { data: shift, error: shiftErr } = await supabase
          .from('shifts')
          .insert({
            company_id: company.id,
            department_id: dept.id,
            title: `${dept.name} ${isManager ? 'Shift' : 'Afternoon Shift'}`,
            shift_date: shiftDateStr,
            start_time: startTime,
            end_time: endTime,
            status: 'active',
            publication_status: 'published',
            created_by: ownerUser.id,
          })
          .select('id')
          .single()
        if (shiftErr) { console.warn(`  ⚠ 创建 shift 失败 (${email}, ${shiftDateStr}): ${shiftErr.message}`); continue }

        const { data: assignment, error: assignErr } = await supabase
          .from('shift_assignments')
          .insert({
            shift_id: shift.id,
            user_id: userId,
            assigned_by: ownerUser.id,
          })
          .select('id')
          .single()
        if (assignErr) { console.warn(`  ⚠ 创建 assignment 失败 (${email}, ${shiftDateStr}): ${assignErr.message}`); continue }

        assignmentInfo.push({
          assignmentId: assignment.id,
          shiftId: shift.id,
          shiftDate: shiftDateStr,
          startTime,
          endTime,
          email,
          userId,
          deptIdx,
          isPast,
        })
      }
    }
  }
  console.log(`  ✓ 生成 ${assignmentInfo.length} 个 shift + assignment（过去 ${SHIFT_DAYS_PAST} 天 + 未来 ${SHIFT_DAYS_FUTURE} 天，跳过周末）`)

  // ── Step 11: Attendance Records（仅对过去的 shift）──────────────────────
  // 混合比例：70% 准时打卡完成已审批，10% 迟到，10% 仍待审批，5% 被驳回，5% 缺勤（不生成记录）。
  console.log('\nStep 11: 生成 Attendance Records（过去的 shift）...')
  const pastAssignments = assignmentInfo.filter(a => a.isPast)
  let attendanceCount = 0
  for (let i = 0; i < pastAssignments.length; i++) {
    const a = pastAssignments[i]
    const bucket = i % 20 // deterministic distribution, no randomness needed for repeatable seeds
    if (bucket < 1) continue // ~5% absent — no attendance_records row at all

    const [startH, startM] = a.startTime.split(':').map(Number)
    const [endH, endM] = a.endTime.split(':').map(Number)
    const clockInBase = new Date(`${a.shiftDate}T${a.startTime}:00Z`)
    const clockOutBase = new Date(`${a.shiftDate}T${a.endTime}:00Z`)

    let clockInTime
    let ownerStatus
    let status
    if (bucket < 3) {
      // ~10% late — clock in 15 minutes after scheduled start
      clockInTime = new Date(clockInBase.getTime() + 15 * 60000)
    } else {
      // on time — within the 10-minute grace window
      clockInTime = new Date(clockInBase.getTime() + 3 * 60000)
    }
    const clockOutTime = new Date(clockOutBase.getTime() + 2 * 60000)

    if (bucket < 5) {
      status = 'submitted'; ownerStatus = 'pending'
    } else if (bucket < 7) {
      status = 'owner_rejected'; ownerStatus = 'rejected'
    } else {
      status = 'owner_approved'; ownerStatus = 'approved'
    }

    const { error: attErr } = await supabase.from('attendance_records').insert({
      shift_assignment_id: a.assignmentId,
      casual_worker_id: a.userId,
      confirmed_by_employee_id: a.userId,
      submitted_by_employee_id: a.userId,
      clock_in_time: clockInTime.toISOString(),
      clock_out_time: clockOutTime.toISOString(),
      status,
      owner_status: ownerStatus,
      owner_reviewed_by: ownerStatus === 'pending' ? null : ownerUser.id,
      owner_reviewed_at: ownerStatus === 'pending' ? null : new Date().toISOString(),
    })
    if (attErr) console.warn(`  ⚠ 创建 attendance_record 失败 (${a.email}, ${a.shiftDate}): ${attErr.message}`)
    else attendanceCount++
  }
  console.log(`  ✓ 生成 ${attendanceCount} 条 attendance_records（混合 approved/pending/rejected/late，~5% 缺勤无记录）`)

  // ── Step 11b: Casual Worker Shifts + Attendance Records ─────────────────
  // 每个 active CW 分配到一个部门，过去 7 天生成 shifts（混合 Shift Job / One-Off）
  // 每个 CW 由同部门的 Employee 负责 supervise。
  console.log('\nStep 11b: 生成 Casual Worker Shifts + Attendance Records...')
  const activeCWEmails = ['cw1@test.com','cw2@test.com','cw3@test.com','cw4@test.com','cw5@test.com','cw6@test.com','cw7@test.com']
  // 每 dept 分配约 1-2 个 CW
  const cwByDept = [
    ['cw1@test.com', 'cw2@test.com'], // dept[0]
    ['cw3@test.com', 'cw4@test.com'], // dept[1]
    ['cw5@test.com', 'cw6@test.com'], // dept[2]
    ['cw7@test.com'],                  // dept[3]
  ]
  const cwAssignmentInfo = []
  let cwShiftCount = 0

  for (let deptIdx = 0; deptIdx < deptByIndex.length; deptIdx++) {
    const dept = deptByIndex[deptIdx]
    const deptCWEmails = cwByDept[deptIdx]
    const supervisorEmail = employeesByDept[deptIdx][0] // first employee supervises CWs
    const supervisorId = userIdMap[supervisorEmail].internalId

    for (let cwIdx = 0; cwIdx < deptCWEmails.length; cwIdx++) {
      const cwEmail = deptCWEmails[cwIdx]
      const cwId = userIdMap[cwEmail].internalId
      // Alternate: even CW index = Shift Job (is_open_ended=false), odd = One-Off (is_open_ended=true)
      const isOneOff = cwIdx % 2 === 1

      for (let dayOffset = -SHIFT_DAYS_PAST; dayOffset <= 0; dayOffset++) {
        const shiftDate = addDays(TODAY, dayOffset)
        if (isWeekend(shiftDate)) continue
        const shiftDateStr = dateKey(shiftDate)
        const isPast = dayOffset < 0

        // CW shift times vary by dept slot
        const startTime = cwIdx % 2 === 0 ? '09:00' : '13:00'
        const endTime   = cwIdx % 2 === 0 ? '17:00' : '21:00'

        const { data: cwShift, error: cwShiftErr } = await supabase
          .from('shifts')
          .insert({
            company_id: company.id,
            department_id: dept.id,
            title: `${dept.name} CW ${isOneOff ? 'One-Off' : 'Regular'} Shift`,
            shift_date: shiftDateStr,
            start_time: startTime,
            end_time: endTime,
            status: 'active',
            publication_status: 'published',
            is_open_ended: isOneOff,
            flat_rate: isOneOff ? 120.00 : null,
            created_by: ownerUser.id,
          })
          .select('id')
          .single()
        if (cwShiftErr) { console.warn(`  ⚠ CW shift 失败 (${cwEmail}, ${shiftDateStr}): ${cwShiftErr.message}`); continue }

        const { data: cwAssignment, error: cwAssignErr } = await supabase
          .from('shift_assignments')
          .insert({
            shift_id: cwShift.id,
            user_id: cwId,
            assigned_by: ownerUser.id,
            supervisor_employee_id: supervisorId,
          })
          .select('id')
          .single()
        if (cwAssignErr) { console.warn(`  ⚠ CW assignment 失败 (${cwEmail}, ${shiftDateStr}): ${cwAssignErr.message}`); continue }

        cwShiftCount++
        cwAssignmentInfo.push({
          assignmentId: cwAssignment.id,
          shiftDate: shiftDateStr,
          startTime,
          endTime,
          email: cwEmail,
          userId: cwId,
          supervisorId,
          deptIdx,
          isPast,
        })
      }
    }
  }
  console.log(`  ✓ 生成 ${cwShiftCount} 个 CW shift + assignment`)

  // Attendance records for CW past shifts
  let cwAttCount = 0
  const cwPastAssignments = cwAssignmentInfo.filter(a => a.isPast)
  for (let i = 0; i < cwPastAssignments.length; i++) {
    const a = cwPastAssignments[i]
    const bucket = i % 10
    if (bucket === 0) continue // 10% absent — no record

    const clockInBase  = new Date(`${a.shiftDate}T${a.startTime}:00Z`)
    const clockOutBase = new Date(`${a.shiftDate}T${a.endTime}:00Z`)
    const isLate = bucket === 1 // 10% late
    const clockInTime  = new Date(clockInBase.getTime()  + (isLate ? 18 : 3) * 60000)
    const clockOutTime = new Date(clockOutBase.getTime() + 2 * 60000)

    const ownerStatus = bucket < 3 ? 'pending' : bucket < 5 ? 'rejected' : 'approved'
    const status      = bucket < 3 ? 'submitted' : bucket < 5 ? 'owner_rejected' : 'owner_approved'

    const { error: cwAttErr } = await supabase.from('attendance_records').insert({
      shift_assignment_id: a.assignmentId,
      casual_worker_id: a.userId,
      confirmed_by_employee_id: a.supervisorId,
      submitted_by_employee_id: a.supervisorId,
      clock_in_time: clockInTime.toISOString(),
      clock_out_time: clockOutTime.toISOString(),
      status,
      owner_status: ownerStatus,
      owner_reviewed_by: ownerStatus === 'pending' ? null : ownerUser.id,
      owner_reviewed_at: ownerStatus === 'pending' ? null : new Date().toISOString(),
    })
    if (cwAttErr) console.warn(`  ⚠ CW attendance 失败 (${a.email}, ${a.shiftDate}): ${cwAttErr.message}`)
    else cwAttCount++
  }
  console.log(`  ✓ 生成 ${cwAttCount} 条 CW attendance_records（混合 approved/pending/rejected/late，10% 缺勤）`)

  // ── Step 12: Tasks（每个未来 shift 挂一条 task，保证 Shift Swap 的 Task Changes
  // 预览、Kanban 等 UI 都能看到真实数据 —— tasks.shift_id 之前完全没设置，导致任何
  // 依赖 shift_id 关联的功能（如批准 swap 时的 task 转移预览）永远查不到东西）────
  console.log('\nStep 12: 生成 Tasks（挂在每个未来 shift 上）...')
  let taskCount = 0
  const percentByStatus = { Assigned: 0, 'In Progress': 40, Review: 80, Complete: 100 }
  const futureStaffAssignments = assignmentInfo.filter(a => !a.isPast)
  for (let i = 0; i < futureStaffAssignments.length; i++) {
    const a = futureStaffAssignments[i]
    const dept = deptByIndex[a.deptIdx]
    const titles = TASK_TITLES_BY_DEPT[dept.name] || []
    if (titles.length === 0) continue
    const isManager = managerEmails.includes(a.email)
    // Owner assigns Manager tasks; Manager assigns Employee tasks (one level down, per the
    // company hierarchy — never skip a level and never self-assign).
    const assignedByUserId = isManager ? ownerUser.id : userIdMap[managersByDept[a.deptIdx][0]].internalId
    const title = pick(titles, i)
    const status = pick(TASK_STATUSES, i)
    const priority = pick(TASK_PRIORITIES, i)

    const { error: taskErr } = await supabase.from('tasks').insert({
      company_id: company.id,
      department_id: dept.id,
      shift_id: a.shiftId,
      title,
      description: `${title} for the ${dept.name} team.`,
      assigned_user_id: a.userId,
      assigned_by: assignedByUserId,
      status,
      percentage_complete: percentByStatus[status],
      priority,
      due_at: new Date(`${a.shiftDate}T${a.endTime}:00Z`).toISOString(),
      task_date: a.shiftDate,
    })
    if (taskErr) console.warn(`  ⚠ 创建 task 失败 (${a.email}, ${a.shiftDate}): ${taskErr.message}`)
    else taskCount++
  }
  console.log(`  ✓ 生成 ${taskCount} 条 tasks（每个未来 shift 一条，挂在对应 shift_id 上，混合 Assigned/In Progress/Review/Complete）`)

  // ── Step 13: Communication — Announcements ──────────────────────────────
  console.log('\nStep 13: 生成 Announcements...')
  let announcementCount = 0
  for (let i = 0; i < ANNOUNCEMENT_TEMPLATES.length; i++) {
    const tpl = ANNOUNCEMENT_TEMPLATES[i]
    // First announcement is company-wide (Owner), rest are per-department (rotating manager)
    const isCompanyWide = i === 0
    const deptIdx = i % deptByIndex.length
    const fromUserId = isCompanyWide ? ownerUser.id : userIdMap[managersByDept[deptIdx][0]].internalId
    const departmentId = isCompanyWide ? null : deptByIndex[deptIdx].id

    const { error: annErr } = await supabase.from('announcements').insert({
      from_user_id: fromUserId,
      company_id: company.id,
      department_id: departmentId,
      title: tpl.title,
      content: tpl.content,
    })
    if (annErr) console.warn(`  ⚠ 创建 announcement 失败 (${tpl.title}): ${annErr.message}`)
    else announcementCount++
  }
  console.log(`  ✓ 生成 ${announcementCount} 条 announcements`)

  // ── Step 14: Communication — Messages（每个部门一组 Manager-Employee 对话）──
  console.log('\nStep 14: 生成 Messages...')
  let messageCount = 0
  for (let deptIdx = 0; deptIdx < deptByIndex.length; deptIdx++) {
    const managerEmail = managersByDept[deptIdx][0]
    const employeeEmail = employeesByDept[deptIdx][0]
    const managerId = userIdMap[managerEmail].internalId
    const employeeId = userIdMap[employeeEmail].internalId
    const managerName = accounts.find(a => a.email === managerEmail).full_name
    const employeeName = accounts.find(a => a.email === employeeEmail).full_name

    for (let i = 0; i < MESSAGE_TEMPLATES.length; i++) {
      const fromEmployee = i % 2 === 1 // alternate sender, employee starts
      const fromUserId = fromEmployee ? employeeId : managerId
      const toUserId = fromEmployee ? managerId : employeeId
      const senderName = fromEmployee ? employeeName : managerName

      const { error: msgErr } = await supabase.from('messages').insert({
        from_user_id: fromUserId,
        to_user_id: toUserId,
        company_id: company.id,
        content: MESSAGE_TEMPLATES[i],
        is_read: i < MESSAGE_TEMPLATES.length - 1, // last message left unread
        sender_name: senderName,
      })
      if (msgErr) console.warn(`  ⚠ 创建 message 失败: ${msgErr.message}`)
      else messageCount++
    }
  }
  console.log(`  ✓ 生成 ${messageCount} 条 messages（${deptByIndex.length} 组 Manager-Employee 对话）`)

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
  console.log(`\n业务数据（基于运行当天 ${dateKey(TODAY)} 动态生成）：`)
  console.log(`  Shifts:      ${assignmentInfo.length} 个（Internal Staff，过去 ${SHIFT_DAYS_PAST} 天 + 未来 ${SHIFT_DAYS_FUTURE} 天，跳过周末）`)
  console.log(`  Attendance:  ${attendanceCount} 条（Internal Staff，混合 approved/pending/rejected/late，~5% 缺勤）`)
  console.log(`  CW Shifts:   ${cwShiftCount} 个（Casual Worker，过去 ${SHIFT_DAYS_PAST} 天，跳过周末，含 Shift Job + One-Off）`)
  console.log(`  CW Attend.:  ${cwAttCount} 条（Casual Worker，混合 approved/pending/rejected/late，10% 缺勤）`)
  console.log(`  Tasks:       ${taskCount} 条（混合 Assigned/In Progress/Review/Complete）`)
  console.log(`  Announcements: ${announcementCount} 条`)
  console.log(`  Messages:    ${messageCount} 条`)

  // ── Step 15: Shift Swap Requests（大量数据填满 Action Needed + Processed Requests）──
  console.log('\nStep 15: 生成 Shift Swap Requests...')
  let swapCount = 0
  const futureAssignments = assignmentInfo.filter(a => !a.isPast)
  const futureAssignmentsByEmail = new Map()
  for (const assignment of futureAssignments) {
    if (!futureAssignmentsByEmail.has(assignment.email)) futureAssignmentsByEmail.set(assignment.email, [])
    futureAssignmentsByEmail.get(assignment.email).push(assignment)
  }
  for (const list of futureAssignmentsByEmail.values()) {
    list.sort((a, b) => a.shiftDate.localeCompare(b.shiftDate) || a.startTime.localeCompare(b.startTime))
  }
  const pickDifferentDateAndTimeSwap = (requesterEmail, counterpartEmail, seed = 0, excludedCounterpartAssignmentIds = new Set()) => {
    const requesterAssignments = futureAssignmentsByEmail.get(requesterEmail) ?? []
    const counterpartAssignments = futureAssignmentsByEmail.get(counterpartEmail) ?? []
    if (requesterAssignments.length === 0 || counterpartAssignments.length === 0) return null

    const reqAsgn = requesterAssignments[seed % requesterAssignments.length]
    const cpAsgn =
      counterpartAssignments.find((assignment, idx) =>
        idx >= seed &&
        !excludedCounterpartAssignmentIds.has(assignment.assignmentId) &&
        assignment.shiftDate !== reqAsgn.shiftDate &&
        (assignment.startTime !== reqAsgn.startTime || assignment.endTime !== reqAsgn.endTime)
      ) ??
      counterpartAssignments.find(assignment =>
        !excludedCounterpartAssignmentIds.has(assignment.assignmentId) &&
        assignment.shiftDate !== reqAsgn.shiftDate &&
        (assignment.startTime !== reqAsgn.startTime || assignment.endTime !== reqAsgn.endTime)
      ) ??
      counterpartAssignments.find(assignment =>
        !excludedCounterpartAssignmentIds.has(assignment.assignmentId) &&
        assignment.shiftDate !== reqAsgn.shiftDate
      )

    return cpAsgn ? { reqAsgn, cpAsgn } : null
  }

  const pendingReasons = [
    'I have a doctor appointment on that day, can we swap?',
    'Family event — would really appreciate if we could switch.',
    'Attending a training course, need to swap this shift.',
    'Personal commitment on that date, happy to take your slot.',
    'Need to pick up my kid from school, can we trade?',
    'Medical check-up scheduled, please consider swapping.',
    'Have a flight to catch early morning, can we swap shifts?',
    'Religious observance that day — would love to swap.',
    'Car in the workshop all day, prefer the later slot.',
    'Prior booking I forgot about — can we switch?',
    'Helping a friend move, swap would be much appreciated.',
    'Government appointment I cannot reschedule.',
  ]

  const processedReasons = [
    'Agreed to swap beforehand, just need official approval.',
    'Both parties confirmed, please approve.',
    'We already covered each other informally last month.',
    'Counterpart is fine with it, awaiting your sign-off.',
    'Mutually agreed swap — kindly approve.',
  ]

  // ── Action Needed: pending swaps — requester/counterpart use different dates and times ──
  let reasonIdx = 0
  const usedPendingCounterpartAssignmentIds = new Set()
  for (let deptIdx = 0; deptIdx < deptByIndex.length; deptIdx++) {
    const [mgrEmail1, mgrEmail2] = managersByDept[deptIdx]
    const mgrId1 = userIdMap[mgrEmail1].internalId
    const mgrId2 = userIdMap[mgrEmail2].internalId
    const [empEmail1, empEmail2] = employeesByDept[deptIdx]
    const empId1 = userIdMap[empEmail1].internalId
    const empId2 = userIdMap[empEmail2].internalId
    const pendingPairs = [
      [mgrEmail1, empEmail1, mgrId1, empId1],
      [mgrEmail2, empEmail2, mgrId2, empId2],
      [empEmail1, mgrEmail2, empId1, mgrId2],
      [empEmail2, mgrEmail1, empId2, mgrId1],
      [mgrEmail1, empEmail2, mgrId1, empId2],
    ]

    // 5 pending swaps per dept. Manager shifts are 09:00-17:00 and employee shifts
    // are 11:00-18:00, so every request highlights a different date and time.
    for (let k = 0; k < pendingPairs.length; k++) {
      const [reqEmail, cpEmail, reqId, cpId] = pendingPairs[k]
      const picked = pickDifferentDateAndTimeSwap(reqEmail, cpEmail, deptIdx * pendingPairs.length + k, usedPendingCounterpartAssignmentIds)
      if (!picked) continue
      const { reqAsgn, cpAsgn } = picked
      const { error } = await supabase.from('shift_swap_requests').insert({
        company_id: company.id,
        requester_id: reqId,
        requester_assignment_id: reqAsgn.assignmentId,
        counterpart_id: cpId,
        counterpart_assignment_id: cpAsgn.assignmentId,
        reason: pendingReasons[reasonIdx++ % pendingReasons.length],
        status: 'pending',
        counterpart_status: 'approved',
        counterpart_reviewed_at: new Date(Date.now() - (k + 1) * 3600000).toISOString(),
      })
      if (error) console.warn(`  ⚠ swap pending 失败 (dept${deptIdx} k${k}): ${error.message}`)
      else {
        usedPendingCounterpartAssignmentIds.add(cpAsgn.assignmentId)
        swapCount++
      }
    }
  }

  // ── Processed Requests: 20 approved/rejected swaps ──
  // Each processed request also pairs a manager with an employee so dates and times differ.
  const processedPairs = [
    [managerEmails[0], employeeEmails[0], 'approved',  4],
    [managerEmails[2], employeeEmails[2], 'rejected',  4],
    [managerEmails[4], employeeEmails[4], 'approved',  4],
    [managerEmails[6], employeeEmails[6], 'rejected',  3],
    [employeeEmails[0], managerEmails[1], 'approved',  2],
    [employeeEmails[2], managerEmails[3], 'rejected',  3],
    [employeeEmails[4], managerEmails[5], 'approved',  2],
    [employeeEmails[6], managerEmails[7], 'rejected',  3],
    [managerEmails[1], employeeEmails[1], 'approved',  5],
    [managerEmails[3], employeeEmails[3], 'rejected',  5],
    [managerEmails[5], employeeEmails[5], 'approved',  5],
    [managerEmails[7], employeeEmails[7], 'rejected',  5],
    [employeeEmails[1], managerEmails[0], 'approved',  3],
    [employeeEmails[3], managerEmails[2], 'rejected',  4],
    [employeeEmails[5], managerEmails[4], 'approved',  3],
    [employeeEmails[7], managerEmails[6], 'rejected',  4],
    [managerEmails[0], employeeEmails[1], 'approved',  6],
    [managerEmails[2], employeeEmails[3], 'rejected',  6],
    [employeeEmails[0], managerEmails[1], 'approved',  4],
    [employeeEmails[2], managerEmails[3], 'rejected',  4],
  ]
  let procReasonIdx = 0
  for (const [reqEmail, cpEmail, finalStatus, seed] of processedPairs) {
    const reqId = userIdMap[reqEmail].internalId
    const cpId = userIdMap[cpEmail].internalId
    const picked = pickDifferentDateAndTimeSwap(reqEmail, cpEmail, seed)
    if (!picked) continue
    const { reqAsgn, cpAsgn } = picked
    const { error } = await supabase.from('shift_swap_requests').insert({
      company_id: company.id,
      requester_id: reqId,
      requester_assignment_id: reqAsgn.assignmentId,
      counterpart_id: cpId,
      counterpart_assignment_id: cpAsgn.assignmentId,
      reason: processedReasons[procReasonIdx++ % processedReasons.length],
      status: finalStatus,
      counterpart_status: 'approved',
      counterpart_reviewed_at: new Date(Date.now() - 6 * 3600000).toISOString(),
      reviewed_by: ownerUser.id,
      reviewed_at: new Date(Date.now() - 3 * 3600000).toISOString(),
    })
    if (error) console.warn(`  ⚠ swap processed 失败 (${reqEmail}): ${error.message}`)
    else swapCount++
  }

  console.log(`  ✓ 生成 ${swapCount} 条 shift_swap_requests（~20 pending Action Needed + 20 processed）`)

  // ── Step 15b: 给 Owner 发未读消息（触发 Chat 红点）─────────────────────────
  // manager1 和 employee1 各给 Owner 发一条未读消息，让 Owner 的 Communication > Chat
  // tab 显示红点。
  console.log('\nStep 15b: 给 Owner 发未读消息...')
  const ownerMsgSenders = [
    { email: 'manager1@test.com', content: 'Hi Sarah, can you review the Operations shift schedule for next week?' },
    { email: 'employee1@test.com', content: 'Just a heads up — I may need to leave early on Friday.' },
  ]
  let ownerMsgCount = 0
  for (const sender of ownerMsgSenders) {
    const senderId = userIdMap[sender.email].internalId
    const senderName = accounts.find(a => a.email === sender.email)?.full_name ?? sender.email
    const { error: msgErr } = await supabase.from('messages').insert({
      from_user_id: senderId,
      to_user_id: ownerUser.id,
      company_id: company.id,
      content: sender.content,
      is_read: false,
      sender_name: senderName,
    })
    if (msgErr) console.warn(`  ⚠ 给 Owner 发消息失败 (${sender.email}): ${msgErr.message}`)
    else { ownerMsgCount++; console.log(`  ✓ ${senderName} → Owner (unread)`) }
  }
  console.log(`  ✓ 生成 ${ownerMsgCount} 条发给 Owner 的未读消息`)

  // ── Step 15c: Fixed Off Day Requests（触发 Fixed Day Off 红点）─────────────
  // employee1（Operations）和 employee3（Marketing）各提交 1 个 pending 的固定休息日申请
  console.log('\nStep 15c: 生成 Fixed Off Day Requests...')
  const fixedOffSeeders = [
    { email: 'employee1@test.com', weekday: 5 }, // Friday
    { email: 'employee3@test.com', weekday: 3 }, // Wednesday
  ]
  let fixedOffCount = 0
  for (const fo of fixedOffSeeders) {
    const userId = userIdMap[fo.email].internalId
    const { error: foErr } = await supabase.from('employee_fixed_off_days').insert({
      user_id: userId,
      company_id: company.id,
      weekday: fo.weekday,
      status: 'pending',
    })
    if (foErr) console.warn(`  ⚠ fixed_off_day 失败 (${fo.email}): ${foErr.message}`)
    else { fixedOffCount++; console.log(`  ✓ ${fo.email} → weekday ${fo.weekday} (pending)`) }
  }
  console.log(`  ✓ 生成 ${fixedOffCount} 条 employee_fixed_off_days（pending）`)
}

main().catch(err => {
  console.error('\n✗ 脚本异常:', err.message)
  process.exit(1)
})
