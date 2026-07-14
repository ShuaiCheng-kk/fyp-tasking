'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Building2, CalendarDays, Check, Clock, Mail, MapPin, Phone, UserCheck, XCircle } from 'lucide-react'
import CasualTaskBoard from '@/components/casual/CasualTaskBoard'
import CasualMessagePanel from '@/components/casual/CasualMessagePanel'

type CurrentJob = {
  assignment_id: string
  shift_id: string
  company_id: string
  department_id: string
  title: string
  shift_date: string
  start_time: string
  end_time: string
  is_open_ended: boolean
  company_name: string | null
  location: string | null
  supervisor: { id: string; full_name: string; phone_number: string | null; email_address: string } | null
  clock_in_time: string | null
  clock_out_time: string | null
  clock_out_released_at: string | null
}

const pageKeyframes = `
  @keyframes blockSlideUp { from { opacity: 0; transform: translateY(20px) } to { opacity: 1; transform: translateY(0) } }
  @keyframes fadeSlideUpToast { from { opacity: 0; transform: translateX(-50%) translateY(10px) } to { opacity: 1; transform: translateX(-50%) translateY(0) } }
  @keyframes overlayFadeIn { from { opacity: 0 } to { opacity: 1 } }
`

// UC49: the Clock In button appears starting 30 minutes before the shift's scheduled start and
// stays up after that too — a late worker can still clock in, the real time is what's recorded.
const CLOCK_IN_WINDOW_MINUTES_BEFORE = 30

function canClockIn(job: CurrentJob): boolean {
  const shiftStart = new Date(`${job.shift_date}T${job.start_time}Z`)
  const earliestClockIn = new Date(shiftStart.getTime() - CLOCK_IN_WINDOW_MINUTES_BEFORE * 60000)
  return Date.now() >= earliestClockIn.getTime()
}

