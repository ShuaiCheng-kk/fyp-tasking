'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { User } from 'lucide-react'
import CasualSidebar from '@/components/CasualSidebar'

export default function CasualAttendancePage() {
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

      const attendanceRes = await fetch(`/api/casual/attendance?user_id=${userId}`)
      const attendanceData = await attendanceRes.json()

      if (cancelled) return

      if (!attendanceData.success) {
        router.replace('/signin')
        return
      }

      setUserName(attendanceData.attendance.user.full_name ?? 'Casual Worker')
      setLoading(false)
    }

    void run()

    return () => {
      cancelled = true
    }
  }, [router])

  return (
    <div style={pageStyle}>
      <CasualSidebar />

      <main style={mainStyle}>
        <div style={headerStyle}>
          <h1 style={titleStyle}>Attendance</h1>

          {!loading && (
            <div style={userBadgeStyle}>
              <span style={userIconStyle}>
                <User size={14} strokeWidth={2.2} />
              </span>
              <span>{userName}</span>
            </div>
          )}
        </div>

        <p style={emptyTextStyle}>No active shift.</p>
      </main>
    </div>
  )
}

const pageStyle: React.CSSProperties = {
  display: 'flex',
  minHeight: '100vh',
  background: '#F3F4F6',
  fontFamily: 'var(--font-body)',
}

const mainStyle: React.CSSProperties = {
  marginLeft: '64px',
  flex: 1,
  minHeight: '100vh',
  padding: '24px 32px',
}

const headerStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  paddingBottom: '22px',
  borderBottom: '1px solid #E5E7EB',
  marginBottom: '24px',
}

const titleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: '1.75rem',
  fontWeight: 700,
  color: '#111827',
  letterSpacing: '-0.04em',
}

const userBadgeStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  padding: '5px 12px 5px 7px',
  borderRadius: '999px',
  background: '#FFFFFF',
  border: '1px solid #E5E7EB',
  boxShadow: '0 2px 8px rgba(15,23,42,0.12)',
  color: '#111827',
  fontSize: '0.82rem',
  fontWeight: 700,
}

const userIconStyle: React.CSSProperties = {
  width: 22,
  height: 22,
  borderRadius: '999px',
  background: '#334155',
  color: '#FFFFFF',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
}

const emptyTextStyle: React.CSSProperties = {
  margin: 0,
  color: '#6B7280',
  fontSize: '0.95rem',
}