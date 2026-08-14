/**
 * scripts/seed-demo.js — 演示专用种子脚本（16-17 分钟纯操作，中途零脚本）
 *
 * 设计原则：**不复制 seed.js**。本脚本先原样跑一遍 `node scripts/seed.js` 建立完整基础数据，
 * 再在其之上打演示专用的补丁。这样 seed.js 永远是唯一的数据源真相，以后 seed.js 改了这里
 * 自动跟着改，不会出现两份 4000 行脚本互相漂移。
 *
 * ## 这个脚本要解决的问题
 *
 * 演示只有 16-17 分钟，而且**中途不能停下来跑脚本、不能等时间**。系统里有三类"必须等"的门槛，
 * 全部要在演示开始前就变成既定事实：
 *
 *   1. 打卡窗口   —— Clock In 只在开工前 30 分钟才解锁
 *   2. 只读锁     —— 任何人一旦 clock out，他的页面立刻变只读（getClockLockStatus 只看最近
 *                    一条打卡记录有没有下班时间）
 *   3. 招聘周期   —— 岗位要有人申请、AI 才有得排名；工人要先完工才会进 Worker Pool
 *
 * 所以本脚本把"过去"和"未来"都铺好，现场只做**有看头的动作**：跑 AI Assessment、跑 AI Assign、
 * 拖任务、打回重做、从 Pool 邀请。
 *
 * ## 补丁清单
 *
 *   D1  Off Day 提交截止改成「周日 17:00」，并把待审批的 Off Day 全部对齐到当前开放的提交周，
 *       这样演示当天既能处理 Off Day 又能排那一周的班（可选段落，不演也不碍事）。
 *   D2  Ben Seah（employee1）和 David Lim（manager1）今天已打卡、**未下班**。硬性要求：不补
 *       这条记录的话 Ben 一登录整个 Tasks 页就是只读，AI Assign 按钮根本不渲染。
 *   D3  清掉 seed.js 自己塞在 Ben 名下的今日在管工人，班组人数才是确定的。
 *   D4  Hero（guest1 Wei Jie Lim）清干净在途申请，并在**第三天**给他在第二家公司排一个已确认的
 *       班 —— 这就是跨公司冲突拦截演示的那条。
 *   D5  **核心**。一个岗位同时承担招聘和干活两件事，让 PPT 那六步连成一条线：
 *         · 岗位在**今天**，开工时间 = 跑脚本那一刻 + 30 分钟
 *         · 3 个人**已经录用确认并在岗打卡**（完整复刻走完一遍服务层的结果：
 *           申请 accepted → 邀请 accepted → 班次 → 排班挂 Ben → 打卡未下班）
 *         · 还剩 2 个空位 + 5 个待处理申请人 → Hero 现场申请，AI Assessment 排 6 个人
 *         · Hero 确认 offer 后拿到的是**今天**的班，当场就能 Clock In，
 *           然后立刻出现在 Ben 的 AI Assign 候选名单里
 *       ⚠️ 30 分钟是硬窗口，由两条互相顶着的规则夹出来：
 *          respondToInvitation → invitationHasExpired：开工时间一过，offer 确认不了
 *          Clock In 只在开工前 30 分钟解锁
 *          所以开工时间必须「在未来」且「30 分钟内」。超时了重跑本脚本即可。
 *   D6  第三天的岗位，时间与 D4 那个班重叠 —— Hero 申请它必被拦。
 *   D7  Worker Pool 预置 3 个已验证工人（含历史完工记录）。班组**故意不预先入池**，
 *       他们要等演示里主管放行、真的 Clock Out 那一刻才进池 —— PPT 第六步
 *       「做完一次工就进人才库」于是在镜头前真实发生，而不是早就发生过。
 *   D8  制造工作量失衡（Workload Suggestion 必定触发）+ 几条超期任务（Task Delay Alert 有内容）。
 *
 * ## 演示账号（密码统一 111111）
 *
 *   Owner         owner@test.com      Sarah Mitchell
 *   Manager       manager1@test.com   David Lim（Operations，已打卡未下班）
 *   Employee      employee1@test.com  Ben Seah（Operations，今天班组的主管，已打卡未下班）
 *   Guest         guest1@test.com     Wei Jie Lim（现场申请岗位的那个人）
 *
 * ## 使用方法（演示开始前跑一次）
 *
 *   node scripts/seed-demo.js
 *
 * 幂等，可以反复跑。跑完最后会打印一份"现场可以做什么"的清单。
 */

const { createClient } = require('@supabase/supabase-js')
const { spawnSync } = require('child_process')
const path = require('path')

// Node does not read .env.local on its own — without this the service-role key is
// undefined and the script exits at the guard below (BUG-006 removed the hardcoded
// fallback but left no loader). Same line every other script under scripts/ uses.
require('dotenv').config({ path: '.env.local' })

// ─── 配置 ──────────────────────────────────────────────────────────────────────

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
  || 'https://qnpwuipwyidslxndgewg.supabase.co'

const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SERVICE_ROLE_KEY) {
  console.error('SUPABASE_SERVICE_ROLE_KEY is required (set it in .env.local) — no hardcoded fallback, see BUG-006')
  process.exit(1)
}

const PASSWORD = '111111'

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

// 第二家公司的 Owner —— 只为了让 companies.owner_id 有个合法的人，演示时不会登录它。
const SECOND_OWNER_EMAIL = 'owner2@demo.test'

const HERO_EMAIL = 'guest1@test.com'          // 现场申请岗位的人
const HIRING_JOB_TITLE = 'Event Crew — Grand Opening'   // AI Assessment 演示用
const CONFLICT_JOB_TITLE = 'Sunday Banquet Service Crew' // 冲突拦截演示用

// 通过招聘岗位**已经录用并确认**的 4 个人 —— 演示开始时他们已经在岗打卡。
// 岗位要 5 个人，这 4 个已确认，Owner 打开时就是「还差最后一个」，Hero 现场补位。
// 补完 AI Assign 的候选人就是 5 个（4 班组 + Hero）。
const CREW_EMAILS = ['casual3@test.com', 'casual4@test.com', 'casual5@test.com', 'casual6@test.com']
// Worker Pool 里预先就有的人（跟班组**故意错开**：班组这次干完下班才会进池，
// 这样「做完一次工就进人才库」这个收尾动作在演示里是真的发生，不是早就发生过）。
const POOL_EMAILS = ['casual7@test.com', 'casual8@test.com', 'casual2@test.com']
// 招聘岗位上还在等的申请人 —— Hero 现场再申请一个，AI Assessment 一共排 6 个。
const APPLICANT_EMAILS = ['guest2@test.com', 'guest3@test.com', 'guest4@test.com', 'guest5@test.com', 'casual7@test.com']

