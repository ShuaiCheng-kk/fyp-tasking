/**
 * Backfill accepted company invites into department membership tables.
 *
 * This repairs older data created before invite acceptance started syncing
 * `manager_departments` / `employee_departments` and `users.department_id`.
 */

const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')

function loadLocalEnv() {
  for (const filename of ['.env.local', '.env']) {
    const fullPath = path.join(process.cwd(), filename)
    if (!fs.existsSync(fullPath)) continue
    const content = fs.readFileSync(fullPath, 'utf8')
    for (const line of content.split(/\r?\n/)) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const eqIdx = trimmed.indexOf('=')
      if (eqIdx === -1) continue
      const key = trimmed.slice(0, eqIdx).trim()
      const value = trimmed
        .slice(eqIdx + 1)
        .trim()
        .replace(/\s+#.*$/, '')
        .replace(/^["']|["']$/g, '')
      if (key && !process.env[key]) process.env[key] = value
    }
  }
}

loadLocalEnv()

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  throw new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required')
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

async function main() {
  const { data: invites, error } = await supabase
    .from('inbox')
    .select('id, recipient_user_id, company_id, role, department_id, status')
    .eq('type', 'company_invite')
    .eq('status', 'accepted')

  if (error) throw error

  let managerSynced = 0
  let employeeSynced = 0
  let userDeptUpdated = 0

  for (const invite of invites ?? []) {
    if (!invite.department_id) continue

    const { data: user, error: userErr } = await supabase
      .from('users')
      .select('id, role, department_id')
      .eq('id', invite.recipient_user_id)
      .single()

    if (userErr || !user) continue

    const role = String(invite.role ?? '').toLowerCase()

    if (role === 'manager') {
      const { error: mdErr } = await supabase
        .from('manager_departments')
        .upsert(
          { manager_id: user.id, company_id: invite.company_id, department_id: invite.department_id },
          { onConflict: 'manager_id,department_id' },
        )
      if (!mdErr) managerSynced += 1
    }

    if (role === 'employee') {
      const { error: edErr } = await supabase
        .from('employee_departments')
        .upsert(
          { employee_id: user.id, department_id: invite.department_id },
          { onConflict: 'employee_id,department_id' },
        )
      if (!edErr) employeeSynced += 1
    }

    if (user.department_id !== invite.department_id) {
      const { error: updateErr } = await supabase
        .from('users')
        .update({ department_id: invite.department_id })
        .eq('id', user.id)
      if (!updateErr) userDeptUpdated += 1
    }
  }

  console.log(`Backfill complete. manager_synced=${managerSynced} employee_synced=${employeeSynced} users_updated=${userDeptUpdated}`)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
