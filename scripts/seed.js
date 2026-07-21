/**
 * scripts/seed.js — Tasking 基础账号/公司结构种子脚本（精简版）
 *
 * 只建立手操测试所需的最小结构，不生成任何业务数据（无 Shift / Attendance /
 * Task / Communication / Recruitment 数据）——这些由手操测试在 UI 里自己创建。
 *
 * 建立内容：
 *   1. 清空所有业务数据表 + 账号/公司/部门
 *   2. 删除 auth.users 里的旧测试账号（含 Playwright 遗留的 @tasking-tests.local 垃圾账号）
 *   3. 确保平台级 Admin 账号存在（madmin/uadmin，只建不删）
 *   4. 创建 auth 账号（密码统一 111111）+ public.users
 *   5. 创建 1 Company + 4 Department，并分配 Manager/Employee 到各部门
 *
 * 测试账号结构：
 *   1 Owner   owner@test.com
 *   1 Partner partner1@test.com
 *   4 Manager manager1-4@test.com（每部门 1 个）
 *   4 Employee employee1-4@test.com（每部门 1 个）
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

// ─── 账号定义 ──────────────────────────────────────────────────────────────────

const DEMO_PHOTO_URL = 'https://api.dicebear.com/7.x/avataaars/svg?seed=tasking'

const accounts = [
  { email: 'owner@test.com',    full_name: 'Sarah Mitchell', role: 'Owner',    phone_number: '+65 9123 4567', date_of_birth: '1980-03-15' },
  { email: 'partner1@test.com', full_name: 'James Tan',      role: 'Partner',  phone_number: '+65 9234 5678', date_of_birth: '1982-07-22' },
  { email: 'manager1@test.com', full_name: 'David Lim',      role: 'Manager',  phone_number: '+65 9456 7890', date_of_birth: '1988-04-12', hourly_rate: 28.00 },
  { email: 'manager2@test.com', full_name: 'Rachel Koh',     role: 'Manager',  phone_number: '+65 9567 8901', date_of_birth: '1990-09-28', hourly_rate: 27.50 },
  { email: 'manager3@test.com', full_name: 'Aaron Wong',     role: 'Manager',  phone_number: '+65 9678 9012', date_of_birth: '1987-01-17', hourly_rate: 26.00 },
  { email: 'manager4@test.com', full_name: 'Fiona Chen',     role: 'Manager',  phone_number: '+65 9789 0123', date_of_birth: '1991-06-03', hourly_rate: 29.00 },
  { email: 'employee1@test.com', full_name: 'Ben Seah',      role: 'Employee', phone_number: '+65 8123 4567', date_of_birth: '1995-02-18', hourly_rate: 19.00 },
  { email: 'employee2@test.com', full_name: 'Chloe Yeo',     role: 'Employee', phone_number: '+65 8234 5678', date_of_birth: '1997-10-05', hourly_rate: 18.50 },
  { email: 'employee3@test.com', full_name: 'Daniel Tay',    role: 'Employee', phone_number: '+65 8345 6789', date_of_birth: '1994-07-30', hourly_rate: 20.00 },
  { email: 'employee4@test.com', full_name: 'Elaine Chua',   role: 'Employee', phone_number: '+65 8456 7890', date_of_birth: '1996-04-11', hourly_rate: 19.50 },
]

// Platform-level admin accounts (Module 9/10) — NOT scoped to any company. Protected from
// deletion by the protect_admin_accounts DB trigger, so created idempotently (skipped if
// already present) rather than deleted-then-recreated.
const platformAdmins = [
  { email: 'madmin@tasking.com', full_name: 'Marketing Admin', role: 'Marketing Admin' },
  { email: 'uadmin@tasking.com', full_name: 'User Admin',      role: 'User Admin' },
]

// 之前完整版种子建过的账号也要一并从 auth 清掉（cw1-10 / guest1-10 / partner2 /
// manager5-8 / employee5-8），否则会留下孤儿 auth 账号。
const legacyTestEmailsToDelete = [
  ...accounts.map(a => a.email),
  'partner2@test.com',
  ...[5, 6, 7, 8].map(n => `manager${n}@test.com`),
  ...[5, 6, 7, 8].map(n => `employee${n}@test.com`),
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
  if (offDayDeadlineErr) console.warn(`  ⚠ 清空 off_day_submission_deadline 失败: ${offDayDeadlineErr.message}`)
  else console.log('  ✓ 清空 off_day_submission_deadline')
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

  // ── Step 7: 分配部门（每部门 1 Manager + 1 Employee）─────────────────────
  console.log('\nStep 7: 分配部门...')
  for (let i = 0; i < 4; i++) {
    const managerEmail = `manager${i + 1}@test.com`
    const employeeEmail = `employee${i + 1}@test.com`
    const dept = depts[i]

    const { error: mdErr } = await supabase.from('manager_departments').insert({
      manager_id: userIdMap[managerEmail].internalId,
      department_id: dept.id,
      company_id: company.id,
      assigned_by: ownerUser.id,
    })
    if (mdErr) console.warn(`  ⚠ manager_departments 失败: ${mdErr.message}`)
    else console.log(`  ✓ ${managerEmail} → ${dept.name}`)

    const { error: edErr } = await supabase.from('employee_departments').insert({
      employee_id: userIdMap[employeeEmail].internalId,
      department_id: dept.id,
      company_id: company.id,
    })
    if (edErr) console.warn(`  ⚠ employee_departments 失败: ${edErr.message}`)
    else console.log(`  ✓ ${employeeEmail} → ${dept.name}`)
  }

  console.log('\n═══════════════════════════════════════════')
  console.log('  完成！账号结构（密码全部 111111）：')
  console.log('  Owner:    owner@test.com')
  console.log('  Partner:  partner1@test.com')
  console.log('  Manager:  manager1-4@test.com（Operations / Marketing / Engineering / Customer Support）')
  console.log('  Employee: employee1-4@test.com（同上一一对应）')
  console.log('  无任何业务数据 —— Shift/Task/考勤等全部由手操测试自行创建。')
  console.log('═══════════════════════════════════════════')
}

main().catch(err => {
  console.error('\n✗ 脚本异常:', err.message)
  process.exit(1)
})
