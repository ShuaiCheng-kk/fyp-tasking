import { createClient } from '@supabase/supabase-js'

const sb = createClient(
  'https://qnpwuipwyidslxndgewg.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFucHd1aXB3eWlkc2x4bmRnZXdnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODA2MDE3NCwiZXhwIjoyMDkzNjM2MTc0fQ.YSQMxKFiAmSlBcQ0tAtU07MnuViwpalADYhpfGxOskU'
)

const { error } = await sb.rpc('exec_sql', {
  sql: `
    ALTER TABLE marketing_content_blocks DROP CONSTRAINT IF EXISTS marketing_content_blocks_block_type_check;
    ALTER TABLE marketing_content_blocks ADD CONSTRAINT marketing_content_blocks_block_type_check
      CHECK (block_type IN ('text','textarea','list','image','toggle','url'));
  `
})
if (error) console.error('rpc error (expected if no exec_sql fn):', error.message)
else console.log('Constraint updated.')
