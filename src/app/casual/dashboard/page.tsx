'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Building2, CalendarDays, Check, Clock, Mail, MapPin, Phone, User, UserCheck, XCircle } from 'lucide-react'
import CasualSidebar from '@/components/CasualSidebar'

type UpcomingShift = {
  id: string
  title: string
  shift_date: string
  start_time: string
  end_time: string
  is_open_ended: boolean
  company_name: string | null
  location: string | null
  supervisor: {
    full_name: string
    phone_number: string | null
    email_address: string
  } | null
}

const pageKeyframes = `
  @keyframes blockSlideUp { from { opacity: 0; transform: translateY(20px) } to { opacity: 1; transform: translateY(0) } }
  @keyframes fadeSlideUpToast { from { opacity: 0; transform: translateX(-50%) translateY(10px) } to { opacity: 1; transform: translateX(-50%) translateY(0) } }
  @keyframes overlayFadeIn { from { opacity: 0 } to { opacity: 1 } }
`

function formatShiftDate(dateKey: string) {
  return new Date(`${dateKey}T00:00:00`).toLocaleDateString('en-SG', {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
  })
}

function formatTime(time: string) {
  const [h, m] = time.split(':').map(Number)
  const ap = h < 12 ? 'AM' : 'PM'
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h
  return `${h12}:${String(m).padStart(2, '0')} ${ap}`
}

