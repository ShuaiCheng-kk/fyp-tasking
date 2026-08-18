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
 *   D2  排班：Ben Seah 今天有班但**故意不打卡** —— 他要在镜头前按 Clock In，那一下正好把
 *       Tasks 页从只读解锁（seed.js 给的历史打卡都带下班时间，页面默认是锁的）。
 *       David Lim 则预先打好卡，万一临时点进 Manager 页面不会撞上只读锁。
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
 *   D8  **重建 Owner 层任务看板**。seed.js 种的几十条任务会把看板塞满，演示时看不出现场
 *       新派的那条落在哪，所以整个清掉重建：每部门 4 条，只占 Assigned / In Progress 两列，
 *       Review 与 Complete 留空。Operations 刻意做成 Wendy 3 条 Urgent、David 1 条 Medium，
 *       AI Assign 必定推荐 David，同时 Workload Suggestion 只在这一个部门触发。
 *   D10 **招聘看板瘦身**。除演示岗位外的 open / pending_approval 岗位全部归档，
 *       Active Jobs 只剩一条、Pending Approval 清空，当天现场发的岗位才会填进去。
 *
 * ## 演示账号（密码统一 111111）
 *
 *   Owner         owner@test.com      Sarah Mitchell
 *   Manager       manager1@test.com   David Lim（Operations，已打卡未下班）
 *   Employee      employee1@test.com  Ben Seah（Operations，班组主管，有班未打卡）
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
const fs = require('fs')
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

// 现场发布的岗位固定打在这一天（PPT 和讲稿里写死的日期）。演示当天重跑脚本时它必须仍在未来，
// 否则 Available Shift 下拉里选不到。换演示日期就改这里。
const POSTING_JOB_DATE = '2026-08-30'

// 跨公司冲突拦截是「额外可选」的演示点，但它会在 Active Jobs 里多挂一个岗位。
// 主动线要求招聘看板只剩演示岗位那一条，所以默认关掉；想演冲突拦截就改成 true。
const INCLUDE_CONFLICT_JOB = false

// Off Day 与 Shift Swap 不在这次的六段动线里，但它们的 pending 申请会点亮 Owner 的 Attendance
// 红点和 Manager 的 Shifts 红点。默认清空，让开场时侧边栏是干净的；要演这两个功能就改成 true。
const INCLUDE_OFFDAY_SWAP_DEMO = false

// D9 会给班组预先派 7 条任务，用来撑起 Employee 页的 Workload Suggestion 和 Task Delay Alert。
// 但那样 Ben 的看板一开场就是满的，而第 4 段要讲的正是「他当场把任务派出去」，预置任务会抢镜。
// 默认关掉，代价见 seedEmployeeSideInsights 里的注释。
const INCLUDE_EMPLOYEE_INSIGHTS = false

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

