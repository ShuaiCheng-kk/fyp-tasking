import { createClient as createSupabaseClient, SupabaseClient } from '@supabase/supabase-js'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let supabaseInstance: SupabaseClient<any, any, any> | null = null

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const createClient = (): SupabaseClient<any, any, any> => {
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
