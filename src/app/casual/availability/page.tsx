'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import CasualSidebar from '@/components/CasualSidebar'

const GREY = '#4B5563'

export default function CasualAvailabilityPage() {
  const router = useRouter()
  const [userName, setUserName] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    const run = async () => {
      const userId = localStorage.getItem('tasking_user_id')
      if (!userId) {
        router.replace('/signin')
        return
      }

      const availabilityRes = await fetch(`/api/casual/availability?user_id=${userId}`)
      const availabilityData = await availabilityRes.json()

      if (cancelled) return

      if (!availabilityData.success) {
        router.replace('/signin')
        return
      }

      setUserName(availabilityData.availability.user.full_name ?? '')

      if (!cancelled) setLoading(false)
    }

    void run()

    return () => {
      cancelled = true
    }
  }, [router])

  return (
    <div style={{ display: 'flex', height: '100vh', background: '#F3F4F6', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <CasualSidebar />

      <main style={{ marginLeft: '64px', flex: 1, height: '100vh', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
        <div style={{
          padding: '19px 32px',
          background: GREY,
          borderBottom: '1px solid #374151',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          position: 'sticky',
          top: 0,
          zIndex: 10,
        }}>
          <h1 style={{ fontWeight: 700, fontSize: '1.1875rem', color: '#FFFFFF', margin: 0 }}>
            {loading ? 'Availability' : 'Availability'}
          </h1>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {userName && (
              <span style={{ fontSize: '0.9rem', color: 'rgba(255,255,255,0.85)' }}>
                {userName}
              </span>
            )}

            <span style={{ padding: '4px 10px', borderRadius: '999px', fontSize: '0.8rem', fontWeight: 600, background: 'rgba(255,255,255,0.2)', color: '#FFFFFF' }}>
              Casual Worker
            </span>
          </div>
        </div>

        <div style={{ padding: '28px 32px', flex: 1 }}>
          <p style={{ margin: 0, color: '#9CA3AF', fontSize: '0.9rem' }}>
            You have not set your availability yet.
          </p>
        </div>
      </main>
    </div>
  )
}