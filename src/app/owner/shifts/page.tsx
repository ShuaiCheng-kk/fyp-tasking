'use client'

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import {
  AlertTriangle,
  CalendarDays,
  Check,
  CheckCheck,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  MessageCircle,
  MoreHorizontal,
  Pencil,
  Plus,
  GripVertical,
  Sparkles,
  Trash2,
  Upload,
  Users,
  UserCog,
  UserRound,
  X,
  Crown,
} from 'lucide-react'
import { createBrowserClient } from '@supabase/ssr'
import OwnerSidebar from '@/components/OwnerSidebar'
import OwnerPlanBadge from '@/components/owner/PlanBadge'
import OwnerUserBadge from '@/components/owner/OwnerUserBadge'
import { deptColor, setDeptColorOverrides } from '@/lib/deptColor'
import { TimelineRow, TimelineShiftBlock } from '@/types/Timeline'
import { AiShiftSlot, ShiftTypeInput } from '@/types/SchedulingRule'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

type Department = {
  id: string
  name: string
  company_id?: string
  color?: string | null
  created_at?: string
}

type TeamMember = {
  id: string
  full_name: string
  role: string
  department_id: string | null
  profile_photo_url?: string | null
}

type Company = {
  id: string
  name: string
  plan: string
}

type UserProfileSummary = {
  user_id: string
  full_name: string
  role: string
  weekly_working_hours: number
  max_weekly_hours: number
  contracted_weekly_hours: number
  fixed_off_days: number[]
  leave_requests: Array<{ id: string; request_type: string; reason: string | null; status: string; created_at: string }>
}

type DepartmentManagerAssignment = {
  department_id: string
  manager_id: string
  manager_name: string
}

type BatchCell = {
  user_id: string
  shift_date: string
  start_time: string
  end_time: string
  enabled: boolean
}

type BulkFailure = {
  user_id: string
  shift_date: string
  start_time: string
  end_time: string
  message: string
}

type ShiftEditForm = {
  shift_date: string
  start_time: string
  end_time: string
  assigned_user_id: string
  department_id: string
  acceptance_deadline_at: string
}

type DepartmentModalMode = 'add' | 'edit' | 'delete' | null

type AutoShiftBlock = {
  key: string
  department_id: string
  department_name: string
  shift_date: string
  slots: AiShiftSlot[]
  warning: string | null
}

type AiScheduleViolation = {
  rule_name: string
  message: string
}


const TIME_OPTIONS: { value: string; label: string }[] = (() => {
  const opts: { value: string; label: string }[] = []
  for (let h = 0; h < 24; h++) {
    for (const m of [0, 30]) {
      const hh = String(h).padStart(2, '0')
      const mm = String(m).padStart(2, '0')
      const ampm = h < 12 ? 'AM' : 'PM'
      const displayH = h === 0 ? 12 : h > 12 ? h - 12 : h
      opts.push({ value: `${hh}:${mm}`, label: `${displayH}:${mm} ${ampm}` })
    }
  }
  return opts
})()

const APP_BG = '#F1F5F9'
const OWNER_ORANGE = '#F97316'
const _PANEL_BORDER_PICKER = '#E2E8F0'
const _TEXT_DARK_PICKER = '#0F172A'
const _MUTED_PICKER = '#64748B'
const MEMBER_NAME_STYLE = {
  fontSize: '0.9375rem',
  fontWeight: 600,
  color: '#111827',
} as const
const DEPARTMENT_NAME_STYLE = {
  fontSize: '0.9375rem',
  fontWeight: 600,
  color: '#374151',
  lineHeight: 1.2,
} as const
const SECTION_TITLE_STYLE = {
  fontSize: 18,
  fontWeight: 700,
  color: '#0F172A',
  letterSpacing: '-0.2px',
  lineHeight: 1.2,
} as const

function TimePicker({ value, onChange, compact = false }: { value: string; onChange: (v: string) => void; compact?: boolean }) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0 })
  const triggerRef = useRef<HTMLButtonElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const hNum = parseInt(value.split(':')[0] ?? '0')
  const mNum = parseInt(value.split(':')[1] ?? '0')
  const derivedAmpm: 'AM' | 'PM' = hNum < 12 ? 'AM' : 'PM'
  const [meridiem, setMeridiem] = useState<'AM' | 'PM'>(derivedAmpm)

  useEffect(() => {
    setMeridiem(parseInt(value.split(':')[0]) < 12 ? 'AM' : 'PM')
  }, [value])

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (
        triggerRef.current?.contains(e.target as Node) ||
        dropdownRef.current?.contains(e.target as Node)
      ) return
      setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  useEffect(() => {
    if (open && listRef.current) {
      const sel = listRef.current.querySelector('[data-selected="true"]') as HTMLElement | null
      if (sel) sel.scrollIntoView({ block: 'center' })
    }
  }, [open, meridiem])

  const handleOpen = () => {
    if (triggerRef.current) {
      const r = triggerRef.current.getBoundingClientRect()
      const DROPDOWN_H = 212
      const fitsBelow = r.bottom + DROPDOWN_H + 8 <= window.innerHeight
      setPos({
        top: fitsBelow ? r.bottom + 4 : r.top - DROPDOWN_H - 4,
        left: r.left,
        width: r.width,
      })
    }
    setOpen(o => !o)
  }

  const displayH = hNum === 0 ? 12 : hNum > 12 ? hNum - 12 : hNum
  const displayLabel = `${displayH}:${String(mNum).padStart(2, '0')} ${derivedAmpm}`

  const times = useMemo(() => {
    const res: { value: string; label: string }[] = []
    const startH = meridiem === 'AM' ? 0 : 12
    const endH = meridiem === 'AM' ? 12 : 24
    for (let h = startH; h < endH; h++) {
      for (const m of [0, 30]) {
        const hh = String(h).padStart(2, '0')
        const mm = String(m).padStart(2, '0')
        const dh = h === 0 ? 12 : h > 12 ? h - 12 : h
        res.push({ value: `${hh}:${mm}`, label: `${dh}:${mm}` })
      }
    }
    return res
  }, [meridiem])

  const dropdown = open ? (
    <div ref={dropdownRef} style={{
      position: 'fixed', top: pos.top, left: pos.left, zIndex: 9999,
      background: '#FFFFFF', border: `1px solid ${_PANEL_BORDER_PICKER}`,
      borderRadius: 12, boxShadow: '0 8px 28px rgba(15,23,42,0.14)',
      display: 'flex', overflow: 'hidden', minWidth: Math.max(pos.width, 148),
    }}>
      <div ref={listRef} style={{ flex: 1, maxHeight: 192, overflowY: 'auto', padding: '4px 0' }}>
        {times.map(t => {
          const isSel = t.value === value
          return (
            <button key={t.value} type="button" data-selected={isSel ? 'true' : 'false'}
              onClick={() => { onChange(t.value); setOpen(false) }}
              style={{
                display: 'block', width: '100%', padding: '7px 16px', textAlign: 'left',
                border: 'none', background: isSel ? '#FFF7ED' : 'transparent',
                color: isSel ? OWNER_ORANGE : _TEXT_DARK_PICKER,
                fontWeight: isSel ? 700 : 400, fontSize: 13, cursor: 'pointer',
              }}
            >{t.label}</button>
          )
        })}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 6, padding: '8px', borderLeft: `1px solid ${_PANEL_BORDER_PICKER}` }}>
        {(['AM', 'PM'] as const).map(mp => (
          <button key={mp} type="button"
            onClick={() => {
              const [ch, cm] = value.split(':').map(Number)
              let newH = ch
              if (mp === 'AM' && ch >= 12) newH = ch - 12
              if (mp === 'PM' && ch < 12) newH = ch + 12
              onChange(`${String(newH).padStart(2, '0')}:${String(cm).padStart(2, '0')}`)
              setMeridiem(mp)
            }}
            style={{
              borderRadius: 7, border: 'none',
              background: meridiem === mp ? OWNER_ORANGE : '#F1F5F9',
              color: meridiem === mp ? '#FFFFFF' : _TEXT_DARK_PICKER,
              fontWeight: 600, fontSize: 12, padding: '7px 10px', cursor: 'pointer', lineHeight: 1,
            }}
          >{mp}</button>
        ))}
      </div>
    </div>
  ) : null

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <button ref={triggerRef} type="button" onClick={handleOpen}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4,
          border: `1px solid ${_PANEL_BORDER_PICKER}`, borderRadius: 8, background: '#FFFFFF',
          cursor: 'pointer', padding: compact ? '5px 10px' : '8px 12px',
          fontSize: compact ? 12 : 13, fontWeight: 500, color: _TEXT_DARK_PICKER,
          minHeight: compact ? 32 : 38,
        }}
      >
        <span style={{ userSelect: 'none', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{displayLabel}</span>
        <ChevronDown size={compact ? 11 : 12} color={_MUTED_PICKER} style={{ flexShrink: 0 }} />
      </button>
      {typeof document !== 'undefined' && createPortal(dropdown, document.body)}
    </div>
  )
}
const PANEL_BORDER = '#E2E8F0'
const TEXT_DARK = '#0F172A'
const MUTED = '#64748B'

const pageKeyframes = `
  @keyframes overlayFadeIn    { from { opacity: 0 } to { opacity: 1 } }
  @keyframes modalSlideIn     { from { opacity: 0; transform: scale(0.97) translateY(8px) } to { opacity: 1; transform: scale(1) translateY(0) } }
  @keyframes drawerSlideIn    { from { opacity: 0; transform: translateX(24px) } to { opacity: 1; transform: translateX(0) } }
  @keyframes blockSlideUp     { from { opacity: 0; transform: translateY(20px) } to { opacity: 1; transform: translateY(0) } }
  @keyframes blockPopIn       { 0% { opacity: 0; transform: scale(0.93) translateY(10px) } 65% { opacity: 1; transform: scale(1.025) translateY(-2px) } 100% { transform: scale(1) translateY(0) } }
  @keyframes fadeSlideUpToast { from { opacity: 0; transform: translateX(-50%) translateY(10px) } to { opacity: 1; transform: translateX(-50%) translateY(0) } }
  @keyframes fadeSlideUp      { from { opacity: 0; transform: scale(0.97) translateY(8px) } to { opacity: 1; transform: scale(1) translateY(0) } }
  @keyframes cardStagger      { from { opacity: 0; transform: translateY(14px) scale(0.96) } to { opacity: 1; transform: translateY(0) scale(1) } }
  @keyframes deptCardIn       { from { opacity: 0; transform: translateX(-10px) } to { opacity: 1; transform: translateX(0) } }
  @keyframes rowSlideIn       { from { opacity: 0; transform: translateX(-8px) } to { opacity: 1; transform: translateX(0) } }
  @keyframes tabContentIn     { from { opacity: 0; transform: translateY(8px) scale(0.99) } to { opacity: 1; transform: translateY(0) scale(1) } }
  @keyframes shimmer          { 0% { background-position: -400px 0 } 100% { background-position: 400px 0 } }

  .shift-dept-panel  { animation: blockPopIn 0.42s cubic-bezier(0.34,1.56,0.64,1) both 0.05s; }
  .shift-timeline-panel { animation: blockSlideUp 0.38s ease both 0.12s; }
  .shift-dept-card:hover { box-shadow: 0 4px 14px rgba(0,0,0,0.09) !important; transform: translateY(-1px) !important; }
  .member-card       { animation: cardStagger 0.30s ease both; transition: box-shadow 0.18s ease, border-color 0.18s ease; }
  .member-card:hover { box-shadow: 0 3px 10px rgba(0,0,0,0.08); border-color: #FDBA74 !important; }
  .tl-row            { transition: background 0.14s ease; }
  .tl-row:hover      { background: #FAFAFA !important; }
  .tl-name           { transition: color 0.14s ease; }
  .tl-row:hover .tl-name { color: #F97316; }
  .shift-tab-content { animation: tabContentIn 0.22s ease-out both; }
  .people-chip       { transition: box-shadow 0.16s ease, border-color 0.16s ease, transform 0.16s ease; }
  .people-chip:hover:not([data-locked="true"]) { box-shadow: 0 3px 10px rgba(0,0,0,0.08); transform: translateY(-1px); }
  .ai-wizard-back-circle { transition: background 0.14s ease; }
  .ai-wizard-back-circle:hover { background: #EDE9FE; }
`

function formatDateKey(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function normalizeDateInput(value: string): string {
  const trimmed = value.trim().replace(/[^\d/-]/g, '')
  const standardMatch = trimmed.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/)
  if (standardMatch) {
    const [, year, month, day] = standardMatch
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
  }
  const slashMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (slashMatch) {
    const [, month, day, year] = slashMatch
    const normalized = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
    const date = new Date(`${normalized}T00:00:00`)
    if (!Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === normalized) return normalized
  }
  const parsed = new Date(value)
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10)
  return trimmed
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

function prettyDate(dateKey: string): string {
  return new Date(`${dateKey}T00:00:00`).toLocaleDateString('en-AU', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })
}

function shortDate(dateKey: string): string {
  return new Date(`${dateKey}T00:00:00`).toLocaleDateString('en-AU', {
    weekday: 'short',
    day: 'numeric',
  })
}

function formatShiftHour(time: string): string {
  const [h, m] = time.split(':').map(Number)
  const ampm = h < 12 ? 'am' : 'pm'
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h
  return m === 0 ? `${h12}${ampm}` : `${h12}:${String(m).padStart(2, '0')}${ampm}`
}

function previewDateLabel(dateKey: string): string {
  const d = new Date(`${dateKey}T00:00:00`)
  const weekday = d.toLocaleDateString('en-US', { weekday: 'short' })
  const month = d.toLocaleDateString('en-US', { month: 'long' })
  const dayNum = d.getDate()
  return `${weekday}, ${month} ${dayNum}`
}

