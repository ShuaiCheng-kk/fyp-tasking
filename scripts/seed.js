/**
 * scripts/seed.js — Tasking 完整开发数据重建脚本
 *
 * 功能：
 *   1. 清空账户/公司/部门及所有业务数据表
 *   2. 删除 auth.users 里的旧测试账号（含 Playwright 遗留的 @tasking-tests.local 垃圾账号）
 *   3. 在 Supabase Auth 创建真实账号（密码统一 111111）
 *   4. 插入 public.users、companies、departments 及部门分配
 *   5. 插入 Casual Workers（含 date_of_birth, phone_number, worker_status 等）
 *   6. 生成 Shifts（过去28天 + 未来7天，每个 Employee/Manager 每天一个班 —— 过去拉长到
 *      28 天是为了 Owner Report 的 "vs Previous Period" 上期对比有真实数据）
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
  // Managers (8, 2 per department) — hourly_rate feeds the Owner Report's labor-cost figure for
  // internal staff (scheduled hours × rate, since Managers/Employees don't clock in/out).
  { email: 'manager1@test.com', full_name: 'David Lim',      role: 'Manager', phone_number: '+65 9456 7890', date_of_birth: '1988-04-12', hourly_rate: 28.00 },
  { email: 'manager2@test.com', full_name: 'Rachel Koh',     role: 'Manager', phone_number: '+65 9567 8901', date_of_birth: '1990-09-28', hourly_rate: 27.50 },
  { email: 'manager3@test.com', full_name: 'Aaron Wong',     role: 'Manager', phone_number: '+65 9678 9012', date_of_birth: '1987-01-17', hourly_rate: 26.00 },
  { email: 'manager4@test.com', full_name: 'Fiona Chen',     role: 'Manager', phone_number: '+65 9789 0123', date_of_birth: '1991-06-03', hourly_rate: 29.00 },
  { email: 'manager5@test.com', full_name: 'Ethan Goh',      role: 'Manager', phone_number: '+65 9890 1234', date_of_birth: '1986-12-25', hourly_rate: 30.00 },
  { email: 'manager6@test.com', full_name: 'Jasmine Lee',    role: 'Manager', phone_number: '+65 9901 2345', date_of_birth: '1992-03-09', hourly_rate: 27.00 },
  { email: 'manager7@test.com', full_name: 'Marcus Ong',     role: 'Manager', phone_number: '+65 9012 3456', date_of_birth: '1989-08-14', hourly_rate: 26.50 },
  { email: 'manager8@test.com', full_name: 'Vivian Ho',      role: 'Manager', phone_number: '+65 9123 4560', date_of_birth: '1993-05-21', hourly_rate: 28.50 },
  // Employees (8, 2 per department)
  { email: 'employee1@test.com', full_name: 'Ben Seah',       role: 'Employee', phone_number: '+65 8123 4567', date_of_birth: '1995-02-18', hourly_rate: 19.00 },
  { email: 'employee2@test.com', full_name: 'Chloe Yeo',      role: 'Employee', phone_number: '+65 8234 5678', date_of_birth: '1997-10-05', hourly_rate: 18.50 },
  { email: 'employee3@test.com', full_name: 'Daniel Tay',     role: 'Employee', phone_number: '+65 8345 6789', date_of_birth: '1994-07-30', hourly_rate: 20.00 },
  { email: 'employee4@test.com', full_name: 'Elaine Chua',    role: 'Employee', phone_number: '+65 8456 7890', date_of_birth: '1996-04-11', hourly_rate: 19.50 },
  { email: 'employee5@test.com', full_name: 'Felix Ng',       role: 'Employee', phone_number: '+65 8567 8901', date_of_birth: '1998-01-24', hourly_rate: 21.00 },
  { email: 'employee6@test.com', full_name: 'Grace Lau',      role: 'Employee', phone_number: '+65 8678 9012', date_of_birth: '1995-09-16', hourly_rate: 18.00 },
  // employee7 deliberately left without an hourly_rate — keeps the Report's "no pay rate on
  // file" data-quality flag genuinely demonstrable instead of it always reading zero.
  { email: 'employee7@test.com', full_name: 'Henry Sim',      role: 'Employee', phone_number: '+65 8789 0123', date_of_birth: '1997-06-07', hourly_rate: null },
  { email: 'employee8@test.com', full_name: 'Irene Tan',      role: 'Employee', phone_number: '+65 8890 1234', date_of_birth: '1999-03-29', hourly_rate: 20.50 },
]

// Casual Workers — these get worker_status, date_of_birth, resume/skills/certificates on the live
// profile (users.skills/resume_url + user_certificates), same profile-level fields the Casual
// Worker Detail card on the Team page reads (not the per-application job_applicants snapshot).
const casualWorkers = [
  { email: 'cw1@test.com',  full_name: 'Alicia Tan',     phone_number: '+65 8100 1001', date_of_birth: '1998-05-12', worker_status: 'active',   inactivate_reason: null, hourly_rate: 15.50,
    skills: 'Barista, Latte art, Cash register', resume_url: 'https://example.com/demo-resumes/cw1-resume.pdf',
    certs: [{ name: 'Food Hygiene Certificate', file_url: 'https://example.com/demo-certs/food-hygiene.pdf' }] },
  { email: 'cw2@test.com',  full_name: 'Nadia Wong',     phone_number: '+65 8100 1002', date_of_birth: '2000-08-22', worker_status: 'active',   inactivate_reason: null, hourly_rate: 14.00,
    skills: 'Retail cashiering, Stocktaking, Customer service', resume_url: 'https://example.com/demo-resumes/cw2-resume.pdf',
    certs: [{ name: 'WSQ Food Safety Course Level 1', file_url: 'https://example.com/demo-certs/wsq-food-safety.pdf' }] },
  { email: 'cw3@test.com',  full_name: 'Hui Min Lee',    phone_number: '+65 8100 1003', date_of_birth: '1999-03-17', worker_status: 'active',   inactivate_reason: null, hourly_rate: 16.00,
    skills: 'Event setup, Sound equipment, Stage rigging', resume_url: 'https://example.com/demo-resumes/cw3-resume.pdf',
    certs: [{ name: 'First Aid Certificate (CPR + AED)', file_url: 'https://example.com/demo-certs/first-aid.pdf' }] },
  { email: 'cw4@test.com',  full_name: 'Farah Hassan',   phone_number: '+65 8100 1004', date_of_birth: '2001-11-05', worker_status: 'active',   inactivate_reason: null, hourly_rate: 13.50,
    skills: 'Photography, Canva, Retail merchandising', resume_url: 'https://example.com/demo-resumes/cw4-resume.pdf',
    certs: [{ name: 'Security Officer Licence', file_url: 'https://example.com/demo-certs/security-officer.pdf' }] },
  { email: 'cw5@test.com',  full_name: 'Ethan Ong',      phone_number: '+65 8100 1005', date_of_birth: '1997-07-30', worker_status: 'active',   inactivate_reason: null, hourly_rate: 17.00,
    skills: 'Forklift operation, Inventory management, Heavy lifting', resume_url: 'https://example.com/demo-resumes/cw5-resume.pdf',
    certs: [{ name: 'Forklift Licence', file_url: 'https://example.com/demo-certs/forklift-licence.pdf' }] },
  { email: 'cw6@test.com',  full_name: 'Daniel Goh',     phone_number: '+65 8100 1006', date_of_birth: '2002-02-14', worker_status: 'active',   inactivate_reason: null, hourly_rate: 14.50,
    skills: 'Live chat support, Zendesk, Clear written English', resume_url: 'https://example.com/demo-resumes/cw6-resume.pdf',
    certs: [{ name: 'Food Hygiene Certificate', file_url: 'https://example.com/demo-certs/food-hygiene.pdf' }] },
  { email: 'cw7@test.com',  full_name: 'Siti Nur',       phone_number: '+65 8100 1007', date_of_birth: '1996-09-09', worker_status: 'active',   inactivate_reason: null, hourly_rate: 15.00,
    skills: 'Flyer distribution, Crowd engagement, Bilingual (EN/MY)', resume_url: 'https://example.com/demo-resumes/cw7-resume.pdf',
    certs: [{ name: 'First Aid Certificate (CPR + AED)', file_url: 'https://example.com/demo-certs/first-aid.pdf' }] },
  { email: 'cw8@test.com',  full_name: 'Marcus Lim',     phone_number: '+65 8100 1008', date_of_birth: '2000-04-25', worker_status: 'inactive', inactivate_reason: 'Repeated no-shows without prior notice.', hourly_rate: null,
    skills: 'PC hardware, Networking basics, Troubleshooting', resume_url: null, certs: [] },
  { email: 'cw9@test.com',  full_name: 'Jasper Koh',     phone_number: '+65 8100 1009', date_of_birth: '1999-12-01', worker_status: 'inactive', inactivate_reason: 'Violated workplace conduct policy.',     hourly_rate: null,
    skills: 'Structured cabling, Server racking, Network patching', resume_url: null, certs: [] },
  { email: 'cw10@test.com', full_name: 'Mei Xin Teo',    phone_number: '+65 8100 1010', date_of_birth: '1998-06-18', worker_status: 'inactive', inactivate_reason: 'Unable to meet shift requirements.',     hourly_rate: null,
    skills: 'PC hardware, Networking basics, Troubleshooting', resume_url: null, certs: [] },
]

// Guest Users — public job-board applicants (role 'Guest User', not scoped to any company yet).
// These are who job_applicants.user_id points at before an applicant is ever hired.
// skills / certs feed both the live worker profile (users.skills + user_certificates) and the
// per-application snapshot fields (skills_snapshot / certificates_snapshot) so the employer-side
// applicant panel has real, varied content to render.
const guestApplicants = [
  { email: 'guest1@test.com',  full_name: 'Wei Jie Lim',   phone_number: '+65 8200 2001', date_of_birth: '2000-01-15',
    skills: 'Forklift operation, Inventory management, Heavy lifting',
    certs: [{ name: 'Forklift Licence', file_url: 'https://example.com/demo-certs/forklift-licence.pdf' }] },
  { email: 'guest2@test.com',  full_name: 'Priyanka Das',  phone_number: '+65 8200 2002', date_of_birth: '1999-05-22',
    skills: 'Customer service, Social media content, Copywriting',
    certs: [{ name: 'Digital Marketing Certificate', file_url: 'https://example.com/demo-certs/digital-marketing.pdf' }] },
  { email: 'guest3@test.com',  full_name: 'Kai Xuan Ong',  phone_number: '+65 8200 2003', date_of_birth: '2001-09-10',
    skills: 'Event setup, Sound equipment, Stage rigging',
    certs: [] },
  { email: 'guest4@test.com',  full_name: 'Amirah Yusof',  phone_number: '+65 8200 2004', date_of_birth: '1998-12-03',
    skills: 'Photography, Canva, Retail merchandising',
    certs: [{ name: 'First Aid Certificate', file_url: null }] },
  { email: 'guest5@test.com',  full_name: 'Ryan Teo',      phone_number: '+65 8200 2005', date_of_birth: '2002-03-28',
    skills: 'PC hardware, Networking basics, Troubleshooting',
    certs: [{ name: 'CompTIA A+', file_url: 'https://example.com/demo-certs/comptia-a-plus.pdf' }] },
  { email: 'guest6@test.com',  full_name: 'Sofia Chen',    phone_number: '+65 8200 2006', date_of_birth: '2000-07-19',
    skills: 'Live chat support, Zendesk, Clear written English',
    certs: [] },
  { email: 'guest7@test.com',  full_name: 'Harith Rahman', phone_number: '+65 8200 2007', date_of_birth: '2003-02-11',
    skills: 'Barista, Latte art, Cash register',
    certs: [{ name: 'Food Hygiene Certificate', file_url: 'https://example.com/demo-certs/food-hygiene.pdf' }] },
  { email: 'guest8@test.com',  full_name: 'Chen Jia Yi',   phone_number: '+65 8200 2008', date_of_birth: '2005-06-30',
    skills: 'Retail cashiering, Stocktaking',
    certs: [] },
  { email: 'guest9@test.com',  full_name: 'Dinesh Kumar',  phone_number: '+65 8200 2009', date_of_birth: '1996-10-08',
    skills: 'Structured cabling, Server racking, Network patching',
    certs: [{ name: 'CCNA', file_url: 'https://example.com/demo-certs/ccna.pdf' }, { name: 'Working at Heights', file_url: null }] },
  { email: 'guest10@test.com', full_name: 'Nurul Aisyah',  phone_number: '+65 8200 2010', date_of_birth: '2004-04-17',
    skills: 'Flyer distribution, Crowd engagement, Bilingual (EN/MY)',
    certs: [] },
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

// 过去 28 天：Owner Report 的 "vs Previous Period" 需要当期 + 上一段等长区间都有数据
//（默认视图是 7 天，用户也常选 13~14 天，上期最远到 26~28 天前）。
const SHIFT_DAYS_PAST = 28
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
    'recruitment_cancellations',
    'job_postings',
    'job_templates',
    'employee_off_day_requests',
    'off_day_quota_settings',
    'employee_fixed_off_days',
    'user_certificates',
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
  // Playwright 集成测试的一次性账号统一用 test-<label>-<ts>@tasking-tests.local
  //（见 tests/helpers/seed.ts）——测试中途失败时 afterAll 清理不到，会在 auth 里越积
  // 越多。每次重建种子数据时顺手全部清掉，保证 Auth 面板里只剩真实演示账号。
  let garbageCount = 0
  for (const u of allAuthUsers) {
    const isSeedAccount = testEmails.has(u.email)
    const isTestGarbage = (u.email || '').endsWith('@tasking-tests.local')
    if (isSeedAccount || isTestGarbage) {
      await supabase.auth.admin.deleteUser(u.id)
      if (isTestGarbage) garbageCount++
      else console.log(`  ✓ 删除 auth: ${u.email}`)
    }
  }
  if (garbageCount > 0) console.log(`  ✓ 清理 Playwright 遗留测试账号 ${garbageCount} 个（@tasking-tests.local）`)

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
        hourly_rate: account.hourly_rate ?? null,
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
        skills: cw.skills ?? null,
        resume_url: cw.resume_url ?? null,
      })
      .select()
      .single()
    if (uErr) { console.error(`  ✗ 插入 CW users 失败 ${cw.email}:`, uErr.message); process.exit(1) }
    userIdMap[cw.email].internalId = u.id
    for (const cert of cw.certs ?? []) {
      const { error: certErr } = await supabase.from('user_certificates').insert({
        user_id: u.id,
        name: cert.name,
        file_url: cert.file_url,
      })
      if (certErr) console.warn(`  ⚠ 插入 user_certificates 失败 (${cw.email} / ${cert.name}): ${certErr.message}`)
    }
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
        skills: guest.skills ?? null,
      })
      .select()
      .single()
    if (uErr) { console.error(`  ✗ 插入 Guest users 失败 ${guest.email}:`, uErr.message); process.exit(1) }
    userIdMap[guest.email].internalId = u.id
    for (const cert of guest.certs ?? []) {
      const { error: certErr } = await supabase.from('user_certificates').insert({
        user_id: u.id,
        name: cert.name,
        file_url: cert.file_url,
      })
      if (certErr) console.warn(`  ⚠ 插入 user_certificates 失败 (${guest.email} / ${cert.name}): ${certErr.message}`)
    }
    console.log(`  ✓ Guest: ${guest.full_name} → ${u.id}（${(guest.certs ?? []).length} 张证书）`)
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
  // 每天一个班，全部 published。日期锚点是脚本运行时的"今天"。
  // 注意：不跳过周末——真实业务规则（schedulingRuleService.ts）里"某天是否休息"看的是
  // 每个人自己的 employee_off_day_requests / 已批准请假，跟星期几无关；周末只是
  // fair_weekend_rotation 这条 soft rule 的参考对象（公平轮换谁上周末班），不是"周末不排班"。
  // 之前这里写死跳过周六周日只是图省事，会导致周末完全没人排班（进而导致依赖"某天有没有
  // 员工"的功能，例如 Post Job 向导的 Available Shift 选择器，在周末永远显示"没有员工"）。
  console.log('\nStep 10: 生成 Shifts + Shift Assignments...')
  const allStaffEmails = [...managerEmails, ...employeeEmails]
  // assignmentInfo: shiftAssignmentId -> { date, start_time, end_time, userEmail, isPast }
  const assignmentInfo = []

  // 28 天 × 16 人 ≈ 576 个班 —— 逐行 insert 太慢，改为整批收集后分块批量插入
  //（PostgREST 的 INSERT ... RETURNING 按输入顺序返回，meta 数组与返回 id 一一对应）。
  const CHUNK = 200
  async function chunkInsert(table, rows, withIds) {
    const ids = []
    for (let i = 0; i < rows.length; i += CHUNK) {
      const chunk = rows.slice(i, i + CHUNK)
      const query = supabase.from(table).insert(chunk)
      const { data, error } = withIds ? await query.select('id') : await query
      if (error) {
        console.warn(`  ⚠ 批量插入 ${table} 失败（第 ${i / CHUNK + 1} 块，${chunk.length} 行）: ${error.message}`)
        if (withIds) ids.push(...chunk.map(() => null))
      } else if (withIds) {
        ids.push(...data.map(r => r.id))
      }
    }
    return ids
  }

  // TODAY's attendance story — so the Owner Dashboard's Attendance Overview shows real variety
  // (checked-in / late / absent / not started) instead of everyone sitting in "Not Started".
  // Slot order per dept = [managerA, managerB, employeeA, employeeB] (staffEmails order below).
  // 'absent' works by giving that person an early shift today ('00:00'–'01:00' UTC-nominal =
  // 08:00–09:00 UTC+8 local) that has already ended with no clock-in — that is exactly
  // getAttendanceExceptions' "no clock-in by shift end" absent rule, and it keeps the person
  // OUT of the checked-in count (an invalid late clock-in would wrongly count as checked in).
  const TODAY_INTERNAL_OUTCOMES = [
    ['present', 'late', 'absent', 'not_started'],  // Operations
    ['present', 'present', 'late', 'not_started'], // Marketing
    ['late', 'present', 'absent', 'not_started'],  // Engineering
    ['present', 'late', 'present', 'absent'],      // Customer Support
  ]
  const TODAY_LATE_MINUTES = [12, 25, 18, 32] // per dept — Late cards show different minutes

  const shiftRows = []
  const shiftMeta = []
  for (let dayOffset = -SHIFT_DAYS_PAST; dayOffset <= SHIFT_DAYS_FUTURE; dayOffset++) {
    const shiftDate = addDays(TODAY, dayOffset)
    const shiftDateStr = dateKey(shiftDate)
    const isPast = dayOffset < 0
    const isToday = dayOffset === 0

    for (let deptIdx = 0; deptIdx < deptByIndex.length; deptIdx++) {
      const dept = deptByIndex[deptIdx]
      const staffEmails = [...managersByDept[deptIdx], ...employeesByDept[deptIdx]]
      for (let slotIdx = 0; slotIdx < staffEmails.length; slotIdx++) {
        const email = staffEmails[slotIdx]
        const isManager = managerEmails.includes(email)
        const todayOutcome = isToday ? TODAY_INTERNAL_OUTCOMES[deptIdx][slotIdx] : null
        let startTime = isManager ? '09:00' : '11:00'
        let endTime = isManager ? '17:00' : '18:00'
        if (todayOutcome === 'absent') { startTime = '00:00'; endTime = '01:00' }
        shiftRows.push({
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
        shiftMeta.push({ shiftDateStr, startTime, endTime, email, userId: userIdMap[email].internalId, deptIdx, isPast, isToday, todayOutcome })
      }
    }
  }
  const shiftIds = await chunkInsert('shifts', shiftRows, true)

  const assignmentRows = []
  const assignmentMeta = []
  for (let i = 0; i < shiftMeta.length; i++) {
    if (!shiftIds[i]) continue
    assignmentRows.push({ shift_id: shiftIds[i], user_id: shiftMeta[i].userId, assigned_by: ownerUser.id })
    assignmentMeta.push({ ...shiftMeta[i], shiftId: shiftIds[i] })
  }
  const assignmentIds = await chunkInsert('shift_assignments', assignmentRows, true)
  for (let i = 0; i < assignmentMeta.length; i++) {
    if (!assignmentIds[i]) continue
    const m = assignmentMeta[i]
    assignmentInfo.push({
      assignmentId: assignmentIds[i],
      shiftId: m.shiftId,
      shiftDate: m.shiftDateStr,
      startTime: m.startTime,
      endTime: m.endTime,
      email: m.email,
      userId: m.userId,
      deptIdx: m.deptIdx,
      isPast: m.isPast,
      isToday: m.isToday,
      todayOutcome: m.todayOutcome,
    })
  }
  console.log(`  ✓ 生成 ${assignmentInfo.length} 个 shift + assignment（过去 ${SHIFT_DAYS_PAST} 天 + 未来 ${SHIFT_DAYS_FUTURE} 天，含周末）`)

  // ── Step 11: Attendance Records（仅对过去的 shift）──────────────────────
  // 混合比例：65% 准时打卡完成已审批，10% 迟到（未审批), 10% 已经 Manager Review
  // 等待 Owner 终审，10% 被驳回，5% 缺勤（不生成记录）。Manager Review 这一档此前
  // 完全没有种子数据 —— managerReviewAttendance 是真实存在的功能（Manager 点 Review
  // 后 status 会变成 manager_reviewed，owner_status 仍是 pending），不生成会导致
  // Owner/Manager 页面永远看不到"已经被 Manager 看过、等 Owner 终审"这个真实状态。
  console.log('\nStep 11: 生成 Attendance Records（过去的 shift）...')
  const pastAssignments = assignmentInfo.filter(a => a.isPast)
  const attendanceRows = []
  for (let i = 0; i < pastAssignments.length; i++) {
    const a = pastAssignments[i]
    const bucket = i % 20 // deterministic distribution, no randomness needed for repeatable seeds
    if (bucket < 1) continue // ~5% absent — no attendance_records row at all

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

    attendanceRows.push({
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
  }
  // TODAY's internal records — mid-shift snapshots per TODAY_INTERNAL_OUTCOMES: 'present' and
  // 'late' get a clocked-in-not-yet-out record (status 'clocked_in', clock_out null — exactly
  // what casualAttendanceService.clockIn writes); 'absent' and 'not_started' get no record.
  for (const a of assignmentInfo.filter(x => x.isToday)) {
    if (a.todayOutcome !== 'present' && a.todayOutcome !== 'late') continue
    const clockInBase = new Date(`${a.shiftDate}T${a.startTime}:00Z`)
    const minutesAfterStart = a.todayOutcome === 'late' ? TODAY_LATE_MINUTES[a.deptIdx] : 3
    attendanceRows.push({
      shift_assignment_id: a.assignmentId,
      casual_worker_id: a.userId,
      confirmed_by_employee_id: a.userId,
      submitted_by_employee_id: a.userId,
      clock_in_time: new Date(clockInBase.getTime() + minutesAfterStart * 60000).toISOString(),
      clock_out_time: null,
      status: 'clocked_in',
      manager_notes: null,
      owner_status: 'pending',
      owner_reviewed_by: null,
      owner_reviewed_at: null,
    })
  }
  await chunkInsert('attendance_records', attendanceRows, false)
  const attendanceCount = attendanceRows.length
  console.log(`  ✓ 生成 ${attendanceCount} 条 attendance_records（混合 approved/pending/manager_reviewed/rejected/late，~5% 缺勤无记录；含今天的 clocked_in/late/absent/not-started 分布）`)

  // ── Step 11b: Casual Worker Shifts + Attendance Records ─────────────────
  // 每个 active CW 分配到一个部门，过去 7 天生成 shifts（混合 Shift Job / One-Off）
  // 每个 CW 由同部门的 Employee 负责 supervise。
  console.log('\nStep 11b: 生成 Casual Worker Shifts + Attendance Records...')
  const activeCWEmails = ['cw1@test.com','cw2@test.com','cw3@test.com','cw4@test.com','cw5@test.com','cw6@test.com','cw7@test.com']

  // Per-worker "story" — deliberately varied instead of one global random-ish bucket, so the
  // Owner Report's Casual Worker Pool blocks (Top Reliable / Needing Attention / Most Requested /
  // Task Quality) each have a real, differentiated cast instead of everyone landing in the same
  // bucket. workDays = which weekdays (0=Sun..6=Sat) this worker is even scheduled on — any 7
  // consecutive calendar days contain each weekday exactly once, so this alone spreads
  // assigned_shifts across a real range (3–7) regardless of which week the report is viewed for.
  // outcome(dayOfWeek) decides the attendance result for a day this worker IS scheduled; applied
  // uniformly across the whole shift history (not just the report's default window) so the trait
  // reads as consistent, not a one-week fluke, and the previous-period comparison isn't skewed.
  const CW_STORY = {
    'cw1@test.com': { // Alicia Tan — the star: full availability, always on time.
      workDays: new Set([0, 1, 2, 3, 4, 5, 6]),
      outcome: () => 'present',
    },
    'cw2@test.com': { // Nadia Wong — no-show pattern: skips Sundays, ghosts Tue + Fri.
      workDays: new Set([1, 2, 3, 4, 5, 6]),
      outcome: dow => (dow === 2 || dow === 5 ? 'absent' : 'present'),
    },
    'cw3@test.com': { // Hui Min Lee — shows up but chronically late (Mon/Wed/Fri), skips Saturdays.
      workDays: new Set([0, 1, 2, 3, 4, 5]),
      outcome: dow => (dow === 1 || dow === 3 || dow === 5 ? 'late' : 'present'),
    },
    'cw4@test.com': { // Farah Hassan — limited availability (Mon/Wed/Fri only) but clean when she's in;
      // her one blemish is a cancelled confirmed job, seeded separately in Step 15d.
      workDays: new Set([1, 3, 5]),
      outcome: () => 'present',
    },
    'cw5@test.com': { // Ethan Ong — full availability like Alicia (most requested), but late every Thursday
      // — demonstrates "most requested" and "most reliable" are NOT the same ranking.
      workDays: new Set([0, 1, 2, 3, 4, 5, 6]),
      outcome: dow => (dow === 4 ? 'late' : 'present'),
    },
    'cw6@test.com': { // Daniel Goh — perfect attendance (Mon-Fri); his story is task QUALITY, not
      // punctuality — see the Task Quality seed in Step 13c.
      workDays: new Set([1, 2, 3, 4, 5]),
      outcome: () => 'present',
    },
    'cw7@test.com': { // Siti Nur — narrower availability (Tue-Fri) but clean attendance AND clean task
      // quality — the "quality star" contrast to Alicia's "attendance star".
      workDays: new Set([2, 3, 4, 5]),
      outcome: () => 'present',
    },
  }
  // TODAY's CW attendance story (only applies to workers whose workDays include today) — same
  // idea as TODAY_INTERNAL_OUTCOMES: the dashboard's Casual Worker half should show variety too.
  // cw2 absent-today reinforces her no-show persona; cw6/cw4 not-started keeps their clean record.
  const CW_TODAY_OUTCOME = {
    'cw1@test.com': 'present',
    'cw2@test.com': 'absent',
    'cw3@test.com': 'present',
    'cw4@test.com': 'not_started',
    'cw5@test.com': 'late',
    'cw6@test.com': 'not_started',
    'cw7@test.com': 'present',
  }
  // 每 dept 分配约 1-2 个 CW
  const cwByDept = [
    ['cw1@test.com', 'cw2@test.com'], // dept[0]
    ['cw3@test.com', 'cw4@test.com'], // dept[1]
    ['cw5@test.com', 'cw6@test.com'], // dept[2]
    ['cw7@test.com'],                  // dept[3]
  ]
  const cwAssignmentInfo = []
  let cwShiftCount = 0
  const cwShiftRows = []
  const cwShiftMeta = []

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

      const story = CW_STORY[cwEmail]
      for (let dayOffset = -SHIFT_DAYS_PAST; dayOffset <= 0; dayOffset++) {
        const shiftDate = addDays(TODAY, dayOffset)
        if (!story.workDays.has(shiftDate.getDay())) continue // not scheduled this weekday
        const shiftDateStr = dateKey(shiftDate)
        const isPast = dayOffset < 0
        const isToday = dayOffset === 0
        const todayOutcome = isToday ? CW_TODAY_OUTCOME[cwEmail] : null

        // CW shift times vary by dept slot; absent-today = early shift already over, no clock-in
        // (same trick as the internal side — see TODAY_INTERNAL_OUTCOMES above).
        let startTime = cwIdx % 2 === 0 ? '09:00' : '13:00'
        let endTime   = cwIdx % 2 === 0 ? '17:00' : '21:00'
        if (todayOutcome === 'absent') { startTime = '00:00'; endTime = '01:00' }

        cwShiftRows.push({
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
        cwShiftMeta.push({ shiftDateStr, startTime, endTime, email: cwEmail, userId: cwId, supervisorId, deptIdx, isPast, isToday, todayOutcome, dayOfWeek: shiftDate.getDay() })
      }
    }
  }
  const cwShiftIds = await chunkInsert('shifts', cwShiftRows, true)
  const cwAssignmentRows = []
  const cwAssignmentMeta = []
  for (let i = 0; i < cwShiftMeta.length; i++) {
    if (!cwShiftIds[i]) continue
    cwAssignmentRows.push({
      shift_id: cwShiftIds[i],
      user_id: cwShiftMeta[i].userId,
      assigned_by: ownerUser.id,
      supervisor_employee_id: cwShiftMeta[i].supervisorId,
    })
    cwAssignmentMeta.push({ ...cwShiftMeta[i], shiftId: cwShiftIds[i] })
  }
  const cwAssignmentIds = await chunkInsert('shift_assignments', cwAssignmentRows, true)
  for (let i = 0; i < cwAssignmentMeta.length; i++) {
    if (!cwAssignmentIds[i]) continue
    const m = cwAssignmentMeta[i]
    cwShiftCount++
    cwAssignmentInfo.push({
      assignmentId: cwAssignmentIds[i],
      shiftId: m.shiftId,
      shiftDate: m.shiftDateStr,
      startTime: m.startTime,
      endTime: m.endTime,
      email: m.email,
      userId: m.userId,
      supervisorId: m.supervisorId,
      deptIdx: m.deptIdx,
      isPast: m.isPast,
      isToday: m.isToday,
      todayOutcome: m.todayOutcome,
      dayOfWeek: m.dayOfWeek,
    })
  }
  console.log(`  ✓ 生成 ${cwShiftCount} 个 CW shift + assignment`)

  // Attendance records for CW past shifts
  const cwPastAssignments = cwAssignmentInfo.filter(a => a.isPast)
  const cwAttendanceRows = []
  const cwWorkedDeptPairs = new Map() // casual_worker_id -> Set<department_id>（有完整打卡的组合）
  let cwReviewCounter = 0 // drives status/ownerStatus variety only — independent of the attendance
  // outcome below, since classifyAttendance() (reportService.ts) never looks at status/owner_status;
  // those fields only feed the Attendance module's own approval-chain UI.
  for (let i = 0; i < cwPastAssignments.length; i++) {
    const a = cwPastAssignments[i]
    const outcome = CW_STORY[a.email].outcome(a.dayOfWeek) // 'present' | 'late' | 'absent' — per this worker's story
    if (outcome === 'absent') continue // no attendance_records row at all — matches classifyAttendance's "no clock-in" rule

    const clockInBase  = new Date(`${a.shiftDate}T${a.startTime}:00Z`)
    const clockOutBase = new Date(`${a.shiftDate}T${a.endTime}:00Z`)
    const isLate = outcome === 'late'
    const clockInTime  = new Date(clockInBase.getTime()  + (isLate ? 18 : 3) * 60000)
    const clockOutTime = new Date(clockOutBase.getTime() + 2 * 60000)

    // status/ownerStatus buckets: 0-1=submitted(pending, untouched), 2=manager_reviewed(pending,
    // manager already looked at it), 3-4=owner_rejected, 5-8=owner_approved.
    const reviewBucket = cwReviewCounter++ % 9
    let status, ownerStatus
    if (reviewBucket < 2) { status = 'submitted'; ownerStatus = 'pending' }
    else if (reviewBucket < 3) { status = 'manager_reviewed'; ownerStatus = 'pending' }
    else if (reviewBucket < 5) { status = 'owner_rejected'; ownerStatus = 'rejected' }
    else { status = 'owner_approved'; ownerStatus = 'approved' }
    const managerNotes = status === 'manager_reviewed' ? 'Checked with the shift supervisor — hours look correct.' : null

    // confirmed_by/submitted_by are always the Casual Worker's own id — casualAttendanceService's
    // clockIn/clockOut both self-attest (there is no separate "supervising Employee confirms"
    // action in the app today); supervisor_employee_id on the shift_assignment above already
    // captures the real "Employee supervises this CW" relationship for display purposes.
    cwAttendanceRows.push({
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
    const deptSet = cwWorkedDeptPairs.get(a.userId) ?? new Set()
    deptSet.add(deptByIndex[a.deptIdx].id)
    cwWorkedDeptPairs.set(a.userId, deptSet)
  }
  // TODAY's CW records — mid-shift snapshots per CW_TODAY_OUTCOME (mirrors the internal side).
  for (const a of cwAssignmentInfo.filter(x => x.isToday)) {
    if (a.todayOutcome !== 'present' && a.todayOutcome !== 'late') continue
    const clockInBase = new Date(`${a.shiftDate}T${a.startTime}:00Z`)
    cwAttendanceRows.push({
      shift_assignment_id: a.assignmentId,
      casual_worker_id: a.userId,
      confirmed_by_employee_id: a.userId,
      submitted_by_employee_id: a.userId,
      clock_in_time: new Date(clockInBase.getTime() + (a.todayOutcome === 'late' ? 18 : 3) * 60000).toISOString(),
      clock_out_time: null,
      status: 'clocked_in',
      manager_notes: null,
      owner_status: 'pending',
      owner_reviewed_by: null,
      owner_reviewed_at: null,
    })
  }
  await chunkInsert('attendance_records', cwAttendanceRows, false)
  const cwAttCount = cwAttendanceRows.length
  // Mirrors casualAttendanceService.clockOut's side effect: a completed clock-in + clock-out
  // is what promotes a CW into the company's verified worker pool (see casualworker_departments
  // migration 20260713234000). Raw-inserting attendance_records above bypasses that service, so
  // replicate it here — otherwise every seeded CW would sit outside the pool despite having
  // "worked" in the seed data.
  for (const [cwId, deptSet] of cwWorkedDeptPairs) {
    for (const deptId of deptSet) {
      const { error: verifyErr } = await supabase
        .from('casualworker_departments')
        .update({ verified_at: new Date().toISOString() })
        .eq('casual_worker_id', cwId)
        .eq('department_id', deptId)
        .is('verified_at', null)
      if (verifyErr) console.warn(`  ⚠ casualworker_departments verified_at 更新失败 (${cwId}): ${verifyErr.message}`)
    }
  }
  console.log(`  ✓ 生成 ${cwAttCount} 条 CW attendance_records（混合 approved/pending/manager_reviewed/rejected 审批状态；出勤本身按 CW_STORY 每人固定人设 —— cw1 全勤准时/cw2 常缺勤/cw3 常迟到/cw4 出勤干净但会取消工作/cw5 全勤但周四迟到/cw6+cw7 出勤干净）`)

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

  // ── Step 13c: 历史 Tasks（供 Owner Report 的 Department On-Time / Rework / Overdue 使用）──
  // 上面 Step 13b 的任务全部锚定在"今天"（Task Kanban / Delay Alert / Workload Suggestion 要
  // 用），Report 只看"过去"，两组数据故意分开、互不影响。每个部门 4 条：on_time / late /
  // overdue（仍未完成）/ rework（带 rejection_reason），task_date 撒在过去 3~20 天，避开周末。
  function pastWeekdayKey(daysAgo) {
    let d = addDays(TODAY, -daysAgo)
    while (isWeekend(d)) d = addDays(d, -1)
    return dateKey(d)
  }

  const historicalTaskDefs = [
    // Operations
    { dept: 0, assignee: 'manager1@test.com', title: 'Close July payroll batch', description: 'Reconcile hours and submit the July payroll batch for processing.', priority: 'High', daysAgo: 4, dueOffsetH: 10, outcome: 'on_time' },
    { dept: 0, assignee: 'manager2@test.com', title: 'Replace walk-in chiller thermostat', description: 'Coordinate with the technician to replace the faulty chiller thermostat.', priority: 'Urgent', daysAgo: 9, dueOffsetH: 6, outcome: 'late' },
    { dept: 0, assignee: 'manager1@test.com', title: 'Finalize August roster draft', description: 'Draft and circulate the August roster for department sign-off.', priority: 'Medium', daysAgo: 6, dueOffsetH: 8, outcome: 'overdue' },
    { dept: 0, assignee: 'manager2@test.com', title: 'Audit petty cash float', description: 'Count and reconcile the petty cash float against the log.', priority: 'Low', daysAgo: 12, dueOffsetH: 4, outcome: 'rework' },
    // Marketing
    { dept: 1, assignee: 'manager3@test.com', title: 'Publish June newsletter recap', description: 'Compile and send the June newsletter performance recap.', priority: 'Medium', daysAgo: 5, dueOffsetH: 12, outcome: 'on_time' },
    { dept: 1, assignee: 'manager4@test.com', title: 'Finalize influencer shortlist', description: 'Narrow the influencer outreach list down to five confirmed partners.', priority: 'High', daysAgo: 8, dueOffsetH: 6, outcome: 'late' },
    { dept: 1, assignee: 'manager3@test.com', title: 'Renew signage permit', description: 'Submit the renewal paperwork for the storefront signage permit.', priority: 'Low', daysAgo: 15, dueOffsetH: 24, outcome: 'overdue' },
    { dept: 1, assignee: 'manager4@test.com', title: 'Book photographer for July shoot', description: 'Confirm the photographer and location for the July product shoot.', priority: 'Medium', daysAgo: 3, dueOffsetH: 10, outcome: 'on_time' },
    // Engineering
    { dept: 2, assignee: 'manager5@test.com', title: 'Patch POS terminal firmware', description: 'Roll out the latest firmware patch to all POS terminals.', priority: 'Urgent', daysAgo: 7, dueOffsetH: 5, outcome: 'on_time' },
    { dept: 2, assignee: 'manager6@test.com', title: 'Migrate backup storage to new NAS', description: 'Move nightly backups over to the newly provisioned NAS.', priority: 'High', daysAgo: 10, dueOffsetH: 8, outcome: 'late' },
    { dept: 2, assignee: 'manager5@test.com', title: 'Retire legacy printer driver', description: 'Uninstall the legacy printer driver from all front-desk machines.', priority: 'Low', daysAgo: 20, dueOffsetH: 24, outcome: 'overdue' },
    { dept: 2, assignee: 'manager6@test.com', title: 'Re-test kiosk after OS update', description: 'Verify the clock-in kiosk works correctly after the OS patch.', priority: 'Medium', daysAgo: 6, dueOffsetH: 6, outcome: 'rework' },
    // Customer Support
    { dept: 3, assignee: 'manager7@test.com', title: 'Clear refund ticket backlog', description: 'Work through and close the outstanding refund ticket backlog.', priority: 'High', daysAgo: 4, dueOffsetH: 8, outcome: 'on_time' },
    { dept: 3, assignee: 'manager8@test.com', title: 'Retrain team on new macros', description: 'Walk the support team through the updated canned-reply macros.', priority: 'Medium', daysAgo: 11, dueOffsetH: 6, outcome: 'late' },
    { dept: 3, assignee: 'manager7@test.com', title: 'Audit call recording retention', description: 'Confirm call recordings older than 90 days are purged per policy.', priority: 'Low', daysAgo: 18, dueOffsetH: 24, outcome: 'overdue' },
    { dept: 3, assignee: 'manager8@test.com', title: 'Update support SLA doc', description: 'Revise the SLA response-time targets in the support handbook.', priority: 'Medium', daysAgo: 5, dueOffsetH: 10, outcome: 'on_time' },

    // ── 上期窗口（8~14 天前，默认 7 天视图的 Previous Period）—— 补几条准时完成的，
    // 否则这个窗口只剩 late/rework，上期 on-time 率恒为 0%，对比失真。
    { dept: 1, assignee: 'employee4@test.com', title: 'Schedule July social calendar', description: 'Queue the July posts across all social channels.', priority: 'Medium', daysAgo: 9, dueOffsetH: 10, outcome: 'on_time' },
    { dept: 3, assignee: 'employee8@test.com', title: 'Refresh help center screenshots', description: 'Re-capture outdated screenshots across the top help articles.', priority: 'Low', daysAgo: 11, dueOffsetH: 8, outcome: 'on_time' },
    { dept: 2, assignee: 'employee6@test.com', title: 'Verify UPS battery health', description: 'Run the quarterly UPS battery self-test and log results.', priority: 'Medium', daysAgo: 13, dueOffsetH: 6, outcome: 'on_time' },

    // ── 上上期窗口（14~26 天前）—— 更宽日期范围（如 13~14 天）的 Previous Period 基线：
    // on_time/late 混合的已完成任务，而不是空到只剩 0%。Manager/Employee 混排
    //（On-time Task Completion Rate 的口径就是这两个角色）。
    { dept: 0, assignee: 'manager1@test.com', title: 'Reconcile June supplier invoices', description: 'Match June supplier invoices against goods received notes.', priority: 'High', daysAgo: 16, dueOffsetH: 10, outcome: 'on_time' },
    { dept: 0, assignee: 'employee1@test.com', title: 'Relabel storage room shelving', description: 'Replace worn shelf labels across both storage rooms.', priority: 'Low', daysAgo: 22, dueOffsetH: 8, outcome: 'late' },
    { dept: 1, assignee: 'manager3@test.com', title: 'Wrap up spring campaign report', description: 'Compile the spring campaign performance report for leadership.', priority: 'Medium', daysAgo: 15, dueOffsetH: 12, outcome: 'on_time' },
    { dept: 1, assignee: 'employee3@test.com', title: 'Archive expired promo assets', description: 'Move expired promo banners and copy decks into the archive drive.', priority: 'Low', daysAgo: 21, dueOffsetH: 6, outcome: 'on_time' },
    { dept: 2, assignee: 'manager5@test.com', title: 'Rotate service account credentials', description: 'Rotate and re-store the shared service account credentials.', priority: 'Urgent', daysAgo: 17, dueOffsetH: 6, outcome: 'late' },
    { dept: 2, assignee: 'employee5@test.com', title: 'Image spare front-desk laptops', description: 'Re-image the two spare laptops with the standard build.', priority: 'Medium', daysAgo: 23, dueOffsetH: 10, outcome: 'on_time' },
    { dept: 3, assignee: 'manager7@test.com', title: 'Close May escalation review', description: 'Document outcomes for the May escalations and close the review.', priority: 'Medium', daysAgo: 16, dueOffsetH: 8, outcome: 'on_time' },
    { dept: 3, assignee: 'employee7@test.com', title: 'Purge stale saved replies', description: 'Delete outdated saved replies flagged in the QA sweep.', priority: 'Low', daysAgo: 24, dueOffsetH: 6, outcome: 'late' },
  ]

  let historicalTaskCount = 0
  for (const def of historicalTaskDefs) {
    const taskDateStr = pastWeekdayKey(def.daysAgo)
    const dueAtMs = new Date(`${taskDateStr}T00:00:00Z`).getTime() + def.dueOffsetH * 3600000
    let status, pct, isCompleted, completedAt, rejection, rejectedAt
    if (def.outcome === 'on_time') {
      status = 'Complete'; pct = 100; isCompleted = true
      completedAt = new Date(dueAtMs - 2 * 3600000).toISOString() // finished 2h before deadline
      rejection = null; rejectedAt = null
    } else if (def.outcome === 'late') {
      status = 'Complete'; pct = 100; isCompleted = true
      completedAt = new Date(dueAtMs + 5 * 3600000).toISOString() // finished 5h after deadline
      rejection = null; rejectedAt = null
    } else if (def.outcome === 'overdue') {
      status = 'In Progress'; pct = 60; isCompleted = false
      completedAt = null; rejection = null; rejectedAt = null
    } else {
      // rework — completed late, carrying a rejection_reason from an earlier review cycle
      status = 'Complete'; pct = 100; isCompleted = true
      completedAt = new Date(dueAtMs + 8 * 3600000).toISOString()
      rejection = 'Sent back once before this was approved — details were incomplete on the first pass.'
      rejectedAt = new Date(dueAtMs + 1 * 3600000).toISOString()
    }

    const id = await insertTask({
      company_id: company.id,
      department_id: deptByIndex[def.dept].id,
      title: def.title,
      description: def.description,
      assigned_user_id: mgrId(def.assignee),
      assigned_by: ownerUser.id,
      status,
      percentage_complete: pct,
      is_completed: isCompleted,
      completed_at: completedAt,
      priority: def.priority,
      due_at: new Date(dueAtMs).toISOString(),
      task_date: taskDateStr,
      created_at: new Date(dueAtMs - 48 * 3600000).toISOString(),
      rejection_reason: rejection,
      rejected_at: rejectedAt,
    })
    if (id) historicalTaskCount++
  }
  console.log(`  ✓ 生成 ${historicalTaskCount} 条历史 tasks（供 Report：on-time/late/overdue/rework 混合，跨 4 个部门 + Manager/Employee 混排，task_date 在过去 3~26 天，覆盖当期与上期窗口）`)

  // ── Casual Worker 历史任务（供 Owner Report 的 Task Quality block）──────────
  // historicalTaskDefs above only ever assigns Manager/Employee — the report's Casual tab had
  // ZERO deadline tasks to show (On-Time Task Completion Rate KPI = "No data", Task Quality block
  // empty). Two contrasting per-worker stories, due dates inside the report's default 7-day
  // window: Daniel Goh (cw6) — clean attendance but a real quality problem (2 of 3 tasks sent
  // back for rework); Siti Nur (cw7) — clean on every axis (0 returned), the "Clean" contrast.
  let cwTaskCount = 0
  function cwTaskDueAtMs(daysAgo, dueOffsetH) {
    const dateStr = dateKey(addDays(TODAY, -daysAgo))
    return new Date(`${dateStr}T00:00:00Z`).getTime() + dueOffsetH * 3600000
  }
  const cwTaskDefs = [
    // Daniel Goh (cw6, Engineering) — task QUALITY problem, not punctuality.
    { assignee: 'cw6@test.com', deptIdx: 2, title: 'Re-image front-desk kiosk', description: 'Wipe and re-image the front-desk clock-in kiosk with the standard build.',
      daysAgo: 6, dueOffsetH: 10, rejectedBeforeDueH: 3, completedAfterDueH: 5 }, // sent back, fixed LATE — misses the deadline
    { assignee: 'cw6@test.com', deptIdx: 2, title: 'Label patch panel ports', description: 'Label every port on the server-room patch panel to match the wiring diagram.',
      daysAgo: 4, dueOffsetH: 8, rejectedBeforeDueH: 20, completedBeforeDueH: 2 }, // sent back, but fixed with time to spare — still ON time
    { assignee: 'cw6@test.com', deptIdx: 2, title: 'Test spare barcode scanners', description: 'Charge and test-scan the spare handheld barcode scanners.',
      daysAgo: 2, dueOffsetH: 6, completedBeforeDueH: 2 }, // clean, on time, no rework
    // Siti Nur (cw7, Customer Support) — clean on every axis.
    { assignee: 'cw7@test.com', deptIdx: 3, title: 'Restock roadshow flyers', description: 'Restock the flyer racks at the mall roadshow booth before the weekend rush.',
      daysAgo: 5, dueOffsetH: 8, completedBeforeDueH: 2 },
    { assignee: 'cw7@test.com', deptIdx: 3, title: 'Log roadshow foot traffic', description: 'Tally hourly foot traffic at the booth and log it in the shared sheet.',
      daysAgo: 3, dueOffsetH: 6, completedBeforeDueH: 2 },
  ]
  for (const def of cwTaskDefs) {
    const dueAtMs = cwTaskDueAtMs(def.daysAgo, def.dueOffsetH)
    const completedAt = def.completedAfterDueH != null
      ? new Date(dueAtMs + def.completedAfterDueH * 3600000).toISOString()
      : new Date(dueAtMs - def.completedBeforeDueH * 3600000).toISOString()
    const rejectedAt = def.rejectedBeforeDueH != null ? new Date(dueAtMs - def.rejectedBeforeDueH * 3600000).toISOString() : null
    const id = await insertTask({
      company_id: company.id,
      department_id: deptByIndex[def.deptIdx].id,
      title: def.title,
      description: def.description,
      assigned_user_id: mgrId(def.assignee),
      assigned_by: mgrId(employeesByDept[def.deptIdx][0]), // the dept's supervising Employee (CLAUDE.md: Employee → Casual Worker only)
      status: 'Complete',
      percentage_complete: 100,
      is_completed: true,
      completed_at: completedAt,
      priority: 'Medium',
      due_at: new Date(dueAtMs).toISOString(),
      task_date: dateKey(addDays(TODAY, -def.daysAgo)),
      created_at: new Date(dueAtMs - 48 * 3600000).toISOString(),
      rejection_reason: rejectedAt ? 'Sent back once before this was approved — needed another pass.' : null,
      rejected_at: rejectedAt,
    })
    if (id) cwTaskCount++
  }
  console.log(`  ✓ 生成 ${cwTaskCount} 条 Casual Worker 历史 tasks（供 Report Task Quality：cw6 Daniel Goh 2/3 返工，cw7 Siti Nur 全部干净，due_at 落在默认 7 天窗口内）`)

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
  console.log('  Guest:    guest1~10@test.com（求职申请人，尚未受雇，带技能/证书档案）')
  console.log('            guest1@test.com = Applications 页演示账号：Ongoing 三个 block + History 全部终态各有一条')
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
  console.log(`  Shifts:      ${assignmentInfo.length} 个（Internal Staff，过去 ${SHIFT_DAYS_PAST} 天 + 未来 ${SHIFT_DAYS_FUTURE} 天，含周末）`)
  console.log(`  Attendance:  ${attendanceCount} 条（Internal Staff，混合 approved/pending/manager_reviewed/rejected/late，~5% 缺勤）`)
  console.log(`  CW Shifts:   ${cwShiftCount} 个（Casual Worker，过去 ${SHIFT_DAYS_PAST} 天，各人按 CW_STORY 每周固定工作日，含 Shift Job + One-Off）`)
  console.log(`  CW Attend.:  ${cwAttCount} 条（Casual Worker，出勤结果按 CW_STORY 每人固定人设，审批状态混合 approved/pending/manager_reviewed/rejected）`)
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

  // Overdue — the most recently CLOSED submission week (deadline already passed) keeps a few
  // still-pending requests, so the Owner Dashboard's "Schedule Next Week" card has real pending
  // data to show. Only uses requesters the w=1 historical week skips ((i+1)%3===0), so nobody
  // gets both a decided and a pending row for the same week.
  const closedWeekStart = addDays(activeWeekStart, -7)
  const overdueClosedWeekSeeders = allRequesters.flatMap((email, i) => {
    if ((i + 1) % 3 !== 0) return []
    const quota = requesterQuota.get(email)
    return pickWeekdaysForQuota(quota, i).map(weekday => ({
      email,
      weekStart: closedWeekStart,
      weekday,
      status: 'pending',
      source: 'submitted',
      submittedHoursAgo: 24 * 6 + i,
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

  const fixedOffSeeders = [...pendingFixedOffSeeders, ...overdueClosedWeekSeeders, ...historicalFixedOffSeeders]
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
  console.log(`  ok seeded ${fixedOffCount} employee_off_day_requests (${pendingFixedOffSeeders.length} pending for week ${activeWeekStartKey} + ${overdueClosedWeekSeeders.length} overdue pending for closed week ${dateKey(closedWeekStart)} + ${historicalFixedOffSeeders.length} historical across 4 past weeks)`)

  // ── Step 15: Job Postings（Recruitment 页面全部状态的数据）──────────────
  // 状态 → 页面位置：open = Active Jobs 标签，closed = Closed Jobs 标签，archived =
  // Job Sources 的 Archived 面板（archived_from_status 记录归档前是 open 还是 closed，
  // Unarchive 按它还原），pending_approval = Review（Manager 提交、Owner 审批），
  // draft = Drafts。每条职位都刻意做出差异：4 个部门轮开、Shift Job / One-Off 混排、
  // openings 全部 ≥ 2、requirements（minimum_age / experience / uniform）各不相同、
  // 每条都带 application deadline（expires_at，deadlineDays 相对今天，可为过去）。
  console.log('\nStep 15: 生成 Job Postings（open / closed / archived / pending / draft）...')
  // Must land on a weekday — Employee/Manager shifts are only generated on weekdays (Step 10
  // skips weekends), so a raw addDays(TODAY, 5) can land on a Saturday/Sunday and leave every
  // posting's shift_date pointing at a day with zero scheduled employees (breaks "Available
  // Shift" / "Supervisor" pickers when reopening these as drafts or templates in the wizard).
  const jobStartDateKey = weekdayKey(5)
  const jobPostingDefs = [
    // ── Active Jobs（status: open）— 4 个部门全覆盖，Shift 周期班 / Shift 单日班 /
    // One-Off 三种形态混排，requirements 每条都不同，deadline 全部在未来 ──
    {
      dept: 0, status: 'open', form: 'shift', is_recurring: true, title: 'Warehouse Assistant',
      description: 'Support day-to-day warehouse operations including stock handling, deliveries and put-away.',
      requirements: 'Able to lift up to 15kg. Prior warehouse experience a plus.',
      employment_type: 'casual', salary_amount: 15.5, assignedEmployeeIdx: 0, openings: 3, deadlineDays: 10,
      shift_days: ['Mon', 'Wed', 'Fri'],
      shift_start_time: '09:00', shift_end_time: '17:00', break_start_time: '12:00', break_end_time: '13:00',
      recurrence_interval: 1, recurrence_unit: 'week', createdBy: 'owner', createdDaysAgo: 6,
      experience_required: 'Not Required', minimum_age: 18, uniform_type: 'company', uniform_details: 'Hi-vis vest and safety boots (provided)',
    },
    {
      dept: 0, status: 'open', form: 'oneoff', title: 'Event Setup Crew',
      description: 'One-off crew needed to set up and tear down staging for a corporate gala dinner.',
      requirements: 'Comfortable with physical setup work. Punctual and reliable.',
      employment_type: 'casual', salary_amount: 130, urgency: 'high', estimated_hours: '5',
      job_start_time: '12:00', createdBy: 'owner', createdDaysAgo: 8, assignedEmployeeIdx: 1, openings: 4, deadlineDays: 4,
      experience_required: 'Preferred', minimum_age: 21, uniform_type: 'dress_code', uniform_details: 'Black tee, long pants, covered shoes',
    },
    {
      dept: 0, status: 'open', form: 'shift', is_recurring: false, title: 'Pop-Up Cafe Barista',
      description: 'Single-day barista cover for our pop-up cafe booth at the Marina Bay food fair.',
      requirements: 'Able to run an espresso machine solo during peak hour.',
      employment_type: 'casual', salary_amount: 14, assignedEmployeeIdx: 1, openings: 2, deadlineDays: 3,
      shift_start_time: '11:00', shift_end_time: '18:00', break_start_time: '14:30', break_end_time: '15:00',
      createdBy: 'owner', createdDaysAgo: 4,
      experience_required: 'Preferred', minimum_age: 16, uniform_type: 'company', uniform_details: 'Barista apron provided, wear your own black top',
    },
    {
      dept: 1, status: 'open', form: 'shift', is_recurring: true, title: 'Social Media Assistant',
      description: 'Help manage the weekly social media content calendar and community replies.',
      requirements: 'Familiar with Instagram and TikTok. Good written English.',
      employment_type: 'part-time', salary_amount: 16, assignedEmployeeIdx: 2, openings: 2, deadlineDays: 14,
      shift_days: ['Tue', 'Thu'],
      shift_start_time: '10:00', shift_end_time: '15:00', break_start_time: '12:30', break_end_time: '13:00',
      recurrence_interval: 1, recurrence_unit: 'week', createdBy: 'owner', createdDaysAgo: 7,
      experience_required: '1+ Year', minimum_age: null, uniform_type: 'none',
    },
    {
      dept: 1, status: 'open', form: 'oneoff', title: 'Roadshow Brand Ambassador',
      description: 'Engage shoppers, hand out samples and drive footfall at our weekend roadshow booth.',
      requirements: 'Energetic and comfortable approaching the public. Bilingual a plus.',
      employment_type: 'casual', salary_amount: 95, urgency: 'normal', estimated_hours: '6',
      job_start_time: '11:00', createdBy: 'owner', createdDaysAgo: 8, assignedEmployeeIdx: 3, openings: 5, deadlineDays: 6,
      experience_required: 'Not Required', minimum_age: 16, uniform_type: 'dress_code', uniform_details: 'Plain white top, dark jeans, sneakers',
    },
    {
      dept: 2, status: 'open', form: 'shift', is_recurring: true, title: 'Junior Support Technician',
      description: 'Provide first-line technical support and help maintain internal tooling.',
      requirements: 'Basic troubleshooting skills. Currently studying IT/CS is a plus.',
      employment_type: 'part-time', salary_amount: 18, assignedEmployeeIdx: 4, openings: 2, deadlineDays: 12,
      shift_days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
      shift_start_time: '13:00', shift_end_time: '21:00', break_start_time: '17:00', break_end_time: '17:30',
      recurrence_interval: 2, recurrence_unit: 'week', createdBy: 'owner', createdDaysAgo: 4,
      experience_required: '6+ Months', minimum_age: 18, uniform_type: 'none',
    },
    {
      dept: 2, status: 'open', form: 'oneoff', title: 'Server Room Cabling Helper',
      description: 'Assist the infra team to re-run structured cabling during a one-night server room refresh.',
      requirements: 'Comfortable on a ladder and working in tight spaces.',
      employment_type: 'casual', salary_amount: 140, urgency: 'urgent', estimated_hours: '4',
      job_start_time: '13:00', createdBy: 'owner', createdDaysAgo: 5, assignedEmployeeIdx: 5, openings: 2, deadlineDays: 2,
      experience_required: '2+ Years', minimum_age: 21, uniform_type: 'company', uniform_details: 'Anti-static lab coat (provided)',
    },
    {
      dept: 3, status: 'open', form: 'shift', is_recurring: true, title: 'Weekend Support Agent',
      description: 'Cover weekend customer support tickets and live chat.',
      requirements: 'Clear written communication. Weekend availability required.',
      employment_type: 'part-time', salary_amount: 15, assignedEmployeeIdx: 6, openings: 3, deadlineDays: 9,
      shift_days: ['Sat', 'Sun'],
      shift_start_time: '09:00', shift_end_time: '17:00', break_start_time: '12:00', break_end_time: '13:00',
      recurrence_interval: 1, recurrence_unit: 'week', createdBy: 'owner', createdDaysAgo: 7,
      experience_required: 'Preferred', minimum_age: 16, uniform_type: 'none',
    },

    // ── Dashboard Recruitment Overview 专用（status: open）——
    // deadlineToday = 申请截止日就是今天（Deadline Today 列表）；
    // startDays 1/2 = 明天/后天开工且 confirmed < openings（Starting Soon, Understaffed 列表）──
    {
      dept: 1, status: 'open', form: 'oneoff', title: 'Inventory Count Crew',
      description: 'Overnight stocktake crew for the quarterly inventory count at the main warehouse.',
      requirements: 'Detail-oriented; comfortable using a barcode scanner.',
      employment_type: 'casual', salary_amount: 120, urgency: 'high', estimated_hours: '6',
      job_start_time: '21:00', createdBy: 'owner', createdDaysAgo: 7, assignedEmployeeIdx: 2, openings: 3, deadlineToday: true, startDays: 4,
      experience_required: 'Not Required', minimum_age: 18, uniform_type: 'none',
    },
    {
      dept: 2, status: 'open', form: 'shift', is_recurring: false, title: 'Weekend Market Booth Helper',
      description: 'Help run our weekend market booth — set up, serve customers and pack down.',
      requirements: 'Friendly and comfortable handling cash.',
      employment_type: 'casual', salary_amount: 15, assignedEmployeeIdx: 6, openings: 3, deadlineDays: 1, startDays: 2,
      shift_start_time: '08:00', shift_end_time: '16:00', break_start_time: '12:00', break_end_time: '12:30',
      createdBy: 'owner', createdDaysAgo: 3,
      experience_required: 'Not Required', minimum_age: 16, uniform_type: 'dress_code', uniform_details: 'Plain white top, dark pants',
    },
    {
      dept: 3, status: 'open', form: 'oneoff', title: 'Delivery Surge Runner',
      description: 'Extra runner to cover tomorrow\'s delivery surge from the flash sale.',
      requirements: 'Own transport preferred. Familiar with the city center area.',
      employment_type: 'casual', salary_amount: 90, urgency: 'high', estimated_hours: '4',
      job_start_time: '10:00', createdBy: 'owner', createdDaysAgo: 2, assignedEmployeeIdx: 4, openings: 2, deadlineDays: 1, startDays: 1,
      experience_required: 'Not Required', minimum_age: 18, uniform_type: 'none',
    },

    // ── Closed Jobs（status: closed）— 同样多元：不同部门 / 形态 / requirements，
    // deadline 一半已过（到期后手动关闭）、一半未到（招满提前关闭）──
    {
      dept: 1, status: 'closed', form: 'oneoff', title: 'Promo Day Staff',
      description: 'Promo booth staff for a one-day retail activation.',
      requirements: 'Outgoing personality, comfortable engaging with the public.',
      employment_type: 'casual', salary_amount: 110, urgency: 'normal', estimated_hours: '6',
      job_start_time: '11:00', createdBy: 'owner', createdDaysAgo: 11, assignedEmployeeIdx: 3, openings: 2, deadlineDays: -1,
      experience_required: 'Not Required', minimum_age: 16, uniform_type: 'dress_code', uniform_details: 'Brand tee provided on-site, own dark bottoms',
    },
    {
      dept: 3, status: 'closed', form: 'oneoff', title: 'Call Center Backup',
      description: 'Backup phone support during a planned product launch surge.',
      requirements: 'Prior call center experience preferred.',
      employment_type: 'casual', salary_amount: 120, urgency: 'high', estimated_hours: '8',
      job_start_time: '12:30', createdBy: 'owner', createdDaysAgo: 9, assignedEmployeeIdx: 7, openings: 3, deadlineDays: 2,
      experience_required: '1+ Year', minimum_age: 18, uniform_type: 'none',
    },
    {
      dept: 0, status: 'closed', form: 'shift', is_recurring: true, title: 'Stocktake Crew',
      description: 'Weekly Saturday stocktake across both storage rooms — counting, tagging, reporting variances.',
      requirements: 'Detail-oriented, comfortable with barcode scanners.',
      employment_type: 'casual', salary_amount: 15, assignedEmployeeIdx: 0, openings: 2, deadlineDays: -2,
      shift_days: ['Sat'],
      shift_start_time: '09:00', shift_end_time: '17:00', break_start_time: '12:00', break_end_time: '12:45',
      recurrence_interval: 1, recurrence_unit: 'week', createdBy: 'owner', createdDaysAgo: 12,
      experience_required: 'Not Required', minimum_age: 18, uniform_type: 'company', uniform_details: 'Gloves and vest provided',
    },
    {
      dept: 2, status: 'closed', form: 'shift', is_recurring: false, title: 'On-Site AV Technician',
      description: 'Run the AV desk for a single-day client town hall — mics, projector, live stream.',
      requirements: 'Hands-on with mixers and projectors. Calm under pressure.',
      employment_type: 'casual', salary_amount: 19, assignedEmployeeIdx: 4, openings: 2, deadlineDays: 5,
      shift_start_time: '12:00', shift_end_time: '18:00', break_start_time: null, break_end_time: null,
      createdBy: 'owner', createdDaysAgo: 8,
      experience_required: '2+ Years', minimum_age: 21, uniform_type: 'dress_code', uniform_details: 'All-black smart casual',
    },

    // ── Report 趋势数据：Closed + 已招满/部分招满，created_at 一批落在最近 7 天、一批落在
    // 15~20 天前 —— Company Overview 的 Hiring Success Rate / Average Time to Fill 才能在默认
    // 7 天视图和更宽的日期范围里都有"当期 + 上期"可对比的数据 ──
    {
      dept: 0, status: 'closed', form: 'oneoff', title: 'Weekend Inventory Blitz',
      description: 'One-day full stock count across the main warehouse ahead of the annual audit.',
      requirements: 'Comfortable with barcode scanners and step ladders.',
      employment_type: 'casual', salary_amount: 105, urgency: 'normal', estimated_hours: '7',
      job_start_time: '09:00', createdBy: 'owner', createdDaysAgo: 6, assignedEmployeeIdx: 0, openings: 2, deadlineDays: -2,
      experience_required: 'Not Required', minimum_age: 18, uniform_type: 'company', uniform_details: 'Hi-vis vest provided',
    },
    {
      dept: 2, status: 'closed', form: 'oneoff', title: 'Office Wi-Fi Upgrade Helper',
      description: 'Assist the infra team to swap access points across two floors in one evening.',
      requirements: 'Comfortable on a ladder; cable management experience a plus.',
      employment_type: 'casual', salary_amount: 125, urgency: 'high', estimated_hours: '5',
      job_start_time: '18:00', createdBy: 'owner', createdDaysAgo: 4, assignedEmployeeIdx: 5, openings: 2, deadlineDays: -1,
      experience_required: '6+ Months', minimum_age: 18, uniform_type: 'none',
    },
    {
      dept: 1, status: 'closed', form: 'oneoff', title: 'Weekday Sampling Crew',
      description: 'Hand out product samples at the CBD lunch crowd pop-up across three weekdays.',
      requirements: 'Energetic, presentable, comfortable engaging office crowds.',
      employment_type: 'casual', salary_amount: 90, urgency: 'normal', estimated_hours: '4',
      job_start_time: '11:00', createdBy: 'owner', createdDaysAgo: 5, assignedEmployeeIdx: 2, openings: 3, deadlineDays: -1,
      experience_required: 'Not Required', minimum_age: 16, uniform_type: 'dress_code', uniform_details: 'Brand tee provided, own dark bottoms',
    },
    {
      dept: 0, status: 'closed', form: 'oneoff', title: 'Quarterly Stocktake Support',
      description: 'Support the quarterly stocktake weekend — counting, tagging and variance reporting.',
      requirements: 'Detail-oriented; prior stocktake exposure preferred.',
      employment_type: 'casual', salary_amount: 100, urgency: 'normal', estimated_hours: '8',
      job_start_time: '09:00', createdBy: 'owner', createdDaysAgo: 20, assignedEmployeeIdx: 1, openings: 2, deadlineDays: -15,
      experience_required: 'Preferred', minimum_age: 18, uniform_type: 'company', uniform_details: 'Gloves and vest provided',
    },
    {
      dept: 1, status: 'closed', form: 'oneoff', title: 'Mall Roadshow Crew',
      description: 'Man the weekend mall roadshow booth — demos, giveaways and lead capture.',
      requirements: 'Outgoing, reliable, weekend availability.',
      employment_type: 'casual', salary_amount: 95, urgency: 'normal', estimated_hours: '6',
      job_start_time: '11:00', createdBy: 'owner', createdDaysAgo: 17, assignedEmployeeIdx: 3, openings: 2, deadlineDays: -12,
      experience_required: 'Not Required', minimum_age: 16, uniform_type: 'dress_code', uniform_details: 'Campaign tee issued on-site',
    },
    {
      dept: 3, status: 'closed', form: 'oneoff', title: 'Launch Week Hotline Support',
      description: 'Extra hotline coverage during launch week to keep wait times down.',
      requirements: 'Clear phone manner; prior support experience preferred.',
      employment_type: 'casual', salary_amount: 115, urgency: 'high', estimated_hours: '8',
      job_start_time: '10:00', createdBy: 'owner', createdDaysAgo: 16, assignedEmployeeIdx: 7, openings: 3, deadlineDays: -11,
      experience_required: '1+ Year', minimum_age: 18, uniform_type: 'none',
    },

    // ── Archived（status: archived）— Job Sources 的 Archived 面板。archived_from_status
    // 记录归档前状态（open/closed），留一条 null 模拟"deadline 过期被系统自动归档"的旧数据 ──
    {
      dept: 3, status: 'archived', form: 'oneoff', title: 'Orientation Day Assistant',
      description: 'Guide new-joiner groups between orientation stations and manage the registration desk.',
      requirements: 'Friendly, organised, good with directions.',
      employment_type: 'casual', salary_amount: 85, urgency: 'normal', estimated_hours: '4',
      job_start_time: '13:00', createdBy: 'owner', createdDaysAgo: 14, assignedEmployeeIdx: 6, openings: 2, deadlineDays: -10,
      experience_required: 'Not Required', minimum_age: 16, uniform_type: 'none',
      archivedFrom: 'closed', archivedDaysAgo: 5,
    },
    {
      dept: 1, status: 'archived', form: 'shift', is_recurring: true, title: 'Festival Booth Crew',
      description: 'Man the festival merchandise booth on weekend evenings during the month-long fair.',
      requirements: 'Cash handling experience, comfortable with crowds.',
      employment_type: 'casual', salary_amount: 14.5, assignedEmployeeIdx: 2, openings: 4, deadlineDays: -3,
      shift_days: ['Fri', 'Sat'],
      shift_start_time: '16:00', shift_end_time: '22:00', break_start_time: '18:30', break_end_time: '19:00',
      recurrence_interval: 1, recurrence_unit: 'week', createdBy: 'owner', createdDaysAgo: 8,
      experience_required: 'Preferred', minimum_age: 18, uniform_type: 'company', uniform_details: 'Festival crew tee (provided)',
      archivedFrom: 'open', archivedDaysAgo: 2,
    },
    {
      dept: 0, status: 'archived', form: 'shift', is_recurring: false, title: 'Night Auditor Cover',
      description: 'Overnight front-desk audit cover for a single night — end-of-day reports and reconciliation.',
      requirements: 'Prior front office or audit exposure required.',
      employment_type: 'casual', salary_amount: 20, assignedEmployeeIdx: 1, openings: 2, deadlineDays: -1,
      shift_start_time: '22:00', shift_end_time: '06:00', break_start_time: '02:00', break_end_time: '02:30',
      createdBy: 'owner', createdDaysAgo: 5,
      experience_required: '1+ Year', minimum_age: 21, uniform_type: 'dress_code', uniform_details: 'Business casual, closed shoes',
      archivedFrom: null, archivedDaysAgo: 1, // deadline 过期后被系统自动归档的形态（archived_from_status 为空）
    },
    {
      dept: 2, status: 'archived', form: 'oneoff', title: 'Legacy System Data Entry',
      description: 'Migrate paper records into the new system during a one-off weekend data entry sprint.',
      requirements: 'Fast, accurate typing. Spreadsheet basics.',
      employment_type: 'casual', salary_amount: 100, urgency: 'normal', estimated_hours: '7',
      job_start_time: '11:00', createdBy: 'owner', createdDaysAgo: 18, assignedEmployeeIdx: 5, openings: 3, deadlineDays: -14,
      experience_required: 'Not Required', minimum_age: 18, uniform_type: 'none',
      archivedFrom: 'closed', archivedDaysAgo: 7,
    },

    // ── Review 数据（status: pending_approval，由 Manager 提交、Owner 审批）——
    // 同样保持多元：部门 / 形态 / requirements / deadline / openings 全部不同 ──
    {
      dept: 0, status: 'pending_approval', form: 'oneoff', title: 'Extra Warehouse Hand',
      description: 'Need extra pairs of hands for next week\'s stocktake.',
      requirements: 'Available for a full day, no experience required.',
      employment_type: 'casual', salary_amount: 100, urgency: 'normal', estimated_hours: '6',
      job_start_time: '11:00', createdBy: 'manager1@test.com', assignedEmployeeIdx: 1,
      openings: 2, deadlineDays: 5,
      experience_required: 'Not Required', minimum_age: 18, uniform_type: 'company', uniform_details: 'Gloves provided',
    },
    {
      dept: 1, status: 'pending_approval', form: 'shift', is_recurring: true, title: 'Weekend Promo Crew',
      description: 'Recurring weekend booth crew for the new campaign launch.',
      requirements: 'Friendly, presentable, weekend availability.',
      employment_type: 'casual', salary_amount: 17, assignedEmployeeIdx: 3,
      shift_days: ['Sat', 'Sun'],
      shift_start_time: '11:00', shift_end_time: '19:00', break_start_time: '15:00', break_end_time: '15:30',
      recurrence_interval: 1, recurrence_unit: 'week', createdBy: 'manager3@test.com',
      openings: 3, deadlineDays: 6,
      experience_required: 'Preferred', minimum_age: 16, uniform_type: 'dress_code', uniform_details: 'Campaign tee (issued), own jeans',
    },
    {
      dept: 2, status: 'pending_approval', form: 'oneoff', title: 'Bug Bash Volunteer',
      description: 'One-off testing session ahead of the next release.',
      requirements: 'Comfortable following a test script.',
      employment_type: 'casual', salary_amount: 90, urgency: 'urgent', estimated_hours: '3',
      job_start_time: '14:00', createdBy: 'manager5@test.com', assignedEmployeeIdx: 5,
      openings: 4, deadlineDays: 2,
      experience_required: '6+ Months', minimum_age: null, uniform_type: 'none',
    },
    {
      dept: 3, status: 'pending_approval', form: 'shift', is_recurring: true, title: 'Overflow Support Agent',
      description: 'Additional recurring evening shift to cover overflow support tickets.',
      requirements: 'Prior customer service experience preferred.',
      employment_type: 'part-time', salary_amount: 15.5, assignedEmployeeIdx: 7,
      shift_days: ['Mon', 'Wed'],
      shift_start_time: '17:00', shift_end_time: '21:00', break_start_time: null, break_end_time: null,
      recurrence_interval: 1, recurrence_unit: 'week', createdBy: 'manager7@test.com',
      openings: 2, deadlineDays: 8,
      experience_required: '1+ Year', minimum_age: 18, uniform_type: 'none',
    },
    {
      dept: 0, status: 'pending_approval', form: 'oneoff', title: 'Inventory Count Helper',
      description: 'Support the monthly inventory count across two storage rooms.',
      requirements: 'Detail-oriented, comfortable with spreadsheets.',
      employment_type: 'casual', salary_amount: 105, urgency: 'normal', estimated_hours: '5',
      job_start_time: '12:00', createdBy: 'manager2@test.com', assignedEmployeeIdx: 0,
      openings: 2, deadlineDays: 4,
      experience_required: 'Not Required', minimum_age: 21, uniform_type: 'dress_code', uniform_details: 'Covered shoes mandatory (warehouse floor)',
    },

    // ── Drafts（status: draft）— Post Job 表单存了一半的草稿，同样保持形态多元 ──
    {
      dept: 0, status: 'draft', form: 'shift', is_recurring: true, title: 'Night Shift Stocker',
      description: 'Restock shelves and prepare deliveries during the overnight window.',
      requirements: 'Able to work overnight hours. Physically fit.',
      employment_type: 'part-time', salary_amount: 17, openings: 2, deadlineDays: 11,
      shift_days: ['Tue', 'Thu', 'Sat'],
      shift_start_time: '22:00', shift_end_time: '06:00', break_start_time: '02:00', break_end_time: '02:30',
      recurrence_interval: 1, recurrence_unit: 'week', createdBy: 'owner',
      experience_required: 'Not Required', minimum_age: 18, uniform_type: 'company', uniform_details: 'Hi-vis vest (provided)',
    },
    {
      dept: 1, status: 'draft', form: 'oneoff', title: 'Product Photoshoot Assistant',
      description: 'Assist the photographer during a one-day product shoot — props, steaming, staging.',
      requirements: 'Detail-oriented, comfortable on set.',
      employment_type: 'casual', salary_amount: 95, urgency: 'normal', estimated_hours: '6',
      job_start_time: '12:00', createdBy: 'owner', openings: 2, deadlineDays: 7,
      experience_required: 'Preferred', minimum_age: 16, uniform_type: 'none',
    },
    {
      dept: 2, status: 'draft', form: 'shift', is_recurring: true, title: 'Weekend NOC Monitor',
      description: 'Monitor system dashboards over the weekend and escalate incidents.',
      requirements: 'Basic understanding of uptime monitoring tools.',
      employment_type: 'part-time', salary_amount: 19, openings: 3, deadlineDays: 13,
      shift_days: ['Sat', 'Sun'],
      shift_start_time: '08:00', shift_end_time: '16:00', break_start_time: '12:00', break_end_time: '12:30',
      recurrence_interval: 1, recurrence_unit: 'week', createdBy: 'owner',
      experience_required: '6+ Months', minimum_age: 18, uniform_type: 'none',
    },
    {
      // 故意残缺的草稿：只有标题和一半描述，模拟写到一半就点了 Save Draft
      dept: 3, status: 'draft', form: 'oneoff', title: 'Holiday Hotline Backup',
      description: 'Cover the customer hotline during the public holiday period.',
      requirements: null,
      employment_type: 'casual', salary_amount: null, urgency: 'normal', estimated_hours: null,
      job_start_time: null, createdBy: 'owner', openings: 2, deadlineDays: 9,
    },
    {
      dept: 1, status: 'draft', form: 'oneoff', title: 'Roadshow Flyer Distributor',
      description: 'Hand out flyers and direct footfall to the roadshow booth.',
      requirements: 'Energetic and comfortable approaching the public.',
      employment_type: 'casual', salary_amount: 80, urgency: 'high', estimated_hours: '4',
      job_start_time: '11:00', createdBy: 'owner', openings: 4, deadlineDays: 3,
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
    const isShift = def.form === 'shift'
    // deadlineToday → 今天 23:59（还没过期但 Dashboard 的 Deadline Today 会命中）
    const expiresAt = def.deadlineToday
      ? new Date(addDays(TODAY, 1).getTime() - 60000).toISOString()
      : def.deadlineDays != null ? addDays(TODAY, def.deadlineDays).toISOString() : null
    const isArchived = def.status === 'archived'

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
      form_type: def.form,
      is_recurring: isShift ? (def.is_recurring ?? false) : false,
      recurrence_interval: isShift ? (def.recurrence_interval ?? null) : null,
      recurrence_unit: isShift ? (def.recurrence_unit ?? null) : null,
      shift_days: isShift ? (def.shift_days ?? null) : null,
      salary_amount: def.salary_amount ?? null,
      salary_type: def.salary_amount == null ? null : (isShift ? 'per hour' : 'flat rate'),
      urgency: isShift ? null : (def.urgency ?? 'normal'),
      estimated_hours: isShift ? null : (def.estimated_hours ?? null),
      shift_date: def.startDays != null ? dateKey(addDays(TODAY, def.startDays)) : jobStartDateKey,
      shift_start_time: isShift ? (def.shift_start_time ?? null) : null,
      shift_end_time: isShift ? (def.shift_end_time ?? null) : null,
      break_start_time: isShift ? (def.break_start_time ?? null) : null,
      break_end_time: isShift ? (def.break_end_time ?? null) : null,
      job_start_time: isShift ? null : (def.job_start_time ?? null),
      assigned_employee_id: assignedEmployeeId,
      openings: def.openings ?? 2,
      expires_at: expiresAt,
      expiry_preset: expiresAt ? 'custom' : 'none',
      experience_required: def.experience_required ?? null,
      minimum_age: def.minimum_age ?? null,
      uniform_required: def.uniform_type === 'company' || def.uniform_type === 'dress_code',
      uniform_type: def.uniform_type ?? 'none',
      uniform_details: def.uniform_details ?? null,
      archived_at: isArchived ? addDays(TODAY, -(def.archivedDaysAgo ?? 1)).toISOString() : null,
      archived_from_status: isArchived ? (def.archivedFrom ?? null) : null,
      // open/closed/archived postings are backdated so Owner Report (which only looks at
      // the past) has real recruitment data to show; draft/pending_approval are excluded
      // from the report anyway, so they keep the default now() and need no backdating.
      created_at: def.createdDaysAgo != null ? addDays(TODAY, -def.createdDaysAgo).toISOString() : undefined,
    }).select('id').single()
    if (jpErr) console.warn(`  ⚠ 创建 job_posting 失败 (${def.title}): ${jpErr.message}`)
    else { jobPostingCount++; postingIdByTitle.set(def.title, jp.id); console.log(`  ✓ Job Posting: ${def.title} [${def.status}] (${dept.name})`) }
  }
  const countBy = s => jobPostingDefs.filter(d => d.status === s).length
  console.log(`  ✓ 生成 ${jobPostingCount} 条 job_postings（open ${countBy('open')} / closed ${countBy('closed')} / archived ${countBy('archived')} / pending_approval ${countBy('pending_approval')} / draft ${countBy('draft')}）`)

  // ── Step 15b: Job Applicants ─────────────────────────────────────────────
  // open / closed / archived 三种职位都有申请人（Recruitment 页面每种状态的右侧
  // Applicants 面板都要有内容）。状态覆盖完整的真实流转：
  //   pending                → 等 Owner 决定
  //   accepted + inv 'sent'      → Owner 已接受、等 worker 确认（awaiting confirmation）
  //   accepted + inv 'accepted'  → 双向确认，占用一个 opening（confirmed / openings）
  //   rejected / withdrawn / cancelled_by_employer / job_closed → 各种终态
  // 每条申请都带 apply 时刻的完整快照（age / relevant_experience / skills / certificates /
  // note），跟真实 applyJob 写入的字段一致，AI 分析字段留空让缓存流程自己算。
  console.log('\nStep 15b: 生成 Job Applicants...')
  // exp: 'none' | 'less_than_1' | '1_to_2' | 'more_than_2'（申请表单的四档相关经验）
  // inv: null | 'sent' | 'accepted'（accepted 状态的申请人对应的邀请及其确认进度）
  const applicantDefs = [
    // Active — Warehouse Assistant（3 个名额：1 confirmed + 1 awaiting + 2 pending + 1 rejected）
    { title: 'Warehouse Assistant', guest: 'guest1@test.com', status: 'accepted', inv: 'accepted', exp: 'more_than_2', daysAgo: 3,
      note: 'Held a forklift licence for four years and ran inbound receiving at my last warehouse job.' },
    { title: 'Warehouse Assistant', guest: 'guest3@test.com', status: 'accepted', inv: 'sent', exp: '1_to_2', daysAgo: 2,
      note: 'Used to load event trucks, so pallet work is familiar.' },
    { title: 'Warehouse Assistant', guest: 'guest7@test.com', status: 'pending', exp: 'less_than_1', daysAgo: 2, note: null },
    { title: 'Warehouse Assistant', guest: 'guest8@test.com', status: 'pending', exp: 'none', daysAgo: 1, noResume: true,
      note: 'No warehouse background yet but I stocktake weekly at my retail job.' },
    { title: 'Warehouse Assistant', guest: 'guest5@test.com', status: 'rejected', exp: 'none', daysAgo: 4, note: null },

    // Active — Event Setup Crew
    { title: 'Event Setup Crew', guest: 'guest3@test.com', status: 'accepted', inv: 'accepted', exp: 'more_than_2', daysAgo: 5,
      note: 'Rigged staging and sound for concerts — happy to lead the teardown too.' },
    { title: 'Event Setup Crew', guest: 'guest10@test.com', status: 'pending', exp: 'less_than_1', daysAgo: 1, note: null },
    { title: 'Event Setup Crew', guest: 'guest9@test.com', status: 'pending', exp: '1_to_2', daysAgo: 1,
      note: 'Comfortable with heavy lifting and working at height.' },
    { title: 'Event Setup Crew', guest: 'guest1@test.com', status: 'withdrawn', exp: 'none', daysAgo: 6, note: null },

    // Active — Pop-Up Cafe Barista
    { title: 'Pop-Up Cafe Barista', guest: 'guest7@test.com', status: 'accepted', inv: 'accepted', exp: '1_to_2', daysAgo: 2,
      note: 'Worked the espresso bar at a specialty cafe — can pour basic latte art.' },
    { title: 'Pop-Up Cafe Barista', guest: 'guest8@test.com', status: 'pending', exp: 'none', daysAgo: 1, note: null },
    { title: 'Pop-Up Cafe Barista', guest: 'guest4@test.com', status: 'pending', exp: 'less_than_1', daysAgo: 1, noResume: true, note: null },

    // Active — Social Media Assistant
    { title: 'Social Media Assistant', guest: 'guest2@test.com', status: 'accepted', inv: 'sent', exp: 'more_than_2', daysAgo: 4,
      note: 'Grew a food page to 20k followers; strong on Reels and community replies.' },
    { title: 'Social Media Assistant', guest: 'guest4@test.com', status: 'pending', exp: '1_to_2', daysAgo: 2,
      note: 'I shoot and edit my own product photos — portfolio in resume.' },
    { title: 'Social Media Assistant', guest: 'guest10@test.com', status: 'rejected', exp: 'none', daysAgo: 5, note: null },

    // Active — Roadshow Brand Ambassador（含一条被雇主移除的 cancelled_by_employer）
    { title: 'Roadshow Brand Ambassador', guest: 'guest10@test.com', status: 'accepted', inv: 'accepted', exp: '1_to_2', daysAgo: 3,
      note: 'Did flyer distribution for two mall roadshows, comfortable approaching strangers.' },
    { title: 'Roadshow Brand Ambassador', guest: 'guest8@test.com', status: 'pending', exp: 'less_than_1', daysAgo: 2, note: null },
    { title: 'Roadshow Brand Ambassador', guest: 'guest2@test.com', status: 'pending', exp: 'more_than_2', daysAgo: 1, note: null },
    { title: 'Roadshow Brand Ambassador', guest: 'guest6@test.com', status: 'cancelled_by_employer', exp: '1_to_2', daysAgo: 6, note: null },

    // Active — Junior Support Technician
    { title: 'Junior Support Technician', guest: 'guest5@test.com', status: 'pending', exp: '1_to_2', daysAgo: 1,
      note: 'Final-year IT student, built and troubleshoot my own PCs since secondary school.' },
    { title: 'Junior Support Technician', guest: 'guest9@test.com', status: 'pending', exp: 'more_than_2', daysAgo: 2, noResume: true, note: null },

    // Active — Server Room Cabling Helper
    { title: 'Server Room Cabling Helper', guest: 'guest9@test.com', status: 'accepted', inv: 'accepted', exp: 'more_than_2', daysAgo: 2,
      note: 'CCNA holder — patched and labelled full racks during two office relocations.' },
    { title: 'Server Room Cabling Helper', guest: 'guest5@test.com', status: 'rejected', exp: 'less_than_1', daysAgo: 3, note: null },

    // Active — Weekend Support Agent
    { title: 'Weekend Support Agent', guest: 'guest6@test.com', status: 'accepted', inv: 'sent', exp: 'more_than_2', daysAgo: 3,
      note: 'Handled Zendesk queues solo on weekends at my previous job.' },
    { title: 'Weekend Support Agent', guest: 'guest2@test.com', status: 'pending', exp: '1_to_2', daysAgo: 1, note: null },
    { title: 'Weekend Support Agent', guest: 'guest8@test.com', status: 'withdrawn', exp: 'none', daysAgo: 4, note: null },

    // Closed — Promo Day Staff（2/2 招满后关闭：pending 的被置为 job_closed）
    { title: 'Promo Day Staff', guest: 'guest10@test.com', status: 'accepted', inv: 'accepted', exp: '1_to_2', daysAgo: 8, note: null },
    { title: 'Promo Day Staff', guest: 'guest4@test.com', status: 'accepted', inv: 'accepted', exp: 'less_than_1', daysAgo: 9,
      note: 'Merchandising background — good at keeping a booth presentable all day.' },
    { title: 'Promo Day Staff', guest: 'guest8@test.com', status: 'job_closed', exp: 'none', daysAgo: 8, note: null },
    { title: 'Promo Day Staff', guest: 'guest2@test.com', status: 'rejected', exp: 'more_than_2', daysAgo: 9, note: null },

    // Closed — Call Center Backup
    { title: 'Call Center Backup', guest: 'guest6@test.com', status: 'accepted', inv: 'accepted', exp: 'more_than_2', daysAgo: 7, note: null },
    { title: 'Call Center Backup', guest: 'guest2@test.com', status: 'accepted', inv: 'accepted', exp: '1_to_2', daysAgo: 7, note: null },
    { title: 'Call Center Backup', guest: 'guest3@test.com', status: 'job_closed', exp: 'none', daysAgo: 6, note: null },
    { title: 'Call Center Backup', guest: 'guest10@test.com', status: 'job_closed', exp: 'less_than_1', daysAgo: 6, noResume: true, note: null },

    // Closed — Stocktake Crew
    { title: 'Stocktake Crew', guest: 'guest1@test.com', status: 'accepted', inv: 'accepted', exp: 'more_than_2', daysAgo: 10,
      note: 'Ran cycle counts with a scanner gun every weekend at my last warehouse.' },
    { title: 'Stocktake Crew', guest: 'guest3@test.com', status: 'job_closed', exp: 'none', daysAgo: 9, note: null },

    // Closed — On-Site AV Technician
    { title: 'On-Site AV Technician', guest: 'guest9@test.com', status: 'accepted', inv: 'accepted', exp: 'more_than_2', daysAgo: 6, note: null },
    { title: 'On-Site AV Technician', guest: 'guest5@test.com', status: 'job_closed', exp: 'less_than_1', daysAgo: 5, note: null },
    { title: 'On-Site AV Technician', guest: 'guest3@test.com', status: 'rejected', exp: '1_to_2', daysAgo: 6,
      note: 'Mostly stage sound experience, projector setup is new to me.' },

    // ── Report 趋势数据的 Closed 职位申请（当期窗口：招满 2 条、部分招满 1 条）──
    // Weekend Inventory Blitz（2/2 招满）
    { title: 'Weekend Inventory Blitz', guest: 'guest2@test.com', status: 'accepted', inv: 'accepted', exp: '1_to_2', daysAgo: 5, note: null },
    { title: 'Weekend Inventory Blitz', guest: 'guest6@test.com', status: 'accepted', inv: 'accepted', exp: 'more_than_2', daysAgo: 5,
      note: 'Ran the last two annual stocktakes at my previous warehouse job.' },
    { title: 'Weekend Inventory Blitz', guest: 'guest8@test.com', status: 'job_closed', exp: 'none', daysAgo: 4, note: null },
    // Office Wi-Fi Upgrade Helper（2/2 招满）
    { title: 'Office Wi-Fi Upgrade Helper', guest: 'guest9@test.com', status: 'accepted', inv: 'accepted', exp: 'more_than_2', daysAgo: 3, note: null },
    { title: 'Office Wi-Fi Upgrade Helper', guest: 'guest5@test.com', status: 'accepted', inv: 'accepted', exp: '1_to_2', daysAgo: 2,
      note: 'Patched two office floors during a relocation last year.' },
    // Weekday Sampling Crew（3 个名额只招到 2 个 → 部分招满）
    { title: 'Weekday Sampling Crew', guest: 'guest4@test.com', status: 'accepted', inv: 'accepted', exp: 'less_than_1', daysAgo: 4, note: null },
    { title: 'Weekday Sampling Crew', guest: 'guest10@test.com', status: 'accepted', inv: 'accepted', exp: '1_to_2', daysAgo: 3, note: null },

    // ── Report 趋势数据的 Closed 职位申请（上期窗口 15~20 天前：招满 2 条、部分招满 1 条）──
    // Quarterly Stocktake Support（2/2 招满）
    { title: 'Quarterly Stocktake Support', guest: 'guest1@test.com', status: 'accepted', inv: 'accepted', exp: 'more_than_2', daysAgo: 19, note: null },
    { title: 'Quarterly Stocktake Support', guest: 'guest3@test.com', status: 'accepted', inv: 'accepted', exp: '1_to_2', daysAgo: 18, note: null },
    { title: 'Quarterly Stocktake Support', guest: 'guest7@test.com', status: 'job_closed', exp: 'none', daysAgo: 18, note: null },
    // Mall Roadshow Crew（2/2 招满）
    { title: 'Mall Roadshow Crew', guest: 'guest7@test.com', status: 'accepted', inv: 'accepted', exp: '1_to_2', daysAgo: 15, note: null },
    { title: 'Mall Roadshow Crew', guest: 'guest2@test.com', status: 'accepted', inv: 'accepted', exp: 'less_than_1', daysAgo: 14, note: null },
    // Launch Week Hotline Support（3 个名额只招到 2 个 → 部分招满）
    { title: 'Launch Week Hotline Support', guest: 'guest6@test.com', status: 'accepted', inv: 'accepted', exp: 'more_than_2', daysAgo: 15, note: null },
    { title: 'Launch Week Hotline Support', guest: 'guest10@test.com', status: 'accepted', inv: 'accepted', exp: '1_to_2', daysAgo: 13, note: null },
    { title: 'Launch Week Hotline Support', guest: 'guest8@test.com', status: 'rejected', exp: 'none', daysAgo: 14, note: null },

    // Archived（原 closed）— Orientation Day Assistant
    { title: 'Orientation Day Assistant', guest: 'guest6@test.com', status: 'accepted', inv: 'accepted', exp: '1_to_2', daysAgo: 12, note: null },
    { title: 'Orientation Day Assistant', guest: 'guest8@test.com', status: 'job_closed', exp: 'none', daysAgo: 11, note: null },

    // Archived（原 open，归档时申请保持原状态）— Festival Booth Crew
    { title: 'Festival Booth Crew', guest: 'guest10@test.com', status: 'pending', exp: 'less_than_1', daysAgo: 4, note: null },
    { title: 'Festival Booth Crew', guest: 'guest4@test.com', status: 'accepted', inv: 'sent', exp: '1_to_2', daysAgo: 5, note: null },
    { title: 'Festival Booth Crew', guest: 'guest2@test.com', status: 'rejected', exp: 'none', daysAgo: 6, noResume: true, note: null },

    // Archived（deadline 过期自动归档）— Night Auditor Cover
    { title: 'Night Auditor Cover', guest: 'guest1@test.com', status: 'pending', exp: '1_to_2', daysAgo: 3, note: null },
    { title: 'Night Auditor Cover', guest: 'guest7@test.com', status: 'pending', exp: 'less_than_1', daysAgo: 2,
      note: 'Cafe closing-shift lead — used to cashing up and end-of-day reports.' },

    // Archived（原 closed）— Legacy System Data Entry
    { title: 'Legacy System Data Entry', guest: 'guest5@test.com', status: 'accepted', inv: 'accepted', exp: '1_to_2', daysAgo: 16, note: null },
    { title: 'Legacy System Data Entry', guest: 'guest9@test.com', status: 'job_closed', exp: 'more_than_2', daysAgo: 15, note: null },
    { title: 'Legacy System Data Entry', guest: 'guest8@test.com', status: 'job_closed', exp: 'none', daysAgo: 15, note: null },

    // ── guest1 = Guest 端演示账号：登录 guest1@test.com 能看到 Applications 页的全部状态 ──
    // Ongoing 三个 block（上面已有 Warehouse Assistant accepted+inv accepted → Confirmed）：
    { title: 'Pop-Up Cafe Barista', guest: 'guest1@test.com', status: 'pending', exp: '1_to_2', daysAgo: 1,
      note: 'Poured for a year at a neighbourhood cafe — happy to cover peak hours.' },        // → Pending Review
    { title: 'Junior Support Technician', guest: 'guest1@test.com', status: 'accepted', inv: 'sent', exp: '1_to_2', daysAgo: 2,
      note: 'Comfortable reimaging laptops and walking users through fixes over chat.' },      // → Accept / Reject Job Offer
    // History 只剩一种对外徽章：Not Selected（rejected / position_filled / job_closed 合并而来）——
    // 其余终态要么是用户自己的决定，要么系统已经发过邮件通知，一律不再显示。
    { title: 'Server Room Cabling Helper', guest: 'guest1@test.com', status: 'rejected', exp: 'less_than_1', daysAgo: 3, note: null },                       // → Not Selected（被拒）
    { title: 'Promo Day Staff', guest: 'guest1@test.com', status: 'accepted', inv: 'position_filled', exp: 'less_than_1', daysAgo: 8, note: null },          // → Not Selected（FCFS 输了）
    { title: 'Call Center Backup', guest: 'guest1@test.com', status: 'job_closed', exp: 'none', daysAgo: 6, note: null },                                    // → Not Selected（岗位先招满）
    // 隐藏用例（按设计 Guest 端一律不显示，用来验证过滤生效）：
    //   · Social Media Assistant    withdrawn + inv declined → 自己拒 offer
    //   · Weekend Support Agent     withdrawn + inv cancelled → 确认后自己取消班次
    //   · Event Setup Crew          withdrawn 无邀请 → pending 时自己撤回（上面已存在）
    //   · Night Auditor Cover       pending 但岗位 deadline 已过期归档（上面已存在）
    //   · On-Site AV Technician     inv expired → 收到 offer 但没在开工前确认（已发过邮件提醒）
    //   · Roadshow Brand Ambassador cancelled_by_employer → 确认后被雇主移除（已发过取消邮件）
    { title: 'Social Media Assistant', guest: 'guest1@test.com', status: 'withdrawn', inv: 'declined', exp: 'none', daysAgo: 4, note: null },
    { title: 'Weekend Support Agent', guest: 'guest1@test.com', status: 'withdrawn', inv: 'cancelled', exp: '1_to_2', daysAgo: 5, note: null },
    { title: 'On-Site AV Technician', guest: 'guest1@test.com', status: 'accepted', inv: 'expired', exp: '1_to_2', daysAgo: 6, note: null },
    { title: 'Roadshow Brand Ambassador', guest: 'guest1@test.com', status: 'cancelled_by_employer', inv: 'cancelled', exp: '1_to_2', daysAgo: 5, note: null },
  ]

  const INVITATION_MESSAGES = [
    'We would love to have you on this job — please confirm to lock in your spot.',
    'Your application stood out. Confirm the invitation and we will see you on site.',
    'You have been selected for this role. Please accept the invitation to finalise your slot.',
  ]
  // age at the moment the application was made, from the guest's date_of_birth
  function ageAt(dobStr, atDate) {
    const dob = new Date(dobStr)
    let age = atDate.getFullYear() - dob.getFullYear()
    const m = atDate.getMonth() - dob.getMonth()
    if (m < 0 || (m === 0 && atDate.getDate() < dob.getDate())) age--
    return age
  }
  let jobApplicantCount = 0
  let jobInvitationCount = 0
  for (let i = 0; i < applicantDefs.length; i++) {
    const def = applicantDefs[i]
    const jobId = postingIdByTitle.get(def.title)
    const guest = guestApplicants.find(g => g.email === def.guest)
    const guestId = userIdMap[def.guest]?.internalId
    if (!jobId || !guest || !guestId) { console.warn(`  ⚠ 跳过 applicant（找不到 job 或 guest）: ${def.title} / ${def.guest}`); continue }

    const appliedAt = new Date(Date.now() - def.daysAgo * 86400000 - (i % 7) * 3600000)
    // The applicant tracker renders a timeline (Applied → Offer received → Confirmed / Not
    // selected), so the demo data has to carry the same timestamps the real flow stamps.
    const sentAt = new Date(appliedAt.getTime() + 6 * 3600000)          // employer accepted → offer out
    const respondedAt = new Date(sentAt.getTime() + 5 * 3600000)        // worker answered the offer
    const decidedAt = new Date(appliedAt.getTime() + 8 * 3600000)       // employer/system closed the application
    // Only terminal application statuses get decided_at; 'pending'/'accepted' are still in flight.
    const APPLICATION_RESOLVED = ['rejected', 'withdrawn', 'cancelled_by_employer', 'job_closed']
    // Only a resolved offer gets responded_at; 'sent' is still awaiting the worker.
    const OFFER_RESOLVED = ['accepted', 'declined', 'expired', 'position_filled', 'cancelled']

    const { data: ja, error: jaErr } = await supabase.from('job_applicants').insert({
      job_id: jobId,
      user_id: guestId,
      resume_url: def.noResume ? null : `https://example.com/demo-resumes/${def.guest.split('@')[0]}-resume.pdf`,
      status: def.status,
      applied_at: appliedAt.toISOString(),
      decided_at: APPLICATION_RESOLVED.includes(def.status) ? decidedAt.toISOString() : null,
      relevant_experience: def.exp,
      additional_note: def.note ?? null,
      skills_snapshot: guest.skills ?? null,
      certificates_snapshot: (guest.certs ?? []).map(c => ({ name: c.name, file_url: c.file_url })),
      age_at_apply: ageAt(guest.date_of_birth, appliedAt),
    }).select('id').single()
    if (jaErr) { console.warn(`  ⚠ 创建 job_applicant 失败 (${def.title} / ${def.guest}): ${jaErr.message}`); continue }
    jobApplicantCount++

    // Mirrors recruitmentService.decideApplicant: accepting an applicant also sends a job
    // invitation. inv 'sent' = worker 还没确认（awaiting confirmation），inv 'accepted' =
    // 双向确认完成（占用一个 opening，卡片上的 confirmed/openings 计数就数这些）。
    if (def.inv) {
      const { error: jiErr } = await supabase.from('job_invitations').insert({
        job_id: jobId,
        applicant_id: ja.id,
        sent_by: ownerUser.id,
        message: INVITATION_MESSAGES[i % INVITATION_MESSAGES.length],
        status: def.inv,
        sent_at: sentAt.toISOString(),
        responded_at: OFFER_RESOLVED.includes(def.inv) ? respondedAt.toISOString() : null,
      })
      if (jiErr) console.warn(`  ⚠ 创建 job_invitation 失败 (${def.title} / ${def.guest}): ${jiErr.message}`)
      else jobInvitationCount++
    }
  }
  console.log(`  ✓ 生成 ${jobApplicantCount} 条 job_applicants + ${jobInvitationCount} 条 job_invitations（覆盖 open/closed/archived，含 pending/awaiting/confirmed/rejected/withdrawn/cancelled/job_closed 全部状态）`)

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

  // ── Step 15d: 一条 Casual Worker 取消已确认工作的记录 ─────────────────────
  // 供 Owner Report 的 Casual Worker Pool → Workers Needing Attention 演示"取消"这个独立
  // 风险维度：Farah Hassan (cw4) 在 CW_STORY 里出勤是干净的（Step 11b），但她另外把一个已
  // 确认的工作取消了——展示"出勤没问题 ≠ 没有风险信号"。cancelled_role='worker' 确保这条
  // 记录只会算在 worker 头上，不会被误记成雇主取消（reportRepository.getWorkerCancellationsInRange
  // 就是靠这个字段过滤的）。applicant_id 留空——这条记录不依赖 Step 15b 那套复杂的申请/邀约
  // 状态机，recruitmentCancellationService 本身在找不到 applicant 时也是这样处理的。
  console.log('\nStep 15d: 生成 Casual Worker 取消已确认工作记录...')
  const cancelledJobId = postingIdByTitle.get('Promo Day Staff')
  if (cancelledJobId) {
    const { error: cancelErr } = await supabase.from('recruitment_cancellations').insert({
      job_id: cancelledJobId,
      applicant_id: null,
      cancelled_by: userIdMap['cw4@test.com'].internalId,
      cancelled_role: 'worker',
      scope: 'worker',
      reason: 'Family emergency came up — had to back out.',
      created_at: addDays(TODAY, -3).toISOString(),
    })
    if (cancelErr) console.warn(`  ⚠ 创建 recruitment_cancellation 失败: ${cancelErr.message}`)
    else console.log('  ✓ Farah Hassan (cw4) 取消了 "Promo Day Staff" 的已确认工作')
  } else {
    console.warn('  ⚠ 找不到 "Promo Day Staff" job_posting，跳过 recruitment_cancellation 演示数据')
  }

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
