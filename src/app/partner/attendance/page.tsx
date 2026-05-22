'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'
import PartnerSidebar from '@/components/PartnerSidebar'

export default function PartnerAttendancePage() {
  const router = useRouter()
  const [companyName, setCompanyName] = useState('')

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      let userId = localStorage.getItem('tasking_user_id')
      if (!userId) {
        const supabase = createBrowserClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        )
        const { data: { session } } = await supabase.auth.getSession()
        if (session?.user?.id) {
          userId = session.user.id
          localStorage.setItem('tasking_user_id', userId)
        }
      }
      if (!userId) { router.replace('/signin'); return }
      if (cancelled) return

      const companyId = localStorage.getItem(`tasking_company_id_${userId}`) || ''
      if (!companyId || cancelled) return

      try {
        const params = new URLSearchParams({ user_id: userId, company_id: companyId })
        const res = await fetch(`/api/company/current?${params}`)
        const data = await res.json()
        if (!cancelled && data.success && data.company?.name) setCompanyName(data.company.name)
      } catch {}
    }
    void run()
    return () => { cancelled = true }
  }, [router])

  return (
    <div style={{ display: 'flex', height: '100vh', background: '#F3F4F6', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <PartnerSidebar />

      <main style={{ marginLeft: '64px', flex: 1, height: '100vh', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '18px 32px', background: '#FFFFFF', borderBottom: '1px solid #E5E7EB', position: 'sticky', top: 0, zIndex: 10 }}>
          <h1 style={{ fontWeight: 700, fontSize: '1.1875rem', color: '#111827', margin: 0 }}>
            {companyName ? `${companyName} — Attendance` : 'Attendance'}
          </h1>
        </div>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <p style={{ color: '#9CA3AF', fontSize: '0.9375rem' }}>Attendance coming soon</p>
        </div>
      </main>
    </div>
  )
}
