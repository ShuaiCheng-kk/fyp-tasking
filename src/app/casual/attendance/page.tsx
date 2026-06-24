'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangle, CalendarDays, Check, Clock, RefreshCw, Repeat2, User } from 'lucide-react'
import CasualSidebar from '@/components/CasualSidebar'

type AttendanceRecord = {
  id: string
  clock_in_time: string | null
  clock_out_time: string | null
  status: string
  owner_status: string
}

type AttendanceShift = {
  assignment: { id: string; user_id: string }
  shift: {
    id: string
    company_id: string
    department_id: string | null
    title: string | null
    shift_date: string
    start_time: string
    end_time: string
  }
  record: AttendanceRecord | null
}

type TeamMember = {
  id: string
  full_name: string
  role: string
}

const BG = '#F3F4F6'
const PANEL = '#FFFFFF'
const BORDER = '#E5E7EB'
const TEXT = '#111827'
const MUTED = '#6B7280'
const SLATE = '#334155'
const GREEN = '#16A34A'
const ORANGE = '#F97316'

function fmtDate(date: string) {
  return new Date(`${date}T00:00:00`).toLocaleDateString('en-AU', { weekday: 'short', day: '2-digit', month: 'short' })
}

function fmtTime(value: string | null | undefined) {
  if (!value) return '-'
  if (value.includes('T')) return new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  return value.slice(0, 5)
}

function statusLabel(shift: AttendanceShift) {
  if (!shift.record) return { label: 'Not started', bg: '#F1F5F9', color: SLATE }
  if (shift.record.clock_out_time) return { label: 'Submitted', bg: '#ECFDF5', color: '#047857' }
  if (shift.record.clock_in_time) return { label: 'Clocked in', bg: '#FFFBEB', color: '#B45309' }
  return { label: shift.record.status, bg: '#F1F5F9', color: SLATE }
}

