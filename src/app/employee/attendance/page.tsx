'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  CalendarDays, Clock, UserRound, CheckCircle2, XCircle, AlertCircle,
  RefreshCw, Coffee, Paperclip, ArrowLeftRight, Calendar, ShieldCheck,
} from 'lucide-react'
import EmployeeSidebar from '@/components/EmployeeSidebar'
import { FixedOffDayRequestView, ShiftSwapRequestView, TimeOffRequestView } from '@/types/Attendance'
import { TimelineRow } from '@/types/Timeline'

const GREEN      = '#16A34A'
const BORDER     = '#E2E8F0'
const TEXT       = '#0F172A'
const MUTED      = '#64748B'
const PANEL      = '#FFFFFF'

function getUpcomingWeekDates(): string[] {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const day = today.getDay()
  const daysUntilNextMonday = ((8 - day) % 7) || 7
  const monday = new Date(today)
  monday.setDate(today.getDate() + daysUntilNextMonday)
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(monday)
    date.setDate(monday.getDate() + index)
    return date.toISOString().slice(0, 10)
  })
}

type AttendanceRecord = {
  id: string
  shift_id: string
  shift_title: string
  shift_date: string
  start_time: string
  end_time: string
  clock_in_time: string | null
  clock_out_time: string | null
  status: string
  employee_notes: string | null
  manager_notes: string | null
  department_name: string | null
}

type MyShiftRecord = { id: string; clock_in_time: string | null; clock_out_time: string | null; break_in_time: string | null; break_out_time: string | null; status: string }
type MyShift = {
  assignment: { id: string; user_id: string }
  shift: { id: string; title: string | null; shift_date: string; start_time: string; end_time: string; is_open_ended: boolean }
  record: MyShiftRecord | null
}

const CLOCK_IN_WINDOW_MINUTES_BEFORE = 30

function canClockIn(shift: MyShift['shift']): boolean {
  const shiftStart = new Date(`${shift.shift_date}T${shift.start_time}Z`)
  const earliestClockIn = new Date(shiftStart.getTime() - CLOCK_IN_WINDOW_MINUTES_BEFORE * 60000)
  return Date.now() >= earliestClockIn.getTime()
}

function canClockOut(shift: MyShift['shift']): boolean {
  if (shift.is_open_ended) return true
  const shiftEnd = new Date(`${shift.shift_date}T${shift.end_time}Z`)
  return Date.now() >= shiftEnd.getTime()
}

function formatTime(value: string | null | undefined): string {
  if (!value) return '—'
  if (value.includes('T')) return new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  return value.slice(0, 5)
}