// ─── 日期 / 时间工具（口径与 seed.js 一致：班次时间是新加坡名义时间 +08:00）──────

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
// 新加坡时间的某天某个钟点，对应的真实 UTC 时刻。
function sgt(dateStr, hhmm) {
  return new Date(`${dateStr}T${hhmm}:00.000+08:00`)
}
// 与 attendanceService.resolveActiveSubmissionWeekStart 同一套算法：返回当前仍开放提交的那一周
// （周一）。deadline 落在「本周」内，过了就顺延到下一周。
function activeSubmissionWeekStart(today, deadlineWeekday, deadlineTime) {
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

// 「今天」按**新加坡日历**算，跟 app 的 sgtTodayKey() 同一口径 —— 班次日期存的就是这个。
function sgtTodayKeyNow() {
  return new Date(Date.now() + 8 * 3600000).toISOString().slice(0, 10)
}

// ⚠️ 这些是 let 不是 const，且会在 runBaseSeed() 之后重算一次。
// runBaseSeed 要跑 2-3 分钟，如果日期在脚本启动那一刻就定死，而这几分钟里跨过了午夜，
// 就会出现「日期是昨天、时间是今天」的组合 —— 岗位直接变成 24 小时前，offer 一确认就报
// 「shift has already started」。（第一次跑正好卡在 23:57 撞上了这个。）
let TODAY = new Date()
let TODAY_KEY = sgtTodayKeyNow()
let TOMORROW_KEY = dateKey(addDays(TODAY, 1))
let DAY3_KEY = dateKey(addDays(TODAY, 2))

function refreshDates() {
  TODAY = new Date(`${sgtTodayKeyNow()}T00:00:00`)
  TODAY_KEY = sgtTodayKeyNow()
  TOMORROW_KEY = dateKey(addDays(TODAY, 1))
  DAY3_KEY = dateKey(addDays(TODAY, 2))
}

// 招聘岗位的开工时间 = 跑脚本那一刻 + 30 分钟。这个数字不是随便挑的，是两条规则夹出来的
// **唯一**可行值：
//   · respondToInvitation 会调 invitationHasExpired —— 开工时间一过，offer 就确认不了
//     → 开工时间必须在未来
//   · Clock In 只在开工前 30 分钟解锁（casual/dashboard 的 CLOCK_IN_WINDOW_MINUTES_BEFORE）
//     → 开工时间必须在 30 分钟内
// 两条一夹，可用窗口最大 30 分钟，而且只有把开工时间设成「现在 +30 分」才能拿满整个 30 分钟
// （窗口从跑完脚本那一刻立刻开始）。演示必须在这 30 分钟内完成招聘那一段，超时就重跑脚本。
const JOB_START_OFFSET_MIN = 30

// 新加坡挂钟时间的 HH:MM，从现在起偏移 offsetMinutes 分钟。
// 班次时间存的是新加坡名义时间，所以要先把真实时刻 +08:00 再读小时分钟。
function sgtClockFromNow(offsetMinutes) {
  const d = new Date(Date.now() + offsetMinutes * 60000 + 8 * 3600000)
  return `${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}`
}
function pad2(n) { return String(n).padStart(2, '0') }

// ⚠️ 这两个**必须**在真正写岗位那一刻才算，不能在模块加载时算：runBaseSeed() 要先跑 2-3 分钟
// seed.js，如果开工时间在脚本启动时就定死，等岗位写进库时 30 分钟窗口已经先烧掉好几分钟，
// 演示还没开始 offer 就快过期了（第一次跑就是这么翻车的）。由 seedHiringJob 在写入前赋值。
let JOB_START = null
let CREW_CLOCK_IN = null
// 窗口起点，用来在最后打印准确的截止时刻。
let windowOpensAt = Date.now()

function ok(msg) { console.log(`  ✓ ${msg}`) }
function warn(msg) { console.warn(`  ⚠ ${msg}`) }

// ─── 第一步：原样跑 seed.js ────────────────────────────────────────────────────

function runBaseSeed() {
  console.log('═══════════════════════════════════════════')
  console.log(' Step 0: 先跑 scripts/seed.js 建立基础数据')
  console.log('═══════════════════════════════════════════\n')
  const result = spawnSync(process.execPath, [path.join(__dirname, 'seed.js')], {
    stdio: 'inherit',
    env: process.env,
  })
  if (result.status !== 0) {
    console.error('\n✗ seed.js 执行失败，演示补丁不会继续。')
    process.exit(1)
  }
}

// ─── 查询小工具 ────────────────────────────────────────────────────────────────

async function getUserByEmail(email, { optional = false } = {}) {
  const { data, error } = await supabase
    .from('users').select('id, full_name, company_id, role').eq('email_address', email).maybeSingle()
  if (error) throw new Error(`查询 ${email} 失败: ${error.message}`)
  if (!data && !optional) throw new Error(`找不到用户 ${email}，seed.js 是不是没跑成功？`)
  return data
}

async function getCompanyByName(name) {
  const { data, error } = await supabase
    .from('companies').select('id, name').eq('name', name).maybeSingle()
  if (error) throw new Error(`查询公司 ${name} 失败: ${error.message}`)
  return data
}

async function getDepartments(companyId) {
  const { data, error } = await supabase
    .from('departments').select('id, name').eq('company_id', companyId)
  if (error) throw new Error(`查询部门失败: ${error.message}`)
  return data ?? []
}

async function createShift(fields) {
  const { data, error } = await supabase.from('shifts').insert(fields).select().single()
  if (error) { warn(`创建 shift 失败 (${fields.shift_date}): ${error.message}`); return null }
  return data
}

async function assignShift(shiftId, userId, assignedBy, supervisorEmployeeId = null) {
  if (!shiftId) return null
  const { data, error } = await supabase
    .from('shift_assignments')
    .insert({ shift_id: shiftId, user_id: userId, assigned_by: assignedBy, supervisor_employee_id: supervisorEmployeeId })
    .select().single()
  if (error) { warn(`创建 shift_assignment 失败: ${error.message}`); return null }
  return data
}

async function createTask(fields) {
  const { data, error } = await supabase.from('tasks').insert(fields).select().single()
  if (error) { warn(`创建 task 失败 (${fields.title}): ${error.message}`); return null }
  if (fields.assigned_user_id) {
    const { error: taErr } = await supabase.from('task_assignments').insert({
      task_id: data.id, user_id: fields.assigned_user_id, assigned_by: fields.assigned_by ?? null,
    })
    if (taErr) warn(`创建 task_assignment 失败 (${fields.title}): ${taErr.message}`)
  }
  return data
}

// 删掉某人从某天起的所有排班（含挂在上面的任务和打卡记录），外键顺序安全。
async function wipeShiftsFrom(userId, fromDateKey) {
  const { data: assignments, error } = await supabase
    .from('shift_assignments')
    .select('id, shift_id, shifts!inner(id, shift_date)')
    .eq('user_id', userId)
    .gte('shifts.shift_date', fromDateKey)
  if (error) { warn(`查询未来班次失败: ${error.message}`); return 0 }

  const rows = assignments ?? []
  const shiftIds = [...new Set(rows.map(r => r.shift_id))]
  const assignmentIds = rows.map(r => r.id)

  if (assignmentIds.length > 0) {
    await supabase.from('attendance_records').delete().in('shift_assignment_id', assignmentIds)
  }
  if (shiftIds.length > 0) {
    // 挂在这些班次上的任务要先清掉，否则 shifts 删不动（tasks.shift_id 外键）。
    const { data: shiftTasks } = await supabase.from('tasks').select('id').in('shift_id', shiftIds)
    const taskIds = (shiftTasks ?? []).map(t => t.id)
    if (taskIds.length > 0) {
      await supabase.from('task_assignments').delete().in('task_id', taskIds)
      await supabase.from('tasks').delete().in('parent_task_id', taskIds)
      await supabase.from('tasks').delete().in('id', taskIds)
    }
  }
  if (assignmentIds.length > 0) {
    await supabase.from('shift_assignments').delete().in('id', assignmentIds)
  }
  if (shiftIds.length > 0) {
    const { error: sErr } = await supabase.from('shifts').delete().in('id', shiftIds)
    if (sErr) warn(`删除班次失败: ${sErr.message}`)
  }
  return shiftIds.length
}

// ─── D1: Off Day 截止时间 + 待审批周对齐 ───────────────────────────────────────

async function applyOffDayDeadline(companyId) {
  console.log('\nD1: Off Day 提交截止改为周日 17:00...')

  const { error } = await supabase.from('off_day_submission_deadline').upsert({
    company_id: companyId,
    deadline_weekday: 0,   // 0 = 周日（getDay 口径）
    deadline_time: '17:00',
  }, { onConflict: 'company_id' })
  if (error) { warn(`更新 off_day_submission_deadline 失败: ${error.message}`); return }
  ok('Off Day submission deadline: Sunday 17:00')

  const activeWeek = activeSubmissionWeekStart(TODAY, 0, '17:00')
  const activeWeekKey = dateKey(activeWeek)

  const { data: pendingRows, error: pendErr } = await supabase
    .from('off_day_requests')
    .select('id, requested_date, requested_week')
    .eq('company_id', companyId)
    .eq('status', 'pending')
  if (pendErr) { warn(`查询 pending off_day_requests 失败: ${pendErr.message}`); return }

  let moved = 0
  for (const row of pendingRows ?? []) {
    if (row.requested_week === activeWeekKey) continue
    // 保持原本是周几不变，只把整条记录平移到开放提交的那一周。
    const oldDate = new Date(`${row.requested_date}T00:00:00`)
    const oldWeek = new Date(`${row.requested_week}T00:00:00`)
    const dayOffset = Math.round((oldDate.getTime() - oldWeek.getTime()) / 86400000)
    const newDate = dateKey(addDays(activeWeek, Math.max(0, Math.min(6, dayOffset))))
    const { error: upErr } = await supabase
      .from('off_day_requests')
      .update({ requested_week: activeWeekKey, requested_date: newDate })
      .eq('id', row.id)
    if (upErr) warn(`平移 off_day_request ${row.id} 失败: ${upErr.message}`)
    else moved++
  }
  ok(`${moved} 条待审批 Off Day 已对齐到 ${activeWeekKey} 那一周`)
}

// ─── D2: Ben Seah / David Lim 今天已打卡未下班 ─────────────────────────────────

async function applyClockedInSupervisors(companyId, ownerId, users) {
  console.log('\nD2: Ben Seah / David Lim 今天已打卡、未下班...')

  for (const [label, user] of [['Ben Seah (employee1)', users.employee1], ['David Lim (manager1)', users.manager1]]) {
    const { data: assignments, error: aErr } = await supabase
      .from('shift_assignments')
      .select('id, shift_id, shifts!inner(id, shift_date)')
      .eq('user_id', user.id)
      .eq('shifts.shift_date', TODAY_KEY)
    if (aErr) { warn(`查询 ${label} 今天的班失败: ${aErr.message}`); continue }

    let assignment = (assignments ?? [])[0]

    if (assignment) {
      const { error: sErr } = await supabase
        .from('shifts')
        .update({ start_time: '08:00', end_time: '20:00', is_open_ended: false })
        .eq('id', assignment.shift_id)
      if (sErr) warn(`更新 ${label} 今天班次时间失败: ${sErr.message}`)
    } else {
      const shift = await createShift({
        company_id: companyId, department_id: users.opsDeptId, shift_date: TODAY_KEY,
        start_time: '08:00', end_time: '20:00', is_open_ended: false,
        created_by: ownerId, publication_status: 'published',
      })
      assignment = await assignShift(shift?.id, user.id, ownerId)
      if (!assignment) { warn(`${label} 今天的班没建成，跳过打卡记录`); continue }
    }

    // 关键的一步：已打卡、**不写 clock_out_time**。
    // getClockLockStatus 取 clock_in_time 最新的一条记录，只要它没有下班时间就解锁。
    await supabase.from('attendance_records').delete().eq('shift_assignment_id', assignment.id)
    const { error: recErr } = await supabase.from('attendance_records').insert({
      shift_assignment_id: assignment.id,
      user_id: user.id,
      clock_in_time: sgt(TODAY_KEY, '08:00').toISOString(),
      clock_out_time: null,
      break_in_time: null,
      break_out_time: null,
    })
    if (recErr) warn(`${label} 打卡记录写入失败: ${recErr.message}`)
    else ok(`${label} 今天 08:00 已打卡、未下班（Tasks 页可写，AI Assign 按钮会渲染）`)
  }
}

// ─── D3: 清掉 seed.js 自带的今日在管工人 ───────────────────────────────────────

// Employee 那一层 AI Assign 的候选人来自 getSupervisedCasualWorkersByEmployee，条件是：
//   shift_assignments.supervisor_employee_id = Ben
//   AND shifts.shift_date = 今天 AND shifts.department_id = Operations
// seed.js 自己也会给别的 Casual Worker（Marcus Lee、Hana Bakri）排今天的班并挂 Ben 当主管，
// 不清的话候选名单会混进不属于班组的人，现场讲解跟画面对不上。
async function clearStraySupervisedWorkers(benId) {
  console.log('\nD3: 清掉 seed.js 自带的今日在管工人...')
  const { data: preexisting } = await supabase
    .from('shift_assignments')
    .select('user_id, shifts!inner(shift_date)')
    .eq('supervisor_employee_id', benId)
    .eq('shifts.shift_date', TODAY_KEY)
  const strayIds = [...new Set((preexisting ?? []).map(r => r.user_id))]
  for (const uid of strayIds) await wipeShiftsFrom(uid, TODAY_KEY)
  ok(`清掉 ${strayIds.length} 人，Ben 今天名下现在是空的，等 D5 把班组种进去`)
}

// ─── D4: Hero 清干净 + 第二家公司的既有承诺（冲突拦截用）──────────────────────

async function prepareHeroAndSecondCompany(heroId) {
  console.log('\nD4: Hero（Wei Jie Lim）清干净在途工作，并在第二家公司排一个已确认的班...')

  const wiped = await wipeShiftsFrom(heroId, TODAY_KEY)
  ok(`清掉 Hero ${wiped} 个从今天起的班次`)

  // 在途申请同样算「已占用时段」（workerEligibility.getActiveApplicationJobs），一并清掉，
  // 否则他现场申请新岗位时可能被自己的旧申请挡住。
  const { data: apps } = await supabase
    .from('job_applicants').select('id').eq('user_id', heroId).in('status', ['pending', 'accepted'])
  const appIds = (apps ?? []).map(a => a.id)
  if (appIds.length > 0) {
    await supabase.from('job_invitations').delete().in('applicant_id', appIds)
    await supabase.from('job_applicants').delete().in('id', appIds)
  }
  ok(`清掉 Hero ${appIds.length} 条在途申请（现在他是干净的，可以现场申请）`)

  // Hero 的 worker profile —— 没有这行，Apply 会直接报 "Worker profile not found"。
  // seed.js 正常会建，这里兜底一次，重跑也安全。
  const { data: profile } = await supabase
    .from('casual_worker_profiles').select('user_id').eq('user_id', heroId).maybeSingle()
  if (!profile) {
    await supabase.from('casual_worker_profiles').insert({
      user_id: heroId,
      skills: 'Forklift operation, Inventory management, Heavy lifting',
      resume_url: 'https://example.com/demo-resumes/guest1-resume.pdf',
    })
    ok('补上了 Hero 的 worker profile')
  } else {
    ok('Hero 的 worker profile 已存在')
  }

  // ── 第二家公司 ──
  const { data: authList } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 })
  const stale = (authList?.users ?? []).find(u => u.email === SECOND_OWNER_EMAIL)
  if (stale) await supabase.auth.admin.deleteUser(stale.id)

  const { data: auth, error: authErr } = await supabase.auth.admin.createUser({
    email: SECOND_OWNER_EMAIL, password: PASSWORD, email_confirm: true,
  })
  if (authErr || !auth?.user) { warn(`第二家公司 owner 建号失败: ${authErr?.message}`); return null }

  const { data: owner2, error: uErr } = await supabase.from('users').insert({
    supabase_auth_id: auth.user.id,
    full_name: 'Priya Nair',
    email_address: SECOND_OWNER_EMAIL,
    phone_number: '+65 8100 3001',
    date_of_birth: '1984-06-11',
    role: 'Owner',
    // users.profile_photo_url 是 NOT NULL，跟 seed.js 用同一张占位图。
    profile_photo_url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=tasking',
  }).select().single()
  if (uErr) { warn(`第二家公司 owner users 行失败: ${uErr.message}`); return null }

  const { data: company2, error: cErr } = await supabase.from('companies').insert({
    name: 'Harbourfront Events Pte Ltd',
    owner_id: owner2.id,
    description: 'Event staffing and venue operations across the southern waterfront.',
    location: 'HarbourFront',
    address: '1 Maritime Square, Singapore 099253',
    postal_code: '099253',
    industry: 'Events',
    size: '11-50',
    plan: 'Free',
  }).select().single()
  if (cErr) { warn(`第二家公司创建失败: ${cErr.message}`); return null }
  await supabase.from('users').update({ company_id: company2.id }).eq('id', owner2.id)

  const { data: dept2, error: dErr } = await supabase.from('departments').insert({
    name: 'Venue Operations', color: '#8B5CF6', company_id: company2.id,
  }).select().single()
  if (dErr) { warn(`第二家公司部门创建失败: ${dErr.message}`); return null }

  // 第三天 15:00-21:00 的已确认班次 —— 演示里「他在另一家公司已经有活了」就是这条。
  const shift = await createShift({
    company_id: company2.id, department_id: dept2.id, shift_date: DAY3_KEY,
    start_time: '15:00', end_time: '21:00', is_open_ended: false,
    created_by: owner2.id, publication_status: 'published', hourly_rate: 15,
  })
  await assignShift(shift?.id, heroId, owner2.id)

  await supabase.from('casualworker_departments').upsert({
    casual_worker_id: heroId, department_id: dept2.id, company_id: company2.id,
    verified_at: new Date().toISOString(),
  }, { onConflict: 'casual_worker_id,department_id' })

  ok(`Harbourfront Events：Hero 第三天 ${DAY3_KEY} 15:00-21:00 已确认排班`)
  return company2
}

