import { createClient } from '@supabase/supabase-js'

const sb = createClient(
  'https://qnpwuipwyidslxndgewg.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFucHd1aXB3eWlkc2x4bmRnZXdnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODA2MDE3NCwiZXhwIjoyMDkzNjM2MTc0fQ.YSQMxKFiAmSlBcQ0tAtU07MnuViwpalADYhpfGxOskU'
)

const pages = [
  { id: '00000000-0000-0000-0002-000000000001', slug: 'products-ai-features',        title: 'AI Features',         route_path: '/products/ai-features',        is_editable: true },
  { id: '00000000-0000-0000-0002-000000000002', slug: 'products-recruitment',         title: 'Recruitment',         route_path: '/products/recruitment',         is_editable: true },
  { id: '00000000-0000-0000-0002-000000000003', slug: 'products-attendance',          title: 'Attendance',          route_path: '/products/attendance',          is_editable: true },
  { id: '00000000-0000-0000-0002-000000000004', slug: 'products-team-management',     title: 'Team Management',     route_path: '/products/team-management',     is_editable: true },
  { id: '00000000-0000-0000-0002-000000000005', slug: 'products-smart-notifications', title: 'Smart Notifications', route_path: '/products/smart-notifications', is_editable: true },
  { id: '00000000-0000-0000-0002-000000000006', slug: 'about-mission',                title: 'Mission',             route_path: '/about/mission',                is_editable: true },
  { id: '00000000-0000-0000-0002-000000000007', slug: 'about-problem-solution',       title: 'Problem & Solution',  route_path: '/about/problem-solution',       is_editable: true },
  { id: '00000000-0000-0000-0002-000000000008', slug: 'about-team',                   title: 'Team',                route_path: '/about/team',                   is_editable: true },
  { id: '00000000-0000-0000-0002-000000000009', slug: 'about-faq',                    title: 'FAQ',                 route_path: '/about/faq',                    is_editable: true },
]

