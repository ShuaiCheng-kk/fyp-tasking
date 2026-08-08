'use client'

import { createBrowserClient } from '@supabase/ssr'
import { SupabaseClient } from '@supabase/supabase-js'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let instance: SupabaseClient<any, any, any> | null = null

// Browser-only client. Unlike src/lib/supabase.ts (plain @supabase/supabase-js, session kept in
// localStorage only), this syncs the session into cookies too, which is what lets
// getServerSessionUser() (src/lib/serverAuth.ts, used by every protected API route) see a user
// who just signed in client-side via supabase.auth.signInWithPassword. Without this, a client-side
// sign-in "succeeds" but every subsequent API call the browser makes gets 401, since the server
// never sees a session.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createClient(): SupabaseClient<any, any, any> {
  if (instance) return instance
  instance = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
  return instance
}

export const supabase = createClient()
