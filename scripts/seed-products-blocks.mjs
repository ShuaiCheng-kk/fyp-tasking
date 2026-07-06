import { createClient } from '@supabase/supabase-js'

const sb = createClient(
  'https://qnpwuipwyidslxndgewg.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFucHd1aXB3eWlkc2x4bmRnZXdnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODA2MDE3NCwiZXhwIjoyMDkzNjM2MTc0fQ.YSQMxKFiAmSlBcQ0tAtU07MnuViwpalADYhpfGxOskU'
)

const P = '00000000-0000-0000-0001-000000000004'

const blocks = [
  { page_id: P, block_key: 'hero.badge',               block_type: 'text', label: 'Hero Badge',                value: 'Products',                                                  sort_order: 1 },
  { page_id: P, block_key: 'hero.button.label',         block_type: 'text', label: 'Hero Button Label',         value: 'Explore Our Modules',                                       sort_order: 5 },
  { page_id: P, block_key: 'hero.button.url',           block_type: 'text', label: 'Hero Button URL',           value: '#modules',                                                  sort_order: 6 },
  { page_id: P, block_key: 'why.title',                 block_type: 'text', label: 'Why Simple — Title',        value: 'We kept it simple. On purpose.',                            sort_order: 10 },
  { page_id: P, block_key: 'why.intro',                 block_type: 'textarea', label: 'Why Simple — Intro',   value: 'Most workforce tools were built for corporations with dedicated IT teams and six-figure software budgets. Here\'s what we left out, and why.', sort_order: 11 },
  { page_id: P, block_key: 'modules.title',             block_type: 'text', label: 'Modules Section Title',     value: 'Five modules. One workflow. Zero gaps.',                     sort_order: 20 },
  { page_id: P, block_key: 'modules.subtitle',          block_type: 'textarea', label: 'Modules Section Subtitle', value: 'Every module in Tasking is designed to work together — from the moment you post a job to the moment the shift ends.', sort_order: 21 },
  { page_id: P, block_key: 'module.recruitment.tagline',block_type: 'text', label: 'Recruitment Tagline',       value: 'Find the right people. Fast.',                              sort_order: 30 },
  { page_id: P, block_key: 'module.attendance.tagline', block_type: 'text', label: 'Attendance Tagline',        value: 'Every clock-in. Verified. Every record. Protected.',         sort_order: 31 },
  { page_id: P, block_key: 'module.team.tagline',       block_type: 'text', label: 'Team Management Tagline',  value: 'Your company structure, exactly how you need it.',           sort_order: 32 },
  { page_id: P, block_key: 'module.notifications.tagline', block_type: 'text', label: 'Notifications Tagline', value: 'No more chasing people for updates.',                        sort_order: 33 },
  { page_id: P, block_key: 'module.ai.tagline',         block_type: 'text', label: 'AI Features Tagline',      value: 'Enterprise-grade AI. Free for everyone.',                    sort_order: 34 },
  { page_id: P, block_key: 'cta.button2.label',         block_type: 'text', label: 'CTA Button 2 Label',       value: 'View Pricing',                                              sort_order: 62 },
  { page_id: P, block_key: 'cta.button2.url',           block_type: 'text', label: 'CTA Button 2 URL',         value: '/pricing',                                                  sort_order: 63 },
]

const { error } = await sb.from('marketing_content_blocks').upsert(blocks, { onConflict: 'page_id,block_key', ignoreDuplicates: true })
if (error) { console.error(error.message); process.exit(1) }
console.log('Done — seeded Products page blocks.')
