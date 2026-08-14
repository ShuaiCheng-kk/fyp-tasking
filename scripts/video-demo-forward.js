/**
 * "Fast forward to the 15th" for the video demo.
 *
 *   node scripts/video-demo-forward.js
 *
 * The storyline posts a job for tomorrow, so nothing can be clocked into while recording. This
 * pulls that day's work back onto today instead of advancing any clock, so nothing is recreated and
 * nothing done on camera is lost. Job postings, applications, offers, acceptances, the guest's new
 * Casual Worker role: all untouched.
 *
 * What it moves, for EVERY worker's shift on the EARLIEST upcoming offer-generated date (Event
 * Setup & Breakdown alone confirms 5 people, not just the hero — a job posting with openings > 1
 * always can):
 *   · shift_date -> today. start_time stays whatever the job itself was posted with (10:00 for
 *     this one) — that is the job's own schedule, not something "fast forward" should touch.
 *   · each distinct job posting behind those shifts: job_date -> today, job_start_time UNCHANGED.
 *   · the supervising employee's own shift -> today, kept on a relative "started a while ago"
 *     window (not tied to the job's start time) so Clock In stays available whenever this
 *     actually gets run, rather than only near 10am.
 *
 * Clock-in split, matching how the recording actually plays out:
 *   · the hero (guest1) is left NOT clocked in — clocked in on camera by hand.
 *   · the supervising employee is left NOT clocked in — same, by hand.
 *   · every OTHER confirmed worker (the fillers, never appearing on camera themselves) gets
 *     clocked in by this script, a few minutes apart starting from the job's own start time, so
 *     they read as already on site rather than all landing on the exact same second.
 *
 * Only the earliest date moves. Anything confirmed for a LATER date (Room Cleaning's 16th) is
 * untouched — that is a separate, not-yet-scripted fast-forward of its own.
 *
 * Run it after the guest has accepted the offer. Running it earlier finds no shift to move.
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

// Employee's own shift stays relative to real "now" — it isn't tied to the job's schedule, and a
// fixed clock-in time would only be clickable near that hour on whatever real day this is run.
const EMP_START = (() => { const d = new Date(Date.now() - 45 * 60000); return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}` })()
const EMP_END = (() => { const d = new Date(Date.now() + 8 * 60 * 60000); return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}` })()

// Shift times are stored as Singapore wall-clock. "HH:MM" + 8 hours ahead of it is the matching
// UTC instant for TODAY_KEY — same relationship seed scripts elsewhere in this repo use.
function sgtTodayInstant(hm) {
  const [h, m] = hm.split(':').map(Number)
  return new Date(Date.parse(`${TODAY_KEY}T00:00:00Z`) + (h - 8) * 3600000 + m * 60000)
}
function addMinutes(hm, mins) {
  const [h, m] = hm.split(':').map(Number)
  const total = h * 60 + m + mins
  return `${pad(Math.floor(total / 60) % 24)}:${pad(total % 60)}`
}
function addHours(hm, hrs) {
  const [h, m] = hm.split(':').map(Number)
  return `${pad((h + hrs) % 24)}:${pad(m)}`
}

async function main() {
  console.log('\n═══ Fast forward to the job\'s day ═══\n')

  const { data: hero } = await supabase.from('users').select('id').eq('email_address', HERO_EMAIL).single()
  if (!hero) { console.error(`${HERO_EMAIL} not found.`); process.exit(1) }

  // ── Every casual worker's shift on the earliest upcoming date ────────────────
  // Created by workerApplicationService the moment each offer was accepted, and tagged with the
  // posting it came from. That tag is how we find them without guessing — but a posting can (and
  // here does) confirm more than one person, so this has to move all of them, not just [0].
  const { data: allCwShifts, error: shiftErr } = await supabase
    .from('shifts')
    .select('id, shift_date, start_time, end_time, source_job_posting_id, department_id, shift_assignments(id, user_id, users!shift_assignments_user_id_fkey(full_name))')
    .not('source_job_posting_id', 'is', null)
    .gte('shift_date', TODAY_KEY)
    .order('shift_date', { ascending: true })
  if (shiftErr) throw new Error(shiftErr.message)

  if (!allCwShifts || allCwShifts.length === 0) {
    console.error('No upcoming casual-worker shift found.')
    console.error('This runs AFTER the guest accepts their offer, and that acceptance is what creates the shift.\n')
    process.exit(1)
  }

  const earliestDate = allCwShifts[0].shift_date
  const cwShifts = allCwShifts.filter(s => s.shift_date === earliestDate)
  const departmentId = cwShifts[0].department_id
  console.log(`${cwShifts.length} worker(s) confirmed for ${earliestDate}:`)

  // Each shift's own job_start_time is what its start_time becomes — read once per distinct
  // posting rather than assumed, in case a later day ever mixes postings with different times.
  const jobIds = [...new Set(cwShifts.map(s => s.source_job_posting_id).filter(Boolean))]
  const jobStartById = new Map()
  for (const jobId of jobIds) {
    const { data: job } = await supabase.from('job_postings').select('id, job_start_time').eq('id', jobId).single()
    if (job?.job_start_time) jobStartById.set(jobId, job.job_start_time.slice(0, 5))
  }

  let clockInOffset = 3 // minutes after the job's start time, staggered per filler below
  for (const shift of cwShifts) {
    const jobStart = jobStartById.get(shift.source_job_posting_id) ?? shift.start_time.slice(0, 5)
    const jobEnd = addHours(jobStart, 8)
    const assignment = (shift.shift_assignments ?? [])[0]
    const name = assignment?.users?.full_name ?? shift.id
    const isHero = assignment?.user_id === hero.id

    const { error: upErr } = await supabase
      .from('shifts')
      .update({ shift_date: TODAY_KEY, start_time: jobStart, end_time: jobEnd, is_open_ended: true })
      .eq('id', shift.id)
    if (upErr) throw new Error(upErr.message)

    if (isHero) {
      console.log(`  ✓ ${name} (hero): ${shift.shift_date} ${shift.start_time} -> ${TODAY_KEY} ${jobStart}, NOT clocked in`)
      continue
    }
    if (!assignment) {
      console.log(`  ⚠ ${shift.id}: no shift_assignment row found, skipped clock-in`)
      continue
    }

    const { data: existingRecord } = await supabase
      .from('attendance_records')
      .select('id, clock_in_time')
      .eq('shift_assignment_id', assignment.id)
      .maybeSingle()
    if (existingRecord?.clock_in_time) {
      console.log(`  · ${name}: already clocked in, skipped`)
      continue
    }

    const clockIn = addMinutes(jobStart, clockInOffset)
    const { error: attErr } = await supabase.from('attendance_records').insert({
      shift_assignment_id: assignment.id,
      user_id: assignment.user_id,
      clock_in_time: sgtTodayInstant(clockIn).toISOString(),
    })
    if (attErr) throw new Error(`clocking in ${name}: ${attErr.message}`)
    console.log(`  ✓ ${name}: ${shift.shift_date} ${shift.start_time} -> ${TODAY_KEY} ${jobStart}, clocked in ${clockIn}`)
    clockInOffset += 4
  }
  console.log()

  // ── Every distinct job posting behind those shifts ───────────────────────────
  // Only the date moves — job_start_time is the job's own schedule (10:00 for this one), not
  // something "fast forward" should be touching.
  for (const jobId of jobIds) {
    const { data: job } = await supabase
      .from('job_postings')
      .select('id, title, job_date')
      .eq('id', jobId)
      .single()
    if (job) {
      await supabase.from('job_postings').update({ job_date: TODAY_KEY }).eq('id', job.id)
      console.log(`Job posting: "${job.title}"`)
      console.log(`  → ${job.job_date} becomes ${TODAY_KEY} (start time unchanged: ${jobStartById.get(jobId)})\n`)
    }
  }

  // ── The supervising employee's shift ───────────────────────────────────────
  // Every Employee/Manager page locks to read-only once its owner clocked out of their most recent
  // shift, clearing only on their next Clock In. The supervisor has to be able to clock in today
  // or they can't assign a single task. Left NOT clocked in — clocked in on camera by hand.
  // Matched to earliestDate specifically, not just "whatever's soonest" — a department can have
  // more than one of these (this one's own 16th-Aug supervisor-availability shift for Room
  // Cleaning is a real example), and grabbing the wrong one silently steals a day this same
  // script will need to move correctly later.
  const { data: supShifts } = await supabase
    .from('shifts')
    .select('id, shift_date, start_time, end_time')
    .is('source_job_posting_id', null)
    .eq('department_id', departmentId)
    .eq('shift_date', earliestDate)

  if (supShifts && supShifts.length > 0) {
    const sup = supShifts[0]
    await supabase
      .from('shifts')
      .update({ shift_date: TODAY_KEY, start_time: EMP_START, end_time: EMP_END, is_open_ended: true })
      .eq('id', sup.id)
    console.log(`Supervisor shift: ${sup.shift_date} ${sup.start_time}-${sup.end_time}`)
    console.log(`  → moved to ${TODAY_KEY} ${EMP_START}, open-ended, NOT clocked in\n`)
  } else {
    console.log('No separate supervisor shift to move, the one already on today will do.\n')
  }

  // ── What survived ──────────────────────────────────────────────────────────
  const [{ count: jobCount }, { count: appCount }, { count: cwCount }] = await Promise.all([
    supabase.from('job_postings').select('*', { count: 'exact', head: true }),
    supabase.from('job_applicants').select('*', { count: 'exact', head: true }),
    supabase.from('users').select('*', { count: 'exact', head: true }).eq('role', 'Casual Worker'),
  ])

  console.log('Untouched:')
  console.log(`  job postings ....... ${jobCount}`)
  console.log(`  applications ....... ${appCount}`)
  console.log(`  casual workers ..... ${cwCount}`)
  console.log('\nNext on camera:')
  console.log('  1. Employee: Clock In by hand, then assign the tasks')
  console.log(`  2. ${HERO_EMAIL}: Clock In by hand, work the board`)
  console.log('  3. Employee: review, reject one with a reason, approve the redo')
  console.log('  4. Employee: release clock-out; Casual Worker clocks out')
  console.log('  5. Owner: post a job and Invite from Pool\n')
}

main().catch(err => { console.error(err.message); process.exit(1) })