function formatDate(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00`)
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

function statusBadge(status: string): { bg: string; text: string; label: string } {
  switch (status) {
    case 'approved': return { bg: '#ECFDF5', text: '#047857', label: 'Approved' }
    case 'rejected': return { bg: '#FEF2F2', text: '#B91C1C', label: 'Rejected' }
    case 'pending':  return { bg: '#FFFBEB', text: '#B45309', label: 'Pending' }
    case 'absent':   return { bg: '#FEF2F2', text: '#B91C1C', label: 'Absent' }
    default:         return { bg: '#F3F4F6', text: '#4B5563', label: status }
  }
}

function StatusIcon({ status }: { status: string }) {
  if (status === 'approved') return <CheckCircle2 size={14} color="#047857" />
  if (status === 'rejected' || status === 'absent') return <XCircle size={14} color="#B91C1C" />
  return <AlertCircle size={14} color="#B45309" />
}

function Spinner({ dark = false }: { dark?: boolean }) {
  return (
    <svg className="animate-spin" width="15" height="15" viewBox="0 0 18 18" style={{ display: 'inline-block', flexShrink: 0 }}>
      <circle cx="9" cy="9" r="7" stroke={dark ? 'rgba(17,24,39,0.2)' : 'rgba(255,255,255,0.35)'} strokeWidth="2.5" fill="none" />
      <path d="M9 2a7 7 0 0 1 7 7" stroke={dark ? '#111827' : 'white'} strokeWidth="2.5" strokeLinecap="round" fill="none" />
    </svg>
  )
}

function statusChip(status: string) {
  const b = statusBadge(status)
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', height: 22, padding: '0 8px', borderRadius: 999, fontSize: 11, fontWeight: 700, background: b.bg, color: b.text }}>
      {b.label}
    </span>
  )
}

type TabKey = 'records' | 'my_requests'

export default function EmployeeAttendancePage() {
  const router = useRouter()
  const [userName,       setUserName]       = useState('')
  const [companyId,      setCompanyId]      = useState('')
  const [userId,         setUserId]         = useState('')
  const [records,        setRecords]        = useState<AttendanceRecord[]>([])
  const [loading,        setLoading]        = useState(true)
  const [refreshing,     setRefreshing]     = useState(false)
  const [activeTab,      setActiveTab]      = useState<TabKey>('records')

  const [myShifts,       setMyShifts]       = useState<MyShift[]>([])
  const [clockBusyId,    setClockBusyId]    = useState('')
  const [clockMessage,   setClockMessage]   = useState('')

  const [lateFormId,         setLateFormId]         = useState<string | null>(null)
  const [lateReason,         setLateReason]         = useState('')
  const [absenceFormId,      setAbsenceFormId]      = useState<string | null>(null)
  const [absenceReason,      setAbsenceReason]      = useState('')
  const [attachmentFile,     setAttachmentFile]     = useState<File | null>(null)
  const [attachmentUploading, setAttachmentUploading] = useState(false)

  // My Requests state
  const [mySwaps,        setMySwaps]        = useState<ShiftSwapRequestView[]>([])
  const [myTimeOff,      setMyTimeOff]      = useState<TimeOffRequestView[]>([])
  const [myFixedOff,     setMyFixedOff]     = useState<FixedOffDayRequestView[]>([])
  const [myReqLoading,   setMyReqLoading]   = useState(false)
  const [myReqError,     setMyReqError]     = useState('')
  const [myReqSuccess,   setMyReqSuccess]   = useState('')
  const [userDeptId,     setUserDeptId]     = useState('')
  const [swapCandidateRows, setSwapCandidateRows] = useState<TimelineRow[]>([])

  // Submit form state
  const [swapFormOpen,      setSwapFormOpen]      = useState(false)
  const [swapShiftId,       setSwapShiftId]       = useState('')
  const [swapCounterpartId,           setSwapCounterpartId]           = useState('')
  const [swapCounterpartAssignmentId, setSwapCounterpartAssignmentId] = useState('')
  const [swapReason,        setSwapReason]        = useState('')
  const [swapSubmitting,    setSwapSubmitting]    = useState(false)

  const [leaveFormOpen,  setLeaveFormOpen]  = useState(false)
  const [leaveType,      setLeaveType]      = useState<'leave' | 'time_off'>('leave')
  const [leaveShiftId,   setLeaveShiftId]   = useState('')
  const [leaveReason,    setLeaveReason]    = useState('')
  const [leaveSubmitting, setLeaveSubmitting] = useState(false)

  const [fixedFormOpen,    setFixedFormOpen]    = useState(false)
  const [selectedFixedOffDates, setSelectedFixedOffDates] = useState<string[]>([])
  const [fixedOffQuota,    setFixedOffQuota]    = useState(1)
  const [fixedSubmitting,  setFixedSubmitting]  = useState(false)

  // ── summary stats ──────────────────────────────────────────────────────────
  const totalShifts = records.length
  const approved    = records.filter(r => r.status === 'approved').length
  const pending     = records.filter(r => r.status === 'pending').length
  const rejected    = records.filter(r => r.status === 'rejected' || r.status === 'absent').length

  const fetchRecords = useCallback(async (uid: string, isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    try {
      const res  = await fetch(`/api/employee/attendance?user_id=${uid}`)
      const data = await res.json()
      if (data.success) setRecords(data.records ?? [])
    } catch {}
    finally { setLoading(false); setRefreshing(false) }
  }, [])

  const fetchMyShift = useCallback(async (uid: string) => {
    try {
      const res = await fetch(`/api/employee/attendance?user_id=${uid}&resource=my_shift`)
      const data = await res.json()
      if (data.success) setMyShifts(data.myShift?.shifts ?? [])
    } catch {}
  }, [])

  const fetchMyRequests = useCallback(async (uid: string) => {
    if (!uid) return
    setMyReqLoading(true); setMyReqError('')
    try {
      const res = await fetch(`/api/attendance?resource=my_requests&user_id=${uid}`)
      const data = await res.json()
      if (!data.success) throw new Error(data.message)
      setMySwaps(data.swaps ?? [])
      setMyTimeOff(data.time_off ?? [])
      setMyFixedOff(data.fixed_off ?? [])
    } catch (err) {
      setMyReqError(err instanceof Error ? err.message : 'Failed to load requests')
    } finally { setMyReqLoading(false) }
  }, [])

  const fetchFixedOffQuota = useCallback(async (cid: string, uid: string) => {
    if (!cid || !uid) return
    try {
      const res = await fetch(`/api/attendance/off-day-settings?company_id=${cid}&user_id=${uid}&resource=my_quota`)
      const data = await res.json()
      if (data.success && typeof data.max_days_per_week === 'number') setFixedOffQuota(data.max_days_per_week)
    } catch {}
  }, [])

  // Swap counterparts must be same-department, same-role colleagues with an upcoming (tomorrow+)
  // shift — reuses the timeline endpoint (already used by partner/manager shift pages) instead of
  // introducing a new API just for this picker.
  const fetchSwapCandidates = useCallback(async (cid: string) => {
    if (!cid) return
    try {
      const from = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
      const to = new Date(Date.now() + 31 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
      const res = await fetch(`/api/shift?company_id=${cid}&date_from=${from}&date_to=${to}&viewer_role=Employee`)
      const data = await res.json()
      if (data.success) setSwapCandidateRows(data.rows ?? [])
    } catch {}
  }, [])

  const uploadAttachment = async (): Promise<string | null> => {
    if (!attachmentFile) return null
    setAttachmentUploading(true)
    try {
      const { createBrowserClient } = await import('@supabase/ssr')
      const sb = createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
      const ext = attachmentFile.name.split('.').pop()
      const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
      const { error } = await sb.storage.from('attendance-attachments').upload(path, attachmentFile, { upsert: false })
      if (error) throw error
      const { data } = sb.storage.from('attendance-attachments').getPublicUrl(path)
      return data.publicUrl
    } catch {
      setClockMessage('File upload failed. Try again.')
      return null
    } finally { setAttachmentUploading(false) }
  }

  const runClockAction = async (uid: string, shift: MyShift, action: 'clock_in' | 'clock_out' | 'break_in' | 'break_out', extra?: { late_reason?: string; attachment_url?: string | null }) => {
    setClockBusyId(`${shift.assignment.id}:${action}`)
    setClockMessage('')
    try {
      const body: Record<string, unknown> = { action, user_id: uid, shift_assignment_id: shift.assignment.id }
      if (extra?.late_reason) body.late_reason = extra.late_reason
      if (extra?.attachment_url) body.attachment_url = extra.attachment_url
      const res = await fetch('/api/employee/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.message || 'Attendance action failed')
      await fetchMyShift(uid)
      const msgs: Record<string, string> = { clock_in: 'Clocked in successfully.', clock_out: 'Clocked out successfully.', break_in: 'Break started.', break_out: 'Break ended.' }
      setClockMessage(msgs[action] ?? 'Done.')
    } catch (err) {
      setClockMessage(err instanceof Error ? err.message : 'Attendance action failed')
    } finally { setClockBusyId('') }
  }

  const handleLateClockIn = async (shift: MyShift) => {
    if (!lateReason.trim()) { setClockMessage('Please enter a reason for being late.'); return }
    const url = await uploadAttachment()
    await runClockAction(userId, shift, 'clock_in', { late_reason: lateReason.trim(), attachment_url: url })
    setLateFormId(null); setLateReason(''); setAttachmentFile(null)
  }

  const handleAbsence = async (shift: MyShift) => {
    if (!absenceReason.trim()) { setClockMessage('Please enter a reason for absence.'); return }
    const url = await uploadAttachment()
    setClockBusyId(`${shift.assignment.id}:absent`); setClockMessage('')
    try {
      const res = await fetch('/api/employee/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'record_absence', user_id: userId, shift_assignment_id: shift.assignment.id, absence_reason: absenceReason.trim(), attachment_url: url }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.message)
      await fetchMyShift(userId)
      setClockMessage('Absence reported.')
    } catch (err) {
      setClockMessage(err instanceof Error ? err.message : 'Failed to record absence')
    } finally { setClockBusyId(''); setAbsenceFormId(null); setAbsenceReason(''); setAttachmentFile(null) }
  }

  const handleSubmitSwap = async () => {
    if (!swapShiftId || !swapCounterpartId || !swapCounterpartAssignmentId) { setMyReqError('Select a shift, a colleague, and their shift.'); return }
    setSwapSubmitting(true); setMyReqError(''); setMyReqSuccess('')
    try {
      const res = await fetch('/api/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'submit_shift_swap',
          company_id: companyId,
          requester_id: userId,
          requester_assignment_id: swapShiftId,
          counterpart_id: swapCounterpartId,
          counterpart_assignment_id: swapCounterpartAssignmentId,
          reason: swapReason || null,
        }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.message)
      setMyReqSuccess('Shift swap request submitted.')
      setSwapFormOpen(false); setSwapShiftId(''); setSwapCounterpartId(''); setSwapCounterpartAssignmentId(''); setSwapReason('')
      void fetchMyRequests(userId)
    } catch (err) {
      setMyReqError(err instanceof Error ? err.message : 'Failed to submit')
    } finally { setSwapSubmitting(false) }
  }

  const handleSubmitLeave = async () => {
    setLeaveSubmitting(true); setMyReqError(''); setMyReqSuccess('')
    try {
      const res = await fetch('/api/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'submit_leave_request', company_id: companyId, requester_id: userId, request_type: leaveType, reason: leaveReason || null, shift_assignment_id: leaveShiftId || null }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.message)
      setMyReqSuccess('Leave request submitted.')
      setLeaveFormOpen(false); setLeaveShiftId(''); setLeaveReason('')
      void fetchMyRequests(userId)
    } catch (err) {
      setMyReqError(err instanceof Error ? err.message : 'Failed to submit')
    } finally { setLeaveSubmitting(false) }
  }

  const handleSubmitFixedOff = async () => {
    if (selectedFixedOffDates.length !== fixedOffQuota) { setMyReqError(`Select exactly ${fixedOffQuota} day(s).`); return }
    setFixedSubmitting(true); setMyReqError(''); setMyReqSuccess('')
    try {
      const res = await fetch('/api/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'submit_fixed_off_day', user_id: userId, company_id: companyId, dates: selectedFixedOffDates }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.message)
      setMyReqSuccess('Weekly day off request submitted.')
      setFixedFormOpen(false)
      setSelectedFixedOffDates([])
      void fetchMyRequests(userId)
    } catch (err) {
      setMyReqError(err instanceof Error ? err.message : 'Failed to submit')
    } finally { setFixedSubmitting(false) }
  }

  const toggleFixedOffDate = (date: string) => {
    setMyReqError('')
    setSelectedFixedOffDates(prev => {
      if (prev.includes(date)) return prev.filter(value => value !== date)
      if (prev.length >= fixedOffQuota) {
        setMyReqError(`You must select exactly ${fixedOffQuota} day(s).`)
        return prev
      }
      return [...prev, date].sort()
    })
  }

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      const uid = localStorage.getItem('tasking_user_id')
      if (!uid) { router.replace('/signin'); return }
      const meRes  = await fetch(`/api/user/me?user_id=${uid}`)
      const meData = await meRes.json()
      if (cancelled) return
      if (!meData.success) { router.replace('/signin'); return }
      setUserName(meData.user.full_name ?? '')
      const internalId = meData.user.id ?? uid
      setUserId(internalId)
      setUserDeptId(meData.user.department_id ?? '')

      const dashRes = await fetch(`/api/employee/dashboard?user_id=${uid}`)
      const dashData = await dashRes.json()
      const cid = (!cancelled && dashData.success) ? (dashData.company_id || '') : ''
      if (cid) { setCompanyId(cid); void fetchSwapCandidates(cid); void fetchFixedOffQuota(cid, internalId) }

      if (!cancelled) {
        void fetchRecords(uid)
        void fetchMyShift(internalId)
        void fetchMyRequests(internalId)
      }
    }
    void run()
    return () => { cancelled = true }
  }, [router, fetchRecords, fetchMyShift, fetchMyRequests, fetchSwapCandidates, fetchFixedOffQuota])

  const todayLabel = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })
  const myPendingCount = mySwaps.filter(r => r.status === 'pending').length + myTimeOff.filter(r => r.status === 'pending').length + myFixedOff.filter(r => r.status === 'pending').length

  const tabs: { key: TabKey; label: string; count?: number }[] = [
    { key: 'records', label: 'My Records' },
    { key: 'my_requests', label: 'My Requests', count: myPendingCount || undefined },
  ]

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#F7F8FA', fontFamily: "'Inter', system-ui, -apple-system, sans-serif" }}>
      <style>{`.ep-att-row:hover td { background: #F0FDF4 !important; }`}</style>
      <EmployeeSidebar />

      <main style={{ marginLeft: '64px', flex: 1, height: '100vh', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>

        {/* ── Page header ───────────────────────────── */}
        <div style={{ padding: '20px 28px 16px', flexShrink: 0, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 24 }}>
          <h1 className="mb-0 font-heading text-3xl font-bold tracking-tight text-gray-950">Attendance</h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0, paddingTop: 4 }}>
            {userName && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, height: 36, background: '#fff', border: '1.5px solid #E5E7EB', borderRadius: 999, padding: '0 14px 0 6px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 26, height: 26, borderRadius: 999, background: '#14532D', color: '#FFFFFF', flexShrink: 0 }}>
                  <UserRound size={13} />
                </span>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>{userName}</span>
              </div>
            )}
          </div>
        </div>

        {/* ── Date + tab bar row ─────────────────────────────────────────────── */}
        <div style={{ padding: '0 28px 16px', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: '#F0F4F8', borderRadius: 8, padding: '6px 12px' }}>
            <CalendarDays size={13} style={{ color: '#6B7280' }} />
            <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#374151' }}>{todayLabel}</span>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            {tabs.map(tab => (
              <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                style={{ height: 36, padding: '0 14px', borderRadius: 9, cursor: 'pointer', fontWeight: 700, fontSize: 12.5, display: 'inline-flex', alignItems: 'center', gap: 6, background: activeTab === tab.key ? '#14532D' : PANEL, border: activeTab === tab.key ? 'none' : `1.5px solid ${BORDER}`, color: activeTab === tab.key ? '#FFFFFF' : MUTED, transition: 'all 0.15s' }}>
                {tab.label}
                {tab.count !== undefined && tab.count > 0 && (
                  <span style={{ minWidth: 18, height: 18, padding: '0 4px', borderRadius: 999, background: '#EF4444', color: '#fff', fontSize: 10, fontWeight: 900, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{tab.count}</span>
                )}
              </button>
            ))}
          </div>
          {activeTab === 'records' && (
            <button
              onClick={() => { const uid = localStorage.getItem('tasking_user_id'); if (uid) fetchRecords(uid, true) }}
              disabled={refreshing || loading}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, border: '1.5px solid #E5E7EB', borderRadius: 8, background: '#fff', color: '#374151', padding: '6px 13px', fontWeight: 600, fontSize: '0.8125rem', cursor: refreshing || loading ? 'default' : 'pointer', opacity: refreshing || loading ? 0.6 : 1 }}>
              {refreshing ? <Spinner dark /> : <RefreshCw size={13} />} Refresh
            </button>
          )}
        </div>

        <div style={{ padding: '0 28px 28px', display: 'flex', flexDirection: 'column', gap: 18 }}>

          {/* ── My Shift — UC49 Clock In / Clock Out (always visible) ── */}
          {myShifts.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {clockMessage && (
                <div style={{ padding: '10px 14px', background: clockMessage.includes('successfully') || clockMessage.includes('reported') ? '#ECFDF5' : '#FEF2F2', color: clockMessage.includes('successfully') || clockMessage.includes('reported') ? '#047857' : '#B91C1C', borderRadius: 8, fontSize: 13, fontWeight: 600 }}>
                  {clockMessage}
                </div>
              )}
              {myShifts.map(shift => {
                const clockedIn  = !!shift.record?.clock_in_time
                const clockedOut = !!shift.record?.clock_out_time
                const clockInWindowOpen  = canClockIn(shift.shift)
                const clockOutWindowOpen = canClockOut(shift.shift)
                const shiftStart = new Date(`${shift.shift.shift_date}T${shift.shift.start_time}Z`)
                const isLateNow  = Date.now() > shiftStart.getTime() + 10 * 60000
                const onBreak  = !!shift.record?.break_in_time && !shift.record?.break_out_time
                const breakDone = !!shift.record?.break_in_time && !!shift.record?.break_out_time
                const isLateForm    = lateFormId === shift.assignment.id
                const isAbsenceForm = absenceFormId === shift.assignment.id
                return (
                  <div key={shift.assignment.id} style={{ background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: 12, padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
                      <div>
                        <p style={{ margin: 0, fontWeight: 700, fontSize: 14, color: '#111827' }}>{shift.shift.title || 'My Shift'}</p>
                        <p style={{ margin: '2px 0 0', fontSize: 12.5, color: '#6B7280' }}>
                          {formatDate(shift.shift.shift_date)} · {formatTime(shift.shift.start_time)} – {formatTime(shift.shift.end_time)}
                          {clockedIn && <> · In {formatTime(shift.record?.clock_in_time)}</>}
                          {onBreak && <> · On break since {formatTime(shift.record?.break_in_time)}</>}
                          {breakDone && <> · Break {formatTime(shift.record?.break_in_time)} – {formatTime(shift.record?.break_out_time)}</>}
                          {clockedOut && <> · Out {formatTime(shift.record?.clock_out_time)}</>}
                        </p>
                      </div>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
                        {!clockedIn && clockInWindowOpen && !isLateForm && !isAbsenceForm && (
                          <>
                            <button onClick={() => {
                              if (isLateNow) { setLateFormId(shift.assignment.id); setLateReason('') }
                              else void runClockAction(userId, shift, 'clock_in')
                            }} disabled={!!clockBusyId}
                              style={{ height: 34, padding: '0 14px', borderRadius: 8, border: 'none', background: GREEN, color: '#fff', fontWeight: 700, fontSize: 12.5, cursor: clockBusyId ? 'default' : 'pointer' }}>
                              {clockBusyId === `${shift.assignment.id}:clock_in` ? 'Working…' : 'Clock In'}
                            </button>
                            <button onClick={() => { setAbsenceFormId(shift.assignment.id); setAbsenceReason('') }}
                              style={{ height: 34, padding: '0 14px', borderRadius: 8, border: '1.5px solid #EF4444', background: '#FEF2F2', color: '#B91C1C', fontWeight: 700, fontSize: 12.5, cursor: 'pointer' }}>
                              Not Coming In
                            </button>
                          </>
                        )}
                        {!clockedIn && !clockInWindowOpen && (
                          <span style={{ fontSize: 12, color: '#6B7280', fontStyle: 'italic' }}>Clock In opens 30 min before shift</span>
                        )}
                        {clockedIn && !clockedOut && (
                          <>
                            {!onBreak && !breakDone && (
                              <button onClick={() => runClockAction(userId, shift, 'break_in')} disabled={!!clockBusyId}
                                style={{ height: 34, padding: '0 14px', borderRadius: 8, border: '1.5px solid #D97706', background: '#FFFBEB', color: '#B45309', fontWeight: 700, fontSize: 12.5, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
                                <Coffee size={12} /> Break In
                              </button>
                            )}
                            {onBreak && (
                              <button onClick={() => runClockAction(userId, shift, 'break_out')} disabled={!!clockBusyId}
                                style={{ height: 34, padding: '0 14px', borderRadius: 8, border: '1.5px solid #D97706', background: '#FFF7ED', color: '#B45309', fontWeight: 700, fontSize: 12.5, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
                                <Coffee size={12} /> Break Out
                              </button>
                            )}
                            {clockOutWindowOpen && (
                              <button onClick={() => runClockAction(userId, shift, 'clock_out')} disabled={!!clockBusyId}
                                style={{ height: 34, padding: '0 14px', borderRadius: 8, border: 'none', background: '#334155', color: '#fff', fontWeight: 700, fontSize: 12.5, cursor: 'pointer' }}>
                                {clockBusyId === `${shift.assignment.id}:clock_out` ? 'Working…' : 'Clock Out'}
                              </button>
                            )}
                            {!clockOutWindowOpen && <span style={{ fontSize: 12, color: '#6B7280', fontStyle: 'italic' }}>Clock Out opens at shift end</span>}
                          </>
                        )}
                        {clockedOut && <span style={{ fontSize: 12, fontWeight: 600, color: '#047857' }}>Completed</span>}
                      </div>
                    </div>

                    {isLateForm && (
                      <div style={{ background: '#FFFBEB', border: '1.5px solid #FCD34D', borderRadius: 10, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#92400E' }}>You are late — please provide a reason</p>
                        <textarea value={lateReason} onChange={e => setLateReason(e.target.value)} placeholder="Reason for being late…" rows={2}
                          style={{ resize: 'vertical', fontSize: 13, padding: '8px 10px', borderRadius: 7, border: '1.5px solid #FCD34D', outline: 'none', fontFamily: 'inherit', background: '#fff' }} />
                        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: '#92400E', cursor: 'pointer' }}>
                          <Paperclip size={12} />
                          {attachmentFile ? attachmentFile.name : 'Attach supporting document (optional)'}
                          <input type="file" accept=".pdf,.jpg,.jpeg,.png" style={{ display: 'none' }} onChange={e => setAttachmentFile(e.target.files?.[0] ?? null)} />
                        </label>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button onClick={() => handleLateClockIn(shift)} disabled={!!clockBusyId || attachmentUploading}
                            style={{ height: 32, padding: '0 14px', borderRadius: 7, border: 'none', background: GREEN, color: '#fff', fontWeight: 700, fontSize: 12.5, cursor: 'pointer' }}>
                            {attachmentUploading ? 'Uploading…' : 'Submit & Clock In'}
                          </button>
                          <button onClick={() => { setLateFormId(null); setAttachmentFile(null) }}
                            style={{ height: 32, padding: '0 12px', borderRadius: 7, border: '1.5px solid #D1D5DB', background: '#fff', fontWeight: 600, fontSize: 12.5, cursor: 'pointer' }}>
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}

                    {isAbsenceForm && (
                      <div style={{ background: '#FEF2F2', border: '1.5px solid #FCA5A5', borderRadius: 10, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#991B1B' }}>Report absence — please provide a reason</p>
                        <textarea value={absenceReason} onChange={e => setAbsenceReason(e.target.value)} placeholder="Reason for absence…" rows={2}
                          style={{ resize: 'vertical', fontSize: 13, padding: '8px 10px', borderRadius: 7, border: '1.5px solid #FCA5A5', outline: 'none', fontFamily: 'inherit', background: '#fff' }} />
                        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: '#991B1B', cursor: 'pointer' }}>
                          <Paperclip size={12} />
                          {attachmentFile ? attachmentFile.name : 'Attach supporting document (optional)'}
                          <input type="file" accept=".pdf,.jpg,.jpeg,.png" style={{ display: 'none' }} onChange={e => setAttachmentFile(e.target.files?.[0] ?? null)} />
                        </label>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button onClick={() => handleAbsence(shift)} disabled={!!clockBusyId || attachmentUploading}
                            style={{ height: 32, padding: '0 14px', borderRadius: 7, border: 'none', background: '#DC2626', color: '#fff', fontWeight: 700, fontSize: 12.5, cursor: 'pointer' }}>
                            {clockBusyId === `${shift.assignment.id}:absent` ? 'Submitting…' : attachmentUploading ? 'Uploading…' : 'Report Absence'}
                          </button>
                          <button onClick={() => { setAbsenceFormId(null); setAttachmentFile(null) }}
                            style={{ height: 32, padding: '0 12px', borderRadius: 7, border: '1.5px solid #D1D5DB', background: '#fff', fontWeight: 600, fontSize: 12.5, cursor: 'pointer' }}>
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {/* ══ RECORDS TAB ══ */}
          {activeTab === 'records' && (
            <>
              <section style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
                {[
                  { label: 'Total Shifts', value: totalShifts, color: '#111827' },
                  { label: 'Approved',     value: approved,    color: '#047857' },
                  { label: 'Pending',      value: pending,     color: '#B45309' },
                  { label: 'Rejected',     value: rejected,    color: '#B91C1C' },
                ].map(({ label, value, color }) => (
                  <div key={label} style={{ background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: 10, padding: '14px 16px' }}>
                    <p style={{ margin: 0, color: '#6B7280', fontSize: '0.72rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</p>
                    <strong style={{ display: 'block', marginTop: 6, fontSize: '1.5rem', color: loading ? '#D1D5DB' : color }}>{loading ? '—' : value}</strong>
                  </div>
                ))}
              </section>

              <section style={{ background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: 12, overflow: 'hidden' }}>
                <div style={{ padding: '14px 18px', borderBottom: '1px solid #F0F4F8', display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 30, height: 30, borderRadius: 9, background: '#F0FDF4', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Clock size={15} style={{ color: GREEN }} />
                  </div>
                  <span style={{ fontSize: '0.875rem', fontWeight: 700, color: '#111827', flex: 1 }}>My Shift Attendance</span>
                  <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#6B7280' }}>{records.length} record{records.length !== 1 ? 's' : ''}</span>
                </div>
                {loading ? (
                  <div style={{ padding: '28px 18px', color: '#9CA3AF', fontSize: '0.875rem', display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'center' }}>
                    <Spinner dark /> Loading attendance records…
                  </div>
                ) : records.length === 0 ? (
                  <div style={{ padding: '32px 18px', color: '#9CA3AF', fontSize: '0.875rem', textAlign: 'center' }}>No attendance records found.</div>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                      <thead>
                        <tr style={{ background: '#F8FAFC' }}>
                          {['Date', 'Shift', 'Department', 'Scheduled', 'Clock In', 'Clock Out', 'Status', 'Notes'].map(h => (
                            <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 700, fontSize: '0.72rem', color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '1px solid #F0F4F8', whiteSpace: 'nowrap' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {records.map((row, i) => {
                          const badge = statusBadge(row.status)
                          return (
                            <tr key={row.id} className="ep-att-row" style={{ borderBottom: i < records.length - 1 ? '1px solid #F8FAFC' : 'none' }}>
                              <td style={{ padding: '12px 14px', color: '#374151', fontWeight: 600, whiteSpace: 'nowrap' }}>{formatDate(row.shift_date)}</td>
                              <td style={{ padding: '12px 14px', color: '#111827', fontWeight: 500 }}>{row.shift_title || 'Shift'}</td>
                              <td style={{ padding: '12px 14px', color: '#6B7280' }}>{row.department_name ?? '—'}</td>
                              <td style={{ padding: '12px 14px', color: '#374151', whiteSpace: 'nowrap' }}>{formatTime(row.start_time)} – {formatTime(row.end_time)}</td>
                              <td style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}>
                                {row.clock_in_time ? <span style={{ color: '#047857', fontWeight: 600 }}>{formatTime(row.clock_in_time)}</span> : <span style={{ color: '#9CA3AF' }}>—</span>}
                              </td>
                              <td style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}>
                                {row.clock_out_time ? <span style={{ color: '#047857', fontWeight: 600 }}>{formatTime(row.clock_out_time)}</span> : <span style={{ color: '#9CA3AF' }}>—</span>}
                              </td>
                              <td style={{ padding: '12px 14px' }}>
                                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: badge.bg, color: badge.text, padding: '3px 9px', borderRadius: 99, fontWeight: 700, fontSize: '0.72rem', whiteSpace: 'nowrap' }}>
                                  <StatusIcon status={row.status} /> {badge.label}
                                </div>
                              </td>
                              <td style={{ padding: '12px 14px', color: '#6B7280', fontSize: '0.8rem', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {row.employee_notes || row.manager_notes || '—'}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            </>
          )}

          {/* ══ MY REQUESTS TAB ══ */}
          {activeTab === 'my_requests' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {myReqError && <div style={{ padding: '10px 14px', background: '#FEF2F2', border: '1px solid #FECACA', color: '#B91C1C', borderRadius: 8, fontSize: 13, fontWeight: 700 }}>{myReqError}</div>}
              {myReqSuccess && <div style={{ padding: '10px 14px', background: '#ECFDF5', border: '1px solid #A7F3D0', color: '#047857', borderRadius: 8, fontSize: 13, fontWeight: 700 }}>{myReqSuccess}</div>}

              {/* Action buttons */}
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <button onClick={() => { setSwapFormOpen(v => !v); setLeaveFormOpen(false); setFixedFormOpen(false) }}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 7, height: 38, padding: '0 16px', background: swapFormOpen ? '#14532D' : PANEL, color: swapFormOpen ? '#FFFFFF' : TEXT, border: `1.5px solid ${swapFormOpen ? '#14532D' : BORDER}`, borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                  <ArrowLeftRight size={14} /> Shift Swap
                </button>
                <button onClick={() => { setLeaveFormOpen(v => !v); setSwapFormOpen(false); setFixedFormOpen(false) }}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 7, height: 38, padding: '0 16px', background: leaveFormOpen ? '#14532D' : PANEL, color: leaveFormOpen ? '#FFFFFF' : TEXT, border: `1.5px solid ${leaveFormOpen ? '#14532D' : BORDER}`, borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                  <ShieldCheck size={14} /> Leave Request
                </button>
                <button onClick={() => { setFixedFormOpen(v => !v); setSwapFormOpen(false); setLeaveFormOpen(false) }}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 7, height: 38, padding: '0 16px', background: fixedFormOpen ? '#14532D' : PANEL, color: fixedFormOpen ? '#FFFFFF' : TEXT, border: `1.5px solid ${fixedFormOpen ? '#14532D' : BORDER}`, borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                  <Calendar size={14} /> Weekly Day Off
                </button>
                <button onClick={() => void fetchMyRequests(userId)} disabled={myReqLoading || !userId}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 38, padding: '0 14px', background: PANEL, color: MUTED, border: `1px solid ${BORDER}`, borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer', marginLeft: 'auto' }}>
                  {myReqLoading ? <Spinner dark /> : <RefreshCw size={13} />} Refresh
                </button>
              </div>

              {/* Shift Swap form */}
              {swapFormOpen && (
                <div style={{ background: PANEL, border: `1.5px solid #E5E7EB`, borderRadius: 14, padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 13 }}>
                  <p style={{ margin: 0, fontWeight: 800, fontSize: 14, color: TEXT }}>Submit Shift Swap Request</p>
                  {(() => {
                    const todayStr = new Date().toISOString().slice(0, 10)
                    const mySwappableShifts = myShifts.filter(s => s.shift.shift_date > todayStr)
                    const colleagueRows = swapCandidateRows.filter(r => r.user_id !== userId && r.role === 'Employee' && r.department_id === userDeptId)
                    const selectedColleague = colleagueRows.find(r => r.user_id === swapCounterpartId)
                    const colleagueShifts = (selectedColleague?.shifts ?? []).filter(s => s.shift_date > todayStr && s.assignment_id)
                    return (
                      <>
                        <div>
                          <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 5 }}>My Shift</label>
                          <select value={swapShiftId} onChange={e => setSwapShiftId(e.target.value)}
                            style={{ width: '100%', height: 38, padding: '0 10px', border: `1px solid ${BORDER}`, borderRadius: 8, fontSize: 13, color: TEXT, background: '#F8FAFC', outline: 'none' }}>
                            <option value="">Select a shift to swap… (tomorrow or later)</option>
                            {mySwappableShifts.map(s => (
                              <option key={s.assignment.id} value={s.assignment.id}>{s.shift.title || 'Shift'} — {s.shift.shift_date} {s.shift.start_time}–{s.shift.end_time}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 5 }}>Swap With</label>
                          <select value={swapCounterpartId} onChange={e => { setSwapCounterpartId(e.target.value); setSwapCounterpartAssignmentId('') }}
                            style={{ width: '100%', height: 38, padding: '0 10px', border: `1px solid ${BORDER}`, borderRadius: 8, fontSize: 13, color: TEXT, background: '#F8FAFC', outline: 'none' }}>
                            <option value="">Select a colleague…</option>
                            {colleagueRows.map(r => (
                              <option key={r.user_id} value={r.user_id ?? ''}>{r.full_name}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 5 }}>Their Shift</label>
                          <select value={swapCounterpartAssignmentId} onChange={e => setSwapCounterpartAssignmentId(e.target.value)} disabled={!swapCounterpartId}
                            style={{ width: '100%', height: 38, padding: '0 10px', border: `1px solid ${BORDER}`, borderRadius: 8, fontSize: 13, color: TEXT, background: swapCounterpartId ? '#F8FAFC' : '#F1F5F9', outline: 'none' }}>
                            <option value="">{swapCounterpartId ? (colleagueShifts.length === 0 ? 'No upcoming shifts' : 'Select their shift…') : 'Select a colleague first'}</option>
                            {colleagueShifts.map(s => (
                              <option key={s.assignment_id} value={s.assignment_id ?? ''}>{s.title || 'Shift'} — {s.shift_date} {s.start_time}–{s.end_time}</option>
                            ))}
                          </select>
                        </div>
                      </>
                    )
                  })()}
                  <div>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 5 }}>Reason (optional)</label>
                    <textarea value={swapReason} onChange={e => setSwapReason(e.target.value)} rows={2}
                      style={{ width: '100%', padding: '8px 10px', border: `1px solid ${BORDER}`, borderRadius: 8, fontSize: 13, color: TEXT, background: '#F8FAFC', outline: 'none', resize: 'vertical', boxSizing: 'border-box', fontFamily: 'inherit' }} />
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => setSwapFormOpen(false)} style={{ flex: 1, height: 38, background: 'none', border: `1.5px solid ${BORDER}`, borderRadius: 9, fontWeight: 700, fontSize: 13, color: MUTED, cursor: 'pointer' }}>Cancel</button>
                    <button onClick={handleSubmitSwap} disabled={swapSubmitting || !swapShiftId || !swapCounterpartId || !swapCounterpartAssignmentId}
                      style={{ flex: 2, height: 38, background: '#14532D', border: 'none', borderRadius: 9, fontWeight: 700, fontSize: 13, color: '#FFFFFF', cursor: swapSubmitting ? 'default' : 'pointer', opacity: swapSubmitting || !swapShiftId || !swapCounterpartId || !swapCounterpartAssignmentId ? 0.55 : 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                      {swapSubmitting ? <Spinner /> : <ArrowLeftRight size={13} />} Submit Swap Request
                    </button>
                  </div>
                </div>
              )}

              {/* Leave Request form */}
              {leaveFormOpen && (
                <div style={{ background: PANEL, border: `1.5px solid #E5E7EB`, borderRadius: 14, padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 13 }}>
                  <p style={{ margin: 0, fontWeight: 800, fontSize: 14, color: TEXT }}>Submit Leave Request</p>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div>
                      <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 5 }}>Type</label>
                      <select value={leaveType} onChange={e => setLeaveType(e.target.value as 'leave' | 'time_off')}
                        style={{ width: '100%', height: 38, padding: '0 10px', border: `1px solid ${BORDER}`, borderRadius: 8, fontSize: 13, color: TEXT, background: '#F8FAFC', outline: 'none' }}>
                        <option value="leave">Leave</option>
                        <option value="time_off">Time Off</option>
                      </select>
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 5 }}>Related Shift (optional)</label>
                      <select value={leaveShiftId} onChange={e => setLeaveShiftId(e.target.value)}
                        style={{ width: '100%', height: 38, padding: '0 10px', border: `1px solid ${BORDER}`, borderRadius: 8, fontSize: 13, color: TEXT, background: '#F8FAFC', outline: 'none' }}>
                        <option value="">No specific shift</option>
                        {myShifts.map(s => (
                          <option key={s.assignment.id} value={s.assignment.id}>{s.shift.title || 'Shift'} — {s.shift.shift_date}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 5 }}>Reason</label>
                    <textarea value={leaveReason} onChange={e => setLeaveReason(e.target.value)} rows={3}
                      style={{ width: '100%', padding: '8px 10px', border: `1px solid ${BORDER}`, borderRadius: 8, fontSize: 13, color: TEXT, background: '#F8FAFC', outline: 'none', resize: 'vertical', boxSizing: 'border-box', fontFamily: 'inherit' }} />
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => setLeaveFormOpen(false)} style={{ flex: 1, height: 38, background: 'none', border: `1.5px solid ${BORDER}`, borderRadius: 9, fontWeight: 700, fontSize: 13, color: MUTED, cursor: 'pointer' }}>Cancel</button>
                    <button onClick={handleSubmitLeave} disabled={leaveSubmitting}
                      style={{ flex: 2, height: 38, background: '#14532D', border: 'none', borderRadius: 9, fontWeight: 700, fontSize: 13, color: '#FFFFFF', cursor: leaveSubmitting ? 'default' : 'pointer', opacity: leaveSubmitting ? 0.55 : 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                      {leaveSubmitting ? <Spinner /> : <ShieldCheck size={13} />} Submit Leave Request
                    </button>
                  </div>
                </div>
              )}

              {/* Fixed Day Off form */}
              {fixedFormOpen && (
                <div style={{ background: PANEL, border: `1.5px solid #E5E7EB`, borderRadius: 14, padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 13 }}>
                  <p style={{ margin: 0, fontWeight: 800, fontSize: 14, color: TEXT }}>Request Weekly Day Off</p>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, color: MUTED, fontSize: 12.5, fontWeight: 700 }}>
                    <span>Upcoming week</span>
                    <span>{selectedFixedOffDates.length}/{fixedOffQuota} selected</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(108px, 1fr))', gap: 8 }}>
                    {getUpcomingWeekDates().map(date => {
                      const selected = selectedFixedOffDates.includes(date)
                      const atLimit = !selected && selectedFixedOffDates.length >= fixedOffQuota
                      return (
                        <button
                          key={date}
                          type="button"
                          onClick={() => toggleFixedOffDate(date)}
                          disabled={atLimit}
                          style={{
                            minHeight: 58,
                            padding: '8px 10px',
                            borderRadius: 10,
                            border: selected ? '1.5px solid #16A34A' : `1px solid ${BORDER}`,
                            background: selected ? '#DCFCE7' : '#FFFFFF',
                            color: selected ? '#166534' : TEXT,
                            opacity: atLimit ? 0.45 : 1,
                            cursor: atLimit ? 'not-allowed' : 'pointer',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'flex-start',
                            justifyContent: 'center',
                            gap: 3,
                            fontWeight: 800,
                          }}
                        >
                          <span style={{ fontSize: 12 }}>{new Date(`${date}T00:00:00`).toLocaleDateString('en-AU', { weekday: 'short' })}</span>
                          <span style={{ fontSize: 13 }}>{formatDate(date)}</span>
                        </button>
                      )
                    })}
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => setFixedFormOpen(false)} style={{ flex: 1, height: 38, background: 'none', border: `1.5px solid ${BORDER}`, borderRadius: 9, fontWeight: 700, fontSize: 13, color: MUTED, cursor: 'pointer' }}>Cancel</button>
                    <button onClick={handleSubmitFixedOff} disabled={fixedSubmitting || selectedFixedOffDates.length !== fixedOffQuota}
                      style={{ flex: 2, height: 38, background: '#14532D', border: 'none', borderRadius: 9, fontWeight: 700, fontSize: 13, color: '#FFFFFF', cursor: fixedSubmitting ? 'default' : 'pointer', opacity: fixedSubmitting || selectedFixedOffDates.length !== fixedOffQuota ? 0.55 : 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                      {fixedSubmitting ? <Spinner /> : <Calendar size={13} />} Request Weekly Day Off
                    </button>
                  </div>
                </div>
              )}

              {/* History panels */}
              {myReqLoading ? (
                <div style={{ padding: '32px 0', textAlign: 'center', color: MUTED, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}><Spinner dark /> Loading…</div>
              ) : (
                <>
                  <div style={{ background: PANEL, borderRadius: 12, overflow: 'hidden', border: `1px solid ${BORDER}` }}>
                    <div style={{ padding: '12px 16px', borderBottom: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', gap: 8 }}>
                      <ArrowLeftRight size={14} color="#F97316" />
                      <span style={{ fontWeight: 700, fontSize: 13, color: TEXT }}>My Shift Swap Requests</span>
                      <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 700, color: MUTED }}>{mySwaps.length} total</span>
                    </div>
                    {mySwaps.length === 0 ? (
                      <div style={{ padding: '20px 16px', color: MUTED, fontSize: 13, textAlign: 'center' }}>No swap requests yet.</div>
                    ) : mySwaps.map((req, i) => (
                      <div key={req.id} style={{ padding: '12px 16px', borderBottom: i < mySwaps.length - 1 ? `1px solid #F8FAFC` : 'none', display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: TEXT }}>Swap with {req.counterpart_name}</div>
                          <div style={{ fontSize: 11.5, color: MUTED }}>{req.requester_shift_title ?? 'Shift'} · {req.requester_shift_date ?? '—'} · {formatTime(req.requester_start_time)} – {formatTime(req.requester_end_time)}</div>
                          {req.reason && <div style={{ fontSize: 11.5, color: '#4B5563', marginTop: 2 }}>{req.reason}</div>}
                          {req.owner_review_reason && (
                            <span style={{ display: 'inline-block', marginTop: 4, fontSize: 10.5, fontWeight: 700, color: '#B91C1C', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 999, padding: '2px 8px' }}>{req.owner_review_reason}</span>
                          )}
                        </div>
                        {statusChip(req.status)}
                      </div>
                    ))}
                  </div>

                  <div style={{ background: PANEL, borderRadius: 12, overflow: 'hidden', border: `1px solid ${BORDER}` }}>
                    <div style={{ padding: '12px 16px', borderBottom: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', gap: 8 }}>
                      <ShieldCheck size={14} color="#059669" />
                      <span style={{ fontWeight: 700, fontSize: 13, color: TEXT }}>My Leave Requests</span>
                      <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 700, color: MUTED }}>{myTimeOff.length} total</span>
                    </div>
                    {myTimeOff.length === 0 ? (
                      <div style={{ padding: '20px 16px', color: MUTED, fontSize: 13, textAlign: 'center' }}>No leave requests yet.</div>
                    ) : myTimeOff.map((req, i) => (
                      <div key={req.id} style={{ padding: '12px 16px', borderBottom: i < myTimeOff.length - 1 ? `1px solid #F8FAFC` : 'none', display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: TEXT }}>{req.request_type === 'leave' ? 'Leave' : 'Time Off'}</div>
                          <div style={{ fontSize: 11.5, color: MUTED }}>{req.shift_date ?? '—'}{req.shift_title ? ` · ${req.shift_title}` : ''}</div>
                          {req.reason && <div style={{ fontSize: 11.5, color: '#4B5563', marginTop: 2 }}>{req.reason}</div>}
                        </div>
                        {statusChip(req.status)}
                      </div>
                    ))}
                  </div>

                  <div style={{ background: PANEL, borderRadius: 12, overflow: 'hidden', border: `1px solid ${BORDER}` }}>
                    <div style={{ padding: '12px 16px', borderBottom: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Calendar size={14} color="#7C3AED" />
                      <span style={{ fontWeight: 700, fontSize: 13, color: TEXT }}>My Weekly Day Off Requests</span>
                      <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 700, color: MUTED }}>{myFixedOff.length} total</span>
                    </div>
                    {myFixedOff.length === 0 ? (
                      <div style={{ padding: '20px 16px', color: MUTED, fontSize: 13, textAlign: 'center' }}>No weekly day off requests yet.</div>
                    ) : myFixedOff.map((req, i) => (
                      <div key={req.id} style={{ padding: '12px 16px', borderBottom: i < myFixedOff.length - 1 ? `1px solid #F8FAFC` : 'none', display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: TEXT }}>{formatDate(req.request_date)}</div>
                          {req.source === 'auto_assigned' && <div style={{ fontSize: 11.5, color: MUTED, marginTop: 2 }}>Auto assigned</div>}
                        </div>
                        {statusChip(req.status)}
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

        </div>
      </main>
    </div>
  )
}
