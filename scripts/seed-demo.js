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
 *   D3  今天的班组：4 个 Casual Worker 在今天的 Operations 班上，**主管是 Ben、且已打卡**。
 *       这是 AI Assign 多人分派的前提 —— Employee 那一层的候选人池来自
 *       taskRepository.getSupervisedCasualWorkersByEmployee，它只认「今天同一个班、
 *       supervisor_employee_id 是我」的人。
 *   D4  Hero（guest1 Wei Jie Lim）清干净在途申请，并在**第三天**给他在第二家公司排一个已确认的
 *       班 —— 这就是跨公司冲突拦截演示的那条。
 *   D5  **明天**的招聘岗位，open，主管挂 Ben，已经躺着 5 个待处理申请人。
 *       ⚠️ 为什么是明天不是今天：respondToInvitation 会调 invitationHasExpired 直接拦截，
 *          一旦岗位开工时间已经过去，offer 就**确认不了**。放今天的话演示时早就过点了，
 *          Hero 接受 offer 那一步会直接失败。
 *   D6  第三天的岗位，时间与 D4 那个班重叠 —— Hero 申请它必被拦。
 *   D7  Worker Pool 预置 6 个已验证工人（含历史完工记录，completed_shifts 不是 0）。
 *       结尾「Invite from Pool」直接就有人可邀，不用现场挣。
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

// 今天在 Ben 手下干活的班组 —— AI Assign 的候选人就是这几个。
const CREW_EMAILS = ['casual3@test.com', 'casual4@test.com', 'casual5@test.com', 'casual6@test.com']
// Worker Pool 里的人（班组 + 两个只有历史记录的）。
const POOL_EMAILS = [...CREW_EMAILS, 'casual7@test.com', 'casual8@test.com']
// 招聘岗位上预置的待处理申请人 —— Hero 现场再申请一个，AI Assessment 一共排 6 个。
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

const TODAY = new Date()
TODAY.setHours(0, 0, 0, 0)
const TODAY_KEY = dateKey(TODAY)
const TOMORROW_KEY = dateKey(addDays(TODAY, 1))
const DAY3_KEY = dateKey(addDays(TODAY, 2))

// 班组今天的开工时间。必须是**已经过去**的钟点，Clock In 窗口（开工前 30 分钟才解锁）才一定
// 是开着的，不管演示实际几点开始。
const CREW_START = '08:00'

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
        .update({ start_time: CREW_START, end_time: '18:00', is_open_ended: false })
        .eq('id', assignment.shift_id)
      if (sErr) warn(`更新 ${label} 今天班次时间失败: ${sErr.message}`)
    } else {
      const shift = await createShift({
        company_id: companyId, department_id: users.opsDeptId, shift_date: TODAY_KEY,
        start_time: CREW_START, end_time: '18:00', is_open_ended: false,
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
      clock_in_time: sgt(TODAY_KEY, CREW_START).toISOString(),
      clock_out_time: null,
      break_in_time: null,
      break_out_time: null,
    })
    if (recErr) warn(`${label} 打卡记录写入失败: ${recErr.message}`)
    else ok(`${label} 今天 ${CREW_START} 已打卡、未下班（Tasks 页可写，AI Assign 按钮会渲染）`)
  }
}

// ─── D3: 今天的班组（AI Assign 多人分派的候选人池）────────────────────────────

