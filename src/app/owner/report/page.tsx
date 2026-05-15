'use client'

import { useState, useEffect } from 'react'
import OwnerSidebar from '@/components/OwnerSidebar'

export default function ReportPage() {
  const [companyName, setCompanyName] = useState('')

  useEffect(() => {
    const uid = localStorage.getItem('tasking_user_id') || ''
    const cid = localStorage.getItem('tasking_company_id') || ''
    if (!uid) return
    const params = new URLSearchParams({ owner_id: uid })
    if (cid) params.set('company_id', cid)
    fetch(`/api/company/by-owner?${params}`)
      .then(r => r.json())
      .then(data => { if (data.success && data.company?.name) setCompanyName(data.company.name) })
      .catch(() => {})
  }, [])

  return (
    <div style={{ display: 'flex', height: '100vh', background: '#F3F4F6', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <OwnerSidebar />

      <main style={{ marginLeft: '64px', flex: 1, height: '100vh', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>

        <div style={{
          padding: '18px 32px', background: '#FFFFFF', borderBottom: '1px solid #E5E7EB',
          position: 'sticky', top: 0, zIndex: 10,
        }}>
          <h1 style={{ fontWeight: 700, fontSize: '1.1875rem', color: '#111827', margin: 0 }}>
            {companyName ? `${companyName} Report` : 'Report'}
          </h1>
        </div>

        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <p style={{ color: '#9CA3AF', fontSize: '0.9375rem' }}>Report coming soon</p>
        </div>

      </main>
    </div>
  )
}
