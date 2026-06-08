import { createClient } from '@supabase/supabase-js'

// Server-only admin client. Never import this from client components.
let instance: ReturnType<typeof createClient> | null = null

export function getSupabaseAdmin() {
  if (!instance) {
    instance = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
  }
  return instance
}

