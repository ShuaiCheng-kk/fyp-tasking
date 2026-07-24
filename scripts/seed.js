/**
 * scripts/seed.js — Tasking 完整测试数据种子脚本
 *
 * 目标：Owner/Partner 的每个页面都要有完整内容可看，不留白——Dashboard 全部 Overview
 * 面板、Shift/Task/Attendance/Communication/Team/Recruitment/Report 每一个 Tab 都有
 * 真实数据，包括那些 Owner/Partner 光靠自己在 UI 里点不出来的状态（需要 Manager 提交、
 * 需要对方先同意、需要打卡历史才能显示）。
 *
 * 建立内容：
 *   1. 清空所有业务数据表 + 账号/公司/部门
 *   2. 删除 auth.users 里的旧测试账号（含 Playwright 遗留的 @tasking-tests.local 垃圾账号）
 *   3. 确保平台级 Admin 账号存在（madmin/uadmin，只建不删）
 *   4. 创建 auth 账号（密码统一 111111）+ public.users
 *   5. 创建 1 Company + 4 Department，并分配 Manager/Employee 到各部门（每部门 2 Manager + 2 Employee）
 *   6. 创建 5 个 Guest User 求职者账号（带 skills/resume/certificates）
 *   7. 创建 6 条 Job Posting：3 条 Open（覆盖 oneoff/shift 两种表单 + 全部徽章字段）/
 *      Pending Approval（Manager 提交，等 Owner/Partner 审批）/ Draft / Rejected（可测
 *      Edit & Resubmit）；3 条 Open 上的 Guest 申请覆盖 Pending / Offer Sent / Confirmed /
 *      Not Selected 四种 Guest Applications 页状态（ApplicationFlow 全分支）
 *   8. 创建 1 个 Casual Worker 账号
 *   9. 创建过去 2 天的排班 + 打卡记录（Present/Late/Absent 混合）、7 条未来班次（含 David Lim/
 *      Wendy Ho 的 Operations 换班用班次——特意不种 pending swap，留给 Manager 自己在 UI 上测 Submit）
 *   10. 创建 2 条 Shift Swap（Manager↔Manager 待 O/P 审批 + Employee↔Employee 验证隔离）
 *   11. 创建 4 条 Fixed Day Off（1 条已批准 + 3 条待批准，覆盖 safe/flagged+建议/flagged 无建议
 *       三种 AI Process 结果，另 1 条排班冲突供手动测试）
 *   12. 创建 2 条 Job Template + 2 条 Shift Template
 *   13. 创建 1 条 Archived Job Posting
 *   14. 给 Marcus Lee（Casual Worker）建一个「现在就能打卡」的开放工作 —— 时间以脚本
 *       运行时的真实当下为基准（往前 10 分钟起、往后 4 小时止），跑完 seed 立刻登录
 *       casual1@test.com 就能在 Dashboard 上点 Clock In
 *   15. 创建 12 条 Task（Owner→Manager / Partner→Manager / Manager→Employee，含 2 条
 *       子任务），覆盖 Overdue/Due Soon/Completed 三个 Dashboard 桶 + 全部 4 种状态
 *   16. 创建 3 条 Announcement（company-wide + 部门级）+ 4 条 Message（含未读）
 *
 * 测试账号结构：
 *   1 Owner   owner@test.com
 *   1 Partner partner1@test.com
 *   8 Manager manager1-4@test.com（每部门第 1 个）+ manager5-8@test.com（每部门第 2 个，同一部门顺序对应）
 *   8 Employee employee1-4@test.com（每部门第 1 个）+ employee5-8@test.com（每部门第 2 个，同一部门顺序对应）
 *   1 Casual Worker casual1@test.com（Marcus Lee，带一个可立即 Clock In 的开放班次）
 *   5 Guest   guest1-5@test.com（求职者，未受雇，不属于任何 company）
 *
 *   部门对应关系（i=0..3，department 与 manager{i+1}/manager{i+5}、employee{i+1}/employee{i+5} 一一对应）：
 *     Operations       → manager1 (David Lim) + manager5 (Wendy Ho)   / employee1 (Ben Seah) + employee5 (Grace Lim)
 *     Marketing        → manager2 (Rachel Koh) + manager6 (Kelvin Ang) / employee2 (Chloe Yeo) + employee6 (Hannah Lee)
 *     Engineering      → manager3 (Aaron Wong) + manager7 (Natalie Goh) / employee3 (Daniel Tay) + employee7 (Ivan Koh)
 *     Customer Support → manager4 (Fiona Chen) + manager8 (Samuel Ng)  / employee4 (Elaine Chua) + employee8 (Sophia Tan)
 *
 * 使用方法：
 *   node scripts/seed.js
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

// ─── 日期工具（Recruitment 的 deadline 全部基于"今天"动态推算，不写死绝对日期）──

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
// Monday of the week containing d (used for employee_off_day_requests.week_start).
function mondayOf(d) {
  const day = d.getDay()
  return addDays(d, day === 0 ? -6 : 1 - day)
}
// Next future date matching targetDow (0=Sun..6=Sat), always strictly after `from`.
function nextWeekday(from, targetDow) {
  const diff = (targetDow - from.getDay() + 7) % 7 || 7
  return addDays(from, diff)
}
const TODAY = new Date()
TODAY.setHours(0, 0, 0, 0)
const YESTERDAY = addDays(TODAY, -1)
const TWO_DAYS_AGO = addDays(TODAY, -2)
// Attendance (Module 5) seed dates — Shift Swap uses TODAY+3..+6, Off Day uses next Mon/Tue/Wed.
const NEXT_MON = nextWeekday(TODAY, 1)
const NEXT_TUE = addDays(NEXT_MON, 1)
const NEXT_WED = addDays(NEXT_MON, 2)
const TOMORROW = addDays(TODAY, 1)

// tasks.due_at is read back via LOCAL wall-clock getters (unlike shift times, which are
// UTC-nominal) — build it from a local Date + local setHours so the stored instant still reads
// back as the intended calendar day regardless of the machine's timezone.
function dueAtOn(dateObj, hour = 17) {
  const d = new Date(dateObj)
  d.setHours(hour, 0, 0, 0)
  return d.toISOString()
}
// UTC calendar-day key — for the Casual Worker open-shift below, whose start/end times are
// derived from the real "now" instant and compared against real now in UTC by the clock-in gate,
// so its shift_date must match that same UTC day, not the machine's local day.
function dueLaterToday(hoursFromNow = 2) {
  const now = new Date()
  const d = new Date(now)
  d.setHours(now.getHours() + hoursFromNow, 30, 0, 0)
  if (dateKey(d) !== dateKey(now)) d.setHours(23, 59, 0, 0)
  return d.toISOString()
}
function activeSubmissionWeekStart(today, deadlineWeekday = 0, deadlineTime = '08:00') {
  let candidate = mondayOf(today)
  for (;;) {
    const targetWeek = addDays(candidate, 7)
    const deadlineDate = addDays(candidate, (deadlineWeekday + 6) % 7)
    const [h, m] = deadlineTime.split(':').map(Number)
    deadlineDate.setHours(h, m, 0, 0)
    if (Date.now() <= deadlineDate.getTime()) return targetWeek
    candidate = targetWeek
  }
}
function dateKeyUTC(d) {
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}
function toHM(d) {
  return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`
}

// ─── Attendance (Module 5) 小工具：建 shift / assignment / attendance_record ──

async function createShift(fields) {
  const { data, error } = await supabase.from('shifts').insert(fields).select().single()
  if (error) { console.warn(`  ⚠ 创建 shift 失败 (${fields.title} / ${fields.shift_date}): ${error.message}`); return null }
  return data
}
async function assignShift(shiftId, userId, assignedBy, supervisorEmployeeId = null) {
  if (!shiftId) return null
  const { data, error } = await supabase
    .from('shift_assignments')
    .insert({ shift_id: shiftId, user_id: userId, assigned_by: assignedBy, supervisor_employee_id: supervisorEmployeeId })
    .select()
    .single()
  if (error) { console.warn(`  ⚠ 创建 shift_assignment 失败: ${error.message}`); return null }
  return data
}
// Mirrors taskRepository.createTask: keeps task_assignments in sync with the primary assignee
// so the app's own reads (which join through task_assignments, not just tasks.assigned_user_id)
// see these seeded tasks the same way it sees ones created through the UI.
async function createTask(fields) {
  const { data, error } = await supabase.from('tasks').insert(fields).select().single()
  if (error) { console.warn(`  ⚠ 创建 task 失败 (${fields.title}): ${error.message}`); return null }
  if (fields.assigned_user_id) {
    const { error: taErr } = await supabase.from('task_assignments').insert({
      task_id: data.id, user_id: fields.assigned_user_id, assigned_by: fields.assigned_by ?? null,
    })
    if (taErr) console.warn(`  ⚠ 创建 task_assignment 失败 (${fields.title}): ${taErr.message}`)
  }
  return data
}
// lateMinutes=0 → Present；传大于0 → Late；不调用这个函数 → Absent（不建记录）。
// breakStart/breakEnd（可选，"HH:MM" 24小时制）→ 填充 break_in_time/break_out_time。
async function clockRecord(assignment, userId, { dateStr, endStr = '17:00', lateMinutes = 0, breakStart = null, breakEnd = null }) {
  if (!assignment) return
  const clockIn = new Date(`${dateStr}T09:00:00.000Z`)
  clockIn.setUTCMinutes(clockIn.getUTCMinutes() + lateMinutes)
  const clockOut = new Date(`${dateStr}T${endStr}:00.000Z`)
  const { error } = await supabase.from('attendance_records').insert({
    shift_assignment_id: assignment.id,
    casual_worker_id: userId,
    clock_in_time: clockIn.toISOString(),
    clock_out_time: clockOut.toISOString(),
    break_in_time: breakStart ? new Date(`${dateStr}T${breakStart}:00.000Z`).toISOString() : null,
    break_out_time: breakEnd ? new Date(`${dateStr}T${breakEnd}:00.000Z`).toISOString() : null,
    confirmed_by_employee_id: userId,
    submitted_by_employee_id: userId,
    status: 'submitted',
  })
  if (error) console.warn(`  ⚠ 创建 attendance_record 失败: ${error.message}`)
}

// ─── 账号定义 ──────────────────────────────────────────────────────────────────

const DEMO_PHOTO_URL = 'https://api.dicebear.com/7.x/avataaars/svg?seed=tasking'

const accounts = [
  { email: 'owner@test.com',    full_name: 'Sarah Mitchell', role: 'Owner',    phone_number: '+65 9123 4567', date_of_birth: '1980-03-15' },
  { email: 'partner1@test.com', full_name: 'James Tan',      role: 'Partner',  phone_number: '+65 9234 5678', date_of_birth: '1982-07-22' },
  { email: 'manager1@test.com', full_name: 'David Lim',      role: 'Manager',  phone_number: '+65 9456 7890', date_of_birth: '1988-04-12', hourly_rate: 28.00 },
  { email: 'manager2@test.com', full_name: 'Rachel Koh',     role: 'Manager',  phone_number: '+65 9567 8901', date_of_birth: '1990-09-28', hourly_rate: 27.50 },
  { email: 'manager3@test.com', full_name: 'Aaron Wong',     role: 'Manager',  phone_number: '+65 9678 9012', date_of_birth: '1987-01-17', hourly_rate: 26.00 },
  { email: 'manager4@test.com', full_name: 'Fiona Chen',     role: 'Manager',  phone_number: '+65 9789 0123', date_of_birth: '1991-06-03', hourly_rate: 29.00 },
  // 2nd Manager per department (manager{i+5} pairs with manager{i+1} on the same department, see
  // the deptStaff/Step 7 assignment loop) — every department now has 2 Managers, so the Manager
  // Tasks/Shifts pages have a real peer-manager-in-the-same-department scenario to test against,
  // not just a single manager per department.
  { email: 'manager5@test.com', full_name: 'Wendy Ho',       role: 'Manager',  phone_number: '+65 9890 1234', date_of_birth: '1989-11-02', hourly_rate: 27.00 },
  { email: 'manager6@test.com', full_name: 'Kelvin Ang',     role: 'Manager',  phone_number: '+65 9901 2345', date_of_birth: '1986-05-19', hourly_rate: 28.50 },
  { email: 'manager7@test.com', full_name: 'Natalie Goh',    role: 'Manager',  phone_number: '+65 9012 3456', date_of_birth: '1992-02-25', hourly_rate: 27.00 },
  { email: 'manager8@test.com', full_name: 'Samuel Ng',      role: 'Manager',  phone_number: '+65 9123 4560', date_of_birth: '1985-12-08', hourly_rate: 26.50 },
  { email: 'employee1@test.com', full_name: 'Ben Seah',      role: 'Employee', phone_number: '+65 8123 4567', date_of_birth: '1995-02-18', hourly_rate: 19.00 },
  { email: 'employee2@test.com', full_name: 'Chloe Yeo',     role: 'Employee', phone_number: '+65 8234 5678', date_of_birth: '1997-10-05', hourly_rate: 18.50 },
  { email: 'employee3@test.com', full_name: 'Daniel Tay',    role: 'Employee', phone_number: '+65 8345 6789', date_of_birth: '1994-07-30', hourly_rate: 20.00 },
  { email: 'employee4@test.com', full_name: 'Elaine Chua',   role: 'Employee', phone_number: '+65 8456 7890', date_of_birth: '1996-04-11', hourly_rate: 19.50 },
  // 2nd Employee per department (employee{i+5} pairs with employee{i+1} on the same department,
  // same i as its manager{i+5} above) — every department now has 2 Employees, not just Operations,
  // which also means MIN_EMPLOYEES_PER_DAY=1 is satisfiable everywhere: a Fixed Day Off request no
  // longer has to be structurally flagged with no safe alternative just because a department only
  // has 1 Employee (see suggestFixedOffDayGroup/suggestFixedOffDayQueue in requestAISuggestService.ts).
  { email: 'employee5@test.com', full_name: 'Grace Lim',     role: 'Employee', phone_number: '+65 8567 8901', date_of_birth: '1998-08-14', hourly_rate: 18.00 },
  { email: 'employee6@test.com', full_name: 'Hannah Lee',    role: 'Employee', phone_number: '+65 8678 9012', date_of_birth: '1999-03-21', hourly_rate: 18.50 },
  { email: 'employee7@test.com', full_name: 'Ivan Koh',      role: 'Employee', phone_number: '+65 8789 0123', date_of_birth: '1996-08-09', hourly_rate: 19.00 },
  { email: 'employee8@test.com', full_name: 'Sophia Tan',    role: 'Employee', phone_number: '+65 8890 1234', date_of_birth: '1997-01-27', hourly_rate: 18.50 },
]

// Guest Users — public job-board applicants (role 'Guest User', not scoped to any company yet).
// skills/certs feed both the live worker profile (users.skills + user_certificates) and the
// per-application snapshot fields (skills_snapshot/certificates_snapshot) on job_applicants, so
// UC44/45/48 (Applicant List / Accept-Reject / AI Candidate Recommendation) have real content to
// show instead of empty applicant cards.
const guestApplicants = [
  { email: 'guest1@test.com', full_name: 'Wei Jie Lim',  phone_number: '+65 8200 2001', date_of_birth: '2000-01-15',
    skills: 'Forklift operation, Inventory management, Heavy lifting', resume_url: 'https://example.com/demo-resumes/guest1-resume.pdf',
    certs: [{ name: 'Forklift Licence', file_url: 'https://example.com/demo-certs/forklift-licence.pdf' }] },
  { email: 'guest2@test.com', full_name: 'Priyanka Das',  phone_number: '+65 8200 2002', date_of_birth: '1999-05-22',
    skills: 'Customer service, Social media content, Copywriting', resume_url: 'https://example.com/demo-resumes/guest2-resume.pdf',
    certs: [{ name: 'Digital Marketing Certificate', file_url: 'https://example.com/demo-certs/digital-marketing.pdf' }] },
  { email: 'guest3@test.com', full_name: 'Kai Xuan Ong',  phone_number: '+65 8200 2003', date_of_birth: '2001-09-10',
    skills: 'Event setup, Sound equipment, Stage rigging', resume_url: 'https://example.com/demo-resumes/guest3-resume.pdf',
    certs: [] },
  { email: 'guest4@test.com', full_name: 'Amirah Yusof',  phone_number: '+65 8200 2004', date_of_birth: '1998-12-03',
    skills: 'Photography, Canva, Retail merchandising', resume_url: 'https://example.com/demo-resumes/guest4-resume.pdf',
    certs: [{ name: 'First Aid Certificate', file_url: null }] },
  { email: 'guest5@test.com', full_name: 'Ryan Teo',      phone_number: '+65 8200 2005', date_of_birth: '2002-03-28',
    skills: 'PC hardware, Networking basics, Troubleshooting', resume_url: 'https://example.com/demo-resumes/guest5-resume.pdf',
    certs: [{ name: 'CompTIA A+', file_url: 'https://example.com/demo-certs/comptia-a-plus.pdf' }] },
]

// Platform-level admin accounts (Module 9/10) — NOT scoped to any company. Protected from
// deletion by the protect_admin_accounts DB trigger, so created idempotently (skipped if
// already present) rather than deleted-then-recreated.
const platformAdmins = [
  { email: 'madmin@tasking.com', full_name: 'Marketing Admin', role: 'Marketing Admin' },
  { email: 'uadmin@tasking.com', full_name: 'User Admin',      role: 'User Admin' },
]

// 之前完整版种子建过的账号也要一并从 auth 清掉（cw1-10 / guest1-10 / partner2），否则会留下
// 孤儿 auth 账号。manager5-8/employee5-8 现在本来就在 accounts[] 里，不用再重复列一次。
const legacyTestEmailsToDelete = [
  ...accounts.map(a => a.email),
  ...guestApplicants.map(g => g.email),
  'casual1@test.com',
  'casual2@test.com',
  'partner2@test.com',
  ...Array.from({ length: 10 }, (_, i) => `cw${i + 1}@test.com`),
  ...Array.from({ length: 10 }, (_, i) => `guest${i + 1}@test.com`),
]

// ─── 主流程 ────────────────────────────────────────────────────────────────────

async function main() {
  console.log('═══════════════════════════════════════════')
  console.log('  Tasking Seed Script (minimal)')
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
  if (offDayDeadlineErr) console.warn(`  ⚠ 清空 off_day_submission_deadline 失败: ${offDayDeadlineErr.message}`)
  else console.log('  ✓ 清空 off_day_submission_deadline')
  // shift_swap_settings has no `id` column (PK is company_id) and its updated_by FK blocks the
  // users cleanup below if left in place — must be cleared before users.
  const { error: swSettingsErr } = await supabase.from('shift_swap_settings').delete().neq('company_id', '00000000-0000-0000-0000-000000000000')
  if (swSettingsErr) console.warn(`  ⚠ 清空 shift_swap_settings 失败: ${swSettingsErr.message}`)
  else console.log('  ✓ 清空 shift_swap_settings')
  const { error: swDeptSettingsErr } = await supabase.from('shift_swap_department_settings').delete().neq('company_id', '00000000-0000-0000-0000-000000000000')
  if (swDeptSettingsErr) console.warn(`  ⚠ 清空 shift_swap_department_settings 失败: ${swDeptSettingsErr.message}`)
  else console.log('  ✓ 清空 shift_swap_department_settings')
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
  // 最多返回 1000 条 —— 必须翻页取全量，否则会漏找 madmin/uadmin 而重复创建。
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

  // ── Step 3: 创建 auth 账号 ────────────────────────────────────────────────
  console.log('\nStep 3: 创建 auth 账号...')
  const userIdMap = {} // email → { authId, internalId }

  for (const account of accounts) {
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
    if (deptErr) { console.error(`  ✗ 创建 dept ${def.name} 失败:`, deptErr.message); process.exit(1) }
    depts.push(dept)
    console.log(`  ✓ Department: ${dept.name} (${dept.id})`)
  }

  // ── Step 6: 插入其余 public.users ────────────────────────────────────────
  console.log('\nStep 6: 插入 public.users...')
  for (const account of accounts) {
    if (account.email === 'owner@test.com') continue
    const authId = userIdMap[account.email].authId
    const { data: u, error: insUErr } = await supabase
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
    if (insUErr) { console.error(`  ✗ 插入 users 失败 ${account.email}:`, insUErr.message); process.exit(1) }
    userIdMap[account.email].internalId = u.id
    console.log(`  ✓ users: ${account.full_name} (${account.role})`)
  }

  // ── Step 7: 分配部门（每部门 2 Manager + 2 Employee）─────────────────────
  // manager{i+1}/employee{i+1} 是每部门第 1 个，manager{i+5}/employee{i+5} 是第 2 个
  // （见 accounts[] 里的注释和对应关系）。
  console.log('\nStep 7: 分配部门...')
  for (let i = 0; i < 4; i++) {
    const dept = depts[i]
    const managerEmails = [`manager${i + 1}@test.com`, `manager${i + 5}@test.com`]
    const employeeEmails = [`employee${i + 1}@test.com`, `employee${i + 5}@test.com`]

    for (const managerEmail of managerEmails) {
      const { error: mdErr } = await supabase.from('manager_departments').insert({
        manager_id: userIdMap[managerEmail].internalId,
        department_id: dept.id,
        company_id: company.id,
        assigned_by: ownerUser.id,
      })
      if (mdErr) console.warn(`  ⚠ manager_departments 失败: ${mdErr.message}`)
      else console.log(`  ✓ ${managerEmail} → ${dept.name}`)
    }

    for (const employeeEmail of employeeEmails) {
      const { error: edErr } = await supabase.from('employee_departments').insert({
        employee_id: userIdMap[employeeEmail].internalId,
        department_id: dept.id,
        company_id: company.id,
      })
      if (edErr) console.warn(`  ⚠ employee_departments 失败: ${edErr.message}`)
      else console.log(`  ✓ ${employeeEmail} → ${dept.name}`)
    }
  }

  // ── Step 8: Off Day clean baseline ───────────────────────────────────────
  // Minimal Off Day test baseline:
  // Keep only accounts, company, departments, and team relationships. Do not recreate shifts,
  // assignments, attendance records, swap requests, jobs, tasks, templates, messages, or any
  // existing off-day requests. This lets you test Manager Submit Off Day first, then generate
  // real shifts afterwards from a clean schedule.
  console.log('\nStep 8: Create Off Day clean baseline settings...')
  const quotaRows = [
    { company_id: company.id, user_id: null, role: 'Manager', max_days_per_week: 2, updated_by: ownerUser.id },
    { company_id: company.id, user_id: null, role: 'Employee', max_days_per_week: 2, updated_by: ownerUser.id },
  ]
  for (const row of quotaRows) {
    const { error } = await supabase.from('off_day_quota_settings').insert(row)
    if (error) console.warn(`  ⚠ Failed to create ${row.role} default off-day quota: ${error.message}`)
    else console.log(`  ✓ ${row.role} default off-day quota: ${row.max_days_per_week} days/week`)
  }
  const { error: deadlineSeedErr } = await supabase.from('off_day_submission_deadline').upsert({
    company_id: company.id,
    deadline_weekday: 0,
    deadline_time: '08:00',
    updated_by: ownerUser.id,
  }, { onConflict: 'company_id' })
  if (deadlineSeedErr) console.warn(`  ⚠ Failed to create off-day submission deadline: ${deadlineSeedErr.message}`)
  else console.log('  ✓ Off Day submission deadline: Sunday 08:00')
  const closedSubmissionWeek = addDays(activeSubmissionWeekStart(TODAY, 0, '08:00'), -7)
  const offDayReminderRows = [
    { user_id: userIdMap['employee1@test.com'].internalId, request_date: dateKey(addDays(closedSubmissionWeek, 1)) },
    { user_id: userIdMap['employee5@test.com'].internalId, request_date: dateKey(addDays(closedSubmissionWeek, 2)) },
  ]
  const { error: offDayReminderErr } = await supabase.from('employee_off_day_requests').insert(
    offDayReminderRows.map(row => ({
      user_id: row.user_id,
      company_id: company.id,
      request_date: row.request_date,
      week_start: dateKey(closedSubmissionWeek),
      status: 'pending',
      source: 'submitted',
    })),
  )
  if (offDayReminderErr) console.warn(`  ⚠ Failed to seed Manager off-day reminder rows: ${offDayReminderErr.message}`)
  else console.log('  ✓ Off Day submission reminder rows: 2 pending Operations requests')

  // Step 8b: compact Manager Swap Requests test pack.
  // The minimal seed intentionally stops before the old full demo data. For the Manager
  // Attendance -> Swap Requests tab, seed just enough future shifts and Employee<->Employee
  // swap requests for manager1/manager5 (Operations) to test pending/completed states.
  console.log('\nStep 8b: Create Manager Swap Requests test data...')
  const { error: deptSwapSettingsErr } = await supabase.from('shift_swap_department_settings').upsert(
    depts.map((dept, i) => ({
      company_id: company.id,
      department_id: dept.id,
      auto_approval_enabled: false,
      monthly_swap_limit: 3,
      deadline_hours_before_shift: 24,
      require_review_on_limit_exceeded: true,
      require_review_on_deadline_exceeded: true,
      updated_by: userIdMap[`manager${i + 1}@test.com`]?.internalId ?? ownerUser.id,
    })),
    { onConflict: 'company_id,department_id' },
  )
  if (deptSwapSettingsErr) console.warn(`  ⚠ Failed to create department shift-swap settings: ${deptSwapSettingsErr.message}`)
  else console.log('  ✓ Department Shift Swap Settings: 3/month, 24 hours before shift, manager review required')

  const minutesAgo = n => new Date(Date.now() - n * 60 * 1000).toISOString()
  async function createSwapAssignmentPair({ requesterEmail, counterpartEmail, department, requesterDayOffset, counterpartDayOffset, requesterTime = ['09:00', '13:00'], counterpartTime = ['13:30', '17:30'], title }) {
    const requesterShift = await createShift({
      company_id: company.id,
      department_id: department.id,
      shift_date: dateKey(addDays(TODAY, requesterDayOffset)),
      start_time: requesterTime[0],
      end_time: requesterTime[1],
      title,
      created_by: ownerUser.id,
      publication_status: 'published',
    })
    const counterpartShift = await createShift({
      company_id: company.id,
      department_id: department.id,
      shift_date: dateKey(addDays(TODAY, counterpartDayOffset)),
      start_time: counterpartTime[0],
      end_time: counterpartTime[1],
      title,
      created_by: ownerUser.id,
      publication_status: 'published',
    })
    const requesterAssignment = requesterShift && await assignShift(requesterShift.id, userIdMap[requesterEmail].internalId, ownerUser.id)
    const counterpartAssignment = counterpartShift && await assignShift(counterpartShift.id, userIdMap[counterpartEmail].internalId, ownerUser.id)
    return { requesterAssignment, counterpartAssignment }
  }
  async function createSeedSwap(def) {
    const { requesterAssignment, counterpartAssignment } = await createSwapAssignmentPair(def)
    if (!requesterAssignment || !counterpartAssignment) return false
    const row = {
      company_id: company.id,
      requester_id: userIdMap[def.requesterEmail].internalId,
      requester_assignment_id: requesterAssignment.id,
      counterpart_id: userIdMap[def.counterpartEmail].internalId,
      counterpart_assignment_id: counterpartAssignment.id,
      reason: def.reason,
      counterpart_status: def.counterpartStatus,
      counterpart_reviewed_at: def.counterpartReviewedAt ?? null,
      status: def.status,
      reviewed_by: def.reviewedBy ?? null,
      reviewed_at: def.reviewedAt ?? null,
      requires_owner_review: def.requiresReview ?? false,
      owner_review_reason: def.ownerReviewReason ?? null,
      created_at: def.createdAt,
    }
    const { error } = await supabase.from('shift_swap_requests').insert(row)
    if (error) {
      console.warn(`  ⚠ Failed to create seeded swap (${def.label}): ${error.message}`)
      return false
    }
    return true
  }
  const opsDept = depts[0]
  const manager1Id = userIdMap['manager1@test.com'].internalId
  const swapSeedDefs = [
    {
      label: 'pending-ben-grace-morning',
      requesterEmail: 'employee1@test.com',
      counterpartEmail: 'employee5@test.com',
      department: opsDept,
      requesterDayOffset: 3,
      counterpartDayOffset: 4,
      title: 'Operations Floor Shift',
      reason: 'Ben needs the afternoon free and Grace already agreed to swap.',
      status: 'pending',
      counterpartStatus: 'approved',
      counterpartReviewedAt: minutesAgo(48),
      requiresReview: true,
      createdAt: minutesAgo(60),
    },
    {
      label: 'pending-grace-ben-weekend',
      requesterEmail: 'employee5@test.com',
      counterpartEmail: 'employee1@test.com',
      department: opsDept,
      requesterDayOffset: 5,
      counterpartDayOffset: 6,
      title: 'Weekend Operations Cover',
      reason: 'Grace is covering a family appointment and Ben can take the weekend slot.',
      status: 'pending',
      counterpartStatus: 'approved',
      counterpartReviewedAt: minutesAgo(38),
      requiresReview: true,
      createdAt: minutesAgo(50),
    },
    {
      label: 'approved-ben-grace-evening',
      requesterEmail: 'employee1@test.com',
      counterpartEmail: 'employee5@test.com',
      department: opsDept,
      requesterDayOffset: 7,
      counterpartDayOffset: 8,
      title: 'Operations Evening Cover',
      reason: 'Ben and Grace swapped to balance opening and closing coverage.',
      status: 'approved',
      counterpartStatus: 'approved',
      counterpartReviewedAt: minutesAgo(95),
      reviewedBy: manager1Id,
      reviewedAt: minutesAgo(70),
      createdAt: minutesAgo(120),
    },
    {
      label: 'rejected-grace-ben-coverage',
      requesterEmail: 'employee5@test.com',
      counterpartEmail: 'employee1@test.com',
      department: opsDept,
      requesterDayOffset: 9,
      counterpartDayOffset: 10,
      title: 'Operations Service Shift',
      reason: 'Grace wanted to move her service shift to Ben.',
      status: 'rejected',
      counterpartStatus: 'approved',
      counterpartReviewedAt: minutesAgo(88),
      reviewedBy: manager1Id,
      reviewedAt: minutesAgo(62),
      ownerReviewReason: 'Coverage would be too light during the Friday service window.',
      createdAt: minutesAgo(115),
    },
    {
      label: 'hidden-awaiting-counterpart',
      requesterEmail: 'employee1@test.com',
      counterpartEmail: 'employee5@test.com',
      department: opsDept,
      requesterDayOffset: 11,
      counterpartDayOffset: 12,
      title: 'Operations Standby Shift',
      reason: 'This one is still waiting for Grace, so Manager Swap Requests should not show it yet.',
      status: 'pending',
      counterpartStatus: 'pending',
      createdAt: minutesAgo(20),
    },
  ]
  let seededSwapCount = 0
  for (const def of swapSeedDefs) {
    if (await createSeedSwap(def)) seededSwapCount++
  }
  console.log(`  ✓ ${seededSwapCount} Employee shift swap requests seeded for manager1/manager5 Operations testing`)

  // Step 8c: Manager dashboard data pack.
  // The current seed intentionally returns before the older full-demo section below. That is useful
  // for focused Attendance tests, but it left manager1@test.com with an empty Dashboard. This pack
  // keeps the seed compact while ensuring every Manager dashboard block has real Operations data:
  // Waiting On You, Recruitment Overview, Task Overview, Internal Attendance, and Casual Attendance.
  console.log('\nStep 8c: Create manager1 dashboard data pack...')
  const todayKey = dateKey(TODAY)
  const managerClockStart = new Date(Date.now() + 30 * 60000)
  const managerClockEnd = new Date(managerClockStart.getTime() + 8 * 60 * 60000)
  const managerClockDate = dateKeyUTC(managerClockStart)
  const managerClockStartTime = toHM(managerClockStart)
  const managerClockEndTime = toHM(managerClockEnd)
  const manager1UserId = userIdMap['manager1@test.com'].internalId
  const manager5UserId = userIdMap['manager5@test.com'].internalId
  const employee1UserId = userIdMap['employee1@test.com'].internalId
  const employee5UserId = userIdMap['employee5@test.com'].internalId

  const dashboardGuestEmails = ['guest1@test.com', 'guest2@test.com', 'guest3@test.com']
  for (const guestEmail of dashboardGuestEmails) {
    const guest = guestApplicants.find(g => g.email === guestEmail)
    if (!guest) continue
    const { data: guestAuth, error: guestAuthErr } = await supabase.auth.admin.createUser({
      email: guest.email,
      password: PASSWORD,
      email_confirm: true,
    })
    if (guestAuthErr || !guestAuth.user) {
      console.warn(`  ⚠ Failed to create dashboard guest auth ${guest.email}: ${guestAuthErr?.message}`)
      continue
    }
    const { data: guestUser, error: guestUserErr } = await supabase
      .from('users')
      .insert({
        supabase_auth_id: guestAuth.user.id,
        full_name: guest.full_name,
        email_address: guest.email,
        phone_number: guest.phone_number,
        date_of_birth: guest.date_of_birth,
        profile_photo_url: DEMO_PHOTO_URL,
        role: 'Guest User',
        company_id: null,
        skills: guest.skills,
        resume_url: guest.resume_url,
      })
      .select()
      .single()
    if (guestUserErr) {
      console.warn(`  ⚠ Failed to create dashboard guest user ${guest.email}: ${guestUserErr.message}`)
      continue
    }
    userIdMap[guest.email] = { authId: guestAuth.user.id, internalId: guestUser.id }
    for (const cert of guest.certs) {
      const { error: certErr } = await supabase.from('user_certificates').insert({
        user_id: guestUser.id,
        name: cert.name,
        file_url: cert.file_url,
      })
      if (certErr) console.warn(`  ⚠ Failed to seed dashboard guest certificate (${guest.email}): ${certErr.message}`)
    }
  }

  const { data: dashboardCasualAuth, error: dashboardCasualAuthErr } = await supabase.auth.admin.createUser({
    email: 'casual1@test.com',
    password: PASSWORD,
    email_confirm: true,
  })
  if (dashboardCasualAuthErr || !dashboardCasualAuth.user) {
    console.warn(`  ⚠ Failed to create casual1@test.com auth: ${dashboardCasualAuthErr?.message}`)
  } else {
    const { data: dashboardCasualUser, error: dashboardCasualUserErr } = await supabase
      .from('users')
      .insert({
        supabase_auth_id: dashboardCasualAuth.user.id,
        full_name: 'Marcus Lee',
        email_address: 'casual1@test.com',
        phone_number: '+65 8300 3001',
        date_of_birth: '1999-11-20',
        profile_photo_url: DEMO_PHOTO_URL,
        role: 'Casual Worker',
        company_id: company.id,
        worker_status: 'active',
        hourly_rate: 18.5,
      })
      .select()
      .single()
    if (dashboardCasualUserErr) {
      console.warn(`  ⚠ Failed to create casual1@test.com user: ${dashboardCasualUserErr.message}`)
    } else {
      userIdMap['casual1@test.com'] = { authId: dashboardCasualAuth.user.id, internalId: dashboardCasualUser.id }
      const { error: casualDeptErr } = await supabase.from('casualworker_departments').upsert({
        casual_worker_id: dashboardCasualUser.id,
        department_id: opsDept.id,
        company_id: company.id,
        verified_at: new Date().toISOString(),
      }, { onConflict: 'casual_worker_id,department_id' })
      if (casualDeptErr) console.warn(`  ⚠ Failed to verify casual1@test.com in Operations: ${casualDeptErr.message}`)
    }
  }

  const todayInternalShift = await createShift({
    company_id: company.id,
    department_id: opsDept.id,
    shift_date: managerClockDate,
    start_time: managerClockStartTime,
    end_time: managerClockEndTime,
    title: 'Operations Live Floor Coverage',
    created_by: ownerUser.id,
    publication_status: 'published',
  })
  const todayAssignments = []
  for (const email of ['manager1@test.com']) {
    const assignment = await assignShift(todayInternalShift?.id, userIdMap[email].internalId, ownerUser.id)
    if (assignment) todayAssignments.push({ email, assignment })
  }

  const dashboardAttendanceShift = await createShift({
    company_id: company.id,
    department_id: opsDept.id,
    shift_date: todayKey,
    start_time: '09:00',
    end_time: '17:00',
    title: 'Operations Day Team Coverage',
    created_by: ownerUser.id,
    publication_status: 'published',
  })
  const dashboardAttendanceAssignments = []
  for (const email of ['manager5@test.com', 'employee1@test.com', 'employee5@test.com']) {
    const assignment = await assignShift(dashboardAttendanceShift?.id, userIdMap[email].internalId, ownerUser.id)
    if (assignment) dashboardAttendanceAssignments.push({ email, assignment })
  }
  await clockRecord(dashboardAttendanceAssignments.find(a => a.email === 'manager5@test.com')?.assignment, manager5UserId, { dateStr: todayKey, breakStart: '12:15', breakEnd: '12:45' })
  await clockRecord(dashboardAttendanceAssignments.find(a => a.email === 'employee1@test.com')?.assignment, employee1UserId, { dateStr: todayKey, lateMinutes: 20, breakStart: '12:30', breakEnd: '13:00' })
  console.log(`  ✓ manager1@test.com test shift starts in the clock-in window: ${managerClockDate} ${managerClockStartTime}-${managerClockEndTime} UTC`)

  if (userIdMap['casual1@test.com']) {
    const casualPreStartStart = new Date(Date.now() + 30 * 60 * 1000)
    const casualPreStartEnd = new Date(casualPreStartStart.getTime() + 4 * 60 * 60 * 1000)
    const casualPreStartDate = dateKeyUTC(casualPreStartStart)
    const casualPreStartStartTime = toHM(casualPreStartStart)
    const casualPreStartEndTime = toHM(casualPreStartEnd)
    const { data: casualPreStartJob, error: casualPreStartJobErr } = await supabase
      .from('job_postings')
      .insert({
        company_id: company.id,
        department_id: opsDept.id,
        created_by: manager1UserId,
        title: 'Pre-Shift Cafe Counter Cover',
        description: 'Cover the cafe counter during the pre-lunch rush. Prepare the till, greet guests, take orders, and keep the counter stocked before the lunch team arrives.',
        requirements: 'Arrive on time, wear black shoes, comfortable handling cash and customer questions.',
        location: '1 Raffles Place, Singapore 048616',
        employment_type: 'Part-time',
        company_name: company.name,
        status: 'closed',
        form_type: 'oneoff',
        urgency: 'normal',
        estimated_hours: '4',
        shift_date: casualPreStartDate,
        job_start_time: casualPreStartStartTime,
        openings: 1,
        experience_required: 'Not Required',
        minimum_age: 16,
        uniform_required: true,
        uniform_type: 'company',
        uniform_details: 'Black pants and covered shoes. Apron provided on site.',
        salary_amount: 72,
        expires_at: casualPreStartDate,
        archived_at: new Date().toISOString(),
      })
      .select()
      .single()
    if (casualPreStartJobErr) {
      console.warn(`  ⚠ Failed to create casual pre-start job posting: ${casualPreStartJobErr.message}`)
    } else {
      const { data: casualPreStartApplicant, error: casualPreStartApplicantErr } = await supabase
        .from('job_applicants')
        .insert({
          job_id: casualPreStartJob.id,
          user_id: userIdMap['casual1@test.com'].internalId,
          resume_url: 'https://example.com/demo-resumes/marcus-lee-resume.pdf',
          status: 'accepted',
          relevant_experience: 'less_than_1',
          additional_note: 'I can arrive before the shift starts and help with cafe counter setup.',
        })
        .select()
        .single()
      if (casualPreStartApplicantErr) {
        console.warn(`  ⚠ Failed to create casual pre-start applicant: ${casualPreStartApplicantErr.message}`)
      } else {
        const { error: casualPreStartInvitationErr } = await supabase.from('job_invitations').insert({
          job_id: casualPreStartJob.id,
          applicant_id: casualPreStartApplicant.id,
          sent_by: manager1UserId,
          status: 'accepted',
        })
        if (casualPreStartInvitationErr) console.warn(`  ⚠ Failed to create casual pre-start invitation: ${casualPreStartInvitationErr.message}`)
      }
      const todayCasualShift = await createShift({
        company_id: company.id,
        department_id: opsDept.id,
        shift_date: casualPreStartDate,
        start_time: casualPreStartStartTime,
        end_time: casualPreStartEndTime,
        title: 'Pre-Shift Cafe Counter Cover',
        created_by: manager1UserId,
        publication_status: 'published',
        source_job_posting_id: casualPreStartJob.id,
        flat_rate: 72,
      })
      const todayCasualAssignment = await assignShift(todayCasualShift?.id, userIdMap['casual1@test.com'].internalId, manager1UserId, employee1UserId)
      if (todayCasualShift && todayCasualAssignment) {
        await createTask({
          shift_id: todayCasualShift.id,
          company_id: company.id,
          department_id: opsDept.id,
          title: 'Set up the cafe counter float',
          description: 'Count the starting cash float, turn on the POS, and confirm receipt paper is loaded before opening.',
          assigned_user_id: userIdMap['casual1@test.com'].internalId,
          assigned_by: employee1UserId,
          status: 'Assigned',
          due_at: dueAtOn(new Date(casualPreStartDate), Number(casualPreStartStartTime.slice(0, 2))),
          priority: 'High',
        })
        await createTask({
          shift_id: todayCasualShift.id,
          company_id: company.id,
          department_id: opsDept.id,
          title: 'Stock cups, napkins, and takeaway lids',
          description: 'Top up front-counter consumables from the storeroom before the first order rush.',
          assigned_user_id: userIdMap['casual1@test.com'].internalId,
          assigned_by: employee1UserId,
          status: 'Assigned',
          due_at: dueAtOn(new Date(casualPreStartDate), Number(casualPreStartStartTime.slice(0, 2))),
          priority: 'Medium',
        })
        const managerCasualAttendanceShift = await createShift({
          company_id: company.id,
          department_id: opsDept.id,
          shift_date: todayKey,
          start_time: '12:00',
          end_time: '16:00',
          title: 'Lunch Service Casual Cover',
          created_by: manager1UserId,
          publication_status: 'published',
        })
        const managerCasualAttendanceAssignment = await assignShift(managerCasualAttendanceShift?.id, userIdMap['casual1@test.com'].internalId, manager1UserId, employee1UserId)
        await clockRecord(managerCasualAttendanceAssignment, userIdMap['casual1@test.com'].internalId, { dateStr: todayKey, endStr: '16:00', breakStart: '14:00', breakEnd: '14:15' })
        const { error: casualMessageErr } = await supabase.from('messages').insert({
          from_user_id: employee1UserId,
          to_user_id: userIdMap['casual1@test.com'].internalId,
          company_id: company.id,
          content: `Hi Marcus, your cafe counter cover starts at ${casualPreStartStartTime}. Please clock in from 30 minutes before the shift and check the two setup tasks.`,
          is_read: false,
          sender_name: 'Ben Seah',
        })
        if (casualMessageErr) console.warn(`  ⚠ Failed to create casual pre-start message: ${casualMessageErr.message}`)
        console.log(`  ✓ Casual Worker pre-start dashboard job: casual1@test.com starts at ${casualPreStartStartTime} UTC (${casualPreStartDate}); no attendance record seeded, so the page shows the pre-work clock-in state`)
      }
    }
  }
  console.log('  ✓ Today attendance: Operations internal staff rows for Manager dashboard; casual1@test.com has a pre-start dashboard job')

  const managerDashboardJobDefs = [
    {
      key: 'manager_deadline_today',
      title: 'Operations Event Runner - Applications Close Today',
      expires_at: todayKey,
      shift_date: dateKey(TOMORROW),
      openings: 4,
      job_start_time: '10:00',
    },
    {
      key: 'manager_starting_soon',
      title: 'Lobby Queue Host - Starts Tomorrow',
      expires_at: dateKey(addDays(TODAY, 3)),
      shift_date: dateKey(TOMORROW),
      openings: 3,
      job_start_time: '11:00',
    },
  ]
  const managerDashboardJobIds = {}
  for (const def of managerDashboardJobDefs) {
    const { key, ...rest } = def
    const { data: job, error: jobErr } = await supabase
      .from('job_postings')
      .insert({
        company_id: company.id,
        department_id: opsDept.id,
        created_by: manager1UserId,
        description: 'Seeded manager dashboard posting with applicants, deadline, and staffing pressure.',
        requirements: 'Friendly, punctual, comfortable with guest-facing work.',
        location: company.location,
        employment_type: 'Part-time',
        status: 'open',
        form_type: 'oneoff',
        urgency: 'high',
        estimated_hours: '5',
        experience_required: 'Not Required',
        minimum_age: 16,
        uniform_required: false,
        salary_amount: 16,
        ...rest,
      })
      .select()
      .single()
    if (jobErr) {
      console.warn(`  ⚠ Failed to create manager dashboard job (${def.title}): ${jobErr.message}`)
    } else {
      managerDashboardJobIds[key] = job.id
    }
  }
  for (const guestEmail of dashboardGuestEmails) {
    if (!managerDashboardJobIds.manager_deadline_today || !userIdMap[guestEmail]) continue
    const guest = guestApplicants.find(g => g.email === guestEmail)
    const { error: appErr } = await supabase.from('job_applicants').insert({
      job_id: managerDashboardJobIds.manager_deadline_today,
      user_id: userIdMap[guestEmail].internalId,
      resume_url: guest?.resume_url ?? null,
      status: 'pending',
      relevant_experience: 'less_than_1',
      additional_note: 'Available for the seeded Operations dashboard test shift.',
      skills_snapshot: guest?.skills ?? null,
      certificates_snapshot: guest?.certs ?? [],
    })
    if (appErr) console.warn(`  ⚠ Failed to create manager dashboard applicant (${guestEmail}): ${appErr.message}`)
  }
  console.log('  ✓ Recruitment Overview: deadline-today job, starting-soon job, and pending applicants')

  await createTask({
    company_id: company.id,
    department_id: opsDept.id,
    title: 'Approve cafe counter reset checklist',
    description: 'Review Ben Seah\'s completed checklist before the evening handover.',
    assigned_user_id: employee1UserId,
    assigned_by: manager1UserId,
    status: 'Review',
    due_at: dueAtOn(TODAY, 12),
    percentage_complete: 100,
    priority: 'High',
  })
  await createTask({
    company_id: company.id,
    department_id: opsDept.id,
    title: 'Finish morning stock variance follow-up',
    description: 'Resolve the stock variance notes before the next delivery window.',
    assigned_user_id: employee5UserId,
    assigned_by: manager1UserId,
    status: 'In Progress',
    due_at: dueAtOn(YESTERDAY, 16),
    percentage_complete: 45,
    priority: 'High',
  })
  await createTask({
    company_id: company.id,
    department_id: opsDept.id,
    title: 'Confirm weekend runner briefing',
    description: 'Confirm the briefing notes and attendee list for the weekend runner team.',
    assigned_user_id: employee1UserId,
    assigned_by: manager1UserId,
    status: 'Assigned',
    due_at: dueAtOn(TOMORROW, 10),
    percentage_complete: 0,
    priority: 'Medium',
  })
  await createTask({
    company_id: company.id,
    department_id: opsDept.id,
    title: 'Confirm closing cash handover',
    description: 'Due-today sample for the Manager Team Task Overview block.',
    assigned_user_id: employee5UserId,
    assigned_by: manager1UserId,
    status: 'Assigned',
    due_at: dueLaterToday(2),
    percentage_complete: 0,
    priority: 'High',
  })
  await createTask({
    company_id: company.id,
    department_id: opsDept.id,
    title: 'Owner assigned weekly staffing review',
    description: 'New Owner-assigned Manager task for the Task Notification block.',
    assigned_user_id: manager1UserId,
    assigned_by: ownerUser.id,
    status: 'Assigned',
    due_at: dueAtOn(TOMORROW, 14),
    percentage_complete: 0,
    priority: 'High',
  })
  await createTask({
    company_id: company.id,
    department_id: opsDept.id,
    title: 'Revise weekend staffing plan',
    description: 'Owner rejected this Manager task so the Task Notification block has a rework alert.',
    assigned_user_id: manager1UserId,
    assigned_by: ownerUser.id,
    status: 'In Progress',
    due_at: dueAtOn(TOMORROW, 15),
    percentage_complete: 35,
    priority: 'High',
    rejection_reason: 'Please account for the late service window before resubmitting.',
    rejected_at: minutesAgo(35),
  })
  await createTask({
    company_id: company.id,
    department_id: opsDept.id,
    title: 'Close opening float reconciliation',
    description: 'Completed task for the Manager dashboard completed-today bucket.',
    assigned_user_id: employee5UserId,
    assigned_by: manager1UserId,
    status: 'Complete',
    due_at: dueAtOn(TODAY, 11),
    completed_at: dueAtOn(TODAY, 11),
    percentage_complete: 100,
    priority: 'Low',
  })
  console.log('  ✓ Task Overview: review, overdue, due-soon, and completed-today Operations tasks')

  const { error: opsAnnouncementErr } = await supabase.from('announcements').insert({
    from_user_id: manager1UserId,
    company_id: company.id,
    department_id: opsDept.id,
    title: 'Operations shift notes for today',
    content: 'Counter cover, stock variance follow-up, and weekend runner briefing are all active today.',
  })
  if (opsAnnouncementErr) console.warn(`  ⚠ Failed to create manager announcement: ${opsAnnouncementErr.message}`)
  const managerMessageDefs = [
    { from_user_id: ownerUser.id, to_user_id: manager1UserId, sender_name: 'Sarah Mitchell', content: 'Please keep an eye on the cafe cover applicants before the deadline.', is_read: false },
    { from_user_id: manager1UserId, to_user_id: employee1UserId, sender_name: 'David Lim', content: 'Thanks for the checklist. I am reviewing it from the dashboard queue now.', is_read: true },
    { from_user_id: employee5UserId, to_user_id: manager1UserId, sender_name: 'Grace Lim', content: 'I will finish the stock variance follow-up before handover.', is_read: false },
  ]
  for (const message of managerMessageDefs) {
    const { error } = await supabase.from('messages').insert({ ...message, company_id: company.id })
    if (error) console.warn(`  ⚠ Failed to create manager dashboard message: ${error.message}`)
  }
  console.log('  ✓ Communication: Operations announcement + manager1 conversations')

  console.log('\n═══════════════════════════════════════════')
  console.log('  Done: Manager-focused seed is ready. Password for all test accounts: 111111')
  console.log('  Owner:    owner@test.com')
  console.log('  Partner:  partner1@test.com')
  console.log('  Manager:  manager1-8@test.com')
  console.log('  Employee: employee1-8@test.com')
  console.log('  Casual:   casual1@test.com')
  console.log('  Guest:    guest1-3@test.com')
  console.log('  Company:  Sunrise Hospitality Group')
  console.log('  Seeded for testing: manager1@test.com Dashboard, Attendance, Tasks, Recruitment, Communication, Team, and Shift Swap Requests.')
  console.log('  Test path: login manager1@test.com -> Manager Dashboard. No dashboard overview block should be empty.')
  console.log('═══════════════════════════════════════════')
  return

  for (const guest of guestApplicants) {
    const { data: authData, error: authErr } = await supabase.auth.admin.createUser({
      email: guest.email,
      password: PASSWORD,
      email_confirm: true,
    })
    if (authErr || !authData.user) {
      console.error(`  ✗ auth 创建失败 ${guest.email}: ${authErr?.message}`)
      process.exit(1)
    }
    const { data: u, error: uErr } = await supabase
      .from('users')
      .insert({
        supabase_auth_id: authData.user.id,
        full_name: guest.full_name,
        email_address: guest.email,
        phone_number: guest.phone_number,
        date_of_birth: guest.date_of_birth,
        profile_photo_url: DEMO_PHOTO_URL,
        role: 'Guest User',
        company_id: null,
        skills: guest.skills,
        resume_url: guest.resume_url,
      })
      .select()
      .single()
    if (uErr) { console.error(`  ✗ 插入 Guest users 失败 ${guest.email}:`, uErr.message); process.exit(1) }
    userIdMap[guest.email] = { authId: authData.user.id, internalId: u.id }
    for (const cert of guest.certs) {
      const { error: certErr } = await supabase.from('user_certificates').insert({
        user_id: u.id,
        name: cert.name,
        file_url: cert.file_url,
      })
      if (certErr) console.warn(`  ⚠ 插入 user_certificates 失败 (${guest.email} / ${cert.name}): ${certErr.message}`)
    }
    console.log(`  ✓ Guest: ${guest.full_name} → ${u.id}（${guest.certs.length} 张证书）`)
  }

  // ── Step 9: 创建 Job Postings（覆盖 UC42 需要的 Pending Approval 状态，其余
  // 状态方便直接测 UC38-40/UC44-48，不用每次手动从头建）───────────────────
  console.log('\nStep 9: 创建 Job Postings...')
  const applicationDeadline = dateKey(addDays(TODAY, 14))
  const jobDefs = [
    {
      key: 'open',
      company_id: company.id,
      department_id: depts[0].id, // Operations
      created_by: ownerUser.id,
      title: 'Weekend Event Crew',
      description: 'Help set up and run a corporate weekend event — registration desk, guest flow, and teardown.',
      requirements: 'Comfortable on your feet for a full shift, clear spoken English, punctual.',
      location: company.location,
      employment_type: 'Part-time',
      status: 'open',
      form_type: 'oneoff',
      urgency: 'normal',
      estimated_hours: '6',
      // Real date, not just a deadline — accepting an invitation on this job (respondToInvitation)
      // only creates the actual shifts/shift_assignments row (what the Casual dashboard reads) when
      // shift_date is set; leaving it null silently produces an "accepted" application with no
      // shift behind it.
      shift_date: dateKey(nextWeekday(TODAY, 6)), // next Saturday
      job_start_time: '09:00',
      openings: 3,
      experience_required: 'Not Required',
      minimum_age: 16,
      uniform_required: false,
      salary_amount: 15.5,
      expires_at: applicationDeadline,
    },
    {
      key: 'pending_approval',
      company_id: company.id,
      department_id: depts[1].id, // Marketing
      created_by: userIdMap['manager2@test.com'].internalId, // Rachel Koh — so it lands on someone else's approval queue
      title: 'Flyer Distribution — City Centre',
      description: 'Hand out promotional flyers in the city centre during lunch and evening foot traffic peaks.',
      requirements: 'Friendly, comfortable approaching strangers, own transport to the city centre.',
      location: company.location,
      employment_type: 'Part-time',
      status: 'pending_approval',
      form_type: 'oneoff',
      urgency: 'high',
      estimated_hours: '4',
      job_start_time: '11:00',
      openings: 2,
      experience_required: 'Not Required',
      minimum_age: 16,
      uniform_required: false,
      salary_amount: 14,
      expires_at: applicationDeadline,
    },
    {
      key: 'draft',
      company_id: company.id,
      department_id: depts[2].id, // Engineering
      created_by: ownerUser.id,
      title: 'IT Support — Office Relocation',
      description: 'Assist packing/unpacking and reconnecting workstations during an office move.',
      requirements: null,
      location: company.location,
      employment_type: 'Part-time',
      status: 'draft',
      form_type: 'oneoff',
      urgency: 'normal',
      estimated_hours: null,
      job_start_time: null,
      openings: 1,
      experience_required: null,
      minimum_age: null,
      uniform_required: false,
      salary_amount: null,
      expires_at: null,
    },
    {
      key: 'rejected',
      company_id: company.id,
      department_id: depts[3].id, // Customer Support
      created_by: userIdMap['manager4@test.com'].internalId, // Fiona Chen — so Owner's rejection has a real recipient
      title: 'Live Chat Support — Overnight',
      description: 'Cover overnight live-chat customer support shifts.',
      requirements: 'Clear written English, own laptop, stable internet connection.',
      location: company.location,
      employment_type: 'Part-time',
      status: 'rejected',
      form_type: 'oneoff',
      urgency: 'normal',
      estimated_hours: '8',
      job_start_time: '22:00',
      openings: 2,
      experience_required: 'Not Required',
      minimum_age: 18,
      uniform_required: false,
      salary_amount: 16,
      expires_at: applicationDeadline,
      rejection_reason: 'Overnight coverage is already fully staffed this month — please resubmit next month or propose daytime hours instead.',
      rejected_by: ownerUser.id,
    },
    // Two more Open postings — purely for Guest job-board coverage (Step 10b): a recurring
    // 'shift' type job (Weekend Event Crew above is 'oneoff') and a second 'oneoff' job with
    // urgency/uniform/experience badges all switched on, so the public board and the Guest
    // Applications page both have real variety to browse instead of a single card.
    {
      key: 'open_shift',
      company_id: company.id,
      department_id: depts[2].id, // Engineering
      created_by: ownerUser.id,
      title: 'Warehouse Stock Count — Weekend Shift',
      description: 'Recurring weekend shift counting and organizing warehouse inventory ahead of a new stock intake.',
      requirements: 'Comfortable with repetitive counting tasks, basic spreadsheet use a plus.',
      location: company.location,
      employment_type: 'Part-time',
      status: 'open',
      form_type: 'shift',
      is_recurring: true,
      urgency: 'normal',
      shift_date: dateKey(addDays(TODAY, 4)),
      shift_days: ['Saturday', 'Sunday'],
      shift_start_time: '08:00',
      shift_end_time: '13:00',
      break_start_time: '10:00',
      break_end_time: '10:15',
      openings: 2,
      experience_required: '6+ Months',
      minimum_age: 18,
      uniform_required: false,
      salary_amount: 13.5,
      expires_at: applicationDeadline,
    },
    {
      key: 'open_urgent',
      company_id: company.id,
      department_id: depts[1].id, // Marketing
      created_by: ownerUser.id,
      title: 'Retail Promo Day — Orchard Road',
      description: 'Represent the brand at a retail pop-up booth — greet shoppers, hand out samples, and log leads.',
      requirements: 'Outgoing personality, comfortable standing for long periods, available on short notice.',
      location: company.location,
      employment_type: 'Part-time',
      status: 'open',
      form_type: 'oneoff',
      urgency: 'urgent',
      estimated_hours: '5',
      shift_date: dateKey(addDays(TODAY, 2)), // same reason as the 'open' job above
      job_start_time: '10:00',
      openings: 2,
      experience_required: 'Preferred',
      minimum_age: 18,
      uniform_required: true,
      uniform_type: 'company',
      uniform_details: 'Branded polo shirt and cap will be provided at check-in.',
      salary_amount: 90,
      expires_at: dateKey(addDays(TODAY, 5)),
    },
    // Manager-created (David Lim, Operations) — Open with pending applicants of its own, so
    // manager1@test.com has a job where canManageApplicants() is true (created_by === self) to
    // test UC44 View Applicant List / UC45 Accept-Reject / UC48 AI Candidate Recommendation with.
    {
      key: 'manager_open',
      company_id: company.id,
      department_id: depts[0].id, // Operations
      created_by: userIdMap['manager1@test.com'].internalId,
      title: 'Weekend Café Cover',
      description: 'Cover the café counter for a weekend rush — orders, till, and light cleaning.',
      requirements: 'Comfortable handling cash, friendly with customers.',
      location: company.location,
      employment_type: 'Part-time',
      status: 'open',
      form_type: 'oneoff',
      urgency: 'normal',
      estimated_hours: '5',
      shift_date: dateKey(nextWeekday(TODAY, 6)), // next Saturday
      job_start_time: '09:00',
      openings: 2,
      experience_required: 'Not Required',
      minimum_age: 16,
      uniform_required: false,
      salary_amount: 16,
      expires_at: applicationDeadline,
    },
    // Manager-created (David Lim, Operations) — clean Draft to test UC39 Duplicate Draft Job /
    // UC40 Save Job as Draft with (drafts are creator-only, never department-shared, per confirmed
    // 2026-07-23 decision — see getDraftPostings in recruitmentService.ts).
    {
      key: 'manager_draft',
      company_id: company.id,
      department_id: depts[0].id, // Operations
      created_by: userIdMap['manager1@test.com'].internalId,
      title: 'Stockroom Reorganisation — Half Day',
      description: 'Reorganise the stockroom shelving and relabel bins ahead of next month\'s delivery.',
      requirements: null,
      location: company.location,
      employment_type: 'Part-time',
      status: 'draft',
      form_type: 'oneoff',
      urgency: 'normal',
      estimated_hours: null,
      job_start_time: null,
      openings: 1,
      experience_required: null,
      minimum_age: null,
      uniform_required: false,
      salary_amount: null,
      expires_at: null,
    },
  ]
  const jobIdByKey = {}
  for (const def of jobDefs) {
    const { key, ...fields } = def
    const { data: job, error: jobErr } = await supabase
      .from('job_postings')
      .insert(fields)
      .select()
      .single()
    if (jobErr) { console.warn(`  ⚠ 创建 job_posting 失败 (${def.title}): ${jobErr.message}`); continue }
    jobIdByKey[key] = job.id
    console.log(`  ✓ Job Posting [${def.status}]: ${job.title} (${job.id})`)
  }

  // ── Step 10: 给 Open 状态的 job 挂 3 个 pending 申请人（UC44/45/48 用）────
  console.log('\nStep 10: 创建 Job Applicants...')
  if (jobIdByKey.open) {
    for (const guestEmail of ['guest1@test.com', 'guest2@test.com', 'guest3@test.com']) {
      const guestDef = guestApplicants.find(g => g.email === guestEmail)
      const guestId = userIdMap[guestEmail].internalId
      const { error: appErr } = await supabase.from('job_applicants').insert({
        job_id: jobIdByKey.open,
        user_id: guestId,
        resume_url: guestDef.resume_url,
        status: 'pending',
        relevant_experience: 'less_than_1',
        additional_note: `Hi, I'm ${guestDef.full_name.split(' ')[0]} and I'd love to help out with this one.`,
        skills_snapshot: guestDef.skills,
        certificates_snapshot: guestDef.certs,
      })
      if (appErr) console.warn(`  ⚠ 创建 job_applicant 失败 (${guestDef.full_name}): ${appErr.message}`)
      else console.log(`  ✓ Applicant: ${guestDef.full_name} → Weekend Event Crew`)
    }
  }
  // manager1(David Lim)-owned job — same 3 guests re-applying to a second posting is fine,
  // there's no uniqueness constraint on (job_id, user_id) and guest1 already spans multiple
  // jobs elsewhere in this file (UC44/45/48 test data for the Manager role).
  if (jobIdByKey.manager_open) {
    for (const guestEmail of ['guest1@test.com', 'guest2@test.com', 'guest3@test.com']) {
      const guestDef = guestApplicants.find(g => g.email === guestEmail)
      const guestId = userIdMap[guestEmail].internalId
      const { error: appErr } = await supabase.from('job_applicants').insert({
        job_id: jobIdByKey.manager_open,
        user_id: guestId,
        resume_url: guestDef.resume_url,
        status: 'pending',
        relevant_experience: 'less_than_1',
        additional_note: `Hi, I'm ${guestDef.full_name.split(' ')[0]} and I'd love to help out with this one.`,
        skills_snapshot: guestDef.skills,
        certificates_snapshot: guestDef.certs,
      })
      if (appErr) console.warn(`  ⚠ 创建 job_applicant 失败 (${guestDef.full_name}): ${appErr.message}`)
      else console.log(`  ✓ Applicant: ${guestDef.full_name} → Weekend Café Cover (Manager)`)
    }
  }

  // ── Step 10b: 给新增的两条 Open job 挂不同状态的 Guest 申请人（覆盖 Guest
  // Applications 页的 Offer Sent / Confirmed / Not Selected 三种卡片 —— Step 10 的 3 个
  // pending 申请人只够测 Pending Review 这一种，这里补齐 ApplicationFlow 剩下的分支）──
  console.log('\nStep 10b: 创建更多 Guest 申请状态（Offer Sent / Confirmed / Not Selected）...')

  async function insertApplicant(jobId, guestEmail, status, extra = {}) {
    const guestDef = guestApplicants.find(g => g.email === guestEmail)
    const guestId = userIdMap[guestEmail].internalId
    const { data, error } = await supabase
      .from('job_applicants')
      .insert({
        job_id: jobId,
        user_id: guestId,
        resume_url: guestDef.resume_url,
        status,
        relevant_experience: extra.relevant_experience ?? 'less_than_1',
        additional_note: extra.additional_note ?? `Hi, I'm ${guestDef.full_name.split(' ')[0]} and I'd love to help out with this one.`,
        skills_snapshot: guestDef.skills,
        certificates_snapshot: guestDef.certs,
        decided_at: extra.decided_at ?? null,
      })
      .select()
      .single()
    if (error) { console.warn(`  ⚠ 创建 job_applicant 失败 (${guestDef.full_name}): ${error.message}`); return null }
    return data
  }

  async function insertInvitation(jobId, applicantId, status) {
    const { error } = await supabase.from('job_invitations').insert({
      job_id: jobId,
      applicant_id: applicantId,
      sent_by: ownerUser.id,
      status,
    })
    if (error) console.warn(`  ⚠ 创建 job_invitation 失败: ${error.message}`)
  }

  if (jobIdByKey.open_shift) {
    // Amirah Yusof — employer accepted her application and sent an offer; she hasn't responded
    // yet → Guest Applications page shows "Accept / Reject Job Offer" (ApplicationFlow step 2).
    const offerApp = await insertApplicant(jobIdByKey.open_shift, 'guest4@test.com', 'accepted')
    if (offerApp) {
      await insertInvitation(jobIdByKey.open_shift, offerApp.id, 'sent')
      console.log('  ✓ Amirah Yusof → Warehouse Stock Count（Offer Sent，待她 Accept/Decline，Guest Applications Step 2）')
    }
  }

  if (jobIdByKey.open_urgent) {
    // Ryan Teo — both sides already agreed → "Confirmed" (ApplicationFlow step 3).
    const confirmedApp = await insertApplicant(jobIdByKey.open_urgent, 'guest5@test.com', 'accepted')
    if (confirmedApp) {
      await insertInvitation(jobIdByKey.open_urgent, confirmedApp.id, 'accepted')
      console.log('  ✓ Ryan Teo → Retail Promo Day（Confirmed，Guest Applications Step 3）')
    }

    // Priyanka Das (already pending on Weekend Event Crew from Step 10) also applied here and was
    // turned down — gives one guest two applications sitting in two different states at once.
    const rejectedApp = await insertApplicant(jobIdByKey.open_urgent, 'guest2@test.com', 'rejected', { decided_at: new Date().toISOString() })
    if (rejectedApp) console.log('  ✓ Priyanka Das → Retail Promo Day（Rejected / Not Selected，同时她在 Weekend Event Crew 上仍是 Pending）')

    // Wei Jie Lim (guest1) gets a second application here — an open Offer to respond to — on top
    // of his Step 10 Pending on Weekend Event Crew, and a Rejected one below. One guest now covers
    // Pending / Offer Sent / History all at once instead of that being spread across five logins.
    const guest1OfferApp = await insertApplicant(jobIdByKey.open_urgent, 'guest1@test.com', 'accepted')
    if (guest1OfferApp) {
      await insertInvitation(jobIdByKey.open_urgent, guest1OfferApp.id, 'sent')
      console.log('  ✓ Wei Jie Lim → Retail Promo Day（Offer Sent，待他 Accept/Decline，Guest Applications Step 2）')
    }
  }
  if (jobIdByKey.open_shift) {
    // Wei Jie Lim's third application — already decided, so it lands in History as Not Selected.
    const guest1RejectedApp = await insertApplicant(jobIdByKey.open_shift, 'guest1@test.com', 'rejected', { decided_at: new Date().toISOString() })
    if (guest1RejectedApp) console.log('  ✓ Wei Jie Lim → Warehouse Stock Count（Rejected / Not Selected，History）')
  }

  // ── Step 11: 创建一个 Casual Worker 账号（Attendance Records 里的零工行）────
  console.log('\nStep 11: 创建 Casual Worker 账号...')
  const { data: casualAuth, error: casualAuthErr } = await supabase.auth.admin.createUser({
    email: 'casual1@test.com',
    password: PASSWORD,
    email_confirm: true,
  })
  if (casualAuthErr || !casualAuth.user) {
    console.error(`  ✗ auth 创建失败 casual1@test.com: ${casualAuthErr?.message}`)
    process.exit(1)
  }
  const { data: casualUser, error: casualUserErr } = await supabase
    .from('users')
    .insert({
      supabase_auth_id: casualAuth.user.id,
      full_name: 'Marcus Lee',
      email_address: 'casual1@test.com',
      phone_number: '+65 8300 3001',
      date_of_birth: '1999-11-20',
      profile_photo_url: DEMO_PHOTO_URL,
      role: 'Casual Worker',
      company_id: company.id,
      worker_status: 'active',
      // Pay = shift.flat_rate if set, else this hourly_rate × hours worked (see
      // casualAttendanceService's history builder) — without this every past shift shows "$0.00".
      hourly_rate: 18.5,
    })
    .select()
    .single()
  if (casualUserErr) { console.error('  ✗ 插入 Casual Worker users 失败:', casualUserErr.message); process.exit(1) }
  userIdMap['casual1@test.com'] = { authId: casualAuth.user.id, internalId: casualUser.id }
  console.log(`  ✓ Casual Worker: Marcus Lee → ${casualUser.id}`)

  // ── Step 12: 创建 Shifts + Shift Assignments（Attendance 数据的排班基础）────
  // 过去 10 天（4 部门 × Manager+Employee，覆盖 Report 页默认的近 7 天窗口，不受种子脚本
  // 和实际打开页面的浏览器之间可能存在的时区/时钟偏差影响）+ 未来若干班次（专门给
  // Shift Swap 用）。
  console.log('\nStep 12: 创建 Shifts + Assignments...')
  const deptStaff = [0, 1, 2, 3].map(i => ({
    dept: depts[i],
    managerEmail: `manager${i + 1}@test.com`,
    employeeEmail: `employee${i + 1}@test.com`,
  }))
  // Chronological, oldest first: TODAY-10 .. TODAY-1. TWO_DAYS_AGO/YESTERDAY are the last two
  // entries, so the existing Late/Absent/Present scenarios keyed off those two dates below still
  // land on the same days as before — this only ADDS more history further back.
  const PAST_DAYS = Array.from({ length: 10 }, (_, i) => addDays(TODAY, -(10 - i)))

  const pastAssignments = {} // key: `${email}|${dateKey}` → shift_assignments row
  for (const dayDate of PAST_DAYS) {
    for (const staff of deptStaff) {
      const shift = await createShift({
        company_id: company.id,
        department_id: staff.dept.id,
        shift_date: dateKey(dayDate),
        start_time: '09:00',
        end_time: '17:00',
        title: 'Regular Shift',
        created_by: ownerUser.id,
        publication_status: 'published',
      })
      if (!shift) continue
      for (const email of [staff.managerEmail, staff.employeeEmail]) {
        const assignment = await assignShift(shift.id, userIdMap[email].internalId, ownerUser.id)
        if (assignment) pastAssignments[`${email}|${dateKey(dayDate)}`] = assignment
      }
    }
  }
  console.log(`  ✓ ${Object.keys(pastAssignments).length} 条过去 10 天的排班（4 部门 × Manager+Employee）`)

  // 每个部门的「第二位」Manager/Employee（manager5-8 / employee5-8）之前完全没有排班/打卡记录——
  // Manager 的 Attendance Records 页是按部门查排班（不是按"我自己带的人"），所以理论上部门里
  // 第二组人也该出现，但没有排班数据自然就查不到。这里补上：跟第一组共用同一条已建好的班次
  // （同一天、同一部门只有一条 Regular Shift，四个人一起排在上面），全部 Present，让 Manager 的
  // Attendance Records 页真正显示"整个部门"而不是只有一半人。
  let secondPairCount = 0
  for (const dayDate of PAST_DAYS) {
    for (let i = 0; i < 4; i++) {
      const firstManagerEmail = `manager${i + 1}@test.com`
      const shiftId = pastAssignments[`${firstManagerEmail}|${dateKey(dayDate)}`]?.shift_id
      if (!shiftId) continue
      for (const email of [`manager${i + 5}@test.com`, `employee${i + 5}@test.com`]) {
        const assignment = await assignShift(shiftId, userIdMap[email].internalId, ownerUser.id)
        if (!assignment) continue
        pastAssignments[`${email}|${dateKey(dayDate)}`] = assignment
        await clockRecord(assignment, userIdMap[email].internalId, { dateStr: dateKey(dayDate) })
        secondPairCount++
      }
    }
  }
  console.log(`  ✓ ${secondPairCount} 条第二位 Manager/Employee 的排班+打卡（共用同一班次，全部 Present）`)

  // Casual Worker 的一次性班次——过去 10 天里隔天一条 + 昨天固定一条（10am-2pm），给 Report 的
  // Casual Worker Pool / Cost Distribution 和 casual1@test.com 自己的 Attendance History 页面
  // 足够的历史数据；昨天单独保留是因为 Records Tab 默认这一周视图 + 下面 Step 13 的
  // "昨天 Casual Worker Present" 场景都是按这一天写死的。
  const cwPastDays = [...PAST_DAYS.filter((_, i) => i % 2 === 0), YESTERDAY]
  const cwPastAssignments = {} // key: dateKey → shift_assignments row
  for (const dayDate of cwPastDays) {
    const shift = await createShift({
      company_id: company.id,
      department_id: depts[0].id,
      shift_date: dateKey(dayDate),
      start_time: '10:00',
      end_time: '14:00',
      title: 'Weekend Event Crew Cover',
      created_by: ownerUser.id,
      publication_status: 'published',
    })
    const assignment = shift && await assignShift(shift.id, userIdMap['casual1@test.com'].internalId, ownerUser.id, userIdMap['employee1@test.com'].internalId)
    if (assignment) cwPastAssignments[dateKey(dayDate)] = assignment
  }
  const cwAssignment = cwPastAssignments[dateKey(YESTERDAY)] ?? null
  console.log(`  ✓ ${Object.keys(cwPastAssignments).length} 条 Casual Worker 过去班次（Marcus Lee，隔天一条 + 昨天）`)

  // 未来班次，专门给 Shift Swap 用（UC52/53）——每人一个独立班次，方便互换。
  // submitShiftSwapRequest 强制要求双方班次同部门（否则 400 "must be in the same department"），
  // 所以每组换班的班次都特意放在同一个部门里，即使换班对象本人所属部门不同。
  //
  // David Lim (manager1) / Wendy Ho (manager5) 同属 Operations——这两条班次特意 *不* 建对应的
  // pending swap request（见 Step 14），留成干净数据，让 Manager 自己在 UI 上测 Submit Shift
  // Swap（提交后走 Owner/Partner 审批）。种了 pending 的话 assignment 会先被锁住
  // （submitShiftSwapRequest 一发现某 assignment 已有 pending 请求就拒绝提交)。
  const futMgr1Shift = await createShift({ company_id: company.id, department_id: depts[0].id, shift_date: dateKey(addDays(TODAY, 3)), start_time: '09:00', end_time: '17:00', title: 'Regular Shift', created_by: ownerUser.id, publication_status: 'published' })
  const futMgr5Shift = await createShift({ company_id: company.id, department_id: depts[0].id, shift_date: dateKey(addDays(TODAY, 4)), start_time: '09:00', end_time: '17:00', title: 'Regular Shift', created_by: ownerUser.id, publication_status: 'published' })
  const futEmp1Shift = await createShift({ company_id: company.id, department_id: depts[0].id, shift_date: dateKey(addDays(TODAY, 5)), start_time: '09:00', end_time: '17:00', title: 'Regular Shift', created_by: ownerUser.id, publication_status: 'published' })
  const futEmp2Shift = await createShift({ company_id: company.id, department_id: depts[0].id, shift_date: dateKey(addDays(TODAY, 6)), start_time: '09:00', end_time: '17:00', title: 'Regular Shift', created_by: ownerUser.id, publication_status: 'published' })
  // Elaine（Customer Support）的这个班次故意撞在她 Off Day 申请的同一天（Step 15），给 UC57 AI 一个能标记 flagged 的冲突
  const futEmp4Shift = await createShift({ company_id: company.id, department_id: depts[3].id, shift_date: dateKey(NEXT_WED), start_time: '09:00', end_time: '17:00', title: 'Regular Shift', created_by: ownerUser.id, publication_status: 'published' })
  // Rachel Koh (manager2) / Kelvin Ang (manager6) — Marketing 的两位 Manager——顶上原本 David/Rachel
  // 那条 pending Manager↔Manager swap request（见 Step 14），让 Owner/Partner 的审批队列（UC53）
  // 依然有真实数据可测，同时不碰 manager1/manager5 的干净数据。
  const futMgr2Shift = await createShift({ company_id: company.id, department_id: depts[1].id, shift_date: dateKey(addDays(TODAY, 3)), start_time: '09:00', end_time: '17:00', title: 'Regular Shift', created_by: ownerUser.id, publication_status: 'published' })
  const futMgr6Shift = await createShift({ company_id: company.id, department_id: depts[1].id, shift_date: dateKey(addDays(TODAY, 4)), start_time: '09:00', end_time: '17:00', title: 'Regular Shift', created_by: ownerUser.id, publication_status: 'published' })

  const futMgr1Assign = await assignShift(futMgr1Shift?.id, userIdMap['manager1@test.com'].internalId, ownerUser.id)
  const futMgr5Assign = await assignShift(futMgr5Shift?.id, userIdMap['manager5@test.com'].internalId, ownerUser.id)
  const futEmp1Assign = await assignShift(futEmp1Shift?.id, userIdMap['employee1@test.com'].internalId, ownerUser.id)
  const futEmp2Assign = await assignShift(futEmp2Shift?.id, userIdMap['employee2@test.com'].internalId, ownerUser.id)
  await assignShift(futEmp4Shift?.id, userIdMap['employee4@test.com'].internalId, ownerUser.id)
  const futMgr2Assign = await assignShift(futMgr2Shift?.id, userIdMap['manager2@test.com'].internalId, ownerUser.id)
  const futMgr6Assign = await assignShift(futMgr6Shift?.id, userIdMap['manager6@test.com'].internalId, ownerUser.id)
  console.log('  ✓ 7 条未来班次（David/Wendy 换班用，不种 pending，留给 Manager 自测 Submit；Rachel/Kelvin 顶上 O/P 审批队列；Employee 换班 2 条 + Off Day 冲突用 1 条）')

  // Marcus Lee 的另外 2 个未来班次（不打卡，不建 attendance_record）——让 CW Dashboard 的
  // Upcoming Jobs 除了今天这个即时可 Clock In 的班次外，还能看到「之后」的排班，符合正常使用场景。
  const cwFutShift1 = await createShift({
    company_id: company.id,
    department_id: depts[0].id,
    shift_date: dateKey(addDays(TODAY, 2)),
    start_time: '11:00',
    end_time: '15:00',
    title: 'Weekend Event Crew Cover',
    created_by: ownerUser.id,
    publication_status: 'published',
  })
  const cwFutShift2 = await createShift({
    company_id: company.id,
    department_id: depts[0].id,
    shift_date: dateKey(addDays(TODAY, 5)),
    start_time: '09:00',
    end_time: '13:00',
    title: 'Weekend Event Crew Cover',
    created_by: ownerUser.id,
    publication_status: 'published',
  })
  await assignShift(cwFutShift1?.id, userIdMap['casual1@test.com'].internalId, ownerUser.id, userIdMap['employee1@test.com'].internalId)
  await assignShift(cwFutShift2?.id, userIdMap['casual1@test.com'].internalId, ownerUser.id, userIdMap['employee1@test.com'].internalId)
  console.log('  ✓ Marcus Lee 另外 2 条未来班次（Upcoming Jobs 列表用）')

  // ── Step 13: 创建 Attendance Records（Present / Late / Absent 状态混合，UC50/51/56）──
  console.log('\nStep 13: 创建 Attendance Records...')
  // 3-10 天前：全员 Present——单纯给 Report 页默认的近 7 天窗口和各种历史统计铺数据，不需要
  // 状态混合（Late/Absent 的具体测试场景留在下面"两天前"/"昨天"这两个近日，跟以前一样）。
  const OLDER_DAYS = PAST_DAYS.slice(0, -2) // 排除最后两个（两天前、昨天），那两天走专门场景
  // The oldest 3 of these (TODAY-10..TODAY-8) are the only OLDER_DAYS that fall inside the Report
  // page's PREVIOUS 7-day comparison window ([TODAY-14, TODAY-8]) — everything else here lands in
  // the CURRENT window. Rachel's manager (Engineering's manager3) is deliberately marked absent on
  // those 3 previous-period days only, so previous-period absent rate (3/6 = 50%) swings sharply
  // against this period's spotless attendance (0%) — otherwise both periods are 100% Present
  // everywhere and Report's period-over-period absent-rate anomaly never has anything to detect.
  const PREV_PERIOD_OVERLAP_DAYS = new Set(OLDER_DAYS.slice(0, 3).map(d => dateKey(d)))
  for (const dayDate of OLDER_DAYS) {
    for (const staff of deptStaff) {
      const isEngineeringManagerPrevPeriodAbsence =
        staff.dept.id === depts[2].id && PREV_PERIOD_OVERLAP_DAYS.has(dateKey(dayDate))
      if (!isEngineeringManagerPrevPeriodAbsence) {
        await clockRecord(pastAssignments[`${staff.managerEmail}|${dateKey(dayDate)}`], userIdMap[staff.managerEmail].internalId, { dateStr: dateKey(dayDate) })
      }
      await clockRecord(pastAssignments[`${staff.employeeEmail}|${dateKey(dayDate)}`], userIdMap[staff.employeeEmail].internalId, { dateStr: dateKey(dayDate) })
    }
    const cwOlderAssignment = cwPastAssignments[dateKey(dayDate)]
    if (cwOlderAssignment) await clockRecord(cwOlderAssignment, userIdMap['casual1@test.com'].internalId, { dateStr: dateKey(dayDate), endStr: '14:00', breakStart: '11:45', breakEnd: '12:00' })
  }
  console.log(`  ✓ ${OLDER_DAYS.length} 天（3-10 天前）全员 + Casual Worker 隔天 Present，给 Report 铺历史数据`)
  console.log('  ✓ Engineering manager (Aaron Wong) 在前一对比周期的 3 天里缺勤，给 Report 的 absent rate 环比异常留下真实信号')

  // 两天前：全员 Present（干净的基线日）
  for (const staff of deptStaff) {
    await clockRecord(pastAssignments[`${staff.managerEmail}|${dateKey(TWO_DAYS_AGO)}`], userIdMap[staff.managerEmail].internalId, { dateStr: dateKey(TWO_DAYS_AGO) })
    await clockRecord(pastAssignments[`${staff.employeeEmail}|${dateKey(TWO_DAYS_AGO)}`], userIdMap[staff.employeeEmail].internalId, { dateStr: dateKey(TWO_DAYS_AGO) })
  }
  await clockRecord(cwPastAssignments[dateKey(TWO_DAYS_AGO)], userIdMap['casual1@test.com'].internalId, { dateStr: dateKey(TWO_DAYS_AGO), endStr: '14:00', breakStart: '11:45', breakEnd: '12:00' })
  // 昨天：4 位 Manager 全部 Present
  for (const staff of deptStaff) {
    await clockRecord(pastAssignments[`${staff.managerEmail}|${dateKey(YESTERDAY)}`], userIdMap[staff.managerEmail].internalId, { dateStr: dateKey(YESTERDAY) })
  }
  // 昨天：employee1 迟到 22 分钟 → Late
  await clockRecord(pastAssignments[`employee1@test.com|${dateKey(YESTERDAY)}`], userIdMap['employee1@test.com'].internalId, { dateStr: dateKey(YESTERDAY), lateMinutes: 20 })
  // 昨天：employee2 的记录故意不建 → 该格子显示 Absent
  // 昨天：employee3/employee4 正常 Present
  await clockRecord(pastAssignments[`employee3@test.com|${dateKey(YESTERDAY)}`], userIdMap['employee3@test.com'].internalId, { dateStr: dateKey(YESTERDAY) })
  await clockRecord(pastAssignments[`employee4@test.com|${dateKey(YESTERDAY)}`], userIdMap['employee4@test.com'].internalId, { dateStr: dateKey(YESTERDAY) })
  // 昨天：Casual Worker Present（10am-2pm 那个班次）
  await clockRecord(cwAssignment, userIdMap['casual1@test.com'].internalId, { dateStr: dateKey(YESTERDAY), endStr: '14:00', breakStart: '11:45', breakEnd: '12:00' })
  console.log('  ✓ 前天全员 Present；昨天 David/Rachel/Aaron/Fiona + Daniel/Elaine Present、Ben Late、Chloe Absent、Casual Worker Present')

  // 真实流程里，Casual Worker 是靠 casualworker_departments（不是 users.company_id）挂进公司的，
  // 且只有第一次打卡下班后 markCasualWorkerDepartmentVerified 才会把 verified_at 打上 —— 这一步
  // 直接种上 verified_at，代表 Marcus 已经完成过一次班次。少这一步的话 Team/Company 页的 Casual
  // Workers 面板（只认 casual_worker_verified_at）看不到他，即使 Attendance/Report 已经有他的记录。
  const { error: cwdErr } = await supabase.from('casualworker_departments').upsert({
    casual_worker_id: userIdMap['casual1@test.com'].internalId,
    department_id: depts[0].id,
    company_id: company.id,
    verified_at: new Date().toISOString(),
  }, { onConflict: 'casual_worker_id,department_id' })
  if (cwdErr) console.warn(`  ⚠ 创建 casualworker_departments 失败: ${cwdErr.message}`)
  else console.log('  ✓ Casual Worker 已验证（casualworker_departments.verified_at）—— Team/Company 页 Casual Workers 面板现在能看到 Marcus Lee')

  // ── Step 13b: 创建第二个 Casual Worker（Report 页 Workers Needing Attention 用）──
  // Marcus Lee 全勤，report.casual.workers 里 late/absent/cancellations 全是 0 ——
  // ReportView 的 attentionData 过滤 late>0||absent>0||cancellations>0，所以 Workers
  // Needing Attention 永远落到空状态。加一个本期有迟到+旷工的 Casual Worker，让这块也有真实数据；
  // 顺便把她排进 Marketing（不是 Operations），Casual Worker Cost Distribution 饼图也不再是
  // Operations 独占 100%。
  console.log('\nStep 13b: 创建第二个 Casual Worker（Farah Aziz）...')
  const { data: casual2Auth, error: casual2AuthErr } = await supabase.auth.admin.createUser({
    email: 'casual2@test.com', password: PASSWORD, email_confirm: true,
  })
  if (casual2AuthErr || !casual2Auth.user) {
    console.error(`  ✗ auth 创建失败 casual2@test.com: ${casual2AuthErr?.message}`)
    process.exit(1)
  }
  const { data: casual2User, error: casual2UserErr } = await supabase
    .from('users')
    .insert({
      supabase_auth_id: casual2Auth.user.id,
      full_name: 'Farah Aziz',
      email_address: 'casual2@test.com',
      phone_number: '+65 8300 3002',
      date_of_birth: '2000-06-08',
      profile_photo_url: DEMO_PHOTO_URL,
      role: 'Casual Worker',
      company_id: company.id,
      worker_status: 'active',
      hourly_rate: 17.0,
    })
    .select()
    .single()
  if (casual2UserErr) { console.error('  ✗ 插入第二个 Casual Worker users 失败:', casual2UserErr.message); process.exit(1) }
  userIdMap['casual2@test.com'] = { authId: casual2Auth.user.id, internalId: casual2User.id }
  console.log(`  ✓ Casual Worker: Farah Aziz → ${casual2User.id}`)

  // start_time 09:00 to match clockRecord's hardcoded 09:00 clock-in baseline (see the helper
  // above) — that's what makes lateMinutes actually land as "late" against the real shift start.
  const casual2Days = [addDays(TODAY, -6), addDays(TODAY, -5), addDays(TODAY, -4), addDays(TODAY, -3)]
  const casual2Assignments = {}
  for (const dayDate of casual2Days) {
    const shift = await createShift({
      company_id: company.id, department_id: depts[1].id, shift_date: dateKey(dayDate),
      start_time: '09:00', end_time: '13:00', title: 'Promo Table Crew Cover',
      created_by: ownerUser.id, publication_status: 'published',
    })
    const assignment = shift && await assignShift(shift.id, casual2User.id, ownerUser.id, userIdMap['employee2@test.com'].internalId)
    if (assignment) casual2Assignments[dateKey(dayDate)] = assignment
  }
  // Present, Late (25 min), Absent (no record), Present — exactly 1 Late + 1 No-show this period.
  await clockRecord(casual2Assignments[dateKey(addDays(TODAY, -6))], casual2User.id, { dateStr: dateKey(addDays(TODAY, -6)), endStr: '13:00' })
  await clockRecord(casual2Assignments[dateKey(addDays(TODAY, -5))], casual2User.id, { dateStr: dateKey(addDays(TODAY, -5)), endStr: '13:00', lateMinutes: 25 })
  // -4 天：故意不打卡 → Absent / No-show
  await clockRecord(casual2Assignments[dateKey(addDays(TODAY, -3))], casual2User.id, { dateStr: dateKey(addDays(TODAY, -3)), endStr: '13:00' })
  console.log('  ✓ Farah Aziz 本期 4 条 Marketing 部门班次：Present / Late 25min / No-show / Present')

  const { error: cwd2Err } = await supabase.from('casualworker_departments').upsert({
    casual_worker_id: casual2User.id,
    department_id: depts[1].id,
    company_id: company.id,
    verified_at: new Date().toISOString(),
  }, { onConflict: 'casual_worker_id,department_id' })
  if (cwd2Err) console.warn(`  ⚠ 创建第二个 casualworker_departments 失败: ${cwd2Err.message}`)
  else console.log('  ✓ Farah Aziz 已验证——Team/Company 页 Casual Workers 面板可见，Report 的 Workers Needing Attention 现在有数据')

  // ── Step 14: 创建 Shift Swap Settings + Requests（UC52/53）──────────────────
  // 不种 shift_swap_settings 的话 Rule Check 区块（Within monthly limit / Before deadline
  // 那些绿色胶囊）不会渲染——ruleConfigured 只在公司配置过规则时才为 true。
  console.log('\nStep 14: 创建 Shift Swap Settings + Requests...')
  const { error: swapSettingsErr } = await supabase.from('shift_swap_settings').upsert({
    company_id: company.id,
    auto_approval_enabled: false,
    monthly_swap_limit: 3,
    deadline_hours_before_shift: 24,
    require_review_on_limit_exceeded: true,
    require_review_on_deadline_exceeded: true,
    updated_by: ownerUser.id,
  }, { onConflict: 'company_id' })
  if (swapSettingsErr) console.warn(`  ⚠ 创建 shift_swap_settings 失败: ${swapSettingsErr.message}`)
  else console.log('  ✓ Shift Swap Settings：月度上限 3 次/人，提前 24 小时截止（Rule Check 胶囊现在会显示）')

  // David Lim (manager1) / Wendy Ho (manager5) 故意不种 pending swap request——两人是留给 Manager
  // 自己在 UI 上测 Submit Shift Swap 用的干净数据（futMgr1Assign / futMgr5Assign 都已建好未来班次，
  // 同部门 Operations，随时可以互选对方提交）。O/P 审批队列改用 Rachel Koh (manager2) ↔
  // Kelvin Ang (manager6) 顶上，覆盖 UC53。
  if (futMgr2Assign && futMgr6Assign) {
    const { error } = await supabase.from('shift_swap_requests').insert({
      company_id: company.id,
      requester_id: userIdMap['manager2@test.com'].internalId,
      requester_assignment_id: futMgr2Assign.id,
      counterpart_id: userIdMap['manager6@test.com'].internalId,
      counterpart_assignment_id: futMgr6Assign.id,
      status: 'pending',
      counterpart_status: 'approved', // 对方已同意，直接落在 Owner/Partner 的可决策队列里
      reason: 'Need to cover a family commitment that week — Kelvin already agreed to trade.',
    })
    if (error) console.warn(`  ⚠ 创建 Manager↔Manager swap 失败: ${error.message}`)
    else console.log('  ✓ Shift Swap: Rachel Koh ↔ Kelvin Ang（对方已同意，Owner/Partner 队列可直接 Approve/Reject，UC53）')
  }
  if (futEmp1Assign && futEmp2Assign) {
    const { error } = await supabase.from('shift_swap_requests').insert({
      company_id: company.id,
      requester_id: userIdMap['employee1@test.com'].internalId,
      requester_assignment_id: futEmp1Assign.id,
      counterpart_id: userIdMap['employee2@test.com'].internalId,
      counterpart_assignment_id: futEmp2Assign.id,
      status: 'pending',
      counterpart_status: 'approved',
      reason: "Swapping to attend a friend's event — Chloe already agreed to trade.",
    })
    if (error) console.warn(`  ⚠ 创建 Employee↔Employee swap 失败: ${error.message}`)
    else console.log('  ✓ Shift Swap: Ben Seah ↔ Chloe Yeo（Employee 之间的换班，Owner/Partner 队列应该看不到——用来验证会路由给 Manager 的隔离规则）')
  }

  // ── Step 15: 创建 Fixed Day Off Requests（UC54/55/57）───────────────────────
  console.log('\nStep 15: 创建 Fixed Day Off Requests...')
  const { error: offApprovedErr } = await supabase.from('employee_off_day_requests').insert({
    user_id: userIdMap['employee3@test.com'].internalId,
    company_id: company.id,
    request_date: dateKey(TODAY),
    week_start: dateKey(mondayOf(TODAY)),
    source: 'submitted',
    status: 'approved',
  })
  if (offApprovedErr) console.warn(`  ⚠ 创建已批准 Off Day 失败: ${offApprovedErr.message}`)
  else console.log('  ✓ Off Day（已批准）：Daniel Tay 今天休息 —— Records Tab 本周日历里应显示紫色 Off Day 胶囊')

  const weekStartNext = dateKey(NEXT_MON)

  // Ben Seah and Grace Lim both request the SAME day (NEXT_MON) in Operations, which now has 2
  // Employees — so AI Process's first-come-first-served check has real headroom to work with:
  // whoever's request lands in the DB first is measured against nobody else being off yet (safe),
  // the second collides with the first (flagged) AND — because the department has 2 people, not
  // 1 — there IS a real alternative day, so the AI can actually suggest one. Sequential awaits
  // (not Promise.all) so created_at ordering between the two is guaranteed.
  const { error: offSafeErr } = await supabase.from('employee_off_day_requests').insert({
    user_id: userIdMap['employee1@test.com'].internalId,
    company_id: company.id,
    request_date: weekStartNext,
    week_start: weekStartNext,
    source: 'submitted',
    status: 'pending',
  })
  if (offSafeErr) console.warn(`  ⚠ 创建 pending Off Day 失败 (employee1): ${offSafeErr.message}`)
  else console.log(`  ✓ Off Day（待审批）：Ben Seah → ${weekStartNext}（Operations 现有 2 个 Employee，先提交的这条 AI Process 应判定 safe）`)

  const { error: offFlaggedErr } = await supabase.from('employee_off_day_requests').insert({
    user_id: userIdMap['employee5@test.com'].internalId,
    company_id: company.id,
    request_date: weekStartNext,
    week_start: weekStartNext,
    source: 'submitted',
    status: 'pending',
  })
  if (offFlaggedErr) console.warn(`  ⚠ 创建 pending Off Day 失败 (employee5): ${offFlaggedErr.message}`)
  else console.log(`  ✓ Off Day（待审批）：Grace Lim → ${weekStartNext}（跟 Ben Seah 撞同一天且后提交，AI Process 应判定 flagged 并给出真实的替代日建议）`)

  const { error: offMgrErr } = await supabase.from('employee_off_day_requests').insert({
    user_id: userIdMap['manager3@test.com'].internalId,
    company_id: company.id,
    request_date: dateKey(NEXT_TUE),
    week_start: weekStartNext,
    source: 'submitted',
    status: 'pending',
  })
  if (offMgrErr) console.warn(`  ⚠ 创建 pending Off Day 失败 (manager3): ${offMgrErr.message}`)
  else console.log(`  ✓ Off Day（待审批）：Aaron Wong → ${dateKey(NEXT_TUE)}（Manager 自己的申请，同样是 O/P 审批；Engineering 现在有 manager3+manager7 两个 Manager，AI Process 应判定 safe——覆盖"Manager 自己申请 Off Day"这个提交路径，跟 Ben/Grace 那组 Employee 场景分开测）`)

  const { error: offConflictErr } = await supabase.from('employee_off_day_requests').insert({
    user_id: userIdMap['employee4@test.com'].internalId,
    company_id: company.id,
    request_date: dateKey(NEXT_WED),
    week_start: weekStartNext,
    source: 'submitted',
    status: 'pending',
  })
  if (offConflictErr) console.warn(`  ⚠ 创建 pending Off Day 失败 (employee4): ${offConflictErr.message}`)
  else console.log(`  ✓ Off Day（待审批）：Elaine Chua → ${dateKey(NEXT_WED)}（当天她已经有排好的班次——AI Process 不检查排班冲突，只检查部门人数，这条仅供手动测试"批准了跟已排班撞期的休假会怎样"）`)

  // ── Step 16: 创建 Job Templates + Shift Templates（Recruitment/Shift 模板列表不再留白）──
  console.log('\nStep 16: 创建 Job Templates + Shift Templates...')
  const jobTemplateDefs = [
    {
      company_id: company.id, created_by: ownerUser.id, name: 'Standard Event Crew',
      title: 'Event Crew', description: 'General event support — setup, registration desk, and teardown.',
      requirements: 'Comfortable on your feet for a full shift, punctual.',
      employment_type: 'Part-time', form_type: 'oneoff', department_id: depts[0].id,
      salary_amount: 15, salary_type: 'flat rate', uniform_required: false,
      experience_required: 'Not Required', minimum_age: 16, estimated_hours: '6', urgency: 'normal',
    },
    {
      company_id: company.id, created_by: ownerUser.id, name: 'Weekend Warehouse Shift',
      title: 'Warehouse Assistant', description: 'Recurring weekend stock-count and inventory shift.',
      requirements: 'Basic spreadsheet use, comfortable with repetitive tasks.',
      employment_type: 'Part-time', form_type: 'shift', department_id: depts[2].id,
      salary_amount: 13.5, salary_type: 'per hour', uniform_required: false,
      experience_required: '6+ Months', minimum_age: 18, urgency: 'normal',
    },
    // Manager-created (David Lim, Operations) — so manager1@test.com has a template of their own
    // to test UC37 Edit Job Template with (Job Templates are creator-only to edit, department-only
    // to view — Owner's two templates above are invisible to a Manager, see jobTemplateRepository).
    {
      company_id: company.id, created_by: userIdMap['manager1@test.com'].internalId, name: 'Weekend Café Cover',
      title: 'Café Cover Staff', description: 'Cover the café counter for a weekend rush — orders, till, and light cleaning.',
      requirements: 'Comfortable handling cash, friendly with customers.',
      employment_type: 'Part-time', form_type: 'oneoff', department_id: depts[0].id,
      salary_amount: 16, salary_type: 'flat rate', uniform_required: false,
      experience_required: 'Not Required', minimum_age: 16, estimated_hours: '5', urgency: 'normal',
    },
  ]
  for (const def of jobTemplateDefs) {
    const { error } = await supabase.from('job_templates').insert(def)
    if (error) console.warn(`  ⚠ 创建 job_template 失败 (${def.name}): ${error.message}`)
    else console.log(`  ✓ Job Template: ${def.name}`)
  }

  const shiftTemplateDefs = [
    { company_id: company.id, name: 'Morning Shift (9am-5pm)', start_time: '09:00', end_time: '17:00', created_by: ownerUser.id },
    { company_id: company.id, name: 'Evening Shift (2pm-10pm)', start_time: '14:00', end_time: '22:00', created_by: ownerUser.id },
  ]
  for (const def of shiftTemplateDefs) {
    const { error } = await supabase.from('shift_templates').insert(def)
    if (error) console.warn(`  ⚠ 创建 shift_template 失败 (${def.name}): ${error.message}`)
    else console.log(`  ✓ Shift Template: ${def.name}`)
  }

  // ── Step 17: 创建 1 条 Archived Job Posting（Archived 列表不再留白）──────────
  console.log('\nStep 17: 创建 Archived Job Posting...')
  const { error: archivedErr } = await supabase.from('job_postings').insert({
    company_id: company.id, department_id: depts[3].id, created_by: ownerUser.id,
    title: 'Holiday Season Support — Customer Support', description: 'Extra overnight support coverage for the holiday rush.',
    requirements: 'Clear written English, own laptop.', location: company.location,
    employment_type: 'Part-time', status: 'archived', form_type: 'oneoff', urgency: 'normal',
    estimated_hours: '6', job_start_time: '20:00', openings: 2, experience_required: 'Not Required',
    minimum_age: 18, uniform_required: false, salary_amount: 15, expires_at: dateKey(TWO_DAYS_AGO),
    archived_at: new Date().toISOString(), archived_from_status: 'closed',
  })
  if (archivedErr) console.warn(`  ⚠ 创建 archived job_posting 失败: ${archivedErr.message}`)
  else console.log('  ✓ Job Posting [archived]: Holiday Season Support — Customer Support')

  // Report 页的 Hiring Success Rate / Average Time to Fill 只统计 status='closed' 且 created_at
  // 落在所选日期范围内的 posting（getClosedPostingsByDateRange）——种一条职位全部招满、created_at
  // 明确回填到 5 天前的 closed posting，这两个指标才有真实数字而不是 "No data"。
  const closedCreatedAt = dueAtOn(addDays(TODAY, -5), 9)
  const closedConfirmedAt = dueAtOn(addDays(TODAY, -3), 15)
  const { data: closedJob, error: closedJobErr } = await supabase.from('job_postings').insert({
    company_id: company.id, department_id: depts[1].id, created_by: ownerUser.id,
    title: 'Product Launch Day Crew', description: 'One-day crew to support an in-store product launch event.',
    requirements: 'Outgoing, comfortable talking to customers.', location: company.location,
    employment_type: 'Part-time', status: 'closed', form_type: 'oneoff', urgency: 'normal',
    estimated_hours: '5', shift_date: dateKey(addDays(TODAY, -2)), job_start_time: '10:00',
    openings: 1, experience_required: 'Not Required', minimum_age: 16, uniform_required: false,
    salary_amount: 80, expires_at: dateKey(addDays(TODAY, -3)), created_at: closedCreatedAt,
  }).select().single()
  if (closedJobErr) {
    console.warn(`  ⚠ 创建 closed job_posting 失败: ${closedJobErr.message}`)
  } else {
    const { data: closedApp, error: closedAppErr } = await supabase.from('job_applicants').insert({
      job_id: closedJob.id, user_id: userIdMap['guest3@test.com'].internalId,
      resume_url: guestApplicants.find(g => g.email === 'guest3@test.com').resume_url, status: 'accepted',
      relevant_experience: 'less_than_1', decided_at: closedConfirmedAt,
    }).select().single()
    if (closedAppErr) {
      console.warn(`  ⚠ 创建 job_applicant 失败 (Product Launch Day Crew): ${closedAppErr.message}`)
    } else {
      const { error: closedInviteErr } = await supabase.from('job_invitations').insert({
        job_id: closedJob.id, applicant_id: closedApp.id, sent_by: ownerUser.id, status: 'accepted',
        responded_at: closedConfirmedAt,
      })
      if (closedInviteErr) console.warn(`  ⚠ 创建 job_invitation 失败 (Product Launch Day Crew): ${closedInviteErr.message}`)
      else console.log('  ✓ Job Posting [closed]: Product Launch Day Crew（Kai Xuan Ong 已招满，2 天填满，Hiring Success Rate / Average Time to Fill 有数据）')
    }
  }

  // Product Launch Day Crew above was the ONLY closed posting, so Hiring Success Rate / Average
  // Time to Fill only ever plotted one bar (Marketing). Three more closed postings, spread across
  // the other three departments with different outcomes (fast full fill / partial fill / slow full
  // fill), so both charts show real per-department variety instead of a single data point.
  async function createClosedJobPosting({ departmentId, title, description, requirements, openings, hires, createdDaysAgo, confirmedDaysAgo, salary }) {
    const createdAt = dueAtOn(addDays(TODAY, -createdDaysAgo), 9)
    const confirmedAt = dueAtOn(addDays(TODAY, -confirmedDaysAgo), 15)
    const { data: job, error: jobErr } = await supabase.from('job_postings').insert({
      company_id: company.id, department_id: departmentId, created_by: ownerUser.id,
      title, description, requirements, location: company.location,
      employment_type: 'Part-time', status: 'closed', form_type: 'oneoff', urgency: 'normal',
      estimated_hours: '5', shift_date: dateKey(addDays(TODAY, -confirmedDaysAgo)), job_start_time: '10:00',
      openings, experience_required: 'Not Required', minimum_age: 16, uniform_required: false,
      salary_amount: salary, expires_at: dateKey(addDays(TODAY, -confirmedDaysAgo)), created_at: createdAt,
    }).select().single()
    if (jobErr) { console.warn(`  ⚠ 创建 closed job_posting 失败 (${title}): ${jobErr.message}`); return }
    for (const guestEmail of hires) {
      const { data: app, error: appErr } = await supabase.from('job_applicants').insert({
        job_id: job.id, user_id: userIdMap[guestEmail].internalId,
        resume_url: guestApplicants.find(g => g.email === guestEmail).resume_url, status: 'accepted',
        relevant_experience: 'less_than_1', decided_at: confirmedAt,
      }).select().single()
      if (appErr) { console.warn(`  ⚠ 创建 job_applicant 失败 (${title} / ${guestEmail}): ${appErr.message}`); continue }
      const { error: inviteErr } = await supabase.from('job_invitations').insert({
        job_id: job.id, applicant_id: app.id, sent_by: ownerUser.id, status: 'accepted', responded_at: confirmedAt,
      })
      if (inviteErr) console.warn(`  ⚠ 创建 job_invitation 失败 (${title} / ${guestEmail}): ${inviteErr.message}`)
    }
    console.log(`  ✓ Job Posting [closed]: ${title}（${hires.length}/${openings} 招满，${departmentId === depts[0].id ? 'Operations' : departmentId === depts[2].id ? 'Engineering' : 'Customer Support'}）`)
  }

  await createClosedJobPosting({
    departmentId: depts[0].id, title: 'Weekend Warehouse Restock Crew',
    description: 'Two-person crew to restock the warehouse floor ahead of the weekend rush.',
    requirements: 'Comfortable with physical, repetitive work.',
    openings: 2, hires: ['guest1@test.com', 'guest5@test.com'], createdDaysAgo: 6, confirmedDaysAgo: 5, salary: 70,
  })
  await createClosedJobPosting({
    departmentId: depts[2].id, title: 'IT Helpdesk Temp Support',
    description: 'Temporary helpdesk coverage for a hardware refresh rollout.',
    requirements: 'Basic troubleshooting and networking knowledge.',
    openings: 3, hires: ['guest2@test.com'], createdDaysAgo: 6, confirmedDaysAgo: 4, salary: 90,
  })
  await createClosedJobPosting({
    departmentId: depts[3].id, title: 'Weekend Support Overflow Crew',
    description: 'Extra hands to clear the weekend support ticket backlog.',
    requirements: 'Clear written English, calm under pressure.',
    openings: 2, hires: ['guest4@test.com', 'guest3@test.com'], createdDaysAgo: 6, confirmedDaysAgo: 1, salary: 75,
  })

  // ── Step 18: 给 Marcus Lee 建一个"现在就能打卡"的开放 Casual Worker 工作（UC49）──
  // 时间从真实当下往前推 10 分钟起、往后 4 小时止，跑完 seed 立刻登录 casual1@test.com
  // 就能在 Dashboard 上看到 Clock In 按钮可点；不是 open-ended，达到 end_time 后 Clock Out
  // 不需要主管先 Release。shift_date 用 UTC 日历日，跟打卡窗口判定用的时区口径保持一致。
  console.log('\nStep 18: 创建 Casual Worker 当前可打卡的工作...')
  const cwOpenStart = new Date(Date.now() - 10 * 60000)
  const cwOpenEnd = new Date(Date.now() + 4 * 60 * 60000)
  // UTC calendar date — matches both the Clock In gate (casualAttendanceService.clockIn) and the
  // Casual Dashboard's "which jobs show up" query (casualDashboardService.findCurrentAssignment,
  // fixed to use the same UTC day instead of local — see that file for why the two need to agree).
  const cwOpenShiftDate = dateKeyUTC(cwOpenStart)

  // openings: 1 and the single applicant below is inserted directly as 'accepted' (i.e. already
  // confirmed) — in the real app, respondToInvitation's auto-close (acceptedCount >= openings)
  // would flip this to 'closed' the moment that confirmation lands. Seeding bypasses that service
  // call, so the row must be inserted already 'closed' or it sits in Active Jobs fully filled,
  // which is exactly the inconsistency this seed step exists to avoid.
  const { data: cwOpenJob, error: cwOpenJobErr } = await supabase.from('job_postings').insert({
    company_id: company.id, department_id: depts[0].id, created_by: ownerUser.id,
    title: 'Same-Day Café Cover Shift', description: 'Cover the café counter for a same-day gap in the roster.',
    requirements: 'Available immediately, comfortable handling cash and orders.', location: company.location,
    employment_type: 'Part-time', status: 'closed', archived_at: new Date().toISOString(), form_type: 'oneoff', urgency: 'urgent',
    estimated_hours: '4', shift_date: cwOpenShiftDate, job_start_time: toHM(cwOpenStart),
    openings: 1, experience_required: 'Not Required', minimum_age: 16, uniform_required: false,
    salary_amount: 16, expires_at: dateKey(addDays(TODAY, 3)),
  }).select().single()
  if (cwOpenJobErr) {
    console.warn(`  ⚠ 创建 job_posting 失败 (Same-Day Café Cover Shift): ${cwOpenJobErr.message}`)
  } else {
    const { data: cwOpenApp, error: cwOpenAppErr } = await supabase.from('job_applicants').insert({
      job_id: cwOpenJob.id, user_id: userIdMap['casual1@test.com'].internalId,
      resume_url: 'https://example.com/demo-resumes/marcus-lee-resume.pdf', status: 'accepted',
      relevant_experience: 'less_than_1', additional_note: "I've covered this counter before — happy to jump in today.",
    }).select().single()
    if (cwOpenAppErr) {
      console.warn(`  ⚠ 创建 job_applicant 失败 (Marcus Lee): ${cwOpenAppErr.message}`)
    } else {
      const { error: cwOpenInviteErr } = await supabase.from('job_invitations').insert({
        job_id: cwOpenJob.id, applicant_id: cwOpenApp.id, sent_by: ownerUser.id, status: 'accepted',
      })
      if (cwOpenInviteErr) console.warn(`  ⚠ 创建 job_invitation 失败: ${cwOpenInviteErr.message}`)
    }

    const cwOpenShift = await createShift({
      company_id: company.id, department_id: depts[0].id, shift_date: cwOpenShiftDate,
      start_time: toHM(cwOpenStart), end_time: toHM(cwOpenEnd), is_open_ended: false,
      title: cwOpenJob.title, created_by: ownerUser.id, publication_status: 'published',
      source_job_posting_id: cwOpenJob.id,
    })
    if (cwOpenShift) {
      await assignShift(cwOpenShift.id, userIdMap['casual1@test.com'].internalId, ownerUser.id, userIdMap['employee1@test.com'].internalId)
      console.log(`  ✓ Marcus Lee 的开放班次：${cwOpenJob.title}（今天 ${toHM(cwOpenStart)}–${toHM(cwOpenEnd)} UTC，登录 casual1@test.com 立刻可 Clock In，主管 Ben Seah）`)

      // Ben Seah（主管，employee1）给 Marcus 分派的 Task——挂在这个当前班次的 shift_id 上，
      // CasualTaskBoard 是按 shift_id 过滤 + 前端再按 assigned_user_id 过滤当前用户的任务，
      // 三个不同状态铺满 Kanban 的三列（Assigned/In Progress/Review），Complete 留一条历史任务。
      await createTask({
        company_id: company.id, department_id: depts[0].id, shift_id: cwOpenShift.id,
        title: 'Set up café counter float', description: 'Count the cash float and set up the till before opening.',
        assigned_user_id: userIdMap['casual1@test.com'].internalId, assigned_by: userIdMap['employee1@test.com'].internalId,
        status: 'Assigned', due_at: dueAtOn(TODAY), priority: 'High',
      })
      await createTask({
        company_id: company.id, department_id: depts[0].id, shift_id: cwOpenShift.id,
        title: 'Restock napkins and cup sleeves', description: 'Check front counter stock and top up from the back storeroom.',
        assigned_user_id: userIdMap['casual1@test.com'].internalId, assigned_by: userIdMap['employee1@test.com'].internalId,
        status: 'In Progress', due_at: dueAtOn(TODAY), percentage_complete: 50, priority: 'Medium',
      })
      await createTask({
        company_id: company.id, department_id: depts[0].id, shift_id: cwOpenShift.id,
        title: 'Wipe down and reset outdoor seating', description: 'Clean tables and chairs, reset umbrellas for the next customers.',
        assigned_user_id: userIdMap['casual1@test.com'].internalId, assigned_by: userIdMap['employee1@test.com'].internalId,
        status: 'Review', due_at: dueAtOn(TODAY), percentage_complete: 90, priority: 'Low',
      })
      await createTask({
        company_id: company.id, department_id: depts[0].id, shift_id: cwOpenShift.id,
        title: 'Brief opening checklist to Marcus', description: 'Walk through the opening checklist before the counter opens.',
        assigned_user_id: userIdMap['casual1@test.com'].internalId, assigned_by: userIdMap['employee1@test.com'].internalId,
        status: 'Complete', due_at: dueAtOn(YESTERDAY), percentage_complete: 100,
      })
      console.log('  ✓ Ben Seah 给 Marcus Lee 分派的 4 条 Task（挂在当前班次 shift_id 上，Kanban 三列 + 1 条历史）')
    }
  }

  // ── Step 19: 创建 Tasks（Task 页 + Dashboard Task Overview 三个桶都有数据，UC12-23）──
  console.log('\nStep 19: 创建 Tasks...')
  await createTask({
    company_id: company.id, department_id: depts[0].id, title: 'Finalize event staffing roster',
    description: "Confirm who is covering each position for Saturday's event.",
    assigned_user_id: userIdMap['manager1@test.com'].internalId, assigned_by: ownerUser.id,
    status: 'Assigned', due_at: dueAtOn(TOMORROW), priority: 'High',
  })
  await createTask({
    company_id: company.id, department_id: depts[1].id, title: 'Review Q3 campaign budget',
    description: 'Check spend against the approved Q3 marketing budget.',
    assigned_user_id: userIdMap['manager2@test.com'].internalId, assigned_by: ownerUser.id,
    status: 'In Progress', due_at: dueAtOn(YESTERDAY), percentage_complete: 40, priority: 'High',
  })
  await createTask({
    company_id: company.id, department_id: depts[2].id, title: 'Sign off warehouse safety audit',
    description: 'Review the completed safety checklist and sign off.',
    assigned_user_id: userIdMap['manager3@test.com'].internalId, assigned_by: ownerUser.id,
    status: 'Review', due_at: dueAtOn(TODAY), percentage_complete: 90, priority: 'Medium',
  })
  await createTask({
    company_id: company.id, department_id: depts[3].id, title: 'Submit monthly support metrics',
    description: "Compile and submit last month's support ticket metrics.",
    assigned_user_id: userIdMap['manager4@test.com'].internalId, assigned_by: ownerUser.id,
    status: 'Complete', due_at: dueAtOn(TWO_DAYS_AGO), percentage_complete: 100,
  })
  await createTask({
    company_id: company.id, department_id: depts[0].id, title: 'Approve overtime requests',
    description: 'Review and approve pending overtime requests for this week.',
    assigned_user_id: userIdMap['manager1@test.com'].internalId, assigned_by: userIdMap['partner1@test.com'].internalId,
    status: 'Assigned', due_at: dueAtOn(addDays(TODAY, 2)), priority: 'Medium',
  })
  await createTask({
    company_id: company.id, department_id: depts[2].id, title: 'Review new hire onboarding checklist',
    description: 'Make sure the onboarding checklist is up to date before the next intake.',
    assigned_user_id: userIdMap['manager3@test.com'].internalId, assigned_by: userIdMap['partner1@test.com'].internalId,
    status: 'In Progress', due_at: dueAtOn(YESTERDAY), percentage_complete: 20, priority: 'Low',
  })
  const t7 = await createTask({
    company_id: company.id, department_id: depts[0].id, title: 'Restock front counter supplies',
    description: 'Check and restock counter supplies before the weekend rush.',
    assigned_user_id: userIdMap['employee1@test.com'].internalId, assigned_by: userIdMap['manager1@test.com'].internalId,
    status: 'In Progress', due_at: dueAtOn(TODAY), percentage_complete: 50, priority: 'Medium',
  })
  await createTask({
    company_id: company.id, department_id: depts[1].id, title: 'Draft social media captions for weekend promo',
    description: 'Draft 5 captions for the weekend promo posts.',
    assigned_user_id: userIdMap['employee2@test.com'].internalId, assigned_by: userIdMap['manager2@test.com'].internalId,
    status: 'Assigned', due_at: dueAtOn(TOMORROW), priority: 'Medium',
  })
  await createTask({
    company_id: company.id, department_id: depts[2].id, title: 'Update inventory count spreadsheet',
    description: "Reconcile last week's counts into the master spreadsheet.",
    assigned_user_id: userIdMap['employee3@test.com'].internalId, assigned_by: userIdMap['manager3@test.com'].internalId,
    status: 'Review', due_at: dueAtOn(TODAY), percentage_complete: 95, priority: 'High',
  })
  await createTask({
    company_id: company.id, department_id: depts[3].id, title: 'Clear support ticket backlog',
    description: 'Work through the remaining open tickets from last week.',
    assigned_user_id: userIdMap['employee4@test.com'].internalId, assigned_by: userIdMap['manager4@test.com'].internalId,
    status: 'Complete', percentage_complete: 100,
  })
  if (t7) {
    await createTask({
      company_id: company.id, department_id: depts[0].id, title: 'Count current stock',
      parent_task_id: t7.id, sequence_order: 1,
      assigned_user_id: userIdMap['employee1@test.com'].internalId, assigned_by: userIdMap['manager1@test.com'].internalId,
      status: 'Complete', percentage_complete: 100,
    })
    await createTask({
      company_id: company.id, department_id: depts[0].id, title: 'Place supplier order',
      parent_task_id: t7.id, sequence_order: 2,
      assigned_user_id: userIdMap['employee1@test.com'].internalId, assigned_by: userIdMap['manager1@test.com'].internalId,
      status: 'Assigned', due_at: dueAtOn(TOMORROW),
    })
  }

  // ── Step 19a: Operations 部门第二位 Manager（Wendy Ho）分派的 Tasks ──────────
  // manager1@test.com (David Lim) 登录后测 Manager Tasks 页时，Kanban 的团队范围（
  // getManagerTeamScope）会把同部门的 peer Manager 也算进去——之前 Operations 里所有 Task
  // 都是 David 自己分派的，Wendy Ho 一条没有，Manager 选择器/看板永远看不到"来自另一位
  // Manager 的任务"这个真实场景。这里补齐 Wendy → Ben Seah / Grace Lim 的任务，四种状态
  // 各覆盖到（含一条 Review，供 David 用 Approve/Reject 测 assertCanActOnTaskAsPeer），
  // 且每条都带齐 description/priority/due_at——不是只有 title 的半成品数据。
  const wendyOpsTask1 = await createTask({
    company_id: company.id, department_id: depts[0].id, title: 'Reconcile weekend register discrepancies',
    description: "Compare Saturday and Sunday's register totals against the POS sales report and flag any discrepancy over $5.",
    assigned_user_id: userIdMap['employee1@test.com'].internalId, assigned_by: userIdMap['manager5@test.com'].internalId,
    status: 'In Progress', due_at: dueAtOn(TOMORROW), percentage_complete: 35, priority: 'High',
  })
  await createTask({
    company_id: company.id, department_id: depts[0].id, title: 'Prepare loading dock for incoming stock',
    description: "Clear the loading dock and stage the pallet jacks ahead of tomorrow's delivery truck.",
    assigned_user_id: userIdMap['employee5@test.com'].internalId, assigned_by: userIdMap['manager5@test.com'].internalId,
    status: 'Assigned', due_at: dueAtOn(YESTERDAY), priority: 'Medium',
  })
  await createTask({
    company_id: company.id, department_id: depts[0].id, title: 'Submit weekly cash-handling report',
    description: 'Compile this week\'s cash-handling log into the standard template and submit it for manager sign-off.',
    assigned_user_id: userIdMap['employee1@test.com'].internalId, assigned_by: userIdMap['manager5@test.com'].internalId,
    status: 'Review', due_at: dueAtOn(TODAY), percentage_complete: 100, priority: 'Medium',
  })
  await createTask({
    company_id: company.id, department_id: depts[0].id, title: "Archive last month's supplier invoices",
    description: 'Scan and file last month\'s supplier invoices into the shared archive folder, sorted by vendor.',
    assigned_user_id: userIdMap['employee5@test.com'].internalId, assigned_by: userIdMap['manager5@test.com'].internalId,
    status: 'Complete', due_at: dueAtOn(TWO_DAYS_AGO), percentage_complete: 100, completed_at: dueAtOn(TWO_DAYS_AGO),
  })
  if (wendyOpsTask1) {
    await createTask({
      company_id: company.id, department_id: depts[0].id, title: 'Cross-check till counts',
      parent_task_id: wendyOpsTask1.id, sequence_order: 1,
      assigned_user_id: userIdMap['employee1@test.com'].internalId, assigned_by: userIdMap['manager5@test.com'].internalId,
      status: 'Complete', percentage_complete: 100,
    })
    await createTask({
      company_id: company.id, department_id: depts[0].id, title: 'File discrepancy report',
      parent_task_id: wendyOpsTask1.id, sequence_order: 2,
      assigned_user_id: userIdMap['employee1@test.com'].internalId, assigned_by: userIdMap['manager5@test.com'].internalId,
      status: 'Assigned', due_at: dueAtOn(TOMORROW),
    })
  }
  // David Lim (manager1) 自己也需要一条 Review 状态的 Task——之前 Operations 里 David 分派的
  // 任务只有 Assigned/In Progress/Complete，没有 Review，Approve/Reject 面板测不到"审批自己
  // 分派的任务"这条路径（跟上面 Wendy 那条"审批同事分派的任务"的 peer 场景分开测）。
  await createTask({
    company_id: company.id, department_id: depts[0].id, title: 'Review new hire onboarding paperwork',
    description: "Check Grace's signed onboarding forms and W-9 for completeness before filing with HR.",
    assigned_user_id: userIdMap['employee5@test.com'].internalId, assigned_by: userIdMap['manager1@test.com'].internalId,
    status: 'Review', due_at: dueAtOn(TODAY), percentage_complete: 100, priority: 'Low',
  })
  console.log('  ✓ Operations 另加 Wendy Ho（manager5）分派给 Ben Seah/Grace Lim 的 4 条 Task（含 2 条子任务，4 种状态齐全）')
  console.log('    + David Lim（manager1）自己的 1 条 Review Task —— Manager Tasks 页现在同部门两位 Manager 的任务都有真实数据可测')

  // 再补几条 due_at 落在更早几天（3-7 天前）的已完成任务——Dashboard 的三个桶只看"最近"，
  // 但 Report 页的 On-time Task Completion Rate 是按所选日期范围统计 due_at 落在范围内的任务，
  // 默认范围不一定包含"今天/昨天"，所以这里单独给 Report 铺一批历史上按时完成的任务。
  // completed_at is only stamped by the app when a task is approved out of Review (see
  // 20260709040000_add_completed_at_to_tasks.sql) — a direct-insert 'Complete' row with no
  // completed_at reads as "missed its deadline" to Report's on-time-rate math. onTime:true backs
  // that in explicitly so Operations/Marketing/Engineering show a real completion rate on the
  // chart instead of flatlining at 0%; Customer Support is left onTime:false on purpose (see the
  // backlog block below).
  const historicalTaskDefs = [
    { dept: 0, title: 'Weekly stock reconciliation', description: "Reconcile this week's physical stock count against the system inventory and log variances.", priority: 'Medium', manager: 'manager1@test.com', employee: 'employee1@test.com', daysAgo: 3, onTime: true },
    { dept: 1, title: 'Social media performance recap', description: "Pull engagement numbers for this week's posts and summarize in the campaign tracker.", priority: 'Low', manager: 'manager2@test.com', employee: 'employee2@test.com', daysAgo: 4, onTime: true },
    { dept: 2, title: 'Equipment maintenance check', description: 'Run the scheduled maintenance checklist on the workshop equipment and log any faults.', priority: 'Medium', manager: 'manager3@test.com', employee: 'employee3@test.com', daysAgo: 5, onTime: true },
    { dept: 3, title: 'Customer feedback summary', description: "Summarize this week's customer feedback tickets into the monthly report template.", priority: 'Medium', manager: 'manager4@test.com', employee: 'employee4@test.com', daysAgo: 6, onTime: false },
    { dept: 0, title: 'Team briefing notes', description: "Write up notes from this week's team briefing and share with the department.", priority: 'Low', manager: 'manager1@test.com', employee: 'employee5@test.com', daysAgo: 7, onTime: true },
  ]
  for (const def of historicalTaskDefs) {
    const taskDueAt = dueAtOn(addDays(TODAY, -def.daysAgo))
    await createTask({
      company_id: company.id, department_id: depts[def.dept].id, title: def.title, description: def.description,
      assigned_user_id: userIdMap[def.employee].internalId, assigned_by: userIdMap[def.manager].internalId,
      status: 'Complete', due_at: taskDueAt, percentage_complete: 100, priority: def.priority,
      completed_at: def.onTime ? taskDueAt : null,
    })
  }
  console.log('  ✓ 12 条 Task：Owner→Manager ×4、Partner→Manager ×2、Manager→Employee ×4（含 2 条子任务）')
  console.log('    覆盖 Dashboard 的 Overdue / Due Soon / Completed 三个桶，以及 Assigned/In Progress/Review/Complete 全部 4 种状态')
  console.log('  ✓ 另 5 条已完成 Task，due_at 分布在 3-7 天前，给 Report 的 On-time Task Completion Rate 铺历史数据（Customer Support 那条故意不算准时）')

  // Customer Support: 6 more tasks overdue or completed late, all due_at inside the current Report
  // window. Combined with the 'Customer feedback summary' task above (onTime:false), this gives
  // Customer Support a real ≥5-task on-time sample that is genuinely low, while its attendance
  // (Elaine/Fiona, clocked in normally in Step 13) stays high — staff showing up but delivery
  // slipping is exactly the cross-measure anomaly anomalyDetectionService.ts looks for.
  const customerSupportBacklog = [
    { title: 'Reconcile refund requests log', assignee: 'employee4@test.com', daysAgo: 6, status: 'Assigned', percentage_complete: 0 },
    { title: 'Rebuild FAQ knowledge base article', assignee: 'employee4@test.com', daysAgo: 5, status: 'Complete', percentage_complete: 100, completedDaysAgo: 2 },
    { title: 'Audit chat transcripts for compliance', assignee: 'manager4@test.com', daysAgo: 4, status: 'In Progress', percentage_complete: 60 },
    { title: 'Update support macros for new pricing', assignee: 'employee4@test.com', daysAgo: 3, status: 'In Progress', percentage_complete: 30 },
    { title: 'Follow up with VIP accounts', assignee: 'employee4@test.com', daysAgo: 3, status: 'Complete', percentage_complete: 100, completedDaysAgo: 1 },
    { title: 'Resolve escalated billing dispute', assignee: 'manager4@test.com', daysAgo: 1, status: 'Assigned', percentage_complete: 0 },
  ]
  for (const def of customerSupportBacklog) {
    const assignerEmail = def.assignee === 'manager4@test.com' ? 'partner1@test.com' : 'manager4@test.com'
    await createTask({
      company_id: company.id, department_id: depts[3].id, title: def.title,
      assigned_user_id: userIdMap[def.assignee].internalId, assigned_by: userIdMap[assignerEmail].internalId,
      status: def.status, due_at: dueAtOn(addDays(TODAY, -def.daysAgo)), percentage_complete: def.percentage_complete,
      completed_at: def.completedDaysAgo !== undefined ? dueAtOn(addDays(TODAY, -def.completedDaysAgo)) : null,
    })
  }
  console.log('  ✓ Customer Support 另加 6 条逾期/延迟 Task，on-time task completion rate 样本量够且真实偏低')

  // Operations: 8 more tasks concentrated almost entirely on one Employee (Ben Seah, 6 of 8).
  // Report's department charts aggregate everyone together, so one person quietly carrying most of
  // a department's load is otherwise invisible on the page — this is what the "work concentrated on
  // one person" anomaly in anomalyDetectionService.ts exists to surface. task_date (not due_at)
  // anchors these into the CURRENT report window: reportRepository.getTasksInRange buckets by
  // task_date when it's set, and only falls back to created_at (today, outside the window) when it
  // isn't — due_at is left null so these don't also skew the on-time-rate chart.
  const opsWorkloadDefs = [
    { title: 'Unload delivery truck', description: "Unload this morning's supplier truck and stage pallets in the receiving bay.", priority: 'Medium', assignee: 'employee1@test.com', daysAgo: 6, status: 'Complete', percentage_complete: 100 },
    { title: 'Restock aisle 3 shelving', description: 'Restock aisle 3 from the backroom overflow and front-face all items.', priority: 'Low', assignee: 'employee1@test.com', daysAgo: 5, status: 'Complete', percentage_complete: 100 },
    { title: 'Process customer return items', description: "Inspect and process yesterday's customer returns — restock sellable items, log damaged ones.", priority: 'Medium', assignee: 'employee1@test.com', daysAgo: 5, status: 'Complete', percentage_complete: 100 },
    { title: 'Set up weekend promo display', description: 'Build the weekend promo end-cap display per the layout sent by Marketing.', priority: 'Medium', assignee: 'employee1@test.com', daysAgo: 4, status: 'Complete', percentage_complete: 100 },
    { title: 'Sweep and mop stockroom', description: 'Sweep and mop the stockroom floor and clear any blocked walkways.', priority: 'Low', assignee: 'employee1@test.com', daysAgo: 3, status: 'In Progress', percentage_complete: 50 },
    { title: 'Label new inventory batch', description: "Print and apply shelf labels for this week's new inventory batch.", priority: 'Medium', assignee: 'employee1@test.com', daysAgo: 2, status: 'In Progress', percentage_complete: 20 },
    { title: 'Cover front register during lunch', description: "Cover the front register during Ben's lunch break, 12–1pm.", priority: 'Medium', assignee: 'employee5@test.com', daysAgo: 4, status: 'Complete', percentage_complete: 100 },
    { title: 'Review weekend staffing plan', description: 'Review the draft weekend roster for gaps before it goes out to the team.', priority: 'High', assignee: 'manager1@test.com', daysAgo: 3, status: 'In Progress', percentage_complete: 40 },
  ]
  for (const def of opsWorkloadDefs) {
    const assignerId = def.assignee === 'manager1@test.com' ? ownerUser.id : userIdMap['manager1@test.com'].internalId
    await createTask({
      company_id: company.id, department_id: depts[0].id, title: def.title, description: def.description,
      assigned_user_id: userIdMap[def.assignee].internalId, assigned_by: assignerId,
      status: def.status, percentage_complete: def.percentage_complete, priority: def.priority,
      task_date: dateKey(addDays(TODAY, -def.daysAgo)),
    })
  }
  console.log('  ✓ Operations 另加 8 条本期 Task，Ben Seah 占 6/8——给 Report 的「工作集中在一人身上」异常留下真实信号')

  // ── Step 20: 创建 Announcements + Messages（Communication 页两个 Tab 都有数据，UC58-61）──
  console.log('\nStep 20: 创建 Communication 数据...')
  const announcementDefs = [
    { from_user_id: ownerUser.id, company_id: company.id, department_id: null,
      title: 'Q3 All-Hands — This Friday 3pm', content: 'Join us this Friday at 3pm for the Q3 all-hands. Attendance is expected for all Managers and Employees.' },
    { from_user_id: ownerUser.id, company_id: company.id, department_id: depts[0].id,
      title: 'Updated opening checklist now posted', content: 'The updated opening checklist for Operations is now posted in the shared drive — please review before your next shift.' },
    { from_user_id: userIdMap['partner1@test.com'].internalId, company_id: company.id, department_id: null,
      title: 'Reminder: submit expense reports by month-end', content: 'Please submit any outstanding expense reports by the last day of the month so payroll can process them on time.' },
  ]
  for (const def of announcementDefs) {
    const { error } = await supabase.from('announcements').insert(def)
    if (error) console.warn(`  ⚠ 创建 announcement 失败 (${def.title}): ${error.message}`)
    else console.log(`  ✓ Announcement: ${def.title}`)
  }

  const messageDefs = [
    { from_user_id: ownerUser.id, from_name: 'Sarah Mitchell', to_email: 'manager1@test.com',
      content: "Can you confirm headcount for Saturday's event?", is_read: false },
    { from_user_id: userIdMap['manager1@test.com'].internalId, from_name: 'David Lim', to_email: 'owner@test.com',
      content: 'Yes, all positions are filled — 3 crew confirmed.', is_read: false },
    { from_user_id: userIdMap['partner1@test.com'].internalId, from_name: 'James Tan', to_email: 'employee2@test.com',
      content: 'Great job on the campaign visuals — clients loved them!', is_read: true },
    { from_user_id: userIdMap['manager3@test.com'].internalId, from_name: 'Aaron Wong', to_email: 'employee3@test.com',
      content: "Please prioritize the safety audit today, it's due this afternoon.", is_read: false },
  ]
  for (const def of messageDefs) {
    const { error } = await supabase.from('messages').insert({
      from_user_id: def.from_user_id,
      to_user_id: userIdMap[def.to_email].internalId,
      company_id: company.id,
      content: def.content,
      is_read: def.is_read,
      sender_name: def.from_name,
    })
    if (error) console.warn(`  ⚠ 创建 message 失败: ${error.message}`)
  }
  console.log('  ✓ 3 条 Announcement（company-wide ×2 + Operations 部门 ×1）+ 4 条 Message（含未读，Owner/Partner 收件箱都有）')

  console.log('\n═══════════════════════════════════════════')
  console.log('  完成！账号结构（密码全部 111111）：')
  console.log('  Owner:    owner@test.com')
  console.log('  Partner:  partner1@test.com')
  console.log('  Manager:  manager1-4@test.com（Operations / Marketing / Engineering / Customer Support，每部门第 1 个）')
  console.log('            + manager5-8@test.com（同一部门顺序对应，每部门第 2 个）')
  console.log('  Employee: employee1-4@test.com（同上一一对应，每部门第 1 个）+ employee5-8@test.com（每部门第 2 个）')
  console.log('  Guest:    guest1-5@test.com（求职者，带 skills/resume/certificates）')
  console.log('  Casual Worker: casual1@test.com（Marcus Lee，带一个现在就能 Clock In 的开放班次，见下）')
  console.log('  Recruitment 已种 6 条 Job Posting：')
  console.log('    Open             Weekend Event Crew（Operations，oneoff，3 个 pending 申请人：Wei Jie/Priyanka/Kai Xuan，可测 UC44/45/48）')
  console.log('    Open             Warehouse Stock Count（Engineering，shift 型/周末循环班，Amirah Yusof 已获 Offer 待 Accept/Decline，Wei Jie Lim 被 Rejected）')
  console.log('    Open             Retail Promo Day（Marketing，oneoff/urgent/uniform，Ryan Teo 已 Confirmed，Priyanka Das 被 Rejected，Wei Jie Lim 已获 Offer 待 Accept/Decline）')
  console.log('    Pending Approval Flyer Distribution（Marketing，Manager Rachel Koh 提交，可直接测 UC42）')
  console.log('    Draft            IT Support（Engineering，可测 UC39/UC40）')
  console.log('    Rejected         Live Chat Support（Customer Support，Manager Fiona Chen 提交，可测 Edit & Resubmit）')
  console.log('  Guest Applications 页（guest1-5@test.com 登录）四种状态齐全：')
  console.log('    Pending Review        Wei Jie Lim / Priyanka Das / Kai Xuan Ong → Weekend Event Crew')
  console.log('    Accept/Reject Offer   Amirah Yusof → Warehouse Stock Count；Wei Jie Lim → Retail Promo Day')
  console.log('    Confirmed             Ryan Teo → Retail Promo Day')
  console.log('    Not Selected/History  Priyanka Das → Retail Promo Day（同时她在 Weekend Event Crew 上仍是 Pending）；Wei Jie Lim → Warehouse Stock Count')
  console.log('    guest1@test.com（Wei Jie Lim）单人身上同时有 Pending + Offer Sent + History 三种卡片')
  console.log('  Attendance 已种（Records Tab 默认这一周就能看到，不用翻页）：')
  console.log('    前天：4 部门 Manager+Employee 全员 Present')
  console.log('    昨天：Ben Seah Late、Chloe Yeo Absent（无记录）、其余 Present、Marcus Lee(CW) Present')
  console.log('    今天：Daniel Tay 已批准 Off Day（紫色胶囊）')
  console.log('    Shift Swap：Rachel Koh ↔ Kelvin Ang（对方已同意，Owner/Partner 可直接 Approve/Reject，UC53）')
  console.log('               Ben Seah ↔ Chloe Yeo（Employee 之间，应只在 Manager 队列可见，验证隔离规则）')
  console.log('               David Lim (manager1) / Wendy Ho (manager5) 故意不种 pending —— 两人都有未来班次，Operations 同部门，留给 Manager 自己在 UI 上测 Submit Shift Swap')
  console.log('    Off Day 待提交：David Lim / Wendy Ho 都没有现成 pending/approved 记录，留给 Manager 自己测 Submit Fixed Day Off')
  console.log('    Off Day 待审批：Ben Seah + Grace Lim 撞同一天（Operations 2 人）—— AI Process 应判 Ben 为 safe、Grace 为 flagged 并给出替代日建议')
  console.log('                   Aaron Wong（Manager 自己的申请；Engineering 现有 manager3+manager7 两个 Manager，AI Process 应判 safe）')
  console.log('                   Elaine Chua（当天已有排班冲突，仅供手动测试，AI Process 不检查排班）')
  console.log('  Casual Worker Clock In：casual1@test.com 登录后 Dashboard 有 Same-Day Café Cover Shift 可直接 Clock In（UC49）')
  console.log('  Templates：Job Template ×2（Standard Event Crew / Weekend Warehouse Shift）+ Shift Template ×2')
  console.log('  Archived Job Posting：Holiday Season Support — Customer Support')
  console.log('  Task 已种 12 条：Owner→Manager ×4、Partner→Manager ×2、Manager→Employee ×4（含 2 条子任务）')
  console.log('    覆盖 Dashboard Overdue/Due Soon/Completed 三个桶 + Assigned/In Progress/Review/Complete 全部状态')
  console.log('  Communication 已种 3 条 Announcement（company-wide ×2 + Operations 部门 ×1）+ 4 条 Message（含未读）')
  console.log('═══════════════════════════════════════════')
}

main().catch(err => {
  console.error('\n✗ 脚本异常:', err.message)
  process.exit(1)
})
