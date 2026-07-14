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
import CasualSidebar from '@/components/CasualSidebar'

export default function CasualLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [paymentMissing, setPaymentMissing] = useState(false)
  const [checked, setChecked] = useState(false)

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
      <main style={{ marginLeft: 64, minHeight: '100vh' }}>
        {children}
      </main>
    </div>
  )
}
