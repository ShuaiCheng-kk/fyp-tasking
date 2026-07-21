'use client'

import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import CasualSidebar from '@/components/CasualSidebar'
import GuestSidebar from '@/components/GuestSidebar'

type WorkerRole = 'Guest User' | 'Casual Worker'

const guestAllowedRoutes = [
  '/guest/applications',
  '/guest/profile',
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

        // Only a definitive "this account does not exist" may end the session. Transient
        // failures (dev-server recompile, network blip, a 500) must NOT bounce an
        // authenticated worker to /signin — that's handled in catch below.
        if (res.status === 404) {
          localStorage.removeItem('tasking_user_id')
          localStorage.removeItem('tasking_user_role')
          router.replace('/signin')
          return
        }

        const data = await res.json()
        if (!data.success) throw new Error(data.message || 'Failed to load profile')

        // The role for THIS session is the one signin/page.tsx stamped into localStorage at
        // login, not whatever the DB says right now — accepting a job offer promotes the
        // account to Casual Worker immediately server-side, but swapping the sidebar/menu out
        // from under the worker mid-session (e.g. the instant they click into Profile) would be
        // confusing. That switch is only supposed to happen on their NEXT sign-in. Only fall
        // back to the live DB role if nothing usable was stored (shouldn't happen via the
        // normal sign-in flow).
        const storedRole = localStorage.getItem('tasking_user_role')
        const userRole: WorkerRole =
          storedRole === 'Guest User' || storedRole === 'Casual Worker'
            ? storedRole
            : (data.profile.role as WorkerRole)
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
        // Fall back to the locally stored role so a momentary API failure doesn't log the
        // worker out of the UI; only workers with no usable session end up at /signin.
        const storedRole = localStorage.getItem('tasking_user_role')
        if (storedRole === 'Guest User' || storedRole === 'Casual Worker') {
          setRole(storedRole as WorkerRole)
        } else {
          router.replace('/signin')
        }
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
      <div style={{ height: '100vh', overflow: 'hidden', background: '#F9FAFB' }}>
        <GuestSidebar />

        <main style={{ marginLeft: 64, height: '100vh', minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          {children}
        </main>
      </div>
    )
  }

  return (
    <div style={{ height: '100vh', overflow: 'hidden', background: '#F9FAFB' }}>
      <CasualSidebar />

      <main style={{ marginLeft: 64, height: '100vh', minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {children}
      </main>
    </div>
  )
}