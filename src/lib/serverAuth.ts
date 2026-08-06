// Verifies the caller's identity server-side from their Supabase auth session cookie, instead of
// trusting a client-supplied id in the request body/query string. Mirrors the cookie-reading
// pattern already used by api/auth/signin and api/auth/debug (createServerClient + next/headers).
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { authRepository } from '@/repositories/auth/authRepository'
import { User } from '@/types/auth.types'

export interface ServerSessionUser {
  // The Supabase auth user id (auth.users.id / users.supabase_auth_id) — some endpoints (e.g. the
  // worker profile routes) key off this directly rather than the internal users.id.
  auth_id: string
  user: User
}

// Returns null when there is no valid session — callers decide the 401/403 response.
export async function getServerSessionUser(): Promise<ServerSessionUser | null> {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options)
          })
        },
      },
    }
  )

  // getUser() (not getSession()) revalidates the token against the Supabase auth server rather
  // than trusting the cookie's payload alone.
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return null

  const profile = await authRepository.findByAuthId(user.id)
  if (!profile) return null

  return { auth_id: user.id, user: profile }
}
