'use client'

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'
import {
  AlertTriangle, ArrowLeftRight, Calendar, CalendarDays, Check, ChevronDown, ChevronLeft, ChevronRight,
  Download, RefreshCw, ShieldCheck, UserCog, UserRound, UserX, X,
} from 'lucide-react'
import OwnerSidebar from '@/components/OwnerSidebar'
import OwnerPlanBadge from '@/components/owner/PlanBadge'
import OwnerUserBadge from '@/components/owner/OwnerUserBadge'
import Spinner from '@/components/Spinner'
import { deptColor } from '@/lib/deptColor'
import {
  AttendanceDashboardRecord,
  FixedOffDayRequestView,
  ShiftSwapRequestView,
  TimeOffRequestView,
} from '@/types/Attendance'
import { ModalOverlay, ModalBox, ModalHeader, modalErrorBoxStyle, modalPrimaryButtonStyle } from '@/components/modal'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

const PANEL_BORDER = '#E2E8F0'
const TEXT_DARK = '#0F172A'


const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

// ─── helpers ─────────────────────────────────────────────────────────────────

function formatTime(value: string | null | undefined): string {
  if (!value) return '-'
  if (value.includes('T')) return new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  return value.slice(0, 5)
}

function statusColor(status: string): { bg: string; text: string } {
  if (status === 'approved') return { bg: '#ECFDF5', text: '#047857' }
  if (status === 'rejected') return { bg: '#FEF2F2', text: '#B91C1C' }
  if (status === 'modified') return { bg: '#FFF7ED', text: '#C2410C' }
  return { bg: '#FFFBEB', text: '#B45309' }
}

function requestTypeLabel(requestType: string): string {
  if (requestType === 'leave') return 'Leave Request'
  if (requestType === 'break_waiver') return 'Break Waiver'
  return 'Time Off'
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

function fmt(d: Date): string {
  return `${String(d.getDate()).padStart(2, '0')} ${d.toLocaleDateString('en-AU', { month: 'short' })}`
}

function formatShiftHour(time: string): string {
  const [h, m] = time.split(':').map(Number)
  const ampm = h < 12 ? 'am' : 'pm'
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h
  return m === 0 ? `${h12}${ampm}` : `${h12}:${String(m).padStart(2, '0')}${ampm}`
}


type ARStatus = 'present' | 'late' | 'absent' | 'no-shift'

function getARStatus(row: AttendanceDashboardRecord): ARStatus {
  if (row.exceptions.includes('absent')) return 'absent'
  if (row.exceptions.includes('late')) return 'late'
  if (row.record?.clock_in_time) return 'present'
  return 'absent'
}

// ─── FilterDropdown — matches Shift page custom select style ─────────────────

function FilterDropdown({ value, onChange, options, placeholder }: {
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
  placeholder: string
}) {
  const [open, setOpen] = useState(false)
  const btnRef = useRef<HTMLButtonElement>(null)
  const [rect, setRect] = useState<DOMRect | null>(null)

  const selected = options.find(o => o.value === value)

  const openMenu = () => {
    if (btnRef.current) setRect(btnRef.current.getBoundingClientRect())
    setOpen(true)
  }

  useEffect(() => {
    if (!open) return
    const close = () => setOpen(false)
    window.addEventListener('mousedown', close)
    return () => window.removeEventListener('mousedown', close)
  }, [open])

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={openMenu}
        style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'space-between', gap: 6,
          height: 38, padding: '0 12px', border: `1px solid ${PANEL_BORDER}`, borderRadius: 9,
          background: '#FFFFFF', cursor: 'pointer', fontSize: 13, fontWeight: 500,
          color: value ? TEXT_DARK : '#64748B', minWidth: 150,
        }}
      >
        <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {selected ? selected.label : placeholder}
        </span>
        <ChevronDown size={14} color="#64748B" style={{ flexShrink: 0 }} />
      </button>

      {open && rect && createPortal(
        <div
          onMouseDown={e => e.stopPropagation()}
          style={{
            position: 'fixed', top: rect.bottom + 4, left: rect.left,
            minWidth: rect.width, background: '#FFFFFF', border: `1px solid ${PANEL_BORDER}`,
            borderRadius: 12, boxShadow: '0 4px 24px rgba(0,0,0,0.10)', zIndex: 9999, padding: 6, overflow: 'hidden',
          }}
        >
          {[{ value: '', label: placeholder }, ...options].map(opt => {
            const isActive = opt.value === value
            return (
              <div
                key={opt.value}
                onMouseDown={() => { onChange(opt.value); setOpen(false) }}
                style={{
                  padding: '9px 12px', borderRadius: 8, fontSize: 13, fontWeight: isActive ? 700 : 500,
                  color: isActive ? '#F97316' : TEXT_DARK,
                  background: isActive ? '#FFF7ED' : 'transparent',
                  cursor: 'pointer',
                }}
                onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = '#F8FAFC' }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = isActive ? '#FFF7ED' : 'transparent' }}
              >
                {opt.label}
              </div>
            )
          })}
        </div>,
        document.body,
      )}
    </>
  )
}

// ─── sub-components ──────────────────────────────────────────────────────────

