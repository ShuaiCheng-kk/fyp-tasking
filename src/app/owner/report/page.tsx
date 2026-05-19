'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'
import OwnerSidebar from '@/components/OwnerSidebar'

export default function ReportPage() {
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
      if (!userId) {
        router.replace('/signin')
        return
      }
      if (cancelled) return

      let companyId = localStorage.getItem(`tasking_company_id_${userId}`) || ''

      if (!companyId) {
        // Fallback 1: fetch from /api/user/me (works for invited users)
        try {
          const res = await fetch(`/api/user/me?user_id=${userId}`)
          const data = await res.json()
          if (data.success && data.user?.company_id) {
            companyId = data.user.company_id
            localStorage.setItem(`tasking_company_id_${userId}`, companyId)
          }
        } catch {}
      }

      if (!companyId) {
        // Fallback 2: fetch default company for owner
        try {
          const res = await fetch(`/api/company/by-owner?owner_id=${userId}`)
          const data = await res.json()
          if (data.success && data.company?.id) {
            companyId = data.company.id
            localStorage.setItem(`tasking_company_id_${userId}`, companyId)
          }
        } catch {}
      }

      if (!companyId || cancelled) return

      try {
        const params = new URLSearchParams({ user_id: userId, company_id: companyId })
        const res = await fetch(`/api/company/current?${params}`)
        const data = await res.json()
        if (!cancelled && data.success && data.company?.name) {
          setCompanyName(data.company.name)
        }
      } catch {}
    }
    void run()
    return () => { cancelled = true }
  }, [router])

  return (
    <div style={{ display: 'flex', height: '100vh', background: '#F3F4F6', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <OwnerSidebar />

      <main style={{ marginLeft: '64px', flex: 1, height: '100vh', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>

        <div style={{
          padding: '18px 32px', background: '#FFFFFF', borderBottom: '1px solid #E5E7EB',
          position: 'sticky', top: 0, zIndex: 10,
        }}>
          <h1 style={{ fontWeight: 700, fontSize: '1.1875rem', color: '#111827', margin: 0 }}>
            {companyName ? `${companyName} — Report` : 'Report'}
          </h1>
        </div>

        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <p style={{ color: '#9CA3AF', fontSize: '0.9375rem' }}>Report coming soon</p>
        </div>

      </main>
    </div>
  )
}
