import { createClient } from '@supabase/supabase-js'

const sb = createClient(
  'https://qnpwuipwyidslxndgewg.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFucHd1aXB3eWlkc2x4bmRnZXdnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODA2MDE3NCwiZXhwIjoyMDkzNjM2MTc0fQ.YSQMxKFiAmSlBcQ0tAtU07MnuViwpalADYhpfGxOskU'
)

const ABOUT    = '00000000-0000-0000-0001-000000000002'
const PRODUCTS = '00000000-0000-0000-0001-000000000004'

const b = (page_id, block_key, block_type, label, value, sort_order) => ({
  page_id, block_key, block_type, label, value, sort_order,
})

const blocks = [
  // ── PRODUCTS page ──────────────────────────────────────────────────────────
  b(PRODUCTS, 'hero.badge',       'text',     'Hero Badge',           'Products',                                                                                                                                                          1),
  b(PRODUCTS, 'hero.headline',    'text',     'Hero Headline',        'One platform. Every tool your casual workforce needs.',                                                                                                               2),
  b(PRODUCTS, 'hero.subheadline', 'textarea', 'Hero Subheadline',     'Tasking brings recruitment, attendance, team management, and AI automation together in one place — so you can stop juggling tools and start running your business.',  3),
  b(PRODUCTS, 'hero.button.label','text',     'Hero Button Label',    'Explore Our Modules',                                                                                                                                               5),
  b(PRODUCTS, 'hero.button.url',  'text',     'Hero Button URL',      '#modules',                                                                                                                                                          6),

  b(PRODUCTS, 'why.title',        'text',     'Why Simple — Title',   'We kept it simple. On purpose.',                                                                                                                                    10),
  b(PRODUCTS, 'why.intro',        'textarea', 'Why Simple — Intro',   "Most workforce tools were built for corporations with dedicated IT teams and six-figure software budgets. They come packed with modules that look impressive on a features list — but for an SME trying to manage a casual workforce, they just get in the way. Here's what we left out, and why.", 11),

  b(PRODUCTS, 'modules.title',    'text',     'Modules Section Title',    'Five modules. One workflow. Zero gaps.',                                                                                                                        20),
  b(PRODUCTS, 'modules.subtitle', 'textarea', 'Modules Section Subtitle', 'Every module in Tasking is designed to work together — from the moment you post a job to the moment the shift ends.',                                          21),

  b(PRODUCTS, 'module.recruitment.tagline',   'text', 'Recruitment Tagline',        'Find the right people. Fast.',                              30),
  b(PRODUCTS, 'module.attendance.tagline',    'text', 'Attendance Tagline',         'Every clock-in. Verified. Every record. Protected.',        31),
  b(PRODUCTS, 'module.team.tagline',          'text', 'Team Management Tagline',    'Your company structure, exactly how you need it.',          32),
  b(PRODUCTS, 'module.notifications.tagline', 'text', 'Smart Notifications Tagline','No more chasing people for updates.',                       33),
  b(PRODUCTS, 'module.ai.tagline',            'text', 'AI Features Tagline',        'Enterprise-grade AI. Free for everyone.',                   34),

  b(PRODUCTS, 'cta.headline',     'text',     'CTA Headline',         'Ready to see it in action?',                                                                                                                                        60),
  b(PRODUCTS, 'cta.subheadline',  'textarea', 'CTA Subheadline',      'Join SMEs already using Tasking to hire smarter, schedule faster, and track with confidence.',                                                                     61),
  b(PRODUCTS, 'cta.button.label', 'text',     'CTA Button Label',     'Get Started Free',                                                                                                                                                 62),
  b(PRODUCTS, 'cta.button.url',   'text',     'CTA Button URL',       '/get-started',                                                                                                                                                     63),
  b(PRODUCTS, 'cta.button2.label','text',     'CTA Button 2 Label',   'View Pricing',                                                                                                                                                     64),
  b(PRODUCTS, 'cta.button2.url',  'text',     'CTA Button 2 URL',     '/pricing',                                                                                                                                                         65),

  // ── ABOUT page ─────────────────────────────────────────────────────────────
  b(ABOUT, 'hero.badge',        'text',     'Hero Badge',       'About',                                                                                                                       1),
  b(ABOUT, 'hero.headline',     'text',     'Hero Headline',    "Built by people who've seen the chaos firsthand.",                                                                             2),
  b(ABOUT, 'hero.subheadline',  'textarea', 'Hero Subheadline', 'Tasking was born out of a simple frustration — watching SMEs struggle with casual workforce management using tools that were never built for them.', 3),

  b(ABOUT, 'learn-more.title',    'text',     'Learn More Title',    'Learn more about us',                                                                          10),
  b(ABOUT, 'learn-more.subtitle', 'textarea', 'Learn More Subtitle', 'Everything you need to know about why Tasking exists and the people behind it.',               11),

  b(ABOUT, 'cta.quote',  'textarea', 'CTA Quote',        '"We didn\'t build another HR tool. We built the thing SMEs actually needed."',  60),
  b(ABOUT, 'cta.author', 'text',     'CTA Quote Author', '— The Tasking Team',                                                             61),
]

const { error } = await sb.from('marketing_content_blocks').upsert(blocks, { onConflict: 'page_id,block_key' })
if (error) { console.error(error.message); process.exit(1) }
console.log(`Done — seeded ${blocks.length} real-text blocks.`)
