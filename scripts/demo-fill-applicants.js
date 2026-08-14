/**
 * Demo helper: "fast forward" a freshly posted job so it has a realistic pile of applicants.
 *
 * A job posted live during the demo has nobody in it, so AI Assessment has nothing to rank.
 * Pause the recording after the Owner approves the posting, run this, then carry on: the
 * Manager's applicant panel will show a full list, and the hero guest applies on camera as usual.
 *
 *   node scripts/demo-fill-applicants.js --job "Event Setup"   # before guest1 applies to this one
 *   node scripts/demo-fill-applicants.js --job "Room Cleaning" # before guest1 applies to this one
 *
 * Run it once per job, each time right before the hero applies through the UI — their worker
 * profile gets rewritten to mirror whichever job --job matched, so the snapshot the AI actually
 * scores (job_applicants.skills, captured at apply time, not the live profile) carries the right
 * text for THAT job. Applying to the other job later without re-running this would leave the
 * hero's profile pointed at the wrong posting.
 *
 * Filler accounts (guest2..guest9) are created on first use if they don't exist yet — the minimal
 * video-demo-seed.js only creates the four named accounts, not these.
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
const PASSWORD = '111111'
const DEMO_PHOTO_URL = 'https://api.dicebear.com/7.x/avataaars/svg?seed=demo'

function arg(flag, fallback) {
  const i = process.argv.indexOf(flag)
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback
}

const JOB_MATCH = arg('--job', null)
const HERO_EMAIL = arg('--hero', 'guest1@test.com')

// Two real postings this demo uses, each with its own applicant pool sized to how the Owner will
// actually decide: Event Setup & Breakdown posts 5 openings, so 4 fillers plus the hero fill every
// slot (all genuinely accept-worthy) while 2 more sit there specifically to be passed over on
// camera. Room Cleaning posts only 1 opening, so 2 fillers are enough to make the shortlist real
// without anyone else being a plausible pick over the hero's hotel-specific note.
const JOB_FILLER_SETS = [
  {
    match: title => /event setup/i.test(title),
    fillers: [
      { email: 'guest2@test.com', full_name: 'Marcus Tan', accept: true,
        skills: 'Event crew experience setting up tables, chairs and signage for functions, comfortable lifting and carrying equipment, follows a floor plan precisely.',
        certificates: [], note: "I've worked event crews for weddings and corporate functions before, know how to move fast before doors open." },
      { email: 'guest3@test.com', full_name: 'Aisha Rahman', accept: true,
        skills: 'Physically fit, used to moving furniture and equipment for large functions, works well under time pressure as part of a small team.',
        certificates: [{ name: 'First Aid Certificate', certificate_url: null }], note: 'Done setup and teardown for community hall bookings a few times.' },
      { email: 'guest4@test.com', full_name: 'Kelvin Ong', accept: true,
        skills: 'Warehouse and logistics background: heavy lifting, loading bay work, following exact instructions and layouts.',
        certificates: [], note: 'Not event-specific experience, but very used to physical labor and precise setups.' },
      { email: 'guest5@test.com', full_name: 'Nurul Huda', accept: true,
        skills: 'Hospitality floor staff experience, comfortable setting up function rooms and clearing venues quickly, works efficiently in a team.',
        certificates: [], note: 'Helped set up banquet rooms at a hotel before the actual event started.' },
      { email: 'guest6@test.com', full_name: 'Jason Teo', accept: false,
        skills: 'Data entry and customer support experience, mostly desk-based administrative work.',
        certificates: [], note: 'Looking to try something different from office work, no hands-on event experience yet.' },
      { email: 'guest7@test.com', full_name: 'Priya Raman', accept: false,
        skills: 'Graphic design and social media content creation.',
        certificates: [], note: "Interested in the events industry but haven't done physical setup work before." },
    ],
  },
  {
    match: title => /room cleaning/i.test(title),
    fillers: [
      { email: 'guest8@test.com', full_name: 'Wei Ling Tan', accept: false,
        skills: 'General housekeeping experience, comfortable with repetitive cleaning tasks and standing for long periods.',
        certificates: [], note: 'Done home cleaning services before, new to hotel-standard turnover work.' },
      { email: 'guest9@test.com', full_name: 'Farah Aziz', accept: false,
        skills: 'Customer-facing hospitality experience at a hotel front desk, some exposure to housekeeping standards.',
        certificates: [], note: 'Mostly front desk experience, limited hands-on room cleaning so far.' },
    ],
  },
]

// Falls back here if --job matches neither posting above, e.g. testing against the unused third
// template. Generic, off-target on purpose — see the module header on why that's the point.
const DEFAULT_FILLERS = [
  { email: 'guest2@test.com', full_name: 'Marcus Tan', accept: true,
    skills: 'Retail merchandising, stock replenishment, cashier experience.',
    certificates: [], note: 'Hi, I have retail floor experience and I am available on the day.' },
  { email: 'guest3@test.com', full_name: 'Aisha Rahman', accept: true,
    skills: 'Warehouse picking, forklift operation, heavy lifting.',
    certificates: [], note: 'I have done warehouse shifts before and can start early.' },
]

// phone_number carries a unique constraint, so every filler needs a distinct one — derived from
// the email's numeric suffix (guest2 -> ...0002) rather than hardcoded, so adding a filler never
// needs a manually-picked next number.
function phoneFor(email) {
  const n = (email.match(/\d+/) || ['0'])[0].padStart(4, '0')
  return `+65 8100 ${n}`
}

async function ensureAccountExists(filler) {
  const { data: existingUser } = await supabase
    .from('users')
    .select('id, full_name')
    .eq('email_address', filler.email)
    .single()
  if (existingUser) return existingUser

  const { data: authList } = await supabase.auth.admin.listUsers({ perPage: 1000 })
  let authId = (authList?.users ?? []).find(u => u.email === filler.email)?.id
  if (authId) {
    await supabase.auth.admin.updateUserById(authId, { password: PASSWORD, email_confirm: true })
  } else {
    const { data, error } = await supabase.auth.admin.createUser({ email: filler.email, password: PASSWORD, email_confirm: true })
    if (error || !data.user) throw new Error(`creating auth account for ${filler.email}: ${error?.message}`)
    authId = data.user.id
  }

  const { data: row, error } = await supabase.from('users').insert({
    supabase_auth_id: authId,
    full_name: filler.full_name,
    email_address: filler.email,
    phone_number: phoneFor(filler.email),
    date_of_birth: '1998-01-01',
    profile_photo_url: DEMO_PHOTO_URL,
    role: 'Guest User',
    company_id: null,
  }).select().single()
  if (error) throw new Error(`creating users row for ${filler.email}: ${error.message}`)
  return row
}

async function main() {
  console.log('\n═══ Demo: fill a freshly posted job with applicants ═══\n')

  // ── The job ────────────────────────────────────────────────────────────────
  let query = supabase
    .from('job_postings')
    .select('id, title, skills, responsibilities, status, created_at')
    .eq('status', 'open')
    .order('created_at', { ascending: false })
  if (JOB_MATCH) query = query.ilike('title', `%${JOB_MATCH}%`)

  const { data: jobs, error: jobErr } = await query.limit(1)
  if (jobErr) throw new Error(jobErr.message)
  if (!jobs || jobs.length === 0) {
    console.error(JOB_MATCH
      ? `No open job matching "${JOB_MATCH}".`
      : 'No open job found. Approve the posting first, then run this.')
    process.exit(1)
  }
  const job = jobs[0]
  console.log(`Job:  ${job.title}`)
  console.log(`      posted ${new Date(job.created_at).toLocaleString()}\n`)

  const fillerSet = JOB_FILLER_SETS.find(s => s.match(job.title))
  const fillers = fillerSet ? fillerSet.fillers : DEFAULT_FILLERS
  if (!fillerSet) console.log('(no tailored filler set for this title, using the generic fallback)\n')

  // ── The hero ───────────────────────────────────────────────────────────────
  const { data: hero } = await supabase
    .from('users')
    .select('id, full_name, email_address')
    .eq('email_address', HERO_EMAIL)
    .single()
  if (!hero) {
    console.error(`Hero account ${HERO_EMAIL} not found.`)
    process.exit(1)
  }

  // Mirror the posting's own requirements onto the hero's LIVE profile. AI Assessment scores the
  // job_applicants.skills snapshot captured at apply time, not this live value, so this only
  // matters for whichever application happens next through the UI — re-run this before applying
  // to the other job, or the second application carries the first job's mirrored text.
  const heroSkills = (job.skills || job.responsibilities || '').trim()
  if (heroSkills) {
    const { error: profErr } = await supabase
      .from('casual_worker_profiles')
      .upsert({ user_id: hero.id, skills: heroSkills.slice(0, 500) }, { onConflict: 'user_id' })
    if (profErr) console.warn(`  ⚠ could not update hero profile: ${profErr.message}`)
    else console.log(`Hero: ${hero.full_name} (${HERO_EMAIL}), profile matched to this job`)
  } else {
    console.log(`Hero: ${hero.full_name} (${HERO_EMAIL}), job has no skills text, profile left as is`)
  }
  console.log('      NOT pre-applied. Apply through the UI on camera, with the notes already written for this job.\n')

  // ── The fillers ────────────────────────────────────────────────────────────
  const { data: existing } = await supabase
    .from('job_applicants')
    .select('user_id')
    .eq('job_id', job.id)
  const alreadyApplied = new Set((existing ?? []).map(r => r.user_id))

  let added = 0
  for (const filler of fillers) {
    if (filler.email === HERO_EMAIL) continue

    const user = await ensureAccountExists(filler)
    if (alreadyApplied.has(user.id)) { console.log(`  · ${user.full_name}: already applied, skipped`); continue }

    // Keep the live profile and the application snapshot consistent: the Worker Pool and the
    // applicant card would otherwise disagree about the same person.
    await supabase
      .from('casual_worker_profiles')
      .upsert({ user_id: user.id, skills: filler.skills }, { onConflict: 'user_id' })

    const { error: insErr } = await supabase.from('job_applicants').insert({
      job_id: job.id,
      user_id: user.id,
      status: 'pending',
      skills: filler.skills,
      certificates: filler.certificates,
      additional_note: filler.note,
      applied_at: new Date(Date.now() - (added + 1) * 7 * 60000).toISOString(),
    })
    if (insErr) { console.warn(`  ⚠ ${user.full_name}: ${insErr.message}`); continue }

    console.log(`  ${filler.accept ? '✓ accept' : '✗ reject'}  ${user.full_name}: ${filler.skills}`)
    added++
  }

  const acceptCount = fillers.filter(f => f.accept).length
  console.log(`\n${added} applicant(s) added. With the hero applying live, the panel will show ${added + 1}.`)
  console.log(`Intended outcome: hero + ${acceptCount} filler(s) accepted, ${fillers.length - acceptCount} passed over.`)
  console.log('\nNext on camera:')
  console.log(`  1. ${HERO_EMAIL} applies for "${job.title}" with the matching note`)
  console.log('  2. Manager opens the applicant panel, now a real shortlist')
  console.log('  3. Run AI Assessment; the hero should rank at the top')
  console.log('  4. Accept the hero and the marked filler(s), pass over the rest\n')
}

main().catch(err => { console.error(err.message); process.exit(1) })
