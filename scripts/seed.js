/**
 * scripts/seed.js — Tasking 测试数据完整重建脚本
 *
 * 功能：
 *   1. 清空所有业务数据表
 *   2. 删除 auth.users 里的旧测试账号
 *   3. 在 Supabase Auth 创建真实账号（密码统一 111111）
 *   4. 插入 public.users、companies、departments 及所有关联数据
 *
 * 测试账号结构：
 *   1 Owner, 2 Partner, 8 Manager, 8 Employee
 *   1 Company, 4 Department, 2 Manager/dept, 2 Employee/dept
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

// ─── 账号定义 ──────────────────────────────────────────────────────────────────

const accounts = [
  // Owner
  { email: 'owner@test.com',     full_name: 'Test Owner',     role: 'Owner' },
  // Partners
  { email: 'partner1@test.com',  full_name: 'Test Partner 1', role: 'Partner' },
  { email: 'partner2@test.com',  full_name: 'Test Partner 2', role: 'Partner' },
  // Managers (8, 2 per department)
  { email: 'manager1@test.com',  full_name: 'Test Manager 1', role: 'Manager' },
  { email: 'manager2@test.com',  full_name: 'Test Manager 2', role: 'Manager' },
  { email: 'manager3@test.com',  full_name: 'Test Manager 3', role: 'Manager' },
  { email: 'manager4@test.com',  full_name: 'Test Manager 4', role: 'Manager' },
  { email: 'manager5@test.com',  full_name: 'Test Manager 5', role: 'Manager' },
  { email: 'manager6@test.com',  full_name: 'Test Manager 6', role: 'Manager' },
  { email: 'manager7@test.com',  full_name: 'Test Manager 7', role: 'Manager' },
  { email: 'manager8@test.com',  full_name: 'Test Manager 8', role: 'Manager' },
  // Employees (8, 2 per department)
  { email: 'employee1@test.com', full_name: 'Test Employee 1', role: 'Employee' },
  { email: 'employee2@test.com', full_name: 'Test Employee 2', role: 'Employee' },
  { email: 'employee3@test.com', full_name: 'Test Employee 3', role: 'Employee' },
  { email: 'employee4@test.com', full_name: 'Test Employee 4', role: 'Employee' },
  { email: 'employee5@test.com', full_name: 'Test Employee 5', role: 'Employee' },
  { email: 'employee6@test.com', full_name: 'Test Employee 6', role: 'Employee' },
  { email: 'employee7@test.com', full_name: 'Test Employee 7', role: 'Employee' },
  { email: 'employee8@test.com', full_name: 'Test Employee 8', role: 'Employee' },
]

const legacyTestEmailsToDelete = [
  ...accounts.map(a => a.email),
  'cw1@test.com',
  'cw2@test.com',
  'cw3@test.com',
  'cw4@test.com',
  'cw5@test.com',
  'cw6@test.com',
  'cw7@test.com',
  'cw8@test.com',
]

// ─── 主流程 ────────────────────────────────────────────────────────────────────

async function main() {
  console.log('═══════════════════════════════════════════')
  console.log('  Tasking Seed Script')
  console.log('═══════════════════════════════════════════\n')

  // ── Step 1: 清空业务数据表 ─────────────────────────────────────────────────
  console.log('Step 1: 清空所有业务数据表...')
  // 顺序重要：先删子表再删父表，users 要在 companies 之前
  const tablesToClear = [
    'attendance_records',
    'shift_assignments',
    'shifts',
    'tasks',
    'messages',
    'announcements',
    'inbox',
    'job_applicants',
    'job_invitations',
    'job_postings',
    'time_off_requests',
    'shift_swap_requests',
    'manager_departments',
    'employee_departments',
  ]
  for (const table of tablesToClear) {
    const { error } = await supabase.from(table).delete().neq('id', '00000000-0000-0000-0000-000000000000')
    if (error) console.warn(`  ⚠ 清空 ${table} 失败: ${error.message}`)
    else console.log(`  ✓ 清空 ${table}`)
  }
  // invitation_code 主键不叫 id，用 code 字段清空
  const { error: icErr } = await supabase.from('invitation_code').delete().neq('code', '')
  if (icErr) console.warn(`  ⚠ 清空 invitation_code 失败: ${icErr.message}`)
  else console.log('  ✓ 清空 invitation_code')
  // users 先删（有 company_id FK），再删 departments、companies
  const { error: uErr } = await supabase.from('users').delete().neq('id', '00000000-0000-0000-0000-000000000000')
  if (uErr) console.warn(`  ⚠ 清空 users 失败: ${uErr.message}`)
  else console.log('  ✓ 清空 users')
  const { error: dErr } = await supabase.from('departments').delete().neq('id', '00000000-0000-0000-0000-000000000000')
  if (dErr) console.warn(`  ⚠ 清空 departments 失败: ${dErr.message}`)
  else console.log('  ✓ 清空 departments')
  const { error: cErr } = await supabase.from('companies').delete().neq('id', '00000000-0000-0000-0000-000000000000')
  if (cErr) console.warn(`  ⚠ 清空 companies 失败: ${cErr.message}`)
  else console.log('  ✓ 清空 companies')

  // ── Step 2: 删除旧 auth 账号 ──────────────────────────────────────────────
  console.log('\nStep 2: 删除旧 auth 账号...')
  const { data: existingUsers } = await supabase.auth.admin.listUsers({ perPage: 1000 })
  const testEmails = new Set(legacyTestEmailsToDelete)
  for (const u of (existingUsers?.users ?? [])) {
    if (testEmails.has(u.email)) {
      await supabase.auth.admin.deleteUser(u.id)
      console.log(`  ✓ 删除 auth: ${u.email}`)
    }
  }

  // ── Step 3: 创建 auth 账号 + public.users ──────────────────────────────────
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

  // ── Step 4: 创建 Company ───────────────────────────────────────────────────
  console.log('\nStep 4: 创建 Company...')
  const ownerAuthId = userIdMap['owner@test.com'].authId

  // 先插入 owner 的 public.users（company_id 暂时为 null，后面更新）
  const { data: ownerUser, error: ownerErr } = await supabase
    .from('users')
    .insert({
      supabase_auth_id: ownerAuthId,
      full_name: 'Test Owner',
      email_address: 'owner@test.com',
      phone_number: null,
      role: 'Owner',
      company_id: null,
    })
    .select()
    .single()
  if (ownerErr) { console.error('  ✗ 插入 owner users 失败:', ownerErr.message); process.exit(1) }
  userIdMap['owner@test.com'].internalId = ownerUser.id

  const { data: company, error: compErr } = await supabase
    .from('companies')
    .insert({ name: 'Test Company', owner_id: ownerUser.id })
    .select()
    .single()
  if (compErr) { console.error('  ✗ 创建 company 失败:', compErr.message); process.exit(1) }
  console.log(`  ✓ Company: ${company.name} (${company.id})`)

  // 更新 owner 的 company_id
  await supabase.from('users').update({ company_id: company.id }).eq('id', ownerUser.id)

  // ── Step 5: 创建 Departments ───────────────────────────────────────────────
  console.log('\nStep 5: 创建 Departments...')
  const deptNames = ['Operations', 'Marketing', 'Engineering', 'Customer Support']
  const depts = []
  for (const name of deptNames) {
    const { data: dept, error: dErr } = await supabase
      .from('departments')
      .insert({ name, company_id: company.id })
      .select()
      .single()
    if (dErr) { console.error(`  ✗ 创建 dept ${name} 失败:`, dErr.message); process.exit(1) }
    depts.push(dept)
    console.log(`  ✓ Department: ${dept.name} (${dept.id})`)
  }

  // ── Step 6: 插入所有其他 public.users ─────────────────────────────────────
  console.log('\nStep 6: 插入 public.users...')
  for (const account of accounts) {
    if (account.email === 'owner@test.com') continue // 已插入
    const authId = userIdMap[account.email].authId
    const { data: u, error: uErr } = await supabase
      .from('users')
      .insert({
        supabase_auth_id: authId,
        full_name: account.full_name,
        email_address: account.email,
        phone_number: null,
        role: account.role,
        company_id: company.id,
      })
      .select()
      .single()
    if (uErr) { console.error(`  ✗ 插入 users 失败 ${account.email}:`, uErr.message); process.exit(1) }
    userIdMap[account.email].internalId = u.id
    console.log(`  ✓ users: ${account.full_name} (${u.id})`)
  }

  // ── Step 7: manager_departments — 每个 dept 分配 2 个 manager ─────────────
  console.log('\nStep 7: 分配 manager_departments...')
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

  // ── Step 8: employee_departments — 每个 dept 分配 2 个 employee ───────────
  console.log('\nStep 8: 分配 employee_departments...')
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
    })
    if (edErr) console.warn(`  ⚠ employee_departments 失败: ${edErr.message}`)
    else console.log(`  ✓ ${employeeEmails[i]} → ${dept.name}`)
  }

  // ── Step 9: Partner 的 company_id 已在 Step 6 设置完毕 ───────────────────
  console.log('\nStep 9: Partner company 确认...')
  console.log('  ✓ partner1@test.com, partner2@test.com → Test Company (已在 Step 6 完成)')

  // ── 完成 ───────────────────────────────────────────────────────────────────
  console.log('\n═══════════════════════════════════════════')
  console.log('  ✅ Seed 完成！')
  console.log('═══════════════════════════════════════════')
  console.log('\n测试账号（密码统一：111111）')
  console.log('  Owner:    owner@test.com')
  console.log('  Partner:  partner1@test.com / partner2@test.com')
  console.log('  Manager:  manager1~8@test.com')
  console.log('  Employee: employee1~8@test.com')
  console.log('\n部门分配：')
  console.log('  Operations:       manager1,2 / employee1,2')
  console.log('  Marketing:        manager3,4 / employee3,4')
  console.log('  Engineering:      manager5,6 / employee5,6')
  console.log('  Customer Support: manager7,8 / employee7,8')
}

main().catch(err => {
  console.error('\n✗ 脚本异常:', err.message)
  process.exit(1)
})