// ─── D5: 明天的招聘岗位 + 5 个待处理申请人（AI Assessment 用）─────────────────

async function seedHiringJob(companyId, ownerId, opsDeptId, benId) {
  // 30 分钟窗口从**这一刻**起算，不是从脚本启动起算 —— seed.js 已经跑掉的那几分钟不该占用它。
  JOB_START = sgtClockFromNow(JOB_START_OFFSET_MIN)
  // 班组提前到场（开工前 20 分钟打的卡），显示成 Present 而不是 Late。
  CREW_CLOCK_IN = sgtClockFromNow(JOB_START_OFFSET_MIN - 20)
  windowOpensAt = Date.now()

  // 跨午夜守卫：开工时刻落到了新加坡日历的下一天，而班次日期是今天 —— 拼起来就是 24 小时前
  // 的班，offer 一确认就报「shift has already started」。宁可大声喊停，也不要种出一份看起来
  // 正常、演示到一半才炸的数据。
  const startDay = new Date(Date.now() + (JOB_START_OFFSET_MIN + 8 * 60) * 60000).toISOString().slice(0, 10)
  if (startDay !== TODAY_KEY) {
    console.error('\n✗ 现在离新加坡时间午夜不到 30 分钟，种出来的岗位会跨天失效。')
    console.error('  过了午夜再重跑一次这个脚本即可。\n')
    process.exit(1)
  }

  console.log(`\nD5: 今天 ${JOB_START} 开工的招聘岗位 + 已在岗班组 + 待处理申请人...`)

  // 先把本公司其它岗位的 pending 申请压掉，保证红点只有这一个，现场不会点错。
  const { data: postings } = await supabase
    .from('job_postings').select('id, title').eq('company_id', companyId)
  const otherIds = (postings ?? []).filter(p => p.title !== HIRING_JOB_TITLE).map(p => p.id)
  if (otherIds.length > 0) {
    await supabase.from('job_applicants').update({ status: 'rejected' }).in('job_id', otherIds).eq('status', 'pending')
  }

  // 重跑时先删掉上一次建的，避免同名岗位堆积。
  const existing = (postings ?? []).find(p => p.title === HIRING_JOB_TITLE)
  if (existing) {
    const { data: oldApps } = await supabase.from('job_applicants').select('id').eq('job_id', existing.id)
    const oldAppIds = (oldApps ?? []).map(a => a.id)
    if (oldAppIds.length > 0) {
      await supabase.from('job_invitations').delete().in('applicant_id', oldAppIds)
      await supabase.from('job_applicants').delete().in('id', oldAppIds)
    }
    await supabase.from('job_postings').delete().eq('id', existing.id)
  }

  const { data: job, error } = await supabase.from('job_postings').insert({
    company_id: companyId, department_id: opsDeptId, created_by: ownerId,
    // 这个字段就是新工人被录用后 shift_assignments.supervisor_employee_id 的来源
    // （workerApplicationService 第 256 行）。挂 Ben，新人才归 Ben 管。
    assigned_employee_id: benId,
    title: HIRING_JOB_TITLE,
    responsibilities: 'Set up the venue before doors open, run the floor during the event, and clear down afterwards. Includes moving tables and chairs, guiding guests, and keeping service areas tidy.',
    skills: 'Comfortable lifting and carrying event equipment, follows a floor plan accurately, stays calm and quick under time pressure, works well in a team.',
    status: 'open',
    job_type: 'oneoff',
    urgency: 'urgent',
    // 今天，开工时间 = 现在 +30 分钟。见 JOB_START_OFFSET_MIN 上面那段注释：这是「offer 还能
    // 确认」和「Clock In 已解锁」两条规则唯一的交集。放明天的话 Hero 录用后拿到的是明天的班，
    // 不会出现在今天的 AI Assign 候选名单里，整条链就断了。
    job_date: TODAY_KEY,
    job_start_time: JOB_START,
    estimated_hours: '8',
    // 3 个位置已经被班组占了，剩 2 个空位。Hero 确认后是 4/5，岗位不会当场自动关闭
    // （openings 填满会触发 closeJobPosting 并作废其余 offer，演示中途跳这个不好收场）。
    openings: 5,
    experience_required: 'Not Required',
    minimum_age: 16,
    salary_amount: 120,
    no_deadline: true,
  }).select().single()
  if (error) { warn(`招聘岗位创建失败: ${error.message}`); return null }

  // ── 班组：通过这个岗位**已经录用并确认**的 3 个人 ──
  // 完整复刻 workerApplicationService 走完一遍的结果：申请(accepted) → 邀请(accepted) →
  // 班次(source_job_posting_id 指回岗位) → 排班(supervisor 挂 Ben) → 已打卡未下班。
  // 这样演示开始时他们就在岗，Hero 现场补最后一个位置，AI Assign 立刻有 4 个人。
  const crew = []
  for (const email of CREW_EMAILS) {
    const user = await getUserByEmail(email, { optional: true })
    if (!user) { warn(`找不到 ${email}，跳过`); continue }

    await wipeShiftsFrom(user.id, TODAY_KEY)

    const { data: applicant, error: appErr } = await supabase.from('job_applicants').insert({
      job_id: job.id, user_id: user.id, status: 'accepted',
      skills: (await supabase.from('casual_worker_profiles').select('skills').eq('user_id', user.id).maybeSingle()).data?.skills ?? null,
      certificates: [],
      additional_note: 'Confirmed earlier today.',
      applied_at: new Date(Date.now() - 3 * 3600000).toISOString(),
      decided_at: new Date(Date.now() - 2 * 3600000).toISOString(),
    }).select().single()
    if (appErr) { warn(`${user.full_name} 申请记录失败: ${appErr.message}`); continue }

    await supabase.from('job_invitations').insert({
      job_id: job.id, applicant_id: applicant.id, sent_by: ownerId, status: 'accepted',
      sent_at: new Date(Date.now() - 2 * 3600000).toISOString(),
      responded_at: new Date(Date.now() - 90 * 60000).toISOString(),
    })

    const shift = await createShift({
      company_id: companyId, department_id: opsDeptId, shift_date: TODAY_KEY,
      start_time: JOB_START, end_time: '23:00',
      // 一次性工作是开放式班次：下班要主管放行，正是演示第 5 步「主管放行 → 工人下班」。
      is_open_ended: true,
      created_by: ownerId, publication_status: 'published',
      source_job_posting_id: job.id, hourly_rate: null,
    })
    const assignment = await assignShift(shift?.id, user.id, ownerId, benId)
    if (!assignment) { warn(`${user.full_name} 排班失败`); continue }

    const { error: recErr } = await supabase.from('attendance_records').insert({
      shift_assignment_id: assignment.id,
      user_id: user.id,
      clock_in_time: sgt(TODAY_KEY, CREW_CLOCK_IN).toISOString(),
      clock_out_time: null,
    })
    if (recErr) { warn(`${user.full_name} 打卡记录失败: ${recErr.message}`); continue }

    // 这个岗位是他们在本公司的第一份工 —— verified_at 留空，等演示里下班那一刻才进 Pool。
    await supabase.from('casualworker_departments').upsert({
      casual_worker_id: user.id, department_id: opsDeptId, company_id: companyId,
      verified_at: null, inactive_at: null,
    }, { onConflict: 'casual_worker_id,department_id' })

    crew.push(user)
    ok(`${user.full_name}：已录用确认，${CREW_CLOCK_IN} 打卡在岗，主管 Ben`)
  }

  // 5 个待处理申请人，资料直接取自各自的 worker profile（跟真人自己填的一致）。
  // 留言故意写成强弱分明，AI Assessment 排出来的名次才讲得通。
  const notes = {
    'guest2@test.com': 'Mostly social media and copywriting so far, but I pick things up fast and I am free all weekend.',
    'guest3@test.com': 'Two seasons of event crew work, stage rigging and sound setup. Used to long pack-down nights.',
    'guest4@test.com': 'Retail and promo experience, comfortable talking to guests all day. Weekends fully free.',
    'guest5@test.com': 'My background is IT support rather than events, but I am reliable and happy to do the heavy lifting.',
    'casual7@test.com': 'Worked several banquet turnovers here before. Know the floor plan and the pack-down routine already.',
  }

  let created = 0
  for (const email of APPLICANT_EMAILS) {
    const user = await getUserByEmail(email, { optional: true })
    if (!user) { warn(`找不到 ${email}，跳过`); continue }

    const { data: profile } = await supabase
      .from('casual_worker_profiles').select('skills, resume_url').eq('user_id', user.id).maybeSingle()
    const { data: certs } = await supabase
      .from('user_certificates').select('name, certificate_url').eq('user_id', user.id)

    const { error: appErr } = await supabase.from('job_applicants').insert({
      job_id: job.id,
      user_id: user.id,
      status: 'pending',
      resume: profile?.resume_url ?? null,
      skills: profile?.skills ?? null,
      certificates: certs ?? [],
      additional_note: notes[email] ?? null,
      // 错开申请时间，列表看起来像陆续收到的。
      applied_at: new Date(Date.now() - (created + 1) * 37 * 60000).toISOString(),
    })
    if (appErr) warn(`挂申请人 ${email} 失败: ${appErr.message}`)
    else created++
  }

  ok(`「${job.title}」今天 ${JOB_START} 开工（openings 5，已占 ${crew.length}），主管挂 Ben`)
  ok(`${created} 个待处理申请人，Hero 现场再申请一个就是 ${created + 1} 个人排名`)
  return { job, crew }
}