function canClockOut(job: CurrentJob): boolean {
  if (job.is_open_ended) return !!job.clock_out_released_at
  const shiftEnd = new Date(`${job.shift_date}T${job.end_time}Z`)
  return Date.now() >= shiftEnd.getTime()
}

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

  const [authId, setAuthId] = useState('')
  const [internalUserId, setInternalUserId] = useState('')
  const [job, setJob] = useState<CurrentJob | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [cancelReason, setCancelReason] = useState('')
  const [showCancelConfirm, setShowCancelConfirm] = useState(false)
  const [cancelError, setCancelError] = useState('')
  const [toast, setToast] = useState('')
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const showToast = (msg: string) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    setToast(msg)
    toastTimerRef.current = setTimeout(() => setToast(''), 3000)
  }

  const load = async (uid: string) => {
    const res = await fetch(`/api/casual/dashboard?user_id=${uid}`)
    const data = await res.json()
    if (!data.success) {
      router.replace('/signin')
      return
    }
    setInternalUserId(data.dashboard.user.id)
    setJob(data.dashboard.current_job ?? null)
    setLoading(false)
  }

  useEffect(() => {
    const uid = localStorage.getItem('tasking_user_id')
    if (!uid) {
      router.replace('/signin')
      return
    }
    setAuthId(uid)
    void load(uid)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router])

  const runClockAction = async (action: 'clock_in' | 'clock_out') => {
    if (!job) return
    setBusy(true)
    try {
      const res = await fetch('/api/casual/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, user_id: authId, shift_assignment_id: job.assignment_id }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.message || 'Attendance action failed')
      showToast(action === 'clock_in' ? 'Clocked in.' : 'Clocked out — see you next time.')
      await load(authId)
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Attendance action failed')
    } finally {
      setBusy(false)
    }
  }

  const confirmCancel = async () => {
    if (!job) return
    setCancelling(true); setCancelError('')
    try {
      const res = await fetch('/api/casual/shift-cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: authId, shift_id: job.shift_id, reason: cancelReason.trim() || null }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.message || 'Failed to cancel shift')
      setShowCancelConfirm(false); setCancelReason('')
      showToast('Shift cancelled — the employer has been notified.')
      await load(authId)
    } catch (err) {
      setCancelError(err instanceof Error ? err.message : 'Failed to cancel shift')
    } finally {
      setCancelling(false)
    }
  }

  const clockedIn = !!job?.clock_in_time
  const clockedOut = !!job?.clock_out_time

  return (
    <>
      <style>{pageKeyframes}</style>

      <main style={pageStyle}>
        <div style={{ marginBottom: 20 }}>
          <h1 className="mb-0 font-heading text-3xl font-bold tracking-tight text-gray-950">
            Dashboard
          </h1>
        </div>

        {loading ? null : !job ? (
          <p style={{ margin: 0, color: '#6B7280', fontSize: '0.95rem' }}>No active job right now.</p>
        ) : (
          <div style={{ maxWidth: 720, display: 'flex', flexDirection: 'column', gap: 16, animation: 'blockSlideUp 0.38s ease both 0.06s' }}>
            {/* Current job card */}
            <div style={cardStyle}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, marginBottom: 12 }}>
                <div>
                  <p style={{ margin: 0, fontWeight: 700, fontSize: '1.0625rem', color: '#111827' }}>{job.title}</p>
                  {job.company_name && (
                    <p style={{ margin: '3px 0 0', fontSize: '0.8125rem', color: '#6B7280', display: 'flex', alignItems: 'center', gap: 5 }}>
                      <Building2 size={13} /> {job.company_name}
                    </p>
                  )}
                </div>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: '0.75rem', fontWeight: 700, color: '#EA580C', background: '#FFF7ED', border: '1px solid #FED7AA', borderRadius: 999, padding: '4px 11px', whiteSpace: 'nowrap' }}>
                  <CalendarDays size={12} /> {formatShiftDate(job.shift_date)}
                </span>
              </div>

              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: '0.8425rem', color: '#374151' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                  <Clock size={13} color="#F97316" />
                  {formatTime(job.start_time)}{job.is_open_ended ? ' — until done' : ` – ${formatTime(job.end_time)}`}
                </span>
                {job.location && (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                    <MapPin size={13} color="#F97316" /> {job.location}
                  </span>
                )}
              </div>

              {job.supervisor && (
                <div style={{ marginTop: 12, padding: '10px 14px', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 10 }}>
                  <p style={{ margin: '0 0 6px', fontSize: '0.72rem', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Report To
                  </p>
                  <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: '0.8425rem', color: '#111827' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontWeight: 700 }}>
                      <UserCheck size={13} color="#0EA5E9" /> {job.supervisor.full_name}
                    </span>
                    {job.supervisor.phone_number && (
                      <a href={`tel:${job.supervisor.phone_number}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: '#111827', textDecoration: 'none' }}>
                        <Phone size={13} color="#0EA5E9" /> {job.supervisor.phone_number}
                      </a>
                    )}
                    <a href={`mailto:${job.supervisor.email_address}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: '#111827', textDecoration: 'none' }}>
                      <Mail size={13} color="#0EA5E9" /> {job.supervisor.email_address}
                    </a>
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginTop: 14 }}>
                <div>
                  {!clockedIn && canClockIn(job) && (
                    <button type="button" onClick={() => runClockAction('clock_in')} disabled={busy}
                      style={{ ...actionButtonStyle, background: '#16A34A' }}>
                      {busy ? 'Working…' : 'Clock In'}
                    </button>
                  )}
                  {!clockedIn && !canClockIn(job) && (
                    <span style={{ fontSize: '0.8rem', color: '#9CA3AF', fontStyle: 'italic' }}>
                      Clock In opens 30 minutes before the job starts
                    </span>
                  )}
                  {clockedIn && !clockedOut && canClockOut(job) && (
                    <button type="button" onClick={() => runClockAction('clock_out')} disabled={busy}
                      style={{ ...actionButtonStyle, background: '#334155' }}>
                      {busy ? 'Working…' : 'Clock Out'}
                    </button>
                  )}
                  {clockedIn && !clockedOut && !canClockOut(job) && (
                    <span style={{ fontSize: '0.8rem', color: '#9CA3AF', fontStyle: 'italic' }}>
                      {job.is_open_ended
                        ? 'Waiting for your supervisor to review your work'
                        : 'Clock Out opens once the job ends'}
                    </span>
                  )}
                </div>

                {!clockedIn && (
                  <button
                    type="button"
                    onClick={() => { setShowCancelConfirm(true); setCancelReason(''); setCancelError('') }}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 5, height: 30, padding: '0 12px', borderRadius: 8, border: '1px solid #FECACA', background: '#FEF2F2', color: '#DC2626', fontWeight: 700, fontSize: '0.78rem', cursor: 'pointer' }}
                  >
                    <XCircle size={13} /> Cancel Shift
                  </button>
                )}
              </div>
            </div>

            <CasualTaskBoard companyId={job.company_id} shiftId={job.shift_id} userId={internalUserId} />

            {job.supervisor && (
              <CasualMessagePanel
                authId={authId}
                companyId={job.company_id}
                supervisorId={job.supervisor.id}
                supervisorName={job.supervisor.full_name}
              />
            )}
          </div>
        )}
      </main>

      {showCancelConfirm && job && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, zIndex: 9999, animation: 'overlayFadeIn 0.18s ease-out' }}>
          <div style={{ width: '100%', maxWidth: 440, background: '#FFFFFF', borderRadius: 16, padding: 26, boxShadow: '0 24px 64px rgba(0,0,0,0.16)' }}>
            <h3 style={{ margin: '0 0 6px', fontSize: '1.05rem', fontWeight: 700, color: '#111827' }}>
              Cancel this shift?
            </h3>
            <p style={{ margin: '0 0 14px', fontSize: '0.875rem', color: '#6B7280', lineHeight: 1.5 }}>
              {job.title} — {formatShiftDate(job.shift_date)}. The employer will be notified and your spot goes back up for hire.
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
              <button onClick={() => setShowCancelConfirm(false)} disabled={cancelling}
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
    </>
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
  padding: '20px 24px',
  boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
}

const actionButtonStyle: React.CSSProperties = {
  border: 'none',
  borderRadius: 8,
  color: '#FFFFFF',
  fontWeight: 700,
  fontSize: '0.85rem',
  padding: '9px 20px',
  cursor: 'pointer',
}
