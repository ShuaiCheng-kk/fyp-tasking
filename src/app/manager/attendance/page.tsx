'use client'

import { useState, useEffect } from 'react'
import ManagerSidebar from '@/components/ManagerSidebar'

export default function ManagerAttendancePage() {
  const [companyName, setCompanyName] = useState('')
  const [deptName, setDeptName] = useState('')

  useEffect(() => {
    const uid = localStorage.getItem('tasking_user_id')
    if (!uid) return
    fetch(`/api/user/me?user_id=${uid}`)
      .then(r => r.json())
      .then(async d => {
        if (!d.success) return
        const { company_id, department_id } = d.user
        if (company_id) {
          const [compRes, deptRes] = await Promise.all([
            fetch(`/api/company/current?user_id=${uid}&company_id=${company_id}`),
            fetch(`/api/company/departments?company_id=${company_id}`),
          ])
          const compData = await compRes.json()
          const deptData = await deptRes.json()
          if (compData.success && compData.company?.name) setCompanyName(compData.company.name)
          if (deptData.success && department_id) {
            const match = deptData.departments.find((d: { id: string; name: string }) => d.id === department_id)
            if (match) setDeptName(match.name)
          }
        }
      })
      .catch(() => {})
  }, [])

  const title = companyName && deptName ? `${companyName} [${deptName}] — Attendance` : 'Attendance'

  return (
    <div style={{ display: 'flex', height: '100vh', background: '#F3F4F6', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <ManagerSidebar />
      <main style={{ marginLeft: '64px', flex: 1, height: '100vh', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '18px 32px', background: '#1E3A5F', borderBottom: '1px solid #163050', position: 'sticky', top: 0, zIndex: 10 }}>
          <h1 style={{ fontWeight: 700, fontSize: '1.1875rem', color: '#FFFFFF', margin: 0 }}>{title}</h1>
        </div>
        <div style={{ padding: '28px 32px', flex: 1 }} />
      </main>
    </div>
  )
}
