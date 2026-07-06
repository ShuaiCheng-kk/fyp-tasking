import { createClient } from '@supabase/supabase-js'

const sb = createClient(
  'https://qnpwuipwyidslxndgewg.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFucHd1aXB3eWlkc2x4bmRnZXdnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODA2MDE3NCwiZXhwIjoyMDkzNjM2MTc0fQ.YSQMxKFiAmSlBcQ0tAtU07MnuViwpalADYhpfGxOskU'
)

const HOME = '00000000-0000-0000-0001-000000000001'

const blocks = [
  { page_id: HOME, block_key: 'products.button.label', block_type: 'text', label: 'Products Button Label', value: 'Explore All Features', sort_order: 62 },
  { page_id: HOME, block_key: 'products.button.url',   block_type: 'text', label: 'Products Button URL',   value: '/products',           sort_order: 63 },
  { page_id: HOME, block_key: 'industries.button.label', block_type: 'text', label: 'Industries Button Label', value: 'Explore All Industries', sort_order: 64 },
  { page_id: HOME, block_key: 'industries.button.url',   block_type: 'text', label: 'Industries Button URL',   value: '/industries',             sort_order: 65 },
]

const { error } = await sb.from('marketing_content_blocks').upsert(blocks, { onConflict: 'page_id,block_key', ignoreDuplicates: true })
if (error) { console.error(error.message); process.exit(1) }
console.log('Done — seeded products + industries button blocks.')
