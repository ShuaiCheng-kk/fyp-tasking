/**
 * Demo helper: after the hero (guest1) has accepted Event Setup & Breakdown and declined Room
 * Cleaning through the UI, push the OTHER applicants from demo-fill-applicants.js through the same
 * real offer -> confirm flow so both jobs end up properly staffed, without touching guest1's own
 * rows.
 *
 *   node scripts/demo-fillers-confirm.js
 *
 * Run this ONLY after the hero has responded to both offers on camera. It never reads or writes
 * anything belonging to guest1@test.com — every action here is scoped to the OTHER named fillers
 * by their own emails.
 *
 * This calls the real /api/recruitment (Owner accepts an applicant) and
 * /api/guest/applications/.../respond (worker confirms) routes over HTTP, signed in as the actual
 * account each step needs, rather than hand-writing the equivalent SQL. Accepting an offer isn't a
 * status flag flip: it promotes the guest to Casual Worker, creates a real shift via shiftService,
 * checks First-Come-First-Served against the posting's openings, and auto-closes the posting once
 * every opening is filled. Replicating that by hand risks missing a step; going through the same
 * endpoints the real UI hits guarantees it happens exactly the way it would on camera.
 *
 * Also adds one job posting from an unrelated company, dated the 15th, so the public job board
 * doesn't look like a single-employer platform.
 */
const { createClient } = require('@supabase/supabase-js')
const { createServerClient } = require('@supabase/ssr')

require('dotenv').config({ path: '.env.local' })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const APP_URL = process.env.DEMO_APP_URL || 'http://localhost:3000'
if (!SERVICE_ROLE_KEY || !ANON_KEY) {
  console.error('SUPABASE_SERVICE_ROLE_KEY and NEXT_PUBLIC_SUPABASE_ANON_KEY are required (.env.local)')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const PASSWORD = '111111'
const HERO_EMAIL = 'guest1@test.com'

// ── Real session, the same way the browser gets one ─────────────────────────────────────────────
const cookieCache = new Map()
async function sessionCookieFor(email) {
  if (cookieCache.has(email)) return cookieCache.get(email)
  const anon = createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false } })
  const { data, error } = await anon.auth.signInWithPassword({ email, password: PASSWORD })
  if (error || !data.session) throw new Error(`sign in failed for ${email}: ${error?.message}`)

  const jar = {}
  const server = createServerClient(SUPABASE_URL, ANON_KEY, {
    cookies: {
      getAll() { return Object.entries(jar).map(([name, value]) => ({ name, value })) },
      setAll(cookiesToSet) { for (const { name, value } of cookiesToSet) jar[name] = value },
    },
  })
  await server.auth.setSession({ access_token: data.session.access_token, refresh_token: data.session.refresh_token })
  const cookie = Object.entries(jar).map(([name, value]) => `${name}=${value}`).join('; ')
  cookieCache.set(email, cookie)
  return cookie
}

async function decideApplicantAsOwner(applicantId) {
  const cookie = await sessionCookieFor('owner@test.com')
  const res = await fetch(`${APP_URL}/api/recruitment`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify({ action: 'decide_applicant', applicant_id: applicantId, decision: 'accepted' }),
  })
  const data = await res.json()
  if (!data.success) throw new Error(data.message || `decide_applicant failed (${res.status})`)
}

async function respondAsWorker(email, invitationId) {
  const cookie = await sessionCookieFor(email)
  const res = await fetch(`${APP_URL}/api/guest/applications/x/respond`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify({ invitation_id: invitationId, response: 'accepted' }),
  })
  const data = await res.json()
  if (!data.success) throw new Error(data.message || `respond failed (${res.status})`)
}

// Owner accepts (creates the invitation), then the worker confirms it — the same two-sided
// exchange the UI walks a real person through. Safe to re-run: decideApplicant itself refuses an
// applicant who already confirmed, so a filler already pushed through on an earlier run is just
// skipped, not re-processed.
async function pushApplicantThrough(jobTitle, email) {
  const { data: user } = await supabase.from('users').select('id, full_name').eq('email_address', email).single()
  if (!user) { console.log(`  ⚠ ${email}: account not found — run demo-fill-applicants.js for this job first`); return }

  const { data: applicant } = await supabase
    .from('job_applicants')
    .select('id, status')
    .eq('user_id', user.id)
    .eq('job_id', (await supabase.from('job_postings').select('id').ilike('title', `%${jobTitle}%`).single()).data.id)
    .single()
  if (!applicant) { console.log(`  ⚠ ${user.full_name}: no application on "${jobTitle}" found`); return }
  if (applicant.status === 'rejected') { console.log(`  ⚠ ${user.full_name}: already rejected, skipped`); return }

  if (applicant.status === 'accepted') {
    // Already offered — either by this script on an earlier run, or (the normal recording path)
    // by the Manager clicking Accept in the AI Assessment panel on camera. Either way, offering
    // again would create a second invitation row and a duplicate acceptance email, so only the
    // confirm step is still needed here.
    const { data: inv } = await supabase.from('job_invitations').select('id, status').eq('applicant_id', applicant.id).order('sent_at', { ascending: false }).limit(1).single()
    if (inv?.status === 'accepted') { console.log(`  · ${user.full_name}: already confirmed, skipped`); return }
    if (!inv) throw new Error(`${user.full_name} is Accepted but has no invitation row — data is inconsistent`)
    await respondAsWorker(email, inv.id)
    console.log(`  ✓ ${user.full_name}: already offered, confirmed now`)
    return
  }

  // Still pending — nobody has offered them yet, so this script does both steps itself.
  await decideApplicantAsOwner(applicant.id)
  const { data: invitation } = await supabase
    .from('job_invitations')
    .select('id')
    .eq('applicant_id', applicant.id)
    .order('sent_at', { ascending: false })
    .limit(1)
    .single()
  if (!invitation) throw new Error(`no invitation row found for ${user.full_name} after offering`)

  await respondAsWorker(email, invitation.id)
  console.log(`  ✓ ${user.full_name}: offered and confirmed`)
}

