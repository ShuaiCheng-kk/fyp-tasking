/**
 * scripts/seed-demo.js — 22 Aug 演示专用种子脚本
 *
 * 设计原则：**不复制 seed.js**。本脚本先原样跑一遍 `node scripts/seed.js` 建立完整基础数据，
 * 再在其之上打演示专用的补丁。这样 seed.js 永远是唯一的数据源真相，以后 seed.js 改了这里
 * 自动跟着改，不会出现两份 4000 行脚本互相漂移。
 *
 * 与 seed.js 的差异（也就是本脚本做的全部事情）：
 *   D1  Off Day 提交截止改成「周日 17:00」，并把待审批的 Off Day 全部对齐到当前开放的提交周
 *       （22 号周六跑 = 8/24–8/30 那一周），这样 demo 当天既能处理 Off Day 又能排那一周的班。
 *   D2  Ben Seah（employee1）和 David Lim（manager1）今天 08:00–18:00 排班，并且**已打卡、
 *       未下班**。这一步是硬性的：getClockLockStatus 只看「最近一条打卡记录有没有下班时间」，
 *       seed.js 种的历史打卡全都有下班时间，所以不补这条记录的话，Ben Seah 一登录整个 Tasks
 *       页就是只读——AI Assign 按钮不渲染、不能通过/驳回任务、不能放行下班。
 *   D3  Marcus Lee（casual1）清空从今天起的所有在手工作，让他今天是干净的，才能申请当场发布的
 *       「22 Aug Demo」一次性工作（one-off 会占住 11:30 到当天 23:59，身上有别的班就会被自己挡）。
 *   D4  新建第二家公司，并给 Marcus 在**明天**排一个已确认的班——演示 eligibility 拦截用的
 *       「他在另一家公司已经有活了」就是这条。
 *   D5  在本公司发一个**明天**的公开岗位，时间与 D4 那个班重叠，Marcus 申请它必被拒。
 *   D6  Recruitment 的 Active Jobs 只留一个带红点的岗位（红点 = pending_count > 0），挂 5 个
 *       资料齐全的待处理申请人，专门给 AI Assessment 演示用；其余岗位的 pending 申请全部清掉。
 *   D7  Operations / Marketing 两个部门制造工作量失衡，让 Workload Suggestion 必定触发
 *       （Reassign All 才有东西可点），并补几条明显超时的任务给 Task Delay Alert。
 *
 * 演示账号（只用 1 结尾的）：
 *   Owner        owner@test.com      Sarah Mitchell（公司 plan 已是 Paid，seed.js 就设好了）
 *   Manager      manager1@test.com   David Lim（Operations）
 *   Employee     employee1@test.com  Ben Seah（Operations，Marcus 的主管）
 *   Casual Worker casual1@test.com   Marcus Lee
 *   密码统一 111111
 *
 * 使用方法（演示当天早上跑一次）：
 *   node scripts/seed-demo.js
 */

const { createClient } = require('@supabase/supabase-js')
const { spawnSync } = require('child_process')
const path = require('path')

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

// AI Assessment 演示用的岗位（seed.js 里已有的 open 岗位，本脚本只往上挂申请人）。
const ASSESSMENT_JOB_TITLE = 'Weekend Event Crew'

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
const TOMORROW = addDays(TODAY, 1)
const TODAY_KEY = dateKey(TODAY)
const TOMORROW_KEY = dateKey(TOMORROW)

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

async function getUserByEmail(email) {
  const { data, error } = await supabase
    .from('users').select('id, full_name, company_id').eq('email_address', email).maybeSingle()
  if (error) throw new Error(`查询 ${email} 失败: ${error.message}`)
  if (!data) throw new Error(`找不到用户 ${email}，seed.js 是不是没跑成功？`)
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

  // 演示当天（周六）这个截止还没到，所以开放提交的是下一周 = 8/24–8/30。把所有 pending 的
  // 申请强制对齐到这一周，Owner 才能在 demo 里处理它们、并接着排那一周的班。
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
  ok(`${moved} 条待审批 Off Day 已对齐到 ${activeWeekKey} 那一周（demo 要排的就是这一周）`)
}

