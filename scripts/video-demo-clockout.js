/**
 * Clocks out every filler Casual Worker left over from video-demo-forward.js — for the video demo.
 *
 *   node scripts/video-demo-clockout.js
 *
 * video-demo-forward.js clocks the fillers IN but deliberately leaves them clocked in (only the
 * hero, guest1, gets a real on-camera Clock In -> work -> Clock Out). That's fine for the flow up
 * to "Manager: check attendance" — but the later "Owner: post a job, Invite from Pool" step needs
 * every filler to actually show up in the pool, and entering the pool is NOT just "has a
 * clock_out_time": casualAttendanceService.clockOut does two writes on a worker's first ever
 * clock-out —
 *   1. attendance_records.clock_out_time
 *   2. casualworker_departments.verified_at (only the pool-inclusion query in
 *      recruitmentRepository.getVerifiedPoolWorkers actually checks this column — the attendance
 *      record itself is just display metadata, completed_shifts/last_worked_date)
 * A script that only fills in clock_out_time and skips verified_at would leave the fillers clocked
 * out but still invisible in the pool. This does both, matching the real service exactly, so we
 * don't need to click through every filler's own page by hand.
 *
 * Run this at the "Manager: check attendance" pause point, AFTER the hero (guest1) has already
 * been released and clocked out by hand on camera — this script explicitly skips the hero, since
 * their record is the one real one the recording shows.
 */
const { createClient } = require('@supabase/supabase-js')

require('dotenv').config({ path: '.env.local' })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SERVICE_ROLE_KEY) {
  console.error('SUPABASE_SERVICE_ROLE_KEY is required (set it in .env.local)')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } })

const HERO_EMAIL = 'guest1@test.com'

const pad = n => String(n).padStart(2, '0')
const dateKey = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const TODAY_KEY = dateKey(new Date())

// Shift times are stored as Singapore wall-clock. "HH:MM" + 8 hours ahead of it is the matching
// UTC instant for TODAY_KEY — same helper video-demo-forward.js uses.
function sgtTodayInstant(hm) {
  const [h, m] = hm.split(':').map(Number)
  return new Date(Date.parse(`${TODAY_KEY}T00:00:00Z`) + (h - 8) * 3600000 + m * 60000)
}

async function main() {
  console.log('\n═══ Clock out the fillers, verify them into the pool ═══\n')

  const { data: hero } = await supabase.from('users').select('id').eq('email_address', HERO_EMAIL).single()
  if (!hero) { console.error(`${HERO_EMAIL} not found.`); process.exit(1) }

  // Same source as video-demo-forward.js: every casual-worker shift on TODAY_KEY that came from an
  // accepted offer, with its attendance record and department.
  const { data: shifts, error: shiftErr } = await supabase
    .from('shifts')
    .select('id, department_id, end_time, shift_assignments(id, user_id, users!shift_assignments_user_id_fkey(full_name))')
    .not('source_job_posting_id', 'is', null)
    .eq('shift_date', TODAY_KEY)
  if (shiftErr) throw new Error(shiftErr.message)

  if (!shifts || shifts.length === 0) {
    console.error(`No casual-worker shift found for today (${TODAY_KEY}).`)
    console.error('Run this AFTER video-demo-forward.js has moved the shifts onto today.\n')
    process.exit(1)
  }

  for (const shift of shifts) {
    const assignment = (shift.shift_assignments ?? [])[0]
    if (!assignment) continue
    const name = assignment.users?.full_name ?? assignment.user_id
    if (assignment.user_id === hero.id) {
      console.log(`  · ${name} (hero): skipped, released/clocked out by hand on camera`)
      continue
    }

    const { data: record } = await supabase
      .from('attendance_records')
      .select('id, clock_in_time, clock_out_time')
      .eq('shift_assignment_id', assignment.id)
      .maybeSingle()
    if (!record || !record.clock_in_time) {
      console.log(`  ⚠ ${name}: not clocked in yet, skipped (run video-demo-forward.js first)`)
      continue
    }
    if (record.clock_out_time) {
      console.log(`  · ${name}: already clocked out, skipped`)
      continue
    }

    const clockOut = shift.end_time.slice(0, 5)
    const { error: attErr } = await supabase
      .from('attendance_records')
      .update({ clock_out_released: true, clock_out_time: sgtTodayInstant(clockOut).toISOString() })
      .eq('id', record.id)
    if (attErr) throw new Error(`clocking out ${name}: ${attErr.message}`)

    // Matches casualAttendanceService.clockOut exactly — no-op once verified_at is already set,
    // same as a real second clock-out would be.
    const { error: verifyErr } = await supabase
      .from('casualworker_departments')
      .update({ verified_at: new Date().toISOString() })
      .eq('casual_worker_id', assignment.user_id)
      .eq('department_id', shift.department_id)
      .is('verified_at', null)
    if (verifyErr) throw new Error(`verifying ${name}: ${verifyErr.message}`)

    console.log(`  ✓ ${name}: clocked out ${clockOut}, verified into the pool`)
  }

  console.log('\nNext on camera:')
  console.log('  Owner: post a job and Invite from Pool — all 5 workers should now appear.\n')
}

main().catch(err => { console.error(err.message); process.exit(1) })
