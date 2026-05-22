'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import EmployeeSidebar from '@/components/EmployeeSidebar'

const GREEN = '#16A34A'

export default function EmployeeAttendancePage() {
  const router = useRouter()
  const [userName, setUserName] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [departmentName, setDepartmentName] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      const userId = localStorage.getItem('tasking_user_id')
      if (!userId) { router.replace('/signin'); return }

      const meRes = await fetch(`/api/user/me?user_id=${userId}`)
      const meData = await meRes.json()
      if (cancelled) return
      if (!meData.success) { router.replace('/signin'); return }
      setUserName(meData.user.full_name ?? '')

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
    ? `${companyName} [${departmentName}] — Attendance`
    : 'Attendance'

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
            {loading ? 'Attendance' : title}
          </h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {userName && <span style={{ fontSize: '0.9rem', color: 'rgba(255,255,255,0.85)' }}>{userName}</span>}
            <span style={{ padding: '4px 10px', borderRadius: '999px', fontSize: '0.8rem', fontWeight: 600, background: 'rgba(255,255,255,0.2)', color: '#FFFFFF' }}>
              Employee
            </span>
          </div>
        </div>

        <div style={{ padding: '28px 32px', flex: 1 }} />
      </main>
    </div>
  )
}