export default function CasualDashboardPage() {
  const router = useRouter()

  const [userName, setUserName] = useState('')
  const [shifts, setShifts] = useState<UpcomingShift[]>([])
  const [loading, setLoading] = useState(true)
  const [cancelTarget, setCancelTarget] = useState<UpcomingShift | null>(null)
  const [cancelReason, setCancelReason] = useState('')
  const [cancelling, setCancelling] = useState(false)
  const [cancelError, setCancelError] = useState('')
  const [toast, setToast] = useState('')
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const showToast = (msg: string) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    setToast(msg)
    toastTimerRef.current = setTimeout(() => setToast(''), 3000)
  }

  const confirmCancel = async () => {
    if (!cancelTarget) return
    setCancelling(true); setCancelError('')
    try {
      const userId = localStorage.getItem('tasking_user_id')
      const res = await fetch('/api/casual/shift-cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, shift_id: cancelTarget.id, reason: cancelReason.trim() || null }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.message || 'Failed to cancel shift')
      setShifts(prev => prev.filter(s => s.id !== cancelTarget.id))
      setCancelTarget(null); setCancelReason('')
      showToast('Shift cancelled — the employer has been notified.')
    } catch (err) {
      setCancelError(err instanceof Error ? err.message : 'Failed to cancel shift')
    } finally {
      setCancelling(false)
    }
  }

  useEffect(() => {
    let cancelled = false

    const run = async () => {
      const userId = localStorage.getItem('tasking_user_id')

      if (!userId) {
        router.replace('/signin')
        return
      }

      const dashRes = await fetch(
        `/api/casual/dashboard?user_id=${userId}`
      )
      const dashData = await dashRes.json()

      if (cancelled) return

      if (!dashData.success) {
        router.replace('/signin')
        return
      }

      setUserName(
        dashData.dashboard.user.full_name ??
        'Casual Worker'
      )
      setShifts(dashData.dashboard.upcoming_shifts ?? [])

      setLoading(false)
    }

    void run()

    return () => {
      cancelled = true
    }
  }, [router])

  return (
    <div style={pageStyle}>
      <style>{pageKeyframes}</style>
      <CasualSidebar />

      <main style={mainStyle}>
        <div style={headerStyle}>
          <h1 style={titleStyle}>Dashboard</h1>

          {!loading && (
            <div style={userBadgeStyle}>
              <span style={userIconStyle}>
                <User size={15} strokeWidth={2.2} />
              </span>

              <span>{userName}</span>
            </div>
          )}
        </div>

        {!loading && (
          shifts.length === 0 ? (
            <p style={emptyTextStyle}>No assigned work yet.</p>
          ) : (
            <div style={{ maxWidth: 620, animation: 'blockSlideUp 0.38s ease both 0.06s' }}>
              <p style={{ margin: '0 0 14px', fontSize: '0.8rem', fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Upcoming Shifts
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {shifts.map(shift => (
                  <div key={shift.id} style={{ background: '#FFFFFF', borderRadius: 14, border: '1.5px solid #E5E7EB', padding: '18px 22px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, marginBottom: 10 }}>
                      <div>
                        <p style={{ margin: 0, fontWeight: 700, fontSize: '1rem', color: '#111827' }}>{shift.title}</p>
                        {shift.company_name && (
                          <p style={{ margin: '3px 0 0', fontSize: '0.8125rem', color: '#6B7280', display: 'flex', alignItems: 'center', gap: 5 }}>
                            <Building2 size={13} /> {shift.company_name}
                          </p>
                        )}
                      </div>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: '0.75rem', fontWeight: 700, color: '#EA580C', background: '#FFF7ED', border: '1px solid #FED7AA', borderRadius: 999, padding: '4px 11px', whiteSpace: 'nowrap' }}>
                        <CalendarDays size={12} /> {formatShiftDate(shift.shift_date)}
                      </span>
                    </div>

                    <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: '0.8425rem', color: '#374151' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                        <Clock size={13} color="#F97316" />
                        {formatTime(shift.start_time)}{shift.is_open_ended ? ' — until done' : ` – ${formatTime(shift.end_time)}`}
                      </span>
                      {shift.location && (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                          <MapPin size={13} color="#F97316" /> {shift.location}
                        </span>
                      )}
                    </div>

                    {/* Who to report to on arrival — live contact of the job's responsible employee */}
                    {shift.supervisor && (
                      <div style={{ marginTop: 12, padding: '10px 14px', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 10 }}>
                        <p style={{ margin: '0 0 6px', fontSize: '0.72rem', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                          Report To
                        </p>
                        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: '0.8425rem', color: '#111827' }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontWeight: 700 }}>
                            <UserCheck size={13} color="#0EA5E9" /> {shift.supervisor.full_name}
                          </span>
                          {shift.supervisor.phone_number && (
                            <a href={`tel:${shift.supervisor.phone_number}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: '#111827', textDecoration: 'none' }}>
                              <Phone size={13} color="#0EA5E9" /> {shift.supervisor.phone_number}
                            </a>
                          )}
                          <a href={`mailto:${shift.supervisor.email_address}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: '#111827', textDecoration: 'none' }}>
                            <Mail size={13} color="#0EA5E9" /> {shift.supervisor.email_address}
                          </a>
                        </div>
                      </div>
                    )}

                    {/* Cancellation is only possible BEFORE the shift starts (enforced
                        server-side too); after that, attendance rules take over. */}
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
                      <button
                        onClick={() => { setCancelTarget(shift); setCancelReason(''); setCancelError('') }}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 5, height: 30, padding: '0 12px', borderRadius: 8, border: '1px solid #FECACA', background: '#FEF2F2', color: '#DC2626', fontWeight: 700, fontSize: '0.78rem', cursor: 'pointer' }}
                        onMouseEnter={e => { e.currentTarget.style.background = '#FEE2E2' }}
                        onMouseLeave={e => { e.currentTarget.style.background = '#FEF2F2' }}
                      >
                        <XCircle size={13} /> Cancel Shift
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )
        )}
      </main>

      {/* Cancel confirmation — reason is optional for the worker side */}
      {cancelTarget && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, zIndex: 9999, animation: 'overlayFadeIn 0.18s ease-out' }}>
          <div style={{ width: '100%', maxWidth: 440, background: '#FFFFFF', borderRadius: 16, padding: 26, boxShadow: '0 24px 64px rgba(0,0,0,0.16)' }}>
            <h3 style={{ margin: '0 0 6px', fontSize: '1.05rem', fontWeight: 700, color: '#111827' }}>
              Cancel this shift?
            </h3>
            <p style={{ margin: '0 0 14px', fontSize: '0.875rem', color: '#6B7280', lineHeight: 1.5 }}>
              {cancelTarget.title} — {formatShiftDate(cancelTarget.shift_date)}. The employer will be notified and your spot goes back up for hire.
            </p>
            <textarea
              value={cancelReason}
              onChange={e => setCancelReason(e.target.value)}
              rows={2}
              maxLength={500}
              placeholder="Reason (optional), e.g. family emergency"
              style={{ width: '100%', padding: '10px 12px', border: '1.5px solid #E5E7EB', borderRadius: 8, fontSize: '0.9rem', color: '#111827', outline: 'none', boxSizing: 'border-box', resize: 'vertical', lineHeight: 1.5, fontFamily: 'inherit' }}
            />
            {cancelError && <p style={{ margin: '8px 0 0', fontSize: '0.8125rem', color: '#DC2626' }}>{cancelError}</p>}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 16 }}>
              <button onClick={() => setCancelTarget(null)} disabled={cancelling}
                style={{ padding: '8px 16px', borderRadius: 8, border: '1.5px solid #E5E7EB', background: '#FFFFFF', color: '#6B7280', fontWeight: 700, fontSize: '0.8125rem', cursor: 'pointer' }}>
                Keep Shift
              </button>
              <button onClick={confirmCancel} disabled={cancelling}
                style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: cancelling ? '#9CA3AF' : '#DC2626', color: '#FFFFFF', fontWeight: 700, fontSize: '0.8125rem', cursor: cancelling ? 'default' : 'pointer' }}>
                {cancelling ? 'Cancelling…' : 'Cancel Shift'}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div style={{
          position: 'fixed', bottom: 28, left: '50%', transform: 'translateX(-50%)',
          background: '#0F172A', color: '#FFFFFF', borderRadius: 999, padding: '10px 18px',
          display: 'flex', alignItems: 'center', gap: 8,
          fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', zIndex: 9999,
          animation: 'fadeSlideUpToast 0.22s ease',
          boxShadow: '0 4px 20px rgba(0,0,0,0.25)',
        }}>
          <Check size={15} style={{ color: '#10B981', flexShrink: 0 }} />
          {toast}
        </div>
      )}
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
  gap: '10px',
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