const blocks = [
  // AI Features
  { page_id: '00000000-0000-0000-0002-000000000001', block_key: 'hero.headline',    block_type: 'text',     label: 'Hero Headline',    value: 'Enterprise-grade AI. Free for everyone.',                                                                                              sort_order: 1 },
  { page_id: '00000000-0000-0000-0002-000000000001', block_key: 'hero.subheadline', block_type: 'textarea', label: 'Hero Subheadline', value: 'Four intelligent tools built into your workflow from day one — no upgrades, no paywalls, no excuses.',                                 sort_order: 2 },
  { page_id: '00000000-0000-0000-0002-000000000001', block_key: 'cta.headline',     block_type: 'text',     label: 'CTA Headline',     value: 'Ready to put AI to work?',                                                                                                             sort_order: 3 },
  { page_id: '00000000-0000-0000-0002-000000000001', block_key: 'cta.subheadline',  block_type: 'textarea', label: 'CTA Subheadline',  value: 'All four AI features are free. No upgrade required.',                                                                                   sort_order: 4 },
  // Recruitment
  { page_id: '00000000-0000-0000-0002-000000000002', block_key: 'hero.headline',    block_type: 'text',     label: 'Hero Headline',    value: 'Find the right people. Fast.',                                                                                                         sort_order: 1 },
  { page_id: '00000000-0000-0000-0002-000000000002', block_key: 'hero.subheadline', block_type: 'textarea', label: 'Hero Subheadline', value: 'From job posting to confirmed hire — without the back-and-forth.',                                                                     sort_order: 2 },
  { page_id: '00000000-0000-0000-0002-000000000002', block_key: 'cta.headline',     block_type: 'text',     label: 'CTA Headline',     value: 'Your next hire is one post away.',                                                                                                     sort_order: 3 },
  { page_id: '00000000-0000-0000-0002-000000000002', block_key: 'cta.subheadline',  block_type: 'textarea', label: 'CTA Subheadline',  value: 'Join SMEs already using Tasking to fill shifts faster and smarter.',                                                                   sort_order: 4 },
  // Attendance
  { page_id: '00000000-0000-0000-0002-000000000003', block_key: 'hero.headline',    block_type: 'text',     label: 'Hero Headline',    value: 'Every clock-in. Verified. Every record. Protected.',                                                                                   sort_order: 1 },
  { page_id: '00000000-0000-0000-0002-000000000003', block_key: 'hero.subheadline', block_type: 'textarea', label: 'Hero Subheadline', value: 'Accurate attendance tracking with AI built in — so nothing slips through the cracks.',                                                 sort_order: 2 },
  { page_id: '00000000-0000-0000-0002-000000000003', block_key: 'cta.headline',     block_type: 'text',     label: 'CTA Headline',     value: 'No more disputed timesheets.',                                                                                                         sort_order: 3 },
  { page_id: '00000000-0000-0000-0002-000000000003', block_key: 'cta.subheadline',  block_type: 'textarea', label: 'CTA Subheadline',  value: 'Photo-verified, AI-assisted, and fully auditable — from the first clock-in.',                                                         sort_order: 4 },
  // Team Management
  { page_id: '00000000-0000-0000-0002-000000000004', block_key: 'hero.headline',    block_type: 'text',     label: 'Hero Headline',    value: 'Your company structure, exactly how you need it.',                                                                                     sort_order: 1 },
  { page_id: '00000000-0000-0000-0002-000000000004', block_key: 'hero.subheadline', block_type: 'textarea', label: 'Hero Subheadline', value: 'Full control from the top. Focused access for everyone else.',                                                                         sort_order: 2 },
  { page_id: '00000000-0000-0000-0002-000000000004', block_key: 'cta.headline',     block_type: 'text',     label: 'CTA Headline',     value: 'Get your team set up in minutes.',                                                                                                     sort_order: 3 },
  { page_id: '00000000-0000-0000-0002-000000000004', block_key: 'cta.subheadline',  block_type: 'textarea', label: 'CTA Subheadline',  value: 'No IT team. No training programme. Just a clean system your whole organisation can use from day one.',                                sort_order: 4 },
  // Smart Notifications
  { page_id: '00000000-0000-0000-0002-000000000005', block_key: 'hero.headline',    block_type: 'text',     label: 'Hero Headline',    value: 'No more chasing people for updates.',                                                                                                  sort_order: 1 },
  { page_id: '00000000-0000-0000-0002-000000000005', block_key: 'hero.subheadline', block_type: 'textarea', label: 'Hero Subheadline', value: 'Tasking handles the follow-ups. You handle the business.',                                                                             sort_order: 2 },
  { page_id: '00000000-0000-0000-0002-000000000005', block_key: 'cta.headline',     block_type: 'text',     label: 'CTA Headline',     value: 'Stay in the loop. Automatically.',                                                                                                     sort_order: 3 },
  { page_id: '00000000-0000-0000-0002-000000000005', block_key: 'cta.subheadline',  block_type: 'textarea', label: 'CTA Subheadline',  value: 'Every key moment in your workflow, covered — without you lifting a finger.',                                                           sort_order: 4 },
  // Mission
  { page_id: '00000000-0000-0000-0002-000000000006', block_key: 'hero.headline',    block_type: 'text',     label: 'Hero Headline',    value: 'We built Tasking because SMEs deserve better.',                                                                                        sort_order: 1 },
  { page_id: '00000000-0000-0000-0002-000000000006', block_key: 'hero.subheadline', block_type: 'textarea', label: 'Hero Subheadline', value: 'Not a watered-down version of enterprise software. Not another spreadsheet wrapper. A platform built from scratch for the way SMEs actually operate.', sort_order: 2 },
  // Problem & Solution
  { page_id: '00000000-0000-0000-0002-000000000007', block_key: 'hero.headline',    block_type: 'text',     label: 'Hero Headline',    value: 'The problem is real. The fixes are already built.',                                                                                    sort_order: 1 },
  { page_id: '00000000-0000-0000-0002-000000000007', block_key: 'hero.subheadline', block_type: 'textarea', label: 'Hero Subheadline', value: "Here's an honest breakdown of what's broken in casual workforce management, where existing tools fall short, and exactly how Tasking addresses it.", sort_order: 2 },
  // Team
  { page_id: '00000000-0000-0000-0002-000000000008', block_key: 'hero.headline',    block_type: 'text',     label: 'Hero Headline',    value: 'The people behind Tasking.',                                                                                                           sort_order: 1 },
  { page_id: '00000000-0000-0000-0002-000000000008', block_key: 'hero.subheadline', block_type: 'textarea', label: 'Hero Subheadline', value: 'A multidisciplinary team of six — covering design, frontend, backend, full-stack, and project management — working together to make casual workforce management genuinely simple.', sort_order: 2 },
  // FAQ
  { page_id: '00000000-0000-0000-0002-000000000009', block_key: 'hero.headline',    block_type: 'text',     label: 'Hero Headline',    value: 'Questions we get all the time.',                                                                                                       sort_order: 1 },
  { page_id: '00000000-0000-0000-0002-000000000009', block_key: 'hero.subheadline', block_type: 'textarea', label: 'Hero Subheadline', value: "Honest answers about how Tasking works, what's free, and what to expect.",                                                            sort_order: 2 },
]

const { error: pe } = await sb.from('marketing_pages').upsert(pages, { onConflict: 'slug', ignoreDuplicates: true })
if (pe) { console.error('pages error:', pe.message); process.exit(1) }

const { error: be } = await sb.from('marketing_content_blocks').upsert(blocks, { onConflict: 'page_id,block_key', ignoreDuplicates: true })
if (be) { console.error('blocks error:', be.message); process.exit(1) }

console.log('Done — 9 sub-pages seeded.')