// ─── D6: 第三天的岗位（Hero 申请它必然撞车）────────────────────────────────────

async function seedConflictJob(companyId, ownerId, opsDeptId) {
  console.log('\nD6: 第三天的岗位，用来演示跨公司资格冲突拦截...')

  const { data: existing } = await supabase
    .from('job_postings').select('id').eq('company_id', companyId).eq('title', CONFLICT_JOB_TITLE).maybeSingle()
  if (existing) {
    const { data: oldApps } = await supabase.from('job_applicants').select('id').eq('job_id', existing.id)
    const oldAppIds = (oldApps ?? []).map(a => a.id)
    if (oldAppIds.length > 0) {
      await supabase.from('job_invitations').delete().in('applicant_id', oldAppIds)
      await supabase.from('job_applicants').delete().in('id', oldAppIds)
    }
    await supabase.from('job_postings').delete().eq('id', existing.id)
  }

  const { data: job, error } = await supabase.from('job_postings').insert({
    company_id: companyId, department_id: opsDeptId, created_by: ownerId,
    title: CONFLICT_JOB_TITLE,
    responsibilities: 'Serve a full-house banquet: plate service, drinks top-up, and floor reset between courses.',
    skills: 'Comfortable on your feet for long stretches, tidy presentation, works well in a team.',
    status: 'open',
    job_type: 'oneoff',
    urgency: 'normal',
    job_date: DAY3_KEY,
    job_start_time: '16:00',
    estimated_hours: '6',
    openings: 4,
    experience_required: 'Not Required',
    minimum_age: 16,
    salary_amount: 90,
    no_deadline: true,
  }).select().single()
  if (error) { warn(`冲突演示岗位创建失败: ${error.message}`); return }

  ok(`「${job.title}」第三天 ${DAY3_KEY} 16:00 开工`)
  ok('Hero 申请它会撞上 Harbourfront 那天 15:00-21:00 的班 → 被拦下')
  ok('注意：拦截文案只说「和你已有的班冲突」，不写公司名，跨公司这点要靠讲解点出来')
}