async function seedTodayCrew(companyId, ownerId, opsDeptId, benId) {
  console.log('\nD3: 今天的班组 —— 4 个 Casual Worker，主管 Ben，已打卡...')

  // Employee 那一层 AI Assign 的候选人来自 getSupervisedCasualWorkersByEmployee，条件是：
  //   shift_assignments.supervisor_employee_id = Ben
  //   AND shifts.shift_date = 今天 AND shifts.department_id = Operations
  // 三个条件缺一个人就不会出现在候选名单里。
  //
  // 先把今天挂在 Ben 名下的**所有**班次清掉：seed.js 自己也会给别的 Casual Worker（Marcus Lee、
  // Hana Bakri）排今天的班并挂 Ben 当主管，不清的话候选名单会混进不属于班组的人，现场
  // 讲解跟画面对不上。清完再种，班组人数就是确定的 4 个。
  const { data: preexisting } = await supabase
    .from('shift_assignments')
    .select('user_id, shifts!inner(shift_date)')
    .eq('supervisor_employee_id', benId)
    .eq('shifts.shift_date', TODAY_KEY)
  const strayIds = [...new Set((preexisting ?? []).map(r => r.user_id))]
  for (const uid of strayIds) await wipeShiftsFrom(uid, TODAY_KEY)
  if (strayIds.length > 0) ok(`清掉 ${strayIds.length} 个 seed.js 自带的今日在管工人，班组只留下面这几个`)

  const crew = []
  for (const email of CREW_EMAILS) {
    const user = await getUserByEmail(email, { optional: true })
    if (!user) { warn(`找不到 ${email}，跳过`); continue }

    // 先清掉他今天起的其它班，避免同一天两个班把画面搞乱、或撞到自己。
    await wipeShiftsFrom(user.id, TODAY_KEY)

    const shift = await createShift({
      company_id: companyId, department_id: opsDeptId, shift_date: TODAY_KEY,
      start_time: CREW_START, end_time: '20:00',
      // 开放式班次：下班要主管放行（release），这正是演示最后「主管放行 → 工人下班」那一步。
      is_open_ended: true,
      created_by: ownerId, publication_status: 'published', hourly_rate: 14,
    })
    const assignment = await assignShift(shift?.id, user.id, ownerId, benId)
    if (!assignment) { warn(`${user.full_name} 排班失败，跳过`); continue }

    // 已打卡未下班。错开几分钟，看起来像真的陆续到场，而不是同一秒批量写进去的。
    const minute = String(3 + crew.length * 4).padStart(2, '0')
    const { error: recErr } = await supabase.from('attendance_records').insert({
      shift_assignment_id: assignment.id,
      user_id: user.id,
      clock_in_time: sgt(TODAY_KEY, `${CREW_START.slice(0, 2)}:${minute}`).toISOString(),
      clock_out_time: null,
    })
    if (recErr) { warn(`${user.full_name} 打卡记录失败: ${recErr.message}`); continue }

    crew.push(user)
    ok(`${user.full_name}：今天 ${CREW_START} 开工，${CREW_START.slice(0, 2)}:${minute} 已打卡，主管 Ben`)
  }

  if (crew.length < 2) {
    warn('班组不足 2 人，AI Assign 的多人分派会退化成单人推荐 —— 检查上面的报错')
  } else {
    ok(`班组共 ${crew.length} 人，Ben 的 AI Assign 候选名单就是这几个`)
  }
  return crew
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
  console.log('\nD5: 明天的招聘岗位 + 预置申请人（AI Assessment 用）...')

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
    job_date: TOMORROW_KEY,
    job_start_time: '10:00',
    estimated_hours: '8',
    openings: 3,
    experience_required: 'Not Required',
    minimum_age: 16,
    salary_amount: 120,
    no_deadline: true,
  }).select().single()
  if (error) { warn(`招聘岗位创建失败: ${error.message}`); return null }

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

  ok(`「${job.title}」明天 10:00 开工，${created} 个待处理申请人，主管挂 Ben`)
  ok(`openings = 3，Hero 现场再申请一个就是 ${created + 1} 个人排名`)
  return job
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
  const crew = await seedTodayCrew(company.id, owner.id, opsDept.id, employee1.id)
  await prepareHeroAndSecondCompany(hero.id)
  await seedHiringJob(company.id, owner.id, opsDept.id, employee1.id)
  await seedConflictJob(company.id, owner.id, opsDept.id)
  await seedWorkerPool(company.id, owner.id, opsDept.id, employee1.id)
  await seedWorkloadImbalance(company.id, owner.id, depts)

  const activeWeek = activeSubmissionWeekStart(TODAY, 0, '17:00')

  console.log('\n═══════════════════════════════════════════')
  console.log(' 演示数据就绪')
  console.log('═══════════════════════════════════════════')
  console.log(`  今天 ${TODAY_KEY} ｜ 招聘岗位 ${TOMORROW_KEY} ｜ 冲突岗位 ${DAY3_KEY}`)
  console.log('')
  console.log('  账号（密码 111111）：')
  console.log('    Owner     owner@test.com      Sarah Mitchell')
  console.log('    Manager   manager1@test.com   David Lim      已打卡未下班')
  console.log('    Employee  employee1@test.com  Ben Seah       已打卡未下班，今天班组的主管')
  console.log(`    Guest     ${HERO_EMAIL}     Wei Jie Lim    干净，可现场申请`)
  console.log('')
  console.log('  现场可以做的（顺序自己排）：')
  console.log(`    · Guest 申请「${CONFLICT_JOB_TITLE}」→ 被跨公司冲突拦下`)
  console.log(`    · Guest 申请「${HIRING_JOB_TITLE}」→ 成功`)
  console.log(`    · Manager 在「${HIRING_JOB_TITLE}」跑 AI Assessment（连 Hero 一共 6 人排名）`)
  console.log('    · Guest 接受 offer → 变成 Casual Worker → 看到明天的班')
  console.log(`    · Employee 跑 AI Assign，候选人就是今天的班组 ${crew.length} 人（多人分派 + 子任务）`)
  console.log('    · 分屏：Casual Worker 拖卡片 / Employee 打回重做 / 再通过')
  console.log('    · Owner 或 Manager 看 Workload Suggestion + Task Delay Alert')
  console.log('    · Owner 发新岗位 → Invite from Pool（池子里已有 6 人）')
  console.log(`    · （可选）Off Day 与 AI Schedule 都排 ${dateKey(activeWeek)} 那一周`)
  console.log('')
  console.log('  已经替你拆掉的雷：')
  console.log('    · 没有人处于 clocked out 状态 —— 不会有页面变只读')
  console.log(`    · 班组今天 ${CREW_START} 开工且已打卡 —— Clock In 窗口早就开了，不用等`)
  console.log('    · 招聘岗位放在明天 —— offer 不会因为开工时间已过而拒绝确认')
  console.log('    · 红点只有招聘岗位一个 —— 现场不会点错')
  console.log('═══════════════════════════════════════════')
}

main().catch(err => {
  console.error('\n✗ 脚本异常:', err.message)
  process.exit(1)
})
