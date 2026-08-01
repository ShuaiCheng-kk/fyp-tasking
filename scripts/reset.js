/**
 * scripts/reset.js — 把数据库清成「全新系统」状态（只清，不建任何测试数据）
 *
 * 与 scripts/seed.js 的区别：
 *   seed.js  = 清空 + 重建一整套演示数据（Owner/Partner/8 Manager/8 Employee/班次/任务/招聘…）
 *   reset.js = 只清空，什么都不建 —— 用于「模拟真实用户从 0 开始」的手动测试
 *
 * 清空后系统的状态：
 *   · 0 家公司、0 个部门、0 个业务用户、0 条任何业务数据
 *   · 0 个 auth 账号（除下面两个平台账号）
 *   · 保留 madmin@tasking.com（Marketing Admin）和 uadmin@tasking.com（User Admin）
 *     —— 这两个是平台运营账号，被 protect_admin_accounts 触发器保护，删不掉也不该删
 *   · 保留营销站内容（marketing_pages / marketing_content_blocks）
 *     —— 那是 Marketing Admin 维护的公开站文案，删了首页会空掉，不属于「公司数据」
 *
 * 用法：
 *   node scripts/reset.js --yes                  清空（保留营销站内容）
 *   node scripts/reset.js --yes --wipe-marketing 连营销站内容一起清（测 UC72-74 空状态时才用）
 *
 * ⚠️ 这个脚本会删掉数据库里**所有**账号（含你手动注册的）。必须显式加 --yes 才会执行。
 */

const { createClient } = require('@supabase/supabase-js')

