'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'

// Centralises the Supabase session-validity check for admin pages.
// onAuthStateChange is a browser-only event subscription and cannot go
// through an API route — this is the single place that calls it.
export function useAuthGuard() {
  const router = useRouter()

  useEffect(() => {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') router.replace('/signin')
    })

    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (error || !session) {
        supabase.auth.signOut({ scope: 'local' }).finally(() => router.replace('/signin'))
      }
    })

    return () => subscription.unsubscribe()
  }, [router])
}
