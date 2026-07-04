'use client'

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'
import {
  AlertTriangle, ArrowLeftRight, BarChart3, Calendar, CalendarDays, Check, CheckCheck, ChevronDown, ChevronLeft, ChevronRight,
  ClipboardList, Clock, Download, Eye, FileText, Filter, Pencil, Plus, RefreshCw, Search, Settings, Sparkles, ThumbsDown, ThumbsUp, Trash2, UserCog, UserRound, UserX, X,
} from 'lucide-react'
import OwnerSidebar from '@/components/OwnerSidebar'
import RoleAvatar from '@/components/RoleAvatar'
import OwnerPlanBadge from '@/components/owner/PlanBadge'
import OwnerUserBadge from '@/components/owner/OwnerUserBadge'
import Spinner from '@/components/Spinner'
import { deptColor } from '@/lib/deptColor'
import {
  AttendanceDashboardRecord,
  AttendanceRequestStatus,
  FixedOffDaySource,
  FixedOffDayRequestView,
  ShiftSwapMovableTask,
  ShiftSwapRequestView,
} from '@/types/Attendance'
import { JobPosting } from '@/types/Recruitment'
import { ModalOverlay, ModalBox, ModalHeader, modalErrorBoxStyle, modalPrimaryButtonStyle, modalGhostButtonStyle, modalInputStyle, modalLabelStyle } from '@/components/modal'
import { ShowcaseCard } from '@/components/panel'
import DatePickerField from '@/components/DatePickerField'
import DropdownField from '@/components/DropdownField'
import Toast from '@/components/Toast'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { TimelineRow, TimelineShiftBlock } from '@/types/Timeline'

const PANEL_BORDER = '#E2E8F0'
const TEXT_DARK = '#0F172A'

// Shape returned by POST /api/attendance/ai-suggest for request_type: 'fixed_off_day'
interface FixedOffDayAISuggestion {
  recommendation: 'approve' | 'modify'
  confidence: number
  reason: string
  concerns: string[]
  alternatives: string[]
}

// A Manager/Employee submits one weekly request (e.g. "off Mon + Wed next week"), stored as one
// row per date but decided as a single unit — group by requester + week so Action Needed shows
// one card per weekly submission, not one per date.
interface FixedOffGroup {
  key: string
  user_id: string
  requester_name: string
  requester_role: string
  department_id: string | null
  week_start: string
  status: AttendanceRequestStatus
  source: FixedOffDaySource
  created_at: string
  reviewed_at: string | null
  requests: FixedOffDayRequestView[]
}

function groupFixedOff(rows: FixedOffDayRequestView[]): FixedOffGroup[] {
  const byKey = new Map<string, FixedOffGroup>()
  for (const req of rows) {
    const key = `${req.user_id}_${req.week_start}`
    const existing = byKey.get(key)
    if (existing) {
      existing.requests.push(req)
      if (new Date(req.created_at ?? 0).getTime() < new Date(existing.created_at ?? 0).getTime()) existing.created_at = req.created_at
      if (new Date(req.reviewed_at ?? req.created_at ?? 0).getTime() > new Date(existing.reviewed_at ?? existing.created_at ?? 0).getTime()) existing.reviewed_at = req.reviewed_at ?? req.created_at
    } else {
      byKey.set(key, {
        key, user_id: req.user_id, requester_name: req.requester_name, requester_role: req.requester_role,
        department_id: req.department_id, week_start: req.week_start, status: req.status, source: req.source,
        created_at: req.created_at, reviewed_at: req.reviewed_at ?? req.created_at, requests: [req],
      })
    }
  }
  for (const group of byKey.values()) {
    group.requests.sort((a, b) => a.request_date.localeCompare(b.request_date))
  }
  return [...byKey.values()]
}

// ─── helpers ─────────────────────────────────────────────────────────────────

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

function formatSwapDate(value: string | null | undefined): string {
  if (!value) return '-'
  const date = new Date(`${value}T00:00:00`)
  const weekday = date.toLocaleDateString('en-GB', { weekday: 'short' })
  const dayMonth = date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
  return `${weekday}, ${dayMonth}`
}

// "Tuesday [07 Jul]" — full weekday name + bracketed date, for a Fixed Off Day request's day list.
function formatFixedOffRequestDay(value: string): string {
  const date = new Date(`${value}T00:00:00`)
  const weekday = date.toLocaleDateString('en-GB', { weekday: 'long' })
  const dayMonth = date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
  return `${weekday} [${dayMonth}]`
}

function formatWeekDateRange(weekStart: string | null | undefined): string {
  if (!weekStart) return ''
  const start = new Date(`${weekStart}T00:00:00`)
  const end = addDays(start, 6)
  const formatDateOnly = (date: Date) => date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
  return `${formatDateOnly(start)} - ${formatDateOnly(end)}`
}

function formatOwnerDecisionTime(value: string | null | undefined): string {
  if (!value) return '-'
  const date = new Date(value)
  const weekday = date.toLocaleDateString('en-GB', { weekday: 'short' })
  const dayMonth = date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
  const hours = date.getHours()
  const minutes = date.getMinutes()
  const suffix = hours < 12 ? 'AM' : 'PM'
  const hour12 = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours
  const time = minutes === 0 ? `${hour12}${suffix}` : `${hour12}:${String(minutes).padStart(2, '0')}${suffix}`
  return `${weekday}, ${dayMonth}, ${time}`
}

