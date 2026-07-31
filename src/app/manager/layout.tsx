'use client'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'
import { useReloadOnBfcacheRestore } from '@/hooks/useReloadOnBfcacheRestore'

const ROLE_DASHBOARD: Record<string, string> = {
  Owner: '/owner/dashboard',
  Partner: '/partner/dashboard',
  Employee: '/employee/dashboard',
  'Casual Worker': '/casual/dashboard',
}

export default function ManagerLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const [checking, setChecking] = useState(true)
  const authUserIdRef = useRef<string | null>(null)
  useReloadOnBfcacheRestore()

  useEffect(() => {
    if (window.location.pathname === '/manager/removed') {
      setChecking(false)
      return
    }

    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    supabase.auth.getSession().then(async ({ data: { session }, error }) => {
      // BUG-077: no session at all (logged out, never logged in, or the refresh token was revoked
      // — e.g. by BUG-071's password-reset session revocation) is NOT the same thing as "removed
      // from the company". /manager/removed says "your account has been removed", which is false
      // and misleading here — send these cases to /signin instead, matching what owner/partner's
      // layout already does correctly (see their `!userId` branch). Only an actual session that
      // resolves to a missing/mismatched user record below is a real removal.
      if (error?.message?.toLowerCase().includes('refresh token')) {
        await supabase.auth.signOut()
        localStorage.clear()
        router.replace('/signin')
        return
      }
      if (!session) {
        router.replace('/signin')
        return
      }

      authUserIdRef.current = session.user.id

      const res = await fetch(`/api/user/me?user_id=${session.user.id}`)

      if (res.status === 401) {
        localStorage.clear()
        router.replace('/manager/removed')
        return
      }
      const data = await res.json()
      const role: string = data.success ? (data.user?.role ?? '') : ''
      if (role === 'Manager') {
        setChecking(false)
      } else if (!role) {
        router.replace('/manager/removed')
      } else {
        router.replace(ROLE_DASHBOARD[role] ?? '/signin')
      }
    })
  }, [router])

  // Poll every 3 s to detect removal while the Manager stays on the page — mirrors
  // EmployeeLayout's equivalent check, which this layout was missing (BUG-051): without it, a
  // Manager already on a page when removed never gets redirected to /manager/removed and instead
  // falls through to whatever generic "no company linked" fallback that page's own data-fetch
  // happens to show, which isn't written for this scenario.
  useEffect(() => {
    if (window.location.pathname === '/manager/removed') return

    const interval = setInterval(async () => {
      const uid = authUserIdRef.current
      if (!uid) return
      try {
        const res = await fetch(`/api/user/me?user_id=${uid}`)
        if (res.status === 401 || res.status === 404) {
          clearInterval(interval)
          localStorage.clear()
          router.replace('/manager/removed')
          return
        }
        const data = await res.json()
        if (!data.success || !data.user?.role) {
          clearInterval(interval)
          localStorage.clear()
          router.replace('/manager/removed')
        }
      } catch {}
    }, 3000)

    return () => clearInterval(interval)
  }, [router])

  if (checking) return null

  return <>{children}</>
}