// ─── D7: Worker Pool 预置（Invite from Pool 直接有人可邀）──────────────────────

async function seedWorkerPool(companyId, ownerId, opsDeptId, benId) {
  console.log('\nD7: Worker Pool 预置已验证工人 + 历史完工记录...')

  // getVerifiedPoolWorkers 的条件：casualworker_departments.verified_at 非空、inactive_at 为空。
  // completed_shifts 是从 attendance_records 里有 clock_out_time 的记录数出来的，所以要补历史
  // 完工记录，否则池子里每个人都是 0 场，看着像假数据。
  let pooled = 0
  for (const email of POOL_EMAILS) {
    const user = await getUserByEmail(email, { optional: true })
    if (!user) { warn(`找不到 ${email}，跳过`); continue }

    const { error: cwdErr } = await supabase.from('casualworker_departments').upsert({
      casual_worker_id: user.id,
      department_id: opsDeptId,
      company_id: companyId,
      verified_at: new Date().toISOString(),
      inactive_at: null,
    }, { onConflict: 'casual_worker_id,department_id' })
    if (cwdErr) { warn(`${user.full_name} 入池失败: ${cwdErr.message}`); continue }

    // 过去两周补 2-3 场已完工的班。天数按人错开，Last Worked 那一列才不会所有人同一天。
    const pastCount = 2 + (pooled % 2)
    for (let i = 0; i < pastCount; i++) {
      const dayBack = 3 + i * 4 + (pooled % 3)
      const pastKey = dateKey(addDays(TODAY, -dayBack))
      const shift = await createShift({
        company_id: companyId, department_id: opsDeptId, shift_date: pastKey,
        start_time: '09:00', end_time: '17:00', is_open_ended: false,
        created_by: ownerId, publication_status: 'published', hourly_rate: 14,
      })
      const assignment = await assignShift(shift?.id, user.id, ownerId, benId)
      if (!assignment) continue
      await supabase.from('attendance_records').insert({
        shift_assignment_id: assignment.id,
        user_id: user.id,
        clock_in_time: sgt(pastKey, '08:56').toISOString(),
        clock_out_time: sgt(pastKey, '17:04').toISOString(),
      })
    }

    pooled++
    ok(`${user.full_name}：已验证入池，${pastCount} 场历史完工记录`)
  }

  ok(`Worker Pool 共 ${pooled} 人，结尾「Invite from Pool」直接有人可邀`)
}