// ─── D2: Ben Seah / David Lim 今天已打卡未下班 ─────────────────────────────────

async function applyClockedInSupervisors(companyId, ownerId, users) {
  console.log('\nD2: Ben Seah / David Lim 今天 08:00-18:00 排班且已打卡...')

  for (const [label, user] of [['Ben Seah (employee1)', users.employee1], ['David Lim (manager1)', users.manager1]]) {
    // 先找 seed.js 已经给他种的今天的班——直接改时间，不删，避免动到挂在这个 shift 上的任务。
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
        .update({ start_time: '08:00', end_time: '18:00', is_open_ended: false })
        .eq('id', assignment.shift_id)
      if (sErr) warn(`更新 ${label} 今天班次时间失败: ${sErr.message}`)
    } else {
      const shift = await createShift({
        company_id: companyId, department_id: users.opsDeptId, shift_date: TODAY_KEY,
        start_time: '08:00', end_time: '18:00', is_open_ended: false,
        created_by: ownerId, publication_status: 'published',
      })
      assignment = await assignShift(shift?.id, user.id, ownerId)
      if (!assignment) { warn(`${label} 今天的班没建成，跳过打卡记录`); continue }
    }

    // 关键的一步：08:00 打卡、**不写 clock_out_time**。
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

// ─── D3: 清空 Marcus Lee 今天起的所有在手工作 ──────────────────────────────────

async function clearCasualUpcomingWork(marcusId) {
  console.log('\nD3: 清空 Marcus Lee 从今天起的所有班次与在途申请...')

  const { data: assignments, error: aErr } = await supabase
    .from('shift_assignments')
    .select('id, shift_id, shifts!inner(id, shift_date, source_job_posting_id)')
    .eq('user_id', marcusId)
    .gte('shifts.shift_date', TODAY_KEY)
  if (aErr) { warn(`查询 Marcus 未来班次失败: ${aErr.message}`); return }

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
    if (sErr) warn(`删除 Marcus 未来班次失败: ${sErr.message}`)
  }
  ok(`清掉 ${shiftIds.length} 个从今天起的班次`)

  // 在途申请同样算「已占用时段」（workerEligibility.getActiveApplicationJobs），一并清掉，
  // 否则他申请「22 Aug Demo」时可能被自己的旧申请挡住。
  const { data: apps } = await supabase
    .from('job_applicants').select('id').eq('user_id', marcusId).in('status', ['pending', 'accepted'])
  const appIds = (apps ?? []).map(a => a.id)
  if (appIds.length > 0) {
    await supabase.from('job_invitations').delete().in('applicant_id', appIds)
    await supabase.from('job_applicants').delete().in('id', appIds)
  }
  ok(`清掉 ${appIds.length} 条在途申请`)
}

// ─── D4: 第二家公司 + Marcus 明天在那边的已确认班次 ────────────────────────────

async function createSecondCompanyCommitment(marcusId) {
  console.log('\nD4: 建第二家公司，并让 Marcus 明天在那边已经有班...')

  // 重跑时先清掉上一次留下的账号，否则 auth 建号会撞邮箱。
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

  // 明天 15:00–21:00 的已确认班次 —— 这就是演示里「他在另一家公司已经有活了」的那条。
  const shift = await createShift({
    company_id: company2.id, department_id: dept2.id, shift_date: TOMORROW_KEY,
    start_time: '15:00', end_time: '21:00', is_open_ended: false,
    created_by: owner2.id, publication_status: 'published', hourly_rate: 15,
  })
  await assignShift(shift?.id, marcusId, owner2.id)

  await supabase.from('casualworker_departments').upsert({
    casual_worker_id: marcusId, department_id: dept2.id, company_id: company2.id,
    verified_at: new Date().toISOString(),
  }, { onConflict: 'casual_worker_id,department_id' })

  ok(`Harbourfront Events：Marcus 明天 ${TOMORROW_KEY} 15:00-21:00 已确认排班`)
  return company2
}

// ─── D5: 本公司明天的岗位（申请它必然撞车） ────────────────────────────────────