// ── A second employer, so the public job board isn't a single-company view ──────────────────────
async function ensureOtherCompanyJob() {
  const OTHER_TITLE = 'Weekend Barista'
  const { data: existing } = await supabase.from('job_postings').select('id').eq('title', OTHER_TITLE).eq('status', 'open').maybeSingle()
  if (existing) { console.log(`Public job board: "${OTHER_TITLE}" already there, skipped\n`); return }

  const { data: existingCompany } = await supabase.from('companies').select('id').eq('name', 'GreenLeaf Catering Co.').maybeSingle()
  let companyId = existingCompany?.id
  let deptId

  if (!companyId) {
    const { data: authList } = await supabase.auth.admin.listUsers({ perPage: 1000 })
    let authId = (authList?.users ?? []).find(u => u.email === 'owner2@test.com')?.id
    if (!authId) {
      const { data, error } = await supabase.auth.admin.createUser({ email: 'owner2@test.com', password: PASSWORD, email_confirm: true })
      if (error) throw new Error(`creating owner2 auth: ${error.message}`)
      authId = data.user.id
    }
    const { data: ownerRow, error: ownerErr } = await supabase.from('users').insert({
      supabase_auth_id: authId, full_name: 'Daniel Koh', email_address: 'owner2@test.com',
      phone_number: '+65 8200 0001', date_of_birth: '1982-09-01',
      profile_photo_url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=demo', role: 'Owner', company_id: null,
    }).select().single()
    if (ownerErr) throw new Error(`creating owner2 users row: ${ownerErr.message}`)

    const { data: company, error: coErr } = await supabase.from('companies').insert({
      owner_id: ownerRow.id, name: 'GreenLeaf Catering Co.', description: 'Independent catering company, unrelated to Sunrise Hospitality Group.',
      location: 'Singapore', address: '2 Orchard Turn, Singapore 238801', postal_code: '238801',
      industry: 'Food & Beverage', size: '1-10', plan: 'Free',
    }).select().single()
    if (coErr) throw new Error(`creating GreenLeaf: ${coErr.message}`)
    companyId = company.id
    await supabase.from('users').update({ company_id: companyId }).eq('id', ownerRow.id)

    const { data: dept, error: deptErr } = await supabase.from('departments').insert({ company_id: companyId, name: 'Catering', color: '#10B981' }).select().single()
    if (deptErr) throw new Error(`creating GreenLeaf department: ${deptErr.message}`)
    deptId = dept.id
    console.log('Public job board: created GreenLeaf Catering Co. (unrelated second employer)')
  } else {
    const { data: dept } = await supabase.from('departments').select('id').eq('company_id', companyId).limit(1).single()
    deptId = dept.id
  }

  const { data: owner2 } = await supabase.from('users').select('id').eq('email_address', 'owner2@test.com').single()
  const { error: jobErr } = await supabase.from('job_postings').insert({
    company_id: companyId, department_id: deptId, created_by: owner2.id, status: 'open',
    title: OTHER_TITLE, job_type: 'shift', job_date: '2026-08-15', job_start_time: '07:00', job_end_time: '15:00',
    responsibilities: 'Run the coffee counter for a weekend catering event: take orders, prepare drinks, keep the station clean.',
    skills: 'Barista basics, comfortable with a busy counter, friendly with customers.',
    salary_amount: 15, experience_required: 'Preferred', minimum_age: 18, uniform_type: 'none', openings: 1,
  })
  if (jobErr) throw new Error(`creating GreenLeaf posting: ${jobErr.message}`)
  console.log(`Public job board: "${OTHER_TITLE}" — GreenLeaf Catering Co., 15 Aug\n`)
}

async function main() {
  console.log('\n═══ Push the remaining applicants through offer + confirm ═══\n')

  console.log('Event Setup & Breakdown (4 more, filling all 5 openings alongside the hero):')
  for (const email of ['guest2@test.com', 'guest3@test.com', 'guest4@test.com', 'guest5@test.com']) {
    await pushApplicantThrough('Event Setup', email)
  }

  console.log('\nRoom Cleaning (1 more, taking the opening the hero declined):')
  await pushApplicantThrough('Room Cleaning', 'guest8@test.com')

  console.log()
  await ensureOtherCompanyJob()

  // Sanity check — confirm the hero's own rows were never touched by this script.
  const { data: heroRows } = await supabase
    .from('job_applicants')
    .select('status, job_postings(title)')
    .eq('user_id', (await supabase.from('users').select('id').eq('email_address', HERO_EMAIL).single()).data.id)
  console.log(`Hero (${HERO_EMAIL}) applications, untouched by this script:`)
  for (const row of heroRows ?? []) console.log(`  ${row.job_postings.title}: ${row.status}`)
  console.log()
}

main().catch(err => { console.error(err.message); process.exit(1) })