// seed.js 会把每个人的 profile_photo_url 重置回那张共用的生成头像，所以自定义头像必须在
// 所有补丁跑完之后重新贴一次，否则每跑一次 seed 就白换一次。demo-avatars/ 不存在就静默跳过。
function reapplyDemoAvatars() {
  const avatarDir = path.join(__dirname, '..', 'demo-avatars')
  if (!fs.existsSync(avatarDir)) return
  console.log('')
  const result = spawnSync(process.execPath, [path.join(__dirname, 'set-demo-avatars.js')], {
    stdio: 'inherit',
    env: process.env,
  })
  if (result.status !== 0) console.warn('  ⚠ 补头像失败，跑一次 node scripts/set-demo-avatars.js 看具体报错')
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

    await supabase.from('attendance_records').delete().eq('shift_assignment_id', assignment.id)

    // Ben 和 David 都预先打好卡。
    //
    // Ben 以前是故意留着不打卡、让他在镜头前按 Clock In 的，但演示重心已经移到「Employee 把
    // 任务派给 Casual Worker」，他上工那一下不是要讲的东西；而 Clock In 的窗口只在开班前
    // 30 分钟才开（他的班是 08:00，窗口 07:30 才开），彩排时间一早一晚就按不动，反而挡路。
    // 预先打上卡还顺带解掉只读锁（getClockLockStatus 只看最近一条打卡有没有下班时间）。
    const { error: recErr } = await supabase.from('attendance_records').insert({
      shift_assignment_id: assignment.id,
      user_id: user.id,
      clock_in_time: sgt(TODAY_KEY, '08:00').toISOString(),
      clock_out_time: null,
      break_in_time: null,
      break_out_time: null,
    })
    if (recErr) warn(`${label} 打卡记录写入失败: ${recErr.message}`)
    else ok(`${label} 今天 08:00 已打卡、未下班`)
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

  // 申请记录**全部**删掉，不能只删 pending/accepted。被拒/落选的那些不占时段，但会留在
  // Applications 页的 History 分页里显示成「Not Selected」，开场就有一条失败记录很难看；
  // 而且他对演示岗位的旧申请只要还在（哪怕是 rejected），现场再申请一次的行为就不干净。
  const { data: apps } = await supabase
    .from('job_applicants').select('id').eq('user_id', heroId)
  const appIds = (apps ?? []).map(a => a.id)
  if (appIds.length > 0) {
    await supabase.from('job_invitations').delete().in('applicant_id', appIds)
    await supabase.from('job_applicants').delete().in('id', appIds)
  }
  ok(`清掉 Hero ${appIds.length} 条申请记录（Ongoing 和 History 两个分页都空了）`)

  // Hero 的 worker profile —— 没有这行，Apply 会直接报 "Worker profile not found"。
  //
  // 技能和证书必须**对准演示岗位**。seed.js 给的是仓库口径（Forklift / Inventory / Heavy
  // lifting + Forklift Licence），而演示岗位「Event Crew — Grand Opening」要的是活动布置、
  // 搬运设备、看平面图、引导来宾、抗压、团队配合 —— 两者不搭，AI Assessment 只按技能与岗位
  // 要求的匹配度打分，他就排不到第一，整段演示的高潮就没了。
  // 用 upsert 强制覆盖，重跑也保证是这一份。
  const { error: profErr } = await supabase.from('casual_worker_profiles').upsert({
    user_id: heroId,
    skills: 'Event setup and teardown, Safe lifting and carrying of event equipment, '
      + 'Reading floor plans accurately, Guiding and directing guests, '
      + 'Staying calm under time pressure, Team coordination',
    resume_url: 'https://example.com/demo-resumes/guest1-resume.pdf',
  }, { onConflict: 'user_id' })
  if (profErr) warn(`写 Hero worker profile 失败: ${profErr.message}`)
  else ok('Hero 的技能已对准 Event Crew 岗位要求')

  // 证书同样换掉：仓库的堆高机执照对活动岗位没有说服力，而且 AI 会把「有证书且附了证明文件」
  // 当加分项，所以两张都带 certificate_url。
  await supabase.from('user_certificates').delete().eq('user_id', heroId)
  const { error: certErr } = await supabase.from('user_certificates').insert([
    { user_id: heroId, name: 'Workplace Safety and Health (WSH) Level 1',
      certificate_url: 'https://example.com/demo-certs/wsh-level-1.pdf' },
    { user_id: heroId, name: 'Standard First Aid Certificate',
      certificate_url: 'https://example.com/demo-certs/standard-first-aid.pdf' },
  ])
  if (certErr) warn(`写 Hero 证书失败: ${certErr.message}`)
  else ok('Hero 证书换成 WSH Level 1 + First Aid（都带证明文件）')

  // ── 第二家公司 ──
  // 它唯一的用途是给 Hero 一个「别家公司的既有班」，让跨公司冲突拦截演示有东西可撞。
  // 关掉冲突演示时整段跳过 —— 否则那条班会出现在他的 Casual Worker Dashboard 的
  // Upcoming Jobs 里，变成一份他自己没申请过、也讲不出来历的工作。
  if (!INCLUDE_CONFLICT_JOB) {
    ok('INCLUDE_CONFLICT_JOB = false，跳过第二家公司 → Hero 的 Upcoming Jobs 只有演示岗位')
    return null
  }

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

  // 关掉时整段跳过，Ben 的看板保持全空，他派出去的第一条任务就是现场派的那条。
  // ⚠️ 两个功能会跟着消失：
  //   · Workload Suggestion —— 现场仍然演得出来，连着给同一个人派 2 条以上就会触发
  //   · Task Delay Alert   —— 演不出来。它认的是「已用掉 50% 以上时间还停在 Assigned」，
  //     必须有几小时前就派下去的任务，15 分钟的演示里造不出来
  if (!INCLUDE_EMPLOYEE_INSIGHTS) {
    ok('INCLUDE_EMPLOYEE_INSIGHTS = false，跳过 → Ben 的看板开场为空，两个提示都没有内容')
    return
  }

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

// ─── D8: 重建 Owner 层任务看板 ─────────────────────────────────────────────────
//
// seed.js 给每个部门种了十几到几十条 Owner 派下去的任务，演示时看板密密麻麻，评委看不出
// 「现场新派的那条落在哪」。这里把 Owner/Partner 派下去的任务整个清掉再按计划重建：
//
//   · 每个部门恰好 4 条，全部只落在 Assigned / In Progress 两列
//   · Review 与 Complete 两列留空 —— 演示当天 David 那条是唯一走完
//     Assigned → In Progress → Review → Complete 的任务，动线一眼可见
//   · Operations 刻意做成 Wendy Ho 3 条 Urgent、David Lim 1 条 Medium：
//       AI Assign 推荐的是「最闲的 Manager」，所以必定落在 David 头上
//       Workload Suggestion 要求「最重的人 > 最轻的人 x 2」，12 > 2x2 成立，Operations 会出建议
//   · 其余三个部门刻意做成 2:2 均衡（每人 High + Medium 各一条，同分），不出建议 ——
//     通知栏就只剩 Operations 那一条，不会一片红点
//   · 所有 due_at 都落在 3 天以后：deadlineUrgencyWeight 取 1，且已用时间为 0%，
//     Owner 页的 Task Delay Alert 保持为空（Ben 那边的 D9 不受影响，照常有内容）
//
// 只删 assigned_by ∈ {Owner, Partner} 的任务。Ben 派给班组的那些（D9）是 Employee 层的，
// 不在 Owner 看板上，必须原样保留。

// 空数组 = Owner 的 Tasks 看板开场一条都没有。演示时 Owner 用 AI Assign 派下去的那一条
// 是屏幕上唯一的卡片，从 Assigned 一路走到 Complete，动线完全没有干扰。
//
// ⚠️ 代价：所有 Manager 工作量都是 0 分，rankManagers 只按分数排、没有并列时的次级排序，
// 谁排第一取决于数据库返回行的顺序。实测每次都是 David Lim 在前（他的 manager_departments
// 行先插入，之后没有任何更新去动它），但这是 Postgres 的物理顺序，不是保证。
// 万一现场推荐成了 Wendy Ho，Assignee 是单选下拉，改一下就行。
// 想要百分百确定，就在这里给 Wendy Ho 加一条任务，代价是看板不再是空的。
const OWNER_BOARD_PLAN = []

async function rebuildOwnerTaskBoard(companyId, ownerId, depts) {
  console.log('\nD8: 清空 Owner 层任务看板（现场派下去的那一条是唯一一张卡）...')

  const partner = await getUserByEmail('partner1@test.com', { optional: true })
  const peerTier = [ownerId, partner?.id].filter(Boolean)

  // ── 1. 清掉 Owner/Partner 派下去的所有任务 ──
  // 顺序：先解开 task_assignments，再删子任务，最后删父任务，避免外键阻塞。
  const { data: doomed, error: doomedErr } = await supabase
    .from('tasks').select('id').eq('company_id', companyId).in('assigned_by', peerTier)
  if (doomedErr) { warn(`读取 Owner 层任务失败: ${doomedErr.message}`); return }

  const doomedIds = (doomed ?? []).map(t => t.id)
  if (doomedIds.length > 0) {
    await supabase.from('task_assignments').delete().in('task_id', doomedIds)
    await supabase.from('tasks').delete().in('parent_task_id', doomedIds)
    const { error } = await supabase.from('tasks').delete().in('id', doomedIds)
    if (error) { warn(`清空 Owner 层任务失败: ${error.message}`); return }
    ok(`清掉 ${doomedIds.length} 条 seed.js 派下来的 Owner 层任务`)
  }

  // ── 2. 按计划重建 ──
  let created = 0
  for (const plan of OWNER_BOARD_PLAN) {
    const dept = depts.find(d => d.name === plan.dept)
    if (!dept) { warn(`找不到部门 ${plan.dept}，跳过`); continue }

    const perAssignee = new Map()
    for (const spec of plan.tasks) {
      const assignee = await getUserByEmail(spec.email, { optional: true })
      if (!assignee) { warn(`找不到 ${spec.email}，跳过`); continue }
      const due = addDays(TODAY, spec.dueInDays)
      due.setHours(17, 0, 0, 0)
      const row = await createTask({
        company_id: companyId,
        department_id: dept.id,
        title: spec.title,
        description: 'Seeded for the demo board — kept deliberately small so the live task is easy to spot.',
        assigned_user_id: assignee.id,
        assigned_by: ownerId,
        status: spec.status,
        priority: spec.priority,
        due_at: due.toISOString(),
        // task_date 留空：留空时 Workload Suggestion 不再要求接手人当天有排班，建议一定搬得动。
        task_date: null,
      })
      if (!row) continue
      created++
      perAssignee.set(assignee.full_name, (perAssignee.get(assignee.full_name) ?? 0) + 1)
    }
    const breakdown = [...perAssignee.entries()].map(([name, n]) => `${name} ${n}`).join(' / ')
    ok(`${plan.dept}：${plan.tasks.length} 条（${breakdown}）`)
  }
  ok(`Owner 看板共 ${created} 条任务，Review 与 Complete 两列为空`)
  ok('David Lim 名下 0 条 → Manager 的 Tasks 红点开场为 0，AI Assign 仍必定推荐他（最闲）')
}

// ─── D10: 招聘看板瘦身 ─────────────────────────────────────────────────────────
//
// seed.js 会种十来个 open 岗位和 2 个 pending_approval 岗位。演示时 Active Jobs 排成一长列、
// Pending Approval 还挂着红点，评委分不清哪个是我们在讲的。这里把演示岗位以外的全部归档：
//   · Active Jobs 只剩预置的那一个（AI Assessment 用）
//   · Pending Approval 清空 —— 当天 Manager 现场发的那条才会出现在里面，红点是现场产生的
// 归档而不是删除：这些岗位挂着申请人、邀请和班次，直接删会被外键挡住。
async function pruneJobBoard(companyId, keepTitles, ownerId) {
  console.log('\nD10: 招聘页清空（只留演示岗位，Create Job 页四个分区全空）...')

  // 归档过一次就够了 —— 归档只是换个状态，岗位仍然挂在 Create Job 页的 Archived 分区里，
  // 一长列跟演示无关的历史岗位。这里改成**彻底删除**，四个分区（Pending Approval / Drafts /
  // Archived / Templates）开场全是空的，现场发出去的那一个才是页面上唯一的东西。
  const { data: postings, error } = await supabase
    .from('job_postings').select('id, title, status').eq('company_id', companyId)
  if (error) { warn(`读取 job_postings 失败: ${error.message}`); return }

  // closed 的也一起删。它们在 Closed Jobs 那个 Tab 里堆了十几条历史岗位，同样是跟演示
  // 无关的噪音。⚠️ 代价：Report 页的招聘相关图表（录用成功率、平均填补时长）会因此没有数据，
  // 那些指标是从 closed / archived 岗位算出来的。六段动线不经过 Report，所以按干净优先处理。
  const doomed = (postings ?? []).filter(p => !keepTitles.includes(p.title))

  if (doomed.length > 0) {
    const ids = doomed.map(p => p.id)

    // 外键顺序：邀请 → 申请 → 取消记录 → 岗位本身。
    // shifts.source_job_posting_id 只是溯源用的引用，置空即可，不能连班次一起删。
    await supabase.from('shifts').update({ source_job_posting_id: null }).in('source_job_posting_id', ids)
    const { data: apps } = await supabase.from('job_applicants').select('id').in('job_id', ids)
    const appIds = (apps ?? []).map(a => a.id)
    if (appIds.length > 0) await supabase.from('job_invitations').delete().in('applicant_id', appIds)
    await supabase.from('job_invitations').delete().in('job_id', ids)
    await supabase.from('job_applicants').delete().in('job_id', ids)
    await supabase.from('job_cancellations').delete().in('job_id', ids)

    const { error: delErr } = await supabase.from('job_postings').delete().in('id', ids)
    if (delErr) { warn(`删除岗位失败: ${delErr.message}`); return }

    const byStatus = {}
    for (const p of doomed) byStatus[p.status] = (byStatus[p.status] ?? 0) + 1
    ok(`删掉 ${doomed.length} 个岗位（${Object.entries(byStatus).map(([s, n]) => `${s} ${n}`).join('、')}）`)
  }

  // Owner 自己的 Job Template 也清掉：新动线里发岗位的是 Manager，用的是他自己的模板，
  // Owner 根本不会打开模板列表。David 的那一个是 Manager 建的，不在这里删的范围内
  // （Job Template 的可见范围本来就是 Owner/Partner 一池、Manager 一池，互不相见）。
  if (ownerId) {
    const { data: tpl } = await supabase
      .from('job_templates').select('id, title').eq('company_id', companyId).eq('created_by', ownerId)
    if ((tpl ?? []).length > 0) {
      const { error: tErr } = await supabase.from('job_templates').delete().in('id', tpl.map(t => t.id))
      if (tErr) warn(`删除 Owner 模板失败: ${tErr.message}`)
      else ok(`删掉 Owner 名下 ${tpl.length} 个 Job Template（David 的那个保留）`)
    }
  }

  ok(`Active Jobs 只剩：${keepTitles.join('、')}；Pending Approval / Drafts / Archived / Templates 全空`)
}

// ─── D11: David Lim 的 Job Template 对齐 Owner 派下来的任务 ────────────────────
//
// 第 1 段里 David 是「拿到 Owner 的任务 → 用模板发 One-Off 岗位」。seed.js 给他的模板叫
// 「Café Cover Staff」，跟任务标题（30 Aug 仓库临时班组）完全不搭，评委会觉得他随手点了
// 一个不相干的模板。这里把它改成同一件事的模板。
//
// 只需要改这一个：Job Template 的可见范围比 Task Template 更严 —— Manager 只看得到
// 「挂在自己部门 且 由 Manager 创建」的模板（见 jobTemplateRepository.getTemplatesByCompany），
// 所以 Owner 那两个模板对 David 是隐形的，他的列表里就这一条，不会点错。
const MANAGER_TEMPLATE = {
  title: 'Warehouse Stock Count Crew',
  responsibilities: 'Count and record stock across the warehouse racks, flag damaged or mislabelled cartons, '
    + 'and repack the counted pallets before the floor reopens.',
  skills: 'Able to lift up to 15kg, comfortable reading pick lists and entering counts on a handheld scanner.',
  job_type: 'oneoff',
  // One-Off 的薪资是**整单固定价**不是时薪，写 15 会被误读成 $15/hr。给 120，
  // 和预置的 Event Crew 岗位（$120 flat rate）同一个量级，Flat Rate 这件事一眼看得出来。
  salary_amount: 120,
  uniform_type: 'none',
  experience_required: 'Not Required',
  minimum_age: 18,
  estimated_hours: '6',
  urgency: 'normal',
}

async function alignManagerJobTemplate(companyId, managerId, opsDeptId) {
  console.log('\nD11: 把 David Lim 的 Job Template 对齐到「30 Aug 仓库临时班组」...')

  const { data: existing, error } = await supabase
    .from('job_templates').select('id, title').eq('company_id', companyId).eq('created_by', managerId)
  if (error) { warn(`读取 job_templates 失败: ${error.message}`); return }

  const payload = { ...MANAGER_TEMPLATE, company_id: companyId, created_by: managerId, department_id: opsDeptId }

  if ((existing ?? []).length > 0) {
    // 多于一条时只留第一条，其余删掉 —— 演示时下拉里只该有一个选项。
    const [keep, ...extras] = existing
    const { error: updErr } = await supabase.from('job_templates').update(payload).eq('id', keep.id)
    if (updErr) { warn(`更新模板失败: ${updErr.message}`); return }
    ok(`「${keep.title}」→「${MANAGER_TEMPLATE.title}」（Operations，One-Off）`)
    if (extras.length > 0) {
      await supabase.from('job_templates').delete().in('id', extras.map(t => t.id))
      ok(`删掉 David 名下多余的 ${extras.length} 个模板，下拉里只剩一个选项`)
    }
  } else {
    const { error: insErr } = await supabase.from('job_templates').insert(payload)
    if (insErr) { warn(`创建模板失败: ${insErr.message}`); return }
    ok(`新建模板「${MANAGER_TEMPLATE.title}」（Operations，One-Off）`)
  }
}

// ─── D19: 今天只让演示会讲到的部门有内部员工上班 ───────────────────────────────
//
// Owner Dashboard 的 Internal Attendance 面板按「今天有班的 Manager / Employee」分部门统计。
// seed.js 四个部门都排了班，于是面板上四张卡，其中三张跟演示无关，而且因为那些人不会打卡，
// 显示出来全是 0/4、0/3 这种数字，看起来像大面积缺勤。
//
// 只保留演示会讲到的两个部门，其余部门今天的内部排班整段删掉。
// 不动部门本身，只动今天的班次 —— 删部门会连带管理层、成员归属、历史数据一起塌。
const ATTENDANCE_DEPARTMENTS = ['Operations', 'Marketing']

async function trimInternalAttendanceToday(companyId) {
  console.log('\nD19: 今天只留演示部门的内部排班...')

  const { data: depts } = await supabase
    .from('departments').select('id, name').eq('company_id', companyId)
  const doomedDeptIds = (depts ?? [])
    .filter(d => !ATTENDANCE_DEPARTMENTS.includes(d.name))
    .map(d => d.id)
  if (doomedDeptIds.length === 0) { ok('没有多余部门'); return }

  const { data: rows, error } = await supabase
    .from('shift_assignments')
    .select('id, shift_id, user_id, shifts!inner(shift_date, company_id, department_id)')
    .eq('shifts.company_id', companyId)
    .eq('shifts.shift_date', TODAY_KEY)
    .in('shifts.department_id', doomedDeptIds)
  if (error) { warn(`读取今天的排班失败: ${error.message}`); return }
  if ((rows ?? []).length === 0) { ok('这些部门今天本来就没有排班'); return }

  // 只删内部员工（Manager / Employee）。临时工由 D18 按班组规则处理，两边不重叠。
  const userIds = [...new Set(rows.map(r => r.user_id))]
  const { data: people } = await supabase.from('users').select('id, role').in('id', userIds)
  const internalIds = new Set((people ?? []).filter(p => p.role === 'Manager' || p.role === 'Employee').map(p => p.id))
  const doomed = rows.filter(r => internalIds.has(r.user_id))
  if (doomed.length === 0) { ok('这些部门今天没有内部员工排班'); return }

  const assignmentIds = doomed.map(r => r.id)
  const shiftIds = [...new Set(doomed.map(r => r.shift_id))]

  await supabase.from('attendance_records').delete().in('shift_assignment_id', assignmentIds)
  const { data: shiftTasks } = await supabase.from('tasks').select('id').in('shift_id', shiftIds)
  const taskIds = (shiftTasks ?? []).map(t => t.id)
  if (taskIds.length > 0) {
    await supabase.from('task_assignments').delete().in('task_id', taskIds)
    await supabase.from('tasks').delete().in('parent_task_id', taskIds)
    await supabase.from('tasks').delete().in('id', taskIds)
  }
  await supabase.from('shift_assignments').delete().in('id', assignmentIds)

  const { data: survivors } = await supabase
    .from('shift_assignments').select('shift_id').in('shift_id', shiftIds)
  const stillUsed = new Set((survivors ?? []).map(r => r.shift_id))
  const emptyIds = shiftIds.filter(id => !stillUsed.has(id))
  if (emptyIds.length > 0) await supabase.from('shifts').delete().in('id', emptyIds)

  ok(`清掉 ${doomed.length} 条排班，Internal Attendance 现在只剩 ${ATTENDANCE_DEPARTMENTS.join(' 和 ')}`)
}

// ─── D18: 清掉今天不属于演示班组的 Casual Worker 排班 ──────────────────────────
//
// seed.js 会给别的部门的临时工也排今天的班（比如 Marketing 的 Farah Aziz），他们既不打卡
// 也跟演示无关，但会出现在 Owner Dashboard 的 Casual Worker Attendance 面板里，占掉一格、
// 还会因为没打卡显示成迟到或缺勤。删掉之后那个面板就只剩演示班组，每一个人评委都知道是谁。
//
// 班组本人不动：他们今天在岗是 D5 刻意种的，岗位 5 个名额已确认 4 个靠的就是他们。
// 过去日期的班次也不动 —— Worker Pool 的「完成过几个班」是从那些历史打卡记录数出来的。
async function pruneNonCrewCasualShiftsToday(companyId, crew) {
  console.log('\nD18: 清掉今天不属于演示班组的 Casual Worker 排班...')

  const crewIds = new Set(crew.map(c => c.id))

  // shift_assignments 有三个外键指向 users（user_id / assigned_by / supervisor_employee_id），
  // 直接 join 会因为关系不唯一而报错，所以角色单独查一次再自己对起来。
  const { data: rows, error } = await supabase
    .from('shift_assignments')
    .select('id, shift_id, user_id, shifts!inner(shift_date, company_id)')
    .eq('shifts.company_id', companyId)
    .eq('shifts.shift_date', TODAY_KEY)
  if (error) { warn(`读取今天的排班失败: ${error.message}`); return }

  const userIds = [...new Set((rows ?? []).map(r => r.user_id))]
  if (userIds.length === 0) { ok('今天没有排班'); return }
  const { data: people } = await supabase
    .from('users').select('id, full_name, role').in('id', userIds)
  const byId = new Map((people ?? []).map(p => [p.id, p]))

  const doomed = (rows ?? []).filter(r => {
    const person = byId.get(r.user_id)
    return person?.role === 'Casual Worker' && !crewIds.has(r.user_id)
  })
  if (doomed.length === 0) { ok('今天在岗的 Casual Worker 就是演示班组，没有杂数据'); return }

  const assignmentIds = doomed.map(r => r.id)
  const shiftIds = [...new Set(doomed.map(r => r.shift_id))]

  await supabase.from('attendance_records').delete().in('shift_assignment_id', assignmentIds)
  const { data: shiftTasks } = await supabase.from('tasks').select('id').in('shift_id', shiftIds)
  const taskIds = (shiftTasks ?? []).map(t => t.id)
  if (taskIds.length > 0) {
    await supabase.from('task_assignments').delete().in('task_id', taskIds)
    await supabase.from('tasks').delete().in('parent_task_id', taskIds)
    await supabase.from('tasks').delete().in('id', taskIds)
  }
  await supabase.from('shift_assignments').delete().in('id', assignmentIds)

  // 一个班次可能还挂着别人，只删已经没人的那些。
  const { data: survivors } = await supabase
    .from('shift_assignments').select('shift_id').in('shift_id', shiftIds)
  const stillUsed = new Set((survivors ?? []).map(r => r.shift_id))
  const emptyIds = shiftIds.filter(id => !stillUsed.has(id))
  if (emptyIds.length > 0) await supabase.from('shifts').delete().in('id', emptyIds)

  const names = [...new Set(doomed.map(r => byId.get(r.user_id)?.full_name ?? r.user_id))]
  ok(`清掉 ${names.join('、')} 今天的班`)
  ok('Owner Dashboard 的 Casual Worker Attendance 现在只剩演示班组')
}

// ─── D17: 清掉 Ben 派给「今天不归他带」的人的任务 ──────────────────────────────
//
// seed.js 会让 Ben 给 Nadia Osman 这类工人派活，但 Employee 的看板只能从「我今天带的班组」
// 里解析负责人姓名（一人一天一个主管的配对关系），解析不到就渲染成 "No assignee" ——
// 卡片上明明有任务却写着没人负责，看起来像脏数据。
//
// 这些任务本身是有 assigned_user_id 的，不是空指针，所以按「负责人是否在今天的班组里」清，
// 不能按 assigned_user_id 为空清。D9 派给班组的那些（Delay Alert / Workload Suggestion 用）
// 负责人都在班组里，不受影响。
async function pruneOrphanCrewTasks(companyId, benId, crew) {
  console.log('\nD17: 清掉 Ben 派给「今天不归他带」的人的任务...')

  const crewIds = new Set(crew.map(c => c.id))
  const { data: tasks, error } = await supabase
    .from('tasks').select('id, title, assigned_user_id')
    .eq('company_id', companyId).eq('assigned_by', benId)
  if (error) { warn(`读取 Ben 派出的任务失败: ${error.message}`); return }

  const orphans = (tasks ?? []).filter(t => !t.assigned_user_id || !crewIds.has(t.assigned_user_id))
  if (orphans.length === 0) { ok('没有孤儿任务，看板是干净的'); return }

  const ids = orphans.map(t => t.id)
  await supabase.from('task_assignments').delete().in('task_id', ids)
  await supabase.from('tasks').delete().in('parent_task_id', ids)
  const { error: delErr } = await supabase.from('tasks').delete().in('id', ids)
  if (delErr) { warn(`清理失败: ${delErr.message}`); return }
  ok(`清掉 ${orphans.length} 条：${orphans.map(t => t.title).join('、')}`)
  ok('Ben 的看板上每一条任务的负责人现在都解析得出姓名')
}

// ─── D16: 预写陪跑申请人的 AI 评估缓存 ─────────────────────────────────────────
//
// candidateRecommendationService 有缓存：申请人只要 ai_computed_at 和 ai_summary 都有值，
// 就直接读缓存不再调 LLM（前端从不传 refresh=true，所以缓存永远命中）。
// 先把陪跑的几位写好，现场点 AI Assessment 时**只有 Hero 一个人真的走 LLM**：
//
//   · 快 —— 一个人的 structured output 比六个人快得多，镜头前不用干等
//   · 稳 —— 陪跑分数完全确定，Hero 只要匹配度够就必然排第一，不看模型当天心情
//   · 诚实 —— 这就是产品的真实行为：这几位几天前申请时就评过了，系统缓存结果，
//     点一次只评新进来的申请人。被问到照实说即可。
//
// 分数刻意压在 34-58：Hero 的技能几乎是岗位要求的逐条对应，加两张带附件的证书和一份简历，
// 现场评下来通常 80 以上，差距拉得开。
const CHAPERONE_ASSESSMENTS = {
  'Ryan Teo': { score: 42, recommendation: 'weak',
    reasons: ['Hands-on troubleshooting background shows he is comfortable working to a checklist.'],
    risks: ['Experience is IT support, not event floor work.', 'No evidence of lifting or crowd-facing duties.'],
    suggested_next_step: 'Keep on file for technical support roles rather than event crew.' },
  'Amirah Yusof': { score: 55, recommendation: 'review',
    reasons: ['Retail and promo work means she is used to being on her feet in front of customers.'],
    risks: ['Merchandising is not the same as event setup and teardown.', 'No stated experience carrying event equipment.'],
    suggested_next_step: 'Worth a short call about physical setup duties before deciding.' },
  'Priyanka Das': { score: 34, recommendation: 'weak',
    reasons: ['Customer service background suggests she can handle guest questions.'],
    risks: ['Profile is social media and copywriting, with nothing on venue or event operations.'],
    suggested_next_step: 'Better suited to a marketing support posting.' },
  'Kai Xuan Ong': { score: 48, recommendation: 'review',
    reasons: ['Has worked shifts before and lists general helper duties.'],
    risks: ['No specific event setup, floor plan, or equipment handling experience listed.'],
    suggested_next_step: 'Ask what kind of shifts were previously worked.' },
  'Nadia Osman': { score: 51, recommendation: 'review',
    reasons: ['Previously completed shifts with this company, so reliability is already known.'],
    risks: ['Past work was warehouse-side, not front-of-house event support.'],
    suggested_next_step: 'Consider for stock-side roles where her past work applies directly.' },
}

const DEFAULT_CHAPERONE_ASSESSMENT = { score: 45, recommendation: 'review',
  reasons: ['Profile is complete but does not line up with this posting.'],
  risks: ['No event setup, floor plan, or equipment handling experience listed.'],
  suggested_next_step: 'Keep on file for a posting closer to their background.' }

async function seedChaperoneAssessments(jobTitle) {
  console.log('\nD16: 预写陪跑申请人的 AI 评估缓存（现场只评 Hero 一个人）...')

  const { data: job } = await supabase
    .from('job_postings').select('id').eq('title', jobTitle).maybeSingle()
  if (!job) { warn(`找不到岗位「${jobTitle}」`); return }

  // job_applicants 没有 full_name 列，姓名是 join users 来的（见 recruitmentRepository）。
  const { data: applicants } = await supabase
    .from('job_applicants').select('id, user_id').eq('job_id', job.id).eq('status', 'pending')
  if (!applicants || applicants.length === 0) { warn('这个岗位没有待处理申请人'); return }

  const { data: people } = await supabase
    .from('users').select('id, full_name').in('id', applicants.map(a => a.user_id))
  const nameById = new Map((people ?? []).map(p => [p.id, p.full_name]))

  const now = new Date().toISOString()
  const written = []
  for (const applicant of applicants) {
    const fullName = nameById.get(applicant.user_id) ?? ''
    const preset = CHAPERONE_ASSESSMENTS[fullName] ?? DEFAULT_CHAPERONE_ASSESSMENT
    const payload = {
      applicant_id: applicant.id,
      applicant_name: fullName,
      ...preset,
    }
    const { error } = await supabase
      .from('job_applicants')
      .update({ ai_summary: JSON.stringify(payload), ai_computed_at: now })
      .eq('id', applicant.id)
    if (error) { warn(`写 ${fullName} 的评估缓存失败: ${error.message}`); continue }
    written.push(`${fullName} ${preset.score}`)
  }
  ok(`已缓存 ${written.length} 人：${written.join(' / ')}`)
  ok('现场 Hero 申请后点 AI Assessment，只有他会真的调 LLM，其余读缓存')
}

// ─── D15: 重建 Operations 的 Team Tasks（Manager → Employee 那一层）────────────
//
// D8 清的是 Owner 派下去的任务，Manager 的 Team Tasks 是另一层：Manager 派给 Employee 的。
// seed.js 在 Operations 里塞了 30 多条，其中三样东西会点亮 David 的 Tasks 红点：
//
//   · Review 列里有 3 条 —— waiting_on_you 的 task_review 直接计入 tasks 红点
//   · 好几条已超期还停在 Assigned —— Task Delay Alert 有内容
//   · Ben 8 条 vs Grace 5 条 —— Workload Suggestion 成立
//
// 整层清掉重建成 2:2 均衡、无 Review、无超期，三个来源一次性归零。
// 只删 assigned_by 是 David / Wendy 的：Ben 派给班组 Casual Worker 的（D9）是再下一层，
// 演示第 4、5 段要用，必须原样保留。
// 空数组 = David 的 Team Tasks 看板开场也是空的，跟 Owner 那块一个思路：演示时他从 Owner
// 那里收到的任务是屏幕上唯一一张卡。Ben Seah 的 My Tasks 因此同样是空的，第 4、5 段讲的是
// 「Employee 把任务派给 Casual Worker」，上级派给他的任务只会抢镜。
//
// 三个红点来源同时归零：Review 列没有内容（task_review = 0）、没有超期任务（Delay Alert = 0）、
// 所有 Employee 都是 0 分（Workload Suggestion 要求最重的人至少 2 条主任务才成立）。
const TEAM_TASK_PLAN = []

async function rebuildTeamTaskBoard(companyId, opsDeptId, managerIds, assignerId) {
  console.log('\nD15: 清空 Operations 的 Team Tasks（David 和 Ben 的看板都留给现场）...')

  const { data: doomed, error } = await supabase
    .from('tasks').select('id')
    .eq('company_id', companyId).eq('department_id', opsDeptId).in('assigned_by', managerIds)
  if (error) { warn(`读取 Team Tasks 失败: ${error.message}`); return }

  const doomedIds = (doomed ?? []).map(t => t.id)
  if (doomedIds.length > 0) {
    await supabase.from('task_assignments').delete().in('task_id', doomedIds)
    await supabase.from('tasks').delete().in('parent_task_id', doomedIds)
    const { error: delErr } = await supabase.from('tasks').delete().in('id', doomedIds)
    if (delErr) { warn(`清空 Team Tasks 失败: ${delErr.message}`); return }
    ok(`清掉 ${doomedIds.length} 条 seed.js 的 Manager 层任务`)
  }

  const perAssignee = new Map()
  for (const spec of TEAM_TASK_PLAN) {
    const assignee = await getUserByEmail(spec.email, { optional: true })
    if (!assignee) { warn(`找不到 ${spec.email}，跳过`); continue }
    const due = addDays(TODAY, spec.dueInDays)
    due.setHours(17, 0, 0, 0)
    const row = await createTask({
      company_id: companyId, department_id: opsDeptId, title: spec.title,
      description: 'Seeded for the demo board: balanced across the two employees and not overdue, so no alert fires.',
      assigned_user_id: assignee.id, assigned_by: assignerId,
      status: spec.status, priority: spec.priority,
      due_at: due.toISOString(), task_date: null,
    })
    if (!row) continue
    perAssignee.set(assignee.full_name, (perAssignee.get(assignee.full_name) ?? 0) + 1)
  }
  if (TEAM_TASK_PLAN.length === 0) ok('不重建任何任务，看板留空')
  else ok(`重建 ${TEAM_TASK_PLAN.length} 条（${[...perAssignee.entries()].map(([n, c]) => `${n} ${c}`).join(' / ')}）`)
  ok('David 的 Team Tasks 与 Ben 的 My Tasks 都为空 → 两边的 Tasks 红点都是 0')
}

// ─── D13: 预置招聘岗位改挂在 David Lim 名下 ────────────────────────────────────
//
// seed.js 是用 Owner 的身份发这个岗位的，所以详情页写「Posted by Sarah Mitchell」，
// 而 assertCanManageApplicants 对 Manager 的要求是 created_by === 自己 —— David 打开它
// 只能看，不能录用，AI Assessment 那一步就走不下去。改成他自己发的。
async function handHiringJobToManager(companyId, managerId) {
  console.log('\nD13: 把预置招聘岗位改挂到 David Lim 名下...')
  const { data, error } = await supabase
    .from('job_postings')
    .update({ created_by: managerId })
    .eq('company_id', companyId).eq('title', HIRING_JOB_TITLE)
    .select('id')
  if (error) { warn(`改岗位归属失败: ${error.message}`); return }
  if (!data || data.length === 0) { warn(`找不到岗位「${HIRING_JOB_TITLE}」`); return }
  ok(`「${HIRING_JOB_TITLE}」现在由 David Lim 管理，AI Assessment / 录用都做得了`)
}

// ─── D14: 侧边栏红点清零 ───────────────────────────────────────────────────────
//
// 演示开场时 Manager 侧边栏应该一个红点都没有 —— Owner 派下任务那一刻亮起的第一个红点，
// 才说明「系统会主动通知你」。seed.js 留下的历史私信、公告和待处理请求会让四个红点全亮，
// 把这条叙事毁掉。这里按红点的三个来源逐个清：
//
//   Communication 红点 = 未读私信 + 未读公告（别人发的）
//   Attendance / Shifts 红点 = pending 的换班申请 + pending 的 Fixed Day Off 申请
//   Tasks 红点 = Workload 建议 + Delay 提醒 + 未读 My Task（见 OWNER_BOARD_PLAN 的注释）
//
// Tasks 那一路已经在 D8 的排布里解决了，这里只处理前两路。
async function clearNotificationDots(companyId, watchers) {
  console.log('\nD14: 侧边栏红点清零（Communication / Attendance）...')

  // ── 私信：发给这些人的全部标记已读 ──
  const { error: msgErr } = await supabase
    .from('messages').update({ is_read: true })
    .eq('company_id', companyId).in('to_user_id', watchers).eq('is_read', false)
  if (msgErr) warn(`标记私信已读失败: ${msgErr.message}`)
  else ok(`发给这 ${watchers.length} 个演示账号的历史私信全部标记已读`)

  // ── 公告：别人发的都补一条 announcement_reads ──
  const { data: anns } = await supabase
    .from('announcements').select('id, user_id').eq('company_id', companyId)
  const rows = []
  for (const watcher of watchers) {
    for (const ann of anns ?? []) {
      if (ann.user_id === watcher) continue // 自己发的本来就不算未读
      rows.push({ user_id: watcher, announcement_id: ann.id })
    }
  }
  if (rows.length > 0) {
    const { error: annErr } = await supabase
      .from('announcement_reads').upsert(rows, { onConflict: 'user_id,announcement_id', ignoreDuplicates: true })
    if (annErr) warn(`标记公告已读失败: ${annErr.message}`)
    else ok(`补了 ${rows.length} 条公告已读记录`)
  }

  // ── 换班 / Fixed Day Off：pending 的全删 ──
  // Owner 的 Attendance 红点数 = 全公司 pending 的换班 + off day；Manager 的 Shifts 红点还多算
  // 「自己已被决定但没看过的申请」，所以已决定的那些也一起清掉，否则红点靠 localStorage 才消得掉。
  if (!INCLUDE_OFFDAY_SWAP_DEMO) {
    const { error: swapErr } = await supabase
      .from('shift_swap_requests').delete().eq('company_id', companyId)
    if (swapErr) warn(`清空换班申请失败: ${swapErr.message}`)
    const { error: offErr } = await supabase
      .from('off_day_requests').delete().eq('company_id', companyId).eq('source', 'submitted')
    if (offErr) warn(`清空 Fixed Day Off 申请失败: ${offErr.message}`)

    // 光删申请还不够。Manager 的 off_day_deadline 计数是「他自己这周还没提交 → 记 1 分」
    // （ownerDashboardService: hasSubmitted ? 0 : 1），删干净反而让它永远是 1，Shifts 红点不灭。
    // 整个提醒块由 `if (deadline)` 守着，所以把提交截止时间那一行也删掉，块直接不进。
    const { error: dlErr } = await supabase
      .from('off_day_submission_deadline').delete().eq('company_id', companyId)
    if (dlErr) warn(`清空 off day 提交截止设置失败: ${dlErr.message}`)

    ok('换班、Fixed Day Off 申请与提交截止设置已清空 → Owner 的 Attendance、Manager 的 Shifts 红点归零')
  } else {
    warn('INCLUDE_OFFDAY_SWAP_DEMO = true，保留换班/off day 数据，Attendance 红点会亮')
  }
}

// ─── D12: 收窄 Apply Template 的 Available Shift 下拉 ──────────────────────────
//
// 那个下拉不是招聘模块自己的数据：loadDeptShiftOptions 打的是
// /api/shifts/department-employees，列出「本部门 Employee 未来还有班的每一个日期」。
// seed.js 给 Ben Seah 和 Grace Lim 排了两周多的班，于是下拉里十几个日期，David 要在里面
// 翻找 30 Aug，镜头上很难看。
//
// 这里把 Operations 的 Employee 未来班次收窄到只剩两天：
//   · 今天      —— 预置招聘岗位就在今天，Ben 是它的主管，这条不能动
//   · 30 Aug    —— 现场发布的岗位要挂在这天，没有班次这个日期根本不会出现在下拉里
// 其余日期整段删掉。删的是 Operations Employee 的班，Manager（David 今天的打卡）、
// 班组 Casual Worker、其他三个部门都不碰。
//
// 副作用（是好事）：24 Aug 那一周的 Operations 变空，AI Schedule 演示正好排进一个干净的周。
async function trimAvailableShiftDates(companyId, opsDeptId, benId) {
  console.log('\nD12: 收窄 Available Shift 下拉（只留今天和现场发布日）...')

  const keepDates = new Set([TODAY_KEY, POSTING_JOB_DATE])

  // 前端那个下拉过滤用的是 UTC 日期（loadDeptShiftOptions 里的 toISOString().slice(0,10)），
  // 而 TODAY_KEY 是新加坡日期。上午跑脚本时两者相同，但半夜（SGT 已跨天、UTC 还没跨）跑，
  // 会多漏出「SGT 昨天」那一条。从两者较早的那天开始清，半夜跑也干净，白天跑则是空操作。
  const utcTodayKey = new Date().toISOString().slice(0, 10)
  const floorDate = utcTodayKey < TODAY_KEY ? utcTodayKey : TODAY_KEY

  const { data: memberships, error: mErr } = await supabase
    .from('employee_departments').select('employee_id').eq('department_id', opsDeptId)
  if (mErr) { warn(`读取 Operations Employee 失败: ${mErr.message}`); return }
  const employeeIds = (memberships ?? []).map(m => m.employee_id)
  if (employeeIds.length === 0) { warn('Operations 没有 Employee，跳过'); return }

  const { data: rows, error: aErr } = await supabase
    .from('shift_assignments')
    .select('id, shift_id, user_id, shifts!inner(id, shift_date)')
    .in('user_id', employeeIds)
    .gte('shifts.shift_date', floorDate)
  if (aErr) { warn(`读取未来班次失败: ${aErr.message}`); return }

  const doomed = (rows ?? []).filter(r => !keepDates.has(r.shifts.shift_date))
  if (doomed.length > 0) {
    const assignmentIds = doomed.map(r => r.id)
    const shiftIds = [...new Set(doomed.map(r => r.shift_id))]

    await supabase.from('attendance_records').delete().in('shift_assignment_id', assignmentIds)

    // 挂在这些班次上的任务要先清掉，否则 shifts 删不动（tasks.shift_id 外键）。
    const { data: shiftTasks } = await supabase.from('tasks').select('id').in('shift_id', shiftIds)
    const taskIds = (shiftTasks ?? []).map(t => t.id)
    if (taskIds.length > 0) {
      await supabase.from('task_assignments').delete().in('task_id', taskIds)
      await supabase.from('tasks').delete().in('parent_task_id', taskIds)
      await supabase.from('tasks').delete().in('id', taskIds)
    }

    await supabase.from('shift_assignments').delete().in('id', assignmentIds)

    // 一个班次可能还挂着别人（Manager / Casual Worker），只删已经没人的那些。
    const { data: survivors } = await supabase
      .from('shift_assignments').select('shift_id').in('shift_id', shiftIds)
    const stillUsed = new Set((survivors ?? []).map(r => r.shift_id))
    const emptyShiftIds = shiftIds.filter(id => !stillUsed.has(id))
    if (emptyShiftIds.length > 0) {
      const { error: sErr } = await supabase.from('shifts').delete().in('id', emptyShiftIds)
      if (sErr) warn(`删除空班次失败: ${sErr.message}`)
    }
    const removedDates = [...new Set(doomed.map(r => r.shifts.shift_date))].length
    ok(`删掉 ${removedDates} 个日期、${doomed.length} 条 Operations Employee 排班`)
  }

  // 发布日必须有班，否则它不会出现在 Available Shift 下拉里。没有就给 Ben 补一条。
  const { data: onPostingDay } = await supabase
    .from('shift_assignments')
    .select('id, shifts!inner(shift_date)')
    .in('user_id', employeeIds)
    .eq('shifts.shift_date', POSTING_JOB_DATE)
  if ((onPostingDay ?? []).length === 0) {
    const shift = await createShift({
      company_id: companyId, department_id: opsDeptId, shift_date: POSTING_JOB_DATE,
      start_time: '09:00', end_time: '17:00', is_open_ended: false,
      created_by: benId, publication_status: 'published',
    })
    await assignShift(shift?.id, benId, benId)
    ok(`${POSTING_JOB_DATE} 原本没班，给 Ben Seah 补了一条 09:00-17:00`)
  }

  if (POSTING_JOB_DATE <= TODAY_KEY) {
    warn(`POSTING_JOB_DATE (${POSTING_JOB_DATE}) 不在未来了，Available Shift 下拉会选不到它 —— 改脚本顶部那个常量`)
  }
  ok(`Available Shift 下拉现在只有：${TODAY_KEY}（今天）、${POSTING_JOB_DATE}（现场发布用）`)
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
  if (INCLUDE_CONFLICT_JOB) await seedConflictJob(company.id, owner.id, opsDept.id)
  await seedWorkerPool(company.id, owner.id, opsDept.id, employee1.id)
  await seedEmployeeSideInsights(company.id, employee1.id, opsDept.id, crew)
  await rebuildOwnerTaskBoard(company.id, owner.id, depts)
  await alignManagerJobTemplate(company.id, manager1.id, opsDept.id)
  // 放在 D5/D6 之后：它们会给今天和冲突日建班，收窄必须在那之后跑才不会误删。
  await trimAvailableShiftDates(company.id, opsDept.id, employee1.id)
  await handHiringJobToManager(company.id, manager1.id)
  const manager5 = await getUserByEmail('manager5@test.com', { optional: true })
  await rebuildTeamTaskBoard(company.id, opsDept.id, [manager1.id, manager5?.id].filter(Boolean), manager1.id)
  await trimInternalAttendanceToday(company.id)
  await pruneNonCrewCasualShiftsToday(company.id, crew)
  await pruneOrphanCrewTasks(company.id, employee1.id, crew)
  await seedChaperoneAssessments(HIRING_JOB_TITLE)
  // 最后跑：前面每一步都可能新建公告/申请，红点清零必须垫底。
  await clearNotificationDots(company.id, [owner.id, manager1.id, employee1.id])
  // 放在最后：前面几步自己会建岗位，瘦身必须在它们之后跑，否则刚建的又被算成多余的。
  await pruneJobBoard(company.id, [
    HIRING_JOB_TITLE,
    ...(INCLUDE_CONFLICT_JOB ? [CONFLICT_JOB_TITLE] : []),
  ], owner.id)

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
  console.log(`  今天 ${TODAY_KEY} 干活（岗位 ${JOB_START} 开工）`
    + (INCLUDE_CONFLICT_JOB ? `｜ 冲突岗位在 ${DAY3_KEY}` : ''))
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
  if (INCLUDE_CONFLICT_JOB) {
    console.log(`    · Guest 申请「${CONFLICT_JOB_TITLE}」→ 被跨公司冲突拦下`)
  } else {
    console.log('    · 跨公司冲突拦截已关闭（INCLUDE_CONFLICT_JOB = false），')
    console.log('      开着会让 Active Jobs 多挂一个岗位；要演就把那个常量改成 true')
  }
  console.log(`    · Off Day 与 AI Schedule 都排 ${dateKey(activeWeek)} 那一周`)
  console.log('')
  console.log('  已经替你拆掉的雷：')
  console.log('    · 没有人处于 clocked out 状态；Ben 一按 Clock In，Tasks 页立刻可写')
  console.log(`    · 岗位 ${JOB_START} 开工 —— Clock In 窗口现在就是开的，Hero 确认完立刻能打卡`)
  console.log('    · 班组已在岗但**还没进 Pool** —— 第 6 步「做完一次工就进人才库」是真的当场发生')
  console.log('    · 红点只有招聘岗位一个 —— 现场不会点错')
  console.log('═══════════════════════════════════════════')

  reapplyDemoAvatars()
}

main().catch(err => {
  console.error('\n✗ 脚本异常:', err.message)
  process.exit(1)
})
