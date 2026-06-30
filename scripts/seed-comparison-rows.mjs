import { createClient } from '@supabase/supabase-js'

const sb = createClient(
  'https://qnpwuipwyidslxndgewg.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFucHd1aXB3eWlkc2x4bmRnZXdnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODA2MDE3NCwiZXhwIjoyMDkzNjM2MTc0fQ.YSQMxKFiAmSlBcQ0tAtU07MnuViwpalADYhpfGxOskU'
)

const PRODUCTS = '00000000-0000-0000-0001-000000000004'

const rows = [
  'Split shift timeline',
  'Shift acceptance deadlines',
  'Clopening detection',
  'Reverse actions',
  'Support sub-tasks',
  'Recurring job posting',
  'Duplicate job posting',
  'Archive job posting',
  'Photo-based clock-in verification',
  'AI candidate recommendation',
  'AI job description generator',
  'AI anomaly detection',
]

const blocks = rows.map((value, i) => ({
  page_id: PRODUCTS,
  block_key: `comparison.row.${i}`,
  block_type: 'text',
  label: `Comparison Row ${i + 1}`,
  value,
  sort_order: 200 + i,
}))

const { error } = await sb
  .from('marketing_content_blocks')
  .upsert(blocks, { onConflict: 'page_id,block_key' })

if (error) { console.error(error.message); process.exit(1) }
console.log(`Done — seeded ${blocks.length} comparison rows.`)
