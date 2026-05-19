'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'

const ROLE_DASHBOARD: Record<string, string> = {
  Manager: '/manager/dashboard',
  Employee: '/employee/dashboard',
  'Casual Worker': '/casual/dashboard',
}

export default function OwnerLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) {
        router.replace('/signin')
        return
      }
      const res = await fetch(`/api/user/me?user_id=${session.user.id}`)
      const data = await res.json()
      const role: string = data.success ? (data.user?.role ?? '') : ''
      const redirect = ROLE_DASHBOARD[role]
      if (redirect) {
        router.replace(redirect)
      } else {
        setChecking(false)
      }
    })
  }, [router])

  if (checking) return null

  return <>{children}</>
}