// 从 .env.local / .env 读取凭证 —— 不像 seed.js 那样硬编码 service-role key（见 BUGLOG BUG-006）。
require('dotenv').config({ path: '.env.local' })
require('dotenv').config({ path: '.env' })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
if (!SUPABASE_URL) {
  console.error('✗ 缺少环境变量 NEXT_PUBLIC_SUPABASE_URL')
  process.exit(1)
}
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SERVICE_ROLE_KEY) {
  console.error('✗ 缺少环境变量 SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD || '111111'

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const args = process.argv.slice(2)
const CONFIRMED = args.includes('--yes')
const WIPE_MARKETING = args.includes('--wipe-marketing')

// 平台级账号 —— 永远保留，不属于任何公司
const PLATFORM_ADMINS = [
  { email: 'madmin@tasking.com', full_name: 'Marketing Admin', role: 'Marketing Admin' },
  { email: 'uadmin@tasking.com', full_name: 'User Admin',      role: 'User Admin' },
]
const PLATFORM_EMAILS = new Set(PLATFORM_ADMINS.map(a => a.email))

const ZERO_UUID = '00000000-0000-0000-0000-000000000000'

// 删除顺序 = 外键依赖的逆序。子表在前，父表在后，否则 FK 会挡住删除。
// 每项 { table, pk } —— pk 是该表用来做 "delete all" 的列（大多数是 id，少数表主键是别的列）。
const TABLES_IN_DELETE_ORDER = [
  // 考勤 / 排班
  { table: 'attendance_records',              pk: 'id' },
  { table: 'shift_action_history',            pk: 'id' },
  { table: 'shift_swap_requests',             pk: 'id' },
  { table: 'shift_assignments',               pk: 'id' },
  { table: 'shifts',                          pk: 'id' },
  { table: 'shift_templates',                 pk: 'id' },
  // 任务（task_assignments / 提醒读取状态必须先于 tasks 和 users）
  { table: 'task_assignments',                pk: 'id' },
  { table: 'task_delay_alert_reads',          pk: 'task_id' },
  { table: 'task_delay_alert_settings',       pk: 'company_id' },
  { table: 'task_templates',                  pk: 'id' },
  { table: 'tasks',                           pk: 'id' },
  // 沟通
  { table: 'messages',                        pk: 'id' },
  { table: 'announcement_reads',              pk: 'id' },
  { table: 'announcements',                   pk: 'id' },
  // 招聘
  { table: 'job_invitations',                 pk: 'id' },
  { table: 'job_applicants',                  pk: 'id' },
  { table: 'job_cancellations',               pk: 'id' },
  { table: 'job_postings',                    pk: 'id' },
  { table: 'job_templates',                   pk: 'id' },
  // 休息日 / 换班设置
  { table: 'off_day_requests',                pk: 'id' },
  { table: 'off_day_quota_settings',           pk: 'id' },
  { table: 'off_day_submission_deadline',      pk: 'company_id' },
  { table: 'shift_swap_settings',              pk: 'company_id' },
  { table: 'shift_swap_department_settings',   pk: 'company_id' },
  // 用户附属
  { table: 'user_certificates',               pk: 'id' },
  { table: 'casual_worker_profiles',          pk: 'user_id' },
  { table: 'reviews',                         pk: 'id' },
  // 归属关系
  { table: 'manager_departments',             pk: 'id' },
  { table: 'employee_departments',            pk: 'id' },
  { table: 'casualworker_departments',        pk: 'id' },
  { table: 'company_activity_logs',           pk: 'id' },
]

async function clearTable(table, pk) {
  // 文本主键（invitation_code.code）用 neq('')，UUID 主键用 neq(ZERO_UUID)。
  const sentinel = pk === 'code' ? '' : ZERO_UUID
  const { error } = await supabase.from(table).delete().neq(pk, sentinel)
  if (error) {
    console.warn(`  ⚠ 清空 ${table} 失败: ${error.message}`)
    return false
  }
  console.log(`  ✓ 清空 ${table}`)
  return true
}

async function main() {
  console.log('═══════════════════════════════════════════════════════')
  console.log('  Tasking RESET — 把数据库清成全新系统（不建任何数据）')
  console.log('═══════════════════════════════════════════════════════\n')
  console.log(`  目标数据库: ${SUPABASE_URL}`)
  console.log(`  营销站内容: ${WIPE_MARKETING ? '一并清空' : '保留'}`)
  console.log(`  平台账号  : 保留 ${PLATFORM_ADMINS.map(a => a.email).join(' / ')}\n`)

  if (!CONFIRMED) {
    console.log('  ⚠ 这会删除数据库里所有公司、所有业务数据、所有账号（平台账号除外）。')
    console.log('  ⚠ 确认无误请重新运行：node scripts/reset.js --yes\n')
    process.exit(1)
  }

  let warnings = 0

  // ── Step 1: 清空业务数据表 ────────────────────────────────────────────────
  console.log('Step 1: 清空业务数据表...')
  for (const { table, pk } of TABLES_IN_DELETE_ORDER) {
    if (!(await clearTable(table, pk))) warnings++
  }
  if (!(await clearTable('invitation_code', 'code'))) warnings++

  // ── Step 2: 清空 users / departments / companies ─────────────────────────
  // 平台账号行被 protect_admin_accounts 触发器保护 —— 必须排除，否则整条 delete 会失败。
  console.log('\nStep 2: 清空用户 / 部门 / 公司...')
  const { error: uErr } = await supabase
    .from('users')
    .delete()
    .neq('id', ZERO_UUID)
    .not('role', 'in', '("User Admin","Marketing Admin")')
  if (uErr) { console.warn(`  ⚠ 清空 users 失败: ${uErr.message}`); warnings++ }
  else console.log('  ✓ 清空 users（保留 User Admin / Marketing Admin）')

  if (!(await clearTable('departments', 'id'))) warnings++
  if (!(await clearTable('companies', 'id'))) warnings++

  // ── Step 3: 清空营销站内容（仅 --wipe-marketing）─────────────────────────
  if (WIPE_MARKETING) {
    console.log('\nStep 3: 清空营销站内容...')
    if (!(await clearTable('marketing_content_blocks', 'id'))) warnings++
    if (!(await clearTable('marketing_pages', 'id'))) warnings++
    console.log('  · 恢复方式: node scripts/seed-marketing-pages.mjs 等 seed-*.mjs 脚本')
  } else {
    console.log('\nStep 3: 跳过营销站内容（未加 --wipe-marketing）')
  }

  // ── Step 4: 删除所有 auth 账号（平台账号除外）────────────────────────────
  // listUsers 单页最多 1000 条，必须翻页取全量。
  console.log('\nStep 4: 删除 auth 账号...')
  const allAuthUsers = []
  for (let page = 1; ; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 })
    if (error) { console.warn(`  ⚠ listUsers 第 ${page} 页失败: ${error.message}`); warnings++; break }
    allAuthUsers.push(...(data?.users ?? []))
    if (!data?.users?.length || data.users.length < 1000) break
  }
  console.log(`  · auth 账号总数: ${allAuthUsers.length}`)

  let deleted = 0
  for (const u of allAuthUsers) {
    if (PLATFORM_EMAILS.has(u.email)) { console.log(`  · 保留: ${u.email}`); continue }
    const { error } = await supabase.auth.admin.deleteUser(u.id)
    if (error) { console.warn(`  ⚠ 删除 auth 失败 ${u.email}: ${error.message}`); warnings++ }
    else deleted++
  }
  console.log(`  ✓ 删除 auth 账号 ${deleted} 个`)

  // ── Step 5: 确保平台账号存在 ─────────────────────────────────────────────
  console.log('\nStep 5: 确保平台账号存在...')
  for (const [i, admin] of PLATFORM_ADMINS.entries()) {
    let authId = allAuthUsers.find(u => u.email === admin.email)?.id

    if (!authId) {
      const { data, error } = await supabase.auth.admin.createUser({
        email: admin.email,
        password: ADMIN_PASSWORD,
        email_confirm: true,
      })
      if (error || !data.user) {
        console.error(`  ✗ auth 创建失败 ${admin.email}: ${error?.message}`)
        process.exit(1)
      }
      authId = data.user.id
      console.log(`  ✓ auth 创建: ${admin.email}`)
    } else {
      console.log(`  · auth 已存在: ${admin.email}`)
    }

    const { data: existingRow } = await supabase
      .from('users').select('id').eq('email_address', admin.email).maybeSingle()

    if (!existingRow) {
      const { error: insErr } = await supabase.from('users').insert({
        supabase_auth_id: authId,
        full_name: admin.full_name,
        email_address: admin.email,
        phone_number: `+65 9000 000${i}`,
        role: admin.role,
        company_id: null,
      })
      if (insErr) { console.warn(`  ⚠ users 行创建失败 ${admin.email}: ${insErr.message}`); warnings++ }
      else console.log(`  ✓ users 行创建: ${admin.email}`)
    } else {
      console.log(`  · users 行已存在: ${admin.email}`)
    }
  }

  // ── Step 6: 验证真的空了 ─────────────────────────────────────────────────
  console.log('\nStep 6: 验证...')
  const checks = [
    ['companies', 0], ['departments', 0], ['shifts', 0], ['tasks', 0],
    ['job_postings', 0], ['announcements', 0], ['messages', 0], ['attendance_records', 0],
  ]
  let clean = true
  for (const [table, expected] of checks) {
    const { count, error } = await supabase.from(table).select('*', { count: 'exact', head: true })
    if (error) { console.warn(`  ⚠ 无法统计 ${table}: ${error.message}`); warnings++; continue }
    const ok = count === expected
    if (!ok) clean = false
    console.log(`  ${ok ? '✓' : '✗'} ${table}: ${count}（期望 ${expected}）`)
  }
  const { count: userCount } = await supabase.from('users').select('*', { count: 'exact', head: true })
  const userOk = userCount === PLATFORM_ADMINS.length
  if (!userOk) clean = false
  console.log(`  ${userOk ? '✓' : '✗'} users: ${userCount}（期望 ${PLATFORM_ADMINS.length}，只剩平台账号）`)

  console.log('\n═══════════════════════════════════════════════════════')
  if (clean && warnings === 0) {
    console.log('  ✅ 数据库已清空，系统处于全新状态')
  } else {
    console.log(`  ⚠️ 完成，但有 ${warnings} 条警告 / 残留 —— 请往上看具体哪张表没清干净`)
  }
  console.log('═══════════════════════════════════════════════════════')
  console.log('\n下一步：')
  console.log('  1. npm run dev')
  console.log('  2. 打开 http://localhost:3000/get-started')
  console.log('  3. 按 docs/testing/15_FreshStart_RealUser_Journey.md 从注册第一个 Owner 开始')
  console.log(`  4. 平台账号仍可用：madmin@tasking.com / uadmin@tasking.com（密码 ${ADMIN_PASSWORD}）\n`)
}

main().catch(err => {
  console.error('\n✗ 脚本异常终止:', err)
  process.exit(1)
})
