'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Building2, CalendarDays, Clock, DollarSign } from 'lucide-react'

type HistoryEntry = {
  id: string
  title: string | null
  company_name: string | null
  shift_date: string
  clock_in_time: string | null
  clock_out_time: string | null
  hours: number | null
  pay: number | null
}

function formatDate(dateKey: string) {
  return new Date(`${dateKey}T00:00:00`).toLocaleDateString('en-SG', {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
  })
}

function formatClockTime(value: string | null) {
  if (!value) return '—'
  return new Date(value).toLocaleTimeString('en-SG', { hour: 'numeric', minute: '2-digit', hour12: true })
}

export default function CasualAttendancePage() {
  const router = useRouter()
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const uid = localStorage.getItem('tasking_user_id')
    if (!uid) {
      router.replace('/signin')
      return
    }
    const load = async () => {
      const res = await fetch(`/api/casual/attendance?resource=history&user_id=${uid}`)
      const data = await res.json()
      if (data.success) setHistory(data.history)
      setLoading(false)
    }
    void load()
  }, [router])

  const totalPay = history.reduce((sum, h) => sum + (h.pay ?? 0), 0)

  return (
    <main style={pageStyle}>
      <div style={{ marginBottom: 20 }}>
        <h1 className="mb-0 font-heading text-3xl font-bold tracking-tight text-gray-950">
          Attendance
        </h1>
      </div>

      {loading ? null : history.length === 0 ? (
        <p style={{ margin: 0, color: '#6B7280', fontSize: '0.95rem' }}>No completed jobs yet.</p>
      ) : (
        <div style={{ maxWidth: 720, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={summaryCardStyle}>
            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#6B7280' }}>Total earned</span>
            <span style={{ fontSize: '1.375rem', fontWeight: 800, color: '#111827' }}>${totalPay.toFixed(2)}</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {history.map(entry => (
              <div key={entry.id} style={cardStyle}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, marginBottom: 10 }}>
                  <div>
                    <p style={{ margin: 0, fontWeight: 700, fontSize: '1rem', color: '#111827' }}>{entry.title || 'Job'}</p>
                    {entry.company_name && (
                      <p style={{ margin: '3px 0 0', fontSize: '0.8125rem', color: '#6B7280', display: 'flex', alignItems: 'center', gap: 5 }}>
                        <Building2 size={13} /> {entry.company_name}
                      </p>
                    )}
                  </div>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: '0.75rem', fontWeight: 700, color: '#6B7280', background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: 999, padding: '4px 11px', whiteSpace: 'nowrap' }}>
                    <CalendarDays size={12} /> {formatDate(entry.shift_date)}
                  </span>
                </div>

                <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', fontSize: '0.8425rem', color: '#374151' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                    <Clock size={13} color="#F97316" /> {formatClockTime(entry.clock_in_time)} – {formatClockTime(entry.clock_out_time)}
                    {entry.hours !== null && <span style={{ color: '#9CA3AF' }}>({entry.hours}h)</span>}
                  </span>
                  {entry.pay !== null && (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontWeight: 700, color: '#15803D' }}>
                      <DollarSign size={13} /> ${entry.pay.toFixed(2)}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </main>
  )
}

const pageStyle: React.CSSProperties = {
  minHeight: '100vh',
  padding: '20px 28px 28px',
}

const cardStyle: React.CSSProperties = {
  background: '#FFFFFF',
  borderRadius: 14,
  border: '1.5px solid #E5E7EB',
  padding: '18px 22px',
  boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
}

const summaryCardStyle: React.CSSProperties = {
  ...cardStyle,
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
}
