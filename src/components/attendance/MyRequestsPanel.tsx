'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  ArrowLeftRight, Calendar, Check, ChevronDown, ChevronLeft, ChevronRight, Clock, ClipboardList,
  FileText, Pencil, Plus, Trash2, X,
} from 'lucide-react'
import Spinner from '@/components/Spinner'
import { ModalOverlay, ModalBox, ModalHeader, modalErrorBoxStyle, modalPrimaryButtonStyle, modalDestructiveButtonStyle, modalGhostButtonStyle, modalInputStyle, modalLabelStyle } from '@/components/modal'
import { ShiftSwapRequestView, FixedOffDayRequestView } from '@/types/Attendance'
import { TimelineRow } from '@/types/Timeline'
import { useResourceInvalidation } from '@/components/realtime/RealtimeNotificationsProvider'
import { sgtInstant } from '@/lib/singaporeTime'

// Self-contained "My Requests" surface — submit/track a Manager's or Employee's own Shift Swap
// and Fixed Day Off requests. Extracted out of AttendanceView so it can also be rendered inside
// ShiftsView's Manager-only merged Shift page without duplicating the ~40 pieces of state and the
// deadline/limit/conflict rules that drive it. Fully self-contained: fetches its own data, owns
// its own modals — the parent only needs to place it and forward a couple of toast callbacks.

const PANEL_BORDER = '#E2E8F0'
const DATE_DISPLAY_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function formatShiftHour(time: string): string {
  const [h, m] = time.split(':').map(Number)
  const ampm = h < 12 ? 'am' : 'pm'
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h
  return m === 0 ? `${h12}${ampm}` : `${h12}:${String(m).padStart(2, '0')}${ampm}`
}

function formatShiftDateShort(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00`)
  const weekday = d.toLocaleDateString('en-AU', { weekday: 'short' })
  const day = String(d.getDate()).padStart(2, '0')
  const month = d.toLocaleDateString('en-AU', { month: 'short' })
  return `${weekday}, ${day} ${month}`
}

function formatShortWeekdayDate(value: string | null | undefined): string {
  if (!value) return '—'
  const date = new Date(`${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) return '—'
  const weekday = date.toLocaleDateString('en-GB', { weekday: 'short' })
  return `${weekday} ${String(date.getDate()).padStart(2, '0')} ${DATE_DISPLAY_MONTHS[date.getMonth()]}`
}

function formatTime(value: string | null | undefined): string {
  if (!value) return '-'
  const date = value.includes('T') ? new Date(value) : null
  const [h, m] = date
    ? [date.getHours(), date.getMinutes()]
    : value.split(':').map(Number)
  if (Number.isNaN(h) || Number.isNaN(m)) return value.slice(0, 5)
  const suffix = h < 12 ? 'am' : 'pm'
  const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h
  return m === 0 ? `${hour12}${suffix}` : `${hour12}:${String(m).padStart(2, '0')}${suffix}`
}

function formatCompactAt(iso: string): string {
  const d = new Date(iso)
  const day = String(d.getDate()).padStart(2, '0')
  const month = d.toLocaleDateString([], { month: 'short' })
  const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }).replace(/\s/g, '')
  return `${day} ${month}, ${time}`
}

