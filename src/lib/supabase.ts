import { createClient as createSupabaseClient } from '@supabase/supabase-js'

export const createClient = () =>
  createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    }
  )

// Legacy singleton for server-side code that still imports `supabase` directly
export const supabase = createClient()
