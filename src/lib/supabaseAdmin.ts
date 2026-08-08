import { createClient, SupabaseClient } from '@supabase/supabase-js'

// Server-only admin client. Never import this from client components.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let instance: SupabaseClient<any, any, any> | null = null

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getSupabaseAdmin(): SupabaseClient<any, any, any> {
  if (!instance) {
    instance = createClient<any, any, any>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
  }
  return instance
}

