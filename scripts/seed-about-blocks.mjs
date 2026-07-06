import { createClient } from '@supabase/supabase-js'

const sb = createClient(
  'https://qnpwuipwyidslxndgewg.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFucHd1aXB3eWlkc2x4bmRnZXdnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODA2MDE3NCwiZXhwIjoyMDkzNjM2MTc0fQ.YSQMxKFiAmSlBcQ0tAtU07MnuViwpalADYhpfGxOskU'
)

const MISSION   = '00000000-0000-0000-0002-000000000006'
const PROBSOL   = '00000000-0000-0000-0002-000000000007'
const TEAM      = '00000000-0000-0000-0002-000000000008'
const FAQ       = '00000000-0000-0000-0009-000000000001'  // about-faq page id

// Resolve about-faq page id dynamically
const { data: faqPage } = await sb.from('marketing_pages').select('id').eq('slug', 'about-faq').single()
const FAQ_ID = faqPage?.id

if (!FAQ_ID) { console.error('about-faq page not found'); process.exit(1) }

const b = (page_id, block_key, label, value, sort_order) =>
  ({ page_id, block_key, block_type: 'text', label, value, sort_order })

const blocks = [
  // ── about-mission ──────────────────────────────────────────────
  b(MISSION, 'section.hero.visible',    'Hero Visible',       'true',  0),
  b(MISSION, 'section.why.visible',     'Why Visible',        'true',  1),
  b(MISSION, 'section.goals.visible',   'Goals Visible',      'true',  2),
  b(MISSION, 'section.values.visible',  'Values Visible',     'true',  3),
  b(MISSION, 'section.cta.visible',     'CTA Visible',        'true',  4),

  b(MISSION, 'hero.badge',        'Hero Badge',        'Mission',                                                                        10),
  b(MISSION, 'hero.headline',     'Hero Headline',     'We built Tasking because SMEs deserve better.',                                   11),
  b(MISSION, 'hero.subheadline',  'Hero Subheadline',  'Not a watered-down version of enterprise software. Not another spreadsheet wrapper. A platform built from scratch for the way SMEs actually operate.', 12),

  b(MISSION, 'why.headline',  'Why Headline',  'Why we built it',                                                                        20),
  b(MISSION, 'why.para1',     'Why Para 1',    'Across retail floors, F&B kitchens, logistics hubs, and event venues, SME managers were doing the same thing: juggling WhatsApp groups, spreadsheets, paper timesheets, and manual phone calls just to keep their casual workforce running.', 21),
  b(MISSION, 'why.para2',     'Why Para 2',    "They weren't failing because they lacked effort. They were failing because the tools available were either built for large enterprises with IT departments, or too simple to handle the real complexity of managing people who work flexibly, inconsistently, and across multiple roles.", 22),
  b(MISSION, 'why.pain.1',    'Pain Point 1',  'Shift coordination done through WhatsApp threads',                                       23),
  b(MISSION, 'why.pain.2',    'Pain Point 2',  'Clock-ins tracked on paper or not at all',                                              24),
  b(MISSION, 'why.pain.3',    'Pain Point 3',  'No reliable way to verify who actually showed up',                                      25),
  b(MISSION, 'why.pain.4',    'Pain Point 4',  'Attendance disputes with no audit trail',                                               26),
  b(MISSION, 'why.pain.5',    'Pain Point 5',  'Weeks wasted reposting the same job roles',                                             27),

  b(MISSION, 'goals.headline',    'Goals Headline',   'What we set out to do',                                                          30),
  b(MISSION, 'goals.1.title',     'Goal 1 Title',     'Automate the repetitive',                                                        31),
  b(MISSION, 'goals.1.body',      'Goal 1 Body',      "Every task that a manager does manually on a recurring basis — posting the same job, chasing confirmations, approving clean timesheets — should be handled by the system. Managers should only be involved when something genuinely needs their attention.", 32),
  b(MISSION, 'goals.2.title',     'Goal 2 Title',     'Centralise everything',                                                          33),
  b(MISSION, 'goals.2.body',      'Goal 2 Body',      "Recruitment, attendance, team structure, notifications — all in one place. No more bouncing between tools, no more data living in five different places, no more version-of-truth problems.", 34),
  b(MISSION, 'goals.3.title',     'Goal 3 Title',     'Make verification the default',                                                  35),
  b(MISSION, 'goals.3.body',      'Goal 3 Body',      "Photo-verified clock-ins and signed attendance records aren't premium features. They're the baseline. Every attendance record in Tasking comes with a chain of evidence — so disputes don't happen, and when they do, the truth is already on record.", 36),
  b(MISSION, 'goals.4.title',     'Goal 4 Title',     'Give smaller businesses real AI',                                                37),
  b(MISSION, 'goals.4.body',      'Goal 4 Body',      "AI candidate ranking, job description generation, auto-approval, and anomaly detection aren't locked behind an enterprise plan. They're free. Because SMEs need them just as much as anyone else.", 38),

  b(MISSION, 'values.headline',    'Values Headline',   'What we stand for',                                                            40),
  b(MISSION, 'values.1.badge',     'Value 1 Badge',     'Free AI',                                                                      41),
  b(MISSION, 'values.1.title',     'Value 1 Title',     'No paywalls on intelligence',                                                  42),
  b(MISSION, 'values.1.body',      'Value 1 Body',      "Every AI feature in Tasking — candidate ranking, job description generation, auto-approval, anomaly detection — is free. Not a trial. Not a premium add-on. Free forever. Intelligence shouldn't be a luxury.", 43),
  b(MISSION, 'values.2.badge',     'Value 2 Badge',     'Built for SMEs',                                                               44),
  b(MISSION, 'values.2.title',     'Value 2 Title',     'Not a stripped-down enterprise tool',                                          45),
  b(MISSION, 'values.2.body',      'Value 2 Body',      "We didn't take an enterprise product and remove features until it was affordable. We started from scratch with SME workflows in mind — 5 to 50 employees, casual contracts, multiple departments, managers who wear ten hats.", 46),
  b(MISSION, 'values.3.badge',     'Value 3 Badge',     'Simple by design',                                                             47),
  b(MISSION, 'values.3.title',     'Value 3 Title',     'No onboarding programme required',                                             48),
  b(MISSION, 'values.3.body',      'Value 3 Body',      "If your team needs a three-day training session to use a scheduling tool, something has already gone wrong. Tasking is designed so that every role — from the owner to the casual worker — can get up and running on day one.", 49),

  b(MISSION, 'cta.headline',       'CTA Headline',      'Ready to see it for yourself?',                                                50),
  b(MISSION, 'cta.button.label',   'CTA Button Label',  'Get Started Free',                                                             51),
  b(MISSION, 'cta.button.url',     'CTA Button URL',    '/get-started',                                                                 52),

  // ── about-problem-solution ─────────────────────────────────────
  b(PROBSOL, 'section.hero.visible',      'Hero Visible',      'true',  0),
  b(PROBSOL, 'section.problems.visible',  'Problems Visible',  'true',  1),
  b(PROBSOL, 'section.gaps.visible',      'Gaps Visible',      'true',  2),
  b(PROBSOL, 'section.fixes.visible',     'Fixes Visible',     'true',  3),
  b(PROBSOL, 'section.cta.visible',       'CTA Visible',       'true',  4),

  b(PROBSOL, 'hero.badge',       'Hero Badge',       'Problem & Solution',                                                                         10),
  b(PROBSOL, 'hero.headline',    'Hero Headline',    'The problem is real. The fixes are already built.',                                           11),
  b(PROBSOL, 'hero.subheadline', 'Hero Subheadline', "Here's an honest breakdown of what's broken in casual workforce management, where existing tools fall short, and exactly how Tasking addresses it.", 12),

  b(PROBSOL, 'problems.title',    'Problems Title',    'What SMEs are dealing with every day',                                                     20),
  b(PROBSOL, 'problems.subtitle', 'Problems Subtitle', "These aren't edge cases. They're the daily reality for any SME relying on casual workers.", 21),
  b(PROBSOL, 'problems.1.title',  'Problem 1 Title',   'No reliable way to verify attendance',                                                     22),
  b(PROBSOL, 'problems.1.body',   'Problem 1 Body',    "Paper timesheets and WhatsApp check-ins are impossible to audit. When disputes arise, there's no evidence — just conflicting memories.",            23),
  b(PROBSOL, 'problems.2.title',  'Problem 2 Title',   'Shift coordination is entirely manual',                                                    24),
  b(PROBSOL, 'problems.2.body',   'Problem 2 Body',    'Managers spend hours every week posting jobs, chasing acceptances, and confirming shifts through personal messages — work the system should be doing.', 25),
  b(PROBSOL, 'problems.3.title',  'Problem 3 Title',   'No structured hiring flow for casual roles',                                               26),
  b(PROBSOL, 'problems.3.body',   'Problem 3 Body',    "Job boards and generic HR tools weren't built for high-turnover casual hiring. There's no ranking, no deadline enforcement, no automated closure when a role is filled.", 27),
  b(PROBSOL, 'problems.4.title',  'Problem 4 Title',   'Permissions and access are all or nothing',                                               28),
  b(PROBSOL, 'problems.4.body',   'Problem 4 Body',    "Most tools give everyone the same view or none at all. Managers see too much. Casual workers see nothing useful. There's no concept of role-based operational access.", 29),
  b(PROBSOL, 'problems.5.title',  'Problem 5 Title',   'No single source of truth',                                                               30),
  b(PROBSOL, 'problems.5.body',   'Problem 5 Body',    "Data lives in spreadsheets, messaging apps, email threads, and personal notes. There's no centralised record of who worked, when, what they were paid, or why they left.", 31),

  b(PROBSOL, 'gaps.title',    'Gaps Title',    "Existing tools weren't built for this",                                                           40),
  b(PROBSOL, 'gaps.subtitle', 'Gaps Subtitle', 'Seven specific gaps in the tools SMEs are currently using — and paying for.',                      41),
  b(PROBSOL, 'gaps.1.title',  'Gap 1 Title',   'Built for enterprises, not SMEs',                                                                 42),
  b(PROBSOL, 'gaps.1.detail', 'Gap 1 Detail',  "Most workforce tools assume you have an IT team, a dedicated HR department, and six-figure software budgets. SMEs have none of these.",                    43),
  b(PROBSOL, 'gaps.2.title',  'Gap 2 Title',   'AI is a premium add-on',                                                                          44),
  b(PROBSOL, 'gaps.2.detail', 'Gap 2 Detail',  'Candidate ranking, job description generation, and anomaly detection are locked behind expensive tiers that SMEs simply cannot justify.',                  45),
  b(PROBSOL, 'gaps.3.title',  'Gap 3 Title',   'No photo-based verification',                                                                     46),
  b(PROBSOL, 'gaps.3.detail', 'Gap 3 Detail',  "Clock-in confirmation is still a text field or a button press — with nothing to prove who actually submitted it.",                                         47),
  b(PROBSOL, 'gaps.4.title',  'Gap 4 Title',   "Attendance records can't be audited",                                                             48),
  b(PROBSOL, 'gaps.4.detail', 'Gap 4 Detail',  "When a record is modified, the original disappears. There's no chain of evidence, no history, no transparency.",                                          49),
  b(PROBSOL, 'gaps.5.title',  'Gap 5 Title',   'No clopening protection',                                                                         50),
  b(PROBSOL, 'gaps.5.detail', 'Gap 5 Detail',  "Back-to-back shifts with insufficient rest time get scheduled without any warning — creating burnout and legal risk that managers don't catch until it's too late.", 51),
  b(PROBSOL, 'gaps.6.title',  'Gap 6 Title',   'Scheduling is disconnected from hiring',                                                          52),
  b(PROBSOL, 'gaps.6.detail', 'Gap 6 Detail',  "Recruitment and scheduling tools don't talk to each other. A job gets filled in one system; the shift gets assigned in another. Nothing is automatic.",  53),
  b(PROBSOL, 'gaps.7.title',  'Gap 7 Title',   'Casual workers are an afterthought',                                                              54),
  b(PROBSOL, 'gaps.7.detail', 'Gap 7 Detail',  "Most tools don't model the casual worker experience at all. There's no public job portal, no visibility into their own history, no way to participate in the workflow without a full account.", 55),

  b(PROBSOL, 'fixes.title',       'Fixes Title',       'Every problem. Directly addressed.',                                                      60),
  b(PROBSOL, 'fixes.subtitle',    'Fixes Subtitle',    'Not workarounds. Not partial fixes. Specific features built to solve each problem.',       61),
  b(PROBSOL, 'fixes.1.problem',   'Fix 1 Problem',     'Unverifiable attendance',                                                                 62),
  b(PROBSOL, 'fixes.1.solution',  'Fix 1 Solution',    'Photo-verified clock-ins + signed submission + AI anomaly detection',                     63),
  b(PROBSOL, 'fixes.1.detail',    'Fix 1 Detail',      "Every clock-in includes a live photo. Employees sign before submitting. AI flags mismatches and unusual patterns before managers even open the record.", 64),
  b(PROBSOL, 'fixes.2.problem',   'Fix 2 Problem',     'Manual shift coordination',                                                               65),
  b(PROBSOL, 'fixes.2.solution',  'Fix 2 Solution',    'Automated reminders, deadlines, and closure',                                             66),
  b(PROBSOL, 'fixes.2.detail',    'Fix 2 Detail',      "12-hour acceptance windows start automatically. Reminders fire without manual intervention. Jobs close the moment a candidate accepts. Managers only act when something actually needs them.", 67),
  b(PROBSOL, 'fixes.3.problem',   'Fix 3 Problem',     'Unstructured casual hiring',                                                              68),
  b(PROBSOL, 'fixes.3.solution',  'Fix 3 Solution',    'Public portal + AI ranking + one-click invitation',                                       69),
  b(PROBSOL, 'fixes.3.detail',    'Fix 3 Detail',      "Casual workers browse and apply without an account. AI ranks every applicant by fit. The manager selects, invites, and the system handles everything else.", 70),
  b(PROBSOL, 'fixes.4.problem',   'Fix 4 Problem',     'All-or-nothing access',                                                                   71),
  b(PROBSOL, 'fixes.4.solution',  'Fix 4 Solution',    'Five distinct roles with scoped visibility',                                              72),
  b(PROBSOL, 'fixes.4.detail',    'Fix 4 Detail',      "Owners see everything. Managers see their department. Employees see their assigned work. Casual workers see their own history. Guests browse and apply. Nothing more, nothing less.", 73),
  b(PROBSOL, 'fixes.5.problem',   'Fix 5 Problem',     'No single source of truth',                                                               74),
  b(PROBSOL, 'fixes.5.solution',  'Fix 5 Solution',    'One platform for recruitment, attendance, and team management',                            75),
  b(PROBSOL, 'fixes.5.detail',    'Fix 5 Detail',      "Every action — job posting, clock-in, record submission, approval — lives in the same system with a complete, tamper-evident audit trail.", 76),

  b(PROBSOL, 'cta.headline',      'CTA Headline',      'See it working. For free.',                                                               80),
  b(PROBSOL, 'cta.button.label',  'CTA Button Label',  'Get Started Free',                                                                        81),
  b(PROBSOL, 'cta.button.url',    'CTA Button URL',    '/get-started',                                                                            82),

  // ── about-team ─────────────────────────────────────────────────
  b(TEAM, 'section.hero.visible',  'Hero Visible',  'true',  0),
  b(TEAM, 'section.team.visible',  'Team Visible',  'true',  1),
  b(TEAM, 'section.cta.visible',   'CTA Visible',   'true',  2),

  b(TEAM, 'hero.badge',       'Hero Badge',       'The Team',                                                                                      10),
  b(TEAM, 'hero.headline',    'Hero Headline',    'The people behind Tasking.',                                                                     11),
  b(TEAM, 'hero.subheadline', 'Hero Subheadline', 'A multidisciplinary team of six — covering design, frontend, backend, full-stack, and project management — working together to make casual workforce management genuinely simple.', 12),

  b(TEAM, 'member.1.name',     'Member 1 Name',     'Pei Shuai Cheng',                                                                            20),
  b(TEAM, 'member.1.role',     'Member 1 Role',     'Project Manager',                                                                             21),
  b(TEAM, 'member.1.initials', 'Member 1 Initials', 'SC',                                                                                         22),
  b(TEAM, 'member.1.desc',     'Member 1 Desc',     'Oversees project timeline, milestones, and cross-team coordination to keep Tasking on track from concept to deployment.', 23),
  b(TEAM, 'member.1.focus',    'Member 1 Focus',    'Timeline & milestones, Stakeholder communication, Risk management',                           24),

  b(TEAM, 'member.2.name',     'Member 2 Name',     'Nadiyah D/O Mohamed Asaref',                                                                 25),
  b(TEAM, 'member.2.role',     'Member 2 Role',     'UI/UX Designer',                                                                             26),
  b(TEAM, 'member.2.initials', 'Member 2 Initials', 'NA',                                                                                         27),
  b(TEAM, 'member.2.desc',     'Member 2 Desc',     'Designing intuitive, accessible interfaces across all 5 user roles — ensuring every interaction feels natural for SME operators and casual workers alike.', 28),
  b(TEAM, 'member.2.focus',    'Member 2 Focus',    'User research, Wireframing & prototyping, 5-role interface design',                           29),

  b(TEAM, 'member.3.name',     'Member 3 Name',     'Nan Phyu Sin Maung',                                                                         30),
  b(TEAM, 'member.3.role',     'Member 3 Role',     'Frontend Developer',                                                                          31),
  b(TEAM, 'member.3.initials', 'Member 3 Initials', 'NP',                                                                                         32),
  b(TEAM, 'member.3.desc',     'Member 3 Desc',     'Building the user interface with Next.js and React, translating design specifications into a fast, accessible, and responsive web application.', 33),
  b(TEAM, 'member.3.focus',    'Member 3 Focus',    'Next.js / React, Component architecture, Responsive UI',                                      34),

  b(TEAM, 'member.4.name',     'Member 4 Name',     'Neha Tanmayi',                                                                               35),
  b(TEAM, 'member.4.role',     'Member 4 Role',     'Backend Developer',                                                                           36),
  b(TEAM, 'member.4.initials', 'Member 4 Initials', 'NT',                                                                                         37),
  b(TEAM, 'member.4.desc',     'Member 4 Desc',     'Architecting the server-side logic, database schema, and API layer — ensuring data integrity and performance across all Tasking operations.', 38),
  b(TEAM, 'member.4.focus',    'Member 4 Focus',    'Server-side logic, Database design, API development',                                         39),

  b(TEAM, 'member.5.name',     'Member 5 Name',     'Phatcharin Ng Hui Lin',                                                                      40),
  b(TEAM, 'member.5.role',     'Member 5 Role',     'Backend Developer',                                                                           41),
  b(TEAM, 'member.5.initials', 'Member 5 Initials', 'PH',                                                                                         42),
  b(TEAM, 'member.5.desc',     'Member 5 Desc',     'Building the recruitment, attendance, and smart notification systems that form the operational core of the Tasking platform.', 43),
  b(TEAM, 'member.5.focus',    'Member 5 Focus',    'Recruitment module, Attendance systems, Notification engine',                                  44),

  b(TEAM, 'member.6.name',     'Member 6 Name',     'Sandy Tan Ying Hui',                                                                         45),
  b(TEAM, 'member.6.role',     'Member 6 Role',     'Full Stack Developer',                                                                        46),
  b(TEAM, 'member.6.initials', 'Member 6 Initials', 'ST',                                                                                         47),
  b(TEAM, 'member.6.desc',     'Member 6 Desc',     'Leading AI integration across the platform and ensuring the modules work seamlessly together — from the job posting flow through to the approved attendance record.', 48),
  b(TEAM, 'member.6.focus',    'Member 6 Focus',    'AI feature integration, Full-stack module cohesion, Platform architecture',                    49),

  b(TEAM, 'cta.headline',      'CTA Headline',      'Six people. One platform. Built for the businesses that need it most.',                        50),
]