export default function CasualAttendancePage() {
  const router = useRouter()
  const [authId, setAuthId] = useState('')
  const [userId, setUserId] = useState('')
  const [companyId, setCompanyId] = useState('')
  const [userName, setUserName] = useState('')
  const [shifts, setShifts] = useState<AttendanceShift[]>([])
  const [members, setMembers] = useState<TeamMember[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState('')
  const [message, setMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  const [requestType, setRequestType] = useState<Record<string, 'time_off' | 'break_waiver'>>({})
  const [requestReason, setRequestReason] = useState<Record<string, string>>({})
  const [replacementByShift, setReplacementByShift] = useState<Record<string, string>>({})

  const replacementOptions = useMemo(
    () => members.filter(member => member.id !== userId && member.role === 'Casual Worker'),
    [members, userId],
  )

  const load = useCallback(async (uid: string) => {
    setLoading(true)
    setMessage(null)
    try {
      const [attendanceRes, meRes] = await Promise.all([
        fetch(`/api/casual/attendance?user_id=${uid}`),
        fetch(`/api/user/me?user_id=${uid}`),
      ])
      const attendanceData = await attendanceRes.json()
      const meData = await meRes.json()
      if (!attendanceData.success) throw new Error(attendanceData.message || 'Failed to load attendance')
      if (!meData.success) throw new Error(meData.message || 'Failed to load profile')

      const internalUserId = attendanceData.attendance.user.id as string
      const cid = meData.user.company_id as string
      setUserId(internalUserId)
      setCompanyId(cid)
      setUserName(attendanceData.attendance.user.full_name ?? 'Casual Worker')
      setShifts(attendanceData.attendance.shifts ?? [])

      if (cid) {
        const membersRes = await fetch(`/api/team/members?company_id=${cid}`)
        const membersData = await membersRes.json()
        if (membersData.success) setMembers(membersData.members ?? [])
      }
    } catch (err) {
      setMessage({ type: 'err', text: err instanceof Error ? err.message : 'Failed to load attendance' })
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

  const runAction = async (shift: AttendanceShift, action: 'clock_in' | 'clock_out') => {
    setBusyId(`${shift.assignment.id}:${action}`)
    setMessage(null)
    try {
      const res = await fetch('/api/casual/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          user_id: authId,
          shift_assignment_id: shift.assignment.id,
        }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.message || 'Attendance action failed')
      await load(authId)
      setMessage({ type: 'ok', text: action === 'clock_in' ? 'Clocked in successfully.' : 'Timesheet submitted.' })
    } catch (err) {
      setMessage({ type: 'err', text: err instanceof Error ? err.message : 'Attendance action failed' })
    } finally {
      setBusyId('')
    }
  }

  const submitLeave = async (shift: AttendanceShift) => {
    if (!companyId) return
    setBusyId(`${shift.assignment.id}:leave`)
    setMessage(null)
    const type = requestType[shift.assignment.id] ?? 'time_off'
    try {
      const res = await fetch('/api/user/leave-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userId,
          company_id: companyId,
          shift_assignment_id: shift.assignment.id,
          request_type: type,
          reason: requestReason[shift.assignment.id]?.trim() || null,
        }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.message || 'Failed to submit request')
      setRequestReason(prev => ({ ...prev, [shift.assignment.id]: '' }))
      setMessage({ type: 'ok', text: type === 'time_off' ? 'Time-off request submitted.' : 'Break waiver request submitted.' })
    } catch (err) {
      setMessage({ type: 'err', text: err instanceof Error ? err.message : 'Failed to submit request' })
    } finally {
      setBusyId('')
    }
  }

  const submitSwap = async (shift: AttendanceShift) => {
    if (!companyId) return
    const replacementId = replacementByShift[shift.assignment.id]
    if (!replacementId) {
      setMessage({ type: 'err', text: 'Choose a replacement worker first.' })
      return
    }
    setBusyId(`${shift.assignment.id}:swap`)
    setMessage(null)
    try {
      const res = await fetch('/api/user/shift-swap-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company_id: companyId,
          shift_assignment_id: shift.assignment.id,
          requester_id: userId,
          replacement_user_id: replacementId,
          reason: requestReason[`${shift.assignment.id}:swap`]?.trim() || null,
        }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.message || 'Failed to submit shift swap')
      setReplacementByShift(prev => ({ ...prev, [shift.assignment.id]: '' }))
      setRequestReason(prev => ({ ...prev, [`${shift.assignment.id}:swap`]: '' }))
      setMessage({ type: 'ok', text: 'Shift swap request submitted.' })
    } catch (err) {
      setMessage({ type: 'err', text: err instanceof Error ? err.message : 'Failed to submit shift swap' })
    } finally {
      setBusyId('')
    }
  }

  return (
    <div style={pageStyle}>
      <CasualSidebar />
      <main style={mainStyle}>
        <div style={headerStyle}>
          <div>
            <h1 style={titleStyle}>Attendance</h1>
            <p style={subtitleStyle}>Clock in, submit timesheets, and request shift changes.</p>
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

        <div style={toolbarStyle}>
          <span style={countStyle}>{loading ? 'Loading shifts...' : `${shifts.length} upcoming shift${shifts.length === 1 ? '' : 's'}`}</span>
          <button type="button" onClick={() => load(authId)} disabled={loading || !authId} style={ghostButtonStyle}>
            <RefreshCw size={14} /> Refresh
          </button>
        </div>

        {loading ? (
          <section style={emptyBoxStyle}>Loading attendance...</section>
        ) : shifts.length === 0 ? (
          <section style={emptyBoxStyle}>No upcoming shifts are assigned to you yet.</section>
        ) : (
          <div style={gridStyle}>
            {shifts.map(shift => {
              const badge = statusLabel(shift)
              const clockedIn = !!shift.record?.clock_in_time
              const clockedOut = !!shift.record?.clock_out_time
              return (
                <section key={shift.assignment.id} style={cardStyle}>
                  <div style={cardHeaderStyle}>
                    <div>
                      <h2 style={cardTitleStyle}>{shift.shift.title || 'Assigned shift'}</h2>
                      <div style={metaStyle}>
                        <span><CalendarDays size={13} /> {fmtDate(shift.shift.shift_date)}</span>
                        <span><Clock size={13} /> {fmtTime(shift.shift.start_time)} - {fmtTime(shift.shift.end_time)}</span>
                      </div>
                    </div>
                    <span style={{ ...chipStyle, background: badge.bg, color: badge.color }}>{badge.label}</span>
                  </div>

                  <div style={timeGridStyle}>
                    <div style={timeBoxStyle}>
                      <span style={timeLabelStyle}>Clock In</span>
                      <strong style={timeValueStyle}>{fmtTime(shift.record?.clock_in_time)}</strong>
                    </div>
                    <div style={timeBoxStyle}>
                      <span style={timeLabelStyle}>Clock Out</span>
                      <strong style={timeValueStyle}>{fmtTime(shift.record?.clock_out_time)}</strong>
                    </div>
                  </div>

                  <div style={actionRowStyle}>
                    <button
                      type="button"
                      onClick={() => runAction(shift, 'clock_in')}
                      disabled={clockedIn || !!busyId}
                      style={{ ...primaryButtonStyle, background: clockedIn ? '#CBD5E1' : GREEN, cursor: clockedIn || busyId ? 'not-allowed' : 'pointer' }}
                    >
                      {busyId === `${shift.assignment.id}:clock_in` ? 'Working...' : 'Clock In'}
                    </button>
                    <button
                      type="button"
                      onClick={() => runAction(shift, 'clock_out')}
                      disabled={!clockedIn || clockedOut || !!busyId}
                      style={{ ...primaryButtonStyle, background: !clockedIn || clockedOut ? '#CBD5E1' : SLATE, cursor: !clockedIn || clockedOut || busyId ? 'not-allowed' : 'pointer' }}
                    >
                      {busyId === `${shift.assignment.id}:clock_out` ? 'Working...' : 'Clock Out'}
                    </button>
                  </div>

                  <div style={dividerStyle} />

                  <div style={formRowStyle}>
                    <select
                      value={requestType[shift.assignment.id] ?? 'time_off'}
                      onChange={e => setRequestType(prev => ({ ...prev, [shift.assignment.id]: e.target.value as 'time_off' | 'break_waiver' }))}
                      style={inputStyle}
                    >
                      <option value="time_off">Time Off</option>
                      <option value="break_waiver">Break Waiver</option>
                    </select>
                    <input
                      value={requestReason[shift.assignment.id] ?? ''}
                      onChange={e => setRequestReason(prev => ({ ...prev, [shift.assignment.id]: e.target.value }))}
                      placeholder="Request reason"
                      style={{ ...inputStyle, flex: 1 }}
                    />
                    <button type="button" onClick={() => submitLeave(shift)} disabled={!!busyId} style={secondaryButtonStyle}>
                      Submit
                    </button>
                  </div>

                  <div style={swapBoxStyle}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: TEXT, fontWeight: 800, fontSize: 13 }}>
                      <Repeat2 size={14} /> Shift Swap
                    </div>
                    <div style={formRowStyle}>
                      <select
                        value={replacementByShift[shift.assignment.id] ?? ''}
                        onChange={e => setReplacementByShift(prev => ({ ...prev, [shift.assignment.id]: e.target.value }))}
                        style={{ ...inputStyle, minWidth: 190 }}
                      >
                        <option value="">Choose replacement</option>
                        {replacementOptions.map(member => (
                          <option key={member.id} value={member.id}>{member.full_name}</option>
                        ))}
                      </select>
                      <input
                        value={requestReason[`${shift.assignment.id}:swap`] ?? ''}
                        onChange={e => setRequestReason(prev => ({ ...prev, [`${shift.assignment.id}:swap`]: e.target.value }))}
                        placeholder="Swap reason"
                        style={{ ...inputStyle, flex: 1 }}
                      />
                      <button type="button" onClick={() => submitSwap(shift)} disabled={!!busyId} style={secondaryButtonStyle}>
                        Request
                      </button>
                    </div>
                  </div>
                </section>
              )
            })}
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
const toolbarStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 14 }
const countStyle: React.CSSProperties = { color: MUTED, fontSize: 13, fontWeight: 800 }
const ghostButtonStyle: React.CSSProperties = { height: 34, border: `1px solid ${BORDER}`, borderRadius: 8, background: PANEL, color: SLATE, display: 'inline-flex', alignItems: 'center', gap: 6, padding: '0 12px', fontWeight: 800, cursor: 'pointer' }
const emptyBoxStyle: React.CSSProperties = { background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 10, padding: 28, color: MUTED, fontSize: 14, textAlign: 'center' }
const gridStyle: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }
const cardStyle: React.CSSProperties = { background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 10, padding: 16, minWidth: 0 }
const cardHeaderStyle: React.CSSProperties = { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }
const cardTitleStyle: React.CSSProperties = { margin: 0, color: TEXT, fontSize: 16, fontWeight: 850 }
const metaStyle: React.CSSProperties = { display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 8, color: MUTED, fontSize: 12, fontWeight: 700 }
const chipStyle: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', height: 24, padding: '0 10px', borderRadius: 999, fontSize: 11, fontWeight: 850, flexShrink: 0 }
const timeGridStyle: React.CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 16 }
const timeBoxStyle: React.CSSProperties = { background: '#F8FAFC', border: '1px solid #EEF2F7', borderRadius: 8, padding: 12 }
const timeLabelStyle: React.CSSProperties = { display: 'block', color: MUTED, fontSize: 11, fontWeight: 850, textTransform: 'uppercase' }
const timeValueStyle: React.CSSProperties = { display: 'block', marginTop: 5, color: TEXT, fontSize: 16 }
const actionRowStyle: React.CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 14 }
const primaryButtonStyle: React.CSSProperties = { height: 38, border: 'none', borderRadius: 8, color: '#FFFFFF', fontWeight: 850 }
const secondaryButtonStyle: React.CSSProperties = { height: 36, border: 'none', borderRadius: 8, background: ORANGE, color: '#FFFFFF', padding: '0 14px', fontWeight: 850, cursor: 'pointer', flexShrink: 0 }
const dividerStyle: React.CSSProperties = { height: 1, background: '#EEF2F7', margin: '16px 0' }
const formRowStyle: React.CSSProperties = { display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }
const inputStyle: React.CSSProperties = { height: 36, border: `1px solid ${BORDER}`, borderRadius: 8, background: '#FFFFFF', color: TEXT, padding: '0 10px', fontSize: 13, minWidth: 140, outline: 'none' }
const swapBoxStyle: React.CSSProperties = { marginTop: 12, background: '#F8FAFC', border: '1px solid #EEF2F7', borderRadius: 8, padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }
