/**
 * scripts/seed.js — Tasking 基础测试数据重建脚本
 *
 * 功能：
 *   1. 清空账户/公司/部门/Shift 相关数据表
 *   2. 删除 auth.users 里的旧测试账号
 *   3. 在 Supabase Auth 创建真实账号（密码统一 111111）
 *   4. 插入 public.users、companies、departments 及部门分配
 *   5. 插入 Casual Workers（含 date_of_birth, phone_number, worker_status 等）
 *   6. 插入一个 Shift Template，以及 2026-06-22 当天覆盖 4 个部门的 Shifts
 *      （含 Split Shift、引用 Template 的 Shift、一条待审批的 Shift Swap Request）
 *
 * 测试账号结构：
 *   1 Owner, 2 Partner, 8 Manager, 8 Employee, 10 Casual Worker
 *   1 Company, 4 Department, 2 Manager/dept, 2 Employee/dept
 *
 * 不创建：tasks/recruitment/messages/announcements 等业务数据，
 * 仅用于测试账户/公司/部门/Shift 相关的 UC。
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
  // Managers (8, 2 per department)
  { email: 'manager1@test.com', full_name: 'David Lim',      role: 'Manager', phone_number: '+65 9456 7890', date_of_birth: '1988-04-12' },
  { email: 'manager2@test.com', full_name: 'Rachel Koh',     role: 'Manager', phone_number: '+65 9567 8901', date_of_birth: '1990-09-28' },
  { email: 'manager3@test.com', full_name: 'Aaron Wong',     role: 'Manager', phone_number: '+65 9678 9012', date_of_birth: '1987-01-17' },
  { email: 'manager4@test.com', full_name: 'Fiona Chen',     role: 'Manager', phone_number: '+65 9789 0123', date_of_birth: '1991-06-03' },
  { email: 'manager5@test.com', full_name: 'Ethan Goh',      role: 'Manager', phone_number: '+65 9890 1234', date_of_birth: '1986-12-25' },
  { email: 'manager6@test.com', full_name: 'Jasmine Lee',    role: 'Manager', phone_number: '+65 9901 2345', date_of_birth: '1992-03-09' },
  { email: 'manager7@test.com', full_name: 'Marcus Ong',     role: 'Manager', phone_number: '+65 9012 3456', date_of_birth: '1989-08-14' },
  { email: 'manager8@test.com', full_name: 'Vivian Ho',      role: 'Manager', phone_number: '+65 9123 4560', date_of_birth: '1993-05-21' },
  // Employees (8, 2 per department)
  { email: 'employee1@test.com', full_name: 'Ben Seah',       role: 'Employee', phone_number: '+65 8123 4567', date_of_birth: '1995-02-18' },
  { email: 'employee2@test.com', full_name: 'Chloe Yeo',      role: 'Employee', phone_number: '+65 8234 5678', date_of_birth: '1997-10-05' },
  { email: 'employee3@test.com', full_name: 'Daniel Tay',     role: 'Employee', phone_number: '+65 8345 6789', date_of_birth: '1994-07-30' },
  { email: 'employee4@test.com', full_name: 'Elaine Chua',    role: 'Employee', phone_number: '+65 8456 7890', date_of_birth: '1996-04-11' },
  { email: 'employee5@test.com', full_name: 'Felix Ng',       role: 'Employee', phone_number: '+65 8567 8901', date_of_birth: '1998-01-24' },
  { email: 'employee6@test.com', full_name: 'Grace Lau',      role: 'Employee', phone_number: '+65 8678 9012', date_of_birth: '1995-09-16' },
  { email: 'employee7@test.com', full_name: 'Henry Sim',      role: 'Employee', phone_number: '+65 8789 0123', date_of_birth: '1997-06-07' },
  { email: 'employee8@test.com', full_name: 'Irene Tan',      role: 'Employee', phone_number: '+65 8890 1234', date_of_birth: '1999-03-29' },
]

// Casual Workers — these get worker_status, date_of_birth, resume/cover letter URLs
const casualWorkers = [
  { email: 'cw1@test.com',  full_name: 'Alicia Tan',     phone_number: '+65 8100 1001', date_of_birth: '1998-05-12', worker_status: 'active',   inactivate_reason: null },
  { email: 'cw2@test.com',  full_name: 'Nadia Wong',     phone_number: '+65 8100 1002', date_of_birth: '2000-08-22', worker_status: 'active',   inactivate_reason: null },
  { email: 'cw3@test.com',  full_name: 'Hui Min Lee',    phone_number: '+65 8100 1003', date_of_birth: '1999-03-17', worker_status: 'active',   inactivate_reason: null },
  { email: 'cw4@test.com',  full_name: 'Farah Hassan',   phone_number: '+65 8100 1004', date_of_birth: '2001-11-05', worker_status: 'active',   inactivate_reason: null },
  { email: 'cw5@test.com',  full_name: 'Ethan Ong',      phone_number: '+65 8100 1005', date_of_birth: '1997-07-30', worker_status: 'active',   inactivate_reason: null },
  { email: 'cw6@test.com',  full_name: 'Daniel Goh',     phone_number: '+65 8100 1006', date_of_birth: '2002-02-14', worker_status: 'active',   inactivate_reason: null },
  { email: 'cw7@test.com',  full_name: 'Siti Nur',       phone_number: '+65 8100 1007', date_of_birth: '1996-09-09', worker_status: 'active',   inactivate_reason: null },
  { email: 'cw8@test.com',  full_name: 'Marcus Lim',     phone_number: '+65 8100 1008', date_of_birth: '2000-04-25', worker_status: 'inactive', inactivate_reason: 'Repeated no-shows without prior notice.' },
  { email: 'cw9@test.com',  full_name: 'Jasper Koh',     phone_number: '+65 8100 1009', date_of_birth: '1999-12-01', worker_status: 'inactive', inactivate_reason: 'Violated workplace conduct policy.' },
  { email: 'cw10@test.com', full_name: 'Mei Xin Teo',    phone_number: '+65 8100 1010', date_of_birth: '1998-06-18', worker_status: 'inactive', inactivate_reason: 'Unable to meet shift requirements.' },
]

const legacyTestEmailsToDelete = [
  ...accounts.map(a => a.email),
  ...casualWorkers.map(cw => cw.email),
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
    'shift_assignments',
    'shifts',
    'shift_templates',
    'tasks',
    'messages',
    'announcements',
    'inbox',
    'job_invitations',
    'job_applicants',
    'job_postings',
    'time_off_requests',
    'manager_departments',
    'employee_departments',
  ]
  for (const table of tablesToClear) {
    const { error } = await supabase.from(table).delete().neq('id', '00000000-0000-0000-0000-000000000000')
    if (error) console.warn(`  ⚠ 清空 ${table} 失败: ${error.message}`)
    else console.log(`  ✓ 清空 ${table}`)
  }
  const { error: icErr } = await supabase.from('invitation_code').delete().neq('code', '')
  if (icErr) console.warn(`  ⚠ 清空 invitation_code 失败: ${icErr.message}`)
  else console.log('  ✓ 清空 invitation_code')
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

  // ── Step 3: 创建 auth 账号（internal + CW）──────────────────────────────
  console.log('\nStep 3: 创建 auth 账号...')
  const userIdMap = {} // email → { authId, internalId }

  const allAuthAccounts = [...accounts, ...casualWorkers]
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
  const deptNames = ['Operations', 'Marketing', 'Engineering', 'Customer Support']
  const depts = []
  for (const name of deptNames) {
    const { data: dept, error: deptErr } = await supabase
      .from('departments')
      .insert({ name, company_id: company.id })
      .select()
      .single()
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
      })
      .select()
      .single()
    if (uErr) { console.error(`  ✗ 插入 CW users 失败 ${cw.email}:`, uErr.message); process.exit(1) }
    userIdMap[cw.email].internalId = u.id
    console.log(`  ✓ CW: ${cw.full_name} (${cw.worker_status}) → ${u.id}`)
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

  // ── Step 10: Shift Template ────────────────────────────────────────────
  console.log('\nStep 10: 创建 Shift Template...')
  const { data: template, error: tplErr } = await supabase
    .from('shift_templates')
    .insert({
      company_id: company.id,
      name: 'Standard Day Shift (9-5)',
      start_time: '09:00',
      end_time: '17:00',
      created_by: ownerUser.id,
    })
    .select()
    .single()
  if (tplErr) console.warn(`  ⚠ shift_template 创建失败: ${tplErr.message}`)
  else console.log(`  ✓ Template: ${template.name} (${template.id})`)

  // ── Step 11: Shifts on 2026-06-22 across all departments ───────────────
  console.log('\nStep 11: 创建 2026-06-22 的 Shifts...')

  const mgrId = (n) => userIdMap[`manager${n}@test.com`].internalId
  const empId = (n) => userIdMap[`employee${n}@test.com`].internalId
  const cwId = (n) => userIdMap[`cw${n}@test.com`].internalId
  const SHIFT_DATE = '2026-06-22'

  // A shift maps to at most one shift_assignment row — never pass more than one assignee here.
  const createShiftWithAssignees = async ({ dept, start, end, title, instruction, pub, creator, assignee, template_id }) => {
    const { data: shift, error: shiftErr } = await supabase
      .from('shifts')
      .insert({
        company_id: company.id,
        department_id: depts[dept].id,
        title,
        instruction,
        shift_date: SHIFT_DATE,
        start_time: start,
        end_time: end,
        status: 'active',
        publication_status: pub,
        created_by: creator,
        template_id: template_id ?? null,
      })
      .select()
      .single()
    if (shiftErr) { console.warn(`  ⚠ shift 创建失败 (${title}): ${shiftErr.message}`); return null }

    let assignmentRecord = null
    if (assignee) {
      const { data: sa, error: saErr } = await supabase
        .from('shift_assignments')
        .insert({ shift_id: shift.id, user_id: assignee.u, assigned_by: assignee.by })
        .select()
        .single()
      if (saErr) { console.warn(`  ⚠ shift_assignment 创建失败: ${saErr.message}`) }
      else assignmentRecord = { id: sa.id, userId: assignee.u }
    }
    console.log(`  ✓ Shift: ${title} @ ${SHIFT_DATE} (${depts[dept].name}, ${pub}) — ${assignmentRecord ? '1 assignee' : 'unassigned'}`)
    return { shift, assignments: assignmentRecord ? [assignmentRecord] : [] }
  }

  // Operations: standard published shift using the template, assigned to the manager.
  // A second, separate shift covers the employee on the same slot — one assignee per shift.
  await createShiftWithAssignees({
    dept: 0, start: '09:00', end: '17:00', title: 'Operations Coverage',
    instruction: 'Baseline department coverage shift.', pub: 'published',
    creator: mgrId(1), template_id: template?.id,
    assignee: { u: mgrId(1), by: mgrId(1) },
  })
  await createShiftWithAssignees({
    dept: 0, start: '09:00', end: '17:00', title: 'Operations Coverage',
    instruction: 'Baseline department coverage shift.', pub: 'published',
    creator: mgrId(1), template_id: template?.id,
    assignee: { u: empId(1), by: mgrId(1) },
  })

  // Marketing: draft shift, unassigned
  await createShiftWithAssignees({
    dept: 1, start: '10:00', end: '18:00', title: 'Marketing Coverage',
    instruction: 'Campaign monitoring and content review.', pub: 'draft',
    creator: mgrId(3), assignee: null,
  })

  // Engineering: published shift assigned to a manager.
  // A second, separate shift covers the employee on the same slot — one assignee per shift.
  const engShift = await createShiftWithAssignees({
    dept: 2, start: '08:00', end: '16:00', title: 'Engineering On-call',
    instruction: 'Monitor incident queue and deploy pipeline.', pub: 'published',
    creator: mgrId(5), assignee: { u: mgrId(5), by: mgrId(5) },
  })
  await createShiftWithAssignees({
    dept: 2, start: '08:00', end: '16:00', title: 'Engineering On-call',
    instruction: 'Monitor incident queue and deploy pipeline.', pub: 'published',
    creator: mgrId(5), assignee: { u: empId(5), by: mgrId(5) },
  })

  // Customer Support: published shift assigned to a casual worker, supervised by an employee
  await createShiftWithAssignees({
    dept: 3, start: '13:00', end: '21:00', title: 'Customer Hotline',
    instruction: 'Cover overflow calls.', pub: 'published',
    creator: mgrId(7),
    assignee: { u: empId(7), by: mgrId(7) },
  })

  // Operations: split shift (two non-contiguous blocks, same day) — UC9
  const splitGroupId = require('crypto').randomUUID()
  for (const block of [{ start: '09:00', end: '12:00' }, { start: '15:00', end: '18:00' }]) {
    const { data: splitShift, error: splitErr } = await supabase
      .from('shifts')
      .insert({
        company_id: company.id,
        department_id: depts[0].id,
        title: 'Lunch Rush Split Shift',
        instruction: 'Cover the morning and evening rush separately.',
        shift_date: SHIFT_DATE,
        start_time: block.start,
        end_time: block.end,
        status: 'active',
        publication_status: 'published',
        created_by: mgrId(2),
        split_group_id: splitGroupId,
      })
      .select()
      .single()
    if (splitErr) { console.warn(`  ⚠ split shift 创建失败: ${splitErr.message}`); continue }
    await supabase.from('shift_assignments').insert({ shift_id: splitShift.id, user_id: cwId(1), assigned_by: mgrId(2) })
    console.log(`  ✓ Split Shift block: ${block.start}-${block.end} @ ${SHIFT_DATE} (Operations)`)
  }

  // Engineering: a shift swap request pending review — UC for shift swap
  if (engShift && engShift.assignments[0]) {
    const { error: swapErr } = await supabase.from('shift_swap_requests').insert({
      company_id: company.id,
      shift_assignment_id: engShift.assignments[0].id,
      requester_id: mgrId(5),
      replacement_user_id: mgrId(6),
      reason: 'Personal appointment, requesting coverage swap.',
      status: 'pending',
    })
    if (swapErr) console.warn(`  ⚠ shift_swap_request 创建失败: ${swapErr.message}`)
    else console.log('  ✓ Shift Swap Request: manager5 → manager6 (pending)')
  }

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
  console.log('\n公司：Sunrise Hospitality Group')
  console.log('\n部门分配：')
  console.log('  Operations:       manager1,2 / employee1,2')
  console.log('  Marketing:        manager3,4 / employee3,4')
  console.log('  Engineering:      manager5,6 / employee5,6')
  console.log('  Customer Support: manager7,8 / employee7,8')
  console.log('\nCasual Workers：')
  console.log('  Active (7):   cw1~7@test.com')
  console.log('  Inactive (3): cw8~10@test.com（含 inactivate_reason）')
  console.log('\nShifts（2026-06-22）：')
  console.log('  Operations:       Operations Coverage（已发布，引用 Template）')
  console.log('  Operations:       Lunch Rush Split Shift（Split Shift，2 blocks）')
  console.log('  Marketing:        Marketing Coverage（draft，未分配）')
  console.log('  Engineering:      Engineering On-call（已发布，附带待审批的 Swap Request）')
  console.log('  Customer Support: Customer Hotline（已发布）')
}

main().catch(err => {
  console.error('\n✗ 脚本异常:', err.message)
  process.exit(1)
})
