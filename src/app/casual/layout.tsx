'use client'

// Casual Worker shell — same shared layout pattern as src/app/guest/layout.tsx: one sidebar +
// margin wrapper for every page under this route group, so individual pages don't each re-render
// their own copy of the chrome.
//
// Also enforces the first-login Payment Information gate: a Casual Worker is a just-confirmed
// Guest User, and without payment info on file they can never be paid — so until it's filled in,
// every nav item except Profile is locked and any other route bounces back to /casual/profile.

import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { LogOut } from 'lucide-react'
import { createBrowserClient } from '@supabase/ssr'
import CasualSidebar from '@/components/CasualSidebar'
import { useIsCompactViewport } from '@/hooks/useIsCompactViewport'

const PHONE_BREAKPOINT = 640

export default function CasualLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [paymentMissing, setPaymentMissing] = useState(false)
  const [checked, setChecked] = useState(false)
  const isPhone = useIsCompactViewport(PHONE_BREAKPOINT)

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
    let cancelled = false

    const run = async () => {
      const userId = localStorage.getItem('tasking_user_id')
      if (!userId) {
        router.replace('/signin')
        return
      }

      try {
        const res = await fetch(`/api/casual/profile?user_id=${userId}`)
        if (res.status === 404) {
          localStorage.removeItem('tasking_user_id')
          localStorage.removeItem('tasking_user_role')
          router.replace('/signin')
          return
        }
        const data = await res.json()
        if (cancelled) return
        if (!data.success) throw new Error(data.message || 'Failed to load profile')

        const missing = !data.profile.user.payment_account
        setPaymentMissing(missing)
        if (missing && pathname !== '/casual/profile') {
          router.replace('/casual/profile')
          return
        }
      } catch {
        // A transient failure (dev-server recompile, network blip) must not lock an
        // otherwise-fine worker out of the whole app — just skip the gate check this pass.
      } finally {
        if (!cancelled) setChecked(true)
      }
    }

    void run()

    // Saving payment info happens without a navigation, so pathname never changes — without
    // this, the sidebar would stay locked even right after a successful save.
    window.addEventListener('casual:payment-updated', run)

    return () => {
      cancelled = true
      window.removeEventListener('casual:payment-updated', run)
    }
  }, [pathname, router])

  return (
    <div style={{ minHeight: '100vh', background: '#F9FAFB' }}>
      <CasualSidebar disabled={checked && paymentMissing} />
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
      <main style={isPhone
        ? { marginLeft: 0, minHeight: '100vh', paddingTop: 44, paddingBottom: 64 }
        : { marginLeft: 64, minHeight: '100vh' }}
      >
        {children}
      </main>
    </div>
  )
}
