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
 *   9. 创建过去 10 天 + 未来 7 天的常规排班（4 部门 × Manager+Employee，每个部门各自的时间窗口，
 *      Manager 时间窗口比 Employee 早开始/晚结束）+ 打卡记录（Present/Late/Absent 混合）+ 7 条
 *      Shift Swap 专属散班次（含 David Lim/Wendy Ho 的 Operations 换班用班次——特意不种 pending
 *      swap，留给 Manager 自己在 UI 上测 Submit）
 *   10. 创建 2 条 Shift Swap（Manager↔Manager 待 O/P 审批 + Employee↔Employee 验证隔离）
 *   11. 创建 4 条 Fixed Day Off（1 条已批准 + 3 条待批准，覆盖 safe/flagged+建议/flagged 无建议
 *       三种 AI Process 结果，另 1 条排班冲突供手动测试）
 *   12. 创建 2 条 Job Template + 2 条 Shift Template + 3 条 Task Template
 *   13. 创建 1 条 Archived Job Posting
 *   14. 给 Marcus Lee（Casual Worker）建一个「现在就能打卡」的开放工作 —— 时间以脚本
 *       运行时的真实当下为基准（往前 10 分钟起、往后 4 小时止），跑完 seed 立刻登录
 *       casual1@test.com 就能在 Dashboard 上点 Clock In
 *   15. 创建 Task（Owner→Manager / Partner→Manager / Manager→Employee，含子任务），覆盖 Overdue/
 *       Due Soon/Completed 三个 Dashboard 桶 + 全部 4 种状态 + Rework（4 部门都有）+ Archived
 *       （5 条）+ TODAY-7..TODAY+6 每天多部门都有到期任务，Overdue 均匀分布在最近 3 天内
 *   16. 创建 9 条 Company Activity Log（invite/remove/change_department/set_active/set_inactive）
 *   17. 创建 6 条 Announcement（Owner 5 + Partner 1）+ 10 条 Message（Owner 自己的 Chatbox 4 组对话）
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
// Monday of the week containing d (used for off_day_requests.week_start).
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
// Singapore-nominal) — build it from a local Date + local setHours so the stored instant still
// reads back as the intended calendar day regardless of the machine's timezone.
function dueAtOn(dateObj, hour = 17) {
  const d = new Date(dateObj)
  d.setHours(hour, 0, 0, 0)
  return d.toISOString()
}
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
// shifts.shift_date/start_time/end_time are Singapore-nominal wall-clock values (see
// src/lib/singaporeTime.ts's sgtInstant/sgtTodayKey — the app parses them with a fixed +08:00
// offset, not literal UTC). For a "now"-relative dynamic shift (e.g. "started 1h ago") to
// actually land on the real intended instant, its shift_date/start_time/end_time must be the
// Singapore wall-clock reading of that instant, not its raw UTC digits.
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
// A shift that hasn't ended yet (relative to the real "now" the script is actually running at,
// not TODAY's midnight) must never get a clock-out already on record — that would be an
// attendance record for an event that hasn't happened. Only ever gate TODAY's fixtures with this;
// past days are unambiguously over already.
function hasShiftEndedSGT(dateStr, endTime) {
  return Date.now() >= new Date(`${dateStr}T${endTime}:00.000+08:00`).getTime()
}

// lateMinutes=0 → Present；传大于0 → Late；不调用这个函数 → Absent（不建记录）。
// breakStart/breakEnd（可选，"HH:MM" 24小时制）→ 填充 break_in_time/break_out_time。
// clock_in/out/break 时间用 +08:00（新加坡时间）解析，跟 shift start_time="09:00" 被 App 的
// sgtInstant 解析成的真实时刻对齐——用字面 Z（UTC）会跟 App 的 Late/Absent 判定差 8 小时。
// modifiedBy/modifiedReason/modifiedClockInMinutes（可选）→ 同一条 insert 里带上 modified_*
// 字段，模拟"Owner/Partner/Manager 事后改过这条打卡记录"，raw 列还是原始值不变，Attendance
// Records 页对比 raw vs modified 会自动亮出 "M" (Modified) 徽章。
async function clockRecord(assignment, userId, { dateStr, endStr = '17:00', lateMinutes = 0, breakStart = null, breakEnd = null, modifiedBy = null, modifiedReason = null, modifiedClockInMinutes = null }) {
  if (!assignment) return
  const clockIn = new Date(`${dateStr}T09:00:00.000+08:00`)
  clockIn.setUTCMinutes(clockIn.getUTCMinutes() + lateMinutes)
  const clockOut = new Date(`${dateStr}T${endStr}:00.000+08:00`)
  const fields = {
    shift_assignment_id: assignment.id,
    user_id: userId,
    clock_in_time: clockIn.toISOString(),
    clock_out_time: clockOut.toISOString(),
    break_in_time: breakStart ? new Date(`${dateStr}T${breakStart}:00.000+08:00`).toISOString() : null,
    break_out_time: breakEnd ? new Date(`${dateStr}T${breakEnd}:00.000+08:00`).toISOString() : null,
  }
  if (modifiedBy) {
    fields.modified_by = modifiedBy
    fields.modified_reason = modifiedReason
    fields.modified_at = new Date().toISOString()
    if (modifiedClockInMinutes !== null) {
      const modifiedClockIn = new Date(`${dateStr}T09:00:00.000+08:00`)
      modifiedClockIn.setUTCMinutes(modifiedClockIn.getUTCMinutes() + modifiedClockInMinutes)
      fields.modified_clock_in_time = modifiedClockIn.toISOString()
    }
  }
  const { error } = await supabase.from('attendance_records').insert(fields)
  if (error) console.warn(`  ⚠ 创建 attendance_record 失败: ${error.message}`)
}

// ─── 账号定义 ──────────────────────────────────────────────────────────────────

const DEMO_PHOTO_URL = 'https://api.dicebear.com/7.x/avataaars/svg?seed=tasking'

const accounts = [
  { email: 'owner@test.com',    full_name: 'Sarah Mitchell', role: 'Owner',    phone_number: '+65 9123 4567', date_of_birth: '1980-03-15' },
  { email: 'partner1@test.com', full_name: 'James Tan',      role: 'Partner',  phone_number: '+65 9234 5678', date_of_birth: '1982-07-22' },
  { email: 'manager1@test.com', full_name: 'David Lim',      role: 'Manager',  phone_number: '+65 9456 7890', date_of_birth: '1988-04-12' },
  { email: 'manager2@test.com', full_name: 'Rachel Koh',     role: 'Manager',  phone_number: '+65 9567 8901', date_of_birth: '1990-09-28' },
  { email: 'manager3@test.com', full_name: 'Aaron Wong',     role: 'Manager',  phone_number: '+65 9678 9012', date_of_birth: '1987-01-17' },
  { email: 'manager4@test.com', full_name: 'Fiona Chen',     role: 'Manager',  phone_number: '+65 9789 0123', date_of_birth: '1991-06-03' },
  // 2nd Manager per department (manager{i+5} pairs with manager{i+1} on the same department, see
  // the deptStaff/Step 7 assignment loop) — every department now has 2 Managers, so the Manager
  // Tasks/Shifts pages have a real peer-manager-in-the-same-department scenario to test against,
  // not just a single manager per department.
  { email: 'manager5@test.com', full_name: 'Wendy Ho',       role: 'Manager',  phone_number: '+65 9890 1234', date_of_birth: '1989-11-02' },
  { email: 'manager6@test.com', full_name: 'Kelvin Ang',     role: 'Manager',  phone_number: '+65 9901 2345', date_of_birth: '1986-05-19' },
  { email: 'manager7@test.com', full_name: 'Natalie Goh',    role: 'Manager',  phone_number: '+65 9012 3456', date_of_birth: '1992-02-25' },
  { email: 'manager8@test.com', full_name: 'Samuel Ng',      role: 'Manager',  phone_number: '+65 9123 4560', date_of_birth: '1985-12-08' },
  { email: 'employee1@test.com', full_name: 'Ben Seah',      role: 'Employee', phone_number: '+65 8123 4567', date_of_birth: '1995-02-18' },
  { email: 'employee2@test.com', full_name: 'Chloe Yeo',     role: 'Employee', phone_number: '+65 8234 5678', date_of_birth: '1997-10-05' },
  { email: 'employee3@test.com', full_name: 'Daniel Tay',    role: 'Employee', phone_number: '+65 8345 6789', date_of_birth: '1994-07-30' },
  { email: 'employee4@test.com', full_name: 'Elaine Chua',   role: 'Employee', phone_number: '+65 8456 7890', date_of_birth: '1996-04-11' },
  // 2nd Employee per department (employee{i+5} pairs with employee{i+1} on the same department,
  // same i as its manager{i+5} above) — every department now has 2 Employees, not just Operations,
  // which also means MIN_EMPLOYEES_PER_DAY=1 is satisfiable everywhere: a Fixed Day Off request no
  // longer has to be structurally flagged with no safe alternative just because a department only
  // has 1 Employee (see suggestFixedOffDayGroup/suggestFixedOffDayQueue in requestAISuggestService.ts).
  { email: 'employee5@test.com', full_name: 'Grace Lim',     role: 'Employee', phone_number: '+65 8567 8901', date_of_birth: '1998-08-14' },
  { email: 'employee6@test.com', full_name: 'Hannah Lee',    role: 'Employee', phone_number: '+65 8678 9012', date_of_birth: '1999-03-21' },
  { email: 'employee7@test.com', full_name: 'Ivan Koh',      role: 'Employee', phone_number: '+65 8789 0123', date_of_birth: '1996-08-09' },
  { email: 'employee8@test.com', full_name: 'Sophia Tan',    role: 'Employee', phone_number: '+65 8890 1234', date_of_birth: '1997-01-27' },
]

