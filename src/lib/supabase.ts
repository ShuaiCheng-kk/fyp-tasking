import { createClient as createSupabaseClient } from '@supabase/supabase-js'

let supabaseInstance: ReturnType<typeof createSupabaseClient> | null = null

export const createClient = () => {
  if (supabaseInstance) return supabaseInstance

  supabaseInstance = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        storageKey: 'tasking-auth-token',
      },
    }
  )

  return supabaseInstance
}

// Legacy singleton for server-side code that still imports `supabase` directly
export const supabase = createClient()
