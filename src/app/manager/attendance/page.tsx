'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'
import {
  Briefcase, Check, CheckSquare, Clock, Edit3, RefreshCw, X,
  AlertTriangle, CalendarDays, Users, ChevronDown, UserCog,
  Coffee, Paperclip, XCircle, ArrowLeftRight, Calendar, ShieldCheck,
  Sparkles, ChevronUp,
} from 'lucide-react'
import ManagerSidebar from '@/components/ManagerSidebar'
import {
  AttendanceDashboard,
  AttendanceDashboardRecord,
  FixedOffDayRequestView,
  ShiftSwapRequestView,
  TimeOffRequestView,
} from '@/types/Attendance'
import { TimelineRow } from '@/types/Timeline'

// ─── Theme ────────────────────────────────────────────────────────────────────
const BLUE   = '#2563EB'
const APP_BG = '#F1F5F9'
const PANEL  = '#FFFFFF'
const BORDER = '#E2E8F0'
const TEXT   = '#0F172A'
const MUTED  = '#64748B'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtTime(val: string | null | undefined): string {
  if (!val) return '—'
  if (val.includes('T')) return new Date(val).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  return val.slice(0, 5)
}

function fmtDate(val: string | null | undefined): string {
  if (!val) return '—'
  return new Date(val).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })
}

function statusChip(status: string) {
  const map: Record<string, { bg: string; color: string; label: string }> = {
    approved:         { bg: '#ECFDF5', color: '#047857', label: 'Approved' },
    owner_approved:   { bg: '#ECFDF5', color: '#047857', label: 'Approved' },
    rejected:         { bg: '#FEF2F2', color: '#B91C1C', label: 'Rejected' },
    owner_rejected:   { bg: '#FEF2F2', color: '#B91C1C', label: 'Rejected' },
    manager_reviewed: { bg: '#EFF6FF', color: '#1D4ED8', label: 'Under review' },
    submitted:        { bg: '#FFF7ED', color: '#C2410C', label: 'Needs review' },
    pending:          { bg: '#FFFBEB', color: '#B45309', label: 'Pending' },
    late:             { bg: '#FFF7ED', color: '#C2410C', label: 'Late' },
    absent:           { bg: '#FEF2F2', color: '#B91C1C', label: 'Absent' },
  }
  const s = map[status] ?? { bg: '#F1F5F9', color: MUTED, label: status }
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', height: 22, padding: '0 8px', borderRadius: 999, fontSize: 11, fontWeight: 700, background: s.bg, color: s.color }}>
      {s.label}
    </span>
  )
}