// ─── D9: Employee 页面的 Workload Suggestion + Task Delay Alert ────────────────

// D8 那套是 Manager 层的（Owner 页面看的）。演示不打算展示 Manager，所以这里单独再造一份
// **Casual Worker 层**的，让 Ben 自己的 Tasks 页就能刷出这两个提示。
//
// 两个提示的触发条件完全不同，别混：
//   Workload Suggestion（getWorkloadRebalancingSuggestions，candidateRole='Casual Worker'）
//     候选人 = getSupervisedCasualWorkersByEmployee(Ben, 今天)，也就是班组
//     要求：最重的人分数 > 最轻的人 x2，且最重的人至少 2 条活跃主任务，
//           且被搬的任务不能是 Review / 带驳回理由的，且接手人当天要有排班
//   Task Delay Alert（getTaskDelayAlerts）
//     只看**还停在 Assigned 没人动**的任务，且 (now - created_at) / (due_at - created_at)
//     超过阈值（默认 50%）。所以要把 created_at 往前挪，不是把 due_at 设成过去。
async function seedEmployeeSideInsights(companyId, benId, opsDeptId, crew) {
  console.log('\nD9: Employee 页面的 Workload Suggestion + Task Delay Alert...')

  if (crew.length < 2) { warn('班组不足 2 人，这两个提示都出不来，跳过'); return }

  const overloaded = crew[0]
  const lightest = crew[1]

  // ── Task Delay Alert：2 条「派下去了但一直没人开始」的任务 ──
  // created_at 4 小时前、due_at 2 小时后 → 已用掉 67% 的时间，超过 50% 阈值。
  // 停在 Assigned 是关键：一旦被拖到 In Progress 就不再算延迟了。
  const stalled = [
    { title: 'Check function room AV setup', hoursAgo: 4, dueInHours: 2 },
    { title: 'Count linen stock for tonight', hoursAgo: 5, dueInHours: 1 },
  ]
  for (const s of stalled) {
    await createTask({
      company_id: companyId, department_id: opsDeptId,
      title: s.title,
      description: 'Assigned ahead of the shift and still not picked up — this is what the delay alert flags.',
      assigned_user_id: overloaded.id, assigned_by: benId,
      status: 'Assigned', priority: 'High',
      created_at: new Date(Date.now() - s.hoursAgo * 3600000).toISOString(),
      due_at: new Date(Date.now() + s.dueInHours * 3600000).toISOString(),
      task_date: TODAY_KEY,
    })
  }
  ok(`${stalled.length} 条任务停在 Assigned 且已用掉 >50% 时间 → Ben 的 Task Delay Alert 有内容`)

  // ── Workload Suggestion：把活压在一个人身上 ──
  // 班组是今天才上工的，手上本来是干净的，所以分数完全由这里决定，不用像 D8 那样先测再补。
  // Urgent(4) x 截止 6 小时内(3) = 12 分/条。压 4 条 = 48 分，其他人 0 分，稳过 2 倍线。
  const piled = [
    'Reset banquet hall seating plan',
    'Restock service station supplies',
    'Wipe down and polish glassware',
    'Stage welcome signage at entrance',
  ]
  for (const title of piled) {
    await createTask({
      company_id: companyId, department_id: opsDeptId,
      title,
      description: 'Seeded so one worker is visibly overloaded and the rebalance suggestion has something to move.',
      assigned_user_id: overloaded.id, assigned_by: benId,
      status: 'Assigned', priority: 'Urgent',
      due_at: new Date(Date.now() + 6 * 3600000).toISOString(),
      // task_date 落在今天：接手人当天必须有排班才搬得动，班组今天都在岗，一定搬得动。
      task_date: TODAY_KEY,
    })
  }

  // 给第二个人一条轻活，画面上不至于「一个人满、其他人全空」那么假。
  await createTask({
    company_id: companyId, department_id: opsDeptId,
    title: 'Brief the floor team on tonight’s run sheet',
    description: 'A light one, so the board does not read as one person holding literally everything.',
    assigned_user_id: lightest.id, assigned_by: benId,
    status: 'Assigned', priority: 'Low',
    due_at: new Date(Date.now() + 5 * 24 * 3600000).toISOString(),
    task_date: TODAY_KEY,
  })

  const overloadedScore = (stalled.length + piled.length) * 12
  ok(`${overloaded.full_name} 手上 ${stalled.length + piled.length} 条活（约 ${overloadedScore} 分），`
    + `${lightest.full_name} 1 条，其余 0 条 → Workload Suggestion 必出`)
  ok('注意：延迟提示只认「还停在 Assigned」的任务，演示时别提前把它们拖走')
}

