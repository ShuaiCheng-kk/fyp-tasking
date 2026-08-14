'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { LogOut } from 'lucide-react'
import { createBrowserClient } from '@supabase/ssr'
import CasualSidebar from '@/components/CasualSidebar'
import GuestSidebar from '@/components/GuestSidebar'
import { useIsCompactViewport } from '@/hooks/useIsCompactViewport'
import { useReloadOnBfcacheRestore } from '@/hooks/useReloadOnBfcacheRestore'
import type { WorkerProfile } from '@/types/WorkerProfile'

type WorkerRole = 'Guest User' | 'Casual Worker'

// Below this the sidebar rail becomes a fixed bottom tab bar (see GuestSidebar/CasualSidebar) and
// Logout moves into a slim top bar, since a hover-expand rail has no touch equivalent.
const PHONE_BREAKPOINT = 640

const guestAllowedRoutes = [
  '/guest/applications',
  '/guest/profile',
]

// The layout already fetches the full WorkerProfile below for its own role-guard check — expose
// it to pages under this layout instead of each page (Applications, Profile) running the exact
// same `/api/guest/profile` fetch again right after the layout's own "Loading…" gate clears
// (2026-07-31). Null means "not available from the layout" (first render, or the layout's fetch
// hit its error fallback) — a consumer should fall back to fetching for itself in that case.
const WorkerProfileContext = createContext<WorkerProfile | null>(null)
export function useLayoutWorkerProfile() {
  return useContext(WorkerProfileContext)
}

export default function WorkerLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const pathname = usePathname()
  const isPhone = useIsCompactViewport(PHONE_BREAKPOINT)
  useReloadOnBfcacheRestore()

  const [role, setRole] = useState<WorkerRole | null>(null)
  const [profile, setProfile] = useState<WorkerProfile | null>(null)
  const [loading, setLoading] = useState(true)

  const handleLogout = async () => {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    await supabase.auth.signOut()
    localStorage.removeItem('tasking_user_id')
    localStorage.removeItem('tasking_user_role')
    localStorage.removeItem('tasking_company_id')
    localStorage.removeItem('tasking_active_session')
    localStorage.removeItem('apply_job_id')
    sessionStorage.removeItem('tasking_session_active')
    window.location.href = '/signout'
  }

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
        setProfile(data.profile)

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

  return (
    <div style={{ height: '100vh', overflow: 'hidden', background: '#F9FAFB' }}>
      {role === 'Guest User' ? <GuestSidebar /> : <CasualSidebar />}

      {/* Phone — the sidebar is a bottom tab bar down here, so Logout gets its own slim top bar
          (same shell as casual/layout.tsx). */}
      {isPhone && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, zIndex: 20, height: 44,
          display: 'flex', alignItems: 'center', justifyContent: 'flex-end', padding: '0 14px',
          background: '#FFFFFF', borderBottom: '1px solid #E5E7EB',
        }}>
          <button
            type="button"
            onClick={handleLogout}
            aria-label="Logout"
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, border: 'none', background: 'none', color: '#EF4444', cursor: 'pointer' }}
          >
            <LogOut size={18} strokeWidth={2} />
          </button>
        </div>
      )}

      {/* Phone: the 44px top bar and 64px bottom tab bar are folded INTO the same one-viewport box
          (boxSizing:border-box), so the fixed bars can never push the document past 100vh. */}
      <main style={isPhone
        ? { marginLeft: 0, height: '100vh', minHeight: 0, overflow: 'hidden', boxSizing: 'border-box', paddingTop: 44, paddingBottom: 64, display: 'flex', flexDirection: 'column' }
        : { marginLeft: 64, height: '100vh', minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}
      >
        <WorkerProfileContext.Provider value={profile}>{children}</WorkerProfileContext.Provider>
      </main>
    </div>
  )
}