function TimelineDatePicker({ value, onChange, shiftDates, anchorRef, triggerStyle, minDate: minDateProp, accentColor = OWNER_ORANGE }: {
  value: string
  onChange: (date: string) => void
  shiftDates: Set<string>
  anchorRef?: React.RefObject<HTMLDivElement | null>
  minDate?: string
  triggerStyle?: React.CSSProperties
  accentColor?: string
}) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState({ top: 0, left: 0, width: 292 })
  const [viewMonth, setViewMonth] = useState(value.slice(0, 7))
  const triggerRef = useRef<HTMLButtonElement>(null)
  const popoverRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (triggerRef.current?.contains(e.target as Node) || popoverRef.current?.contains(e.target as Node)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const handleOpen = () => {
    const anchor = anchorRef?.current ?? triggerRef.current
    if (anchor) {
      const r = anchor.getBoundingClientRect()
      const POPOVER_H = 320
      const fitsBelow = r.bottom + POPOVER_H + 8 <= window.innerHeight
      setViewMonth(value.slice(0, 7))
      setPos({ top: fitsBelow ? r.bottom + 6 : r.top - POPOVER_H - 6, left: r.left, width: Math.max(r.width, 292) })
    }
    setOpen(o => !o)
  }

  const todayStr = formatDateKey(new Date())
  const minSelectableStr = minDateProp ?? formatDateKey(addDays(new Date(), -7))
  const [cy, cm] = viewMonth.split('-').map(Number)
  const firstDay = new Date(cy, cm - 1, 1).getDay()
  const daysInMonth = new Date(cy, cm, 0).getDate()
  const monthLabel = new Date(cy, cm - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  const cells: (string | null)[] = []
  for (let i = 0; i < firstDay; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push(`${cy}-${String(cm).padStart(2, '0')}-${String(d).padStart(2, '0')}`)
  }
  const minSelectableMonth = minSelectableStr.slice(0, 7)
  const canGoPrevMonth = viewMonth > minSelectableMonth
  const goPrev = () => { const d = new Date(cy, cm - 2, 1); const nm = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; if (nm < minSelectableMonth) return; setViewMonth(nm) }
  const goNext = () => { const d = new Date(cy, cm, 1); setViewMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`) }

  const displayLabel = new Date(`${value}T00:00:00`).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })

  const popover = open ? (
    <div ref={popoverRef} style={{
      position: 'fixed', top: pos.top, left: pos.left, zIndex: 9999,
      background: '#FFFFFF', border: `1px solid ${PANEL_BORDER}`,
      borderRadius: 16, boxShadow: '0 8px 32px rgba(15,23,42,0.14)',
      padding: '14px 16px', width: pos.width,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <button type="button" onClick={goPrev} disabled={!canGoPrevMonth} style={{ width: 26, height: 26, border: `1px solid ${PANEL_BORDER}`, borderRadius: 7, background: '#FFFFFF', cursor: canGoPrevMonth ? 'pointer' : 'default', display: 'flex', alignItems: 'center', justifyContent: 'center', color: canGoPrevMonth ? '#64748B' : '#D1D5DB' }}><ChevronLeft size={13} /></button>
        <span style={{ fontSize: 13, fontWeight: 600, color: TEXT_DARK }}>{monthLabel}</span>
        <button type="button" onClick={goNext} style={{ width: 26, height: 26, border: `1px solid ${PANEL_BORDER}`, borderRadius: 7, background: '#FFFFFF', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748B' }}><ChevronRight size={13} /></button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', marginBottom: 4 }}>
        {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => (
          <div key={d} style={{ fontSize: 11, fontWeight: 600, color: '#9CA3AF', textAlign: 'center', height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{d}</div>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
        {cells.map((date, i) => {
          if (!date) return <div key={`e-${i}`} style={{ height: 36 }} />
          const isDisabled = date < minSelectableStr
          const isSel = date === value
          const isToday = date === todayStr
          const isPast = date < todayStr
          const hasShift = shiftDates.has(date)
          return (
            <button key={date} type="button" disabled={isDisabled} onClick={() => { if (isDisabled) return; onChange(date); setOpen(false) }}
              style={{
                height: 36, width: '100%', border: isToday && !isSel ? `2px solid ${accentColor}` : 'none',
                borderRadius: 8, background: isSel ? accentColor : 'transparent',
                color: isDisabled ? '#D1D5DB' : isSel ? '#FFFFFF' : isToday ? accentColor : TEXT_DARK,
                fontWeight: isSel || isToday ? 700 : 400, fontSize: 13, cursor: isDisabled ? 'default' : 'pointer',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2, padding: 0,
                position: 'relative',
              }}
              onMouseEnter={e => { if (!isSel && !isDisabled) e.currentTarget.style.background = '#F8FAFC' }}
              onMouseLeave={e => { if (!isSel && !isDisabled) e.currentTarget.style.background = 'transparent' }}
            >
              <span style={{ lineHeight: 1 }}>{parseInt(date.split('-')[2])}</span>
              {hasShift && (
                <span style={{ width: 4, height: 4, borderRadius: '50%', background: isPast ? '#94A3B8' : isSel ? 'rgba(255,255,255,0.8)' : accentColor, flexShrink: 0 }} />
              )}
            </button>
          )
        })}
      </div>
    </div>
  ) : null

  return (
    <>
      <button ref={triggerRef} type="button" onClick={handleOpen}
        style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 38, padding: '0 12px', border: `1px solid ${PANEL_BORDER}`, borderRadius: 9, background: '#FFFFFF', cursor: 'pointer', fontSize: 13, fontWeight: 500, color: TEXT_DARK, minWidth: 140, fontFamily: 'var(--font-body), system-ui, sans-serif', ...triggerStyle }}
      >
        <CalendarDays size={14} color="#64748B" style={{ flexShrink: 0 }} />
        <span>{displayLabel}</span>
      </button>
      {typeof document !== 'undefined' && createPortal(popover, document.body)}
    </>
  )
}

function InlineDatePicker({ value, onChange, shiftDates }: {
  value: string
  onChange: (date: string) => void
  shiftDates: Set<string>
}) {
  const todayStr = formatDateKey(new Date())
  const todayMonth = todayStr.slice(0, 7)
  const [viewMonth, setViewMonth] = useState(value.slice(0, 7))

  useEffect(() => { setViewMonth(value.slice(0, 7)) }, [value])

  const [cy, cm] = viewMonth.split('-').map(Number)
  const firstDay = new Date(cy, cm - 1, 1).getDay()
  const daysInMonth = new Date(cy, cm, 0).getDate()
  const monthLabel = new Date(cy, cm - 1, 1).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })

  const cells: (string | null)[] = []
  for (let i = 0; i < firstDay; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push(`${cy}-${String(cm).padStart(2, '0')}-${String(d).padStart(2, '0')}`)
  }

  const canGoPrevMonth = viewMonth > todayMonth
  const goPrev = () => {
    const d = new Date(cy, cm - 2, 1)
    const nm = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    if (nm < todayMonth) return
    setViewMonth(nm)
  }
  const goNext = () => {
    const d = new Date(cy, cm, 1)
    setViewMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }

  return (
    <div style={{ border: `1px solid ${PANEL_BORDER}`, borderRadius: 10, padding: '8px 10px', background: '#FFFFFF' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <button type="button" onClick={goPrev} disabled={!canGoPrevMonth}
          style={{ width: 22, height: 22, border: `1px solid ${PANEL_BORDER}`, borderRadius: 6, background: '#fff', cursor: canGoPrevMonth ? 'pointer' : 'default', display: 'flex', alignItems: 'center', justifyContent: 'center', color: canGoPrevMonth ? '#64748B' : '#D1D5DB', padding: 0 }}>
          <ChevronLeft size={11} />
        </button>
        <span style={{ fontSize: 12, fontWeight: 600, color: TEXT_DARK }}>{monthLabel}</span>
        <button type="button" onClick={goNext}
          style={{ width: 22, height: 22, border: `1px solid ${PANEL_BORDER}`, borderRadius: 6, background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748B', padding: 0 }}>
          <ChevronRight size={11} />
        </button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', marginBottom: 2 }}>
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
          <div key={i} style={{ fontSize: 10, fontWeight: 600, color: '#9CA3AF', textAlign: 'center', height: 18, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{d}</div>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 1 }}>
        {cells.map((date, i) => {
          if (!date) return <div key={`e-${i}`} style={{ height: 28 }} />
          const isPast = date < todayStr
          if (isPast) return <div key={date} style={{ height: 28 }} />
          const isSel = date === value
          const isToday = date === todayStr
          const hasShift = shiftDates.has(date)
          return (
            <button key={date} type="button" onClick={() => onChange(date)}
              style={{
                height: 28, width: '100%', border: isToday && !isSel ? `2px solid ${OWNER_ORANGE}` : 'none',
                borderRadius: 6, background: isSel ? OWNER_ORANGE : 'transparent',
                color: isSel ? '#FFFFFF' : isToday ? OWNER_ORANGE : TEXT_DARK,
                fontWeight: isSel || isToday ? 700 : 400, fontSize: 11, cursor: 'pointer',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 1, padding: 0,
              }}
              onMouseEnter={e => { if (!isSel) e.currentTarget.style.background = '#F1F5F9' }}
              onMouseLeave={e => { if (!isSel) e.currentTarget.style.background = 'transparent' }}
            >
              <span style={{ lineHeight: 1 }}>{parseInt(date.split('-')[2])}</span>
              {hasShift && (
                <span style={{ width: 3, height: 3, borderRadius: '50%', background: isSel ? 'rgba(255,255,255,0.8)' : OWNER_ORANGE, flexShrink: 0 }} />
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function timeAgo(ts: string): string {
  const diff = Math.floor((Date.now() - new Date(ts).getTime()) / 1000)
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

function timeToMinutes(timeStr: string): number {
  const [h, m] = timeStr.split(':').map(Number)
  return h * 60 + (m || 0)
}

function formatHourLabel(hour: number): string {
  if (hour === 0 || hour === 24) return '12am'
  if (hour === 12) return '12pm'
  return hour < 12 ? `${hour}am` : `${hour - 12}pm`
}

function parseDepartmentImportCsv(text: string): string[] {
  const lines = text.split(/\r?\n/).map(line => line.trim()).filter(Boolean)
  const withoutHeader = lines[0]?.toLowerCase().includes('department') ? lines.slice(1) : lines
  return [...new Set(withoutHeader.map(line => line.split(',')[0]?.trim()).filter(Boolean))]
}

function roleRank(role: string): number {
  if (role === 'Manager') return 0
  if (role === 'Employee') return 1
  return 2
}

function buildDateRangeKeys(from: string, to: string): string[] {
  if (!from || !to) return []
  const start = new Date(`${from}T00:00:00`)
  const end = new Date(`${to}T00:00:00`)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) return []
  const dates: string[] = []
  const cursor = new Date(start)
  while (cursor <= end) {
    dates.push(formatDateKey(cursor))
    cursor.setDate(cursor.getDate() + 1)
  }
  return dates
}


function Spinner({ size = 16, dark = false }: { size?: number; dark?: boolean }) {
  return (
    <svg className="animate-spin" width={size} height={size} viewBox="0 0 18 18" style={{ display: 'inline-block', flexShrink: 0 }}>
      <circle cx="9" cy="9" r="7" stroke={dark ? 'rgba(15,23,42,0.18)' : 'rgba(255,255,255,0.35)'} strokeWidth="2.5" fill="none" />
      <path d="M9 2a7 7 0 0 1 7 7" stroke={dark ? '#0F172A' : 'white'} strokeWidth="2.5" strokeLinecap="round" fill="none" />
    </svg>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  minHeight: 40,
  padding: '9px 11px',
  border: `1px solid ${PANEL_BORDER}`,
  borderRadius: 8,
  background: '#FFFFFF',
  color: TEXT_DARK,
  fontSize: 13,
  outline: 'none',
  boxSizing: 'border-box',
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  marginBottom: 6,
  color: '#334155',
  fontSize: 12,
  fontWeight: 600,
}

const EMPTY_DATE_SET = new Set<string>()

const modalLabelStyle: React.CSSProperties = {
  display: 'block',
  fontWeight: 600,
  fontSize: '0.875rem',
  color: '#374151',
  marginBottom: '8px',
}

const modalInputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  border: '1.5px solid #E5E7EB',
  borderRadius: 8,
  fontSize: '0.9375rem',
  fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
  fontWeight: 400,
  color: '#111827',
  outline: 'none',
  boxSizing: 'border-box',
  background: '#FFFFFF',
}

export default function OwnerShiftsPage() {
  const router = useRouter()
  const timelineControlsRef = useRef<HTMLDivElement>(null)
  const tomorrow = useMemo(() => addDays(new Date(), 1), [])
  const minDate = useMemo(() => {
    // Floor = Monday of the week that contains (today - 7 days)
    const d = addDays(new Date(), -7)
    const dow = (d.getDay() + 6) % 7  // 0=Mon … 6=Sun
    return formatDateKey(addDays(d, -dow))
  }, [])
  const dateOptions = useMemo(() => Array.from({ length: 30 }, (_, index) => formatDateKey(addDays(tomorrow, index))), [tomorrow])
  const maxDate = dateOptions[dateOptions.length - 1]

  const [initialReady, setInitialReady] = useState(false)
  const [authUserId, setAuthUserId] = useState('')
  const [internalUserId, setInternalUserId] = useState('')
  const [ownerName, setOwnerName] = useState('Owner')
  const [companyId, setCompanyId] = useState('')
  const [company, setCompany] = useState<Company | null>(null)
  const [companies, setCompanies] = useState<Company[]>([])
  const [dropdownOpen, setDropdownOpen] = useState(false)

  const [departments, setDepartments] = useState<Department[]>([])
  const [members, setMembers] = useState<TeamMember[]>([])
  const [departmentManagers, setDepartmentManagers] = useState<DepartmentManagerAssignment[]>([])
  const [assignmentDataLoading, setAssignmentDataLoading] = useState(false)
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<string | null>(null)
  const [departmentOrder, setDepartmentOrder] = useState<string[]>([])
  const [draggingDepartmentId, setDraggingDepartmentId] = useState<string | null>(null)
  const [dragOverDepartmentId, setDragOverDepartmentId] = useState<string | null>(null)
  const departmentOrderRef = useRef<string[]>([])
  const deptOrderKey = companyId ? `owner_shift_department_order_${companyId}` : null

  const [timelineRows, setTimelineRows] = useState<TimelineRow[]>([])
  const [futureRows, setFutureRows] = useState<TimelineRow[]>([])
  const [timelineLoading, setTimelineLoading] = useState(false)
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null)
  const [timelineDate, setTimelineDate] = useState(formatDateKey(new Date()))
  const [rangeStartHour, setRangeStartHour] = useState(7)
  const [rangeEndHour, setRangeEndHour] = useState(23)
  const [isAutoFit, setIsAutoFit] = useState(false)
  const [shiftViewMode, setShiftViewMode] = useState<'timeline' | 'calendar'>('timeline')
  const shiftTabBarRef = useRef<HTMLDivElement>(null)
  const shiftTabButtonRefs = useRef<Record<'timeline' | 'calendar', HTMLButtonElement | null>>({ timeline: null, calendar: null })
  const [shiftTabIndicator, setShiftTabIndicator] = useState({ left: 0, width: 0, opacity: 0 })
  const [calWeekRows, setCalWeekRows] = useState<TimelineRow[]>([])
  const [calWeekLoading, setCalWeekLoading] = useState(false)
  const [selectedTimelineUserIds, setSelectedTimelineUserIds] = useState<string[]>([])
  const [timelineBulkDeleting, setTimelineBulkDeleting] = useState(false)
  const [timelineDeleteError, setTimelineDeleteError] = useState('')

  const [openDepartmentMenuId, setOpenDepartmentMenuId] = useState<string | null>(null)
  const [deptMenuPos, setDeptMenuPos] = useState({ top: 0, right: 0 })
  const [departmentModal, setDepartmentModal] = useState<DepartmentModalMode>(null)
  const [departmentModalTab, setDepartmentModalTab] = useState<'manual' | 'import'>('manual')
  const [activeDepartment, setActiveDepartment] = useState<Department | null>(null)
  const [departmentNameInput, setDepartmentNameInput] = useState('')
  const [departmentImportRows, setDepartmentImportRows] = useState<string[]>([])
  const [departmentActionError, setDepartmentActionError] = useState('')
  const [departmentActionResult, setDepartmentActionResult] = useState('')
  const [departmentActionLoading, setDepartmentActionLoading] = useState(false)

  const [managerModalDepartment, setManagerModalDepartment] = useState<Department | null>(null)
  const [selectedManagerId, setSelectedManagerId] = useState('')
  const [managerActionError, setManagerActionError] = useState('')
  const [managerActionLoading, setManagerActionLoading] = useState(false)
  const [managerRemoveLoading, setManagerRemoveLoading] = useState<string | null>(null)

  // AI Shift Scheduling state
  const [aiShiftModal, setAiShiftModal] = useState(false)
  const [aiShiftWizardStep, setAiShiftWizardStep] = useState<'dates' | 'departments' | 'shiftTypes' | 'generate'>('dates')
  const [aiShiftDateFrom, setAiShiftDateFrom] = useState('')
  const [aiShiftDateTo, setAiShiftDateTo] = useState('')
  const [aiShiftTypes, setAiShiftTypes] = useState<ShiftTypeInput[]>([
    { label: 'Shift 1', start_time: '09:00', end_time: '17:00' },
  ])
  const [aiShiftSelectedDepartmentIds, setAiShiftSelectedDepartmentIds] = useState<string[]>([])
  const [aiShiftLoading, setAiShiftLoading] = useState(false)
  const [aiShiftProgress, setAiShiftProgress] = useState(0)
  const [aiShiftEtaSeconds, setAiShiftEtaSeconds] = useState(0)
  const aiShiftProgressTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const [aiShiftError, setAiShiftError] = useState('')
  const [aiShiftNotice, setAiShiftNotice] = useState('')
  const [aiShiftSuggestions, setAiShiftSuggestions] = useState<AutoShiftBlock[]>([])
  const [aiShiftSelected, setAiShiftSelected] = useState<Set<string>>(new Set())
  const [aiShiftCreateLoading, setAiShiftCreateLoading] = useState(false)
  const [aiShiftCreateError, setAiShiftCreateError] = useState('')
  const [aiResultWeekOffset, setAiResultWeekOffset] = useState(0)

  const [batchDepartment, setBatchDepartment] = useState<Department | null>(null)
  const [batchSingleMember, setBatchSingleMember] = useState<TeamMember | null>(null)
  const [batchFromSelection, setBatchFromSelection] = useState(false)
  const [calMonth, setCalMonth] = useState('')
  const [calDir, setCalDir] = useState<'next' | 'prev'>('next')
  const [calKey, setCalKey] = useState(0)
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([])
  const [selectedDates, setSelectedDates] = useState<string[]>([])
  const [defaultStartTime, setDefaultStartTime] = useState('09:00')
  const [defaultEndTime, setDefaultEndTime] = useState('17:00')
  const [batchCells, setBatchCells] = useState<Record<string, BatchCell>>({})
  const [editShiftCalMonth, setEditShiftCalMonth] = useState('')
  const [editShiftCalDir, setEditShiftCalDir] = useState<'next' | 'prev'>('next')
  const [editShiftCalKey, setEditShiftCalKey] = useState(0)
  const [bulkSubmitting, setBulkSubmitting] = useState(false)
  const [bulkError, setBulkError] = useState('')
  const [bulkResult, setBulkResult] = useState('')
  const [bulkFailures, setBulkFailures] = useState<BulkFailure[]>([])
  const [successToast, setSuccessToast] = useState<string | null>(null)
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const aiGenerateAbortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    return () => {
      if (aiShiftProgressTimerRef.current) clearInterval(aiShiftProgressTimerRef.current)
    }
  }, [])

  const profileSummary: UserProfileSummary = {
    user_id: '',
    full_name: '',
    role: '',
    weekly_working_hours: 0,
    max_weekly_hours: 44,
    contracted_weekly_hours: 44,
    fixed_off_days: [],
    leave_requests: [],
  }
  const profileSummaryLoading = false
  const setProfileDrawerUserId = (_value: null) => {}

  const [selectedShift, setSelectedShift] = useState<TimelineShiftBlock | null>(null)
  const [shiftEditForm, setShiftEditForm] = useState<ShiftEditForm>({
    shift_date: minDate,
    start_time: '09:00',
    end_time: '17:00',
    assigned_user_id: '',
    department_id: '',
    acceptance_deadline_at: '',
  })
  const [shiftActionLoading, setShiftActionLoading] = useState(false)
  const [shiftActionError, setShiftActionError] = useState('')

  useEffect(() => {
    return () => {
      aiGenerateAbortRef.current?.abort()
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      let userIdResolved = localStorage.getItem('tasking_user_id')
      if (!userIdResolved) {
        const supabase = createBrowserClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        )
        const { data: { session } } = await supabase.auth.getSession()
        if (session?.user?.id) {
          userIdResolved = session.user.id
          localStorage.setItem('tasking_user_id', userIdResolved)
        }
      }
      if (!userIdResolved) {
        router.replace('/signin')
        return
      }
      if (cancelled) return
      setAuthUserId(userIdResolved)

      fetch(`/api/user/me?user_id=${userIdResolved}`)
        .then(r => r.json())
        .then(data => {
          if (cancelled || !data.success) return
          if (data.user?.full_name) setOwnerName(data.user.full_name)
          if (data.user?.id) setInternalUserId(data.user.id)
        })
        .catch(() => {})

      const storedCid = localStorage.getItem(`tasking_company_id_${userIdResolved}`)
      const qs = new URLSearchParams({ user_id: userIdResolved })
      if (storedCid) qs.set('company_id', storedCid)

      const res = await fetch(`/api/company/current?${qs}`)
      if (!res.ok) {
        if (!cancelled) setInitialReady(true)
        return
      }
      const data = await res.json()
      if (cancelled) return
      if (!data.success) {
        setInitialReady(true)
        return
      }

      const companyList: Company[] = (data.companies ?? []).map((item: Company) => ({ id: item.id, name: item.name, plan: item.plan }))
      setCompanies(companyList)
      const nextCompany: Company | null = data.company ?? companyList[0] ?? null
      if (nextCompany) {
        localStorage.setItem(`tasking_company_id_${userIdResolved}`, nextCompany.id)
        localStorage.setItem(`tasking_last_company_name_${nextCompany.id}`, nextCompany.name)
        setCompanyId(nextCompany.id)
        setCompany(nextCompany)
      }
      setInitialReady(true)
    }
    void run()
    return () => { cancelled = true }
  }, [router])

  useEffect(() => {
    const closeDepartmentMenuOnOutsideClick = (event: PointerEvent) => {
      const target = event.target
      if (target instanceof Element && target.closest('[data-department-menu-root="true"]')) return
      setOpenDepartmentMenuId(null)
    }

    document.addEventListener('pointerdown', closeDepartmentMenuOnOutsideClick)
    return () => document.removeEventListener('pointerdown', closeDepartmentMenuOnOutsideClick)
  }, [])

  const fetchAssignmentData = useCallback(async (cid: string, silent = false) => {
    if (!cid) return
    if (!silent) setAssignmentDataLoading(true)
    try {
      const [deptRes, memberRes, managerRes] = await Promise.all([
        fetch(`/api/company/departments?company_id=${cid}`),
        fetch(`/api/team/members?company_id=${cid}`),
        fetch(`/api/team/department-manager?company_id=${cid}`),
      ])
      const deptData = await deptRes.json()
      const memberData = await memberRes.json()
      const managerData = await managerRes.json()
      if (deptData.success) {
        const nextDepartments: Department[] = (deptData.departments ?? []).sort((a: Department, b: Department) => a.name.localeCompare(b.name))
        setDepartments(nextDepartments)
        setDeptColorOverrides(nextDepartments)
      }
      if (memberData.success) {
        const schedulable = (memberData.members ?? [])
          .filter((member: TeamMember) => ['Manager', 'Employee'].includes(member.role))
          .sort((a: TeamMember, b: TeamMember) => roleRank(a.role) - roleRank(b.role) || a.full_name.localeCompare(b.full_name))
        setMembers(schedulable)
      }
      if (managerData.success) setDepartmentManagers(managerData.assignments ?? [])
    } finally {
      if (!silent) setAssignmentDataLoading(false)
    }
  }, [])

  const fetchTimeline = useCallback(async (cid: string, date: string) => {
    if (!cid || !date) return
    setTimelineLoading(true)
    try {
      const res = await fetch(`/api/shift?company_id=${cid}&date_from=${date}&date_to=${date}`)
      const data = await res.json()
      setTimelineRows(data.success ? data.rows ?? [] : [])
    } finally {
      setTimelineLoading(false)
    }
  }, [])

  const fetchFutureRows = useCallback(async (cid: string) => {
    if (!cid) return
    const res = await fetch(`/api/shift?company_id=${cid}&date_from=${minDate}&date_to=${maxDate}`)
    const data = await res.json()
    setFutureRows(data.success ? data.rows ?? [] : [])
  }, [maxDate, minDate])

  const fetchCalWeek = useCallback(async (cid: string, anchorDate: string) => {
    if (!cid || !anchorDate) return
    setCalWeekLoading(true)
    try {
      const anchor = new Date(`${anchorDate}T00:00:00`)
      const dow = (anchor.getDay() + 6) % 7  // 0=Mon … 6=Sun
      const mon = new Date(anchor); mon.setDate(anchor.getDate() - dow)
      const sun = new Date(mon); sun.setDate(mon.getDate() + 6)
      const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
      const res = await fetch(`/api/shift?company_id=${cid}&date_from=${fmt(mon)}&date_to=${fmt(sun)}`)
      const data = await res.json()
      setCalWeekRows(data.success ? data.rows ?? [] : [])
    } finally {
      setCalWeekLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!companyId || departments.length === 0) return

    const fallbackOrder = departments.map(dept => dept.id)
    let nextOrder = fallbackOrder

    if (deptOrderKey) {
      try {
        const raw = localStorage.getItem(deptOrderKey)
        if (raw) {
          const parsed = JSON.parse(raw)
          if (Array.isArray(parsed)) {
            const saved = parsed.filter((id): id is string => fallbackOrder.includes(id))
            const remaining = fallbackOrder.filter(id => !saved.includes(id))
            nextOrder = [...saved, ...remaining]
          }
        }
      } catch {}
    }

    setDepartmentOrder(nextOrder)
  }, [companyId, departments, deptOrderKey])

  useEffect(() => {
    if (!deptOrderKey || departmentOrder.length === 0) return
    try {
      localStorage.setItem(deptOrderKey, JSON.stringify(departmentOrder))
    } catch {}
  }, [deptOrderKey, departmentOrder])

  useEffect(() => {
    departmentOrderRef.current = departmentOrder
  }, [departmentOrder])

  const refreshShiftData = useCallback(async () => {
    if (!companyId) return
    await Promise.all([
      fetchTimeline(companyId, timelineDate),
      fetchFutureRows(companyId),
      fetchCalWeek(companyId, timelineDate),
    ])
    setLastRefreshed(new Date())
  }, [companyId, fetchCalWeek, fetchFutureRows, fetchTimeline, timelineDate])

  useEffect(() => {
    if (!companyId) return
    void Promise.all([
      fetchAssignmentData(companyId),
      fetchTimeline(companyId, timelineDate),
      fetchFutureRows(companyId),
    ]).then(() => setLastRefreshed(new Date()))
  }, [companyId, fetchAssignmentData, fetchFutureRows, fetchTimeline, timelineDate])

  useEffect(() => {
    if (!companyId || shiftViewMode !== 'calendar') return
    void fetchCalWeek(companyId, timelineDate)
  }, [companyId, shiftViewMode, timelineDate, fetchCalWeek])

  const membersByDepartment = useMemo(() => {
    const map = new Map<string, TeamMember[]>()
    for (const department of departments) map.set(department.id, [])
    for (const member of members) {
      if (!member.department_id) continue
      const group = map.get(member.department_id)
      if (group) group.push(member)
    }
    for (const [key, group] of map) {
      map.set(key, group.sort((a, b) => roleRank(a.role) - roleRank(b.role) || a.full_name.localeCompare(b.full_name)))
    }
    return map
  }, [departments, members])

  const managerOptions = useMemo(() => members.filter(member => member.role === 'Manager'), [members])
  const selectedDepartment = useMemo(
    () => departments.find(department => department.id === selectedDepartmentId) ?? null,
    [departments, selectedDepartmentId],
  )
  const orderedDepartments = useMemo(() => {
    if (departments.length === 0) return []
    const byId = new Map(departments.map(dept => [dept.id, dept] as const))
    const saved = departmentOrder.filter(id => byId.has(id))
    const remaining = departments.map(dept => dept.id).filter(id => !saved.includes(id))
    const orderedIds = saved.length > 0 ? [...saved, ...remaining] : departments.map(dept => dept.id)
    return orderedIds.map(id => byId.get(id)!).filter(Boolean)
  }, [departments, departmentOrder])
  const getDepartmentPeople = useCallback((department: Department): TeamMember[] => {
    const managerIds = new Set(
      departmentManagers
        .filter(item => item.department_id === department.id)
        .map(item => item.manager_id),
    )
    const managers = members
      .filter(member => member.role === 'Manager' && managerIds.has(member.id))
      .sort((a, b) => a.full_name.localeCompare(b.full_name))
    const employees = (membersByDepartment.get(department.id) ?? [])
      .filter(member => member.role === 'Employee')
      .sort((a, b) => a.full_name.localeCompare(b.full_name))
    return [...managers, ...employees]
  }, [departmentManagers, members, membersByDepartment])
  const visibleTimelineRows = useMemo<TimelineRow[]>(() => {
    const rowsByUser = new Map(timelineRows.filter(row => row.user_id).map(row => [row.user_id, row]))
    const people = selectedDepartment ? getDepartmentPeople(selectedDepartment) : members
    return people
      .filter(member => member.role === 'Manager' || member.role === 'Employee')
      .sort((a, b) => roleRank(a.role) - roleRank(b.role) || a.full_name.localeCompare(b.full_name))
      .map(member => {
        const department = departments.find(item => item.id === member.department_id)
        const apiRow = rowsByUser.get(member.id)
        const shifts = selectedDepartment
          ? (apiRow?.shifts ?? []).filter(shift => shift.department_id === selectedDepartment.id)
          : (apiRow?.shifts ?? [])
        return {
          user_id: member.id,
          full_name: member.full_name,
          role: member.role,
          department_id: selectedDepartment?.id ?? member.department_id ?? apiRow?.department_id ?? '',
          department_name: selectedDepartment?.name ?? department?.name ?? apiRow?.department_name ?? 'Unassigned',
          profile_photo_url: member.profile_photo_url ?? null,
          shifts,
        }
      })
  }, [departments, getDepartmentPeople, members, selectedDepartment, timelineRows])
  const timelineIsPast = timelineDate < formatDateKey(new Date())
  const autoFitRange = useMemo(() => {
    const allShifts = visibleTimelineRows.flatMap(r => r.shifts)
    if (allShifts.length === 0) return { from: 7, to: 23 }
    const minMin = Math.min(...allShifts.map(s => timeToMinutes(s.start_time)))
    const maxMin = Math.max(...allShifts.map(s => timeToMinutes(s.end_time)))
    return {
      from: Math.max(0, Math.floor(minMin / 60) - 1),
      to: Math.min(24, Math.ceil(maxMin / 60) + 1),
    }
  }, [visibleTimelineRows])

  const activeDeptIds = useMemo(() => {
    const ids = new Set<string>()
    for (const row of timelineRows) {
      if (row.user_id && row.shifts.length > 0) ids.add(row.department_id)
    }
    return ids
  }, [timelineRows])

  const selectedTimelineRows = useMemo(
    () => timelineIsPast ? [] : visibleTimelineRows.filter(row => row.user_id && selectedTimelineUserIds.includes(row.user_id)),
    [selectedTimelineUserIds, timelineIsPast, visibleTimelineRows],
  )
  const selectedTimelineAssignmentIds = useMemo(() => {
    const ids = new Set<string>()
    for (const row of selectedTimelineRows) {
      for (const shift of row.shifts) {
        if (shift.assignment_id) ids.add(shift.assignment_id)
      }
    }
    return Array.from(ids)
  }, [selectedTimelineRows])

  const selectedMembers = useMemo(
    () => selectedMemberIds
      .map(id => members.find(member => member.id === id))
      .filter((member): member is TeamMember => Boolean(member))
      .sort((a, b) => (a.role === 'Manager' ? 0 : 1) - (b.role === 'Manager' ? 0 : 1)),
    [members, selectedMemberIds],
  )

  const futureShiftMap = useMemo(() => {
    const map = new Map<string, TimelineShiftBlock[]>()
    for (const row of futureRows) {
      if (!row.user_id) continue
      for (const shift of row.shifts) {
        const key = `${row.user_id}_${shift.shift_date}`
        const existing = map.get(key) ?? []
        existing.push(shift)
        map.set(key, existing)
      }
    }
    return map
  }, [futureRows])

  const datesWithShifts = useMemo(() => {
    const dates = new Set<string>()
    for (const row of futureRows) {
      if (!row.user_id) continue
      for (const shift of row.shifts) {
        if (selectedDepartmentId && shift.department_id !== selectedDepartmentId) continue
        dates.add(shift.shift_date)
      }
    }
    return dates
  }, [futureRows, selectedDepartmentId])

  const editUserShiftDates = useMemo(() => {
    const uid = shiftEditForm.assigned_user_id
    if (!uid) return new Set<string>()
    const s = new Set<string>()
    for (const row of futureRows) {
      if (row.user_id === uid) {
        for (const shift of row.shifts) s.add(shift.shift_date)
      }
    }
    return s
  }, [futureRows, shiftEditForm.assigned_user_id])

  const selectedBatchCells = useMemo(() => {
    const cells: BatchCell[] = []
    for (const memberId of selectedMemberIds) {
      for (const date of selectedDates) {
        const key = `${memberId}_${date}`
        cells.push(batchCells[key] ?? {
          user_id: memberId,
          shift_date: date,
          start_time: defaultStartTime,
          end_time: defaultEndTime,
          enabled: true,
        })
      }
    }
    return cells
  }, [batchCells, defaultEndTime, defaultStartTime, selectedDates, selectedMemberIds])

  const enabledBatchCells = selectedBatchCells.filter(cell => cell.enabled)
  const moveDepartment = useCallback((sourceId: string, targetId: string) => {
    if (!sourceId || !targetId || sourceId === targetId) return
    const ids = departmentOrderRef.current.length > 0 ? departmentOrderRef.current : departments.map(dept => dept.id)
    const sourceIdx = ids.indexOf(sourceId)
    const targetIdx = ids.indexOf(targetId)
    if (sourceIdx < 0 || targetIdx < 0 || sourceIdx === targetIdx) return
    const next = [...ids]
    next.splice(sourceIdx, 1)
    next.splice(targetIdx, 0, sourceId)
    departmentOrderRef.current = next
    setDepartmentOrder(next)
  }, [departments])

  const handleDepartmentDragStart = useCallback((departmentId: string) => {
    setDraggingDepartmentId(departmentId)
  }, [])

  const handleDepartmentDragEnd = useCallback(() => {
    setDraggingDepartmentId(null)
    setDragOverDepartmentId(null)
  }, [])

  const clearTimelineSelection = () => {
    setSelectedTimelineUserIds([])
    setTimelineDeleteError('')
  }

  const setTimelineDateAndClearSelection = (date: string) => {
    clearTimelineSelection()
    setTimelineDate(date)
  }

  const setTimelineByOffset = (offset: number) => {
    if (!timelineDate) return
    setTimelineDateAndClearSelection(formatDateKey(addDays(new Date(`${timelineDate}T00:00:00`), offset)))
  }

  const toggleTimelineUserSelection = (userId: string) => {
    if (timelineIsPast) return
    setTimelineDeleteError('')
    setSelectedTimelineUserIds(prev => (
      prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
    ))
  }

  const deleteSelectedTimelineAssignments = async () => {
    if (timelineIsPast) return
    if (selectedTimelineUserIds.length === 0 || timelineBulkDeleting) return
    if (selectedTimelineAssignmentIds.length === 0) {
      setSelectedTimelineUserIds([])
      setTimelineDeleteError('')
      return
    }

    setTimelineBulkDeleting(true)
    setTimelineDeleteError('')
    try {
      const qs = internalUserId ? `?actor_id=${internalUserId}` : ''
      const deletedCount = selectedTimelineAssignmentIds.length
      for (const assignmentId of selectedTimelineAssignmentIds) {
        const res = await fetch(`/api/shift-assignment/${assignmentId}${qs}`, { method: 'DELETE' })
        const data = await res.json()
        if (!data.success) throw new Error(data.message || 'Failed to delete selected shifts')
      }
      setSelectedTimelineUserIds([])
      await refreshShiftData()
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
      setSuccessToast(`${deletedCount} shift${deletedCount === 1 ? '' : 's'} removed`)
      toastTimerRef.current = setTimeout(() => setSuccessToast(null), 3000)
    } catch (err) {
      setTimelineDeleteError(err instanceof Error ? err.message : 'Failed to delete selected shifts')
    } finally {
      setTimelineBulkDeleting(false)
    }
  }

  const syncCell = (memberId: string, date: string) => {
    const key = `${memberId}_${date}`
    setBatchCells(prev => {
      const existing = prev[key]
      if (existing && existing.enabled !== false) return prev
      return {
        ...prev,
        [key]: {
          user_id: memberId,
          shift_date: date,
          start_time: defaultStartTime,
          end_time: defaultEndTime,
          enabled: true,
        },
      }
    })
  }

  const toggleBatchMember = (memberId: string) => {
    setSelectedMemberIds(prev => {
      if (prev.includes(memberId)) return prev.filter(id => id !== memberId)
      for (const date of selectedDates) syncCell(memberId, date)
      return [...prev, memberId]
    })
  }

  const toggleBatchDate = (date: string) => {
    if (selectedDates.includes(date)) {
      setSelectedDates(prev => prev.filter(item => item !== date))
    } else {
      for (const memberId of selectedMemberIds) syncCell(memberId, date)
      setSelectedDates(prev => [...prev, date].sort())
    }
  }

  const updateBatchCell = (memberId: string, date: string, fields: Partial<BatchCell>) => {
    const key = `${memberId}_${date}`
    setBatchCells(prev => {
      const current = prev[key]
      return {
        ...prev,
        [key]: {
          user_id: current?.user_id ?? memberId,
          shift_date: current?.shift_date ?? date,
          start_time: current?.start_time ?? defaultStartTime,
          end_time: current?.end_time ?? defaultEndTime,
          enabled: current?.enabled ?? true,
          ...fields,
        },
      }
    })
  }

  const removeShiftCard = (memberId: string, date: string) => {
    // Check if ALL members will have this date disabled after this removal
    const allMembersDisabledForDate = selectedMemberIds.every(mid => {
      if (mid === memberId) return true
      const cell = batchCells[`${mid}_${date}`]
      return cell?.enabled === false
    })

    if (allMembersDisabledForDate) {
      // Remove the date entirely and clean up cells so calendar date reverts to unselected
      setSelectedDates(prev => prev.filter(d => d !== date))
      setBatchCells(prev => {
        const next = { ...prev }
        for (const mid of selectedMemberIds) delete next[`${mid}_${date}`]
        return next
      })
    } else {
      updateBatchCell(memberId, date, { enabled: false })
    }
    // Never remove member from selectedMemberIds here — that breaks re-selection
    // Members are only removed via the people-picker toggles
  }

  const applyDefaultToAllCells = () => {
    setBatchCells(prev => {
      const next = { ...prev }
      for (const memberId of selectedMemberIds) {
        for (const date of selectedDates) {
          const key = `${memberId}_${date}`
          next[key] = {
            user_id: memberId,
            shift_date: date,
            start_time: defaultStartTime,
            end_time: defaultEndTime,
            enabled: next[key]?.enabled ?? true,
          }
        }
      }
      return next
    })
  }

  const openAiShiftModal = (_dept?: Department | null) => {
    aiGenerateAbortRef.current?.abort()
    aiGenerateAbortRef.current = null
    setAiShiftWizardStep('dates')
    const today = new Date()
    const dow = (today.getDay() + 6) % 7
    const nextMonday = addDays(today, 7 - dow)
    const nextSunday = addDays(nextMonday, 6)
    const todayStr = formatDateKey(nextMonday)
    const nextWeek = formatDateKey(nextSunday)
    setAiShiftDateFrom(todayStr)
    setAiShiftDateTo(nextWeek)
    setAiShiftTypes([{ label: 'Shift 1', start_time: '09:00', end_time: '17:00' }])
    setAiShiftSelectedDepartmentIds([])
    if (aiShiftProgressTimerRef.current) {
      clearInterval(aiShiftProgressTimerRef.current)
      aiShiftProgressTimerRef.current = null
    }
    setAiShiftLoading(false)
    setAiShiftProgress(0)
    setAiShiftEtaSeconds(0)
    setAiShiftError('')
    setAiShiftNotice('')
    setAiShiftSuggestions([])
    setAiShiftSelected(new Set())
    setAiShiftCreateError('')
    setAiResultWeekOffset(0)
    setAiShiftModal(true)
  }

  const closeAiShiftModal = () => {
    aiGenerateAbortRef.current?.abort()
    aiGenerateAbortRef.current = null
    if (aiShiftProgressTimerRef.current) {
      clearInterval(aiShiftProgressTimerRef.current)
      aiShiftProgressTimerRef.current = null
    }
    setAiShiftLoading(false)
    setAiShiftModal(false)
  }

  const estimateAiScheduleSeconds = (departmentCount: number, dayCount: number, shiftTypeCount: number) => {
    const blockCount = Math.max(1, departmentCount * dayCount)
    const slotCount = Math.max(1, blockCount * shiftTypeCount)
    // Baseline latency plus a per-slot cost, derived from observed generation times.
    const estimate = 6 + slotCount * 1.6
    return Math.min(60, Math.round(estimate))
  }

  const startAiShiftProgress = (etaSeconds: number) => {
    if (aiShiftProgressTimerRef.current) clearInterval(aiShiftProgressTimerRef.current)
    const startedAt = Date.now()
    setAiShiftProgress(0)
    setAiShiftEtaSeconds(etaSeconds)
    aiShiftProgressTimerRef.current = setInterval(() => {
      const elapsedSeconds = (Date.now() - startedAt) / 1000
      // Approach 92% asymptotically so the bar never appears finished before the response lands.
      const ratio = 1 - Math.exp(-elapsedSeconds / Math.max(4, etaSeconds * 0.6))
      const progress = Math.min(92, ratio * 92)
      setAiShiftProgress(progress)
      setAiShiftEtaSeconds(Math.max(0, Math.ceil(etaSeconds - elapsedSeconds)))
    }, 200)
  }

  const stopAiShiftProgress = (complete: boolean) => {
    if (aiShiftProgressTimerRef.current) {
      clearInterval(aiShiftProgressTimerRef.current)
      aiShiftProgressTimerRef.current = null
    }
    if (complete) setAiShiftProgress(100)
    setAiShiftEtaSeconds(0)
  }

  const handleAiGenerateShifts = async () => {
    const normalizedDateFrom = normalizeDateInput(aiShiftDateFrom)
    const normalizedDateTo = normalizeDateInput(aiShiftDateTo)
    if (!normalizedDateFrom || !normalizedDateTo) { setAiShiftError('Select a date range'); return }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(normalizedDateFrom) || !/^\d{4}-\d{2}-\d{2}$/.test(normalizedDateTo)) {
      setAiShiftError('Select a valid date range')
      return
    }
    if (aiShiftSelectedDepartmentIds.length === 0) { setAiShiftError('Select at least one department'); return }
    const validShiftTypes = aiShiftTypes
      .map((shift, index) => ({
        label: shift.label?.trim() || `Shift ${index + 1}`,
        start_time: shift.start_time,
        end_time: shift.end_time,
      }))
      .filter(shift => shift.start_time && shift.end_time)
    if (validShiftTypes.length === 0) { setAiShiftError('Add at least one shift type'); return }
    if (validShiftTypes.some(shift => shift.start_time >= shift.end_time)) {
      setAiShiftError('Each shift type start time must be before end time')
      return
    }

    const dayCount = Math.floor((new Date(`${normalizedDateTo}T00:00:00Z`).getTime() - new Date(`${normalizedDateFrom}T00:00:00Z`).getTime()) / 86_400_000) + 1
    const slotCount = aiShiftSelectedDepartmentIds.length * dayCount * validShiftTypes.length
    if (slotCount > 150) {
      setAiShiftError(`Too many shifts to generate at once (${slotCount}). Narrow the date range, departments, or shift types and try again.`)
      return
    }
    const etaSeconds = estimateAiScheduleSeconds(aiShiftSelectedDepartmentIds.length, dayCount, validShiftTypes.length)

    setAiShiftLoading(true)
    setAiShiftError('')
    setAiShiftNotice('')
    setAiShiftSuggestions([])
    setAiShiftSelected(new Set())
    startAiShiftProgress(etaSeconds)
    aiGenerateAbortRef.current?.abort()
    const controller = new AbortController()
    aiGenerateAbortRef.current = controller
    try {
      const res = await fetch('/api/owner/scheduling-rules/generate', {
        method: 'POST',
        signal: controller.signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company_id: companyId,
          user_id: internalUserId,
          date_from: normalizedDateFrom,
          date_to: normalizedDateTo,
          department_ids: aiShiftSelectedDepartmentIds,
          shift_types: validShiftTypes,
        }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.message || 'AI schedule generation failed')

      const rawBlocks = data.suggestions as Array<{
        department_id: string
        department_name?: string
        shift_date: string
        slots: AiShiftSlot[]
        warning: string | null
      }>

      const deptNameMap = new Map(departments.map(d => [d.id, d.name]))

      const generated: AutoShiftBlock[] = rawBlocks.map(block => {
        const deptName = block.department_name ?? deptNameMap.get(block.department_id) ?? block.department_id
        return {
          key: `${block.department_id}_${block.shift_date}`,
          department_id: block.department_id,
          department_name: deptName,
          shift_date: block.shift_date,
          slots: Array.isArray(block.slots) ? block.slots : [],
          warning: block.warning,
        }
      })

      setAiShiftSuggestions(generated)
      setAiShiftSelected(new Set(generated.map(block => block.key)))
      setAiShiftNotice(data.notice ?? `AI generated ${generated.length} schedule block${generated.length === 1 ? '' : 's'} for Owner review.`)
      setAiResultWeekOffset(0)
      stopAiShiftProgress(true)
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return
      setAiShiftError(err instanceof Error ? err.message : 'Schedule generation failed')
      stopAiShiftProgress(false)
    } finally {
      if (aiGenerateAbortRef.current === controller) {
        aiGenerateAbortRef.current = null
        setAiShiftLoading(false)
      }
    }
  }


  const handleAiCreateShifts = async () => {
    if (aiShiftSelected.size === 0) return
    if (!companyId || !internalUserId) return
    const normalizedDateFrom = normalizeDateInput(aiShiftDateFrom)
    const normalizedDateTo = normalizeDateInput(aiShiftDateTo)
    setAiShiftCreateLoading(true); setAiShiftCreateError('')
    try {
      const selectedScheduleItems = aiShiftSuggestions
        .filter(block => aiShiftSelected.has(block.key))
        .flatMap(block => block.slots.map(shift => ({
          department_id: block.department_id,
          shift_date: block.shift_date,
          start_time: shift.start_time,
          end_time: shift.end_time,
          user_id: shift.assigned_user_id,
        })))

      const existingScheduleItems = futureRows.flatMap(row => row.shifts
        .filter(shift => shift.shift_date >= normalizedDateFrom && shift.shift_date <= normalizedDateTo)
        .map(shift => ({
          department_id: shift.department_id,
          shift_date: shift.shift_date,
          start_time: shift.start_time,
          end_time: shift.end_time,
          user_id: row.user_id,
        })))

      const validationRes = await fetch('/api/owner/scheduling-rules/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company_id: companyId,
          date_from: normalizedDateFrom,
          date_to: normalizedDateTo,
          items: [...existingScheduleItems, ...selectedScheduleItems],
        }),
      })
      const validationData = await validationRes.json()
      if (!validationData.success) throw new Error(validationData.message || 'Failed to validate generated schedule')
      const validation = validationData.validation as { valid: boolean; errors: AiScheduleViolation[]; warnings: AiScheduleViolation[] }
      if (!validation.valid) {
        const firstErrors = validation.errors.slice(0, 4).map(item => `${item.rule_name}: ${item.message}`)
        throw new Error(`AI schedule was not saved because it violates hard rules. ${firstErrors.join(' ')}`)
      }

      for (const block of aiShiftSuggestions) {
        if (!aiShiftSelected.has(block.key)) continue
        for (const shift of block.slots) {
          const res = await fetch('/api/shift', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              company_id: companyId,
              department_id: block.department_id,
              title: `${block.department_name} ${shift.shift_label}`,
              instruction: `${block.department_name} | ${shift.shift_label} | ${shift.reason}`,
              shift_date: block.shift_date,
              start_time: shift.start_time,
              end_time: shift.end_time,
              created_by: internalUserId,
              assigned_user_id: shift.assigned_user_id,
            }),
          })
          const data = await res.json()
          if (!data.success) throw new Error(data.message || 'Failed to create shift')
        }
      }
      setAiShiftModal(false)
      setSuccessToast(validation.warnings.length > 0
        ? `Draft shifts created with ${validation.warnings.length} soft-rule warning${validation.warnings.length === 1 ? '' : 's'}`
        : 'Draft shifts created')
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
      toastTimerRef.current = setTimeout(() => setSuccessToast(null), 3000)
      void refreshShiftData()
    } catch (err) {
      setAiShiftCreateError(err instanceof Error ? err.message : 'Failed to create shifts')
    } finally {
      setAiShiftCreateLoading(false)
    }
  }

  const openBatchDrawer = (department: Department, initialMemberId?: string, initialDate?: string) => {
    const departmentMembers = getDepartmentPeople(department)
    const single = initialMemberId ? (members.find(m => m.id === initialMemberId) ?? null) : null
    setBatchDepartment(department)
    setBatchSingleMember(single)
    setBatchFromSelection(false)
    setSelectedMemberIds(initialMemberId ? [initialMemberId] : [])
    setSelectedDates(initialDate ? [initialDate] : [])
    setBatchCells({})
    setBulkError('')
    setBulkResult('')
    setBulkFailures([])
    const base = initialDate ? new Date(`${initialDate}T00:00:00`) : addDays(new Date(), 1)
    setCalMonth(`${base.getFullYear()}-${String(base.getMonth() + 1).padStart(2, '0')}`)
    if (!initialMemberId && departmentMembers.length === 1) {
      setSelectedMemberIds([departmentMembers[0].id])
    }
    if (companyId) void fetchFutureRows(companyId)
  }

  const openBatchDrawerForSelection = () => {
    if (timelineIsPast) return
    if (selectedTimelineRows.length === 0) return
    const firstRow = selectedTimelineRows[0]
    const dept = departments.find(d => d.id === firstRow.department_id)
    if (!dept) return
    setBatchDepartment(dept)
    setBatchSingleMember(null)
    setBatchFromSelection(true)
    setSelectedMemberIds(selectedTimelineUserIds)
    setSelectedDates([])
    setBatchCells({})
    setBulkError('')
    setBulkResult('')
    setBulkFailures([])
    const base = addDays(new Date(), 1)
    setCalMonth(`${base.getFullYear()}-${String(base.getMonth() + 1).padStart(2, '0')}`)
    if (companyId) void fetchFutureRows(companyId)
  }

  const closeBatchDrawer = () => {
    setBatchDepartment(null)
    setBatchSingleMember(null)
    setBatchFromSelection(false)
    setCalDir('next')
    setCalKey(0)
    setBulkError('')
    setBulkResult('')
    setBulkFailures([])
  }

  const submitBulkAssignment = async () => {
    if (!batchDepartment || !companyId || !internalUserId) return
    setBulkError('')
    setBulkResult('')
    setBulkFailures([])
    if (enabledBatchCells.length === 0) {
      setBulkError('Select at least one enabled shift cell.')
      return
    }
    const invalid = enabledBatchCells.find(cell => cell.start_time >= cell.end_time)
    if (invalid) {
      setBulkError(`Invalid time on ${prettyDate(invalid.shift_date)}. Start time must be before end time.`)
      return
    }

    setBulkSubmitting(true)
    try {
      const res = await fetch('/api/shift/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company_id: companyId,
          department_id: batchDepartment.id,
          created_by: internalUserId,
          assignments: enabledBatchCells.map(cell => ({
            user_id: cell.user_id,
            shift_date: cell.shift_date,
            start_time: cell.start_time,
            end_time: cell.end_time,
            acceptance_deadline_at: null,
          })),
        }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.message || 'Failed to assign shifts')
      const createdCount = data.result?.created?.length ?? 0
      const failures: BulkFailure[] = data.result?.failed ?? []
      await refreshShiftData()
      if (failures.length > 0) {
        setBulkFailures(failures)
        setBulkResult('')
      } else {
        closeBatchDrawer()
        if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
        setSuccessToast(`${createdCount} shift${createdCount === 1 ? '' : 's'} assigned successfully`)
        toastTimerRef.current = setTimeout(() => setSuccessToast(null), 3000)
      }
    } catch (err) {
      setBulkError(err instanceof Error ? err.message : 'Failed to assign shifts')
    } finally {
      setBulkSubmitting(false)
    }
  }

  const handleDepartmentImportFile = async (file: File | null) => {
    setDepartmentActionError('')
    setDepartmentActionResult('')
    if (!file) return
    const rows = parseDepartmentImportCsv(await file.text())
    setDepartmentImportRows(rows)
    if (rows.length === 0) setDepartmentActionError('No valid departments found.')
  }

  const openAddDepartment = () => {
    setDepartmentModal('add')
    setDepartmentModalTab('manual')
    setActiveDepartment(null)
    setDepartmentNameInput('')
    setDepartmentImportRows([])
    setDepartmentActionError('')
    setDepartmentActionResult('')
  }

  const openEditDepartment = (department: Department) => {
    setDepartmentModal('edit')
    setDepartmentModalTab('manual')
    setActiveDepartment(department)
    setDepartmentNameInput(department.name)
    setDepartmentActionError('')
    setDepartmentActionResult('')
    setOpenDepartmentMenuId(null)
  }

  const openDeleteDepartment = (department: Department) => {
    setDepartmentModal('delete')
    setActiveDepartment(department)
    setDepartmentActionError('')
    setDepartmentActionResult('')
    setOpenDepartmentMenuId(null)
  }

  const openManagerModal = (department: Department) => {
    setManagerModalDepartment(department)
    setSelectedManagerId('')
    setManagerActionError('')
    setOpenDepartmentMenuId(null)
  }

  const handleSaveDepartment = async () => {
    if (!companyId) return
    const name = departmentNameInput.trim()
    if (departmentModalTab === 'manual' && !name) {
      setDepartmentActionError('Department name is required.')
      return
    }
    if (departmentModalTab === 'import' && departmentImportRows.length === 0) {
      setDepartmentActionError('Choose a CSV file with department names.')
      return
    }
    setDepartmentActionLoading(true)
    setDepartmentActionError('')
    try {
      if (departmentModalTab === 'import') {
        const res = await fetch('/api/import/departments', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ company_id: companyId, departments: departmentImportRows }),
        })
        const data = await res.json()
        if (!data.success) throw new Error(data.message || 'Failed to import departments')
        const created = data.result?.created?.length ?? 0
        const skipped = data.result?.skipped?.length ?? 0
        setDepartmentActionResult(`${created} department(s) created. ${skipped} skipped.`)
      } else {
        const isEdit = departmentModal === 'edit'
        const res = await fetch(isEdit ? '/api/company/update-department' : '/api/company/create-department', {
          method: isEdit ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(isEdit ? { department_id: activeDepartment?.id, name } : { company_id: companyId, name }),
        })
        const data = await res.json()
        if (!data.success) throw new Error(data.message || 'Failed to save department')
        setDepartmentModal(null)
      }
      await fetchAssignmentData(companyId, true)
    } catch (err) {
      setDepartmentActionError(err instanceof Error ? err.message : 'Failed to save department')
    } finally {
      setDepartmentActionLoading(false)
    }
  }

  const handleDeleteDepartment = async () => {
    if (!companyId || !activeDepartment) return
    setDepartmentActionLoading(true)
    setDepartmentActionError('')
    try {
      const res = await fetch('/api/company/delete-department', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ department_id: activeDepartment.id }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.message || 'Failed to delete department')
      setDepartmentModal(null)
      setActiveDepartment(null)
      await Promise.all([fetchAssignmentData(companyId, true), refreshShiftData(), fetchTimeline(companyId, timelineDate)])
    } catch (err) {
      setDepartmentActionError(err instanceof Error ? err.message : 'Failed to delete department')
    } finally {
      setDepartmentActionLoading(false)
    }
  }

  const handleSetManager = async () => {
    if (!companyId || !internalUserId || !managerModalDepartment || !selectedManagerId) return
    setManagerActionLoading(true)
    setManagerActionError('')
    try {
      const res = await fetch('/api/team/department-manager', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company_id: companyId,
          department_id: managerModalDepartment.id,
          manager_id: selectedManagerId,
          assigned_by: internalUserId,
        }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.message || 'Failed to assign manager')
      setSelectedManagerId('')
      await fetchAssignmentData(companyId, true)
    } catch (err) {
      setManagerActionError(err instanceof Error ? err.message : 'Failed to assign manager')
    } finally {
      setManagerActionLoading(false)
    }
  }

  const handleRemoveManager = async (managerId: string) => {
    if (!companyId || !managerModalDepartment) return
    setManagerRemoveLoading(managerId)
    setManagerActionError('')
    try {
      const res = await fetch('/api/team/department-manager', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          manager_id: managerId,
          department_id: managerModalDepartment.id,
        }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.message || 'Failed to remove manager')
      await fetchAssignmentData(companyId, true)
    } catch (err) {
      setManagerActionError(err instanceof Error ? err.message : 'Failed to remove manager')
    } finally {
      setManagerRemoveLoading(null)
    }
  }

  const openShiftDetail = (shift: TimelineShiftBlock, row: TimelineRow, isPast = false) => {
    if (isPast) return
    setSelectedShift(shift)
    setShiftEditForm({
      shift_date: shift.shift_date,
      start_time: shift.start_time,
      end_time: shift.end_time,
      assigned_user_id: row.user_id ?? '',
      department_id: shift.department_id,
      acceptance_deadline_at: shift.acceptance_deadline_at
        ? shift.acceptance_deadline_at.slice(0, 16)
        : '',
    })
    setEditShiftCalMonth(shift.shift_date.slice(0, 7))
    setEditShiftCalDir('next')
    setEditShiftCalKey(k => k + 1)
    setShiftActionError('')
  }

  const saveShiftEdit = async () => {
    if (!selectedShift || !internalUserId) return
    setShiftActionError('')
    if (shiftEditForm.shift_date > maxDate) {
      setShiftActionError('Shift date must be within the next 30 days.')
      return
    }
    if (shiftEditForm.start_time >= shiftEditForm.end_time) {
      setShiftActionError('Start time must be before end time.')
      return
    }
    setShiftActionLoading(true)
    try {
      const res = await fetch(`/api/shift/${selectedShift.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          department_id: shiftEditForm.department_id,
          title: '',
          instruction: null,
          shift_date: shiftEditForm.shift_date,
          start_time: shiftEditForm.start_time,
          end_time: shiftEditForm.end_time,
          publication_status: 'published',
          acceptance_deadline_at: shiftEditForm.acceptance_deadline_at || null,
          assigned_user_id: shiftEditForm.assigned_user_id || null,
          assigned_by: internalUserId,
        }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.message || 'Failed to update shift')
      setSelectedShift(null)
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
      setSuccessToast('Shift updated successfully')
      toastTimerRef.current = setTimeout(() => setSuccessToast(null), 3000)
      await refreshShiftData()
    } catch (err) {
      setShiftActionError(err instanceof Error ? err.message.replace('CLOPENING_CONFLICT: ', '') : 'Failed to update shift')
    } finally {
      setShiftActionLoading(false)
    }
  }

  const deleteShift = async () => {
    if (!selectedShift) return
    setShiftActionLoading(true)
    setShiftActionError('')
    try {
      const qs = internalUserId ? `?actor_id=${internalUserId}` : ''
      const res = await fetch(`/api/shift/${selectedShift.id}${qs}`, { method: 'DELETE' })
      const data = await res.json()
      if (!data.success) throw new Error(data.message || 'Failed to delete shift')
      setSelectedShift(null)
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
      setSuccessToast('Shift deleted')
      toastTimerRef.current = setTimeout(() => setSuccessToast(null), 3000)
      await refreshShiftData()
    } catch (err) {
      setShiftActionError(err instanceof Error ? err.message : 'Failed to delete shift')
    } finally {
      setShiftActionLoading(false)
    }
  }

  const switchCompany = (nextCompany: Company) => {
    if (!authUserId) return
    localStorage.setItem(`tasking_company_id_${authUserId}`, nextCompany.id)
    localStorage.setItem(`tasking_last_company_name_${nextCompany.id}`, nextCompany.name)
    setDropdownOpen(false)
    setCompanyId(nextCompany.id)
    setCompany(nextCompany)
  }

  const TL_NAME_COL = 180
  const TL_PAD = 4
  const tlHourTicks: number[] = []
  for (let h = rangeStartHour; h <= rangeEndHour; h++) tlHourTicks.push(h)
  const tlTotalMin = Math.max(60, (rangeEndHour - rangeStartHour) * 60)
  const tlPad = (min: number) => {
    const raw = ((Math.max(rangeStartHour * 60, Math.min(rangeEndHour * 60, min)) - rangeStartHour * 60) / tlTotalMin) * 100
    return TL_PAD + (raw / 100) * (100 - TL_PAD * 2)
  }

  const renderTimeAxis = () => (
    <div style={{ display: 'flex', background: 'linear-gradient(135deg, #0F172A 0%, #1E293B 100%)', borderRadius: '12px 12px 0 0' }}>
      <div style={{ width: TL_NAME_COL, flexShrink: 0 }} />
      <div style={{ position: 'relative', height: 44, flex: 1 }}>
        {tlHourTicks.map(h => (
          <div key={h} style={{ position: 'absolute', top: 0, left: `${tlPad(h * 60)}%`, transform: 'translateX(-50%)', height: '100%', display: 'flex', alignItems: 'center', pointerEvents: 'none' }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.55)', whiteSpace: 'nowrap', userSelect: 'none', letterSpacing: '0.02em' }}>
              {formatHourLabel(h)}
            </span>
          </div>
        ))}
      </div>
    </div>
  )

  const renderShiftRow = (row: TimelineRow, isDeptBoundary = false, barColor = deptColor(row.department_id)) => {
    const EDGE = '2px solid rgba(15,23,42,0.45)'
    const borderTop = isDeptBoundary ? EDGE : 'none'
    return (
      <div key={row.user_id ?? `${row.department_id}_open`} className="tl-row" style={{ display: 'flex', height: 58, borderTop, background: '#FFFFFF' }}>
        <div style={{ width: 8, flexShrink: 0, background: barColor, opacity: 0.85 }} />
        <div style={{ width: TL_NAME_COL - 8, flexShrink: 0, display: 'flex', alignItems: 'center', overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flex: 1, padding: '0 10px 0 12px', cursor: 'default', textAlign: 'left', height: '100%' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 26, height: 26, flexShrink: 0, background: row.profile_photo_url ? 'transparent' : (row.role === 'Manager' ? '#FFF7ED' : '#F3F4F6'), color: row.role === 'Manager' ? '#EA580C' : '#4B5563', borderRadius: 999, overflow: 'hidden' }}>
              {row.profile_photo_url
                ? <img src={row.profile_photo_url} alt={row.full_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : row.role === 'Manager' ? <UserCog size={13} /> : <UserRound size={13} />}
            </div>
            <span className="tl-name" style={{ ...MEMBER_NAME_STYLE, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', transition: 'color 0.14s ease' }}>
              {row.full_name}
            </span>
          </div>
        </div>
        <div style={{ position: 'relative', flex: 1 }}>
          {tlHourTicks.map(h => (
            <div key={`grid-${h}`} style={{ position: 'absolute', top: 0, bottom: 0, left: `${tlPad(h * 60)}%`, width: 0, borderLeft: '1px dashed rgba(15,23,42,0.55)', pointerEvents: 'none', zIndex: 2 }} />
          ))}
          {row.shifts.length === 0 && row.user_id && (() => {
            const dept = departments.find(d => d.id === row.department_id)
            const isTimelinePast = timelineDate < formatDateKey(new Date())
            return (
              <button
                type="button"
                className="off-bar"
                onClick={() => { if (!isTimelinePast && dept) openBatchDrawer(dept, row.user_id!, timelineDate) }}
                style={{ position: 'absolute', top: 10, bottom: 10, left: `${TL_PAD}%`, right: `${TL_PAD}%`, borderRadius: 999, background: '#E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1, border: 'none', cursor: isTimelinePast ? 'default' : 'pointer' }}
                title={isTimelinePast ? undefined : `Assign shift to ${row.full_name}`}
              >
                <span style={{ fontSize: '0.78rem', fontWeight: 600, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.05em', pointerEvents: 'none' }}>Off</span>
              </button>
            )
          })()}
          {row.shifts.map(shift => {
            const startMin = Math.max(timeToMinutes(shift.start_time), rangeStartHour * 60)
            const endMin = Math.min(timeToMinutes(shift.end_time), rangeEndHour * 60)
            const left = tlPad(startMin)
            const right = tlPad(endMin)
            const width = right - left
            if (width <= 0) return null
            const shiftColor = deptColor(row.department_id)
            return (
              <button
                key={`${shift.id}_${shift.assignment_id ?? 'open'}`}
                type="button"
                className="shift-bar"
                onClick={() => openShiftDetail(shift, row, timelineDate < formatDateKey(new Date()))}
                style={{
                  position: 'absolute',
                  top: 10, bottom: 10,
                  left: `${left}%`,
                  width: `${Math.max(width, 1.5)}%`,
                  border: 0,
                  borderRadius: 999,
                  background: shiftColor,
                  color: '#FFFFFF',
                  boxShadow: '0 2px 8px rgba(15,23,42,0.18)',
                  cursor: timelineDate < formatDateKey(new Date()) ? 'default' : 'pointer',
                  padding: '0 8px',
                  textAlign: 'center',
                  overflow: 'hidden',
                  zIndex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                title={`${row.full_name} ${formatShiftHour(shift.start_time)}–${formatShiftHour(shift.end_time)}`}
              >
                <span style={{ fontSize: '0.72rem', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {formatShiftHour(shift.start_time)} – {formatShiftHour(shift.end_time)}
                </span>
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  const renderCalendarView = () => {
    const anchor = new Date(`${timelineDate}T00:00:00`)
    const dow = (anchor.getDay() + 6) % 7  // 0=Mon … 6=Sun
    const mon = new Date(anchor); mon.setDate(anchor.getDate() - dow)
    const weekDates: string[] = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(mon); d.setDate(mon.getDate() + i)
      return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
    })
    const todayStr = formatDateKey(new Date())

    // Build per-user rows, filtered to selected dept if any, excluding open shifts and unassigned/CW rows
    const deptFilter = selectedDepartment?.id
    const filteredRows = calWeekRows.filter(r =>
      r.user_id !== null &&
      r.department_id &&
      (r.role === 'Manager' || r.role === 'Employee') &&
      (!deptFilter || r.department_id === deptFilter)
    )
    // Sort: Manager → Employee → Casual Worker, then alpha
    const sortedRows = [...filteredRows].sort((a, b) =>
      roleRank(a.role) - roleRank(b.role) || a.full_name.localeCompare(b.full_name)
    )

    const BORDER = PANEL_BORDER
    const NAME_COL = TL_NAME_COL

    if (calWeekLoading) {
      return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 260, color: MUTED, gap: 10 }}>
          <Spinner dark /> Loading week schedule…
        </div>
      )
    }

    // Group rows by department to apply dept-boundary borders (same logic as timeline)
    const deptRowsCal: Record<string, TimelineRow[]> = {}
    for (const row of sortedRows) {
      if (!deptRowsCal[row.department_id]) deptRowsCal[row.department_id] = []
      deptRowsCal[row.department_id].push(row)
    }
    const deptOrderCal = orderedDepartments.map(dept => dept.id).filter(deptId => deptRowsCal[deptId])

    const EDGE = '2px solid rgba(15,23,42,0.45)'

    return (
      <div className="shift-tab-content" style={{ overflowX: 'auto', padding: '14px 16px 18px 18px' }}>
        <div style={{ minWidth: 700, borderRadius: 12, overflow: 'hidden', border: `1px solid ${BORDER}` }}>
          {/* Header row */}
          <div style={{ display: 'grid', gridTemplateColumns: `${NAME_COL}px repeat(7, 1fr)`, background: 'linear-gradient(135deg, #0F172A 0%, #1E293B 100%)', height: 54 }}>
            <div style={{ padding: '10px 14px', borderRight: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center' }} />
            {weekDates.map(date => {
              const d = new Date(`${date}T00:00:00`)
              const dayNum = String(d.getDate()).padStart(2, '0')
              const month = d.toLocaleDateString('en-AU', { month: 'short' })
              const weekday = d.toLocaleDateString('en-AU', { weekday: 'long' })
              const isToday = date === todayStr
              return (
                <div key={date} style={{ padding: '10px 8px', borderRight: '1px solid rgba(255,255,255,0.08)', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                  <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: isToday ? OWNER_ORANGE : 'rgba(255,255,255,0.85)', letterSpacing: '0.01em', lineHeight: 1.2 }}>{dayNum} {month}</p>
                  <p style={{ margin: '3px 0 0', fontSize: 12, fontWeight: 500, color: isToday ? OWNER_ORANGE : 'rgba(255,255,255,0.5)', letterSpacing: '0.01em', lineHeight: 1.2 }}>{weekday}</p>
                </div>
              )
            })}
          </div>

          {/* Body rows */}
          {sortedRows.length === 0 ? (
            <div style={{ padding: '48px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, color: '#9CA3AF' }}>
              <CalendarDays size={22} strokeWidth={1.5} />
              <p style={{ margin: 0, fontWeight: 600, fontSize: 14 }}>No shifts this week</p>
            </div>
          ) : (
            <div style={{ borderLeft: EDGE, borderRight: EDGE, borderBottom: EDGE }}>
              {deptOrderCal.map((deptId, deptIdx) => {
                const barColor = deptColor(deptId)
                return deptRowsCal[deptId].map((row, rowIdx) => {
                  const isManager = row.role === 'Manager'
                  const isDeptBoundary = deptIdx > 0 && rowIdx === 0
                  const borderTop = isDeptBoundary ? EDGE : `1px solid ${BORDER}`
                  return (
                    <div key={row.user_id ?? `r-${deptIdx}-${rowIdx}`} style={{ display: 'grid', gridTemplateColumns: `${NAME_COL}px repeat(7, 1fr)`, borderTop, background: '#FFFFFF', height: 58 }}>
                      {/* Color bar + Name cell */}
                      <div style={{ display: 'flex', alignItems: 'center', borderRight: `1px solid ${BORDER}`, overflow: 'hidden', height: 58 }}>
                        <div style={{ width: 8, alignSelf: 'stretch', flexShrink: 0, background: barColor, opacity: 0.85 }} />
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 10px 0 12px', minWidth: 0, flex: 1, cursor: 'default', textAlign: 'left', height: '100%' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 26, height: 26, flexShrink: 0, background: row.profile_photo_url ? 'transparent' : (isManager ? '#FFF7ED' : '#F3F4F6'), color: isManager ? '#EA580C' : '#4B5563', borderRadius: 999, overflow: 'hidden' }}>
                            {row.profile_photo_url
                              ? <img src={row.profile_photo_url} alt={row.full_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                              : isManager ? <UserCog size={13} /> : <UserRound size={13} />}
                          </div>
                          <span className="tl-name" style={{ ...MEMBER_NAME_STYLE, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', transition: 'color 0.14s ease' }}>{row.full_name}</span>
                        </div>
                      </div>
                      {/* Day cells */}
                      {weekDates.map(date => {
                        const dayShifts = row.shifts.filter((s: TimelineShiftBlock) => s.shift_date === date)
                        const isPastDate = date < todayStr
                        return (
                          <div key={date} style={{ padding: '0 6px', borderRight: `1px solid ${BORDER}`, height: 58, overflow: 'hidden', display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'stretch', justifyContent: 'center' }}>
                            {dayShifts.length === 0 ? (
                              <div style={{ borderRadius: 999, background: '#E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'center', height: 24, cursor: isPastDate ? 'default' : 'pointer' }}
                                onClick={() => {
                                  if (isPastDate) return
                                  const dept = departments.find(d => d.id === row.department_id)
                                  if (!dept) return
                                  openBatchDrawer(dept, row.user_id!, date)
                                }}
                                title={isPastDate ? undefined : `Assign shift to ${row.full_name} on ${date}`}
                              >
                                <span style={{ fontSize: 10, fontWeight: 600, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Off</span>
                              </div>
                            ) : dayShifts.map((shift: TimelineShiftBlock) => (
                                <button
                                  key={shift.id}
                                  onClick={() => openShiftDetail(shift, row, isPastDate)}
                                  style={{
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    padding: '0 8px', height: 28, flexShrink: 0,
                                    background: barColor,
                                    border: 'none', borderRadius: 999,
                                    cursor: isPastDate ? 'default' : 'pointer', width: '100%',
                                    opacity: isPastDate ? 0.7 : 1,
                                  }}
                                  onMouseEnter={e => { if (!isPastDate) e.currentTarget.style.filter = 'brightness(1.08)' }}
                                  onMouseLeave={e => { e.currentTarget.style.filter = 'none' }}
                                >
                                  <span style={{ fontSize: 10.5, fontWeight: 600, color: '#FFFFFF', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                    {formatShiftHour(shift.start_time)}–{formatShiftHour(shift.end_time)}
                                  </span>
                                </button>
                              ))}
                          </div>
                        )
                      })}
                    </div>
                  )
                })
              })}
            </div>
          )}
        </div>
      </div>
    )
  }

  const renderTimeline = () => {
    if (timelineLoading) {
      return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 260, color: MUTED, gap: 10 }}>
          <Spinner dark /> Loading future schedule
        </div>
      )
    }
    if (visibleTimelineRows.length === 0) {
      return (
        <div style={{ minHeight: 260, display: 'grid', placeItems: 'center', color: MUTED, fontWeight: 700 }}>
          {selectedDepartment ? 'No Manager or Employee in this department yet.' : `No people available for ${prettyDate(timelineDate)}.`}
        </div>
      )
    }
    const EDGE = '2px solid rgba(15,23,42,0.45)'
    const deptOrder: string[] = []
    const deptMap: Record<string, { color: string; name: string; rows: TimelineRow[] }> = {}
    for (const row of visibleTimelineRows) {
      if (!deptMap[row.department_id]) {
        deptOrder.push(row.department_id)
        deptMap[row.department_id] = { color: deptColor(row.department_id), name: row.department_name, rows: [] }
      }
      deptMap[row.department_id].rows.push(row)
    }
    const orderedDeptIds = orderedDepartments.map(dept => dept.id).filter(deptId => deptMap[deptId])
    for (const dept of Object.values(deptMap)) {
      dept.rows.sort((a, b) => roleRank(a.role) - roleRank(b.role) || a.full_name.localeCompare(b.full_name))
    }
    return (
      <div className="shift-tab-content" style={{ overflowX: 'auto', padding: '14px 16px 18px 18px' }}>
        <div style={{ minWidth: 860 }}>
          {renderTimeAxis()}
          <div style={{ borderLeft: EDGE, borderRight: EDGE, borderBottom: EDGE }}>
            {orderedDeptIds.map((deptId, deptIdx) => {
              const dept = deptMap[deptId]
              return dept.rows.map((row, rowIdx) =>
                renderShiftRow(row, deptIdx > 0 && rowIdx === 0, dept.color)
              )
            })}
          </div>
        </div>
      </div>
    )
  }

  useLayoutEffect(() => {
    const container = shiftTabBarRef.current
    const activeButton = shiftTabButtonRefs.current[shiftViewMode]
    if (!container || !activeButton) return

    const containerRect = container.getBoundingClientRect()
    const activeRect = activeButton.getBoundingClientRect()
    setShiftTabIndicator({
      left: activeRect.left - containerRect.left,
      width: activeRect.width,
      opacity: 1,
    })
  }, [shiftViewMode])

  useEffect(() => {
    const updateIndicator = () => {
      const container = shiftTabBarRef.current
      const activeButton = shiftTabButtonRefs.current[shiftViewMode]
      if (!container || !activeButton) return

      const containerRect = container.getBoundingClientRect()
      const activeRect = activeButton.getBoundingClientRect()
      setShiftTabIndicator({
        left: activeRect.left - containerRect.left,
        width: activeRect.width,
        opacity: 1,
      })
    }

    window.addEventListener('resize', updateIndicator)
    return () => window.removeEventListener('resize', updateIndicator)
  }, [shiftViewMode])

  if (!initialReady) {
    return (
      <div style={{ display: 'flex', minHeight: '100vh', background: APP_BG }}>
        <OwnerSidebar />
        <main style={{ flex: 1, display: 'grid', placeItems: 'center', color: TEXT_DARK, fontWeight: 600 }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}><Spinner dark /> Loading shifts</span>
        </main>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: APP_BG }}>
      <style>{pageKeyframes}</style>
      <OwnerSidebar />
      <main style={{ marginLeft: 64, height: '100vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', flex: 1, gap: 0, animation: 'blockSlideUp 0.38s ease both 0.04s' }}>
        <div style={{ padding: '20px 28px 16px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 24, flexShrink: 0 }}>
          <div>
            <h1 className="mb-0 font-heading text-3xl font-bold tracking-tight text-gray-950">
              Shifts
            </h1>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0, paddingTop: 4 }}>
            {internalUserId && <OwnerUserBadge userId={internalUserId} companyId={companyId} />}
            {companyId && <OwnerPlanBadge plan={company?.plan ?? 'Free'} currentCompanyId={companyId} />}
          </div>
        </div>

        <div style={{ padding: '0 28px 16px', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start' }}>
            <div
              ref={shiftTabBarRef}
              style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: 4,
              background: '#FFFFFF',
              border: '1px solid #E5E7EB',
              borderRadius: 999,
              boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
              overflow: 'hidden',
              position: 'relative',
            }}
            >
              <span
                aria-hidden="true"
                style={{
                  position: 'absolute',
                  top: 4,
                  left: shiftTabIndicator.left,
                  width: shiftTabIndicator.width,
                  height: 'calc(100% - 8px)',
                  borderRadius: 999,
                  background: 'linear-gradient(180deg, #0F172A 0%, #111827 100%)',
                  boxShadow: '0 6px 18px rgba(15,23,42,0.18)',
                  opacity: shiftTabIndicator.opacity,
                  transform: shiftTabIndicator.opacity ? 'translateY(0)' : 'translateY(4px)',
                  transition: 'left 0.24s cubic-bezier(0.22, 1, 0.36, 1), width 0.24s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.16s ease, transform 0.24s cubic-bezier(0.22, 1, 0.36, 1)',
                  pointerEvents: 'none',
                }}
              />
              {([
                { id: 'timeline' as const, label: 'Timeline' },
                { id: 'calendar' as const, label: 'Calendar' },
              ]).map(tab => {
                const active = shiftViewMode === tab.id
                return (
                  <button
                    key={tab.id}
                    ref={el => { shiftTabButtonRefs.current[tab.id] = el }}
                    type="button"
                    onClick={() => setShiftViewMode(tab.id)}
                    style={{
                      position: 'relative',
                      zIndex: 1,
                      height: 36,
                      padding: '0 18px',
                      borderRadius: 999,
                      border: 'none',
                      background: active ? '#0F172A' : 'transparent',
                      color: active ? '#FFFFFF' : '#64748B',
                      fontSize: 13,
                      fontWeight: 700,
                      cursor: 'pointer',
                      boxShadow: 'none',
                      transition: 'color 0.18s ease, transform 0.18s ease',
                      transform: active ? 'translateY(-0.5px)' : 'translateY(0)',
                    }}
                  >
                    {tab.label}
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 24, padding: '0 28px 24px' }}>
          {initialReady && !companyId && (
            <div style={{ background: '#FFFBEB', borderRadius: 12, padding: '14px 16px', fontSize: 13, color: '#92400E', border: '1px solid #FDE68A' }}>
              No company is linked to your profile yet. If you just accepted an invitation, try signing out and signing in again.
            </div>
          )}

          {companyId && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(300px, 326px) minmax(0, 1fr)', gap: 16, alignItems: 'start' }}>
        <section className="shift-dept-panel" style={{ background: '#FFFFFF', border: `1px solid ${PANEL_BORDER}`, borderRadius: 14, overflow: 'visible' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start', gap: 12, padding: '16px 18px', borderBottom: `1px solid ${PANEL_BORDER}`, flexWrap: 'wrap' }}>
            {selectedDepartment ? (
              <>
                <button
                  type="button"
                  onClick={() => { clearTimelineSelection(); setSelectedDepartmentId(null) }}
                  aria-label="Back to all departments"
                  title="Back to all departments"
                  style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 30, height: 30, borderRadius: 8, border: '1px solid #E2E8F0', background: '#FFFFFF', color: MUTED, cursor: 'pointer', flexShrink: 0 }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = '#FDBA74'; e.currentTarget.style.color = '#F97316'; e.currentTarget.style.background = '#FFF7ED' }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = '#E2E8F0'; e.currentTarget.style.color = MUTED; e.currentTarget.style.background = '#FFFFFF' }}
                >
                  <ChevronLeft size={14} />
                </button>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                  <span style={{ width: 10, height: 10, borderRadius: 999, background: deptColor(selectedDepartment.id), flexShrink: 0 }} />
                  <h2 style={{ margin: 0, ...DEPARTMENT_NAME_STYLE, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {selectedDepartment.name}
                  </h2>
                </div>
              </>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 30, height: 30, borderRadius: 9, background: '#FFF7ED', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Users size={15} style={{ color: '#F97316' }} />
                </div>
                <span style={SECTION_TITLE_STYLE}>Departments</span>
              </div>
            )}
          </div>
          <div style={{ padding: 14 }}>
            {assignmentDataLoading ? (
              <div style={{ minHeight: 150, display: 'grid', placeItems: 'center', color: MUTED, fontWeight: 600 }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}><Spinner dark /> Loading departments</span>
              </div>
            ) : selectedDepartment ? (
              <div style={{ display: 'grid', gap: 12 }}>
                <div style={{ display: 'grid', gap: 12 }}>
                  {getDepartmentPeople(selectedDepartment).length === 0 ? (
                    <div style={{ borderRadius: 12, background: '#F8FAFC', padding: 18, color: '#94A3B8', fontSize: 13, fontWeight: 600, textAlign: 'center' }}>
                      No Manager or Employee yet.
                    </div>
                  ) : getDepartmentPeople(selectedDepartment).map((member, memberIdx) => (
                    <div key={`${member.id}-${shiftViewMode}`} className="member-card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, border: member.role === 'Manager' ? '1.5px solid #FDBA74' : `1px solid ${PANEL_BORDER}`, borderRadius: 12, padding: '13px 12px', background: member.role === 'Manager' ? '#FFFBF7' : '#FFFFFF', animationDelay: `${memberIdx * 50}ms` }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, borderRadius: 999, background: member.profile_photo_url ? 'transparent' : (member.role === 'Manager' ? '#FFF7ED' : '#F3F4F6'), color: member.role === 'Manager' ? '#EA580C' : '#4B5563', flexShrink: 0, overflow: 'hidden' }}>
                          {member.profile_photo_url
                            ? <img src={member.profile_photo_url} alt={member.full_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            : member.role === 'Manager' ? <UserCog size={14} /> : <UserRound size={14} />}
                        </span>
                        <div style={{ minWidth: 0 }}>
                          <p style={{ margin: 0, ...MEMBER_NAME_STYLE, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{member.full_name}</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={e => { e.stopPropagation(); router.push(`/owner/communication?tab=messages&partner_id=${member.id}`) }}
                        title="Send message"
                        style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', border: `1px solid #E2E8F0`, borderRadius: 9, background: '#F8FAFC', color: '#CBD5E1', width: 30, height: 30, cursor: 'pointer', flexShrink: 0 }}
                        onMouseEnter={e => { e.currentTarget.style.color = '#F97316'; e.currentTarget.style.borderColor = '#FDBA74'; e.currentTarget.style.background = '#FFF7ED' }}
                        onMouseLeave={e => { e.currentTarget.style.color = '#CBD5E1'; e.currentTarget.style.borderColor = '#E2E8F0'; e.currentTarget.style.background = '#F8FAFC' }}
                      >
                        <MessageCircle size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ) : orderedDepartments.length === 0 ? (
              <div style={{ minHeight: 150, display: 'grid', placeItems: 'center', color: MUTED, fontWeight: 600 }}>No departments yet.</div>
            ) : (
              <>
              <div style={{ display: 'grid', gap: 10, marginBottom: 12 }}>
                {orderedDepartments.map((department, deptIdx) => {
                  const deptMembers = membersByDepartment.get(department.id) ?? []
                  const employeeCount = deptMembers.filter(member => member.role === 'Employee').length
                  const deptManagerList = departmentManagers.filter(item => item.department_id === department.id)
                  const isDragging = draggingDepartmentId === department.id
                  const isDragOver = dragOverDepartmentId === department.id
                  return (
                    <article
                      key={`${department.id}-${shiftViewMode}`}
                      draggable
                      className="shift-dept-card"
                      onDragStart={(event) => {
                        const target = event.target as HTMLElement | null
                        if (target?.closest('button, input, textarea, select, a, [role="button"]')) {
                          event.preventDefault()
                          return
                        }
                        event.dataTransfer.effectAllowed = 'move'
                        event.dataTransfer.setData('text/plain', department.id)
                        handleDepartmentDragStart(department.id)
                      }}
                      onDragEnd={handleDepartmentDragEnd}
                      onDragOver={(event) => {
                        event.preventDefault()
                        if (draggingDepartmentId && draggingDepartmentId !== department.id) {
                          setDragOverDepartmentId(department.id)
                        }
                      }}
                      onDragLeave={(event) => {
                        if (event.currentTarget.contains(event.relatedTarget as Node | null)) return
                        setDragOverDepartmentId(current => current === department.id ? null : current)
                      }}
                      onDrop={(event) => {
                        event.preventDefault()
                        const sourceId = event.dataTransfer.getData('text/plain')
                        if (sourceId) moveDepartment(sourceId, department.id)
                        handleDepartmentDragEnd()
                      }}
                      style={{
                        position: 'relative',
                        animation: `deptCardIn 0.28s ease both ${deptIdx * 55}ms`,
                        zIndex: 1,
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        gap: 10,
                        minHeight: 84,
                        border: `1px solid ${PANEL_BORDER}`,
                        borderRadius: 10,
                        padding: '14px 16px',
                        background: '#F9FAFB',
                        cursor: isDragging ? 'grabbing' : 'grab',
                        overflow: 'hidden',
                        transition: 'box-shadow 0.18s ease, transform 0.18s ease, border-color 0.18s ease, opacity 0.18s ease',
                        opacity: isDragging ? 0.88 : 1,
                        outline: isDragOver ? '2px dashed #F97316' : 'none',
                        outlineOffset: 3,
                        boxShadow: isDragOver ? '0 14px 34px rgba(249,115,22,0.12)' : undefined,
                        transform: isDragging ? 'scale(0.985)' : undefined,
                      }}
                      onClick={() => {
                        clearTimelineSelection()
                        setSelectedDepartmentId(department.id)
                      }}
                      onMouseEnter={event => {
                        if (draggingDepartmentId) return
                        event.currentTarget.style.transform = 'translateY(-3px)'
                        event.currentTarget.style.boxShadow = `0 10px 28px rgba(15,23,42,0.11)`
                        event.currentTarget.style.borderColor = deptColor(department.id)
                      }}
                      onMouseLeave={event => {
                        if (draggingDepartmentId) return
                        event.currentTarget.style.transform = isDragging ? 'scale(0.985)' : 'none'
                        event.currentTarget.style.boxShadow = 'none'
                        event.currentTarget.style.borderColor = PANEL_BORDER
                      }}
                    >
                      <div style={{ minWidth: 0, display: 'grid', gap: 14 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flex: 1 }}>
                            <span
                              className={activeDeptIds.has(department.id) ? 'dept-dot-active' : undefined}
                              style={{ width: 8, height: 8, borderRadius: 999, background: deptColor(department.id), flexShrink: 0, display: 'inline-block' }}
                            />
                            <h3 style={{ margin: 0, ...DEPARTMENT_NAME_STYLE, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{department.name}</h3>
                          </div>
                          <span
                            aria-hidden="true"
                            title="Drag to reorder"
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              width: 26,
                              height: 26,
                              borderRadius: 8,
                              color: '#9CA3AF',
                              flexShrink: 0,
                              cursor: 'grab',
                              background: 'transparent',
                              transition: 'color 0.15s ease, background 0.15s ease, transform 0.15s ease',
                            }}
                            onMouseEnter={event => {
                              event.currentTarget.style.color = '#F97316'
                              event.currentTarget.style.background = '#FFF7ED'
                              event.currentTarget.style.transform = 'scale(1.04)'
                            }}
                            onMouseLeave={event => {
                              event.currentTarget.style.color = '#9CA3AF'
                              event.currentTarget.style.background = 'transparent'
                              event.currentTarget.style.transform = 'none'
                            }}
                          >
                            <GripVertical size={16} strokeWidth={2.2} />
                          </span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                            <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, borderRadius: 999, background: '#FFF7ED', color: '#EA580C', flexShrink: 0 }}>
                              <UserCog size={14} />
                            </span>
                            <span style={{ color: '#111827', fontSize: 15, fontWeight: 600 }}>{deptManagerList.length}</span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                            <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, borderRadius: 999, background: '#F3F4F6', color: '#4B5563', flexShrink: 0 }}>
                              <UserRound size={14} />
                            </span>
                            <span style={{ color: '#111827', fontSize: 15, fontWeight: 600 }}>{employeeCount}</span>
                          </div>
                        </div>
                      </div>
                    </article>
                  )
                })}
              </div>
              <div style={{ display: 'flex', justifyContent: 'center' }}>
                <button
                  type="button"
                  onClick={() => openAiShiftModal(null)}
                  style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7, border: 0, borderRadius: 10, background: 'linear-gradient(135deg, #7C3AED, #6D28D9)', color: '#FFFFFF', height: 36, padding: '0 24px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
                >
                  <Sparkles size={14} /> AI Schedule
                </button>
              </div>
              </>
            )}
          </div>
        </section>

        <section className="shift-timeline-panel" style={{ background: '#FFFFFF', border: `1px solid ${PANEL_BORDER}`, borderRadius: 14, display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '14px 18px', borderBottom: `1px solid ${PANEL_BORDER}`, flexWrap: 'wrap', flexShrink: 0 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 30, height: 30, borderRadius: 9, background: '#FFF7ED', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <CalendarDays size={15} style={{ color: '#F97316' }} />
                </div>
                <span style={SECTION_TITLE_STYLE}>Shift Timeline</span>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <div ref={timelineControlsRef} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                {shiftViewMode === 'calendar' ? (
                  // Calendar week navigation — no Today button, no date picker
                  (() => {
                    const anchor = new Date(`${timelineDate}T00:00:00`)
                    const dow = (anchor.getDay() + 6) % 7  // 0=Mon … 6=Sun
                    const mon = new Date(anchor); mon.setDate(anchor.getDate() - dow)
                    const sun = new Date(mon); sun.setDate(mon.getDate() + 6)
                    const fmt = (d: Date) => `${String(d.getDate()).padStart(2,'0')} ${d.toLocaleDateString('en-AU',{month:'short'})}`
                    const weekLabel = `${fmt(mon)} – ${fmt(sun)} ${sun.getFullYear()}`
                    const goWeek = (dir: number) => setTimelineDateAndClearSelection(formatDateKey(addDays(mon, dir * 7)))
                    // Earliest allowed week: the Monday of the week containing minDate
                    const minAnchor = new Date(`${minDate}T00:00:00`)
                    const minDow = (minAnchor.getDay() + 6) % 7
                    const minMon = new Date(minAnchor); minMon.setDate(minAnchor.getDate() - minDow)
                    const canGoPrev = mon > minMon
                    return (
                      <>
                        <button type="button" onClick={() => goWeek(-1)} disabled={!canGoPrev} style={{ ...iconButtonStyle, opacity: canGoPrev ? 1 : 0.3, cursor: canGoPrev ? 'pointer' : 'default' }}><ChevronLeft size={16} /></button>
                        <span style={{ fontSize: 13, fontWeight: 500, color: TEXT_DARK, padding: '0 12px', minWidth: 176, textAlign: 'center', height: 38, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, border: `1px solid ${PANEL_BORDER}`, borderRadius: 9, background: '#FFFFFF', fontFamily: 'var(--font-body), system-ui, sans-serif' }}><CalendarDays size={14} color="#64748B" style={{ flexShrink: 0 }} />{weekLabel}</span>
                        <button type="button" onClick={() => goWeek(1)} style={iconButtonStyle}><ChevronRight size={16} /></button>
                      </>
                    )
                  })()
                ) : (
                  <button type="button" onClick={() => setTimelineDateAndClearSelection(formatDateKey(new Date()))} style={{ height: 38, padding: '0 14px', border: `1px solid ${PANEL_BORDER}`, borderRadius: 8, background: timelineDate === formatDateKey(new Date()) ? '#F97316' : '#FFFFFF', color: timelineDate === formatDateKey(new Date()) ? '#FFFFFF' : TEXT_DARK, fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: 'background 0.15s, color 0.15s' }}>Today</button>
                )}
                {shiftViewMode !== 'calendar' && (
                  <>
                    <button type="button" onClick={() => setTimelineByOffset(-1)} disabled={timelineDate <= minDate} style={{ ...iconButtonStyle, opacity: timelineDate <= minDate ? 0.3 : 1, cursor: timelineDate <= minDate ? 'default' : 'pointer' }}><ChevronLeft size={16} /></button>
                    <TimelineDatePicker value={timelineDate} onChange={setTimelineDateAndClearSelection} shiftDates={datesWithShifts} anchorRef={timelineControlsRef} minDate={minDate} />
                    <button type="button" onClick={() => setTimelineByOffset(1)} style={iconButtonStyle}><ChevronRight size={16} /></button>
                  </>
                )}
              </div>
              {shiftViewMode !== 'calendar' && <DropdownMenu>
                <DropdownMenuTrigger
                  data-testid="shift-timeline-menu"
                  aria-label="Timeline options"
                  style={{ ...iconButtonStyle, width: 38, height: 38 }}
                >
                  <MoreHorizontal size={16} />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" sideOffset={10} style={{ width: 280, borderRadius: 16, padding: 16, border: `1px solid ${PANEL_BORDER}`, background: '#FFFFFF', boxShadow: '0 4px 24px rgba(0,0,0,0.10)' }}>
                  <p style={{ margin: '0 0 10px', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#9CA3AF' }}>Time Window</p>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 14 }}>
                    {[
                      {
                        label: 'Auto-fit',
                        onClick: () => { setRangeStartHour(autoFitRange.from); setRangeEndHour(autoFitRange.to); setIsAutoFit(true) },
                        active: isAutoFit,
                      },
                      {
                        label: 'Full day',
                        onClick: () => { setRangeStartHour(0); setRangeEndHour(24); setIsAutoFit(false) },
                        active: !isAutoFit && rangeStartHour === 0 && rangeEndHour === 24,
                      },
                    ].map(option => (
                      <button
                        key={option.label}
                        type="button"
                        onClick={option.onClick}
                        style={{
                          cursor: 'pointer',
                          borderRadius: 10,
                          border: option.active ? '1.5px solid #FDBA74' : `1px solid ${PANEL_BORDER}`,
                          background: option.active ? '#FFF7ED' : '#F9FAFB',
                          padding: '8px 6px',
                          textAlign: 'center',
                        }}
                      >
                        <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: option.active ? '#EA580C' : '#374151' }}>{option.label}</p>
                      </button>
                    ))}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    {[
                      { label: 'From', val: rangeStartHour, dec: () => { setIsAutoFit(false); setRangeStartHour(Math.max(0, rangeStartHour - 1)) }, inc: () => { setIsAutoFit(false); setRangeStartHour(Math.min(rangeEndHour - 1, rangeStartHour + 1)) } },
                      { label: 'To', val: rangeEndHour, dec: () => { setIsAutoFit(false); setRangeEndHour(Math.max(rangeStartHour + 1, rangeEndHour - 1)) }, inc: () => { setIsAutoFit(false); setRangeEndHour(Math.min(24, rangeEndHour + 1)) } },
                    ].map(control => (
                      <div key={control.label}>
                        <p style={{ margin: '0 0 6px', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#9CA3AF' }}>{control.label}</p>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <button type="button" onClick={control.dec} aria-label={`Decrease ${control.label}`} style={{ width: 28, height: 28, borderRadius: 7, border: `1px solid ${PANEL_BORDER}`, background: '#F9FAFB', cursor: 'pointer', fontSize: 14, color: MUTED, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>−</button>
                          <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: TEXT_DARK, textAlign: 'center' }}>{formatHourLabel(control.val)}</span>
                          <button type="button" onClick={control.inc} aria-label={`Increase ${control.label}`} style={{ width: 28, height: 28, borderRadius: 7, border: `1px solid ${PANEL_BORDER}`, background: '#F9FAFB', cursor: 'pointer', fontSize: 14, color: MUTED, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>+</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </DropdownMenuContent>
              </DropdownMenu>}
            </div>
          </div>
          {shiftViewMode === 'calendar' ? renderCalendarView() : renderTimeline()}
        </section>
              </div>
            </>
          )}
        </div>
      </main>

      {/* ═══════════════ USER PROFILE SUMMARY DRAWER ═══════════════ */}
      {false && (
        <div>
          <div>
            <div style={{ padding: '18px 20px', borderBottom: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                <span style={{ width: 32, height: 32, borderRadius: 8, background: '#FFF7ED', color: OWNER_ORANGE, display: 'grid', placeItems: 'center' }}>
                  <UserCog size={15} />
                </span>
                <div>
                  <p style={{ margin: 0, fontWeight: 800, fontSize: 14, color: TEXT_DARK }}>{profileSummary?.full_name ?? '…'}</p>
                  <p style={{ margin: '1px 0 0', fontSize: 11, color: MUTED, fontWeight: 600 }}>{profileSummary?.role ?? ''}</p>
                </div>
              </div>
              <button type="button" onClick={() => setProfileDrawerUserId(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: MUTED, display: 'grid', placeItems: 'center' }}><X size={16} /></button>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 20 }}>
              {profileSummaryLoading ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 120, color: MUTED, gap: 8, fontSize: 13 }}>
                  <Spinner dark /> Loading…
                </div>
              ) : profileSummary ? (
                <>
                  {/* Weekly Hours */}
                  <div>
                    <p style={{ margin: '0 0 8px', fontSize: 11, fontWeight: 800, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Weekly Hours</p>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                      {([
                        { label: 'Used this week', value: profileSummary.weekly_working_hours, color: '#F97316', bg: '#FFF7ED' },
                        { label: 'Max allowed', value: profileSummary.max_weekly_hours, color: '#2563EB', bg: '#EFF6FF' },
                        { label: 'Contracted', value: profileSummary.contracted_weekly_hours, color: '#16A34A', bg: '#DCFCE7' },
                      ] as const).map(card => (
                        <div key={card.label} style={{ background: card.bg, borderRadius: 8, padding: '10px 8px 8px', textAlign: 'center' }}>
                          <p style={{ margin: 0, fontSize: 20, fontWeight: 800, color: card.color }}>{card.value != null ? `${card.value}h` : '—'}</p>
                          <p style={{ margin: '3px 0 0', fontSize: 10, fontWeight: 700, color: card.color, opacity: 0.7, textTransform: 'uppercase', letterSpacing: '0.04em', lineHeight: 1.3 }}>{card.label}</p>
                        </div>
                      ))}
                    </div>
                    {profileSummary.max_weekly_hours != null && profileSummary.weekly_working_hours != null && (
                      <div style={{ marginTop: 10 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                          <span style={{ fontSize: 11, color: MUTED, fontWeight: 600 }}>Remaining this week</span>
                          <span style={{ fontSize: 11, fontWeight: 800, color: TEXT_DARK }}>{Math.max(0, profileSummary.max_weekly_hours - profileSummary.weekly_working_hours)}h left</span>
                        </div>
                        <div style={{ height: 6, borderRadius: 999, background: '#E2E8F0', overflow: 'hidden' }}>
                          <div style={{ height: '100%', borderRadius: 999, background: OWNER_ORANGE, width: `${Math.min(100, (profileSummary.weekly_working_hours / profileSummary.max_weekly_hours) * 100)}%` }} />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Fixed Off Days */}
                  <div>
                    <p style={{ margin: '0 0 8px', fontSize: 11, fontWeight: 800, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Fixed Off Days</p>
                    {profileSummary.fixed_off_days.length === 0 ? (
                      <p style={{ margin: 0, fontSize: 13, color: MUTED }}>No fixed off days set.</p>
                    ) : (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map((day, i) => {
                          const isOff = profileSummary.fixed_off_days.includes(i)
                          return (
                            <span key={day} style={{ height: 28, padding: '0 12px', borderRadius: 999, fontSize: 12, fontWeight: 700, display: 'inline-flex', alignItems: 'center', background: isOff ? '#FEF2F2' : '#F1F5F9', color: isOff ? '#B91C1C' : '#94A3B8', border: `1px solid ${isOff ? '#FECACA' : '#E2E8F0'}` }}>
                              {day}
                            </span>
                          )
                        })}
                      </div>
                    )}
                  </div>

                  {/* Leave Requests */}
                  <div>
                    <p style={{ margin: '0 0 8px', fontSize: 11, fontWeight: 800, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Leave Requests</p>
                    {profileSummary.leave_requests.length === 0 ? (
                      <p style={{ margin: 0, fontSize: 13, color: MUTED }}>No leave requests.</p>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {profileSummary.leave_requests.map(req => {
                          const sMap: Record<string, { bg: string; color: string }> = {
                            pending:  { bg: '#FFFBEB', color: '#B45309' },
                            approved: { bg: '#ECFDF5', color: '#047857' },
                            rejected: { bg: '#FEF2F2', color: '#B91C1C' },
                          }
                          const s = sMap[req.status] ?? { bg: '#F1F5F9', color: MUTED }
                          return (
                            <div key={req.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px', borderRadius: 7, background: '#F8FAFC', border: '1px solid #E2E8F0', gap: 8 }}>
                              <div style={{ minWidth: 0 }}>
                                <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: TEXT_DARK, textTransform: 'capitalize' }}>{req.request_type.replace('_', ' ')}</p>
                                {req.reason && <p style={{ margin: '1px 0 0', fontSize: 11, color: MUTED, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{req.reason}</p>}
                              </div>
                              <span style={{ flexShrink: 0, height: 20, padding: '0 8px', borderRadius: 999, fontSize: 10, fontWeight: 800, display: 'inline-flex', alignItems: 'center', background: s.bg, color: s.color, textTransform: 'capitalize' }}>{req.status}</span>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <p style={{ color: MUTED, fontSize: 13 }}>Failed to load profile.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════ AI SHIFT SCHEDULING MODAL ═══════════════ */}      {aiShiftModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, animation: 'overlayFadeIn 0.18s ease-out' }}>
          <div onClick={e => e.stopPropagation()} style={{ width: aiShiftWizardStep === 'generate' && aiShiftSuggestions.length > 0 ? 920 : 360, maxWidth: 'calc(100% - 32px)', maxHeight: '90vh', background: '#FFFFFF', borderRadius: 20, boxShadow: '0 24px 64px rgba(0,0,0,0.16), 0 4px 16px rgba(0,0,0,0.08)', display: 'flex', flexDirection: 'column', overflow: 'hidden', flexShrink: 0, transition: 'width 0.25s ease', animation: 'modalSlideIn 0.22s cubic-bezier(0.16,1,0.3,1)' }}>
            {(() => {
              const AI_WIZARD_STEPS = ['dates', 'departments', 'shiftTypes', 'generate'] as const
              const stepIdx = AI_WIZARD_STEPS.indexOf(aiShiftWizardStep)
              const stepLabel: Record<typeof AI_WIZARD_STEPS[number], string> = {
                dates: 'Dates',
                departments: 'Departments',
                shiftTypes: 'Shift',
                generate: 'Generate',
              }
              const canContinueFromDates = !!aiShiftDateFrom && !!aiShiftDateTo
              const canContinueFromDepartments = aiShiftSelectedDepartmentIds.length > 0
              const canContinueFromShiftTypes = aiShiftTypes.length > 0
              return (
                <>
                  <div style={{ padding: '20px 24px 18px', borderBottom: '1px solid #F3F4F6', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 32, height: 32, borderRadius: 9, background: 'linear-gradient(135deg, #7C3AED, #6D28D9)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <Sparkles size={15} color="#FFFFFF" strokeWidth={2.5} />
                      </div>
                      <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#111827', fontFamily: "'Inter', system-ui, -apple-system, sans-serif" }}>Auto Shift Scheduling</h2>
                    </div>
                    <button
                      onClick={closeAiShiftModal}
                      style={{ background: '#F9FAFB', border: '1px solid #E5E7EB', cursor: 'pointer', color: '#6B7280', display: 'flex', padding: '6px', borderRadius: 8, flexShrink: 0 }}
                      onMouseEnter={e => { e.currentTarget.style.background = '#F3F4F6' }}
                      onMouseLeave={e => { e.currentTarget.style.background = '#F9FAFB' }}
                    ><X size={16} /></button>
                  </div>

                  <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 28 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      {AI_WIZARD_STEPS.map((s, i) => {
                        const isDone = stepIdx > i
                        return (
                          <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                            {isDone ? (
                              <button
                                type="button"
                                onClick={() => setAiShiftWizardStep(s)}
                                title="Back"
                                aria-label={`Back to ${stepLabel[s]}`}
                                className="ai-wizard-back-circle"
                                style={{ width: 24, height: 24, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, border: 'none', background: '#F5F3FF', color: '#7C3AED', padding: 0, cursor: 'pointer' }}
                              >
                                <ChevronLeft size={14} strokeWidth={2.75} />
                              </button>
                            ) : (
                              <div style={{ width: 20, height: 20, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, background: aiShiftWizardStep === s ? '#7C3AED' : '#F3F4F6', color: aiShiftWizardStep === s ? '#FFF' : '#9CA3AF', flexShrink: 0 }}>
                                {i + 1}
                              </div>
                            )}
                            {aiShiftWizardStep === s && (
                              <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#111827' }}>{stepLabel[s]}</span>
                            )}
                            {i < AI_WIZARD_STEPS.length - 1 && <div style={{ width: 16, height: 1.5, background: '#E5E7EB', margin: '0 1px' }} />}
                          </div>
                        )
                      })}
                    </div>

                    <div key={aiShiftWizardStep} style={{ display: 'flex', flexDirection: 'column', gap: 20, animation: 'tabContentIn 0.22s ease-out' }}>
                    {aiShiftWizardStep === 'dates' && (
                      <div style={{ display: 'flex', gap: 12 }}>
                        <div style={{ flex: 1 }}>
                          <label style={modalLabelStyle}>From</label>
                          <TimelineDatePicker
                            value={normalizeDateInput(aiShiftDateFrom)}
                            onChange={date => {
                              setAiShiftDateFrom(date)
                              if (aiShiftDateTo && date > aiShiftDateTo) setAiShiftDateTo(date)
                            }}
                            shiftDates={EMPTY_DATE_SET}
                            minDate={formatDateKey(new Date())}
                            accentColor="#7C3AED"
                            triggerStyle={{ width: '100%' }}
                          />
                        </div>
                        <div style={{ flex: 1 }}>
                          <label style={modalLabelStyle}>To</label>
                          <TimelineDatePicker
                            value={normalizeDateInput(aiShiftDateTo)}
                            onChange={setAiShiftDateTo}
                            shiftDates={EMPTY_DATE_SET}
                            minDate={aiShiftDateFrom ? normalizeDateInput(aiShiftDateFrom) : formatDateKey(new Date())}
                            accentColor="#7C3AED"
                            triggerStyle={{ width: '100%' }}
                          />
                        </div>
                      </div>
                    )}

                    {aiShiftWizardStep === 'departments' && (
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, gap: 12, flexWrap: 'wrap' }}>
                          <label style={{ ...modalLabelStyle, marginBottom: 0 }}>
                            Departments
                          </label>
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button
                              type="button"
                              onClick={() => setAiShiftSelectedDepartmentIds(departments.map(dept => dept.id))}
                              title="Select all"
                              aria-label="Select all"
                              style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 26, height: 26, borderRadius: 7, background: 'none', border: '1px solid #E5E7EB', color: '#7C3AED', cursor: 'pointer' }}
                            ><CheckCheck size={13} /></button>
                            <button
                              type="button"
                              onClick={() => setAiShiftSelectedDepartmentIds([])}
                              title="Clear"
                              aria-label="Clear"
                              style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 26, height: 26, borderRadius: 7, background: 'none', border: '1px solid #E5E7EB', color: '#9CA3AF', cursor: 'pointer' }}
                            ><X size={13} /></button>
                          </div>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
                          {departments.map(dept => {
                            const checked = aiShiftSelectedDepartmentIds.includes(dept.id)
                            return (
                              <button key={dept.id} type="button" onClick={() => setAiShiftSelectedDepartmentIds(prev => prev.includes(dept.id) ? prev.filter(id => id !== dept.id) : [...prev, dept.id])} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '10px 12px', borderRadius: 10, border: '1.5px solid #E5E7EB', background: '#FFFFFF', cursor: 'pointer', textAlign: 'left' }}>
                                <span style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                                  <span style={{ width: 8, height: 8, borderRadius: 999, background: deptColor(dept.id), flexShrink: 0 }} />
                                  <span style={{ fontSize: 13, fontWeight: 600, color: '#111827', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{dept.name}</span>
                                </span>
                                <span style={{ width: 18, height: 18, borderRadius: 6, border: `2px solid ${checked ? '#7C3AED' : '#D1D5DB'}`, background: checked ? '#7C3AED' : 'transparent', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{checked && <Check size={11} color="#FFFFFF" strokeWidth={3} />}</span>
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    )}

                    {aiShiftWizardStep === 'shiftTypes' && (
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, gap: 12 }}>
                          <label style={{ ...modalLabelStyle, marginBottom: 0 }}>Shift</label>
                          <button
                            type="button"
                            onClick={() => setAiShiftTypes(prev => [...prev, { label: `Shift ${prev.length + 1}`, start_time: '09:00', end_time: '17:00' }])}
                            aria-label="Add shift"
                            title="Add shift"
                            style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 26, height: 26, borderRadius: 7, background: 'none', border: '1px solid #E5E7EB', color: '#7C3AED', cursor: 'pointer' }}
                          >
                            <Plus size={14} strokeWidth={2.5} />
                          </button>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 8 }}>
                          {aiShiftTypes.map((shift, index) => (
                            <div key={index} style={{ position: 'relative', border: '1px solid #E5E7EB', background: '#FFFFFF', borderRadius: 10, padding: '10px 12px' }}>
                              {aiShiftTypes.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() => setAiShiftTypes(prev => prev.filter((_, i) => i !== index))}
                                  aria-label="Remove shift"
                                  style={{ position: 'absolute', top: 8, right: 8, width: 20, height: 20, border: 'none', borderRadius: 6, background: '#F9FAFB', color: '#9CA3AF', cursor: 'pointer', display: 'grid', placeItems: 'center' }}
                                  onMouseEnter={e => { e.currentTarget.style.background = '#FEF2F2'; e.currentTarget.style.color = '#DC2626' }}
                                  onMouseLeave={e => { e.currentTarget.style.background = '#F9FAFB'; e.currentTarget.style.color = '#9CA3AF' }}
                                >
                                  <X size={12} strokeWidth={2.5} />
                                </button>
                              )}
                              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                                <div><label style={labelStyle}>Start time</label><TimePicker value={shift.start_time} onChange={value => setAiShiftTypes(prev => prev.map((item, i) => i === index ? { ...item, start_time: value } : item))} /></div>
                                <div><label style={labelStyle}>End time</label><TimePicker value={shift.end_time} onChange={value => setAiShiftTypes(prev => prev.map((item, i) => i === index ? { ...item, end_time: value } : item))} /></div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {aiShiftWizardStep === 'dates' && (
                      <button type="button" onClick={() => setAiShiftWizardStep('departments')} disabled={!canContinueFromDates} style={{ alignSelf: 'flex-end', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, padding: '9px 20px', background: !canContinueFromDates ? '#EDE9FE' : 'linear-gradient(135deg, #7C3AED, #6D28D9)', border: 'none', borderRadius: 8, fontWeight: 600, fontSize: '0.8125rem', color: !canContinueFromDates ? '#A78BFA' : '#FFFFFF', cursor: !canContinueFromDates ? 'default' : 'pointer' }}>
                        Continue
                      </button>
                    )}
                    {aiShiftWizardStep === 'departments' && (
                      <button type="button" onClick={() => setAiShiftWizardStep('shiftTypes')} disabled={!canContinueFromDepartments} style={{ alignSelf: 'flex-end', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, padding: '9px 20px', background: !canContinueFromDepartments ? '#EDE9FE' : 'linear-gradient(135deg, #7C3AED, #6D28D9)', border: 'none', borderRadius: 8, fontWeight: 600, fontSize: '0.8125rem', color: !canContinueFromDepartments ? '#A78BFA' : '#FFFFFF', cursor: !canContinueFromDepartments ? 'default' : 'pointer' }}>
                        Continue
                      </button>
                    )}
                    {aiShiftWizardStep === 'shiftTypes' && (
                      <button type="button" onClick={() => setAiShiftWizardStep('generate')} disabled={!canContinueFromShiftTypes} style={{ alignSelf: 'flex-end', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, padding: '9px 20px', background: !canContinueFromShiftTypes ? '#EDE9FE' : 'linear-gradient(135deg, #7C3AED, #6D28D9)', border: 'none', borderRadius: 8, fontWeight: 600, fontSize: '0.8125rem', color: !canContinueFromShiftTypes ? '#A78BFA' : '#FFFFFF', cursor: !canContinueFromShiftTypes ? 'default' : 'pointer' }}>
                        Continue
                      </button>
                    )}

                    {aiShiftWizardStep === 'generate' && aiShiftSuggestions.length === 0 && !aiShiftLoading && (
                      <button type="button" onClick={handleAiGenerateShifts} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, padding: '11px 14px', background: 'linear-gradient(135deg, #7C3AED, #6D28D9)', border: 'none', borderRadius: 8, fontWeight: 600, fontSize: '0.8125rem', color: '#FFFFFF', cursor: 'pointer' }}>
                        <Sparkles size={13} strokeWidth={2.5} />
                        Generate Schedule with AI
                      </button>
                    )}

                    {aiShiftWizardStep === 'generate' && aiShiftLoading && (
                      <div style={{ width: '100%', height: 8, borderRadius: 999, background: '#EDE9FE', overflow: 'hidden' }}>
                        <div style={{ width: `${aiShiftProgress}%`, height: '100%', borderRadius: 999, background: 'linear-gradient(135deg, #7C3AED, #6D28D9)', transition: 'width 0.2s linear' }} />
                      </div>
                    )}

                    {aiShiftWizardStep === 'generate' && aiShiftError && <div style={{ padding: '10px 14px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, fontSize: '0.875rem', color: '#DC2626' }}>{aiShiftError}</div>}
                    {aiShiftWizardStep === 'generate' && aiShiftNotice && <div style={{ padding: '10px 14px', background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 8, fontSize: '0.875rem', color: '#92400E', fontWeight: 600, lineHeight: 1.45 }}>{aiShiftNotice}</div>}

                    {aiShiftWizardStep === 'generate' && aiShiftSuggestions.length > 0 && (() => {
                      const allDates = Array.from(new Set(aiShiftSuggestions.map(b => b.shift_date))).sort()
                      const weekStartDates: string[] = []
                      for (let i = 0; i < allDates.length; i += 7) weekStartDates.push(allDates[i])
                      const clampedWeekOffset = Math.min(aiResultWeekOffset, Math.max(0, weekStartDates.length - 1))
                      const weekDates = allDates.slice(clampedWeekOffset * 7, clampedWeekOffset * 7 + 7)

                      type PersonRow = { key: string; name: string; deptId: string; deptName: string; isUnassigned: boolean }
                      const rowMap = new Map<string, PersonRow>()
                      for (const block of aiShiftSuggestions) {
                        for (const slot of block.slots) {
                          const rowKey = slot.assigned_user_id ?? `unassigned_${block.department_id}`
                          if (!rowMap.has(rowKey)) {
                            rowMap.set(rowKey, {
                              key: rowKey,
                              name: slot.assigned_user_name ?? 'Unassigned',
                              deptId: block.department_id,
                              deptName: block.department_name,
                              isUnassigned: !slot.assigned_user_id,
                            })
                          }
                        }
                      }
                      const rows = Array.from(rowMap.values()).sort((a, b) => {
                        if (a.isUnassigned !== b.isUnassigned) return a.isUnassigned ? 1 : -1
                        if (a.deptName !== b.deptName) return a.deptName.localeCompare(b.deptName)
                        return a.name.localeCompare(b.name)
                      })

                      const cellsFor = (rowKey: string, date: string) => {
                        const out: { block: AutoShiftBlock; slot: AiShiftSlot }[] = []
                        for (const block of aiShiftSuggestions) {
                          if (block.shift_date !== date) continue
                          for (const slot of block.slots) {
                            const slotKey = slot.assigned_user_id ?? `unassigned_${block.department_id}`
                            if (slotKey === rowKey) out.push({ block, slot })
                          }
                        }
                        return out
                      }

                      return (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                            <p style={{ margin: 0, fontSize: '0.72rem', fontWeight: 700, color: '#7C3AED', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{aiShiftSuggestions.length} schedule block{aiShiftSuggestions.length !== 1 ? 's' : ''} suggested</p>
                            <div style={{ display: 'flex', gap: 10 }}>
                              <button type="button" onClick={() => setAiShiftSelected(new Set(aiShiftSuggestions.map(block => block.key)))} style={{ fontSize: '0.75rem', fontWeight: 700, color: '#7C3AED', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>Select all</button>
                              <button type="button" onClick={() => setAiShiftSelected(new Set())} style={{ fontSize: '0.75rem', fontWeight: 700, color: '#9CA3AF', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>Clear</button>
                              <button type="button" onClick={handleAiGenerateShifts} disabled={aiShiftLoading} style={{ fontSize: '0.75rem', fontWeight: 700, color: '#F97316', background: 'none', border: 'none', cursor: aiShiftLoading ? 'default' : 'pointer', padding: 0, opacity: aiShiftLoading ? 0.5 : 1 }}>Regenerate</button>
                            </div>
                          </div>

                          {weekStartDates.length > 1 && (
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
                              <button type="button" onClick={() => setAiResultWeekOffset(o => Math.max(0, o - 1))} disabled={clampedWeekOffset === 0} style={{ width: 28, height: 28, border: '1px solid #E5E7EB', borderRadius: 7, background: '#FFFFFF', cursor: clampedWeekOffset === 0 ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: clampedWeekOffset === 0 ? '#D1D5DB' : '#64748B' }}><ChevronLeft size={14} /></button>
                              <span style={{ fontSize: 12, fontWeight: 700, color: '#374151' }}>
                                Week {clampedWeekOffset + 1} of {weekStartDates.length} — {prettyDate(weekDates[0])} to {prettyDate(weekDates[weekDates.length - 1])}
                              </span>
                              <button type="button" onClick={() => setAiResultWeekOffset(o => Math.min(weekStartDates.length - 1, o + 1))} disabled={clampedWeekOffset === weekStartDates.length - 1} style={{ width: 28, height: 28, border: '1px solid #E5E7EB', borderRadius: 7, background: '#FFFFFF', cursor: clampedWeekOffset === weekStartDates.length - 1 ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: clampedWeekOffset === weekStartDates.length - 1 ? '#D1D5DB' : '#64748B' }}><ChevronRight size={14} /></button>
                            </div>
                          )}

                          <div style={{ overflowX: 'auto' }}>
                            <div style={{ minWidth: 700, borderRadius: 12, overflow: 'hidden', border: `1px solid ${PANEL_BORDER}` }}>
                              <div style={{ display: 'grid', gridTemplateColumns: `${TL_NAME_COL}px repeat(${weekDates.length}, 1fr)`, background: 'linear-gradient(135deg, #0F172A 0%, #1E293B 100%)', height: 54 }}>
                                <div style={{ borderRight: '1px solid rgba(255,255,255,0.08)' }} />
                                {weekDates.map(date => {
                                  const d = new Date(`${date}T00:00:00`)
                                  return (
                                    <div key={date} style={{ padding: '8px 6px', borderRight: '1px solid rgba(255,255,255,0.08)', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                                      <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,0.85)', lineHeight: 1.2 }}>{d.toLocaleDateString('en-AU', { day: '2-digit', month: 'short' })}</p>
                                      <p style={{ margin: '2px 0 0', fontSize: 11, fontWeight: 500, color: 'rgba(255,255,255,0.5)', lineHeight: 1.2 }}>{d.toLocaleDateString('en-AU', { weekday: 'short' })}</p>
                                    </div>
                                  )
                                })}
                              </div>
                              <div>
                                {rows.map((row, rowIdx) => {
                                  const barColor = row.isUnassigned ? '#9CA3AF' : deptColor(row.deptId)
                                  return (
                                    <div key={row.key} style={{ display: 'grid', gridTemplateColumns: `${TL_NAME_COL}px repeat(${weekDates.length}, 1fr)`, borderTop: rowIdx === 0 ? 'none' : `1px solid ${PANEL_BORDER}`, background: '#FFFFFF', minHeight: 58 }}>
                                      <div style={{ display: 'flex', alignItems: 'center', borderRight: `1px solid ${PANEL_BORDER}`, overflow: 'hidden' }}>
                                        <div style={{ width: 8, alignSelf: 'stretch', flexShrink: 0, background: barColor, opacity: 0.85 }} />
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 10px 0 12px', minWidth: 0, flex: 1 }}>
                                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 26, height: 26, flexShrink: 0, background: row.isUnassigned ? '#F3F4F6' : '#FFF7ED', color: row.isUnassigned ? '#9CA3AF' : '#EA580C', borderRadius: 999 }}>
                                            <UserRound size={13} />
                                          </div>
                                          <div style={{ minWidth: 0 }}>
                                            <span style={{ ...MEMBER_NAME_STYLE, display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{row.name}</span>
                                            <span style={{ fontSize: 10.5, fontWeight: 600, color: '#9CA3AF', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'block' }}>{row.deptName}</span>
                                          </div>
                                        </div>
                                      </div>
                                      {weekDates.map(date => {
                                        const cells = cellsFor(row.key, date)
                                        return (
                                          <div key={date} style={{ padding: '6px', borderRight: `1px solid ${PANEL_BORDER}`, display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'stretch', justifyContent: 'center' }}>
                                            {cells.length === 0 ? (
                                              <div style={{ borderRadius: 999, background: '#F3F4F6', height: 24 }} />
                                            ) : cells.map(({ block, slot }, i) => {
                                              const checked = aiShiftSelected.has(block.key)
                                              return (
                                                <button
                                                  key={`${block.key}_${slot.shift_label}_${i}`}
                                                  type="button"
                                                  onClick={() => setAiShiftSelected(prev => { const next = new Set(prev); if (next.has(block.key)) next.delete(block.key); else next.add(block.key); return next })}
                                                  title={`${slot.shift_label} ${formatShiftHour(slot.start_time)}–${formatShiftHour(slot.end_time)}: ${slot.reason}`}
                                                  style={{
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                                                    padding: '0 6px', height: 26, flexShrink: 0,
                                                    background: checked ? deptColor(block.department_id) : '#FFFFFF',
                                                    border: `1.5px solid ${checked ? deptColor(block.department_id) : '#E5E7EB'}`,
                                                    borderRadius: 999, cursor: 'pointer', width: '100%',
                                                    opacity: block.warning ? 0.75 : 1,
                                                  }}
                                                >
                                                  {block.warning && <AlertTriangle size={10} color={checked ? '#FFFFFF' : '#D97706'} />}
                                                  <span style={{ fontSize: 10, fontWeight: 700, color: checked ? '#FFFFFF' : '#374151', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                    {formatShiftHour(slot.start_time)}–{formatShiftHour(slot.end_time)}
                                                  </span>
                                                </button>
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
                          </div>
                        </div>
                      )
                    })()}

                    {aiShiftWizardStep === 'generate' && aiShiftCreateError && <div style={{ padding: '10px 14px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 9, fontSize: '0.875rem', color: '#DC2626', fontWeight: 600 }}>{aiShiftCreateError}</div>}
                    </div>
                  </div>

                  {aiShiftWizardStep === 'generate' && aiShiftSuggestions.length > 0 && (
                    <div style={{ padding: '0 24px 20px', display: 'flex', justifyContent: 'flex-end', gap: 8, flexShrink: 0 }}>
                      <button
                        type="button"
                        onClick={handleAiCreateShifts}
                        disabled={aiShiftSelected.size === 0 || aiShiftCreateLoading}
                        style={{ padding: '7px 18px', background: aiShiftSelected.size === 0 || aiShiftCreateLoading ? '#A78BFA' : 'linear-gradient(135deg, #7C3AED, #6D28D9)', border: 'none', borderRadius: 8, fontWeight: 600, fontSize: '0.8125rem', color: '#FFFFFF', cursor: aiShiftSelected.size === 0 || aiShiftCreateLoading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 6, opacity: aiShiftSelected.size === 0 || aiShiftCreateLoading ? 0.65 : 1 }}
                      >
                        {aiShiftCreateLoading ? <Spinner size={13} /> : <Check size={13} />}
                        {aiShiftCreateLoading ? 'Creating...' : `Create ${aiShiftSuggestions.filter(block => aiShiftSelected.has(block.key)).reduce((total, block) => total + block.slots.length, 0)} Shifts`}
                      </button>
                    </div>
                  )}
                </>
              )
            })()}
          </div>
        </div>
      )}

      {batchDepartment && (
        <div style={modalOverlayStyle}>
          <div style={{ ...modalStyle, width: 'min(520px, calc(100% - 32px))', padding: 0, display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '20px 24px 18px', borderBottom: '1px solid #F3F4F6', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 32, height: 32, borderRadius: 9, background: 'linear-gradient(135deg, #F97316, #EA580C)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <CalendarDays size={15} color="#fff" strokeWidth={2} />
                </div>
                <h2 style={{ fontWeight: 700, fontSize: '1rem', color: '#111827', margin: 0, fontFamily: "'Inter', system-ui, -apple-system, sans-serif" }}>
                  {batchSingleMember
                    ? `Assign Shift to ${batchSingleMember.full_name}`
                    : selectedMemberIds.length > 0 && new Set(selectedMemberIds.map(id => members.find(m => m.id === id)?.department_id)).size > 1
                      ? `Assign Shifts to Selected (${selectedMemberIds.length})`
                      : `Assign Shift to ${batchDepartment.name}`
                  }
                </h2>
              </div>
              <button
                type="button"
                onClick={closeBatchDrawer}
                style={{ background: '#F9FAFB', border: '1px solid #E5E7EB', cursor: 'pointer', color: '#6B7280', display: 'flex', padding: '6px', borderRadius: 8, flexShrink: 0 }}
                onMouseEnter={e => { e.currentTarget.style.background = '#F3F4F6' }}
                onMouseLeave={e => { e.currentTarget.style.background = '#F9FAFB' }}
              >
                <X size={16} />
              </button>
            </div>
            <div style={{ padding: '20px 24px 4px', overflowY: 'auto', flex: 1 }}>
              {/* Batch mode: People picker */}
              {!batchSingleMember && (
                <div style={{ marginBottom: 20 }}>
                  <p style={{ margin: '0 0 8px', fontWeight: 600, fontSize: '0.875rem', color: '#374151', display: 'block' }}>People</p>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 8 }}>
                    {(batchFromSelection
                      ? members.filter(m => selectedMemberIds.includes(m.id))
                      : (membersByDepartment.get(batchDepartment.id) ?? [])
                    ).map(member => {
                      const active = selectedMemberIds.includes(member.id)
                      const isManager = member.role === 'Manager'
                      return (
                        <button type="button" key={member.id}
                          className="people-chip"
                          data-locked={batchFromSelection ? 'true' : 'false'}
                          onClick={() => { if (!batchFromSelection) toggleBatchMember(member.id) }}
                          style={{ border: active ? `1.5px solid ${OWNER_ORANGE}` : `1px solid ${PANEL_BORDER}`, background: active ? '#FFF7ED' : '#FFFFFF', borderRadius: 10, padding: '10px 12px', textAlign: 'left', cursor: batchFromSelection ? 'default' : 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                            <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, borderRadius: 999, background: isManager ? '#FFF7ED' : '#F3F4F6', color: isManager ? '#EA580C' : '#4B5563', flexShrink: 0 }}>
                              {isManager ? <UserCog size={13} /> : <UserRound size={13} />}
                            </span>
                            <div style={{ minWidth: 0 }}>
                            <p style={{ margin: 0, ...MEMBER_NAME_STYLE, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{member.full_name}</p>
                              <p style={{ margin: '2px 0 0', color: '#94A3B8', fontSize: 11, fontWeight: 600 }}>{member.role}</p>
                            </div>
                          </div>
                          {active && <Check size={15} color={OWNER_ORANGE} style={{ flexShrink: 0 }} />}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Step 2 placeholder: shown only when no people selected yet */}
              {!batchSingleMember && calMonth && selectedMemberIds.length === 0 && (
                <div style={{ marginBottom: 20, background: '#F8FAFC', borderRadius: 14, padding: '24px 18px', border: `1.5px dashed ${PANEL_BORDER}`, textAlign: 'center' }}>
                  <div style={{ marginBottom: 6, display: 'flex', justifyContent: 'center' }}><CalendarDays size={20} color="#CBD5E1" /></div>
                  <p style={{ margin: 0, color: '#94A3B8', fontSize: 13, fontWeight: 600 }}>Select team members above to pick shift dates</p>
                </div>
              )}

              {/* Two-column: Calendar + Shift Hours */}
              {calMonth && (selectedMemberIds.length > 0 || !!batchSingleMember) && (() => {
                const todayStr = formatDateKey(new Date())
                const todayMonthStr = todayStr.slice(0, 7)
                const [cy, cm] = calMonth.split('-').map(Number)
                const firstDay = new Date(cy, cm - 1, 1).getDay()
                const daysInMonth = new Date(cy, cm, 0).getDate()
                const monthLabel = new Date(cy, cm - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
                const canGoPrev = calMonth > todayMonthStr
                const cells: (string | null)[] = []
                for (let i = 0; i < firstDay; i++) cells.push(null)
                for (let d = 1; d <= daysInMonth; d++) cells.push(`${cy}-${String(cm).padStart(2, '0')}-${String(d).padStart(2, '0')}`)
                const goPrev = () => {
                  if (!canGoPrev) return
                  setCalDir('prev')
                  setCalKey(k => k + 1)
                  const d = new Date(cy, cm - 2, 1)
                  setCalMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
                }
                const goNext = () => {
                  setCalDir('next')
                  setCalKey(k => k + 1)
                  const d = new Date(cy, cm, 1)
                  setCalMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
                }
                return (
                  <>
                    <style>{`
                      @keyframes calSlideNext { from { opacity: 0; transform: translateX(18px) } to { opacity: 1; transform: translateX(0) } }
                      @keyframes calSlidePrev { from { opacity: 0; transform: translateX(-18px) } to { opacity: 1; transform: translateX(0) } }
                    `}</style>
                    <div style={{ marginBottom: 20 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 190px', gap: 14, alignItems: 'stretch' }}>
                      {/* Calendar */}
                      <div style={{ background: '#FFFFFF', borderRadius: 14, padding: '12px 14px', border: `1px solid ${PANEL_BORDER}` }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                          <button type="button" onClick={goPrev} disabled={!canGoPrev}
                            style={{ width: 26, height: 26, border: `1px solid ${canGoPrev ? PANEL_BORDER : 'transparent'}`, background: canGoPrev ? '#FFFFFF' : 'transparent', borderRadius: 7, cursor: canGoPrev ? 'pointer' : 'default', display: 'flex', alignItems: 'center', justifyContent: 'center', color: canGoPrev ? MUTED : '#D1D5DB', flexShrink: 0, opacity: canGoPrev ? 1 : 0.3, transition: 'opacity 0.15s' }}>
                            <ChevronLeft size={12} />
                          </button>
                          <span style={{ fontSize: 13, fontWeight: 600, color: TEXT_DARK }}>{monthLabel}</span>
                          <button type="button" onClick={goNext}
                            style={{ width: 26, height: 26, border: `1px solid ${PANEL_BORDER}`, background: '#FFFFFF', borderRadius: 7, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: MUTED, flexShrink: 0 }}>
                            <ChevronRight size={12} />
                          </button>
                        </div>
                        <div key={`hd-${calKey}`} style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 32px)', justifyContent: 'center', marginBottom: 2 }}>
                          {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => (
                            <div key={d} style={{ fontSize: 11, fontWeight: 600, color: '#9CA3AF', textAlign: 'center', height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{d}</div>
                          ))}
                        </div>
                        <div key={`grid-${calKey}`} style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 32px)', justifyContent: 'center', gap: 2, animation: `${calDir === 'next' ? 'calSlideNext' : 'calSlidePrev'} 0.18s ease` }}>
                          {cells.map((date, i) => {
                            if (!date) return <div key={`e-${i}`} style={{ width: 32, height: 32 }} />
                            const isPast = date < todayStr
                            const sel = selectedDates.includes(date)
                            const isToday = date === todayStr
                            const dayNum = new Date(date + 'T00:00:00').getDate()
                            if (isPast) {
                              return (
                                <div key={date} style={{ width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, color: '#D1D5DB', userSelect: 'none' }}>
                                  {dayNum}
                                </div>
                              )
                            }
                            return (
                              <button
                                key={date}
                                type="button"
                                onClick={() => toggleBatchDate(date)}
                                style={{
                                  width: 32, height: 32,
                                  borderRadius: '50%',
                                  border: isToday && !sel ? `2px solid ${OWNER_ORANGE}` : 'none',
                                  background: sel ? OWNER_ORANGE : 'transparent',
                                  color: sel ? '#FFFFFF' : isToday ? OWNER_ORANGE : TEXT_DARK,
                                  fontWeight: sel || isToday ? 700 : 400,
                                  fontSize: 13,
                                  cursor: 'pointer',
                                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  padding: 0, flexShrink: 0,
                                  transition: 'background 0.12s, color 0.12s',
                                }}
                              >
                                {dayNum}
                              </button>
                            )
                          })}
                        </div>
                      </div>

                      {/* Shift Hours */}
                      <div style={{ background: '#FFFFFF', borderRadius: 14, padding: '12px 14px', border: `1px solid ${PANEL_BORDER}`, display: 'flex', flexDirection: 'column', gap: 12 }}>
                        <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          <span style={{ display: 'block', fontWeight: 600, fontSize: '0.875rem', color: '#374151', marginBottom: 4 }}>Start time</span>
                          <TimePicker value={defaultStartTime} onChange={setDefaultStartTime} />
                        </label>
                        <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          <span style={{ display: 'block', fontWeight: 600, fontSize: '0.875rem', color: '#374151', marginBottom: 4 }}>End time</span>
                          <TimePicker value={defaultEndTime} onChange={setDefaultEndTime} />
                        </label>
                        <button type="button" onClick={applyDefaultToAllCells}
                          style={{ border: `1px solid ${PANEL_BORDER}`, borderRadius: 8, background: '#FFFFFF', color: TEXT_DARK, height: 34, padding: '0 12px', fontWeight: 600, fontSize: 12, cursor: 'pointer', width: '100%', marginTop: 2 }}
                        >
                          Apply to all
                        </button>
                      </div>
                    </div>
                    </div>
                  </>
                )
              })()}

              {/* Preview Grid */}
              <div style={{ marginBottom: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <p style={{ margin: 0, fontWeight: 600, fontSize: '0.875rem', color: '#374151', display: 'block' }}>Preview</p>
                  <span style={{ fontSize: 12, color: enabledBatchCells.length > 0 ? OWNER_ORANGE : '#CBD5E1', fontWeight: 600 }}>
                    {enabledBatchCells.length} shift{enabledBatchCells.length !== 1 ? 's' : ''} selected
                  </span>
                </div>
                {selectedMembers.length === 0 || selectedDates.length === 0 ? (
                  <div style={{ border: `1.5px dashed ${PANEL_BORDER}`, borderRadius: 12, padding: '22px 18px', textAlign: 'center' }}>
                    <div style={{ marginBottom: 6, display: 'flex', justifyContent: 'center' }}><CalendarDays size={20} color="#CBD5E1" /></div>
                    <p style={{ margin: 0, color: '#94A3B8', fontSize: 13, fontWeight: 600 }}>
                      {selectedMembers.length === 0 ? 'Select team members to get started' : 'Select dates from the calendar above'}
                    </p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {selectedMembers.map(member => {
                      const isManager = member.role === 'Manager'
                      return (
                        <div key={member.id} style={{ border: `1px solid ${PANEL_BORDER}`, borderRadius: 12, overflow: 'hidden' }}>
                          {!batchSingleMember && (
                            <div style={{ padding: '8px 12px', borderBottom: `1px solid ${PANEL_BORDER}`, background: '#F8FAFC', display: 'flex', alignItems: 'center', gap: 7 }}>
                              <div style={{ width: 22, height: 22, borderRadius: '50%', background: isManager ? '#FEF3E8' : '#F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                {isManager
                                  ? <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={OWNER_ORANGE} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                                  : <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                                }
                              </div>
                              <span style={MEMBER_NAME_STYLE}>{member.full_name}</span>
                              <span style={{ fontSize: 11, color: '#94A3B8', fontWeight: 600 }}>{member.role}</span>
                            </div>
                          )}
                          <div style={{ padding: '10px', display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
                            {selectedDates.map(date => {
                              const key = `${member.id}_${date}`
                              const cell = batchCells[key] ?? { user_id: member.id, shift_date: date, start_time: defaultStartTime, end_time: defaultEndTime, enabled: true }
                              if (cell.enabled === false) return null
                              const existing = futureShiftMap.get(key) ?? []
                              return (
                                <div key={key} style={{ border: `1px solid ${PANEL_BORDER}`, borderRadius: 10, padding: '9px 10px', background: '#FFFFFF', position: 'relative' }}>
                                  <button
                                    type="button"
                                    onClick={() => removeShiftCard(member.id, date)}
                                    style={{ position: 'absolute', top: 5, right: 5, width: 18, height: 18, border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#CBD5E1', borderRadius: 4, padding: 0 }}
                                    onMouseEnter={e => { e.currentTarget.style.color = '#DC2626'; e.currentTarget.style.background = '#FEF2F2' }}
                                    onMouseLeave={e => { e.currentTarget.style.color = '#CBD5E1'; e.currentTarget.style.background = 'transparent' }}
                                  >
                                    <X size={10} />
                                  </button>
                                  <p style={{ margin: '0 0 7px', fontSize: 11, fontWeight: 600, color: TEXT_DARK, paddingRight: 14 }}>{previewDateLabel(date)}</p>
                                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 5 }}>
                                    <TimePicker compact value={cell.start_time} onChange={v => updateBatchCell(member.id, date, { start_time: v })} />
                                    <TimePicker compact value={cell.end_time} onChange={v => updateBatchCell(member.id, date, { end_time: v })} />
                                  </div>
                                  {existing.length > 0 && (
                                    <div style={{ display: 'flex', gap: 4, marginTop: 5, color: '#B45309', fontSize: '0.68rem', fontWeight: 600, alignItems: 'center', flexWrap: 'wrap' }}>
                                      <AlertTriangle size={11} style={{ flexShrink: 0 }} />
                                      <span>Has {existing.length} shift{existing.length !== 1 ? 's' : ''} ({[...new Set(existing.map(s => s.department_name))].join(', ')})</span>
                                    </div>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              {(bulkError || bulkFailures.length > 0) && (
                <div style={{ marginBottom: 16 }}>
                  {bulkError && <div style={errorBoxStyle}>{bulkError}</div>}
                  {bulkFailures.length > 0 && (
                    <div style={{ ...errorBoxStyle, marginTop: 8 }}>
                      {bulkFailures.slice(0, 5).map((failure, index) => (
                        <div key={`${failure.user_id}_${failure.shift_date}_${index}`}>{prettyDate(failure.shift_date)} {failure.start_time}-{failure.end_time}: {failure.message.replace('CLOPENING_CONFLICT: ', '')}</div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
            <div style={{ padding: '0 24px 20px', display: 'flex', justifyContent: 'flex-end', gap: 8, borderTop: '1px solid #F3F4F6' }}>
              <button type="button" onClick={submitBulkAssignment} disabled={bulkSubmitting} style={{ padding: '7px 18px', background: bulkSubmitting ? '#FDA060' : 'linear-gradient(135deg, #F97316, #EA580C)', border: 'none', borderRadius: 8, fontWeight: 600, fontSize: '0.8125rem', color: '#FFFFFF', cursor: bulkSubmitting ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 6, opacity: bulkSubmitting ? 0.65 : 1 }}>
                {bulkSubmitting ? <Spinner size={13} /> : <Check size={13} />} Assign {enabledBatchCells.length || ''} Shift{enabledBatchCells.length === 1 ? '' : 's'}
              </button>
            </div>
          </div>
        </div>
      )}


      {selectedShift && (() => {
        const todayStr = formatDateKey(new Date())
        const todayMonthStr = todayStr.slice(0, 7)
        const monthKey = editShiftCalMonth || shiftEditForm.shift_date.slice(0, 7)
        const [cy, cm] = monthKey.split('-').map(Number)
        const firstDay = new Date(cy, cm - 1, 1).getDay()
        const daysInMonth = new Date(cy, cm, 0).getDate()
        const monthLabel = new Date(cy, cm - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
        const canGoPrev = monthKey > todayMonthStr
        const cells: (string | null)[] = []
        for (let i = 0; i < firstDay; i++) cells.push(null)
        for (let d = 1; d <= daysInMonth; d++) cells.push(`${cy}-${String(cm).padStart(2, '0')}-${String(d).padStart(2, '0')}`)
        const goPrev = () => {
          if (!canGoPrev) return
          setEditShiftCalDir('prev')
          setEditShiftCalKey(k => k + 1)
          const d = new Date(cy, cm - 2, 1)
          setEditShiftCalMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
        }
        const goNext = () => {
          setEditShiftCalDir('next')
          setEditShiftCalKey(k => k + 1)
          const d = new Date(cy, cm, 1)
          setEditShiftCalMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
        }

        return (
          <div style={modalOverlayStyle}>
            <div style={{ ...modalStyle, width: 'min(780px, calc(100% - 32px))', padding: 0, display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '20px 24px 18px', borderBottom: '1px solid #F3F4F6', flexShrink: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 32, height: 32, borderRadius: 9, background: 'linear-gradient(135deg, #F97316, #EA580C)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Pencil size={14} color="#fff" strokeWidth={2} />
                  </div>
                  <h2 style={{ fontWeight: 700, fontSize: '1rem', color: '#111827', margin: 0, fontFamily: "'Inter', system-ui, -apple-system, sans-serif" }}>Edit Shift</h2>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedShift(null)}
                  style={{ background: '#F9FAFB', border: '1px solid #E5E7EB', cursor: 'pointer', color: '#6B7280', display: 'flex', padding: '6px', borderRadius: 8, flexShrink: 0 }}
                  onMouseEnter={e => { e.currentTarget.style.background = '#F3F4F6' }}
                  onMouseLeave={e => { e.currentTarget.style.background = '#F9FAFB' }}
                >
                  <X size={16} />
                </button>
              </div>

              <div style={{ padding: '28px 34px 24px', overflowY: 'auto', flex: 1 }}>
                <div style={{ marginBottom: 20 }}>
                  <span style={{ display: 'block', fontWeight: 700, fontSize: '0.9375rem', color: '#374151', marginBottom: 10 }}>Reassign to</span>
                  <DropdownField
                    value={shiftEditForm.assigned_user_id}
                    options={members
                      .filter(member => member.department_id === shiftEditForm.department_id)
                      .map(member => ({ value: member.id, label: `${member.full_name} · ${member.role}` }))}
                    onChange={v => setShiftEditForm(prev => ({ ...prev, assigned_user_id: v }))}
                    placeholder="Select person"
                  />
                </div>

                <style>{`
                  @keyframes editCalSlideNext { from { opacity: 0; transform: translateX(18px) } to { opacity: 1; transform: translateX(0) } }
                  @keyframes editCalSlidePrev { from { opacity: 0; transform: translateX(-18px) } to { opacity: 1; transform: translateX(0) } }
                `}</style>
                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.35fr) minmax(220px, 0.9fr)', gap: 22, alignItems: 'stretch' }}>
                  <div style={{ background: '#FFFFFF', borderRadius: 16, padding: '18px 20px 20px', border: `1px solid ${PANEL_BORDER}` }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                      <button type="button" onClick={goPrev} disabled={!canGoPrev}
                        style={{ width: 38, height: 38, border: `1px solid ${canGoPrev ? PANEL_BORDER : 'transparent'}`, background: canGoPrev ? '#FFFFFF' : 'transparent', borderRadius: 10, cursor: canGoPrev ? 'pointer' : 'default', display: 'flex', alignItems: 'center', justifyContent: 'center', color: canGoPrev ? MUTED : '#D1D5DB', flexShrink: 0, opacity: canGoPrev ? 1 : 0.3 }}>
                        <ChevronLeft size={15} />
                      </button>
                      <span style={{ fontSize: 16, fontWeight: 800, color: TEXT_DARK }}>{monthLabel}</span>
                      <button type="button" onClick={goNext}
                        style={{ width: 38, height: 38, border: `1px solid ${PANEL_BORDER}`, background: '#FFFFFF', borderRadius: 10, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: MUTED, flexShrink: 0 }}>
                        <ChevronRight size={15} />
                      </button>
                    </div>
                    <div key={`edit-hd-${editShiftCalKey}`} style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 42px)', justifyContent: 'center', marginBottom: 8 }}>
                      {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => (
                        <div key={d} style={{ fontSize: 13, fontWeight: 800, color: '#9CA3AF', textAlign: 'center', height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{d}</div>
                      ))}
                    </div>
                    <div key={`edit-grid-${editShiftCalKey}`} style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 42px)', justifyContent: 'center', rowGap: 8, columnGap: 8, animation: `${editShiftCalDir === 'next' ? 'editCalSlideNext' : 'editCalSlidePrev'} 0.18s ease` }}>
                      {cells.map((date, i) => {
                        if (!date) return <div key={`e-${i}`} style={{ width: 42, height: 42 }} />
                        const isPast = date < todayStr
                        const isSel = date === shiftEditForm.shift_date
                        const isToday = date === todayStr
                        const hasShift = editUserShiftDates.has(date)
                        const dayNum = new Date(`${date}T00:00:00`).getDate()
                        if (isPast) {
                          return (
                            <div key={date} style={{ width: 42, height: 42, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, color: '#CBD5E1', userSelect: 'none' }}>
                              {dayNum}
                            </div>
                          )
                        }
                        return (
                          <button
                            key={date}
                            type="button"
                            onClick={() => setShiftEditForm(prev => ({ ...prev, shift_date: date }))}
                            style={{
                              width: 42, height: 42,
                              borderRadius: '50%',
                              border: isToday && !isSel ? `2px solid ${OWNER_ORANGE}` : 'none',
                              background: isSel ? OWNER_ORANGE : 'transparent',
                              color: isSel ? '#FFFFFF' : isToday ? OWNER_ORANGE : TEXT_DARK,
                              fontWeight: isSel || isToday ? 800 : 500,
                              fontSize: 18,
                              cursor: 'pointer',
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: 2,
                              padding: 0,
                              transition: 'background 0.12s, color 0.12s',
                            }}
                            onMouseEnter={e => { if (!isSel) e.currentTarget.style.background = '#F8FAFC' }}
                            onMouseLeave={e => { if (!isSel) e.currentTarget.style.background = 'transparent' }}
                          >
                            <span style={{ lineHeight: 1 }}>{dayNum}</span>
                            {hasShift && <span style={{ width: 4, height: 4, borderRadius: '50%', background: isSel ? 'rgba(255,255,255,0.85)' : OWNER_ORANGE, flexShrink: 0 }} />}
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  <div style={{ background: '#FFFFFF', borderRadius: 16, padding: '20px 22px', border: `1px solid ${PANEL_BORDER}`, display: 'flex', flexDirection: 'column', gap: 18 }}>
                    <label style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      <span style={{ display: 'block', fontWeight: 800, fontSize: '0.9375rem', color: '#374151' }}>Start time</span>
                      <TimePicker value={shiftEditForm.start_time} onChange={val => setShiftEditForm(prev => ({ ...prev, start_time: val }))} />
                    </label>
                    <label style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      <span style={{ display: 'block', fontWeight: 800, fontSize: '0.9375rem', color: '#374151' }}>End time</span>
                      <TimePicker value={shiftEditForm.end_time} onChange={val => setShiftEditForm(prev => ({ ...prev, end_time: val }))} />
                    </label>
                  </div>
                </div>

                {shiftActionError && <div style={{ ...errorBoxStyle, marginTop: 18 }}>{shiftActionError}</div>}
              </div>

              <div style={{ padding: '18px 34px 24px', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 10, borderTop: '1px solid #F3F4F6' }}>
                <button type="button" onClick={deleteShift} disabled={shiftActionLoading} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, border: 'none', borderRadius: 10, background: shiftActionLoading ? '#F3A8A8' : 'linear-gradient(135deg, #EF4444, #DC2626)', color: '#FFFFFF', height: 36, padding: '0 14px', fontSize: 13, fontWeight: 700, cursor: shiftActionLoading ? 'not-allowed' : 'pointer', marginRight: 'auto' }}>{shiftActionLoading ? <Spinner size={13} /> : <Trash2 size={13} />} Delete</button>
                <button type="button" onClick={saveShiftEdit} disabled={shiftActionLoading} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7, border: 0, borderRadius: 10, background: shiftActionLoading ? '#FDA060' : '#F97316', color: '#FFFFFF', height: 36, padding: '0 18px', fontSize: 13, fontWeight: 700, cursor: shiftActionLoading ? 'not-allowed' : 'pointer', opacity: shiftActionLoading ? 0.65 : 1 }}>{shiftActionLoading ? <Spinner size={13} /> : <Check size={16} />} Save</button>
              </div>
            </div>
          </div>
        )
      })()}

      {/* ── Success toast ── */}
      {successToast && (
        <div style={{
          position: 'fixed', bottom: 28, left: '50%', transform: 'translateX(-50%)',
          zIndex: 9999, display: 'flex', alignItems: 'center', gap: 10,
          background: '#0F172A', color: '#fff', borderRadius: 12,
          padding: '12px 20px', boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
          fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap',
          animation: 'fadeSlideUpToast 0.22s ease',
        }}>
          <Check size={15} style={{ color: '#10B981', flexShrink: 0 }} />
          {successToast}
        </div>
      )}
    </div>
  )
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div style={modalOverlayStyle}>
      <div style={{ ...modalStyle, padding: 0, display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '20px 24px 18px', borderBottom: '1px solid #F3F4F6', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: 9, background: 'linear-gradient(135deg, #F97316, #EA580C)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Pencil size={14} color="#fff" strokeWidth={2} />
            </div>
            <h2 style={{ fontWeight: 700, fontSize: '1rem', color: '#111827', margin: 0, fontFamily: "'Inter', system-ui, -apple-system, sans-serif" }}>{title}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{ background: '#F9FAFB', border: '1px solid #E5E7EB', cursor: 'pointer', color: '#6B7280', display: 'flex', padding: '6px', borderRadius: 8, flexShrink: 0 }}
            onMouseEnter={e => { e.currentTarget.style.background = '#F3F4F6' }}
            onMouseLeave={e => { e.currentTarget.style.background = '#F9FAFB' }}
          >
            <X size={16} />
          </button>
        </div>
        <div style={{ padding: '20px 24px' }}>
          {children}
        </div>
      </div>
    </div>
  )
}

// ─── Custom Dropdown Field ────────────────────────────────────────────────────

function DropdownField({ value, options, onChange, placeholder, disabled = false }: {
  value: string
  options: { value: string; label: string }[]
  onChange: (v: string) => void
  placeholder?: string
  disabled?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0 })
  const triggerRef = useRef<HTMLButtonElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const h = (e: MouseEvent) => {
      if (!triggerRef.current?.contains(e.target as Node) && !dropdownRef.current?.contains(e.target as Node)) setOpen(false)
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
      <button ref={triggerRef} type="button" disabled={disabled}
        onClick={handleOpen}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '10px 12px', border: `1.5px solid ${open ? '#F97316' : '#E5E7EB'}`, borderRadius: 8,
          background: disabled ? '#F9FAFB' : '#FFFFFF', cursor: canOpen ? 'pointer' : 'default',
          fontSize: '0.875rem', color: selected ? '#111827' : '#9CA3AF',
          fontWeight: selected ? 500 : 400, outline: 'none', boxSizing: 'border-box',
          transition: 'border-color 0.15s',
        }}>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {selected?.label ?? placeholder ?? 'Select...'}
        </span>
        <ChevronDown size={13} style={{ color: '#9CA3AF', flexShrink: 0, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
      </button>
      {open && (
        <div ref={dropdownRef} style={{
          position: 'fixed', top: pos.top, left: pos.left, width: pos.width,
          background: '#FFFFFF', border: '1.5px solid #E5E7EB', borderRadius: 10,
          boxShadow: '0 8px 24px rgba(15,23,42,0.12)', zIndex: 9999, maxHeight: 208, overflowY: 'auto',
          padding: '4px 0',
        }}>
          {options.map(opt => {
            const isSel = opt.value === value
            return (
              <button key={opt.value} type="button"
                onClick={() => { onChange(opt.value); setOpen(false) }}
                style={{
                  display: 'block', width: '100%', padding: '8px 14px', textAlign: 'left',
                  border: 'none', background: isSel ? '#FFF7ED' : 'transparent',
                  color: isSel ? '#EA580C' : '#374151', fontWeight: isSel ? 700 : 400,
                  fontSize: 13, cursor: 'pointer',
                }}
                onMouseEnter={e => { if (!isSel) e.currentTarget.style.background = '#F9FAFB' }}
                onMouseLeave={e => { if (!isSel) e.currentTarget.style.background = 'transparent' }}
              >{opt.label}</button>
            )
          })}
        </div>
      )}
    </div>
  )
}

const menuButtonStyle: React.CSSProperties = {
  width: '100%',
  border: 0,
  background: 'transparent',
  color: TEXT_DARK,
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  borderRadius: 10,
  padding: '5px 10px',
  fontSize: 12,
  fontWeight: 600,
  cursor: 'pointer',
  textAlign: 'left',
}

const iconButtonStyle: React.CSSProperties = {
  width: 38,
  height: 38,
  borderRadius: 9,
  border: `1px solid ${PANEL_BORDER}`,
  background: '#FFFFFF',
  display: 'inline-grid',
  placeItems: 'center',
  cursor: 'pointer',
  color: TEXT_DARK,
}

const primaryButtonStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 7,
  border: 0,
  borderRadius: 10,
  background: OWNER_ORANGE,
  color: '#FFFFFF',
  height: 36,
  padding: '0 12px',
  fontSize: 13,
  fontWeight: 600,
  cursor: 'pointer',
}

const secondaryButtonStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 7,
  border: `1px solid ${PANEL_BORDER}`,
  borderRadius: 10,
  background: '#FFFFFF',
  color: TEXT_DARK,
  height: 36,
  padding: '0 12px',
  fontSize: 13,
  fontWeight: 600,
  cursor: 'pointer',
}

const modalOverlayStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(15,23,42,0.42)',
  display: 'grid',
  placeItems: 'center',
  padding: 18,
  zIndex: 80,
  backdropFilter: 'blur(4px)',
  animation: 'overlayFadeIn 0.18s ease-out',
}

const modalStyle: React.CSSProperties = {
  width: 'min(480px, 100%)',
  maxHeight: '88vh',
  overflowY: 'auto',
  background: '#FFFFFF',
  borderRadius: 20,
  border: `1px solid ${PANEL_BORDER}`,
  boxShadow: '0 24px 64px rgba(0,0,0,0.16), 0 4px 16px rgba(0,0,0,0.08)',
  padding: 16,
  animation: 'modalSlideIn 0.22s cubic-bezier(0.16,1,0.3,1)',
}

const drawerOverlayStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(15,23,42,0.42)',
  zIndex: 80,
  display: 'grid',
  placeItems: 'center',
  padding: 18,
  backdropFilter: 'blur(4px)',
  animation: 'overlayFadeIn 0.18s ease-out',
}

const drawerStyle: React.CSSProperties = {
  width: 'min(660px, 100%)',
  maxHeight: '90vh',
  background: '#FFFFFF',
  borderRadius: 20,
  border: `1px solid ${PANEL_BORDER}`,
  boxShadow: '0 24px 64px rgba(0,0,0,0.16), 0 4px 16px rgba(0,0,0,0.08)',
  display: 'flex',
  flexDirection: 'column',
  animation: 'modalSlideIn 0.22s cubic-bezier(0.16,1,0.3,1)',
}

const drawerSectionTitleStyle: React.CSSProperties = {
  margin: '0 0 9px',
  color: TEXT_DARK,
  fontSize: '0.92rem',
  fontWeight: 600,
}

const tableHeaderStyle: React.CSSProperties = {
  padding: '10px 9px',
  background: '#F8FAFC',
  color: '#334155',
  fontSize: '0.76rem',
  fontWeight: 600,
  borderBottom: `1px solid ${PANEL_BORDER}`,
  textAlign: 'left',
}

const tablePersonStyle: React.CSSProperties = {
  padding: 10,
  color: TEXT_DARK,
  fontWeight: 600,
  fontSize: '0.82rem',
  borderTop: `1px solid ${PANEL_BORDER}`,
  verticalAlign: 'top',
  minWidth: 150,
}

const tableCellStyle: React.CSSProperties = {
  padding: 10,
  borderTop: `1px solid ${PANEL_BORDER}`,
  borderLeft: `1px solid ${PANEL_BORDER}`,
  verticalAlign: 'top',
  minWidth: 170,
}

const modalFooterStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'flex-end',
  gap: 10,
  marginTop: 18,
}

const errorBoxStyle: React.CSSProperties = {
  border: '1px solid #FECACA',
  background: '#FEF2F2',
  color: '#B91C1C',
  borderRadius: 10,
  padding: '10px 12px',
  fontSize: '0.82rem',
  fontWeight: 600,
}

const successBoxStyle: React.CSSProperties = {
  border: '1px solid #BBF7D0',
  background: '#F0FDF4',
  color: '#166534',
  borderRadius: 10,
  padding: '10px 12px',
  fontSize: '0.82rem',
  fontWeight: 600,
}