function statusColor(status: string): { bg: string; text: string } {
  if (status === 'approved') return { bg: '#ECFDF5', text: '#047857' }
  if (status === 'rejected') return { bg: '#FEF2F2', text: '#B91C1C' }
  if (status === 'modified') return { bg: '#FFF7ED', text: '#C2410C' }
  return { bg: '#FFFBEB', text: '#B45309' }
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

// Mirrors attendanceService.resolveActiveSubmissionWeekStart exactly (same toISOString()-based
// todayKey, same Monday-offset math, same UTC deadline moment) — the week currently open for
// submission shifts forward each time a window's own deadline passes, so the header always names
// whichever week a fresh submission would actually land in, not a stale/already-closed one.
function resolveActiveSubmissionWeekStart(deadlineWeekday: number, deadlineTime: string): string {
  const todayKey = new Date().toISOString().slice(0, 10)
  let candidateWeekStart = computeWeekStartKey(todayKey)
  for (;;) {
    const targetWeek = toISODate(addDays(new Date(`${candidateWeekStart}T00:00:00`), 7))
    const offsetFromMonday = (deadlineWeekday + 6) % 7
    const deadlineDate = toISODate(addDays(new Date(`${candidateWeekStart}T00:00:00`), offsetFromMonday))
    const deadlineMoment = new Date(`${deadlineDate}T${deadlineTime}:00.000Z`)
    if (Date.now() <= deadlineMoment.getTime()) return targetWeek
    candidateWeekStart = targetWeek
  }
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
  tabs: { key: T; label: string; count?: number; dot?: boolean }[]
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
      style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: 4, background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: 999, boxShadow: '0 1px 4px rgba(0,0,0,0.05)', position: 'relative' }}
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
            {tab.count !== undefined && tab.count > 0 && (
              <span style={{ minWidth: 22, height: 22, padding: '0 7px', borderRadius: 999, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: isActive ? 'rgba(255,255,255,0.16)' : '#F1F5F9', color: isActive ? '#FFFFFF' : '#64748B', fontSize: 11, fontWeight: 900 }}>
                {tab.count}
              </span>
            )}
            {tab.dot && (
              <span style={{ width: 10, height: 10, borderRadius: 999, background: '#EF4444', flexShrink: 0, border: isActive ? '1.5px solid #111827' : '1.5px solid #fff' }} />
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

// Every 30-minute slot for 24h, value stored as 24h "HH:MM" (matches shifts.start_time convention),
// label shown as 12h "h:mm AM/PM" for the Submission Deadline time picker.
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

// ─── CurrentShiftsBlock ───────────────────────────────────────────────────────

function CurrentShiftsBlock({ show, deptName, rows, loading, panelBorder, highlightRequest, anchorDate, onNavigateDay }: {
  show: boolean
  deptName: string
  rows: TimelineRow[]
  loading: boolean
  panelBorder: string
  highlightRequest?: ShiftSwapRequestView | null
  anchorDate: string
  onNavigateDay: (dir: number) => void
}) {
  if (!show) return null
  const today = new Date()
  // Rolling 7-day window starting exactly at anchorDate (not snapped to Mon-Sun) — a swap can
  // straddle a calendar-week boundary, so the window must be free to start on any weekday.
  const mon = new Date(`${anchorDate}T00:00:00`)
  const csWeekDates: string[] = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(mon); d.setDate(mon.getDate() + i)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  })
  const todayKey2 = today.toISOString().slice(0, 10)
  const csIconButtonStyle: React.CSSProperties = {
    width: 34, height: 34, borderRadius: 8, border: `1px solid ${panelBorder}`,
    background: '#FFFFFF', display: 'inline-grid', placeItems: 'center', cursor: 'pointer', color: TEXT_DARK, flexShrink: 0,
  }
  const dc = deptColor(deptName)
  const sortedRows = [...rows].sort((a, b) => {
    const ra = a.role === 'Manager' ? 0 : 1
    const rb = b.role === 'Manager' ? 0 : 1
    return ra - rb || a.full_name.localeCompare(b.full_name)
  })
  const EDGE = '2px solid rgba(15,23,42,0.45)'
  const isSameClock = (a: string | null, b: string | null) => !!a && !!b && a.slice(0, 5) === b.slice(0, 5)
  const isHighlightedShift = (row: TimelineRow, shift: TimelineShiftBlock) => {
    if (!highlightRequest) return false
    if (
      shift.assignment_id &&
      (shift.assignment_id === highlightRequest.requester_assignment_id ||
       shift.assignment_id === highlightRequest.counterpart_assignment_id)
    ) return true

    const matchesRequester =
      row.user_id === highlightRequest.requester_id &&
      shift.shift_date === highlightRequest.requester_shift_date &&
      isSameClock(shift.start_time, highlightRequest.requester_start_time) &&
      isSameClock(shift.end_time, highlightRequest.requester_end_time)

    const matchesCounterpart =
      row.user_id === highlightRequest.counterpart_id &&
      shift.shift_date === highlightRequest.counterpart_shift_date &&
      isSameClock(shift.start_time, highlightRequest.counterpart_start_time) &&
      isSameClock(shift.end_time, highlightRequest.counterpart_end_time)

    return matchesRequester || matchesCounterpart
  }

  return (
    <section style={{ background: '#FFFFFF', border: `1px solid ${panelBorder}`, borderRadius: 14, overflow: 'hidden' }}>
      <div style={{ padding: '14px 18px', borderBottom: `1px solid ${panelBorder}`, display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ width: 30, height: 30, borderRadius: 9, background: '#FFF7ED', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <CalendarDays size={15} style={{ color: '#F97316' }} />
        </div>
        <div style={{ flex: 1 }}>
          <span style={{ fontSize: 18, fontWeight: 700, color: '#0F172A', letterSpacing: '-0.2px', lineHeight: 1.2 }}>Current Shifts</span>
          {deptName && (
            <span style={{ fontSize: 12, fontWeight: 600, color: dc, background: `${dc}1a`, borderRadius: 999, padding: '2px 10px', marginLeft: 10 }}>{deptName}</span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <button type="button" onClick={() => onNavigateDay(-1)} aria-label="Shift window back one day" disabled={!deptName} style={{ ...csIconButtonStyle, opacity: deptName ? 1 : 0.4, cursor: deptName ? 'pointer' : 'default' }}><ChevronLeft size={15} /></button>
          <button type="button" onClick={() => onNavigateDay(1)} aria-label="Shift window forward one day" disabled={!deptName} style={{ ...csIconButtonStyle, opacity: deptName ? 1 : 0.4, cursor: deptName ? 'pointer' : 'default' }}><ChevronRight size={15} /></button>
        </div>
        {loading && <Spinner size={13} dark />}
      </div>
      <div style={{ overflowX: 'auto', padding: '22px 18px 28px' }}>
        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 100, gap: 8, color: '#9CA3AF' }}>
            <Spinner size={14} dark /> <span style={{ fontSize: 13, fontWeight: 600 }}>Loading…</span>
          </div>
        ) : !deptName ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 100, gap: 10, color: '#9CA3AF' }}>
            <CalendarDays size={22} strokeWidth={1.5} />
            <span style={{ fontSize: 13, fontWeight: 600 }}>Select a request to preview shifts</span>
          </div>
        ) : sortedRows.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 100, gap: 10, color: '#9CA3AF' }}>
            <CalendarDays size={22} strokeWidth={1.5} />
            <span style={{ fontSize: 13, fontWeight: 600 }}>No shifts for this week</span>
          </div>
        ) : (
          <div style={{ minWidth: 700, borderRadius: 12, overflow: 'hidden', border: `1px solid ${panelBorder}` }}>
            <div style={{ display: 'grid', gridTemplateColumns: '180px repeat(7, 1fr)', background: 'linear-gradient(135deg,#0F172A 0%,#1E293B 100%)', height: 62 }}>
              <div style={{ padding: '10px 14px', borderRight: '1px solid rgba(255,255,255,0.08)' }} />
              {csWeekDates.map(date => {
                const d = new Date(date + 'T00:00:00')
                const isToday = date === todayKey2
                return (
                  <div key={date} style={{ padding: '10px 8px', borderRight: '1px solid rgba(255,255,255,0.08)', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                    <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: isToday ? '#F97316' : 'rgba(255,255,255,0.85)', letterSpacing: '0.01em', lineHeight: 1.2 }}>{String(d.getDate()).padStart(2, '0')} {d.toLocaleDateString('en-AU', { month: 'short' })}</p>
                    <p style={{ margin: '3px 0 0', fontSize: 12, fontWeight: 500, color: isToday ? '#F97316' : 'rgba(255,255,255,0.5)', letterSpacing: '0.01em', lineHeight: 1.2 }}>{d.toLocaleDateString('en-AU', { weekday: 'long' })}</p>
                  </div>
                )
              })}
            </div>
            <div style={{ borderLeft: EDGE, borderRight: EDGE, borderBottom: EDGE }}>
              {sortedRows.map((row, rowIdx) => {
                const isManager = row.role === 'Manager'
                const borderTop = rowIdx > 0 ? `1px solid ${panelBorder}` : 'none'
                const maxPerDay = Math.max(1, ...csWeekDates.map(d => row.shifts.filter((s: TimelineShiftBlock) => s.shift_date === d).length))
                const rowH = Math.max(72, maxPerDay * 34 + (maxPerDay - 1) * 6 + 38)
                return (
                  <div key={row.user_id} style={{ display: 'grid', gridTemplateColumns: '180px repeat(7, 1fr)', borderTop, background: '#FFFFFF', height: rowH }}>
                    <div style={{ display: 'flex', alignItems: 'center', borderRight: `1px solid ${panelBorder}`, overflow: 'hidden', height: rowH }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 10px 0 18px', minWidth: 0, flex: 1 }}>
                        <div style={{ width: 26, height: 26, borderRadius: 999, background: row.profile_photo_url ? 'transparent' : (isManager ? '#FFF7ED' : '#F3F4F6'), display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden' }}>
                          {row.profile_photo_url
                            ? <img src={row.profile_photo_url} alt={row.full_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            : isManager ? <UserCog size={13} color="#EA580C" /> : <UserRound size={13} color="#4B5563" />}
                        </div>
                        <span style={{ fontSize: '0.9375rem', fontWeight: 600, color: '#111827', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{row.full_name}</span>
                      </div>
                    </div>
                    {csWeekDates.map(date => {
                      const dayShifts = row.shifts.filter((s: TimelineShiftBlock) => s.shift_date === date)
                      return (
                        <div key={date} style={{ padding: '0 8px', borderRight: `1px solid ${panelBorder}`, height: rowH, display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'stretch', justifyContent: 'center', background: 'transparent' }}>
                          {dayShifts.length === 0 ? (
                            <div style={{ borderRadius: 999, background: '#E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'center', height: 32 }}>
                              <span style={{ fontSize: 12, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Off</span>
                            </div>
                          ) : dayShifts.map((shift: TimelineShiftBlock) => {
                            const highlighted = isHighlightedShift(row, shift)
                            return (
                              <div key={shift.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 8px', height: 32, background: highlighted ? '#FFF7ED' : '#F8FAFC', borderRadius: 999, opacity: shift.publication_status === 'draft' ? 0.72 : 1, border: highlighted ? '1.5px solid #FDBA74' : shift.publication_status === 'draft' ? '1.5px dashed #CBD5E1' : '1px solid #E2E8F0', boxShadow: highlighted ? '0 0 0 3px rgba(249,115,22,0.12)' : 'none' }}>
                                <span style={{ fontSize: 12.5, fontWeight: 800, color: highlighted ? '#C2410C' : '#334155', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                  {formatShiftHour(shift.start_time)}–{formatShiftHour(shift.end_time)}
                                </span>
                              </div>
                            )
                          })}
                        </div>
                      )
                    })}
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </section>
  )
}

// ─── TaskChangeBlock ──────────────────────────────────────────────────────────
// Previews, for the currently-selected pending swap request, which active tasks would move to
// the other party if the Owner approves — mirrors exactly what decideShiftSwapRequest actually
// moves (same non-Complete/non-archived filter), so nothing shown here can surprise on approval.

// Same palette/format as the Task Page's TaskCard (src/app/owner/tasks/page.tsx), so a task
// looks identical whether it's viewed there or previewed here mid-swap.
const TASK_CHANGES_PRIORITY_COLORS: Record<string, { bg: string; text: string }> = {
  Low:    { bg: '#F1F5F9', text: '#475569' },
  Medium: { bg: '#DBEAFE', text: '#1D4ED8' },
  High:   { bg: '#FFEDD5', text: '#C2410C' },
  Urgent: { bg: '#FEE2E2', text: '#B91C1C' },
}

// Same status palette as the Task Page's Kanban columns (STATUS_CONFIG in src/app/owner/tasks/page.tsx)
const TASK_CHANGES_STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  'Assigned':    { bg: '#E2E8F0', text: '#475569' },
  'In Progress': { bg: '#DBEAFE', text: '#2563EB' },
  'Review':      { bg: '#FED7AA', text: '#EA580C' },
  'Complete':    { bg: '#BBF7D0', text: '#16A34A' },
}

function formatTaskChangeDueDate(value: string | null): string {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const dayMonth = date.toLocaleDateString('en-US', { day: 'numeric', month: 'long' })
  const hours = date.getHours()
  const minutes = date.getMinutes()
  const hour12 = hours % 12 || 12
  const suffix = hours < 12 ? 'AM' : 'PM'
  const time = minutes === 0 ? `${hour12}${suffix}` : `${hour12}:${String(minutes).padStart(2, '0')}${suffix}`
  return `${dayMonth}, ${time}`
}

// Mirrors the Task Page's TaskCard layout (top-row priority badge, title, due date) with one
// addition: a status badge next to priority, since this preview has no Kanban column to imply
// status from. No assignee footer — the person column header above already identifies who.
function TaskChangeCard({ task, onSelect }: { task: ShiftSwapMovableTask; onSelect: () => void }) {
  const priorityStyle = task.priority ? TASK_CHANGES_PRIORITY_COLORS[task.priority] : null
  const statusStyle = TASK_CHANGES_STATUS_COLORS[task.status]
  const dueLabel = formatTaskChangeDueDate(task.due_at)
  return (
    <div
      className="task-card"
      onClick={onSelect}
      style={{ background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: 10, padding: '16px 16px', cursor: 'pointer' }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
        {priorityStyle && task.priority && (
          <span style={{ fontSize: '0.72rem', fontWeight: 800, padding: '4px 10px', borderRadius: 99, background: priorityStyle.bg, color: priorityStyle.text, letterSpacing: '0.01em' }}>
            {task.priority}
          </span>
        )}
        {statusStyle && (
          <span style={{ fontSize: '0.72rem', fontWeight: 800, padding: '4px 10px', borderRadius: 99, background: statusStyle.bg, color: statusStyle.text, letterSpacing: '0.01em' }}>
            {task.status}
          </span>
        )}
      </div>
      <p style={{ fontWeight: 600, fontSize: '0.875rem', color: '#111827', margin: 0, lineHeight: 1.4 }}>{task.title}</p>
      {dueLabel && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 12 }}>
          <Clock size={11} color="#9CA3AF" />
          <span style={{ fontSize: '0.7rem', fontWeight: 600, color: '#9CA3AF', whiteSpace: 'nowrap' }}>{dueLabel}</span>
        </div>
      )}
    </div>
  )
}

function TaskChangePersonColumn({ name, role, photoUrl, tasks, onSelectTask }: {
  name: string
  role: string
  photoUrl: string | null
  tasks: ShiftSwapMovableTask[]
  onSelectTask: (task: ShiftSwapMovableTask) => void
}) {
  const [index, setIndex] = useState(0)
  const clampedIndex = Math.min(index, Math.max(tasks.length - 1, 0))
  const activeTask = tasks[clampedIndex]

  return (
    <div style={{ flex: 1, minWidth: 0, border: '1px solid #E5E7EB', borderRadius: 12, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <RoleAvatar role={role} size={36} photoUrl={photoUrl} />
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: '0.86rem', fontWeight: 700, color: '#111827', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</div>
        </div>
        {tasks.length > 1 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
            <button
              type="button"
              onClick={() => setIndex((clampedIndex - 1 + tasks.length) % tasks.length)}
              aria-label="Previous task"
              style={{ width: 22, height: 22, borderRadius: 6, border: '1px solid #E5E7EB', background: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
            >
              <ChevronLeft size={12} style={{ color: '#6B7280' }} />
            </button>
            <span style={{ fontSize: '0.68rem', fontWeight: 700, color: '#9CA3AF', whiteSpace: 'nowrap' }}>{clampedIndex + 1}/{tasks.length}</span>
            <button
              type="button"
              onClick={() => setIndex((clampedIndex + 1) % tasks.length)}
              aria-label="Next task"
              style={{ width: 22, height: 22, borderRadius: 6, border: '1px solid #E5E7EB', background: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
            >
              <ChevronRight size={12} style={{ color: '#6B7280' }} />
            </button>
          </div>
        )}
      </div>
      {activeTask ? (
        <TaskChangeCard task={activeTask} onSelect={() => onSelectTask(activeTask)} />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 80, border: '1px dashed #E5E7EB', borderRadius: 10, color: '#9CA3AF' }}>
          <ClipboardList size={18} strokeWidth={1.5} />
          <span style={{ fontSize: '0.72rem', fontWeight: 600 }}>No task to move</span>
        </div>
      )}
    </div>
  )
}

// Two independent, side-by-side panels (same pattern as Action Needed) — one showing each
// party's task as it stands today, the other previewing what decideShiftSwapRequest will move
// it to if the Owner approves.
function TaskChangeBlock({ title, show, request, panelBorder, useCounterpartTasksForRequester, onSelectTask }: {
  title: string
  show: boolean
  request: ShiftSwapRequestView | null
  panelBorder: string
  useCounterpartTasksForRequester: boolean
  onSelectTask: (task: ShiftSwapMovableTask) => void
}) {
  if (!show) return null
  const requesterMovableTasks = request?.requester_movable_tasks ?? []
  const counterpartMovableTasks = request?.counterpart_movable_tasks ?? []
  const hasChanges = requesterMovableTasks.length > 0 || counterpartMovableTasks.length > 0

  const requesterTasks = useCounterpartTasksForRequester ? counterpartMovableTasks : requesterMovableTasks
  const counterpartTasks = useCounterpartTasksForRequester ? requesterMovableTasks : counterpartMovableTasks

  return (
    <section style={{ flex: 1, minWidth: 0, background: '#FFFFFF', border: `1px solid ${panelBorder}`, borderRadius: 14, overflow: 'hidden' }}>
      <div style={{ padding: '14px 18px', borderBottom: `1px solid ${panelBorder}`, display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ width: 30, height: 30, borderRadius: 9, background: '#F5F3FF', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <ClipboardList size={15} style={{ color: '#7C3AED' }} />
        </div>
        <span style={{ fontSize: 18, fontWeight: 700, color: '#0F172A', letterSpacing: '-0.2px', lineHeight: 1.2 }}>{title}</span>
      </div>
      {!request ? (
        <div style={{ padding: '18px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 80, gap: 10, color: '#9CA3AF' }}>
          <ClipboardList size={22} strokeWidth={1.5} />
          <span style={{ fontSize: 13, fontWeight: 600 }}>Select a request to preview task changes</span>
        </div>
      ) : !hasChanges ? (
        <div style={{ padding: '18px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 80, gap: 10, color: '#9CA3AF' }}>
          <ClipboardList size={22} strokeWidth={1.5} />
          <span style={{ fontSize: 13, fontWeight: 600 }}>No tasks will move if this swap is approved</span>
        </div>
      ) : (
        <div style={{ padding: '18px', display: 'flex', alignItems: 'stretch', gap: 14 }}>
          <TaskChangePersonColumn name={request.requester_name} role={request.requester_role} photoUrl={request.requester_photo_url} tasks={requesterTasks} onSelectTask={onSelectTask} />
          <TaskChangePersonColumn name={request.counterpart_name} role={request.counterpart_role} photoUrl={request.counterpart_photo_url} tasks={counterpartTasks} onSelectTask={onSelectTask} />
        </div>
      )}
    </section>
  )
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

  // job posting detail modal — opened from the "Job Title" field of a CW attendance record,
  // via Shift.source_job_posting_id (the posting that CW was actually hired from)
  const [jobPostingDetailOpen, setJobPostingDetailOpen] = useState(false)
  const [jobPostingDetail, setJobPostingDetail] = useState<JobPosting | null>(null)
  const [jobPostingDetailLoading, setJobPostingDetailLoading] = useState(false)
  const [jobPostingDetailError, setJobPostingDetailError] = useState('')

  // task-change detail modal — opened from a task card in the Current Task / After Change panels
  const [taskChangeDetail, setTaskChangeDetail] = useState<ShiftSwapMovableTask | null>(null)

  // ── Export modal state ────────────────────────────────────────────────────
  const [exportOpen, setExportOpen] = useState(false)
  const [exportLoading, setExportLoading] = useState(false)
  const [exportFrom, setExportFrom] = useState('')
  const [exportTo, setExportTo] = useState('')
  const [exportFormat, setExportFormat] = useState<'csv' | 'pdf'>('csv')

  // ── Off Day Settings block state ─────────────────────────────────────────
  const [offDaySettingsLoading, setOffDaySettingsLoading] = useState(false)
  const [offDaySettingsError, setOffDaySettingsError] = useState('')
  const [offDaySettingsSaving, setOffDaySettingsSaving] = useState(false)
  // Shared page-wide toast pair — every action handler on this page reports success/failure
  // through these two instead of each growing its own ad-hoc toast state.
  const [successToast, setSuccessToast] = useState('')
  const [errorToast, setErrorToast] = useState('')
  const showSuccessToast = useCallback((message: string) => {
    setSuccessToast(message)
    setTimeout(() => setSuccessToast(''), 3000)
  }, [])
  const showErrorToast = useCallback((message: string) => {
    setErrorToast(message)
    setTimeout(() => setErrorToast(''), 3000)
  }, [])
  const [managerOverridesModalOpen, setManagerOverridesModalOpen] = useState(false)
  const [companyStaff, setCompanyStaff] = useState<{ id: string; full_name: string; role: string; department_id: string | null; profile_photo_url: string | null }[]>([])
  const [companyDepartments, setCompanyDepartments] = useState<{ id: string; name: string }[]>([])
  const [managerDefaultQuota, setManagerDefaultQuota] = useState(2)
  const [employeeDefaultQuota, setEmployeeDefaultQuota] = useState(2)
  const [individualQuotaOverrides, setIndividualQuotaOverrides] = useState<Record<string, number>>({})
  const [overrideDrafts, setOverrideDrafts] = useState<Record<string, number>>({})
  const [revealedOverrideInputs, setRevealedOverrideInputs] = useState<Set<string>>(new Set())
  const [overrideInputText, setOverrideInputText] = useState<Record<string, string>>({})
  // Separate from the modal's batched-draft editing (overrideDrafts/revealedOverrideInputs) —
  // this inline preview on the Settings block commits immediately on blur, no Save button.
  const [revealedInlineOverrides, setRevealedInlineOverrides] = useState<Set<string>>(new Set())
  const [inlineOverrideInputText, setInlineOverrideInputText] = useState<Record<string, string>>({})
  const [overrideSearch, setOverrideSearch] = useState('')
  const [overrideRoleFilter, setOverrideRoleFilter] = useState('all')
  const [overrideDeptFilter, setOverrideDeptFilter] = useState('all')
  const [overrideSearchPanelOpen, setOverrideSearchPanelOpen] = useState(false)
  const [deadlineWeekday, setDeadlineWeekday] = useState(2)
  const [deadlineTime, setDeadlineTime] = useState('17:00')

  // ── Requests tab state ───────────────────────────────────────────────────
  const [reqTab, setReqTab] = useState<'swaps' | 'fixedoff'>('swaps')
  const [swapRequests, setSwapRequests] = useState<ShiftSwapRequestView[]>([])
  const [fixedOffDayRequests, setFixedOffDayRequests] = useState<FixedOffDayRequestView[]>([])
  const [reqLoading, setReqLoading] = useState(false)
  const [actionIndex, setActionIndex] = useState(0)
  // Narrow desktop windows (laptop-width, ~<1500px) don't have room to show 2 Action Needed
  // swap cards side by side without truncating the requester/counterpart names — drop to 1 per
  // page there instead of squeezing both.
  const [isNarrowViewport, setIsNarrowViewport] = useState(false)
  useEffect(() => {
    const check = () => setIsNarrowViewport(window.innerWidth < 1500)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])
  const [fixedOffActionIndex, setFixedOffActionIndex] = useState(0)
  const [fixedOffCalendarMonthAnchor, setFixedOffCalendarMonthAnchor] = useState(() => {
    const d = new Date()
    d.setDate(1)
    return toISODate(d)
  })
  const [dayOffDetailDate, setDayOffDetailDate] = useState<string | null>(null)
  const [processedDeptFilter, setProcessedDeptFilter] = useState<string>('all')
  const [processedPage, setProcessedPage] = useState(0)
  const [processedDeptDropdownOpen, setProcessedDeptDropdownOpen] = useState(false)
  const processedDeptDropdownRef = useRef<HTMLDivElement>(null)
  const [newlyProcessedId, setNewlyProcessedId] = useState<string | null>(null)
  useEffect(() => {
    if (!processedDeptDropdownOpen) return
    const handler = (e: MouseEvent) => {
      if (!processedDeptDropdownRef.current?.contains(e.target as Node)) setProcessedDeptDropdownOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [processedDeptDropdownOpen])
  const [reqActionLoading, setReqActionLoading] = useState(false)
  const [reqError, setReqError] = useState('')
  const [currentShiftsRows, setCurrentShiftsRows] = useState<TimelineRow[]>([])
  const [currentShiftsLoading, setCurrentShiftsLoading] = useState(false)
  const [currentShiftsDept, setCurrentShiftsDept] = useState<string | null>(null)
  const [csAnchorDate, setCsAnchorDate] = useState<string>(() => toISODate(new Date()))
  const navigateCurrentShiftsDay = useCallback((dir: number) => {
    setCsAnchorDate(prev => {
      const d = new Date(`${prev}T00:00:00`)
      d.setDate(d.getDate() + dir)
      return toISODate(d)
    })
  }, [])
  // Owner's "Modify" action — reassign a pending request's day(s) to different dates in the same
  // week. Only one card's picker is open at a time. The manual pick-any-day flow stays intact for
  // later Free-tier gating; "Suggestion" (below) is the AI-assisted entry point that drives it.
  const [modifyingFixedOffKey, setModifyingFixedOffKey] = useState<string | null>(null)
  const [fixedOffModifySelection, setFixedOffModifySelection] = useState<string[]>([])
  const [requestAiKey, setRequestAiKey] = useState<string | null>(null)
  const [requestAiResult, setRequestAiResult] = useState<FixedOffDayAISuggestion | null>(null)
  const [requestAiLoading, setRequestAiLoading] = useState(false)
  const [requestAiError, setRequestAiError] = useState('')
  const [activityLogs, setActivityLogs] = useState<{ id: string; type: 'swaps' | 'fixedoff'; action: 'approved' | 'rejected' | 'modified'; targetName: string; ts: Date }[]>(() => {
    try {
      const saved = localStorage.getItem('attendance_activity_logs')
      if (!saved) return []
      return (JSON.parse(saved) as { id: string; type: 'swaps' | 'fixedoff'; action: 'approved' | 'rejected' | 'modified'; targetName: string; ts: string }[])
        .map(l => ({ ...l, ts: new Date(l.ts) }))
    } catch { return [] }
  })
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
      const [swapRes, fixedRes] = await Promise.all([
        fetch(`/api/attendance?company_id=${cid}&resource=shift_swaps`),
        fetch(`/api/attendance?company_id=${cid}&resource=fixed_off_days`),
      ])
      const swapData = await swapRes.json()
      const fixedData = await fixedRes.json()
      setSwapRequests(swapData.requests ?? [])
      setFixedOffDayRequests(fixedData.requests ?? [])
    } catch (err) {
      setReqError(err instanceof Error ? err.message : 'Failed to fetch requests')
    } finally { setReqLoading(false) }
  }, [])

  // ── Fetch current dept shifts for Current Shifts block ───────────────────
  const fetchCurrentShifts = useCallback(async (cid: string, deptName: string, anchorDate: string) => {
    if (!cid || !deptName) return
    setCurrentShiftsLoading(true)
    setCurrentShiftsDept(deptName)
    try {
      // Rolling 7-day window starting exactly at anchorDate — must match the CurrentShiftsBlock
      // display window (which is not Mon-Sun snapped) or a swap that crosses a week boundary
      // would fetch a range that doesn't cover both sides of it.
      const mon = new Date(`${anchorDate}T00:00:00`)
      const sun = new Date(mon); sun.setDate(mon.getDate() + 6)
      const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      const res = await fetch(`/api/shift?company_id=${cid}&date_from=${fmt(mon)}&date_to=${fmt(sun)}`)
      const data = await res.json()
      const all: TimelineRow[] = data.success ? data.rows ?? [] : []
      setCurrentShiftsRows(all.filter(r => r.department_name === deptName && r.user_id && (r.role === 'Manager' || r.role === 'Employee')))
    } catch {
      setCurrentShiftsRows([])
    } finally {
      setCurrentShiftsLoading(false)
    }
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

  const activeSwapRequest = useMemo(() => {
    const pending = swapRequests
      .filter(r => r.status === 'pending')
      .sort((a, b) => new Date(a.created_at ?? 0).getTime() - new Date(b.created_at ?? 0).getTime())
    return pending[Math.min(actionIndex, pending.length - 1)] ?? null
  }, [swapRequests, actionIndex])

  // Auto-focus the Current Shifts window on the swap's own two dates whenever a new request
  // becomes active — a swap can straddle a week boundary (e.g. Sun 5 Jul <-> Mon 6 Jul), so
  // anchoring on whichever date comes first (rather than snapping to a Mon-Sun calendar week)
  // is the only way both sides of the swap are guaranteed to land inside the same 7-day window.
  useEffect(() => {
    if (!activeSwapRequest) return
    const dates = [activeSwapRequest.requester_shift_date, activeSwapRequest.counterpart_shift_date]
      .filter((d): d is string => !!d)
    if (dates.length === 0) return
    setCsAnchorDate(dates.reduce((a, b) => (a < b ? a : b)))
  }, [activeSwapRequest?.id, activeSwapRequest?.requester_shift_date, activeSwapRequest?.counterpart_shift_date])

  // fetch current dept shifts whenever the action-needed card or the viewed window changes —
  // guarded so merely switching tabs away and back (mainTab/reqTab) doesn't re-fetch the same
  // department/window that's already loaded.
  const currentShiftsFetchedForRef = useRef<string | null>(null)
  useEffect(() => {
    if (!companyId || mainTab !== 'requests' || reqTab !== 'swaps' || !activeSwapRequest?.department_name) return
    const key = `${companyId}_${activeSwapRequest.department_name}_${csAnchorDate}`
    if (currentShiftsFetchedForRef.current === key) return
    currentShiftsFetchedForRef.current = key
    void fetchCurrentShifts(companyId, activeSwapRequest.department_name, csAnchorDate)
  }, [companyId, mainTab, reqTab, activeSwapRequest?.department_name, csAnchorDate, fetchCurrentShifts])

  const fixedOffGroupsAll = useMemo(() => groupFixedOff(fixedOffDayRequests), [fixedOffDayRequests])
  const fixedOffActionNeeded = useMemo(
    () => fixedOffGroupsAll.filter(g => g.status === 'pending').sort((a, b) => new Date(a.created_at ?? 0).getTime() - new Date(b.created_at ?? 0).getTime()),
    [fixedOffGroupsAll],
  )
  const currentFixedOffItem = useMemo(() => {
    const clamped = Math.min(fixedOffActionIndex, Math.max(fixedOffActionNeeded.length - 1, 0))
    return fixedOffActionNeeded[clamped] ?? null
  }, [fixedOffActionNeeded, fixedOffActionIndex])
  // Deadline passing only ever stops new submissions for that week — it does NOT by itself end the
  // week for display purposes. A week is only "published"/done once every one of its pending requests
  // has been Approved or Modified, so this stays on the oldest week that still has something to
  // decide, and only falls back to the next open-for-submission week once the queue is empty.
  const displayWeekStart = useMemo(
    () => currentFixedOffItem?.week_start ?? resolveActiveSubmissionWeekStart(deadlineWeekday, deadlineTime),
    [currentFixedOffItem, deadlineWeekday, deadlineTime],
  )

  // ── Off Day Settings (quota + deadline) ─────────────────────────────────────
  // Tracks which companyId this data has already been fetched for, so revisiting the tab doesn't
  // re-fire all 4 requests every time — save handlers below patch local state directly on success,
  // so a refetch is never needed after a mutation, only on first load / company switch.
  const offDaySettingsLoadedForRef = useRef<string | null>(null)
  const loadOffDaySettings = useCallback(async (force = false) => {
    if (!companyId || !internalUserId) return
    if (!force && offDaySettingsLoadedForRef.current === companyId) return
    offDaySettingsLoadedForRef.current = companyId
    setOffDaySettingsLoading(true)
    setOffDaySettingsError('')
    try {
      const [membersRes, deptRes, quotaRes, deadlineRes] = await Promise.all([
        fetch(`/api/team/members?company_id=${companyId}`),
        fetch(`/api/company/departments?company_id=${companyId}`),
        fetch(`/api/attendance/off-day-settings?company_id=${companyId}&owner_id=${internalUserId}&resource=quota`),
        fetch(`/api/attendance/off-day-settings?company_id=${companyId}&owner_id=${internalUserId}&resource=deadline`),
      ])
      const membersData = await membersRes.json()
      const deptData = await deptRes.json()
      const quotaData = await quotaRes.json()
      const deadlineData = await deadlineRes.json()
      if (!quotaData.success) throw new Error(quotaData.message || 'Failed to load quota settings')
      if (!deadlineData.success) throw new Error(deadlineData.message || 'Failed to load deadline settings')

      const staff = (membersData.members ?? []).filter((m: { role: string }) => m.role === 'Manager' || m.role === 'Employee')
      setCompanyStaff(staff)
      if (deptData.success) setCompanyDepartments(deptData.departments ?? [])

      const settings: Array<{ user_id: string | null; max_days_per_week: number; role: 'Manager' | 'Employee' | null }> = quotaData.settings ?? []
      const managerDefaultRow = settings.find(s => s.user_id === null && s.role === 'Manager')
      const employeeDefaultRow = settings.find(s => s.user_id === null && s.role === 'Employee')
      setManagerDefaultQuota(managerDefaultRow?.max_days_per_week ?? 2)
      setEmployeeDefaultQuota(employeeDefaultRow?.max_days_per_week ?? 2)
      const overrides: Record<string, number> = {}
      settings.filter(s => s.user_id !== null).forEach(s => { overrides[s.user_id as string] = s.max_days_per_week })
      setIndividualQuotaOverrides(overrides)

      setDeadlineWeekday(deadlineData.deadline?.deadline_weekday ?? 2)
      setDeadlineTime(deadlineData.deadline?.deadline_time ?? '17:00')
    } catch (err) {
      offDaySettingsLoadedForRef.current = null
      setOffDaySettingsError(err instanceof Error ? err.message : 'Failed to load off day settings')
    } finally {
      setOffDaySettingsLoading(false)
    }
  }, [companyId, internalUserId])

  useEffect(() => {
    if (mainTab === 'requests' && reqTab === 'fixedoff') void loadOffDaySettings()
  }, [mainTab, reqTab, loadOffDaySettings])

  const saveIndividualQuotaOverride = async (userId: string, value: number) => {
    if (!companyId || !internalUserId) return
    setOffDaySettingsSaving(true)
    setOffDaySettingsError('')
    try {
      const res = await fetch('/api/attendance/off-day-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'set_user_quota_override', company_id: companyId, owner_id: internalUserId, user_id: userId, max_days_per_week: value }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.message || 'Failed to save override')
      setIndividualQuotaOverrides(prev => ({ ...prev, [userId]: value }))
      showSuccessToast('Override saved.')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save override'
      setOffDaySettingsError(message)
      showErrorToast(message)
    } finally {
      setOffDaySettingsSaving(false)
    }
  }

  const resetIndividualQuotaOverride = async (userId: string) => {
    if (!companyId || !internalUserId) return
    setOffDaySettingsSaving(true)
    setOffDaySettingsError('')
    try {
      const res = await fetch('/api/attendance/off-day-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'remove_user_quota_override', company_id: companyId, owner_id: internalUserId, user_id: userId }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.message || 'Failed to reset override')
      setIndividualQuotaOverrides(prev => { const next = { ...prev }; delete next[userId]; return next })
      showSuccessToast('Override reset to default.')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to reset override'
      setOffDaySettingsError(message)
      showErrorToast(message)
    } finally {
      setOffDaySettingsSaving(false)
    }
  }

  // Batches every unsaved row in the "Set Override" search panel into one Save action — a draft
  // equal to the person's role default clears an existing override; otherwise it's set/updated.
  // Runs all requests in parallel (rather than one-by-one) so saving several people at once
  // doesn't feel like a stutter of sequential round-trips.
  const saveOverrideDrafts = async () => {
    const entries = Object.entries(overrideDrafts)
    if (!companyId || !internalUserId || entries.length === 0) return

    setOffDaySettingsSaving(true)
    setOffDaySettingsError('')

    try {
      const nextOverrides = { ...individualQuotaOverrides }
      const requests = entries
        .map(([personId, draftValue]) => {
          const person = companyStaff.find(s => s.id === personId)
          if (!person) return null
          const roleDefault = person.role === 'Manager' ? managerDefaultQuota : employeeDefaultQuota
          const hasExisting = individualQuotaOverrides[personId] !== undefined
          const shouldRemove = draftValue === roleDefault
          const shouldSave = draftValue !== (individualQuotaOverrides[personId] ?? roleDefault)
          if (shouldRemove) {
            if (!hasExisting) return null
            delete nextOverrides[personId]
            return fetch('/api/attendance/off-day-settings', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action: 'remove_user_quota_override', company_id: companyId, owner_id: internalUserId, user_id: personId }),
            })
          }
          if (!shouldSave) return null
          nextOverrides[personId] = draftValue
          return fetch('/api/attendance/off-day-settings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'set_user_quota_override', company_id: companyId, owner_id: internalUserId, user_id: personId, max_days_per_week: draftValue }),
          })
        })
        .filter((p): p is Promise<Response> => p !== null)

      const responses = await Promise.all(requests)
      await Promise.all(responses.map(async res => {
        const data = await res.json()
        if (!res.ok || !data.success) throw new Error(data.message || 'Failed to save override')
        return data
      }))

      setIndividualQuotaOverrides(nextOverrides)
      setOverrideDrafts({})
      setOverrideSearch('')
      setOverrideRoleFilter('all')
      setOverrideDeptFilter('all')
      setRevealedOverrideInputs(new Set())
      setOverrideInputText({})
      setOverrideSearchPanelOpen(false)
      showSuccessToast('Individual overrides saved.')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save override'
      setOffDaySettingsError(message)
      showErrorToast(message)
    } finally {
      setOffDaySettingsSaving(false)
    }
  }

  const saveCompanyDefaultAndDeadline = async () => {
    if (!companyId || !internalUserId) return
    setOffDaySettingsSaving(true)
    setOffDaySettingsError('')
    try {
      const [managerQuotaRes, employeeQuotaRes, deadlineRes] = await Promise.all([
        fetch('/api/attendance/off-day-settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'set_default_quota', company_id: companyId, owner_id: internalUserId, role: 'Manager', max_days_per_week: managerDefaultQuota }),
        }),
        fetch('/api/attendance/off-day-settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'set_default_quota', company_id: companyId, owner_id: internalUserId, role: 'Employee', max_days_per_week: employeeDefaultQuota }),
        }),
        fetch('/api/attendance/off-day-settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'set_deadline', company_id: companyId, owner_id: internalUserId, deadline_weekday: deadlineWeekday, deadline_time: deadlineTime }),
        }),
      ])
      const [managerQuotaData, employeeQuotaData, deadlineData] = await Promise.all([managerQuotaRes.json(), employeeQuotaRes.json(), deadlineRes.json()])
      if (!managerQuotaData.success) throw new Error(managerQuotaData.message || 'Failed to save manager default quota')
      if (!employeeQuotaData.success) throw new Error(employeeQuotaData.message || 'Failed to save employee default quota')
      if (!deadlineData.success) throw new Error(deadlineData.message || 'Failed to save deadline')
      showSuccessToast('Settings saved successfully.')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save settings'
      setOffDaySettingsError(message)
      showErrorToast(message)
    } finally {
      setOffDaySettingsSaving(false)
    }
  }

  // ── Decide request ────────────────────────────────────────────────────────
  const decideRequest = async (
    kind: 'decide_shift_swap',
    id: string,
    decision: 'approved' | 'rejected',
    targetName?: string,
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
      setActivityLogs(prev => {
        const next = [{ id: `${id}-${Date.now()}`, type: 'swaps' as const, action: decision, targetName: targetName ?? '—', ts: new Date() }, ...prev]
        try { localStorage.setItem('attendance_activity_logs', JSON.stringify(next)) } catch {}
        return next
      })
      setNewlyProcessedId(id)
      setTimeout(() => setNewlyProcessedId(null), 800)
      setActionIndex(0)
      await fetchRequestData(companyId)
      showSuccessToast(decision === 'approved' ? 'Shift swap approved.' : 'Shift swap rejected.')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update request'
      setReqError(message)
      showErrorToast(message)
    } finally { setReqActionLoading(false) }
  }

  // A weekly Fixed Day Off submission is stored as one row per date but decided as a single
  // unit — approve/reject applies the same decision to every date in the group at once.
  const decideFixedOffGroup = async (ids: string[], decision: 'approved' | 'modified', targetName?: string, newDates?: string[]) => {
    if (!internalUserId || !companyId || ids.length === 0) return
    setReqActionLoading(true)
    setReqError('')
    try {
      const res = await fetch('/api/attendance', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'decide_fixed_off_day', ids, reviewer_id: internalUserId, decision, new_dates: newDates }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.message || 'Failed to update request')
      setActivityLogs(prev => {
        const next = [{ id: `${ids[0]}-${Date.now()}`, type: 'fixedoff' as const, action: decision, targetName: targetName ?? '—', ts: new Date() }, ...prev]
        try { localStorage.setItem('attendance_activity_logs', JSON.stringify(next)) } catch {}
        return next
      })
      setModifyingFixedOffKey(null)
      setFixedOffModifySelection([])
      await fetchRequestData(companyId)
      showSuccessToast(decision === 'approved' ? 'Day off request approved.' : 'Day off request modified.')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update request'
      setReqError(message)
      showErrorToast(message)
    } finally { setReqActionLoading(false) }
  }

  // "Suggestion" — AI reviews one weekly request against everyone else's requests/scheduled
  // headcount that week and recommends Approve or Modify. On Modify it seeds the existing manual
  // day-picker with the AI's suggested replacement day(s) so the Owner just needs to confirm (or
  // still override manually before confirming).
  const analyzeFixedOffRequest = async (groupKey: string, ids: string[], requestedCount: number) => {
    setRequestAiKey(groupKey)
    setRequestAiResult(null)
    setRequestAiError('')
    setRequestAiLoading(true)
    try {
      const res = await fetch('/api/attendance/ai-suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ request_type: 'fixed_off_day', ids, company_id: companyId }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.message || 'AI analysis failed')
      setRequestAiResult(data.suggestion)
      if (data.suggestion.recommendation === 'modify') {
        // Only pre-select AI-vetted alternatives — never fall back to the original requested dates,
        // since those are exactly what triggered the "modify" recommendation in the first place.
        // If the AI found fewer safe alternatives than needed, the Owner picks the rest manually
        // (the Confirm button already stays disabled until the full count is selected).
        setFixedOffModifySelection((data.suggestion.alternatives ?? []).slice(0, requestedCount))
        setModifyingFixedOffKey(groupKey)
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'AI analysis failed'
      setRequestAiError(message)
      showErrorToast(message)
    } finally {
      setRequestAiLoading(false)
    }
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

  const openJobPostingDetail = async (jobId: string) => {
    setJobPostingDetailOpen(true)
    setJobPostingDetailLoading(true)
    setJobPostingDetailError('')
    setJobPostingDetail(null)
    try {
      const res = await fetch(`/api/recruitment?resource=job_posting&job_id=${jobId}`)
      const data = await res.json()
      if (!data.success) throw new Error(data.message || 'Failed to load job posting')
      setJobPostingDetail(data.posting)
    } catch (err) {
      setJobPostingDetailError(err instanceof Error ? err.message : 'Failed to load job posting')
    } finally {
      setJobPostingDetailLoading(false)
    }
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
      showSuccessToast(newStatus === 'active' ? 'Casual worker reactivated.' : 'Casual worker deactivated.')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update status'
      setReviewError(message)
      showErrorToast(message)
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
      showSuccessToast('Attendance record updated.')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update attendance'
      setReviewError(message)
      showErrorToast(message)
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
          didDrawCell: (hookData) => {
            // Only trigger once per row (on the first cell) to draw date dividers
            if (hookData.section !== 'body' || hookData.column.index !== 0) return
            const rowDate = String(hookData.cell.text?.[0] ?? '')
            if (lastDate && rowDate !== lastDate) {
              const y = hookData.cell.y
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
      showSuccessToast('Export ready — check your downloads.')
    } catch (err) {
      showErrorToast(err instanceof Error ? err.message : 'Failed to export records')
    } finally {
      setExportLoading(false)
    }
  }, [companyId, recordsRole, selectedDeptId, casualJobType, showSuccessToast, showErrorToast])

  // ── Absence reason lookups ────────────────────────────────────────────────
  // approved fixed off: userId+request_date (YYYY-MM-DD) → true
  const fixedOffByUserDate = useMemo(() => {
    const map = new Map<string, boolean>()
    fixedOffDayRequests.forEach(r => {
      if (r.status === 'approved') map.set(`${r.user_id}|${r.request_date}`, true)
    })
    return map
  }, [fixedOffDayRequests])

  // ── Pending counts ────────────────────────────────────────────────────────
  const pendingSwapCount = swapRequests.filter(r => r.status === 'pending').length
  const pendingFixedOffCount = fixedOffDayRequests.filter(r => r.status === 'pending').length
  const totalPendingRequests = pendingSwapCount + pendingFixedOffCount

  const mainTabs = [
    { key: 'records' as const, label: 'Records' },
    { key: 'requests' as const, label: 'Requests', dot: !reqLoading && totalPendingRequests > 0 },
  ]

  // ── Today's date key for AR status reference ──────────────────────────────
  const todayKey = useMemo(() => new Date().toISOString().slice(0, 10), [])

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#F1F5F9' }}>
      <style>{`
        @keyframes fadeSlideUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes deptCardIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes ping { 0% { transform: scale(1); opacity: 1; } 75%, 100% { transform: scale(2); opacity: 0; } }
        @keyframes slideInFromLeft { from { opacity: 0; transform: translateX(-32px); } to { opacity: 1; transform: translateX(0); } }
        .att-request-card { transition: box-shadow 0.18s ease, transform 0.18s ease; }
        .att-request-card:hover { box-shadow: 0 8px 22px rgba(15,23,42,0.08); transform: translateY(-2px); }
        .att-request-card-new { animation: slideInFromLeft 0.38s cubic-bezier(0.22,1,0.36,1) both !important; }
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
                <div style={{ width: 30, height: 30, borderRadius: 9, background: '#FFF7ED', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <UserCog size={15} style={{ color: '#F97316' }} />
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
                <div style={{ width: 30, height: 30, borderRadius: 9, background: '#FFF7ED', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <UserRound size={15} style={{ color: '#F97316' }} />
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
                  const ORANGE = '#F97316'
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
                        border: `1px solid ${isActive ? ORANGE : PANEL_BORDER}`,
                        borderRadius: 10, padding: '12px 14px',
                        background: isActive ? '#FFF7ED' : '#F9FAFB',
                        cursor: 'pointer',
                        transition: 'box-shadow 0.18s, transform 0.18s, border-color 0.18s, background 0.18s',
                        animation: `deptCardIn 0.28s ease both ${idx * 55}ms`,
                        boxShadow: isActive ? `0 4px 16px ${ORANGE}22` : undefined,
                      }}
                      onMouseEnter={e => { if (!isActive) { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 20px rgba(15,23,42,0.10)'; e.currentTarget.style.borderColor = ORANGE } }}
                      onMouseLeave={e => { if (!isActive) { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.borderColor = PANEL_BORDER } }}
                    >
                      <span style={{ width: 8, height: 8, borderRadius: 999, background: '#94A3B8', flexShrink: 0 }} />
                      <span style={{ fontSize: '0.9375rem', fontWeight: 700, color: '#374151' }}>{opt.label}</span>
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
                                        const isFixedOff = fixedOffByUserDate.get(`${userId}|${date}`)
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
          <div style={{ padding: '0 28px 28px', display: 'grid', gridTemplateColumns: 'minmax(260px, 326px) minmax(360px, 1fr) minmax(360px, 640px)', gridTemplateRows: 'auto minmax(0, 1fr)', gap: 16, alignItems: 'start' }}>
            <div style={{ display: 'contents' }}>

            {/* ── LEFT: Request Types sidebar ──────────────────────────────── */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <section style={{ background: '#FFFFFF', border: `1px solid ${PANEL_BORDER}`, borderRadius: 14, overflow: 'hidden', height: 260 }}>
                <div style={{ padding: '14px 18px', borderBottom: `1px solid ${PANEL_BORDER}`, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 30, height: 30, borderRadius: 9, background: '#FFF7ED', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <ArrowLeftRight size={15} style={{ color: '#F97316' }} />
                  </div>
                  <span style={{ fontSize: 18, fontWeight: 700, color: '#0F172A', letterSpacing: '-0.2px', lineHeight: 1.2 }}>Type</span>
                </div>
                <div style={{ padding: '14px 16px', display: 'grid', gap: 14 }}>
                  {(['swaps', 'fixedoff'] as const).map((tab, idx) => {
                    const isActive = reqTab === tab
                    const meta = {
                      swaps:    { color: '#F97316', label: 'Shift Swaps', subtitle: 'Swap shifts with colleagues', count: pendingSwapCount },
                      fixedoff: { color: '#F97316', label: 'Weekly Day Off', subtitle: 'Request a weekly day off', count: pendingFixedOffCount },
                    }[tab]
                    return (
                      <article
                        key={tab}
                        onClick={() => setReqTab(tab)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 10,
                          border: `1px solid ${isActive ? meta.color : PANEL_BORDER}`,
                          borderRadius: 10, padding: '18px 16px',
                          background: isActive ? '#FFF7ED' : '#F9FAFB',
                          cursor: 'pointer',
                          transition: 'box-shadow 0.18s, transform 0.18s, border-color 0.18s, background 0.18s',
                          animation: `deptCardIn 0.28s ease both ${idx * 55}ms`,
                          boxShadow: isActive ? `0 4px 16px ${meta.color}22` : undefined,
                        }}
                        onMouseEnter={e => { if (!isActive) { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 20px rgba(15,23,42,0.10)'; e.currentTarget.style.borderColor = meta.color } }}
                        onMouseLeave={e => { if (!isActive) { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.borderColor = PANEL_BORDER } }}
                      >
                        <span style={{ position: 'relative', width: 8, height: 8, flexShrink: 0 }}>
                          {meta.count > 0 && (
                            <span style={{ position: 'absolute', inset: 0, borderRadius: 999, background: '#F97316', animation: 'ping 1.2s cubic-bezier(0,0,0.2,1) infinite' }} />
                          )}
                          <span style={{ position: 'absolute', inset: 0, borderRadius: 999, background: meta.count > 0 ? '#F97316' : '#94A3B8' }} />
                        </span>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: '0.9375rem', fontWeight: 700, color: '#374151' }}>{meta.label}</div>
                          <div style={{ fontSize: '0.75rem', color: '#9CA3AF', marginTop: 2 }}>{meta.subtitle}</div>
                        </div>
                      </article>
                    )
                  })}
                </div>
              </section>
              {reqTab === 'fixedoff' && (
                <section style={{ background: '#FFFFFF', border: `1px solid ${PANEL_BORDER}`, borderRadius: 14, overflow: 'hidden' }}>
                  <div style={{ padding: '14px 18px', borderBottom: `1px solid ${PANEL_BORDER}`, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 30, height: 30, borderRadius: 9, background: '#FFF7ED', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Settings size={15} style={{ color: '#F97316' }} />
                    </div>
                    <span style={{ fontSize: 18, fontWeight: 700, color: '#0F172A', letterSpacing: '-0.2px', lineHeight: 1.2, flex: 1 }}>Settings</span>
                    {offDaySettingsLoading && <Spinner size={13} dark />}
                  </div>
                  <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 24 }}>
                    {offDaySettingsError && (
                      <div style={{ padding: '10px 12px', borderRadius: 10, background: '#FEF2F2', border: '1px solid #FECACA', color: '#B91C1C', fontSize: 12, fontWeight: 700 }}>{offDaySettingsError}</div>
                    )}

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#374151', margin: '0 0 6px' }}>Manager Off Days</label>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, border: '1.5px solid #E5E7EB', borderRadius: 8, minHeight: 40, padding: '10px 12px', background: '#FFFFFF', boxSizing: 'border-box' }}>
                          <input
                            type="text"
                            inputMode="numeric"
                            value={managerDefaultQuota}
                            onChange={e => {
                              const digits = e.target.value.replace(/\D/g, '')
                              if (digits === '') { setManagerDefaultQuota(0); return }
                              setManagerDefaultQuota(Math.min(7, Math.max(1, Number(digits))))
                            }}
                            style={{ width: `${String(managerDefaultQuota).length}ch`, minWidth: 10, border: 'none', outline: 'none', padding: 0, fontSize: '0.9375rem', color: '#111827', background: 'transparent' }}
                          />
                          <span style={{ fontSize: '0.9375rem', color: '#111827' }}>days per week</span>
                        </div>
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#374151', margin: '0 0 6px' }}>Employee Off Days</label>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, border: '1.5px solid #E5E7EB', borderRadius: 8, minHeight: 40, padding: '10px 12px', background: '#FFFFFF', boxSizing: 'border-box' }}>
                          <input
                            type="text"
                            inputMode="numeric"
                            value={employeeDefaultQuota}
                            onChange={e => {
                              const digits = e.target.value.replace(/\D/g, '')
                              if (digits === '') { setEmployeeDefaultQuota(0); return }
                              setEmployeeDefaultQuota(Math.min(7, Math.max(1, Number(digits))))
                            }}
                            style={{ width: `${String(employeeDefaultQuota).length}ch`, minWidth: 10, border: 'none', outline: 'none', padding: 0, fontSize: '0.9375rem', color: '#111827', background: 'transparent' }}
                          />
                          <span style={{ fontSize: '0.9375rem', color: '#111827' }}>days per week</span>
                        </div>
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#374151', margin: '0 0 6px' }}>Submission Deadline</label>
                        <div style={{ display: 'flex', gap: 10 }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <DropdownField
                              value={String(deadlineWeekday)}
                              onChange={v => setDeadlineWeekday(Number(v))}
                              options={['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map((day, i) => ({ value: String(i), label: day }))}
                            />
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <DropdownField
                              value={deadlineTime}
                              onChange={setDeadlineTime}
                              options={DEADLINE_TIME_OPTIONS}
                            />
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                        <button onClick={() => { setOverrideSearchPanelOpen(false); setOverrideSearch(''); setOverrideRoleFilter('all'); setOverrideDeptFilter('all'); setManagerOverridesModalOpen(true) }} style={{ ...modalGhostButtonStyle, display: 'flex', alignItems: 'center', gap: 6 }}>
                          <UserCog size={13} />
                          Customization
                        </button>
                        <button onClick={() => void saveCompanyDefaultAndDeadline()} disabled={offDaySettingsSaving || offDaySettingsLoading} style={modalPrimaryButtonStyle(offDaySettingsSaving || offDaySettingsLoading)}>
                          {offDaySettingsSaving ? <Spinner size={13} /> : <Check size={14} />}
                          Save
                        </button>
                      </div>

                      {(() => {
                        const deptNameById = new Map(companyDepartments.map(d => [d.id, d.name]))
                        const overrideStaff = companyStaff.filter(person => {
                          const overrideValue = individualQuotaOverrides[person.id]
                          if (overrideValue === undefined) return false
                          const roleDefault = person.role === 'Manager' ? managerDefaultQuota : employeeDefaultQuota
                          return overrideValue !== roleDefault
                        })
                        if (overrideStaff.length === 0) return null

                        return (
                          <div style={{ borderTop: '1px solid #E5E7EB', paddingTop: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
                            <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 700, color: '#374151', margin: 0 }}>Individual Override</label>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                              {overrideStaff.map(person => {
                                const overrideValue = individualQuotaOverrides[person.id]
                                const roleDefault = person.role === 'Manager' ? managerDefaultQuota : employeeDefaultQuota
                                const deptName = person.department_id ? deptNameById.get(person.department_id) : undefined
                                const dc = deptName ? deptColor(deptName) : null
                                const isRevealed = revealedInlineOverrides.has(person.id)
                                return (
                                  <div key={person.id} style={{ border: '1px solid #E5E7EB', borderRadius: 10, padding: '16px 12px', display: 'flex', alignItems: 'center', gap: 10, background: '#FFFFFF' }}>
                                    <RoleAvatar role={person.role} size={34} photoUrl={person.profile_photo_url} />
                                    <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 7 }}>
                                      {dc && (
                                        <span style={{ alignSelf: 'flex-start', fontSize: '0.62rem', fontWeight: 800, color: dc, background: `${dc}1a`, borderRadius: 999, padding: '2px 8px' }}>{deptName}</span>
                                      )}
                                      <span style={{ fontSize: '0.875rem', fontWeight: 700, color: '#111827', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={person.full_name}>{person.full_name}</span>
                                    </div>
                                    {isRevealed ? (
                                      <input
                                        type="text"
                                        inputMode="numeric"
                                        autoFocus
                                        value={inlineOverrideInputText[person.id] ?? String(overrideValue)}
                                        onFocus={e => e.target.select()}
                                        onChange={e => {
                                          // Same 1-7-only, single-digit rule as the Customization modal.
                                          const digit = e.target.value.replace(/\D/g, '').slice(-1)
                                          if (digit !== '' && !/^[1-7]$/.test(digit)) return
                                          setInlineOverrideInputText(prev => ({ ...prev, [person.id]: digit }))
                                        }}
                                        onBlur={async () => {
                                          const raw = inlineOverrideInputText[person.id]
                                          setInlineOverrideInputText(prev => { const next = { ...prev }; delete next[person.id]; return next })
                                          setRevealedInlineOverrides(prev => { const next = new Set(prev); next.delete(person.id); return next })
                                          if (raw === undefined) return
                                          const parsed = raw === '' ? roleDefault : Math.min(7, Math.max(1, Number(raw)))
                                          if (parsed === overrideValue) return
                                          if (parsed === roleDefault) await resetIndividualQuotaOverride(person.id)
                                          else await saveIndividualQuotaOverride(person.id, parsed)
                                        }}
                                        style={{ ...inputStyle, width: 54, padding: '6px 4px', fontSize: '0.78rem', textAlign: 'center', flexShrink: 0, fontWeight: 700, color: '#111827' }}
                                      />
                                    ) : (
                                      <button
                                        type="button"
                                        onDoubleClick={() => setRevealedInlineOverrides(prev => new Set(prev).add(person.id))}
                                        title="Double-click to edit"
                                        style={{ ...inputStyle, width: 54, padding: '6px 4px', fontSize: '0.78rem', textAlign: 'center', flexShrink: 0, fontWeight: 700, color: '#111827', cursor: 'pointer', userSelect: 'none' }}
                                      >
                                        {overrideValue}
                                      </button>
                                    )}
                                    <button
                                      type="button"
                                      onClick={() => void resetIndividualQuotaOverride(person.id)}
                                      disabled={offDaySettingsSaving}
                                      title="Remove override"
                                      style={{ width: 28, height: 28, border: 'none', background: 'transparent', color: '#DC2626', cursor: offDaySettingsSaving ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, flexShrink: 0 }}
                                    >
                                      <Trash2 size={13} />
                                    </button>
                                  </div>
                                )
                              })}
                            </div>
                            <button
                              type="button"
                              onClick={() => { setOverrideSearch(''); setOverrideRoleFilter('all'); setOverrideDeptFilter('all'); setManagerOverridesModalOpen(true); setOverrideSearchPanelOpen(true) }}
                              style={{ alignSelf: 'center', marginTop: 2, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7, border: 'none', borderRadius: 10, background: 'linear-gradient(135deg, #F97316, #EA580C)', color: '#FFFFFF', height: 36, padding: '0 14px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
                            >
                              <Plus size={15} strokeWidth={2.5} /> Add Override
                            </button>
                          </div>
                        )
                      })()}
                    </div>
                  </div>
                </section>
              )}
            </div>

            {/* ── RIGHT: Content ───────────────────────────────────────────── */}
            <div style={{ minWidth: 0, display: 'contents' }}>

              {reqError && (
                <div style={{ gridColumn: '2 / 4', padding: 12, background: '#FEF2F2', border: '1px solid #FECACA', color: '#B91C1C', borderRadius: 8, fontSize: '0.84rem', fontWeight: 800 }}>{reqError}</div>
              )}

              {/* ── Shift Swaps ─────────────────────────────────────────────── */}
              {reqTab === 'swaps' && (() => {
                const actionNeeded = swapRequests
                  .filter(r => r.status === 'pending')
                  .sort((a, b) => new Date(a.created_at ?? 0).getTime() - new Date(b.created_at ?? 0).getTime())
                const processed = swapRequests
                  .filter(r => r.status !== 'pending')
                  .sort((a, b) => new Date(b.reviewed_at ?? 0).getTime() - new Date(a.reviewed_at ?? 0).getTime())

                const SwapCard = ({ req, compact, selected, onSelect }: { req: ShiftSwapRequestView; compact?: boolean; selected?: boolean; onSelect?: () => void }) => {
                  const isReadyForDecision = req.counterpart_status === 'approved' && req.status === 'pending'
                  const isAwaitingCounterpart = req.counterpart_status === 'pending' && req.status === 'pending'
                  const initials = (name: string) => name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
                  const avatarColors = ['#3B82F6', '#8B5CF6', '#059669', '#F97316', '#EC4899', '#0EA5E9']
                  const avatarBg = (name: string) => avatarColors[name.charCodeAt(0) % avatarColors.length]

                  if (compact) {
                    const isNew = req.id === newlyProcessedId
                    const isPending = req.status === 'pending'
                    const approved = req.status === 'approved'
                    const StatusIcon = approved ? Check : X
                    const statusTone = approved
                      ? { bg: '#ECFDF5', text: '#047857', border: '#86EFAC' }
                      : { bg: '#FEF2F2', text: '#B91C1C', border: '#FCA5A5' }
                    const miniShiftCard = (
                      name: string,
                      role: string,
                      photoUrl: string | null,
                      shiftDate: string | null,
                      startTime: string | null,
                      endTime: string | null,
                      mirror = false,
                    ) => (
                      <div style={{ flex: 1, minWidth: 0, border: '1px solid #E5E7EB', borderRadius: 12, padding: '12px 10px', display: 'flex', alignItems: 'center', justifyContent: mirror ? 'flex-end' : undefined, gap: 16, background: '#FFFFFF' }}>
                        {mirror && (
                          <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 4 }}>
                            <div style={{ fontSize: '1rem', fontWeight: 800, color: '#111827', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' }}>{name}</div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: '#64748B', minWidth: 0, maxWidth: '100%' }}>
                              <Calendar size={12} style={{ flexShrink: 0 }} />
                              <span style={{ fontSize: '0.75rem', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }}>{formatSwapDate(shiftDate)}</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: '#64748B', minWidth: 0, maxWidth: '100%' }}>
                              <Clock size={12} style={{ flexShrink: 0 }} />
                              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#334155', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }}>{formatTime(startTime)} – {formatTime(endTime)}</span>
                            </div>
                          </div>
                        )}
                        <RoleAvatar role={role} size={54} photoUrl={photoUrl} />
                        {!mirror && (
                          <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
                            <div style={{ fontSize: '1rem', fontWeight: 800, color: '#111827', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: '#64748B', minWidth: 0, maxWidth: '100%' }}>
                              <Calendar size={12} style={{ flexShrink: 0 }} />
                              <span style={{ fontSize: '0.75rem', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }}>{formatSwapDate(shiftDate)}</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: '#64748B', minWidth: 0, maxWidth: '100%' }}>
                              <Clock size={12} style={{ flexShrink: 0 }} />
                              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#334155', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }}>{formatTime(startTime)} – {formatTime(endTime)}</span>
                            </div>
                          </div>
                        )}
                      </div>
                    )
                    return (
                      <div
                        className={`att-request-card${isNew ? ' att-request-card-new' : ''}`}
                        onClick={isPending ? onSelect : undefined}
                        style={{
                          background: selected ? '#FFF7ED' : '#F9FAFB',
                          border: `1.5px solid ${selected ? '#F97316' : isNew ? '#FED7AA' : PANEL_BORDER}`,
                          borderRadius: 14, padding: '12px 14px 14px', display: 'flex', flexDirection: 'column', gap: 12,
                          cursor: isPending && onSelect ? 'pointer' : 'default',
                          boxShadow: selected ? '0 4px 16px rgba(249,115,22,0.14)' : 'none',
                          transition: 'border-color 0.15s, background 0.15s, box-shadow 0.15s',
                          overflow: 'hidden',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', rowGap: 6 }}>
                          {req.department_name && (() => {
                            const dc = deptColor(req.department_name)
                            return <span style={{ fontSize: '0.72rem', fontWeight: 800, color: dc, background: `${dc}1a`, borderRadius: 999, padding: '4px 10px', flexShrink: 0 }}>{req.department_name}</span>
                          })()}
                          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8, minWidth: 0, flexWrap: 'wrap', rowGap: 6 }}>
                            <span style={{ fontSize: '0.76rem', fontWeight: 800, color: '#64748B', whiteSpace: 'nowrap' }}>
                              {isPending ? formatOwnerDecisionTime(req.created_at) : formatOwnerDecisionTime(req.reviewed_at)}
                            </span>
                            {isPending ? (
                              <div onClick={e => e.stopPropagation()} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                {req.counterpart_status === 'approved' && (
                                  <>
                                    <button onClick={() => decideRequest('decide_shift_swap', req.id, 'rejected', req.requester_name)} disabled={reqActionLoading} title="Reject" style={{ width: 28, height: 28, borderRadius: 8, border: '1.5px solid #FECACA', background: '#FFF', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: reqActionLoading ? 'default' : 'pointer', opacity: reqActionLoading ? 0.5 : 1 }}>
                                      <X size={13} style={{ color: '#DC2626' }} />
                                    </button>
                                    <button onClick={() => decideRequest('decide_shift_swap', req.id, 'approved', req.requester_name)} disabled={reqActionLoading} title="Approve" style={{ width: 28, height: 28, borderRadius: 8, border: 'none', background: '#F97316', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: reqActionLoading ? 'default' : 'pointer', opacity: reqActionLoading ? 0.5 : 1 }}>
                                      <Check size={13} style={{ color: '#FFFFFF' }} />
                                    </button>
                                  </>
                                )}
                                {req.counterpart_status === 'pending' && (
                                  <span style={{ fontSize: '0.68rem', fontWeight: 700, color: '#92400E', background: '#FEF3C7', borderRadius: 999, padding: '3px 10px', whiteSpace: 'nowrap' }}>Awaiting</span>
                                )}
                              </div>
                            ) : (
                              <span title={req.status === 'approved' ? 'Approved' : 'Rejected'} style={{ width: 30, height: 30, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: statusTone.bg, color: statusTone.text, border: `1.5px solid ${statusTone.border}`, borderRadius: 999, flexShrink: 0 }}>
                                <StatusIcon size={12} strokeWidth={3} />
                              </span>
                            )}
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          {miniShiftCard(req.requester_name, req.requester_role, req.requester_photo_url, req.requester_shift_date, req.requester_start_time, req.requester_end_time, true)}
                          <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, color: '#94A3B8' }}>
                            <svg width="24" height="8" viewBox="0 0 24 8" fill="none">
                              <line x1="1" y1="4" x2="19" y2="4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
                              <polyline points="16,1 22,4 16,7" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                            <svg width="24" height="8" viewBox="0 0 24 8" fill="none">
                              <line x1="23" y1="4" x2="5" y2="4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
                              <polyline points="8,1 2,4 8,7" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                          </div>
                          {miniShiftCard(req.counterpart_name, req.counterpart_role, req.counterpart_photo_url, req.counterpart_shift_date, req.counterpart_start_time, req.counterpart_end_time)}
                        </div>
                      </div>
                    )
                  }

                  return (
                    <div className="att-request-card" style={{ background: '#FFFFFF', borderRadius: 16, overflow: 'hidden' }}>
                      {/* Top meta row */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 20px 0' }}>
                        {req.department_name && (() => {
                          const dc = deptColor(req.department_name)
                          return (
                            <span style={{ fontSize: '0.78rem', fontWeight: 700, color: dc, background: `${dc}1a`, borderRadius: 999, padding: '5px 12px' }}>{req.department_name}</span>
                          )
                        })()}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                          <Calendar size={12} style={{ color: '#6B7280' }} />
                          <span style={{ fontSize: '0.78rem', color: '#374151', fontWeight: 500 }}>
                            {req.created_at ? new Date(req.created_at).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-'}
                          </span>
                        </div>
                        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
                          {isReadyForDecision && (
                            <>
                              <button onClick={() => decideRequest('decide_shift_swap', req.id, 'rejected', req.requester_name)} disabled={reqActionLoading} title="Reject" style={{ width: 32, height: 32, borderRadius: 8, border: '1.5px solid #FECACA', background: '#FFF', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: reqActionLoading ? 'default' : 'pointer', opacity: reqActionLoading ? 0.5 : 1, transition: 'background 0.14s' }} onMouseEnter={e => { e.currentTarget.style.background = '#FEF2F2' }} onMouseLeave={e => { e.currentTarget.style.background = '#FFF' }}>
                                <X size={15} style={{ color: '#DC2626' }} />
                              </button>
                              <button onClick={() => decideRequest('decide_shift_swap', req.id, 'approved', req.requester_name)} disabled={reqActionLoading} title="Approve" style={{ width: 32, height: 32, borderRadius: 8, border: 'none', background: '#F97316', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: reqActionLoading ? 'default' : 'pointer', opacity: reqActionLoading ? 0.5 : 1 }}>
                                <Check size={15} style={{ color: '#FFFFFF' }} />
                              </button>
                            </>
                          )}
                          {isAwaitingCounterpart && (
                            <span style={{ fontSize: '0.68rem', fontWeight: 700, color: '#92400E', background: '#FEF3C7', borderRadius: 999, padding: '3px 10px' }}>Awaiting</span>
                          )}
                        </div>
                      </div>
                      {/* Two sub-cards + arrow */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 0, padding: '14px 20px 20px' }}>
                        {/* Original Shift card — mirrored: text on the left, avatar on the right (next to the arrow), so the two cards face each other */}
                        <div style={{ flex: 1, background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: 12, padding: '16px 18px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 14, justifyContent: 'flex-end' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 5 }}>
                              <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#111827' }}>{req.requester_name}</div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexDirection: 'row-reverse' }}>
                                <Calendar size={11} style={{ color: '#64748B', flexShrink: 0 }} />
                                <span style={{ fontSize: '0.72rem', fontWeight: 600, color: '#64748B' }}>
                                  {formatSwapDate(req.requester_shift_date)}
                                </span>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexDirection: 'row-reverse' }}>
                                <Clock size={11} style={{ color: '#64748B', flexShrink: 0 }} />
                                <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#334155' }}>{formatTime(req.requester_start_time)} – {formatTime(req.requester_end_time)}</span>
                              </div>
                            </div>
                            <RoleAvatar role={req.requester_role} size={52} photoUrl={req.requester_photo_url} />
                          </div>
                        </div>

                        {/* Arrow */}
                        <div style={{ flexShrink: 0, padding: '0 18px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                          <svg width="32" height="10" viewBox="0 0 32 10" fill="none">
                            <line x1="0" y1="5" x2="26" y2="5" stroke="#9CA3AF" strokeWidth="1.5" strokeLinecap="round"/>
                            <polyline points="22,1 30,5 22,9" fill="none" stroke="#9CA3AF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                          <svg width="32" height="10" viewBox="0 0 32 10" fill="none">
                            <line x1="32" y1="5" x2="6" y2="5" stroke="#9CA3AF" strokeWidth="1.5" strokeLinecap="round"/>
                            <polyline points="10,1 2,5 10,9" fill="none" stroke="#9CA3AF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        </div>

                        {/* Swap With card */}
                        <div style={{ flex: 1, background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: 12, padding: '16px 18px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                            <RoleAvatar role={req.counterpart_role} size={52} photoUrl={req.counterpart_photo_url} />
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                              <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#111827' }}>{req.counterpart_name}</div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                                <Calendar size={11} style={{ color: '#64748B', flexShrink: 0 }} />
                                <span style={{ fontSize: '0.72rem', fontWeight: 600, color: '#64748B' }}>
                                  {formatSwapDate(req.counterpart_shift_date)}
                                </span>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                                <Clock size={11} style={{ color: '#64748B', flexShrink: 0 }} />
                                <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#334155' }}>{formatTime(req.counterpart_start_time)} – {formatTime(req.counterpart_end_time)}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                    </div>
                  )
                }

                return (
                  <>
                    {/* Header row — intentionally empty, no title or refresh needed */}

                    {reqLoading ? (
                      <div style={{ padding: '32px', textAlign: 'center', color: '#9CA3AF', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}><Spinner size={16} dark /> Loading...</div>
                    ) : (
                      <>
                        <div style={{ display: 'contents' }}>
                        {/* Action Needed — always rendered at a fixed size so the grid layout never
                            shifts; shows an empty state in place of the cards once nothing is
                            pending. Shows 2 at a time; clicking a card selects it (driving Current
                            Shifts/Task Changes below) independently from paging through the rest. */}
                        {(() => {
                          const PAGE_SIZE = isNarrowViewport ? 1 : 2
                          const hasActionNeeded = actionNeeded.length > 0
                          const clampedIndex = Math.min(actionIndex, Math.max(actionNeeded.length - 1, 0))
                          const totalPages = Math.ceil(actionNeeded.length / PAGE_SIZE)
                          const currentPage = hasActionNeeded ? Math.floor(clampedIndex / PAGE_SIZE) : 0
                          const pageStart = currentPage * PAGE_SIZE
                          const visibleItems = actionNeeded.slice(pageStart, pageStart + PAGE_SIZE)
                          return (
                        <section style={{ gridColumn: '2', gridRow: '1', background: '#FFFFFF', border: `1px solid ${PANEL_BORDER}`, borderRadius: 14, overflow: 'hidden', height: 260, display: 'flex', flexDirection: 'column' }}>
                          <div style={{ padding: '14px 18px', borderBottom: `1px solid ${PANEL_BORDER}`, display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{ width: 30, height: 30, borderRadius: 9, background: '#FFF7ED', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                              <ClipboardList size={15} style={{ color: '#F97316' }} />
                            </div>
                            <span style={{ fontSize: 18, fontWeight: 700, color: '#0F172A', letterSpacing: '-0.2px', lineHeight: 1.2, flex: 1 }}>Action Needed</span>
                            {totalPages > 1 && (
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <button
                                  onClick={() => setActionIndex(((currentPage - 1 + totalPages) % totalPages) * PAGE_SIZE)}
                                  style={{ width: 28, height: 28, borderRadius: 8, border: '1.5px solid #E5E7EB', background: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'background 0.14s, border-color 0.14s' }}
                                  onMouseEnter={e => { e.currentTarget.style.background = '#F8FAFC'; e.currentTarget.style.borderColor = '#CBD5E1' }}
                                  onMouseLeave={e => { e.currentTarget.style.background = '#FFFFFF'; e.currentTarget.style.borderColor = '#E5E7EB' }}
                                >
                                  <ChevronLeft size={14} style={{ color: '#6B7280' }} />
                                </button>
                                <span style={{ fontSize: '0.72rem', fontWeight: 600, color: '#9CA3AF' }}>{pageStart + 1}-{Math.min(pageStart + PAGE_SIZE, actionNeeded.length)} / {actionNeeded.length}</span>
                                <button
                                  onClick={() => setActionIndex(((currentPage + 1) % totalPages) * PAGE_SIZE)}
                                  style={{ width: 28, height: 28, borderRadius: 8, border: '1.5px solid #E5E7EB', background: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'background 0.14s, border-color 0.14s' }}
                                  onMouseEnter={e => { e.currentTarget.style.background = '#F8FAFC'; e.currentTarget.style.borderColor = '#CBD5E1' }}
                                  onMouseLeave={e => { e.currentTarget.style.background = '#FFFFFF'; e.currentTarget.style.borderColor = '#E5E7EB' }}
                                >
                                  <ChevronRight size={14} style={{ color: '#6B7280' }} />
                                </button>
                              </div>
                            )}
                          </div>
                          {hasActionNeeded ? (
                            <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'row', gap: 10 }}>
                              {visibleItems.map((item, i) => (
                                <div key={item.id} style={{ flex: PAGE_SIZE === 1 ? '1 1 100%' : '0 0 calc(50% - 5px)', minWidth: 0 }}>
                                  <SwapCard
                                    req={item}
                                    compact
                                    selected={item.id === actionNeeded[clampedIndex]?.id}
                                    onSelect={() => setActionIndex(pageStart + i)}
                                  />
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, color: '#9CA3AF' }}>
                              <CheckCheck size={22} strokeWidth={1.5} />
                              <span style={{ fontSize: 13, fontWeight: 600 }}>All caught up — nothing needs action</span>
                            </div>
                          )}
                        </section>
                          )
                        })()}

                        {/* Processed — paginated 6 per page, same pager pattern as Action Needed */}
                        {(() => {
                          const PROCESSED_PAGE_SIZE = 6
                          const processedDepts = ['all', ...Array.from(new Set(processed.map(r => r.department_name).filter(Boolean)))] as string[]
                          const filteredProcessed = processedDeptFilter === 'all' ? processed : processed.filter(r => r.department_name === processedDeptFilter)
                          const totalPages = Math.max(1, Math.ceil(filteredProcessed.length / PROCESSED_PAGE_SIZE))
                          const currentPage = Math.min(processedPage, totalPages - 1)
                          const pageStart = currentPage * PROCESSED_PAGE_SIZE
                          const visibleProcessed = filteredProcessed.slice(pageStart, pageStart + PROCESSED_PAGE_SIZE)
                          return (
                          <section style={{ gridColumn: '3', gridRow: '1 / span 2', alignSelf: 'stretch', background: '#FFFFFF', border: `1px solid ${PANEL_BORDER}`, borderRadius: 14, overflow: 'hidden' }}>
                            <div style={{ padding: '14px 18px', borderBottom: `1px solid ${PANEL_BORDER}`, display: 'flex', alignItems: 'center', gap: 8 }}>
                              <div style={{ width: 30, height: 30, borderRadius: 9, background: '#F0FDF4', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                <CheckCheck size={15} style={{ color: '#16A34A' }} />
                              </div>
                              <span style={{ fontSize: 18, fontWeight: 700, color: '#0F172A', letterSpacing: '-0.2px', lineHeight: 1.2, flex: 1 }}>Processed Requests</span>
                              {totalPages > 1 && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                  <button
                                    onClick={() => setProcessedPage((currentPage - 1 + totalPages) % totalPages)}
                                    style={{ width: 28, height: 28, borderRadius: 8, border: '1.5px solid #E5E7EB', background: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'background 0.14s, border-color 0.14s' }}
                                    onMouseEnter={e => { e.currentTarget.style.background = '#F8FAFC'; e.currentTarget.style.borderColor = '#CBD5E1' }}
                                    onMouseLeave={e => { e.currentTarget.style.background = '#FFFFFF'; e.currentTarget.style.borderColor = '#E5E7EB' }}
                                  >
                                    <ChevronLeft size={14} style={{ color: '#6B7280' }} />
                                  </button>
                                  <span style={{ fontSize: '0.72rem', fontWeight: 600, color: '#9CA3AF' }}>{pageStart + 1}-{Math.min(pageStart + PROCESSED_PAGE_SIZE, filteredProcessed.length)} / {filteredProcessed.length}</span>
                                  <button
                                    onClick={() => setProcessedPage((currentPage + 1) % totalPages)}
                                    style={{ width: 28, height: 28, borderRadius: 8, border: '1.5px solid #E5E7EB', background: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'background 0.14s, border-color 0.14s' }}
                                    onMouseEnter={e => { e.currentTarget.style.background = '#F8FAFC'; e.currentTarget.style.borderColor = '#CBD5E1' }}
                                    onMouseLeave={e => { e.currentTarget.style.background = '#FFFFFF'; e.currentTarget.style.borderColor = '#E5E7EB' }}
                                  >
                                    <ChevronRight size={14} style={{ color: '#6B7280' }} />
                                  </button>
                                </div>
                              )}
                              {/* Department filter dropdown */}
                              <div ref={processedDeptDropdownRef} style={{ position: 'relative' }}>
                                <button
                                  type="button"
                                  onClick={() => setProcessedDeptDropdownOpen(o => !o)}
                                  style={{ display: 'flex', alignItems: 'center', gap: 5, height: 36, padding: '0 10px', border: `1.5px solid ${processedDeptDropdownOpen ? '#F97316' : '#E5E7EB'}`, borderRadius: 8, background: '#FFFFFF', color: '#374151', fontSize: 12, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap', boxShadow: processedDeptDropdownOpen ? '0 0 0 3px rgba(249,115,22,0.10)' : 'none', transition: 'border-color 0.15s' }}
                                >
                                  <Filter size={11} style={{ color: '#9CA3AF', flexShrink: 0 }} />
                                  {processedDeptFilter === 'all' ? 'All Departments' : processedDeptFilter}
                                  <ChevronDown size={11} style={{ color: '#9CA3AF', flexShrink: 0, transform: processedDeptDropdownOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
                                </button>
                                {processedDeptDropdownOpen && (
                                  <div style={{ position: 'absolute', top: 'calc(100% + 4px)', right: 0, minWidth: 160, background: '#FFFFFF', border: '1.5px solid #E5E7EB', borderRadius: 10, boxShadow: '0 8px 24px rgba(15,23,42,0.12)', zIndex: 50, padding: '4px 0', overflow: 'hidden' }}>
                                    {processedDepts.map(dept => {
                                      const active = processedDeptFilter === dept
                                      return (
                                        <button key={dept} type="button"
                                          onClick={() => { setProcessedDeptFilter(dept); setProcessedPage(0); setProcessedDeptDropdownOpen(false) }}
                                          style={{ display: 'block', width: '100%', padding: '8px 14px', textAlign: 'left', border: 'none', background: active ? '#FFF7ED' : 'transparent', color: active ? '#EA580C' : '#374151', fontWeight: active ? 700 : 400, fontSize: 13, cursor: 'pointer' }}
                                          onMouseEnter={e => { if (!active) e.currentTarget.style.background = '#F9FAFB' }}
                                          onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent' }}
                                        >
                                          {dept === 'all' ? 'All Departments' : dept}
                                        </button>
                                      )
                                    })}
                                  </div>
                                )}
                              </div>
                            </div>
                            <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                              {visibleProcessed.length === 0
                                ? <div style={{ padding: '24px', textAlign: 'center', color: '#9CA3AF', fontSize: '0.875rem' }}>{processedDeptFilter === 'all' ? 'No processed requests.' : `No processed requests for ${processedDeptFilter}.`}</div>
                                : visibleProcessed.map(req => <SwapCard key={req.id} req={req} compact />)}
                            </div>
                          </section>
                          )
                        })()}
                        </div>
                      </>
                    )}
                  </>
                )
              })()}

              {/* ── Fixed Day Off ────────────────────────────────────────────── */}
              {reqTab === 'fixedoff' && (() => {
                const actionNeeded = fixedOffActionNeeded
                const clampedIndex = Math.min(fixedOffActionIndex, Math.max(actionNeeded.length - 1, 0))
                const currentItem = currentFixedOffItem
                // displayWeekStart (outer scope) — the oldest week that still has a pending request,
                // falling back to the next submission-open week once nothing is left pending.
                const displayWeekEnd = toISODate(addDays(new Date(`${displayWeekStart}T00:00:00`), 6))
                // Full month grid (not just the currently-open week) — shows every day, past and
                // future, so the Owner can spot at a glance which day historically had the most
                // people off, alongside where the upcoming week's requests are landing.
                const monthAnchorDate = new Date(`${fixedOffCalendarMonthAnchor}T00:00:00`)
                const monthLabel = monthAnchorDate.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
                const firstOfMonth = new Date(monthAnchorDate.getFullYear(), monthAnchorDate.getMonth(), 1)
                const firstGridDow = (firstOfMonth.getDay() + 6) % 7 // Monday-start offset
                const monthGridStart = addDays(firstOfMonth, -firstGridDow)
                const monthGridDates = Array.from({ length: 42 }, (_, i) => toISODate(addDays(monthGridStart, i)))
                const fixedOffByDate = new Map<string, FixedOffDayRequestView[]>()
                fixedOffDayRequests.forEach(req => {
                  const list = fixedOffByDate.get(req.request_date) ?? []
                  list.push(req)
                  fixedOffByDate.set(req.request_date, list)
                })
                const fixedOffStatusTone = (status: string) => {
                  if (status === 'approved') return { bg: '#ECFDF5', text: '#047857', border: '#86EFAC', label: 'Approved' }
                  if (status === 'modified') return { bg: '#FFF7ED', text: '#C2410C', border: '#FED7AA', label: 'Modified' }
                  if (status === 'rejected') return { bg: '#FEF2F2', text: '#B91C1C', border: '#FCA5A5', label: 'Rejected' }
                  return { bg: '#FFF7ED', text: '#EA580C', border: '#FED7AA', label: 'Pending' }
                }
                const fixedOffStaffById = new Map(companyStaff.map(person => [person.id, person]))
                const fixedOffDeptNameById = new Map(companyDepartments.map(dept => [dept.id, dept.name]))

                const FixedOffCard = ({ group }: { group: FixedOffGroup }) => {
                  const isPending = group.status === 'pending'
                  const isApproved = group.status === 'approved'
                  const isModifying = modifyingFixedOffKey === group.key
                  const requester = fixedOffStaffById.get(group.user_id)
                  const departmentId = group.department_id ?? requester?.department_id ?? null
                  const departmentName = departmentId ? fixedOffDeptNameById.get(departmentId) : null
                  const departmentLabel = departmentName ?? 'Unassigned'
                  const departmentColor = departmentName ? deptColor(departmentName) : '#64748B'
                  const StatusIcon = isApproved ? Check : group.status === 'modified' ? Pencil : X
                  const statusTone = fixedOffStatusTone(group.status)
                  const ids = group.requests.map(r => r.id)
                  const weekDates = Array.from({ length: 7 }, (_, i) => toISODate(addDays(new Date(`${group.week_start}T00:00:00`), i)))
                  const requestedCount = group.requests.length
                  const aiResult = requestAiKey === group.key ? requestAiResult : null
                  const aiLoading = requestAiLoading && requestAiKey === group.key
                  const aiErr = requestAiKey === group.key ? requestAiError : ''

                  const toggleModifyDate = (date: string) => {
                    setFixedOffModifySelection(prev => {
                      if (prev.includes(date)) return prev.filter(d => d !== date)
                      if (prev.length >= requestedCount) return prev
                      return [...prev, date]
                    })
                  }

                  return (
                    <div
                      className="att-request-card"
                      style={{
                        width: '100%',
                        boxSizing: 'border-box',
                        background: '#FFFFFF',
                        border: `1.5px solid ${PANEL_BORDER}`,
                        borderRadius: 16,
                        padding: '16px 20px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 14,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 44 }}>
                        <RoleAvatar role={group.requester_role || 'Manager'} size={72} photoUrl={requester?.profile_photo_url ?? null} />

                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flexShrink: 0 }}>
                          <span style={{ alignSelf: 'flex-start', fontSize: '0.72rem', fontWeight: 800, color: departmentColor, background: `${departmentColor}1a`, borderRadius: 999, padding: '3px 10px', whiteSpace: 'nowrap' }}>
                            {departmentLabel}
                          </span>
                          <span style={{ fontSize: '1.05rem', fontWeight: 800, color: '#111827', whiteSpace: 'nowrap' }}>{group.requester_name}</span>
                        </div>

                        <div style={{ width: 1, alignSelf: 'stretch', background: '#E5E7EB', flexShrink: 0 }} />

                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flexShrink: 0 }}>
                          <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#374151', margin: 0 }}>Requested Off Days</label>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                            {group.requests.map(r => (
                              <span key={r.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.76rem', fontWeight: 700, color: '#C2410C', background: '#FFF7ED', border: '1px solid #FED7AA', borderRadius: 999, padding: '4px 10px', whiteSpace: 'nowrap' }}>
                                <Calendar size={11} style={{ flexShrink: 0 }} />
                                {formatFixedOffRequestDay(r.request_date)}
                              </span>
                            ))}
                          </div>
                        </div>

                        <div style={{ width: 1, alignSelf: 'stretch', background: '#E5E7EB', flexShrink: 0 }} />

                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flexShrink: 0 }}>
                          <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#374151', margin: 0 }}>Submitted</label>
                          <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#374151', whiteSpace: 'nowrap' }}>
                            {isPending ? formatOwnerDecisionTime(group.created_at) : formatOwnerDecisionTime(group.reviewed_at ?? group.created_at)}
                          </span>
                        </div>

                        {isPending ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginLeft: 'auto', flexShrink: 0 }}>
                            <button
                              onClick={() => decideFixedOffGroup(ids, 'approved', group.requester_name)}
                              disabled={reqActionLoading}
                              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: '0.78rem', fontWeight: 700, color: '#15803D', background: '#F0FDF4', border: '1.5px solid #BBF7D0', borderRadius: 999, padding: '6px 16px', cursor: reqActionLoading ? 'default' : 'pointer', opacity: reqActionLoading ? 0.6 : 1, transition: 'background 0.15s, border-color 0.15s' }}
                            >
                              <Check size={13} /> Approve
                            </button>
                            <button
                              onClick={() => {
                                if (isModifying || aiResult) {
                                  setModifyingFixedOffKey(null)
                                  setRequestAiKey(null)
                                  setRequestAiResult(null)
                                } else {
                                  void analyzeFixedOffRequest(group.key, ids, requestedCount)
                                }
                              }}
                              disabled={reqActionLoading || aiLoading}
                              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: '0.78rem', fontWeight: 700, color: '#C2410C', background: (isModifying || aiResult) ? '#FFEDD5' : '#FFF7ED', border: `1.5px solid ${(isModifying || aiResult) ? '#FDBA74' : '#FED7AA'}`, borderRadius: 999, padding: '6px 16px', cursor: (reqActionLoading || aiLoading) ? 'default' : 'pointer', opacity: (reqActionLoading || aiLoading) ? 0.6 : 1, transition: 'background 0.15s, border-color 0.15s' }}
                            >
                              {aiLoading ? <Spinner size={13} /> : <Sparkles size={13} />} Suggestion
                            </button>
                          </div>
                        ) : (
                          <span title={statusTone.label} style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.78rem', fontWeight: 700, color: statusTone.text, background: statusTone.bg, border: `1.5px solid ${statusTone.border}`, borderRadius: 999, padding: '6px 16px', flexShrink: 0 }}>
                            <StatusIcon size={13} strokeWidth={3} /> {statusTone.label}
                          </span>
                        )}
                      </div>

                      {aiErr && <div style={{ fontSize: '0.75rem', color: '#DC2626', fontWeight: 600 }}>{aiErr}</div>}

                      {aiResult && aiResult.recommendation === 'approve' && (
                        <div style={{ width: '100%', boxSizing: 'border-box', border: '1px solid #BBF7D0', background: '#F0FDF4', borderRadius: 12, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
                          <span style={{ width: 28, height: 28, borderRadius: '50%', background: '#DCFCE7', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <Check size={14} strokeWidth={3} style={{ color: '#15803D' }} />
                          </span>
                          <p style={{ margin: 0, fontSize: '0.82rem', color: '#374151', lineHeight: 1.4 }}>{aiResult.reason}</p>
                        </div>
                      )}

                      {isModifying && (
                        <div onClick={e => e.stopPropagation()} style={{ width: '100%', boxSizing: 'border-box', border: '1.5px solid #FED7AA', borderRadius: 12, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                            <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                              {aiResult && aiResult.recommendation === 'modify' && (
                                <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#C2410C', lineHeight: 1.4 }}>{aiResult.reason}</span>
                              )}
                              <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#374151', margin: 0 }}>
                                Select {requestedCount} replacement day{requestedCount > 1 ? 's' : ''} for the week of {formatSwapDate(group.week_start)}
                              </label>
                            </div>
                            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: fixedOffModifySelection.length === requestedCount ? '#15803D' : '#9CA3AF' }}>
                              {fixedOffModifySelection.length}/{requestedCount}
                            </span>
                          </div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                            {weekDates.map(date => {
                              const isSelected = fixedOffModifySelection.includes(date)
                              return (
                                <button
                                  key={date}
                                  type="button"
                                  onClick={() => toggleModifyDate(date)}
                                  style={{
                                    display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.72rem', fontWeight: 700,
                                    color: isSelected ? '#FFFFFF' : '#334155',
                                    background: isSelected ? '#F97316' : '#FFFFFF',
                                    border: `1.5px solid ${isSelected ? '#F97316' : '#E5E7EB'}`,
                                    borderRadius: 999, padding: '5px 10px', cursor: 'pointer',
                                  }}
                                >
                                  {formatFixedOffRequestDay(date)}
                                </button>
                              )
                            })}
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                            <button
                              type="button"
                              onClick={() => setModifyingFixedOffKey(null)}
                              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: '0.78rem', fontWeight: 700, color: '#6B7280', background: '#FFFFFF', border: '1.5px solid #E5E7EB', borderRadius: 999, padding: '6px 16px', cursor: 'pointer' }}
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              onClick={() => decideFixedOffGroup(ids, 'modified', group.requester_name, fixedOffModifySelection)}
                              disabled={fixedOffModifySelection.length !== requestedCount || reqActionLoading}
                              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: '0.78rem', fontWeight: 700, color: '#FFFFFF', background: (fixedOffModifySelection.length !== requestedCount || reqActionLoading) ? '#FDBA74' : '#F97316', border: 'none', borderRadius: 999, padding: '6px 16px', cursor: (fixedOffModifySelection.length !== requestedCount || reqActionLoading) ? 'default' : 'pointer', opacity: (fixedOffModifySelection.length !== requestedCount || reqActionLoading) ? 0.7 : 1 }}
                            >
                              {reqActionLoading ? <Spinner size={13} /> : <Check size={13} />} Confirm Modification
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                }

                return (
                  <>
                    {reqLoading ? (
                      <div style={{ gridColumn: '2 / 4', padding: '32px', textAlign: 'center', color: '#9CA3AF', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}><Spinner size={16} dark /> Loading...</div>
                    ) : (
                      <>
                        {/* Request card + Calendar share one grid cell (col 2, spanning both rows)
                             so their combined natural height never has to be forced to match the
                             AI Insights column — splitting them into separate row-1/row-2 grid items
                             let the grid's row-track sizing inflate row 1 to fit AI Insights, leaving
                             a dead gap above the Calendar. ── */}
                        <div style={{ gridColumn: '2', gridRow: '1 / span 2', display: 'flex', flexDirection: 'column', gap: 16 }}>
                        {(() => {
                          const hasActionNeeded = actionNeeded.length > 0
                          // displayWeekStart (outer scope) — the oldest week that still has a pending
                          // request, falling back to the next submission-open week once nothing is
                          // left pending, so the header never jumps ahead of unfinished reviews.
                          const requestWeekRange = formatWeekDateRange(displayWeekStart)
                          const actionTitle = requestWeekRange ? `Off Day Request For Next Week ${requestWeekRange}` : 'Off Day Request'
                          return (
                            <section style={{ background: '#FFFFFF', border: `1px solid ${PANEL_BORDER}`, borderRadius: 14, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                              <div style={{ padding: '14px 18px', borderBottom: `1px solid ${PANEL_BORDER}`, display: 'flex', alignItems: 'center', gap: 8 }}>
                                <div style={{ width: 30, height: 30, borderRadius: 9, background: '#FFF7ED', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                  <ClipboardList size={15} style={{ color: '#F97316' }} />
                                </div>
                                <span title={actionTitle} style={{ fontSize: 18, fontWeight: 700, color: '#0F172A', letterSpacing: '-0.2px', lineHeight: 1.2, flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{actionTitle}</span>
                                {actionNeeded.length > 1 && (
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <button onClick={() => setFixedOffActionIndex((clampedIndex - 1 + actionNeeded.length) % actionNeeded.length)} style={{ width: 28, height: 28, borderRadius: 8, border: '1.5px solid #E5E7EB', background: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                                      <ChevronLeft size={14} style={{ color: '#6B7280' }} />
                                    </button>
                                    <span style={{ fontSize: '0.72rem', fontWeight: 600, color: '#9CA3AF' }}>{clampedIndex + 1} / {actionNeeded.length}</span>
                                    <button onClick={() => setFixedOffActionIndex((clampedIndex + 1) % actionNeeded.length)} style={{ width: 28, height: 28, borderRadius: 8, border: '1.5px solid #E5E7EB', background: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                                      <ChevronRight size={14} style={{ color: '#6B7280' }} />
                                    </button>
                                  </div>
                                )}
                              </div>
                              {currentItem ? (
                                <div style={{ padding: '14px 16px' }}>
                                  <FixedOffCard group={currentItem} />
                                </div>
                              ) : (
                                <div style={{ flex: 1, minHeight: 170, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, color: '#9CA3AF' }}>
                                  <CheckCheck size={22} strokeWidth={1.5} />
                                  <span style={{ fontSize: 13, fontWeight: 600 }}>All caught up — nothing needs action</span>
                                </div>
                              )}
                            </section>
                          )
                        })()}

                        {/* ── Weekly Day Off Calendar — full month grid, every day past and future,
                             so the Owner can spot at a glance which day historically had the most
                             people off, alongside where the currently-open week's requests land. ── */}
                        <section style={{ background: '#FFFFFF', border: `1px solid ${PANEL_BORDER}`, borderRadius: 14, overflow: 'hidden' }}>
                          <div style={{ padding: '14px 18px', borderBottom: `1px solid ${PANEL_BORDER}`, display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{ width: 30, height: 30, borderRadius: 9, background: '#FFF7ED', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                              <CalendarDays size={15} style={{ color: '#F97316' }} />
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <span style={{ fontSize: 18, fontWeight: 700, color: '#0F172A', letterSpacing: '-0.2px', lineHeight: 1.2 }}>Off Day Calendar For {monthLabel}</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <button
                                onClick={() => setFixedOffCalendarMonthAnchor(toISODate(new Date(monthAnchorDate.getFullYear(), monthAnchorDate.getMonth() - 1, 1)))}
                                style={{ width: 28, height: 28, borderRadius: 8, border: '1.5px solid #E5E7EB', background: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                              >
                                <ChevronLeft size={14} style={{ color: '#6B7280' }} />
                              </button>
                              <button
                                onClick={() => setFixedOffCalendarMonthAnchor(toISODate(new Date(monthAnchorDate.getFullYear(), monthAnchorDate.getMonth() + 1, 1)))}
                                style={{ width: 28, height: 28, borderRadius: 8, border: '1.5px solid #E5E7EB', background: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                              >
                                <ChevronRight size={14} style={{ color: '#6B7280' }} />
                              </button>
                            </div>
                          </div>

                          <div style={{ padding: '12px 16px 16px', overflowX: 'auto' }}>
                            <div style={{ minWidth: 560, border: '1px solid #1E293B', borderRadius: 10, overflow: 'hidden' }}>
                              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(76px, 1fr))', background: 'linear-gradient(135deg, #0F172A 0%, #1E293B 100%)', height: 44 }}>
                                {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((label, i) => (
                                  <div
                                    key={label}
                                    style={{
                                      fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.85)', textAlign: 'center', textTransform: 'uppercase', letterSpacing: '0.05em',
                                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                                      borderRight: i !== 6 ? '1px solid rgba(255,255,255,0.08)' : 'none',
                                    }}
                                  >
                                    {label}
                                  </div>
                                ))}
                              </div>
                              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(76px, 1fr))' }}>
                                {monthGridDates.map((date, i) => {
                                  const day = new Date(`${date}T00:00:00`)
                                  const inCurrentMonth = day.getMonth() === monthAnchorDate.getMonth()
                                  const isToday = date === todayKey
                                  const isActiveWeek = date >= displayWeekStart && date <= displayWeekEnd
                                  const requests = fixedOffByDate.get(date) ?? []
                                  const activeRequests = requests.filter(r => r.status !== 'rejected')
                                  const pendingCount = activeRequests.filter(r => r.status === 'pending').length
                                  const decidedCount = activeRequests.length - pendingCount
                                  const tooltip = requests.length > 0
                                    ? requests.map(r => `${r.requester_name} — ${fixedOffStatusTone(r.status).label}`).join('\n')
                                    : undefined
                                  const isLastCol = i % 7 === 6
                                  const isLastRow = i >= monthGridDates.length - 7
                                  const hasDetails = activeRequests.length > 0
                                  const cellBg = !inCurrentMonth ? '#FAFAFA' : isToday ? '#FFF7ED' : isActiveWeek ? '#EFF6FF' : '#FFFFFF'
                                  return [
                                    <div
                                      key={date}
                                      title={tooltip}
                                      onClick={() => { if (hasDetails) setDayOffDetailDate(date) }}
                                      onMouseEnter={e => { if (hasDetails) e.currentTarget.style.background = '#F8FAFC' }}
                                      onMouseLeave={e => { e.currentTarget.style.background = cellBg }}
                                      style={{
                                        borderRight: isLastCol ? 'none' : '1px solid #1E293B',
                                        borderBottom: isLastRow ? 'none' : '1px solid #1E293B',
                                        background: cellBg,
                                        padding: '8px 10px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4, minHeight: 108,
                                        opacity: inCurrentMonth ? 1 : 0.4, position: 'relative',
                                        cursor: hasDetails ? 'pointer' : 'default', transition: 'background 0.14s ease',
                                      }}
                                    >
                                      <div style={{ position: 'absolute', top: 16, right: 16, fontSize: 15, fontWeight: 800, color: '#64748B' }}>
                                        {day.getDate()}
                                      </div>
                                      {isActiveWeek ? (
                                        (decidedCount > 0 || pendingCount > 0) && (
                                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                            {decidedCount > 0 && (
                                              <span style={{ width: 36, height: 36, borderRadius: '50%', background: '#DCFCE7', color: '#15803D', fontSize: 16, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                                {decidedCount}
                                              </span>
                                            )}
                                            {pendingCount > 0 && (
                                              <span style={{ width: 36, height: 36, borderRadius: '50%', background: '#DBEAFE', color: '#1D4ED8', fontSize: 16, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                                {pendingCount}
                                              </span>
                                            )}
                                          </div>
                                        )
                                      ) : (
                                        activeRequests.length > 0 && (
                                          <span style={{ width: 36, height: 36, borderRadius: '50%', background: '#FFEDD5', color: '#C2410C', fontSize: 16, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                            {activeRequests.length}
                                          </span>
                                        )
                                      )}
                                    </div>,
                                    isLastCol && isActiveWeek && (
                                      <div
                                        key={`${date}-week-label`}
                                        style={{
                                          gridColumn: '1 / -1', textAlign: 'center', padding: '6px 0', fontSize: 12, fontWeight: 700,
                                          color: '#1D4ED8', background: '#EFF6FF', borderBottom: isLastRow ? 'none' : '1px solid #1E293B',
                                        }}
                                      >
                                        Requesting Week
                                      </div>
                                    ),
                                  ]
                                })}
                              </div>
                            </div>
                          </div>
                        </section>
                        </div>

                        {/* ── Request Overview + Details share one grid cell (col 3, spanning both
                             rows), same reasoning as the col-2 wrapper above. ── */}
                        <div style={{ gridColumn: '3', gridRow: '1 / span 2', display: 'flex', flexDirection: 'column', gap: 16 }}>
                        {(() => {
                          const weekDates = Array.from({ length: 7 }, (_, i) => toISODate(addDays(new Date(`${displayWeekStart}T00:00:00`), i)))
                          const dayLabel = (date: string) => {
                            const d = new Date(`${date}T00:00:00`)
                            return {
                              short: d.toLocaleDateString('en-GB', { weekday: 'short' }),
                              dayMonth: d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }),
                            }
                          }
                          const dayCounts = weekDates.map(date => (fixedOffByDate.get(date) ?? []).filter(r => r.status !== 'rejected').length)
                          const maxCount = Math.max(1, ...dayCounts)

                          return (
                            <section style={{ background: '#FFFFFF', border: `1px solid ${PANEL_BORDER}`, borderRadius: 14, overflow: 'hidden' }}>
                              <div style={{ padding: '14px 18px', borderBottom: `1px solid ${PANEL_BORDER}`, display: 'flex', alignItems: 'center', gap: 8 }}>
                                <div style={{ width: 30, height: 30, borderRadius: 9, background: '#FFF7ED', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                  <BarChart3 size={15} style={{ color: '#F97316' }} />
                                </div>
                                <span style={{ fontSize: 18, fontWeight: 700, color: '#0F172A', letterSpacing: '-0.2px', lineHeight: 1.2 }}>Request Overview</span>
                              </div>
                              <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 18 }}>
                                {weekDates.map((date, i) => {
                                  const label = dayLabel(date)
                                  const count = dayCounts[i]
                                  return (
                                    <div key={date} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                      <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#374151', width: 88, flexShrink: 0, whiteSpace: 'nowrap' }}>{label.short} ({label.dayMonth})</span>
                                      <div style={{ flex: 1, height: 14, borderRadius: 999, background: '#F1F5F9', overflow: 'hidden' }}>
                                        <div style={{ width: `${(count / maxCount) * 100}%`, height: '100%', borderRadius: 999, background: '#F97316' }} />
                                      </div>
                                      <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#374151', width: 20, textAlign: 'right', flexShrink: 0 }}>{count}</span>
                                    </div>
                                  )
                                })}
                              </div>
                            </section>
                          )
                        })()}

                        {(() => {
                          const detailRequests = dayOffDetailDate
                            ? fixedOffDayRequests
                              .filter(r => r.request_date === dayOffDetailDate && r.status !== 'rejected')
                              .sort((a, b) => a.requester_name.localeCompare(b.requester_name))
                            : []
                          const detailDateLabel = dayOffDetailDate
                            ? new Date(`${dayOffDetailDate}T00:00:00`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
                            : null
                          // Each person's full weekly request (not just this one day) gives context —
                          // e.g. someone off Tue AND Wed shows both dates even though only Tue was clicked.
                          const groupByUserWeek = new Map(fixedOffGroupsAll.map(g => [`${g.user_id}_${g.week_start}`, g]))
                          const managerRequests = detailRequests.filter(r => r.requester_role === 'Manager')
                          const employeeRequests = detailRequests.filter(r => r.requester_role === 'Employee')
                          const isDetailInRequestingWeek = !!dayOffDetailDate && dayOffDetailDate >= displayWeekStart && dayOffDetailDate <= displayWeekEnd
                          const managerLabel = isDetailInRequestingWeek ? 'Managers Requesting Off' : 'Manager'
                          const employeeLabel = isDetailInRequestingWeek ? 'Employee Requesting Off' : 'Employee'

                          const renderPerson = (req: FixedOffDayRequestView) => {
                            const person = fixedOffStaffById.get(req.user_id)
                            const deptId = req.department_id ?? person?.department_id ?? null
                            const deptName = deptId ? fixedOffDeptNameById.get(deptId) : null
                            const dc = deptName ? deptColor(deptName) : '#64748B'
                            const group = groupByUserWeek.get(`${req.user_id}_${req.week_start}`)
                            const requestedDates = group?.requests ?? [req]
                            return (
                              <div key={req.id} style={{ display: 'flex', alignItems: 'center', gap: 14, border: `1px solid ${PANEL_BORDER}`, borderRadius: 12, padding: '14px 16px' }}>
                                <RoleAvatar role={req.requester_role} size={44} photoUrl={person?.profile_photo_url ?? null} />
                                <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
                                  {deptName && (
                                    <span style={{ alignSelf: 'flex-start', fontSize: '0.58rem', fontWeight: 800, color: dc, background: `${dc}1a`, borderRadius: 999, padding: '2px 8px' }}>{deptName}</span>
                                  )}
                                  <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#111827', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{req.requester_name}</span>
                                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                    {requestedDates.map(r => (
                                      <span key={r.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.64rem', fontWeight: 700, color: '#C2410C', background: '#FFF7ED', border: '1px solid #FED7AA', borderRadius: 999, padding: '3px 8px', whiteSpace: 'nowrap' }}>
                                        <Calendar size={10} style={{ flexShrink: 0 }} />
                                        {formatFixedOffRequestDay(r.request_date)}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                                {(req.status === 'approved' || req.status === 'modified') && (
                                  <span title="Approved" style={{ width: 26, height: 26, borderRadius: '50%', background: '#DCFCE7', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                    <Check size={14} strokeWidth={3} style={{ color: '#15803D' }} />
                                  </span>
                                )}
                              </div>
                            )
                          }

                          return (
                            <ShowcaseCard
                              icon={<Eye size={15} style={{ color: '#F97316' }} />}
                              title={detailDateLabel ? `Details for ${detailDateLabel}` : 'Details'}
                              actions={dayOffDetailDate ? (
                                <button type="button" onClick={() => setDayOffDetailDate(null)} style={{ width: 26, height: 26, borderRadius: 8, border: '1.5px solid #E5E7EB', background: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
                                  <X size={12} style={{ color: '#6B7280' }} />
                                </button>
                              ) : undefined}
                            >
                              {!dayOffDetailDate ? (
                                <div style={{ padding: '28px 0', textAlign: 'center', background: '#F8FAFC', borderRadius: 14 }}>
                                  <p style={{ fontSize: 12, color: '#94A3B8', margin: 0 }}>Click a day in the calendar to see who&apos;s off.</p>
                                </div>
                              ) : detailRequests.length === 0 ? (
                                <div style={{ padding: '28px 0', textAlign: 'center', background: '#F8FAFC', borderRadius: 14 }}>
                                  <p style={{ fontSize: 12, color: '#94A3B8', margin: 0 }}>No one is off this day.</p>
                                </div>
                              ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxHeight: 580, overflowY: 'auto', paddingRight: 8 }}>
                                  {managerRequests.length > 0 && (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                      <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#111827' }}>{managerLabel}</span>
                                      {managerRequests.map(renderPerson)}
                                    </div>
                                  )}
                                  {employeeRequests.length > 0 && (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                      <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#111827' }}>{employeeLabel}</span>
                                      {employeeRequests.map(renderPerson)}
                                    </div>
                                  )}
                                </div>
                              )}
                            </ShowcaseCard>
                          )
                        })()}
                        </div>

                      </>
                    )}
                  </>
                )
              })()}

            </div>{/* /right content */}
            </div>{/* /two-col grid */}

            {/* ── Current Shifts + Task Changes — full-width, below Type + Action Needed ───
                 Stacked in one flex wrapper (not separate grid rows) so they stay flush together
                 regardless of how tall column 3 (Processed Requests, which spans rows 1-2) makes
                 the row-2 track — a second grid row would inherit that inflated track height and
                 leave a large gap above it. ─── */}
            <div style={{ gridColumn: '1 / 3', gridRow: '2', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>
              <CurrentShiftsBlock
                show={reqTab === 'swaps'}
                deptName={currentShiftsDept ?? ''}
                rows={currentShiftsRows}
                loading={currentShiftsLoading}
                panelBorder={PANEL_BORDER}
                highlightRequest={activeSwapRequest}
                anchorDate={csAnchorDate}
                onNavigateDay={navigateCurrentShiftsDay}
              />
              <div style={{ display: 'flex', alignItems: 'stretch', gap: 16 }}>
                <TaskChangeBlock
                  title="Current Task"
                  show={reqTab === 'swaps'}
                  request={activeSwapRequest}
                  panelBorder={PANEL_BORDER}
                  useCounterpartTasksForRequester={false}
                  onSelectTask={setTaskChangeDetail}
                />
                <TaskChangeBlock
                  title="After Change"
                  show={reqTab === 'swaps'}
                  request={activeSwapRequest}
                  panelBorder={PANEL_BORDER}
                  useCounterpartTasksForRequester={true}
                  onSelectTask={setTaskChangeDetail}
                />
              </div>
            </div>
          </div>
        )}

      </main>

      {/* ── Export modal ─────────────────────────────────────────────────── */}
      {exportOpen && (
        <ModalOverlay onClose={() => setExportOpen(false)} maxWidth="420px">
          <ModalBox>
            <ModalHeader title="Export Attendance Records" icon={<Download size={15} color="#fff" strokeWidth={2.5} />} onClose={() => setExportOpen(false)} />

            <div style={{ padding: '0 24px', display: 'flex', flexDirection: 'column' }}>
              {/* Date range */}
              <div style={{ padding: '16px 0', borderBottom: '1px solid #F3F4F6' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div>
                    <label style={{ ...modalLabelStyle, fontSize: '0.8125rem' }}>From</label>
                    <DatePickerField
                      value={exportFrom}
                      onChange={setExportFrom}
                      placeholder="Select date"
                      max={exportTo || new Date().toISOString().slice(0, 10)}
                      clearable={false}
                    />
                  </div>
                  <div>
                    <label style={{ ...modalLabelStyle, fontSize: '0.8125rem' }}>To</label>
                    <DatePickerField
                      value={exportTo}
                      onChange={setExportTo}
                      placeholder="Select date"
                      min={exportFrom || undefined}
                      max={new Date().toISOString().slice(0, 10)}
                      clearable={false}
                    />
                  </div>
                </div>
              </div>

              {/* Format */}
              <div style={{ padding: '16px 0' }}>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#6B7280', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Format</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  {([
                    { key: 'csv', label: 'Excel / CSV' },
                    { key: 'pdf', label: 'PDF' },
                  ] as const).map(({ key, label }) => (
                    <button key={key} onClick={() => setExportFormat(key)} style={{
                      padding: '12px 0', borderRadius: 10,
                      border: `1.5px solid ${exportFormat === key ? '#F97316' : '#E5E7EB'}`,
                      background: exportFormat === key ? '#FFF7ED' : '#FAFAFA',
                      color: exportFormat === key ? '#EA580C' : '#6B7280',
                      fontWeight: 700, fontSize: '0.8125rem', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                      transition: 'border-color 0.15s, background 0.15s',
                    }}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div style={{ padding: '12px 24px 20px', display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid #F3F4F6' }}>
              <button
                disabled={!exportFrom || !exportTo || exportLoading}
                onClick={async () => { await doExport(exportFrom, exportTo, exportFormat); setExportOpen(false) }}
                style={modalPrimaryButtonStyle(!exportFrom || !exportTo || exportLoading)}>
                <Download size={13} /> {exportLoading ? 'Exporting…' : 'Export'}
              </button>
            </div>
          </ModalBox>
        </ModalOverlay>
      )}

      {/* ── Attendance Record modal ───────────────────────────────────────── */}
      {reviewOpen && reviewRecord && (
        <ModalOverlay onClose={() => setReviewOpen(false)} maxWidth="420px">
          <ModalBox>
            <ModalHeader title="Attendance Record" icon={<Check size={15} color="#fff" strokeWidth={2.5} />} onClose={() => setReviewOpen(false)} />

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
                    if (status === 'absent') return <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: 999, fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', background: '#FEF2F2', color: '#B91C1C' }}>Absent</span>
                    return null
                  })()}
                </div>
              </div>
            </div>

            {/* Read-only fields */}
            <div style={{ padding: '0 24px', display: 'flex', flexDirection: 'column' }}>
              {([
                ...(reviewRecord.assignee_role === 'Casual Worker'
                  ? [
                      { label: 'Job Type', value: reviewRecord.shift.is_open_ended ? 'One-off Job' : 'Shift Job' },
                      {
                        label: 'Job Title',
                        value: reviewRecord.shift.title ?? '—',
                        onClick: reviewRecord.shift.source_job_posting_id
                          ? () => openJobPostingDetail(reviewRecord.shift.source_job_posting_id!)
                          : undefined,
                      },
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
              ] as { label: string; value: string; onClick?: () => void }[]).map(field => (
                <div key={field.label} style={{ padding: '14px 0', borderBottom: '1px solid #F3F4F6' }}>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#6B7280', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{field.label}</label>
                  {field.onClick ? (
                    <button
                      type="button"
                      onClick={field.onClick}
                      title="View job posting details"
                      style={{ fontSize: '0.9375rem', color: '#F97316', margin: 0, background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontWeight: 700, textDecoration: 'underline', textUnderlineOffset: 3 }}
                    >
                      {field.value}
                    </button>
                  ) : (
                    <p style={{ fontSize: '0.9375rem', color: '#111827', margin: 0 }}>{field.value}</p>
                  )}
                </div>
              ))}

              {/* Editable clock times — only meaningful if a clock-in/out record actually exists.
                  A genuine no-show (absent, never clocked in) has no attendance_records row at
                  all, so there is nothing here to edit or save. */}
              {reviewRecord.record && (
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
              )}
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
              {reviewRecord.record && (
                <div style={{ marginLeft: 'auto' }}>
                  <button onClick={submitReview} disabled={reviewActionLoading} style={modalPrimaryButtonStyle(reviewActionLoading)}>
                    {reviewActionLoading ? <Spinner size={13} /> : <Check size={13} />} Save
                  </button>
                </div>
              )}
            </div>
          </ModalBox>
        </ModalOverlay>
      )}

      {/* ── Job Posting detail modal — opened from the "Job Title" field above ──────── */}
      {jobPostingDetailOpen && (
        <ModalOverlay onClose={() => setJobPostingDetailOpen(false)} maxWidth="480px">
          <ModalBox>
            <ModalHeader title="Job Posting" icon={<ClipboardList size={15} color="#fff" strokeWidth={2.5} />} onClose={() => setJobPostingDetailOpen(false)} />
            <div style={{ padding: '20px 24px 24px', display: 'flex', flexDirection: 'column', gap: 16, maxHeight: '70vh', overflowY: 'auto' }}>
              {jobPostingDetailLoading ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '24px 0', color: '#9CA3AF' }}>
                  <Spinner size={16} dark /> Loading…
                </div>
              ) : jobPostingDetailError ? (
                <div style={modalErrorBoxStyle}>{jobPostingDetailError}</div>
              ) : jobPostingDetail ? (
                <>
                  <div>
                    <p style={{ margin: '0 0 6px', fontWeight: 800, fontSize: '1.05rem', color: '#0F172A' }}>{jobPostingDetail.title}</p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', padding: '3px 10px', borderRadius: 99, fontSize: '0.7rem', fontWeight: 700, background: jobPostingDetail.is_recurring ? '#FFF7ED' : '#F5F3FF', color: jobPostingDetail.is_recurring ? '#C2410C' : '#7C3AED', border: `1px solid ${jobPostingDetail.is_recurring ? '#FED7AA' : '#DDD6FE'}` }}>
                        {jobPostingDetail.is_recurring ? 'Shift Job' : 'One-Off Job'}
                      </span>
                      <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#6B7280', textTransform: 'capitalize' }}>{jobPostingDetail.status}</span>
                    </div>
                  </div>
                  <div>
                    <label style={modalLabelStyle}>Description</label>
                    <p style={{ margin: '4px 0 0', fontSize: '0.85rem', color: '#374151', lineHeight: 1.6 }}>{jobPostingDetail.description}</p>
                  </div>
                  {jobPostingDetail.requirements && (
                    <div>
                      <label style={modalLabelStyle}>Requirements</label>
                      <p style={{ margin: '4px 0 0', fontSize: '0.85rem', color: '#374151', lineHeight: 1.6 }}>{jobPostingDetail.requirements}</p>
                    </div>
                  )}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                    <div>
                      <label style={modalLabelStyle}>Location</label>
                      <p style={{ margin: '4px 0 0', fontSize: '0.85rem', color: '#111827' }}>{jobPostingDetail.location ?? '—'}</p>
                    </div>
                    <div>
                      <label style={modalLabelStyle}>Employment Type</label>
                      <p style={{ margin: '4px 0 0', fontSize: '0.85rem', color: '#111827', textTransform: 'capitalize' }}>{jobPostingDetail.employment_type ?? '—'}</p>
                    </div>
                    <div>
                      <label style={modalLabelStyle}>Salary</label>
                      <p style={{ margin: '4px 0 0', fontSize: '0.85rem', color: '#111827' }}>
                        {jobPostingDetail.salary_amount != null ? `$${jobPostingDetail.salary_amount} ${jobPostingDetail.salary_type ?? ''}` : '—'}
                      </p>
                    </div>
                    <div>
                      <label style={modalLabelStyle}>{jobPostingDetail.is_recurring ? 'Shift Time' : 'Job Start'}</label>
                      <p style={{ margin: '4px 0 0', fontSize: '0.85rem', color: '#111827' }}>
                        {jobPostingDetail.is_recurring
                          ? (jobPostingDetail.shift_start_time && jobPostingDetail.shift_end_time ? `${formatShiftHour(jobPostingDetail.shift_start_time)} – ${formatShiftHour(jobPostingDetail.shift_end_time)}` : '—')
                          : (jobPostingDetail.job_start_time ? formatShiftHour(jobPostingDetail.job_start_time) : '—')}
                      </p>
                    </div>
                  </div>
                </>
              ) : null}
            </div>
          </ModalBox>
        </ModalOverlay>
      )}

      {/* ── Task Change detail modal — opened from a task card in Current Task / After Change ── */}
      {taskChangeDetail && (() => {
        const task = taskChangeDetail
        const priorityStyle = task.priority ? TASK_CHANGES_PRIORITY_COLORS[task.priority] : null
        const statusStyle = TASK_CHANGES_STATUS_COLORS[task.status]
        const viewFieldValue: React.CSSProperties = { ...modalInputStyle, display: 'flex', alignItems: 'center' }
        const viewEmpty: React.CSSProperties = { ...viewFieldValue, color: '#9CA3AF', fontStyle: 'italic' }
        return (
          <ModalOverlay onClose={() => setTaskChangeDetail(null)} maxWidth="440px">
            <ModalBox>
              <ModalHeader title={`${task.title}'s Details`} icon={<Eye size={15} color="#fff" strokeWidth={2.5} />} onClose={() => setTaskChangeDetail(null)} />
              <div style={{ padding: '20px 24px 24px', display: 'flex', flexDirection: 'column', gap: 12, maxHeight: 'calc(90vh - 130px)', overflowY: 'auto' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  {priorityStyle && task.priority && (
                    <span style={{ fontSize: '0.72rem', fontWeight: 800, padding: '4px 10px', borderRadius: 99, background: priorityStyle.bg, color: priorityStyle.text, letterSpacing: '0.01em' }}>
                      {task.priority}
                    </span>
                  )}
                  {statusStyle && (
                    <span style={{ fontSize: '0.72rem', fontWeight: 800, padding: '4px 10px', borderRadius: 99, background: statusStyle.bg, color: statusStyle.text, letterSpacing: '0.01em' }}>
                      {task.status}
                    </span>
                  )}
                </div>
                <div>
                  <label style={modalLabelStyle}>Description</label>
                  {task.description
                    ? <div style={{ ...viewFieldValue, alignItems: 'flex-start', whiteSpace: 'pre-wrap', lineHeight: 1.55 }}>{task.description}</div>
                    : <div style={viewEmpty}>No description</div>
                  }
                </div>
                <div>
                  <label style={modalLabelStyle}>Assigned Time</label>
                  <div style={viewFieldValue}>
                    {new Date(task.created_at).toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
                {task.due_at && (
                  <div>
                    <label style={modalLabelStyle}>Due</label>
                    <div style={viewFieldValue}>{formatTaskChangeDueDate(task.due_at)}</div>
                  </div>
                )}
              </div>
            </ModalBox>
          </ModalOverlay>
        )
      })()}

      {managerOverridesModalOpen && (() => {
        const deptNameById = new Map(companyDepartments.map(d => [d.id, d.name]))
        const hasOverrides = Object.keys(individualQuotaOverrides).length > 0
        const overrideStaff = companyStaff.filter(s => individualQuotaOverrides[s.id] !== undefined)
        const showSearchPanel = overrideSearchPanelOpen
        const hasActiveFilter = overrideSearch.trim() !== '' || overrideRoleFilter !== 'all' || overrideDeptFilter !== 'all'
        const keyword = overrideSearch.trim().toLowerCase()
        const filteredStaff = companyStaff.filter(s =>
          (overrideRoleFilter === 'all' || s.role === overrideRoleFilter) &&
          (overrideDeptFilter === 'all' || s.department_id === overrideDeptFilter) &&
          (keyword === '' || s.full_name.toLowerCase().includes(keyword))
        )
        // In the editor, no active filter means "browse everyone"; the saved-overrides snapshot
        // lives in the first modal view so Save can return there like Task Templates does.
        const visibleStaff = hasActiveFilter
          ? filteredStaff : companyStaff
        const hasDrafts = Object.keys(overrideDrafts).length > 0

        const closeSearchPanel = () => {
          setOverrideDrafts({})
          setOverrideSearch('')
          setOverrideRoleFilter('all')
          setOverrideDeptFilter('all')
          setOverrideSearchPanelOpen(false)
          setRevealedOverrideInputs(new Set())
          setOverrideInputText({})
        }

        return (
          <ModalOverlay onClose={() => setManagerOverridesModalOpen(false)} maxWidth="520px">
            <ModalBox>
              <ModalHeader title="Individual Overrides" icon={<UserCog size={15} color="#fff" strokeWidth={2.5} />} onClose={() => setManagerOverridesModalOpen(false)} />
              {!showSearchPanel ? (
                <div style={{ padding: '20px 24px 24px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {!hasOverrides ? (
                    <div style={{ height: 180, borderRadius: 12, background: '#F8FAFC', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#94A3B8', gap: 8, fontWeight: 600, fontSize: 13 }}>
                      <UserCog size={26} strokeWidth={1.5} />
                      No individual overrides yet
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, maxHeight: 360, overflowY: 'auto', paddingRight: 4 }}>
                      {overrideStaff.map(person => {
                        const overrideValue = individualQuotaOverrides[person.id]
                        const roleDefault = person.role === 'Manager' ? managerDefaultQuota : employeeDefaultQuota
                        const listValue = overrideInputText[person.id] ?? String(overrideValue)
                        const isEditingOverride = revealedOverrideInputs.has(person.id)
                        const deptName = person.department_id ? deptNameById.get(person.department_id) : undefined
                        const dc = deptName ? deptColor(deptName) : null
                        return (
                          <div key={person.id} style={{ border: '1px solid #E5E7EB', borderRadius: 10, padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 12, background: '#FFFFFF' }}>
                            <RoleAvatar role={person.role} size={40} photoUrl={person.profile_photo_url} />
                            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
                              {dc && (
                                <span style={{ alignSelf: 'flex-start', fontSize: '0.62rem', fontWeight: 800, color: dc, background: `${dc}1a`, borderRadius: 999, padding: '2px 8px' }}>{deptName}</span>
                              )}
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <span style={{ fontSize: '0.875rem', fontWeight: 700, color: '#111827', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={person.full_name}>{person.full_name}</span>
                              </div>
                            </div>
                            {isEditingOverride ? (
                              <input
                                type="text"
                                inputMode="numeric"
                                autoFocus
                                value={listValue}
                                onFocus={e => e.target.select()}
                                onChange={e => {
                                  const digit = e.target.value.replace(/\D/g, '').slice(-1)
                                  if (digit !== '' && !/^[1-7]$/.test(digit)) return
                                  setOverrideInputText(prev => ({ ...prev, [person.id]: digit }))
                                }}
                                onBlur={() => {
                                  const raw = overrideInputText[person.id]
                                  const parsed = raw ? Math.min(7, Math.max(1, Number(raw))) : overrideValue
                                  setOverrideInputText(prev => { const next = { ...prev }; delete next[person.id]; return next })
                                  setRevealedOverrideInputs(prev => { const next = new Set(prev); next.delete(person.id); return next })
                                  if (parsed === roleDefault) void resetIndividualQuotaOverride(person.id)
                                  else if (parsed !== overrideValue) void saveIndividualQuotaOverride(person.id, parsed)
                                }}
                                onKeyDown={e => {
                                  if (e.key === 'Enter') e.currentTarget.blur()
                                  if (e.key === 'Escape') {
                                    setOverrideInputText(prev => { const next = { ...prev }; delete next[person.id]; return next })
                                    setRevealedOverrideInputs(prev => { const next = new Set(prev); next.delete(person.id); return next })
                                  }
                                }}
                                style={{ ...inputStyle, width: 62, padding: '6px 4px', fontSize: '0.78rem', textAlign: 'center', flexShrink: 0, fontWeight: 700, color: '#111827' }}
                              />
                            ) : (
                              <button
                                type="button"
                                onDoubleClick={() => {
                                  setOverrideInputText(prev => ({ ...prev, [person.id]: String(overrideValue) }))
                                  setRevealedOverrideInputs(prev => new Set(prev).add(person.id))
                                }}
                                title="Double-click to edit override"
                                style={{ ...inputStyle, width: 62, padding: '6px 4px', fontSize: '0.78rem', textAlign: 'center', flexShrink: 0, fontWeight: 700, color: '#111827', cursor: 'pointer', userSelect: 'none' }}
                              >
                                {overrideValue}
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => void resetIndividualQuotaOverride(person.id)}
                              disabled={offDaySettingsSaving}
                              title="Reset to default"
                              style={{ width: 30, height: 34, border: 'none', background: 'transparent', color: '#DC2626', cursor: offDaySettingsSaving ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, flexShrink: 0, opacity: offDaySettingsSaving ? 0.55 : 1 }}
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        )
                      })}
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => setOverrideSearchPanelOpen(true)}
                    style={{ alignSelf: 'center', marginTop: 10, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7, border: 'none', borderRadius: 10, background: 'linear-gradient(135deg, #F97316, #EA580C)', color: '#FFFFFF', height: 36, padding: '0 14px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
                  >
                    <Plus size={15} strokeWidth={2.5} /> Set Override
                  </button>
                </div>
              ) : (
                <>
                  <div style={{ padding: '20px 24px 0', display: 'flex', gap: 8 }}>
                    <div style={{ position: 'relative', flex: 1, minWidth: 0 }}>
                      <Search size={13} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: '#9CA3AF', pointerEvents: 'none' }} />
                      <input
                        value={overrideSearch}
                        onChange={e => setOverrideSearch(e.target.value)}
                        style={{ ...inputStyle, height: 40, padding: '8px 8px 8px 32px', fontSize: '0.8125rem', boxSizing: 'border-box' }}
                      />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <DropdownField
                        fontSize="0.8125rem"
                        value={overrideRoleFilter}
                        onChange={setOverrideRoleFilter}
                        options={[{ value: 'all', label: 'All Roles' }, { value: 'Manager', label: 'Manager' }, { value: 'Employee', label: 'Employee' }]}
                      />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <DropdownField
                        fontSize="0.8125rem"
                        value={overrideDeptFilter}
                        onChange={setOverrideDeptFilter}
                        options={[{ value: 'all', label: 'All Departments' }, ...companyDepartments.map(d => ({ value: d.id, label: d.name }))]}
                      />
                    </div>
                  </div>
                  <div style={{ padding: '16px 24px 20px' }}>
                    {visibleStaff.length === 0 ? (
                      <div style={{ padding: '10px 0', color: '#9CA3AF', fontSize: '0.8125rem', fontWeight: 600 }}>No matching Managers or Employees.</div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 380, overflowY: 'auto', paddingRight: 8 }}>
                        {visibleStaff.map(person => {
                          const roleDefault = person.role === 'Manager' ? managerDefaultQuota : employeeDefaultQuota
                          const value = overrideDrafts[person.id] ?? individualQuotaOverrides[person.id] ?? roleDefault
                          const deptName = person.department_id ? deptNameById.get(person.department_id) : undefined
                          const dc = deptName ? deptColor(deptName) : null
                          return (
                            <div key={person.id} style={{ border: '1px solid #E5E7EB', borderRadius: 12, padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 12, background: '#FFFFFF' }}>
                              <RoleAvatar role={person.role} size={40} photoUrl={person.profile_photo_url} />
                              <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
                                {dc && overrideDeptFilter === 'all' && (
                                  <span style={{ alignSelf: 'flex-start', fontSize: '0.62rem', fontWeight: 800, color: dc, background: `${dc}1a`, borderRadius: 999, padding: '2px 8px' }}>{deptName}</span>
                                )}
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                  <span style={{ fontSize: '0.875rem', fontWeight: 700, color: '#111827', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={person.full_name}>{person.full_name}</span>
                                </div>
                              </div>
                              {value === roleDefault && !revealedOverrideInputs.has(person.id) ? (
                                <button
                                  type="button"
                                  onDoubleClick={() => setRevealedOverrideInputs(prev => new Set(prev).add(person.id))}
                                  title="Double-click to set an override"
                                  style={{ ...inputStyle, width: 62, padding: '6px 4px', fontSize: '0.78rem', textAlign: 'center', flexShrink: 0, fontWeight: 600, color: '#9CA3AF', cursor: 'pointer', userSelect: 'none' }}
                                >
                                  Default
                                </button>
                              ) : (
                                <input
                                  type="text"
                                  inputMode="numeric"
                                  autoFocus={revealedOverrideInputs.has(person.id)}
                                  value={overrideInputText[person.id] ?? String(value)}
                                  onFocus={e => e.target.select()}
                                  onChange={e => {
                                    // Values are always a single digit 1-7 (a week has 7 days) — capping
                                    // input to one character avoids the classic "backspace snaps back to
                                    // the old value" controlled-input bug, and rejecting anything outside
                                    // 1-7 immediately (rather than only clamping on blur) stops 8/9/0 from
                                    // ever being visible even mid-edit.
                                    const digit = e.target.value.replace(/\D/g, '').slice(-1)
                                    if (digit !== '' && !/^[1-7]$/.test(digit)) return
                                    setOverrideInputText(prev => ({ ...prev, [person.id]: digit }))
                                    if (digit !== '') setOverrideDrafts(prev => ({ ...prev, [person.id]: Number(digit) }))
                                  }}
                                  onBlur={() => {
                                    const raw = overrideInputText[person.id]
                                    const parsed = raw ? Math.min(7, Math.max(1, Number(raw))) : roleDefault
                                    setOverrideDrafts(prev => ({ ...prev, [person.id]: parsed }))
                                    setOverrideInputText(prev => { const next = { ...prev }; delete next[person.id]; return next })
                                    if (parsed === roleDefault) {
                                      setRevealedOverrideInputs(prev => { const next = new Set(prev); next.delete(person.id); return next })
                                    }
                                  }}
                                  style={{ ...inputStyle, width: 62, padding: '6px 4px', fontSize: '0.78rem', textAlign: 'center', flexShrink: 0, fontWeight: 700, color: '#111827' }}
                                />
                              )}
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                  <div style={{ padding: '12px 24px 20px', display: 'flex', justifyContent: 'flex-end', gap: 8, borderTop: '1px solid #F3F4F6' }}>
                    <button type="button" onClick={closeSearchPanel} style={modalGhostButtonStyle}>Cancel</button>
                    <button type="button" onClick={() => void saveOverrideDrafts()} disabled={!hasDrafts || offDaySettingsSaving} style={modalPrimaryButtonStyle(!hasDrafts || offDaySettingsSaving)}>
                      {offDaySettingsSaving ? <Spinner size={13} /> : <Check size={13} />} Save
                    </button>
                  </div>
                </>
              )}
            </ModalBox>
          </ModalOverlay>
        )
      })()}

      <Toast message={successToast} />
      <Toast message={errorToast} variant="error" />
    </div>
  )
}