// ─── D8: 工作量失衡 + 超时任务 ─────────────────────────────────────────────────

// taskService.taskWorkloadWeight 的复刻：优先级权重 x 截止紧迫度。
const PRIORITY_WEIGHT = { Urgent: 4, High: 3, Medium: 2, Low: 1 }
function deadlineUrgencyWeight(dueAt) {
  if (!dueAt) return 1
  const hoursRemaining = (new Date(dueAt).getTime() - Date.now()) / 3600000
  if (hoursRemaining < 0) return 4
  if (hoursRemaining <= 24) return 3
  if (hoursRemaining <= 72) return 2
  return 1
}
function taskWorkloadWeight(task) {
  return (PRIORITY_WEIGHT[task.priority] ?? PRIORITY_WEIGHT.Medium) * deadlineUrgencyWeight(task.due_at)
}

async function seedWorkloadImbalance(companyId, ownerId, depts) {
  console.log('\nD8: 制造工作量失衡（Workload Suggestion）+ 超时任务（Delay Alert）...')

  // ── 先种 Delay Alert 用的超期任务（它们也会计入下面的工作量分数，所以必须排在前面）──
  const opsDept = depts.find(d => d.name === 'Operations')
  const overdueSpecs = [
    { title: 'Submit last week ops incident summary', assignee: 'manager5@test.com', daysLate: 2 },
    { title: 'Close out damaged equipment write-off', assignee: 'manager5@test.com', daysLate: 3 },
  ]
  for (const spec of overdueSpecs) {
    const { data: assignee } = await supabase
      .from('users').select('id').eq('email_address', spec.assignee).maybeSingle()
    if (!assignee || !opsDept) continue
    const due = addDays(TODAY, -spec.daysLate)
    due.setHours(17, 0, 0, 0)
    await createTask({
      company_id: companyId, department_id: opsDept.id, title: spec.title,
      description: 'Seeded overdue so Task Delay Alert has something to flag.',
      assigned_user_id: assignee.id, assigned_by: ownerId,
      status: 'In Progress', priority: 'High', due_at: due.toISOString(), task_date: null,
    })
  }
  ok(`${overdueSpecs.length} 条已超期任务，Task Delay Alert 有内容`)

  // ── 工作量失衡 ──
  // 触发条件（taskService.getWorkloadRebalancingSuggestions）：
  //   最重的人分数 > 最轻候选人分数 x 2，且最重的人至少有 2 条活跃主任务。
  // 直接照抄 seed.js 的任务量去猜要堆多少条是猜不准的，所以这里**先按线上真实数据算一遍分数，
  // 再算出还差几条**，避免以后 seed.js 改了这里就失效。
  //
  // 「重」的一方固定放在各部门的第二个 Manager（Wendy Ho / Kelvin Ang），「轻」的一方留给
  // David Lim / Rachel Koh —— AI Assign 推荐的是**最闲**的人，两边必须对得上，否则画面自相矛盾。
  const partner = await getUserByEmail('partner1@test.com')
  const peerTier = [ownerId, partner.id]

  const overloadPlan = [
    { deptName: 'Operations', overloadedEmail: 'manager5@test.com', titlePool: [
      'Rebuild weekend floor rota', 'Chase outstanding supplier invoices',
      'Draft peak-season staffing brief', 'Audit stockroom count variances',
      'Re-cost the banquet overtime claim', 'Rewrite the closing handover checklist',
      'Reconcile last month agency invoices', 'Prepare the peak-week contingency roster',
      'Escalate the linen supplier shortfall', 'Rebuild the standby caller list',
      'Re-check the venue capacity sign-off', 'Close the outstanding incident actions',
    ] },
    { deptName: 'Marketing', overloadedEmail: 'manager6@test.com', titlePool: [
      'Rework Q4 campaign brief', 'Collect partner co-marketing assets',
      'Refresh promo landing copy', 'Rebuild the seasonal creative calendar',
      'Chase the agency asset handover', 'Re-cut the launch teaser',
      'Rewrite the loyalty email sequence', 'Audit the paid channel spend',
      'Refresh the storefront window brief', 'Re-brief the influencer shortlist',
      'Rebuild the campaign tracking sheet', 'Close out the sponsorship recap',
    ] },
  ]

  // Urgent + 6 小时后到期 = 4 x 3 = 12 分/条。
  const WEIGHT_PER_SEEDED_TASK = PRIORITY_WEIGHT.Urgent * 3

  for (const plan of overloadPlan) {
    const dept = depts.find(d => d.name === plan.deptName)
    if (!dept) { warn(`找不到部门 ${plan.deptName}，跳过`); continue }

    const { data: overloaded } = await supabase
      .from('users').select('id, full_name').eq('email_address', plan.overloadedEmail).maybeSingle()
    if (!overloaded) { warn(`找不到 ${plan.overloadedEmail}，跳过`); continue }

    const { data: memberships } = await supabase
      .from('manager_departments').select('manager_id').eq('department_id', dept.id)
    const candidateIds = (memberships ?? []).map(m => m.manager_id)
    if (candidateIds.length < 2) { warn(`${plan.deptName} 的 Manager 不足 2 人，无法形成建议`); continue }

    // Owner 的 Tasks 页只看 Owner/Partner 这一层派下去的任务（route.ts 的 assignedByFilter），
    // 分数也必须按同一口径算。
    const { data: deptTasks } = await supabase
      .from('tasks').select('assigned_user_id, priority, due_at, status, parent_task_id, assigned_by')
      .eq('company_id', companyId).eq('department_id', dept.id)
    const active = (deptTasks ?? []).filter(t =>
      t.status !== 'Complete' && t.parent_task_id === null && t.assigned_user_id && peerTier.includes(t.assigned_by))

    const scores = new Map(candidateIds.map(id => [id, 0]))
    for (const t of active) {
      if (!scores.has(t.assigned_user_id)) continue
      scores.set(t.assigned_user_id, scores.get(t.assigned_user_id) + taskWorkloadWeight(t))
    }

    const overloadedScore = scores.get(overloaded.id) ?? 0
    const lightest = Math.min(...[...scores.entries()].filter(([id]) => id !== overloaded.id).map(([, s]) => s))
    // 需要严格大于 2 倍，留 1 分余量。
    const gap = (lightest * 2 + 1) - overloadedScore
    const needed = Math.max(2, Math.ceil(gap / WEIGHT_PER_SEEDED_TASK))

    if (needed > plan.titlePool.length) {
      warn(`${plan.deptName} 需要 ${needed} 条任务才能拉开 2 倍差距，超过备用标题数量（${plan.titlePool.length}），只种满为止`)
    }
    const toCreate = Math.min(needed, plan.titlePool.length)

    for (let i = 0; i < toCreate; i++) {
      const due = new Date()
      due.setHours(due.getHours() + 6, 0, 0, 0)
      await createTask({
        company_id: companyId,
        department_id: dept.id,
        title: plan.titlePool[i],
        description: 'Seeded for the Workload Suggestion demo — Urgent and due today, so it carries real weight.',
        assigned_user_id: overloaded.id,
        assigned_by: ownerId,
        status: 'Assigned',
        priority: 'Urgent',
        due_at: due.toISOString(),
        // task_date 留空：留空时 rebalance 不再要求接手人当天有排班，建议一定搬得动。
        task_date: null,
      })
    }

    const finalScore = overloadedScore + toCreate * WEIGHT_PER_SEEDED_TASK
    const passes = finalScore > lightest * 2
    ok(`${plan.deptName}：${overloaded.full_name} ${overloadedScore} → ${finalScore} 分（最轻 ${lightest} 分，`
      + `补了 ${toCreate} 条 Urgent）${passes ? ' ✅ 会出建议' : ' ⚠ 仍未达 2 倍线'}`)
  }
}

