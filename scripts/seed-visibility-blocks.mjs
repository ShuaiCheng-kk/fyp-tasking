import { createClient } from '@supabase/supabase-js'

const sb = createClient(
  'https://qnpwuipwyidslxndgewg.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFucHd1aXB3eWlkc2x4bmRnZXdnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODA2MDE3NCwiZXhwIjoyMDkzNjM2MTc0fQ.YSQMxKFiAmSlBcQ0tAtU07MnuViwpalADYhpfGxOskU'
)

// section visibility blocks for every page
const ABOUT       = '00000000-0000-0000-0001-000000000002'
const PRICING     = '00000000-0000-0000-0001-000000000003'
const PRODUCTS    = '00000000-0000-0000-0001-000000000004'
const INDUSTRIES  = '00000000-0000-0000-0001-000000000005'
// sub-pages (products-*)
const P_AI        = '00000000-0000-0000-0002-000000000001'
const P_RECRUIT   = '00000000-0000-0000-0002-000000000002'
const P_ATTEND    = '00000000-0000-0000-0002-000000000003'
const P_TEAM      = '00000000-0000-0000-0002-000000000004'
const P_NOTIF     = '00000000-0000-0000-0002-000000000005'
// sub-pages (about-*)
const A_MISSION   = '00000000-0000-0000-0002-000000000006'
const A_PROBLEM   = '00000000-0000-0000-0002-000000000007'
const A_TEAM      = '00000000-0000-0000-0002-000000000008'
const A_FAQ       = '00000000-0000-0000-0002-000000000009'

const vis = (page_id, key, label, order) => ({
  page_id, block_key: `section.${key}.visible`, block_type: 'text', label, value: 'true', sort_order: order,
})

// generic section keys: hero, intro, content, cta
const generic = (page_id) => [
  vis(page_id, 'hero',    'Hero Section',    1),
  vis(page_id, 'intro',   'Intro Section',   2),
  vis(page_id, 'content', 'Page Content',    3),
  vis(page_id, 'cta',     'CTA Section',     4),
]

const blocks = [
  // About page (dedicated preview)
  vis(ABOUT, 'hero',       'Hero Section',        1),
  vis(ABOUT, 'learn-more', 'Learn More Cards',    2),
  vis(ABOUT, 'cta',        'CTA / Quote Section', 3),

  // Products page (dedicated preview)
  vis(PRODUCTS, 'hero',       'Hero Section',        1),
  vis(PRODUCTS, 'why',        '"We kept it simple"', 2),
  vis(PRODUCTS, 'comparison', 'Comparison Table',    3),
  vis(PRODUCTS, 'modules',    'Module Cards',        4),
  vis(PRODUCTS, 'cta',        'CTA Section',         5),

  // Generic pages
  ...generic(PRICING),
  ...generic(INDUSTRIES),
  ...generic(P_AI),
  ...generic(P_RECRUIT),
  ...generic(P_ATTEND),
  ...generic(P_TEAM),
  ...generic(P_NOTIF),
  ...generic(A_MISSION),
  ...generic(A_PROBLEM),
  ...generic(A_TEAM),
  ...generic(A_FAQ),
]

const { error } = await sb.from('marketing_content_blocks').upsert(blocks, { onConflict: 'page_id,block_key', ignoreDuplicates: true })
if (error) { console.error(error.message); process.exit(1) }
console.log(`Done — seeded ${blocks.length} visibility blocks.`)
