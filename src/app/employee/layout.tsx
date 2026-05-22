'use client'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'

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

  useEffect(() => {
    if (window.location.pathname === '/employee/removed') {
      setChecking(false)
      return
    }

    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) {
        router.replace('/employee/removed')
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
    }, 10000)

    return () => clearInterval(interval)
  }, [router])

  if (checking) return null

  return <>{children}</>
}
