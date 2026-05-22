'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'
import EmployeeSidebar from '@/components/EmployeeSidebar'

const GREEN = '#16A34A'

function Spinner({ size = 16 }: { size?: number }) {
  return (
    <svg className="animate-spin" width={size} height={size} viewBox="0 0 18 18" style={{ display: 'inline-block', flexShrink: 0 }}>
      <circle cx="9" cy="9" r="7" stroke="rgba(255,255,255,0.3)" strokeWidth="2.5" fill="none" />
      <path d="M9 2a7 7 0 0 1 7 7" stroke="#FFFFFF" strokeWidth="2.5" strokeLinecap="round" fill="none" />
    </svg>
  )
}

export default function EmployeeDashboard() {
  const router = useRouter()
  const [userName, setUserName] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [departmentName, setDepartmentName] = useState('')
  const [loading, setLoading] = useState(true)

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

      const meRes = await fetch(`/api/user/me?user_id=${userId}`)
      const meData = await meRes.json()
      if (cancelled) return
      if (!meData.success) { router.replace('/signin'); return }

      const { full_name, company_id } = meData.user
      if (full_name) setUserName(full_name)
      if (company_id) localStorage.setItem(`tasking_company_id_${userId}`, company_id)

      const dashRes = await fetch(`/api/employee/dashboard?user_id=${userId}`)
      const dashData = await dashRes.json()
      if (!cancelled && dashData.success) {
        setCompanyName(dashData.company_name ?? '')
        setDepartmentName(dashData.department_name ?? '')
      }

      if (!cancelled) setLoading(false)
    }
    void run()
    return () => { cancelled = true }
  }, [router])

  const title = companyName && departmentName
    ? `${companyName} [${departmentName}]`
    : companyName || 'Dashboard'

  return (
    <div style={{ display: 'flex', height: '100vh', background: '#F0FDF4', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <EmployeeSidebar />

      <main style={{ marginLeft: '64px', flex: 1, height: '100vh', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
        <div style={{
          padding: '18px 32px',
          background: GREEN,
          borderBottom: '1px solid #15803D',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          position: 'sticky',
          top: 0,
          zIndex: 10,
        }}>
          <h1 style={{ fontWeight: 700, fontSize: '1.1875rem', color: '#FFFFFF', margin: 0 }}>
            {loading ? '' : title}
          </h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {userName && (
              <span style={{ fontSize: '0.9rem', color: 'rgba(255,255,255,0.85)' }}>{userName}</span>
            )}
            <span style={{
              padding: '4px 10px',
              borderRadius: '999px',
              fontSize: '0.8rem',
              fontWeight: 600,
              background: 'rgba(255,255,255,0.2)',
              color: '#FFFFFF',
            }}>
              Employee
            </span>
          </div>
        </div>

        <div style={{ padding: '28px 32px', flex: 1 }}>
          {loading && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#6B7280', fontSize: '0.9375rem' }}>
              <svg className="animate-spin" width={16} height={16} viewBox="0 0 18 18">
                <circle cx="9" cy="9" r="7" stroke="rgba(17,24,39,0.2)" strokeWidth="2.5" fill="none" />
                <path d="M9 2a7 7 0 0 1 7 7" stroke="#16A34A" strokeWidth="2.5" strokeLinecap="round" fill="none" />
              </svg>
              Loading…
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