// Guest Users — public job-board applicants (role 'Guest User', not scoped to any company yet).
// skills/certs feed both the live worker profile (users.skills + user_certificates) and the
// per-application snapshot fields (skills_snapshot/certificates_snapshot) on job_applicants, so
// UC44/45/48 (Applicant List / Accept-Reject / AI Candidate Recommendation) have real content to
// show instead of empty applicant cards.
const guestApplicants = [
  { email: 'guest1@test.com', full_name: 'Wei Jie Lim',  phone_number: '+65 8200 2001', date_of_birth: '2000-01-15',
    skills: 'Forklift operation, Inventory management, Heavy lifting', resume_url: 'https://example.com/demo-resumes/guest1-resume.pdf',
    certs: [{ name: 'Forklift Licence', certificate_url: 'https://example.com/demo-certs/forklift-licence.pdf' }] },
  { email: 'guest2@test.com', full_name: 'Priyanka Das',  phone_number: '+65 8200 2002', date_of_birth: '1999-05-22',
    skills: 'Customer service, Social media content, Copywriting', resume_url: 'https://example.com/demo-resumes/guest2-resume.pdf',
    certs: [{ name: 'Digital Marketing Certificate', certificate_url: 'https://example.com/demo-certs/digital-marketing.pdf' }] },
  { email: 'guest3@test.com', full_name: 'Kai Xuan Ong',  phone_number: '+65 8200 2003', date_of_birth: '2001-09-10',
    skills: 'Event setup, Sound equipment, Stage rigging', resume_url: 'https://example.com/demo-resumes/guest3-resume.pdf',
    certs: [] },
  { email: 'guest4@test.com', full_name: 'Amirah Yusof',  phone_number: '+65 8200 2004', date_of_birth: '1998-12-03',
    skills: 'Photography, Canva, Retail merchandising', resume_url: 'https://example.com/demo-resumes/guest4-resume.pdf',
    certs: [{ name: 'First Aid Certificate', certificate_url: null }] },
  { email: 'guest5@test.com', full_name: 'Ryan Teo',      phone_number: '+65 8200 2005', date_of_birth: '2002-03-28',
    skills: 'PC hardware, Networking basics, Troubleshooting', resume_url: 'https://example.com/demo-resumes/guest5-resume.pdf',
    certs: [{ name: 'CompTIA A+', certificate_url: 'https://example.com/demo-certs/comptia-a-plus.pdf' }] },
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
  'casual3@test.com',
  'casual4@test.com',
  'casual5@test.com',
  'casual6@test.com',
  'casual7@test.com',
  'casual8@test.com',
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
    'shift_assignments',
    'shifts',
    'shift_templates',
    'task_templates',
    'tasks',
    'messages',
    'announcement_reads',
    'announcements',
    'job_invitations',
    'job_applicants',
    'job_cancellations',
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
  // casual_worker_profiles has no `id` column (PK is user_id) and its FK blocks the users cleanup
  // below if left in place — must be cleared before users.
  const { error: cwProfileErr } = await supabase.from('casual_worker_profiles').delete().neq('user_id', '00000000-0000-0000-0000-000000000000')
  if (cwProfileErr) console.warn(`  ⚠ 清空 casual_worker_profiles 失败: ${cwProfileErr.message}`)
  else console.log('  ✓ 清空 casual_worker_profiles')
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
  for (const [adminIndex, admin] of platformAdmins.entries()) {
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
        phone_number: `+65 9000 000${adminIndex}`,
        date_of_birth: '1990-01-01',
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
      plan: 'Paid',
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

  // Per-department shift windows (index-aligned with deptDefs/depts above) — each department runs
  // its own hours instead of every department sharing one flat 9am-5pm, so the Shift Timeline
  // actually looks like 4 different departments. Manager window always starts 30min before and
  // ends 30min after the Employee window on the same department, so a Manager's bar visibly
  // envelops their department's Employee bar (M clocks in first / leaves last to cover the team).
  const DEPT_SHIFT_TIMES = [
    { employee: ['09:00', '17:00'], manager: ['08:30', '17:30'] }, // Operations
    { employee: ['10:00', '18:00'], manager: ['09:30', '18:30'] }, // Marketing
    { employee: ['08:30', '16:30'], manager: ['08:00', '17:00'] }, // Engineering
    { employee: ['10:00', '16:00'], manager: ['09:30', '16:30'] }, // Customer Support
  ]

  // Weekly rest-day rotation (same 2 weekdays every week, a 5-day work week) for the regular
  // roster — each of a department's 2 Managers/2 Employees gets 2 rest days, but the two people in
  // the SAME role (both Managers, or both Employees) never share a rest day, so every calendar day
  // the department still has at least 1 Manager + 1 Employee working.
  // Role index: 0 = manager{i+1} (1st Manager), 1 = manager{i+5} (2nd Manager),
  //             2 = employee{i+1} (1st Employee), 3 = employee{i+5} (2nd Employee).
  // Date.getDay(): 0=Sun..6=Sat.
  const REST_DAYS_OF_WEEK_BY_ROLE_INDEX = [
    [3, 0], // 1st Manager: Wed + Sun
    [6, 2], // 2nd Manager: Sat + Tue
    [1, 5], // 1st Employee: Mon + Fri
    [4, 0], // 2nd Employee: Thu + Sun
  ]
  const isRestDay = (roleIndex, dateObj) => REST_DAYS_OF_WEEK_BY_ROLE_INDEX[roleIndex].includes(dateObj.getDay())
  async function seedRestDayOffRequest(email, dateObj) {
    const { error } = await supabase.from('off_day_requests').insert({
      user_id: userIdMap[email].internalId,
      company_id: company.id,
      requested_date: dateKey(dateObj),
      requested_week: dateKey(mondayOf(dateObj)),
      source: 'submitted',
      status: 'approved',
    })
    if (error) console.warn(`  ⚠ 创建 rest-day off_day_request 失败 (${email} ${dateKey(dateObj)}): ${error.message}`)
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
    { company_id: company.id, user_id: null, role: 'Manager', max_days_per_week: 2 },
    { company_id: company.id, user_id: null, role: 'Employee', max_days_per_week: 2 },
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
  }, { onConflict: 'company_id' })
  if (deadlineSeedErr) console.warn(`  ⚠ Failed to create off-day submission deadline: ${deadlineSeedErr.message}`)
  else console.log('  ✓ Off Day submission deadline: Sunday 08:00')
  const closedSubmissionWeek = addDays(activeSubmissionWeekStart(TODAY, 0, '08:00'), -7)
  const offDayReminderRows = [
    { user_id: userIdMap['employee1@test.com'].internalId, requested_date: dateKey(addDays(closedSubmissionWeek, 1)) },
    { user_id: userIdMap['employee5@test.com'].internalId, requested_date: dateKey(addDays(closedSubmissionWeek, 2)) },
  ]
  const { error: offDayReminderErr } = await supabase.from('off_day_requests').insert(
    offDayReminderRows.map(row => ({
      user_id: row.user_id,
      company_id: company.id,
      requested_date: row.requested_date,
      requested_week: dateKey(closedSubmissionWeek),
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
  // Every department's "first" Manager (manager1-4), used below as the assigned_by for a
  // swap-shift task given to an Employee — Owner assigning straight to an Employee would skip a
  // level (strictly-one-level-down rule, CLAUDE.md §3).
  function firstManagerEmailForDept(deptId) {
    const i = depts.findIndex(d => d.id === deptId)
    return `manager${i >= 0 ? i + 1 : 1}@test.com`
  }
  async function createSwapAssignmentPair({ requesterEmail, counterpartEmail, department, requesterDayOffset, counterpartDayOffset, requesterTime = ['09:00', '13:00'], counterpartTime = ['13:30', '17:30'], title }) {
    const requesterShift = await createShift({
      company_id: company.id,
      department_id: department.id,
      shift_date: dateKey(addDays(TODAY, requesterDayOffset)),
      start_time: requesterTime[0],
      end_time: requesterTime[1],
      created_by: ownerUser.id,
      publication_status: 'published',
    })
    const counterpartShift = await createShift({
      company_id: company.id,
      department_id: department.id,
      shift_date: dateKey(addDays(TODAY, counterpartDayOffset)),
      start_time: counterpartTime[0],
      end_time: counterpartTime[1],
      created_by: ownerUser.id,
      publication_status: 'published',
    })
    const requesterAssignment = requesterShift && await assignShift(requesterShift.id, userIdMap[requesterEmail].internalId, ownerUser.id)
    const counterpartAssignment = counterpartShift && await assignShift(counterpartShift.id, userIdMap[counterpartEmail].internalId, ownerUser.id)

    // A task tied to each side's shift (via shift_id) so the Swap Requests review panel's
    // "Current Task Assignment" / "Task Assignment After Swap" blocks — which list whatever active
    // tasks are attached to that shift — have something real to show instead of "No tasks will
    // move" on every single swap, for both the Owner/Partner queue and the Manager's own queue.
    const assignerFor = email => email.startsWith('manager')
      ? ownerUser.id
      : userIdMap[firstManagerEmailForDept(department.id)].internalId
    if (requesterShift && requesterAssignment) {
      await createTask({
        company_id: company.id, department_id: department.id, shift_id: requesterShift.id,
        title: `${title} — handover checklist`, assigned_user_id: userIdMap[requesterEmail].internalId,
        assigned_by: assignerFor(requesterEmail), status: 'Assigned', priority: 'Medium',
      })
    }
    if (counterpartShift && counterpartAssignment) {
      await createTask({
        company_id: company.id, department_id: department.id, shift_id: counterpartShift.id,
        title: `${title} — shift briefing`, assigned_user_id: userIdMap[counterpartEmail].internalId,
        assigned_by: assignerFor(counterpartEmail), status: 'Assigned', priority: 'Medium',
      })
    }
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
      label: 'owner-pending-rachel-kelvin',
      requesterEmail: 'manager2@test.com',
      counterpartEmail: 'manager6@test.com',
      department: depts[1],
      requesterDayOffset: 3,
      counterpartDayOffset: 4,
      title: 'Marketing Manager Coverage',
      reason: 'Rachel needs to cover a family commitment and Kelvin already agreed to trade.',
      status: 'pending',
      counterpartStatus: 'approved',
      counterpartReviewedAt: minutesAgo(34),
      requiresReview: true,
      ownerReviewReason: 'Manager-level swap requires Owner/Partner review.',
      createdAt: minutesAgo(44),
    },
    {
      label: 'owner-approved-aaron-natalie',
      requesterEmail: 'manager3@test.com',
      counterpartEmail: 'manager7@test.com',
      department: depts[2],
      requesterDayOffset: 5,
      counterpartDayOffset: 6,
      title: 'Engineering Manager Release Cover',
      reason: 'Aaron and Natalie swapped release support windows.',
      status: 'approved',
      counterpartStatus: 'approved',
      counterpartReviewedAt: minutesAgo(118),
      reviewedBy: ownerUser.id,
      reviewedAt: minutesAgo(92),
      createdAt: minutesAgo(150),
    },
    {
      label: 'owner-rejected-fiona-samuel',
      requesterEmail: 'manager4@test.com',
      counterpartEmail: 'manager8@test.com',
      department: depts[3],
      requesterDayOffset: 7,
      counterpartDayOffset: 8,
      title: 'Support Manager Queue Cover',
      reason: 'Fiona asked Samuel to take the live support queue window.',
      status: 'rejected',
      counterpartStatus: 'approved',
      counterpartReviewedAt: minutesAgo(126),
      reviewedBy: ownerUser.id,
      reviewedAt: minutesAgo(84),
      ownerReviewReason: 'Queue handover would leave too little senior coverage.',
      createdAt: minutesAgo(160),
    },
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
    // Two more cross-department Employee↔Employee swaps landing in Operations (same reasoning as
    // Ben↔Chloe below in Step 12 — swap validity requires both sides' shifts in the same
    // department, even though the counterpart's real home department differs) — David Lim's
    // Manager Swap Requests queue was thin with only the Ben/Grace pair + Ben/Chloe.
    {
      label: 'pending-grace-ivan-crossdept',
      requesterEmail: 'employee5@test.com',
      counterpartEmail: 'employee7@test.com',
      department: opsDept,
      requesterDayOffset: 2,
      counterpartDayOffset: 10,
      title: 'Operations Weekday Cover',
      reason: 'Grace needs Wednesday off and Ivan from Engineering already agreed to trade with her.',
      status: 'pending',
      counterpartStatus: 'approved',
      counterpartReviewedAt: minutesAgo(25),
      requiresReview: true,
      createdAt: minutesAgo(35),
    },
    {
      label: 'pending-ben-hannah-crossdept',
      requesterEmail: 'employee1@test.com',
      counterpartEmail: 'employee6@test.com',
      department: opsDept,
      requesterDayOffset: 12,
      counterpartDayOffset: 13,
      title: 'Operations Closing Cover',
      reason: 'Ben has a family commitment and Hannah from Marketing already agreed to cover.',
      status: 'pending',
      counterpartStatus: 'approved',
      counterpartReviewedAt: minutesAgo(15),
      requiresReview: true,
      createdAt: minutesAgo(28),
    },
    // David Lim (manager1) / Wendy Ho (manager5) Manager-tier swaps — same status spread as Ben
    // Seah's Employee-tier set above (2 pending / 1 approved / 1 rejected / 1 hidden-awaiting-
    // counterpart), so manager1's own Shifts page has as much real Swap Requests data as
    // employee1's to compare against, instead of the "left empty for manual testing" placeholder
    // this used to be (2026-08-02). Manager-tier swaps are Owner/Partner-reviewed, not peer-Manager
    // — matches the Rachel↔Kelvin pair above, just for Operations. Day offsets (2026-08-XX: pulled
    // in from 13-22 to 1-10, so nothing on the Shift Timeline calendar reaches past "next week")
    // are chosen so manager1/manager5 never repeat an offset against themselves — the full-roster
    // generic future shifts (Step 12) skip exactly these (email, offset) pairs, see
    // futureShiftSkipSet, so nobody ends up double-booked.
    {
      label: 'pending-david-wendy-morning',
      requesterEmail: 'manager1@test.com',
      counterpartEmail: 'manager5@test.com',
      department: opsDept,
      requesterDayOffset: 1,
      counterpartDayOffset: 2,
      title: 'Operations Manager Floor Cover',
      reason: 'David has a supplier meeting that morning and Wendy already agreed to trade.',
      status: 'pending',
      counterpartStatus: 'approved',
      counterpartReviewedAt: minutesAgo(42),
      createdAt: minutesAgo(55),
    },
    {
      label: 'pending-wendy-david-weekend',
      requesterEmail: 'manager5@test.com',
      counterpartEmail: 'manager1@test.com',
      department: opsDept,
      requesterDayOffset: 3,
      counterpartDayOffset: 4,
      title: 'Operations Weekend Manager Cover',
      reason: 'Wendy is covering a family event and David can take the weekend slot.',
      status: 'pending',
      counterpartStatus: 'approved',
      counterpartReviewedAt: minutesAgo(30),
      createdAt: minutesAgo(40),
    },
    {
      label: 'approved-david-wendy-evening',
      requesterEmail: 'manager1@test.com',
      counterpartEmail: 'manager5@test.com',
      department: opsDept,
      requesterDayOffset: 5,
      counterpartDayOffset: 6,
      title: 'Operations Manager Evening Handover',
      reason: 'David and Wendy swapped to balance opening and closing coverage.',
      status: 'approved',
      counterpartStatus: 'approved',
      counterpartReviewedAt: minutesAgo(100),
      reviewedBy: ownerUser.id,
      reviewedAt: minutesAgo(75),
      createdAt: minutesAgo(130),
    },
    {
      label: 'rejected-wendy-david-coverage',
      requesterEmail: 'manager5@test.com',
      counterpartEmail: 'manager1@test.com',
      department: opsDept,
      requesterDayOffset: 7,
      counterpartDayOffset: 8,
      title: 'Operations Manager Service Shift',
      reason: 'Wendy wanted to move her service shift to David.',
      status: 'rejected',
      counterpartStatus: 'approved',
      counterpartReviewedAt: minutesAgo(90),
      reviewedBy: ownerUser.id,
      reviewedAt: minutesAgo(65),
      ownerReviewReason: 'Coverage would be too light during the Friday service window.',
      createdAt: minutesAgo(118),
    },
    {
      label: 'hidden-david-awaiting-wendy',
      requesterEmail: 'manager1@test.com',
      counterpartEmail: 'manager5@test.com',
      department: opsDept,
      requesterDayOffset: 9,
      counterpartDayOffset: 10,
      title: 'Operations Manager Standby Shift',
      reason: 'This one is still waiting for Wendy, so the Owner/Partner queue should not show it yet.',
      status: 'pending',
      counterpartStatus: 'pending',
      createdAt: minutesAgo(15),
    },
  ]
  let seededSwapCount = 0
  for (const def of swapSeedDefs) {
    if (await createSeedSwap(def)) seededSwapCount++
  }
  console.log(`  ✓ ${seededSwapCount} shift swap requests seeded for Owner queue and manager1/manager5 Operations testing`)

  // Step 8c: Manager dashboard data pack.
  // The current seed intentionally returns before the older full-demo section below. That is useful
  // for focused Attendance tests, but it left manager1@test.com with an empty Dashboard. This pack
  // keeps the seed compact while ensuring every Manager dashboard block has real Operations data:
  // Waiting On You, Recruitment Overview, Task Overview, Internal Attendance, and Casual Attendance.
  console.log('\nStep 8c: Create manager1 dashboard data pack...')
  const todayKey = dateKey(TODAY)
  const managerClockStart = new Date(Date.now() + 30 * 60000)
  const managerClockEnd = new Date(managerClockStart.getTime() + 8 * 60 * 60000)
  const managerClockDate = dateKeySGT(managerClockStart)
  const managerClockStartTime = toHM(managerClockStart)
  const managerClockEndTime = toHM(managerClockEnd)
  const manager1UserId = userIdMap['manager1@test.com'].internalId
  const manager5UserId = userIdMap['manager5@test.com'].internalId
  const manager2UserId = userIdMap['manager2@test.com'].internalId
  const manager3UserId = userIdMap['manager3@test.com'].internalId
  const manager7UserId = userIdMap['manager7@test.com'].internalId
  const manager4UserId = userIdMap['manager4@test.com'].internalId
  const employee1UserId = userIdMap['employee1@test.com'].internalId
  const employee5UserId = userIdMap['employee5@test.com'].internalId
  const employee2UserId = userIdMap['employee2@test.com'].internalId
  const employee3UserId = userIdMap['employee3@test.com'].internalId
  const employee4UserId = userIdMap['employee4@test.com'].internalId

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
      })
      .select()
      .single()
    if (guestUserErr) {
      console.warn(`  ⚠ Failed to create dashboard guest user ${guest.email}: ${guestUserErr.message}`)
      continue
    }
    userIdMap[guest.email] = { authId: guestAuth.user.id, internalId: guestUser.id }
    const { error: guestProfileErr } = await supabase
      .from('casual_worker_profiles')
      .insert({ user_id: guestUser.id, skills: guest.skills, resume_url: guest.resume_url })
    if (guestProfileErr) console.warn(`  ⚠ Failed to seed dashboard guest profile (${guest.email}): ${guestProfileErr.message}`)
    for (const cert of guest.certs) {
      const { error: certErr } = await supabase.from('user_certificates').insert({
        user_id: guestUser.id,
        name: cert.name,
        certificate_url: cert.certificate_url,
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
  const { data: dashboardCasual2Auth, error: dashboardCasual2AuthErr } = await supabase.auth.admin.createUser({
    email: 'casual2@test.com',
    password: PASSWORD,
    email_confirm: true,
  })
  if (dashboardCasual2AuthErr || !dashboardCasual2Auth.user) {
    console.warn(`  ⚠ Failed to create casual2@test.com auth: ${dashboardCasual2AuthErr?.message}`)
  } else {
    const { data: dashboardCasual2User, error: dashboardCasual2UserErr } = await supabase
      .from('users')
      .insert({
        supabase_auth_id: dashboardCasual2Auth.user.id,
        full_name: 'Farah Aziz',
        email_address: 'casual2@test.com',
        phone_number: '+65 8300 3002',
        date_of_birth: '1998-07-09',
        profile_photo_url: DEMO_PHOTO_URL,
        role: 'Casual Worker',
        company_id: company.id,
      })
      .select()
      .single()
    if (dashboardCasual2UserErr) {
      console.warn(`  ⚠ Failed to create casual2@test.com user: ${dashboardCasual2UserErr.message}`)
    } else {
      userIdMap['casual2@test.com'] = { authId: dashboardCasual2Auth.user.id, internalId: dashboardCasual2User.id }
      const { error: casual2DeptErr } = await supabase.from('casualworker_departments').upsert({
        casual_worker_id: dashboardCasual2User.id,
        department_id: depts[1].id,
        company_id: company.id,
        verified_at: new Date().toISOString(),
      }, { onConflict: 'casual_worker_id,department_id' })
      if (casual2DeptErr) console.warn(`  ⚠ Failed to verify casual2@test.com in Marketing: ${casual2DeptErr.message}`)
    }
  }

  const todayInternalShift = await createShift({
    company_id: company.id,
    department_id: opsDept.id,
    shift_date: managerClockDate,
    start_time: managerClockStartTime,
    end_time: managerClockEndTime,
    created_by: ownerUser.id,
    publication_status: 'published',
    // canClockOut (AttendanceView.tsx) only unlocks Clock Out at the shift's own end_time for a
    // fixed shift — with an 8h end_time (kept long so the Shift Timeline bar still looks like a
    // normal full shift, not a sliver), that meant manager1 had to wait ~8 real hours after
    // Clock In before Clock Out unlocked. is_open_ended makes canClockOut return true right after
    // Clock In regardless of end_time, so the whole flow is completable the moment seed finishes,
    // while the Timeline bar (which reads start_time/end_time directly, not is_open_ended) still
    // shows the full 8h block.
    is_open_ended: true,
  })
  const todayAssignments = []
  for (const email of ['manager1@test.com']) {
    const assignment = await assignShift(todayInternalShift?.id, userIdMap[email].internalId, ownerUser.id)
    if (assignment) todayAssignments.push({ email, assignment })
  }

  // Operations Manager/Employee windows (DEPT_SHIFT_TIMES[0]) — separate shift rows so manager5's
  // bar visibly starts before / ends after employee5's on the Shift Timeline.
  const opsShiftTimes = DEPT_SHIFT_TIMES[0]
  const dashboardAttendanceManagerShift = await createShift({
    company_id: company.id,
    department_id: opsDept.id,
    shift_date: todayKey,
    start_time: opsShiftTimes.manager[0],
    end_time: opsShiftTimes.manager[1],
    created_by: ownerUser.id,
    publication_status: 'published',
  })
  const dashboardAttendanceEmployeeShift = await createShift({
    company_id: company.id,
    department_id: opsDept.id,
    shift_date: todayKey,
    start_time: opsShiftTimes.employee[0],
    end_time: opsShiftTimes.employee[1],
    created_by: ownerUser.id,
    publication_status: 'published',
  })
  const dashboardAttendanceAssignments = []
  // employee1 (Ben Seah) intentionally left off employee5's employee-window shift — he gets his own
  // "now"-relative one below instead, so his own Dashboard's Clock In/Break In/Break Out/Clock Out
  // row is genuinely clickable the moment the seed finishes, not a fixed business-hours window
  // that may already be over (or not started) whenever this actually runs.
  const managerAssignment5 = await assignShift(dashboardAttendanceManagerShift?.id, userIdMap['manager5@test.com'].internalId, ownerUser.id)
  if (managerAssignment5) dashboardAttendanceAssignments.push({ email: 'manager5@test.com', assignment: managerAssignment5 })
  const employeeAssignment5 = await assignShift(dashboardAttendanceEmployeeShift?.id, userIdMap['employee5@test.com'].internalId, ownerUser.id)
  if (employeeAssignment5) dashboardAttendanceAssignments.push({ email: 'employee5@test.com', assignment: employeeAssignment5 })
  if (hasShiftEndedSGT(todayKey, opsShiftTimes.manager[1])) {
    await clockRecord(dashboardAttendanceAssignments.find(a => a.email === 'manager5@test.com')?.assignment, manager5UserId, { dateStr: todayKey, endStr: opsShiftTimes.manager[1], breakStart: '12:15', breakEnd: '12:45' })
  }

  // employee1's own "click through it yourself" shift (UC49, same idea as Marcus Lee's Step 18
  // CW demo) — starts 45 minutes ago, runs a full ~8h workday from there (same length as manager1's
  // clock-in-window demo shift above, so it reads as a normal full shift bar on the Owner Shift
  // Timeline instead of a truncated sliver), no attendance_records row at all, so Clock In is live
  // right away. is_open_ended:true (not false) so canClockOut (AttendanceView.tsx) doesn't force a
  // real ~8h wait for the fixed end_time before Clock Out unlocks — the whole Clock In→Clock Out
  // flow is completable immediately, same fix as manager1's shift above.
  const employee1ShiftStart = new Date(Date.now() - 45 * 60000)
  const employee1ShiftEnd = new Date(employee1ShiftStart.getTime() + 8 * 60 * 60000)
  const employee1ShiftDate = dateKeySGT(employee1ShiftStart)
  const employee1LiveShift = await createShift({
    company_id: company.id, department_id: opsDept.id, shift_date: employee1ShiftDate,
    start_time: toHM(employee1ShiftStart), end_time: toHM(employee1ShiftEnd), is_open_ended: true,
    created_by: ownerUser.id, publication_status: 'published',
  })
  if (employee1LiveShift) {
    await assignShift(employee1LiveShift.id, employee1UserId, ownerUser.id)
    console.log(`  ✓ Ben Seah（employee1）今天 ${toHM(employee1ShiftStart)}–${toHM(employee1ShiftEnd)} UTC 排班，未打卡 —— 登录 employee1@test.com 立刻可以自己点完 Clock In → Break In → Break Out → Clock Out 整套流程`)
  }

  const ownerDashboardAttendanceDefs = [
    {
      department: depts[1],
      deptIndex: 1,
      title: 'Marketing Campaign Desk Coverage',
      managerEmails: ['manager2@test.com', 'manager6@test.com'],
      employeeEmails: ['employee2@test.com', 'employee6@test.com'],
      clocked: [
        { email: 'manager2@test.com', userId: manager2UserId, role: 'manager', options: { dateStr: todayKey, breakStart: '12:00', breakEnd: '12:30' } },
        { email: 'employee2@test.com', userId: employee2UserId, role: 'employee', options: { dateStr: todayKey, lateMinutes: 25 } },
      ],
    },
    {
      department: depts[2],
      deptIndex: 2,
      title: 'Engineering Release Support',
      // employee3 (Daniel Tay) is deliberately NOT scheduled today — he has an approved Fixed Day
      // Off for today (see the off_day_requests seeding below), so giving him a shift + clock-in
      // record on the same date would contradict that and confuse the Off Day pill test.
      managerEmails: ['manager3@test.com', 'manager7@test.com'],
      employeeEmails: ['employee7@test.com'],
      clocked: [
        { email: 'manager3@test.com', userId: manager3UserId, role: 'manager', options: { dateStr: todayKey } },
        { email: 'manager7@test.com', userId: manager7UserId, role: 'manager', options: { dateStr: todayKey, lateMinutes: 15 } },
      ],
    },
    {
      department: depts[3],
      deptIndex: 3,
      title: 'Customer Support Live Queue',
      // manager8/employee8 (Samuel Ng/Sophia Tan, the department's 2nd pair) were missing here
      // entirely — with no shift today they fell through to a gray "OFF" bar on the Owner Shift
      // Timeline even though they're scheduled every other day. Every dept's 2nd pair works today.
      managerEmails: ['manager4@test.com', 'manager8@test.com'],
      employeeEmails: ['employee4@test.com', 'employee8@test.com'],
      clocked: [
        { email: 'manager4@test.com', userId: manager4UserId, role: 'manager', options: { dateStr: todayKey, lateMinutes: 10 } },
        { email: 'employee4@test.com', userId: employee4UserId, role: 'employee', options: { dateStr: todayKey } },
        { email: 'manager8@test.com', userId: userIdMap['manager8@test.com'].internalId, role: 'manager', options: { dateStr: todayKey } },
        { email: 'employee8@test.com', userId: userIdMap['employee8@test.com'].internalId, role: 'employee', options: { dateStr: todayKey, lateMinutes: 8 } },
      ],
    },
  ]
  for (const def of ownerDashboardAttendanceDefs) {
    const times = DEPT_SHIFT_TIMES[def.deptIndex]
    const managerShift = await createShift({
      company_id: company.id,
      department_id: def.department.id,
      shift_date: todayKey,
      start_time: times.manager[0],
      end_time: times.manager[1],
      created_by: ownerUser.id,
      publication_status: 'published',
    })
    const employeeShift = await createShift({
      company_id: company.id,
      department_id: def.department.id,
      shift_date: todayKey,
      start_time: times.employee[0],
      end_time: times.employee[1],
      created_by: ownerUser.id,
      publication_status: 'published',
    })
    const assignments = []
    for (const email of def.managerEmails) {
      const assignment = await assignShift(managerShift?.id, userIdMap[email].internalId, ownerUser.id)
      if (assignment) assignments.push({ email, assignment })
    }
    for (const email of def.employeeEmails) {
      const assignment = await assignShift(employeeShift?.id, userIdMap[email].internalId, ownerUser.id)
      if (assignment) assignments.push({ email, assignment })
    }
    for (const row of def.clocked) {
      // A department's shift for today must not get a fully-clocked-out attendance record before
      // that shift's own end time has actually happened in real Singapore time — otherwise running
      // the seed early in the morning would leave everyone "clocked out at 5pm" hours before 5pm.
      const endTime = times[row.role][1]
      if (!hasShiftEndedSGT(todayKey, endTime)) continue
      await clockRecord(assignments.find(a => a.email === row.email)?.assignment, row.userId, { ...row.options, endStr: endTime })
    }
  }
  console.log(`  ✓ manager1@test.com test shift starts in the clock-in window: ${managerClockDate} ${managerClockStartTime}-${managerClockEndTime} UTC`)

  if (userIdMap['casual1@test.com']) {
    const casualPreStartStart = new Date(Date.now() + 30 * 60 * 1000)
    const casualPreStartEnd = new Date(casualPreStartStart.getTime() + 4 * 60 * 60 * 1000)
    const casualPreStartDate = dateKeySGT(casualPreStartStart)
    const casualPreStartStartTime = toHM(casualPreStartStart)
    const casualPreStartEndTime = toHM(casualPreStartEnd)
    const { data: casualPreStartJob, error: casualPreStartJobErr } = await supabase
      .from('job_postings')
      .insert({
        company_id: company.id,
        department_id: opsDept.id,
        created_by: manager1UserId,
        title: 'Pre-Shift Cafe Counter Cover',
        responsibilities: 'Cover the cafe counter during the pre-lunch rush. Prepare the till, greet guests, take orders, and keep the counter stocked before the lunch team arrives.',
        skills: 'Arrive on time, wear black shoes, comfortable handling cash and customer questions.',
        status: 'closed',
        job_type: 'oneoff',
        urgency: 'normal',
        estimated_hours: '4',
        job_date: casualPreStartDate,
        job_start_time: casualPreStartStartTime,
        openings: 1,
        experience_required: 'Not Required',
        minimum_age: 16,
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
          resume: 'https://example.com/demo-resumes/marcus-lee-resume.pdf',
          status: 'accepted',
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
      // Marcus Lee (casual1@test.com) intentionally has NO shift/assignment/task/clock-record
      // seeded this week — Manager wanted to see the Shift Calendar's Casual Workers section
      // rendering an all-"OFF" row (job posting/applicant/invitation above still seeded, just no
      // shift attached to them).
      if (userIdMap['casual2@test.com']) {
        const ownerCasualAttendanceShift = await createShift({
          company_id: company.id,
          department_id: depts[1].id,
          shift_date: todayKey,
          start_time: '09:00',
          end_time: '13:00',
          created_by: ownerUser.id,
          publication_status: 'published',
        })
        const ownerCasualAttendanceAssignment = await assignShift(ownerCasualAttendanceShift?.id, userIdMap['casual2@test.com'].internalId, ownerUser.id, employee2UserId)
        if (hasShiftEndedSGT(todayKey, '13:00')) {
          await clockRecord(ownerCasualAttendanceAssignment, userIdMap['casual2@test.com'].internalId, { dateStr: todayKey, endStr: '13:00', lateMinutes: 18 })
        }
      }
      console.log('  ✓ Casual Worker pre-start dashboard job posting/application seeded; no shift/task/clock-record for casual1@test.com this week (Manager Shift Calendar all-OFF row test)')
    }
  }
  console.log('  ✓ Today attendance: Operations rows for Manager dashboard plus multi-department Owner attendance; casual1/casual2 cover both dashboard halves')

  // ── Employee Tasks page demo: Grace Lim (employee5) supervises a Casual Worker today, so her
  // Tasks page (Assign/Edit/Delete/Sub-task to the Casual Workers she supervises) has real data
  // instead of the empty state. A fresh Casual Worker rather than reusing casual1/casual2, who
  // are already booked at other times today under employee1/employee2's supervision.
  const { data: casual3Auth, error: casual3AuthErr } = await supabase.auth.admin.createUser({
    email: 'casual3@test.com',
    password: PASSWORD,
    email_confirm: true,
  })
  if (casual3AuthErr || !casual3Auth.user) {
    console.warn(`  ⚠ Failed to create casual3@test.com auth: ${casual3AuthErr?.message}`)
  } else {
    const { data: casual3User, error: casual3UserErr } = await supabase
      .from('users')
      .insert({
        supabase_auth_id: casual3Auth.user.id,
        full_name: 'Priya Nair',
        email_address: 'casual3@test.com',
        phone_number: '+65 8300 3003',
        date_of_birth: '2000-03-22',
        profile_photo_url: DEMO_PHOTO_URL,
        role: 'Casual Worker',
        company_id: company.id,
      })
      .select()
      .single()
    if (casual3UserErr) {
      console.warn(`  ⚠ Failed to create casual3@test.com user: ${casual3UserErr.message}`)
    } else {
      userIdMap['casual3@test.com'] = { authId: casual3Auth.user.id, internalId: casual3User.id }
      const { error: casual3DeptErr } = await supabase.from('casualworker_departments').upsert({
        casual_worker_id: casual3User.id,
        department_id: opsDept.id,
        company_id: company.id,
        verified_at: new Date().toISOString(),
      }, { onConflict: 'casual_worker_id,department_id' })
      if (casual3DeptErr) console.warn(`  ⚠ Failed to verify casual3@test.com in Operations: ${casual3DeptErr.message}`)

      // Dynamic "now"-relative shift (not a fixed UTC clock time) — same reasoning as
      // casualPreStartStart above: a fixed UTC window can fall outside "now" depending on when the
      // script is run vs. the tester's local time (Singapore is UTC+8), which would leave
      // workActionsUnlocked() false and hide the Casual Worker's task board / clock-in entirely.
      // Started 1h ago so it reads as already-in-progress whenever this is run or tested.
      const emp5Shift1Start = new Date(Date.now() - 60 * 60 * 1000)
      const emp5Shift1End = new Date(emp5Shift1Start.getTime() + 8 * 60 * 60 * 1000)
      const emp5Shift1Date = dateKeySGT(emp5Shift1Start)
      const emp5Shift1StartTime = toHM(emp5Shift1Start)
      const emp5Shift1EndTime = toHM(emp5Shift1End)
      const employee5CasualShift = await createShift({
        company_id: company.id,
        department_id: opsDept.id,
        shift_date: emp5Shift1Date,
        start_time: emp5Shift1StartTime,
        end_time: emp5Shift1EndTime,
        created_by: manager1UserId,
        publication_status: 'published',
      })
      const employee5CasualAssignment = await assignShift(employee5CasualShift?.id, casual3User.id, manager1UserId, employee5UserId)
      if (employee5CasualShift && employee5CasualAssignment) {
        await createTask({
          shift_id: employee5CasualShift.id, company_id: company.id, department_id: opsDept.id,
          title: 'Restock cafe display fridge',
          description: "Top up the display fridge with today's pastries and check expiry labels before opening.",
          assigned_user_id: casual3User.id, assigned_by: employee5UserId,
          status: 'Assigned', due_at: new Date(emp5Shift1Start.getTime() + 2 * 3600000).toISOString(), priority: 'Medium',
        })
        await createTask({
          shift_id: employee5CasualShift.id, company_id: company.id, department_id: opsDept.id,
          title: 'Clean and reset cafe tables',
          description: 'Wipe down all cafe tables and chairs, and reset condiment trays between the lunch and afternoon rush.',
          assigned_user_id: casual3User.id, assigned_by: employee5UserId,
          status: 'In Progress', due_at: new Date(emp5Shift1Start.getTime() + 4 * 3600000).toISOString(), priority: 'Medium',
        })
        await createTask({
          shift_id: employee5CasualShift.id, company_id: company.id, department_id: opsDept.id,
          title: 'Count afternoon float',
          description: 'Count the till float at the afternoon handover and log the total on the shift sheet.',
          assigned_user_id: casual3User.id, assigned_by: employee5UserId,
          status: 'Review', due_at: new Date(emp5Shift1Start.getTime() + 5 * 3600000).toISOString(), priority: 'High',
        })
        await createTask({
          shift_id: employee5CasualShift.id, company_id: company.id, department_id: opsDept.id,
          title: 'Set up morning coffee station',
          description: 'Set up the coffee station, grind beans for the day, and check the milk fridge stock.',
          assigned_user_id: casual3User.id, assigned_by: employee5UserId,
          status: 'Complete',
          due_at: emp5Shift1Start.toISOString(), completed_at: emp5Shift1Start.toISOString(),
        })
        console.log(`  ✓ Employee Tasks 页演示数据：Grace Lim（employee5）今天督导 Priya Nair（casual3），4 条 Task 覆盖 Assigned/In Progress/Review/Complete；班次 ${emp5Shift1StartTime}-${emp5Shift1EndTime} UTC（${emp5Shift1Date}）现在正好在班内`)
      }
    }
  }

  // Second Casual Worker under the same Employee today — so the Employee Tasks page's Member
  // panel shows a real "one Employee, multiple Casual Workers" scenario, not just a single row.
  const { data: casual4Auth, error: casual4AuthErr } = await supabase.auth.admin.createUser({
    email: 'casual4@test.com',
    password: PASSWORD,
    email_confirm: true,
  })
  if (casual4AuthErr || !casual4Auth.user) {
    console.warn(`  ⚠ Failed to create casual4@test.com auth: ${casual4AuthErr?.message}`)
  } else {
    const { data: casual4User, error: casual4UserErr } = await supabase
      .from('users')
      .insert({
        supabase_auth_id: casual4Auth.user.id,
        full_name: 'Daniel Wong',
        email_address: 'casual4@test.com',
        phone_number: '+65 8300 3004',
        date_of_birth: '2001-01-17',
        profile_photo_url: DEMO_PHOTO_URL,
        role: 'Casual Worker',
        company_id: company.id,
      })
      .select()
      .single()
    if (casual4UserErr) {
      console.warn(`  ⚠ Failed to create casual4@test.com user: ${casual4UserErr.message}`)
    } else {
      userIdMap['casual4@test.com'] = { authId: casual4Auth.user.id, internalId: casual4User.id }
      const { error: casual4DeptErr } = await supabase.from('casualworker_departments').upsert({
        casual_worker_id: casual4User.id,
        department_id: opsDept.id,
        company_id: company.id,
        verified_at: new Date().toISOString(),
      }, { onConflict: 'casual_worker_id,department_id' })
      if (casual4DeptErr) console.warn(`  ⚠ Failed to verify casual4@test.com in Operations: ${casual4DeptErr.message}`)

      // Same dynamic "now"-relative reasoning as casual3's shift above — started 90 min ago on a
      // 9h shift, staggered slightly from casual3's so the two Casual Workers aren't identical.
      const emp5Shift2Start = new Date(Date.now() - 90 * 60 * 1000)
      const emp5Shift2End = new Date(emp5Shift2Start.getTime() + 9 * 60 * 60 * 1000)
      const emp5Shift2Date = dateKeySGT(emp5Shift2Start)
      const emp5Shift2StartTime = toHM(emp5Shift2Start)
      const emp5Shift2EndTime = toHM(emp5Shift2End)
      const employee5CasualShift2 = await createShift({
        company_id: company.id,
        department_id: opsDept.id,
        shift_date: emp5Shift2Date,
        start_time: emp5Shift2StartTime,
        end_time: emp5Shift2EndTime,
        created_by: manager1UserId,
        publication_status: 'published',
      })
      const employee5CasualAssignment2 = await assignShift(employee5CasualShift2?.id, casual4User.id, manager1UserId, employee5UserId)
      if (employee5CasualShift2 && employee5CasualAssignment2) {
        await createTask({
          shift_id: employee5CasualShift2.id, company_id: company.id, department_id: opsDept.id,
          title: 'Sweep and mop dining floor',
          description: 'Sweep and mop the dining floor before the doors open, paying extra attention to the entrance mat area.',
          assigned_user_id: casual4User.id, assigned_by: employee5UserId,
          status: 'Assigned', due_at: new Date(emp5Shift2Start.getTime() + 3 * 3600000).toISOString(), priority: 'Low',
        })
        await createTask({
          shift_id: employee5CasualShift2.id, company_id: company.id, department_id: opsDept.id,
          title: 'Restock napkins and cutlery trays',
          description: 'Top up napkin dispensers and cutlery trays at every table before the lunch rush.',
          assigned_user_id: casual4User.id, assigned_by: employee5UserId,
          status: 'In Progress', due_at: new Date(emp5Shift2Start.getTime() + 4 * 3600000).toISOString(), priority: 'Medium',
        })
        await createTask({
          shift_id: employee5CasualShift2.id, company_id: company.id, department_id: opsDept.id,
          title: 'Clear and reset outdoor seating',
          description: 'Clear used cups and trays from the outdoor seating area and wipe down every table.',
          assigned_user_id: casual4User.id, assigned_by: employee5UserId,
          status: 'Complete',
          due_at: emp5Shift2Start.toISOString(), completed_at: emp5Shift2Start.toISOString(),
        })
        console.log(`  ✓ Employee Tasks 页演示数据：Grace Lim（employee5）今天同时督导 Daniel Wong（casual4），3 条 Task 覆盖 Assigned/In Progress/Complete；班次 ${emp5Shift2StartTime}-${emp5Shift2EndTime} UTC（${emp5Shift2Date}）现在正好在班内 —— 验证一个 Employee 同时带多个 CW 的场景`)
      }
    }
  }

  const managerDashboardJobDefs = [
    {
      key: 'manager_deadline_today',
      title: 'Operations Event Runner - Applications Close Today',
      expires_at: todayKey,
      job_date: dateKey(TOMORROW),
      openings: 4,
      job_start_time: '10:00',
    },
    {
      key: 'manager_starting_soon',
      title: 'Lobby Queue Host - Starts Tomorrow',
      expires_at: dateKey(addDays(TODAY, 3)),
      job_date: dateKey(TOMORROW),
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
        responsibilities: 'Seeded manager dashboard posting with applicants, deadline, and staffing pressure.',
        skills: 'Friendly, punctual, comfortable with guest-facing work.',
        status: 'open',
        job_type: 'oneoff',
        urgency: 'high',
        estimated_hours: '5',
        experience_required: 'Not Required',
        minimum_age: 16,
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
      resume: guest?.resume_url ?? null,
      status: 'pending',
      additional_note: 'Available for the seeded Operations dashboard test shift.',
      skills: guest?.skills ?? null,
      certificates: guest?.certs ?? [],
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
    due_at: dueAtOn(addDays(TODAY, -3), 16),
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
    priority: 'Low',
  })
  await createTask({
    company_id: company.id,
    department_id: depts[1].id,
    title: 'Finalize campaign roster exceptions',
    description: 'Owner dashboard overdue sample: Rachel needs to finish the roster exception review.',
    assigned_user_id: manager2UserId,
    assigned_by: ownerUser.id,
    status: 'Assigned',
    due_at: dueAtOn(YESTERDAY, 15),
    priority: 'High',
  })
  await createTask({
    company_id: company.id,
    department_id: depts[2].id,
    title: 'Confirm release support runbook',
    description: 'Owner dashboard delay-alert sample: assigned long enough ago that it is at risk before tomorrow.',
    assigned_user_id: manager3UserId,
    assigned_by: ownerUser.id,
    status: 'Assigned',
    due_at: dueAtOn(TOMORROW, 11),
    created_at: new Date(Date.now() - 36 * 60 * 60 * 1000).toISOString(),
    priority: 'Medium',
  })
  await createTask({
    company_id: company.id,
    department_id: depts[3].id,
    title: 'Complete customer escalation review',
    description: 'Owner dashboard completed-today sample for the Task Overview block.',
    assigned_user_id: manager4UserId,
    assigned_by: ownerUser.id,
    status: 'Complete',
    due_at: dueAtOn(TODAY, 10),
    completed_at: dueAtOn(TODAY, 10),
    priority: 'Low',
  })
  await createTask({
    company_id: company.id,
    department_id: opsDept.id,
    title: 'Partner review of weekend floor plan',
    description: 'Partner-assigned task so Owner dashboard peer-scope task reads have visible data too.',
    assigned_user_id: manager1UserId,
    assigned_by: userIdMap['partner1@test.com'].internalId,
    status: 'Assigned',
    due_at: dueAtOn(addDays(TODAY, -2), 17),
    priority: 'High',
  })
  console.log('  ✓ Task Overview: manager Operations tasks plus Owner overdue, delay-alert, completed-today, and Partner-assigned samples')

  const { error: opsAnnouncementErr } = await supabase.from('announcements').insert({
    user_id: manager1UserId,
    company_id: company.id,
    audience_department_id: opsDept.id,
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
  console.log('  Done: Owner/Manager dashboard seed is ready. Password for all test accounts: 111111')
  console.log('  Owner:    owner@test.com')
  console.log('  Partner:  partner1@test.com')
  console.log('  Manager:  manager1-8@test.com')
  console.log('  Employee: employee1-8@test.com')
  console.log('  Casual:   casual1@test.com')
  console.log('  Guest:    guest1-3@test.com')
  console.log('  Company:  Sunrise Hospitality Group')
  console.log('  Seeded for testing: owner@test.com and manager1@test.com Dashboard, Attendance, Tasks, Recruitment, Communication, Team, and Shift Swap Requests.')
  console.log('  Test paths: login owner@test.com -> Owner Dashboard, or manager1@test.com -> Manager Dashboard. No dashboard overview block should be empty.')
  console.log('═══════════════════════════════════════════')

  // guest1-3 were already created above (Step 8c's dashboardGuestEmails pack, for the Owner/
  // Manager dashboard demo) — only guest4/guest5 are still needed here.
  for (const guest of guestApplicants) {
    if (userIdMap[guest.email]) continue
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
      })
      .select()
      .single()
    if (uErr) { console.error(`  ✗ 插入 Guest users 失败 ${guest.email}:`, uErr.message); process.exit(1) }
    userIdMap[guest.email] = { authId: authData.user.id, internalId: u.id }
    const { error: profileErr } = await supabase
      .from('casual_worker_profiles')
      .insert({ user_id: u.id, skills: guest.skills, resume_url: guest.resume_url })
    if (profileErr) console.warn(`  ⚠ 插入 casual_worker_profiles 失败 (${guest.email}): ${profileErr.message}`)
    for (const cert of guest.certs) {
      const { error: certErr } = await supabase.from('user_certificates').insert({
        user_id: u.id,
        name: cert.name,
        certificate_url: cert.certificate_url,
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
      responsibilities: 'Help set up and run a corporate weekend event — registration desk, guest flow, and teardown.',
      skills: 'Comfortable on your feet for a full shift, clear spoken English, punctual.',
      status: 'open',
      job_type: 'oneoff',
      urgency: 'normal',
      estimated_hours: '6',
      // Real date, not just a deadline — accepting an invitation on this job (respondToInvitation)
      // only creates the actual shifts/shift_assignments row (what the Casual dashboard reads) when
      // shift_date is set; leaving it null silently produces an "accepted" application with no
      // shift behind it.
      job_date: dateKey(nextWeekday(TODAY, 6)), // next Saturday
      job_start_time: '09:00',
      openings: 3,
      experience_required: 'Not Required',
      minimum_age: 16,
      salary_amount: 15.5,
      expires_at: applicationDeadline,
    },
    {
      key: 'pending_approval',
      company_id: company.id,
      department_id: depts[1].id, // Marketing
      created_by: userIdMap['manager2@test.com'].internalId, // Rachel Koh — so it lands on someone else's approval queue
      title: 'Flyer Distribution — City Centre',
      responsibilities: 'Hand out promotional flyers in the city centre during lunch and evening foot traffic peaks.',
      skills: 'Friendly, comfortable approaching strangers, own transport to the city centre.',
      status: 'pending_approval',
      job_type: 'oneoff',
      urgency: 'high',
      estimated_hours: '4',
      job_start_time: '11:00',
      openings: 2,
      experience_required: 'Not Required',
      minimum_age: 16,
      salary_amount: 14,
      expires_at: applicationDeadline,
    },
    {
      key: 'draft',
      company_id: company.id,
      department_id: depts[2].id, // Engineering
      created_by: ownerUser.id,
      title: 'IT Support — Office Relocation',
      responsibilities: 'Assist packing/unpacking and reconnecting workstations during an office move.',
      skills: null,
      status: 'draft',
      job_type: 'oneoff',
      urgency: 'normal',
      estimated_hours: null,
      job_start_time: null,
      openings: 1,
      experience_required: null,
      minimum_age: null,
      salary_amount: null,
      expires_at: null,
    },
    {
      key: 'rejected',
      company_id: company.id,
      department_id: depts[3].id, // Customer Support
      created_by: userIdMap['manager4@test.com'].internalId, // Fiona Chen — so Owner's rejection has a real recipient
      title: 'Live Chat Support — Overnight',
      responsibilities: 'Cover overnight live-chat customer support shifts.',
      skills: 'Clear written English, own laptop, stable internet connection.',
      status: 'rejected',
      job_type: 'oneoff',
      urgency: 'normal',
      estimated_hours: '8',
      job_start_time: '22:00',
      openings: 2,
      experience_required: 'Not Required',
      minimum_age: 18,
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
      responsibilities: 'Recurring weekend shift counting and organizing warehouse inventory ahead of a new stock intake.',
      skills: 'Comfortable with repetitive counting tasks, basic spreadsheet use a plus.',
      status: 'open',
      job_type: 'shift',
      urgency: 'normal',
      job_date: dateKey(addDays(TODAY, 4)),
      job_start_time: '08:00',
      job_end_time: '13:00',
      break_start_time: '10:00',
      break_end_time: '10:15',
      openings: 2,
      experience_required: '6+ Months',
      minimum_age: 18,
      salary_amount: 13.5,
      expires_at: applicationDeadline,
    },
    {
      key: 'open_urgent',
      company_id: company.id,
      department_id: depts[1].id, // Marketing
      created_by: ownerUser.id,
      title: 'Retail Promo Day — Orchard Road',
      responsibilities: 'Represent the brand at a retail pop-up booth — greet shoppers, hand out samples, and log leads.',
      skills: 'Outgoing personality, comfortable standing for long periods, available on short notice.',
      status: 'open',
      job_type: 'oneoff',
      urgency: 'urgent',
      estimated_hours: '5',
      job_date: dateKey(addDays(TODAY, 2)), // same reason as the 'open' job above
      job_start_time: '10:00',
      openings: 2,
      experience_required: 'Preferred',
      minimum_age: 18,
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
      responsibilities: 'Cover the café counter for a weekend rush — orders, till, and light cleaning.',
      skills: 'Comfortable handling cash, friendly with customers.',
      status: 'open',
      job_type: 'oneoff',
      urgency: 'normal',
      estimated_hours: '5',
      job_date: dateKey(nextWeekday(TODAY, 6)), // next Saturday
      job_start_time: '09:00',
      openings: 2,
      experience_required: 'Not Required',
      minimum_age: 16,
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
      responsibilities: 'Reorganise the stockroom shelving and relabel bins ahead of next month\'s delivery.',
      skills: null,
      status: 'draft',
      job_type: 'oneoff',
      urgency: 'normal',
      estimated_hours: null,
      job_start_time: null,
      openings: 1,
      experience_required: null,
      minimum_age: null,
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
        resume: guestDef.resume_url,
        status: 'pending',
        additional_note: `Hi, I'm ${guestDef.full_name.split(' ')[0]} and I'd love to help out with this one.`,
        skills: guestDef.skills,
        certificates: guestDef.certs,
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
        resume: guestDef.resume_url,
        status: 'pending',
        additional_note: `Hi, I'm ${guestDef.full_name.split(' ')[0]} and I'd love to help out with this one.`,
        skills: guestDef.skills,
        certificates: guestDef.certs,
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
        resume: guestDef.resume_url,
        status,
        additional_note: extra.additional_note ?? `Hi, I'm ${guestDef.full_name.split(' ')[0]} and I'd love to help out with this one.`,
        skills: guestDef.skills,
        certificates: guestDef.certs,
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
  if (userIdMap['casual1@test.com']) {
    // Already created by Step 8c's dashboardCasualAuth pack (same person, Marcus Lee) — reuse it.
    console.log(`  ✓ Casual Worker: Marcus Lee 已在 Step 8c 创建 → ${userIdMap['casual1@test.com'].internalId}`)
  } else {
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
      })
      .select()
      .single()
    if (casualUserErr) { console.error('  ✗ 插入 Casual Worker users 失败:', casualUserErr.message); process.exit(1) }
    userIdMap['casual1@test.com'] = { authId: casualAuth.user.id, internalId: casualUser.id }
    console.log(`  ✓ Casual Worker: Marcus Lee → ${casualUser.id}`)
  }

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
  // key: `${deptIndex}|${dateKey}` → { managerShiftId, employeeShiftId } — each department runs its
  // own DEPT_SHIFT_TIMES window, and Manager/Employee get separate shift rows (Manager's window
  // starts earlier / ends later, so the Timeline bar visibly envelops the department's Employees).
  const pastShiftsByDeptDay = {}
  for (const dayDate of PAST_DAYS) {
    for (const [i, staff] of deptStaff.entries()) {
      const times = DEPT_SHIFT_TIMES[i]
      const managerShift = await createShift({
        company_id: company.id,
        department_id: staff.dept.id,
        shift_date: dateKey(dayDate),
        start_time: times.manager[0],
        end_time: times.manager[1],
        created_by: ownerUser.id,
        publication_status: 'published',
      })
      const employeeShift = await createShift({
        company_id: company.id,
        department_id: staff.dept.id,
        shift_date: dateKey(dayDate),
        start_time: times.employee[0],
        end_time: times.employee[1],
        created_by: ownerUser.id,
        publication_status: 'published',
      })
      pastShiftsByDeptDay[`${i}|${dateKey(dayDate)}`] = { managerShiftId: managerShift?.id, employeeShiftId: employeeShift?.id }
      if (isRestDay(0, dayDate)) {
        await seedRestDayOffRequest(staff.managerEmail, dayDate)
      } else if (managerShift) {
        const assignment = await assignShift(managerShift.id, userIdMap[staff.managerEmail].internalId, ownerUser.id)
        if (assignment) pastAssignments[`${staff.managerEmail}|${dateKey(dayDate)}`] = assignment
      }
      if (isRestDay(2, dayDate)) {
        await seedRestDayOffRequest(staff.employeeEmail, dayDate)
      } else if (employeeShift) {
        const assignment = await assignShift(employeeShift.id, userIdMap[staff.employeeEmail].internalId, ownerUser.id)
        if (assignment) pastAssignments[`${staff.employeeEmail}|${dateKey(dayDate)}`] = assignment
      }
    }
  }
  console.log(`  ✓ ${Object.keys(pastAssignments).length} 条过去 10 天的排班（4 部门 × Manager+Employee，每部门各自的时间窗口 + 每周固定 1 天 Off Day 轮休）`)

  // 每个部门的「第二位」Manager/Employee（manager5-8 / employee5-8）之前完全没有排班/打卡记录——
  // Manager 的 Attendance Records 页是按部门查排班（不是按"我自己带的人"），所以理论上部门里
  // 第二组人也该出现，但没有排班数据自然就查不到。这里补上：第二位 Manager 跟第一位 Manager 共用
  // 同一条 Manager 时间窗口的班次，第二位 Employee 跟第一位 Employee 共用同一条 Employee 时间窗口
  // 的班次（而不是四个人挤在一条班次上），全部 Present，让 Manager 的 Attendance Records 页真正
  // 显示"整个部门"而不是只有一半人。
  let secondPairCount = 0
  for (const dayDate of PAST_DAYS) {
    for (let i = 0; i < 4; i++) {
      const { managerShiftId, employeeShiftId } = pastShiftsByDeptDay[`${i}|${dateKey(dayDate)}`] ?? {}
      const pairs = [
        [`manager${i + 5}@test.com`, managerShiftId, 1],
        [`employee${i + 5}@test.com`, employeeShiftId, 3],
      ]
      for (const [email, shiftId, roleIndex] of pairs) {
        if (isRestDay(roleIndex, dayDate)) {
          await seedRestDayOffRequest(email, dayDate)
          continue
        }
        if (!shiftId) continue
        const assignment = await assignShift(shiftId, userIdMap[email].internalId, ownerUser.id)
        if (!assignment) continue
        pastAssignments[`${email}|${dateKey(dayDate)}`] = assignment
        await clockRecord(assignment, userIdMap[email].internalId, { dateStr: dateKey(dayDate) })
        secondPairCount++
      }
    }
  }
  console.log(`  ✓ ${secondPairCount} 条第二位 Manager/Employee 的排班+打卡（Manager/Employee 各自共用同角色的班次，全部 Present，每周固定 1 天 Off Day 轮休）`)

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
      created_by: ownerUser.id,
      publication_status: 'published',
      // Report's labor-cost math only counts a Casual Worker's shift if the shift row itself
      // has hourly_rate set (reportService.ts) — without it every attended shift is "uncosted"
      // and Total Casual Worker Cost / Cost Distribution stays $0.
      hourly_rate: 16,
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
  const futMgr1Shift = await createShift({ company_id: company.id, department_id: depts[0].id, shift_date: dateKey(addDays(TODAY, 3)), start_time: DEPT_SHIFT_TIMES[0].manager[0], end_time: DEPT_SHIFT_TIMES[0].manager[1], created_by: ownerUser.id, publication_status: 'published' })
  const futMgr5Shift = await createShift({ company_id: company.id, department_id: depts[0].id, shift_date: dateKey(addDays(TODAY, 4)), start_time: DEPT_SHIFT_TIMES[0].manager[0], end_time: DEPT_SHIFT_TIMES[0].manager[1], created_by: ownerUser.id, publication_status: 'published' })
  const futEmp1Shift = await createShift({ company_id: company.id, department_id: depts[0].id, shift_date: dateKey(addDays(TODAY, 5)), start_time: DEPT_SHIFT_TIMES[0].employee[0], end_time: DEPT_SHIFT_TIMES[0].employee[1], created_by: ownerUser.id, publication_status: 'published' })
  const futEmp2Shift = await createShift({ company_id: company.id, department_id: depts[0].id, shift_date: dateKey(addDays(TODAY, 6)), start_time: DEPT_SHIFT_TIMES[0].employee[0], end_time: DEPT_SHIFT_TIMES[0].employee[1], created_by: ownerUser.id, publication_status: 'published' })
  // Elaine（Customer Support）的这个班次故意撞在她 Off Day 申请的同一天（Step 15），给 UC57 AI 一个能标记 flagged 的冲突
  const futEmp4Shift = await createShift({ company_id: company.id, department_id: depts[3].id, shift_date: dateKey(NEXT_WED), start_time: DEPT_SHIFT_TIMES[3].employee[0], end_time: DEPT_SHIFT_TIMES[3].employee[1], created_by: ownerUser.id, publication_status: 'published' })
  // (2026-08-XX 移除了这里原本重复的 Rachel Koh (manager2) / Kelvin Ang (manager6) 干净班次 +
  // Step 14 的 Rachel↔Kelvin swap request insert — swapSeedDefs 的 'owner-pending-rachel-kelvin'
  // 已经是同一对 Manager、同样 pending/对方已同意的场景，两边都建等于同一天让 manager2/manager6
  // 各自被排了两条班，是真的 double-booking bug，不是两种不同测试场景。)

  const futMgr1Assign = await assignShift(futMgr1Shift?.id, userIdMap['manager1@test.com'].internalId, ownerUser.id)
  const futMgr5Assign = await assignShift(futMgr5Shift?.id, userIdMap['manager5@test.com'].internalId, ownerUser.id)
  const futEmp1Assign = await assignShift(futEmp1Shift?.id, userIdMap['employee1@test.com'].internalId, ownerUser.id)
  const futEmp2Assign = await assignShift(futEmp2Shift?.id, userIdMap['employee2@test.com'].internalId, ownerUser.id)
  await assignShift(futEmp4Shift?.id, userIdMap['employee4@test.com'].internalId, ownerUser.id)
  console.log('  ✓ 5 条未来班次（David/Wendy 换班用，不种 pending，留给 Manager 自测 Submit；Employee 换班 2 条 + Off Day 冲突用 1 条）')

  // 未来 13 天（到"下周"为止，不铺到下下周）：4 部门 × Manager+Employee 完整常规排班（部门专属
  // 时间窗口，Manager 时间窗口比 Employee 早开始/晚结束）——上面那几条 + swapSeedDefs 只是专门给
  // Shift Swap 用的散班次，未来大部分日期在 Shift Timeline 上原本是空的（全员灰色 OFF），跟过去
  // 10 天的规律排班完全不对称，日历上的"有排班"圆点（datesWithShifts 不分角色，只要当天有任何
  // shift 就点亮）因此会跟 Timeline 实际显示的 OFF 对不上，也会一路点到一个月后。这里把未来
  // 13 天也铺满，让圆点跟 Timeline 一致、且不超出"下周"。跳过 swapSeedDefs（上面 Step 8b）+
  // futMgr1/futMgr5/futEmp1/futEmp2/futEmp4 已经占用的 (人, 日期)，避免重复建班（双重排班）。
  const FUTURE_DAYS = Array.from({ length: 13 }, (_, i) => addDays(TODAY, i + 1))
  const futureShiftSkipSet = new Set([
    `manager1@test.com|${dateKey(addDays(TODAY, 3))}`,
    `manager5@test.com|${dateKey(addDays(TODAY, 4))}`,
    `employee1@test.com|${dateKey(addDays(TODAY, 5))}`,
    `employee2@test.com|${dateKey(addDays(TODAY, 6))}`,
    `employee4@test.com|${dateKey(NEXT_WED)}`,
    ...swapSeedDefs.flatMap(def => [
      `${def.requesterEmail}|${dateKey(addDays(TODAY, def.requesterDayOffset))}`,
      `${def.counterpartEmail}|${dateKey(addDays(TODAY, def.counterpartDayOffset))}`,
    ]),
    // Split-shift demo days (see splitShiftDefs below) — the generic roster must not also give
    // these 4 people a normal single-block shift on the same date.
    `manager4@test.com|${dateKey(addDays(TODAY, 4))}`,
    `manager1@test.com|${dateKey(addDays(TODAY, 7))}`,
    `employee2@test.com|${dateKey(addDays(TODAY, 3))}`,
    `employee7@test.com|${dateKey(addDays(TODAY, 9))}`,
  ])
  // Ben Seah / Grace Lim's weekly rest day rotation would otherwise land exactly on NEXT_MON, the
  // same date Step 15 has them submit a real Fixed Day Off *request* for (the whole point of that
  // scenario is requesting a day off from a day they'd normally be working) — force a regular
  // shift instead of the rotation's Off Day on that one date so the two don't collide.
  //
  // manager1 (David Lim) needs to be demo-able for Submit Off Day: MyRequestsPanel's
  // hasMyFixedOffForActiveWeek disables the whole "Off Day Request" option (not just the final
  // submit button) if the user has ANY off_day_requests row — auto-rotation included, source
  // doesn't matter — for whichever week resolveActiveSubmissionWeekStart currently considers open
  // (with no off_day_submission_deadline row seeded, that's always "next week", i.e. NEXT_MON's
  // week). So manager1's own Wed/Sun rotation rest days that land inside that specific week get a
  // regular shift instead of an auto Off Day, keeping him with zero Off Day rows for the currently
  // open week — every other week he still gets his normal 2 rest days.
  const restDayRotationExceptions = new Set([
    `employee1@test.com|${dateKey(NEXT_MON)}`,
    `employee5@test.com|${dateKey(NEXT_MON)}`,
    `manager1@test.com|${dateKey(addDays(NEXT_MON, 2))}`, // Wed of the currently open submission week
    `manager1@test.com|${dateKey(addDays(NEXT_MON, 6))}`, // Sun of the currently open submission week
  ])
  let futureRosterCount = 0
  for (const dayDate of FUTURE_DAYS) {
    for (const [i, staff] of deptStaff.entries()) {
      const times = DEPT_SHIFT_TIMES[i]
      const managerShift = await createShift({
        company_id: company.id, department_id: staff.dept.id, shift_date: dateKey(dayDate),
        start_time: times.manager[0], end_time: times.manager[1],
        created_by: ownerUser.id, publication_status: 'published',
      })
      const employeeShift = await createShift({
        company_id: company.id, department_id: staff.dept.id, shift_date: dateKey(dayDate),
        start_time: times.employee[0], end_time: times.employee[1],
        created_by: ownerUser.id, publication_status: 'published',
      })
      // roleIndex: 0/1 = 1st/2nd Manager, 2/3 = 1st/2nd Employee — matches REST_DAYS_OF_WEEK_BY_ROLE_INDEX.
      const roleEmails = [
        [managerShift, [`manager${i + 1}@test.com`, `manager${i + 5}@test.com`], [0, 1]],
        [employeeShift, [`employee${i + 1}@test.com`, `employee${i + 5}@test.com`], [2, 3]],
      ]
      for (const [shift, emails, roleIndexes] of roleEmails) {
        for (const [j, email] of emails.entries()) {
          // Priority: an already-scripted Shift Swap shift for this exact (person, date) wins over
          // the rotation, then the weekly rest-day rotation, then the regular roster shift.
          const key = `${email}|${dateKey(dayDate)}`
          if (futureShiftSkipSet.has(key)) continue
          if (isRestDay(roleIndexes[j], dayDate) && !restDayRotationExceptions.has(key)) {
            await seedRestDayOffRequest(email, dayDate)
            continue
          }
          const assignment = await assignShift(shift?.id, userIdMap[email].internalId, ownerUser.id)
          if (assignment) futureRosterCount++
        }
      }
    }
  }
  console.log(`  ✓ ${futureRosterCount} 条未来 13 天的常规排班（4 部门 × Manager+Employee×2，部门专属时间窗口 + 每周固定 1 天 Off Day 轮休，跳过已建的 Shift Swap 专属场景）`)

  // Split Shift 演示数据（4 部门各一条）——真实 Split 是同一天两条 shift 记录共用一个
  // split_group_id（见 shiftService.createSplitShift），中间空出一段时间，不是一条长班次。
  // 复用上面已经在 futureShiftSkipSet 里占好的 4 个 (人, 日期)，避免常规排班在同一天重复建班。
  console.log('\n创建 Split Shift 演示数据...')
  const splitShiftDefs = [
    { email: 'manager4@test.com', dept: 3, daysAhead: 4, blocks: [['09:30', '13:00'], ['14:30', '18:30']] }, // Fiona Chen, Customer Support
    { email: 'manager1@test.com', dept: 0, daysAhead: 7, blocks: [['08:30', '13:00'], ['14:00', '17:30']] }, // David Lim, Operations
    { email: 'employee2@test.com', dept: 1, daysAhead: 3, blocks: [['10:00', '14:00'], ['15:00', '18:00']] }, // Chloe Yeo, Marketing
    { email: 'employee7@test.com', dept: 2, daysAhead: 9, blocks: [['08:30', '12:30'], ['13:30', '16:30']] }, // Ivan Koh, Engineering
  ]
  for (const def of splitShiftDefs) {
    const splitGroupId = crypto.randomUUID()
    const shiftDate = dateKey(addDays(TODAY, def.daysAhead))
    for (const [start, end] of def.blocks) {
      const shift = await createShift({
        company_id: company.id, department_id: depts[def.dept].id, shift_date: shiftDate,
        start_time: start, end_time: end, created_by: ownerUser.id,
        publication_status: 'published', split_group_id: splitGroupId,
      })
      await assignShift(shift?.id, userIdMap[def.email].internalId, ownerUser.id)
    }
  }
  console.log('  ✓ 4 条 Split Shift（每个部门各一条：Fiona Chen/David Lim/Chloe Yeo/Ivan Koh），All Departments Shift Timeline 上能看到分块班次')

  // Marcus Lee 的另外 2 个未来班次（不打卡，不建 attendance_record）——让 CW Dashboard 的
  // Upcoming Jobs 除了今天这个即时可 Clock In 的班次外，还能看到「之后」的排班，符合正常使用场景。
  const cwFutShift1 = await createShift({
    company_id: company.id,
    department_id: depts[0].id,
    shift_date: dateKey(addDays(TODAY, 2)),
    start_time: '11:00',
    end_time: '15:00',
    created_by: ownerUser.id,
    publication_status: 'published',
  })
  const cwFutShift2 = await createShift({
    company_id: company.id,
    department_id: depts[0].id,
    shift_date: dateKey(addDays(TODAY, 5)),
    start_time: '09:00',
    end_time: '13:00',
    created_by: ownerUser.id,
    publication_status: 'published',
  })
  await assignShift(cwFutShift1?.id, userIdMap['casual1@test.com'].internalId, ownerUser.id, userIdMap['employee1@test.com'].internalId)
  await assignShift(cwFutShift2?.id, userIdMap['casual1@test.com'].internalId, ownerUser.id, userIdMap['employee1@test.com'].internalId)
  console.log('  ✓ Marcus Lee 另外 2 条未来班次（Upcoming Jobs 列表用）')

  // Marcus Lee 再多 3 条未来班次，铺满 Upcoming Jobs（2026-07-31：单独 2 条太单薄，Casual
  // Dashboard 看起来像个几乎没排班的账号）——凑成一个排班很满的活跃 Casual Worker。
  // casualDashboardService.UPCOMING_WINDOW_DAYS = 7（今天含在内，窗口到 TODAY+6）——超出这个
  // 窗口的班次不会出现在 Dashboard 的 Upcoming Jobs 里，所以这几条必须落在 +1..+6 天内，且避开
  // 已有的 +2 / +5，让一周内每天最多一条，看起来是排得满满的一周而不是同一天撞两条。
  const cwMoreFutureDefs = [
    { days: 1, start: '10:00', end: '14:00' },
    { days: 3, start: '17:00', end: '21:00' },
    { days: 6, start: '09:00', end: '13:00' },
  ]
  for (const def of cwMoreFutureDefs) {
    const shift = await createShift({
      company_id: company.id,
      department_id: depts[0].id,
      shift_date: dateKey(addDays(TODAY, def.days)),
      start_time: def.start,
      end_time: def.end,
      created_by: ownerUser.id,
      publication_status: 'published',
    })
    await assignShift(shift?.id, userIdMap['casual1@test.com'].internalId, ownerUser.id, userIdMap['employee1@test.com'].internalId)
  }
  console.log('  ✓ Marcus Lee 再 3 条未来班次（共 5 条未来班次，Upcoming Jobs 列表铺满）')

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
  // 昨天：employee1 迟到 20 分钟，但 David Lim（manager1）后来手动改过打卡时间（"M" Modified
  // 徽章的真实数据来源——raw clock_in_time 还是原始的迟到时间，modified_clock_in_time 是改过的）。
  await clockRecord(pastAssignments[`employee1@test.com|${dateKey(YESTERDAY)}`], userIdMap['employee1@test.com'].internalId, {
    dateStr: dateKey(YESTERDAY), lateMinutes: 20,
    modifiedBy: manager1UserId, modifiedReason: 'Turnstile badge reader was down that morning — confirmed on-time via CCTV.', modifiedClockInMinutes: 0,
  })
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
  if (userIdMap['casual2@test.com']) {
    // Already created by Step 8c's dashboardCasual2Auth pack (same person, Farah Aziz) — reuse it.
    console.log(`  ✓ Casual Worker: Farah Aziz 已在 Step 8c 创建 → ${userIdMap['casual2@test.com'].internalId}`)
  } else {
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
      })
      .select()
      .single()
    if (casual2UserErr) { console.error('  ✗ 插入第二个 Casual Worker users 失败:', casual2UserErr.message); process.exit(1) }
    userIdMap['casual2@test.com'] = { authId: casual2Auth.user.id, internalId: casual2User.id }
    console.log(`  ✓ Casual Worker: Farah Aziz → ${casual2User.id}`)
  }

  // start_time 09:00 to match clockRecord's hardcoded 09:00 clock-in baseline (see the helper
  // above) — that's what makes lateMinutes actually land as "late" against the real shift start.
  const casual2Days = [addDays(TODAY, -6), addDays(TODAY, -5), addDays(TODAY, -4), addDays(TODAY, -3)]
  const casual2Assignments = {}
  for (const dayDate of casual2Days) {
    const shift = await createShift({
      company_id: company.id, department_id: depts[1].id, shift_date: dateKey(dayDate),
      start_time: '09:00', end_time: '13:00',
      created_by: ownerUser.id, publication_status: 'published',
      // Report's labor-cost math only counts a Casual Worker's shift if the shift row itself
      // has hourly_rate set — without it every attended shift is "uncosted" and Total Casual
      // Worker Cost / Cost Distribution stays $0.
      hourly_rate: 14,
    })
    const assignment = shift && await assignShift(shift.id, userIdMap['casual2@test.com'].internalId, ownerUser.id, userIdMap['employee2@test.com'].internalId)
    if (assignment) casual2Assignments[dateKey(dayDate)] = assignment
  }
  // Present, Late (25 min), Absent (no record), Present — exactly 1 Late + 1 No-show this period.
  await clockRecord(casual2Assignments[dateKey(addDays(TODAY, -6))], userIdMap['casual2@test.com'].internalId, { dateStr: dateKey(addDays(TODAY, -6)), endStr: '13:00' })
  await clockRecord(casual2Assignments[dateKey(addDays(TODAY, -5))], userIdMap['casual2@test.com'].internalId, { dateStr: dateKey(addDays(TODAY, -5)), endStr: '13:00', lateMinutes: 25 })
  // -4 天：故意不打卡 → Absent / No-show
  await clockRecord(casual2Assignments[dateKey(addDays(TODAY, -3))], userIdMap['casual2@test.com'].internalId, { dateStr: dateKey(addDays(TODAY, -3)), endStr: '13:00' })
  console.log('  ✓ Farah Aziz 本期 4 条 Marketing 部门班次：Present / Late 25min / No-show / Present')

  const { error: cwd2Err } = await supabase.from('casualworker_departments').upsert({
    casual_worker_id: userIdMap['casual2@test.com'].internalId,
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

  // David Lim (manager1) / Wendy Ho (manager5) 的完整一套（2 pending/1 approved/1 rejected/1
  // hidden）已经在上面的 swapSeedDefs 里种好了（2026-08-02）。Rachel Koh ↔ Kelvin Ang 同理也已经
  // 在 swapSeedDefs 的 'owner-pending-rachel-kelvin' 里种好了，这里不重复建。
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
  const { error: offApprovedErr } = await supabase.from('off_day_requests').insert({
    user_id: userIdMap['employee3@test.com'].internalId,
    company_id: company.id,
    requested_date: dateKey(TODAY),
    requested_week: dateKey(mondayOf(TODAY)),
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
  const { error: offSafeErr } = await supabase.from('off_day_requests').insert({
    user_id: userIdMap['employee1@test.com'].internalId,
    company_id: company.id,
    requested_date: weekStartNext,
    requested_week: weekStartNext,
    source: 'submitted',
    status: 'pending',
  })
  if (offSafeErr) console.warn(`  ⚠ 创建 pending Off Day 失败 (employee1): ${offSafeErr.message}`)
  else console.log(`  ✓ Off Day（待审批）：Ben Seah → ${weekStartNext}（Operations 现有 2 个 Employee，先提交的这条 AI Process 应判定 safe）`)

  const { error: offFlaggedErr } = await supabase.from('off_day_requests').insert({
    user_id: userIdMap['employee5@test.com'].internalId,
    company_id: company.id,
    requested_date: weekStartNext,
    requested_week: weekStartNext,
    source: 'submitted',
    status: 'pending',
  })
  if (offFlaggedErr) console.warn(`  ⚠ 创建 pending Off Day 失败 (employee5): ${offFlaggedErr.message}`)
  else console.log(`  ✓ Off Day（待审批）：Grace Lim → ${weekStartNext}（跟 Ben Seah 撞同一天且后提交，AI Process 应判定 flagged 并给出真实的替代日建议）`)

  const { error: offMgrErr } = await supabase.from('off_day_requests').insert({
    user_id: userIdMap['manager3@test.com'].internalId,
    company_id: company.id,
    requested_date: dateKey(NEXT_TUE),
    requested_week: weekStartNext,
    source: 'submitted',
    status: 'pending',
  })
  if (offMgrErr) console.warn(`  ⚠ 创建 pending Off Day 失败 (manager3): ${offMgrErr.message}`)
  else console.log(`  ✓ Off Day（待审批）：Aaron Wong → ${dateKey(NEXT_TUE)}（Manager 自己的申请，同样是 O/P 审批；Engineering 现在有 manager3+manager7 两个 Manager，AI Process 应判定 safe——覆盖"Manager 自己申请 Off Day"这个提交路径，跟 Ben/Grace 那组 Employee 场景分开测）`)

  // (2026-08-XX) David Lim (manager1) 之前在这里有一条 pending Off Day，跟 employee1 的那条
  // 一一对应做对比数据用——但 requested_week 落在 weekStartNext，跟前端 hasMyFixedOffForActiveWeek
  // 判断的"当前可提交周"是同一周，导致 My Requests 里 Off Day Request 那个选项整个被禁用（灰掉、
  // 连 modal 都点不开），manager1 没法自己再提交新的 Off Day——用户要用这个账号做 demo，必须能
  // 现场提交，所以这条移除了，David 目前对 Off Day 是干净状态。

  const { error: offConflictErr } = await supabase.from('off_day_requests').insert({
    user_id: userIdMap['employee4@test.com'].internalId,
    company_id: company.id,
    requested_date: dateKey(NEXT_WED),
    requested_week: weekStartNext,
    source: 'submitted',
    status: 'pending',
  })
  if (offConflictErr) console.warn(`  ⚠ 创建 pending Off Day 失败 (employee4): ${offConflictErr.message}`)
  else console.log(`  ✓ Off Day（待审批）：Elaine Chua → ${dateKey(NEXT_WED)}（当天她已经有排好的班次——AI Process 不检查排班冲突，只检查部门人数，这条仅供手动测试"批准了跟已排班撞期的休假会怎样"）`)

  // Marketing 之前在 Off Day 待审批队列里一条都没有；Customer Support 除了 Elaine 那条特意做冲突
  // 测试的以外也没有"正常"的一条——都补上，让 Requests 队列覆盖到全部 4 个部门。
  const { error: offMktErr } = await supabase.from('off_day_requests').insert({
    user_id: userIdMap['employee6@test.com'].internalId,
    company_id: company.id,
    requested_date: dateKey(addDays(NEXT_MON, 2)),
    requested_week: weekStartNext,
    source: 'submitted',
    status: 'pending',
  })
  if (offMktErr) console.warn(`  ⚠ 创建 pending Off Day 失败 (employee6): ${offMktErr.message}`)
  else console.log(`  ✓ Off Day（待审批）：Hannah Lee → ${dateKey(addDays(NEXT_MON, 2))}（Marketing，之前待审批队列里没有 Marketing 的申请）`)

  const { error: offCsErr } = await supabase.from('off_day_requests').insert({
    user_id: userIdMap['employee8@test.com'].internalId,
    company_id: company.id,
    requested_date: dateKey(addDays(NEXT_MON, 4)),
    requested_week: weekStartNext,
    source: 'submitted',
    status: 'pending',
  })
  if (offCsErr) console.warn(`  ⚠ 创建 pending Off Day 失败 (employee8): ${offCsErr.message}`)
  else console.log(`  ✓ Off Day（待审批）：Sophia Tan → ${dateKey(addDays(NEXT_MON, 4))}（Customer Support，一条不带冲突的正常申请，跟 Elaine 那条特意做冲突测试的分开）`)

  // 一条已经处理完的 'modified' 历史记录——Off Day 的 Completed Requests 列表之前完全是空的
  // （只有 pending 队列有数据）。Kelvin Ang 原本申请的那天被 Owner 挪到了另一天，
  // requested_date 直接改写成新日期（跟 attendanceService.decideFixedOffDayRequest 的真实
  // 行为一致），status 变成 'modified'，reviewed_by/reviewed_at 记录是谁、什么时候处理的。
  // +9 (not +5/+8, both of which land on manager6's own weekly rest-day-rotation Saturday/Tuesday
  // and would collide with the off_day_requests row that rotation already inserted for him) and
  // outside the 13-day future roster window entirely, so nothing else could have claimed this date.
  const { error: offModifiedErr } = await supabase.from('off_day_requests').insert({
    user_id: userIdMap['manager6@test.com'].internalId,
    company_id: company.id,
    requested_date: dateKey(addDays(NEXT_MON, 9)),
    requested_week: weekStartNext,
    source: 'submitted',
    status: 'modified',
    reviewed_by: ownerUser.id,
    reviewed_at: minutesAgo(180),
  })
  if (offModifiedErr) console.warn(`  ⚠ 创建 modified Off Day 失败 (manager6): ${offModifiedErr.message}`)
  else console.log(`  ✓ Off Day（已处理，modified）：Kelvin Ang 原申请日期被 Sarah Mitchell 改到 ${dateKey(addDays(NEXT_MON, 9))}——Off Day 的 Completed Requests 列表不再是空的`)

  // ── Step 16: 创建 Job Templates + Shift Templates（Recruitment/Shift 模板列表不再留白）──
  console.log('\nStep 16: 创建 Job Templates + Shift Templates...')
  const jobTemplateDefs = [
    {
      company_id: company.id, created_by: ownerUser.id,
      title: 'Event Crew', responsibilities: 'General event support — setup, registration desk, and teardown.',
      skills: 'Comfortable on your feet for a full shift, punctual.',
      job_type: 'oneoff', department_id: depts[0].id,
      salary_amount: 15, uniform_type: 'none',
      experience_required: 'Not Required', minimum_age: 16, estimated_hours: '6', urgency: 'normal',
    },
    {
      company_id: company.id, created_by: ownerUser.id,
      title: 'Warehouse Assistant', responsibilities: 'Recurring weekend stock-count and inventory shift.',
      skills: 'Basic spreadsheet use, comfortable with repetitive tasks.',
      job_type: 'shift', department_id: depts[2].id,
      salary_amount: 13.5, uniform_type: 'none',
      experience_required: '6+ Months', minimum_age: 18, urgency: 'normal',
    },
    // Manager-created (David Lim, Operations) — so manager1@test.com has a template of their own
    // to test UC37 Edit Job Template with (Job Templates are creator-only to edit, department-only
    // to view — Owner's two templates above are invisible to a Manager, see jobTemplateRepository).
    {
      company_id: company.id, created_by: userIdMap['manager1@test.com'].internalId,
      title: 'Café Cover Staff', responsibilities: 'Cover the café counter for a weekend rush — orders, till, and light cleaning.',
      skills: 'Comfortable handling cash, friendly with customers.',
      job_type: 'oneoff', department_id: depts[0].id,
      salary_amount: 16, uniform_type: 'none',
      experience_required: 'Not Required', minimum_age: 16, estimated_hours: '5', urgency: 'normal',
    },
  ]
  for (const def of jobTemplateDefs) {
    const { error } = await supabase.from('job_templates').insert(def)
    if (error) console.warn(`  ⚠ 创建 job_template 失败 (${def.title}): ${error.message}`)
    else console.log(`  ✓ Job Template: ${def.title}`)
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

  // Task Templates (UC14, Paid-only) — company plan is now 'Paid' so this list must not be empty.
  // department_id null = Owner/Partner-only template; a Manager-tagged one so manager1@test.com
  // also has a template of their own (mirrors the job_templates split above).
  const taskTemplateDefs = [
    {
      company_id: company.id, department_id: null, created_by: ownerUser.id,
      title: 'Weekly Stock Count', description: 'Count and reconcile stock levels against the system record.',
      priority: 'Medium', sub_task_titles: ['Count shelf stock', 'Reconcile against POS', 'Flag discrepancies'],
    },
    {
      company_id: company.id, department_id: null, created_by: ownerUser.id,
      title: 'Opening Checklist', description: 'Standard checklist to run through before opening to customers.',
      priority: 'High', sub_task_titles: [],
    },
    {
      company_id: company.id, department_id: depts[0].id, created_by: userIdMap['manager1@test.com'].internalId,
      title: 'Floor Reset', description: 'Reset the Operations floor layout after an event or shift change.',
      priority: 'Low', sub_task_titles: ['Clear equipment', 'Realign furniture'],
    },
  ]
  for (const def of taskTemplateDefs) {
    const { error } = await supabase.from('task_templates').insert(def)
    if (error) console.warn(`  ⚠ 创建 task_template 失败 (${def.title}): ${error.message}`)
    else console.log(`  ✓ Task Template: ${def.title}`)
  }

  // ── Step 17: 创建 1 条 Archived Job Posting（Archived 列表不再留白）──────────
  console.log('\nStep 17: 创建 Archived Job Posting...')
  const { error: archivedErr } = await supabase.from('job_postings').insert({
    company_id: company.id, department_id: depts[3].id, created_by: ownerUser.id,
    title: 'Holiday Season Support — Customer Support', responsibilities: 'Extra overnight support coverage for the holiday rush.',
    skills: 'Clear written English, own laptop.',
    status: 'archived', job_type: 'oneoff', urgency: 'normal',
    estimated_hours: '6', job_start_time: '20:00', openings: 2, experience_required: 'Not Required',
    minimum_age: 18, salary_amount: 15, expires_at: dateKey(TWO_DAYS_AGO),
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
    title: 'Product Launch Day Crew', responsibilities: 'One-day crew to support an in-store product launch event.',
    skills: 'Outgoing, comfortable talking to customers.',
    status: 'closed', job_type: 'oneoff', urgency: 'normal',
    estimated_hours: '5', job_date: dateKey(addDays(TODAY, -2)), job_start_time: '10:00',
    openings: 1, experience_required: 'Not Required', minimum_age: 16,
    salary_amount: 80, expires_at: dateKey(addDays(TODAY, -3)), created_at: closedCreatedAt,
  }).select().single()
  if (closedJobErr) {
    console.warn(`  ⚠ 创建 closed job_posting 失败: ${closedJobErr.message}`)
  } else {
    const { data: closedApp, error: closedAppErr } = await supabase.from('job_applicants').insert({
      job_id: closedJob.id, user_id: userIdMap['guest3@test.com'].internalId,
      resume: guestApplicants.find(g => g.email === 'guest3@test.com').resume_url, status: 'accepted',
      decided_at: closedConfirmedAt,
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
  async function createClosedJobPosting({ departmentId, title, description, skills, openings, hires, createdDaysAgo, confirmedDaysAgo, salary }) {
    const createdAt = dueAtOn(addDays(TODAY, -createdDaysAgo), 9)
    const confirmedAt = dueAtOn(addDays(TODAY, -confirmedDaysAgo), 15)
    const { data: job, error: jobErr } = await supabase.from('job_postings').insert({
      company_id: company.id, department_id: departmentId, created_by: ownerUser.id,
      title, responsibilities: description, skills,
      status: 'closed', job_type: 'oneoff', urgency: 'normal',
      estimated_hours: '5', job_date: dateKey(addDays(TODAY, -confirmedDaysAgo)), job_start_time: '10:00',
      openings, experience_required: 'Not Required', minimum_age: 16,
      salary_amount: salary, expires_at: dateKey(addDays(TODAY, -confirmedDaysAgo)), created_at: createdAt,
    }).select().single()
    if (jobErr) { console.warn(`  ⚠ 创建 closed job_posting 失败 (${title}): ${jobErr.message}`); return }
    for (const guestEmail of hires) {
      const { data: app, error: appErr } = await supabase.from('job_applicants').insert({
        job_id: job.id, user_id: userIdMap[guestEmail].internalId,
        resume: guestApplicants.find(g => g.email === guestEmail).resume_url, status: 'accepted',
        decided_at: confirmedAt,
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
    skills: 'Comfortable with physical, repetitive work.',
    openings: 2, hires: ['guest1@test.com', 'guest5@test.com'], createdDaysAgo: 6, confirmedDaysAgo: 5, salary: 70,
  })
  await createClosedJobPosting({
    departmentId: depts[2].id, title: 'IT Helpdesk Temp Support',
    description: 'Temporary helpdesk coverage for a hardware refresh rollout.',
    skills: 'Basic troubleshooting and networking knowledge.',
    openings: 3, hires: ['guest2@test.com'], createdDaysAgo: 6, confirmedDaysAgo: 4, salary: 90,
  })
  await createClosedJobPosting({
    departmentId: depts[3].id, title: 'Weekend Support Overflow Crew',
    description: 'Extra hands to clear the weekend support ticket backlog.',
    skills: 'Clear written English, calm under pressure.',
    openings: 2, hires: ['guest4@test.com', 'guest3@test.com'], createdDaysAgo: 6, confirmedDaysAgo: 1, salary: 75,
  })

  // ── Step 18: 给 Marcus Lee 建一个"现在就能打卡"的 Shift Casual Worker 工作（UC49）──
  // 时间从真实当下往前推 45 分钟起、往后推 20 分钟止，跑完 seed 立刻登录 casual1@test.com 就能
  // Clock In。job_type: 'shift'（2026-08-XX 从 'oneoff' 换过来）—— 真实 app 里
  // workerApplicationService 对 shift 职位建 shift 时 is_open_ended: false：有 Break In/Break
  // Out，到点（或 Clock In 后随时，因为这是活的当下窗口）自己 Clock Out，不需要主管
  // （Ben Seah / employee1@test.com）批准放行。shift_date 用 UTC 日历日，跟打卡窗口判定用的
  // 时区口径保持一致。
  console.log('\nStep 18: 创建 Casual Worker 当前可打卡的工作...')
  const cwOpenStart = new Date(Date.now() - 45 * 60000)
  const cwOpenEnd = new Date(Date.now() + 20 * 60000)
  // UTC calendar date — matches both the Clock In gate (casualAttendanceService.clockIn) and the
  // Casual Dashboard's "which jobs show up" query (casualDashboardService.findCurrentAssignment,
  // fixed to use the same UTC day instead of local — see that file for why the two need to agree).
  const cwOpenShiftDate = dateKeySGT(cwOpenStart)

  // openings: 1 and the single applicant below is inserted directly as 'accepted' (i.e. already
  // confirmed) — in the real app, respondToInvitation's auto-close (acceptedCount >= openings)
  // would flip this to 'closed' the moment that confirmation lands. Seeding bypasses that service
  // call, so the row must be inserted already 'closed' or it sits in Active Jobs fully filled,
  // which is exactly the inconsistency this seed step exists to avoid.
  const { data: cwOpenJob, error: cwOpenJobErr } = await supabase.from('job_postings').insert({
    company_id: company.id, department_id: depts[0].id, created_by: ownerUser.id,
    title: 'Same-Day Café Cover Shift', responsibilities: 'Cover the café counter for a same-day gap in the roster.',
    skills: 'Available immediately, comfortable handling cash and orders.',
    status: 'closed', archived_at: new Date().toISOString(), job_type: 'shift', urgency: 'urgent',
    job_date: cwOpenShiftDate, job_start_time: toHM(cwOpenStart), job_end_time: toHM(cwOpenEnd),
    openings: 1, experience_required: 'Not Required', minimum_age: 16,
    salary_amount: 16, expires_at: dateKey(addDays(TODAY, 3)),
  }).select().single()
  if (cwOpenJobErr) {
    console.warn(`  ⚠ 创建 job_posting 失败 (Same-Day Café Cover Shift): ${cwOpenJobErr.message}`)
  } else {
    const { data: cwOpenApp, error: cwOpenAppErr } = await supabase.from('job_applicants').insert({
      job_id: cwOpenJob.id, user_id: userIdMap['casual1@test.com'].internalId,
      resume: 'https://example.com/demo-resumes/marcus-lee-resume.pdf', status: 'accepted',
      additional_note: "I've covered this counter before — happy to jump in today.",
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
      created_by: ownerUser.id, publication_status: 'published',
      source_job_posting_id: cwOpenJob.id,
      // Mirrors workerApplicationService.confirmApplication's shift-creation mapping
      // (hourly_rate: job.salary_amount) — without it Attendance's Total Earnings has no rate to
      // compute a flat payout from and shows "–".
      hourly_rate: 16,
    })
    if (cwOpenShift) {
      await assignShift(cwOpenShift.id, userIdMap['casual1@test.com'].internalId, ownerUser.id, userIdMap['employee1@test.com'].internalId)
      console.log(`  ✓ Marcus Lee 的开放班次（Shift）：${cwOpenJob.title}（今天 ${toHM(cwOpenStart)}–${toHM(cwOpenEnd)} UTC，登录 casual1@test.com 立刻可 Clock In → Break In → Break Out → Clock Out 一路点完，不需要主管放行）`)

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
        status: 'In Progress', due_at: dueAtOn(TODAY), priority: 'Medium',
      })
      await createTask({
        company_id: company.id, department_id: depts[0].id, shift_id: cwOpenShift.id,
        title: 'Wipe down and reset outdoor seating', description: 'Clean tables and chairs, reset umbrellas for the next customers.',
        assigned_user_id: userIdMap['casual1@test.com'].internalId, assigned_by: userIdMap['employee1@test.com'].internalId,
        status: 'Review', due_at: dueAtOn(TODAY), priority: 'Low',
      })
      await createTask({
        company_id: company.id, department_id: depts[0].id, shift_id: cwOpenShift.id,
        title: 'Brief opening checklist to Marcus', description: 'Walk through the opening checklist before the counter opens.',
        assigned_user_id: userIdMap['casual1@test.com'].internalId, assigned_by: userIdMap['employee1@test.com'].internalId,
        status: 'Complete', due_at: dueAtOn(YESTERDAY),
      })
      console.log('  ✓ Ben Seah 给 Marcus Lee 分派的 4 条 Task（挂在当前班次 shift_id 上，Kanban 三列 + 1 条历史）')
    }
  }

  // ── Step 18c: 一个新 Casual Worker（Hana Bakri，casual8）现在就能打卡的 Shift Job（对照
  // Step 18 的 One-off，验证 Break In/Break Out + 按时薪算钱这条路径没被 Step 18/is_open_ended
  // 的改动带偏）── 之前这条是直接又建在 Marcus Lee（casual1）身上的，跟 Step 18 的 One-off job
  // 用几乎相同的"往前 45 分钟起、往后 20 分钟止"算出来的时间，结果同一个人同一天两条时间几乎
  // 一样的班次，Attendance/Shift 页看起来像同一条数据重复了两遍（2026-08-XX 测试发现，一个人一天
  // 不该有两条班次）。改成一个专门的新 Casual Worker，两个 job type 各自独立测，互不干扰。
  console.log('\nStep 18c: 创建新 Casual Worker（Hana Bakri）...')
  const { data: casual8Auth, error: casual8AuthErr } = await supabase.auth.admin.createUser({
    email: 'casual8@test.com', password: PASSWORD, email_confirm: true,
  })
  if (casual8AuthErr || !casual8Auth.user) {
    console.warn(`  ⚠ Failed to create casual8@test.com auth: ${casual8AuthErr?.message}`)
  } else {
    const { data: casual8User, error: casual8UserErr } = await supabase
      .from('users')
      .insert({
        supabase_auth_id: casual8Auth.user.id,
        full_name: 'Hana Bakri',
        email_address: 'casual8@test.com',
        phone_number: '+65 8300 3008',
        date_of_birth: '2000-05-30',
        profile_photo_url: DEMO_PHOTO_URL,
        role: 'Casual Worker',
        company_id: company.id,
      })
      .select()
      .single()
    if (casual8UserErr) {
      console.warn(`  ⚠ Failed to create casual8@test.com user: ${casual8UserErr.message}`)
    } else {
      userIdMap['casual8@test.com'] = { authId: casual8Auth.user.id, internalId: casual8User.id }
      const { error: casual8DeptErr } = await supabase.from('casualworker_departments').upsert({
        casual_worker_id: casual8User.id, department_id: opsDept.id, company_id: company.id,
        verified_at: new Date().toISOString(),
      }, { onConflict: 'casual_worker_id,department_id' })
      if (casual8DeptErr) console.warn(`  ⚠ Failed to verify casual8@test.com in Operations: ${casual8DeptErr.message}`)
    }
  }

  console.log('\nStep 18c: 创建 Casual Worker 当前可打卡的 Shift Job（对照 One-off）...')
  const cwShiftStart = new Date(Date.now() - 45 * 60000)
  const cwShiftEnd = new Date(Date.now() + 20 * 60000)
  const cwShiftDate = dateKeySGT(cwShiftStart)

  const { data: cwShiftJob, error: cwShiftJobErr } = await supabase.from('job_postings').insert({
    company_id: company.id, department_id: depts[0].id, created_by: ownerUser.id,
    title: 'Same-Day Retail Floor Cover', responsibilities: 'Cover the retail floor for a same-day gap in the roster.',
    skills: 'Available immediately, comfortable with customer-facing retail work.',
    status: 'closed', archived_at: new Date().toISOString(), job_type: 'shift', urgency: 'urgent',
    job_date: cwShiftDate, job_start_time: toHM(cwShiftStart), job_end_time: toHM(cwShiftEnd),
    openings: 1, experience_required: 'Not Required', minimum_age: 16,
    salary_amount: 18, expires_at: dateKey(addDays(TODAY, 3)),
  }).select().single()
  if (cwShiftJobErr) {
    console.warn(`  ⚠ 创建 job_posting 失败 (Same-Day Retail Floor Cover): ${cwShiftJobErr.message}`)
  } else {
    const { data: cwShiftApp, error: cwShiftAppErr } = await supabase.from('job_applicants').insert({
      job_id: cwShiftJob.id, user_id: userIdMap['casual8@test.com'].internalId,
      resume: 'https://example.com/demo-resumes/hana-bakri-resume.pdf', status: 'accepted',
      additional_note: "Happy to cover the floor today.",
    }).select().single()
    if (cwShiftAppErr) {
      console.warn(`  ⚠ 创建 job_applicant 失败 (Hana Bakri): ${cwShiftAppErr.message}`)
    } else {
      const { error: cwShiftInviteErr } = await supabase.from('job_invitations').insert({
        job_id: cwShiftJob.id, applicant_id: cwShiftApp.id, sent_by: ownerUser.id, status: 'accepted',
      })
      if (cwShiftInviteErr) console.warn(`  ⚠ 创建 job_invitation 失败: ${cwShiftInviteErr.message}`)
    }

    const cwShiftShift = await createShift({
      company_id: company.id, department_id: depts[0].id, shift_date: cwShiftDate,
      start_time: toHM(cwShiftStart), end_time: toHM(cwShiftEnd), is_open_ended: false,
      created_by: ownerUser.id, publication_status: 'published',
      source_job_posting_id: cwShiftJob.id,
      hourly_rate: 18,
    })
    if (cwShiftShift) {
      await assignShift(cwShiftShift.id, userIdMap['casual8@test.com'].internalId, ownerUser.id, userIdMap['employee1@test.com'].internalId)
      console.log(`  ✓ Hana Bakri 的开放班次（Shift）：${cwShiftJob.title}（今天 ${toHM(cwShiftStart)}–${toHM(cwShiftEnd)} UTC，登录 casual8@test.com 立刻可 Clock In → Break In → Break Out → Clock Out 一路点完，不需要主管放行）`)
    }
  }

  // ── Step 18d: 给 Marcus Lee（casual1）补 Applications 页两张卡——之前他所有 job_applicant
  // 都是 status:'accepted' + invitation:'accepted'（Confirmed），从来没有 invitation:'sent'
  // （Accept/Reject Offer）或 status:'rejected'（History）的卡，导致 Applications 小红点
  // （sidebar + Ongoing/History 胶囊）永远不会亮，CW 侧完全没法测（2026-08-01，对照 guest1
  // 已经天然齐全的四态数据）。跟真实 shift 无关，纯粹是 job_applicants/job_invitations 记录。
  console.log('\nStep 18d: 给 Marcus Lee 补 Accept/Reject Offer + History 两张 Applications 卡...')
  const { data: cwOfferJob, error: cwOfferJobErr } = await supabase.from('job_postings').insert({
    company_id: company.id, department_id: depts[0].id, created_by: ownerUser.id,
    title: 'Weekend Warehouse Restock — Extra Hands', responsibilities: 'Extra crew to restock the warehouse floor ahead of the weekend rush.',
    skills: 'Comfortable with physical, repetitive work.',
    status: 'closed', job_type: 'oneoff', urgency: 'normal',
    job_date: dateKey(addDays(TODAY, 7)), job_start_time: '10:00:00', estimated_hours: '5',
    openings: 2, experience_required: 'Not Required', minimum_age: 16,
    salary_amount: 70, expires_at: dateKey(addDays(TODAY, 7)),
  }).select().single()
  if (cwOfferJobErr) {
    console.warn(`  ⚠ 创建 job_posting 失败 (Weekend Warehouse Restock — Extra Hands): ${cwOfferJobErr.message}`)
  } else {
    const { data: cwOfferApp, error: cwOfferAppErr } = await supabase.from('job_applicants').insert({
      job_id: cwOfferJob.id, user_id: userIdMap['casual1@test.com'].internalId,
      resume: 'https://example.com/demo-resumes/marcus-lee-resume.pdf', status: 'accepted',
      additional_note: "I've done warehouse restocking before, happy to help this weekend.",
    }).select().single()
    if (cwOfferAppErr) {
      console.warn(`  ⚠ 创建 job_applicant 失败 (Marcus Lee offer): ${cwOfferAppErr.message}`)
    } else {
      const { error: cwOfferInviteErr } = await supabase.from('job_invitations').insert({
        job_id: cwOfferJob.id, applicant_id: cwOfferApp.id, sent_by: ownerUser.id, status: 'sent',
      })
      if (cwOfferInviteErr) console.warn(`  ⚠ 创建 job_invitation 失败: ${cwOfferInviteErr.message}`)
      else console.log('  ✓ Accept/Reject Offer 卡：Weekend Warehouse Restock — Extra Hands')
    }
  }

  const { data: cwRejectJob, error: cwRejectJobErr } = await supabase.from('job_postings').insert({
    company_id: company.id, department_id: depts[0].id, created_by: ownerUser.id,
    title: 'Overnight Stocktake Crew', responsibilities: 'Overnight team counting and organizing warehouse inventory.',
    skills: 'Comfortable with repetitive counting tasks, basic spreadsheet use a plus.',
    status: 'open', job_type: 'shift', urgency: 'normal',
    job_date: dateKey(addDays(TODAY, 9)), job_start_time: '22:00:00', job_end_time: '06:00:00',
    openings: 2, experience_required: '6+ Months', minimum_age: 18,
    salary_amount: 15, expires_at: dateKey(addDays(TODAY, 19)),
  }).select().single()
  if (cwRejectJobErr) {
    console.warn(`  ⚠ 创建 job_posting 失败 (Overnight Stocktake Crew): ${cwRejectJobErr.message}`)
  } else {
    const { error: cwRejectAppErr } = await supabase.from('job_applicants').insert({
      job_id: cwRejectJob.id, user_id: userIdMap['casual1@test.com'].internalId,
      resume: 'https://example.com/demo-resumes/marcus-lee-resume.pdf', status: 'rejected',
      additional_note: "I'm available overnight and comfortable with stocktake work.",
      decided_at: new Date().toISOString(),
    })
    if (cwRejectAppErr) console.warn(`  ⚠ 创建 job_applicant 失败 (Marcus Lee reject): ${cwRejectAppErr.message}`)
    else console.log('  ✓ History 卡：Overnight Stocktake Crew（Not Selected）')
  }

  // ── Step 18b: Employee Dashboard 演示数据——Ben Seah（employee1）今天同时督导两种类型的
  // Casual Worker："Casual Workers Today" 卡片区分 Shift job（固定 start–end，正常打卡）跟
  // One-off job（is_open_ended，只显示 start，主管必须先 Approve Clock Out 放行工人才能自己
  // Clock Out —— 见 employeeAttendanceService.releaseClockOut / getClockOutReleaseQueue）。
  // 用两个全新的 Casual Worker（不复用 casual1-4，他们今天已经在别处排班），One-off 的那个
  // 直接种成"已打卡、未放行"，登录 employee1@test.com 立刻能在 Dashboard 看到 Approve Clock
  // Out 按钮可点。
  console.log('\nStep 18b: Employee Dashboard 演示数据（Ben Seah 同时督导 Shift job + One-off job 两个 Casual Worker）...')

  const { data: casual5Auth, error: casual5AuthErr } = await supabase.auth.admin.createUser({
    email: 'casual5@test.com', password: PASSWORD, email_confirm: true,
  })
  if (casual5AuthErr || !casual5Auth.user) {
    console.warn(`  ⚠ Failed to create casual5@test.com auth: ${casual5AuthErr?.message}`)
  } else {
    const { data: casual5User, error: casual5UserErr } = await supabase
      .from('users')
      .insert({
        supabase_auth_id: casual5Auth.user.id,
        full_name: 'Hafiz Rahman',
        email_address: 'casual5@test.com',
        phone_number: '+65 8300 3005',
        date_of_birth: '1999-09-09',
        profile_photo_url: DEMO_PHOTO_URL,
        role: 'Casual Worker',
        company_id: company.id,
      })
      .select()
      .single()
    if (casual5UserErr) {
      console.warn(`  ⚠ Failed to create casual5@test.com user: ${casual5UserErr.message}`)
    } else {
      userIdMap['casual5@test.com'] = { authId: casual5Auth.user.id, internalId: casual5User.id }
      const { error: casual5DeptErr } = await supabase.from('casualworker_departments').upsert({
        casual_worker_id: casual5User.id, department_id: depts[0].id, company_id: company.id,
        verified_at: new Date().toISOString(),
      }, { onConflict: 'casual_worker_id,department_id' })
      if (casual5DeptErr) console.warn(`  ⚠ Failed to verify casual5@test.com in Operations: ${casual5DeptErr.message}`)

      // Shift job — regular fixed-end shift, "now"-relative so it always reads as in-progress
      // whenever the seed is run. is_open_ended stays false: this worker clocks out on their own
      // once the shift reaches end_time, no release needed.
      const casual5ShiftStart = new Date(Date.now() - 2 * 60 * 60 * 1000)
      const casual5ShiftEnd = new Date(casual5ShiftStart.getTime() + 8 * 60 * 60 * 1000)
      const casual5ShiftDate = dateKeySGT(casual5ShiftStart)
      const casual5Shift = await createShift({
        company_id: company.id, department_id: depts[0].id, shift_date: casual5ShiftDate,
        start_time: toHM(casual5ShiftStart), end_time: toHM(casual5ShiftEnd), is_open_ended: false,
        created_by: ownerUser.id, publication_status: 'published',
      })
      const casual5Assignment = casual5Shift && await assignShift(casual5Shift.id, casual5User.id, ownerUser.id, userIdMap['employee1@test.com'].internalId)
      if (casual5Assignment) {
        const { error: casual5ClockErr } = await supabase.from('attendance_records').insert({
          shift_assignment_id: casual5Assignment.id,
          user_id: casual5User.id,
          clock_in_time: casual5ShiftStart.toISOString(),
        })
        if (casual5ClockErr) console.warn(`  ⚠ 创建 casual5 attendance_record 失败: ${casual5ClockErr.message}`)
        console.log(`  ✓ Hafiz Rahman（casual5，Shift job）今天 ${toHM(casual5ShiftStart)}–${toHM(casual5ShiftEnd)} UTC 在班，已打卡，Ben Seah 督导`)
      }
    }
  }

  const { data: casual6Auth, error: casual6AuthErr } = await supabase.auth.admin.createUser({
    email: 'casual6@test.com', password: PASSWORD, email_confirm: true,
  })
  if (casual6AuthErr || !casual6Auth.user) {
    console.warn(`  ⚠ Failed to create casual6@test.com auth: ${casual6AuthErr?.message}`)
  } else {
    const { data: casual6User, error: casual6UserErr } = await supabase
      .from('users')
      .insert({
        supabase_auth_id: casual6Auth.user.id,
        full_name: 'Marcus Tan',
        email_address: 'casual6@test.com',
        phone_number: '+65 8300 3006',
        date_of_birth: '2001-12-01',
        profile_photo_url: DEMO_PHOTO_URL,
        role: 'Casual Worker',
        company_id: company.id,
      })
      .select()
      .single()
    if (casual6UserErr) {
      console.warn(`  ⚠ Failed to create casual6@test.com user: ${casual6UserErr.message}`)
    } else {
      userIdMap['casual6@test.com'] = { authId: casual6Auth.user.id, internalId: casual6User.id }
      const { error: casual6DeptErr } = await supabase.from('casualworker_departments').upsert({
        casual_worker_id: casual6User.id, department_id: depts[0].id, company_id: company.id,
        verified_at: new Date().toISOString(),
      }, { onConflict: 'casual_worker_id,department_id' })
      if (casual6DeptErr) console.warn(`  ⚠ Failed to verify casual6@test.com in Operations: ${casual6DeptErr.message}`)

      // One-off job — genuinely is_open_ended, so Clock Out needs Ben Seah's approval (the
      // Clock-Out Release Queue demo). end_time is a structural placeholder (job_start_time + 1h,
      // same convention the real app uses when generating a shift from a One-off posting — see the
      // is_open_ended migration comment), not a real deadline. Already clocked in with no
      // clock_out/release, so it lands straight in Ben Seah's Clock-Out Release Queue.
      const casual6JobStart = new Date(Date.now() - 3 * 60 * 60 * 1000)
      const casual6ShiftDate = dateKeySGT(casual6JobStart)
      const { data: casual6Job, error: casual6JobErr } = await supabase.from('job_postings').insert({
        company_id: company.id, department_id: depts[0].id, created_by: ownerUser.id,
        title: 'Same-Day Storeroom Sort', responsibilities: 'One-off sort and reshelve of the storeroom backlog.',
        skills: 'Available same-day, comfortable with physical work.',
        status: 'closed', archived_at: new Date().toISOString(), job_type: 'oneoff', urgency: 'urgent',
        estimated_hours: '3', job_date: casual6ShiftDate, job_start_time: toHM(casual6JobStart),
        openings: 1, experience_required: 'Not Required', minimum_age: 16,
        salary_amount: 60, expires_at: dateKey(addDays(TODAY, 1)),
      }).select().single()
      if (casual6JobErr) {
        console.warn(`  ⚠ 创建 job_posting 失败 (Same-Day Storeroom Sort): ${casual6JobErr.message}`)
      } else {
        const { data: casual6App, error: casual6AppErr } = await supabase.from('job_applicants').insert({
          job_id: casual6Job.id, user_id: casual6User.id,
          resume: 'https://example.com/demo-resumes/marcus-tan-resume.pdf', status: 'accepted',
          additional_note: "I'm free this afternoon and can start right away.",
        }).select().single()
        if (casual6AppErr) {
          console.warn(`  ⚠ 创建 job_applicant 失败 (Marcus Tan): ${casual6AppErr.message}`)
        } else {
          const { error: casual6InviteErr } = await supabase.from('job_invitations').insert({
            job_id: casual6Job.id, applicant_id: casual6App.id, sent_by: ownerUser.id, status: 'accepted',
          })
          if (casual6InviteErr) console.warn(`  ⚠ 创建 job_invitation 失败: ${casual6InviteErr.message}`)
        }

        const casual6Shift = await createShift({
          company_id: company.id, department_id: depts[0].id, shift_date: casual6ShiftDate,
          start_time: toHM(casual6JobStart), end_time: toHM(new Date(casual6JobStart.getTime() + 60 * 60 * 1000)),
          is_open_ended: true, created_by: ownerUser.id,
          publication_status: 'published', source_job_posting_id: casual6Job.id,
        })
        const casual6Assignment = casual6Shift && await assignShift(casual6Shift.id, casual6User.id, ownerUser.id, userIdMap['employee1@test.com'].internalId)
        if (casual6Assignment) {
          const { error: casual6ClockErr } = await supabase.from('attendance_records').insert({
            shift_assignment_id: casual6Assignment.id,
            user_id: casual6User.id,
            clock_in_time: casual6JobStart.toISOString(),
          })
          if (casual6ClockErr) console.warn(`  ⚠ 创建 casual6 attendance_record 失败: ${casual6ClockErr.message}`)
          console.log(`  ✓ Marcus Tan（casual6，One-off job）今天 ${toHM(casual6JobStart)} UTC 起已打卡、尚未 Clock Out，等 Ben Seah 在 Dashboard 点 Approve Clock Out 才能放行`)
        }
      }
    }
  }

  // ── Step 18e: Employee Tasks 页「Uncompleted Tasks」演示数据——一个 Ben Seah 督导、今天
  // 已经 Clock Out 的 Casual Worker，手上还留着 Assigned/In Progress 各一条任务没做完。跑完
  // seed 直接登录 employee1@test.com 打开 Tasks 页，就能看到 Board 里 Assigned/In Progress 两列
  // 不显示这两条卡（被过滤掉），"All Tasks" 筛选框右边出现红色 Uncompleted Tasks 按钮，点开能看到
  // 这两条任务 + AI Reassign 按钮（这个部门当时还有 Hafiz Rahman / Marcus Tan 在班，可以reassign）。
  // 不复用 casual1/5/6——他们分别演示"现在能打卡""已打卡未放行"，跟这里"已经打完卡走人"是三种
  // 不同状态，混在一个人身上会互相干扰。
  console.log('\nStep 18e: Employee Tasks 页 Uncompleted Tasks 演示数据（Casual Worker 已下班但任务未完成）...')
  const { data: casual7Auth, error: casual7AuthErr } = await supabase.auth.admin.createUser({
    email: 'casual7@test.com', password: PASSWORD, email_confirm: true,
  })
  if (casual7AuthErr || !casual7Auth.user) {
    console.warn(`  ⚠ Failed to create casual7@test.com auth: ${casual7AuthErr?.message}`)
  } else {
    const { data: casual7User, error: casual7UserErr } = await supabase
      .from('users')
      .insert({
        supabase_auth_id: casual7Auth.user.id,
        full_name: 'Nadia Osman',
        email_address: 'casual7@test.com',
        phone_number: '+65 8300 3007',
        date_of_birth: '2000-06-21',
        profile_photo_url: DEMO_PHOTO_URL,
        role: 'Casual Worker',
        company_id: company.id,
      })
      .select()
      .single()
    if (casual7UserErr) {
      console.warn(`  ⚠ Failed to create casual7@test.com user: ${casual7UserErr.message}`)
    } else {
      userIdMap['casual7@test.com'] = { authId: casual7Auth.user.id, internalId: casual7User.id }
      const { error: casual7DeptErr } = await supabase.from('casualworker_departments').upsert({
        casual_worker_id: casual7User.id, department_id: depts[0].id, company_id: company.id,
        verified_at: new Date().toISOString(),
      }, { onConflict: 'casual_worker_id,department_id' })
      if (casual7DeptErr) console.warn(`  ⚠ Failed to verify casual7@test.com in Operations: ${casual7DeptErr.message}`)

      // A short shift earlier today that's already over — clocked in AND out, both "now"-relative
      // so this reads as "already finished and left" no matter when the seed actually runs.
      const casual7ShiftStart = new Date(Date.now() - 4 * 60 * 60 * 1000)
      const casual7ShiftEnd = new Date(Date.now() - 60 * 60 * 1000)
      const casual7ShiftDate = dateKeySGT(casual7ShiftStart)
      const casual7Shift = await createShift({
        company_id: company.id, department_id: depts[0].id, shift_date: casual7ShiftDate,
        start_time: toHM(casual7ShiftStart), end_time: toHM(casual7ShiftEnd), is_open_ended: false,
        created_by: ownerUser.id, publication_status: 'published',
      })
      const casual7Assignment = casual7Shift && await assignShift(casual7Shift.id, casual7User.id, ownerUser.id, userIdMap['employee1@test.com'].internalId)
      if (casual7Assignment) {
        const { error: casual7ClockErr } = await supabase.from('attendance_records').insert({
          shift_assignment_id: casual7Assignment.id,
          user_id: casual7User.id,
          clock_in_time: casual7ShiftStart.toISOString(),
          clock_out_time: casual7ShiftEnd.toISOString(),
        })
        if (casual7ClockErr) console.warn(`  ⚠ 创建 casual7 attendance_record 失败: ${casual7ClockErr.message}`)

        await createTask({
          company_id: company.id, department_id: depts[0].id, shift_id: casual7Shift.id,
          title: 'Reconcile petty cash drawer', description: 'Count petty cash against the log and flag any discrepancy.',
          assigned_user_id: casual7User.id, assigned_by: userIdMap['employee1@test.com'].internalId,
          status: 'Assigned', due_at: dueAtOn(TODAY), priority: 'Medium',
        })
        await createTask({
          company_id: company.id, department_id: depts[0].id, shift_id: casual7Shift.id,
          title: 'Label backroom overflow boxes', description: 'Sort and label the overflow boxes in the backroom for next restock.',
          assigned_user_id: casual7User.id, assigned_by: userIdMap['employee1@test.com'].internalId,
          status: 'In Progress', due_at: dueAtOn(TODAY), priority: 'High',
        })
        console.log(`  ✓ Nadia Osman（casual7）今天 ${toHM(casual7ShiftStart)}–${toHM(casual7ShiftEnd)} UTC 已打卡+已 Clock Out；留 2 条任务（Assigned/In Progress）没做完，Ben Seah 的 Tasks 页会出现 Uncompleted Tasks 按钮`)
      }
    }
  }

  // ── Step 18f: 更多 Casual Worker 过去打卡记录 ──────────────────────────────
  // Priya Nair (casual3) / Daniel Wong (casual4) / Hafiz Rahman (casual5) / Marcus Tan (casual6) /
  // Nadia Osman (casual7) 之前只有"今天"那一条动态"现在就能打卡"班次——Attendance Records 页
  // 翻回上一周，他们几乎全是灰色 OFF。CW 没有 Off Day 概念，OFF 就是 OFF，不用像 Manager/
  // Employee 那样铺 Off Day 轮休，但至少得有真实的历史打卡记录可看。这里补 3 条/人，Present/
  // Late/Absent 都覆盖到；Hafiz Rahman 那条额外带 Modified，让 CW 这边也有真实的 "M" 徽章样本
  // （不只是 Manager/Employee 那条）。放在这（casual5/6/7 全部建完之后），不能更早——他们仨要到
  // Step 18/18b/18e 才存在于 userIdMap 里。
  console.log('\nStep 18f: 创建更多 Casual Worker 过去打卡记录...')
  const moreCwPastDefs = [
    { email: 'casual3@test.com', days: [{ daysAgo: 4, lateMinutes: 0 }, { daysAgo: 2, lateMinutes: 20 }, { daysAgo: 1, absent: true }] },
    { email: 'casual4@test.com', days: [{ daysAgo: 3, lateMinutes: 0 }, { daysAgo: 2, lateMinutes: 0 }, { daysAgo: 1, lateMinutes: 15 }] },
    { email: 'casual5@test.com', days: [{ daysAgo: 4, lateMinutes: 12, modified: true }, { daysAgo: 3, lateMinutes: 0 }, { daysAgo: 1, lateMinutes: 0 }] },
    { email: 'casual6@test.com', days: [{ daysAgo: 3, lateMinutes: 0 }, { daysAgo: 2, absent: true }, { daysAgo: 1, lateMinutes: 0 }] },
    { email: 'casual7@test.com', days: [{ daysAgo: 4, lateMinutes: 0 }, { daysAgo: 2, lateMinutes: 0 }, { daysAgo: 1, lateMinutes: 30 }] },
  ]
  for (const def of moreCwPastDefs) {
    for (const day of def.days) {
      const dayDate = addDays(TODAY, -day.daysAgo)
      const shift = await createShift({
        company_id: company.id, department_id: opsDept.id, shift_date: dateKey(dayDate),
        start_time: '09:00', end_time: '13:00',
        created_by: ownerUser.id, publication_status: 'published',
        // Report's labor-cost math (reportService.ts) only counts a Casual Worker's shift as
        // "payable" when the shift row itself has hourly_rate set — without it, every fully
        // attended shift is "uncosted" and Total Casual Worker Cost/Cost Distribution stays $0.
        hourly_rate: 15,
      })
      const assignment = shift && await assignShift(shift.id, userIdMap[def.email].internalId, ownerUser.id, employee1UserId)
      if (day.absent) continue // 故意不打卡 → Absent
      await clockRecord(assignment, userIdMap[def.email].internalId, {
        dateStr: dateKey(dayDate), endStr: '13:00', lateMinutes: day.lateMinutes,
        ...(day.modified ? { modifiedBy: employee1UserId, modifiedReason: 'Confirmed the actual arrival time against the front-desk sign-in sheet.', modifiedClockInMinutes: 5 } : {}),
      })
    }
  }
  console.log('  ✓ 5 位 Casual Worker（Priya Nair/Daniel Wong/Hafiz Rahman/Marcus Tan/Nadia Osman）各补 3 条过去班次，Present/Late/Absent 都有，Hafiz Rahman 那条带 Modified 徽章')

  // ── Step 18g: Casual Worker 覆盖到 Engineering + Customer Support ──────────
  // 所有 Casual Worker 过去班次此前只落在 Operations（casual1/3-7）和 Marketing（casual2）——
  // Report 的 Casual Worker Cost Distribution 是按部门分桶画饼图的，Engineering/Customer Support
  // 两个部门永远拿不到一分钱数据，饼图天生画不出这两块，不是 hourly_rate 的问题。这里让 Hafiz
  // Rahman（casual5）额外也在 Engineering 接单、Marcus Tan（casual6）额外也在 Customer Support
  // 接单——真实场景里灵活工本来就可能跨部门接活，casualworker_departments 允许一人挂多个部门。
  console.log('\nStep 18g: Casual Worker 覆盖到 Engineering + Customer Support...')
  const crossDeptCwDefs = [
    { email: 'casual5@test.com', deptIndex: 2, supervisor: employee3UserId, rate: 15, days: [{ daysAgo: 3, lateMinutes: 0 }, { daysAgo: 1, lateMinutes: 10 }] },
    { email: 'casual6@test.com', deptIndex: 3, supervisor: employee4UserId, rate: 15, days: [{ daysAgo: 4, lateMinutes: 0 }, { daysAgo: 2, lateMinutes: 0 }] },
  ]
  for (const def of crossDeptCwDefs) {
    const { error: crossDeptErr } = await supabase.from('casualworker_departments').upsert({
      casual_worker_id: userIdMap[def.email].internalId,
      department_id: depts[def.deptIndex].id,
      company_id: company.id,
      verified_at: new Date().toISOString(),
    }, { onConflict: 'casual_worker_id,department_id' })
    if (crossDeptErr) console.warn(`  ⚠ 创建 casualworker_departments 失败 (${def.email} → ${depts[def.deptIndex].name}): ${crossDeptErr.message}`)
    for (const day of def.days) {
      const dayDate = addDays(TODAY, -day.daysAgo)
      const shift = await createShift({
        company_id: company.id, department_id: depts[def.deptIndex].id, shift_date: dateKey(dayDate),
        start_time: '09:00', end_time: '13:00',
        created_by: ownerUser.id, publication_status: 'published',
        hourly_rate: def.rate,
      })
      const assignment = shift && await assignShift(shift.id, userIdMap[def.email].internalId, ownerUser.id, def.supervisor)
      await clockRecord(assignment, userIdMap[def.email].internalId, { dateStr: dateKey(dayDate), endStr: '13:00', lateMinutes: day.lateMinutes })
    }
  }
  console.log('  ✓ Hafiz Rahman 也在 Engineering、Marcus Tan 也在 Customer Support 接了班——Casual Worker Cost Distribution 4 个部门都有数据')

  // ── Step 18h: Casual Worker 未来一周排班（Manager 的 Shift Calendar 之前除了 Marcus Lee
  // 外几乎全是 OFF）── Priya Nair/Daniel Wong/Hafiz Rahman/Marcus Tan/Nadia Osman/Hana Bakri 之前
  // 只有"今天"那一条动态班次，往后翻一周（Manager Shifts 页默认这周）全是灰色 OFF。不用铺满
  // 每一天，但每人补 3 条、分散在 TODAY+1..+6，让 Casual Workers 那一列看起来是真的在排班，不是
  // 摆设。都是未来班次，不建打卡记录（跟 Marcus Lee 现有的未来班次一致）。
  console.log('\nStep 18h: 创建 Casual Worker 未来一周排班...')
  const cwWeekAheadDefs = [
    { email: 'casual3@test.com', shifts: [[1, '10:00', '14:00'], [3, '13:00', '17:00'], [5, '09:00', '13:00']] },
    { email: 'casual4@test.com', shifts: [[2, '11:00', '15:00'], [4, '14:00', '18:00'], [6, '10:00', '14:00']] },
    { email: 'casual5@test.com', shifts: [[1, '09:00', '13:00'], [4, '10:00', '14:00'], [6, '13:00', '17:00']] },
    { email: 'casual6@test.com', shifts: [[2, '10:00', '14:00'], [5, '11:00', '15:00'], [6, '09:00', '13:00']] },
    { email: 'casual7@test.com', shifts: [[3, '09:00', '13:00'], [5, '10:00', '14:00'], [6, '14:00', '18:00']] },
    { email: 'casual8@test.com', shifts: [[1, '14:00', '18:00'], [3, '10:00', '14:00'], [5, '09:00', '13:00']] },
  ]
  let cwWeekAheadCount = 0
  for (const def of cwWeekAheadDefs) {
    for (const [daysAhead, start, end] of def.shifts) {
      const shift = await createShift({
        company_id: company.id, department_id: opsDept.id, shift_date: dateKey(addDays(TODAY, daysAhead)),
        start_time: start, end_time: end, created_by: ownerUser.id, publication_status: 'published',
        hourly_rate: 15,
      })
      const assignment = shift && await assignShift(shift.id, userIdMap[def.email].internalId, ownerUser.id, employee1UserId)
      if (assignment) cwWeekAheadCount++
    }
  }
  console.log(`  ✓ ${cwWeekAheadCount} 条 Casual Worker 未来班次（6 人各 3 条，分散在 TODAY+1..+6），Manager 的 Operations Shift Calendar 这一周不再是一片 OFF`)

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
    status: 'In Progress', due_at: dueAtOn(YESTERDAY), priority: 'High',
  })
  await createTask({
    company_id: company.id, department_id: depts[2].id, title: 'Sign off warehouse safety audit',
    description: 'Review the completed safety checklist and sign off.',
    assigned_user_id: userIdMap['manager3@test.com'].internalId, assigned_by: ownerUser.id,
    status: 'Review', due_at: dueAtOn(TODAY), priority: 'Medium',
  })
  await createTask({
    company_id: company.id, department_id: depts[3].id, title: 'Submit monthly support metrics',
    description: "Compile and submit last month's support ticket metrics.",
    assigned_user_id: userIdMap['manager4@test.com'].internalId, assigned_by: ownerUser.id,
    status: 'Complete', due_at: dueAtOn(TWO_DAYS_AGO),
  })
  await createTask({
    company_id: company.id, department_id: depts[0].id, title: 'Approve overtime requests',
    description: 'Review and approve pending overtime requests for this week.',
    assigned_user_id: userIdMap['manager1@test.com'].internalId, assigned_by: userIdMap['partner1@test.com'].internalId,
    status: 'Assigned', due_at: dueAtOn(addDays(TODAY, 2)), priority: 'Medium',
  })
  // David Lim (manager1) 的 My Tasks 板之前只有 Assigned/In Progress 两种状态、没有子任务——
  // Review/Complete 两列一直是空的，子任务展开/堆叠效果也测不到（2026-08-01）。
  await createTask({
    company_id: company.id, department_id: depts[0].id, title: 'Submit Q3 headcount forecast',
    description: 'Compile the Operations headcount forecast for Q3 and submit for Owner sign-off.',
    assigned_user_id: userIdMap['manager1@test.com'].internalId, assigned_by: ownerUser.id,
    status: 'Review', due_at: dueAtOn(TODAY), priority: 'High',
  })
  await createTask({
    company_id: company.id, department_id: depts[0].id, title: 'Confirm holiday roster coverage',
    description: 'Confirm every shift over the holiday weekend has coverage confirmed.',
    assigned_user_id: userIdMap['manager1@test.com'].internalId, assigned_by: userIdMap['partner1@test.com'].internalId,
    status: 'Complete', due_at: dueAtOn(TWO_DAYS_AGO), completed_at: dueAtOn(TWO_DAYS_AGO), priority: 'Medium',
  })
  const mgr1SubtaskParent = await createTask({
    company_id: company.id, department_id: depts[0].id, title: 'Prepare weekend event staffing pack',
    description: 'Pull together everything the weekend event crew needs before Saturday.',
    assigned_user_id: userIdMap['manager1@test.com'].internalId, assigned_by: ownerUser.id,
    status: 'In Progress', due_at: dueAtOn(TOMORROW), priority: 'High',
  })
  if (mgr1SubtaskParent) {
    await createTask({
      company_id: company.id, department_id: depts[0].id, title: 'Confirm crew contact list',
      parent_task_id: mgr1SubtaskParent.id, sequence_order: 1,
      assigned_user_id: userIdMap['manager1@test.com'].internalId, assigned_by: ownerUser.id,
      status: 'Complete',
    })
    await createTask({
      company_id: company.id, department_id: depts[0].id, title: 'Print floor plan handouts',
      parent_task_id: mgr1SubtaskParent.id, sequence_order: 2,
      assigned_user_id: userIdMap['manager1@test.com'].internalId, assigned_by: ownerUser.id,
      status: 'Assigned', due_at: dueAtOn(TOMORROW),
    })
  }
  console.log('  ✓ David Lim（manager1）My Tasks 补齐 Review/Complete 状态 + 1 条带 2 子任务的 Task，四种状态+子任务展开都有真实数据可测')
  await createTask({
    company_id: company.id, department_id: depts[2].id, title: 'Review new hire onboarding checklist',
    description: 'Make sure the onboarding checklist is up to date before the next intake.',
    assigned_user_id: userIdMap['manager3@test.com'].internalId, assigned_by: userIdMap['partner1@test.com'].internalId,
    status: 'In Progress', due_at: dueAtOn(addDays(TODAY, -2)), priority: 'Low',
  })
  const t7 = await createTask({
    company_id: company.id, department_id: depts[0].id, title: 'Restock front counter supplies',
    description: 'Check and restock counter supplies before the weekend rush.',
    assigned_user_id: userIdMap['employee1@test.com'].internalId, assigned_by: userIdMap['manager1@test.com'].internalId,
    status: 'In Progress', due_at: dueAtOn(TODAY), priority: 'Medium',
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
    status: 'Review', due_at: dueAtOn(TODAY), priority: 'High',
  })
  await createTask({
    company_id: company.id, department_id: depts[3].id, title: 'Clear support ticket backlog',
    description: 'Work through the remaining open tickets from last week.',
    assigned_user_id: userIdMap['employee4@test.com'].internalId, assigned_by: userIdMap['manager4@test.com'].internalId,
    status: 'Complete',
  })
  if (t7) {
    await createTask({
      company_id: company.id, department_id: depts[0].id, title: 'Count current stock',
      parent_task_id: t7.id, sequence_order: 1,
      assigned_user_id: userIdMap['employee1@test.com'].internalId, assigned_by: userIdMap['manager1@test.com'].internalId,
      status: 'Complete',
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
    status: 'In Progress', due_at: dueAtOn(TOMORROW), priority: 'High',
  })
  await createTask({
    company_id: company.id, department_id: depts[0].id, title: 'Prepare loading dock for incoming stock',
    description: "Clear the loading dock and stage the pallet jacks ahead of the delivery truck.",
    assigned_user_id: userIdMap['employee5@test.com'].internalId, assigned_by: userIdMap['manager5@test.com'].internalId,
    status: 'Assigned', due_at: dueAtOn(addDays(TODAY, -3)), priority: 'Medium',
  })
  await createTask({
    company_id: company.id, department_id: depts[0].id, title: 'Submit weekly cash-handling report',
    description: 'Compile this week\'s cash-handling log into the standard template and submit it for manager sign-off.',
    assigned_user_id: userIdMap['employee1@test.com'].internalId, assigned_by: userIdMap['manager5@test.com'].internalId,
    status: 'Review', due_at: dueAtOn(TODAY), priority: 'Medium',
  })
  await createTask({
    company_id: company.id, department_id: depts[0].id, title: "Archive last month's supplier invoices",
    description: 'Scan and file last month\'s supplier invoices into the shared archive folder, sorted by vendor.',
    assigned_user_id: userIdMap['employee5@test.com'].internalId, assigned_by: userIdMap['manager5@test.com'].internalId,
    status: 'Complete', due_at: dueAtOn(TWO_DAYS_AGO), completed_at: dueAtOn(TWO_DAYS_AGO),
  })
  if (wendyOpsTask1) {
    await createTask({
      company_id: company.id, department_id: depts[0].id, title: 'Cross-check till counts',
      parent_task_id: wendyOpsTask1.id, sequence_order: 1,
      assigned_user_id: userIdMap['employee1@test.com'].internalId, assigned_by: userIdMap['manager5@test.com'].internalId,
      status: 'Complete',
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
    status: 'Review', due_at: dueAtOn(TODAY), priority: 'Low',
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
      status: 'Complete', due_at: taskDueAt, priority: def.priority,
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
  // Non-Complete ones (still overdue) are kept inside the last 3 days, evenly spread, so Overdue
  // doesn't trail off into a long tail — combined with the two other overdue tasks above (Review
  // Q3 campaign budget @-1, Review new hire onboarding checklist @-2, Prepare loading dock for
  // incoming stock @-3), Overdue lands ~2/3/2 across -1/-2/-3. The two Complete ones keep their
  // original daysAgo — they're history for Report's on-time-rate sample, not part of "Overdue".
  const customerSupportBacklog = [
    { title: 'Reconcile refund requests log', assignee: 'employee4@test.com', daysAgo: 2, status: 'Assigned' },
    { title: 'Rebuild FAQ knowledge base article', assignee: 'employee4@test.com', daysAgo: 5, status: 'Complete', completedDaysAgo: 2 },
    { title: 'Audit chat transcripts for compliance', assignee: 'manager4@test.com', daysAgo: 3, status: 'In Progress' },
    { title: 'Update support macros for new pricing', assignee: 'employee4@test.com', daysAgo: 2, status: 'In Progress' },
    { title: 'Follow up with VIP accounts', assignee: 'employee4@test.com', daysAgo: 3, status: 'Complete', completedDaysAgo: 1 },
    { title: 'Resolve escalated billing dispute', assignee: 'manager4@test.com', daysAgo: 1, status: 'Assigned' },
  ]
  for (const def of customerSupportBacklog) {
    const assignerEmail = def.assignee === 'manager4@test.com' ? 'partner1@test.com' : 'manager4@test.com'
    await createTask({
      company_id: company.id, department_id: depts[3].id, title: def.title,
      assigned_user_id: userIdMap[def.assignee].internalId, assigned_by: userIdMap[assignerEmail].internalId,
      status: def.status, due_at: dueAtOn(addDays(TODAY, -def.daysAgo)),
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
    { title: 'Unload delivery truck', description: "Unload this morning's supplier truck and stage pallets in the receiving bay.", priority: 'Medium', assignee: 'employee1@test.com', daysAgo: 6, status: 'Complete' },
    { title: 'Restock aisle 3 shelving', description: 'Restock aisle 3 from the backroom overflow and front-face all items.', priority: 'Low', assignee: 'employee1@test.com', daysAgo: 5, status: 'Complete' },
    { title: 'Process customer return items', description: "Inspect and process yesterday's customer returns — restock sellable items, log damaged ones.", priority: 'Medium', assignee: 'employee1@test.com', daysAgo: 5, status: 'Complete' },
    { title: 'Set up weekend promo display', description: 'Build the weekend promo end-cap display per the layout sent by Marketing.', priority: 'Medium', assignee: 'employee1@test.com', daysAgo: 4, status: 'Complete' },
    { title: 'Sweep and mop stockroom', description: 'Sweep and mop the stockroom floor and clear any blocked walkways.', priority: 'Low', assignee: 'employee1@test.com', daysAgo: 3, status: 'In Progress' },
    { title: 'Label new inventory batch', description: "Print and apply shelf labels for this week's new inventory batch.", priority: 'Medium', assignee: 'employee1@test.com', daysAgo: 2, status: 'In Progress' },
    { title: 'Cover front register during lunch', description: "Cover the front register during Ben's lunch break, 12–1pm.", priority: 'Medium', assignee: 'employee5@test.com', daysAgo: 4, status: 'Complete' },
    { title: 'Review weekend staffing plan', description: 'Review the draft weekend roster for gaps before it goes out to the team.', priority: 'High', assignee: 'manager1@test.com', daysAgo: 3, status: 'In Progress' },
  ]
  for (const def of opsWorkloadDefs) {
    const assignerId = def.assignee === 'manager1@test.com' ? ownerUser.id : userIdMap['manager1@test.com'].internalId
    await createTask({
      company_id: company.id, department_id: depts[0].id, title: def.title, description: def.description,
      assigned_user_id: userIdMap[def.assignee].internalId, assigned_by: assignerId,
      status: def.status, priority: def.priority,
      task_date: dateKey(addDays(TODAY, -def.daysAgo)),
    })
  }
  console.log('  ✓ Operations 另加 8 条本期 Task，Ben Seah 占 6/8——给 Report 的「工作集中在一人身上」异常留下真实信号')

  // ── Step 19b: 未来 3-6 天的 Task（Deadline Calendar 本周/下周不再留白）───────
  // 之前 due_at 最远只排到 TODAY+2，+3..+6 完全没有 Task——Deadline Calendar 往后翻一周看起来
  // 是空的。这里把 4 部门都铺到 +3..+6，每天 2 条、分属不同部门。
  const upcomingSpreadDefs = [
    { dept: 1, title: 'Finalize influencer partnership brief', assignee: 'employee2@test.com', assigner: 'manager2@test.com', status: 'Assigned', priority: 'Medium', daysAhead: 3 },
    { dept: 2, title: 'Test staging deploy for release candidate', assignee: 'employee3@test.com', assigner: 'manager3@test.com', status: 'Assigned', priority: 'High', daysAhead: 3 },
    { dept: 0, title: 'Schedule quarterly stocktake', assignee: 'manager1@test.com', assigner: 'owner@test.com', status: 'Assigned', priority: 'Medium', daysAhead: 4 },
    { dept: 3, title: 'Prepare holiday support coverage plan', assignee: 'manager4@test.com', assigner: 'partner1@test.com', status: 'Assigned', priority: 'Medium', daysAhead: 4 },
    { dept: 1, title: 'Review campaign creative with design', assignee: 'employee6@test.com', assigner: 'manager6@test.com', status: 'In Progress', priority: 'Low', daysAhead: 5 },
    { dept: 2, title: 'Draft equipment upgrade proposal', assignee: 'employee7@test.com', assigner: 'manager7@test.com', status: 'Assigned', priority: 'Medium', daysAhead: 5 },
    { dept: 0, title: 'Plan next month staff rota', assignee: 'manager5@test.com', assigner: 'owner@test.com', status: 'Assigned', priority: 'High', daysAhead: 6 },
    { dept: 3, title: 'Compile customer satisfaction survey results', assignee: 'employee8@test.com', assigner: 'manager8@test.com', status: 'Assigned', priority: 'Medium', daysAhead: 6 },
  ]
  for (const def of upcomingSpreadDefs) {
    await createTask({
      company_id: company.id, department_id: depts[def.dept].id, title: def.title,
      assigned_user_id: userIdMap[def.assignee].internalId, assigned_by: userIdMap[def.assigner].internalId,
      status: def.status, due_at: dueAtOn(addDays(TODAY, def.daysAhead)), priority: def.priority,
    })
  }
  console.log('  ✓ 8 条 Task 铺在 TODAY+3..+6（每天 2 条，4 部门都有），Deadline Calendar 下周不再留白')

  // ── Step 19c: 更多 Rework Task（之前全公司只有 Operations 一条，其它 3 个部门都测不到）──
  const reworkDefs = [
    { dept: 1, title: 'Revise Q3 campaign budget breakdown', assignee: 'manager2@test.com', assigner: 'owner@test.com', priority: 'Medium', daysAhead: 1,
      reason: "Numbers don't reconcile with the finance export — please redo the breakdown.", rejectedMinutesAgo: 120 },
    { dept: 2, title: 'Redo equipment maintenance checklist', assignee: 'employee7@test.com', assigner: 'manager3@test.com', priority: 'Medium', daysAhead: 2,
      reason: 'Missed two checklist items — please redo and resubmit.', rejectedMinutesAgo: 200 },
    { dept: 3, title: 'Resubmit monthly support metrics summary', assignee: 'manager4@test.com', assigner: 'partner1@test.com', priority: 'High', daysAhead: 1,
      reason: 'Ticket resolution time figures look off — please double-check and resubmit.', rejectedMinutesAgo: 300 },
  ]
  for (const def of reworkDefs) {
    await createTask({
      company_id: company.id, department_id: depts[def.dept].id, title: def.title,
      assigned_user_id: userIdMap[def.assignee].internalId, assigned_by: userIdMap[def.assigner].internalId,
      status: 'In Progress', due_at: dueAtOn(addDays(TODAY, def.daysAhead)), priority: def.priority,
      rejection_reason: def.reason, rejected_at: minutesAgo(def.rejectedMinutesAgo),
    })
  }
  console.log('  ✓ 3 条 Rework Task（Marketing/Engineering/Customer Support 各 1 条），加上 Operations 原有那条，4 部门都有 Rework 场景可测')

  // ── Step 19d: Archived Task（Archive 列表之前完全是空的）─────────────────────
  const archivedTaskDefs = [
    { dept: 0, title: 'Q2 stockroom deep clean', assignee: 'employee1@test.com', assigner: 'manager1@test.com', status: 'Complete', daysAgo: 18 },
    { dept: 1, title: 'Spring campaign wrap-up report', assignee: 'employee2@test.com', assigner: 'manager2@test.com', status: 'Complete', daysAgo: 22 },
    { dept: 2, title: 'Legacy inventory system migration', assignee: 'employee3@test.com', assigner: 'manager3@test.com', status: 'Complete', daysAgo: 25 },
    { dept: 3, title: 'Q1 support backlog cleanup', assignee: 'employee4@test.com', assigner: 'manager4@test.com', status: 'Complete', daysAgo: 30 },
    // Archiving isn't limited to finished work — this one is archived while still Assigned (a
    // cancelled task), so the Archive list also covers a non-Complete status, not just Complete.
    { dept: 0, title: 'Cancelled vendor onboarding', assignee: 'manager5@test.com', assigner: 'owner@test.com', status: 'Assigned', daysAgo: 15 },
  ]
  for (const def of archivedTaskDefs) {
    const taskDueAt = dueAtOn(addDays(TODAY, -def.daysAgo))
    await createTask({
      company_id: company.id, department_id: depts[def.dept].id, title: def.title,
      assigned_user_id: userIdMap[def.assignee].internalId, assigned_by: userIdMap[def.assigner].internalId,
      status: def.status, due_at: taskDueAt,
      completed_at: def.status === 'Complete' ? taskDueAt : null,
      is_archived: true,
    })
  }
  console.log('  ✓ 5 条 Archived Task（4 部门各 1 条 Complete + 1 条 Assigned 就被取消归档），Archive 列表不再是空的')

  // ── Step 19e: 补几条冷门日期的 Task（上周日历每天都至少 2 个不同部门有数据）──────
  const weekFillerDefs = [
    { dept: 3, title: 'File weekly support summary', assignee: 'employee4@test.com', assigner: 'manager4@test.com', daysAgo: 7 },
    { dept: 1, title: 'Publish weekly newsletter', assignee: 'employee6@test.com', assigner: 'manager6@test.com', daysAgo: 6 },
    { dept: 2, title: 'Calibrate warehouse scanners', assignee: 'employee7@test.com', assigner: 'manager7@test.com', daysAgo: 4 },
    { dept: 0, title: 'Restock breakroom supplies', assignee: 'employee5@test.com', assigner: 'manager5@test.com', daysAgo: 2 },
  ]
  for (const def of weekFillerDefs) {
    const taskDueAt = dueAtOn(addDays(TODAY, -def.daysAgo))
    await createTask({
      company_id: company.id, department_id: depts[def.dept].id, title: def.title,
      assigned_user_id: userIdMap[def.assignee].internalId, assigned_by: userIdMap[def.assigner].internalId,
      status: 'Complete', due_at: taskDueAt, completed_at: taskDueAt,
    })
  }
  console.log('  ✓ 4 条补充 Task，让上周每一天的 Deadline Calendar 至少有 2 个不同部门的数据')

  // ── Step 19f: Company Activity Log（Team/Company 页 Activity Log 面板之前完全是空的）──
  // 直接对应 TeamView.tsx 的 logActivity 五种真实 action（describeActivityLog 渲染出的文案见
  // 各条注释）；target_id 只在 set_active/set_inactive/change_department 时才有真实值，
  // invite_member/remove_member 跟真实代码一致留空（邀请的人还没账号、被移除的人已经不在了）。
  console.log('\nStep 19f: 创建 Company Activity Log...')
  const activityLogDefs = [
    { actor: 'owner@test.com', action: 'invite_member', target_name: 'partner1@test.com', detail: 'Partner', daysAgo: 25 }, // "Invited partner1@test.com as Partner"
    { actor: 'owner@test.com', action: 'invite_member', target_name: 'manager1@test.com', detail: 'Manager', daysAgo: 24 },
    { actor: 'owner@test.com', action: 'invite_member', target_name: 'manager2@test.com', detail: 'Manager', daysAgo: 24 },
    { actor: 'owner@test.com', action: 'invite_member', target_name: 'employee3@test.com', detail: 'Employee', daysAgo: 20 },
    { actor: 'owner@test.com', action: 'remove_member', target_name: 'Marcus Wong', detail: 'Employee', daysAgo: 17 }, // "Removed Marcus Wong (Employee)"
    { actor: 'owner@test.com', action: 'change_department', target_name: 'Farah Aziz', target_id_email: 'casual2@test.com', detail: 'Marketing', daysAgo: 14 }, // "Changed Farah Aziz to Marketing"
    { actor: 'manager1@test.com', action: 'set_active', target_name: 'Marcus Lee', target_id_email: 'casual1@test.com', daysAgo: 10 }, // "Activated Marcus Lee"
    { actor: 'manager1@test.com', action: 'set_inactive', target_name: 'Marcus Tan', target_id_email: 'casual6@test.com', detail: 'Taking a break this month', daysAgo: 6 }, // "Deactivated Marcus Tan"
    { actor: 'manager1@test.com', action: 'set_active', target_name: 'Marcus Tan', target_id_email: 'casual6@test.com', daysAgo: 2 },
  ]
  for (const def of activityLogDefs) {
    const { error } = await supabase.from('company_activity_logs').insert({
      company_id: company.id,
      actor_id: userIdMap[def.actor].internalId,
      action: def.action,
      target_id: def.target_id_email ? userIdMap[def.target_id_email].internalId : null,
      target_name: def.target_name,
      detail: def.detail ?? null,
      created_at: new Date(Date.now() - def.daysAgo * 24 * 60 * 60 * 1000).toISOString(),
    })
    if (error) console.warn(`  ⚠ 创建 activity log 失败 (${def.action} ${def.target_name}): ${error.message}`)
  }
  console.log('  ✓ 9 条 Company Activity Log（invite_member/remove_member/change_department/set_active/set_inactive 五种 action 都覆盖到）')

  // ── Step 20: 创建 Announcements + Messages（Communication 页两个 Tab 都有数据，UC58-61）──
  console.log('\nStep 20: 创建 Communication 数据...')
  const announcementDefs = [
    { user_id: ownerUser.id, company_id: company.id, audience_department_id: null,
      title: 'Q3 All-Hands — This Friday 3pm', content: 'Join us this Friday at 3pm for the Q3 all-hands. Attendance is expected for all Managers and Employees.' },
    { user_id: ownerUser.id, company_id: company.id, audience_department_id: depts[0].id,
      title: 'Updated opening checklist now posted', content: 'The updated opening checklist for Operations is now posted in the shared drive — please review before your next shift.' },
    { user_id: userIdMap['partner1@test.com'].internalId, company_id: company.id, audience_department_id: null,
      title: 'Reminder: submit expense reports by month-end', content: 'Please submit any outstanding expense reports by the last day of the month so payroll can process them on time.' },
    // Owner's own "My Announcements" list only shows what Owner personally created — 2 was thin.
    { user_id: ownerUser.id, company_id: company.id, audience_department_id: null,
      title: 'New visitor parking arrangement from next Monday', content: 'Visitor parking moves to the basement level from next Monday while the ground floor lot is resurfaced.' },
    { user_id: ownerUser.id, company_id: company.id, audience_department_id: depts[2].id,
      title: 'Scheduled server maintenance this weekend', content: 'The internal inventory system will be offline for maintenance from 11pm Saturday to 3am Sunday. Please plan work around it.' },
    { user_id: ownerUser.id, company_id: company.id, audience_department_id: depts[3].id,
      title: 'New customer escalation procedure now in effect', content: 'Escalations that can\'t be resolved within 24 hours should now be flagged to the manager on duty immediately, not held for the weekly review.' },
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
    // Owner's own Chatbox only shows threads Owner is actually a participant in — David Lim +
    // Marcus Lee (below) was only 2 threads. Add a few more so the conversation list isn't thin.
    { from_user_id: userIdMap['partner1@test.com'].internalId, from_name: 'James Tan', to_email: 'owner@test.com',
      content: 'Have you had a chance to look at the Q3 budget draft I sent over?', is_read: false },
    { from_user_id: ownerUser.id, from_name: 'Sarah Mitchell', to_email: 'partner1@test.com',
      content: 'Not yet — will review this afternoon and send comments.', is_read: true },
    { from_user_id: userIdMap['manager2@test.com'].internalId, from_name: 'Rachel Koh', to_email: 'owner@test.com',
      content: 'The campaign creative is ready for your sign-off whenever you have a moment.', is_read: false },
    { from_user_id: ownerUser.id, from_name: 'Sarah Mitchell', to_email: 'manager2@test.com',
      content: 'Looks great — approved to run.', is_read: true },
    { from_user_id: userIdMap['manager4@test.com'].internalId, from_name: 'Fiona Chen', to_email: 'owner@test.com',
      content: "The escalated billing dispute is resolved, closing the ticket.", is_read: true },
    { from_user_id: userIdMap['casual2@test.com'].internalId, from_name: 'Farah Aziz', to_email: 'owner@test.com',
      content: 'Thank you for having me cover the Marketing shift last week!', is_read: false },
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
  console.log('  ✓ 6 条 Announcement（Owner 5 条 + Partner 1 条）+ 10 条 Message（含未读，Owner 自己的 Chatbox 现在有 4 组对话）')

  // Marcus Lee (casual1) ↔ Ben Seah (his supervisor, employee1) / Sarah Mitchell (owner, backup
  // contact) — Casual Dashboard's Message panel had zero seeded rows before this (2026-07-31),
  // so a fresh login showed both contact tabs completely empty until the worker typed something
  // themselves. A real back-and-forth here, mixed read/unread on both threads.
  const casualMessageDefs = [
    { from_user_id: employee1UserId, from_name: 'Ben Seah', to_email: 'casual1@test.com',
      content: 'Hey Marcus, thanks for covering the counter today on such short notice!', is_read: true },
    { from_user_id: userIdMap['casual1@test.com'].internalId, from_name: 'Marcus Lee', to_email: 'employee1@test.com',
      content: "No problem — I'll get the float counted and the till set up before we open.", is_read: true },
    { from_user_id: employee1UserId, from_name: 'Ben Seah', to_email: 'casual1@test.com',
      content: "Great. I've also put a couple of restocking tasks on your board, should be quick.", is_read: false },
    { from_user_id: userIdMap['casual1@test.com'].internalId, from_name: 'Marcus Lee', to_email: 'employee1@test.com',
      content: "Got it, I'll knock those out once the morning rush settles down.", is_read: true },
    { from_user_id: ownerUser.id, from_name: 'Sarah Mitchell', to_email: 'casual1@test.com',
      content: 'Welcome back Marcus — appreciate you picking up shifts on short notice again this month!', is_read: false },
    { from_user_id: userIdMap['casual1@test.com'].internalId, from_name: 'Marcus Lee', to_email: 'owner@test.com',
      content: 'Thank you! Always happy to help out when I can.', is_read: true },
  ]
  for (const def of casualMessageDefs) {
    const { error } = await supabase.from('messages').insert({
      from_user_id: def.from_user_id,
      to_user_id: userIdMap[def.to_email].internalId,
      company_id: company.id,
      content: def.content,
      is_read: def.is_read,
      sender_name: def.from_name,
    })
    if (error) console.warn(`  ⚠ 创建 casual message 失败: ${error.message}`)
  }
  console.log('  ✓ Marcus Lee ↔ Ben Seah / Sarah Mitchell 的 Message 对话（Casual Dashboard Message 面板用，含未读）')

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
  console.log('               David Lim (manager1) ↔ Wendy Ho (manager5)：2 pending/1 approved/1 rejected/1 hidden-awaiting-counterpart（Manager-tier，Owner/Partner 审批，和 employee1 的那一套一一对应，2026-08-02）')
  console.log('    Off Day 待提交：Wendy Ho 还没有现成 pending/approved 记录，留给她自己测 Submit Fixed Day Off；David Lim 已有 1 条 pending（见下）')
  console.log('    Off Day 待审批：Ben Seah + Grace Lim 撞同一天（Operations 2 人）—— AI Process 应判 Ben 为 safe、Grace 为 flagged 并给出替代日建议')
  console.log('                   Aaron Wong（Manager 自己的申请；Engineering 现有 manager3+manager7 两个 Manager，AI Process 应判 safe）')
  console.log('                   David Lim（同理，Operations 现有 manager1+manager5 两个 Manager，AI Process 应判 safe——和 employee1 的 pending Off Day 一一对应）')
  console.log('                   Elaine Chua（当天已有排班冲突，仅供手动测试，AI Process 不检查排班）')
  console.log('  Casual Worker Clock In：casual1@test.com 登录后 Dashboard 有 Same-Day Café Cover Shift（Shift，有 Break In/Out）可直接 Clock In → Break In → Break Out → Clock Out 一路点完（UC49），不需要主管放行')
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