async function createConflictJob(companyId, ownerId, opsDeptId) {
  console.log('\nD5: 建一个明天的公开岗位，用来演示资格冲突拦截...')

  const { data: job, error } = await supabase.from('job_postings').insert({
    company_id: companyId, department_id: opsDeptId, created_by: ownerId,
    title: 'Sunday Banquet Service Crew',
    responsibilities: 'Serve a full-house banquet: plate service, drinks top-up, and floor reset between courses.',
    skills: 'Comfortable on your feet for long stretches, tidy presentation, works well in a team.',
    status: 'open',
    job_type: 'oneoff',
    urgency: 'normal',
    job_date: TOMORROW_KEY,
    job_start_time: '16:00',
    openings: 4,
    experience_required: 'Not Required',
    minimum_age: 16,
    salary_amount: 90,
    no_deadline: true,
  }).select().single()
  if (error) { warn(`冲突演示岗位创建失败: ${error.message}`); return }

  ok(`「${job.title}」明天 16:00 开工 —— Marcus 申请它会撞上 Harbourfront 15:00-21:00 的班`)
  ok('提示：拦截文案只说「和你已有的班冲突」，不会写公司名，跨公司这一点要靠讲解点出来')
}

// ─── D6: Active Jobs 只留一个红点 ──────────────────────────────────────────────

async function focusAssessmentJob(companyId) {
  console.log('\nD6: Recruitment 只留一个带红点的岗位（给 AI Assessment 用）...')

  const { data: postings, error: pErr } = await supabase
    .from('job_postings').select('id, title, status').eq('company_id', companyId)
  if (pErr) { warn(`查询岗位失败: ${pErr.message}`); return }

  const target = (postings ?? []).find(p => p.title === ASSESSMENT_JOB_TITLE)
  if (!target) { warn(`找不到岗位「${ASSESSMENT_JOB_TITLE}」，D6 跳过`); return }

  // 红点 = pending_count > 0。先把本公司所有 pending 申请压掉，保证只有目标岗位亮红点。
  const otherIds = (postings ?? []).filter(p => p.id !== target.id).map(p => p.id)
  if (otherIds.length > 0) {
    const { error: clrErr } = await supabase
      .from('job_applicants').update({ status: 'rejected' }).in('job_id', otherIds).eq('status', 'pending')
    if (clrErr) warn(`清理其它岗位的 pending 申请失败: ${clrErr.message}`)
  }
  ok('其它岗位的 pending 申请已清空（红点只剩一个）')

  // 目标岗位挂 5 个资料齐全的待处理申请人 —— AI Assessment 才有得排名。
  // 资料直接取自各自的 worker profile，跟真人自己填的一致。
  const applicantEmails = ['guest1@test.com', 'guest2@test.com', 'guest3@test.com', 'guest4@test.com', 'guest5@test.com']
  const notes = [
    'Ran the beverage station at two corporate galas last year. Comfortable with high-volume service.',
    'Two seasons of event crew work, mostly front-of-house. Happy to take late finishes.',
    'Stage and AV setup background. Strong on heavy lifting and pack-down.',
    'Retail and promo experience, used to talking to guests all day. Weekends fully free.',
    'First large event, but reliable and quick to pick things up. Available for the whole weekend.',
  ]

  await supabase.from('job_applicants').delete().eq('job_id', target.id)

  let created = 0
  for (let i = 0; i < applicantEmails.length; i++) {
    const email = applicantEmails[i]
    const { data: applicant } = await supabase
      .from('users').select('id').eq('email_address', email).maybeSingle()
    if (!applicant) { warn(`找不到 ${email}，跳过`); continue }

    const { data: profile } = await supabase
      .from('casual_worker_profiles').select('skills, resume_url').eq('user_id', applicant.id).maybeSingle()
    const { data: certs } = await supabase
      .from('user_certificates').select('name, certificate_url').eq('user_id', applicant.id)

    const { error: appErr } = await supabase.from('job_applicants').insert({
      job_id: target.id,
      user_id: applicant.id,
      status: 'pending',
      resume: profile?.resume_url ?? null,
      skills: profile?.skills ?? null,
      certificates: certs ?? [],
      additional_note: notes[i],
    })
    if (appErr) warn(`挂申请人 ${email} 失败: ${appErr.message}`)
    else created++
  }
  ok(`「${target.title}」现在有 ${created} 个待处理申请人，红点独一份`)
}

