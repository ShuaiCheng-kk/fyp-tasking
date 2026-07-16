/**
 * scripts/delete-user.js — 按邮箱一键删除一个测试账号（auth + public.users + 关联数据）
 *
 * 用途：反复用同一个真实邮箱（如 zino1625441786@gmail.com）测试 Guest User 注册时，
 * 不用再去 Supabase Dashboard 的 Authentication → Users 和 users 表里手动找、手动删。
 *
 * 使用方法：
 *   node scripts/delete-user.js                          # 默认删 zino1625441786@gmail.com
 *   node scripts/delete-user.js someone@example.com      # 删指定邮箱
 *
 * 安全护栏：演示种子账号（@test.com / @tasking.com）拒绝删除，防止误伤 seed 数据。
 */

const { createClient } = require('@supabase/supabase-js')

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
  || 'https://qnpwuipwyidslxndgewg.supabase.co'

const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
  || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFucHd1aXB3eWlkc2x4bmRnZXdnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODA2MDE3NCwiZXhwIjoyMDkzNjM2MTc0fQ.YSQMxKFiAmSlBcQ0tAtU07MnuViwpalADYhpfGxOskU'

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const email = (process.argv[2] || 'zino1625441786@gmail.com').trim().toLowerCase()

if (email.endsWith('@test.com') || email.endsWith('@tasking.com')) {
  console.error(`✗ ${email} 是种子演示账号，拒绝删除（请用 node scripts/seed.js 整体重建）`)
  process.exit(1)
}

// 按 FK 依赖顺序列出可能挂在这个用户身上的数据（Guest 注册测试通常只命中前几张，
// 但都尝试一遍，删过 Casual Worker 阶段的账号也能一次清干净）。
async function deleteWhere(table, column, value) {
  const { error, count } = await supabase
    .from(table)
    .delete({ count: 'exact' })
    .eq(column, value)
  if (error) console.warn(`  ⚠ ${table}.${column} 清理失败: ${error.message}`)
  else if (count > 0) console.log(`  ✓ ${table}: 删除 ${count} 行（${column}）`)
}

async function main() {
  console.log(`删除账号: ${email}\n`)

  // ── public.users 行及其关联数据 ──
  const { data: userRow, error: findErr } = await supabase
    .from('users')
    .select('id, full_name, role')
    .eq('email_address', email)
    .maybeSingle()
  if (findErr) { console.error(`✗ 查询 users 失败: ${findErr.message}`); process.exit(1) }

  if (!userRow) {
    console.log('· public.users 中没有这个邮箱的行（可能只注册到一半），跳过业务数据清理')
  } else {
    console.log(`· 找到 users 行: ${userRow.full_name ?? '(无名)'} [${userRow.role}] ${userRow.id}`)
    const uid = userRow.id

    // job_invitations 通过 applicant_id 指向 job_applicants，先删邀请再删申请
    const { data: applicants } = await supabase.from('job_applicants').select('id').eq('user_id', uid)
    for (const a of applicants ?? []) {
      await deleteWhere('job_invitations', 'applicant_id', a.id)
    }
    await deleteWhere('job_applicants', 'user_id', uid)
    await deleteWhere('user_certificates', 'user_id', uid)
    await deleteWhere('attendance_records', 'casual_worker_id', uid)
    await deleteWhere('shift_assignments', 'user_id', uid)
    await deleteWhere('casualworker_departments', 'casual_worker_id', uid)
    await deleteWhere('inbox', 'recipient_user_id', uid)
    await deleteWhere('inbox', 'sender_user_id', uid)
    await deleteWhere('messages', 'from_user_id', uid)
    await deleteWhere('messages', 'to_user_id', uid)

    const { error: uErr } = await supabase.from('users').delete().eq('id', uid)
    if (uErr) { console.error(`✗ 删除 users 行失败: ${uErr.message}`); process.exit(1) }
    console.log('  ✓ users: 行已删除')
  }

  // ── auth.users ──
  let deleted = false
  for (let page = 1; ; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 })
    if (error) { console.error(`✗ listUsers 失败: ${error.message}`); process.exit(1) }
    const match = (data?.users ?? []).find(u => (u.email || '').toLowerCase() === email)
    if (match) {
      const { error: delErr } = await supabase.auth.admin.deleteUser(match.id)
      if (delErr) { console.error(`✗ 删除 auth 用户失败: ${delErr.message}`); process.exit(1) }
      console.log(`  ✓ auth: 已删除 ${match.id}`)
      deleted = true
      break
    }
    if (!data?.users?.length || data.users.length < 1000) break
  }
  if (!deleted) console.log('· auth.users 中没有这个邮箱（无需删除）')

  console.log(`\n✓ 完成 —— ${email} 可以重新注册了`)
}

main()