function formatRelativeTime(value: string | null | undefined): string {
  if (!value) return '—'
  const then = new Date(value).getTime()
  if (Number.isNaN(then)) return '—'
  const diffMs = Date.now() - then
  const minutes = Math.floor(diffMs / 60000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days} day${days === 1 ? '' : 's'} ago`
  const date = new Date(then)
  return `${String(date.getDate()).padStart(2, '0')} ${DATE_DISPLAY_MONTHS[date.getMonth()]}`
}

function fmt(d: Date): string {
  return `${String(d.getDate()).padStart(2, '0')} ${d.toLocaleDateString('en-AU', { month: 'short' })}`
}

function myRequestStatusBadge(status: string): { bg: string; text: string; border: string; label: string } {
  switch (status) {
    case 'approved':  return { bg: '#ECFDF5', text: '#047857', border: '#A7F3D0', label: 'Approved' }
    case 'modified':  return { bg: '#EFF6FF', text: '#1D4ED8', border: '#BFDBFE', label: 'Modified' }
    case 'rejected':  return { bg: '#FEE2E2', text: '#B91C1C', border: '#FCA5A5', label: 'Rejected' }
    case 'pending':   return { bg: '#FFF7ED', text: '#C2410C', border: '#FED7AA', label: 'Pending' }
    case 'withdrawn': return { bg: '#F3F4F6', text: '#4B5563', border: '#E5E7EB', label: 'Withdrawn' }
    case 'expired':   return { bg: '#F3F4F6', text: '#4B5563', border: '#E5E7EB', label: 'Expired' }
    default:          return { bg: '#F3F4F6', text: '#4B5563', border: '#E5E7EB', label: status }
  }
}

const DEADLINE_TIME_OPTIONS: { value: string; label: string }[] = (() => {
  const opts: { value: string; label: string }[] = []
  for (let h = 0; h < 24; h++) {
    for (let m = 0; m < 60; m += 30) {
      const ampm = h < 12 ? 'AM' : 'PM'
      const displayH = h % 12 === 0 ? 12 : h % 12
      opts.push({ value: `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`, label: `${displayH}:${String(m).padStart(2, '0')} ${ampm}` })
    }
  }
  return opts
})()

type MyShiftRecord = { id: string; clock_in_time: string | null; clock_out_time: string | null; status: string }
type MyShift = {
  assignment: { id: string; user_id: string }
  shift: { id: string; title: string | null; shift_date: string; start_time: string; end_time: string; is_open_ended: boolean }
  record: MyShiftRecord | null
}
function compareMyShiftsByDateTime(a: MyShift, b: MyShift): number {
  return a.shift.shift_date.localeCompare(b.shift.shift_date)
    || a.shift.start_time.localeCompare(b.shift.start_time)
    || a.shift.end_time.localeCompare(b.shift.end_time)
    || a.assignment.id.localeCompare(b.assignment.id)
}

function addDays(date: Date, n: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + n)
  return d
}
function toISODate(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}
function computeWeekStartKey(dateKey: string): string {
  const date = new Date(`${dateKey}T00:00:00`)
  const dow = (date.getDay() + 6) % 7
  return toISODate(addDays(date, -dow))
}
// Mirrors attendanceService.resolveActiveSubmissionWeekStart — the week currently open for
// submission shifts forward once its own deadline passes.
function resolveActiveSubmissionWeekStart(deadlineWeekday: number, deadlineTime: string): string {
  const todayKey = new Date().toISOString().slice(0, 10)
  let candidateWeekStart = computeWeekStartKey(todayKey)
  for (;;) {
    const targetWeek = toISODate(addDays(new Date(`${candidateWeekStart}T00:00:00`), 7))
    const offsetFromMonday = (deadlineWeekday + 6) % 7
    const deadlineDate = toISODate(addDays(new Date(`${candidateWeekStart}T00:00:00`), offsetFromMonday))
    const deadlineMoment = new Date(`${deadlineDate}T${deadlineTime}:00`)
    if (Date.now() <= deadlineMoment.getTime()) return targetWeek
    candidateWeekStart = targetWeek
  }
}

// Mirrors Recruitment's RDrop trigger — content-driven height instead of the shared DropdownField's
// fixed 40px, which reads visibly shorter next to this modal's other fields.
function AttendanceRequestDropdown({ value, options, onChange, placeholder, disabled = false }: {
  value: string
  options: { value: string; label: string }[]
  onChange: (v: string) => void
  placeholder?: string
  disabled?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [focused, setFocused] = useState(false)
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0 })
  const triggerRef = useRef<HTMLButtonElement>(null)
  const dropRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const h = (e: MouseEvent) => {
      if (!triggerRef.current?.contains(e.target as Node) && !dropRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [open])

  const selected = options.find(o => o.value === value)
  const canOpen = !disabled && options.length > 0

  const handleOpen = () => {
    if (!canOpen) return
    if (!open && triggerRef.current) {
      const r = triggerRef.current.getBoundingClientRect()
      const DROPDOWN_H = Math.min(options.length * 37 + 8, 208)
      const fitsBelow = r.bottom + DROPDOWN_H + 4 <= window.innerHeight
      setPos({ top: fitsBelow ? r.bottom + 4 : r.top - DROPDOWN_H - 4, left: r.left, width: r.width })
    }
    setOpen(o => !o)
  }

  return (
    <div style={{ position: 'relative' }}>
      <button ref={triggerRef} type="button" disabled={disabled} onClick={handleOpen}
        onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
        style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', border: `1.5px solid ${open || focused ? '#F97316' : '#E5E7EB'}`, borderRadius: 8, background: disabled ? '#F9FAFB' : '#FFFFFF', cursor: canOpen ? 'pointer' : 'default', fontSize: '0.9375rem', color: selected ? '#111827' : '#9CA3AF', fontWeight: 400, outline: 'none', boxSizing: 'border-box', transition: 'border-color 0.15s', fontFamily: "'Inter', system-ui, -apple-system, sans-serif" }}>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {selected?.label ?? placeholder ?? 'Select...'}
        </span>
        <ChevronDown size={13} style={{ color: '#9CA3AF', flexShrink: 0, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
      </button>
      {open && typeof document !== 'undefined' && createPortal(
        <div ref={dropRef} style={{ position: 'fixed', top: pos.top, left: pos.left, width: pos.width, background: '#FFFFFF', border: '1.5px solid #E5E7EB', borderRadius: 10, boxShadow: '0 8px 24px rgba(15,23,42,0.12)', zIndex: 9999, maxHeight: 208, overflowY: 'auto', padding: '4px 0' }}>
          {options.map(opt => {
            const isSel = opt.value === value
            return (
              <button key={opt.value} type="button" onClick={() => { onChange(opt.value); setOpen(false) }}
                style={{ display: 'block', width: '100%', padding: '8px 14px', textAlign: 'left', border: 'none', background: isSel ? '#FFF7ED' : 'transparent', color: isSel ? '#EA580C' : '#374151', fontWeight: isSel ? 700 : 400, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}
                onMouseEnter={e => { if (!isSel) e.currentTarget.style.background = '#F9FAFB' }}
                onMouseLeave={e => { if (!isSel) e.currentTarget.style.background = 'transparent' }}>
                {opt.label}
              </button>
            )
          })}
        </div>,
        document.body
      )}
    </div>
  )
}

export default function MyRequestsPanel({
  companyId, internalUserId, variant, showSuccessToast, showErrorToast, onAttentionCount,
}: {
  companyId: string
  internalUserId: string
  variant: 'manager' | 'employee'
  showSuccessToast: (message: string) => void
  showErrorToast: (message: string) => void
  onAttentionCount?: (count: number) => void
}) {
  const [myReqError, setMyReqError] = useState('')
  const [myReqLoading, setMyReqLoading] = useState(false)
  const [mySwaps, setMySwaps] = useState<ShiftSwapRequestView[]>([])
  const [myFixedOff, setMyFixedOff] = useState<FixedOffDayRequestView[]>([])

  // Read-only deadline/limit config, independently fetched here (never edited from this panel —
  // editing lives in Owner/Partner's Attendance settings, unaffected by this extraction).
  const [deadlineWeekday, setDeadlineWeekday] = useState(2)
  const [deadlineTime, setDeadlineTime] = useState('17:00')
  const [swapMonthlyLimit, setSwapMonthlyLimit] = useState<number | null>(null)
  const [swapDeadlineHours, setSwapDeadlineHours] = useState<number | null>(null)

  const activeSubmissionWeekStart = useMemo(
    () => resolveActiveSubmissionWeekStart(deadlineWeekday, deadlineTime),
    [deadlineWeekday, deadlineTime],
  )
  const myFixedOffForActiveWeek = useMemo(
    () => myFixedOff.filter(req => req.requested_week === activeSubmissionWeekStart && req.source === 'submitted'),
    [activeSubmissionWeekStart, myFixedOff],
  )
  const hasMyFixedOffForActiveWeek = myFixedOffForActiveWeek.length > 0
  const hasPendingMyFixedOffRequest = useMemo(() => myFixedOffForActiveWeek.some(req => req.status === 'pending'), [myFixedOffForActiveWeek])

  const [myReqFilter, setMyReqFilter] = useState<'all' | 'swap' | 'offday'>('all')
  const [myReqDropdownOpen, setMyReqDropdownOpen] = useState(false)
  const myReqDropdownRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!myReqDropdownOpen) return
    const handler = (e: MouseEvent) => {
      if (!myReqDropdownRef.current?.contains(e.target as Node)) setMyReqDropdownOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [myReqDropdownOpen])

  const [selectedMyReqKey, setSelectedMyReqKey] = useState<string | null>(null)
  const [seenMyReqKeys, setSeenMyReqKeys] = useState<Set<string>>(new Set())
  const myReqSeenKey = companyId && internalUserId ? `${variant}_myreq_seen_${companyId}_${internalUserId}` : ''
  useEffect(() => {
    if (!myReqSeenKey) return
    try {
      const raw = localStorage.getItem(myReqSeenKey)
      if (raw) setSeenMyReqKeys(new Set(JSON.parse(raw)))
    } catch {}
  }, [myReqSeenKey])
  const markMyReqSeen = useCallback((key: string) => {
    setSeenMyReqKeys(prev => {
      if (prev.has(key)) return prev
      const next = new Set(prev); next.add(key)
      if (myReqSeenKey) { try { localStorage.setItem(myReqSeenKey, JSON.stringify([...next])) } catch {} }
      return next
    })
  }, [myReqSeenKey])
  const getFixedOffMyReqKey = useCallback((rows: FixedOffDayRequestView[]) => {
    const weekStart = rows[0]?.requested_week ?? ''
    if (!weekStart) return 'offday-unknown'
    const latestDecisionAt = rows
      .filter(req => req.source === 'submitted' && req.status !== 'pending')
      .map(req => req.reviewed_at ?? req.created_at ?? '')
      .filter(Boolean)
      .sort()
      .at(-1)
    return latestDecisionAt ? `offday-${weekStart}-${latestDecisionAt}` : `offday-${weekStart}`
  }, [])

  const fetchMyRequests = useCallback(async (uid: string) => {
    if (!uid) return
    setMyReqLoading(true); setMyReqError('')
    try {
      const res = await fetch(`/api/attendance?resource=my_requests&user_id=${uid}`)
      const data = await res.json()
      if (!data.success) throw new Error(data.message)
      setMySwaps(data.swaps ?? [])
      setMyFixedOff(data.fixed_off ?? [])
    } catch (err) {
      setMyReqError(err instanceof Error ? err.message : 'Failed to load requests')
    } finally { setMyReqLoading(false) }
  }, [])

  const [swapCandidateRows, setSwapCandidateRows] = useState<TimelineRow[]>([])
  const [fixedOffQuota, setFixedOffQuota] = useState(1)
  const [myShifts, setMyShifts] = useState<MyShift[]>([])

  const fetchMyShift = useCallback(async (uid: string) => {
    if (!uid) return
    try {
      const res = await fetch(`/api/employee/attendance?user_id=${uid}&resource=my_shift`)
      const data = await res.json()
      if (data.success) setMyShifts(data.myShift?.shifts ?? [])
    } catch {}
  }, [])

  // Single "Submit Request" modal — choose-then-fill, same pattern as the AI Job Builder wizard's
  // "Choose Job Type" step.
  const [requestModalOpen, setRequestModalOpen] = useState(false)
  const [requestModalStep, setRequestModalStep] = useState<'choose' | 'swap' | 'offday'>('choose')
  const [swapShiftId, setSwapShiftId] = useState('')
  const [swapCounterpartId, setSwapCounterpartId] = useState('')
  const [swapCounterpartAssignmentId, setSwapCounterpartAssignmentId] = useState('')
  const [swapReason, setSwapReason] = useState('')
  const [swapSubmitting, setSwapSubmitting] = useState(false)
  const [swapConflictChecking, setSwapConflictChecking] = useState(false)
  const [swapConflictAssignmentIds, setSwapConflictAssignmentIds] = useState<Set<string>>(new Set())

  const [selectedFixedOffDates, setSelectedFixedOffDates] = useState<string[]>([])
  const [fixedSubmitting, setFixedSubmitting] = useState(false)
  const [editingFixedOffGroup, setEditingFixedOffGroup] = useState<FixedOffDayRequestView[] | null>(null)
  const [editingFixedOffDates, setEditingFixedOffDates] = useState<string[]>([])
  const [editingFixedOffSaving, setEditingFixedOffSaving] = useState(false)
  const [editingFixedOffError, setEditingFixedOffError] = useState('')

  // Deep link (e.g. from a notification): "?submit=offday" opens straight to the Off Day step.
  useEffect(() => {
    const submit = new URLSearchParams(window.location.search).get('submit')
    if (submit === 'offday') {
      setRequestModalStep('offday')
      setRequestModalOpen(true)
    }
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
  // shift — reuses the timeline endpoint rather than a new API just for this picker.
  const fetchSwapCandidates = useCallback(async (cid: string) => {
    if (!cid) return
    try {
      const from = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
      const to = new Date(Date.now() + 31 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
      const candidateRole = variant === 'employee' ? 'Employee' : 'Manager'
      const res = await fetch(`/api/shift?company_id=${cid}&date_from=${from}&date_to=${to}&viewer_role=${candidateRole}`)
      const data = await res.json()
      if (data.success) setSwapCandidateRows(data.rows ?? [])
    } catch {}
  }, [variant])

  // Read-only company config for the modal's subtitles — never written from here.
  const fetchSwapDeadline = useCallback(async (cid: string, uid: string) => {
    if (!cid || !uid) return
    try {
      const res = await fetch(`/api/attendance/shift-swap-settings?company_id=${cid}&owner_id=${uid}`)
      const data = await res.json()
      if (data.success) {
        setSwapDeadlineHours(data.settings.deadline_hours_before_shift ?? null)
        setSwapMonthlyLimit(data.settings.monthly_swap_limit ?? null)
      }
    } catch {}
  }, [])

  const fetchOffDayDeadline = useCallback(async (cid: string, uid: string) => {
    if (!cid || !uid) return
    try {
      const res = await fetch(`/api/attendance/off-day-settings?company_id=${cid}&owner_id=${uid}&resource=deadline`)
      const data = await res.json()
      if (data.success) {
        setDeadlineWeekday(data.deadline?.deadline_weekday ?? 2)
        setDeadlineTime(data.deadline?.deadline_time ?? '17:00')
      }
    } catch {}
  }, [])

  // Own-department scope for the swap-candidate colleague filter — mirrors AttendanceView's
  // scopedDeptRef resolution (Manager reads all their departments; Employee reads their one).
  const scopedDeptRef = useRef<{ ids: Set<string>; names: Set<string> } | null>(null)
  useEffect(() => {
    if (!companyId || !internalUserId) return
    let cancelled = false
    const url = variant === 'manager'
      ? `/api/manager/departments?manager_id=${internalUserId}&company_id=${companyId}`
      : `/api/employee/dashboard?user_id=${internalUserId}`
    fetch(url).then(r => r.json()).then(d => {
      if (cancelled || !d.success) return
      if (variant === 'manager') {
        const rows = d.departments as { department_id: string; department_name: string }[]
        scopedDeptRef.current = { ids: new Set(rows.map(x => x.department_id)), names: new Set(rows.map(x => x.department_name)) }
      } else {
        scopedDeptRef.current = { ids: new Set([d.department_id]), names: new Set([d.department_name]) }
      }
    }).catch(() => {})
    return () => { cancelled = true }
  }, [variant, companyId, internalUserId])

  useEffect(() => {
    if (!companyId || !internalUserId) return
    void fetchFixedOffQuota(companyId, internalUserId)
    void fetchSwapCandidates(companyId)
    void fetchMyRequests(internalUserId)
    void fetchSwapDeadline(companyId, internalUserId)
    void fetchOffDayDeadline(companyId, internalUserId)
    void fetchMyShift(internalUserId)
  }, [companyId, internalUserId, fetchFixedOffQuota, fetchSwapCandidates, fetchMyRequests, fetchSwapDeadline, fetchOffDayDeadline, fetchMyShift])

  useResourceInvalidation(['attendance', 'shifts'], () => {
    if (internalUserId) void fetchMyRequests(internalUserId)
  })

  const getUpcomingWeekDates = useCallback((): string[] => {
    const monday = new Date(`${activeSubmissionWeekStart}T00:00:00`)
    return Array.from({ length: 7 }, (_, index) => {
      const date = new Date(monday)
      date.setDate(monday.getDate() + index)
      const year = date.getFullYear()
      const month = String(date.getMonth() + 1).padStart(2, '0')
      const d = String(date.getDate()).padStart(2, '0')
      return `${year}-${month}-${d}`
    })
  }, [activeSubmissionWeekStart])

  const getWeekDatesFromStart = useCallback((weekStart: string): string[] => {
    const monday = new Date(`${weekStart}T00:00:00`)
    return Array.from({ length: 7 }, (_, index) => {
      const date = new Date(monday)
      date.setDate(monday.getDate() + index)
      const year = date.getFullYear()
      const month = String(date.getMonth() + 1).padStart(2, '0')
      const d = String(date.getDate()).padStart(2, '0')
      return `${year}-${month}-${d}`
    })
  }, [])

  const toggleFixedOffDate = (date: string) => {
    setSelectedFixedOffDates(prev => {
      if (prev.includes(date)) return prev.filter(d => d !== date)
      if (prev.length >= fixedOffQuota) { setMyReqError(`You must select exactly ${fixedOffQuota} day(s).`); return prev }
      return [...prev, date]
    })
  }

  const toggleEditingFixedOffDate = (date: string) => {
    setEditingFixedOffError('')
    setEditingFixedOffDates(prev => {
      if (prev.includes(date)) return prev.filter(d => d !== date)
      if (prev.length >= fixedOffQuota) return [...prev.slice(1), date]
      return [...prev, date]
    })
  }

  const pendingSwapAssignmentIds = useMemo(() => {
    const ids = new Set(swapConflictAssignmentIds)
    mySwaps.forEach(req => {
      if (req.status !== 'pending') return
      ids.add(req.requester_assignment_id)
      ids.add(req.counterpart_assignment_id)
    })
    return ids
  }, [mySwaps, swapConflictAssignmentIds])

  const checkShiftSwapConflict = useCallback(async (assignmentId: string): Promise<boolean> => {
    if (!assignmentId) return false
    if (pendingSwapAssignmentIds.has(assignmentId)) return true
    if (!companyId) return false

    setSwapConflictChecking(true)
    try {
      const res = await fetch(`/api/attendance?company_id=${companyId}&resource=shift_swap_conflict&assignment_id=${assignmentId}`)
      const data = await res.json()
      const hasPending = Boolean(data.success && data.has_pending)
      if (hasPending) {
        setSwapConflictAssignmentIds(prev => {
          const next = new Set(prev)
          next.add(assignmentId)
          return next
        })
      }
      return hasPending
    } catch {
      return false
    } finally {
      setSwapConflictChecking(false)
    }
  }, [companyId, pendingSwapAssignmentIds])

  const handleSwapShiftChange = useCallback(async (assignmentId: string) => {
    setSwapShiftId(assignmentId)
    setSwapCounterpartId('')
    setSwapCounterpartAssignmentId('')
    const hasPending = await checkShiftSwapConflict(assignmentId)
    setMyReqError(hasPending ? 'This shift already has a pending swap request.' : '')
  }, [checkShiftSwapConflict])

  const handleSwapTargetShiftChange = useCallback(async (assignmentId: string) => {
    setSwapCounterpartAssignmentId(assignmentId)
    const hasPending = await checkShiftSwapConflict(assignmentId)
    setMyReqError(hasPending ? "This colleague's shift already has a pending swap request." : '')
  }, [checkShiftSwapConflict])

  const handleSubmitSwap = async () => {
    if (!swapShiftId || !swapCounterpartId || !swapCounterpartAssignmentId) { setMyReqError('Select a shift, a colleague, and their shift.'); return }
    if (pendingSwapAssignmentIds.has(swapShiftId)) { setMyReqError('This shift already has a pending swap request.'); return }
    if (pendingSwapAssignmentIds.has(swapCounterpartAssignmentId)) { setMyReqError("This colleague's shift already has a pending swap request."); return }
    if (!swapReason.trim()) { setMyReqError('Reason is required.'); return }
    setSwapSubmitting(true); setMyReqError('')
    try {
      const res = await fetch('/api/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'submit_shift_swap',
          company_id: companyId,
          requester_id: internalUserId,
          requester_assignment_id: swapShiftId,
          counterpart_id: swapCounterpartId,
          counterpart_assignment_id: swapCounterpartAssignmentId,
          reason: swapReason.trim(),
        }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.message)
      showSuccessToast('Shift swap request submitted.')
      setRequestModalOpen(false); setRequestModalStep('choose')
      setSwapShiftId(''); setSwapCounterpartId(''); setSwapCounterpartAssignmentId(''); setSwapReason('')
      void fetchMyRequests(internalUserId)
    } catch (err) {
      setMyReqError(err instanceof Error ? err.message : 'Failed to submit')
    } finally { setSwapSubmitting(false) }
  }

  // Counterpart accepting/declining a swap someone else invited them into.
  const [respondingSwapId, setRespondingSwapId] = useState<string | null>(null)
  const [withdrawingSwapId, setWithdrawingSwapId] = useState<string | null>(null)
  const [withdrawConfirmSwapId, setWithdrawConfirmSwapId] = useState<string | null>(null)
  const handleRespondSwap = async (id: string, decision: 'approved' | 'rejected') => {
    if (!internalUserId) return
    setRespondingSwapId(id)
    try {
      const res = await fetch('/api/attendance', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'respond_shift_swap', id, counterpart_id: internalUserId, decision }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.message)
      showSuccessToast(decision === 'approved' ? 'Swap accepted — sent for review.' : 'Swap declined.')
      void fetchMyRequests(internalUserId)
    } catch (err) {
      showErrorToast(err instanceof Error ? err.message : 'Failed to respond')
    } finally {
      setRespondingSwapId(null)
    }
  }

  const handleWithdrawSwap = async (id: string) => {
    if (!internalUserId) return
    setWithdrawingSwapId(id)
    try {
      const res = await fetch('/api/attendance', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'withdraw_shift_swap', id, requester_id: internalUserId }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.message)
      showSuccessToast('Shift swap request deleted.')
      setWithdrawConfirmSwapId(null)
      setSelectedMyReqKey(null)
      void fetchMyRequests(internalUserId)
    } catch (err) {
      showErrorToast(err instanceof Error ? err.message : 'Failed to delete request')
    } finally {
      setWithdrawingSwapId(null)
    }
  }

  const handleSubmitFixedOff = async () => {
    if (hasMyFixedOffForActiveWeek) {
      setMyReqError(hasPendingMyFixedOffRequest
        ? 'You already submitted an Off Day request for the currently open week.'
        : 'This open week has already been reviewed and cannot be submitted again.')
      return
    }
    if (selectedFixedOffDates.length !== fixedOffQuota) { setMyReqError(`Select exactly ${fixedOffQuota} day(s).`); return }
    setFixedSubmitting(true); setMyReqError('')
    try {
      const res = await fetch('/api/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'submit_fixed_off_day', user_id: internalUserId, company_id: companyId, dates: selectedFixedOffDates }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.message)
      showSuccessToast('Weekly day off request submitted.')
      setRequestModalOpen(false); setRequestModalStep('choose')
      setSelectedFixedOffDates([])
      void fetchMyRequests(internalUserId)
    } catch (err) {
      setMyReqError(err instanceof Error ? err.message : 'Failed to submit')
    } finally { setFixedSubmitting(false) }
  }

  const openEditFixedOff = (group: FixedOffDayRequestView[]) => {
    const sorted = [...group].sort((a, b) => a.requested_date.localeCompare(b.requested_date))
    setEditingFixedOffGroup(sorted)
    setEditingFixedOffDates(sorted.map(r => r.requested_date))
    setEditingFixedOffError('')
  }

  const closeEditFixedOff = () => {
    if (editingFixedOffSaving) return
    setEditingFixedOffGroup(null)
    setEditingFixedOffDates([])
    setEditingFixedOffError('')
  }

  const handleEditFixedOff = async () => {
    if (!editingFixedOffGroup || !internalUserId || !companyId) return
    if (editingFixedOffDates.length !== fixedOffQuota) {
      setEditingFixedOffError(`Select exactly ${fixedOffQuota} day(s).`)
      return
    }
    setEditingFixedOffSaving(true); setEditingFixedOffError('')
    try {
      const weekStart = editingFixedOffGroup[0].requested_week
      const res = await fetch('/api/attendance', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'edit_fixed_off_day',
          user_id: internalUserId,
          company_id: companyId,
          requested_week: weekStart,
          dates: [...editingFixedOffDates].sort(),
        }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.message)
      showSuccessToast('Off Day request updated.')
      setEditingFixedOffGroup(null)
      setEditingFixedOffDates([])
      setSelectedMyReqKey(`offday-${weekStart}`)
      void fetchMyRequests(internalUserId)
    } catch (err) {
      setEditingFixedOffError(err instanceof Error ? err.message : 'Failed to update request')
    } finally {
      setEditingFixedOffSaving(false)
    }
  }

  // ── Attention count (unseen/needs-response items) — reported up for tab/sidebar dots ──
  const mySwapResponseCount = mySwaps.filter(s => s.counterpart_id === internalUserId && s.counterpart_status === 'pending' && s.status === 'pending').length
  const mySwapRequesterUpdateCount = mySwaps.filter(s => s.requester_id === internalUserId && s.counterpart_status !== 'pending' && !seenMyReqKeys.has(`swap-${s.id}`)).length
  const myFixedOffUpdateCount = (() => {
    const groupsByWeek = new Map<string, FixedOffDayRequestView[]>()
    myFixedOff.forEach(req => {
      if (req.source !== 'submitted' || req.status === 'pending') return
      const group = groupsByWeek.get(req.requested_week) ?? []
      group.push(req)
      groupsByWeek.set(req.requested_week, group)
    })
    let count = 0
    groupsByWeek.forEach(group => {
      if (!seenMyReqKeys.has(getFixedOffMyReqKey(group))) count += 1
    })
    return count
  })()
  const myRequestAttentionCount = mySwapResponseCount + mySwapRequesterUpdateCount + myFixedOffUpdateCount
  useEffect(() => {
    onAttentionCount?.(myRequestAttentionCount)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myRequestAttentionCount])

  type MyReqItem = { key: string; kind: 'swap' | 'offday'; status: string; createdAt: string; swap?: ShiftSwapRequestView; offdayGroup?: FixedOffDayRequestView[]; needsResponse: boolean }
  // Shared with the card render below (isUnseen/showActionDot) so the sort order always matches
  // whichever red dot the card actually shows — a card with any dot belongs before one without.
  const myReqDotState = (i: MyReqItem): { isUnseen: boolean; showActionDot: boolean } => {
    const iRespondedToThisSwap = i.kind === 'swap' && i.swap?.counterpart_id === internalUserId && i.swap.counterpart_status !== 'pending'
    const counterpartRespondedToMySwap = i.kind === 'swap' && i.swap?.requester_id === internalUserId && i.swap.counterpart_status !== 'pending'
    const isUnseen = i.needsResponse || (!iRespondedToThisSwap && i.status !== 'pending' && !seenMyReqKeys.has(i.key))
    const showActionDot = i.needsResponse || (counterpartRespondedToMySwap && !seenMyReqKeys.has(i.key)) || (i.kind === 'offday' && i.status !== 'pending' && !seenMyReqKeys.has(i.key))
    return { isUnseen, showActionDot }
  }
  const offdayGroupsByWeek = new Map<string, FixedOffDayRequestView[]>()
  for (const f of myFixedOff) {
    const list = offdayGroupsByWeek.get(f.requested_week) ?? []
    list.push(f)
    offdayGroupsByWeek.set(f.requested_week, list)
  }
  for (const list of offdayGroupsByWeek.values()) list.sort((a, b) => a.requested_date.localeCompare(b.requested_date))
  const items: MyReqItem[] = [
    ...mySwaps.map((s): MyReqItem => ({
      key: `swap-${s.id}`, kind: 'swap', status: s.status, createdAt: s.created_at, swap: s,
      needsResponse: s.counterpart_id === internalUserId && s.counterpart_status === 'pending' && s.status === 'pending',
    })),
    ...[...offdayGroupsByWeek.entries()].map(([weekStart, group]): MyReqItem => ({
      key: getFixedOffMyReqKey(group), kind: 'offday',
      status: group[0].status,
      createdAt: group.reduce((earliest, f) => f.created_at < earliest ? f.created_at : earliest, group[0].created_at),
      offdayGroup: group, needsResponse: false,
    })),
  ].sort((a, b) => {
    const aDotState = myReqDotState(a)
    const bDotState = myReqDotState(b)
    const aDot = Number(aDotState.isUnseen || aDotState.showActionDot)
    const bDot = Number(bDotState.isUnseen || bDotState.showActionDot)
    return (bDot - aDot) || (new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  })

  const filteredItems = items.filter(i => {
    if (myReqFilter === 'swap') return i.kind === 'swap'
    if (myReqFilter === 'offday') return i.kind === 'offday'
    return true
  })
  const selected = items.find(i => i.key === selectedMyReqKey) ?? filteredItems[0] ?? null

  const isMeRequester = (s: ShiftSwapRequestView) => s.requester_id === internalUserId
  const cardTitle = (i: MyReqItem): string => {
    if (i.kind === 'swap') {
      const s = i.swap!
      const iAmRequester = isMeRequester(s)
      const otherName = iAmRequester ? s.counterpart_name : s.requester_name
      return iAmRequester ? `Shift swap with ${otherName}` : `Swap request from ${otherName}`
    }
    const group = i.offdayGroup!
    const weekStartDate = new Date(`${group[0].requested_week}T00:00:00`)
    const weekEndDate = new Date(weekStartDate); weekEndDate.setDate(weekEndDate.getDate() + 6)
    return `Week of ${fmt(weekStartDate)} - ${fmt(weekEndDate)}`
  }
  const detailTitle = (i: MyReqItem | null): string => {
    if (!i) return 'Request Detail'
    if (i.kind === 'swap') {
      const s = i.swap!
      const iAmRequester = isMeRequester(s)
      const otherName = iAmRequester ? s.counterpart_name : s.requester_name
      return iAmRequester ? `Shift Swap Request Detail with ${otherName}` : `Shift Swap Request Detail from ${otherName}`
    }
    return `Off Day Request Detail of ${cardTitle(i)}`
  }
  const cardBadge = (i: MyReqItem) => {
    if (i.needsResponse) return { bg: '#EFF6FF', text: '#1D4ED8', border: '#BFDBFE', label: 'Response Needed' }
    if (i.kind === 'swap') {
      const s = i.swap!
      if (s.status === 'pending' && s.counterpart_status === 'pending') {
        return { bg: '#FFFBEB', text: '#B45309', border: '#FDE68A', label: 'Awaiting' }
      }
      if (s.status === 'rejected' && s.counterpart_status === 'rejected' && !s.owner_review_reason) {
        return { bg: '#F3F4F6', text: '#4B5563', border: '#E5E7EB', label: 'Closed' }
      }
    }
    return myRequestStatusBadge(i.status)
  }

  const avatarInitial = (name: string) => name.trim().charAt(0).toUpperCase() || '?'
  const selectedBadge = selected ? cardBadge(selected) : null
  const selectedHeaderBadge = selected?.kind === 'offday' ? null : selected && selectedBadge && selected.kind === 'swap' && !selected.needsResponse
    && selected.swap!.status === 'pending' && selected.swap!.counterpart_status === 'pending'
    ? { ...selectedBadge, label: `Awaiting ${selected.swap!.counterpart_name}'s Response` }
    : selected?.needsResponse && selectedBadge
      ? { ...selectedBadge, label: 'Response Needed From You' }
    : selectedBadge
  const selectedCanWithdrawSwap = selected?.kind === 'swap' && !!selected.swap && selected.swap.requester_id === internalUserId && selected.swap.status !== 'approved'
  const selectedWithdrawingSwap = selectedCanWithdrawSwap && withdrawingSwapId === selected.swap?.id
  const selectedCanEditFixedOff = selected?.kind === 'offday'
    && !!selected.offdayGroup?.length
    && selected.offdayGroup.every(req => req.source === 'submitted' && req.status === 'pending')
    && selected.offdayGroup[0].requested_week === activeSubmissionWeekStart
  const MYREQ_HEADER_HEIGHT = 64
  const filterLabel = myReqFilter === 'swap' ? 'Shift Swap Requests' : myReqFilter === 'offday' ? 'Off Day Requests' : 'My Requests'

  // ── Submit Request modal derived state ──
  const todayStr = new Date().toISOString().slice(0, 10)
  const mySwappableShifts = myShifts.filter(s => s.shift.shift_date > todayStr).sort(compareMyShiftsByDateTime)
  const candidateColleagueRole = variant === 'employee' ? 'Employee' : 'Manager'
  const colleagueRows = swapCandidateRows.filter(r => r.user_id !== internalUserId && r.role === candidateColleagueRole && (scopedDeptRef.current?.ids.has(r.department_id) ?? false))
  const selectedColleague = colleagueRows.find(r => r.user_id === swapCounterpartId)
  const colleagueShifts = (selectedColleague?.shifts ?? []).filter(s => s.shift_date > todayStr && s.assignment_id)
  const resetRequestForms = () => {
    setSwapShiftId(''); setSwapCounterpartId(''); setSwapCounterpartAssignmentId(''); setSwapReason('')
    setSelectedFixedOffDates([])
  }
  const closeRequestModal = () => { setRequestModalOpen(false); setRequestModalStep('choose'); setMyReqError(''); resetRequestForms() }
  const modalTitle = requestModalStep === 'choose' ? 'Submit Request'
    : requestModalStep === 'swap' ? 'Submit Shift Swap Request' : 'Submit Off Day Request'
  const modalIcon = requestModalStep === 'offday' ? <Calendar size={15} color="#fff" strokeWidth={2.5} /> : <ArrowLeftRight size={15} color="#fff" strokeWidth={2.5} />
  const swapDeadlineSubtitle = swapDeadlineHours != null
    ? `Submit at least ${swapDeadlineHours} hour${swapDeadlineHours === 1 ? '' : 's'} before your shift.`
    : 'No swap deadline configured.'
  const offDayWeekdayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][deadlineWeekday]
  const offDayTimeLabel = DEADLINE_TIME_OPTIONS.find(o => o.value === deadlineTime)?.label ?? deadlineTime
  const offDaySubtitle = hasMyFixedOffForActiveWeek
    ? hasPendingMyFixedOffRequest
      ? 'Already submitted.'
      : 'This open week has already been reviewed.'
    : `Submit before every ${offDayWeekdayName} ${offDayTimeLabel}.`
  const selectedOwnShift = mySwappableShifts.find(s => s.assignment.id === swapShiftId)?.shift
  const selectedTargetShift = colleagueShifts.find(s => s.assignment_id === swapCounterpartAssignmentId)
  const selectedOwnShiftHasPending = !!swapShiftId && pendingSwapAssignmentIds.has(swapShiftId)
  const selectedTargetShiftHasPending = !!swapCounterpartAssignmentId && pendingSwapAssignmentIds.has(swapCounterpartAssignmentId)
  const swapHasConflict = selectedOwnShiftHasPending || selectedTargetShiftHasPending || swapConflictChecking
  const ruleCheckReady = requestModalStep === 'swap' && !!selectedOwnShift && !!selectedTargetShift
  let swapsLeftPreview: number | null = null
  let swapLimitExceeded: boolean | null = null
  let swapDeadlineExceeded: boolean | null = null
  if (ruleCheckReady) {
    if (swapMonthlyLimit != null) {
      const now = new Date()
      const monthStart = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)
      const monthEnd = Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)
      const usedThisMonth = mySwaps.filter(s => {
        if (s.status !== 'approved' || !s.reviewed_at) return false
        const t = new Date(s.reviewed_at).getTime()
        return t >= monthStart && t < monthEnd
      }).length
      swapsLeftPreview = Math.max(0, swapMonthlyLimit - usedThisMonth)
      swapLimitExceeded = swapsLeftPreview <= 0
    }
    if (swapDeadlineHours != null) {
      const combineDateTime = (date: string, time: string) => sgtInstant(date, time).getTime()
      const earliestStart = Math.min(
        combineDateTime(selectedOwnShift!.shift_date, selectedOwnShift!.start_time),
        combineDateTime(selectedTargetShift!.shift_date, selectedTargetShift!.start_time),
      )
      swapDeadlineExceeded = Date.now() > earliestStart - swapDeadlineHours * 3_600_000
    }
  }

  return (
    <>
      <div style={{ padding: 0, boxSizing: 'border-box', height: '100%', minHeight: 0, overflow: 'hidden', display: 'grid', gridTemplateColumns: 'minmax(340px, 390px) minmax(0, 1fr)', gap: 16 }}>
        {/* LEFT: My Requests list */}
        <section style={{ height: '100%', minHeight: 0, background: '#FFFFFF', border: `1px solid ${PANEL_BORDER}`, borderRadius: 14, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <div style={{ height: MYREQ_HEADER_HEIGHT, padding: '0 18px', boxSizing: 'border-box', borderBottom: `1px solid ${PANEL_BORDER}`, display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            <div style={{ width: 30, height: 30, borderRadius: 9, background: '#FFF7ED', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <FileText size={15} style={{ color: '#F97316' }} />
            </div>
            <div ref={myReqDropdownRef} style={{ position: 'relative', minWidth: 0 }}>
              <button type="button" onClick={() => setMyReqDropdownOpen(o => !o)}
                style={{ display: 'flex', alignItems: 'center', gap: 6, border: 'none', background: 'transparent', padding: 0, cursor: 'pointer' }}>
                <span style={{ fontSize: 18, fontWeight: 700, color: '#0F172A', letterSpacing: '-0.2px', lineHeight: 1.2, whiteSpace: 'nowrap' }}>{filterLabel}</span>
                <ChevronDown size={15} style={{ color: '#9CA3AF', flexShrink: 0, transform: myReqDropdownOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
              </button>
              {myReqDropdownOpen && (
                <div style={{ position: 'absolute', top: 'calc(100% + 8px)', left: 0, minWidth: 140, background: '#FFFFFF', border: '1.5px solid #E5E7EB', borderRadius: 10, boxShadow: '0 8px 24px rgba(15,23,42,0.12)', zIndex: 50, padding: '4px 0', overflow: 'hidden' }}>
                  {([
                    { key: 'all' as const, label: 'All Requests' },
                    { key: 'swap' as const, label: 'Shift Swap' },
                    { key: 'offday' as const, label: 'Off Day' },
                  ]).map(f => {
                    const active = myReqFilter === f.key
                    return (
                      <button key={f.key} type="button"
                        onClick={() => { setMyReqFilter(f.key); setMyReqDropdownOpen(false) }}
                        style={{ display: 'block', width: '100%', padding: '8px 14px', textAlign: 'left', border: 'none', background: active ? '#FFF7ED' : 'transparent', color: active ? '#EA580C' : '#374151', fontWeight: active ? 700 : 500, fontSize: 13, cursor: 'pointer' }}
                        onMouseEnter={e => { if (!active) e.currentTarget.style.background = '#F9FAFB' }}
                        onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent' }}
                      >
                        {f.label}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
            <button onClick={() => { setRequestModalStep('choose'); setMyReqError(''); setRequestModalOpen(true) }}
              style={{ marginLeft: 'auto', height: 32, padding: '0 12px', borderRadius: 8, border: '1.5px solid transparent', background: 'linear-gradient(135deg, #F97316, #EA580C)', color: '#FFFFFF', fontWeight: 700, fontSize: 12.5, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0, whiteSpace: 'nowrap' }}>
              <Plus size={12} /> Submit
            </button>
          </div>
          <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {myReqLoading ? (
              <div style={{ padding: '24px 0', textAlign: 'center', color: '#9CA3AF', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}><Spinner size={13} dark /> Loading…</div>
            ) : filteredItems.length === 0 ? (
              <div style={{ padding: '24px 12px', textAlign: 'center', color: '#9CA3AF', fontSize: 13 }}>No requests yet.</div>
            ) : filteredItems.map(i => {
              const badge = cardBadge(i)
              const isSelected = selected?.key === i.key
              const { isUnseen, showActionDot } = myReqDotState(i)
              const selectRequest = () => { setSelectedMyReqKey(i.key); markMyReqSeen(i.key) }
              return (
                <div key={i.key} style={{ position: 'relative' }}>
                  {showActionDot && (
                    <span
                      title="Response needed"
                      style={{ position: 'absolute', left: -6, top: '50%', marginTop: -5, width: 10, height: 10, borderRadius: '50%', background: '#EF4444', boxShadow: '0 0 0 2px #FFFFFF, 0 1px 3px rgba(0,0,0,0.15)', zIndex: 1 }}
                    />
                  )}
                  <div role="button" tabIndex={0}
                    onClick={selectRequest}
                    onKeyDown={e => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        selectRequest()
                      }
                    }}
                    style={{
                      textAlign: 'left', padding: '16px 16px 18px', borderRadius: 10, cursor: 'pointer',
                      marginLeft: showActionDot ? 18 : 0,
                      border: `1px solid ${isSelected ? '#F97316' : i.needsResponse ? '#93C5FD' : '#E5E7EB'}`,
                      background: '#F9FAFB',
                      display: 'flex', flexDirection: 'column', gap: 10, position: 'relative',
                    }}>
                    {isUnseen && !showActionDot && <span style={{ position: 'absolute', left: -6, top: 14, width: 8, height: 8, borderRadius: '50%', background: '#EF4444', boxShadow: '0 0 0 2px #FFFFFF' }} />}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 99, fontSize: '0.72rem', fontWeight: 600, whiteSpace: 'nowrap', flexShrink: 0, ...(i.kind === 'swap' ? { background: '#FFF7ED', color: '#C2410C', border: '1px solid #FED7AA' } : { background: '#F5F3FF', color: '#7C3AED', border: '1px solid #DDD6FE' }) }}>
                        {i.kind === 'swap' ? <ArrowLeftRight size={11} /> : <Calendar size={11} />} {i.kind === 'swap' ? 'Shift Swap' : 'Off Day'}
                      </span>
                      <span style={{ display: 'inline-flex', alignItems: 'center', padding: '3px 10px', borderRadius: 99, fontSize: '0.72rem', fontWeight: 700, background: badge.bg, color: badge.text, border: `1px solid ${badge.border}`, whiteSpace: 'nowrap', flexShrink: 0 }}>{badge.label}</span>
                    </div>
                    <div style={{ fontSize: '0.9375rem', fontWeight: 700, color: '#0F172A' }}>{cardTitle(i)}</div>
                    <div style={{ fontSize: '0.75rem', color: '#9CA3AF', textAlign: 'right' }}>Submitted {formatRelativeTime(i.createdAt)}</div>
                  </div>
                </div>
              )
            })}
          </div>
        </section>

        {/* RIGHT: Detail */}
        <section style={{ height: '100%', minHeight: 0, background: '#FFFFFF', border: `1px solid ${PANEL_BORDER}`, borderRadius: 14, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <div style={{ height: MYREQ_HEADER_HEIGHT, padding: '0 18px', boxSizing: 'border-box', borderBottom: `1px solid ${PANEL_BORDER}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
              <div style={{ width: 30, height: 30, borderRadius: 9, background: '#FFF7ED', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                {!selected ? <FileText size={15} style={{ color: '#F97316' }} /> : selected.kind === 'swap' ? <ArrowLeftRight size={15} style={{ color: '#F97316' }} /> : <Calendar size={15} style={{ color: '#F97316' }} />}
              </div>
              <span style={{ fontSize: 18, fontWeight: 700, color: '#0F172A', letterSpacing: '-0.2px', lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {detailTitle(selected)}
              </span>
              {selectedHeaderBadge && (
                <span style={{ display: 'inline-flex', alignItems: 'center', height: 24, padding: '0 10px', borderRadius: 999, fontSize: 12, fontWeight: 700, background: selectedHeaderBadge.bg, color: selectedHeaderBadge.text, flexShrink: 0, whiteSpace: 'nowrap' }}>{selectedHeaderBadge.label}</span>
              )}
            </div>
          </div>
          <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '20px 22px' }}>
            {!selected ? (
              <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, color: '#9CA3AF' }}>
                <FileText size={22} strokeWidth={1.5} />
                <span style={{ fontSize: 13, fontWeight: 600 }}>Select a request to see details</span>
              </div>
            ) : selected.kind === 'swap' ? (() => {
                const s = selected.swap!
                const iAmRequester = isMeRequester(s)
                const needsMyResponse = selected.needsResponse
                const responding = respondingSwapId === s.id
                const counterpartRejected = s.counterpart_status === 'rejected'
                const counterpartAccepted = s.counterpart_status === 'approved'
                const ownerRejected = s.status === 'rejected' && !!s.owner_review_reason
                const otherName = iAmRequester ? s.counterpart_name : s.requester_name
                const activeStage: 'sent' | 'response' | 'review' = counterpartAccepted || s.status === 'approved' || s.owner_review_reason ? 'review' : counterpartRejected || s.counterpart_status === 'pending' ? 'response' : 'sent'
                type StageState = 'done' | 'active' | 'blocked' | 'upcoming'
                const submittedAt = new Date(s.created_at).toLocaleString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true })
                const stageState = (key: 'sent' | 'response' | 'review'): StageState => {
                  if (key === 'sent') return activeStage === 'sent' ? 'active' : 'done'
                  if (key === 'response') {
                    if (counterpartRejected) return 'blocked'
                    if (counterpartAccepted) return 'done'
                    return activeStage === 'response' ? 'active' : 'upcoming'
                  }
                  if (counterpartRejected) return 'blocked'
                  if (s.status === 'approved') return 'done'
                  if (s.owner_review_reason) return 'blocked'
                  return activeStage === 'review' ? 'active' : 'upcoming'
                }
                const completedText = (key: 'sent' | 'response' | 'review') => {
                  if (key === 'sent') return iAmRequester ? `You sent this request on ${submittedAt}.` : `${s.requester_name} sent this request on ${submittedAt}.`
                  if (key === 'response') return `${s.counterpart_name} accepted the swap.`
                  if (key === 'review') return s.status === 'approved' ? 'Owner/Partner approved this swap.' : 'This step is complete.'
                  return ''
                }
                const swapPerson = (
                  name: string,
                  photoUrl: string | null,
                  date: string | null,
                  start: string | null,
                  end: string | null,
                  tone: 'orange' | 'blue',
                ) => (
                  <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
                    {photoUrl ? (
                      <img src={photoUrl} alt="" style={{ width: 78, height: 78, borderRadius: 999, objectFit: 'cover', display: 'block', marginBottom: 12, border: '1px solid #E5E7EB' }} />
                    ) : (
                      <div style={{ width: 78, height: 78, borderRadius: 999, background: tone === 'orange' ? '#F97316' : '#3B82F6', color: '#FFFFFF', fontSize: 25, fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>{name === 'You' ? 'Y' : avatarInitial(name)}</div>
                    )}
                    <div style={{ maxWidth: '100%', fontSize: 16, fontWeight: 900, color: '#111827', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</div>
                    <div style={{ marginTop: 5, fontSize: 12.5, fontWeight: 800, color: '#334155' }}>{formatShortWeekdayDate(date)}</div>
                    <div style={{ marginTop: 2, fontSize: 12.5, fontWeight: 800, color: '#334155' }}>{formatTime(start)} – {formatTime(end)}</div>
                  </div>
                )
                const requestCard = (
                  <div style={{ padding: '42px 16px 18px', borderRadius: 12, border: '1px solid #E5E7EB', background: '#FFFFFF', boxShadow: '0 8px 20px rgba(15,23,42,0.05)', display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 34px minmax(0, 1fr)', gap: 12, alignItems: 'start' }}>
                      {swapPerson(iAmRequester ? 'You' : s.requester_name, s.requester_photo_url, s.requester_shift_date, s.requester_start_time, s.requester_end_time, 'orange')}
                      <div style={{ width: 46, height: 46, borderRadius: 999, background: '#FFF7ED', color: '#F97316', border: '1px solid #FED7AA', display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 38, justifySelf: 'center' }}>
                        <ArrowLeftRight size={22} />
                      </div>
                      {swapPerson(iAmRequester ? s.counterpart_name : 'You', s.counterpart_photo_url, s.counterpart_shift_date, s.counterpart_start_time, s.counterpart_end_time, 'blue')}
                    </div>
                    {s.reason && (
                      <div style={{ paddingTop: 2 }}>
                        <div style={{ fontSize: '0.875rem', fontWeight: 800, color: '#374151' }}>Reason</div>
                        <div style={{ marginTop: 6, fontSize: 15.5, color: '#111827', lineHeight: 1.45 }}>{s.reason}</div>
                        {counterpartRejected && (
                          <div style={{ marginTop: 12 }}>
                            <div style={{ fontSize: '0.875rem', fontWeight: 800, color: '#374151' }}>Declined</div>
                            <div style={{ marginTop: 6, fontSize: 15.5, color: '#111827', lineHeight: 1.45 }}>{formatCompactAt(s.counterpart_reviewed_at ?? s.updated_at)}</div>
                          </div>
                        )}
                      </div>
                    )}
                    {needsMyResponse && (
                      <div style={{ display: 'flex', gap: 10, paddingTop: 2, justifyContent: 'center', flexWrap: 'wrap' }}>
                        <button type="button" disabled={responding} onClick={() => handleRespondSwap(s.id, 'approved')}
                          style={{ minWidth: 132, height: 34, padding: '0 20px', border: '1.5px solid #A7F3D0', borderRadius: 999, background: '#ECFDF5', color: '#047857', fontWeight: 800, fontSize: 13, cursor: responding ? 'default' : 'pointer', opacity: responding ? 0.6 : 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}>
                          <Check size={14} strokeWidth={2.6} /> Accept
                        </button>
                        <button type="button" disabled={responding} onClick={() => handleRespondSwap(s.id, 'rejected')}
                          style={{ minWidth: 132, height: 34, padding: '0 20px', border: '1.5px solid #FECACA', borderRadius: 999, background: '#FEF2F2', color: '#B91C1C', fontWeight: 800, fontSize: 13, cursor: responding ? 'default' : 'pointer', opacity: responding ? 0.6 : 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}>
                          <X size={14} strokeWidth={2.6} /> Decline
                        </button>
                      </div>
                    )}
                  </div>
                )
                const stageBlock = (
                  key: 'sent' | 'response' | 'review',
                  title: string,
                  icon: React.ReactNode,
                  hint: string,
                ) => {
                  const state = stageState(key)
                  const active = state === 'active'
                  const done = state === 'done'
                  const blocked = state === 'blocked'
                  const reviewClosedByDecline = key === 'review' && counterpartRejected
                  const reviewRejectedByOwner = key === 'review' && ownerRejected
                  const reviewApproved = key === 'review' && s.status === 'approved'
                  const border = done ? '#A7F3D0' : blocked ? '#FECACA' : active ? '#FED7AA' : '#E5E7EB'
                  const bg = done ? '#F0FDF4' : blocked ? '#FEF2F2' : active ? '#FFFBF5' : '#FFFFFF'
                  const iconBoxBg = done ? '#ECFDF5' : blocked ? '#FEF2F2' : active ? '#FFF7ED' : '#F8FAFC'
                  const iconColor = done ? '#047857' : blocked ? '#B91C1C' : active ? '#F97316' : '#94A3B8'
                  const showWithdrawHere = selectedCanWithdrawSwap && key === activeStage
                  return (
                    <div style={{ minWidth: 0, minHeight: 380, height: '100%', border: `1px solid ${border}`, borderRadius: 14, background: bg, boxShadow: active ? '0 10px 28px rgba(249,115,22,0.08)' : 'none', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                      <div style={{ height: 52, padding: '0 16px', borderBottom: `1px solid ${done ? '#BBF7D0' : blocked ? '#FECACA' : active ? '#FED7AA' : '#F3F4F6'}`, display: 'flex', alignItems: 'center', gap: 9 }}>
                        <span style={{ width: 28, height: 28, borderRadius: 9, background: iconBoxBg, color: iconColor, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{done ? <Check size={14} /> : blocked ? <X size={14} /> : icon}</span>
                        <span style={{ fontSize: 14, fontWeight: 800, color: '#0F172A', whiteSpace: 'nowrap' }}>{title}</span>
                        {showWithdrawHere && (
                          <button
                            type="button"
                            aria-label="Delete shift swap request"
                            title="Delete request"
                            disabled={selectedWithdrawingSwap}
                            onClick={() => { setWithdrawConfirmSwapId(s.id) }}
                            style={{
                              marginLeft: 'auto',
                              width: 28,
                              height: 28,
                              borderRadius: 8,
                              border: '1px solid #FECACA',
                              background: '#FEF2F2',
                              color: '#EF4444',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              cursor: selectedWithdrawingSwap ? 'default' : 'pointer',
                              opacity: selectedWithdrawingSwap ? 0.65 : 1,
                              flexShrink: 0,
                            }}
                          >
                            {selectedWithdrawingSwap ? <Spinner size={12} /> : <Trash2 size={14} />}
                          </button>
                        )}
                      </div>
                      <div style={{ padding: 16, flex: 1 }}>
                        {reviewClosedByDecline ? (
                          <div style={{ height: '100%', border: '1px solid #FECACA', borderRadius: 12, background: '#FFFFFF', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, padding: 18, textAlign: 'center', color: '#B91C1C' }}>
                            <span style={{ width: 44, height: 44, borderRadius: 999, background: '#FEF2F2', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}><X size={24} strokeWidth={2.6} /></span>
                            <span style={{ fontSize: 12.5, fontWeight: 800, lineHeight: 1.45 }}>{iAmRequester ? `${s.counterpart_name} declined this request.` : 'You declined this request.'}</span>
                          </div>
                        ) : reviewApproved ? (
                          <div style={{ padding: '42px 16px 18px', borderRadius: 12, border: '1px solid #BBF7D0', background: '#FFFFFF', boxShadow: '0 8px 20px rgba(15,23,42,0.05)', display: 'flex', flexDirection: 'column', gap: 16 }}>
                            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 34px minmax(0, 1fr)', gap: 12, alignItems: 'start' }}>
                              {swapPerson(iAmRequester ? 'You' : s.requester_name, s.requester_photo_url, s.requester_shift_date, s.requester_start_time, s.requester_end_time, 'orange')}
                              <div style={{ width: 46, height: 46, borderRadius: 999, background: '#FFF7ED', color: '#F97316', border: '1px solid #FED7AA', display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 38, justifySelf: 'center' }}>
                                <ArrowLeftRight size={22} />
                              </div>
                              {swapPerson(iAmRequester ? s.counterpart_name : 'You', s.counterpart_photo_url, s.counterpart_shift_date, s.counterpart_start_time, s.counterpart_end_time, 'blue')}
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 9, textAlign: 'center', color: '#047857' }}>
                              <span style={{ width: 32, height: 32, borderRadius: 999, background: '#ECFDF5', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}><Check size={17} /></span>
                              <span style={{ fontSize: 12.5, fontWeight: 800, lineHeight: 1.45 }}>Owner/Partner approved this swap.</span>
                            </div>
                          </div>
                        ) : reviewRejectedByOwner ? (
                          <div style={{ padding: '42px 16px 18px', borderRadius: 12, border: '1px solid #FECACA', background: '#FFFFFF', boxShadow: '0 8px 20px rgba(15,23,42,0.05)', display: 'flex', flexDirection: 'column', gap: 16 }}>
                            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 34px minmax(0, 1fr)', gap: 12, alignItems: 'start' }}>
                              {swapPerson(iAmRequester ? 'You' : s.requester_name, s.requester_photo_url, s.requester_shift_date, s.requester_start_time, s.requester_end_time, 'orange')}
                              <div style={{ width: 46, height: 46, borderRadius: 999, background: '#FFF7ED', color: '#F97316', border: '1px solid #FED7AA', display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 38, justifySelf: 'center' }}>
                                <ArrowLeftRight size={22} />
                              </div>
                              {swapPerson(iAmRequester ? s.counterpart_name : 'You', s.counterpart_photo_url, s.counterpart_shift_date, s.counterpart_start_time, s.counterpart_end_time, 'blue')}
                            </div>
                            <div>
                              <div style={{ fontSize: '0.875rem', fontWeight: 800, color: '#374151' }}>Rejected Reason</div>
                              <div style={{ marginTop: 6, fontSize: 15.5, color: '#111827', lineHeight: 1.45 }}>{s.owner_review_reason}</div>
                            </div>
                            <div>
                              <div style={{ fontSize: '0.875rem', fontWeight: 800, color: '#374151' }}>Rejected</div>
                              <div style={{ marginTop: 6, fontSize: 15.5, color: '#111827', lineHeight: 1.45 }}>{formatCompactAt(s.reviewed_at ?? s.updated_at)}</div>
                            </div>
                          </div>
                        ) : active || blocked ? requestCard : done ? (
                          <div style={{ height: '100%', border: '1px solid #BBF7D0', borderRadius: 12, background: '#FFFFFF', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 9, padding: 18, textAlign: 'center', color: '#047857' }}>
                            <span style={{ width: 32, height: 32, borderRadius: 999, background: '#ECFDF5', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}><Check size={17} /></span>
                            <span style={{ fontSize: 12.5, fontWeight: 800, lineHeight: 1.45 }}>{completedText(key)}</span>
                          </div>
                        ) : (
                          <div style={{ height: '100%', border: '1px dashed #E5E7EB', borderRadius: 12, background: '#F8FAFC', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, textAlign: 'center', color: '#94A3B8', fontSize: 12.5, fontWeight: 700, lineHeight: 1.45 }}>
                            {hint}
                          </div>
                        )}
                      </div>
                    </div>
                  )
                }
                return (
                  <div style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: 16 }}>
                    {(s.monthly_swap_limit != null || s.deadline_exceeded != null) && (
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        {s.monthly_swap_limit != null && (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11.5, fontWeight: 700, padding: '5px 10px', borderRadius: 999, background: s.limit_exceeded ? '#FEF2F2' : '#ECFDF5', color: s.limit_exceeded ? '#B91C1C' : '#047857' }}>
                            {s.limit_exceeded ? <X size={11} /> : <Check size={11} />} {s.limit_exceeded ? 'Exceeded monthly limit' : `Within monthly limit (${s.requester_swaps_left}/${s.monthly_swap_limit} left)`}
                          </span>
                        )}
                        {s.deadline_exceeded != null && (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11.5, fontWeight: 700, padding: '5px 10px', borderRadius: 999, background: s.deadline_exceeded ? '#FEF2F2' : '#ECFDF5', color: s.deadline_exceeded ? '#B91C1C' : '#047857' }}>
                            {s.deadline_exceeded ? <X size={11} /> : <Check size={11} />} {s.deadline_exceeded ? 'Past deadline' : 'Before deadline'}
                          </span>
                        )}
                      </div>
                    )}
                    <div style={{ marginTop: 6, flex: 1, minHeight: 380, display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 38px minmax(0, 1fr) 38px minmax(0, 1fr)', gap: 14, alignItems: 'stretch' }}>
                      {stageBlock('sent', iAmRequester ? 'Requests Sent' : 'Requests Received', <ArrowLeftRight size={14} />, iAmRequester ? 'Request has been sent.' : 'Request has been received.')}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <span style={{ width: 28, height: 28, borderRadius: 999, background: '#F97316', color: '#FFFFFF', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 6px 16px rgba(249,115,22,0.25)' }}><ChevronRight size={16} /></span>
                      </div>
                      {stageBlock('response', counterpartRejected ? 'Response Declined' : needsMyResponse ? 'Your Response' : 'Awaiting Colleague Response', <Clock size={14} />, counterpartRejected ? 'The colleague declined, so this request is closed.' : needsMyResponse ? 'Accept or decline this swap request.' : 'Waiting for the other Manager.')}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <span style={{ width: 28, height: 28, borderRadius: 999, background: '#F97316', color: '#FFFFFF', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 6px 16px rgba(249,115,22,0.25)' }}><ChevronRight size={16} /></span>
                      </div>
                      {stageBlock('review', ownerRejected ? 'Review Rejected' : counterpartRejected ? 'Review Closed' : 'Awaiting Review', <ClipboardList size={14} />, 'Review starts after both Managers agree.')}
                    </div>
                  </div>
                )
              })() : (() => {
                const group = selected.offdayGroup!
                const first = group[0]
                const requestedDates = group.map(f => f.requested_date)
                const weekDates = getWeekDatesFromStart(first.requested_week)
                const isEditingThisFixedOff = !!editingFixedOffGroup?.length && editingFixedOffGroup[0].requested_week === first.requested_week
                const offDayLabel = first.status === 'pending' ? 'Requested Off Days' : 'Confirmed Off Days'
                const displaySelectedDates = isEditingThisFixedOff ? editingFixedOffDates : requestedDates
                const displaySelectedSet = new Set(displaySelectedDates)
                const reviewedAtLabel = first.status !== 'pending' ? formatCompactAt(first.reviewed_at ?? first.created_at) : ''
                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 18, maxWidth: 620 }}>
                    {first.status === 'modified' && (
                      <div style={{ padding: '12px 14px', background: '#FFFFFF', border: `1px solid ${PANEL_BORDER}`, borderRadius: 10, display: 'flex', gap: 9, boxShadow: '0 6px 16px rgba(15,23,42,0.035)' }}>
                        <Pencil size={15} style={{ color: '#F97316', flexShrink: 0, marginTop: 1 }} />
                        <p style={{ margin: 0, fontSize: 12.5, color: '#111827', fontWeight: 700 }}>{first.reviewer_name ?? 'Owner/Partner'} moved your day{group.length === 1 ? '' : 's'} off to the date{group.length === 1 ? '' : 's'} shown below.</p>
                      </div>
                    )}
                    {first.status === 'approved' && (
                      <div style={{ padding: '12px 14px', background: '#FFFFFF', border: `1px solid ${PANEL_BORDER}`, borderRadius: 10, display: 'flex', gap: 9, boxShadow: '0 6px 16px rgba(15,23,42,0.035)' }}>
                        <Check size={15} style={{ color: '#F97316', flexShrink: 0, marginTop: 1 }} />
                        <p style={{ margin: 0, fontSize: 12.5, color: '#111827', fontWeight: 700 }}>Requested off days approved{first.reviewer_name ? ` by ${first.reviewer_name}` : ''}.</p>
                      </div>
                    )}
                    <div style={{ border: `1px solid ${PANEL_BORDER}`, borderRadius: 14, background: '#FFFFFF', padding: '18px 20px', boxShadow: '0 8px 20px rgba(15,23,42,0.04)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 14 }}>
                        <label style={{ ...modalLabelStyle, margin: 0 }}>
                          {isEditingThisFixedOff ? 'Choose Days' : offDayLabel}
                        </label>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ ...modalLabelStyle, margin: 0 }}>{displaySelectedDates.length}/{fixedOffQuota}</span>
                        </div>
                      </div>
                      {editingFixedOffError && isEditingThisFixedOff && (
                        <div style={{ ...modalErrorBoxStyle, marginBottom: 12 }}>{editingFixedOffError}</div>
                      )}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 56px)', gap: 12, alignItems: 'start' }}>
                          {weekDates.map(date => {
                            const selectedDay = displaySelectedSet.has(date)
                            const d = new Date(`${date}T00:00:00`)
                            return (
                              <div key={date} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
                                <span style={{ fontSize: 11, fontWeight: 800, color: selectedDay ? '#166534' : '#6B7280' }}>{d.toLocaleDateString('en-AU', { weekday: 'short' })}</span>
                                <button
                                  type="button"
                                  onClick={() => { if (isEditingThisFixedOff) toggleEditingFixedOffDate(date) }}
                                  disabled={!isEditingThisFixedOff || editingFixedOffSaving}
                                  style={{
                                    width: 48, height: 48, borderRadius: '50%', padding: 0,
                                    border: selectedDay ? '1.5px solid #16A34A' : '1px solid #E5E7EB',
                                    background: selectedDay ? '#DCFCE7' : isEditingThisFixedOff ? '#FFFFFF' : '#F3F4F6',
                                    color: selectedDay ? '#166534' : isEditingThisFixedOff ? '#6B7280' : '#9CA3AF',
                                    cursor: isEditingThisFixedOff && !editingFixedOffSaving ? 'pointer' : 'default',
                                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 1, fontWeight: 800, lineHeight: 1.1,
                                  }}
                                >
                                  <span style={{ fontSize: 14 }}>{String(d.getDate()).padStart(2, '0')}</span>
                                  <span style={{ fontSize: 9 }}>{d.toLocaleDateString('en-AU', { month: 'short' })}</span>
                                </button>
                              </div>
                            )
                          })}
                        </div>
                        {selectedCanEditFixedOff && !isEditingThisFixedOff && (
                          <button
                            type="button"
                            aria-label="Edit off day request"
                            title="Edit request"
                            onClick={() => openEditFixedOff(group)}
                            style={{
                              height: 34,
                              padding: '0 12px',
                              borderRadius: 9,
                              border: '1px solid #FED7AA',
                              background: '#FFF7ED',
                              color: '#C2410C',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: 6,
                              fontSize: 12,
                              fontWeight: 800,
                              cursor: 'pointer',
                              flexShrink: 0,
                              marginTop: 18,
                            }}
                          >
                            <Pencil size={13} /> Edit
                          </button>
                        )}
                      </div>
                      {isEditingThisFixedOff && (
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
                          <button type="button" onClick={closeEditFixedOff} disabled={editingFixedOffSaving} style={{ height: 34, padding: '0 14px', borderRadius: 9, border: `1px solid ${PANEL_BORDER}`, background: '#FFFFFF', color: '#6B7280', fontSize: 12.5, fontWeight: 800, cursor: editingFixedOffSaving ? 'default' : 'pointer' }}>
                            Cancel
                          </button>
                          <button type="button" onClick={handleEditFixedOff} disabled={editingFixedOffSaving || editingFixedOffDates.length !== fixedOffQuota} style={{ height: 34, padding: '0 16px', borderRadius: 9, border: 'none', background: editingFixedOffSaving || editingFixedOffDates.length !== fixedOffQuota ? '#FDBA74' : '#F97316', color: '#FFFFFF', fontSize: 12.5, fontWeight: 800, cursor: editingFixedOffSaving || editingFixedOffDates.length !== fixedOffQuota ? 'default' : 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                            {editingFixedOffSaving ? <Spinner size={12} /> : <Pencil size={12} />} Save
                          </button>
                        </div>
                      )}
                    </div>
                    {reviewedAtLabel && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 9, paddingLeft: 4, color: '#111827', fontSize: 12.5, fontWeight: 700 }}>
                        <Clock size={13} style={{ color: '#F97316', flexShrink: 0 }} />
                        <span>Processed on {reviewedAtLabel}</span>
                      </div>
                    )}
                  </div>
                )
              })()}
          </div>
        </section>
      </div>

      {/* ── Submit Request modal ─────────────────────────────────────────── */}
      {requestModalOpen && (
        <ModalOverlay onClose={closeRequestModal} maxWidth={requestModalStep === 'offday' ? '490px' : '440px'}>
          <ModalBox>
            <ModalHeader title={modalTitle} icon={modalIcon} onClose={closeRequestModal} />
            <div style={{ padding: requestModalStep === 'offday' ? '26px 24px 32px' : '20px 24px', display: 'flex', flexDirection: 'column', gap: 13, maxHeight: 'calc(90vh - 130px)', overflowY: 'auto' }}>
              {myReqError && requestModalStep !== 'choose' && (
                <div style={modalErrorBoxStyle}>{myReqError}</div>
              )}

              {requestModalStep === 'choose' && (
                <div className="att-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
                  <button onClick={() => setRequestModalStep('swap')}
                    style={{ padding: '14px 16px', border: '1.5px solid #E5E7EB', borderRadius: 12, background: '#FFFFFF', cursor: 'pointer', textAlign: 'left' }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = '#F97316' }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = '#E5E7EB' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ width: 36, height: 36, borderRadius: 9, background: '#FFF7ED', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <ArrowLeftRight size={17} color="#F97316" />
                      </div>
                      <div>
                        <p style={{ fontWeight: 600, fontSize: '0.875rem', color: '#374151', margin: '0 0 2px' }}>Shift Swap Request</p>
                        <p style={{ fontSize: '0.8125rem', color: '#6B7280', margin: 0 }}>{swapDeadlineSubtitle}</p>
                      </div>
                    </div>
                  </button>
                  <button
                    onClick={() => { if (!hasMyFixedOffForActiveWeek) setRequestModalStep('offday') }}
                    disabled={hasMyFixedOffForActiveWeek}
                    style={{ padding: '14px 16px', border: '1.5px solid #E5E7EB', borderRadius: 12, background: hasMyFixedOffForActiveWeek ? '#F9FAFB' : '#FFFFFF', cursor: hasMyFixedOffForActiveWeek ? 'not-allowed' : 'pointer', textAlign: 'left', opacity: hasMyFixedOffForActiveWeek ? 0.72 : 1 }}
                    onMouseEnter={e => { if (!hasMyFixedOffForActiveWeek) e.currentTarget.style.borderColor = '#F97316' }}
                    onMouseLeave={e => { if (!hasMyFixedOffForActiveWeek) e.currentTarget.style.borderColor = '#E5E7EB' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ width: 36, height: 36, borderRadius: 9, background: hasMyFixedOffForActiveWeek ? '#F3F4F6' : '#FFF7ED', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <Calendar size={17} color={hasMyFixedOffForActiveWeek ? '#9CA3AF' : '#F97316'} />
                      </div>
                      <div>
                        <p style={{ fontWeight: 600, fontSize: '0.875rem', color: '#374151', margin: '0 0 2px' }}>Off Day Request</p>
                        <p style={{ fontSize: '0.8125rem', color: hasMyFixedOffForActiveWeek ? '#B45309' : '#6B7280', margin: 0, whiteSpace: 'nowrap' }}>{offDaySubtitle}</p>
                      </div>
                    </div>
                  </button>
                </div>
              )}

              {requestModalStep === 'swap' && (
                <div className="att-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
                  <div>
                    <label style={modalLabelStyle}>Your Shift</label>
                    <AttendanceRequestDropdown
                      value={swapShiftId}
                      onChange={v => { void handleSwapShiftChange(v) }}
                      placeholder="Select your shift"
                      options={mySwappableShifts.map(s => ({ value: s.assignment.id, label: `${formatShiftDateShort(s.shift.shift_date)} ${formatShiftHour(s.shift.start_time)}–${formatShiftHour(s.shift.end_time)}` }))}
                    />
                  </div>
                  <div>
                    <label style={modalLabelStyle}>Swap With Colleague</label>
                    <AttendanceRequestDropdown
                      value={swapCounterpartId}
                      onChange={v => { setSwapCounterpartId(v); setSwapCounterpartAssignmentId(''); if (!selectedOwnShiftHasPending) setMyReqError('') }}
                      disabled={!swapShiftId || selectedOwnShiftHasPending || swapConflictChecking}
                      placeholder="Select a colleague"
                      options={colleagueRows.map(r => ({ value: r.user_id ?? '', label: r.full_name ?? '' }))}
                    />
                  </div>
                  <div>
                    <label style={modalLabelStyle}>Target Shift</label>
                    <AttendanceRequestDropdown
                      value={swapCounterpartAssignmentId}
                      onChange={v => { void handleSwapTargetShiftChange(v) }}
                      disabled={!swapCounterpartId || selectedOwnShiftHasPending || swapConflictChecking}
                      placeholder={swapCounterpartId && colleagueShifts.length === 0 ? 'No upcoming shifts' : "Select colleague's shift"}
                      options={colleagueShifts.map(s => ({ value: s.assignment_id ?? '', label: `${formatShiftDateShort(s.shift_date)} ${formatShiftHour(s.start_time)}–${formatShiftHour(s.end_time)}` }))}
                    />
                  </div>
                  <div>
                    <label style={modalLabelStyle}>Reason</label>
                    <textarea value={swapReason} onChange={e => setSwapReason(e.target.value)} disabled={swapHasConflict} rows={2} placeholder="Enter a brief reason" style={{ ...modalInputStyle, height: 'auto', resize: 'vertical', background: swapHasConflict ? '#F9FAFB' : '#FFFFFF', cursor: swapHasConflict ? 'not-allowed' : 'text' }} />
                  </div>
                  {ruleCheckReady && (swapLimitExceeded != null || swapDeadlineExceeded != null) && (
                    <div className="att-fade-in">
                      <label style={modalLabelStyle}>Rule Check</label>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                        {swapLimitExceeded != null && (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11.5, fontWeight: 700, padding: '5px 10px', borderRadius: 999, background: swapLimitExceeded ? '#FEF2F2' : '#ECFDF5', color: swapLimitExceeded ? '#B91C1C' : '#047857' }}>
                            {swapLimitExceeded ? <X size={11} /> : <Check size={11} />} {swapLimitExceeded ? 'Exceeded monthly limit' : `Within monthly limit (${swapsLeftPreview}/${swapMonthlyLimit} left)`}
                          </span>
                        )}
                        {swapDeadlineExceeded != null && (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11.5, fontWeight: 700, padding: '5px 10px', borderRadius: 999, background: swapDeadlineExceeded ? '#FEF2F2' : '#ECFDF5', color: swapDeadlineExceeded ? '#B91C1C' : '#047857' }}>
                            {swapDeadlineExceeded ? <X size={11} /> : <Check size={11} />} {swapDeadlineExceeded ? 'Past deadline' : 'Before deadline'}
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {requestModalStep === 'offday' && (
                <div className="att-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 8 }}>
                    <label style={{ ...modalLabelStyle, margin: 0 }}>Upcoming Week</label>
                    <label style={{ ...modalLabelStyle, margin: 0 }}>{selectedFixedOffDates.length}/{fixedOffQuota} selected</label>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 7 }}>
                    {getUpcomingWeekDates().map(date => {
                      const isSelected = selectedFixedOffDates.includes(date)
                      const atLimit = !isSelected && selectedFixedOffDates.length >= fixedOffQuota
                      const d = new Date(`${date}T00:00:00`)
                      return (
                        <div key={date} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
                          <span style={{ fontSize: 11, fontWeight: 700, color: isSelected ? '#166534' : '#6B7280' }}>{d.toLocaleDateString('en-AU', { weekday: 'short' })}</span>
                          <button
                            type="button"
                            onClick={() => toggleFixedOffDate(date)}
                            disabled={atLimit}
                            style={{
                              width: 48, height: 48, borderRadius: '50%', padding: 0,
                              border: isSelected ? '1.5px solid #16A34A' : `1px solid ${PANEL_BORDER}`,
                              background: isSelected ? '#DCFCE7' : '#FFFFFF',
                              color: isSelected ? '#166534' : '#111827',
                              opacity: atLimit ? 0.45 : 1, cursor: atLimit ? 'not-allowed' : 'pointer',
                              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 1, fontWeight: 800, lineHeight: 1.1,
                            }}
                          >
                            <span style={{ fontSize: 14 }}>{String(d.getDate()).padStart(2, '0')}</span>
                            <span style={{ fontSize: 9 }}>{d.toLocaleDateString('en-AU', { month: 'short' })}</span>
                          </button>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
            {requestModalStep !== 'choose' && (
              <div style={{ padding: '12px 24px 20px', display: 'flex', gap: 8, justifyContent: 'space-between', borderTop: '1px solid #F3F4F6' }}>
                <button onClick={() => { setRequestModalStep('choose'); setMyReqError(''); resetRequestForms() }} style={{ ...modalGhostButtonStyle, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                  <ChevronLeft size={14} /> Back
                </button>
                {requestModalStep === 'swap' ? (
                  <button onClick={handleSubmitSwap} disabled={swapSubmitting || swapHasConflict || !swapShiftId || !swapCounterpartId || !swapCounterpartAssignmentId || !swapReason.trim()} style={modalPrimaryButtonStyle(swapSubmitting || swapHasConflict || !swapShiftId || !swapCounterpartId || !swapCounterpartAssignmentId || !swapReason.trim())}>
                    {swapSubmitting ? <Spinner size={13} /> : <ArrowLeftRight size={13} />} Submit Swap Request
                  </button>
                ) : (
                  <button onClick={handleSubmitFixedOff} disabled={fixedSubmitting || hasMyFixedOffForActiveWeek || selectedFixedOffDates.length !== fixedOffQuota} style={modalPrimaryButtonStyle(fixedSubmitting || hasMyFixedOffForActiveWeek || selectedFixedOffDates.length !== fixedOffQuota)}>
                    {fixedSubmitting ? <Spinner size={13} /> : <Calendar size={13} />} Request Weekly Day Off
                  </button>
                )}
              </div>
            )}
          </ModalBox>
        </ModalOverlay>
      )}

      {/* ── Withdraw confirmation modal ──────────────────────────────────── */}
      {withdrawConfirmSwapId && (() => {
        const deleting = withdrawingSwapId === withdrawConfirmSwapId
        return (
          <ModalOverlay onClose={() => { if (!deleting) setWithdrawConfirmSwapId(null) }} maxWidth="420px">
            <ModalBox>
              <ModalHeader
                title="Delete Shift Swap Request"
                icon={<Trash2 size={15} color="#fff" strokeWidth={2.5} />}
                iconBg="linear-gradient(135deg, #EF4444, #DC2626)"
                onClose={() => { if (!deleting) setWithdrawConfirmSwapId(null) }}
              />
              <div style={{ padding: '20px 24px 0' }}>
                <p style={{ fontSize: '0.9375rem', color: '#374151', margin: 0, lineHeight: 1.6 }}>
                  Are you sure you want delete this request?
                </p>
              </div>
              <div style={{ padding: '20px 24px 20px', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setWithdrawConfirmSwapId(null)} disabled={deleting} style={modalGhostButtonStyle}>Cancel</button>
                <button type="button" onClick={() => void handleWithdrawSwap(withdrawConfirmSwapId)} disabled={deleting} style={modalDestructiveButtonStyle(deleting)}>
                  {deleting ? <Spinner size={13} /> : <Trash2 size={13} />} Delete
                </button>
              </div>
            </ModalBox>
          </ModalOverlay>
        )
      })()}
    </>
  )
}