function ARStatusIcon({ status }: { status: ARStatus }) {
  if (status === 'present') return (
    <span style={{ width: 20, height: 20, borderRadius: '50%', background: '#ECFDF5', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      <Check size={11} color="#059669" strokeWidth={3} />
    </span>
  )
  if (status === 'late') return (
    <span style={{ width: 20, height: 20, borderRadius: '50%', background: '#FFF7ED', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      <AlertTriangle size={10} color="#C2410C" strokeWidth={3} />
    </span>
  )
  if (status === 'absent') return (
    <span style={{ width: 20, height: 20, borderRadius: '50%', background: '#FEF2F2', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      <UserX size={10} color="#B91C1C" strokeWidth={3} />
    </span>
  )
  return <span style={{ width: 20, height: 20, flexShrink: 0 }} />
}

// ─── CapsuleTabBar ────────────────────────────────────────────────────────────

function CapsuleTabBar<T extends string>({
  tabs,
  active,
  onChange,
}: {
  tabs: { key: T; label: string; count?: number }[]
  active: T
  onChange: (key: T) => void
}) {
  const barRef = useRef<HTMLDivElement>(null)
  const btnRefs = useRef<Record<string, HTMLButtonElement | null>>({})
  const [indicator, setIndicator] = useState({ left: 0, width: 0, opacity: 0 })

  useLayoutEffect(() => {
    const container = barRef.current
    const btn = btnRefs.current[active]
    if (!container || !btn) return
    const cr = container.getBoundingClientRect()
    const br = btn.getBoundingClientRect()
    setIndicator({ left: br.left - cr.left, width: br.width, opacity: 1 })
  }, [active])

  return (
    <div
      ref={barRef}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: 4, background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: 999, boxShadow: '0 1px 4px rgba(0,0,0,0.05)', overflow: 'hidden', position: 'relative' }}
    >
      <span
        aria-hidden="true"
        style={{
          position: 'absolute', top: 4, left: indicator.left, width: indicator.width,
          height: 'calc(100% - 8px)', borderRadius: 999,
          background: 'linear-gradient(180deg, #0F172A 0%, #111827 100%)',
          boxShadow: '0 6px 18px rgba(15,23,42,0.18)',
          opacity: indicator.opacity,
          transform: indicator.opacity ? 'translateY(0)' : 'translateY(4px)',
          transition: 'left 0.24s cubic-bezier(0.22,1,0.36,1), width 0.24s cubic-bezier(0.22,1,0.36,1), opacity 0.16s ease',
          pointerEvents: 'none',
        }}
      />
      {tabs.map(tab => {
        const isActive = active === tab.key
        return (
          <button
            key={tab.key}
            ref={el => { btnRefs.current[tab.key] = el }}
            onClick={() => onChange(tab.key)}
            style={{
              position: 'relative', zIndex: 1, height: 36, padding: '0 18px',
              border: 'none', borderRadius: 999, fontWeight: 700, fontSize: 13, cursor: 'pointer',
              background: 'transparent', color: isActive ? '#FFFFFF' : '#64748B',
              display: 'inline-flex', alignItems: 'center', gap: 8,
              transition: 'color 0.18s ease',
              transform: isActive ? 'translateY(-0.5px)' : 'translateY(0)',
            }}
          >
            {tab.label}
            {tab.count !== undefined && (
              <span style={{ minWidth: 22, height: 22, padding: '0 7px', borderRadius: 999, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: isActive ? 'rgba(255,255,255,0.16)' : '#F1F5F9', color: isActive ? '#FFFFFF' : '#64748B', fontSize: 11, fontWeight: 900 }}>
                {tab.count}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}

// ─── ReviewModal ──────────────────────────────────────────────────────────────

// Generate every 5-minute slot for 24 h in "h:mm AM/PM" format
const TIME_OPTIONS: string[] = (() => {
  const opts: string[] = []
  for (let h = 0; h < 24; h++) {
    for (let m = 0; m < 60; m += 5) {
      const ampm = h < 12 ? 'AM' : 'PM'
      const displayH = h % 12 === 0 ? 12 : h % 12
      opts.push(`${displayH}:${String(m).padStart(2, '0')} ${ampm}`)
    }
  }
  return opts
})()

const selectStyle: React.CSSProperties = {
  width: '100%', padding: '10px 12px', border: '1.5px solid #E5E7EB', borderRadius: 8,
  fontSize: '0.9rem', color: '#111827', outline: 'none', boxSizing: 'border-box', background: '#FFFFFF',
  appearance: 'none', WebkitAppearance: 'none', cursor: 'pointer',
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 12px', border: '1.5px solid #E5E7EB', borderRadius: 8,
  fontSize: '0.9rem', color: '#111827', outline: 'none', boxSizing: 'border-box', background: '#FFFFFF',
}
const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: '0.75rem', fontWeight: 900, color: '#6B7280', marginBottom: 6,
  textTransform: 'uppercase', letterSpacing: '0.04em',
}

// ─── main page ────────────────────────────────────────────────────────────────

export default function OwnerAttendancePage() {
  const router = useRouter()
  const [internalUserId, setInternalUserId] = useState('')
  const [companyId, setCompanyId] = useState('')
  const [currentPlan, setCurrentPlan] = useState('Free')

  // top-level tab
  const [mainTab, setMainTab] = useState<'records' | 'requests'>('records')

  // ── Records tab state ────────────────────────────────────────────────────
  const [recordsKeyword, setRecordsKeyword] = useState('')
  const [recordsRole, setRecordsRole] = useState('')
  const [selectedDeptId, setSelectedDeptId] = useState<string | null>(null)
  const [casualJobType, setCasualJobType] = useState<'all' | 'shift' | 'one-off' | null>(null)
  const [weekRecords, setWeekRecords] = useState<AttendanceDashboardRecord[]>([])
  const [weekLoading, setWeekLoading] = useState(false)

  // review modal (from Records tab)
  const [reviewOpen, setReviewOpen] = useState(false)
  const [reviewRecord, setReviewRecord] = useState<AttendanceDashboardRecord | null>(null)
  const [reviewClockIn, setReviewClockIn] = useState('')
  const [reviewClockOut, setReviewClockOut] = useState('')
  const [reviewActionLoading, setReviewActionLoading] = useState(false)
  const [reviewError, setReviewError] = useState('')
  const [cwWorkerStatus, setCwWorkerStatus] = useState<string | null>(null)
  const [cwStatusLoading, setCwStatusLoading] = useState(false)

  // ── Export modal state ────────────────────────────────────────────────────
  const [exportOpen, setExportOpen] = useState(false)
  const [exportLoading, setExportLoading] = useState(false)
  const [exportFrom, setExportFrom] = useState('')
  const [exportTo, setExportTo] = useState('')
  const [exportFormat, setExportFormat] = useState<'csv' | 'pdf'>('csv')

  // ── Requests tab state ───────────────────────────────────────────────────
  const [reqTab, setReqTab] = useState<'swaps' | 'fixedoff' | 'leave'>('swaps')
  const [timeOffRequests, setTimeOffRequests] = useState<TimeOffRequestView[]>([])
  const [swapRequests, setSwapRequests] = useState<ShiftSwapRequestView[]>([])
  const [fixedOffDayRequests, setFixedOffDayRequests] = useState<FixedOffDayRequestView[]>([])
  const [reqLoading, setReqLoading] = useState(false)
  const [reqActionLoading, setReqActionLoading] = useState(false)
  const [reqError, setReqError] = useState('')
  // ── Rolling 7-day window with back-navigation (0 = current, -7 = one week back, etc.) ──
  const [arWindowOffset, setArWindowOffset] = useState(0) // days offset from current rolling window
  const arToday = useMemo(() => {
    const d = new Date(); d.setHours(0, 0, 0, 0); return d
  }, [])
  const arWindowEnd = useMemo(() => addDays(arToday, arWindowOffset), [arToday, arWindowOffset])
  const arWindowStart = useMemo(() => addDays(arWindowEnd, -6), [arWindowEnd])
  const weekDates = useMemo(() =>
    Array.from({ length: 7 }, (_, i) => toISODate(addDays(arWindowStart, i))),
    [arWindowStart])

  // ── Fetch AR records for the current window ────────────────────────────────
  const fetchWeekRecords = useCallback(async (cid: string, offset: number) => {
    if (!cid) return
    setWeekLoading(true)
    const today = new Date(); today.setHours(0, 0, 0, 0)
    const to = toISODate(addDays(today, offset))
    const from = toISODate(addDays(today, offset - 6))
    try {
      const res = await fetch(`/api/attendance?company_id=${cid}&resource=range&from_date=${from}&to_date=${to}`)
      const data = await res.json()
      if (data.success) setWeekRecords(data.records ?? [])
    } catch { /* leave stale data */ }
    finally { setWeekLoading(false) }
  }, [])

  // ── CSV export ────────────────────────────────────────────────────────────
  // ── Fetch request data ────────────────────────────────────────────────────
  const fetchRequestData = useCallback(async (cid: string) => {
    if (!cid) return
    setReqLoading(true)
    setReqError('')
    try {
      const [toRes, swapRes, fixedRes] = await Promise.all([
        fetch(`/api/attendance?company_id=${cid}&resource=time_off`),
        fetch(`/api/attendance?company_id=${cid}&resource=shift_swaps`),
        fetch(`/api/attendance?company_id=${cid}&resource=fixed_off_days`),
      ])
      const toData = await toRes.json()
      const swapData = await swapRes.json()
      const fixedData = await fixedRes.json()
      setTimeOffRequests(toData.requests ?? [])
      setSwapRequests(swapData.requests ?? [])
      setFixedOffDayRequests(fixedData.requests ?? [])
    } catch (err) {
      setReqError(err instanceof Error ? err.message : 'Failed to fetch requests')
    } finally { setReqLoading(false) }
  }, [])

  // ── Init ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false
    const run = async () => {
      let authId = localStorage.getItem('tasking_user_id')
      if (!authId) {
        const supabase = createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
        const { data: { session } } = await supabase.auth.getSession()
        if (session?.user?.id) { authId = session.user.id; localStorage.setItem('tasking_user_id', authId) }
      }
      if (!authId) { router.replace('/signin'); return }
      const meRes = await fetch(`/api/user/me?user_id=${authId}`)
      const meData = await meRes.json()
      if (!meData.success || cancelled) return
      setInternalUserId(meData.user.id)
      const cid = localStorage.getItem(`tasking_company_id_${authId}`) || meData.user.company_id || ''
      if (!cid) return
      setCompanyId(cid)
      const currentRes = await fetch(`/api/company/current?user_id=${authId}&company_id=${cid}`)
      const currentData = await currentRes.json()
      if (!cancelled && currentData.success) setCurrentPlan(currentData.company?.plan ?? 'Free')
      if (!cancelled) {
        void fetchWeekRecords(cid, 0)
        void fetchRequestData(cid)
      }
    }
    void run()
    return () => { cancelled = true }
  }, [router, fetchWeekRecords, fetchRequestData])

  // fetch AR records on mount / company change / window offset change
  useEffect(() => {
    if (companyId) void fetchWeekRecords(companyId, arWindowOffset)
  }, [companyId, arWindowOffset, fetchWeekRecords])

  // ── Decide request ────────────────────────────────────────────────────────
  const decideRequest = async (
    kind: 'decide_time_off' | 'decide_shift_swap' | 'decide_fixed_off_day',
    id: string,
    decision: 'approved' | 'rejected',
  ) => {
    if (!internalUserId || !companyId) return
    setReqActionLoading(true)
    setReqError('')
    try {
      const res = await fetch('/api/attendance', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: kind, id, reviewer_id: internalUserId, decision }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.message || 'Failed to update request')
      await fetchRequestData(companyId)
    } catch (err) {
      setReqError(err instanceof Error ? err.message : 'Failed to update request')
    } finally { setReqActionLoading(false) }
  }

  // ── Edit AR times (owner can adjust clock in/out) ─────────────────────────
  const isoToAmPm = (iso: string | null | undefined): string => {
    if (!iso) return ''
    // Times are stored as UTC. Round to nearest 5-min slot so the value matches a dropdown option.
    const d = new Date(iso)
    const utcH = d.getUTCHours()
    const utcM = Math.round(d.getUTCMinutes() / 5) * 5
    const h = utcH + (utcM >= 60 ? 1 : 0)
    const m = utcM >= 60 ? 0 : utcM
    const ampm = h < 12 ? 'AM' : 'PM'
    const displayH = h % 12 === 0 ? 12 : h % 12
    return `${displayH}:${String(m).padStart(2, '0')} ${ampm}`
  }

  // Parse "11:03 AM" / "02:02 AM" back to "HH:MM" (24h) for ISO assembly
  const amPmToHHMM = (ampm: string): string => {
    const m = ampm.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i)
    if (!m) return ampm
    let h = parseInt(m[1], 10)
    const min = m[2]
    const meridiem = m[3].toUpperCase()
    if (meridiem === 'AM' && h === 12) h = 0
    if (meridiem === 'PM' && h !== 12) h += 12
    return `${String(h).padStart(2, '0')}:${min}`
  }

  const openReview = (row: AttendanceDashboardRecord) => {
    setReviewRecord(row)
    setReviewClockIn(isoToAmPm(row.record?.owner_adjusted_clock_in_time ?? row.record?.clock_in_time))
    setReviewClockOut(isoToAmPm(row.record?.owner_adjusted_clock_out_time ?? row.record?.clock_out_time))
    setCwWorkerStatus(row.assignee_worker_status ?? 'active')
    setReviewError('')
    setReviewOpen(true)
  }

  const toggleCwStatus = async () => {
    if (!reviewRecord || reviewRecord.assignee_role !== 'Casual Worker') return
    const newStatus = cwWorkerStatus === 'active' ? 'inactive' : 'active'
    setCwStatusLoading(true)
    try {
      const res = await fetch('/api/team/casual-worker-status', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: reviewRecord.assignment.user_id, worker_status: newStatus }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.message || 'Failed to update status')
      setCwWorkerStatus(newStatus)
    } catch (err) {
      setReviewError(err instanceof Error ? err.message : 'Failed to update status')
    } finally { setCwStatusLoading(false) }
  }

  const submitReview = async () => {
    if (!reviewRecord?.record || !internalUserId || !companyId) return
    setReviewActionLoading(true)
    setReviewError('')
    // Convert "HH:MM AM/PM" inputs back to ISO using the shift date
    const shiftDate = reviewRecord.shift.shift_date
    const toISO = (ampm: string) => ampm ? new Date(`${shiftDate}T${amPmToHHMM(ampm)}:00Z`).toISOString() : null
    try {
      const res = await fetch('/api/attendance', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'final_review',
          id: reviewRecord.record.id,
          owner_id: internalUserId,
          decision: 'modified',
          clock_in_time: toISO(reviewClockIn),
          clock_out_time: toISO(reviewClockOut),
        }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.message || 'Failed to update attendance')
      setReviewOpen(false)
      void fetchWeekRecords(companyId, arWindowOffset)
    } catch (err) {
      setReviewError(err instanceof Error ? err.message : 'Failed to update attendance')
    } finally { setReviewActionLoading(false) }
  }

  // ── Build week timeline data ───────────────────────────────────────────────
  // peopleMap: userId → { name, role, deptId, deptName, byDate: { isoDate → AR[] } }
  const peopleMap = useMemo(() => {
    const map = new Map<string, {
      name: string; role: string; deptId: string; deptName: string
      profilePhotoUrl: string | null
      byDate: Map<string, AttendanceDashboardRecord[]>
    }>()

    weekRecords.forEach(row => {
      const userId = row.assignment.user_id
      if (!map.has(userId)) {
        map.set(userId, { name: row.assignee_name, role: row.assignee_role, deptId: '', deptName: row.department_name ?? '', profilePhotoUrl: row.assignee_profile_photo_url ?? null, byDate: new Map() })
      }
      const person = map.get(userId)!
      if (!person.deptName && row.department_name) { person.deptName = row.department_name }
      const date = row.shift.shift_date
      if (!person.byDate.has(date)) person.byDate.set(date, [])
      person.byDate.get(date)!.push(row)
    })

    return map
  }, [weekRecords])

  // Group people by department
  // deptGroups: Internal Staff only (Managers + Employees), never Casual Workers
  const deptGroups = useMemo(() => {
    const groups = new Map<string, { deptId: string; deptName: string; people: typeof peopleMap }>()

    peopleMap.forEach((person, userId) => {
      if (person.role === 'Casual Worker') return
      const key = person.deptName || 'No Department'
      if (!groups.has(key)) groups.set(key, { deptId: key, deptName: key, people: new Map() })
      groups.get(key)!.people.set(userId, person)
    })

    return [...groups.values()].sort((a, b) => a.deptName.localeCompare(b.deptName))
  }, [peopleMap])

  // cwGroups: Casual Workers only, grouped by department
  const cwGroups = useMemo(() => {
    const groups = new Map<string, { deptId: string; deptName: string; people: typeof peopleMap }>()

    peopleMap.forEach((person, userId) => {
      if (person.role !== 'Casual Worker') return
      const key = person.deptName || 'No Department'
      if (!groups.has(key)) groups.set(key, { deptId: key, deptName: key, people: new Map() })
      groups.get(key)!.people.set(userId, person)
    })

    return [...groups.values()].sort((a, b) => a.deptName.localeCompare(b.deptName))
  }, [peopleMap])

  // Apply filters — dept panel, casual job type, keyword + role
  const filteredDeptGroups = useMemo(() => {
    const kw = recordsKeyword.toLowerCase().trim()

    // When a Casual Worker filter is active, render cwGroups; otherwise render deptGroups
    const source = recordsRole === 'Casual Worker' ? cwGroups : deptGroups

    return source
      .filter(g => !selectedDeptId || g.deptId === selectedDeptId)
      .map(group => {
        const filtered = new Map<string, (typeof group.people extends Map<string, infer V> ? V : never)>()
        group.people.forEach((person, userId) => {
          const matchKw = !kw || person.name.toLowerCase().includes(kw)
          if (!matchKw) return
          // casualJobType filter: only applies to Casual Workers
          if (casualJobType && casualJobType !== 'all' && person.role === 'Casual Worker') {
            const filteredByDate = new Map<string, AttendanceDashboardRecord[]>()
            person.byDate.forEach((recs, date) => {
              const filtered2 = recs.filter(r =>
                casualJobType === 'shift' ? !r.shift.is_open_ended : r.shift.is_open_ended
              )
              if (filtered2.length > 0) filteredByDate.set(date, filtered2)
            })
            if (filteredByDate.size > 0) filtered.set(userId, { ...person, byDate: filteredByDate })
          } else {
            filtered.set(userId, person)
          }
        })
        return { ...group, people: filtered }
      }).filter(g => g.people.size > 0)
  }, [deptGroups, cwGroups, recordsKeyword, recordsRole, selectedDeptId, casualJobType])

  // ── Export (CSV or PDF) — fetches the full date range from API, not just the 7-day window ──
  const doExport = useCallback(async (fromDate: string, toDate: string, format: 'csv' | 'pdf') => {
    if (!companyId) return
    setExportLoading(true)
    try {
      // Fetch from API — use date-range endpoint if dates provided, else full dashboard
      let allRecords: AttendanceDashboardRecord[]
      if (fromDate && toDate) {
        const params = new URLSearchParams({ company_id: companyId, resource: 'range', from_date: fromDate, to_date: toDate })
        const res = await fetch(`/api/attendance?${params}`)
        const data = await res.json()
        allRecords = data.records ?? []
      } else {
        const params = new URLSearchParams({ company_id: companyId })
        const res = await fetch(`/api/attendance?${params}`)
        const data = await res.json()
        allRecords = data.records ?? []
      }

      const isCW = recordsRole === 'Casual Worker'
      // When a specific dept is selected, omit the Department column (it's in the title instead)
      const hasDeptFilter = !isCW && !!selectedDeptId
      // CW sub-type: 'shift' = Shift Job only, 'one-off' = One-Off Job only, '' = both
      const cwIsShiftOnly  = isCW && casualJobType === 'shift'
      const cwIsOneOffOnly = isCW && casualJobType === 'one-off'
      const header = isCW
        ? cwIsShiftOnly
          ? ['Date', 'Name', 'Shift Time', 'Clock In', 'Clock Out', 'Total Hours', 'Hourly Rate']
          : cwIsOneOffOnly
            ? ['Date', 'Name', 'Shift Time', 'Clock In', 'Clock Out', 'Total Hours', 'Flat Rate']
            : ['Date', 'Name', 'Job Type', 'Shift Time', 'Clock In', 'Clock Out', 'Total Hours', 'Hourly Rate', 'Flat Rate']
        : hasDeptFilter
          ? ['Date', 'Role', 'Name', 'Shift Time', 'Clock In', 'Clock Out', 'Total Hours']
          : ['Date', 'Department', 'Role', 'Name', 'Shift Time', 'Clock In', 'Clock Out', 'Total Hours']
      const rows: string[][] = []

      // Round ISO timestamp to nearest 5-min slot; return ms (UTC)
      const roundToMs = (iso: string): number => {
        const d = new Date(iso)
        return Math.round(d.getTime() / (5 * 60000)) * (5 * 60000)
      }

      const fmtTime = (iso: string | null | undefined): string => {
        if (!iso) return '—'
        const ms = roundToMs(iso)
        const totalMin = Math.floor(ms / 60000) % (24 * 60)
        const h24 = Math.floor(totalMin / 60)
        const m = totalMin % 60
        const ampm = h24 < 12 ? 'AM' : 'PM'
        const displayH = h24 % 12 === 0 ? 12 : h24 % 12
        return `${displayH}:${String(m).padStart(2, '0')} ${ampm}`
      }

      const fmtShiftHour = (hhmm: string): string => {
        const [hStr, mStr] = hhmm.split(':')
        const h24 = parseInt(hStr, 10)
        const m = parseInt(mStr, 10)
        const ampm = h24 < 12 ? 'AM' : 'PM'
        const displayH = h24 % 12 === 0 ? 12 : h24 % 12
        return m === 0 ? `${displayH}${ampm}` : `${displayH}:${String(m).padStart(2, '0')}${ampm}`
      }

      const fmtDuration = (ms: number): string => {
        if (ms <= 0) return '—'
        const totalMin = Math.round(ms / 60000)
        const h = Math.floor(totalMin / 60)
        const m = totalMin % 60
        return h > 0 && m > 0 ? `${h}h ${m}m` : h > 0 ? `${h}h` : `${m}m`
      }

      // Apply the same role/dept/jobtype filters as the UI
      const filtered = allRecords.filter(rec => {
        const role = rec.assignee_role
        if (isCW) {
          if (role !== 'Casual Worker') return false
          if (casualJobType === 'shift' && rec.shift.is_open_ended) return false
          if (casualJobType === 'one-off' && !rec.shift.is_open_ended) return false
        } else {
          if (role === 'Casual Worker') return false
          if (selectedDeptId && rec.department_name !== selectedDeptId) return false
        }
        return true
      })

      for (const rec of filtered) {
        const breakMs = rec.record?.break_in_time && rec.record?.break_out_time
          ? roundToMs(rec.record.break_out_time) - roundToMs(rec.record.break_in_time)
          : 0
        const workMs = rec.record?.clock_in_time && rec.record?.clock_out_time
          ? roundToMs(rec.record.clock_out_time) - roundToMs(rec.record.clock_in_time) - breakMs
          : 0
        const hourlyRate = rec.assignee_hourly_rate
        const isOneOff = rec.shift.is_open_ended
        const shiftFlatRate = (rec.shift as any).flat_rate as number | null
        const shiftTime = isOneOff
          ? fmtShiftHour(rec.shift.start_time)
          : `${fmtShiftHour(rec.shift.start_time)}–${fmtShiftHour(rec.shift.end_time)}`
        if (isCW) {
          const baseRow = [
            rec.shift.shift_date,
            rec.assignee_name,
            shiftTime,
            fmtTime(rec.record?.clock_in_time),
            fmtTime(rec.record?.clock_out_time),
            fmtDuration(workMs),
          ]
          if (cwIsShiftOnly) {
            rows.push([...baseRow, hourlyRate != null ? `$${hourlyRate.toFixed(2)}/hr` : '—'])
          } else if (cwIsOneOffOnly) {
            rows.push([...baseRow, shiftFlatRate != null ? `$${shiftFlatRate.toFixed(2)}` : '—'])
          } else {
            rows.push([
              rec.shift.shift_date,
              rec.assignee_name,
              isOneOff ? 'One-Off Job' : 'Shift Job',
              shiftTime,
              fmtTime(rec.record?.clock_in_time),
              fmtTime(rec.record?.clock_out_time),
              fmtDuration(workMs),
              !isOneOff && hourlyRate != null ? `$${hourlyRate.toFixed(2)}/hr` : '—',
              isOneOff && shiftFlatRate != null ? `$${shiftFlatRate.toFixed(2)}` : '—',
            ])
          }
        } else if (hasDeptFilter) {
          rows.push([
            rec.shift.shift_date,
            rec.assignee_role,
            rec.assignee_name,
            shiftTime,
            fmtTime(rec.record?.clock_in_time),
            fmtTime(rec.record?.clock_out_time),
            fmtDuration(workMs),
          ])
        } else {
          rows.push([
            rec.shift.shift_date,
            rec.department_name ?? '—',
            rec.assignee_role,
            rec.assignee_name,
            shiftTime,
            fmtTime(rec.record?.clock_in_time),
            fmtTime(rec.record?.clock_out_time),
            fmtDuration(workMs),
          ])
        }
      }

      // Sort by date ascending
      rows.sort((a, b) => a[0].localeCompare(b[0]))

      const dateRange = fromDate && toDate ? `_${fromDate}_to_${toDate}` : fromDate ? `_from_${fromDate}` : toDate ? `_to_${toDate}` : ''
      let prefix: string
      if (isCW) {
        if (casualJobType === 'shift') prefix = 'Shift_Job'
        else if (casualJobType === 'one-off') prefix = 'One_Off_Job'
        else prefix = 'Casual_Worker'
      } else {
        prefix = selectedDeptId ? selectedDeptId.replace(/\s+/g, '_') : 'Internal_Staff'
      }
      const suffix = `${prefix}${dateRange}`

      if (format === 'pdf') {
        const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' })
        const dateLabel = fromDate && toDate ? `${fromDate} – ${toDate}` : fromDate ? `From ${fromDate}` : toDate ? `Up to ${toDate}` : 'All Dates'
        let reportTitle: string
        if (cwIsShiftOnly) reportTitle = `Shift Job Attendance Report  |  ${dateLabel}`
        else if (cwIsOneOffOnly) reportTitle = `One-Off Job Attendance Report  |  ${dateLabel}`
        else if (hasDeptFilter) reportTitle = `${selectedDeptId} Attendance Report  |  ${dateLabel}`
        else reportTitle = `Attendance Report  |  ${dateLabel}`
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(13)
        doc.text(reportTitle, 40, 36)
        let lastDate = ''
        autoTable(doc, {
          head: [header],
          body: rows,
          startY: 50,
          styles: { fontSize: 7.5, cellPadding: 4, font: 'helvetica' },
          headStyles: { fillColor: [249, 115, 22], textColor: 255, fontStyle: 'bold' },
          alternateRowStyles: { fillColor: [249, 250, 251] },
          margin: { left: 40, right: 40 },
          didDrawRow: (hookData) => {
            if (hookData.section !== 'body') return
            const rowDate = String(hookData.row.cells[0]?.text?.[0] ?? '')
            if (lastDate && rowDate !== lastDate) {
              // Draw divider at the top of this row, after row background is painted
              const y = hookData.row.y
              doc.setDrawColor(180, 180, 180)
              doc.setLineWidth(0.5)
              doc.line(
                hookData.settings.margin.left as number,
                y,
                doc.internal.pageSize.width - (hookData.settings.margin.right as number),
                y,
              )
              doc.setDrawColor(0)
            }
            lastDate = rowDate
          },
        })
        doc.save(`${suffix}.pdf`)
      } else {
        const csv = [header, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n')
        // Prepend UTF-8 BOM (﻿) so Excel on Windows opens the file with correct encoding
        const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url; a.download = `${suffix}.csv`; a.click()
        URL.revokeObjectURL(url)
      }
    } finally {
      setExportLoading(false)
    }
  }, [companyId, recordsRole, selectedDeptId, casualJobType])

  // ── Absence reason lookups ────────────────────────────────────────────────
  // approved leave: userId+date → label
  const leaveByUserDate = useMemo(() => {
    const map = new Map<string, string>()
    timeOffRequests.forEach(r => {
      if (r.status === 'approved' && r.shift_date) {
        const label = r.request_type === 'leave' ? 'On Leave' : 'Time Off'
        map.set(`${r.requester_id}|${r.shift_date}`, label)
      }
    })
    return map
  }, [timeOffRequests])

  // approved fixed off: userId+weekday (0=Sun…6=Sat) → true
  const fixedOffByUserWeekday = useMemo(() => {
    const map = new Map<string, boolean>()
    fixedOffDayRequests.forEach(r => {
      if (r.status === 'approved') map.set(`${r.user_id}|${r.weekday}`, true)
    })
    return map
  }, [fixedOffDayRequests])

  // ── Pending counts ────────────────────────────────────────────────────────
  const pendingSwapCount = swapRequests.filter(r => r.status === 'pending').length
  const pendingLeaveCount = timeOffRequests.filter(r => r.status === 'pending').length
  const pendingFixedOffCount = fixedOffDayRequests.filter(r => r.status === 'pending').length
  const totalPendingRequests = pendingSwapCount + pendingLeaveCount + pendingFixedOffCount

  const mainTabs = [
    { key: 'records' as const, label: 'Records' },
    { key: 'requests' as const, label: 'Requests', count: reqLoading ? undefined : totalPendingRequests },
  ]

  const reqSubTabs = [
    { key: 'swaps' as const, label: 'Shift Swaps', count: reqLoading ? undefined : pendingSwapCount },
    { key: 'fixedoff' as const, label: 'Fixed Day Off', count: reqLoading ? undefined : pendingFixedOffCount },
    { key: 'leave' as const, label: 'Leave Requests', count: reqLoading ? undefined : pendingLeaveCount },
  ]

  const sectionHeaderStyle: React.CSSProperties = {
    padding: '14px 18px', borderBottom: '1px solid #F0F4F8', display: 'flex', alignItems: 'center', gap: 10,
  }

  // ── Today's date key for AR status reference ──────────────────────────────
  const todayKey = useMemo(() => new Date().toISOString().slice(0, 10), [])

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#F1F5F9' }}>
      <style>{`
        @keyframes fadeSlideUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes deptCardIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        .att-request-card { transition: box-shadow 0.18s ease, transform 0.18s ease; animation: fadeSlideUp 0.26s ease both; }
        .att-request-card:hover { box-shadow: 0 8px 22px rgba(15,23,42,0.08); transform: translateY(-2px); }
        .ar-row-hover:hover { background: #F8FAFC !important; }
      `}</style>
      <OwnerSidebar />
      <main style={{ marginLeft: '64px', flex: 1, minHeight: '100vh', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>

        {/* ── Page header ────────────────────────────────────────────────── */}
        <div style={{ padding: '20px 28px 16px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 24, flexShrink: 0 }}>
          <h1 className="mb-0 font-heading text-3xl font-bold tracking-tight text-gray-950">Attendance</h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0, paddingTop: 4 }}>
            {internalUserId && <OwnerUserBadge userId={internalUserId} companyId={companyId} />}
            {companyId && <OwnerPlanBadge plan={currentPlan} currentCompanyId={companyId} />}
          </div>
        </div>

        {/* ── Main tab bar ───────────────────────────────────────────────── */}
        <div style={{ padding: '0 28px 16px', flexShrink: 0 }}>
          <CapsuleTabBar tabs={mainTabs} active={mainTab} onChange={setMainTab} />
        </div>

        {/* ══════════════════════════════════════════════════════════════════
            RECORDS TAB
        ══════════════════════════════════════════════════════════════════ */}
        {mainTab === 'records' && (() => {
          return (
          <>
<div style={{ padding: '0 28px 28px', display: 'grid', gridTemplateColumns: 'minmax(300px, 326px) minmax(0, 1fr)', gap: 16, alignItems: 'start' }}>

            {/* ── LEFT: Department + Casual Worker panels ── */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <section style={{ background: '#FFFFFF', border: `1px solid ${PANEL_BORDER}`, borderRadius: 14, overflow: 'hidden' }}>
              <div style={{ padding: '14px 18px', borderBottom: `1px solid ${PANEL_BORDER}`, display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 30, height: 30, borderRadius: 9, background: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <UserCog size={15} style={{ color: '#2563EB' }} />
                </div>
                <span style={{ fontSize: 18, fontWeight: 700, color: '#0F172A', letterSpacing: '-0.2px', lineHeight: 1.2 }}>Internal Staffs</span>
              </div>
              <div style={{ padding: '12px 14px', display: 'grid', gap: 10 }}>
                {deptGroups.length === 0 ? (
                  <div style={{ minHeight: 100, display: 'grid', placeItems: 'center', color: '#9CA3AF', fontWeight: 600, fontSize: 13 }}>No data this week.</div>
                ) : deptGroups.map((group, idx) => {
                  const color = deptColor(group.deptId)
                  const isSelected = selectedDeptId === group.deptId
                  const managerCount = [...group.people.values()].filter(p => p.role === 'Manager').length
                  const staffCount = [...group.people.values()].filter(p => p.role !== 'Manager').length
                  return (
                    <article
                      key={group.deptId}
                      onClick={() => { setSelectedDeptId(isSelected ? null : group.deptId); setCasualJobType(null); setRecordsRole('') }}
                      style={{
                        display: 'flex', flexDirection: 'column', gap: 10,
                        minHeight: 80, border: `1px solid ${isSelected ? color : PANEL_BORDER}`,
                        borderRadius: 10, padding: '14px 16px',
                        background: isSelected ? `${color}0d` : '#F9FAFB',
                        cursor: 'pointer', overflow: 'hidden',
                        transition: 'box-shadow 0.18s, transform 0.18s, border-color 0.18s, background 0.18s',
                        animation: `deptCardIn 0.28s ease both ${idx * 55}ms`,
                        boxShadow: isSelected ? `0 4px 16px ${color}22` : undefined,
                      }}
                      onMouseEnter={e => { if (!isSelected) { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = '0 10px 28px rgba(15,23,42,0.11)'; e.currentTarget.style.borderColor = color } }}
                      onMouseLeave={e => { if (!isSelected) { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.borderColor = PANEL_BORDER } }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                        <span style={{ width: 8, height: 8, borderRadius: 999, background: color, flexShrink: 0 }} />
                        <h3 style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 700, color: TEXT_DARK, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{group.deptName}</h3>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, borderRadius: 999, background: '#FFF7ED', color: '#EA580C', flexShrink: 0 }}>
                            <UserCog size={14} />
                          </span>
                          <span style={{ color: '#111827', fontSize: 15, fontWeight: 600 }}>{managerCount}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, borderRadius: 999, background: '#F3F4F6', color: '#4B5563', flexShrink: 0 }}>
                            <UserRound size={14} />
                          </span>
                          <span style={{ color: '#111827', fontSize: 15, fontWeight: 600 }}>{staffCount}</span>
                        </div>
                      </div>
                    </article>
                  )
                })}
              </div>
            </section>
            {/* ── Casual Worker filter panel ── */}
            <section style={{ background: '#FFFFFF', border: `1px solid ${PANEL_BORDER}`, borderRadius: 14, overflow: 'hidden' }}>
              <div style={{ padding: '14px 18px', borderBottom: `1px solid ${PANEL_BORDER}`, display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 30, height: 30, borderRadius: 9, background: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <UserRound size={15} style={{ color: '#2563EB' }} />
                </div>
                <span style={{ fontSize: 18, fontWeight: 700, color: '#0F172A', letterSpacing: '-0.2px', lineHeight: 1.2 }}>Casual Workers</span>
              </div>
              <div style={{ padding: '12px 14px', display: 'grid', gap: 10 }}>
                {([
                  { key: 'all' as const,      label: 'All',       desc: 'All casual worker shifts' },
                  { key: 'shift' as const,     label: 'Shift Job', desc: 'Regular recurring shifts' },
                  { key: 'one-off' as const,   label: 'One-Off',   desc: 'Single open-ended shifts' },
                ] as const).map((opt, idx) => {
                  const isActive = casualJobType === opt.key
                  const BLUE = '#2563EB'
                  return (
                    <article
                      key={opt.key}
                      onClick={() => {
                        if (isActive) {
                          setCasualJobType(null)
                          setRecordsRole('')
                        } else {
                          setCasualJobType(opt.key)
                          setRecordsRole('Casual Worker')
                          setSelectedDeptId(null)
                        }
                      }}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        border: `1px solid ${isActive ? BLUE : PANEL_BORDER}`,
                        borderRadius: 10, padding: '12px 14px',
                        background: isActive ? '#EFF6FF' : '#F9FAFB',
                        cursor: 'pointer',
                        transition: 'box-shadow 0.18s, transform 0.18s, border-color 0.18s, background 0.18s',
                        animation: `deptCardIn 0.28s ease both ${idx * 55}ms`,
                        boxShadow: isActive ? `0 4px 16px ${BLUE}22` : undefined,
                      }}
                      onMouseEnter={e => { if (!isActive) { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 20px rgba(15,23,42,0.10)'; e.currentTarget.style.borderColor = BLUE } }}
                      onMouseLeave={e => { if (!isActive) { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.borderColor = PANEL_BORDER } }}
                    >
                      <span style={{ width: 8, height: 8, borderRadius: 999, background: isActive ? BLUE : '#94A3B8', flexShrink: 0 }} />
                      <span style={{ fontSize: '0.9375rem', fontWeight: 700, color: isActive ? BLUE : '#374151' }}>{opt.label}</span>
                    </article>
                  )
                })}
              </div>
            </section>
            </div>{/* /left column */}

            {/* ── RIGHT: AR Timeline — exact Shift page structure ── */}
            <section style={{ background: '#FFFFFF', border: `1px solid ${PANEL_BORDER}`, borderRadius: 14, display: 'flex', flexDirection: 'column' }}>

              {/* Section header with borderBottom — same as Shift page */}
              {(() => {
                const fmtD = (d: Date) => `${String(d.getDate()).padStart(2, '0')} ${d.toLocaleDateString('en-AU', { month: 'short' })}`
                const rangeLabel = `${fmtD(arWindowStart)} – ${fmtD(arWindowEnd)} ${arWindowEnd.getFullYear()}`
                return (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '14px 18px', borderBottom: `1px solid ${PANEL_BORDER}`, flexWrap: 'wrap', flexShrink: 0 }}>
                    {/* Left: title + legend */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 30, height: 30, borderRadius: 9, background: '#FFF7ED', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <CalendarDays size={15} style={{ color: '#F97316' }} />
                        </div>
                        <span style={{ fontSize: 18, fontWeight: 700, color: '#0F172A', letterSpacing: '-0.2px', lineHeight: 1.2 }}>Attendance Records</span>
                        {weekLoading && <Spinner size={13} dark />}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                        {([
                          { status: 'present' as ARStatus, label: 'Present' },
                          { status: 'late' as ARStatus, label: 'Late' },
                          { status: 'absent' as ARStatus, label: 'Absent' },
                        ] as const).map(item => (
                          <div key={item.status} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                            <ARStatusIcon status={item.status} />
                            <span style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>{item.label}</span>
                          </div>
                        ))}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                          <span style={{ width: 9, height: 9, borderRadius: '50%', background: '#CBD5E1', display: 'inline-block', flexShrink: 0 }} />
                          <span style={{ fontSize: 13, fontWeight: 600, color: '#64748B' }}>No shift</span>
                        </div>
                      </div>
                    </div>
                    {/* Right: Export + search + date range */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <button onClick={() => setExportOpen(true)}
                        style={{ height: 34, padding: '0 12px', borderRadius: 8, border: `1px solid ${PANEL_BORDER}`, background: '#FFFFFF', color: '#374151', fontWeight: 700, fontSize: 12.5, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
                        <Download size={12} /> Export
                      </button>
                      <input
                        value={recordsKeyword}
                        onChange={e => setRecordsKeyword(e.target.value)}
                        placeholder="Search name..."
                        style={{ height: 34, padding: '0 12px', border: `1px solid ${PANEL_BORDER}`, borderRadius: 8, fontSize: 13, color: TEXT_DARK, background: '#FFFFFF', outline: 'none', width: 148, fontFamily: 'inherit' }}
                      />
                      <button
                        type="button"
                        onClick={() => setArWindowOffset(o => o - 7)}
                        style={{ width: 34, height: 34, borderRadius: 8, border: `1px solid ${PANEL_BORDER}`, background: '#FFFFFF', display: 'inline-grid', placeItems: 'center', cursor: 'pointer', color: '#374151' }}
                        title="Previous 7 days"
                      >
                        <ChevronLeft size={15} />
                      </button>
                      <span style={{ fontSize: 13, fontWeight: 500, color: '#0F172A', padding: '0 12px', height: 34, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, border: `1px solid ${PANEL_BORDER}`, borderRadius: 8, background: '#FFFFFF', whiteSpace: 'nowrap' }}>
                        <CalendarDays size={13} color="#64748B" style={{ flexShrink: 0 }} />
                        {rangeLabel}
                      </span>
                      <button
                        type="button"
                        onClick={() => setArWindowOffset(o => Math.min(0, o + 7))}
                        disabled={arWindowOffset === 0}
                        style={{ width: 34, height: 34, borderRadius: 8, border: `1px solid ${PANEL_BORDER}`, background: '#FFFFFF', display: 'inline-grid', placeItems: 'center', cursor: arWindowOffset === 0 ? 'not-allowed' : 'pointer', color: arWindowOffset === 0 ? '#CBD5E1' : '#374151', opacity: arWindowOffset === 0 ? 0.5 : 1 }}
                        title="Next 7 days"
                      >
                        <ChevronRight size={15} />
                      </button>
                    </div>
                  </div>
                )
              })()}

              {/* Timeline body — exact Shift page renderCalendarView structure */}
              <div style={{ overflowX: 'auto', padding: '14px 16px 18px 18px' }}>
                <div style={{ minWidth: 700, borderRadius: 12, overflow: 'hidden', border: `1px solid ${PANEL_BORDER}` }}>

                  {/* Column header row */}
                  <div style={{ display: 'grid', gridTemplateColumns: '180px repeat(7, 1fr)', background: 'linear-gradient(135deg,#0F172A 0%,#1E293B 100%)', height: 54 }}>
                    <div style={{ padding: '10px 14px', borderRight: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center' }} />
                    {weekDates.map(date => {
                      const d = new Date(date + 'T00:00:00')
                      const dayNum = String(d.getDate()).padStart(2, '0')
                      const month = d.toLocaleDateString('en-AU', { month: 'short' })
                      const weekday = d.toLocaleDateString('en-AU', { weekday: 'long' })
                      const isToday = date === todayKey
                      return (
                        <div key={date} style={{ padding: '10px 8px', borderRight: '1px solid rgba(255,255,255,0.08)', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                          <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: isToday ? '#F97316' : 'rgba(255,255,255,0.85)', letterSpacing: '0.01em', lineHeight: 1.2 }}>{dayNum} {month}</p>
                          <p style={{ margin: '3px 0 0', fontSize: 12, fontWeight: 500, color: isToday ? '#F97316' : 'rgba(255,255,255,0.5)', letterSpacing: '0.01em', lineHeight: 1.2 }}>{weekday}</p>
                        </div>
                      )
                    })}
                  </div>

                  {/* Body */}
                  {weekLoading ? (
                    <div style={{ padding: '48px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, color: '#9CA3AF' }}>
                      <Spinner size={18} dark />
                      <p style={{ margin: 0, fontWeight: 600, fontSize: 14 }}>Loading attendance…</p>
                    </div>
                  ) : filteredDeptGroups.length === 0 ? (
                    <div style={{ padding: '48px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, color: '#9CA3AF' }}>
                      <CalendarDays size={22} strokeWidth={1.5} />
                      <p style={{ margin: 0, fontWeight: 600, fontSize: 14 }}>No attendance records for this period</p>
                    </div>
                  ) : (() => {
                    const EDGE = '2px solid rgba(15,23,42,0.45)'
                    type PersonEntry = { name: string; role: string; deptId: string; deptName: string; profilePhotoUrl: string | null; byDate: Map<string, AttendanceDashboardRecord[]> }
                    // Build dept-ordered flat rows with dept boundary info
                    const deptRows: { deptId: string; people: [string, PersonEntry][] }[] = []
                    filteredDeptGroups.forEach(group => {
                      const sorted = [...group.people.entries()].sort((a, b) => {
                        const ra = a[1].role === 'Manager' ? 0 : a[1].role === 'Employee' ? 1 : 2
                        const rb = b[1].role === 'Manager' ? 0 : b[1].role === 'Employee' ? 1 : 2
                        return ra - rb || a[1].name.localeCompare(b[1].name)
                      })
                      deptRows.push({ deptId: group.deptId, people: sorted })
                    })
                    return (
                      <div style={{ borderLeft: EDGE, borderRight: EDGE, borderBottom: EDGE }}>
                        {deptRows.map(({ deptId, people }, deptIdx) => {
                          const isCWGroup = people[0]?.[1]?.role === 'Casual Worker'
                          const barColor = isCWGroup ? 'transparent' : deptColor(deptId)
                          return people.map(([userId, person], rowIdx) => {
                            const isDeptBoundary = !isCWGroup && deptIdx > 0 && rowIdx === 0
                            const borderTop = isDeptBoundary ? EDGE : `1px solid ${PANEL_BORDER}`
                            const isManager = person.role === 'Manager'
                            return (
                              <div
                                key={userId}
                                className="ar-row-hover"
                                style={{ display: 'grid', gridTemplateColumns: '180px repeat(7, 1fr)', height: 60, borderTop, background: '#FFFFFF' }}
                              >
                                {/* Color bar + name — exact Shift page style */}
                                <div style={{ display: 'flex', alignItems: 'center', borderRight: `1px solid ${PANEL_BORDER}`, overflow: 'hidden', height: 60 }}>
                                  <div style={{ width: 8, alignSelf: 'stretch', flexShrink: 0, background: barColor, opacity: 0.85 }} />
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 10px 0 12px', minWidth: 0, flex: 1 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 26, height: 26, flexShrink: 0, background: person.profilePhotoUrl ? 'transparent' : (isManager ? '#FFF7ED' : person.role === 'Employee' ? '#F3F4F6' : '#EFF6FF'), color: isManager ? '#EA580C' : '#4B5563', borderRadius: 999, overflow: 'hidden' }}>
                                      {person.profilePhotoUrl
                                        ? <img src={person.profilePhotoUrl} alt={person.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                        : isManager ? <UserCog size={13} /> : <UserRound size={13} />}
                                    </div>
                                    <span style={{ fontSize: '0.9375rem', fontWeight: 600, color: '#111827', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{person.name}</span>
                                  </div>
                                </div>

                                {/* 7 date cells — Shift page pill style */}
                                {weekDates.map(date => {
                                  const isToday = date === todayKey
                                  const dayRows = person.byDate.get(date) ?? []
                                  // Sort: worst status first (absent > late > present)
                                  const sorted = [...dayRows].sort((a, b) => {
                                    const order = { absent: 0, late: 1, present: 2, 'no-shift': 3 }
                                    return order[getARStatus(a)] - order[getARStatus(b)]
                                  })
                                  return (
                                    <div
                                      key={date}
                                      style={{
                                        padding: '0 6px', borderRight: `1px solid ${PANEL_BORDER}`,
                                        height: 60, display: 'flex', flexDirection: 'column',
                                        alignItems: 'stretch', justifyContent: 'center', gap: 4,
                                        background: isToday ? 'rgba(249,115,22,0.05)' : 'transparent',
                                      }}
                                    >
                                      {sorted.length === 0 ? (() => {
                                        const d = new Date(date + 'T00:00:00')
                                        const weekday = d.getDay() // 0=Sun…6=Sat
                                        const leaveLabel = leaveByUserDate.get(`${userId}|${date}`)
                                        const isFixedOff = fixedOffByUserWeekday.get(`${userId}|${weekday}`)
                                        if (leaveLabel) return (
                                          <div style={{ borderRadius: 999, background: '#EFF6FF', border: '1.5px solid #93C5FD', display: 'flex', alignItems: 'center', justifyContent: 'center', height: 32, gap: 4 }}>
                                            <Calendar size={11} color="#2563EB" />
                                            <span style={{ fontSize: 11, fontWeight: 600, color: '#2563EB', whiteSpace: 'nowrap' }}>{leaveLabel}</span>
                                          </div>
                                        )
                                        if (isFixedOff) return (
                                          <div style={{ borderRadius: 999, background: '#F5F3FF', border: '1.5px solid #C4B5FD', display: 'flex', alignItems: 'center', justifyContent: 'center', height: 32, gap: 4 }}>
                                            <Calendar size={11} color="#7C3AED" />
                                            <span style={{ fontSize: 11, fontWeight: 600, color: '#7C3AED', whiteSpace: 'nowrap' }}>Fixed Off</span>
                                          </div>
                                        )
                                        return (
                                          <div style={{ borderRadius: 999, background: '#E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'center', height: 32 }}>
                                            <span style={{ fontSize: 10, fontWeight: 600, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Off</span>
                                          </div>
                                        )
                                      })() : null}
                                      {sorted.length > 0 ? sorted.map((rec, ri) => {
                                        const st = getARStatus(rec)
                                        const pillBorder =
                                          st === 'absent' ? '1.5px solid #EF4444' :
                                          st === 'late'   ? '1.5px solid #F59E0B' :
                                                            '1.5px solid #10B981'
                                        return (
                                          <button
                                            key={ri}
                                            onClick={() => openReview(rec)}
                                            style={{
                                              display: 'grid',
                                              gridTemplateColumns: '20px 1fr 20px',
                                              alignItems: 'center',
                                              padding: '0 4px',
                                              height: 32, flexShrink: 0,
                                              background: st === 'absent' ? '#FEF2F2' : st === 'late' ? '#FFFBEB' : '#ECFDF5',
                                              border: pillBorder,
                                              borderRadius: 999, cursor: 'pointer', width: '100%',
                                            }}
                                            onMouseEnter={e => { e.currentTarget.style.filter = 'brightness(0.96)' }}
                                            onMouseLeave={e => { e.currentTarget.style.filter = 'none' }}
                                          >
                                            <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}><ARStatusIcon status={st} /></span>
                                            <span style={{ fontSize: 12, fontWeight: 600, color: '#0F172A', whiteSpace: 'nowrap', textAlign: 'center' }}>
                                              {formatShiftHour(rec.shift.start_time)}–{formatShiftHour(rec.shift.end_time)}
                                            </span>
                                            <span />
                                          </button>
                                        )
                                      }) : null}
                                    </div>
                                  )
                                })}
                              </div>
                            )
                          })
                        })}
                      </div>
                    )
                  })()}

                </div>{/* /minWidth */}
              </div>{/* /overflowX+padding */}
            </section>{/* /AR right section */}
          </div>{/* /two-col grid */}
          </>
          )
        })()}

        {/* ══════════════════════════════════════════════════════════════════
            REQUESTS TAB
        ══════════════════════════════════════════════════════════════════ */}
        {mainTab === 'requests' && (
          <div style={{ padding: '0 28px 28px', display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* Sub tab bar + refresh */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <CapsuleTabBar tabs={reqSubTabs} active={reqTab} onChange={setReqTab} />
              <button
                onClick={() => fetchRequestData(companyId)}
                disabled={reqLoading || !companyId}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 36, border: '1px solid #E5E7EB', borderRadius: 9, background: '#FFFFFF', color: '#0F172A', padding: '0 13px', fontWeight: 700, fontSize: 13, cursor: reqLoading || !companyId ? 'default' : 'pointer', opacity: reqLoading || !companyId ? 0.55 : 1, boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}
              >
                {reqLoading ? <Spinner size={14} dark /> : <RefreshCw size={14} />} Refresh
              </button>
            </div>

            {reqError && (
              <div style={{ padding: 12, background: '#FEF2F2', border: '1px solid #FECACA', color: '#B91C1C', borderRadius: 8, fontSize: '0.84rem', fontWeight: 800 }}>{reqError}</div>
            )}

            {/* ── Shift Swaps ─────────────────────────────────────────────── */}
            {reqTab === 'swaps' && (
              <section style={{ background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: 12, overflow: 'hidden' }}>
                <div style={sectionHeaderStyle}>
                  <div style={{ width: 30, height: 30, borderRadius: 9, background: '#FFF7ED', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <ArrowLeftRight size={14} style={{ color: '#F97316' }} />
                  </div>
                  <span style={{ fontSize: '0.875rem', fontWeight: 700, color: '#111827', flex: 1 }}>Shift Swap Requests</span>
                </div>
                {reqLoading ? (
                  <div style={{ padding: '24px 16px', color: '#9CA3AF', fontSize: '0.875rem', display: 'flex', gap: 8, alignItems: 'center' }}><Spinner size={15} dark /> Loading...</div>
                ) : swapRequests.length === 0 ? (
                  <div style={{ padding: '24px 16px', color: '#9CA3AF', fontSize: '0.875rem', textAlign: 'center' }}>No shift swap requests.</div>
                ) : swapRequests.map(req => {
                  const color = statusColor(req.status)
                  return (
                    <div key={req.id} className="att-request-card" style={{ padding: '14px 16px', borderBottom: '1px solid #F8FAFC' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 6 }}>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                            <strong style={{ fontSize: '0.875rem', color: '#111827' }}>{req.requester_name}</strong>
                            <ArrowLeftRight size={11} style={{ color: '#9CA3AF' }} />
                            <strong style={{ fontSize: '0.875rem', color: '#111827' }}>{req.replacement_name}</strong>
                          </div>
                          <p style={{ margin: 0, fontSize: '0.775rem', color: '#6B7280' }}>
                            {req.shift_title ?? 'Shift'} | {req.shift_date ?? '-'} | {formatTime(req.start_time)} - {formatTime(req.end_time)}
                          </p>
                        </div>
                        <span style={{ background: color.bg, color: color.text, borderRadius: 999, padding: '2px 9px', fontSize: '0.65rem', fontWeight: 900, flexShrink: 0, height: 'fit-content' }}>{req.status}</span>
                      </div>
                      {req.reason && <p style={{ margin: '0 0 10px', fontSize: '0.78rem', color: '#4B5563', lineHeight: 1.4 }}>{req.reason}</p>}
                      {req.status === 'pending' && (
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button onClick={() => decideRequest('decide_shift_swap', req.id, 'approved')} disabled={reqActionLoading} style={{ flex: 1, border: 'none', borderRadius: 7, background: '#059669', color: '#FFFFFF', padding: '7px 0', fontSize: '0.76rem', fontWeight: 700, cursor: reqActionLoading ? 'default' : 'pointer', opacity: reqActionLoading ? 0.5 : 1 }}>Approve</button>
                          <button onClick={() => decideRequest('decide_shift_swap', req.id, 'rejected')} disabled={reqActionLoading} style={{ flex: 1, border: 'none', borderRadius: 7, background: '#DC2626', color: '#FFFFFF', padding: '7px 0', fontSize: '0.76rem', fontWeight: 700, cursor: reqActionLoading ? 'default' : 'pointer', opacity: reqActionLoading ? 0.5 : 1 }}>Reject</button>
                        </div>
                      )}
                    </div>
                  )
                })}
              </section>
            )}

            {/* ── Fixed Day Off ────────────────────────────────────────────── */}
            {reqTab === 'fixedoff' && (
              <section style={{ background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: 12, overflow: 'hidden' }}>
                <div style={sectionHeaderStyle}>
                  <div style={{ width: 30, height: 30, borderRadius: 9, background: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Calendar size={14} style={{ color: '#2563EB' }} />
                  </div>
                  <span style={{ fontSize: '0.875rem', fontWeight: 700, color: '#111827', flex: 1 }}>Fixed Day Off Requests</span>
                </div>
                {reqLoading ? (
                  <div style={{ padding: '24px 16px', color: '#9CA3AF', fontSize: '0.875rem', display: 'flex', gap: 8, alignItems: 'center' }}><Spinner size={15} dark /> Loading...</div>
                ) : fixedOffDayRequests.length === 0 ? (
                  <div style={{ padding: '24px 16px', color: '#9CA3AF', fontSize: '0.875rem', textAlign: 'center' }}>No fixed day off requests.</div>
                ) : fixedOffDayRequests.map(req => {
                  const color = statusColor(req.status)
                  return (
                    <div key={req.id} className="att-request-card" style={{ padding: '14px 16px', borderBottom: '1px solid #F8FAFC' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 6 }}>
                        <div>
                          <strong style={{ fontSize: '0.875rem', color: '#111827' }}>{req.requester_name}</strong>
                          <p style={{ margin: '3px 0 0', fontSize: '0.775rem', color: '#374151', fontWeight: 600 }}>{WEEKDAYS[req.weekday]}</p>
                        </div>
                        <span style={{ background: color.bg, color: color.text, borderRadius: 999, padding: '2px 9px', fontSize: '0.65rem', fontWeight: 900, flexShrink: 0, height: 'fit-content' }}>{req.status}</span>
                      </div>
                      {req.status === 'pending' && (
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button onClick={() => decideRequest('decide_fixed_off_day', req.id, 'approved')} disabled={reqActionLoading} style={{ flex: 1, border: 'none', borderRadius: 7, background: '#059669', color: '#FFFFFF', padding: '7px 0', fontSize: '0.76rem', fontWeight: 700, cursor: reqActionLoading ? 'default' : 'pointer', opacity: reqActionLoading ? 0.5 : 1 }}>Approve</button>
                          <button onClick={() => decideRequest('decide_fixed_off_day', req.id, 'rejected')} disabled={reqActionLoading} style={{ flex: 1, border: 'none', borderRadius: 7, background: '#DC2626', color: '#FFFFFF', padding: '7px 0', fontSize: '0.76rem', fontWeight: 700, cursor: reqActionLoading ? 'default' : 'pointer', opacity: reqActionLoading ? 0.5 : 1 }}>Reject</button>
                        </div>
                      )}
                    </div>
                  )
                })}
              </section>
            )}

            {/* ── Leave Requests ───────────────────────────────────────────── */}
            {reqTab === 'leave' && (
              <section style={{ background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: 12, overflow: 'hidden' }}>
                <div style={sectionHeaderStyle}>
                  <div style={{ width: 30, height: 30, borderRadius: 9, background: '#F0FDF4', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <ShieldCheck size={14} style={{ color: '#059669' }} />
                  </div>
                  <span style={{ fontSize: '0.875rem', fontWeight: 700, color: '#111827', flex: 1 }}>Leave Requests</span>
                </div>
                {reqLoading ? (
                  <div style={{ padding: '24px 16px', color: '#9CA3AF', fontSize: '0.875rem', display: 'flex', gap: 8, alignItems: 'center' }}><Spinner size={15} dark /> Loading...</div>
                ) : timeOffRequests.length === 0 ? (
                  <div style={{ padding: '24px 16px', color: '#9CA3AF', fontSize: '0.875rem', textAlign: 'center' }}>No leave requests.</div>
                ) : timeOffRequests.map(req => {
                  const color = statusColor(req.status)
                  return (
                    <div key={req.id} className="att-request-card" style={{ padding: '14px 16px', borderBottom: '1px solid #F8FAFC' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 6 }}>
                        <div>
                          <strong style={{ fontSize: '0.875rem', color: '#111827' }}>{requestTypeLabel(req.request_type)}</strong>
                          <p style={{ margin: '3px 0 0', fontSize: '0.775rem', color: '#374151', fontWeight: 600 }}>{req.requester_name}</p>
                          <p style={{ margin: '2px 0 0', fontSize: '0.75rem', color: '#6B7280' }}>
                            {req.shift_date ?? '-'} | {formatTime(req.start_time)} - {formatTime(req.end_time)}
                          </p>
                        </div>
                        <span style={{ background: color.bg, color: color.text, borderRadius: 999, padding: '2px 9px', fontSize: '0.65rem', fontWeight: 900, flexShrink: 0, height: 'fit-content' }}>{req.status}</span>
                      </div>
                      {req.reason && <p style={{ margin: '0 0 10px', fontSize: '0.78rem', color: '#4B5563', lineHeight: 1.4 }}>{req.reason}</p>}
                      {req.status === 'pending' && (
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button onClick={() => decideRequest('decide_time_off', req.id, 'approved')} disabled={reqActionLoading} style={{ flex: 1, border: 'none', borderRadius: 7, background: '#059669', color: '#FFFFFF', padding: '7px 0', fontSize: '0.76rem', fontWeight: 700, cursor: reqActionLoading ? 'default' : 'pointer', opacity: reqActionLoading ? 0.5 : 1 }}>Approve</button>
                          <button onClick={() => decideRequest('decide_time_off', req.id, 'rejected')} disabled={reqActionLoading} style={{ flex: 1, border: 'none', borderRadius: 7, background: '#DC2626', color: '#FFFFFF', padding: '7px 0', fontSize: '0.76rem', fontWeight: 700, cursor: reqActionLoading ? 'default' : 'pointer', opacity: reqActionLoading ? 0.5 : 1 }}>Reject</button>
                        </div>
                      )}
                    </div>
                  )
                })}
              </section>
            )}
          </div>
        )}

      </main>

      {/* ── Export modal ─────────────────────────────────────────────────── */}
      {exportOpen && (
        <ModalOverlay onClose={() => setExportOpen(false)} maxWidth="420px">
          <ModalBox>
            <ModalHeader title="Export Attendance" icon={<Download size={15} color="#fff" strokeWidth={2.5} />} onClose={() => setExportOpen(false)} />

            <div style={{ padding: '0 24px', display: 'flex', flexDirection: 'column' }}>
              {/* Date range */}
              <div style={{ padding: '16px 0', borderBottom: '1px solid #F3F4F6' }}>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#6B7280', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Date Range</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 600, color: '#9CA3AF', marginBottom: 5 }}>From</label>
                    <input type="date" value={exportFrom} onChange={e => setExportFrom(e.target.value)}
                      style={{ width: '100%', padding: '9px 11px', border: '1.5px solid #E5E7EB', borderRadius: 8, fontSize: '0.875rem', color: '#111827', outline: 'none', boxSizing: 'border-box', background: '#FAFAFA' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 600, color: '#9CA3AF', marginBottom: 5 }}>To</label>
                    <input type="date" value={exportTo} onChange={e => setExportTo(e.target.value)}
                      style={{ width: '100%', padding: '9px 11px', border: '1.5px solid #E5E7EB', borderRadius: 8, fontSize: '0.875rem', color: '#111827', outline: 'none', boxSizing: 'border-box', background: '#FAFAFA' }} />
                  </div>
                </div>
              </div>

              {/* Format */}
              <div style={{ padding: '16px 0' }}>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#6B7280', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Format</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  {([
                    { key: 'csv', label: 'Excel / CSV', icon: '📊' },
                    { key: 'pdf', label: 'PDF',         icon: '📄' },
                  ] as const).map(({ key, label, icon }) => (
                    <button key={key} onClick={() => setExportFormat(key)} style={{
                      padding: '12px 0', borderRadius: 10,
                      border: `1.5px solid ${exportFormat === key ? '#F97316' : '#E5E7EB'}`,
                      background: exportFormat === key ? '#FFF7ED' : '#FAFAFA',
                      color: exportFormat === key ? '#EA580C' : '#6B7280',
                      fontWeight: 700, fontSize: '0.8125rem', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                      transition: 'border-color 0.15s, background 0.15s',
                    }}>
                      <span>{icon}</span> {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div style={{ padding: '12px 24px 20px', display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid #F3F4F6' }}>
              <button
                disabled={exportLoading}
                onClick={async () => { setExportOpen(false); await doExport(exportFrom, exportTo, exportFormat) }}
                style={modalPrimaryButtonStyle(exportLoading)}>
                <Download size={13} /> {exportLoading ? 'Exporting…' : 'Export'}
              </button>
            </div>
          </ModalBox>
        </ModalOverlay>
      )}

      {/* ── Attendance Record modal ───────────────────────────────────────── */}
      {reviewOpen && reviewRecord?.record && (
        <ModalOverlay onClose={() => setReviewOpen(false)} maxWidth="420px">
          <ModalBox>
            <ModalHeader title="Attendance Record" icon={<ShieldCheck size={15} color="#fff" strokeWidth={2.5} />} onClose={() => setReviewOpen(false)} />

            {/* Name + role header — matches team profile modal */}
            <div style={{ padding: '16px 24px', borderBottom: '1px solid #F3F4F6', display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ width: 44, height: 44, borderRadius: 999, background: reviewRecord.assignee_role === 'Manager' ? '#FFF7ED' : '#F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                {reviewRecord.assignee_profile_photo_url
                  ? <img src={reviewRecord.assignee_profile_photo_url} alt={reviewRecord.assignee_name} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 999 }} />
                  : <UserRound size={20} color={reviewRecord.assignee_role === 'Manager' ? '#EA580C' : '#4B5563'} />}
              </div>
              <div>
                <p style={{ fontWeight: 700, fontSize: '1rem', color: '#0F172A', margin: '0 0 5px' }}>{reviewRecord.assignee_name}</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: 999, fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', background: reviewRecord.assignee_role === 'Manager' ? '#FFF7ED' : '#F3F4F6', color: reviewRecord.assignee_role === 'Manager' ? '#EA580C' : '#4B5563' }}>
                    {reviewRecord.assignee_role}
                  </span>
                  {(() => {
                    const status = getARStatus(reviewRecord)
                    if (status === 'late') return <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: 999, fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', background: '#FEF9C3', color: '#A16207' }}>Late</span>
                    if (status === 'present') return <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: 999, fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', background: '#DCFCE7', color: '#15803D' }}>Present</span>
                    return null
                  })()}
                </div>
              </div>
            </div>

            {/* Read-only fields */}
            <div style={{ padding: '0 24px', display: 'flex', flexDirection: 'column' }}>
              {[
                ...(reviewRecord.assignee_role === 'Casual Worker'
                  ? [
                      { label: 'Job Type', value: reviewRecord.shift.is_open_ended ? 'One-off Job' : 'Shift Job' },
                      { label: 'Job Title', value: reviewRecord.shift.title ?? '—' },
                    ]
                  : [
                      { label: 'Department', value: reviewRecord.department_name ?? '—' },
                    ]
                ),
                { label: 'Date', value: reviewRecord.shift.shift_date },
                ...(reviewRecord.shift.is_open_ended
                  ? [{ label: 'Start Time', value: formatShiftHour(reviewRecord.shift.start_time) }]
                  : [{ label: 'Shift Time', value: `${formatShiftHour(reviewRecord.shift.start_time)} – ${formatShiftHour(reviewRecord.shift.end_time)}` }]
                ),
              ].map(field => (
                <div key={field.label} style={{ padding: '14px 0', borderBottom: '1px solid #F3F4F6' }}>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#6B7280', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{field.label}</label>
                  <p style={{ fontSize: '0.9375rem', color: '#111827', margin: 0 }}>{field.value}</p>
                </div>
              ))}

              {/* Editable clock times */}
              <div style={{ padding: '14px 0', borderBottom: '1px solid #F3F4F6', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#6B7280', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Clock In</label>
                  <div style={{ position: 'relative' }}>
                    <select value={reviewClockIn} onChange={e => setReviewClockIn(e.target.value)} style={selectStyle}>
                      <option value="">-- select --</option>
                      {TIME_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                    <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: '#6B7280', fontSize: 12 }}>▾</span>
                  </div>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#6B7280', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Clock Out</label>
                  <div style={{ position: 'relative' }}>
                    <select value={reviewClockOut} onChange={e => setReviewClockOut(e.target.value)} style={selectStyle}>
                      <option value="">-- select --</option>
                      {TIME_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                    <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: '#6B7280', fontSize: 12 }}>▾</span>
                  </div>
                </div>
              </div>
            </div>

            {reviewError && <div style={modalErrorBoxStyle}>{reviewError}</div>}

            <div style={{ padding: '16px 24px 20px', display: 'flex', gap: 8, justifyContent: 'space-between', alignItems: 'center' }}>
              {/* CW-only: toggle active/inactive status */}
              {reviewRecord.assignee_role === 'Casual Worker' && (
                <button
                  onClick={toggleCwStatus}
                  disabled={cwStatusLoading}
                  style={{
                    border: 'none', borderRadius: 8, padding: '9px 16px', fontSize: '0.8rem', fontWeight: 700,
                    cursor: cwStatusLoading ? 'default' : 'pointer', opacity: cwStatusLoading ? 0.6 : 1,
                    background: cwWorkerStatus === 'active' ? '#FEE2E2' : '#DCFCE7',
                    color: cwWorkerStatus === 'active' ? '#DC2626' : '#15803D',
                  }}
                >
                  {cwStatusLoading ? '...' : cwWorkerStatus === 'active' ? 'Set Inactive' : 'Set Active'}
                </button>
              )}
              <div style={{ marginLeft: 'auto' }}>
                <button onClick={submitReview} disabled={reviewActionLoading} style={modalPrimaryButtonStyle(reviewActionLoading)}>
                  {reviewActionLoading ? <Spinner size={13} /> : <Check size={13} />} Save
                </button>
              </div>
            </div>
          </ModalBox>
        </ModalOverlay>
      )}

    </div>
  )
}
