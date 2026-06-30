import { createClient } from '@supabase/supabase-js'

const sb = createClient(
  'https://qnpwuipwyidslxndgewg.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFucHd1aXB3eWlkc2x4bmRnZXdnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODA2MDE3NCwiZXhwIjoyMDkzNjM2MTc0fQ.YSQMxKFiAmSlBcQ0tAtU07MnuViwpalADYhpfGxOskU'
)

// Fix the CHECK constraint first via rpc isn't possible, so we do it via raw query through the REST API
// Instead we'll just upsert blocks — the constraint needs to be updated manually or via migration
// For now seed the blocks and update constraint separately

const HOME    = '00000000-0000-0000-0001-000000000001'
const PRICING = '00000000-0000-0000-0001-000000000003'
const PRODUCTS_PARENT = '00000000-0000-0000-0001-000000000004'
const INDUSTRIES = '00000000-0000-0000-0001-000000000005'
const AI   = '00000000-0000-0000-0002-000000000001'
const REC  = '00000000-0000-0000-0002-000000000002'
const ATT  = '00000000-0000-0000-0002-000000000003'
const TEAM = '00000000-0000-0000-0002-000000000004'
const NOTIF= '00000000-0000-0000-0002-000000000005'

const blocks = [
  // Home section toggles
  { page_id: HOME, block_key: 'section.hero.visible',        block_type: 'text', label: 'Show Hero Section',          value: 'true', sort_order: 50 },
  { page_id: HOME, block_key: 'section.how-it-works.visible',block_type: 'text', label: 'Show How It Works Section',  value: 'true', sort_order: 51 },
  { page_id: HOME, block_key: 'section.why.visible',         block_type: 'text', label: 'Show Why Tasking Section',   value: 'true', sort_order: 52 },
  { page_id: HOME, block_key: 'section.products.visible',    block_type: 'text', label: 'Show Products Section',      value: 'true', sort_order: 53 },
  { page_id: HOME, block_key: 'section.industries.visible',  block_type: 'text', label: 'Show Industries Section',    value: 'true', sort_order: 54 },
  { page_id: HOME, block_key: 'section.cta.visible',         block_type: 'text', label: 'Show CTA Section',           value: 'true', sort_order: 55 },
  // Home CTA button
  { page_id: HOME, block_key: 'cta.button.label', block_type: 'text', label: 'CTA Button Label', value: 'Get Started Free', sort_order: 60 },
  { page_id: HOME, block_key: 'cta.button.url',   block_type: 'text',  label: 'CTA Button URL',   value: '/get-started',     sort_order: 61 },
  // CTA buttons for other pages
  { page_id: PRICING,          block_key: 'cta.button.label', block_type: 'text', label: 'CTA Button Label', value: 'Get Started Free', sort_order: 10 },
  { page_id: PRICING,          block_key: 'cta.button.url',   block_type: 'text',  label: 'CTA Button URL',   value: '/get-started',     sort_order: 11 },
  { page_id: PRODUCTS_PARENT,  block_key: 'cta.button.label', block_type: 'text', label: 'CTA Button Label', value: 'Get Started Free', sort_order: 10 },
  { page_id: PRODUCTS_PARENT,  block_key: 'cta.button.url',   block_type: 'text',  label: 'CTA Button URL',   value: '/get-started',     sort_order: 11 },
  { page_id: INDUSTRIES,       block_key: 'cta.button.label', block_type: 'text', label: 'CTA Button Label', value: 'Get Started Free', sort_order: 10 },
  { page_id: INDUSTRIES,       block_key: 'cta.button.url',   block_type: 'text',  label: 'CTA Button URL',   value: '/get-started',     sort_order: 11 },
  { page_id: AI,   block_key: 'cta.button.label', block_type: 'text', label: 'CTA Button Label', value: 'Get Started Free', sort_order: 10 },
  { page_id: AI,   block_key: 'cta.button.url',   block_type: 'text',  label: 'CTA Button URL',   value: '/get-started',     sort_order: 11 },
  { page_id: REC,  block_key: 'cta.button.label', block_type: 'text', label: 'CTA Button Label', value: 'Get Started Free', sort_order: 10 },
  { page_id: REC,  block_key: 'cta.button.url',   block_type: 'text',  label: 'CTA Button URL',   value: '/get-started',     sort_order: 11 },
  { page_id: ATT,  block_key: 'cta.button.label', block_type: 'text', label: 'CTA Button Label', value: 'Get Started Free', sort_order: 10 },
  { page_id: ATT,  block_key: 'cta.button.url',   block_type: 'text',  label: 'CTA Button URL',   value: '/get-started',     sort_order: 11 },
  { page_id: TEAM, block_key: 'cta.button.label', block_type: 'text', label: 'CTA Button Label', value: 'Get Started Free', sort_order: 10 },
  { page_id: TEAM, block_key: 'cta.button.url',   block_type: 'text',  label: 'CTA Button URL',   value: '/get-started',     sort_order: 11 },
  { page_id: NOTIF,block_key: 'cta.button.label', block_type: 'text', label: 'CTA Button Label', value: 'Get Started Free', sort_order: 10 },
  { page_id: NOTIF,block_key: 'cta.button.url',   block_type: 'text',  label: 'CTA Button URL',   value: '/get-started',     sort_order: 11 },
]

const { error } = await sb.from('marketing_content_blocks').upsert(blocks, { onConflict: 'page_id,block_key', ignoreDuplicates: true })
if (error) { console.error(error.message); process.exit(1) }
console.log('Done.')
