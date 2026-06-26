// One-time setup script: creates marketing_pages + marketing_content_blocks tables and seeds data.
// Run with: node scripts/seed-marketing-pages.mjs

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://qnpwuipwyidslxndgewg.supabase.co'
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFucHd1aXB3eWlkc2x4bmRnZXdnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODA2MDE3NCwiZXhwIjoyMDkzNjM2MTc0fQ.YSQMxKFiAmSlBcQ0tAtU07MnuViwpalADYhpfGxOskU'

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

const pages = [
  { id: '00000000-0000-0000-0001-000000000001', slug: 'home',       title: 'Home',       route_path: '/',           is_editable: true },
  { id: '00000000-0000-0000-0001-000000000002', slug: 'about',      title: 'About',      route_path: '/about',      is_editable: true },
  { id: '00000000-0000-0000-0001-000000000003', slug: 'pricing',    title: 'Pricing',    route_path: '/pricing',    is_editable: true },
  { id: '00000000-0000-0000-0001-000000000004', slug: 'products',   title: 'Products',   route_path: '/products',   is_editable: true },
  { id: '00000000-0000-0000-0001-000000000005', slug: 'industries', title: 'Industries', route_path: '/industries', is_editable: true },
]

const blocks = [
  // Home
  { page_id: '00000000-0000-0000-0001-000000000001', block_key: 'hero.badge',              block_type: 'text',     label: 'Hero Badge',               value: 'Built for SMEs',                                                                                                                                  sort_order: 1 },
  { page_id: '00000000-0000-0000-0001-000000000001', block_key: 'hero.headline.line1',     block_type: 'text',     label: 'Hero Headline Line 1',     value: 'Hire. Schedule. Track.',                                                                                                                           sort_order: 2 },
  { page_id: '00000000-0000-0000-0001-000000000001', block_key: 'hero.headline.line2',     block_type: 'text',     label: 'Hero Headline Line 2',     value: 'All in One Place.',                                                                                                                                sort_order: 3 },
  { page_id: '00000000-0000-0000-0001-000000000001', block_key: 'hero.subheadline',        block_type: 'textarea', label: 'Hero Subheadline',         value: 'Tasking is the all-in-one casual workforce management platform that helps SMEs hire, schedule, and track their teams without the complexity.',      sort_order: 4 },
  { page_id: '00000000-0000-0000-0001-000000000001', block_key: 'why.title',               block_type: 'text',     label: 'Why Section Title',        value: 'Why SMEs Choose Tasking',                                                                                                                          sort_order: 5 },
  { page_id: '00000000-0000-0000-0001-000000000001', block_key: 'why.card.simple.title',   block_type: 'text',     label: 'Why Card 1 Title',         value: 'Simple Enough for Anyone',                                                                                                                         sort_order: 6 },
  { page_id: '00000000-0000-0000-0001-000000000001', block_key: 'why.card.simple.desc',    block_type: 'textarea', label: 'Why Card 1 Description',   value: 'Designed for SME owners who need results without a learning curve. No technical knowledge needed - just set up and go.',                           sort_order: 7 },
  { page_id: '00000000-0000-0000-0001-000000000001', block_key: 'why.card.control.title',  block_type: 'text',     label: 'Why Card 2 Title',         value: 'Full Control, Department by Department',                                                                                                            sort_order: 8 },
  { page_id: '00000000-0000-0000-0001-000000000001', block_key: 'why.card.control.desc',   block_type: 'textarea', label: 'Why Card 2 Description',   value: 'Managers handle their own recruitment and scheduling while owners keep full visibility across all departments.',                                    sort_order: 9 },
  { page_id: '00000000-0000-0000-0001-000000000001', block_key: 'why.card.ai.title',       block_type: 'text',     label: 'Why Card 3 Title',         value: 'Enterprise AI - Free for Everyone',                                                                                                                sort_order: 10 },
  { page_id: '00000000-0000-0000-0001-000000000001', block_key: 'why.card.ai.desc',        block_type: 'textarea', label: 'Why Card 3 Description',   value: 'AI-powered job description generation, candidate recommendations, and anomaly detection are included in the free plan.',                           sort_order: 11 },
  { page_id: '00000000-0000-0000-0001-000000000001', block_key: 'why.card.casual.title',   block_type: 'text',     label: 'Why Card 4 Title',         value: 'Built for Casual Workforce Realities',                                                                                                             sort_order: 12 },
  { page_id: '00000000-0000-0000-0001-000000000001', block_key: 'why.card.casual.desc',    block_type: 'textarea', label: 'Why Card 4 Description',   value: 'Photo-based clock-in verification, digital attendance records, and automated workflows are built for flexible workers.',                           sort_order: 13 },
  { page_id: '00000000-0000-0000-0001-000000000001', block_key: 'products.title',          block_type: 'text',     label: 'Products Section Title',   value: 'Everything You Need, In One Platform',                                                                                                             sort_order: 14 },
  { page_id: '00000000-0000-0000-0001-000000000001', block_key: 'industries.title',        block_type: 'text',     label: 'Industries Section Title', value: 'Built for the Industries That Run on Casual Workers',                                                                                              sort_order: 15 },
  { page_id: '00000000-0000-0000-0001-000000000001', block_key: 'cta.headline',            block_type: 'text',     label: 'CTA Headline',             value: 'Ready to simplify your workforce?',                                                                                                                sort_order: 16 },
  { page_id: '00000000-0000-0000-0001-000000000001', block_key: 'cta.subheadline',         block_type: 'textarea', label: 'CTA Subheadline',          value: 'Join SMEs already using Tasking to hire smarter, schedule faster, and track with confidence.',                                                    sort_order: 17 },
  // About
  { page_id: '00000000-0000-0000-0001-000000000002', block_key: 'hero.headline',    block_type: 'text',     label: 'Hero Headline',    value: "Built by people who've seen the chaos firsthand.",                                                                                                 sort_order: 1 },
  { page_id: '00000000-0000-0000-0001-000000000002', block_key: 'hero.subheadline', block_type: 'textarea', label: 'Hero Subheadline', value: 'Tasking was born out of a simple frustration - watching SMEs struggle with casual workforce management using tools that were never built for them.', sort_order: 2 },
  // Pricing
  { page_id: '00000000-0000-0000-0001-000000000003', block_key: 'hero.headline',    block_type: 'text',     label: 'Hero Headline',    value: 'Simple, Transparent Pricing',                                            sort_order: 1 },
  { page_id: '00000000-0000-0000-0001-000000000003', block_key: 'hero.subheadline', block_type: 'textarea', label: 'Hero Subheadline', value: "Start free. Upgrade when you're ready. No hidden fees, no surprises.",  sort_order: 2 },
  { page_id: '00000000-0000-0000-0001-000000000003', block_key: 'cta.headline',     block_type: 'text',     label: 'CTA Headline',     value: 'Start for free today',                                                   sort_order: 3 },
  { page_id: '00000000-0000-0000-0001-000000000003', block_key: 'cta.subheadline',  block_type: 'textarea', label: 'CTA Subheadline',  value: 'No credit card required. Set up your team in minutes.',                 sort_order: 4 },
  // Products
  { page_id: '00000000-0000-0000-0001-000000000004', block_key: 'hero.headline',    block_type: 'text',     label: 'Hero Headline',    value: 'Every Tool Your Team Needs',                                                                                                    sort_order: 1 },
  { page_id: '00000000-0000-0000-0001-000000000004', block_key: 'hero.subheadline', block_type: 'textarea', label: 'Hero Subheadline', value: 'From hiring to scheduling to attendance — Tasking covers the full casual workforce lifecycle in one platform.',                   sort_order: 2 },
  { page_id: '00000000-0000-0000-0001-000000000004', block_key: 'intro.title',      block_type: 'text',     label: 'Intro Title',      value: 'Built for Real SME Workflows',                                                                                                   sort_order: 3 },
  { page_id: '00000000-0000-0000-0001-000000000004', block_key: 'intro.body',       block_type: 'textarea', label: 'Intro Body',       value: 'Each module is designed to work standalone or as part of the full suite, giving you flexibility as you scale.',                  sort_order: 4 },
  { page_id: '00000000-0000-0000-0001-000000000004', block_key: 'cta.headline',     block_type: 'text',     label: 'CTA Headline',     value: 'See Tasking in action',                                                                                                          sort_order: 5 },
  { page_id: '00000000-0000-0000-0001-000000000004', block_key: 'cta.subheadline',  block_type: 'textarea', label: 'CTA Subheadline',  value: 'Get started free and explore every feature your team needs.',                                                                   sort_order: 6 },
  // Industries
  { page_id: '00000000-0000-0000-0001-000000000005', block_key: 'hero.headline',    block_type: 'text',     label: 'Hero Headline',    value: 'Built for the Industries That Rely on Casual Workers',                                                                           sort_order: 1 },
  { page_id: '00000000-0000-0000-0001-000000000005', block_key: 'hero.subheadline', block_type: 'textarea', label: 'Hero Subheadline', value: 'Hospitality, retail, events, construction — Tasking adapts to the unique demands of your industry.',                             sort_order: 2 },
  { page_id: '00000000-0000-0000-0001-000000000005', block_key: 'intro.title',      block_type: 'text',     label: 'Intro Title',      value: 'Your Industry, Your Workflow',                                                                                                   sort_order: 3 },
  { page_id: '00000000-0000-0000-0001-000000000005', block_key: 'intro.body',       block_type: 'textarea', label: 'Intro Body',       value: 'Whether you run a café, a retail chain, or a construction firm, Tasking gives you the tools to manage your casual workforce with confidence.', sort_order: 4 },
  { page_id: '00000000-0000-0000-0001-000000000005', block_key: 'cta.headline',     block_type: 'text',     label: 'CTA Headline',     value: 'Find your industry fit',                                                                                                         sort_order: 5 },
  { page_id: '00000000-0000-0000-0001-000000000005', block_key: 'cta.subheadline',  block_type: 'textarea', label: 'CTA Subheadline',  value: 'Join SMEs across industries already simplifying their casual workforce management with Tasking.',                                sort_order: 6 },
]

async function run() {
  // Check if tables exist by trying a select
  const { error: checkError } = await supabase.from('marketing_pages').select('id').limit(1)
  if (checkError && checkError.message.includes('does not exist')) {
    console.error('Tables do not exist yet. Please apply the migration SQL first.')
    process.exit(1)
  }

  // Upsert pages
  const { error: pagesError } = await supabase
    .from('marketing_pages')
    .upsert(pages, { onConflict: 'slug' })
  if (pagesError) { console.error('Pages insert failed:', pagesError.message); process.exit(1) }
  console.log(`✓ Upserted ${pages.length} marketing pages`)

  // Upsert blocks
  const { error: blocksError } = await supabase
    .from('marketing_content_blocks')
    .upsert(blocks, { onConflict: 'page_id,block_key' })
  if (blocksError) { console.error('Blocks insert failed:', blocksError.message); process.exit(1) }
  console.log(`✓ Upserted ${blocks.length} content blocks`)

  // Verify
  const { data: verifyPages } = await supabase.from('marketing_pages').select('slug')
  console.log('Pages in DB:', verifyPages?.map(p => p.slug).join(', '))
}

run()
