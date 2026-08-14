/**
 * Demo helper — "fast forward" a freshly posted job so it has a realistic pile of applicants.
 *
 * A job posted live during the demo has nobody in it, so AI Assessment has nothing to rank.
 * Pause the recording after the Owner approves the posting, run this, then carry on: the
 * Manager's applicant panel will show a full list, and the hero guest applies on camera as usual.
 *
 *   node scripts/demo-fill-applicants.js                        # newest open job
 *   node scripts/demo-fill-applicants.js --job "Weekend"        # match by title
 *   node scripts/demo-fill-applicants.js --hero guest2@test.com # someone else is the protagonist
 *
 * The hero is deliberately left OUT of the inserted list — they apply through the UI so the
 * audience sees it happen. Their worker profile is rewritten to mirror the job's own requirements
 * first, so when AI Assessment runs they rank at the top and picking them reads as following the
 * recommendation rather than overriding it.
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

function arg(flag, fallback) {
  const i = process.argv.indexOf(flag)
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback
}

const JOB_MATCH = arg('--job', null)
const HERO_EMAIL = arg('--hero', 'guest1@test.com')

// Competent but off-target: each one is plausible enough to be worth reading, and none of them
// mirror the posting the way the hero's rewritten profile does — so the ranking has somewhere to go.
const FILLERS = [
  {
    email: 'guest2@test.com',
    skills: 'Retail merchandising, Stock replenishment, Cashier experience',
    certificates: [{ name: 'Retail Operations Certificate', certificate_url: null }],
    note: 'Hi, I have retail floor experience and I am available on the day.',
  },
  {
    email: 'guest3@test.com',
    skills: 'Warehouse picking, Forklift operation, Heavy lifting',
    certificates: [{ name: 'Forklift Licence', certificate_url: null }],
    note: 'I have done warehouse shifts before and can start early.',
  },
  {
    email: 'guest4@test.com',
    skills: 'Photography, Social media content, Canva',
    certificates: [{ name: 'First Aid Certificate', certificate_url: null }],
    note: 'Happy to help out, I pick things up quickly.',
  },
  {
    email: 'guest5@test.com',
    skills: 'PC hardware, Networking basics, Troubleshooting',
    certificates: [{ name: 'CompTIA A+', certificate_url: null }],
    note: 'Available for the shift and reliable with timekeeping.',
  },
]

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

  // Mirror the posting's own requirements onto the hero's profile. AI Assessment compares the
  // applicant's skills against the job's, so this is what puts them first — without it the hero
  // carries whatever unrelated skills the seed gave them and can rank below the fillers, which
  // makes accepting them look like ignoring the AI.
  const heroSkills = (job.skills || job.responsibilities || '').trim()
  if (heroSkills) {
    const { error: profErr } = await supabase
      .from('casual_worker_profiles')
      .upsert({ user_id: hero.id, skills: heroSkills.slice(0, 500) }, { onConflict: 'user_id' })
    if (profErr) console.warn(`  ⚠ could not update hero profile: ${profErr.message}`)
    else console.log(`Hero: ${hero.full_name} (${HERO_EMAIL}) — profile matched to this job`)
  } else {
    console.log(`Hero: ${hero.full_name} (${HERO_EMAIL}) — job has no skills text, profile left as is`)
  }
  console.log('      NOT pre-applied. Apply through the UI on camera.\n')

  // ── The fillers ────────────────────────────────────────────────────────────
  const { data: existing } = await supabase
    .from('job_applicants')
    .select('user_id')
    .eq('job_id', job.id)
  const alreadyApplied = new Set((existing ?? []).map(r => r.user_id))

  let added = 0
  for (const filler of FILLERS) {
    if (filler.email === HERO_EMAIL) continue

    const { data: user } = await supabase
      .from('users')
      .select('id, full_name')
      .eq('email_address', filler.email)
      .single()
    if (!user) { console.log(`  · ${filler.email} — no such account, skipped`); continue }
    if (alreadyApplied.has(user.id)) { console.log(`  · ${user.full_name} — already applied, skipped`); continue }

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

    console.log(`  ✓ ${user.full_name} — ${filler.skills}`)
    added++
  }

  console.log(`\n${added} applicant(s) added. With the hero applying live, the panel will show ${added + 1}.`)
  console.log('\nNext on camera:')
  console.log(`  1. ${HERO_EMAIL} applies for "${job.title}"`)
  console.log('  2. Manager opens the applicant panel — now a real shortlist')
  console.log('  3. Run AI Assessment; the hero should rank at the top')
  console.log('  4. Accept the hero\n')
}

main().catch(err => { console.error(err.message); process.exit(1) })
