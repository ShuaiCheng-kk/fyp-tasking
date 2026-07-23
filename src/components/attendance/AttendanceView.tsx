'use client'

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'
import {
  AlertTriangle, ArrowLeftRight, Calendar, CalendarDays, Check, CheckCheck, ChevronDown, ChevronLeft, ChevronRight,
  ClipboardList, Clock, Download, Eye, FileText, Inbox, Pencil, Plus, RefreshCw, Search, Settings, Sparkles, ThumbsDown, ThumbsUp, Trash2, UserCog, UserRound, UserX, X,
} from 'lucide-react'
import RoleAvatar from '@/components/RoleAvatar'
import OwnerPlanBadge from '@/components/owner/PlanBadge'
import OwnerUserBadge from '@/components/owner/OwnerUserBadge'
import Spinner from '@/components/Spinner'
import { deptColor } from '@/lib/deptColor'
import { useIsCompactViewport } from '@/hooks/useIsCompactViewport'
import { useIsCompactContainer } from '@/hooks/useIsCompactContainer'
import {
  AttendanceDashboardRecord,
  AttendanceModifiedTimeField,
  AttendanceRequestStatus,
  FixedOffDaySource,
  FixedOffDayRequestView,
  ShiftSwapMovableTask,
  ShiftSwapRequestView,
} from '@/types/Attendance'
import { ModalOverlay, ModalBox, ModalHeader, modalErrorBoxStyle, modalPrimaryButtonStyle, modalDestructiveButtonStyle, modalGhostButtonStyle, modalInputStyle, modalLabelStyle } from '@/components/modal'
import DatePickerField from '@/components/DatePickerField'
import DropdownField from '@/components/DropdownField'
import Toast from '@/components/Toast'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { TimelineRow, TimelineShiftBlock } from '@/types/Timeline'

const PANEL_BORDER = '#E2E8F0'
const TEXT_DARK = '#0F172A'

// Shape returned by POST /api/attendance/ai-suggest for request_type: 'fixed_off_day_queue' —
// one verdict per pending weekly submission, walked in submission order (first-come-first-served).
// `key` matches groupFixedOff's `${user_id}_${week_start}` so verdicts map straight onto cards.
interface FixedOffDayQueueItemVerdict {
  key: string
  user_id: string
  requester_name: string
  week_start: string
  ids: string[]
  request_dates: string[]
  verdict: 'safe' | 'flagged'
  problem_dates: string[]
  problem_reasons: Record<string, string>
  // Recommended full replacement day set (safe days kept, flagged days swapped) — pre-seeds Modify.
  suggested_dates: string[]
}