function StatCard({ label, value, icon, accentBg, accentColor }: { label: string; value: number; icon: React.ReactNode; accentBg: string; accentColor: string }) {
  return (
    <div style={{ background: PANEL, borderRadius: 14, padding: '14px 16px', flex: 1, minWidth: 0, boxShadow: '0 1px 4px rgba(0,0,0,0.05), 0 0 0 1px rgba(0,0,0,0.04)', display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.07em' }}>{label}</p>
        <div style={{ width: 30, height: 30, borderRadius: 9, background: accentBg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: accentColor }}>{icon}</div>
      </div>
      <p style={{ margin: 0, fontSize: 26, fontWeight: 800, color: TEXT, letterSpacing: '-0.5px', lineHeight: 1 }}>{value}</p>
    </div>
  )
}

function Spinner({ light = false }: { light?: boolean }) {
  return (
    <svg className="animate-spin" width={14} height={14} viewBox="0 0 18 18" style={{ display: 'inline-block', flexShrink: 0 }}>
      <circle cx="9" cy="9" r="7" stroke={light ? 'rgba(255,255,255,0.35)' : 'rgba(37,99,235,0.2)'} strokeWidth="2.5" fill="none" />
      <path d="M9 2a7 7 0 0 1 7 7" stroke={light ? 'white' : BLUE} strokeWidth="2.5" strokeLinecap="round" fill="none" />
    </svg>
  )
}

const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

type Department = { id: string; name: string }
type TabKey = 'records' | 'time_off' | 'swaps' | 'my_requests'

type MyShiftRecord = { id: string; clock_in_time: string | null; clock_out_time: string | null; break_in_time: string | null; break_out_time: string | null; status: string }
type MyShift = {
  assignment: { id: string; user_id: string }
  shift: { id: string; title: string | null; shift_date: string; start_time: string; end_time: string; is_open_ended: boolean }
  record: MyShiftRecord | null
}

// UC49: Clock In only appears starting 30 minutes before the shift's scheduled start; Clock Out
// never appears early — only once the shift has actually reached its end time (skipped for
// open-ended one-off jobs, where the worker decides when the task is done).
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

export default function ManagerAttendancePage() {
  const router = useRouter()
  const [managerId, setManagerId] = useState('')
  const [managerName, setManagerName] = useState('')
  const [companyId, setCompanyId] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [departments, setDepartments] = useState<Department[]>([])
  const [selectedDeptId, setSelectedDeptId] = useState('')

  const [dashboard, setDashboard] = useState<AttendanceDashboard | null>(null)
  const [timeOffRequests, setTimeOffRequests] = useState<TimeOffRequestView[]>([])
  const [swapRequests, setSwapRequests] = useState<ShiftSwapRequestView[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [activeTab, setActiveTab] = useState<TabKey>('records')
  const [reviewOpen, setReviewOpen] = useState(false)
  const [reviewRecord, setReviewRecord] = useState<AttendanceDashboardRecord | null>(null)
  const [reviewNotes, setReviewNotes] = useState('')
  const [actionLoading, setActionLoading] = useState(false)

  // UC49: Manager clocks in/out for their own shift, same as Employee/Casual Worker.
  const [myShifts, setMyShifts] = useState<MyShift[]>([])
  const [clockBusyId, setClockBusyId] = useState('')
  const [clockMessage, setClockMessage] = useState('')

  // My Requests tab state
  const [mySwaps, setMySwaps] = useState<ShiftSwapRequestView[]>([])
  const [myTimeOff, setMyTimeOff] = useState<TimeOffRequestView[]>([])
  const [myFixedOff, setMyFixedOff] = useState<FixedOffDayRequestView[]>([])
  const [myReqLoading, setMyReqLoading] = useState(false)
  const [myReqError, setMyReqError] = useState('')
  const [myReqSuccess, setMyReqSuccess] = useState('')

  // Submit: Shift Swap form
  const [swapFormOpen, setSwapFormOpen] = useState(false)
  const [swapShiftId, setSwapShiftId] = useState('')
  const [swapCounterpartId, setSwapCounterpartId] = useState('')
  const [swapCounterpartAssignmentId, setSwapCounterpartAssignmentId] = useState('')
  const [swapReason, setSwapReason] = useState('')
  const [swapSubmitting, setSwapSubmitting] = useState(false)

  // Submit: Leave Request form
  const [leaveFormOpen, setLeaveFormOpen] = useState(false)
  const [leaveType, setLeaveType] = useState<'leave' | 'time_off'>('leave')
  const [leaveShiftId, setLeaveShiftId] = useState('')
  const [leaveReason, setLeaveReason] = useState('')
  const [leaveSubmitting, setLeaveSubmitting] = useState(false)

  // Submit: Fixed Day Off form
  const [fixedFormOpen, setFixedFormOpen] = useState(false)
  const [fixedWeekday, setFixedWeekday] = useState(1)
  const [fixedSubmitting, setFixedSubmitting] = useState(false)

  // Swap counterpart candidates (same-department, same-role colleagues with upcoming shifts)
  const [swapCandidateRows, setSwapCandidateRows] = useState<TimelineRow[]>([])

  // Late reason / absence form state (per shift assignment id)
  const [lateFormId, setLateFormId] = useState<string | null>(null)
  const [lateReason, setLateReason] = useState('')
  const [absenceFormId, setAbsenceFormId] = useState<string | null>(null)
  const [absenceReason, setAbsenceReason] = useState('')
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null)
  const [attachmentUploading, setAttachmentUploading] = useState(false)

  const fetchMyShift = useCallback(async (mid: string) => {
    if (!mid) return
    try {
      const res = await fetch(`/api/employee/attendance?user_id=${mid}&resource=my_shift`)
      const data = await res.json()
      if (data.success) setMyShifts(data.myShift?.shifts ?? [])
    } catch {}
  }, [])

  const fetchMyRequests = useCallback(async (uid: string) => {
    if (!uid) return
    setMyReqLoading(true)
    setMyReqError('')
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

  // Swap counterparts must be same-department, same-role colleagues with an upcoming (tomorrow+)
  // shift — reuses the timeline endpoint (already used by partner/manager shift pages) instead of
  // introducing a new API just for this picker.
  const fetchSwapCandidates = useCallback(async (cid: string) => {
    if (!cid) return
    try {
      const from = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
      const to = new Date(Date.now() + 31 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
      const res = await fetch(`/api/shift?company_id=${cid}&date_from=${from}&date_to=${to}&viewer_role=Manager`)
      const data = await res.json()
      if (data.success) setSwapCandidateRows(data.rows ?? [])
    } catch {}
  }, [])

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
          requester_id: managerId,
          requester_assignment_id: swapShiftId,
          counterpart_id: swapCounterpartId,
          counterpart_assignment_id: swapCounterpartAssignmentId,
          reason: swapReason || null,
        }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.message)
      setMyReqSuccess('Shift swap request submitted successfully.')
      setSwapFormOpen(false); setSwapShiftId(''); setSwapCounterpartId(''); setSwapCounterpartAssignmentId(''); setSwapReason('')
      void fetchMyRequests(managerId)
    } catch (err) {
      setMyReqError(err instanceof Error ? err.message : 'Failed to submit request')
    } finally { setSwapSubmitting(false) }
  }

  const handleSubmitLeave = async () => {
    setLeaveSubmitting(true); setMyReqError(''); setMyReqSuccess('')
    try {
      const res = await fetch('/api/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'submit_leave_request', company_id: companyId, requester_id: managerId, request_type: leaveType, reason: leaveReason || null, shift_assignment_id: leaveShiftId || null }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.message)
      setMyReqSuccess('Leave request submitted successfully.')
      setLeaveFormOpen(false); setLeaveShiftId(''); setLeaveReason('')
      void fetchMyRequests(managerId)
    } catch (err) {
      setMyReqError(err instanceof Error ? err.message : 'Failed to submit request')
    } finally { setLeaveSubmitting(false) }
  }

  const handleSubmitFixedOff = async () => {
    setFixedSubmitting(true); setMyReqError(''); setMyReqSuccess('')
    try {
      const res = await fetch('/api/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'submit_fixed_off_day', user_id: managerId, company_id: companyId, weekday: fixedWeekday }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.message)
      setMyReqSuccess('Fixed day off request submitted successfully.')
      setFixedFormOpen(false)
      void fetchMyRequests(managerId)
    } catch (err) {
      setMyReqError(err instanceof Error ? err.message : 'Failed to submit request')
    } finally { setFixedSubmitting(false) }
  }

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
    } finally {
      setAttachmentUploading(false)
    }
  }

  const runClockAction = async (shift: MyShift, action: 'clock_in' | 'clock_out' | 'break_in' | 'break_out', extra?: { late_reason?: string; attachment_url?: string | null }) => {
    setClockBusyId(`${shift.assignment.id}:${action}`)
    setClockMessage('')
    try {
      const body: Record<string, unknown> = { action, user_id: managerId, shift_assignment_id: shift.assignment.id }
      if (extra?.late_reason) body.late_reason = extra.late_reason
      if (extra?.attachment_url) body.attachment_url = extra.attachment_url
      const res = await fetch('/api/employee/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.message || 'Attendance action failed')
      await fetchMyShift(managerId)
      const msgs: Record<string, string> = { clock_in: 'Clocked in successfully.', clock_out: 'Clocked out successfully.', break_in: 'Break started.', break_out: 'Break ended.' }
      setClockMessage(msgs[action] ?? 'Done.')
    } catch (err) {
      setClockMessage(err instanceof Error ? err.message : 'Attendance action failed')
    } finally {
      setClockBusyId('')
    }
  }

  const handleLateClockIn = async (shift: MyShift) => {
    if (!lateReason.trim()) { setClockMessage('Please enter a reason for being late.'); return }
    const url = await uploadAttachment()
    await runClockAction(shift, 'clock_in', { late_reason: lateReason.trim(), attachment_url: url })
    setLateFormId(null)
    setLateReason('')
    setAttachmentFile(null)
  }

  const handleAbsence = async (shift: MyShift) => {
    if (!absenceReason.trim()) { setClockMessage('Please enter a reason for absence.'); return }
    const url = await uploadAttachment()
    setClockBusyId(`${shift.assignment.id}:absent`)
    setClockMessage('')
    try {
      const res = await fetch('/api/employee/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'record_absence', user_id: managerId, shift_assignment_id: shift.assignment.id, absence_reason: absenceReason.trim(), attachment_url: url }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.message)
      await fetchMyShift(managerId)
      setClockMessage('Absence reported.')
    } catch (err) {
      setClockMessage(err instanceof Error ? err.message : 'Failed to record absence')
    } finally {
      setClockBusyId('')
      setAbsenceFormId(null)
      setAbsenceReason('')
      setAttachmentFile(null)
    }
  }

  // ── Auth init ──
  useEffect(() => {
    let cancelled = false
    const run = async () => {
      let uid = localStorage.getItem('tasking_user_id')
      if (!uid) {
        const sb = createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
        const { data: { session } } = await sb.auth.getSession()
        if (session?.user?.id) { uid = session.user.id; localStorage.setItem('tasking_user_id', uid) }
      }
      if (!uid) { router.replace('/signin'); return }
      const meRes = await fetch(`/api/user/me?user_id=${uid}`)
      const meData = await meRes.json()
      if (cancelled || !meData.success) return
      const { id, full_name, company_id } = meData.user
      if (id) { setManagerId(id); void fetchMyShift(id); void fetchMyRequests(id) }
      if (full_name) setManagerName(full_name)
      const cid = localStorage.getItem(`tasking_company_id_${uid}`) || company_id || ''
      if (!cid) return
      setCompanyId(cid)
      void fetchSwapCandidates(cid)
      const [compRes, deptRes] = await Promise.all([
        fetch(`/api/company/current?user_id=${uid}&company_id=${cid}`),
        fetch(`/api/manager/departments?manager_id=${id}&company_id=${cid}`),
      ])
      const compData = await compRes.json()
      const deptData = await deptRes.json()
      if (cancelled) return
      if (compData.success) setCompanyName(compData.company?.name ?? '')
      const depts: Department[] = deptData.success
        ? (deptData.departments ?? []).map((d: { department_id: string; department_name: string }) => ({ id: d.department_id, name: d.department_name }))
        : []
      setDepartments(depts)
      if (depts.length > 0) setSelectedDeptId(depts[0].id)
    }
    void run()
    return () => { cancelled = true }
  }, [router, fetchMyShift, fetchMyRequests, fetchSwapCandidates])

  const fetchData = useCallback(async (cid: string, mid: string) => {
    if (!cid) return
    setLoading(true)
    setError('')
    try {
      const [dashRes, toRes, swapRes] = await Promise.all([
        fetch(`/api/attendance?company_id=${cid}`),
        fetch(`/api/attendance?company_id=${cid}&resource=time_off`),
        // manager_id scopes this to Employee<->Employee swaps within departments this manager
        // manages — Manager<->Manager swaps go to the Owner's queue instead, not here.
        fetch(`/api/attendance?company_id=${cid}&resource=shift_swaps&manager_id=${mid}`),
      ])
      const dashData = await dashRes.json()
      const toData   = await toRes.json()
      const swapData = await swapRes.json()
      if (!dashData.success) throw new Error(dashData.message ?? 'Failed to fetch')
      setDashboard(dashData.dashboard)
      if (toData.success)   setTimeOffRequests(toData.requests ?? [])
      if (swapData.success) setSwapRequests(swapData.requests ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch attendance')
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { if (companyId) void fetchData(companyId, managerId) }, [companyId, managerId, fetchData])

  // Filter records by selected department
  const deptRecords = useMemo<AttendanceDashboardRecord[]>(() => {
    if (!dashboard) return []
    if (!selectedDeptId) return dashboard.records
    return dashboard.records.filter(row => row.shift.department_id === selectedDeptId)
  }, [dashboard, selectedDeptId])

  const summary = useMemo(() => {
    const records = deptRecords
    return {
      total:     records.length,
      needs_review: records.filter(r => r.record?.status === 'submitted' && r.record?.owner_status === 'pending').length,
      reviewed:  records.filter(r => r.record?.status === 'manager_reviewed').length,
      approved:  records.filter(r => r.record?.owner_status === 'approved').length,
      late:      records.filter(r => r.exceptions.includes('late')).length,
      absent:    records.filter(r => r.exceptions.includes('absent')).length,
    }
  }, [deptRecords])

  function openReview(row: AttendanceDashboardRecord) {
    setReviewRecord(row)
    setReviewNotes(row.record?.manager_notes ?? '')
    setReviewOpen(true)
  }

  async function handleManagerReview() {
    if (!reviewRecord?.record || !managerId) return
    setActionLoading(true)
    try {
      const res = await fetch('/api/attendance', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'manager_review', id: reviewRecord.record.id, manager_id: managerId, manager_notes: reviewNotes || null }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.message ?? 'Failed to submit review')
      setReviewOpen(false)
      void fetchData(companyId, managerId)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to submit review')
    } finally { setActionLoading(false) }
  }

  async function handleDecideTimeOff(id: string, decision: 'approved' | 'rejected') {
    if (!managerId) return
    setActionLoading(true)
    try {
      const res = await fetch('/api/attendance', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'decide_time_off', id, reviewer_id: managerId, decision }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.message)
      void fetchData(companyId, managerId)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed')
    } finally { setActionLoading(false) }
  }

  async function handleDecideSwap(id: string, decision: 'approved' | 'rejected') {
    if (!managerId) return
    setActionLoading(true)
    try {
      const res = await fetch('/api/attendance', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'decide_shift_swap', id, reviewer_id: managerId, decision }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.message)
      void fetchData(companyId, managerId)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed')
    } finally { setActionLoading(false) }
  }

  const myPendingCount = mySwaps.filter(r => r.status === 'pending').length + myTimeOff.filter(r => r.status === 'pending').length + myFixedOff.filter(r => r.status === 'pending').length

  const tabs: { key: TabKey; label: string; count?: number }[] = [
    { key: 'records', label: 'Attendance Records', count: summary.needs_review > 0 ? summary.needs_review : undefined },
    { key: 'time_off', label: 'Time Off', count: timeOffRequests.filter(r => r.status === 'pending').length || undefined },
    { key: 'swaps', label: 'Shift Swaps', count: swapRequests.filter(r => r.status === 'pending').length || undefined },
    { key: 'my_requests', label: 'My Requests', count: myPendingCount || undefined },
  ]

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: APP_BG, fontFamily: 'inherit' }}>
      <style>{`
        @keyframes fadeSlideUp { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
        .mgr-att-row:hover td { background: #EFF6FF !important; }
      `}</style>
      <ManagerSidebar />
      <main style={{ marginLeft: '64px', flex: 1, minHeight: '100vh', overflowY: 'auto' }}>

        {/* Page header */}
        <div style={{ padding: '20px 28px 16px', flexShrink: 0, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 24 }}>
          <div>
            <h1 className="mb-0 font-heading text-3xl font-bold tracking-tight text-gray-950">
              Attendance
            </h1>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0, paddingTop: 4 }}>
            {managerName && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, height: 36, background: '#fff', border: '1.5px solid #E5E7EB', borderRadius: 999, padding: '0 14px 0 6px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 26, height: 26, borderRadius: 999, background: '#1E3A5F', color: '#FFFFFF', flexShrink: 0 }}>
                  <UserCog size={13} />
                </span>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>{managerName}</span>
              </div>
            )}
            <button onClick={() => void fetchData(companyId, managerId)} disabled={loading || !companyId}
              style={{ height: 34, width: 34, display: 'flex', alignItems: 'center', justifyContent: 'center', background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 9, cursor: 'pointer', color: MUTED }}>
              {loading ? <Spinner /> : <RefreshCw size={14} />}
            </button>
          </div>
        </div>

        <div style={{ padding: '0 28px 40px', display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* My Shift — UC49 Clock In / Clock Out */}
          {myShifts.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {clockMessage && (
                <div style={{ padding: '10px 14px', background: clockMessage.includes('successfully') ? '#ECFDF5' : '#FEF2F2', color: clockMessage.includes('successfully') ? '#047857' : '#B91C1C', borderRadius: 8, fontSize: 13, fontWeight: 600 }}>
                  {clockMessage}
                </div>
              )}
              {myShifts.map(shift => {
                const clockedIn = !!shift.record?.clock_in_time
                const clockedOut = !!shift.record?.clock_out_time
                const clockInWindowOpen = canClockIn(shift.shift)
                const clockOutWindowOpen = canClockOut(shift.shift)
                const shiftStart = new Date(`${shift.shift.shift_date}T${shift.shift.start_time}Z`)
                const isLateNow = Date.now() > shiftStart.getTime() + 10 * 60000
                const onBreak = !!shift.record?.break_in_time && !shift.record?.break_out_time
                const breakDone = !!shift.record?.break_in_time && !!shift.record?.break_out_time
                const isLateForm = lateFormId === shift.assignment.id
                const isAbsenceForm = absenceFormId === shift.assignment.id
                return (
                  <div key={shift.assignment.id} style={{ background: PANEL, borderRadius: 14, padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 10, boxShadow: '0 1px 4px rgba(0,0,0,0.05), 0 0 0 1px rgba(0,0,0,0.04)' }}>
                    {/* Row 1: shift info + main actions */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
                      <div>
                        <p style={{ margin: 0, fontWeight: 700, fontSize: 14, color: TEXT }}>{shift.shift.title || 'My Shift'}</p>
                        <p style={{ margin: '2px 0 0', fontSize: 12.5, color: MUTED }}>
                          {fmtDate(shift.shift.shift_date)} · {fmtTime(shift.shift.start_time)} – {fmtTime(shift.shift.end_time)}
                          {clockedIn && <> · In {fmtTime(shift.record?.clock_in_time)}</>}
                          {onBreak && <> · On break since {fmtTime(shift.record?.break_in_time)}</>}
                          {breakDone && <> · Break {fmtTime(shift.record?.break_in_time)}–{fmtTime(shift.record?.break_out_time)}</>}
                          {clockedOut && <> · Out {fmtTime(shift.record?.clock_out_time)}</>}
                        </p>
                      </div>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
                        {/* Not clocked in yet */}
                        {!clockedIn && clockInWindowOpen && !isLateForm && !isAbsenceForm && (
                          <>
                            <button onClick={() => {
                              if (isLateNow) { setLateFormId(shift.assignment.id); setLateReason('') }
                              else void runClockAction(shift, 'clock_in')
                            }} disabled={!!clockBusyId}
                              style={{ height: 34, padding: '0 14px', borderRadius: 8, border: 'none', background: '#16A34A', color: '#fff', fontWeight: 700, fontSize: 12.5, cursor: clockBusyId ? 'default' : 'pointer' }}>
                              {clockBusyId === `${shift.assignment.id}:clock_in` ? 'Working…' : 'Clock In'}
                            </button>
                            <button onClick={() => { setAbsenceFormId(shift.assignment.id); setAbsenceReason('') }}
                              style={{ height: 34, padding: '0 14px', borderRadius: 8, border: '1.5px solid #EF4444', background: '#FEF2F2', color: '#B91C1C', fontWeight: 700, fontSize: 12.5, cursor: 'pointer' }}>
                              Not Coming In
                            </button>
                          </>
                        )}
                        {!clockedIn && !clockInWindowOpen && (
                          <span style={{ fontSize: 12, color: MUTED, fontStyle: 'italic' }}>Clock In opens 30 min before shift</span>
                        )}
                        {/* Clocked in, not yet out */}
                        {clockedIn && !clockedOut && (
                          <>
                            {!onBreak && !breakDone && (
                              <button onClick={() => runClockAction(shift, 'break_in')} disabled={!!clockBusyId}
                                style={{ height: 34, padding: '0 14px', borderRadius: 8, border: '1.5px solid #D97706', background: '#FFFBEB', color: '#B45309', fontWeight: 700, fontSize: 12.5, cursor: clockBusyId ? 'default' : 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
                                <Coffee size={12} /> Break In
                              </button>
                            )}
                            {onBreak && (
                              <button onClick={() => runClockAction(shift, 'break_out')} disabled={!!clockBusyId}
                                style={{ height: 34, padding: '0 14px', borderRadius: 8, border: '1.5px solid #D97706', background: '#FFF7ED', color: '#B45309', fontWeight: 700, fontSize: 12.5, cursor: clockBusyId ? 'default' : 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
                                <Coffee size={12} /> Break Out
                              </button>
                            )}
                            {clockOutWindowOpen && (
                              <button onClick={() => runClockAction(shift, 'clock_out')} disabled={!!clockBusyId}
                                style={{ height: 34, padding: '0 14px', borderRadius: 8, border: 'none', background: '#334155', color: '#fff', fontWeight: 700, fontSize: 12.5, cursor: clockBusyId ? 'default' : 'pointer' }}>
                                {clockBusyId === `${shift.assignment.id}:clock_out` ? 'Working…' : 'Clock Out'}
                              </button>
                            )}
                            {!clockOutWindowOpen && (
                              <span style={{ fontSize: 12, color: MUTED, fontStyle: 'italic' }}>Clock Out opens at shift end</span>
                            )}
                          </>
                        )}
                        {clockedOut && <span style={{ fontSize: 12, fontWeight: 600, color: '#047857' }}>Completed</span>}
                      </div>
                    </div>

                    {/* Late reason form */}
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
                            style={{ height: 32, padding: '0 14px', borderRadius: 7, border: 'none', background: '#16A34A', color: '#fff', fontWeight: 700, fontSize: 12.5, cursor: 'pointer' }}>
                            {attachmentUploading ? 'Uploading…' : 'Submit & Clock In'}
                          </button>
                          <button onClick={() => { setLateFormId(null); setAttachmentFile(null) }}
                            style={{ height: 32, padding: '0 12px', borderRadius: 7, border: '1.5px solid #D1D5DB', background: '#fff', fontWeight: 600, fontSize: 12.5, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                            <XCircle size={12} /> Cancel
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Absence form */}
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
                            style={{ height: 32, padding: '0 12px', borderRadius: 7, border: '1.5px solid #D1D5DB', background: '#fff', fontWeight: 600, fontSize: 12.5, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                            <XCircle size={12} /> Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {/* Stats + dept filter */}
          <div style={{ display: 'flex', gap: 12, alignItems: 'stretch', flexWrap: 'wrap', animation: 'fadeSlideUp 0.3s ease both' }}>
            <StatCard label="Total Records"   value={summary.total}        icon={<CalendarDays size={14} />} accentBg="#EFF6FF" accentColor={BLUE} />
            <StatCard label="Needs Review"    value={summary.needs_review} icon={<AlertTriangle size={14} />} accentBg="#FFF7ED" accentColor="#C2410C" />
            <StatCard label="Under Review"    value={summary.reviewed}     icon={<Edit3 size={14} />}        accentBg="#EFF6FF" accentColor="#1D4ED8" />
            <StatCard label="Approved"        value={summary.approved}     icon={<Check size={14} />}        accentBg="#ECFDF5" accentColor="#047857" />
            <StatCard label="Late"            value={summary.late}         icon={<Clock size={14} />}        accentBg="#FFF7ED" accentColor="#C2410C" />
            <StatCard label="Absent"          value={summary.absent}       icon={<Users size={14} />}        accentBg="#FEF2F2" accentColor="#B91C1C" />
          </div>

          {/* Tabs + dept filter */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
            <div style={{ display: 'flex', gap: 6 }}>
              {tabs.map(tab => (
                <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                  style={{ height: 36, padding: '0 13px', borderRadius: 9, cursor: 'pointer', fontWeight: 700, fontSize: 12.5, display: 'flex', alignItems: 'center', gap: 6, background: activeTab === tab.key ? '#EFF6FF' : PANEL, border: activeTab === tab.key ? `1.5px solid ${BLUE}44` : `1.5px solid ${BORDER}`, color: activeTab === tab.key ? BLUE : MUTED, transition: 'all 0.15s' }}
                >
                  {tab.label}
                  {tab.count && tab.count > 0 && (
                    <span style={{ minWidth: 18, height: 18, padding: '0 4px', borderRadius: 999, background: '#EF4444', color: '#fff', fontSize: 10, fontWeight: 900, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{tab.count}</span>
                  )}
                </button>
              ))}
            </div>
            {departments.length > 1 && (
              <div style={{ position: 'relative' }}>
                <select value={selectedDeptId} onChange={e => setSelectedDeptId(e.target.value)}
                  style={{ height: 34, padding: '0 26px 0 10px', border: `1px solid ${BORDER}`, borderRadius: 8, background: PANEL, color: TEXT, fontSize: 12, fontWeight: 600, outline: 'none', cursor: 'pointer', appearance: 'none' }}>
                  <option value="">All departments</option>
                  {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
                <ChevronDown size={11} style={{ position: 'absolute', right: 7, top: '50%', transform: 'translateY(-50%)', color: MUTED, pointerEvents: 'none' }} />
              </div>
            )}
          </div>

          {error && (
            <div style={{ padding: '12px 16px', background: '#FEF2F2', border: '1px solid #FECACA', color: '#B91C1C', borderRadius: 10, fontSize: 13, fontWeight: 600 }}>{error}</div>
          )}

          {/* ── Attendance Records tab ── */}
          {activeTab === 'records' && (
            <div style={{ background: PANEL, borderRadius: 16, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.05), 0 0 0 1px rgba(0,0,0,0.04)', animation: 'fadeSlideUp 0.28s ease both 0.05s' }}>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: '#F8FAFC' }}>
                      {['Worker', 'Dept', 'Shift Date', 'Clock In', 'Clock Out', 'Status', 'Exceptions', 'Actions'].map(col => (
                        <th key={col} style={{ padding: '10px 14px', textAlign: col === 'Worker' || col === 'Dept' ? 'left' : 'center', fontSize: 10.5, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: `1px solid ${BORDER}`, whiteSpace: 'nowrap' }}>{col}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr><td colSpan={8} style={{ padding: '36px 20px', textAlign: 'center', color: MUTED }}><Spinner /> Loading…</td></tr>
                    ) : deptRecords.length === 0 ? (
                      <tr>
                        <td colSpan={8} style={{ padding: '48px 20px', textAlign: 'center' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, color: '#9CA3AF' }}>
                            <div style={{ width: 48, height: 48, borderRadius: 14, background: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center', color: BLUE }}><CheckSquare size={20} strokeWidth={1.5} /></div>
                            <p style={{ margin: 0, fontWeight: 600, fontSize: 13 }}>No attendance records</p>
                          </div>
                        </td>
                      </tr>
                    ) : deptRecords.map((row, i) => {
                      const rec = row.record
                      const status = rec?.status ?? 'no record'
                      const needsReview = rec && rec.status === 'submitted' && rec.owner_status === 'pending'
                      return (
                        <tr key={row.assignment.id} className="mgr-att-row" style={{ background: i % 2 === 0 ? PANEL : '#FAFBFC' }}>
                          <td style={{ padding: '12px 14px', borderBottom: `1px solid ${BORDER}` }}>
                            <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: TEXT }}>{row.assignee_name}</p>
                            <p style={{ margin: 0, fontSize: 11, color: MUTED, fontWeight: 500 }}>{row.assignee_role}</p>
                          </td>
                          <td style={{ padding: '12px 14px', borderBottom: `1px solid ${BORDER}`, fontSize: 12.5, color: MUTED, fontWeight: 500 }}>{row.department_name ?? '—'}</td>
                          <td style={{ padding: '12px 14px', borderBottom: `1px solid ${BORDER}`, fontSize: 12.5, color: TEXT, fontWeight: 500, textAlign: 'center', whiteSpace: 'nowrap' }}>{fmtDate(row.shift.shift_date)}</td>
                          <td style={{ padding: '12px 14px', borderBottom: `1px solid ${BORDER}`, fontSize: 12.5, color: TEXT, textAlign: 'center', fontWeight: 500 }}>{fmtTime(rec?.clock_in_time)}</td>
                          <td style={{ padding: '12px 14px', borderBottom: `1px solid ${BORDER}`, fontSize: 12.5, color: TEXT, textAlign: 'center', fontWeight: 500 }}>{fmtTime(rec?.clock_out_time)}</td>
                          <td style={{ padding: '12px 14px', borderBottom: `1px solid ${BORDER}`, textAlign: 'center' }}>{statusChip(status)}</td>
                          <td style={{ padding: '12px 14px', borderBottom: `1px solid ${BORDER}`, textAlign: 'center' }}>
                            <div style={{ display: 'flex', gap: 4, justifyContent: 'center', flexWrap: 'wrap' }}>
                              {row.exceptions.map(ex => (
                                <span key={ex} style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 999, background: ex === 'absent' ? '#FEF2F2' : '#FFF7ED', color: ex === 'absent' ? '#B91C1C' : '#C2410C' }}>{ex}</span>
                              ))}
                              {row.exceptions.length === 0 && <span style={{ fontSize: 11, color: '#CBD5E1' }}>—</span>}
                            </div>
                          </td>
                          <td style={{ padding: '12px 14px', borderBottom: `1px solid ${BORDER}`, textAlign: 'center' }}>
                            {rec && (
                              <button onClick={() => openReview(row)}
                                style={{ height: 30, padding: '0 10px', background: needsReview ? BLUE : '#F1F5F9', color: needsReview ? '#fff' : MUTED, border: 'none', borderRadius: 7, fontSize: 11.5, fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                <Edit3 size={11} /> {needsReview ? 'Review' : 'Notes'}
                              </button>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── Time Off tab ── */}
          {activeTab === 'time_off' && (
            <div style={{ background: PANEL, borderRadius: 16, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.05), 0 0 0 1px rgba(0,0,0,0.04)', animation: 'fadeSlideUp 0.28s ease both' }}>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: '#F8FAFC' }}>
                      {['Requester', 'Type', 'Shift', 'Shift Date', 'Reason', 'Status', 'Actions'].map(col => (
                        <th key={col} style={{ padding: '10px 14px', textAlign: col === 'Requester' ? 'left' : 'center', fontSize: 10.5, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: `1px solid ${BORDER}`, whiteSpace: 'nowrap' }}>{col}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {timeOffRequests.length === 0 ? (
                      <tr><td colSpan={7} style={{ padding: '32px 20px', textAlign: 'center', color: MUTED, fontSize: 13 }}>No time off requests</td></tr>
                    ) : timeOffRequests.map((req, i) => (
                      <tr key={req.id} className="mgr-att-row" style={{ background: i % 2 === 0 ? PANEL : '#FAFBFC' }}>
                        <td style={{ padding: '12px 14px', borderBottom: `1px solid ${BORDER}`, fontSize: 13, fontWeight: 700, color: TEXT }}>{req.requester_name}</td>
                        <td style={{ padding: '12px 14px', borderBottom: `1px solid ${BORDER}`, textAlign: 'center' }}><span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 999, background: '#F1F5F9', color: MUTED }}>{req.request_type}</span></td>
                        <td style={{ padding: '12px 14px', borderBottom: `1px solid ${BORDER}`, fontSize: 12, color: MUTED, textAlign: 'center' }}>{req.shift_title ?? '—'}</td>
                        <td style={{ padding: '12px 14px', borderBottom: `1px solid ${BORDER}`, fontSize: 12, color: MUTED, textAlign: 'center', whiteSpace: 'nowrap' }}>{fmtDate(req.shift_date)}</td>
                        <td style={{ padding: '12px 14px', borderBottom: `1px solid ${BORDER}`, fontSize: 12, color: MUTED, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{req.reason ?? '—'}</td>
                        <td style={{ padding: '12px 14px', borderBottom: `1px solid ${BORDER}`, textAlign: 'center' }}>{statusChip(req.status)}</td>
                        <td style={{ padding: '12px 14px', borderBottom: `1px solid ${BORDER}`, textAlign: 'center' }}>
                          {req.status === 'pending' && (
                            <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                              <button onClick={() => handleDecideTimeOff(req.id, 'approved')} disabled={actionLoading}
                                style={{ height: 28, padding: '0 10px', background: '#ECFDF5', color: '#047857', border: '1px solid #A7F3D0', borderRadius: 7, fontSize: 11.5, fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                                <Check size={11} /> Approve
                              </button>
                              <button onClick={() => handleDecideTimeOff(req.id, 'rejected')} disabled={actionLoading}
                                style={{ height: 28, padding: '0 10px', background: '#FEF2F2', color: '#B91C1C', border: '1px solid #FECACA', borderRadius: 7, fontSize: 11.5, fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                                <X size={11} /> Reject
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── Shift Swaps tab ── */}
          {activeTab === 'swaps' && (
            <div style={{ background: PANEL, borderRadius: 16, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.05), 0 0 0 1px rgba(0,0,0,0.04)', animation: 'fadeSlideUp 0.28s ease both' }}>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: '#F8FAFC' }}>
                      {['Requester', 'Replacement', 'Shift', 'Shift Date', 'Reason', 'Status', 'Actions'].map(col => (
                        <th key={col} style={{ padding: '10px 14px', textAlign: col === 'Requester' ? 'left' : 'center', fontSize: 10.5, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: `1px solid ${BORDER}`, whiteSpace: 'nowrap' }}>{col}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {swapRequests.length === 0 ? (
                      <tr><td colSpan={7} style={{ padding: '32px 20px', textAlign: 'center', color: MUTED, fontSize: 13 }}>No shift swap requests</td></tr>
                    ) : swapRequests.map((req, i) => (
                      <tr key={req.id} className="mgr-att-row" style={{ background: i % 2 === 0 ? PANEL : '#FAFBFC' }}>
                        <td style={{ padding: '12px 14px', borderBottom: `1px solid ${BORDER}`, fontSize: 13, fontWeight: 700, color: TEXT }}>{req.requester_name}</td>
                        <td style={{ padding: '12px 14px', borderBottom: `1px solid ${BORDER}`, fontSize: 12.5, color: MUTED, fontWeight: 500, textAlign: 'center' }}>{req.counterpart_name}</td>
                        <td style={{ padding: '12px 14px', borderBottom: `1px solid ${BORDER}`, fontSize: 12, color: MUTED, textAlign: 'center' }}>{req.requester_shift_title ?? '—'}</td>
                        <td style={{ padding: '12px 14px', borderBottom: `1px solid ${BORDER}`, fontSize: 12, color: MUTED, textAlign: 'center', whiteSpace: 'nowrap' }}>{fmtDate(req.requester_shift_date)}</td>
                        <td style={{ padding: '12px 14px', borderBottom: `1px solid ${BORDER}`, fontSize: 12, color: MUTED, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{req.reason ?? '—'}</td>
                        <td style={{ padding: '12px 14px', borderBottom: `1px solid ${BORDER}`, textAlign: 'center' }}>{statusChip(req.status)}</td>
                        <td style={{ padding: '12px 14px', borderBottom: `1px solid ${BORDER}`, textAlign: 'center' }}>
                          {req.status === 'pending' && (
                            <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                              <button onClick={() => handleDecideSwap(req.id, 'approved')} disabled={actionLoading}
                                style={{ height: 28, padding: '0 10px', background: '#ECFDF5', color: '#047857', border: '1px solid #A7F3D0', borderRadius: 7, fontSize: 11.5, fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                                <Check size={11} /> Approve
                              </button>
                              <button onClick={() => handleDecideSwap(req.id, 'rejected')} disabled={actionLoading}
                                style={{ height: 28, padding: '0 10px', background: '#FEF2F2', color: '#B91C1C', border: '1px solid #FECACA', borderRadius: 7, fontSize: 11.5, fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                                <X size={11} /> Reject
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── My Requests tab ── */}
          {activeTab === 'my_requests' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, animation: 'fadeSlideUp 0.28s ease both' }}>

              {myReqError && <div style={{ padding: '10px 14px', background: '#FEF2F2', border: '1px solid #FECACA', color: '#B91C1C', borderRadius: 8, fontSize: 13, fontWeight: 700 }}>{myReqError}</div>}
              {myReqSuccess && <div style={{ padding: '10px 14px', background: '#ECFDF5', border: '1px solid #A7F3D0', color: '#047857', borderRadius: 8, fontSize: 13, fontWeight: 700 }}>{myReqSuccess}</div>}

              {/* Action buttons */}
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <button onClick={() => { setSwapFormOpen(v => !v); setLeaveFormOpen(false); setFixedFormOpen(false) }}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 7, height: 38, padding: '0 16px', background: swapFormOpen ? '#0F172A' : PANEL, color: swapFormOpen ? '#FFFFFF' : TEXT, border: `1.5px solid ${swapFormOpen ? '#0F172A' : BORDER}`, borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                  <ArrowLeftRight size={14} /> Shift Swap
                </button>
                <button onClick={() => { setLeaveFormOpen(v => !v); setSwapFormOpen(false); setFixedFormOpen(false) }}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 7, height: 38, padding: '0 16px', background: leaveFormOpen ? '#0F172A' : PANEL, color: leaveFormOpen ? '#FFFFFF' : TEXT, border: `1.5px solid ${leaveFormOpen ? '#0F172A' : BORDER}`, borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                  <ShieldCheck size={14} /> Leave Request
                </button>
                <button onClick={() => { setFixedFormOpen(v => !v); setSwapFormOpen(false); setLeaveFormOpen(false) }}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 7, height: 38, padding: '0 16px', background: fixedFormOpen ? '#0F172A' : PANEL, color: fixedFormOpen ? '#FFFFFF' : TEXT, border: `1.5px solid ${fixedFormOpen ? '#0F172A' : BORDER}`, borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                  <Calendar size={14} /> Fixed Day Off
                </button>
                <button onClick={() => void fetchMyRequests(managerId)} disabled={myReqLoading || !managerId}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 38, padding: '0 14px', background: PANEL, color: MUTED, border: `1px solid ${BORDER}`, borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer', marginLeft: 'auto' }}>
                  {myReqLoading ? <Spinner /> : <RefreshCw size={13} />} Refresh
                </button>
              </div>

              {/* Shift Swap form */}
              {swapFormOpen && (
                <div style={{ background: PANEL, border: `1.5px solid #E5E7EB`, borderRadius: 14, padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 13 }}>
                  <p style={{ margin: 0, fontWeight: 800, fontSize: 14, color: TEXT }}>Submit Shift Swap Request</p>
                  {(() => {
                    const todayStr = new Date().toISOString().slice(0, 10)
                    const myDeptIds = new Set(departments.map(d => d.id))
                    const mySwappableShifts = myShifts.filter(s => s.shift.shift_date > todayStr)
                    const colleagueRows = swapCandidateRows.filter(r => r.user_id !== managerId && r.role === 'Manager' && myDeptIds.has(r.department_id))
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
                      style={{ flex: 2, height: 38, background: '#0F172A', border: 'none', borderRadius: 9, fontWeight: 700, fontSize: 13, color: '#FFFFFF', cursor: swapSubmitting ? 'default' : 'pointer', opacity: swapSubmitting || !swapShiftId || !swapCounterpartId || !swapCounterpartAssignmentId ? 0.55 : 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                      {swapSubmitting ? <Spinner light /> : <ArrowLeftRight size={13} />} Submit Swap Request
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
                      style={{ flex: 2, height: 38, background: '#0F172A', border: 'none', borderRadius: 9, fontWeight: 700, fontSize: 13, color: '#FFFFFF', cursor: leaveSubmitting ? 'default' : 'pointer', opacity: leaveSubmitting ? 0.55 : 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                      {leaveSubmitting ? <Spinner light /> : <ShieldCheck size={13} />} Submit Leave Request
                    </button>
                  </div>
                </div>
              )}

              {/* Fixed Day Off form */}
              {fixedFormOpen && (
                <div style={{ background: PANEL, border: `1.5px solid #E5E7EB`, borderRadius: 14, padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 13 }}>
                  <p style={{ margin: 0, fontWeight: 800, fontSize: 14, color: TEXT }}>Request Fixed Day Off</p>
                  <div>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 5 }}>Preferred Day Off</label>
                    <select value={fixedWeekday} onChange={e => setFixedWeekday(Number(e.target.value))}
                      style={{ width: '100%', height: 38, padding: '0 10px', border: `1px solid ${BORDER}`, borderRadius: 8, fontSize: 13, color: TEXT, background: '#F8FAFC', outline: 'none' }}>
                      {WEEKDAY_NAMES.map((d, i) => <option key={i} value={i}>{d}</option>)}
                    </select>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => setFixedFormOpen(false)} style={{ flex: 1, height: 38, background: 'none', border: `1.5px solid ${BORDER}`, borderRadius: 9, fontWeight: 700, fontSize: 13, color: MUTED, cursor: 'pointer' }}>Cancel</button>
                    <button onClick={handleSubmitFixedOff} disabled={fixedSubmitting}
                      style={{ flex: 2, height: 38, background: '#0F172A', border: 'none', borderRadius: 9, fontWeight: 700, fontSize: 13, color: '#FFFFFF', cursor: fixedSubmitting ? 'default' : 'pointer', opacity: fixedSubmitting ? 0.55 : 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                      {fixedSubmitting ? <Spinner light /> : <Calendar size={13} />} Request Fixed Day Off
                    </button>
                  </div>
                </div>
              )}

              {/* History panels */}
              {myReqLoading ? (
                <div style={{ padding: '32px 0', textAlign: 'center', color: MUTED, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}><Spinner /> Loading requests…</div>
              ) : (
                <>
                  {/* Shift Swaps history */}
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
                          <div style={{ fontSize: 11.5, color: MUTED }}>{req.requester_shift_title ?? 'Shift'} · {req.requester_shift_date ?? '—'} · {fmtTime(req.requester_start_time)}–{fmtTime(req.requester_end_time)}</div>
                          {req.reason && <div style={{ fontSize: 11.5, color: '#4B5563', marginTop: 2 }}>{req.reason}</div>}
                        </div>
                        {statusChip(req.status)}
                      </div>
                    ))}
                  </div>

                  {/* Leave Requests history */}
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
                          <div style={{ fontSize: 13, fontWeight: 600, color: TEXT, textTransform: 'capitalize' }}>{req.request_type === 'leave' ? 'Leave' : 'Time Off'}</div>
                          <div style={{ fontSize: 11.5, color: MUTED }}>{req.shift_date ?? '—'}{req.shift_title ? ` · ${req.shift_title}` : ''}</div>
                          {req.reason && <div style={{ fontSize: 11.5, color: '#4B5563', marginTop: 2 }}>{req.reason}</div>}
                        </div>
                        {statusChip(req.status)}
                      </div>
                    ))}
                  </div>

                  {/* Fixed Day Off history */}
                  <div style={{ background: PANEL, borderRadius: 12, overflow: 'hidden', border: `1px solid ${BORDER}` }}>
                    <div style={{ padding: '12px 16px', borderBottom: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Calendar size={14} color="#7C3AED" />
                      <span style={{ fontWeight: 700, fontSize: 13, color: TEXT }}>My Fixed Day Off Requests</span>
                      <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 700, color: MUTED }}>{myFixedOff.length} total</span>
                    </div>
                    {myFixedOff.length === 0 ? (
                      <div style={{ padding: '20px 16px', color: MUTED, fontSize: 13, textAlign: 'center' }}>No fixed day off requests yet.</div>
                    ) : myFixedOff.map((req, i) => (
                      <div key={req.id} style={{ padding: '12px 16px', borderBottom: i < myFixedOff.length - 1 ? `1px solid #F8FAFC` : 'none', display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: TEXT }}>{WEEKDAY_NAMES[req.weekday]}</div>
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

      {/* ── Review Modal ── */}
      {reviewOpen && reviewRecord && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)', backdropFilter: 'blur(4px)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ width: 480, maxWidth: '92vw', background: PANEL, borderRadius: 18, boxShadow: '0 24px 70px rgba(0,0,0,0.18)', overflow: 'hidden', animation: 'fadeSlideUp 0.22s ease both' }}>
            <div style={{ padding: '18px 22px 14px', borderBottom: `1px solid #F0F4F8`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 34, height: 34, borderRadius: 9, background: '#EFF6FF', color: BLUE, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Edit3 size={15} />
                </div>
                <h3 style={{ fontWeight: 800, fontSize: '0.9375rem', color: TEXT, margin: 0 }}>Manager Review</h3>
              </div>
              <button onClick={() => setReviewOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF', display: 'flex', padding: 4 }}><X size={18} /></button>
            </div>

            <div style={{ padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Record info */}
              <div style={{ background: '#F8FAFC', borderRadius: 10, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 12, color: MUTED, fontWeight: 600 }}>Worker</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: TEXT }}>{reviewRecord.assignee_name}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 12, color: MUTED, fontWeight: 600 }}>Shift Date</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: TEXT }}>{fmtDate(reviewRecord.shift.shift_date)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 12, color: MUTED, fontWeight: 600 }}>Clock In</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: TEXT }}>{fmtTime(reviewRecord.record?.clock_in_time)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 12, color: MUTED, fontWeight: 600 }}>Clock Out</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: TEXT }}>{fmtTime(reviewRecord.record?.clock_out_time)}</span>
                </div>
                {reviewRecord.record?.employee_notes && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <span style={{ fontSize: 11.5, color: MUTED, fontWeight: 600 }}>Employee Notes</span>
                    <span style={{ fontSize: 12, fontWeight: 500, color: TEXT }}>{reviewRecord.record.employee_notes}</span>
                  </div>
                )}
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 11.5, fontWeight: 700, color: '#374151', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Manager Notes</label>
                <textarea
                  value={reviewNotes}
                  onChange={e => setReviewNotes(e.target.value)}
                  placeholder="Add notes for this attendance record…"
                  rows={4}
                  style={{ width: '100%', padding: '10px 12px', border: `1px solid ${BORDER}`, borderRadius: 9, fontSize: 13, outline: 'none', boxSizing: 'border-box', resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.55, background: '#FAFBFC', color: TEXT, fontWeight: 500 }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, padding: '0 22px 18px' }}>
              <button onClick={() => setReviewOpen(false)} style={{ flex: 1, height: 40, background: 'none', border: `1.5px solid ${BORDER}`, borderRadius: 10, fontWeight: 700, fontSize: 13, color: MUTED, cursor: 'pointer' }}>
                Cancel
              </button>
              <button onClick={handleManagerReview} disabled={actionLoading}
                style={{ flex: 1, height: 40, background: BLUE, border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 13, color: '#fff', cursor: actionLoading ? 'not-allowed' : 'pointer', opacity: actionLoading ? 0.65 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                {actionLoading ? <><Spinner light /> Submitting…</> : <><Check size={13} /> Submit Review</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
