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
 *   8. 生成 Communication 数据（Announcements + Manager-Employee 对话）
 *
 * 测试账号结构：
 *   1 Owner, 2 Partner, 8 Manager, 8 Employee, 10 Casual Worker
 *   1 Company, 4 Department, 2 Manager/dept, 2 Employee/dept
 *
 * 日期全部基于脚本运行当天动态推算，没有任何写死的绝对日期 —— 每次运行都会以
 * "今天"为锚点重新生成过去/未来的 Shift、Attendance 数据。
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
function startOfWeekMonday(d) {
  const next = new Date(d)
  const offset = (next.getDay() + 6) % 7
  next.setDate(next.getDate() - offset)
  return next
}
function dateInWeek(weekStart, weekday) {
  return addDays(weekStart, (weekday + 6) % 7)
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

// Guest Users — public job-board applicants (role 'Guest User', not scoped to any company yet).
// These are who job_applicants.user_id points at before an applicant is ever hired.
const guestApplicants = [
  { email: 'guest1@test.com', full_name: 'Wei Jie Lim',   phone_number: '+65 8200 2001', date_of_birth: '2000-01-15' },
  { email: 'guest2@test.com', full_name: 'Priyanka Das',  phone_number: '+65 8200 2002', date_of_birth: '1999-05-22' },
  { email: 'guest3@test.com', full_name: 'Kai Xuan Ong',  phone_number: '+65 8200 2003', date_of_birth: '2001-09-10' },
  { email: 'guest4@test.com', full_name: 'Amirah Yusof',  phone_number: '+65 8200 2004', date_of_birth: '1998-12-03' },
  { email: 'guest5@test.com', full_name: 'Ryan Teo',      phone_number: '+65 8200 2005', date_of_birth: '2002-03-28' },
  { email: 'guest6@test.com', full_name: 'Sofia Chen',    phone_number: '+65 8200 2006', date_of_birth: '2000-07-19' },
]

// Platform-level admin accounts (Module 9/10) — NOT scoped to any company, separate from the
// company hierarchy above. Protected from deletion by the protect_admin_accounts DB trigger, so
// these are created idempotently (skipped if already present) rather than deleted-then-recreated
// like the rest of the seed data.
const platformAdmins = [
  { email: 'madmin@tasking.com', full_name: 'Marketing Admin', role: 'Marketing Admin' },
  { email: 'uadmin@tasking.com', full_name: 'User Admin',      role: 'User Admin' },
]

const legacyTestEmailsToDelete = [
  ...accounts.map(a => a.email),
  ...casualWorkers.map(cw => cw.email),
  ...guestApplicants.map(g => g.email),
]

// ─── 业务数据生成参数 ──────────────────────────────────────────────────────────

const SHIFT_DAYS_PAST = 7
const SHIFT_DAYS_FUTURE = 7

const ANNOUNCEMENT_TEMPLATES = [
  // authorRole 'owner' -> posted by the Owner (company-wide, shows under "My Announcements" for Owner login)
  // authorRole 'manager' -> posted by a rotating department manager (shows under "From Others")
  { title: 'Office closed for public holiday', content: 'Reminder that the office will be closed next week for the public holiday. Please plan your shifts accordingly.', authorRole: 'owner' },
  { title: 'New attendance policy rollout', content: 'Starting this month, clock-in is graced by 10 minutes past shift start. Please review the updated attendance guide.', authorRole: 'manager' },
  { title: 'Town hall this Friday', content: 'Join us this Friday at 3pm for the quarterly town hall. We will be covering company updates and Q&A.', authorRole: 'manager' },
  { title: 'Company all-hands next month', content: 'Mark your calendars — the company all-hands is scheduled for next month. Agenda and dial-in details to follow.', authorRole: 'owner' },
  { title: 'Updated expense reimbursement policy', content: 'The expense reimbursement policy has been updated effective this month. Please review the new claim limits before submitting.', authorRole: 'owner' },
  { title: 'Welcome our new hires this quarter', content: 'Please join us in welcoming the new hires who joined this quarter across every department.', authorRole: 'owner' },
  { title: 'Server maintenance this weekend', content: 'Scheduled server maintenance will occur this weekend. Some internal tools may be briefly unavailable.', authorRole: 'manager' },
  { title: 'Customer feedback survey results', content: 'The latest customer feedback survey results are in — overall satisfaction is up compared to last quarter.', authorRole: 'manager' },
  { title: 'New supply vendor onboarded', content: 'We have onboarded a new supply vendor to improve delivery times. Please direct any procurement requests accordingly.', authorRole: 'manager' },
  { title: 'Reminder: submit timesheets by Friday', content: 'Please make sure all timesheets for this period are submitted by end of day Friday.', authorRole: 'manager' },
  { title: 'Marketing campaign launch next week', content: 'The new marketing campaign launches next week. Please hold off on conflicting promotions until it wraps up.', authorRole: 'manager' },
]

const MESSAGE_TEMPLATES = [
  'Hey, can you cover my shift this Thursday?',
  'Sure, I can take it. Just let me know the time.',
  'Thanks! It is the 2pm to 6pm slot.',
  'Got it, I will clock in on time.',
  'Appreciate it — let me know if anything changes.',
]

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
    'time_off_requests',
    'shift_assignments',
    'shifts',
    'shift_templates',
    'task_templates',
    'tasks',
    'messages',
    'announcement_reads',
    'announcements',
    'inbox',
    'job_invitations',
    'job_applicants',
    'job_postings',
    'job_templates',
    'employee_off_day_requests',
    'off_day_quota_settings',
    'employee_fixed_off_days',
    'manager_departments',
    'employee_departments',
    'casualworker_departments',
    'company_activity_logs',
  ]
  for (const table of tablesToClear) {
    const { error } = await supabase.from(table).delete().neq('id', '00000000-0000-0000-0000-000000000000')
    if (error) console.warn(`  ⚠ 清空 ${table} 失败: ${error.message}`)
    else console.log(`  ✓ 清空 ${table}`)
  }
  const { error: icErr } = await supabase.from('invitation_code').delete().neq('code', '')
  if (icErr) console.warn(`  ⚠ 清空 invitation_code 失败: ${icErr.message}`)
  else console.log('  ✓ 清空 invitation_code')
  const { error: offDayDeadlineErr } = await supabase.from('off_day_submission_deadline').delete().neq('company_id', '00000000-0000-0000-0000-000000000000')
  if (offDayDeadlineErr) console.warn(`  ! clear off_day_submission_deadline failed: ${offDayDeadlineErr.message}`)
  else console.log('  ok clear off_day_submission_deadline')
  // shift_swap_settings has no `id` column (PK is company_id) and its updated_by FK blocks the
  // users cleanup below if left in place — must be cleared before users.
  const { error: swSettingsErr } = await supabase.from('shift_swap_settings').delete().neq('company_id', '00000000-0000-0000-0000-000000000000')
  if (swSettingsErr) console.warn(`  ⚠ 清空 shift_swap_settings 失败: ${swSettingsErr.message}`)
  else console.log('  ✓ 清空 shift_swap_settings')
  // Platform admin rows (User Admin / Marketing Admin) are excluded — the protect_admin_accounts
  // DB trigger rejects any attempt to delete them, which would otherwise fail this entire statement.
  const { error: uErr } = await supabase.from('users').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    .not('role', 'in', '("User Admin","Marketing Admin")')
  if (uErr) console.warn(`  ⚠ 清空 users 失败: ${uErr.message}`)
  else console.log('  ✓ 清空 users（保留 User Admin / Marketing Admin）')
  const { error: dErr } = await supabase.from('departments').delete().neq('id', '00000000-0000-0000-0000-000000000000')
  if (dErr) console.warn(`  ⚠ 清空 departments 失败: ${dErr.message}`)
  else console.log('  ✓ 清空 departments')
  const { error: cErr } = await supabase.from('companies').delete().neq('id', '00000000-0000-0000-0000-000000000000')
  if (cErr) console.warn(`  ⚠ 清空 companies 失败: ${cErr.message}`)
  else console.log('  ✓ 清空 companies')

  // ── Step 2: 删除旧 auth 账号 ──────────────────────────────────────────────
  // auth 用户可能远超 1000（Playwright 集成测试会不断创建一次性账号），listUsers 单页
  // 最多返回 1000 条 —— 必须翻页取全量，否则 Step 2b 会漏找 madmin/uadmin 而重复创建。
  console.log('\nStep 2: 删除旧 auth 账号...')
  const allAuthUsers = []
  for (let page = 1; ; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 })
    if (error) { console.warn(`  ⚠ listUsers 第 ${page} 页失败: ${error.message}`); break }
    allAuthUsers.push(...(data?.users ?? []))
    if (!data?.users?.length || data.users.length < 1000) break
  }
  console.log(`  · auth 用户总数: ${allAuthUsers.length}`)
  const testEmails = new Set(legacyTestEmailsToDelete)
  for (const u of allAuthUsers) {
    if (testEmails.has(u.email)) {
      await supabase.auth.admin.deleteUser(u.id)
      console.log(`  ✓ 删除 auth: ${u.email}`)
    }
  }

  // ── Step 2b: 确保平台级 Admin 账号存在（Marketing Admin / User Admin）──────
  // 这两个账号不在 legacyTestEmailsToDelete 里，也被 Step 1 的清空排除 —— 每次
  // 重跑都是"不存在才创建"，绝不删除重建，避免撞上 protect_admin_accounts 触发器。
  console.log('\nStep 2b: 确保平台级 Admin 账号存在...')
  for (const admin of platformAdmins) {
    let authId = allAuthUsers.find(u => u.email === admin.email)?.id

    if (!authId) {
      const { data, error } = await supabase.auth.admin.createUser({
        email: admin.email,
        password: PASSWORD,
        email_confirm: true,
      })
      if (error || !data.user) {
        console.error(`  ✗ auth 创建失败 ${admin.email}: ${error?.message}`)
        process.exit(1)
      }
      authId = data.user.id
      console.log(`  ✓ auth 创建: ${admin.email} → ${authId}`)
    } else {
      console.log(`  · auth 已存在: ${admin.email} → ${authId}`)
    }

    const { data: existingRow } = await supabase
      .from('users')
      .select('id')
      .eq('email_address', admin.email)
      .maybeSingle()

    if (!existingRow) {
      const { error: insErr } = await supabase.from('users').insert({
        supabase_auth_id: authId,
        full_name: admin.full_name,
        email_address: admin.email,
        phone_number: null,
        date_of_birth: null,
        profile_photo_url: DEMO_PHOTO_URL,
        role: admin.role,
        company_id: null,
      })
      if (insErr) { console.error(`  ✗ 插入 users 失败 ${admin.email}:`, insErr.message); process.exit(1) }
      console.log(`  ✓ users 创建: ${admin.full_name} (${admin.role})`)
    } else {
      console.log(`  · users 已存在: ${admin.full_name} (${admin.role})`)
    }
  }

  // ── Step 3: 创建 auth 账号（internal + CW + Guest）──────────────────────
  console.log('\nStep 3: 创建 auth 账号...')
  const userIdMap = {} // email → { authId, internalId }

  const allAuthAccounts = [...accounts, ...casualWorkers, ...guestApplicants]
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

  // ── Step 7b: 插入 Guest Users（求职申请人，尚未受雇，不属于任何 company）───
  console.log('\nStep 7b: 插入 public.users (Guest Users)...')
  for (const guest of guestApplicants) {
    const authId = userIdMap[guest.email].authId
    const { data: u, error: uErr } = await supabase
      .from('users')
      .insert({
        supabase_auth_id: authId,
        full_name: guest.full_name,
        email_address: guest.email,
        phone_number: guest.phone_number,
        date_of_birth: guest.date_of_birth,
        profile_photo_url: DEMO_PHOTO_URL,
        role: 'Guest User',
        company_id: null,
      })
      .select()
      .single()
    if (uErr) { console.error(`  ✗ 插入 Guest users 失败 ${guest.email}:`, uErr.message); process.exit(1) }
    userIdMap[guest.email].internalId = u.id
    console.log(`  ✓ Guest: ${guest.full_name} → ${u.id}`)
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
  // 混合比例：65% 准时打卡完成已审批，10% 迟到（未审批), 10% 已经 Manager Review
  // 等待 Owner 终审，10% 被驳回，5% 缺勤（不生成记录）。Manager Review 这一档此前
  // 完全没有种子数据 —— managerReviewAttendance 是真实存在的功能（Manager 点 Review
  // 后 status 会变成 manager_reviewed，owner_status 仍是 pending），不生成会导致
  // Owner/Manager 页面永远看不到"已经被 Manager 看过、等 Owner 终审"这个真实状态。
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

    if (bucket < 3) {
      status = 'submitted'; ownerStatus = 'pending' // late, nobody has looked at it yet
    } else if (bucket < 5) {
      status = 'manager_reviewed'; ownerStatus = 'pending' // manager already reviewed, awaiting Owner
    } else if (bucket < 7) {
      status = 'owner_rejected'; ownerStatus = 'rejected'
    } else {
      status = 'owner_approved'; ownerStatus = 'approved'
    }
    const managerNotes = status === 'manager_reviewed' ? 'Times match the schedule — looks good for final approval.' : null

    const { error: attErr } = await supabase.from('attendance_records').insert({
      shift_assignment_id: a.assignmentId,
      casual_worker_id: a.userId,
      confirmed_by_employee_id: a.userId,
      submitted_by_employee_id: a.userId,
      clock_in_time: clockInTime.toISOString(),
      clock_out_time: clockOutTime.toISOString(),
      status,
      manager_notes: managerNotes,
      owner_status: ownerStatus,
      owner_reviewed_by: ownerStatus === 'pending' ? null : ownerUser.id,
      owner_reviewed_at: ownerStatus === 'pending' ? null : new Date().toISOString(),
    })
    if (attErr) console.warn(`  ⚠ 创建 attendance_record 失败 (${a.email}, ${a.shiftDate}): ${attErr.message}`)
    else attendanceCount++
  }
  console.log(`  ✓ 生成 ${attendanceCount} 条 attendance_records（混合 approved/pending/manager_reviewed/rejected/late，~5% 缺勤无记录）`)

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

      // casualworker_departments mirrors employee_departments/manager_departments — gives this CW
      // a stable department_id so getTeamByCompany/getTeamByDepartment can resolve it (real usage:
      // this row is created the moment the CW accepts a job invitation into this department).
      const { error: cwdErr } = await supabase.from('casualworker_departments').insert({
        casual_worker_id: cwId,
        department_id: dept.id,
        company_id: company.id,
      })
      if (cwdErr) console.warn(`  ⚠ casualworker_departments 失败 (${cwEmail}): ${cwdErr.message}`)

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
          shiftId: cwShift.id,
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

    // status/ownerStatus buckets: 1=submitted(pending, untouched), 2=manager_reviewed(pending,
    // manager already looked at it), 3-4=owner_rejected, 5-9=owner_approved.
    let status, ownerStatus
    if (bucket < 2) { status = 'submitted'; ownerStatus = 'pending' }
    else if (bucket < 3) { status = 'manager_reviewed'; ownerStatus = 'pending' }
    else if (bucket < 5) { status = 'owner_rejected'; ownerStatus = 'rejected' }
    else { status = 'owner_approved'; ownerStatus = 'approved' }
    const managerNotes = status === 'manager_reviewed' ? 'Checked with the shift supervisor — hours look correct.' : null

    // confirmed_by/submitted_by are always the Casual Worker's own id — casualAttendanceService's
    // clockIn/clockOut both self-attest (there is no separate "supervising Employee confirms"
    // action in the app today); supervisor_employee_id on the shift_assignment above already
    // captures the real "Employee supervises this CW" relationship for display purposes.
    const { error: cwAttErr } = await supabase.from('attendance_records').insert({
      shift_assignment_id: a.assignmentId,
      casual_worker_id: a.userId,
      confirmed_by_employee_id: a.userId,
      submitted_by_employee_id: a.userId,
      clock_in_time: clockInTime.toISOString(),
      clock_out_time: clockOutTime.toISOString(),
      status,
      manager_notes: managerNotes,
      owner_status: ownerStatus,
      owner_reviewed_by: ownerStatus === 'pending' ? null : ownerUser.id,
      owner_reviewed_at: ownerStatus === 'pending' ? null : new Date().toISOString(),
    })
    if (cwAttErr) console.warn(`  ⚠ CW attendance 失败 (${a.email}, ${a.shiftDate}): ${cwAttErr.message}`)
    else cwAttCount++
  }
  console.log(`  ✓ 生成 ${cwAttCount} 条 CW attendance_records（混合 approved/pending/manager_reviewed/rejected/late，10% 缺勤）`)

  // ── Step 12: Communication — Announcements ──────────────────────────────
  console.log('\nStep 12: 生成 Announcements...')
  let announcementCount = 0
  const announcementIds = []
  let managerAnnCursor = 0
  for (let i = 0; i < ANNOUNCEMENT_TEMPLATES.length; i++) {
    const tpl = ANNOUNCEMENT_TEMPLATES[i]
    const isOwner = tpl.authorRole === 'owner'
    let fromUserId, departmentId
    if (isOwner) {
      fromUserId = ownerUser.id
      departmentId = null
    } else {
      const deptIdx = managerAnnCursor % deptByIndex.length
      const mgrIdx = Math.floor(managerAnnCursor / deptByIndex.length) % managersByDept[deptIdx].length
      fromUserId = userIdMap[managersByDept[deptIdx][mgrIdx]].internalId
      departmentId = deptByIndex[deptIdx].id
      managerAnnCursor++
    }

    const { data: ann, error: annErr } = await supabase.from('announcements').insert({
      from_user_id: fromUserId,
      company_id: company.id,
      department_id: departmentId,
      title: tpl.title,
      content: tpl.content,
    }).select('id').single()
    if (annErr) console.warn(`  ⚠ 创建 announcement 失败 (${tpl.title}): ${annErr.message}`)
    else { announcementCount++; announcementIds.push(ann.id) }
  }
  console.log(`  ✓ 生成 ${announcementCount} 条 announcements`)

  // ── Step 13: Communication — Messages（每个部门一组 Manager-Employee 对话）──
  console.log('\nStep 13: 生成 Messages...')
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

  // ── Step 13b: Tasks + Sub-tasks + Task Templates + Archive ──────────────
  // 专门覆盖 Task 页面的测试点：
  //   · Workload Suggestion — Operations 里 manager1 重度超载（4 个活跃任务，Urgent/High
  //     + 临近死线），manager2 零活跃任务 → 触发 rebalance 建议（其余部门保持均衡不触发）
  //   · Task Delay Alert — 若干 status='Assigned' 的任务把 created_at 回写到过去，使
  //     elapsed% 超过默认阈值 50（含一条已过期 >100% 的），delay_alert_read_at 全部留空
  //   · Search Bar — 每条任务标题/描述都是可区分的关键词（inventory / roster / campaign…）
  //   · Priority 排序 — Urgent / High / Medium / Low 四档全覆盖
  //   · 三个排序条件 — priority（四档混排）/ deadline（due_at 各不相同，含已过期与
  //     即将到期）/ newest（created_at 各不相同，从 -3 天到 -1 小时都有）
  //   · Template — task_templates 3 条（含 sub_task_titles）
  //   · Archive — 2 条 is_archived=true 的已完成顶层任务
  //   · Edit / 删除 — Owner 页面的任务全部 assigned_by=Owner（只有 assigner 能编辑/删除）
  //   · 附带 Manager→Employee、Employee→CW 各一小组任务，让下级角色页面也有数据
  console.log('\nStep 13b: 生成 Tasks + Task Templates...')

  const hoursFromNow = h => new Date(Date.now() + h * 3600000).toISOString()
  // Workload rebalance 要求候选人在 task_date 当天有已发布 shift（hasShiftOnDate），
  // 内部员工的 shift 只种在工作日，所以 task_date 必须避开周末。
  function weekdayKey(offset) {
    let d = addDays(TODAY, offset)
    while (isWeekend(d)) d = addDays(d, 1)
    return dateKey(d)
  }
  const todayKey = weekdayKey(0)

  async function insertTask(row) {
    const { data, error } = await supabase.from('tasks').insert({
      shift_id: null,
      percentage_complete: 0,
      is_archived: false,
      is_completed: false,
      ...row,
    }).select('id').single()
    if (error) { console.warn(`  ⚠ 创建 task 失败 (${row.title}): ${error.message}`); return null }
    return data.id
  }

  const mgrId = email => userIdMap[email].internalId
  let taskCount = 0

  // ── Owner → Manager 任务（Owner Task 页面的主数据）──
  const ownerTaskDefs = [
    // Operations：manager1 超载（4 个活跃）→ Workload Suggestion
    { dept: 0, assignee: 'manager1@test.com', title: 'Prepare monthly inventory report', description: 'Compile stock counts across all storage rooms into the July inventory report.', priority: 'Urgent', status: 'Assigned', createdH: -30, dueH: 6, taskDate: todayKey }, // Delay Alert ~83%
    { dept: 0, assignee: 'manager1@test.com', title: 'Renew supplier contracts', description: 'Renegotiate and renew the three expiring beverage supplier contracts.', priority: 'High', status: 'Assigned', createdH: -72, dueH: -5, taskDate: todayKey }, // Delay Alert 已过期 >100%
    { dept: 0, assignee: 'manager1@test.com', title: 'Plan Q3 roster coverage', description: 'Draft the Q3 roster and confirm coverage for peak weekends.', priority: 'High', status: 'In Progress', pct: 40, createdH: -20, dueH: 48, taskDate: todayKey, subTasks: ['Collect leave requests', 'Draft coverage matrix', 'Confirm with department leads'] },
    { dept: 0, assignee: 'manager1@test.com', title: 'Audit storeroom safety compliance', description: 'Walk through both storerooms against the fire-safety checklist.', priority: 'Medium', status: 'Assigned', createdH: -2, dueH: 120, taskDate: weekdayKey(2) }, // 刚分配，不触发 Delay Alert
    { dept: 0, assignee: 'manager1@test.com', title: 'Update vendor price list', description: 'Refresh the shared vendor price list with the latest quotations.', priority: 'Low', status: 'Review', pct: 100, createdH: -50, dueH: 24, taskDate: todayKey },
    // manager2 只有一条 Complete（不计入 workload）→ 成为 rebalance 推荐对象
    { dept: 0, assignee: 'manager2@test.com', title: 'Submit weekly ops summary', description: 'Summarize last week\'s operations KPIs for the leadership sync.', priority: 'Medium', status: 'Complete', pct: 100, completed: true, createdH: -80, dueH: -48, taskDate: todayKey },
    // Marketing：manager3 / manager4 均衡，不触发建议
    { dept: 1, assignee: 'manager3@test.com', title: 'Draft July newsletter', description: 'Write and schedule the July customer newsletter.', priority: 'High', status: 'In Progress', pct: 60, createdH: -10, dueH: 30, taskDate: todayKey },
    { dept: 1, assignee: 'manager3@test.com', title: 'Launch summer campaign brief', description: 'Finalize the summer campaign brief and share it with the agency.', priority: 'Urgent', status: 'Assigned', createdH: -1, dueH: 96, taskDate: weekdayKey(1) },
    { dept: 1, assignee: 'manager4@test.com', title: 'Refresh homepage banners', description: 'Swap the homepage hero banners to the summer visuals.', priority: 'Medium', status: 'Assigned', createdH: -3, dueH: 72, taskDate: weekdayKey(1) },
    { dept: 1, assignee: 'manager4@test.com', title: 'Compile competitor pricing scan', description: 'Collect current pricing from the top five competitors.', priority: 'Low', status: 'In Progress', pct: 25, createdH: -36, dueH: 120, taskDate: todayKey },
    // Engineering：一条带 rejection_reason 的返工任务
    { dept: 2, assignee: 'manager5@test.com', title: 'Fix clock-in kiosk firmware', description: 'Patch the kiosk firmware so clock-in works after the OS update.', priority: 'Urgent', status: 'In Progress', pct: 70, createdH: -14, dueH: 10, taskDate: todayKey, rejection: 'Kiosk 3 still fails after the patch — please re-test on all devices.' },
    { dept: 2, assignee: 'manager6@test.com', title: 'Evaluate new POS hardware', description: 'Assess the two shortlisted POS terminals and recommend one.', priority: 'Medium', status: 'Assigned', createdH: -4, dueH: 144, taskDate: weekdayKey(3) },
    // Customer Support
    { dept: 3, assignee: 'manager7@test.com', title: 'Resolve escalated refund cases', description: 'Close out the five escalated refund tickets from last week.', priority: 'High', status: 'Review', pct: 100, createdH: -40, dueH: 20, taskDate: todayKey },
    { dept: 3, assignee: 'manager8@test.com', title: 'Update support macros', description: 'Rewrite the canned replies to match the new tone guide.', priority: 'Low', status: 'Assigned', createdH: -6, dueH: 96, taskDate: weekdayKey(2) },
  ]

  for (const def of ownerTaskDefs) {
    const taskId = await insertTask({
      company_id: company.id,
      department_id: deptByIndex[def.dept].id,
      title: def.title,
      description: def.description,
      assigned_user_id: mgrId(def.assignee),
      assigned_by: ownerUser.id,
      status: def.status,
      percentage_complete: def.pct ?? 0,
      is_completed: def.completed ?? false,
      priority: def.priority,
      due_at: hoursFromNow(def.dueH),
      task_date: def.taskDate,
      created_at: hoursFromNow(def.createdH),
      rejection_reason: def.rejection ?? null,
      rejected_at: def.rejection ? hoursFromNow(-5) : null,
    })
    if (!taskId) continue
    taskCount++

    if (def.subTasks) {
      for (let s = 0; s < def.subTasks.length; s++) {
        const subId = await insertTask({
          company_id: company.id,
          department_id: deptByIndex[def.dept].id,
          parent_task_id: taskId,
          sequence_order: s + 1,
          title: def.subTasks[s],
          description: null,
          assigned_user_id: mgrId(def.assignee),
          assigned_by: ownerUser.id,
          status: s === 0 ? 'Complete' : 'Assigned',
          percentage_complete: s === 0 ? 100 : 0,
          is_completed: s === 0,
          priority: def.priority,
          task_date: def.taskDate,
          created_at: hoursFromNow(def.createdH),
        })
        if (subId) taskCount++
      }
    }
  }

  // ── Archived：顶层已完成任务，验证 Archive 视图 ──
  const archivedTaskDefs = [
    { dept: 0, assignee: 'manager1@test.com', title: 'Organize June team offsite', description: 'Book the venue and run the June team offsite.', priority: 'Medium', createdH: -240, dueH: -168 },
    { dept: 0, assignee: 'manager2@test.com', title: 'Migrate legacy attendance sheets', description: 'Move the old Excel attendance sheets into the system.', priority: 'Low', createdH: -320, dueH: -240 },
  ]
  let archivedCount = 0
  for (const def of archivedTaskDefs) {
    const id = await insertTask({
      company_id: company.id,
      department_id: deptByIndex[def.dept].id,
      title: def.title,
      description: def.description,
      assigned_user_id: mgrId(def.assignee),
      assigned_by: ownerUser.id,
      status: 'Complete',
      percentage_complete: 100,
      is_completed: true,
      is_archived: true,
      priority: def.priority,
      due_at: hoursFromNow(def.dueH),
      task_date: dateKey(addDays(TODAY, Math.round(def.dueH / 24))),
      created_at: hoursFromNow(def.createdH),
    })
    if (id) { taskCount++; archivedCount++ }
  }

  // ── Manager → Employee 任务（manager1 的 Task 页面数据，含一条 Delay Alert）──
  const managerTaskDefs = [
    { assignee: 'employee1@test.com', title: 'Restock front shelves', description: 'Restock and face all front-of-house shelves before opening.', priority: 'High', status: 'Assigned', createdH: -26, dueH: 4, taskDate: todayKey }, // manager1 视角的 Delay Alert
    { assignee: 'employee2@test.com', title: 'Deep clean espresso machines', description: 'Full descale and deep clean of both espresso machines.', priority: 'Medium', status: 'In Progress', pct: 50, createdH: -8, dueH: 30, taskDate: todayKey },
    { assignee: 'employee1@test.com', title: 'Verify delivery invoices', description: 'Cross-check this week\'s delivery invoices against goods received.', priority: 'Low', status: 'Complete', pct: 100, completed: true, createdH: -60, dueH: -30, taskDate: todayKey },
  ]
  for (const def of managerTaskDefs) {
    const id = await insertTask({
      company_id: company.id,
      department_id: deptByIndex[0].id,
      title: def.title,
      description: def.description,
      assigned_user_id: mgrId(def.assignee),
      assigned_by: mgrId('manager1@test.com'),
      status: def.status,
      percentage_complete: def.pct ?? 0,
      is_completed: def.completed ?? false,
      priority: def.priority,
      due_at: hoursFromNow(def.dueH),
      task_date: def.taskDate,
      created_at: hoursFromNow(def.createdH),
    })
    if (id) taskCount++
  }

  // ── Employee → Casual Worker 任务（employee1 的 Task 页面数据）──
  const employeeTaskDefs = [
    { assignee: 'cw1@test.com', title: 'Sort recycling bins', description: 'Separate and tag the recycling bins behind the loading bay.', priority: 'Medium', status: 'Assigned', createdH: -20, dueH: 5, taskDate: todayKey }, // employee1 视角的 Delay Alert
    { assignee: 'cw2@test.com', title: 'Wipe down display counters', description: 'Clean and polish all glass display counters.', priority: 'Low', status: 'In Progress', pct: 30, createdH: -5, dueH: 20, taskDate: todayKey },
  ]
  for (const def of employeeTaskDefs) {
    const id = await insertTask({
      company_id: company.id,
      department_id: deptByIndex[0].id,
      title: def.title,
      description: def.description,
      assigned_user_id: mgrId(def.assignee),
      assigned_by: mgrId('employee1@test.com'),
      status: def.status,
      percentage_complete: def.pct ?? 0,
      priority: def.priority,
      due_at: hoursFromNow(def.dueH),
      task_date: def.taskDate,
      created_at: hoursFromNow(def.createdH),
    })
    if (id) taskCount++
  }

  // ── Task Templates ──
  const taskTemplateDefs = [
    { name: 'Daily Opening Checklist', title: 'Complete daily opening checklist', description: 'Run through the standard opening procedure before doors open.', priority: 'High', sub_task_titles: ['Unlock storefront and disarm alarm', 'Count and verify POS float', 'Brief the morning team'] },
    { name: 'Weekly Stock Audit', title: 'Run weekly stock audit', description: 'Count high-turnover SKUs and flag discrepancies above 2%.', priority: 'Medium', sub_task_titles: ['Print current stock list', 'Count storeroom shelves', 'Log discrepancies'] },
    { name: 'New Hire Onboarding', title: 'Onboard new team member', description: 'Standard first-week onboarding for a new hire.', priority: 'Low', sub_task_titles: [] },
  ]
  let taskTemplateCount = 0
  for (const def of taskTemplateDefs) {
    const { error } = await supabase.from('task_templates').insert({
      company_id: company.id,
      name: def.name,
      title: def.title,
      description: def.description,
      priority: def.priority,
      sub_task_titles: def.sub_task_titles,
      created_by: ownerUser.id,
    })
    if (error) console.warn(`  ⚠ 创建 task_template 失败 (${def.name}): ${error.message}`)
    else taskTemplateCount++
  }

  console.log(`  ✓ 生成 ${taskCount} 条 tasks（含 sub-tasks、${archivedCount} 条 archived、多 assignee、rejection 返工、3 条 Delay Alert 触发项、Operations 超载触发 Workload Suggestion）`)
  console.log(`  ✓ 生成 ${taskTemplateCount} 条 task_templates`)

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
  console.log('  Guest:    guest1~6@test.com（求职申请人，尚未受雇）')
  console.log('\n平台级 Admin 账号（不属于任何 company，密码同为 111111）')
  console.log('  Marketing Admin: madmin@tasking.com')
  console.log('  User Admin:      uadmin@tasking.com')
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
  console.log(`  Attendance:  ${attendanceCount} 条（Internal Staff，混合 approved/pending/manager_reviewed/rejected/late，~5% 缺勤）`)
  console.log(`  CW Shifts:   ${cwShiftCount} 个（Casual Worker，过去 ${SHIFT_DAYS_PAST} 天，跳过周末，含 Shift Job + One-Off）`)
  console.log(`  CW Attend.:  ${cwAttCount} 条（Casual Worker，混合 approved/pending/manager_reviewed/rejected/late，10% 缺勤）`)
  console.log(`  Announcements: ${announcementCount} 条`)
  console.log(`  Messages:    ${messageCount} 条`)
  console.log(`  Tasks:       ${taskCount} 条（Owner→Manager 14 + 子任务 + archived 2 + Manager→Employee 3 + Employee→CW 2）`)
  console.log(`  TaskTmpl:    ${taskTemplateCount} 条 task_templates`)

  // ── Step 14: Shift Swap Requests（大量数据填满 Action Needed + Processed Requests）──
  // 严格贴合 attendanceService 的真实规则：
  //   · assertShiftIsSwappable — 可换的班最早是"明天"，今天的班一进列表就会被
  //     autoExpireSwapRequestIfNeeded 自动 reject，所以候选池只取明天及以后的班。
  //   · 同一个 shift_assignment 同时只能挂一个 pending 请求（requester 和 counterpart
  //     两侧都算），用 lockedPendingAssignmentIds 统一去重。
  //   · 同部门 + 同角色才能互换（submitShiftSwapRequest 校验）。
  //   · Owner 页有两种 pending：counterpart 已同意的 Action Needed + 还在等
  //     counterpart 回复的 Awaiting Counterpart，两种都要有数据。
  console.log('\nStep 14: 生成 Shift Swap Requests...')

  // Owner-configured swap rules（对应 Shift Swap Settings 弹窗）：人工审批、每人每月最多
  // 3 次成功换班、最早班次开始前 48 小时截止，两条规则违规都升级 Owner 而不是自动拒绝。
  // 48h 是刻意选的：让"明天开始的班"无论脚本几点跑都必然踩线（距现在 <33h），而
  // "TODAY+3 之后开始的班"必然合规（距现在 >57h）—— 下面的 Rule Check 场景才能确定复现。
  const { error: swapSettingsErr } = await supabase.from('shift_swap_settings').insert({
    company_id: company.id,
    auto_approval_enabled: false,
    monthly_swap_limit: 3,
    deadline_hours_before_shift: 48,
    require_review_on_limit_exceeded: true,
    require_review_on_deadline_exceeded: true,
    updated_by: ownerUser.id,
  })
  if (swapSettingsErr) console.warn(`  ⚠ 生成 shift_swap_settings 失败: ${swapSettingsErr.message}`)
  else console.log('  ✓ 生成 shift_swap_settings（人工审批，limit 3/月，deadline 48h，违规升级 Owner）')

  let swapCount = 0
  const tomorrowKey = dateKey(addDays(TODAY, 1))
  const futureAssignments = assignmentInfo.filter(a => !a.isPast && a.shiftDate >= tomorrowKey)
  const futureAssignmentsByEmail = new Map()
  for (const assignment of futureAssignments) {
    if (!futureAssignmentsByEmail.has(assignment.email)) futureAssignmentsByEmail.set(assignment.email, [])
    futureAssignmentsByEmail.get(assignment.email).push(assignment)
  }
  for (const list of futureAssignmentsByEmail.values()) {
    list.sort((a, b) => a.shiftDate.localeCompare(b.shiftDate) || a.startTime.localeCompare(b.startTime))
  }
  const pickDifferentDateAndTimeSwap = (requesterEmail, counterpartEmail, seed = 0, lockedAssignmentIds = new Set(), poolByEmail = futureAssignmentsByEmail) => {
    const requesterAssignments = poolByEmail.get(requesterEmail) ?? []
    const counterpartAssignments = poolByEmail.get(counterpartEmail) ?? []
    if (requesterAssignments.length === 0 || counterpartAssignments.length === 0) return null

    // Requester side also honours the pending lock — start from `seed` for variety, then walk
    // forward until an unlocked assignment is found.
    let reqAsgn = null
    for (let i = 0; i < requesterAssignments.length; i++) {
      const candidate = requesterAssignments[(seed + i) % requesterAssignments.length]
      if (!lockedAssignmentIds.has(candidate.assignmentId)) { reqAsgn = candidate; break }
    }
    if (!reqAsgn) return null

    const cpAsgn =
      counterpartAssignments.find((assignment, idx) =>
        idx >= seed &&
        !lockedAssignmentIds.has(assignment.assignmentId) &&
        assignment.shiftDate !== reqAsgn.shiftDate &&
        (assignment.startTime !== reqAsgn.startTime || assignment.endTime !== reqAsgn.endTime)
      ) ??
      counterpartAssignments.find(assignment =>
        !lockedAssignmentIds.has(assignment.assignmentId) &&
        assignment.shiftDate !== reqAsgn.shiftDate &&
        (assignment.startTime !== reqAsgn.startTime || assignment.endTime !== reqAsgn.endTime)
      ) ??
      counterpartAssignments.find(assignment =>
        !lockedAssignmentIds.has(assignment.assignmentId) &&
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

  // ── Action Needed: 每对同事最多 1 条 pending —— 每部门 2 条（1 条 Manager 对 +
  // 1 条 Employee 对），共 8 条。Manager 对的 4 条进 Owner 队列，按部门各覆盖一种
  // Rule Check 场景（对照 attendanceService.evaluateShiftSwapRules 的实时计算）：
  //   · dept0 Operations       — 完全合规（Within monthly limit + Before deadline）
  //   · dept1 Marketing        — 超月度限额（该对本月已各有 3 次 approved，见下方补种）
  //   · dept2 Engineering      — 过截止线（双方班次都在 48h 截止窗内 → 专门造明天/后天的班）
  //   · dept3 Customer Support — 两条同时违规（3 次 approved + 明天/后天的班）
  // Employee 对的 4 条进各部门 Manager 的队列，保持干净合规。
  // 合规判定的确定性：deadline 48h + 干净池只取 TODAY+3 之后的班（>57h），违规池只用
  // 明天开始的班（<33h），与脚本运行时刻无关。
  let reasonIdx = 0
  let pendingSwapCount = 0
  const lockedPendingAssignmentIds = new Set()
  const cleanCutoffKey = dateKey(addDays(TODAY, 3))
  const cleanAssignmentsByEmail = new Map()
  for (const [email, list] of futureAssignmentsByEmail) {
    cleanAssignmentsByEmail.set(email, list.filter(a => a.shiftDate >= cleanCutoffKey))
  }

  // deadline 违规场景专用：直接造一个明天/后天的班 + assignment（不与常规池冲突，
  // 明天可能是周末也没关系 —— 只是演示数据）。
  async function createDedicatedSwapShift(deptIdx, email, dayOffset, startTime, endTime) {
    const dept = deptByIndex[deptIdx]
    const shiftDateStr = dateKey(addDays(TODAY, dayOffset))
    const userId = userIdMap[email].internalId
    const { data: shift, error: shiftErr } = await supabase.from('shifts').insert({
      company_id: company.id,
      department_id: dept.id,
      title: `${dept.name} Shift`,
      shift_date: shiftDateStr,
      start_time: startTime,
      end_time: endTime,
      status: 'active',
      publication_status: 'published',
      created_by: ownerUser.id,
    }).select('id').single()
    if (shiftErr) { console.warn(`  ⚠ dedicated swap shift 失败 (${email}): ${shiftErr.message}`); return null }
    const { data: assignment, error: assignErr } = await supabase.from('shift_assignments').insert({
      shift_id: shift.id,
      user_id: userId,
      assigned_by: ownerUser.id,
    }).select('id').single()
    if (assignErr) { console.warn(`  ⚠ dedicated swap assignment 失败 (${email}): ${assignErr.message}`); return null }
    return { assignmentId: assignment.id, shiftId: shift.id, shiftDate: shiftDateStr, startTime, endTime, email, userId }
  }

  // 给换班双方在"被换的那个班"上种任务 —— movable task 的判定是
  // tasks.shift_id = 该班 + assigned_user_id = 该人 + status in (Assigned, In Progress)，
  // 这样 Owner 审批页的 Current Task Assignment / Task Assignment After Swap 才有内容。
  const SWAP_TASK_TITLES = [
    'Run the opening checklist',
    'Reconcile till float',
    'Check incoming delivery manifest',
    'Brief the afternoon crew',
    'Restock service counter supplies',
    'Update the shift handover notes',
    'Clear the escalated ticket queue',
    'Test the clock-in kiosk',
    'Audit display pricing labels',
    'Prepare weekly stock summary',
    'Review chat transcripts for QA',
    'Pack outgoing courier orders',
  ]
  let swapTaskSeq = 0
  let swapTaskCount = 0
  async function seedSwapShiftTasks(asgn, deptIdx, count, subTaskCount, assignedById) {
    for (let t = 0; t < count; t++) {
      const title = SWAP_TASK_TITLES[swapTaskSeq % SWAP_TASK_TITLES.length]
      swapTaskSeq++
      const status = t % 2 === 0 ? 'Assigned' : 'In Progress'
      const taskId = await insertTask({
        company_id: company.id,
        department_id: deptByIndex[deptIdx].id,
        shift_id: asgn.shiftId,
        title,
        description: `${title} during the ${asgn.shiftDate} shift.`,
        assigned_user_id: asgn.userId,
        assigned_by: assignedById,
        status,
        percentage_complete: status === 'In Progress' ? 40 : 0,
        priority: ['High', 'Medium', 'Low'][swapTaskSeq % 3],
        due_at: new Date(`${asgn.shiftDate}T${asgn.endTime}:00Z`).toISOString(),
        task_date: asgn.shiftDate,
      })
      if (!taskId) continue
      swapTaskCount++
      // 第一条任务可以带 sub-tasks（同班同人，同样会出现在 movable 列表里）
      if (t === 0 && subTaskCount > 0) {
        for (let s = 0; s < subTaskCount; s++) {
          const subId = await insertTask({
            company_id: company.id,
            department_id: deptByIndex[deptIdx].id,
            shift_id: asgn.shiftId,
            parent_task_id: taskId,
            sequence_order: s + 1,
            title: `${title} — step ${s + 1}`,
            assigned_user_id: asgn.userId,
            assigned_by: assignedById,
            status: 'Assigned',
            priority: 'Medium',
            task_date: asgn.shiftDate,
          })
          if (subId) swapTaskCount++
        }
      }
    }
  }

  const managerScenarioByDept = ['clean', 'limit', 'deadline', 'both']
  for (let deptIdx = 0; deptIdx < deptByIndex.length; deptIdx++) {
    const [mgrEmail1, mgrEmail2] = managersByDept[deptIdx]
    const [empEmail1, empEmail2] = employeesByDept[deptIdx]
    const actionNeededPairs = [
      { reqEmail: mgrEmail1, cpEmail: mgrEmail2, scenario: managerScenarioByDept[deptIdx] },
      { reqEmail: empEmail1, cpEmail: empEmail2, scenario: 'clean' },
    ]
    for (let k = 0; k < actionNeededPairs.length; k++) {
      const { reqEmail, cpEmail, scenario } = actionNeededPairs[k]
      const reqId = userIdMap[reqEmail].internalId
      const cpId = userIdMap[cpEmail].internalId

      let reqAsgn = null
      let cpAsgn = null
      if (scenario === 'deadline' || scenario === 'both') {
        reqAsgn = await createDedicatedSwapShift(deptIdx, reqEmail, 1, '09:00', '17:00')
        cpAsgn = await createDedicatedSwapShift(deptIdx, cpEmail, 2, '11:00', '18:00')
      } else {
        const picked = pickDifferentDateAndTimeSwap(reqEmail, cpEmail, deptIdx + k, lockedPendingAssignmentIds, cleanAssignmentsByEmail)
        if (picked) ({ reqAsgn, cpAsgn } = picked)
      }
      if (!reqAsgn || !cpAsgn) { console.warn(`  ⚠ swap pending 无可用班次 (dept${deptIdx} k${k})`); continue }

      // 与真实流程一致：counterpart 接受时 evaluateShiftSwapRules 判 escalate 会把原因
      // 记进 owner_review_reason（limit 优先于 deadline，见服务层的判定顺序）。
      const ownerReviewReason = scenario === 'limit' || scenario === 'both'
        ? 'Monthly swap limit exceeded'
        : scenario === 'deadline' ? 'Submitted after deadline' : null

      const { error } = await supabase.from('shift_swap_requests').insert({
        company_id: company.id,
        requester_id: reqId,
        requester_assignment_id: reqAsgn.assignmentId,
        counterpart_id: cpId,
        counterpart_assignment_id: cpAsgn.assignmentId,
        reason: pendingReasons[reasonIdx++ % pendingReasons.length],
        status: 'pending',
        counterpart_status: 'approved',
        counterpart_reviewed_at: new Date(Date.now() - (deptIdx * 2 + k + 1) * 1800000).toISOString(),
        owner_review_reason: ownerReviewReason,
      })
      if (error) { console.warn(`  ⚠ swap pending 失败 (dept${deptIdx} k${k}): ${error.message}`); continue }
      lockedPendingAssignmentIds.add(reqAsgn.assignmentId)
      lockedPendingAssignmentIds.add(cpAsgn.assignmentId)
      swapCount++
      pendingSwapCount++

      // 双方都要有任务：requester 2 条（部分带 sub-tasks），counterpart 1-2 条
      const assignerId = managerEmails.includes(reqEmail) ? ownerUser.id : userIdMap[managersByDept[deptIdx][0]].internalId
      const requesterSubTasks = (k === 0 && deptIdx === 0) || (k === 1 && deptIdx === 1) ? 2 : 0
      await seedSwapShiftTasks(reqAsgn, deptIdx, 2, requesterSubTasks, assignerId)
      await seedSwapShiftTasks(cpAsgn, deptIdx, (deptIdx + k) % 2 === 0 ? 1 : 2, 0, assignerId)
    }
  }

  // ── 限额违规的前置数据：dept1 / dept3 的 Manager 对本月再补 2 条 approved ──
  // （下面的 processed cycle 已各给 1 条 approved → 共 3 条 = monthly_swap_limit，
  // 让上面两条 pending 的 Rule Check 显示 Monthly limit exceeded、swaps left 0/3。）
  const limitExceededPairs = [managersByDept[1], managersByDept[3]]
  let limitTopUpCount = 0
  for (const [e1, e2] of limitExceededPairs) {
    for (let n = 0; n < 2; n++) {
      const picked = pickDifferentDateAndTimeSwap(e1, e2, 40 + n * 2)
      if (!picked) continue
      const { reqAsgn, cpAsgn } = picked
      const { error } = await supabase.from('shift_swap_requests').insert({
        company_id: company.id,
        requester_id: userIdMap[e1].internalId,
        requester_assignment_id: reqAsgn.assignmentId,
        counterpart_id: userIdMap[e2].internalId,
        counterpart_assignment_id: cpAsgn.assignmentId,
        reason: processedReasons[n % processedReasons.length],
        status: 'approved',
        counterpart_status: 'approved',
        counterpart_reviewed_at: new Date(Date.now() - (26 + n * 20) * 3600000).toISOString(),
        reviewed_by: ownerUser.id,
        reviewed_at: new Date(Date.now() - (24 + n * 20) * 3600000).toISOString(),
      })
      if (error) console.warn(`  ⚠ limit top-up swap 失败 (${e1}): ${error.message}`)
      else { swapCount++; limitTopUpCount++ }
    }
  }

  // ── Auto-Approved：每部门 Manager 对 1 条系统自动批准的换班 ──
  // 走 respondShiftSwapRequest 的 auto-approval 分支时 reviewed_by 为 null（没有人工
  // 审批人可归属），Completed Requests 卡片会据此显示 Auto-Approved 徽标。
  // 必须用 Manager 对：Owner 的列表只含 Manager 发起的换班（Employee 的进各部门
  // Manager 队列），种在 Employee 对上 Owner 端永远看不到。
  // 注意这也会计入当月 used 数：dept0/dept2 的 Manager 变成 2/3 已用（仍合规），
  // dept1/dept3 变成 4 次（本就超限，场景不变）。
  let autoApprovedCount = 0
  for (let deptIdx = 0; deptIdx < deptByIndex.length; deptIdx++) {
    const [m1, m2] = managersByDept[deptIdx]
    const picked = pickDifferentDateAndTimeSwap(m1, m2, 60 + deptIdx)
    if (!picked) continue
    const { reqAsgn, cpAsgn } = picked
    const { error } = await supabase.from('shift_swap_requests').insert({
      company_id: company.id,
      requester_id: userIdMap[m1].internalId,
      requester_assignment_id: reqAsgn.assignmentId,
      counterpart_id: userIdMap[m2].internalId,
      counterpart_assignment_id: cpAsgn.assignmentId,
      reason: processedReasons[deptIdx % processedReasons.length],
      status: 'approved',
      counterpart_status: 'approved',
      counterpart_reviewed_at: new Date(Date.now() - (deptIdx + 2) * 3600000).toISOString(),
      reviewed_by: null,
      reviewed_at: new Date(Date.now() - (deptIdx + 2) * 3600000).toISOString(),
    })
    if (error) console.warn(`  ⚠ auto-approved swap 失败 (${m1}): ${error.message}`)
    else { swapCount++; autoApprovedCount++ }
  }

  // ── Processed Requests: 20 approved/rejected swaps ──
  // Same rule as pending: only same-role, same-department pairs are valid, so each dept
  // contributes 5 entries alternating between its one manager pair and one employee pair.
  // Status is fixed per position（前两条 approved，后三条 rejected）—— 这里给每人本月
  // 1 次 approved 打底；dept1/dept3 的 Manager 对由上面的"限额补种"再加 2 条到满额 3，
  // 其余人远低于 monthly_swap_limit=3，保持 Rule Check 场景分布不被打乱。
  const processedStatusCycle = ['approved', 'approved', 'rejected', 'rejected', 'rejected']
  const processedPairs = []
  for (let deptIdx = 0; deptIdx < deptByIndex.length; deptIdx++) {
    const [mgrEmail1, mgrEmail2] = managersByDept[deptIdx]
    const [empEmail1, empEmail2] = employeesByDept[deptIdx]
    const deptRolePairs = [
      [mgrEmail1, mgrEmail2],
      [empEmail1, empEmail2],
      [mgrEmail2, mgrEmail1],
      [empEmail2, empEmail1],
      [mgrEmail1, mgrEmail2],
    ]
    deptRolePairs.forEach(([reqEmail, cpEmail], i) => {
      processedPairs.push([reqEmail, cpEmail, processedStatusCycle[i], 20 + deptIdx * 5 + i])
    })
  }
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

  console.log(`  ✓ 生成 ${swapCount} 条 shift_swap_requests（${pendingSwapCount} pending：Owner 队列 4 条覆盖 clean/limit/deadline/both 四种 Rule Check 场景 + Manager 队列 4 条干净件；processed 含 ${autoApprovedCount} 条 Auto-Approved（reviewed_by null）+ ${limitTopUpCount} 条限额补种；换班双方共 ${swapTaskCount} 条班上任务（含 sub-tasks））`)

  // ── Step 14b: 给 Owner 发未读消息（触发 Chat 红点）─────────────────────────
  // manager1 和 employee1 各给 Owner 发一条未读消息，让 Owner 的 Communication > Chat
  // tab 显示红点。
  console.log('\nStep 14b: 给 Owner 发未读消息...')
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

  // ── Step 14c: Fixed Off Day Requests（触发 Fixed Day Off 红点）─────────────
  // Manager AND Employee submissions both route directly to one unified Owner queue now —
  // there is no separate Manager-review step. Owner's only two live decisions are
  // Approve / Modify (see attendanceService.decideFixedOffDayRequestGroup).
  console.log('\nStep 14c: 生成 Fixed Off Day Requests...')

  const offDayDeadlineWeekday = 5 // Friday, matching resolveDeadlineDateForWeek's Sun=0..Sat=6 convention
  const offDayDeadlineTime = '17:00'
  const { error: offDayDeadlineSeedErr } = await supabase.from('off_day_submission_deadline').insert({
    company_id: company.id,
    deadline_weekday: offDayDeadlineWeekday,
    deadline_time: offDayDeadlineTime,
    updated_by: ownerUser.id,
  })
  if (offDayDeadlineSeedErr) console.warn(`  ! off_day_submission_deadline failed: ${offDayDeadlineSeedErr.message}`)
  else console.log(`  ok off_day_submission_deadline Friday ${offDayDeadlineTime}`)

  // Mirrors resolveActiveSubmissionWeekStart in attendanceService.ts — whichever week is still
  // open for submission right now (shifts a week further out each time a week's own Friday-5PM
  // deadline has passed), so the seeded pending queue lines up with what the live Owner page
  // actually displays as "Off Day Request For Next Week X".
  function resolveActiveSubmissionWeekStart(today, deadlineWeekday, deadlineTime) {
    const [hh, mm] = deadlineTime.split(':').map(Number)
    let candidateWeekStart = startOfWeekMonday(today)
    for (;;) {
      const targetWeek = addDays(candidateWeekStart, 7)
      const deadlineMoment = new Date(dateInWeek(candidateWeekStart, deadlineWeekday))
      deadlineMoment.setHours(hh, mm, 0, 0)
      if (Date.now() <= deadlineMoment.getTime()) return targetWeek
      candidateWeekStart = targetWeek
    }
  }
  const activeWeekStart = resolveActiveSubmissionWeekStart(TODAY, offDayDeadlineWeekday, offDayDeadlineTime)
  const activeWeekStartKey = dateKey(activeWeekStart)

  // Default 2 days/week for both roles (matches what's already configured live), plus a couple
  // of per-user overrides so the "Individual Overrides" panel has real entries to show.
  const offDayQuotaRows = [
    { company_id: company.id, user_id: null, role: 'Manager', max_days_per_week: 2, updated_by: ownerUser.id },
    { company_id: company.id, user_id: null, role: 'Employee', max_days_per_week: 2, updated_by: ownerUser.id },
    { company_id: company.id, user_id: userIdMap['manager3@test.com'].internalId, max_days_per_week: 3, updated_by: ownerUser.id },
    { company_id: company.id, user_id: userIdMap['employee2@test.com'].internalId, max_days_per_week: 1, updated_by: ownerUser.id },
  ]
  const { error: offDayQuotaSeedErr } = await supabase.from('off_day_quota_settings').insert(offDayQuotaRows)
  if (offDayQuotaSeedErr) console.warn(`  ! off_day_quota_settings failed: ${offDayQuotaSeedErr.message}`)
  else console.log('  ok off_day_quota_settings: Manager 2/week, Employee 2/week, +2 overrides')

  // Effective quota per requester — must match the rows above so each seeded weekly group has
  // exactly the right number of dates, same as a real submission would.
  const requesterQuota = new Map([...managerEmails, ...employeeEmails].map(email => [email, 2]))
  requesterQuota.set('manager3@test.com', 3)
  requesterQuota.set('employee2@test.com', 1)

  const WEEKDAY_COMBOS = {
    1: [[1], [2], [3], [4], [5]],
    2: [[1, 3], [2, 4], [3, 5], [1, 4], [2, 5], [1, 2], [4, 5], [2, 3]],
    3: [[1, 3, 5], [2, 4, 5], [1, 2, 4], [1, 3, 4], [2, 3, 5]],
  }
  function pickWeekdaysForQuota(quota, idx) {
    const combos = WEEKDAY_COMBOS[quota] ?? WEEKDAY_COMBOS[2]
    return combos[idx % combos.length]
  }

  const allRequesters = [...managerEmails, ...employeeEmails]

  // Pending — everyone submits their weekly group for the currently-open week, so the Owner's
  // "Off Day Request For Next Week" queue (single-card pager) has a full, realistic set to page
  // through and to test the Approve / Modify + AI Suggestion flow against.
  const pendingFixedOffSeeders = allRequesters.flatMap((email, i) => {
    const quota = requesterQuota.get(email)
    return pickWeekdaysForQuota(quota, i).map(weekday => ({
      email,
      weekStart: activeWeekStart,
      weekday,
      status: 'pending',
      source: 'submitted',
      submittedHoursAgo: 6 + i * 3,
    }))
  })

  // Historical — past 4 weeks, already decided (Approve / Modify only, matching the current
  // product), so the Weekly Day Off Calendar heatmap has real past data to show alongside the
  // upcoming week's live requests.
  const historicalFixedOffSeeders = []
  for (let w = 1; w <= 4; w++) {
    const weekStart = addDays(activeWeekStart, -7 * w)
    allRequesters.forEach((email, i) => {
      if ((i + w) % 3 === 0) return // sparser historical weeks — not everyone requests every week
      const quota = requesterQuota.get(email)
      const weekdays = pickWeekdaysForQuota(quota, i + w)
      weekdays.forEach(weekday => {
        const reviewedHoursAgo = 24 * 7 * w + i
        historicalFixedOffSeeders.push({
          email,
          weekStart,
          weekday,
          status: (i + w) % 4 === 0 ? 'modified' : 'approved',
          source: (i + w) % 5 === 0 ? 'auto_assigned' : 'submitted',
          reviewedHoursAgo,
          submittedHoursAgo: reviewedHoursAgo + 2,
        })
      })
    })
  }

  const fixedOffSeeders = [...pendingFixedOffSeeders, ...historicalFixedOffSeeders]
  let fixedOffCount = 0
  for (const fo of fixedOffSeeders) {
    const userId = userIdMap[fo.email].internalId
    const requestWeekStartKey = dateKey(fo.weekStart)
    const requestDate = dateKey(dateInWeek(fo.weekStart, fo.weekday))
    const isDecided = fo.status !== 'pending'
    const { error: foErr } = await supabase.from('employee_off_day_requests').insert({
      user_id: userId,
      company_id: company.id,
      request_date: requestDate,
      week_start: requestWeekStartKey,
      status: fo.status,
      source: fo.source,
      created_at: new Date(Date.now() - (fo.submittedHoursAgo ?? 1) * 3600000).toISOString(),
      reviewed_by: isDecided ? ownerUser.id : null,
      reviewed_at: isDecided ? new Date(Date.now() - (fo.reviewedHoursAgo ?? 1) * 3600000).toISOString() : null,
    })
    if (foErr) console.warn(`  ! employee_off_day_requests failed (${fo.email}): ${foErr.message}`)
    else fixedOffCount++
  }
  console.log(`  ok seeded ${fixedOffCount} employee_off_day_requests (${pendingFixedOffSeeders.length} pending for week ${activeWeekStartKey} + ${historicalFixedOffSeeders.length} historical across 4 past weeks)`)

  // ── Step 15: Job Postings（Recruitment 页面的 Jobs 标签页 + Review 标签页数据）──
  // Jobs 标签页只显示 status in ('open','closed') 的职位（见 owner/recruitment/page.tsx
  // 的 jobsPostings 过滤逻辑）；Review 标签页显示 status = 'pending_approval' 的职位，
  // 由 Manager 提交、Owner 审批（submitter_name 取自 created_by）。
  console.log('\nStep 15: 生成 Job Postings（Jobs + Review）...')
  const jobStartDate = addDays(TODAY, 5)
  const jobPostingDefs = [
    // ── "All Jobs" tab data: status open/closed, mix of Shift Job / One-Off ──
    {
      dept: 0, status: 'open', is_recurring: true, title: 'Warehouse Assistant',
      description: 'Support day-to-day warehouse operations including stock handling and deliveries.',
      requirements: 'Able to lift up to 15kg. Prior warehouse experience a plus.',
      employment_type: 'casual', salary_amount: 15.5, assignedEmployeeIdx: 0, openings: 3,
      expires_at: addDays(TODAY, 10).toISOString(),
      shift_start_time: '09:00', shift_end_time: '17:00', break_start_time: '12:00', break_end_time: '13:00',
      recurrence_interval: 1, recurrence_unit: 'week', createdBy: 'owner',
    },
    {
      dept: 0, status: 'open', is_recurring: false, title: 'Event Setup Crew',
      description: 'One-off crew needed to set up and tear down for a corporate event.',
      requirements: 'Comfortable with physical setup work. Punctual and reliable.',
      employment_type: 'casual', salary_amount: 130, urgency: 'high', estimated_hours: '5',
      job_start_time: '08:00', createdBy: 'owner', assignedEmployeeIdx: 1, openings: 2,
      expires_at: addDays(TODAY, 7).toISOString(),
    },
    {
      dept: 1, status: 'open', is_recurring: true, title: 'Social Media Assistant',
      description: 'Help manage the weekly social media content calendar and community replies.',
      requirements: 'Familiar with Instagram and TikTok. Good written English.',
      employment_type: 'part-time', salary_amount: 16, assignedEmployeeIdx: 2,
      shift_start_time: '10:00', shift_end_time: '15:00', break_start_time: '12:30', break_end_time: '13:00',
      recurrence_interval: 1, recurrence_unit: 'week', createdBy: 'owner',
    },
    {
      dept: 1, status: 'closed', is_recurring: false, title: 'Promo Day Staff',
      description: 'Promo booth staff for a one-day retail activation.',
      requirements: 'Outgoing personality, comfortable engaging with the public.',
      employment_type: 'casual', salary_amount: 110, urgency: 'normal', estimated_hours: '6',
      job_start_time: '10:00', createdBy: 'owner', assignedEmployeeIdx: 3,
    },
    {
      dept: 2, status: 'open', is_recurring: true, title: 'Junior Support Technician',
      description: 'Provide first-line technical support and help maintain internal tooling.',
      requirements: 'Basic troubleshooting skills. Currently studying IT/CS is a plus.',
      employment_type: 'part-time', salary_amount: 18, assignedEmployeeIdx: 4,
      shift_start_time: '13:00', shift_end_time: '21:00', break_start_time: '17:00', break_end_time: '17:30',
      recurrence_interval: 2, recurrence_unit: 'week', createdBy: 'owner',
    },
    {
      dept: 2, status: 'open', is_recurring: false, title: 'IT Setup Helper',
      description: 'Assist with a one-time office workstation refresh — unboxing and setup.',
      requirements: 'Comfortable with basic PC hardware.',
      employment_type: 'casual', salary_amount: 140, urgency: 'urgent', estimated_hours: '4',
      job_start_time: '09:00', createdBy: 'owner', assignedEmployeeIdx: 5,
      expires_at: addDays(TODAY, 5).toISOString(),
    },
    {
      dept: 3, status: 'open', is_recurring: true, title: 'Weekend Support Agent',
      description: 'Cover weekend customer support tickets and live chat.',
      requirements: 'Clear written communication. Weekend availability required.',
      employment_type: 'part-time', salary_amount: 15, assignedEmployeeIdx: 6,
      shift_start_time: '09:00', shift_end_time: '17:00', break_start_time: '12:00', break_end_time: '13:00',
      recurrence_interval: 1, recurrence_unit: 'week', createdBy: 'owner',
    },
    {
      dept: 3, status: 'closed', is_recurring: false, title: 'Call Center Backup',
      description: 'Backup phone support during a planned product launch surge.',
      requirements: 'Prior call center experience preferred.',
      employment_type: 'casual', salary_amount: 120, urgency: 'high', estimated_hours: '8',
      job_start_time: '08:30', createdBy: 'owner', assignedEmployeeIdx: 7,
    },

    // ── "Review" tab data: status pending_approval, submitted by a Manager ──
    {
      dept: 0, status: 'pending_approval', is_recurring: false, title: 'Extra Warehouse Hand',
      description: 'Need one extra pair of hands for next week\'s stocktake.',
      requirements: 'Available for a full day, no experience required.',
      employment_type: 'casual', salary_amount: 100, urgency: 'normal', estimated_hours: '6',
      job_start_time: '09:00', createdBy: 'manager1@test.com', assignedEmployeeIdx: 1,
    },
    {
      dept: 1, status: 'pending_approval', is_recurring: true, title: 'Weekend Promo Crew',
      description: 'Recurring weekend booth crew for the new campaign launch.',
      requirements: 'Friendly, presentable, weekend availability.',
      employment_type: 'casual', salary_amount: 17, assignedEmployeeIdx: 3,
      shift_start_time: '11:00', shift_end_time: '19:00', break_start_time: '15:00', break_end_time: '15:30',
      recurrence_interval: 1, recurrence_unit: 'week', createdBy: 'manager3@test.com',
    },
    {
      dept: 2, status: 'pending_approval', is_recurring: false, title: 'Bug Bash Volunteer',
      description: 'One-off testing session ahead of the next release.',
      requirements: 'Comfortable following a test script.',
      employment_type: 'casual', salary_amount: 90, urgency: 'urgent', estimated_hours: '3',
      job_start_time: '14:00', createdBy: 'manager5@test.com', assignedEmployeeIdx: 5,
    },
    {
      dept: 3, status: 'pending_approval', is_recurring: true, title: 'Overflow Support Agent',
      description: 'Additional recurring shift to cover overflow support tickets.',
      requirements: 'Prior customer service experience preferred.',
      employment_type: 'part-time', salary_amount: 15.5, assignedEmployeeIdx: 7,
      shift_start_time: '17:00', shift_end_time: '21:00', break_start_time: null, break_end_time: null,
      recurrence_interval: 1, recurrence_unit: 'week', createdBy: 'manager7@test.com',
    },
    {
      dept: 0, status: 'pending_approval', is_recurring: false, title: 'Inventory Count Helper',
      description: 'Support the monthly inventory count across two storage rooms.',
      requirements: 'Detail-oriented, comfortable with spreadsheets.',
      employment_type: 'casual', salary_amount: 105, urgency: 'normal', estimated_hours: '5',
      job_start_time: '09:30', createdBy: 'manager2@test.com', assignedEmployeeIdx: 0,
    },

    // ── "Drafts" data: status draft — postings saved half-way from the Post Job form ──
    {
      dept: 0, status: 'draft', is_recurring: true, title: 'Night Shift Stocker',
      description: 'Restock shelves and prepare deliveries during the overnight window.',
      requirements: 'Able to work overnight hours. Physically fit.',
      employment_type: 'part-time', salary_amount: 17,
      shift_start_time: '22:00', shift_end_time: '06:00', break_start_time: '02:00', break_end_time: '02:30',
      recurrence_interval: 1, recurrence_unit: 'week', createdBy: 'owner',
      experience_required: 'Not Required', minimum_age: 18, uniform_type: 'company', uniform_details: 'Hi-vis vest (provided)',
    },
    {
      dept: 1, status: 'draft', is_recurring: false, title: 'Product Photoshoot Assistant',
      description: 'Assist the photographer during a one-day product shoot — props, steaming, staging.',
      requirements: 'Detail-oriented, comfortable on set.',
      employment_type: 'casual', salary_amount: 95, urgency: 'normal', estimated_hours: '6',
      job_start_time: '10:00', createdBy: 'owner',
      experience_required: 'Preferred', minimum_age: 16, uniform_type: 'none',
    },
    {
      dept: 2, status: 'draft', is_recurring: true, title: 'Weekend NOC Monitor',
      description: 'Monitor system dashboards over the weekend and escalate incidents.',
      requirements: 'Basic understanding of uptime monitoring tools.',
      employment_type: 'part-time', salary_amount: 19,
      shift_start_time: '08:00', shift_end_time: '16:00', break_start_time: '12:00', break_end_time: '12:30',
      recurrence_interval: 1, recurrence_unit: 'week', createdBy: 'owner',
      experience_required: '6+ Months', minimum_age: 18, uniform_type: 'none',
    },
    {
      // 故意残缺的草稿：只有标题和一半描述，模拟写到一半就点了 Save Draft
      dept: 3, status: 'draft', is_recurring: false, title: 'Holiday Hotline Backup',
      description: 'Cover the customer hotline during the public holiday period.',
      requirements: null,
      employment_type: 'casual', salary_amount: null, urgency: 'normal', estimated_hours: null,
      job_start_time: null, createdBy: 'owner',
    },
    {
      dept: 1, status: 'draft', is_recurring: false, title: 'Roadshow Flyer Distributor',
      description: 'Hand out flyers and direct footfall to the roadshow booth.',
      requirements: 'Energetic and comfortable approaching the public.',
      employment_type: 'casual', salary_amount: 80, urgency: 'high', estimated_hours: '4',
      job_start_time: '11:00', createdBy: 'owner',
      experience_required: 'Not Required', minimum_age: 16, uniform_type: 'dress_code', uniform_details: 'Plain white top, dark bottoms',
    },
  ]

  let jobPostingCount = 0
  const allEmployeeEmailsFlat = employeeEmails
  const postingIdByTitle = new Map()
  for (const def of jobPostingDefs) {
    const dept = deptByIndex[def.dept]
    const createdById = def.createdBy === 'owner' ? ownerUser.id : userIdMap[def.createdBy].internalId
    const assignedEmployeeId = def.assignedEmployeeIdx != null
      ? userIdMap[allEmployeeEmailsFlat[def.assignedEmployeeIdx]].internalId
      : null

    const { data: jp, error: jpErr } = await supabase.from('job_postings').insert({
      company_id: company.id,
      department_id: dept.id,
      created_by: createdById,
      title: def.title,
      description: def.description,
      requirements: def.requirements ?? null,
      location: company.address,
      employment_type: def.employment_type ?? null,
      company_name: company.name,
      industry: company.industry,
      status: def.status,
      is_recurring: def.is_recurring,
      recurrence_interval: def.recurrence_interval ?? null,
      recurrence_unit: def.recurrence_unit ?? null,
      salary_amount: def.salary_amount ?? null,
      salary_type: def.is_recurring ? 'per hour' : 'flat rate',
      urgency: def.is_recurring ? null : (def.urgency ?? 'normal'),
      estimated_hours: def.is_recurring ? null : (def.estimated_hours ?? null),
      shift_date: dateKey(jobStartDate),
      shift_start_time: def.is_recurring ? (def.shift_start_time ?? null) : null,
      shift_end_time: def.is_recurring ? (def.shift_end_time ?? null) : null,
      break_start_time: def.is_recurring ? (def.break_start_time ?? null) : null,
      break_end_time: def.is_recurring ? (def.break_end_time ?? null) : null,
      job_start_time: def.is_recurring ? null : (def.job_start_time ?? null),
      assigned_employee_id: assignedEmployeeId,
      openings: def.openings ?? 1,
      expires_at: def.expires_at ?? null,
      expiry_preset: def.expires_at ? 'custom' : 'none',
      experience_required: def.experience_required ?? null,
      minimum_age: def.minimum_age ?? null,
      uniform_required: def.uniform_type === 'company' || def.uniform_type === 'dress_code',
      uniform_type: def.uniform_type ?? 'none',
      uniform_details: def.uniform_details ?? null,
    }).select('id').single()
    if (jpErr) console.warn(`  ⚠ 创建 job_posting 失败 (${def.title}): ${jpErr.message}`)
    else { jobPostingCount++; postingIdByTitle.set(def.title, jp.id); console.log(`  ✓ Job Posting: ${def.title} [${def.status}] (${dept.name})`) }
  }
  const openClosedCount = jobPostingDefs.filter(d => d.status === 'open' || d.status === 'closed').length
  const pendingCount = jobPostingDefs.filter(d => d.status === 'pending_approval').length
  const draftCount = jobPostingDefs.filter(d => d.status === 'draft').length
  console.log(`  ✓ 生成 ${jobPostingCount} 条 job_postings（Jobs 标签页 ${openClosedCount} 条 open/closed，Review 标签页 ${pendingCount} 条 pending_approval，Drafts ${draftCount} 条 draft）`)

  // ── Step 15b: Job Applicants（只对 status='open' 的职位投递，跟真实使用场景一致——
  // 已关闭/待审批的职位不该有公开申请）。混合 pending/accepted/rejected，让 Owner
  // 的 "All Jobs" 卡片能看到红点（有 pending 申请）和真实的申请人详情。──────────
  console.log('\nStep 15b: 生成 Job Applicants...')
  const applicantDefs = [
    { title: 'Warehouse Assistant',        guest: 'guest1@test.com', status: 'pending' },
    { title: 'Warehouse Assistant',        guest: 'guest2@test.com', status: 'accepted' },
    { title: 'Event Setup Crew',           guest: 'guest3@test.com', status: 'pending' },
    { title: 'Social Media Assistant',     guest: 'guest2@test.com', status: 'pending' },
    { title: 'Social Media Assistant',     guest: 'guest4@test.com', status: 'pending' },
    { title: 'Social Media Assistant',     guest: 'guest5@test.com', status: 'rejected' },
    { title: 'Junior Support Technician',  guest: 'guest1@test.com', status: 'pending' },
    { title: 'Weekend Support Agent',      guest: 'guest6@test.com', status: 'pending' },
    { title: 'Weekend Support Agent',      guest: 'guest3@test.com', status: 'rejected' },
  ]
  let jobApplicantCount = 0
  for (let i = 0; i < applicantDefs.length; i++) {
    const def = applicantDefs[i]
    const jobId = postingIdByTitle.get(def.title)
    const guestId = userIdMap[def.guest]?.internalId
    if (!jobId || !guestId) { console.warn(`  ⚠ 跳过 applicant（找不到 job 或 guest）: ${def.title} / ${def.guest}`); continue }

    const { data: ja, error: jaErr } = await supabase.from('job_applicants').insert({
      job_id: jobId,
      user_id: guestId,
      resume_url: `https://example.com/demo-resumes/${def.guest.split('@')[0]}-resume.pdf`,
      cover_letter: `https://example.com/demo-cover-letters/${def.guest.split('@')[0]}-cover-letter.pdf`,
      status: def.status,
      applied_at: new Date(Date.now() - (i + 1) * 3600000).toISOString(),
    }).select('id').single()
    if (jaErr) { console.warn(`  ⚠ 创建 job_applicant 失败 (${def.title} / ${def.guest}): ${jaErr.message}`); continue }
    jobApplicantCount++

    // Mirrors recruitmentService.decideApplicant: accepting an applicant also sends them a job
    // invitation — without this row, an 'accepted' applicant would be stuck with no next step.
    if (def.status === 'accepted') {
      const { error: jiErr } = await supabase.from('job_invitations').insert({
        job_id: jobId,
        applicant_id: ja.id,
        sent_by: ownerUser.id,
        message: 'Your application has been accepted. Please wait for onboarding instructions.',
      })
      if (jiErr) console.warn(`  ⚠ 创建 job_invitation 失败 (${def.title} / ${def.guest}): ${jiErr.message}`)
    }
  }
  console.log(`  ✓ 生成 ${jobApplicantCount} 条 job_applicants（混合 pending/accepted/rejected，只投给 open 状态的职位）`)

  // ── Step 15c: 给部分 CW 的 shift 补上 source_job_posting_id ──────────────
  // 演示 Attendance Record 弹窗里点击 "Job Title" 能看到当初发布的 job posting 详情——
  // 挑每个部门第一个 active CW，把他们所有的 shift 都指回该部门一个 open 状态的 job
  // posting（模拟"这个 CW 就是从这个招聘广告招进来的"）。其余 CW 保持不关联，因为现实
  // 中不是每个 CW 都一定是通过发布的 job posting 招进来的。
  console.log('\nStep 15c: 关联部分 Casual Worker shift 与 Job Posting...')
  const cwToJobPostingTitle = {
    'cw1@test.com': 'Warehouse Assistant',
    'cw3@test.com': 'Social Media Assistant',
    'cw5@test.com': 'Junior Support Technician',
    'cw7@test.com': 'Weekend Support Agent',
  }
  let cwJobLinkCount = 0
  for (const a of cwAssignmentInfo) {
    const jobTitle = cwToJobPostingTitle[a.email]
    if (!jobTitle) continue
    const jobId = postingIdByTitle.get(jobTitle)
    if (!jobId) continue
    const { error: linkErr } = await supabase.from('shifts').update({ source_job_posting_id: jobId }).eq('id', a.shiftId)
    if (linkErr) console.warn(`  ⚠ 关联 shift → job_posting 失败 (${a.email}): ${linkErr.message}`)
    else cwJobLinkCount++
  }
  console.log(`  ✓ 关联了 ${cwJobLinkCount} 个 CW shift 到对应的 job_posting`)

  // ── Step 16: Job Templates（Owner 自己配置的可复用招聘模板）──────────────
  // 20 条贴合 Sunrise Hospitality Group（酒店/餐饮/活动公司）的模板，覆盖全部 4 个部门、
  // shift 与 oneoff 两种类型，并填满模板的所有字段（部门/薪资/着装/经验/年龄/时长/紧急度）。
  console.log('\nStep 16: 生成 Job Templates...')
  const jobTemplateDefs = [
    // ── Shift jobs（长期排班岗位，per hour）──
    { dept: 'Operations', title: 'Barista', form_type: 'shift', salary: 14,
      description: 'Prepare espresso-based drinks, serve customers at the counter, keep the coffee station stocked and clean throughout the shift.',
      requirements: 'Latte art basics preferred, comfortable during morning rush, good customer manner.',
      experience: 'Preferred', age: 16, uniform: 'Black polo and apron (provided)' },
    { dept: 'Operations', title: 'Weekend Cashier', form_type: 'shift', salary: 13,
      description: 'Run the register during weekend shifts, handle cash and card payments, reconcile the till at closing.',
      requirements: 'Basic arithmetic, detail-oriented, friendly with customers.',
      experience: 'Not Required', age: 16, uniform: null },
    { dept: 'Operations', title: 'Banquet Server', form_type: 'shift', salary: 15,
      description: 'Serve plated courses at banquets and corporate dinners, set and clear tables, respond to guest requests.',
      requirements: 'Able to carry a loaded tray, well groomed, prior banquet or F&B service experience.',
      experience: '6+ Months', age: 18, uniform: 'White shirt, black slacks, black shoes', uniformType: 'dress_code' },
    { dept: 'Operations', title: 'Kitchen Steward', form_type: 'shift', salary: 14,
      description: 'Wash and sanitise kitchenware, keep prep areas clean, support chefs with basic ingredient prep.',
      requirements: 'Comfortable standing full shift, food hygiene awareness.',
      experience: 'Not Required', age: 18, uniform: null },
    { dept: 'Operations', title: 'Housekeeping Attendant', form_type: 'shift', salary: 14,
      description: 'Clean and reset function rooms and guest areas, restock supplies, report damage or maintenance issues.',
      requirements: 'Thorough and reliable, able to follow room checklists.',
      experience: 'Not Required', age: 18, uniform: null },
    { dept: 'Operations', title: 'Security Officer', form_type: 'shift', salary: 17,
      description: 'Man the entrance during events, check invitations and wristbands, patrol the venue and handle incidents calmly.',
      requirements: 'Valid security licence, clear communication, physically fit.',
      experience: '1+ Year', age: 21, uniform: 'Company security uniform (provided)' },
    { dept: 'Customer Support', title: 'Front Desk Receptionist', form_type: 'shift', salary: 16,
      description: 'Greet walk-in guests, manage event check-ins, answer phone enquiries and direct them to the right team.',
      requirements: 'Polished phone manner, basic Excel, fluent English.',
      experience: '1+ Year', age: 18, uniform: null },
    { dept: 'Customer Support', title: 'Call Center Agent', form_type: 'shift', salary: 15,
      description: 'Handle inbound booking and billing calls, log every case in the CRM, escalate complex complaints to the duty manager.',
      requirements: 'Clear speaking voice, patient under pressure, typing 40+ wpm.',
      experience: '6+ Months', age: 18, uniform: null },
    { dept: 'Customer Support', title: 'Live Chat Support Agent', form_type: 'shift', salary: 16,
      description: 'Answer customer chats across web and social channels, resolve booking changes, keep response time under two minutes.',
      requirements: 'Strong written English, multitasking across chats, CRM experience.',
      experience: '1+ Year', age: 18, uniform: null },
    { dept: 'Marketing', title: 'Social Media Coordinator', form_type: 'shift', salary: 18,
      description: 'Draft and schedule posts for upcoming events, reply to comments and DMs, compile a weekly engagement summary.',
      requirements: 'Portfolio of managed accounts, Canva or basic photo editing, good copywriting.',
      experience: '1+ Year', age: 18, uniform: null },
    { dept: 'Engineering', title: 'AV Technician', form_type: 'shift', salary: 20,
      description: 'Operate sound and projection during live events, run mic checks with speakers, troubleshoot AV faults on the spot.',
      requirements: 'Hands-on with digital mixers and projectors, calm under live-show pressure.',
      experience: '2+ Years', age: 18, uniform: null },
    { dept: 'Engineering', title: 'Maintenance Technician', form_type: 'shift', salary: 19,
      description: 'Carry out preventive maintenance rounds, fix minor electrical and plumbing faults, log all works in the maintenance system.',
      requirements: 'Electrical or facilities background, able to read equipment manuals, safety-first mindset.',
      experience: '2+ Years', age: 21, uniform: null },
    // ── One-off jobs（单次任务，flat rate）──
    { dept: 'Operations', title: 'Event Setup Crew', form_type: 'oneoff', salary: 120, hours: '6', urgency: 'normal',
      description: 'Set up tables, chairs, staging and signage for a corporate dinner before doors open.',
      requirements: 'Able to lift 15kg, follows floor plans accurately, punctual.',
      experience: 'Not Required', age: 16, uniform: null },
    { dept: 'Operations', title: 'Banquet Teardown Crew', form_type: 'oneoff', salary: 100, hours: '5', urgency: 'high',
      description: 'Clear and pack down the ballroom after a wedding banquet — stack furniture, bag linens, load equipment onto trolleys.',
      requirements: 'Comfortable with late-night physical work, works fast in a team.',
      experience: 'Not Required', age: 18, uniform: null },
    { dept: 'Operations', title: 'Warehouse Stocktake Assistant', form_type: 'oneoff', salary: 110, hours: '6', urgency: 'urgent',
      description: 'Count and tag F&B and equipment inventory at the central store, record quantities into the stocktake sheet.',
      requirements: 'Able to lift 15kg, careful counter, basic spreadsheet entry.',
      experience: 'Not Required', age: 18, uniform: null },
    { dept: 'Marketing', title: 'Flyer Distribution Crew', form_type: 'oneoff', salary: 80, hours: '4', urgency: 'normal',
      description: 'Distribute event flyers around the CBD lunch crowd and record rough handout counts per location.',
      requirements: 'Outgoing, comfortable approaching strangers, reliable timekeeping.',
      experience: 'Not Required', age: 16, uniform: 'Branded t-shirt (provided)' },
    { dept: 'Marketing', title: 'Brand Ambassador — Product Launch', form_type: 'oneoff', salary: 180, hours: '8', urgency: 'high',
      description: 'Front the demo booth at a product launch, walk guests through the product and collect sign-up leads.',
      requirements: 'Confident presenter, well groomed, prior roadshow or promo experience.',
      experience: 'Preferred', age: 18, uniform: 'Branded polo (provided)' },
    { dept: 'Marketing', title: 'Event Photographer Assistant', form_type: 'oneoff', salary: 150, hours: '8', urgency: 'normal',
      description: 'Assist the lead photographer at a wedding — manage lighting gear, wrangle group shots, back up memory cards.',
      requirements: 'Familiar with DSLR gear, discreet around guests, own transport preferred.',
      experience: 'Preferred', age: 18, uniform: null },
    { dept: 'Engineering', title: 'Stage Lighting Rig Crew', form_type: 'oneoff', salary: 200, hours: '10', urgency: 'high',
      description: 'Rig and focus stage lighting for a concert — truss work, cabling, and assisting the lighting designer through the plot.',
      requirements: 'Working-at-height certified, knows DMX basics, prior rigging experience.',
      experience: '2+ Years', age: 18, uniform: null },
    { dept: 'Engineering', title: 'Sound Check Technician', form_type: 'oneoff', salary: 160, hours: '5', urgency: 'normal',
      description: 'Run the afternoon sound check for a live band — patch inputs, ring out monitors, document the desk scene for the evening engineer.',
      requirements: 'Live mixing experience, familiar with digital consoles, methodical.',
      experience: '1+ Year', age: 18, uniform: null },
  ]
  let jobTemplateCount = 0
  for (const def of jobTemplateDefs) {
    const dept = depts.find(d => d.name === def.dept)
    const { error } = await supabase.from('job_templates').insert({
      company_id: company.id,
      name: `${def.title} Template`,
      title: def.title,
      description: def.description,
      requirements: def.requirements,
      employment_type: def.form_type === 'shift' ? 'part-time' : 'casual',
      form_type: def.form_type,
      department_id: dept ? dept.id : null,
      salary_amount: def.salary,
      salary_type: def.form_type === 'shift' ? 'per hour' : 'flat rate',
      uniform_required: !!def.uniform,
      uniform_type: def.uniform ? (def.uniformType || 'company') : 'none',
      uniform_details: def.uniform || null,
      experience_required: def.experience,
      minimum_age: def.age,
      estimated_hours: def.form_type === 'oneoff' ? def.hours : null,
      urgency: def.form_type === 'oneoff' ? def.urgency : null,
      created_by: ownerUser.id,
    })
    if (error) console.warn(`  ⚠ 创建 job_template 失败 (${def.title}): ${error.message}`)
    else jobTemplateCount++
  }
  console.log(`  ✓ 生成 ${jobTemplateCount} 条 job_templates`)

  // ── Step 17: Shift Templates（Owner 自己配置的可复用班次时段模板）────────
  console.log('\nStep 17: 生成 Shift Templates...')
  const shiftTemplateDefs = [
    { name: 'Morning Shift', start_time: '09:00', end_time: '17:00' },
    { name: 'Afternoon Shift', start_time: '11:00', end_time: '18:00' },
    { name: 'Evening Shift', start_time: '13:00', end_time: '21:00' },
  ]
  let shiftTemplateCount = 0
  for (const def of shiftTemplateDefs) {
    const { error } = await supabase.from('shift_templates').insert({
      company_id: company.id,
      name: def.name,
      start_time: def.start_time,
      end_time: def.end_time,
      created_by: ownerUser.id,
    })
    if (error) console.warn(`  ⚠ 创建 shift_template 失败 (${def.name}): ${error.message}`)
    else shiftTemplateCount++
  }
  console.log(`  ✓ 生成 ${shiftTemplateCount} 条 shift_templates`)

  // ── Step 18: Time Off / Break Waiver Requests ────────────────────────────
  // time_off_requests 没有被 UC55/UC57 那次重构删掉——它还是 schedulingRuleService
  // (AI 排班) 判断"这个人这天是不是在请假"的真实数据源，Manager/Employee/CW 的
  // Attendance 页面也还有提交入口，所以要真种，不能当成废弃表跳过。
  console.log('\nStep 18: 生成 Time Off / Break Waiver Requests...')
  const timeOffFutureAssignments = assignmentInfo.filter(a => !a.isPast)
  const timeOffDefs = [
    { email: 'employee2@test.com', request_type: 'time_off', reason: 'Family trip out of town.', status: 'approved' },
    { email: 'employee4@test.com', request_type: 'time_off', reason: 'Medical appointment.', status: 'pending' },
    { email: 'manager3@test.com', request_type: 'break_waiver', reason: 'Prefer to work through break to leave early.', status: 'pending' },
    { email: 'employee6@test.com', request_type: 'time_off', reason: 'Personal commitment.', status: 'rejected' },
  ]
  let timeOffCount = 0
  for (const def of timeOffDefs) {
    const assignment = timeOffFutureAssignments.find(a => a.email === def.email)
    if (!assignment) { console.warn(`  ⚠ 跳过 time_off_request（找不到 ${def.email} 的未来 shift）`); continue }
    const isDecided = def.status !== 'pending'
    const { error } = await supabase.from('time_off_requests').insert({
      company_id: company.id,
      requester_id: userIdMap[def.email].internalId,
      shift_assignment_id: assignment.assignmentId,
      request_type: def.request_type,
      reason: def.reason,
      status: def.status,
      reviewed_by: isDecided ? ownerUser.id : null,
      reviewed_at: isDecided ? new Date().toISOString() : null,
    })
    if (error) console.warn(`  ⚠ 创建 time_off_request 失败 (${def.email}): ${error.message}`)
    else timeOffCount++
  }
  console.log(`  ✓ 生成 ${timeOffCount} 条 time_off_requests（混合 time_off/break_waiver，pending/approved/rejected）`)

  // ── Step 19: Company Activity Logs ───────────────────────────────────────
  // 这张表真实场景下是 owner/team 页面在做增删改操作时自动写入的副作用记录，不是用户
  // 手填的表单——这里直接模拟几条历史操作，让 Owner 一进 Team 页面就有活动记录可看，
  // 不用先手动操作一遍才有数据。
  console.log('\nStep 19: 生成 Company Activity Logs...')
  const activityLogDefs = [
    { action: 'invite_member', target_name: 'David Lim', detail: 'Manager' },
    { action: 'change_department', target_name: 'Chloe Yeo', detail: 'Operations' },
    { action: 'set_inactive', target_name: 'Marcus Lim', detail: 'Repeated no-shows without prior notice.' },
    { action: 'set_active', target_name: 'Jasper Koh', detail: null },
  ]
  let activityLogCount = 0
  for (const def of activityLogDefs) {
    const { error } = await supabase.from('company_activity_logs').insert({
      company_id: company.id,
      actor_id: ownerUser.id,
      action: def.action,
      target_name: def.target_name,
      detail: def.detail,
    })
    if (error) console.warn(`  ⚠ 创建 activity_log 失败 (${def.action}): ${error.message}`)
    else activityLogCount++
  }
  console.log(`  ✓ 生成 ${activityLogCount} 条 company_activity_logs`)

  // ── Step 20: Announcement Reads ──────────────────────────────────────────
  // 同样是自动产生的副作用记录（用户打开公告时才会写入），这里模拟"部分员工已读"，
  // 好让 Owner 端看公告时不是每条都显示 0 已读。
  console.log('\nStep 20: 生成 Announcement Reads...')
  let announcementReadCount = 0
  if (announcementIds.length > 0) {
    const readerEmails = [managersByDept[0][0], employeesByDept[0][0], managersByDept[1][0]]
    const readRows = []
    for (const announcementId of announcementIds) {
      for (const email of readerEmails) {
        readRows.push({ user_id: userIdMap[email].internalId, announcement_id: announcementId })
      }
    }
    const { error } = await supabase.from('announcement_reads').upsert(readRows, { onConflict: 'user_id,announcement_id', ignoreDuplicates: true })
    if (error) console.warn(`  ⚠ 创建 announcement_reads 失败: ${error.message}`)
    else announcementReadCount = readRows.length
  }
  console.log(`  ✓ 生成 ${announcementReadCount} 条 announcement_reads`)

  // ── 故意跳过的表 ──────────────────────────────────────────────────────────
  // scheduling_rule_settings: schedulingRuleService.ts 目前把排班规则写死成内存常量，
  //   updateRule() 直接 throw 'system-protected'，DB 表虽然存在但服务层完全不读它——
  //   种进去也不会在任何页面上生效，等这块真正接上 DB 之后再补种子。
  // reviews: 全项目代码搜不到任何 .from('reviews') 的读写，是张没被使用的表，不种。
  // marketing_pages / marketing_content_blocks: Module 9 Marketing CMS，CLAUDE.md 里
  //   明确写了这两个模块归另一个团队负责，不在这次种子范围内。
}

main().catch(err => {
  console.error('\n✗ 脚本异常:', err.message)
  process.exit(1)
})