interface FixedOffDayQueueSuggestion {
  safe_count: number
  flagged_count: number
  items: FixedOffDayQueueItemVerdict[]
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
  reviewer_name: string | null
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
      if (new Date(req.reviewed_at ?? req.created_at ?? 0).getTime() > new Date(existing.reviewed_at ?? existing.created_at ?? 0).getTime()) {
        existing.reviewed_at = req.reviewed_at ?? req.created_at
        existing.reviewer_name = req.reviewer_name
      }
    } else {
      byKey.set(key, {
        key, user_id: req.user_id, requester_name: req.requester_name, requester_role: req.requester_role,
        department_id: req.department_id, week_start: req.week_start, status: req.status, source: req.source,
        created_at: req.created_at, reviewed_at: req.reviewed_at ?? req.created_at, reviewer_name: req.reviewer_name, requests: [req],
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

// "01 Jul 2026" — fixed 3-letter months (en-GB Intl renders September as "Sept")
const DATE_DISPLAY_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
function formatDateDisplay(value: string | null | undefined, empty = '—'): string {
  if (!value) return empty
  const date = new Date(`${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) return empty
  return `${String(date.getDate()).padStart(2, '0')} ${DATE_DISPLAY_MONTHS[date.getMonth()]} ${date.getFullYear()}`
}

// My Request status chip — shared look for both Shift Swap and Fixed Day Off outcomes.
function myRequestStatusBadge(status: string): { bg: string; text: string; label: string } {
  switch (status) {
    case 'approved':  return { bg: '#ECFDF5', text: '#047857', label: 'Approved' }
    case 'modified':  return { bg: '#EFF6FF', text: '#1D4ED8', label: 'Modified' }
    case 'rejected':  return { bg: '#FEF2F2', text: '#B91C1C', label: 'Rejected' }
    case 'pending':   return { bg: '#FFFBEB', text: '#B45309', label: 'Pending' }
    case 'withdrawn': return { bg: '#F3F4F6', text: '#4B5563', label: 'Withdrawn' }
    case 'expired':   return { bg: '#F3F4F6', text: '#4B5563', label: 'Expired' }
    default:          return { bg: '#F3F4F6', text: '#4B5563', label: status }
  }
}

// "2 hours ago" / "3 days ago" / falls back to the plain date once it's over a week old.
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
  const weeks = Math.floor(days / 7)
  if (weeks < 5) return `${weeks} week${weeks === 1 ? '' : 's'} ago`
  return formatDateDisplay(value.slice(0, 10))
}

// "Sat 26 Jul" — short weekday + date, for My Request card titles.
function formatShortWeekdayDate(value: string | null | undefined): string {
  if (!value) return '—'
  const date = new Date(`${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) return '—'
  const weekday = date.toLocaleDateString('en-GB', { weekday: 'short' })
  return `${weekday} ${String(date.getDate()).padStart(2, '0')} ${DATE_DISPLAY_MONTHS[date.getMonth()]}`
}

// "Tuesday [07 Jul]" — full weekday name + bracketed date, for a Fixed Off Day request's day list.
function formatFixedOffRequestDay(value: string): string {
  const date = new Date(`${value}T00:00:00`)
  const weekday = date.toLocaleDateString('en-GB', { weekday: 'long' })
  const dayMonth = date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
  return `${weekday} [${dayMonth}]`
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

// Compact submitted-on timestamp matching Recruitment's Active Jobs card, e.g. "23 Jul, 09:26PM"
function formatCompactAt(iso: string): string {
  const d = new Date(iso)
  const day = String(d.getDate()).padStart(2, '0')
  const month = d.toLocaleDateString([], { month: 'short' })
  const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }).replace(/\s/g, '')
  return `${day} ${month}, ${time}`
}

// Labels for AttendanceRecord.owner_modified_fields — shown in the "Modified by <Manager>" banner
// on the Owner/Partner review modal, and as the title of the pill's "M" badge.
const OWNER_MODIFIED_FIELD_LABELS: Record<string, string> = {
  clock_in_time: 'Clock In',
  clock_out_time: 'Clock Out',
  break_in_time: 'Break In',
  break_out_time: 'Break Out',
}
function formatModifiedFieldsLabel(fields: string[] | null | undefined): string {
  if (!fields || fields.length === 0) return 'time'
  return fields.map(f => OWNER_MODIFIED_FIELD_LABELS[f] ?? f).join(', ')
}

// Day only (no time-of-day) — the "Modified" field in the review modal only needs the date,
// not the exact minute, per the user's request.
function formatModifiedDateOnly(value: string | null | undefined): string {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  const weekday = date.toLocaleDateString('en-GB', { weekday: 'short' })
  const dayMonth = date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
  return `${weekday}, ${dayMonth}`
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
// todayKey, same Monday-offset math, same local-time deadline moment) — the week currently open
// for submission shifts forward each time a window's own deadline passes, so the header always
// names whichever week a fresh submission would actually land in, not a stale/already-closed one.
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

function fmt(d: Date): string {
  return `${String(d.getDate()).padStart(2, '0')} ${d.toLocaleDateString('en-AU', { month: 'short' })}`
}

function formatShiftHour(time: string): string {
  const [h, m] = time.split(':').map(Number)
  const ampm = h < 12 ? 'am' : 'pm'
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h
  return m === 0 ? `${h12}${ampm}` : `${h12}:${String(m).padStart(2, '0')}${ampm}`
}

// Shift times are UTC-nominal (stored/compared as literal wall-clock, never converted) — read
// clock_in/out timestamps with the UTC getters so an owner-modified time formats consistently
// with the shift's own start_time/end_time instead of drifting through the browser's timezone.
function formatClockHour(iso: string): string {
  const d = new Date(iso)
  const h = d.getUTCHours()
  const m = d.getUTCMinutes()
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

  const measure = useCallback(() => {
    const container = barRef.current
    const btn = btnRefs.current[active]
    if (!container || !btn) return
    const cr = container.getBoundingClientRect()
    const br = btn.getBoundingClientRect()
    setIndicator({ left: br.left - cr.left, width: br.width, opacity: 1 })
  }, [active])

  // A tab's width changes after mount (count/dot appearing once data loads, fonts swapping in),
  // so the indicator must track button resizes — measuring only on `active` leaves it misaligned
  // when the user switches tabs before the Requests data has finished loading.
  const tabSignature = tabs.map(t => `${t.key}:${t.label}:${t.count ?? ''}:${t.dot ? 1 : 0}`).join('|')
  useLayoutEffect(() => { measure() }, [measure, tabSignature])
  useLayoutEffect(() => {
    const observed: Element[] = [barRef.current, ...Object.values(btnRefs.current)].filter((el): el is HTMLButtonElement | HTMLDivElement => !!el)
    const ro = new ResizeObserver(() => measure())
    observed.forEach(el => ro.observe(el))
    return () => ro.disconnect()
  }, [measure])

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

// Every 5-minute slot for 24h, shown/stored as "h:mm AM/PM" for the Clock In/Out pickers.
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
  fontSize: '0.9375rem', fontFamily: "'Inter', system-ui, -apple-system, sans-serif", color: '#111827', outline: 'none', boxSizing: 'border-box', background: '#FFFFFF',
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

function CurrentShiftsBlock({ show, deptName, rows, loading, panelBorder, highlightRequest, anchorDate, onNavigateDay, fixedOffByUserDate }: {
  show: boolean
  deptName: string
  rows: TimelineRow[]
  loading: boolean
  panelBorder: string
  highlightRequest?: ShiftSwapRequestView | null
  anchorDate: string
  onNavigateDay: (dir: number) => void
  // approved fixed off days, keyed `${user_id}|${YYYY-MM-DD}` — shows the purple "Off Day"
  // pill (same as the Records tab) instead of the generic grey OFF on those cells.
  fixedOffByUserDate: Map<string, boolean>
}) {
  // Mouse wheel over the table pages the window day by day (accumulated so trackpads don't
  // fly through weeks). Attached natively: React registers root wheel listeners as passive,
  // so preventDefault() from the synthetic onWheel wouldn't stop the column from scrolling.
  const wheelAreaRef = useRef<HTMLDivElement | null>(null)
  const wheelAccumRef = useRef(0)
  const onNavigateDayRef = useRef(onNavigateDay)
  onNavigateDayRef.current = onNavigateDay
  useEffect(() => {
    const el = wheelAreaRef.current
    if (!el) return
    const handler = (e: WheelEvent) => {
      e.preventDefault()
      const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY
      wheelAccumRef.current += delta
      while (wheelAccumRef.current >= 60) { onNavigateDayRef.current(1); wheelAccumRef.current -= 60 }
      while (wheelAccumRef.current <= -60) { onNavigateDayRef.current(-1); wheelAccumRef.current += 60 }
    }
    el.addEventListener('wheel', handler, { passive: false })
    return () => el.removeEventListener('wheel', handler)
  }, [show])

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
    width: 28, height: 28, borderRadius: 8, border: `1px solid ${panelBorder}`,
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
        <div style={{ flex: 1, display: 'flex', alignItems: 'center' }}>
          <span style={{ fontSize: 18, fontWeight: 700, color: '#0F172A', letterSpacing: '-0.2px', lineHeight: 1.2 }}>Current Schedule</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <button type="button" onClick={() => onNavigateDay(-1)} aria-label="Shift window back one day" disabled={!deptName} style={{ ...csIconButtonStyle, opacity: deptName ? 1 : 0.4, cursor: deptName ? 'pointer' : 'default' }}><ChevronLeft size={15} /></button>
          <button type="button" onClick={() => onNavigateDay(1)} aria-label="Shift window forward one day" disabled={!deptName} style={{ ...csIconButtonStyle, opacity: deptName ? 1 : 0.4, cursor: deptName ? 'pointer' : 'default' }}><ChevronRight size={15} /></button>
        </div>
        {loading && <Spinner size={13} dark />}
      </div>
      <div ref={wheelAreaRef} style={{ overflowX: 'auto', padding: '22px 18px 28px' }}>
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
                            fixedOffByUserDate.get(`${row.user_id}|${date}`) ? (
                              <div style={{ borderRadius: 999, background: '#F5F3FF', border: '1.5px solid #C4B5FD', display: 'flex', alignItems: 'center', justifyContent: 'center', height: 32, gap: 4 }}>
                                <Calendar size={11} color="#7C3AED" />
                                <span style={{ fontSize: 11, fontWeight: 600, color: '#7C3AED', whiteSpace: 'nowrap' }}>Off Day</span>
                              </div>
                            ) : (
                              <div style={{ borderRadius: 999, background: '#E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'center', height: 32 }}>
                                <span style={{ fontSize: 12, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Off</span>
                              </div>
                            )
                          ) : dayShifts.map((shift: TimelineShiftBlock) => {
                            const highlighted = isHighlightedShift(row, shift)
                            return (
                              <div key={shift.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 8px', height: 32, background: highlighted ? '#FFF7ED' : '#F8FAFC', borderRadius: 999, opacity: shift.publication_status === 'draft' ? 0.72 : 1, border: highlighted ? '1.5px solid #FDBA74' : shift.publication_status === 'draft' ? '1.5px dashed #CBD5E1' : '1px solid #E2E8F0', boxShadow: highlighted ? '0 0 0 3px rgba(249,115,22,0.12)' : 'none' }}>
                                <span style={{ fontSize: 12.5, fontWeight: 800, color: highlighted ? '#C2410C' : '#334155', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                  {formatShiftHour(shift.start_time)} – {formatShiftHour(shift.end_time)}
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
        <div style={{ width: 30, height: 30, borderRadius: 9, background: '#FFF7ED', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <ClipboardList size={15} style={{ color: '#F97316' }} />
        </div>
        <span style={{ fontSize: 18, fontWeight: 700, color: '#0F172A', letterSpacing: '-0.2px', lineHeight: 1.2 }}>{title}</span>
      </div>
      {/* Keyed by request id so switching the selected request replays the fade */}
      <div key={request?.id ?? 'none'} className="att-fade-in">
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
      </div>
    </section>
  )
}

// ─── main page ────────────────────────────────────────────────────────────────

// ── Personal clock in/out (UC49) ─────────────────────────────────────────────

type MyShiftRecord = { id: string; clock_in_time: string | null; clock_out_time: string | null; status: string }
type MyShift = {
  assignment: { id: string; user_id: string }
  shift: { id: string; title: string | null; shift_date: string; start_time: string; end_time: string; is_open_ended: boolean }
  record: MyShiftRecord | null
}

// Clock In opens 30 minutes before the scheduled start; Clock Out only once the shift
// reaches its end time (open-ended one-off jobs clock out whenever the work is done).
const CLOCK_IN_WINDOW_MINUTES_BEFORE = 30

function canClockIn(shift: MyShift['shift']): boolean {
  const shiftStart = new Date(`${shift.shift_date}T${shift.start_time}Z`)
  return Date.now() >= shiftStart.getTime() - CLOCK_IN_WINDOW_MINUTES_BEFORE * 60000
}

function isLateForShift(shift: MyShift['shift']): boolean {
  return Date.now() > new Date(`${shift.shift_date}T${shift.start_time}Z`).getTime()
}

function canClockOut(shift: MyShift['shift']): boolean {
  if (shift.is_open_ended) return true
  return Date.now() >= new Date(`${shift.shift_date}T${shift.end_time}Z`).getTime()
}

function fmtShiftTime(hhmmss: string): string {
  const [h, m] = hhmmss.split(':').map(Number)
  const h12 = h % 12 === 0 ? 12 : h % 12
  return `${h12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`
}

function fmtClockStamp(iso: string | null): string {
  if (!iso) return '--'
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'UTC' })
}

export default function AttendanceView({ sidebar, basePath, canModifyClockTimes = true, scopeToManagerDepartments = false, showPersonalClock = false }: {
  sidebar: React.ReactNode
  basePath: string
  // UC56 (modify clock in/out times) is O/P-only.
  canModifyClockTimes?: boolean
  // Manager role scope: records and requests are filtered to the viewer's departments.
  scopeToManagerDepartments?: boolean
  // UC49: Managers (and later Employees) clock in/out of their own shifts from this page.
  showPersonalClock?: boolean
}) {
  const router = useRouter()
  const [internalUserId, setInternalUserId] = useState('')
  const [companyId, setCompanyId] = useState('')
  const [currentPlan, setCurrentPlan] = useState('Free')

  // top-level tab; ?tab=swaps|fixedoff deep-links from the dashboard's Waiting On You cards.
  // Manager has no 'fixedoff' tab at all (see mainTabs below) — ignore that deep link for them
  // rather than landing on a tab with nothing to render.
  const [mainTab, setMainTab] = useState<'records' | 'swaps' | 'fixedoff'>('records')
  useEffect(() => {
    const tab = new URLSearchParams(window.location.search).get('tab')
    if (tab === 'swaps' || (tab === 'fixedoff' && !scopeToManagerDepartments)) setMainTab(tab)
  }, [scopeToManagerDepartments])
  const isCompactReqLayout = useIsCompactViewport(1300)
  // Current Task Assignment / Task Assignment After Swap sit side by side in the middle column
  // of the (up to) 3-column Requests grid above — that column's real width is a fraction of the
  // window (shared with the Requests list and Completed Requests columns), not the window itself,
  // so whether these two panels have room to sit side by side must be measured on their own
  // wrapping row, not a window-width breakpoint (same fix as the Recruitment Applicants panel).
  const [taskChangeRowRef, taskChangeRowCompact] = useIsCompactContainer<HTMLDivElement>(1100)

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
  const [reviewBreakIn, setReviewBreakIn] = useState('')
  const [reviewBreakOut, setReviewBreakOut] = useState('')
  // What the four pickers were pre-filled with when the modal opened — compared against their
  // current value so the Reason field (and Save's "modify" behavior) only appears once the user
  // has actually touched a time, not just for opening the record to look at it.
  const [reviewInitialTimes, setReviewInitialTimes] = useState({ clockIn: '', clockOut: '', breakIn: '', breakOut: '' })
  const [reviewReason, setReviewReason] = useState('')
  const [reviewActionLoading, setReviewActionLoading] = useState(false)
  const [reviewError, setReviewError] = useState('')
  const [cwWorkerStatus, setCwWorkerStatus] = useState<string | null>(null)
  const [cwStatusLoading, setCwStatusLoading] = useState(false)

  // task-change detail modal — opened from a task card in the Current Task / After Change panels
  const [taskChangeDetail, setTaskChangeDetail] = useState<ShiftSwapMovableTask | null>(null)

  // ── Export modal state ────────────────────────────────────────────────────
  const [exportOpen, setExportOpen] = useState(false)
  const [exportLoading, setExportLoading] = useState(false)
  const [exportFrom, setExportFrom] = useState('')
  const [exportTo, setExportTo] = useState('')
  const [exportFormat, setExportFormat] = useState<'csv' | 'pdf'>('csv')

  // ── Off Day Settings block state ─────────────────────────────────────────
  // Settings live in a modal, opened from the gear button in the Off Day Request block header.
  const [offDaySettingsOpen, setOffDaySettingsOpen] = useState(false)
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
  const [overrideSearch, setOverrideSearch] = useState('')
  const [overrideRoleFilter, setOverrideRoleFilter] = useState('all')
  const [overrideDeptFilter, setOverrideDeptFilter] = useState('all')
  const [overrideSearchPanelOpen, setOverrideSearchPanelOpen] = useState(false)
  const [deadlineWeekday, setDeadlineWeekday] = useState(2)
  const [deadlineTime, setDeadlineTime] = useState('17:00')

  // ── Shift Swap Settings block state ──────────────────────────────────────
  // Owner/Partner-only, company-wide — governs Manager<->Manager swaps only.
  const [swapSettingsLoading, setSwapSettingsLoading] = useState(false)
  const [swapSettingsError, setSwapSettingsError] = useState('')
  const [swapSettingsSaving, setSwapSettingsSaving] = useState(false)
  const [swapAutoApprovalEnabled, setSwapAutoApprovalEnabled] = useState(false)
  const [swapMonthlyLimit, setSwapMonthlyLimit] = useState<number | null>(3)
  const [swapDeadlineHours, setSwapDeadlineHours] = useState<number | null>(null)
  const [swapReviewOnLimitExceeded, setSwapReviewOnLimitExceeded] = useState(true)
  const [swapReviewOnDeadlineExceeded, setSwapReviewOnDeadlineExceeded] = useState(true)

  // ── Manager's own Shift Swap Settings block state ────────────────────────
  // Manager-only, department-scoped — governs Employee<->Employee swaps within one of their own
  // managed departments only (confirmed 2026-07-23: Owner/Partner's settings above stop at
  // Manager-level swaps, so Employee-level swaps need their own Manager-owned settings row).
  const [managerSwapSettingsOpen, setManagerSwapSettingsOpen] = useState(false)
  const [managerSwapDepartments, setManagerSwapDepartments] = useState<{ department_id: string; department_name: string }[]>([])
  const [managerSwapDeptId, setManagerSwapDeptId] = useState<string | null>(null)
  const [managerSwapSettingsLoading, setManagerSwapSettingsLoading] = useState(false)
  const [managerSwapSettingsError, setManagerSwapSettingsError] = useState('')
  const [managerSwapSettingsSaving, setManagerSwapSettingsSaving] = useState(false)
  const [managerSwapAutoApprovalEnabled, setManagerSwapAutoApprovalEnabled] = useState(false)
  const [managerSwapMonthlyLimit, setManagerSwapMonthlyLimit] = useState<number | null>(null)
  const [managerSwapDeadlineHours, setManagerSwapDeadlineHours] = useState<number | null>(null)
  const [managerSwapReviewOnLimitExceeded, setManagerSwapReviewOnLimitExceeded] = useState(true)
  const [managerSwapReviewOnDeadlineExceeded, setManagerSwapReviewOnDeadlineExceeded] = useState(true)

  // ── Requests tab state ───────────────────────────────────────────────────
  // Shift Swap and Off Day are now two top-level capsule tabs; reqTab is derived from mainTab
  // so all the existing reqTab-gated request UI below keeps working unchanged.
  const reqTab: 'swaps' | 'fixedoff' = mainTab === 'fixedoff' ? 'fixedoff' : 'swaps'
  const [swapRequests, setSwapRequests] = useState<ShiftSwapRequestView[]>([])
  const [fixedOffDayRequests, setFixedOffDayRequests] = useState<FixedOffDayRequestView[]>([])
  const [reqLoading, setReqLoading] = useState(false)
  const [actionIndex, setActionIndex] = useState(0)
  const [swapSettingsOpen, setSwapSettingsOpen] = useState(false)
  const [fixedOffActionIndex, setFixedOffActionIndex] = useState(0)
  // Owner/Partner must write a reason before a Shift Swap rejection goes through.
  const [rejectSwapTarget, setRejectSwapTarget] = useState<{ id: string; requesterName: string } | null>(null)
  const [rejectSwapReason, setRejectSwapReason] = useState('')
  const [rejectSwapError, setRejectSwapError] = useState('')
  // Clicking a Requests card focuses the calendar on that submission: its days show the requester's
  // name and the rest of the requesting week's counts hide. Clicking anywhere else cancels it.
  const [offDayHighlightEnabled, setOffDayHighlightEnabled] = useState(false)
  useEffect(() => {
    if (!offDayHighlightEnabled) return
    const onClickAway = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null
      if (target?.closest('[data-offday-request-card]')) return
      setOffDayHighlightEnabled(false)
    }
    window.addEventListener('click', onClickAway)
    return () => window.removeEventListener('click', onClickAway)
  }, [offDayHighlightEnabled])
  const [dayOffDetailDate, setDayOffDetailDate] = useState<string | null>(null)
  const [processedDeptFilter, setProcessedDeptFilter] = useState<string>('all')
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

  // ── My Request (Manager submits their own Shift Swap / Fixed Day Off via the Submit Request
  // modal on the Records tab — see requestModalOpen below; results show in the My Request block
  // below the Records table). ──
  const [myReqError, setMyReqError] = useState('')
  const [myReqLoading, setMyReqLoading] = useState(false)
  const [mySwaps, setMySwaps] = useState<ShiftSwapRequestView[]>([])
  const [myFixedOff, setMyFixedOff] = useState<FixedOffDayRequestView[]>([])
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
  // "NEW" = a decided (non-pending) request the Manager hasn't opened since it changed — same
  // localStorage-seen-ids pattern used elsewhere in this app (e.g. Recruitment's approved-job dot).
  const [seenMyReqKeys, setSeenMyReqKeys] = useState<Set<string>>(new Set())
  const myReqSeenKey = companyId && internalUserId ? `manager_myreq_seen_${companyId}_${internalUserId}` : ''
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

  // Single "Submit Request" modal — same choose-then-fill pattern as the AI Job Builder wizard's
  // "Choose Job Type" step (two option cards), re-themed to this page's plain orange accent.
  const [requestModalOpen, setRequestModalOpen] = useState(false)
  const [requestModalStep, setRequestModalStep] = useState<'choose' | 'swap' | 'offday'>('choose')
  const [swapShiftId, setSwapShiftId] = useState('')
  const [swapCounterpartId, setSwapCounterpartId] = useState('')
  const [swapCounterpartAssignmentId, setSwapCounterpartAssignmentId] = useState('')
  const [swapReason, setSwapReason] = useState('')
  const [swapSubmitting, setSwapSubmitting] = useState(false)

  const [selectedFixedOffDates, setSelectedFixedOffDates] = useState<string[]>([])
  const [fixedSubmitting, setFixedSubmitting] = useState(false)

  const fetchFixedOffQuota = useCallback(async (cid: string, uid: string) => {
    if (!cid || !uid) return
    try {
      const res = await fetch(`/api/attendance/off-day-settings?company_id=${cid}&user_id=${uid}&resource=my_quota`)
      const data = await res.json()
      if (data.success && typeof data.max_days_per_week === 'number') setFixedOffQuota(data.max_days_per_week)
    } catch {}
  }, [])

  // Swap counterparts must be same-department, same-role (Manager) colleagues with an upcoming
  // (tomorrow+) shift — reuses the timeline endpoint rather than a new API just for this picker.
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

  useEffect(() => {
    if (!scopeToManagerDepartments || !companyId || !internalUserId) return
    void fetchFixedOffQuota(companyId, internalUserId)
    void fetchSwapCandidates(companyId)
    void fetchMyRequests(internalUserId)
  }, [scopeToManagerDepartments, companyId, internalUserId, fetchFixedOffQuota, fetchSwapCandidates, fetchMyRequests])

  const getUpcomingWeekDates = useCallback((): string[] => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const day = today.getDay()
    const daysUntilNextMonday = ((8 - day) % 7) || 7
    const monday = new Date(today)
    monday.setDate(today.getDate() + daysUntilNextMonday)
    // Local date-key, not toISOString().slice(0,10) — toISOString() converts to UTC first, which
    // shifts the date backward a day in any timezone ahead of UTC (e.g. GMT+8) and desyncs from
    // the server's local-date weekStart() bucketing, tripping "All dates must fall within the
    // same week" even though the picker shows 7 contiguous days.
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

  const handleSubmitSwap = async () => {
    if (!swapShiftId || !swapCounterpartId || !swapCounterpartAssignmentId) { setMyReqError('Select a shift, a colleague, and their shift.'); return }
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
          reason: swapReason || null,
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

  // Counterpart accepting/declining a swap someone else invited them into — the request only
  // reaches any reviewer's queue once this step is done (see getShiftSwapRequests filtering out
  // counterpart_status === 'pending'), so without this the swap is stuck forever.
  const [respondingSwapId, setRespondingSwapId] = useState<string | null>(null)
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

  const handleSubmitFixedOff = async () => {
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
  // Owner's "Modify" action — replace a pending submission's day set with a new one. Only one
  // card's picker is open at a time; the Owner just picks the full NEW set of days (keeping a day =
  // selecting it again), and the Modify button turns into Confirm once enough days are selected.
  const [modifyingFixedOffKey, setModifyingFixedOffKey] = useState<string | null>(null)
  const [fixedOffModifyDates, setFixedOffModifyDates] = useState<string[]>([])
  // Whole-queue Suggestion (Requests block) — safe/flagged verdict per pending submission. Kept
  // after the bulk approval so the flagged cards stay marked; stale keys simply stop matching.
  const [queueAiResult, setQueueAiResult] = useState<FixedOffDayQueueSuggestion | null>(null)
  const [queueAiLoading, setQueueAiLoading] = useState(false)
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
  // ── Personal clock in/out (UC49) ──
  const [myShifts, setMyShifts] = useState<MyShift[]>([])
  const [clockBusyId, setClockBusyId] = useState('')
  const [clockMessage, setClockMessage] = useState('')
  const [lateReasonFor, setLateReasonFor] = useState<string | null>(null)
  const [lateReason, setLateReason] = useState('')

  const fetchMyShift = useCallback(async (uid: string) => {
    if (!uid) return
    try {
      const res = await fetch(`/api/employee/attendance?user_id=${uid}&resource=my_shift`)
      const data = await res.json()
      if (data.success) setMyShifts(data.myShift?.shifts ?? [])
    } catch {}
  }, [])

  useEffect(() => {
    if (showPersonalClock && internalUserId) void fetchMyShift(internalUserId)
  }, [showPersonalClock, internalUserId, fetchMyShift])

  // my_shift returns the coming week's assignments — the strip only cares about today's.
  const myTodayShifts = useMemo(() => {
    const now = new Date()
    const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
    return myShifts.filter(s => s.shift.shift_date === todayKey)
  }, [myShifts])

  const runClockAction = async (shift: MyShift, action: 'clock_in' | 'clock_out', extra?: { late_reason?: string }) => {
    setClockBusyId(`${shift.assignment.id}:${action}`)
    setClockMessage('')
    try {
      const body: Record<string, unknown> = { action, user_id: internalUserId, shift_assignment_id: shift.assignment.id }
      if (extra?.late_reason) body.late_reason = extra.late_reason
      const res = await fetch('/api/employee/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.message || 'Attendance action failed')
      setLateReasonFor(null)
      setLateReason('')
      await fetchMyShift(internalUserId)
      if (companyId) void fetchWeekRecords(companyId, arWindowOffset)
      setClockMessage(action === 'clock_in' ? 'Clocked in successfully.' : 'Clocked out successfully.')
    } catch (err) {
      setClockMessage(err instanceof Error ? err.message : 'Attendance action failed')
    } finally {
      setClockBusyId('')
    }
  }

  // Manager scope: filter any dept-labelled row set (by name or id) to the viewer's own departments.
  const scopedDeptRef = useRef<{ ids: Set<string>; names: Set<string> } | null>(null)
  const scopeByDept = useCallback(<T extends { department_name?: string | null; department_id?: string | null }>(rows: T[]): T[] => {
    const scope = scopedDeptRef.current
    if (!scope) return rows
    return rows.filter(r =>
      (r.department_name != null && scope.names.has(r.department_name)) ||
      (r.department_id != null && scope.ids.has(r.department_id))
    )
  }, [])

  const fetchWeekRecords = useCallback(async (cid: string, offset: number) => {
    if (!cid) return
    setWeekLoading(true)
    const today = new Date(); today.setHours(0, 0, 0, 0)
    const to = toISODate(addDays(today, offset))
    const from = toISODate(addDays(today, offset - 6))
    try {
      const res = await fetch(`/api/attendance?company_id=${cid}&resource=range&from_date=${from}&to_date=${to}`)
      const data = await res.json()
      if (data.success) setWeekRecords(scopeByDept(data.records ?? []))
    } catch { /* leave stale data */ }
    finally { setWeekLoading(false) }
  }, [scopeByDept])

  // ── CSV export ────────────────────────────────────────────────────────────
  // ── Fetch request data ────────────────────────────────────────────────────
  const fetchRequestData = useCallback(async (cid: string) => {
    if (!cid) return
    setReqLoading(true)
    setReqError('')
    try {
      // Manager queue: pass manager_id so getShiftSwapRequests returns Employee<->Employee swaps
      // within their department, not the Owner/Partner-style "everyone whose requester isn't an
      // Employee" queue — without this a Manager's OWN Manager<->Manager swap (which goes to
      // Owner/Partner, never to their own review queue) was incorrectly showing up here.
      const managerParam = scopeToManagerDepartments && internalUserId ? `&manager_id=${internalUserId}` : ''
      const [swapRes, fixedRes] = await Promise.all([
        fetch(`/api/attendance?company_id=${cid}&resource=shift_swaps${managerParam}`),
        fetch(`/api/attendance?company_id=${cid}&resource=fixed_off_days`),
      ])
      const swapData = await swapRes.json()
      const fixedData = await fixedRes.json()
      setSwapRequests(scopeByDept((swapData.requests ?? []) as ShiftSwapRequestView[]))
      setFixedOffDayRequests(scopeByDept((fixedData.requests ?? []) as FixedOffDayRequestView[]))
    } catch (err) {
      setReqError(err instanceof Error ? err.message : 'Failed to fetch requests')
    } finally { setReqLoading(false) }
  }, [scopeByDept, scopeToManagerDepartments, internalUserId])

  // Resolve the manager's departments, then re-run the scoped fetches through the filter.
  useEffect(() => {
    if (!scopeToManagerDepartments || !internalUserId || !companyId) return
    let cancelled = false
    fetch(`/api/manager/departments?manager_id=${internalUserId}&company_id=${companyId}`)
      .then(r => r.json())
      .then(d => {
        if (cancelled || !d.success) return
        const rows = d.departments as { department_id: string; department_name: string }[]
        scopedDeptRef.current = { ids: new Set(rows.map(x => x.department_id)), names: new Set(rows.map(x => x.department_name)) }
        void fetchWeekRecords(companyId, arWindowOffset)
        void fetchRequestData(companyId)
      })
      .catch(() => {})
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scopeToManagerDepartments, internalUserId, companyId])

  // ── Fetch current dept shifts for Current Schedule block ─────────────────
  // Fetches a 3-week band (7 days back, 14 forward of the anchor) instead of just the visible
  // 7 days — arrow/wheel navigation inside the band is then served from this cache instantly
  // (no refetch, no spinner); only crossing the band's edge triggers a new request.
  const csFetchedRangeRef = useRef<{ key: string; from: string; to: string } | null>(null)
  const fetchCurrentShifts = useCallback(async (cid: string, deptName: string, anchorDate: string) => {
    if (!cid || !deptName) return
    setCurrentShiftsLoading(true)
    setCurrentShiftsDept(deptName)
    try {
      const anchor = new Date(`${anchorDate}T00:00:00`)
      const from = new Date(anchor); from.setDate(anchor.getDate() - 7)
      const to = new Date(anchor); to.setDate(anchor.getDate() + 13)
      const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      const res = await fetch(`/api/shift?company_id=${cid}&date_from=${fmt(from)}&date_to=${fmt(to)}`)
      const data = await res.json()
      const all: TimelineRow[] = data.success ? data.rows ?? [] : []
      setCurrentShiftsRows(all.filter(r => r.department_name === deptName && r.user_id && (r.role === 'Manager' || r.role === 'Employee')))
      if (data.success) csFetchedRangeRef.current = { key: `${cid}_${deptName}`, from: fmt(from), to: fmt(to) }
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

  // Auto-focus the Current Schedule window on the swap's own two dates whenever a new request
  // becomes active. The pair is CENTERED in the 7-day window (not pinned to the left edge) so
  // the Owner also sees the days before and after the swap — e.g. Mon 13 <-> Tue 14 shows
  // Sat 11 – Fri 17, and Mon 13 <-> Thu 16 shows Sun 12 – Sat 18 — without having to page.
  useEffect(() => {
    if (!activeSwapRequest) return
    const dates = [activeSwapRequest.requester_shift_date, activeSwapRequest.counterpart_shift_date]
      .filter((d): d is string => !!d)
    if (dates.length === 0) return
    const earlier = dates.reduce((a, b) => (a < b ? a : b))
    const later = dates.reduce((a, b) => (a > b ? a : b))
    const spanDays = Math.round((new Date(`${later}T00:00:00`).getTime() - new Date(`${earlier}T00:00:00`).getTime()) / 86400000) + 1
    // Dates further than a week apart can't both fit — fall back to the earlier date's window.
    const leftPad = spanDays >= 7 ? 0 : Math.floor((7 - spanDays) / 2)
    setCsAnchorDate(toISODate(addDays(new Date(`${earlier}T00:00:00`), -leftPad)))
  }, [activeSwapRequest?.id, activeSwapRequest?.requester_shift_date, activeSwapRequest?.counterpart_shift_date])

  // fetch current dept shifts whenever the reviewed card or the viewed window changes — skipped
  // entirely while the visible 7 days still fit inside the already-fetched 3-week band for the
  // same company+department (that's what makes day-by-day navigation instant).
  useEffect(() => {
    if (!companyId || mainTab !== 'swaps' || !activeSwapRequest?.department_name) return
    const winEnd = new Date(`${csAnchorDate}T00:00:00`); winEnd.setDate(winEnd.getDate() + 6)
    const cached = csFetchedRangeRef.current
    if (
      cached &&
      cached.key === `${companyId}_${activeSwapRequest.department_name}` &&
      csAnchorDate >= cached.from && toISODate(winEnd) <= cached.to
    ) {
      setCurrentShiftsDept(activeSwapRequest.department_name)
      return
    }
    void fetchCurrentShifts(companyId, activeSwapRequest.department_name, csAnchorDate)
  }, [companyId, mainTab, activeSwapRequest?.department_name, csAnchorDate, fetchCurrentShifts])

  const fixedOffGroupsAll = useMemo(() => groupFixedOff(fixedOffDayRequests), [fixedOffDayRequests])
  const fixedOffActionNeeded = useMemo(
    () => fixedOffGroupsAll.filter(g => g.status === 'pending').sort((a, b) => new Date(a.created_at ?? 0).getTime() - new Date(b.created_at ?? 0).getTime()),
    [fixedOffGroupsAll],
  )
  const currentFixedOffItem = useMemo(() => {
    const clamped = Math.min(fixedOffActionIndex, Math.max(fixedOffActionNeeded.length - 1, 0))
    return fixedOffActionNeeded[clamped] ?? null
  }, [fixedOffActionNeeded, fixedOffActionIndex])
  // With nothing pending, the Off Day tab collapses to just the Planning Calendar + Details —
  // the Requests queue, Next Week block, and Preview Calendar only exist to act on submissions.
  const offDayQueueEmpty = !reqLoading && fixedOffActionNeeded.length === 0
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
    // Owner/Partner-only data (quota/deadline config for the settings gear on the approval
    // queue) — Manager's Off Day tab is now "My Request" and never renders that queue/gear, so
    // this pre-existing fetch (which 500s for a non-O/P caller) is skipped entirely for them.
    if (mainTab === 'fixedoff' && !scopeToManagerDepartments) void loadOffDaySettings()
  }, [mainTab, loadOffDaySettings])

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

  // ── Shift Swap Settings (auto-approval rules) ────────────────────────────────
  const swapSettingsLoadedForRef = useRef<string | null>(null)
  const loadSwapSettings = useCallback(async (force = false) => {
    if (!companyId || !internalUserId) return
    if (!force && swapSettingsLoadedForRef.current === companyId) return
    swapSettingsLoadedForRef.current = companyId
    setSwapSettingsLoading(true)
    setSwapSettingsError('')
    try {
      const res = await fetch(`/api/attendance/shift-swap-settings?company_id=${companyId}&owner_id=${internalUserId}`)
      const data = await res.json()
      if (!data.success) throw new Error(data.message || 'Failed to load shift swap settings')
      setSwapAutoApprovalEnabled(!!data.settings.auto_approval_enabled)
      setSwapMonthlyLimit(data.settings.monthly_swap_limit ?? null)
      setSwapDeadlineHours(data.settings.deadline_hours_before_shift ?? null)
      setSwapReviewOnLimitExceeded(data.settings.require_review_on_limit_exceeded ?? true)
      setSwapReviewOnDeadlineExceeded(data.settings.require_review_on_deadline_exceeded ?? true)
    } catch (err) {
      swapSettingsLoadedForRef.current = null
      setSwapSettingsError(err instanceof Error ? err.message : 'Failed to load shift swap settings')
    } finally {
      setSwapSettingsLoading(false)
    }
  }, [companyId, internalUserId])

  useEffect(() => {
    // Owner/Partner only — a Manager never reads/writes this company-wide row, so skip the
    // fetch entirely for them instead of hitting an endpoint that will just reject the call.
    if (mainTab === 'swaps' && !scopeToManagerDepartments) void loadSwapSettings()
  }, [mainTab, scopeToManagerDepartments, loadSwapSettings])

  const saveSwapSettings = async () => {
    if (!companyId || !internalUserId) return
    setSwapSettingsSaving(true)
    setSwapSettingsError('')
    try {
      const res = await fetch('/api/attendance/shift-swap-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'set_settings', company_id: companyId, owner_id: internalUserId,
          auto_approval_enabled: swapAutoApprovalEnabled,
          monthly_swap_limit: swapMonthlyLimit,
          deadline_hours_before_shift: swapDeadlineHours,
          require_review_on_limit_exceeded: swapReviewOnLimitExceeded,
          require_review_on_deadline_exceeded: swapReviewOnDeadlineExceeded,
        }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.message || 'Failed to save shift swap settings')
      showSuccessToast('Settings saved successfully.')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save shift swap settings'
      setSwapSettingsError(message)
      showErrorToast(message)
    } finally {
      setSwapSettingsSaving(false)
    }
  }

  // ── Manager's own Shift Swap Settings (Employee<->Employee swaps, department-scoped) ────────
  const loadManagerSwapDepartments = useCallback(async () => {
    if (!companyId || !internalUserId) return
    try {
      const res = await fetch(`/api/manager/departments?manager_id=${internalUserId}&company_id=${companyId}`)
      const data = await res.json()
      if (!data.success) return
      const rows = (data.departments ?? []) as { department_id: string; department_name: string }[]
      setManagerSwapDepartments(rows)
      setManagerSwapDeptId(prev => (prev && rows.some(r => r.department_id === prev) ? prev : rows[0]?.department_id ?? null))
    } catch { /* modal shows its own load error once a department is picked */ }
  }, [companyId, internalUserId])

  const loadManagerSwapSettings = useCallback(async (deptId: string) => {
    if (!companyId || !internalUserId || !deptId) return
    setManagerSwapSettingsLoading(true)
    setManagerSwapSettingsError('')
    try {
      const res = await fetch(`/api/attendance/shift-swap-department-settings?company_id=${companyId}&department_id=${deptId}&manager_id=${internalUserId}`)
      const data = await res.json()
      if (!data.success) throw new Error(data.message || 'Failed to load shift swap settings')
      setManagerSwapAutoApprovalEnabled(!!data.settings.auto_approval_enabled)
      setManagerSwapMonthlyLimit(data.settings.monthly_swap_limit ?? null)
      setManagerSwapDeadlineHours(data.settings.deadline_hours_before_shift ?? null)
      setManagerSwapReviewOnLimitExceeded(data.settings.require_review_on_limit_exceeded ?? true)
      setManagerSwapReviewOnDeadlineExceeded(data.settings.require_review_on_deadline_exceeded ?? true)
    } catch (err) {
      setManagerSwapSettingsError(err instanceof Error ? err.message : 'Failed to load shift swap settings')
    } finally {
      setManagerSwapSettingsLoading(false)
    }
  }, [companyId, internalUserId])

  useEffect(() => {
    if (managerSwapSettingsOpen) void loadManagerSwapDepartments()
  }, [managerSwapSettingsOpen, loadManagerSwapDepartments])

  useEffect(() => {
    if (managerSwapSettingsOpen && managerSwapDeptId) void loadManagerSwapSettings(managerSwapDeptId)
  }, [managerSwapSettingsOpen, managerSwapDeptId, loadManagerSwapSettings])

  const saveManagerSwapSettings = async () => {
    if (!companyId || !internalUserId || !managerSwapDeptId) return
    setManagerSwapSettingsSaving(true)
    setManagerSwapSettingsError('')
    try {
      const res = await fetch('/api/attendance/shift-swap-department-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'set_settings', company_id: companyId, department_id: managerSwapDeptId, manager_id: internalUserId,
          auto_approval_enabled: managerSwapAutoApprovalEnabled,
          monthly_swap_limit: managerSwapMonthlyLimit,
          deadline_hours_before_shift: managerSwapDeadlineHours,
          require_review_on_limit_exceeded: managerSwapReviewOnLimitExceeded,
          require_review_on_deadline_exceeded: managerSwapReviewOnDeadlineExceeded,
        }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.message || 'Failed to save shift swap settings')
      showSuccessToast('Settings saved successfully.')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save shift swap settings'
      setManagerSwapSettingsError(message)
      showErrorToast(message)
    } finally {
      setManagerSwapSettingsSaving(false)
    }
  }

  // ── Decide request ────────────────────────────────────────────────────────
  const decideRequest = async (
    kind: 'decide_shift_swap',
    id: string,
    decision: 'approved' | 'rejected',
    targetName?: string,
    reason?: string,
  ): Promise<boolean> => {
    if (!internalUserId || !companyId) return false
    setReqActionLoading(true)
    setReqError('')
    try {
      const res = await fetch('/api/attendance', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: kind, id, reviewer_id: internalUserId, decision, reason }),
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
      return true
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update request'
      setReqError(message)
      showErrorToast(message)
      return false
    } finally { setReqActionLoading(false) }
  }

  // Confirms rejection from the "Reject Shift Swap" modal — the reason is mandatory, so this
  // only calls decideRequest once the reviewer has actually typed one.
  const confirmRejectSwap = async () => {
    if (!rejectSwapTarget) return
    const reason = rejectSwapReason.trim()
    if (!reason) { setRejectSwapError('A reason is required to reject this request.'); return }
    setRejectSwapError('')
    const ok = await decideRequest('decide_shift_swap', rejectSwapTarget.id, 'rejected', rejectSwapTarget.requesterName, reason)
    if (ok) {
      setRejectSwapTarget(null)
      setRejectSwapReason('')
    }
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
      setFixedOffModifyDates([])
      await fetchRequestData(companyId)
      await refreshQueueAnalysis()
      showSuccessToast(decision === 'approved' ? 'Day off request approved.' : 'Day off request modified.')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update request'
      setReqError(message)
      showErrorToast(message)
    } finally { setReqActionLoading(false) }
  }

  // Requests-block "Suggestion" — analyzes the WHOLE pending queue in one pass instead of one
  // person at a time: first-come-first-served, so a submission is 'safe' when its days still fit
  // after everyone decided/earlier-and-safe in the queue, and 'flagged' when a day is already taken.
  const fetchQueueSuggestion = async (): Promise<FixedOffDayQueueSuggestion> => {
    const res = await fetch('/api/attendance/ai-suggest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ request_type: 'fixed_off_day_queue', company_id: companyId }),
    })
    const data = await res.json()
    if (!data.success) throw new Error(data.message || 'AI analysis failed')
    return data.suggestion
  }

  const analyzeFixedOffQueue = async () => {
    if (!companyId) return
    setQueueAiLoading(true)
    setQueueAiResult(null)
    try {
      setQueueAiResult(await fetchQueueSuggestion())
    } catch (err) {
      const message = err instanceof Error ? err.message : 'AI analysis failed'
      showErrorToast(message)
    } finally {
      setQueueAiLoading(false)
    }
  }

  // Once Process has run, the analysis stays alive: after every decision (approve / modify) the
  // queue is silently re-analyzed so the remaining Review cards always carry fresh verdicts and
  // AI-recommended replacement dates — no need to press Process again. Failures keep the previous
  // (stale) analysis rather than dropping the marks.
  const refreshQueueAnalysis = async () => {
    if (!companyId || !queueAiResult) return
    try {
      setQueueAiResult(await fetchQueueSuggestion())
    } catch {}
  }

  // One-click follow-up to the queue analysis: approve every still-pending submission the analysis
  // marked safe, as one batch. Flagged ones stay in the queue for the per-request Suggestion flow.
  const approveSafeFixedOffQueue = async () => {
    if (!internalUserId || !companyId || !queueAiResult) return
    const safeKeys = new Set(queueAiResult.items.filter(i => i.verdict === 'safe').map(i => i.key))
    const safeGroups = fixedOffActionNeeded.filter(g => safeKeys.has(g.key))
    if (safeGroups.length === 0) return
    setReqActionLoading(true)
    setReqError('')
    try {
      for (const group of safeGroups) {
        const res = await fetch('/api/attendance', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'decide_fixed_off_day', ids: group.requests.map(r => r.id), reviewer_id: internalUserId, decision: 'approved' }),
        })
        const data = await res.json()
        if (!data.success) throw new Error(data.message || `Failed to approve ${group.requester_name}'s request`)
      }
      setActivityLogs(prev => {
        const entries = safeGroups.map(g => ({ id: `${g.requests[0].id}-${Date.now()}`, type: 'fixedoff' as const, action: 'approved' as const, targetName: g.requester_name, ts: new Date() }))
        const next = [...entries, ...prev]
        try { localStorage.setItem('attendance_activity_logs', JSON.stringify(next)) } catch {}
        return next
      })
      setFixedOffActionIndex(0)
      await fetchRequestData(companyId)
      await refreshQueueAnalysis()
      showSuccessToast(safeGroups.length === 1 ? 'Day off request approved.' : `${safeGroups.length} day off requests approved.`)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to approve requests'
      setReqError(message)
      showErrorToast(message)
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
    const initialClockIn = isoToAmPm(row.record?.owner_adjusted_clock_in_time ?? row.record?.clock_in_time)
    const initialClockOut = isoToAmPm(row.record?.owner_adjusted_clock_out_time ?? row.record?.clock_out_time)
    const initialBreakIn = isoToAmPm(row.record?.break_in_time)
    const initialBreakOut = isoToAmPm(row.record?.break_out_time)
    setReviewClockIn(initialClockIn)
    setReviewClockOut(initialClockOut)
    setReviewBreakIn(initialBreakIn)
    setReviewBreakOut(initialBreakOut)
    setReviewInitialTimes({ clockIn: initialClockIn, clockOut: initialClockOut, breakIn: initialBreakIn, breakOut: initialBreakOut })
    // An existing reason is shown read-only (see showReadOnlyReason below) — this state is only
    // for a NEW reason, so it always starts blank; nobody, including the original author, edits
    // the old text directly, they write a fresh one the moment they touch a time again.
    setReviewReason('')
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
        body: JSON.stringify({ user_id: reviewRecord.assignment.user_id, company_id: companyId, worker_status: newStatus }),
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
    setReviewError('')
    // Convert "HH:MM AM/PM" inputs back to ISO using the shift date
    const shiftDate = reviewRecord.shift.shift_date
    const toISO = (ampm: string) => ampm ? new Date(`${shiftDate}T${amPmToHHMM(ampm)}:00Z`).toISOString() : null
    const clockInIso = toISO(reviewClockIn)
    const clockOutIso = toISO(reviewClockOut)
    const breakInIso = toISO(reviewBreakIn)
    const breakOutIso = toISO(reviewBreakOut)

    // Mirrors validateModifiedAttendanceTimes on the server — catches the mistake before the
    // round-trip instead of only after a rejected PATCH.
    if (clockInIso && clockOutIso && new Date(clockInIso).getTime() > new Date(clockOutIso).getTime()) {
      setReviewError('Clock In cannot be later than Clock Out'); return
    }
    if (breakInIso && breakOutIso && new Date(breakInIso).getTime() > new Date(breakOutIso).getTime()) {
      setReviewError('Break In cannot be later than Break Out'); return
    }
    if (breakInIso && clockInIso && clockOutIso && (new Date(breakInIso).getTime() < new Date(clockInIso).getTime() || new Date(breakInIso).getTime() > new Date(clockOutIso).getTime())) {
      setReviewError('Break In must be between Clock In and Clock Out'); return
    }
    if (breakOutIso && clockInIso && clockOutIso && (new Date(breakOutIso).getTime() < new Date(clockInIso).getTime() || new Date(breakOutIso).getTime() > new Date(clockOutIso).getTime())) {
      setReviewError('Break Out must be between Clock In and Clock Out'); return
    }
    // Whether a reason is actually required depends on the TRUE original (per-field, persisted
    // server-side) — e.g. editing a time back to exactly what it originally was needs no reason
    // at all. That comparison isn't duplicated here; the server (finalReviewAttendance) is the
    // sole authority and its error surfaces below if a reason turns out to be required.

    setReviewActionLoading(true)
    try {
      const res = await fetch('/api/attendance', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'final_review',
          id: reviewRecord.record.id,
          owner_id: internalUserId,
          decision: 'modified',
          owner_notes: reviewReason.trim(),
          clock_in_time: clockInIso,
          clock_out_time: clockOutIso,
          break_in_time: breakInIso,
          break_out_time: breakOutIso,
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

  // allGroups: Managers + Employees + Casual Workers together, grouped by department — the
  // Manager page shows its whole department in one table instead of splitting Internal Staff
  // and Casual Workers into two separately-clicked panels (Owner/Partner keep that split).
  const allGroups = useMemo(() => {
    const groups = new Map<string, { deptId: string; deptName: string; people: typeof peopleMap }>()

    peopleMap.forEach((person, userId) => {
      const key = person.deptName || 'No Department'
      if (!groups.has(key)) groups.set(key, { deptId: key, deptName: key, people: new Map() })
      groups.get(key)!.people.set(userId, person)
    })

    return [...groups.values()].sort((a, b) => a.deptName.localeCompare(b.deptName))
  }, [peopleMap])

  // Apply filters — dept panel, casual job type, keyword + role
  const filteredDeptGroups = useMemo(() => {
    const kw = recordsKeyword.toLowerCase().trim()

    // Manager page: always the merged whole-department list (no Internal Staff/Casual Worker
    // panel toggle to drive `source` off). Owner/Partner keep the existing panel-driven split.
    const source = scopeToManagerDepartments ? allGroups : (recordsRole === 'Casual Worker' ? cwGroups : deptGroups)

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
  }, [deptGroups, cwGroups, allGroups, scopeToManagerDepartments, recordsKeyword, recordsRole, selectedDeptId, casualJobType])

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
          // Manager's table merges Casual Workers into the same list as internal staff (see
          // allGroups) — Export must match what's on screen instead of silently dropping them.
          if (!scopeToManagerDepartments && role === 'Casual Worker') return false
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
          : `${fmtShiftHour(rec.shift.start_time)} – ${fmtShiftHour(rec.shift.end_time)}`
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
  }, [companyId, recordsRole, selectedDeptId, casualJobType, scopeToManagerDepartments, showSuccessToast, showErrorToast])

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

  // Manager has no "Off Day"/"My Request" tab at all — they never review anyone's Fixed Day Off
  // (UC55 is O/P-only) and submitting is now the header button on Records (see requestModalOpen).
  const mainTabs = [
    { key: 'records' as const, label: 'Records' },
    { key: 'swaps' as const, label: 'Shift Swap', dot: !reqLoading && pendingSwapCount > 0 },
    ...(scopeToManagerDepartments ? [] : [
      { key: 'fixedoff' as const, label: 'Off Day', dot: !reqLoading && pendingFixedOffCount > 0 },
    ]),
  ]

  // ── Today's date key for AR status reference ──────────────────────────────
  const todayKey = useMemo(() => new Date().toISOString().slice(0, 10), [])

  // Per-block entrance stagger: every newly mounted section gets an incremental animation-delay
  // in DOM order, so the tab's blocks cascade in one after another instead of moving as one page.
  // Already-staggered sections are skipped so refetches (reqLoading flips) don't replay them.
  useLayoutEffect(() => {
    const sections = document.querySelectorAll<HTMLElement>('.att-page section')
    let order = 0
    sections.forEach(el => {
      if (el.dataset.attStaggered === mainTab) return
      el.dataset.attStaggered = mainTab
      el.style.animationDelay = `${Math.min(order, 8) * 80}ms`
      order++
    })
  }, [mainTab, reqLoading])

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="att-page" style={{ display: 'flex', minHeight: '100vh', background: '#F1F5F9' }}>
      <style>{`
        @keyframes fadeSlideUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes deptCardIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes slideInFromLeft { from { opacity: 0; transform: translateX(-32px); } to { opacity: 1; transform: translateX(0); } }
        @keyframes attBlockIn { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: translateY(0); } }
        /* Every block (section) animates in on mount — tab content is conditionally rendered, so
           switching tabs replays the entrance. Per-block stagger delays are assigned in DOM order
           by the useLayoutEffect below, so blocks cascade in one by one instead of moving as one. */
        .att-page section { animation: attBlockIn 0.42s cubic-bezier(0.22,1,0.36,1) both; }
        .att-fade-in { animation: attBlockIn 0.28s cubic-bezier(0.22,1,0.36,1) both; }
        .att-request-card { transition: box-shadow 0.18s ease, transform 0.18s ease; }
        .att-request-card:hover { box-shadow: 0 8px 22px rgba(15,23,42,0.08); transform: translateY(-2px); }
        .att-request-card-new { animation: slideInFromLeft 0.38s cubic-bezier(0.22,1,0.36,1) both !important; }
        .ar-row-hover:hover { background: #F8FAFC !important; }
        /* Shift Swap tab motion: list items cascade in; the ⇄ arrows shuttle while hovering a card.
           List items enter from ABOVE (translateY negative): these lists live in overflow-y:auto
           containers, and downward-shifted content would transiently overflow the bottom edge and
           flash the scrollbar during the animation — top overflow is clipped without one. */
        @keyframes attListIn { from { opacity: 0; transform: translateY(-10px); } to { opacity: 1; transform: translateY(0); } }
        .att-list-in { animation: attListIn 0.32s cubic-bezier(0.22,1,0.36,1) both; }
        @keyframes swapNudgeR { 0%, 100% { transform: translateX(0); } 50% { transform: translateX(4px); } }
        @keyframes swapNudgeL { 0%, 100% { transform: translateX(0); } 50% { transform: translateX(-4px); } }
        .att-request-card:hover .swap-arrows > svg:nth-child(1) { animation: swapNudgeR 0.8s ease-in-out infinite; }
        .att-request-card:hover .swap-arrows > svg:nth-child(2) { animation: swapNudgeL 0.8s ease-in-out infinite; }
        .att-request-card:hover .swap-arrow-duo { animation: swapNudgeR 0.8s ease-in-out infinite; }
      `}</style>
      {sidebar}
      {/* On the Off Day tab the page itself never scrolls — the tab locks to one viewport and each
           block scrolls internally instead. */}
      <main style={{ marginLeft: '64px', flex: 1, height: '100vh', minHeight: 0, overflowY: 'hidden', display: 'flex', flexDirection: 'column' }}>

        {/* ── Page header ────────────────────────────────────────────────── */}
        <div style={{ padding: '20px 28px 16px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 24, flexShrink: 0 }}>
          <h1 className="mb-0 font-heading text-3xl font-bold tracking-tight text-gray-950">Attendance</h1>
          <div data-owner-header-badges style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0, paddingTop: 4 }}>
            {internalUserId && <OwnerUserBadge userId={internalUserId} companyId={companyId} />}
            {companyId && <OwnerPlanBadge plan={currentPlan} currentCompanyId={companyId} />}
          </div>
        </div>

        {/* ── My Shift Today — personal clock in/out strip (UC49) ─────────── */}
        {showPersonalClock && myTodayShifts.length > 0 && (
          <div style={{ padding: '0 28px 14px', flexShrink: 0 }}>
            <div style={{ background: '#FFFFFF', border: `1px solid ${PANEL_BORDER}`, borderRadius: 14, padding: '12px 18px', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                <div style={{ width: 30, height: 30, borderRadius: 9, background: '#FFF7ED', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Clock size={15} style={{ color: '#F97316' }} />
                </div>
                <span style={{ fontSize: 15, fontWeight: 700, color: '#0F172A', whiteSpace: 'nowrap' }}>My Shift Today</span>
              </div>
              {myTodayShifts.map(shift => {
                const clockedIn = !!shift.record?.clock_in_time
                const clockedOut = !!shift.record?.clock_out_time
                const busyIn = clockBusyId === `${shift.assignment.id}:clock_in`
                const busyOut = clockBusyId === `${shift.assignment.id}:clock_out`
                const late = !clockedIn && isLateForShift(shift.shift)
                const askingLate = lateReasonFor === shift.assignment.id
                return (
                  <div key={shift.assignment.id} style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', minWidth: 0 }}>
                    <span style={{ fontSize: 13.5, fontWeight: 600, color: '#334155', whiteSpace: 'nowrap' }}>
                      {shift.shift.title || 'Shift'} · {fmtShiftTime(shift.shift.start_time)} – {shift.shift.is_open_ended ? 'Open' : fmtShiftTime(shift.shift.end_time)}
                      {clockedIn && <span style={{ color: '#059669' }}> · In {fmtClockStamp(shift.record!.clock_in_time)}</span>}
                      {clockedOut && <span style={{ color: '#64748B' }}> · Out {fmtClockStamp(shift.record!.clock_out_time)}</span>}
                    </span>
                    {!clockedIn && canClockIn(shift.shift) && !askingLate && (
                      <button
                        onClick={() => { if (late) { setLateReasonFor(shift.assignment.id); setLateReason('') } else void runClockAction(shift, 'clock_in') }}
                        disabled={!!clockBusyId}
                        style={{ height: 32, padding: '0 16px', border: 'none', borderRadius: 9, background: '#059669', color: '#FFFFFF', fontSize: 13, fontWeight: 700, cursor: clockBusyId ? 'default' : 'pointer', opacity: busyIn ? 0.6 : 1, transition: 'transform 0.12s ease, box-shadow 0.12s ease' }}
                        onMouseEnter={e => { if (!clockBusyId) { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 4px 10px rgba(5,150,105,0.3)' } }}
                        onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none' }}
                      >
                        {busyIn ? 'Working…' : 'Clock In'}
                      </button>
                    )}
                    {askingLate && (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                        <input
                          value={lateReason}
                          onChange={e => setLateReason(e.target.value)}
                          placeholder="Reason for being late"
                          style={{ height: 32, width: 220, borderRadius: 9, border: '1px solid #E5E7EB', background: '#F9FAFB', padding: '0 12px', fontSize: 13, color: '#111827', outline: 'none' }}
                          onFocus={e => { e.currentTarget.style.borderColor = '#F97316'; e.currentTarget.style.background = '#FFFFFF' }}
                          onBlur={e => { e.currentTarget.style.borderColor = '#E5E7EB'; e.currentTarget.style.background = '#F9FAFB' }}
                        />
                        <button
                          onClick={() => { if (lateReason.trim()) void runClockAction(shift, 'clock_in', { late_reason: lateReason.trim() }) }}
                          disabled={!!clockBusyId || !lateReason.trim()}
                          style={{ height: 32, padding: '0 14px', border: 'none', borderRadius: 9, background: !lateReason.trim() ? '#A7F3D0' : '#059669', color: '#FFFFFF', fontSize: 13, fontWeight: 700, cursor: clockBusyId || !lateReason.trim() ? 'default' : 'pointer', opacity: busyIn ? 0.6 : 1 }}
                        >
                          {busyIn ? 'Working…' : 'Submit & Clock In'}
                        </button>
                        <button
                          onClick={() => { setLateReasonFor(null); setLateReason('') }}
                          style={{ height: 32, padding: '0 10px', border: '1px solid #E5E7EB', borderRadius: 9, background: '#FFFFFF', color: '#64748B', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
                        >
                          Cancel
                        </button>
                      </span>
                    )}
                    {clockedIn && !clockedOut && canClockOut(shift.shift) && (
                      <button
                        onClick={() => void runClockAction(shift, 'clock_out')}
                        disabled={!!clockBusyId}
                        style={{ height: 32, padding: '0 16px', border: 'none', borderRadius: 9, background: '#DC2626', color: '#FFFFFF', fontSize: 13, fontWeight: 700, cursor: clockBusyId ? 'default' : 'pointer', opacity: busyOut ? 0.6 : 1, transition: 'transform 0.12s ease, box-shadow 0.12s ease' }}
                        onMouseEnter={e => { if (!clockBusyId) { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 4px 10px rgba(220,38,38,0.3)' } }}
                        onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none' }}
                      >
                        {busyOut ? 'Working…' : 'Clock Out'}
                      </button>
                    )}
                    {clockedIn && !clockedOut && !canClockOut(shift.shift) && (
                      <span style={{ fontSize: 12.5, fontWeight: 700, color: '#059669', background: '#F0FDF4', border: '1px solid #D1FAE5', borderRadius: 999, padding: '4px 12px', whiteSpace: 'nowrap' }}>On shift</span>
                    )}
                    {clockedOut && (
                      <span style={{ fontSize: 12.5, fontWeight: 700, color: '#64748B', background: '#F1F5F9', borderRadius: 999, padding: '4px 12px', whiteSpace: 'nowrap' }}>Done for today</span>
                    )}
                  </div>
                )
              })}
              {clockMessage && (
                <span style={{ marginLeft: 'auto', fontSize: 12.5, fontWeight: 600, color: clockMessage.includes('success') ? '#059669' : '#DC2626', whiteSpace: 'nowrap' }}>{clockMessage}</span>
              )}
            </div>
          </div>
        )}

        {/* ── Main tab bar ───────────────────────────────────────────────── */}
        <div style={{ padding: '0 28px 16px', flexShrink: 0 }}>
          <CapsuleTabBar tabs={mainTabs} active={mainTab} onChange={setMainTab} />
        </div>

        {/* ══════════════════════════════════════════════════════════════════
            RECORDS TAB
        ══════════════════════════════════════════════════════════════════ */}
        {mainTab === 'records' && (() => {
          return (
          <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
          <>
{/* Manager: flex '0 1 auto' + maxHeight '50%' — hug the table when there are few rows (no
    dead space below), but never grow past half the tab, so a long roster scrolls inside
    the Timeline body div instead (same shrink-to-content idiom as the Requests queue card
    at ~line 3307). Owner/Partner keep the original always-fills-the-tab flex: 1. */}
<div style={{ padding: scopeToManagerDepartments ? '0 28px' : '0 28px 28px', display: 'grid', gridTemplateColumns: scopeToManagerDepartments ? '1fr' : 'minmax(300px, 326px) minmax(0, 1fr)', gap: 16, flex: scopeToManagerDepartments ? '0 1 auto' : 1, maxHeight: scopeToManagerDepartments ? '50%' : undefined, minHeight: 0, overflow: 'hidden' }}>

            {/* ── LEFT: Department + Casual Worker panels — Owner/Partner only. Manager's page
                 shows the whole department merged into the main table instead (see allGroups),
                 so there's nothing for these panels to filter into for that role. ── */}
            {!scopeToManagerDepartments && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minHeight: 0, overflowY: 'auto' }}>
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
                        <h3 style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 600, color: '#374151', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{group.deptName}</h3>
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
                      <span style={{ fontSize: '0.9375rem', fontWeight: 600, color: '#374151' }}>{opt.label}</span>
                    </article>
                  )
                })}
              </div>
            </section>
            </div>
            )}{/* /left column */}

            {/* ── RIGHT: AR Timeline — exact Shift page structure ── */}
            <section style={{ background: '#FFFFFF', border: `1px solid ${PANEL_BORDER}`, borderRadius: 14, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>

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
                        {/* Matches the "M" badge shown on a pill whose clock/break time was
                            corrected via the 'modified' decision (see wasModified below) — shown
                            on every role's Records table, Manager included, so a Manager sees when
                            Owner/Partner corrected their own or their team's records too. */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                          <span style={{ width: 16, height: 16, borderRadius: '50%', background: '#F97316', color: '#fff', fontSize: 9, fontWeight: 800, lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>M</span>
                          <span style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>Modified</span>
                        </div>
                      </div>
                    </div>
                    {/* Right: Export + search + date range */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <button onClick={() => setExportOpen(true)}
                        style={{ height: 34, padding: '0 12px', borderRadius: 8, border: `1px solid ${PANEL_BORDER}`, background: '#FFFFFF', color: '#374151', fontWeight: 700, fontSize: 12.5, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
                        <Download size={12} /> Export
                      </button>
                      {!scopeToManagerDepartments && (
                        <input
                          value={recordsKeyword}
                          onChange={e => setRecordsKeyword(e.target.value)}
                          placeholder="Search name..."
                          style={{ height: 34, padding: '0 12px', border: `1px solid ${PANEL_BORDER}`, borderRadius: 8, fontSize: 13, color: TEXT_DARK, background: '#FFFFFF', outline: 'none', width: 148, fontFamily: 'inherit' }}
                        />
                      )}
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
              <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: '14px 16px 18px 18px' }}>
                <div style={{ minWidth: 700, borderRadius: 12, overflow: 'hidden', border: `1px solid ${PANEL_BORDER}` }}>

                  {/* Column header row */}
                  <div style={{ display: 'grid', gridTemplateColumns: '180px repeat(7, 1fr)', background: 'linear-gradient(135deg,#0F172A 0%,#1E293B 100%)', height: 54 }}>
                    <div style={{ padding: '10px 14px 10px 20px', borderRight: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center' }}>
                      {scopeToManagerDepartments && (
                        <span style={{ fontSize: 14, fontWeight: 700, color: 'rgba(255,255,255,0.85)', letterSpacing: '0.01em' }}>Internal Members</span>
                      )}
                    </div>
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
                          // Manager page drops the department color bar entirely — every row is
                          // already their own department, so the color adds nothing to look at.
                          const barColor = (isCWGroup || scopeToManagerDepartments) ? 'transparent' : deptColor(deptId)
                          return people.flatMap(([userId, person], rowIdx) => {
                            const isDeptBoundary = !isCWGroup && deptIdx > 0 && rowIdx === 0
                            const borderTop = isDeptBoundary ? EDGE : `1px solid ${PANEL_BORDER}`
                            const isManager = person.role === 'Manager'
                            // Manager page merges internal staff and Casual Workers into one table
                            // (see allGroups) — a labelled section break marks where internal staff
                            // ends and Casual Worker rows begin, so the two are still easy to tell
                            // apart at a glance even though they now share a table.
                            const showCwSectionHeader = scopeToManagerDepartments && person.role === 'Casual Worker'
                              && (rowIdx === 0 || people[rowIdx - 1][1].role !== 'Casual Worker')
                            const rows: React.ReactNode[] = []
                            if (showCwSectionHeader) {
                              rows.push(
                                // Same styling as the column header row above (gradient, height, text
                                // treatment) so the two read as one consistent header language.
                                <div key={`${deptId}-cw-section`} style={{ display: 'grid', gridTemplateColumns: '180px repeat(7, 1fr)', height: 54, background: 'linear-gradient(135deg,#0F172A 0%,#1E293B 100%)' }}>
                                  <div style={{ padding: '10px 14px 10px 20px', borderRight: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center' }}>
                                    <span style={{ fontSize: 14, fontWeight: 700, color: 'rgba(255,255,255,0.85)', letterSpacing: '0.01em' }}>Casual Workers</span>
                                  </div>
                                  {weekDates.map(date => <div key={date} style={{ borderRight: '1px solid rgba(255,255,255,0.08)' }} />)}
                                </div>
                              )
                            }
                            rows.push(
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
                                            <span style={{ fontSize: 11, fontWeight: 600, color: '#7C3AED', whiteSpace: 'nowrap' }}>Off Day</span>
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
                                        // This record's clock/break time was corrected via the 'modified' decision —
                                        // by a Manager, the Owner, or the Partner (any of the three). Shown on every
                                        // role's Records table, Manager included — a Manager needs to see when
                                        // Owner/Partner corrected their own or their team's records.
                                        const wasModified = rec.record?.owner_status === 'modified'
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
                                              {(() => {
                                                // Owner-modified times take precedence over the worker's original
                                                // clock times — same precedence openReview() uses to pre-fill the modal.
                                                const inTime = rec.record?.owner_adjusted_clock_in_time ?? rec.record?.clock_in_time
                                                const outTime = rec.record?.owner_adjusted_clock_out_time ?? rec.record?.clock_out_time
                                                return inTime
                                                  ? `${formatClockHour(inTime)} – ${outTime ? formatClockHour(outTime) : formatShiftHour(rec.shift.end_time)}`
                                                  : `${formatShiftHour(rec.shift.start_time)} – ${formatShiftHour(rec.shift.end_time)}`
                                              })()}
                                            </span>
                                            {/* Mirrors the left-hand status icon's 20x20 slot, so a modified pill
                                                reads as symmetric: status icon on the left, "M" badge on the right. */}
                                            <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                              {wasModified && (
                                                <span
                                                  title={`Modified by ${rec.modifier_name ?? 'Unknown'} — changed ${formatModifiedFieldsLabel(rec.record?.owner_modified_fields)}`}
                                                  style={{
                                                    width: 16, height: 16, borderRadius: '50%',
                                                    background: '#F97316', color: '#fff',
                                                    fontSize: 9, fontWeight: 800, lineHeight: 1,
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                    flexShrink: 0,
                                                  }}
                                                >
                                                  M
                                                </span>
                                              )}
                                            </span>
                                          </button>
                                        )
                                      }) : null}
                                    </div>
                                  )
                                })}
                              </div>
                            )
                            return rows
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

          {/* ── My Request — Manager only, bottom half of the Records tab. Everything they've
               submitted via the Submit Request modal above, with the outcome once Owner/Partner
               decide. ── */}
          {scopeToManagerDepartments && (() => {
            // needsResponse — this viewer is the COUNTERPART of a swap someone else invited them
            // into, and hasn't answered yet. The request never reaches any reviewer's queue until
            // this step is done (getShiftSwapRequests filters out counterpart_status === 'pending'),
            // so this card needs its own Accept/Decline action, not just a status readout.
            type MyReqItem = { key: string; kind: 'swap' | 'offday'; status: string; createdAt: string; swap?: ShiftSwapRequestView; offday?: FixedOffDayRequestView; needsResponse: boolean }
            const items: MyReqItem[] = [
              ...mySwaps.map((s): MyReqItem => ({
                key: `swap-${s.id}`, kind: 'swap', status: s.status, createdAt: s.created_at, swap: s,
                needsResponse: s.counterpart_id === internalUserId && s.counterpart_status === 'pending' && s.status === 'pending',
              })),
              ...myFixedOff.map((f): MyReqItem => ({ key: `offday-${f.id}`, kind: 'offday', status: f.status, createdAt: f.created_at, offday: f, needsResponse: false })),
            ].sort((a, b) => (Number(b.needsResponse) - Number(a.needsResponse)) || (new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()))

            const filteredItems = items.filter(i => {
              if (myReqFilter === 'swap') return i.kind === 'swap'
              if (myReqFilter === 'offday') return i.kind === 'offday'
              return true
            })
            const selected = items.find(i => i.key === selectedMyReqKey) ?? filteredItems[0] ?? null

            // Every label below is viewer-relative — a swap looks different depending on whether
            // the current user is the one who requested it or the one invited into it.
            const isMeRequester = (s: ShiftSwapRequestView) => s.requester_id === internalUserId
            const cardTitle = (i: MyReqItem): string => {
              if (i.kind === 'swap') {
                const s = i.swap!
                const iAmRequester = isMeRequester(s)
                const otherName = iAmRequester ? s.counterpart_name : s.requester_name
                const myShiftDate = iAmRequester ? s.requester_shift_date : s.counterpart_shift_date
                return `${formatShortWeekdayDate(myShiftDate)} ⇄ ${otherName}`
              }
              return `${formatShortWeekdayDate(i.offday!.request_date)} — Day Off`
            }
            const cardBadge = (i: MyReqItem) => i.needsResponse ? { bg: '#EFF6FF', text: '#1D4ED8', label: 'Respond' } : myRequestStatusBadge(i.status)

            const avatarInitial = (name: string) => name.trim().charAt(0).toUpperCase() || '?'
            const selectedBadge = selected ? cardBadge(selected) : null
            // Fixed-height, single-line headers — identical padding/icon/title treatment on both
            // cards (and matching the Recruitment page's Job Postings / Detail panel pair) so the
            // two block titles line up exactly when they sit side by side.
            const MYREQ_HEADER_HEIGHT = 64

            const filterLabel = myReqFilter === 'swap' ? 'Shift Swap' : myReqFilter === 'offday' ? 'Off Day' : 'My Requests'

            return (
              <div style={{ padding: '16px 28px 28px', flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: 'minmax(380px, 440px) minmax(0, 1fr)', gap: 16 }}>
                {/* LEFT: My Requests — its own card, filter now lives in a dropdown off the title
                    itself (no more filter pills row), scrollable list. */}
                <section style={{ minHeight: 0, background: '#FFFFFF', border: `1px solid ${PANEL_BORDER}`, borderRadius: 14, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                  <div style={{ height: MYREQ_HEADER_HEIGHT, padding: '0 18px', boxSizing: 'border-box', borderBottom: `1px solid ${PANEL_BORDER}`, display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                    <div style={{ width: 30, height: 30, borderRadius: 9, background: '#FFF7ED', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <FileText size={15} style={{ color: '#F97316' }} />
                    </div>
                    {/* Title doubles as the filter dropdown trigger — click it (or the chevron)
                        to switch between All / Shift Swap / Fixed Day Off; the label updates to
                        show what's currently selected, so no separate filter pills are needed. */}
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
                    <button onClick={() => { setRequestModalStep('choose'); setRequestModalOpen(true) }}
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
                      const isUnseen = i.needsResponse || (i.status !== 'pending' && !seenMyReqKeys.has(i.key))
                      return (
                        <button key={i.key} type="button"
                          onClick={() => { setSelectedMyReqKey(i.key); markMyReqSeen(i.key) }}
                          style={{
                            textAlign: 'left', padding: '10px 12px', borderRadius: 10, cursor: 'pointer',
                            border: `1.5px solid ${isSelected ? '#F97316' : i.needsResponse ? '#93C5FD' : PANEL_BORDER}`,
                            background: isSelected ? '#FFF7ED' : i.needsResponse ? '#EFF6FF' : '#FFFFFF',
                            display: 'flex', flexDirection: 'column', gap: 4, position: 'relative',
                          }}>
                          {isUnseen && <span style={{ position: 'absolute', left: -6, top: 14, width: 8, height: 8, borderRadius: '50%', background: '#EF4444', boxShadow: '0 0 0 2px #FFFFFF' }} />}
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            {i.kind === 'swap' ? <ArrowLeftRight size={12} style={{ color: '#F97316', flexShrink: 0 }} /> : <Calendar size={12} style={{ color: '#7C3AED', flexShrink: 0 }} />}
                            <span style={{ fontSize: 10.5, fontWeight: 800, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{i.kind === 'swap' ? 'Shift Swap' : 'Fixed Day Off'}</span>
                            <span style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', height: 20, padding: '0 8px', borderRadius: 999, fontSize: 10.5, fontWeight: 700, background: badge.bg, color: badge.text, flexShrink: 0 }}>{badge.label}</span>
                          </div>
                          <div style={{ fontSize: 13.5, fontWeight: 700, color: '#0F172A' }}>{cardTitle(i)}</div>
                          <div style={{ fontSize: 11.5, color: '#9CA3AF' }}>Submitted {formatRelativeTime(i.createdAt)}</div>
                        </button>
                      )
                    })}
                  </div>
                </section>

                {/* RIGHT: Detail — its own card, header mirrors the left card's exactly (same
                    height/padding/icon/title styling), plus the status badge pinned to the right
                    the way Recruitment's Detail header pins its meta pills. */}
                <section style={{ minHeight: 0, background: '#FFFFFF', border: `1px solid ${PANEL_BORDER}`, borderRadius: 14, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                  <div style={{ height: MYREQ_HEADER_HEIGHT, padding: '0 18px', boxSizing: 'border-box', borderBottom: `1px solid ${PANEL_BORDER}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexShrink: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                      <div style={{ width: 30, height: 30, borderRadius: 9, background: '#FFF7ED', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        {!selected ? <FileText size={15} style={{ color: '#F97316' }} /> : selected.kind === 'swap' ? <ArrowLeftRight size={15} style={{ color: '#F97316' }} /> : <Calendar size={15} style={{ color: '#F97316' }} />}
                      </div>
                      <span style={{ fontSize: 18, fontWeight: 700, color: '#0F172A', letterSpacing: '-0.2px', lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {!selected ? 'Request Detail' : selected.kind === 'swap' ? 'Shift Swap Request Detail' : 'Off Day Request Detail'}
                      </span>
                    </div>
                    {selectedBadge && (
                      <span style={{ display: 'inline-flex', alignItems: 'center', height: 24, padding: '0 10px', borderRadius: 999, fontSize: 12, fontWeight: 700, background: selectedBadge.bg, color: selectedBadge.text, flexShrink: 0 }}>{selectedBadge.label}</span>
                    )}
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
                        const leftLabel = iAmRequester ? 'You' : s.requester_name
                        const rightLabel = iAmRequester ? s.counterpart_name : 'You'
                        const needsMyResponse = selected.needsResponse
                        const responding = respondingSwapId === s.id
                        return (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 7, color: '#6B7280', fontSize: 12.5 }}>
                              <ArrowLeftRight size={13} /> Submitted {new Date(s.created_at).toLocaleString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true })}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                              <div style={{ flex: 1, minWidth: 0, textAlign: 'center' }}>
                                <div style={{ width: 44, height: 44, borderRadius: 999, background: '#F97316', color: '#fff', fontWeight: 800, fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 6px' }}>{leftLabel === 'You' ? 'Y' : avatarInitial(leftLabel)}</div>
                                <div style={{ fontWeight: 700, fontSize: 13.5, color: '#0F172A' }}>{leftLabel}</div>
                                <div style={{ fontSize: 12, color: '#6B7280' }}>{formatShortWeekdayDate(s.requester_shift_date)}</div>
                                <div style={{ fontSize: 11.5, color: '#9CA3AF' }}>{formatTime(s.requester_start_time)} – {formatTime(s.requester_end_time)}</div>
                              </div>
                              <ArrowLeftRight size={16} style={{ color: '#CBD5E1', flexShrink: 0 }} />
                              <div style={{ flex: 1, minWidth: 0, textAlign: 'center' }}>
                                <div style={{ width: 44, height: 44, borderRadius: 999, background: '#3B82F6', color: '#fff', fontWeight: 800, fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 6px' }}>{rightLabel === 'You' ? 'Y' : avatarInitial(rightLabel)}</div>
                                <div style={{ fontWeight: 700, fontSize: 13.5, color: '#0F172A' }}>{rightLabel}</div>
                                <div style={{ fontSize: 12, color: '#6B7280' }}>{formatShortWeekdayDate(s.counterpart_shift_date)}</div>
                                <div style={{ fontSize: 11.5, color: '#9CA3AF' }}>{formatTime(s.counterpart_start_time)} – {formatTime(s.counterpart_end_time)}</div>
                              </div>
                            </div>
                            {s.reason && (
                              <div>
                                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 5 }}>Reason</label>
                                <div style={{ padding: '10px 12px', background: '#F9FAFB', border: `1px solid ${PANEL_BORDER}`, borderRadius: 9, fontSize: 13, color: '#374151' }}>{s.reason}</div>
                              </div>
                            )}
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
                            {needsMyResponse ? (
                              <div style={{ padding: '12px 14px', background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: 10, display: 'flex', flexDirection: 'column', gap: 10 }}>
                                <div style={{ display: 'flex', gap: 9 }}>
                                  <ArrowLeftRight size={15} style={{ color: '#1D4ED8', flexShrink: 0, marginTop: 1 }} />
                                  <p style={{ margin: 0, fontSize: 12.5, fontWeight: 700, color: '#1D4ED8' }}>{s.requester_name} wants to swap shifts with you — accept or decline.</p>
                                </div>
                                <div style={{ display: 'flex', gap: 8 }}>
                                  <button type="button" disabled={responding} onClick={() => handleRespondSwap(s.id, 'approved')}
                                    style={{ flex: 1, height: 34, border: 'none', borderRadius: 8, background: '#059669', color: '#FFFFFF', fontWeight: 700, fontSize: 13, cursor: responding ? 'default' : 'pointer', opacity: responding ? 0.6 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                                    <Check size={13} /> Accept
                                  </button>
                                  <button type="button" disabled={responding} onClick={() => handleRespondSwap(s.id, 'rejected')}
                                    style={{ flex: 1, height: 34, border: 'none', borderRadius: 8, background: '#DC2626', color: '#FFFFFF', fontWeight: 700, fontSize: 13, cursor: responding ? 'default' : 'pointer', opacity: responding ? 0.6 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                                    <X size={13} /> Decline
                                  </button>
                                </div>
                              </div>
                            ) : s.status === 'pending' && s.counterpart_status === 'pending' ? (
                              <div style={{ padding: '12px 14px', background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 10, display: 'flex', gap: 9 }}>
                                <Clock size={15} style={{ color: '#B45309', flexShrink: 0, marginTop: 1 }} />
                                <p style={{ margin: 0, fontSize: 12.5, fontWeight: 700, color: '#B45309' }}>Awaiting {s.counterpart_name}&apos;s response.</p>
                              </div>
                            ) : s.status === 'pending' && (
                              <div style={{ padding: '12px 14px', background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 10, display: 'flex', gap: 9 }}>
                                <Clock size={15} style={{ color: '#B45309', flexShrink: 0, marginTop: 1 }} />
                                <div>
                                  <p style={{ margin: 0, fontSize: 12.5, fontWeight: 700, color: '#B45309' }}>Awaiting Owner/Partner review</p>
                                  <p style={{ margin: '3px 0 0', fontSize: 12, color: '#92400E', lineHeight: 1.5 }}>Both sides agreed — a Manager swap is decided by Owner/Partner.</p>
                                </div>
                              </div>
                            )}
                            {s.status === 'rejected' && s.owner_review_reason && (
                              <div style={{ padding: '12px 14px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 10 }}>
                                <p style={{ margin: 0, fontSize: 12.5, fontWeight: 700, color: '#B91C1C' }}>Reason</p>
                                <p style={{ margin: '3px 0 0', fontSize: 12.5, color: '#7F1D1D', lineHeight: 1.5 }}>{s.owner_review_reason}</p>
                              </div>
                            )}
                            {s.status === 'rejected' && !s.owner_review_reason && s.counterpart_status === 'rejected' && (
                              <div style={{ padding: '12px 14px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 10, display: 'flex', gap: 9 }}>
                                <X size={15} style={{ color: '#B91C1C', flexShrink: 0, marginTop: 1 }} />
                                <p style={{ margin: 0, fontSize: 12.5, color: '#B91C1C', fontWeight: 700 }}>{iAmRequester ? `${s.counterpart_name} declined the swap.` : 'You declined this swap.'}</p>
                              </div>
                            )}
                            {s.status === 'approved' && (
                              <div style={{ padding: '12px 14px', background: '#ECFDF5', border: '1px solid #A7F3D0', borderRadius: 10, display: 'flex', gap: 9 }}>
                                <Check size={15} style={{ color: '#047857', flexShrink: 0, marginTop: 1 }} />
                                <p style={{ margin: 0, fontSize: 12.5, color: '#047857', fontWeight: 700 }}>Approved{s.reviewer_name ? ` by ${s.reviewer_name}` : ''} — the swap is now confirmed.</p>
                              </div>
                            )}
                          </div>
                        )
                      })() : (() => {
                        const f = selected.offday!
                        return (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 7, color: '#6B7280', fontSize: 12.5 }}>
                              <Calendar size={13} /> Submitted {new Date(f.created_at).toLocaleString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true })}
                            </div>
                            <div>
                              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 5 }}>{f.status === 'modified' ? 'Confirmed Day' : 'Requested Day'}</label>
                              <div style={{ padding: '12px 14px', background: '#F9FAFB', border: `1px solid ${PANEL_BORDER}`, borderRadius: 9, fontSize: 15, fontWeight: 700, color: '#0F172A' }}>{formatFixedOffRequestDay(f.request_date)}</div>
                            </div>
                            <div>
                              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 5 }}>Week Of</label>
                              <div style={{ fontSize: 13, color: '#374151' }}>{formatDateDisplay(f.week_start)}</div>
                            </div>
                            {f.source === 'auto_assigned' && (
                              <div style={{ fontSize: 12, color: '#6B7280' }}>Auto assigned by the system.</div>
                            )}
                            {f.status === 'pending' && (
                              <div style={{ padding: '12px 14px', background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 10, display: 'flex', gap: 9 }}>
                                <Clock size={15} style={{ color: '#B45309', flexShrink: 0, marginTop: 1 }} />
                                <div>
                                  <p style={{ margin: 0, fontSize: 12.5, fontWeight: 700, color: '#B45309' }}>Awaiting Owner/Partner review</p>
                                  <p style={{ margin: '3px 0 0', fontSize: 12, color: '#92400E', lineHeight: 1.5 }}>Fixed Day Off is always decided by Owner/Partner, for every role.</p>
                                </div>
                              </div>
                            )}
                            {f.status === 'modified' && (
                              <div style={{ padding: '12px 14px', background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: 10, display: 'flex', gap: 9 }}>
                                <Pencil size={15} style={{ color: '#1D4ED8', flexShrink: 0, marginTop: 1 }} />
                                <p style={{ margin: 0, fontSize: 12.5, color: '#1D4ED8', fontWeight: 700 }}>{f.reviewer_name ?? 'Owner/Partner'} moved your day off to the date shown above.</p>
                              </div>
                            )}
                            {f.status === 'approved' && (
                              <div style={{ padding: '12px 14px', background: '#ECFDF5', border: '1px solid #A7F3D0', borderRadius: 10, display: 'flex', gap: 9 }}>
                                <Check size={15} style={{ color: '#047857', flexShrink: 0, marginTop: 1 }} />
                                <p style={{ margin: 0, fontSize: 12.5, color: '#047857', fontWeight: 700 }}>Approved{f.reviewer_name ? ` by ${f.reviewer_name}` : ''} — enjoy your day off.</p>
                              </div>
                            )}
                          </div>
                        )
                      })()}
                  </div>
                </section>
              </div>
            )
          })()}
          </div>
          )
        })()}

        {/* ══════════════════════════════════════════════════════════════════
            REQUESTS TAB
        ══════════════════════════════════════════════════════════════════ */}
        {/* Manager's Off Day tab is repurposed entirely (see myRequestTab below) — they never
            review anyone's Fixed Day Off (UC55 is O/P-only), so the approval-queue UI this block
            renders is meaningless for them and is skipped in favor of the "My Request" tab. */}
        {(mainTab === 'swaps' || (mainTab === 'fixedoff' && !scopeToManagerDepartments)) && (
          <div style={{ padding: '0 28px 28px', display: 'grid', gridTemplateColumns: isCompactReqLayout ? '1fr' : reqTab === 'fixedoff' && offDayQueueEmpty ? 'minmax(400px, 1fr) minmax(380px, 620px)' : 'minmax(260px, 326px) minmax(400px, 1fr) minmax(380px, 620px)', gridTemplateRows: isCompactReqLayout ? 'auto' : 'auto minmax(0, 1fr)', gap: 16, alignItems: 'start', flex: 1, minHeight: 0, overflow: isCompactReqLayout ? 'auto' : 'hidden' }}>
            <div style={{ display: 'contents' }}>

            {/* ── LEFT: Requests queue. Spans both grid rows and stretches on both tabs so the
                 queue fills the full page height (same block design as Off Day). Hidden entirely
                 on the Off Day tab while nothing is pending. ── */}
            {!(reqTab === 'fixedoff' && offDayQueueEmpty) && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, gridColumn: '1', gridRow: isCompactReqLayout ? 'auto' : '1 / span 2', alignSelf: isCompactReqLayout ? 'auto' : 'stretch', minHeight: 0 }}>
              {/* ── Requests queue — one card per pending swap, oldest first (same set + order
                   activeSwapRequest cycles through); clicking a card selects it, driving the
                   Action Needed / Current Shifts / Task Changes blocks. ── */}
              {reqTab === 'swaps' && (() => {
                const pendingSwaps = swapRequests
                  .filter(r => r.status === 'pending')
                  .sort((a, b) => new Date(a.created_at ?? 0).getTime() - new Date(b.created_at ?? 0).getTime())
                const selectedIdx = Math.min(actionIndex, Math.max(pendingSwaps.length - 1, 0))
                return (
                  // flex '0 1 auto' — hug the cards when there are few (no dead space below), but
                  // never grow past the stretched column, so a long list scrolls inside instead.
                  <section style={{ background: '#FFFFFF', border: `1px solid ${PANEL_BORDER}`, borderRadius: 14, overflow: 'hidden', display: 'flex', flexDirection: 'column', flex: '0 1 auto', minHeight: 0 }}>
                    <div style={{ padding: '14px 18px', borderBottom: `1px solid ${PANEL_BORDER}`, display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                      <div style={{ width: 30, height: 30, borderRadius: 9, background: '#FFF7ED', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <Inbox size={15} style={{ color: '#F97316' }} />
                      </div>
                      <span style={{ fontSize: 18, fontWeight: 700, color: '#0F172A', letterSpacing: '-0.2px', lineHeight: 1.2, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Requests</span>
                      {reqLoading && <Spinner size={13} dark />}
                    </div>
                    {pendingSwaps.length === 0 ? (
                      <div style={{ flex: 1, padding: '26px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, color: '#9CA3AF' }}>
                        <CheckCheck size={20} strokeWidth={1.5} />
                        <span style={{ fontSize: 12.5, fontWeight: 600 }}>No pending requests</span>
                      </div>
                    ) : (
                      <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10, flex: 1, minHeight: 0, overflowY: 'auto' }}>
                        {pendingSwaps.map((req, idx) => {
                          const isSelected = idx === selectedIdx
                          const dc = req.department_name ? deptColor(req.department_name) : '#64748B'
                          return (
                            <button
                              key={req.id}
                              type="button"
                              className="att-request-card att-list-in"
                              onClick={() => setActionIndex(idx)}
                              style={{
                                display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: 12, width: '100%', boxSizing: 'border-box', textAlign: 'left',
                                border: `1.5px solid ${isSelected ? '#FDBA74' : '#E5E7EB'}`,
                                background: isSelected ? '#FFF7ED' : '#FFFFFF',
                                borderRadius: 12, padding: '14px 14px 16px', cursor: 'pointer', flexShrink: 0,
                                animationDelay: `${Math.min(idx, 8) * 50}ms`,
                              }}
                            >
                              {req.department_name && (
                                <span style={{ alignSelf: 'flex-start', fontSize: '0.62rem', fontWeight: 800, color: dc, background: `${dc}1a`, borderRadius: 999, padding: '2px 8px', whiteSpace: 'nowrap' }}>{req.department_name}</span>
                              )}
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7 }}>
                                  <RoleAvatar role={req.requester_role} size={48} photoUrl={req.requester_photo_url} />
                                  <span style={{ maxWidth: '100%', fontSize: '0.82rem', fontWeight: 700, color: '#111827', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{req.requester_name}</span>
                                </div>
                                <svg className="swap-arrow-duo" width="24" height="14" viewBox="0 0 24 14" fill="none" style={{ flexShrink: 0, color: '#94A3B8' }}>
                                  <line x1="2" y1="4" x2="19" y2="4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                                  <polyline points="16,1 22,4 16,7" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                                  <line x1="22" y1="10" x2="5" y2="10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                                  <polyline points="8,7 2,10 8,13" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                                </svg>
                                <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7 }}>
                                  <RoleAvatar role={req.counterpart_role} size={48} photoUrl={req.counterpart_photo_url} />
                                  <span style={{ maxWidth: '100%', fontSize: '0.82rem', fontWeight: 700, color: '#111827', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{req.counterpart_name}</span>
                                </div>
                              </div>
                              <span style={{ alignSelf: 'flex-end', fontSize: '0.75rem', color: '#9CA3AF' }}>Submitted on {formatCompactAt(req.created_at)}</span>
                            </button>
                          )
                        })}
                      </div>
                    )}
                  </section>
                )
              })()}
              {/* ── Requests queue — one card per pending weekly submission, oldest
                   submission first (same set + order the detail pager cycles through);
                   clicking a card jumps the detail block on the right to that request. ── */}
              {reqTab === 'fixedoff' && (() => {
                const deptNameById = new Map(companyDepartments.map(d => [d.id, d.name]))
                const staffById = new Map(companyStaff.map(p => [p.id, p]))
                const selectedIndex = Math.min(fixedOffActionIndex, Math.max(fixedOffActionNeeded.length - 1, 0))
                const queueVerdictByKey = new Map(queueAiResult?.items.map(i => [i.key, i.verdict]) ?? [])
                const pendingSafeCount = fixedOffActionNeeded.filter(g => queueVerdictByKey.get(g.key) === 'safe').length
                // Once analyzed, the ones needing attention float to the top and the auto-approvable
                // ones sink below (stable sort keeps submission order within each band).
                const verdictRank = (key: string) => { const v = queueVerdictByKey.get(key); return v === 'flagged' ? 0 : v === 'safe' ? 2 : 1 }
                const displayGroups = queueAiResult ? [...fixedOffActionNeeded].sort((a, b) => verdictRank(a.key) - verdictRank(b.key)) : fixedOffActionNeeded
                return (
                  <section style={{ background: '#FFFFFF', border: `1px solid ${PANEL_BORDER}`, borderRadius: 14, overflow: 'hidden', display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
                    <div style={{ padding: '14px 18px', borderBottom: `1px solid ${PANEL_BORDER}`, display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                      <div style={{ width: 30, height: 30, borderRadius: 9, background: '#FFF7ED', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <Inbox size={15} style={{ color: '#F97316' }} />
                      </div>
                      <span style={{ fontSize: 18, fontWeight: 700, color: '#0F172A', letterSpacing: '-0.2px', lineHeight: 1.2, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Requests</span>
                      {fixedOffActionNeeded.length > 0 && (
                        pendingSafeCount > 0 ? (
                          <>
                            <button
                              onClick={() => setQueueAiResult(null)}
                              disabled={reqActionLoading}
                              title="Cancel"
                              style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: '#6B7280', background: '#FFFFFF', border: '1.5px solid #E5E7EB', borderRadius: 10, height: 30, width: 36, cursor: reqActionLoading ? 'default' : 'pointer', opacity: reqActionLoading ? 0.6 : 1, flexShrink: 0 }}
                            >
                              <X size={15} />
                            </button>
                            <button
                              onClick={() => void approveSafeFixedOffQueue()}
                              disabled={reqActionLoading || queueAiLoading}
                              title={`Approve ${pendingSafeCount} safe request${pendingSafeCount === 1 ? '' : 's'}`}
                              style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: '#FFFFFF', background: 'linear-gradient(135deg, #22C55E, #16A34A)', border: 0, borderRadius: 10, height: 30, width: 36, cursor: (reqActionLoading || queueAiLoading) ? 'default' : 'pointer', opacity: (reqActionLoading || queueAiLoading) ? 0.6 : 1, flexShrink: 0 }}
                            >
                              {reqActionLoading ? <Spinner size={14} /> : <Check size={16} strokeWidth={2.5} />}
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => void analyzeFixedOffQueue()}
                            disabled={queueAiLoading || reqActionLoading}
                            style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7, fontSize: 13, fontWeight: 700, color: '#FFFFFF', background: 'linear-gradient(135deg, #7C3AED, #6D28D9)', border: 0, borderRadius: 10, height: 36, padding: '0 14px', cursor: (queueAiLoading || reqActionLoading) ? 'default' : 'pointer', opacity: (queueAiLoading || reqActionLoading) ? 0.6 : 1, flexShrink: 0 }}
                          >
                            {queueAiLoading ? <><Spinner size={13} /> Analyzing…</> : <><Sparkles size={15} strokeWidth={2.5} /> AI Process</>}
                          </button>
                        )
                      )}
                    </div>
                    {fixedOffActionNeeded.length === 0 ? (
                      <div style={{ flex: 1, padding: '26px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, color: '#9CA3AF' }}>
                        <CheckCheck size={20} strokeWidth={1.5} />
                        <span style={{ fontSize: 12.5, fontWeight: 600 }}>No pending requests</span>
                      </div>
                    ) : (
                      <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10, flex: 1, minHeight: 0, overflowY: 'auto' }}>
                        {displayGroups.map(group => {
                          const actionIdx = fixedOffActionNeeded.indexOf(group)
                          const person = staffById.get(group.user_id)
                          const departmentId = group.department_id ?? person?.department_id ?? null
                          const departmentName = departmentId ? deptNameById.get(departmentId) : undefined
                          const departmentColor = departmentName ? deptColor(departmentName) : '#64748B'
                          const isSelected = actionIdx === selectedIndex
                          const verdict = queueVerdictByKey.get(group.key)
                          return (
                            <button
                              key={group.key}
                              type="button"
                              className="att-request-card"
                              data-offday-request-card
                              onClick={() => {
                                if (actionIdx === selectedIndex) {
                                  if (verdict !== 'flagged') setOffDayHighlightEnabled(v => !v)
                                } else {
                                  setFixedOffActionIndex(actionIdx)
                                  setOffDayHighlightEnabled(true)
                                }
                                if (verdict === 'flagged') {
                                  // A flagged request opens straight into Modify, pre-seeded with the
                                  // AI-recommended replacement day set.
                                  const item = queueAiResult?.items.find(qi => qi.key === group.key)
                                  setFixedOffModifyDates((item?.suggested_dates ?? []).slice(0, group.requests.length))
                                  setModifyingFixedOffKey(group.key)
                                } else if (modifyingFixedOffKey && modifyingFixedOffKey !== group.key) {
                                  setModifyingFixedOffKey(null)
                                  setFixedOffModifyDates([])
                                }
                              }}
                              style={{
                                display: 'flex', alignItems: 'center', gap: 10, width: '100%', boxSizing: 'border-box', textAlign: 'left',
                                border: `1.5px solid ${isSelected ? '#FDBA74' : '#E5E7EB'}`,
                                background: isSelected ? '#FFF7ED' : '#FFFFFF',
                                borderRadius: 12, padding: '14px 12px', cursor: 'pointer', flexShrink: 0,
                              }}
                            >
                              <RoleAvatar role={group.requester_role || 'Manager'} size={42} photoUrl={person?.profile_photo_url ?? null} />
                              <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
                                <span style={{ alignSelf: 'flex-start', fontSize: '0.62rem', fontWeight: 800, color: departmentColor, background: `${departmentColor}1a`, borderRadius: 999, padding: '2px 8px', whiteSpace: 'nowrap' }}>
                                  {departmentName ?? 'Unassigned'}
                                </span>
                                <span style={{ fontSize: '0.875rem', fontWeight: 700, color: '#111827', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={group.requester_name}>{group.requester_name}</span>
                                <span style={{ fontSize: '0.75rem', color: '#9CA3AF' }}>Submitted on {formatCompactAt(group.created_at)}</span>
                              </div>
                              {verdict === 'safe' && (
                                <span title="Safe to approve as requested" style={{ width: 32, height: 32, marginRight: 10, borderRadius: '50%', background: '#DCFCE7', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                  <Check size={17} strokeWidth={3} style={{ color: '#15803D' }} />
                                </span>
                              )}
                              {verdict === 'flagged' && (
                                <span title="Requested day is already taken — needs review" style={{ width: 32, height: 32, marginRight: 10, borderRadius: '50%', background: '#FEF3C7', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                  <AlertTriangle size={17} style={{ color: '#B45309' }} />
                                </span>
                              )}
                            </button>
                          )
                        })}
                      </div>
                    )}
                  </section>
                )
              })()}
            </div>
            )}

            {/* ── RIGHT: Content ───────────────────────────────────────────── */}
            <div style={{ minWidth: 0, display: 'contents' }}>

              {reqError && (
                <div style={{ gridColumn: isCompactReqLayout ? '1' : reqTab === 'fixedoff' && offDayQueueEmpty ? '1 / -1' : '2 / 4', padding: 12, background: '#FEF2F2', border: '1px solid #FECACA', color: '#B91C1C', borderRadius: 8, fontSize: '0.84rem', fontWeight: 800 }}>{reqError}</div>
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
                          borderRadius: 14, padding: '12px 14px 14px', display: 'flex', flexDirection: 'column', gap: 12, flexShrink: 0,
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
                          {req.owner_review_reason && (
                            <span style={{ fontSize: '0.68rem', fontWeight: 700, color: '#B91C1C', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 999, padding: '3px 10px', whiteSpace: 'nowrap', flexShrink: 0 }}>{req.owner_review_reason}</span>
                          )}
                          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8, minWidth: 0, flexWrap: 'wrap', rowGap: 6 }}>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
                              <span style={{ fontSize: '0.76rem', fontWeight: 800, color: '#64748B', whiteSpace: 'nowrap' }}>
                                {isPending ? formatOwnerDecisionTime(req.created_at) : formatOwnerDecisionTime(req.reviewed_at)}
                              </span>
                              {!isPending && req.reviewer_name && (
                                <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#94A3B8', whiteSpace: 'nowrap' }}>by {req.reviewer_name}</span>
                              )}
                            </div>
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
                              </div>
                            ) : (
                              <>
                                {approved && req.reviewed_by === null && (
                                  <span title="Approved automatically by the Shift Swap auto-approval rules" style={{ fontSize: '0.62rem', fontWeight: 800, color: '#7C3AED', background: '#F5F3FF', borderRadius: 999, padding: '3px 8px', whiteSpace: 'nowrap' }}>Auto-Approved</span>
                                )}
                                <span title={req.status === 'approved' ? 'Approved' : 'Rejected'} style={{ width: 30, height: 30, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: statusTone.bg, color: statusTone.text, border: `1.5px solid ${statusTone.border}`, borderRadius: 999, flexShrink: 0 }}>
                                  <StatusIcon size={12} strokeWidth={3} />
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          {miniShiftCard(req.requester_name, req.requester_role, req.requester_photo_url, req.requester_shift_date, req.requester_start_time, req.requester_end_time, true)}
                          <div className="swap-arrows" style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, color: '#94A3B8' }}>
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

                  // Non-compact = the Review Request card — same horizontal-section layout as the
                  // Off Day queue card: people (with remaining quota under each name) | requested
                  // swap | rule check spelled out in plain text | submitted time | Approve/Reject.
                  const dividerStyle: React.CSSProperties = { width: 1, alignSelf: 'stretch', background: '#E5E7EB', flexShrink: 0 }
                  const ruleConfigured = req.limit_exceeded != null || req.deadline_exceeded != null
                  const rulePill = (ok: boolean, label: string) => (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: '0.76rem', fontWeight: 700, color: ok ? '#15803D' : '#B91C1C', background: ok ? '#F0FDF4' : '#FEF2F2', border: `1px solid ${ok ? '#BBF7D0' : '#FECACA'}`, borderRadius: 999, padding: '4px 12px', whiteSpace: 'nowrap' }}>
                      {ok ? <Check size={11} strokeWidth={3} style={{ flexShrink: 0 }} /> : <X size={11} strokeWidth={3} style={{ flexShrink: 0 }} />}
                      {label}
                    </span>
                  )
                  const personBlock = (name: string, role: string, photo: string | null, swapsLeft: number | null | undefined, mirror: boolean) => (
                    <div style={{ display: 'flex', flexDirection: mirror ? 'row-reverse' : 'row', alignItems: 'center', gap: 12, flexShrink: 0 }}>
                      <RoleAvatar role={role} size={56} photoUrl={photo} />
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 5, alignItems: mirror ? 'flex-end' : 'flex-start' }}>
                        <span style={{ fontSize: '0.95rem', fontWeight: 800, color: '#111827', whiteSpace: 'nowrap' }}>{name}</span>
                        {swapsLeft != null && (
                          <span style={{ fontSize: '0.72rem', fontWeight: 800, color: swapsLeft <= 0 ? '#B91C1C' : '#15803D', whiteSpace: 'nowrap' }}>
                            {swapsLeft}/{req.monthly_swap_limit} swaps left
                          </span>
                        )}
                      </div>
                    </div>
                  )
                  return (
                    <div className="att-request-card" style={{ width: '100%', boxSizing: 'border-box', background: '#FFFFFF', border: `1.5px solid ${PANEL_BORDER}`, borderRadius: 16, padding: '18px 22px 22px', display: 'flex', flexDirection: 'column', gap: 14 }}>
                      {/* Department badge — top-left corner of the card, above everything else.
                          The requester's swap reason (Shift Swap only, Off Day has none) sits
                          right next to it as a small label. */}
                      {(req.department_name || req.reason) && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          {req.department_name && (() => {
                            const dc = deptColor(req.department_name)
                            return <span style={{ fontSize: '0.72rem', fontWeight: 800, color: dc, background: `${dc}1a`, borderRadius: 999, padding: '4px 10px', whiteSpace: 'nowrap' }}>{req.department_name}</span>
                          })()}
                          {req.reason && (
                            <span style={{ fontSize: '0.72rem', fontWeight: 600, color: '#57534E', background: '#F5F5F4', border: '1px solid #E7E5E4', borderRadius: 999, padding: '4px 10px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 480 }}>
                              <strong style={{ fontWeight: 800 }}>Reason:</strong> {req.reason}
                            </span>
                          )}
                        </div>
                      )}
                      <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', rowGap: 12, gap: 20 }}>
                        {personBlock(req.requester_name, req.requester_role, req.requester_photo_url, req.requester_swaps_left, false)}
                        <svg className="swap-arrow-duo" width="26" height="14" viewBox="0 0 24 14" fill="none" style={{ flexShrink: 0, color: '#94A3B8' }}>
                          <line x1="2" y1="4" x2="19" y2="4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                          <polyline points="16,1 22,4 16,7" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                          <line x1="22" y1="10" x2="5" y2="10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                          <polyline points="8,7 2,10 8,13" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                        {personBlock(req.counterpart_name, req.counterpart_role, req.counterpart_photo_url, req.counterpart_swaps_left, true)}

                        {ruleConfigured && (
                          <>
                            <div style={dividerStyle} />
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flexShrink: 0 }}>
                              <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#374151', margin: 0 }}>Rule Check</label>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                                {req.limit_exceeded != null && rulePill(!req.limit_exceeded, req.limit_exceeded ? 'Monthly limit exceeded' : 'Within monthly limit')}
                                {req.deadline_exceeded != null && rulePill(!req.deadline_exceeded, req.deadline_exceeded ? 'Submitted after deadline' : 'Before deadline')}
                              </div>
                            </div>
                          </>
                        )}

                        <div style={dividerStyle} />

                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flexShrink: 0 }}>
                          <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#374151', margin: 0 }}>Submitted</label>
                          <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#374151', whiteSpace: 'nowrap' }}>{formatOwnerDecisionTime(req.created_at)}</span>
                        </div>

                        {isReadyForDecision && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginLeft: 'auto', flexShrink: 0 }}>
                            <button
                              onClick={() => decideRequest('decide_shift_swap', req.id, 'approved', req.requester_name)}
                              disabled={reqActionLoading}
                              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: '0.78rem', fontWeight: 700, color: '#15803D', background: '#F0FDF4', border: '1.5px solid #BBF7D0', borderRadius: 999, padding: '6px 16px', cursor: reqActionLoading ? 'default' : 'pointer', opacity: reqActionLoading ? 0.6 : 1, transition: 'background 0.15s, border-color 0.15s' }}
                            >
                              <Check size={13} /> Approve
                            </button>
                            <button
                              onClick={() => { setRejectSwapTarget({ id: req.id, requesterName: req.requester_name }); setRejectSwapReason(''); setRejectSwapError('') }}
                              disabled={reqActionLoading}
                              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: '0.78rem', fontWeight: 700, color: '#B91C1C', background: '#FEF2F2', border: '1.5px solid #FECACA', borderRadius: 999, padding: '6px 16px', cursor: reqActionLoading ? 'default' : 'pointer', opacity: reqActionLoading ? 0.6 : 1, transition: 'background 0.15s, border-color 0.15s' }}
                            >
                              <X size={13} /> Reject
                            </button>
                          </div>
                        )}
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
                        {/* Action Needed — one request at a time (the one selected in the left
                            Requests queue), same single-card pattern as the Off Day tab. */}
                        {(() => {
                          const clampedIndex = Math.min(actionIndex, Math.max(actionNeeded.length - 1, 0))
                          const currentSwap = actionNeeded[clampedIndex] ?? null
                          return (
                        <div style={{ gridColumn: isCompactReqLayout ? '1' : '2', gridRow: isCompactReqLayout ? 'auto' : '1 / span 2', alignSelf: isCompactReqLayout ? 'auto' : 'stretch', minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
                        <section style={{ background: '#FFFFFF', border: `1px solid ${PANEL_BORDER}`, borderRadius: 14, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                          <div style={{ padding: '14px 18px', borderBottom: `1px solid ${PANEL_BORDER}`, display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{ width: 30, height: 30, borderRadius: 9, background: '#FFF7ED', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                              <ClipboardList size={15} style={{ color: '#F97316' }} />
                            </div>
                            <span style={{ fontSize: 18, fontWeight: 700, color: '#0F172A', letterSpacing: '-0.2px', lineHeight: 1.2, flex: 1 }}>Review Request</span>
                            <button onClick={() => (scopeToManagerDepartments ? setManagerSwapSettingsOpen(true) : setSwapSettingsOpen(true))} title="Settings" style={{ width: 36, height: 30, borderRadius: 10, border: '1.5px solid #E5E7EB', background: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
                              <Settings size={16} style={{ color: '#6B7280' }} />
                            </button>
                          </div>
                          {currentSwap ? (
                            /* Keyed by request id so picking another card in the queue replays the fade */
                            <div key={currentSwap.id} className="att-fade-in" style={{ padding: '14px 16px' }}>
                              <SwapCard req={currentSwap} />
                            </div>
                          ) : (
                            <div style={{ flex: 1, minHeight: 170, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, color: '#9CA3AF' }}>
                              <CheckCheck size={22} strokeWidth={1.5} />
                              <span style={{ fontSize: 13, fontWeight: 600 }}>All caught up — nothing needs action</span>
                            </div>
                          )}
                        </section>
                        <CurrentShiftsBlock
                          show={reqTab === 'swaps'}
                          deptName={currentShiftsDept ?? ''}
                          rows={currentShiftsRows}
                          loading={currentShiftsLoading}
                          panelBorder={PANEL_BORDER}
                          highlightRequest={activeSwapRequest}
                          anchorDate={csAnchorDate}
                          onNavigateDay={navigateCurrentShiftsDay}
                          fixedOffByUserDate={fixedOffByUserDate}
                        />
                        <div ref={taskChangeRowRef} style={{ display: 'flex', flexDirection: taskChangeRowCompact ? 'column' : 'row', alignItems: 'stretch', gap: 16, flexShrink: 0 }}>
                          <TaskChangeBlock
                            title="Current Task Assignment"
                            show={reqTab === 'swaps'}
                            request={activeSwapRequest}
                            panelBorder={PANEL_BORDER}
                            useCounterpartTasksForRequester={false}
                            onSelectTask={setTaskChangeDetail}
                          />
                          <TaskChangeBlock
                            title="Task Assignment After Swap"
                            show={reqTab === 'swaps'}
                            request={activeSwapRequest}
                            panelBorder={PANEL_BORDER}
                            useCounterpartTasksForRequester={true}
                            onSelectTask={setTaskChangeDetail}
                          />
                        </div>
                        </div>
                          )
                        })()}

                        {/* Processed — full list, scrolls within the panel like the Requests queue */}
                        {(() => {
                          const processedDepts = ['all', ...Array.from(new Set(processed.map(r => r.department_name).filter(Boolean)))] as string[]
                          const filteredProcessed = processedDeptFilter === 'all' ? processed : processed.filter(r => r.department_name === processedDeptFilter)
                          return (
                          <section style={{ gridColumn: isCompactReqLayout ? '1' : '3', gridRow: isCompactReqLayout ? 'auto' : '1 / span 2', alignSelf: 'start', maxHeight: isCompactReqLayout ? undefined : '100%', minHeight: 0, background: '#FFFFFF', border: `1px solid ${PANEL_BORDER}`, borderRadius: 14, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                            <div style={{ padding: '11px 18px', borderBottom: `1px solid ${PANEL_BORDER}`, display: 'flex', alignItems: 'center', gap: 8 }}>
                              <div style={{ width: 30, height: 30, borderRadius: 9, background: '#FFF7ED', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                <CheckCheck size={15} style={{ color: '#F97316' }} />
                              </div>
                              <span style={{ fontSize: 18, fontWeight: 700, color: '#0F172A', letterSpacing: '-0.2px', lineHeight: 1.2, flex: 1 }}>Completed Requests</span>
                              {/* Department filter dropdown — Owner/Partner only; a Manager's
                                  queue is already scoped to their own single department, so the
                                  filter has nothing to filter. */}
                              {!scopeToManagerDepartments && (
                              <div ref={processedDeptDropdownRef} style={{ position: 'relative' }}>
                                <button
                                  type="button"
                                  onClick={() => setProcessedDeptDropdownOpen(o => !o)}
                                  style={{ display: 'flex', alignItems: 'center', gap: 5, height: 36, padding: '0 12px', border: `1.5px solid ${processedDeptDropdownOpen ? '#F97316' : '#E5E7EB'}`, borderRadius: 8, background: '#FFFFFF', color: '#374151', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap', boxShadow: processedDeptDropdownOpen ? '0 0 0 3px rgba(249,115,22,0.10)' : 'none', transition: 'border-color 0.15s' }}
                                >
                                  {processedDeptFilter === 'all' ? 'All Departments' : processedDeptFilter}
                                  <ChevronDown size={11} style={{ color: '#9CA3AF', flexShrink: 0, transform: processedDeptDropdownOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
                                </button>
                                {processedDeptDropdownOpen && (
                                  <div style={{ position: 'absolute', top: 'calc(100% + 4px)', right: 0, minWidth: 160, background: '#FFFFFF', border: '1.5px solid #E5E7EB', borderRadius: 10, boxShadow: '0 8px 24px rgba(15,23,42,0.12)', zIndex: 50, padding: '4px 0', overflow: 'hidden' }}>
                                    {processedDepts.map(dept => {
                                      const active = processedDeptFilter === dept
                                      return (
                                        <button key={dept} type="button"
                                          onClick={() => { setProcessedDeptFilter(dept); setProcessedDeptDropdownOpen(false) }}
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
                              )}
                            </div>
                            <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 8, flex: 1, minHeight: 0, overflowY: 'auto' }}>
                              {filteredProcessed.length === 0
                                ? <div style={{ padding: '24px', textAlign: 'center', color: '#9CA3AF', fontSize: '0.875rem' }}>{processedDeptFilter === 'all' ? 'No processed requests.' : `No processed requests for ${processedDeptFilter}.`}</div>
                                : filteredProcessed.map((req, i) => (
                                    /* Key includes the dept filter so switching it replays the cascade */
                                    <div key={`${processedDeptFilter}-${req.id}`} className="att-list-in" style={{ animationDelay: `${Math.min(i, 10) * 45}ms`, flexShrink: 0, display: 'flex', flexDirection: 'column' }}>
                                      <SwapCard req={req} compact />
                                    </div>
                                  ))}
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
                const currentItem = currentFixedOffItem
                // Three rows anchored to the week being processed (displayWeekStart — the oldest
                // week still holding pending requests, rolling forward past the deadline): the
                // locked week above it, the requesting week in the middle (labeled Upcoming Week),
                // and the following week for Modify spillover. No month paging.
                const calendarStartDate = addDays(new Date(`${displayWeekStart}T00:00:00`), -7)
                const calendarGridDates = Array.from({ length: 21 }, (_, i) => toISODate(addDays(calendarStartDate, i)))
                const upcomingWeekStart = displayWeekStart
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
                // The days requested by the card currently selected in the Requests block — these
                // get a highlight ring in the calendar so the Owner sees where the request lands.
                const selectedOffDates = new Set(offDayHighlightEnabled ? (currentFixedOffItem?.requests ?? []).map(r => r.request_date) : [])

                // Shared day-set picker for the Modify flow — used by the request card and by the
                // Off Day Details cards. Selection lives in fixedOffModifyDates (one picker open at
                // a time via modifyingFixedOffKey).
                const ModifyDaysPicker = ({ group, modifyComplete }: { group: FixedOffGroup; modifyComplete: boolean }) => {
                  const requestDates = group.requests.map(r => r.request_date)
                  const weekDates = Array.from({ length: 7 }, (_, i) => toISODate(addDays(new Date(`${group.week_start}T00:00:00`), i)))
                  const customMinDate = toISODate(addDays(new Date(`${weekDates[6]}T00:00:00`), 1))
                  const toggleModifyDate = (d: string) => {
                    setFixedOffModifyDates(prev => prev.includes(d)
                      ? prev.filter(x => x !== d)
                      : (prev.length < requestDates.length ? [...prev, d] : prev))
                  }
                  const confirmModify = () => decideFixedOffGroup(group.requests.map(r => r.id), 'modified', group.requester_name, [...fixedOffModifyDates].sort())
                  return (
                    <div onClick={e => e.stopPropagation()} style={{ width: '100%', boxSizing: 'border-box', border: '1.5px solid #FED7AA', borderRadius: 12, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <p style={{ margin: 0, flex: 1, minWidth: 0, fontSize: '0.8125rem', fontWeight: 700, color: '#0F172A', lineHeight: 1.4 }}>
                          Choose {requestDates.length} replacement day{requestDates.length === 1 ? '' : 's'}
                        </p>
                        <button
                          type="button"
                          onClick={() => { setModifyingFixedOffKey(null); setFixedOffModifyDates([]) }}
                          title="Cancel"
                          style={{ width: 26, height: 26, borderRadius: 8, border: '1.5px solid #E5E7EB', background: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}
                        >
                          <X size={12} style={{ color: '#6B7280' }} />
                        </button>
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
                        {weekDates.map(wd => {
                          const isSelected = fixedOffModifyDates.includes(wd)
                          return (
                            <button
                              key={wd}
                              type="button"
                              onClick={() => toggleModifyDate(wd)}
                              style={{
                                display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.72rem', fontWeight: 700,
                                color: isSelected ? '#C2410C' : '#334155',
                                background: isSelected ? '#FFEDD5' : '#FFFFFF',
                                border: `1.5px solid ${isSelected ? '#FDBA74' : '#E5E7EB'}`,
                                borderRadius: 999, padding: '5px 10px', cursor: 'pointer',
                              }}
                            >
                              {formatFixedOffRequestDay(wd)}
                            </button>
                          )
                        })}
                        {/* Dates picked outside the request week (via the date input) show as removable chips. */}
                        {fixedOffModifyDates.filter(d => !weekDates.includes(d)).map(d => (
                          <button
                            key={d}
                            type="button"
                            onClick={() => toggleModifyDate(d)}
                            style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.72rem', fontWeight: 700, color: '#C2410C', background: '#FFEDD5', border: '1.5px solid #FDBA74', borderRadius: 999, padding: '5px 10px', cursor: 'pointer' }}
                          >
                            {formatFixedOffRequestDay(d)}
                          </button>
                        ))}
                        <input
                          type="date"
                          value=""
                          min={customMinDate}
                          onChange={e => { if (e.target.value && !fixedOffModifyDates.includes(e.target.value)) toggleModifyDate(e.target.value) }}
                          style={{ fontSize: '0.72rem', fontWeight: 700, color: '#334155', background: '#FFFFFF', border: '1.5px solid #E5E7EB', borderRadius: 999, padding: '4px 8px', cursor: 'pointer' }}
                        />
                        {/* Confirm sits in the same row as the replacement days it applies to, not
                            up in the card's header row, so it's unambiguous which selection it
                            commits. marginLeft: auto pins it to the row's right edge even as the
                            day pills wrap. */}
                        {modifyComplete && (
                          <button
                            type="button"
                            onClick={confirmModify}
                            disabled={reqActionLoading}
                            style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.78rem', fontWeight: 700, color: '#FFFFFF', background: 'linear-gradient(135deg, #F97316, #EA580C)', border: '1.5px solid transparent', borderRadius: 999, padding: '6px 16px', cursor: reqActionLoading ? 'default' : 'pointer', opacity: reqActionLoading ? 0.6 : 1, transition: 'background 0.15s, border-color 0.15s' }}
                          >
                            {reqActionLoading ? <Spinner size={13} /> : <Check size={13} />} Confirm
                          </button>
                        )}
                      </div>
                    </div>
                  )
                }

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
                  const queueVerdict = queueAiResult?.items.find(item => item.key === group.key)?.verdict

                  // Modify flow: the Owner picks the request's full NEW set of days (keeping a day =
                  // picking it again). Once the count matches, the Modify button becomes Confirm.
                  const modifyComplete = isModifying && fixedOffModifyDates.length === group.requests.length

                  return (
                    <div
                      className="att-request-card att-fade-in"
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
                      <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', rowGap: 12, gap: 44 }}>
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

                        {/* Queue-analysis verdict for this submission — same marks as the Requests-list cards. */}
                        {isPending && queueVerdict === 'safe' && (
                          <span title="Safe to approve as requested" style={{ width: 32, height: 32, borderRadius: '50%', background: '#DCFCE7', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <Check size={17} strokeWidth={3} style={{ color: '#15803D' }} />
                          </span>
                        )}
                        {isPending && queueVerdict === 'flagged' && (
                          <span title="Requested day is already taken — needs review" style={{ width: 32, height: 32, borderRadius: '50%', background: '#FEF3C7', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <AlertTriangle size={17} style={{ color: '#B45309' }} />
                          </span>
                        )}

                        {isPending ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginLeft: 'auto', flexShrink: 0 }}>
                            <button
                              onClick={() => decideFixedOffGroup(ids, 'approved', group.requester_name)}
                              disabled={reqActionLoading}
                              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: '0.78rem', fontWeight: 700, color: '#15803D', background: '#F0FDF4', border: '1.5px solid #BBF7D0', borderRadius: 999, padding: '6px 16px', cursor: reqActionLoading ? 'default' : 'pointer', opacity: reqActionLoading ? 0.6 : 1, transition: 'background 0.15s, border-color 0.15s' }}
                            >
                              <Check size={13} /> Approve
                            </button>
                            {/* Once every replacement day is picked, Confirm moves down into the
                                picker itself (right above/below the days it applies to) — this
                                button's only job past that point is staying out of the way. */}
                            {!modifyComplete && (
                              <button
                                onClick={() => {
                                  if (isModifying) {
                                    setModifyingFixedOffKey(null)
                                    setFixedOffModifyDates([])
                                  } else {
                                    setFixedOffModifyDates([])
                                    setModifyingFixedOffKey(group.key)
                                  }
                                }}
                                disabled={reqActionLoading}
                                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: '0.78rem', fontWeight: 700, color: '#C2410C', background: isModifying ? '#FFEDD5' : '#FFF7ED', border: `1.5px solid ${isModifying ? '#FDBA74' : '#FED7AA'}`, borderRadius: 999, padding: '6px 16px', cursor: reqActionLoading ? 'default' : 'pointer', opacity: reqActionLoading ? 0.6 : 1, transition: 'background 0.15s, border-color 0.15s' }}
                              >
                                <Pencil size={13} /> Modify
                              </button>
                            )}
                          </div>
                        ) : (
                          <div style={{ marginLeft: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
                            <span title={statusTone.label} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.78rem', fontWeight: 700, color: statusTone.text, background: statusTone.bg, border: `1.5px solid ${statusTone.border}`, borderRadius: 999, padding: '6px 16px', flexShrink: 0 }}>
                              <StatusIcon size={13} strokeWidth={3} /> {statusTone.label}
                            </span>
                            {group.reviewer_name && (
                              <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#94A3B8', whiteSpace: 'nowrap' }}>by {group.reviewer_name}</span>
                            )}
                          </div>
                        )}
                      </div>

                      {isModifying && <ModifyDaysPicker group={group} modifyComplete={modifyComplete} />}
                    </div>
                  )
                }

                return (
                  <>
                    {reqLoading ? (
                      <div style={{ gridColumn: isCompactReqLayout ? '1' : '2 / 4', padding: '32px', textAlign: 'center', color: '#9CA3AF', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}><Spinner size={16} dark /> Loading...</div>
                    ) : (
                      <>
                        {/* Request card + Calendar share one grid cell (col 2, spanning both rows)
                             so their combined natural height never has to be forced to match the
                             AI Insights column — splitting them into separate row-1/row-2 grid items
                             let the grid's row-track sizing inflate row 1 to fit AI Insights, leaving
                             a dead gap above the Calendar. ── */}
                        <div style={{ gridColumn: isCompactReqLayout ? '1' : offDayQueueEmpty ? '1' : '2', gridRow: isCompactReqLayout ? 'auto' : '1 / span 2', alignSelf: isCompactReqLayout ? 'auto' : 'stretch', minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
                        {!offDayQueueEmpty && (() => {
                          const hasActionNeeded = actionNeeded.length > 0
                          // displayWeekStart (outer scope) — the oldest week that still has a pending
                          // request, falling back to the next submission-open week once nothing is
                          // left pending, so the header never jumps ahead of unfinished reviews.
                          const actionTitle = 'Next Week Off Day Requests'
                          return (
                            <section style={{ background: '#FFFFFF', border: `1px solid ${PANEL_BORDER}`, borderRadius: 14, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                              <div style={{ padding: '14px 18px', borderBottom: `1px solid ${PANEL_BORDER}`, display: 'flex', alignItems: 'center', gap: 8 }}>
                                <div style={{ width: 30, height: 30, borderRadius: 9, background: '#FFF7ED', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                  <ClipboardList size={15} style={{ color: '#F97316' }} />
                                </div>
                                <span title={actionTitle} style={{ fontSize: 18, fontWeight: 700, color: '#0F172A', letterSpacing: '-0.2px', lineHeight: 1.2, flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{actionTitle}</span>
                                <button onClick={() => setOffDaySettingsOpen(true)} title="Settings" style={{ width: 36, height: 30, borderRadius: 10, border: '1.5px solid #E5E7EB', background: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
                                  <Settings size={16} style={{ color: '#6B7280' }} />
                                </button>
                                <button onClick={() => { setOverrideSearchPanelOpen(false); setOverrideSearch(''); setOverrideRoleFilter('all'); setOverrideDeptFilter('all'); setManagerOverridesModalOpen(true) }} title="Customization" style={{ width: 36, height: 30, borderRadius: 10, border: '1.5px solid #E5E7EB', background: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
                                  <UserCog size={16} style={{ color: '#6B7280' }} />
                                </button>
                              </div>
                              {currentItem ? (
                                <div style={{ padding: '14px 16px' }}>
                                  {/* key: switching the selected request replays the entrance animation */}
                                  <FixedOffCard key={currentItem.key} group={currentItem} />
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
                        <section style={{ background: '#FFFFFF', border: `1px solid ${PANEL_BORDER}`, borderRadius: 14, overflow: 'hidden', flexShrink: 0, display: 'flex', flexDirection: 'column' }}>
                          <div style={{ padding: '14px 18px', borderBottom: `1px solid ${PANEL_BORDER}`, display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                            <div style={{ width: 30, height: 30, borderRadius: 9, background: '#FFF7ED', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                              <CalendarDays size={15} style={{ color: '#F97316' }} />
                            </div>
                            <span style={{ fontSize: 18, fontWeight: 700, color: '#0F172A', letterSpacing: '-0.2px', lineHeight: 1.2, flexShrink: 0 }}>Off Day Planning Calendar</span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginLeft: 12, flexShrink: 0 }}>
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.78rem', fontWeight: 600, color: '#374151' }}>
                                <span style={{ width: 12, height: 12, borderRadius: '50%', background: '#DCFCE7', border: '1.5px solid #86EFAC', flexShrink: 0 }} /> Approved
                              </span>
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.78rem', fontWeight: 600, color: '#374151' }}>
                                <span style={{ width: 12, height: 12, borderRadius: '50%', background: '#FFEDD5', border: '1.5px solid #FDBA74', flexShrink: 0 }} /> Pending Request
                              </span>
                            </div>
                            {/* With the Next Week block hidden (nothing pending), its Settings /
                                 Customization buttons live here instead. */}
                            {offDayQueueEmpty && (
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto' }}>
                                <button onClick={() => setOffDaySettingsOpen(true)} title="Settings" style={{ width: 36, height: 30, borderRadius: 10, border: '1.5px solid #E5E7EB', background: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
                                  <Settings size={16} style={{ color: '#6B7280' }} />
                                </button>
                                <button onClick={() => { setOverrideSearchPanelOpen(false); setOverrideSearch(''); setOverrideRoleFilter('all'); setOverrideDeptFilter('all'); setManagerOverridesModalOpen(true) }} title="Customization" style={{ width: 36, height: 30, borderRadius: 10, border: '1.5px solid #E5E7EB', background: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
                                  <UserCog size={16} style={{ color: '#6B7280' }} />
                                </button>
                              </div>
                            )}
                          </div>

                          {fixedOffDayRequests.length === 0 ? (
                            <div style={{ padding: '48px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, color: '#9CA3AF' }}>
                              <CalendarDays size={22} strokeWidth={1.5} />
                              <span style={{ fontSize: 13, fontWeight: 600 }}>No off day requests yet</span>
                            </div>
                          ) : (
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
                                {calendarGridDates.map((date, i) => {
                                  const day = new Date(`${date}T00:00:00`)
                                  const isToday = date === todayKey
                                  const requests = fixedOffByDate.get(date) ?? []
                                  const activeRequests = requests.filter(r => r.status !== 'rejected')
                                  // Split per day: green = already decided (approved/modified), orange = still pending.
                                  const cellPendingCount = activeRequests.filter(r => r.status === 'pending').length
                                  const cellDecidedCount = activeRequests.length - cellPendingCount
                                  const tooltip = requests.length > 0
                                    ? requests.map(r => `${r.requester_name} — ${fixedOffStatusTone(r.status).label}`).join('\n')
                                    : undefined
                                  const isLastCol = i % 7 === 6
                                  const isLastRow = i >= calendarGridDates.length - 7
                                  const hasDetails = activeRequests.length > 0
                                  // The selected request's days pop out of the grid (lift + shadow);
                                  // every other cell stays exactly as normal.
                                  const isSelectedOffDay = selectedOffDates.has(date)
                                  // The day whose Off Day Details panel is open stays tinted so the
                                  // Owner can see which date they clicked.
                                  const isDetailDay = date === dayOffDetailDate
                                  const cellBg = isDetailDay ? '#FFF7ED' : '#FFFFFF'
                                  // Merged full-width band naming the week each row belongs to.
                                  const weekBandLabel = i === 0 ? 'Approved Week' : i === 7 ? 'Upcoming Week' : null
                                  return [
                                    weekBandLabel && (
                                      <div
                                        key={`${date}-week-band`}
                                        style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '8px 0', fontSize: 15, fontWeight: 700, color: '#334155', background: '#F8FAFC', borderBottom: '1px solid #1E293B' }}
                                      >
                                        {weekBandLabel}
                                      </div>
                                    ),
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
                                        padding: '10px 12px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4, minHeight: 104,
                                        position: 'relative',
                                        cursor: hasDetails ? 'pointer' : 'default', transition: 'background 0.14s ease',
                                      }}
                                    >
                                      <div style={{ position: 'absolute', top: 14, right: 14, fontSize: 15, fontWeight: 800, color: isToday ? '#F97316' : '#64748B' }}>
                                        {day.getDate()}
                                      </div>
                                      {isSelectedOffDay ? (
                                        <span title={currentItem?.requester_name} style={{ maxWidth: '92%', fontSize: '0.8rem', fontWeight: 800, color: '#C2410C', background: '#FFEDD5', borderRadius: 999, padding: '5px 12px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                          {currentItem?.requester_name}
                                        </span>
                                      ) : (
                                        activeRequests.length > 0 && !(selectedOffDates.size > 0 && i >= 7 && i < 14) && (
                                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                            {cellDecidedCount > 0 && (
                                              <span title={`${cellDecidedCount} approved`} style={{ width: 36, height: 36, borderRadius: '50%', background: '#DCFCE7', color: '#15803D', fontSize: 16, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                                {cellDecidedCount}
                                              </span>
                                            )}
                                            {cellPendingCount > 0 && (
                                              <span title={`${cellPendingCount} pending`} style={{ width: 36, height: 36, borderRadius: '50%', background: '#FFEDD5', color: '#C2410C', fontSize: 16, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                                {cellPendingCount}
                                              </span>
                                            )}
                                          </div>
                                        )
                                      )}
                                    </div>,
                                  ]
                                })}
                              </div>
                            </div>
                          </div>
                          )}
                        </section>

                        {/* ── Off Day Preview Calendar — the upcoming week only, showing how the AI
                             Process pass split that week: green = safe to approve as requested,
                             amber = collides with a taken day and needs review. ── */}
                        {!offDayQueueEmpty && (() => {
                          const previewDates = Array.from({ length: 7 }, (_, i) => toISODate(addDays(calendarStartDate, 7 + i)))
                          const pendingKeys = new Set(fixedOffActionNeeded.map(g => g.key))
                          const previewCounts = new Map<string, { safe: number; flagged: number }>()
                          if (queueAiResult) {
                            for (const item of queueAiResult.items) {
                              if (!pendingKeys.has(item.key)) continue
                              for (const date of item.request_dates) {
                                const entry = previewCounts.get(date) ?? { safe: 0, flagged: 0 }
                                if (item.verdict === 'safe') entry.safe++
                                else entry.flagged++
                                previewCounts.set(date, entry)
                              }
                            }
                          }
                          return (
                            <section style={{ background: '#FFFFFF', border: `1px solid ${PANEL_BORDER}`, borderRadius: 14, overflow: 'hidden', flexShrink: 0 }}>
                              <div style={{ padding: '14px 18px', borderBottom: `1px solid ${PANEL_BORDER}`, display: 'flex', alignItems: 'center', gap: 8 }}>
                                <div style={{ width: 30, height: 30, borderRadius: 9, background: '#F5F3FF', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                  <CalendarDays size={15} style={{ color: '#7C3AED' }} />
                                </div>
                                <span style={{ fontSize: 18, fontWeight: 700, color: '#0F172A', letterSpacing: '-0.2px', lineHeight: 1.2 }}>Off Day Preview Calendar</span>
                              </div>
                              {!queueAiResult ? (
                                <div style={{ padding: '38px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, color: '#9CA3AF' }}>
                                  <Sparkles size={22} strokeWidth={1.5} />
                                  <span style={{ fontSize: 13, fontWeight: 600 }}>Press Process to preview the decisions</span>
                                </div>
                              ) : (
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
                                      {previewDates.map((date, i) => {
                                        const day = new Date(`${date}T00:00:00`)
                                        const counts = previewCounts.get(date) ?? { safe: 0, flagged: 0 }
                                        const hasItems = counts.safe > 0 || counts.flagged > 0
                                        return (
                                          <div
                                            key={date}
                                            onClick={() => { if (hasItems) setDayOffDetailDate(date) }}
                                            onMouseEnter={e => { if (hasItems) e.currentTarget.style.background = '#F8FAFC' }}
                                            onMouseLeave={e => { e.currentTarget.style.background = '#FFFFFF' }}
                                            style={{
                                              borderRight: i !== 6 ? '1px solid #1E293B' : 'none',
                                              background: '#FFFFFF',
                                              padding: '10px 12px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4, minHeight: 104,
                                              position: 'relative',
                                              cursor: hasItems ? 'pointer' : 'default', transition: 'background 0.14s ease',
                                            }}
                                          >
                                            <div style={{ position: 'absolute', top: 14, right: 14, fontSize: 15, fontWeight: 800, color: '#64748B' }}>
                                              {day.getDate()}
                                            </div>
                                            {hasItems && (
                                              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                                {counts.safe > 0 && (
                                                  <span title={`${counts.safe} safe to approve`} style={{ width: 36, height: 36, borderRadius: '50%', background: '#DCFCE7', color: '#15803D', fontSize: 16, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                                    {counts.safe}
                                                  </span>
                                                )}
                                                {counts.flagged > 0 && (
                                                  <span title={`${counts.flagged} need review`} style={{ width: 36, height: 36, borderRadius: '50%', background: '#FEF3C7', color: '#B45309', fontSize: 16, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                                    {counts.flagged}
                                                  </span>
                                                )}
                                              </div>
                                            )}
                                          </div>
                                        )
                                      })}
                                    </div>
                                  </div>
                                </div>
                              )}
                            </section>
                          )
                        })()}
                        </div>

                        {/* ── Request Overview + Details share one grid cell (col 3, spanning both
                             rows), same reasoning as the col-2 wrapper above. ── */}
                        <div style={{ gridColumn: isCompactReqLayout ? '1' : offDayQueueEmpty ? '2' : '3', gridRow: isCompactReqLayout ? 'auto' : '1 / span 2', alignSelf: isCompactReqLayout ? 'auto' : 'stretch', minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
                        {(() => {
                          const detailRequests = dayOffDetailDate
                            ? fixedOffDayRequests
                              .filter(r => r.request_date === dayOffDetailDate && r.status !== 'rejected')
                              .sort((a, b) => a.requester_name.localeCompare(b.requester_name))
                            : []
                          // "Mon, 06 Jul" — the day picked in the calendar, shown in the block title.
                          const detailDateLabel = dayOffDetailDate
                            ? (() => {
                                const d = new Date(`${dayOffDetailDate}T00:00:00`)
                                return `${d.toLocaleDateString('en-GB', { weekday: 'short' })}, ${String(d.getDate()).padStart(2, '0')} ${DATE_DISPLAY_MONTHS[d.getMonth()]}`
                              })()
                            : null
                          // Each person's full weekly request (not just this one day) gives context —
                          // e.g. someone off Tue AND Wed shows both dates even though only Tue was clicked.
                          const groupByUserWeek = new Map(fixedOffGroupsAll.map(g => [`${g.user_id}_${g.week_start}`, g]))
                          // Queue-analysis verdict per pending submission (same key shape) — lets each
                          // card carry a Suggest Approve / Review tag after Process has run.
                          const detailVerdictByKey = new Map(queueAiResult?.items.map(item => [item.key, item.verdict]) ?? [])
                          const managerRequests = detailRequests.filter(r => r.requester_role === 'Manager')
                          const employeeRequests = detailRequests.filter(r => r.requester_role === 'Employee')
                          const managerLabel = 'Managers Scheduled Off'
                          const employeeLabel = 'Employees Scheduled Off'

                          const renderPerson = (req: FixedOffDayRequestView) => {
                            const person = fixedOffStaffById.get(req.user_id)
                            const deptId = req.department_id ?? person?.department_id ?? null
                            const deptName = deptId ? fixedOffDeptNameById.get(deptId) : null
                            const dc = deptName ? deptColor(deptName) : '#64748B'
                            const group = groupByUserWeek.get(`${req.user_id}_${req.week_start}`)
                            const requestedDates = group?.requests ?? [req]
                            const isDecided = req.status === 'approved' || req.status === 'modified'
                            const verdict = req.status === 'pending' ? detailVerdictByKey.get(`${req.user_id}_${req.week_start}`) : undefined
                            // Clicking a pending card jumps that person's submission into the Next Week
                            // Off Day Requests block — same behavior as picking it from the Requests list,
                            // including opening Modify pre-seeded when the verdict is flagged.
                            const queueIdx = group ? fixedOffActionNeeded.indexOf(group) : -1
                            const openInQueue = () => {
                              if (queueIdx < 0 || !group) return
                              setFixedOffActionIndex(queueIdx)
                              setOffDayHighlightEnabled(true)
                              if (verdict === 'flagged') {
                                const item = queueAiResult?.items.find(qi => qi.key === group.key)
                                setFixedOffModifyDates((item?.suggested_dates ?? []).slice(0, group.requests.length))
                                setModifyingFixedOffKey(group.key)
                              } else if (modifyingFixedOffKey && modifyingFixedOffKey !== group.key) {
                                setModifyingFixedOffKey(null)
                                setFixedOffModifyDates([])
                              }
                            }
                            // An already-decided request in the upcoming week can still be changed —
                            // same Modify picker as the request card, inline on this person card.
                            const canModifyDecided = isDecided && !!group && group.week_start === upcomingWeekStart
                            const isModifyingThis = !!group && modifyingFixedOffKey === group.key
                            const detailModifyComplete = isModifyingThis && !!group && fixedOffModifyDates.length === group.requests.length
                            return (
                              <div
                                key={req.id}
                                onClick={queueIdx >= 0 ? openInQueue : undefined}
                                onMouseEnter={e => { if (queueIdx >= 0) { e.currentTarget.style.borderColor = '#FDBA74'; e.currentTarget.style.boxShadow = '0 4px 14px rgba(249,115,22,0.12)' } }}
                                onMouseLeave={e => { e.currentTarget.style.borderColor = PANEL_BORDER; e.currentTarget.style.boxShadow = 'none' }}
                                style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 12, border: `1px solid ${PANEL_BORDER}`, borderRadius: 12, padding: '18px 16px', background: '#FFFFFF', cursor: queueIdx >= 0 ? 'pointer' : 'default', transition: 'border-color 0.15s, box-shadow 0.15s' }}
                              >
                                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                                  <RoleAvatar role={req.requester_role} size={48} photoUrl={person?.profile_photo_url ?? null} />
                                  <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingRight: (isDecided || verdict) ? 150 : 0 }}>
                                      {deptName && (
                                        <span style={{ fontSize: '0.72rem', fontWeight: 800, color: dc, background: `${dc}1a`, borderRadius: 999, padding: '4px 10px', flexShrink: 0, alignSelf: 'flex-start' }}>{deptName}</span>
                                      )}
                                      <span style={{ fontSize: '0.875rem', fontWeight: 700, color: '#111827', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{req.requester_name}</span>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
                                      {requestedDates.map(r => (
                                        <span key={r.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.76rem', fontWeight: 700, color: '#C2410C', background: '#FFF7ED', border: '1px solid #FED7AA', borderRadius: 999, padding: '4px 10px', whiteSpace: 'nowrap' }}>
                                          <Calendar size={11} style={{ flexShrink: 0 }} />
                                          {formatFixedOffRequestDay(r.request_date)}
                                        </span>
                                      ))}
                                      {/* Once every replacement day is picked, Confirm moves down into
                                          the picker itself, grouped with the days it applies to. */}
                                      {canModifyDecided && !detailModifyComplete && (
                                        <button
                                          type="button"
                                          onClick={e => {
                                            e.stopPropagation()
                                            if (isModifyingThis) {
                                              setModifyingFixedOffKey(null)
                                              setFixedOffModifyDates([])
                                            } else {
                                              setFixedOffModifyDates([])
                                              setModifyingFixedOffKey(group!.key)
                                            }
                                          }}
                                          disabled={reqActionLoading}
                                          style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.76rem', fontWeight: 700, color: '#C2410C', background: isModifyingThis ? '#FFEDD5' : '#FFF7ED', border: `1px solid ${isModifyingThis ? '#FDBA74' : '#FED7AA'}`, borderRadius: 999, padding: '4px 10px', whiteSpace: 'nowrap', cursor: reqActionLoading ? 'default' : 'pointer', opacity: reqActionLoading ? 0.6 : 1, flexShrink: 0, transition: 'background 0.15s, border-color 0.15s' }}
                                        >
                                          <Pencil size={11} /> Modify
                                        </button>
                                      )}
                                    </div>
                                    <span style={{ fontSize: '0.75rem', color: '#9CA3AF' }}>Submitted on {formatCompactAt(req.created_at)}</span>
                                  </div>
                                </div>
                                {/* Decision time + status circle top-right of the card, verdict mark
                                    stacked below it in the same right-aligned column. Absolutely
                                    positioned so this column's height never pushes the name/dates down. */}
                                {(isDecided || verdict) && (
                                  <div style={{ position: 'absolute', top: 18, right: 16, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
                                    {isDecided && (
                                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                                        {(req.reviewed_at || req.reviewer_name) && (
                                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
                                            {req.reviewed_at && (
                                              <span style={{ fontSize: '0.76rem', fontWeight: 800, color: '#64748B', whiteSpace: 'nowrap' }}>{formatOwnerDecisionTime(req.reviewed_at)}</span>
                                            )}
                                            {req.reviewer_name && (
                                              <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#94A3B8', whiteSpace: 'nowrap' }}>by {req.reviewer_name}</span>
                                            )}
                                          </div>
                                        )}
                                        <span title="Approved" style={{ width: 30, height: 30, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: '#ECFDF5', color: '#047857', border: '1.5px solid #86EFAC', borderRadius: 999, flexShrink: 0 }}>
                                          <Check size={12} strokeWidth={3} />
                                        </span>
                                      </div>
                                    )}
                                    {verdict === 'safe' && (
                                      <span title="Safe to approve as requested" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: '0.72rem', fontWeight: 800, color: '#15803D', background: '#DCFCE7', borderRadius: 999, padding: '4px 10px', whiteSpace: 'nowrap', flexShrink: 0 }}>
                                        <Check size={12} strokeWidth={3} style={{ flexShrink: 0 }} /> Suggest Approve
                                      </span>
                                    )}
                                    {verdict === 'flagged' && (
                                      <span title="Requested day is already taken — needs review" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: '0.72rem', fontWeight: 800, color: '#B45309', background: '#FEF3C7', borderRadius: 999, padding: '4px 10px', whiteSpace: 'nowrap', flexShrink: 0 }}>
                                        <AlertTriangle size={12} style={{ flexShrink: 0 }} /> Review
                                      </span>
                                    )}
                                  </div>
                                )}
                                {canModifyDecided && isModifyingThis && group && <ModifyDaysPicker group={group} modifyComplete={detailModifyComplete} />}
                              </div>
                            )
                          }

                          return (
                            <section style={{ background: '#FFFFFF', border: `1px solid ${PANEL_BORDER}`, borderRadius: 14, overflow: 'hidden', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
                              <div style={{ padding: '14px 18px', borderBottom: `1px solid ${PANEL_BORDER}`, display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                                <div style={{ width: 30, height: 30, borderRadius: 9, background: '#FFF7ED', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                  <Eye size={15} style={{ color: '#F97316' }} />
                                </div>
                                <span style={{ fontSize: 18, fontWeight: 700, color: '#0F172A', letterSpacing: '-0.2px', lineHeight: 1.2, flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{detailDateLabel ? `Off Day Details For ${detailDateLabel}` : 'Off Day Details'}</span>
                                {dayOffDetailDate && (
                                  <button type="button" onClick={() => setDayOffDetailDate(null)} style={{ width: 28, height: 28, borderRadius: 8, border: '1.5px solid #E5E7EB', background: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
                                    <X size={12} style={{ color: '#6B7280' }} />
                                  </button>
                                )}
                              </div>
                              <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '14px 16px' }}>
                              {!dayOffDetailDate ? (
                                <div style={{ padding: '38px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, color: '#9CA3AF' }}>
                                  <Eye size={22} strokeWidth={1.5} />
                                  <span style={{ fontSize: 13, fontWeight: 600 }}>Click a day in the calendar to see who&apos;s off</span>
                                </div>
                              ) : detailRequests.length === 0 ? (
                                <div style={{ padding: '38px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, color: '#9CA3AF' }}>
                                  <Eye size={22} strokeWidth={1.5} />
                                  <span style={{ fontSize: 13, fontWeight: 600 }}>No one is off this day</span>
                                </div>
                              ) : (
                                <div key={dayOffDetailDate} className="att-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 16, paddingRight: 8 }}>
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

            </div>{/* /right content */}
            </div>{/* /two-col grid */}

          </div>
        )}

      </main>

      {/* ── Submit Request modal — Manager only, opened from the Records header. Choose-then-fill
           pattern mirroring the Recruitment AI Job Builder's "Choose Job Type" step (two option
           cards up front, form after), re-themed to this page's plain orange accent. ── */}
      {requestModalOpen && (() => {
        const todayStr = new Date().toISOString().slice(0, 10)
        const mySwappableShifts = myShifts.filter(s => s.shift.shift_date > todayStr)
        const colleagueRows = swapCandidateRows.filter(r => r.user_id !== internalUserId && r.role === 'Manager' && (scopedDeptRef.current?.ids.has(r.department_id) ?? false))
        const selectedColleague = colleagueRows.find(r => r.user_id === swapCounterpartId)
        const colleagueShifts = (selectedColleague?.shifts ?? []).filter(s => s.shift_date > todayStr && s.assignment_id)
        const closeRequestModal = () => { setRequestModalOpen(false); setRequestModalStep('choose') }
        const modalTitle = requestModalStep === 'choose' ? 'Submit Request'
          : requestModalStep === 'swap' ? 'Submit Shift Swap Request' : 'Submit Off Day Request'
        const modalIcon = requestModalStep === 'offday' ? <Calendar size={15} color="#fff" strokeWidth={2.5} /> : <ArrowLeftRight size={15} color="#fff" strokeWidth={2.5} />
        return (
          <ModalOverlay onClose={closeRequestModal} maxWidth="440px">
            <ModalBox>
              <ModalHeader title={modalTitle} icon={modalIcon} onClose={closeRequestModal} />
              <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 13, maxHeight: 'calc(90vh - 130px)', overflowY: 'auto' }}>
                {myReqError && (
                  <div style={modalErrorBoxStyle}>{myReqError}</div>
                )}

                {/* ── Step 1: choose request type — same card style as Job Type step ── */}
                {requestModalStep === 'choose' && (
                  <>
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
                          <p style={{ fontSize: '0.8125rem', color: '#6B7280', margin: 0 }}>Trade a shift with a colleague in your department.</p>
                        </div>
                      </div>
                    </button>
                    <button onClick={() => setRequestModalStep('offday')}
                      style={{ padding: '14px 16px', border: '1.5px solid #E5E7EB', borderRadius: 12, background: '#FFFFFF', cursor: 'pointer', textAlign: 'left' }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = '#F97316' }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = '#E5E7EB' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{ width: 36, height: 36, borderRadius: 9, background: '#FFF7ED', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <Calendar size={17} color="#F97316" />
                        </div>
                        <div>
                          <p style={{ fontWeight: 600, fontSize: '0.875rem', color: '#374151', margin: '0 0 2px' }}>Off Day Request</p>
                          <p style={{ fontSize: '0.8125rem', color: '#6B7280', margin: 0 }}>Request specific days off for the upcoming week.</p>
                        </div>
                      </div>
                    </button>
                  </>
                )}

                {/* ── Step 2a: Shift Swap form ── */}
                {requestModalStep === 'swap' && (
                  <>
                    <div>
                      <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 5 }}>My Shift</label>
                      <select value={swapShiftId} onChange={e => setSwapShiftId(e.target.value)} style={selectStyle}>
                        <option value="">Select a shift to swap… (tomorrow or later)</option>
                        {mySwappableShifts.map(s => (
                          <option key={s.assignment.id} value={s.assignment.id}>{s.shift.title || 'Shift'} — {s.shift.shift_date} {formatShiftHour(s.shift.start_time)}–{formatShiftHour(s.shift.end_time)}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 5 }}>Swap With</label>
                      <select value={swapCounterpartId} onChange={e => { setSwapCounterpartId(e.target.value); setSwapCounterpartAssignmentId('') }} style={selectStyle}>
                        <option value="">Select a colleague…</option>
                        {colleagueRows.map(r => (
                          <option key={r.user_id} value={r.user_id ?? ''}>{r.full_name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 5 }}>Their Shift</label>
                      <select value={swapCounterpartAssignmentId} onChange={e => setSwapCounterpartAssignmentId(e.target.value)} disabled={!swapCounterpartId} style={selectStyle}>
                        <option value="">{swapCounterpartId ? (colleagueShifts.length === 0 ? 'No upcoming shifts' : 'Select their shift…') : 'Select a colleague first'}</option>
                        {colleagueShifts.map(s => (
                          <option key={s.assignment_id} value={s.assignment_id ?? ''}>{s.title || 'Shift'} — {s.shift_date} {formatShiftHour(s.start_time)}–{formatShiftHour(s.end_time)}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 5 }}>Reason (optional)</label>
                      <textarea value={swapReason} onChange={e => setSwapReason(e.target.value)} rows={2} style={{ ...selectStyle, height: 'auto', padding: '8px 10px', resize: 'vertical', fontFamily: 'inherit' }} />
                    </div>
                  </>
                )}

                {/* ── Step 2b: Off Day form ── */}
                {requestModalStep === 'offday' && (
                  <>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, color: '#6B7280', fontSize: 12.5, fontWeight: 700 }}>
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
                              minHeight: 58, padding: '8px 10px', borderRadius: 10,
                              border: selected ? '1.5px solid #16A34A' : `1px solid ${PANEL_BORDER}`,
                              background: selected ? '#DCFCE7' : '#FFFFFF',
                              color: selected ? '#166534' : '#111827',
                              opacity: atLimit ? 0.45 : 1, cursor: atLimit ? 'not-allowed' : 'pointer',
                              display: 'flex', flexDirection: 'column', alignItems: 'flex-start', justifyContent: 'center', gap: 3, fontWeight: 800,
                            }}
                          >
                            <span style={{ fontSize: 12 }}>{new Date(`${date}T00:00:00`).toLocaleDateString('en-AU', { weekday: 'short' })}</span>
                            <span style={{ fontSize: 13 }}>{formatDateDisplay(date)}</span>
                          </button>
                        )
                      })}
                    </div>
                  </>
                )}
              </div>
              <div style={{ padding: '12px 24px 20px', display: 'flex', gap: 8, justifyContent: requestModalStep === 'choose' ? 'flex-end' : 'space-between', borderTop: '1px solid #F3F4F6' }}>
                {requestModalStep === 'choose' ? (
                  <button onClick={closeRequestModal} style={modalGhostButtonStyle}>Cancel</button>
                ) : (
                  <>
                    <button onClick={() => { setRequestModalStep('choose'); setMyReqError('') }} style={{ ...modalGhostButtonStyle, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                      <ChevronLeft size={14} /> Back
                    </button>
                    {requestModalStep === 'swap' ? (
                      <button onClick={handleSubmitSwap} disabled={swapSubmitting || !swapShiftId || !swapCounterpartId || !swapCounterpartAssignmentId} style={modalPrimaryButtonStyle(swapSubmitting || !swapShiftId || !swapCounterpartId || !swapCounterpartAssignmentId)}>
                        {swapSubmitting ? <Spinner size={13} /> : <ArrowLeftRight size={13} />} Submit Swap Request
                      </button>
                    ) : (
                      <button onClick={handleSubmitFixedOff} disabled={fixedSubmitting || selectedFixedOffDates.length !== fixedOffQuota} style={modalPrimaryButtonStyle(fixedSubmitting || selectedFixedOffDates.length !== fixedOffQuota)}>
                        {fixedSubmitting ? <Spinner size={13} /> : <Calendar size={13} />} Request Weekly Day Off
                      </button>
                    )}
                  </>
                )}
              </div>
            </ModalBox>
          </ModalOverlay>
        )
      })()}

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
      {reviewOpen && reviewRecord && (() => {
        // UC56 (rank confirmed 2026-07-23): Owner/Partner outrank Manager — once either of them
        // modifies a record, a Manager loses edit rights on it entirely (server enforces this too,
        // see assertCanModifyClockTimes), so the dropdowns must not even render as editable.
        const lockedByOwnerOrPartner = scopeToManagerDepartments
          && reviewRecord.record?.owner_status === 'modified'
          && (reviewRecord.modifier_role === 'Owner' || reviewRecord.modifier_role === 'Partner')
        // UC56 (expanded 2026-07-23): a Manager's edit right stops at their own department's
        // Employee/Casual Worker records — a peer Manager's record is view-only even though
        // canModifyClockTimes is true for the page as a whole.
        const canEditReviewRecord = canModifyClockTimes && !lockedByOwnerOrPartner && (!scopeToManagerDepartments || reviewRecord.assignee_role !== 'Manager')
        // True only once the user has actually changed one of the four pickers from what the
        // modal opened with — the Reason field (and an actual "modify" submission) should only
        // appear/apply once there's something to explain, not just for opening the record to look.
        const hasTimeChanges = reviewClockIn !== reviewInitialTimes.clockIn
          || reviewClockOut !== reviewInitialTimes.clockOut
          || reviewBreakIn !== reviewInitialTimes.breakIn
          || reviewBreakOut !== reviewInitialTimes.breakOut
        // Predicts whether saving now will actually register as a modification — i.e. differs from
        // the field's TRUE original — mirroring resolveTrueOriginal/computeOwnerModification on the
        // server. clock_in_time/clock_out_time are immutable raw punches, so the record's own copy
        // IS the true original; break_in_time/break_out_time get overwritten directly, so a stored
        // owner_modified_original_values entry (from an earlier edit) is reused when present.
        const shiftDateForCompare = reviewRecord.shift.shift_date
        const toISOForCompare = (ampm: string): string | null => ampm ? new Date(`${shiftDateForCompare}T${amPmToHHMM(ampm)}:00Z`).toISOString() : null
        const truncateToMinute = (iso: string | null) => iso?.slice(0, 16) ?? null
        const resolveTrueOriginalClient = (field: AttendanceModifiedTimeField): string | null => {
          const record = reviewRecord.record
          if (!record) return null
          if (field === 'clock_in_time') return record.clock_in_time
          if (field === 'clock_out_time') return record.clock_out_time
          const stored = record.owner_modified_original_values ?? {}
          return field in stored ? stored[field] ?? null : record[field]
        }
        const currentPickerValues: Record<AttendanceModifiedTimeField, string | null> = {
          clock_in_time: toISOForCompare(reviewClockIn),
          clock_out_time: toISOForCompare(reviewClockOut),
          break_in_time: toISOForCompare(reviewBreakIn),
          break_out_time: toISOForCompare(reviewBreakOut),
        }
        const willBeModified = (['clock_in_time', 'clock_out_time', 'break_in_time', 'break_out_time'] as const)
          .some(field => truncateToMinute(resolveTrueOriginalClient(field)) !== truncateToMinute(currentPickerValues[field]))
        // Surfaces who modified this record (Manager, Owner, or Partner — any of the three) and
        // which fields, so the review modal can show a "Modified" summary row plus a per-field "M"
        // badge + original value. Shown for every role, Manager included — a Manager needs to see
        // when Owner/Partner corrected their own or their team's records.
        const showModifiedInfo = reviewRecord.record?.owner_status === 'modified'
        const modifiedFieldsSet = new Set(reviewRecord.record?.owner_modified_fields ?? [])
        const fieldLabelWithBadge = (text: string, fieldKey: AttendanceModifiedTimeField) => (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            {text}
            {showModifiedInfo && modifiedFieldsSet.has(fieldKey) && (
              <span title="Modified" style={{ width: 14, height: 14, borderRadius: '50%', background: '#F97316', color: '#fff', fontSize: 8, fontWeight: 800, lineHeight: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>M</span>
            )}
          </span>
        )
        const originalValueNote = (fieldKey: AttendanceModifiedTimeField) => {
          if (!showModifiedInfo || !modifiedFieldsSet.has(fieldKey)) return null
          const original = reviewRecord.record?.owner_modified_original_values?.[fieldKey] ?? null
          return (
            <p style={{ margin: '4px 0 0', fontSize: 11, fontWeight: 700, color: '#EA580C' }}>
              Original: {original ? fmtClockStamp(original) : '—'}
            </p>
          )
        }
        // The existing reason, shown read-only and un-editable — until the user actually touches
        // a time again, at which point it hands off to the editable box below (always starting
        // blank, even for the original author) and this read-only view disappears.
        const showReadOnlyReason = showModifiedInfo && !hasTimeChanges
        // A NEW reason is required only when the edit actually nets out different from the true
        // original — reverting a time exactly back to what it originally was needs no reason at
        // all (see willBeModified above), so the box doesn't appear for that case either.
        const showEditableReason = hasTimeChanges && willBeModified
        return (
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
                  <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: 999, fontSize: '0.8125rem', fontWeight: 700, background: reviewRecord.assignee_role === 'Manager' ? '#FFF7ED' : '#F3F4F6', color: reviewRecord.assignee_role === 'Manager' ? '#EA580C' : '#4B5563' }}>
                    {reviewRecord.assignee_role}
                  </span>
                  {(() => {
                    const status = getARStatus(reviewRecord)
                    if (status === 'late') return <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: 999, fontSize: '0.8125rem', fontWeight: 700, background: '#FEF9C3', color: '#A16207' }}>Late</span>
                    if (status === 'present') return <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: 999, fontSize: '0.8125rem', fontWeight: 700, background: '#DCFCE7', color: '#15803D' }}>Present</span>
                    if (status === 'absent') return <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: 999, fontSize: '0.8125rem', fontWeight: 700, background: '#FEF2F2', color: '#B91C1C' }}>Absent</span>
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
                          ? () => router.push(`${basePath}/recruitment?job=${reviewRecord.shift.source_job_posting_id}`)
                          : undefined,
                      },
                    ]
                  : [
                      { label: 'Department', value: reviewRecord.department_name ?? '—' },
                    ]
                ),
                { label: 'Date', value: formatDateDisplay(reviewRecord.shift.shift_date) },
                ...(reviewRecord.shift.is_open_ended
                  ? [{ label: 'Start Time', value: formatShiftHour(reviewRecord.shift.start_time) }]
                  : [{ label: 'Shift Time', value: `${formatShiftHour(reviewRecord.shift.start_time)} – ${formatShiftHour(reviewRecord.shift.end_time)}` }]
                ),
                ...(showModifiedInfo
                  ? [{ label: 'Modified By', value: `${reviewRecord.modifier_name ?? 'Unknown'} on ${formatModifiedDateOnly(reviewRecord.record?.owner_reviewed_at)}` }]
                  : []
                ),
              ] as { label: string; value: string; onClick?: () => void }[]).map(field => (
                <div key={field.label} style={{ padding: '14px 0', borderBottom: '1px solid #F3F4F6' }}>
                  <label style={{ ...modalLabelStyle, marginBottom: 4 }}>{field.label}</label>
                  {field.onClick ? (
                    <button
                      type="button"
                      onClick={field.onClick}
                      title="View this job on the Recruitment page"
                      style={{ fontSize: '0.9375rem', color: '#F97316', margin: 0, background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left', fontWeight: 700, textDecoration: 'underline', textUnderlineOffset: 3, fontFamily: "'Inter', system-ui, -apple-system, sans-serif" }}
                    >
                      {field.value}
                    </button>
                  ) : (
                    <p style={{ fontSize: '0.9375rem', color: '#111827', margin: 0, fontFamily: "'Inter', system-ui, -apple-system, sans-serif" }}>{field.value}</p>
                  )}
                </div>
              ))}

              {/* Editable clock times — only meaningful if a clock-in/out record actually exists.
                  A genuine no-show (absent, never clocked in) has no attendance_records row at
                  all, so there is nothing here to edit or save. */}
              {canEditReviewRecord && reviewRecord.record && (
                <div style={{ padding: '14px 0', borderBottom: '1px solid #F3F4F6', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={{ ...modalLabelStyle, marginBottom: 6 }}>{fieldLabelWithBadge('Clock In', 'clock_in_time')}</label>
                    <div style={{ position: 'relative' }}>
                      <select value={reviewClockIn} onChange={e => setReviewClockIn(e.target.value)} style={selectStyle}>
                        <option value="">-- select --</option>
                        {TIME_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                      <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: '#6B7280', fontSize: 12 }}>▾</span>
                    </div>
                    {originalValueNote('clock_in_time')}
                  </div>
                  <div>
                    <label style={{ ...modalLabelStyle, marginBottom: 6 }}>{fieldLabelWithBadge('Clock Out', 'clock_out_time')}</label>
                    <div style={{ position: 'relative' }}>
                      <select value={reviewClockOut} onChange={e => setReviewClockOut(e.target.value)} style={selectStyle}>
                        <option value="">-- select --</option>
                        {TIME_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                      <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: '#6B7280', fontSize: 12 }}>▾</span>
                    </div>
                    {originalValueNote('clock_out_time')}
                  </div>
                </div>
              )}

              {/* Read-only clock times for viewers who can't modify this record (UC50: Employee/
                  Casual Worker viewing their own; also a Manager viewing their own or a peer
                  Manager's — still gets the "M" badge + Original note like the editable view. */}
              {!canEditReviewRecord && reviewRecord.record && (
                <div style={{ padding: '14px 0', borderBottom: '1px solid #F3F4F6', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={{ ...modalLabelStyle, marginBottom: 4 }}>{fieldLabelWithBadge('Clock In', 'clock_in_time')}</label>
                    <p style={{ fontSize: '0.9375rem', color: '#111827', margin: 0, fontFamily: "'Inter', system-ui, -apple-system, sans-serif" }}>{fmtClockStamp(reviewRecord.record.owner_adjusted_clock_in_time ?? reviewRecord.record.clock_in_time)}</p>
                    {originalValueNote('clock_in_time')}
                  </div>
                  <div>
                    <label style={{ ...modalLabelStyle, marginBottom: 4 }}>{fieldLabelWithBadge('Clock Out', 'clock_out_time')}</label>
                    <p style={{ fontSize: '0.9375rem', color: '#111827', margin: 0, fontFamily: "'Inter', system-ui, -apple-system, sans-serif" }}>{fmtClockStamp(reviewRecord.record.owner_adjusted_clock_out_time ?? reviewRecord.record.clock_out_time)}</p>
                    {originalValueNote('clock_out_time')}
                  </div>
                </div>
              )}

              {/* Editable break pair — same picker UI as Clock In/Out (UC56 direct modification). */}
              {canEditReviewRecord && reviewRecord.record && (
                <div style={{ padding: '14px 0', borderBottom: '1px solid #F3F4F6', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={{ ...modalLabelStyle, marginBottom: 6 }}>{fieldLabelWithBadge('Break In', 'break_in_time')}</label>
                    <div style={{ position: 'relative' }}>
                      <select value={reviewBreakIn} onChange={e => setReviewBreakIn(e.target.value)} style={selectStyle}>
                        <option value="">-- select --</option>
                        {TIME_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                      <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: '#6B7280', fontSize: 12 }}>▾</span>
                    </div>
                    {originalValueNote('break_in_time')}
                  </div>
                  <div>
                    <label style={{ ...modalLabelStyle, marginBottom: 6 }}>{fieldLabelWithBadge('Break Out', 'break_out_time')}</label>
                    <div style={{ position: 'relative' }}>
                      <select value={reviewBreakOut} onChange={e => setReviewBreakOut(e.target.value)} style={selectStyle}>
                        <option value="">-- select --</option>
                        {TIME_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                      <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: '#6B7280', fontSize: 12 }}>▾</span>
                    </div>
                    {originalValueNote('break_out_time')}
                  </div>
                </div>
              )}

              {/* Read-only break pair for viewers who can't modify this record — still gets the
                  "M" badge + Original note like the editable view. Only if a break exists to show. */}
              {!canEditReviewRecord && reviewRecord.record && reviewRecord.record.break_in_time && (
                <div style={{ padding: '14px 0', borderBottom: '1px solid #F3F4F6', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={{ ...modalLabelStyle, marginBottom: 4 }}>{fieldLabelWithBadge('Break In', 'break_in_time')}</label>
                    <p style={{ fontSize: '0.9375rem', color: '#111827', margin: 0, fontFamily: "'Inter', system-ui, -apple-system, sans-serif" }}>{fmtClockStamp(reviewRecord.record.break_in_time)}</p>
                    {originalValueNote('break_in_time')}
                  </div>
                  <div>
                    <label style={{ ...modalLabelStyle, marginBottom: 4 }}>{fieldLabelWithBadge('Break Out', 'break_out_time')}</label>
                    <p style={{ fontSize: '0.9375rem', color: '#111827', margin: 0, fontFamily: "'Inter', system-ui, -apple-system, sans-serif" }}>{fmtClockStamp(reviewRecord.record.break_out_time)}</p>
                    {originalValueNote('break_out_time')}
                  </div>
                </div>
              )}

              {/* The reason behind the record's current modification — read-only until the user
                  touches a time again, at which point it hands off to the editable box below.
                  Shown to any viewer (not just whoever can edit) so e.g. a Manager can see why
                  Owner/Partner corrected their own record, even though they can't edit it further. */}
              {reviewRecord.record && showReadOnlyReason && (
                <div style={{ padding: '14px 0', borderBottom: '1px solid #F3F4F6' }}>
                  <label style={{ ...modalLabelStyle, marginBottom: 4 }}>Reason</label>
                  <p style={{ fontSize: '0.9375rem', color: '#111827', margin: 0, fontFamily: "'Inter', system-ui, -apple-system, sans-serif", whiteSpace: 'pre-wrap' }}>
                    {reviewRecord.record.owner_notes || '—'}
                  </p>
                </div>
              )}

              {/* Only appears once a time change actually nets out different from the true
                  original — reason is mandatory whenever a time is genuinely corrected (server
                  also enforces this), so anyone reviewing the record later (Owner/Partner
                  "Modified By" field) knows why. A revert back to the true original needs no
                  reason at all, so this doesn't appear for that case (see willBeModified above). */}
              {canEditReviewRecord && reviewRecord.record && showEditableReason && (
                <div style={{ padding: '14px 0', borderBottom: '1px solid #F3F4F6' }}>
                  <label style={{ ...modalLabelStyle, marginBottom: 6 }}>Reason</label>
                  <textarea
                    value={reviewReason}
                    onChange={e => setReviewReason(e.target.value)}
                    placeholder="Why is this time being changed?"
                    rows={2}
                    style={{ ...selectStyle, height: 'auto', padding: '8px 10px', resize: 'vertical', fontFamily: 'inherit' }}
                  />
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
                    padding: '7px 18px', border: 'none', borderRadius: 8,
                    background: cwWorkerStatus === 'active' ? 'linear-gradient(135deg, #EF4444, #DC2626)' : 'linear-gradient(135deg, #10B981, #059669)',
                    color: '#FFFFFF', fontSize: '0.8125rem', fontWeight: 600,
                    cursor: cwStatusLoading ? 'default' : 'pointer', opacity: cwStatusLoading ? 0.6 : 1,
                    display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center', flexShrink: 0,
                  }}
                >
                  {cwWorkerStatus === 'active'
                    ? <><X size={13} strokeWidth={2.5} /> Inactive</>
                    : <><Check size={13} strokeWidth={2.5} /> Active</>}
                </button>
              )}
              {canEditReviewRecord && reviewRecord.record && (
                <div style={{ marginLeft: 'auto' }}>
                  <button onClick={submitReview} disabled={reviewActionLoading || !hasTimeChanges} style={modalPrimaryButtonStyle(reviewActionLoading || !hasTimeChanges)}>
                    {reviewActionLoading ? <Spinner size={13} /> : <Check size={13} />} Save
                  </button>
                </div>
              )}
            </div>
          </ModalBox>
        </ModalOverlay>
        )
      })()}

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

      {/* ── Off Day Settings modal — opened from the gear button in the Off Day Request block header. ── */}
      {offDaySettingsOpen && (
        <ModalOverlay onClose={() => { setOffDaySettingsOpen(false); void loadOffDaySettings(true) }} maxWidth="480px">
          <ModalBox>
            <ModalHeader title="Off Day Settings" icon={<Settings size={15} color="#fff" strokeWidth={2.5} />} onClose={() => { setOffDaySettingsOpen(false); void loadOffDaySettings(true) }} />
            <div style={{ padding: '20px 24px 24px', maxHeight: '70vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 24 }}>
                {offDaySettingsError && (
                  <div style={{ padding: '10px 12px', borderRadius: 10, background: '#FEF2F2', border: '1px solid #FECACA', color: '#B91C1C', fontSize: 12, fontWeight: 700 }}>{offDaySettingsError}</div>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#374151', margin: '0 0 6px' }}>Manager Off Days</label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, border: '1.5px solid #E5E7EB', borderRadius: 8, minHeight: 40, padding: '10px 12px', background: '#FFFFFF', boxSizing: 'border-box', cursor: 'text' }}>
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
                    </label>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#374151', margin: '0 0 6px' }}>Employee Off Days</label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, border: '1.5px solid #E5E7EB', borderRadius: 8, minHeight: 40, padding: '10px 12px', background: '#FFFFFF', boxSizing: 'border-box', cursor: 'text' }}>
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
                    </label>
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

                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <button onClick={() => void saveCompanyDefaultAndDeadline()} disabled={offDaySettingsSaving || offDaySettingsLoading} style={modalPrimaryButtonStyle(offDaySettingsSaving || offDaySettingsLoading)}>
                      {offDaySettingsSaving ? <Spinner size={13} /> : <Check size={14} />}
                      Save
                    </button>
                  </div>
                </div>
            </div>
          </ModalBox>
        </ModalOverlay>
      )}

      {swapSettingsOpen && (
        <ModalOverlay onClose={() => { setSwapSettingsOpen(false); void loadSwapSettings(true) }} maxWidth="480px">
          <ModalBox>
            <ModalHeader title="Shift Swap Settings" icon={<Settings size={15} color="#fff" strokeWidth={2.5} />} onClose={() => { setSwapSettingsOpen(false); void loadSwapSettings(true) }} />
            <div style={{ padding: '20px 24px 24px', maxHeight: '70vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 24 }}>
              {swapSettingsError && (
                <div style={{ padding: '10px 12px', borderRadius: 10, background: '#FEF2F2', border: '1px solid #FECACA', color: '#B91C1C', fontSize: 12, fontWeight: 700 }}>{swapSettingsError}</div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#374151', margin: '0 0 6px' }}>Monthly Swap Limit / Person</label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, border: '1.5px solid #E5E7EB', borderRadius: 8, minHeight: 40, padding: '10px 12px', background: '#FFFFFF', boxSizing: 'border-box', cursor: 'text' }}>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={swapMonthlyLimit ?? ''}
                      placeholder="No limit"
                      onChange={e => {
                        const digits = e.target.value.replace(/\D/g, '')
                        setSwapMonthlyLimit(digits === '' ? null : Math.max(1, Number(digits)))
                      }}
                      style={{ width: `${String(swapMonthlyLimit ?? 'No limit').length}ch`, minWidth: 10, border: 'none', outline: 'none', padding: 0, fontSize: '0.9375rem', color: '#111827', background: 'transparent' }}
                    />
                    <span style={{ fontSize: '0.9375rem', color: '#111827' }}>swap</span>
                  </label>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#374151', margin: '0 0 6px' }}>Swap Deadline</label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, border: '1.5px solid #E5E7EB', borderRadius: 8, minHeight: 40, padding: '10px 12px', background: '#FFFFFF', boxSizing: 'border-box', cursor: 'text' }}>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={swapDeadlineHours ?? ''}
                      placeholder="No deadline"
                      onChange={e => {
                        const digits = e.target.value.replace(/\D/g, '')
                        setSwapDeadlineHours(digits === '' ? null : Math.max(1, Number(digits)))
                      }}
                      style={{ width: `${String(swapDeadlineHours ?? 'No deadline').length}ch`, minWidth: 10, border: 'none', outline: 'none', padding: 0, fontSize: '0.9375rem', color: '#111827', background: 'transparent' }}
                    />
                    <span style={{ fontSize: '0.9375rem', color: '#111827' }}>hours before shift</span>
                  </label>
                </div>

                <div style={{ borderTop: '1px solid #E5E7EB', paddingTop: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={swapAutoApprovalEnabled}
                      onChange={e => setSwapAutoApprovalEnabled(e.target.checked)}
                      style={{ width: 16, height: 16, accentColor: '#F97316', cursor: 'pointer' }}
                    />
                    <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#111827' }}>Auto Approval</span>
                  </label>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#374151', margin: '0 0 6px' }}>Monthly Limit Exceeded</label>
                    <DropdownField
                      value={swapReviewOnLimitExceeded ? 'review' : 'reject'}
                      onChange={v => setSwapReviewOnLimitExceeded(v === 'review')}
                      options={[{ value: 'review', label: 'Send to Owner/Partner' }, { value: 'reject', label: 'Auto Reject' }]}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#374151', margin: '0 0 6px' }}>Submitted After Deadline</label>
                    <DropdownField
                      value={swapReviewOnDeadlineExceeded ? 'review' : 'reject'}
                      onChange={v => setSwapReviewOnDeadlineExceeded(v === 'review')}
                      options={[{ value: 'review', label: 'Send to Owner/Partner' }, { value: 'reject', label: 'Auto Reject' }]}
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button onClick={() => void saveSwapSettings()} disabled={swapSettingsSaving || swapSettingsLoading} style={modalPrimaryButtonStyle(swapSettingsSaving || swapSettingsLoading)}>
                    {swapSettingsSaving ? <Spinner size={13} /> : <Check size={14} />}
                    Save
                  </button>
                </div>
              </div>
            </div>
          </ModalBox>
        </ModalOverlay>
      )}

      {managerSwapSettingsOpen && (
        <ModalOverlay onClose={() => setManagerSwapSettingsOpen(false)} maxWidth="480px">
          <ModalBox>
            <ModalHeader title="Shift Swap Settings" icon={<Settings size={15} color="#fff" strokeWidth={2.5} />} onClose={() => setManagerSwapSettingsOpen(false)} />
            <div style={{ padding: '20px 24px 24px', maxHeight: '70vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 24 }}>
              {managerSwapSettingsError && (
                <div style={{ padding: '10px 12px', borderRadius: 10, background: '#FEF2F2', border: '1px solid #FECACA', color: '#B91C1C', fontSize: 12, fontWeight: 700 }}>{managerSwapSettingsError}</div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {/* Only shown when the Manager manages more than one department — each department
                    gets its own independent settings row, never shared across departments. */}
                {managerSwapDepartments.length > 1 && (
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#374151', margin: '0 0 6px' }}>Department</label>
                    <DropdownField
                      value={managerSwapDeptId ?? ''}
                      onChange={v => setManagerSwapDeptId(v)}
                      options={managerSwapDepartments.map(d => ({ value: d.department_id, label: d.department_name }))}
                    />
                  </div>
                )}

                <div>
                  <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#374151', margin: '0 0 6px' }}>Monthly Swap Limit / Person</label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, border: '1.5px solid #E5E7EB', borderRadius: 8, minHeight: 40, padding: '10px 12px', background: '#FFFFFF', boxSizing: 'border-box', cursor: 'text' }}>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={managerSwapMonthlyLimit ?? ''}
                      placeholder="No limit"
                      onChange={e => {
                        const digits = e.target.value.replace(/\D/g, '')
                        setManagerSwapMonthlyLimit(digits === '' ? null : Math.max(1, Number(digits)))
                      }}
                      style={{ width: `${String(managerSwapMonthlyLimit ?? 'No limit').length}ch`, minWidth: 10, border: 'none', outline: 'none', padding: 0, fontSize: '0.9375rem', color: '#111827', background: 'transparent' }}
                    />
                    <span style={{ fontSize: '0.9375rem', color: '#111827' }}>swap</span>
                  </label>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#374151', margin: '0 0 6px' }}>Swap Deadline</label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, border: '1.5px solid #E5E7EB', borderRadius: 8, minHeight: 40, padding: '10px 12px', background: '#FFFFFF', boxSizing: 'border-box', cursor: 'text' }}>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={managerSwapDeadlineHours ?? ''}
                      placeholder="No deadline"
                      onChange={e => {
                        const digits = e.target.value.replace(/\D/g, '')
                        setManagerSwapDeadlineHours(digits === '' ? null : Math.max(1, Number(digits)))
                      }}
                      style={{ width: `${String(managerSwapDeadlineHours ?? 'No deadline').length}ch`, minWidth: 10, border: 'none', outline: 'none', padding: 0, fontSize: '0.9375rem', color: '#111827', background: 'transparent' }}
                    />
                    <span style={{ fontSize: '0.9375rem', color: '#111827' }}>hours before shift</span>
                  </label>
                </div>

                <div style={{ borderTop: '1px solid #E5E7EB', paddingTop: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={managerSwapAutoApprovalEnabled}
                      onChange={e => setManagerSwapAutoApprovalEnabled(e.target.checked)}
                      style={{ width: 16, height: 16, accentColor: '#F97316', cursor: 'pointer' }}
                    />
                    <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#111827' }}>Auto Approval</span>
                  </label>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#374151', margin: '0 0 6px' }}>Monthly Limit Exceeded</label>
                    <DropdownField
                      value={managerSwapReviewOnLimitExceeded ? 'review' : 'reject'}
                      onChange={v => setManagerSwapReviewOnLimitExceeded(v === 'review')}
                      options={[{ value: 'review', label: 'Send to Manager' }, { value: 'reject', label: 'Auto Reject' }]}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#374151', margin: '0 0 6px' }}>Submitted After Deadline</label>
                    <DropdownField
                      value={managerSwapReviewOnDeadlineExceeded ? 'review' : 'reject'}
                      onChange={v => setManagerSwapReviewOnDeadlineExceeded(v === 'review')}
                      options={[{ value: 'review', label: 'Send to Manager' }, { value: 'reject', label: 'Auto Reject' }]}
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button onClick={() => void saveManagerSwapSettings()} disabled={managerSwapSettingsSaving || managerSwapSettingsLoading || !managerSwapDeptId} style={modalPrimaryButtonStyle(managerSwapSettingsSaving || managerSwapSettingsLoading || !managerSwapDeptId)}>
                    {managerSwapSettingsSaving ? <Spinner size={13} /> : <Check size={14} />}
                    Save
                  </button>
                </div>
              </div>
            </div>
          </ModalBox>
        </ModalOverlay>
      )}

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

      {/* Reject Shift Swap — Owner/Partner must record why, so it's stored as owner_review_reason
          and shown to the requester / Completed Requests list. */}
      {rejectSwapTarget && (
        <ModalOverlay onClose={() => { setRejectSwapTarget(null); setRejectSwapReason(''); setRejectSwapError('') }} maxWidth="420px">
          <ModalBox>
            <ModalHeader
              title="Reject Shift Swap"
              icon={<X size={15} color="#fff" strokeWidth={2.5} />}
              onClose={() => { setRejectSwapTarget(null); setRejectSwapReason(''); setRejectSwapError('') }}
            />
            <div style={{ padding: '20px 24px 20px' }}>
              <label style={{ ...modalLabelStyle, marginBottom: 10 }}>Reason for {rejectSwapTarget.requesterName}</label>
              <textarea
                autoFocus
                value={rejectSwapReason}
                onChange={e => { setRejectSwapReason(e.target.value); if (rejectSwapError) setRejectSwapError('') }}
                placeholder="Explain why this swap is being rejected..."
                rows={4}
                style={{ ...modalInputStyle, resize: 'vertical', fontFamily: 'inherit' }}
              />
            </div>
            {rejectSwapError && <div style={modalErrorBoxStyle}>{rejectSwapError}</div>}
            <div style={{ padding: '12px 24px 20px', display: 'flex', justifyContent: 'flex-end', gap: 8, borderTop: '1px solid #F3F4F6' }}>
              <button type="button" onClick={() => { setRejectSwapTarget(null); setRejectSwapReason(''); setRejectSwapError('') }} disabled={reqActionLoading} style={modalGhostButtonStyle}>Cancel</button>
              <button type="button" onClick={() => void confirmRejectSwap()} disabled={reqActionLoading || !rejectSwapReason.trim()} style={modalDestructiveButtonStyle(reqActionLoading || !rejectSwapReason.trim())}>
                {reqActionLoading ? <Spinner size={13} /> : <X size={13} />} Reject
              </button>
            </div>
          </ModalBox>
        </ModalOverlay>
      )}

      <Toast message={successToast} />
      <Toast message={errorToast} variant="error" />
    </div>
  )
}