// about-faq blocks (use resolved FAQ_ID)
const faqBlocks = [
  b(FAQ_ID, 'section.hero.visible',  'Hero Visible',  'true',  0),
  b(FAQ_ID, 'section.faq.visible',   'FAQ Visible',   'true',  1),
  b(FAQ_ID, 'section.still.visible', 'Still Visible', 'true',  2),

  b(FAQ_ID, 'hero.badge',       'Hero Badge',       'FAQ',                                                                                        10),
  b(FAQ_ID, 'hero.headline',    'Hero Headline',    'Questions we get all the time.',                                                              11),
  b(FAQ_ID, 'hero.subheadline', 'Hero Subheadline', "Honest answers about how Tasking works, what's free, and what to expect.",                   12),

  b(FAQ_ID, 'faq.1.q', 'FAQ 1 Q', 'Is Tasking free to use?',                                                                                     20),
  b(FAQ_ID, 'faq.1.a', 'FAQ 1 A', "Yes. Tasking operates on a freemium model. The core platform — including all AI features — is free forever. AI candidate recommendation, job description generation, auto-approve timesheets, and anomaly detection are all included at no cost. There is no trial period, no credit card required, and no AI paywall.", 21),
  b(FAQ_ID, 'faq.2.q', 'FAQ 2 Q', 'What does the paid plan include?',                                                                            22),
  b(FAQ_ID, 'faq.2.a', 'FAQ 2 A', 'The paid plan extends Tasking with compliance reporting tools, advanced skills management (certifications, role-specific requirements, expiry tracking), and performance tracking across casual workers over time. These are designed for SMEs that have outgrown the basics and need structured workforce data.', 23),
  b(FAQ_ID, 'faq.3.q', 'FAQ 3 Q', 'Who is Tasking built for?',                                                                                   24),
  b(FAQ_ID, 'faq.3.a', 'FAQ 3 A', "Tasking is built for SMEs and startups with 5 to 50 employees that rely on casual or flexible workers — typically in retail, F&B, logistics, or event management. The platform supports five user roles: Owner, Manager, Employee, Casual Worker, and Guest User. Each role has exactly the access they need — nothing more.", 25),
  b(FAQ_ID, 'faq.4.q', 'FAQ 4 Q', 'Do casual workers need to create an account to apply for jobs?',                                              26),
  b(FAQ_ID, 'faq.4.a', 'FAQ 4 A', 'No. Casual workers and job seekers can browse all open positions on the public recruitment portal without creating an account. An account is only required when they want to formally apply for a role and participate in the hiring process.', 27),
  b(FAQ_ID, 'faq.5.q', 'FAQ 5 Q', 'How does AI candidate recommendation work?',                                                                  28),
  b(FAQ_ID, 'faq.5.a', 'FAQ 5 A', "When applicants apply for a role, Tasking's AI analyses their submitted profile — including skills, stated availability, and work history — and generates a ranked shortlist. The manager sees the highest-fit candidates at the top of their applicant list, with no manual sorting required. The ranking updates as new applications come in.", 29),
  b(FAQ_ID, 'faq.6.q', 'FAQ 6 Q', 'How is data kept secure?',                                                                                    30),
  b(FAQ_ID, 'faq.6.a', 'FAQ 6 A', 'Tasking uses Supabase Auth for authentication, with secure session management and encrypted storage. Access to data is strictly role-based — each user can only read and write what their role permits. Attendance records include full modification history and preserve the original record permanently for audit purposes.', 31),
  b(FAQ_ID, 'faq.7.q', 'FAQ 7 Q', 'Is there a mobile app?',                                                                                      32),
  b(FAQ_ID, 'faq.7.a', 'FAQ 7 A', 'Tasking is a fully web-based platform — no app download required. It works on any modern browser across desktop, tablet, and mobile. Clock-ins, attendance submissions, and notifications all work through the browser, including the photo capture flow for verification.', 33),
  b(FAQ_ID, 'faq.8.q', 'FAQ 8 Q', "What happens if a casual worker doesn't respond to an invitation?",                                           34),
  b(FAQ_ID, 'faq.8.a', 'FAQ 8 A', "Every invitation has a 12-hour acceptance window. If the casual worker hasn't responded, Tasking sends an automatic reminder before the deadline. If the window closes with no response, the manager receives a notification and can take action — whether that's extending the window, re-inviting someone else, or filling the role from another applicant.", 35),

  b(FAQ_ID, 'still.headline',     'Still Headline',     'Still have questions?',                                                                  40),
  b(FAQ_ID, 'still.body',         'Still Body',         "The best way to get answers is to try it. Everything in the core plan is free.",          41),
  b(FAQ_ID, 'still.button.label', 'Still Button Label', 'Get Started Free',                                                                        42),
  b(FAQ_ID, 'still.button.url',   'Still Button URL',   '/get-started',                                                                            43),
]

const allBlocks = [...blocks, ...faqBlocks]

// Delete existing blocks for these pages to avoid duplicates
const pageIds = [MISSION, PROBSOL, TEAM, FAQ_ID]
await sb.from('marketing_content_blocks').delete().in('page_id', pageIds)

const { error } = await sb.from('marketing_content_blocks').insert(allBlocks)
if (error) { console.error(error); process.exit(1) }
console.log(`Seeded ${allBlocks.length} blocks across about sub-pages`)