// ─── D7: 工作量失衡 + 超时任务 ─────────────────────────────────────────────────

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
  console.log('\nD7: 制造工作量失衡（Workload Suggestion）+ 超时任务（Delay Alert）...')

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
  // 直接照抄 seed.js 的任务量去猜要堆多少条是猜不准的（seed 本身给每个 Manager 的负载就不低），
  // 所以这里**先按线上真实数据算一遍分数，再算出还差几条**，避免以后 seed.js 改了这里就失效。
  //
  // 「重」的一方固定放在各部门的第二个 Manager（Wendy Ho / Kelvin Ang），「轻」的一方留给
  // David Lim / Rachel Koh —— 演示第 27 步要 AI Assign 派给 David Lim，而 AI Assign 推荐的是
  // **最闲**的人，两边必须对得上，否则画面自相矛盾。
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

    // 该部门的 Manager 候选池（服务层就是这么取的：部门内的 Manager，起步分 0）。
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
  const marcus = await getUserByEmail('casual1@test.com')

  const company = await getCompanyByName('Sunrise Hospitality Group')
  if (!company) { console.error('✗ 找不到主公司，中止'); process.exit(1) }

  const depts = await getDepartments(company.id)
  const opsDept = depts.find(d => d.name === 'Operations')
  if (!opsDept) { console.error('✗ 找不到 Operations 部门，中止'); process.exit(1) }

  const users = { manager1, employee1, opsDeptId: opsDept.id }

  await applyOffDayDeadline(company.id)
  await applyClockedInSupervisors(company.id, owner.id, users)
  await clearCasualUpcomingWork(marcus.id)
  await createSecondCompanyCommitment(marcus.id)
  await createConflictJob(company.id, owner.id, opsDept.id)
  await focusAssessmentJob(company.id)
  await seedWorkloadImbalance(company.id, owner.id, depts)

  console.log('\n═══════════════════════════════════════════')
  console.log(' 演示数据就绪')
  console.log('═══════════════════════════════════════════')
  console.log(`  演示日期：${TODAY_KEY}（冲突岗位与第二家公司的班都落在 ${TOMORROW_KEY}）`)
  console.log('  账号（密码 111111）：')
  console.log('    Owner         owner@test.com      Sarah Mitchell')
  console.log('    Manager       manager1@test.com   David Lim（Operations，AI Assign 应推荐他）')
  console.log('    Employee      employee1@test.com  Ben Seah（已打卡未下班，Tasks 页可写）')
  console.log('    Casual Worker casual1@test.com    Marcus Lee（今天全空）')
  console.log('')
  console.log('  演示当天现场要做的：')
  console.log('    1. Owner 用 AI Job Builder 发「22 Aug Demo」One-Off，开始时间设 11:30，')
  console.log('       supervisor 选 Ben Seah，截止主动选 "No Deadline"')
  console.log('    2. Marcus 先申请「Sunday Banquet Service Crew」→ 被资格检查拦下')
  console.log('    3. Marcus 再申请「22 Aug Demo」→ 成功')
  console.log(`    4. AI Assessment 在「${ASSESSMENT_JOB_TITLE}」上跑（5 个待处理申请人，唯一红点）`)
  const activeWeek = activeSubmissionWeekStart(TODAY, 0, '17:00')
  console.log(`    5. Off Day 与 AI Schedule 都排 ${dateKey(activeWeek)} – ${dateKey(addDays(activeWeek, 6))} 那一周`)
  console.log('')
  console.log('  注：上面 seed.js 自己打印的「Same-Day Café Cover Shift 可直接 Clock In」已被 D3 清掉，')
  console.log('      Marcus 今天是空的，这是演示需要的状态。')
  console.log('═══════════════════════════════════════════')
}

main().catch(err => {
  console.error('\n✗ 脚本异常:', err.message)
  process.exit(1)
})
