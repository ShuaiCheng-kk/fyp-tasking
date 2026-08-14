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
 * What it moves:
 *   · the shift created when the worker accepted their offer  -> today, starting a moment ago
 *   · the supervising employee's own shift for that day        -> today, open-ended
 *   · the job posting's own date fields                        -> today, so detail views agree
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

const pad = n => String(n).padStart(2, '0')
const dateKey = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const toHM = d => `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`

const TODAY_KEY = dateKey(new Date())
// Started a while ago so Clock In is open immediately; open-ended so Clock Out never waits on a
// clock, only on the supervisor's release.
const START = toHM(new Date(Date.now() - 45 * 60000))
const END = toHM(new Date(Date.now() + 8 * 60 * 60000))

async function main() {
  console.log('\n═══ Fast forward to the job\'s day ═══\n')

  // ── The casual worker's shift ──────────────────────────────────────────────
  // Created by workerApplicationService the moment the offer was accepted, and tagged with the
  // posting it came from. That tag is how we find it without guessing.
  const { data: cwShifts, error: shiftErr } = await supabase
    .from('shifts')
    .select('id, shift_date, start_time, end_time, source_job_posting_id, department_id')
    .not('source_job_posting_id', 'is', null)
    .gte('shift_date', TODAY_KEY)
    .order('shift_date', { ascending: true })
  if (shiftErr) throw new Error(shiftErr.message)

  if (!cwShifts || cwShifts.length === 0) {
    console.error('No upcoming casual-worker shift found.')
    console.error('This runs AFTER the guest accepts their offer, and that acceptance is what creates the shift.\n')
    process.exit(1)
  }

  const shift = cwShifts[0]
  console.log(`Casual worker shift: ${shift.shift_date} ${shift.start_time}-${shift.end_time}`)

  const { error: upErr } = await supabase
    .from('shifts')
    .update({ shift_date: TODAY_KEY, start_time: START, end_time: END, is_open_ended: true })
    .eq('id', shift.id)
  if (upErr) throw new Error(upErr.message)
  console.log(`  → moved to ${TODAY_KEY} ${START}, open-ended\n`)

  // ── The job posting's own dates ────────────────────────────────────────────
  // Detail views read these, so leaving them on the old date makes the posting contradict the
  // shift it produced.
  if (shift.source_job_posting_id) {
    const { data: job } = await supabase
      .from('job_postings')
      .select('id, title, job_date, job_start_time')
      .eq('id', shift.source_job_posting_id)
      .single()
    if (job) {
      await supabase
        .from('job_postings')
        .update({ job_date: TODAY_KEY, job_start_time: START })
        .eq('id', job.id)
      console.log(`Job posting: "${job.title}"`)
      console.log(`  → ${job.job_date} ${job.job_start_time} becomes ${TODAY_KEY} ${START}\n`)
    }
  }

  // ── The supervising employee's shift ───────────────────────────────────────
  // Every Employee/Manager page locks to read-only once its owner clocked out of their most recent
  // shift, clearing only on their next Clock In. The supervisor has to be able to clock in today
  // or they can't assign a single task.
  const { data: supShifts } = await supabase
    .from('shifts')
    .select('id, shift_date, start_time, end_time')
    .is('source_job_posting_id', null)
    .eq('department_id', shift.department_id)
    .gt('shift_date', TODAY_KEY)
    .order('shift_date', { ascending: true })
    .limit(1)

  if (supShifts && supShifts.length > 0) {
    const sup = supShifts[0]
    await supabase
      .from('shifts')
      .update({ shift_date: TODAY_KEY, start_time: START, end_time: END, is_open_ended: true })
      .eq('id', sup.id)
    console.log(`Supervisor shift: ${sup.shift_date} ${sup.start_time}-${sup.end_time}`)
    console.log(`  → moved to ${TODAY_KEY} ${START}, open-ended\n`)
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
  console.log('  1. Employee: Clock In, then assign the tasks')
  console.log('  2. Casual Worker: Clock In, work the board')
  console.log('  3. Employee: review, reject one with a reason, approve the redo')
  console.log('  4. Employee: release clock-out; Casual Worker clocks out')
  console.log('  5. Owner: post a job and Invite from Pool\n')
}

main().catch(err => { console.error(err.message); process.exit(1) })
