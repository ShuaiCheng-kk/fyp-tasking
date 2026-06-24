'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangle, CalendarOff, Check, Clock, Plus, RefreshCw, User } from 'lucide-react'
import CasualSidebar from '@/components/CasualSidebar'

type LeaveRequest = {
  id: string
  request_type: string
  reason: string | null
  status: string
  created_at: string
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const LEAVE_TYPES = [
  { value: 'time_off', label: 'Time Off' },
  { value: 'break_waiver', label: 'Break Waiver' },
]

const BG = '#F3F4F6'
const PANEL = '#FFFFFF'
const BORDER = '#E5E7EB'
const TEXT = '#111827'
const MUTED = '#6B7280'
const SLATE = '#334155'
const GREEN = '#16A34A'
const ORANGE = '#F97316'

function statusChip(status: string) {
  const map: Record<string, { bg: string; color: string; label: string }> = {
    pending: { bg: '#FFFBEB', color: '#B45309', label: 'Pending' },
    approved: { bg: '#ECFDF5', color: '#047857', label: 'Approved' },
    rejected: { bg: '#FEF2F2', color: '#B91C1C', label: 'Rejected' },
  }
  const value = map[status] ?? { bg: '#F1F5F9', color: MUTED, label: status }
  return <span style={{ ...chipStyle, background: value.bg, color: value.color }}>{value.label}</span>
}

export default function CasualAvailabilityPage() {
  const router = useRouter()
  const [authId, setAuthId] = useState('')
  const [userId, setUserId] = useState('')
  const [companyId, setCompanyId] = useState('')
  const [userName, setUserName] = useState('')
  const [loading, setLoading] = useState(true)
  const [fixedOffDays, setFixedOffDays] = useState<number[]>([])
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([])
  const [leaveType, setLeaveType] = useState<'time_off' | 'break_waiver'>('time_off')
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState('')
  const [message, setMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  const load = useCallback(async (uid: string) => {
    setLoading(true)
    setMessage(null)
    try {
      const [availabilityRes, meRes] = await Promise.all([
        fetch(`/api/casual/availability?user_id=${uid}`),
        fetch(`/api/user/me?user_id=${uid}`),
      ])
      const availabilityData = await availabilityRes.json()
      const meData = await meRes.json()
      if (!availabilityData.success) throw new Error(availabilityData.message || 'Failed to load availability')
      if (!meData.success) throw new Error(meData.message || 'Failed to load profile')

      const internalUserId = availabilityData.availability.user.id as string
      setUserId(internalUserId)
      setCompanyId(meData.user.company_id ?? '')
      setUserName(availabilityData.availability.user.full_name ?? 'Casual Worker')

      const [daysRes, leaveRes] = await Promise.all([
        fetch(`/api/user/fixed-off-days?user_id=${internalUserId}`),
        fetch(`/api/user/leave-requests?user_id=${internalUserId}`),
      ])
      const daysData = await daysRes.json()
      const leaveData = await leaveRes.json()
      if (daysData.success) setFixedOffDays((daysData.days ?? []).map((day: { weekday: number }) => day.weekday))
      if (leaveData.success) setLeaveRequests(leaveData.requests ?? [])
    } catch (err) {
      setMessage({ type: 'err', text: err instanceof Error ? err.message : 'Failed to load availability' })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const uid = localStorage.getItem('tasking_user_id')
    if (!uid) {
      router.replace('/signin')
      return
    }
    setAuthId(uid)
    void load(uid)
  }, [load, router])

  const toggleDay = (day: number) => {
    setFixedOffDays(prev => prev.includes(day) ? prev.filter(value => value !== day) : [...prev, day].sort())
    setMessage(null)
  }

  const saveFixedOffDays = async () => {
    if (!userId || !companyId) return
    setBusy('days')
    setMessage(null)
    try {
      const res = await fetch('/api/user/fixed-off-days', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, company_id: companyId, weekdays: fixedOffDays }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.message || 'Failed to save fixed off days')
      setMessage({ type: 'ok', text: 'Fixed off days saved.' })
    } catch (err) {
      setMessage({ type: 'err', text: err instanceof Error ? err.message : 'Failed to save fixed off days' })
    } finally {
      setBusy('')
    }
  }

  const submitLeave = async () => {
    if (!userId || !companyId) return
    setBusy('leave')
    setMessage(null)
    try {
      const res = await fetch('/api/user/leave-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userId,
          company_id: companyId,
          request_type: leaveType,
          reason: reason.trim() || null,
        }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.message || 'Failed to submit request')
      setLeaveRequests(prev => [data.request, ...prev])
      setReason('')
      setMessage({ type: 'ok', text: `${leaveType === 'time_off' ? 'Time-off' : 'Break waiver'} request submitted.` })
    } catch (err) {
      setMessage({ type: 'err', text: err instanceof Error ? err.message : 'Failed to submit request' })
    } finally {
      setBusy('')
    }
  }

  return (
    <div style={pageStyle}>
      <CasualSidebar />
      <main style={mainStyle}>
        <div style={headerStyle}>
          <div>
            <h1 style={titleStyle}>Availability</h1>
            <p style={subtitleStyle}>Set regular off days and submit leave requests for scheduling.</p>
          </div>
          {!loading && (
            <div style={userBadgeStyle}>
              <span style={userIconStyle}><User size={14} strokeWidth={2.2} /></span>
              <span>{userName}</span>
            </div>
          )}
        </div>

        {message && (
          <div style={{ ...alertStyle, background: message.type === 'ok' ? '#F0FDF4' : '#FEF2F2', color: message.type === 'ok' ? '#166534' : '#B91C1C', borderColor: message.type === 'ok' ? '#BBF7D0' : '#FECACA' }}>
            {message.type === 'ok' ? <Check size={15} /> : <AlertTriangle size={15} />}
            {message.text}
          </div>
        )}

        {loading ? (
          <section style={emptyBoxStyle}>Loading availability...</section>
        ) : (
          <div style={gridStyle}>
            <section style={cardStyle}>
              <div style={sectionHeaderStyle}>
                <span style={{ ...iconBoxStyle, background: '#DCFCE7', color: GREEN }}><CalendarOff size={17} /></span>
                <div>
                  <h2 style={sectionTitleStyle}>Fixed Off Days</h2>
                  <p style={sectionTextStyle}>AI scheduling will avoid these regular days.</p>
                </div>
              </div>

              <div style={weekdayGridStyle}>
                {WEEKDAYS.map((day, index) => {
                  const selected = fixedOffDays.includes(index)
                  return (
                    <button
                      key={day}
                      type="button"
                      onClick={() => toggleDay(index)}
                      style={{
                        ...weekdayButtonStyle,
                        borderColor: selected ? GREEN : BORDER,
                        background: selected ? '#DCFCE7' : PANEL,
                        color: selected ? '#166534' : SLATE,
                      }}
                    >
                      {day}
                    </button>
                  )
                })}
              </div>

              <button type="button" onClick={saveFixedOffDays} disabled={busy === 'days'} style={{ ...primaryButtonStyle, background: GREEN }}>
                {busy === 'days' ? <RefreshCw size={14} /> : <Check size={14} />}
                {busy === 'days' ? 'Saving...' : 'Save Fixed Off Days'}
              </button>
            </section>

            <section style={cardStyle}>
              <div style={sectionHeaderStyle}>
                <span style={{ ...iconBoxStyle, background: '#FFF7ED', color: ORANGE }}><Clock size={17} /></span>
                <div>
                  <h2 style={sectionTitleStyle}>Leave Requests</h2>
                  <p style={sectionTextStyle}>Submit time off or break waiver requests.</p>
                </div>
              </div>

              <div style={formRowStyle}>
                <select value={leaveType} onChange={event => setLeaveType(event.target.value as 'time_off' | 'break_waiver')} style={inputStyle}>
                  {LEAVE_TYPES.map(type => <option key={type.value} value={type.value}>{type.label}</option>)}
                </select>
                <input value={reason} onChange={event => setReason(event.target.value)} placeholder="Reason" style={{ ...inputStyle, flex: 1 }} />
              </div>

              <button type="button" onClick={submitLeave} disabled={busy === 'leave'} style={{ ...primaryButtonStyle, background: ORANGE }}>
                {busy === 'leave' ? <RefreshCw size={14} /> : <Plus size={14} />}
                {busy === 'leave' ? 'Submitting...' : 'Submit Request'}
              </button>

              <div style={historyStyle}>
                <h3 style={historyTitleStyle}>History</h3>
                {leaveRequests.length === 0 ? (
                  <p style={emptyTextStyle}>No requests submitted yet.</p>
                ) : (
                  leaveRequests.map(request => (
                    <div key={request.id} style={historyItemStyle}>
                      <div style={{ minWidth: 0 }}>
                        <p style={historyItemTitleStyle}>{LEAVE_TYPES.find(type => type.value === request.request_type)?.label ?? request.request_type}</p>
                        {request.reason && <p style={historyReasonStyle}>{request.reason}</p>}
                        <p style={historyDateStyle}>{new Date(request.created_at).toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
                      </div>
                      {statusChip(request.status)}
                    </div>
                  ))
                )}
              </div>
            </section>
          </div>
        )}
      </main>
    </div>
  )
}

const pageStyle: React.CSSProperties = { display: 'flex', minHeight: '100vh', background: BG, fontFamily: 'var(--font-body), system-ui, sans-serif' }
const mainStyle: React.CSSProperties = { marginLeft: 64, flex: 1, minHeight: '100vh', padding: '24px 32px', minWidth: 0 }
const headerStyle: React.CSSProperties = { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 18, paddingBottom: 20, borderBottom: `1px solid ${BORDER}`, marginBottom: 18 }
const titleStyle: React.CSSProperties = { margin: 0, fontSize: '1.75rem', fontWeight: 800, color: TEXT }
const subtitleStyle: React.CSSProperties = { margin: '5px 0 0', color: MUTED, fontSize: 14 }
const userBadgeStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 8, padding: '5px 12px 5px 7px', borderRadius: 999, background: PANEL, border: `1px solid ${BORDER}`, color: TEXT, fontSize: 13, fontWeight: 800, flexShrink: 0 }
const userIconStyle: React.CSSProperties = { width: 22, height: 22, borderRadius: 999, background: SLATE, color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center' }
const alertStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', border: '1px solid', borderRadius: 8, fontSize: 13, fontWeight: 700, marginBottom: 14 }
const emptyBoxStyle: React.CSSProperties = { background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 10, padding: 28, color: MUTED, fontSize: 14, textAlign: 'center' }
const gridStyle: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16, alignItems: 'start' }
const cardStyle: React.CSSProperties = { background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 10, padding: 18, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 16 }
const sectionHeaderStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 11 }
const iconBoxStyle: React.CSSProperties = { width: 36, height: 36, borderRadius: 9, display: 'grid', placeItems: 'center', flexShrink: 0 }
const sectionTitleStyle: React.CSSProperties = { margin: 0, color: TEXT, fontSize: 15, fontWeight: 850 }
const sectionTextStyle: React.CSSProperties = { margin: '2px 0 0', color: MUTED, fontSize: 12.5 }
const weekdayGridStyle: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(7, minmax(42px, 1fr))', gap: 8 }
const weekdayButtonStyle: React.CSSProperties = { height: 40, border: '1.5px solid', borderRadius: 8, fontWeight: 850, cursor: 'pointer' }
const primaryButtonStyle: React.CSSProperties = { height: 38, border: 'none', borderRadius: 8, color: '#FFFFFF', fontWeight: 850, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7, cursor: 'pointer' }
const formRowStyle: React.CSSProperties = { display: 'flex', gap: 8, flexWrap: 'wrap' }
const inputStyle: React.CSSProperties = { height: 38, border: `1px solid ${BORDER}`, borderRadius: 8, background: PANEL, color: TEXT, padding: '0 10px', fontSize: 13, minWidth: 150, outline: 'none' }
const historyStyle: React.CSSProperties = { borderTop: '1px solid #EEF2F7', paddingTop: 14, display: 'flex', flexDirection: 'column', gap: 8 }
const historyTitleStyle: React.CSSProperties = { margin: 0, color: MUTED, fontSize: 12, fontWeight: 850, textTransform: 'uppercase' }
const emptyTextStyle: React.CSSProperties = { margin: 0, color: MUTED, fontSize: 13 }
const historyItemStyle: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, background: '#F8FAFC', borderRadius: 8, padding: 10 }
const historyItemTitleStyle: React.CSSProperties = { margin: 0, color: TEXT, fontSize: 13, fontWeight: 850 }
const historyReasonStyle: React.CSSProperties = { margin: '2px 0 0', color: MUTED, fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }
const historyDateStyle: React.CSSProperties = { margin: '2px 0 0', color: MUTED, fontSize: 11 }
const chipStyle: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', height: 22, padding: '0 9px', borderRadius: 999, fontSize: 11, fontWeight: 800, flexShrink: 0 }
