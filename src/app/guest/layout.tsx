'use client'

import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import CasualSidebar from '@/components/CasualSidebar'

type WorkerRole = 'Guest User' | 'Casual Worker'

const guestAllowedRoutes = [
  '/guest/applications',
]

export default function WorkerLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const pathname = usePathname()

  const [role, setRole] = useState<WorkerRole | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadRole = async () => {
      try {
        const authId = localStorage.getItem('tasking_user_id')

        if (!authId) {
          router.replace('/signin')
          return
        }

        const res = await fetch(`/api/guest/profile?user_id=${authId}`)
        const data = await res.json()

        if (!data.success) {
          router.replace('/signin')
          return
        }

        const userRole = data.profile.role as WorkerRole
        setRole(userRole)

        if (userRole === 'Guest User') {
          const allowed = guestAllowedRoutes.some((route) =>
            pathname.startsWith(route)
          )

          if (!allowed) {
            router.replace('/guest/applications')
            return
          }
        }
      } catch {
        router.replace('/signin')
      } finally {
        setLoading(false)
      }
    }

    loadRole()
  }, [pathname, router])

  if (loading || !role) {
    return <main style={{ padding: 40 }}>Loading...</main>
  }

  if (role === 'Guest User') {
    return (
      <div style={{ minHeight: '100vh', background: '#F9FAFB' }}>
        {children}
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: '#F9FAFB' }}>
      <CasualSidebar />

      <main style={{ marginLeft: 64, minHeight: '100vh' }}>
        {children}
      </main>
    </div>
  )
}