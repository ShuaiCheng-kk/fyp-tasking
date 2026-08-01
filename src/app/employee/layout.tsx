'use client'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'
import { useReloadOnBfcacheRestore } from '@/hooks/useReloadOnBfcacheRestore'

const ROLE_DASHBOARD: Record<string, string> = {
  Owner: '/owner/dashboard',
  Partner: '/partner/dashboard',
  Manager: '/manager/dashboard',
  'Casual Worker': '/casual/dashboard',
}

export default function EmployeeLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [checking, setChecking] = useState(true)
  const authUserIdRef = useRef<string | null>(null)
  useReloadOnBfcacheRestore()

  useEffect(() => {
    if (window.location.pathname === '/employee/removed') {
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
      // from the company". /employee/removed says "your account has been removed", which is false
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
        router.replace('/employee/removed')
        return
      }
      const data = await res.json()
      const role: string = data.success ? (data.user?.role ?? '') : ''
      if (role === 'Employee') {
        setChecking(false)
      } else if (!role) {
        router.replace('/employee/removed')
      } else {
        router.replace(ROLE_DASHBOARD[role] ?? '/signin')
      }
    })
  }, [router])

  // Poll every 10 s to detect removal while the employee is on the page
  useEffect(() => {
    if (window.location.pathname === '/employee/removed') return

    const interval = setInterval(async () => {
      const uid = authUserIdRef.current
      if (!uid) return
      try {
        const res = await fetch(`/api/user/me?user_id=${uid}`)
        if (res.status === 401 || res.status === 404) {
          clearInterval(interval)
          localStorage.clear()
          router.replace('/employee/removed')
          return
        }
        const data = await res.json()
        if (!data.success || !data.user?.role) {
          clearInterval(interval)
          localStorage.clear()
          router.replace('/employee/removed')
        }
      } catch {}
    }, 3000)

    return () => clearInterval(interval)
  }, [router])

  if (checking) return null

  return <>{children}</>
}