// ─── 主流程 ────────────────────────────────────────────────────────────────────

async function main() {
  runBaseSeed()

  // seed.js 刚跑了 2-3 分钟，期间可能已经跨天 —— 用现在的日期，别用脚本启动时的。
  refreshDates()

  console.log('\n═══════════════════════════════════════════')
  console.log(' 演示补丁开始')
  console.log('═══════════════════════════════════════════')

  const owner = await getUserByEmail('owner@test.com')
  const manager1 = await getUserByEmail('manager1@test.com')
  const employee1 = await getUserByEmail('employee1@test.com')
  const hero = await getUserByEmail(HERO_EMAIL)

  const company = await getCompanyByName('Sunrise Hospitality Group')
  if (!company) { console.error('✗ 找不到主公司，中止'); process.exit(1) }

  const depts = await getDepartments(company.id)
  const opsDept = depts.find(d => d.name === 'Operations')
  if (!opsDept) { console.error('✗ 找不到 Operations 部门，中止'); process.exit(1) }

  const users = { manager1, employee1, opsDeptId: opsDept.id }

  await applyOffDayDeadline(company.id)
  await applyClockedInSupervisors(company.id, owner.id, users)
  await clearStraySupervisedWorkers(employee1.id)
  await prepareHeroAndSecondCompany(hero.id)
  const { crew } = await seedHiringJob(company.id, owner.id, opsDept.id, employee1.id)
  await seedConflictJob(company.id, owner.id, opsDept.id)
  await seedWorkerPool(company.id, owner.id, opsDept.id, employee1.id)
  await seedEmployeeSideInsights(company.id, employee1.id, opsDept.id, crew)
  await seedWorkloadImbalance(company.id, owner.id, depts)

  const activeWeek = activeSubmissionWeekStart(TODAY, 0, '17:00')

  console.log('\n═══════════════════════════════════════════')
  console.log(' 演示数据就绪')
  console.log('═══════════════════════════════════════════')
  // 截止时刻 = 岗位开工时刻，用本机时区显示（评委看的是你屏幕上的时钟，不是 SGT）。
  const deadline = new Date(windowOpensAt + JOB_START_OFFSET_MIN * 60000)
  const deadlineLabel = `${pad2(deadline.getHours())}:${pad2(deadline.getMinutes())}`
  const minutesLeft = Math.max(0, Math.round((deadline.getTime() - Date.now()) / 60000))

  console.log(`  ⏰ 招聘那一段必须在本机时间 ${deadlineLabel} 之前做完（还剩 ${minutesLeft} 分钟）`)
  console.log('     一过点 offer 就确认不了（invitationHasExpired）。')
  console.log('     超时了不用慌，重跑一次这个脚本就重置窗口（约 2-3 分钟）。')
  console.log('')
  console.log(`  今天 ${TODAY_KEY} 干活（岗位 ${JOB_START} 开工）｜ 冲突岗位在 ${DAY3_KEY}`)
  console.log('')
  console.log('  账号（密码 111111）：')
  console.log('    Owner     owner@test.com      Sarah Mitchell')
  console.log('    Manager   manager1@test.com   David Lim      已打卡未下班')
  console.log('    Employee  employee1@test.com  Ben Seah       已打卡未下班，班组的主管')
  console.log(`    Guest     ${HERO_EMAIL}     Wei Jie Lim    干净，可现场申请`)
  console.log('')
  console.log('  演示动线（只用 Owner / Guest / Employee 三个角色，不出现 Manager）：')
  console.log('    ① Owner    用模板现场发「第一个工作」，给评委看发布长什么样')
  console.log('    ② Guest    Job Board 上看到刚发的那个，但**去申请另一个**：')
  console.log(`               「${HIRING_JOB_TITLE}」（这个是预置的，已经有人了）`)
  console.log(`    ③ Owner    打开该岗位：要 5 人、已确认 ${crew.length} 人、还差 1 个`)
  console.log('               跑 AI Assessment → 6 人排名 → 录用前 3 名')
  console.log('    ④ Guest    接受 offer → 看到提示 → 重新登录变 Casual Worker')
  console.log('               填 Payment Info → **当场就能 Clock In** → 给 Ben 发消息')
  console.log('    ⑤ Employee Ben 打卡 → 回消息 → AI Assign（候选人 = 班组 + Hero）')
  console.log('               再手动给 Hero 单独派一条')
  console.log('    ⑥ 分屏     Casual Worker 做任务 → Ben 打回重做 → 再通过')
  console.log('    ⑦ Employee 同一页就有 Workload Suggestion + Task Delay Alert（D9 已种好）')
  console.log('    ⑧ Employee 放行下班 → 工人 Clock Out → 那一刻进 Worker Pool')
  console.log('    ⑨ Owner    发下一个工作 → Invite from Pool')
  console.log('')
  console.log('  额外可选：')
  console.log(`    · Guest 申请「${CONFLICT_JOB_TITLE}」→ 被跨公司冲突拦下`)
  console.log(`    · Off Day 与 AI Schedule 都排 ${dateKey(activeWeek)} 那一周`)
  console.log('')
  console.log('  已经替你拆掉的雷：')
  console.log('    · 没有人处于 clocked out 状态 —— 不会有页面变只读')
  console.log(`    · 岗位 ${JOB_START} 开工 —— Clock In 窗口现在就是开的，Hero 确认完立刻能打卡`)
  console.log('    · 班组已在岗但**还没进 Pool** —— 第 6 步「做完一次工就进人才库」是真的当场发生')
  console.log('    · 红点只有招聘岗位一个 —— 现场不会点错')
  console.log('═══════════════════════════════════════════')
}

main().catch(err => {
  console.error('\n✗ 脚本异常:', err.message)
  process.exit(1)
})
