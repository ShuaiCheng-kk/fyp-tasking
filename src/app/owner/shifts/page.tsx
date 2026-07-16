'use client'

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import {
  AlertTriangle,
  Calendar as CalendarIcon,
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
  Repeat,
  RotateCw,
  Table2,
  GripVertical,
  LayoutTemplate,
  Sparkles,
  Trash2,
  Upload,
  Users,
  UserCog,
  UserRound,
  X,
  Crown,
  SplitSquareHorizontal,
  Undo2,
  Redo2,
  Copy,
  Send,
} from 'lucide-react'
import { createBrowserClient } from '@supabase/ssr'
import OwnerSidebar from '@/components/OwnerSidebar'
import Toast from '@/components/Toast'
import OwnerPlanBadge from '@/components/owner/PlanBadge'
import OwnerUserBadge from '@/components/owner/OwnerUserBadge'
import DatePickerField from '@/components/DatePickerField'
import MultiSelectDropdownField from '@/components/MultiSelectDropdownField'
import { deptColor, setDeptColorOverrides } from '@/lib/deptColor'
import { TimelineRow, TimelineShiftBlock } from '@/types/Timeline'
import { ShiftTemplate } from '@/types/ShiftTemplate'
import { AiShiftSlot, ShiftTypeInput } from '@/types/SchedulingRule'
import { aiScheduleGenerationStore, AutoShiftBlock, AI_SCHEDULE_RULE_STEPS } from '@/lib/aiScheduleGenerationStore'
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
  fixed_off_days: string[]
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
  template_name?: string
  template_id?: string
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

type DuplicateShiftForm = {
  shift_date: string
  start_time: string
  end_time: string
  assigned_user_id: string
}

type RecurringShiftForm = {
  recurrence_rule: 'daily' | 'weekly' | 'custom' | ''
  recurrence_end_date: string
  custom_interval_days: number
  assigned_user_id: string
}

type BulkEditRow = {
  id: string
  shift_date: string
  original_shift_date: string
  start_time: string
  end_time: string
  department_id: string
  assigned_user_id: string
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

function TimePicker({ value, onChange, compact = false, minTime, disabled = false }: { value: string; onChange: (v: string) => void; compact?: boolean; minTime?: string; disabled?: boolean }) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0 })
  const triggerRef = useRef<HTMLButtonElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const hNum = parseInt(value.split(':')[0] ?? '0')
  const mNum = parseInt(value.split(':')[1] ?? '0')
  const normalizedValue = `${String(hNum).padStart(2, '0')}:${String(mNum).padStart(2, '0')}`
  const normalizedMinTime = minTime ? `${String(parseInt(minTime.split(':')[0] ?? '0')).padStart(2, '0')}:${String(parseInt(minTime.split(':')[1] ?? '0')).padStart(2, '0')}` : undefined
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
    if (!open) return
    const id = requestAnimationFrame(() => {
      const list = listRef.current
      const sel = list?.querySelector('[data-selected="true"]') as HTMLElement | null
      if (list && sel) {
        list.scrollTop = sel.offsetTop - list.clientHeight / 2 + sel.clientHeight / 2
      }
    })
    return () => cancelAnimationFrame(id)
  }, [open, meridiem, normalizedValue])

  const handleOpen = () => {
    if (disabled) return
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
          const isSel = t.value === normalizedValue
          const isDisabled = Boolean(normalizedMinTime) && t.value <= normalizedMinTime!
          return (
            <button key={t.value} type="button" data-selected={isSel ? 'true' : 'false'}
              disabled={isDisabled}
              onClick={() => { if (isDisabled) return; onChange(t.value); setOpen(false) }}
              style={{
                display: 'block', width: '100%', padding: '7px 16px', textAlign: 'left',
                border: 'none', background: isSel ? '#FFF7ED' : 'transparent',
                color: isDisabled ? '#D1D5DB' : isSel ? OWNER_ORANGE : _TEXT_DARK_PICKER,
                fontWeight: isSel ? 700 : 400, fontSize: 13, cursor: isDisabled ? 'not-allowed' : 'pointer',
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
      <button ref={triggerRef} type="button" onClick={handleOpen} disabled={disabled}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4,
          border: `1px solid ${_PANEL_BORDER_PICKER}`, borderRadius: 8, background: disabled ? '#F3F4F6' : '#FFFFFF',
          cursor: disabled ? 'not-allowed' : 'pointer', padding: compact ? '5px 10px' : '8px 12px',
          fontSize: compact ? 12 : 13, fontWeight: 500, color: disabled ? '#9CA3AF' : _TEXT_DARK_PICKER,
          minHeight: compact ? 32 : 38,
        }}
      >
        <span style={{ userSelect: 'none', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{displayLabel}</span>
        <ChevronDown size={compact ? 11 : 12} color={_MUTED_PICKER} style={{ flexShrink: 0 }} />
      </button>
      {!disabled && typeof document !== 'undefined' && createPortal(dropdown, document.body)}
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
  .shift-template-panel { animation: blockPopIn 0.42s cubic-bezier(0.34,1.56,0.64,1) both 0.09s; }
  .shift-timeline-panel { animation: blockSlideUp 0.38s ease both 0.12s; }
  .shift-dept-card:hover { box-shadow: 0 4px 14px rgba(0,0,0,0.09) !important; transform: translateY(-1px) !important; }
  .member-card       { animation: cardStagger 0.30s ease both; transition: box-shadow 0.18s ease, border-color 0.18s ease; }
  .member-card:hover { box-shadow: 0 3px 10px rgba(0,0,0,0.08); border-color: #FDBA74 !important; }
  .shift-template-card { animation: cardStagger 0.30s ease both; transition: box-shadow 0.18s ease, border-color 0.18s ease; }
  .shift-template-card:hover { box-shadow: 0 3px 10px rgba(0,0,0,0.08); border-color: #FDBA74 !important; }
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

const CLOPENING_MIN_REST_HOURS = 5

function findClopeningConflict(input: {
  shift_date: string
  start_time: string
  end_time: string
  existingShifts: { shift_date: string; start_time: string; end_time: string }[]
}): { rest_hours: number; direction: 'before' | 'after' } | null {
  const newStart = new Date(`${input.shift_date}T${input.start_time}`).getTime()
  const newEnd = new Date(`${input.shift_date}T${input.end_time}`).getTime()
  for (const shift of input.existingShifts) {
    const existingStart = new Date(`${shift.shift_date}T${shift.start_time}`).getTime()
    const existingEnd = new Date(`${shift.shift_date}T${shift.end_time}`).getTime()
    let restMs: number | null = null
    let direction: 'before' | 'after' | null = null
    if (existingEnd <= newStart) { restMs = newStart - existingEnd; direction = 'before' }
    if (newEnd <= existingStart) { restMs = existingStart - newEnd; direction = 'after' }
    if (restMs === null || direction === null) continue
    const restHours = Math.round((restMs / 3_600_000) * 10) / 10
    if (restHours < CLOPENING_MIN_REST_HOURS) return { rest_hours: restHours, direction }
  }
  return null
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

function bumpEndTime(startTime: string, currentEndTime: string): string {
  if (currentEndTime > startTime) return currentEndTime
  const [h, m] = startTime.split(':').map(Number)
  const total = Math.min(h * 60 + m + 30, 23 * 60 + 30)
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

const SHIFT_NAME_TIME_PRESETS: { keyword: string; start_time: string; end_time: string }[] = [
  { keyword: 'morning', start_time: '07:00', end_time: '15:00' },
  { keyword: 'afternoon', start_time: '11:00', end_time: '19:00' },
  { keyword: 'evening', start_time: '15:00', end_time: '23:00' },
]

function matchShiftNameTimePreset(name: string): { start_time: string; end_time: string } | null {
  const lower = name.toLowerCase()
  const preset = SHIFT_NAME_TIME_PRESETS.find(p => lower.includes(p.keyword))
  return preset ? { start_time: preset.start_time, end_time: preset.end_time } : null
}

function previewDateLabel(dateKey: string): string {
  const d = new Date(`${dateKey}T00:00:00`)
  const weekday = d.toLocaleDateString('en-US', { weekday: 'short' })
  const month = d.toLocaleDateString('en-US', { month: 'long' })
  const dayNum = d.getDate()
  return `${weekday}, ${month} ${dayNum}`
}

function TimelineDatePicker({ value, onChange, shiftDates, anchorRef, triggerStyle, minDate: minDateProp, maxDate: maxDateProp, accentColor = OWNER_ORANGE }: {
  value: string
  onChange: (date: string) => void
  shiftDates: Set<string>
  anchorRef?: React.RefObject<HTMLDivElement | null>
  minDate?: string
  maxDate?: string
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
  const minSelectableStr = minDateProp ?? ''
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
  const maxSelectableMonth = maxDateProp?.slice(0, 7)
  const canGoNextMonth = !maxSelectableMonth || viewMonth < maxSelectableMonth
  const goPrev = () => { const d = new Date(cy, cm - 2, 1); const nm = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; if (nm < minSelectableMonth) return; setViewMonth(nm) }
  const goNext = () => { if (!canGoNextMonth) return; const d = new Date(cy, cm, 1); setViewMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`) }

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
        <button type="button" onClick={goNext} disabled={!canGoNextMonth} style={{ width: 26, height: 26, border: `1px solid ${PANEL_BORDER}`, borderRadius: 7, background: '#FFFFFF', cursor: canGoNextMonth ? 'pointer' : 'default', display: 'flex', alignItems: 'center', justifyContent: 'center', color: canGoNextMonth ? '#64748B' : '#D1D5DB' }}><ChevronRight size={13} /></button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', marginBottom: 4 }}>
        {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => (
          <div key={d} style={{ fontSize: 11, fontWeight: 600, color: '#9CA3AF', textAlign: 'center', height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{d}</div>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
        {cells.map((date, i) => {
          if (!date) return <div key={`e-${i}`} style={{ height: 36 }} />
          const isDisabled = date < minSelectableStr || (maxDateProp ? date > maxDateProp : false)
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
  const todayStr = useMemo(() => formatDateKey(new Date()), [])
  const tomorrow = useMemo(() => addDays(new Date(), 1), [])
  const minDate = useMemo(() => {
    // Floor = Monday of the week that contains (today - 7 days)
    const d = addDays(new Date(), -7)
    const dow = (d.getDay() + 6) % 7  // 0=Mon … 6=Sun
    return formatDateKey(addDays(d, -dow))
  }, [])
  const dateOptions = useMemo(() => Array.from({ length: 30 }, (_, index) => formatDateKey(addDays(tomorrow, index))), [tomorrow])
  const maxDate = dateOptions[dateOptions.length - 1]
  const repeatUntilMaxDate = useMemo(() => formatDateKey(addDays(new Date(), 365 * 2)), [])

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
  // approved fixed off days — purple "Off Day" pill on the calendar/timeline (same as Attendance Records)
  const [fixedOffDayRequests, setFixedOffDayRequests] = useState<{ user_id: string; request_date: string; status: string }[]>([])
  const [selectedTimelineUserIds, setSelectedTimelineUserIds] = useState<string[]>([])
  const [timelineBulkDeleting, setTimelineBulkDeleting] = useState(false)
  const [timelineDeleteError, setTimelineDeleteError] = useState('')

  // AI Shift Scheduling state
  const [aiShiftModal, setAiShiftModal] = useState(false)
  const [aiShiftWizardStep, setAiShiftWizardStep] = useState<'dates' | 'departments' | 'shiftTypes' | 'generate'>('dates')
  const [aiShiftDateFrom, setAiShiftDateFrom] = useState('')
  const [aiShiftDateTo, setAiShiftDateTo] = useState('')
  const [aiShiftTypes, setAiShiftTypes] = useState<ShiftTypeInput[]>([
    { label: 'Shift 1', start_time: '09:00', end_time: '17:00' },
  ])
  const [aiShiftTypeTemplateIds, setAiShiftTypeTemplateIds] = useState<string[]>([''])
  const [aiShiftSelectedDepartmentIds, setAiShiftSelectedDepartmentIds] = useState<string[]>([])
  const [aiShiftError, setAiShiftError] = useState('')
  const [aiEditingSlot, setAiEditingSlot] = useState<{ blockKey: string; slotIndex: number } | null>(null)
  const [aiDraggingSlot, setAiDraggingSlot] = useState<{ blockKey: string; slotIndex: number } | null>(null)
  const [aiDragOverCell, setAiDragOverCell] = useState<string | null>(null)
  const [aiShiftCreateLoading, setAiShiftCreateLoading] = useState(false)
  const [aiShiftCreateError, setAiShiftCreateError] = useState('')
  const [aiResultWeekOffset, setAiResultWeekOffset] = useState(0)
  // Drives the "genie" minimize animation right after starting a generation — the modal shrinks
  // and flies toward the top-right corner (where the floating widget lives) instead of just sitting
  // there or vanishing abruptly, so it's visually obvious where the run went.
  const [aiShiftMinimizing, setAiShiftMinimizing] = useState(false)

  // The generation run itself lives in a module-level store (not component state) so it survives
  // navigating away from this page — see src/lib/aiScheduleGenerationStore.ts for why.
  const aiGenState = useSyncExternalStore(aiScheduleGenerationStore.subscribe, aiScheduleGenerationStore.getSnapshot, aiScheduleGenerationStore.getSnapshot)
  const aiShiftLoading = aiGenState.status === 'generating'
  const aiShiftProgress = aiGenState.progress
  const aiShiftRuleStepIndex = aiGenState.ruleStepIndex
  const aiShiftNotice = aiGenState.notice
  const aiShiftGenerationError = aiGenState.error
  const aiShiftSuggestions = aiGenState.blocks
  const aiShiftSelected = aiGenState.selected
  const aiStaffAvailability = aiGenState.staffAvailability
  const aiShiftKnownRows = aiGenState.knownRows

  const [bulkEditModalOpen, setBulkEditModalOpen] = useState(false)
  const [bulkEditDateFrom, setBulkEditDateFrom] = useState('')
  const [bulkEditDateTo, setBulkEditDateTo] = useState('')
  const [bulkEditDepartmentIds, setBulkEditDepartmentIds] = useState<string[]>([])
  const [bulkEditUserIds, setBulkEditUserIds] = useState<string[]>([])
  const [bulkEditRows, setBulkEditRows] = useState<BulkEditRow[]>([])
  const [bulkEditLoading, setBulkEditLoading] = useState(false)
  const [bulkEditSaving, setBulkEditSaving] = useState(false)
  const [bulkEditDeletingId, setBulkEditDeletingId] = useState<string | null>(null)
  const [bulkEditError, setBulkEditError] = useState('')
  const [bulkEditRowErrors, setBulkEditRowErrors] = useState<Record<string, string>>({})

  const [shiftTemplates, setShiftTemplates] = useState<ShiftTemplate[]>([])
  const [selectedTemplateId, setSelectedTemplateId] = useState('')
  const [templateSaveOpen, setTemplateSaveOpen] = useState(false)
  const [templateSaveName, setTemplateSaveName] = useState('')
  const [templateSaveLoading, setTemplateSaveLoading] = useState(false)
  const [templateSaveError, setTemplateSaveError] = useState('')
  const [templateDeleteLoadingId, setTemplateDeleteLoadingId] = useState<string | null>(null)
  const [templateEditId, setTemplateEditId] = useState<string | null>(null)
  const [templateEditName, setTemplateEditName] = useState('')
  const [templateEditStartTime, setTemplateEditStartTime] = useState('')
  const [templateEditEndTime, setTemplateEditEndTime] = useState('')
  const [templateEditLoading, setTemplateEditLoading] = useState(false)
  const [templateEditError, setTemplateEditError] = useState('')

  // Standalone "Shift Templates" list/create/edit modal reachable from the toolbar — mirrors the
  // Task Templates modal's UX (src/app/owner/tasks/page.tsx). Separate state from the
  // templateSave*/templateEdit* above, which belong to the inline template picker embedded in the
  // per-department Assign Shift drawer — a different flow, left untouched.
  const [shiftTemplateModalOpen, setShiftTemplateModalOpen] = useState(false)
  const [shiftTemplateFormMode, setShiftTemplateFormMode] = useState<'create' | 'edit'>('create')
  const [shiftTemplateFormId, setShiftTemplateFormId] = useState('')
  const [shiftTemplateFormName, setShiftTemplateFormName] = useState('')
  const [shiftTemplateFormStartTime, setShiftTemplateFormStartTime] = useState('09:00')
  const [shiftTemplateFormEndTime, setShiftTemplateFormEndTime] = useState('17:00')
  const [shiftTemplateTimeTouched, setShiftTemplateTimeTouched] = useState(false)
  const [shiftTemplateFormLoading, setShiftTemplateFormLoading] = useState(false)
  const [shiftTemplateFormError, setShiftTemplateFormError] = useState('')
  const [deleteShiftTemplateLoading, setDeleteShiftTemplateLoading] = useState(false)

  const [expandedBatchCells, setExpandedBatchCells] = useState<Set<string>>(new Set())
  const [editSelectedTemplateId, setEditSelectedTemplateId] = useState('')
  const [duplicateSelectedTemplateId, setDuplicateSelectedTemplateId] = useState('')

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
  const [bulkWarning, setBulkWarning] = useState('')
  const [successToast, setSuccessToast] = useState<string | null>(null)
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [errorToast, setErrorToast] = useState<string | null>(null)
  const errorToastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // If the Owner goes back and changes dates/departments/shift types after already generating (or
  // while still generating) a schedule, the old/in-flight run is for a different input and must
  // not be shown as-is — clear it so the "generate" step asks for a fresh run against the new
  // selection. The run itself lives in aiScheduleGenerationStore, not component state.
  //
  // These fields still sitting at their pristine just-mounted defaults ('' / [] / the single
  // default shift type) means the mount-time resume effect (near openAiShiftModal) hasn't hydrated
  // them from a background run yet — not that the Owner edited anything. Skipping in that case
  // also happens to make this safe under React Strict Mode's dev-only double-invoke of effects:
  // both invocations see the same pre-hydration closure (no real render happens between them), so
  // both hit this guard; only the real post-hydration render (where these no longer match the
  // pristine defaults) reaches the comparison below.
  useEffect(() => {
    if (!aiShiftDateFrom && !aiShiftDateTo && aiShiftSelectedDepartmentIds.length === 0) return
    const existing = aiScheduleGenerationStore.getSnapshot()
    if (existing.status === 'idle') return
    const p = existing.params
    const matchesActiveRun = !!p
      && p.dateFrom === aiShiftDateFrom
      && p.dateTo === aiShiftDateTo
      && p.departmentIds.length === aiShiftSelectedDepartmentIds.length
      && p.departmentIds.every(id => aiShiftSelectedDepartmentIds.includes(id))
      && p.shiftTypes.length === aiShiftTypes.length
      && p.shiftTypes.every((st, i) => st.start_time === aiShiftTypes[i]?.start_time && st.end_time === aiShiftTypes[i]?.end_time)
    if (matchesActiveRun) return
    aiScheduleGenerationStore.clear()
    setAiResultWeekOffset(0)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aiShiftSelectedDepartmentIds, aiShiftDateFrom, aiShiftDateTo, aiShiftTypes])

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
  const [shiftActionWarning, setShiftActionWarning] = useState('')
  const shiftActionErrorRef = useRef<HTMLDivElement>(null)
  const [hoveredEditCalDate, setHoveredEditCalDate] = useState<string | null>(null)
  const [hoveredBatchCalDate, setHoveredBatchCalDate] = useState<string | null>(null)

  // Split is folded into Assign (batch drawer) and Edit Shift rather than a standalone modal/button.
  const [editSplitEnabled, setEditSplitEnabled] = useState(false)
  const [editSplitBlock1End, setEditSplitBlock1End] = useState('14:00')
  const [editSplitBlock2Start, setEditSplitBlock2Start] = useState('15:00')
  const [editRepeatEnabled, setEditRepeatEnabled] = useState(false)
  const [editIsRecurrenceOriginal, setEditIsRecurrenceOriginal] = useState(false)
  const [editRecurringTouched, setEditRecurringTouched] = useState(false)
  const [editRecurringForm, setEditRecurringForm] = useState<RecurringShiftForm>({
    recurrence_rule: '',
    recurrence_end_date: '',
    custom_interval_days: 1,
    assigned_user_id: '',
  })
  const [editRecurringError, setEditRecurringError] = useState('')
  const editRecurringErrorRef = useRef<HTMLDivElement>(null)
  const [batchSplitEnabled, setBatchSplitEnabled] = useState(false)
  const [batchSplitBlock1End, setBatchSplitBlock1End] = useState('14:00')
  const [batchSplitBlock2Start, setBatchSplitBlock2Start] = useState('15:00')
  const [undoLoading, setUndoLoading] = useState(false)
  const [redoLoading, setRedoLoading] = useState(false)

  const [duplicateShiftModalOpen, setDuplicateShiftModalOpen] = useState(false)
  const [duplicateShiftForm, setDuplicateShiftForm] = useState<DuplicateShiftForm>({
    shift_date: minDate,
    start_time: '09:00',
    end_time: '17:00',
    assigned_user_id: '',
  })
  const [duplicateShiftLoading, setDuplicateShiftLoading] = useState(false)
  const [duplicateShiftError, setDuplicateShiftError] = useState('')
  const duplicateShiftErrorRef = useRef<HTMLDivElement>(null)
  const [publishLoading, setPublishLoading] = useState(false)

  const [batchRepeatEnabled, setBatchRepeatEnabled] = useState(false)
  const [recurringShiftForm, setRecurringShiftForm] = useState<RecurringShiftForm>({
    recurrence_rule: 'weekly',
    recurrence_end_date: minDate,
    custom_interval_days: 1,
    assigned_user_id: '',
  })
  const [recurringShiftError, setRecurringShiftError] = useState('')
  const recurringShiftErrorRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (shiftActionError) shiftActionErrorRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [shiftActionError])

  useEffect(() => {
    if (duplicateShiftError) duplicateShiftErrorRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [duplicateShiftError])

  useEffect(() => {
    if (recurringShiftError) recurringShiftErrorRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [recurringShiftError])

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

  const fetchShiftTemplates = useCallback(async (cid: string) => {
    if (!cid) return
    const res = await fetch(`/api/shift-template?company_id=${cid}`)
    const data = await res.json()
    setShiftTemplates(data.success ? data.templates ?? [] : [])
  }, [])

  const fetchFixedOffDays = useCallback(async (cid: string) => {
    if (!cid) return
    try {
      const res = await fetch(`/api/attendance?company_id=${cid}&resource=fixed_off_days`)
      const data = await res.json()
      setFixedOffDayRequests(data.requests ?? [])
    } catch {}
  }, [])

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
      fetchFixedOffDays(companyId),
    ])
    setLastRefreshed(new Date())
  }, [companyId, fetchCalWeek, fetchFutureRows, fetchTimeline, fetchFixedOffDays, timelineDate])

  useEffect(() => {
    if (!companyId) return
    void Promise.all([
      fetchAssignmentData(companyId),
      fetchTimeline(companyId, timelineDate),
      fetchFutureRows(companyId),
      fetchShiftTemplates(companyId),
      fetchFixedOffDays(companyId),
    ]).then(() => setLastRefreshed(new Date()))
  }, [companyId, fetchAssignmentData, fetchFutureRows, fetchTimeline, fetchShiftTemplates, fetchFixedOffDays, timelineDate])

  useEffect(() => {
    if (!companyId || shiftViewMode !== 'calendar') return
    void fetchCalWeek(companyId, timelineDate)
  }, [companyId, shiftViewMode, timelineDate, fetchCalWeek])

  // approved fixed off: `${user_id}|${YYYY-MM-DD}` → true (same keying as the Attendance page)
  const fixedOffByUserDate = useMemo(() => {
    const map = new Map<string, boolean>()
    fixedOffDayRequests.forEach(r => {
      if (r.status === 'approved') map.set(`${r.user_id}|${r.request_date}`, true)
    })
    return map
  }, [fixedOffDayRequests])

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
      if (row.user_id && row.shifts.some(shift => shift.publication_status !== 'draft')) ids.add(row.department_id)
    }
    return ids
  }, [timelineRows])

  const userIdsWithShiftToday = useMemo(() => {
    const ids = new Set<string>()
    for (const row of timelineRows) {
      if (row.user_id && row.shifts.length > 0) ids.add(row.user_id)
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

  const editUserShiftsByDate = useMemo(() => {
    const uid = shiftEditForm.assigned_user_id
    const map = new Map<string, { start_time: string; end_time: string }[]>()
    if (!uid) return map
    for (const row of futureRows) {
      if (row.user_id !== uid) continue
      for (const shift of row.shifts) {
        const list = map.get(shift.shift_date) ?? []
        list.push({ start_time: shift.start_time, end_time: shift.end_time })
        map.set(shift.shift_date, list)
      }
    }
    return map
  }, [futureRows, shiftEditForm.assigned_user_id])

  const batchUserShiftsByDate = useMemo(() => {
    const map = new Map<string, { full_name: string; start_time: string; end_time: string }[]>()
    if (selectedMemberIds.length === 0) return map
    for (const row of futureRows) {
      if (!row.user_id || !selectedMemberIds.includes(row.user_id)) continue
      for (const shift of row.shifts) {
        const list = map.get(shift.shift_date) ?? []
        list.push({ full_name: row.full_name, start_time: shift.start_time, end_time: shift.end_time })
        map.set(shift.shift_date, list)
      }
    }
    return map
  }, [futureRows, selectedMemberIds])

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
    const activeTemplate = shiftTemplates.find(t => t.id === selectedTemplateId)
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
          template_name: activeTemplate?.name,
          template_id: activeTemplate?.id,
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
          template_name: current?.template_name,
          template_id: current?.template_id,
          ...(fields.template_name === undefined && (fields.start_time !== undefined || fields.end_time !== undefined) ? { template_name: undefined, template_id: undefined } : {}),
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

  const applyDefaultToAllCells = (overrideStart?: string, overrideEnd?: string, templateName?: string, templateId?: string) => {
    const startTime = overrideStart ?? defaultStartTime
    const endTime = overrideEnd ?? defaultEndTime
    setBatchCells(prev => {
      const next = { ...prev }
      for (const memberId of selectedMemberIds) {
        for (const date of selectedDates) {
          const key = `${memberId}_${date}`
          next[key] = {
            user_id: memberId,
            shift_date: date,
            start_time: startTime,
            end_time: endTime,
            enabled: next[key]?.enabled ?? true,
            template_name: templateName,
            template_id: templateId,
          }
        }
      }
      return next
    })
  }

  const openAiShiftModal = (_dept?: Department | null) => {
    const existing = aiScheduleGenerationStore.getSnapshot()
    // A run is already generating or sitting done/errored in the background (e.g. the Owner
    // minimized it and came back, or clicked the floating widget) — jump straight to reviewing it
    // instead of resetting the wizard, and hydrate the form fields so "back"/regenerate stays
    // consistent with what's actually showing.
    if (existing.status !== 'idle') {
      if (existing.params) {
        setAiShiftDateFrom(existing.params.dateFrom)
        setAiShiftDateTo(existing.params.dateTo)
        setAiShiftSelectedDepartmentIds(existing.params.departmentIds)
        setAiShiftTypes(existing.params.shiftTypes)
        setAiShiftTypeTemplateIds(existing.params.shiftTypes.map(() => ''))
      }
      setAiShiftError('')
      setAiShiftCreateError('')
      setAiEditingSlot(null)
      setAiDraggingSlot(null)
      setAiDragOverCell(null)
      setAiShiftWizardStep('generate')
      setAiShiftModal(true)
      return
    }
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
    setAiShiftTypeTemplateIds([''])
    setAiShiftSelectedDepartmentIds([])
    setAiShiftError('')
    setAiShiftCreateError('')
    setAiResultWeekOffset(0)
    setAiEditingSlot(null)
    setAiDraggingSlot(null)
    setAiDragOverCell(null)
    setAiShiftModal(true)
  }

  const closeAiShiftModal = () => {
    // While a run is still generating, closing just minimizes it — the floating widget (mounted in
    // the owner layout) keeps tracking progress in the background. Once it's done or errored,
    // closing acknowledges and clears it so the widget doesn't linger.
    if (aiScheduleGenerationStore.getSnapshot().status !== 'generating') {
      aiScheduleGenerationStore.clear()
    }
    setAiShiftModal(false)
  }

  // Once the shrink-toward-the-widget animation (see the modal card's transform below) has had time
  // to play, actually hide the modal — the run itself keeps going in aiScheduleGenerationStore
  // regardless, same as a manual minimize.
  useEffect(() => {
    if (!aiShiftMinimizing) return
    const timer = setTimeout(() => {
      setAiShiftModal(false)
      setAiShiftMinimizing(false)
    }, 550)
    return () => clearTimeout(timer)
  }, [aiShiftMinimizing])

  // Only reopen the wizard in response to an explicit request from the floating widget's onClick
  // (aiGenState.pendingOpen) — never merely because this page happened to mount or a background run
  // happens to be non-idle. Landing on /owner/shifts any other way (sidebar nav, direct URL,
  // browser back) must show the plain page, not pop the modal open uninvited. This covers both the
  // Owner clicking the widget from elsewhere (this page mounts fresh with pendingOpen already true)
  // and clicking it while already sitting here (pendingOpen flips true on an already-mounted page).
  useEffect(() => {
    if (!aiGenState.pendingOpen) return
    aiScheduleGenerationStore.consumeOpenRequest()
    if (aiScheduleGenerationStore.getSnapshot().status !== 'idle') {
      openAiShiftModal()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aiGenState.pendingOpen])

  // Returns whether it actually started a generation run (false on a validation failure) — used by
  // the primary "Generate Schedule with AI" button to know whether to play the minimize animation.
  const handleAiGenerateShifts = async (): Promise<boolean> => {
    const normalizedDateFrom = normalizeDateInput(aiShiftDateFrom)
    const normalizedDateTo = normalizeDateInput(aiShiftDateTo)
    if (!normalizedDateFrom || !normalizedDateTo) { setAiShiftError('Select a date range'); return false }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(normalizedDateFrom) || !/^\d{4}-\d{2}-\d{2}$/.test(normalizedDateTo)) {
      setAiShiftError('Select a valid date range')
      return false
    }
    if (aiShiftSelectedDepartmentIds.length === 0) { setAiShiftError('Select at least one department'); return false }
    const validShiftTypes = aiShiftTypes
      .map((shift, index) => ({
        label: shift.label?.trim() || `Shift ${index + 1}`,
        start_time: shift.start_time,
        end_time: shift.end_time,
      }))
      .filter(shift => shift.start_time && shift.end_time)
    if (validShiftTypes.length === 0) { setAiShiftError('Add at least one shift type'); return false }
    if (validShiftTypes.some(shift => shift.start_time >= shift.end_time)) {
      setAiShiftError('Each shift type start time must be before end time')
      return false
    }

    const dayCount = Math.floor((new Date(`${normalizedDateTo}T00:00:00Z`).getTime() - new Date(`${normalizedDateFrom}T00:00:00Z`).getTime()) / 86_400_000) + 1
    const slotCount = aiShiftSelectedDepartmentIds.length * dayCount * validShiftTypes.length
    if (slotCount > 150) {
      setAiShiftError(`Too many shifts to generate at once (${slotCount}). Narrow the date range, departments, or shift types and try again.`)
      return false
    }
    setAiShiftError('')
    setAiEditingSlot(null)
    setAiDraggingSlot(null)
    setAiDragOverCell(null)
    setAiResultWeekOffset(0)
    // The actual generation (streaming fetch + progress) runs in aiScheduleGenerationStore, not
    // here — so it keeps going even if the Owner navigates away from this page. See that module
    // for why, and src/components/owner/AiScheduleStatusWidget.tsx for the persistent indicator.
    const deptNameMap = new Map(departments.map(d => [d.id, d.name]))
    void aiScheduleGenerationStore.startGeneration({
      companyId,
      userId: internalUserId,
      dateFrom: normalizedDateFrom,
      dateTo: normalizedDateTo,
      departmentIds: aiShiftSelectedDepartmentIds,
      shiftTypes: validShiftTypes,
    }, deptNameMap)
    return true
  }

  // The primary "Generate Schedule with AI" button (not the small regenerate icon on an
  // already-reviewed result) — starts the run and immediately shrinks the modal away toward the
  // widget, rather than leaving them staring at it or requiring a manual close.
  const handleAiGenerateAndMinimize = async () => {
    const started = await handleAiGenerateShifts()
    if (!started) return
    setAiShiftMinimizing(true)
  }


  const aiSlotSelectionKey = (blockKey: string, slotIndex: number) => `${blockKey}_${slotIndex}`

  const updateAiShiftSlot = (blockKey: string, slotIndex: number, fields: Partial<AiShiftSlot>) => {
    aiScheduleGenerationStore.setBlocks(prev => prev.map(block => {
      if (block.key !== blockKey) return block
      return { ...block, slots: block.slots.map((slot, i) => i === slotIndex ? { ...slot, ...fields } : slot) }
    }))
  }

  const moveAiShiftSlot = (
    fromBlockKey: string,
    slotIndex: number,
    to: { department_id: string; shift_date: string; assigned_user_id: string | null; assigned_user_name: string | null },
  ) => {
    aiScheduleGenerationStore.setBlocks(prev => {
      const fromBlock = prev.find(b => b.key === fromBlockKey)
      const slot = fromBlock?.slots[slotIndex]
      if (!fromBlock || !slot) return prev
      const toKey = `${to.department_id}_${to.shift_date}`
      const movedSlot: AiShiftSlot = { ...slot, assigned_user_id: to.assigned_user_id, assigned_user_name: to.assigned_user_name }

      if (toKey === fromBlockKey) {
        return prev.map(b => b.key === fromBlockKey ? { ...b, slots: b.slots.map((s, i) => i === slotIndex ? movedSlot : s) } : b)
      }

      const fromSelectionKey = aiSlotSelectionKey(fromBlockKey, slotIndex)
      const wasSelected = aiShiftSelected.has(fromSelectionKey)
      let next = prev.map(b => b.key === fromBlockKey ? { ...b, slots: b.slots.filter((_, i) => i !== slotIndex) } : b)
      next = next.filter(b => b.key !== fromBlockKey || b.slots.length > 0)
      const toBlock = next.find(b => b.key === toKey)
      let newSlotIndex: number
      if (toBlock) {
        newSlotIndex = toBlock.slots.length
        next = next.map(b => b.key === toKey ? { ...b, slots: [...b.slots, movedSlot] } : b)
      } else {
        newSlotIndex = 0
        const deptName = departments.find(d => d.id === to.department_id)?.name ?? fromBlock.department_name
        next = [...next, { key: toKey, department_id: to.department_id, department_name: deptName, shift_date: to.shift_date, slots: [movedSlot], warning: null }]
      }
      if (wasSelected) {
        aiScheduleGenerationStore.setSelected(prevSel => {
          const nextSel = new Set(prevSel)
          nextSel.delete(fromSelectionKey)
          nextSel.add(aiSlotSelectionKey(toKey, newSlotIndex))
          return nextSel
        })
      }
      return next
    })
  }

  const handleAiCreateShifts = async () => {
    if (aiShiftSelected.size === 0) return
    if (!companyId || !internalUserId) return
    const normalizedDateFrom = normalizeDateInput(aiShiftDateFrom)
    const normalizedDateTo = normalizeDateInput(aiShiftDateTo)
    setAiShiftCreateLoading(true); setAiShiftCreateError('')
    try {
      const selectedScheduleItems = aiShiftSuggestions
        .flatMap(block => block.slots.map((shift, slotIndex) => ({ block, shift, slotIndex })))
        .filter(({ block, slotIndex }) => aiShiftSelected.has(aiSlotSelectionKey(block.key, slotIndex)))
        .map(({ block, shift }) => ({
          department_id: block.department_id,
          shift_date: block.shift_date,
          start_time: shift.start_time,
          end_time: shift.end_time,
          user_id: shift.assigned_user_id,
        }))

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

      const items = aiShiftSuggestions
        .flatMap(block => block.slots.map((shift, slotIndex) => ({ block, shift, slotIndex })))
        .filter(({ block, slotIndex }) => aiShiftSelected.has(aiSlotSelectionKey(block.key, slotIndex)))
        .map(({ block, shift }) => ({
          department_id: block.department_id,
          title: `${block.department_name} ${shift.shift_label}`,
          instruction: `${block.department_name} | ${shift.shift_label} | ${shift.reason}`,
          shift_date: block.shift_date,
          start_time: shift.start_time,
          end_time: shift.end_time,
          assigned_user_id: shift.assigned_user_id,
        }))

      const bulkRes = await fetch('/api/shift/bulk-create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ company_id: companyId, created_by: internalUserId, items }),
      })
      const bulkData = await bulkRes.json()
      if (!bulkData.success) throw new Error(bulkData.message || 'Failed to create shifts')
      if (bulkData.result.failed.length > 0) {
        throw new Error(bulkData.result.failed[0].message || 'Failed to create some shifts')
      }
      aiScheduleGenerationStore.clear()
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
    setBulkWarning('')
    setSelectedTemplateId('')
    setExpandedBatchCells(new Set())
    setBatchRepeatEnabled(false)
    setBatchSplitEnabled(false)
    setBatchSplitBlock1End('14:00')
    setBatchSplitBlock2Start('15:00')
    setRecurringShiftForm({
      recurrence_rule: '',
      recurrence_end_date: '',
      custom_interval_days: 1,
      assigned_user_id: '',
    })
    setRecurringShiftError('')
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
    setBulkWarning('')
    setSelectedTemplateId('')
    setExpandedBatchCells(new Set())
    setBatchSplitEnabled(false)
    setBatchSplitBlock1End('14:00')
    setBatchSplitBlock2Start('15:00')
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
    setBulkWarning('')
    setBatchRepeatEnabled(false)
    setRecurringShiftError('')
    setBatchSplitEnabled(false)
  }

  const isSingleCellRepeatEligible = !!batchSingleMember && selectedDates.length === 1 && enabledBatchCells.length === 1

  const previewRepeatDates: string[] = (() => {
    if (!batchRepeatEnabled || !isSingleCellRepeatEligible) return []
    const intervalDays = recurringShiftForm.recurrence_rule === 'daily'
      ? 1
      : recurringShiftForm.recurrence_rule === 'weekly'
        ? 7
        : recurringShiftForm.custom_interval_days
    if (!intervalDays || intervalDays < 1) return []
    const dates: string[] = []
    let next = addDays(new Date(`${selectedDates[0]}T00:00:00`), intervalDays)
    while (formatDateKey(next) <= recurringShiftForm.recurrence_end_date && dates.length < 60) {
      dates.push(formatDateKey(next))
      next = addDays(next, intervalDays)
    }
    return dates
  })()

  const submitBulkAssignment = async () => {
    if (!batchDepartment || !companyId || !internalUserId) return
    setBulkError('')
    setBulkResult('')
    setBulkFailures([])
    setBulkWarning('')
    setRecurringShiftError('')
    if (enabledBatchCells.length === 0) {
      setBulkError('Select at least one enabled shift cell.')
      return
    }
    const invalid = enabledBatchCells.find(cell => cell.start_time >= cell.end_time)
    if (invalid) {
      setBulkError(`Invalid time on ${prettyDate(invalid.shift_date)}. Start time must be before end time.`)
      return
    }
    if (batchRepeatEnabled && isSingleCellRepeatEligible) {
      if (!recurringShiftForm.recurrence_rule) {
        setRecurringShiftError('Choose how often this shift repeats.')
        return
      }
      if (!recurringShiftForm.recurrence_end_date) {
        setRecurringShiftError('Choose a repeat until date.')
        return
      }
      if (recurringShiftForm.recurrence_end_date <= enabledBatchCells[0].shift_date) {
        setRecurringShiftError('Repeat until date must be after the shift date.')
        return
      }
      if (recurringShiftForm.recurrence_end_date > repeatUntilMaxDate) {
        setRecurringShiftError('Repeat until date is too far in the future.')
        return
      }
    }
    if (batchSplitEnabled && isSingleCellRepeatEligible) {
      const cell = enabledBatchCells[0]
      if (cell.start_time >= batchSplitBlock1End) {
        setBulkError('Shift 1: start time must be before end time.')
        return
      }
      if (batchSplitBlock2Start >= cell.end_time) {
        setBulkError('Shift 2: start time must be before end time.')
        return
      }
      if (batchSplitBlock1End > batchSplitBlock2Start) {
        setBulkError('Shift 1 must end before Shift 2 starts.')
        return
      }
    }

    setBulkSubmitting(true)
    try {
      if (batchSplitEnabled && isSingleCellRepeatEligible) {
        const cell = enabledBatchCells[0]
        const res = await fetch('/api/shift/split', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            company_id: companyId,
            department_id: batchDepartment.id,
            shift_date: cell.shift_date,
            blocks: [
              { start_time: cell.start_time, end_time: batchSplitBlock1End },
              { start_time: batchSplitBlock2Start, end_time: cell.end_time },
            ],
            created_by: internalUserId,
            assigned_user_id: cell.user_id,
          }),
        })
        const data = await res.json()
        if (!data.success) throw new Error((data.message || 'Failed to create split shift').replace('CLOPENING_CONFLICT: ', ''))
        const splitGroupId: string | null = data.shifts?.[0]?.split_group_id ?? null

        let recurringCreatedCount = 0
        if (batchRepeatEnabled && splitGroupId) {
          const recRes = await fetch(`/api/shift/split/${splitGroupId}/recurrence`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              recurrence_rule: recurringShiftForm.recurrence_rule,
              recurrence_end_date: recurringShiftForm.recurrence_end_date,
              custom_interval_days: recurringShiftForm.recurrence_rule === 'custom' ? recurringShiftForm.custom_interval_days : undefined,
              created_by: internalUserId,
              assigned_user_id: cell.user_id,
            }),
          })
          const recData = await recRes.json()
          if (!recData.success) throw new Error((recData.message || 'Failed to set recurring shift').replace('CLOPENING_CONFLICT: ', ''))
          recurringCreatedCount = Array.isArray(recData.shifts) ? recData.shifts.length / 2 : 0
        }

        await refreshShiftData()
        if (data.warning) {
          setBulkWarning(data.warning.message)
        } else {
          closeBatchDrawer()
          if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
          setSuccessToast(recurringCreatedCount > 0
            ? `Split shift created — ${recurringCreatedCount} more recurring draft${recurringCreatedCount === 1 ? '' : 's'} created`
            : 'Split shift created')
          toastTimerRef.current = setTimeout(() => setSuccessToast(null), 3000)
        }
        return
      }
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
            template_id: cell.template_id ?? null,
          })),
        }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.message || 'Failed to assign shifts')
      const created: { id: string }[] = data.result?.created ?? []
      const failures: BulkFailure[] = data.result?.failed ?? []
      const warnings: { message: string }[] = data.result?.warnings ?? []

      let recurringCreatedCount = 0
      if (batchRepeatEnabled && isSingleCellRepeatEligible && created[0]) {
        const recRes = await fetch(`/api/shift/${created[0].id}/recurrence`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            recurrence_rule: recurringShiftForm.recurrence_rule,
            recurrence_end_date: recurringShiftForm.recurrence_end_date,
            custom_interval_days: recurringShiftForm.recurrence_rule === 'custom' ? recurringShiftForm.custom_interval_days : undefined,
            created_by: internalUserId,
            assigned_user_id: enabledBatchCells[0].user_id,
          }),
        })
        const recData = await recRes.json()
        if (!recData.success) throw new Error((recData.message || 'Failed to set recurring shift').replace('CLOPENING_CONFLICT: ', ''))
        recurringCreatedCount = Array.isArray(recData.shifts) ? recData.shifts.length : 0
      }

      await refreshShiftData()
      if (failures.length > 0) {
        setBulkFailures(failures)
        setBulkResult('')
      } else if (warnings.length > 0) {
        setBulkWarning(warnings[0].message)
      } else {
        closeBatchDrawer()
        if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
        setSuccessToast(recurringCreatedCount > 0
          ? `Shift assigned — ${recurringCreatedCount} more recurring draft${recurringCreatedCount === 1 ? '' : 's'} created`
          : `${created.length} shift${created.length === 1 ? '' : 's'} assigned successfully`)
        toastTimerRef.current = setTimeout(() => setSuccessToast(null), 3000)
      }
    } catch (err) {
      setBulkError(err instanceof Error ? err.message : 'Failed to assign shifts')
    } finally {
      setBulkSubmitting(false)
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
    setShiftActionWarning('')
    setEditSelectedTemplateId(shift.template_id ?? '')
    setEditSplitEnabled(false)
    setEditSplitBlock1End('14:00')
    setEditSplitBlock2Start('15:00')
    const isRecurrenceOriginal = Boolean(shift.recurrence_group_id) && shift.source_shift_id === null
    setEditIsRecurrenceOriginal(isRecurrenceOriginal)
    setEditRepeatEnabled(isRecurrenceOriginal)
    setEditRecurringTouched(false)
    setEditRecurringError('')
    setEditRecurringForm({
      recurrence_rule: isRecurrenceOriginal ? (shift.recurrence_rule ?? '') : '',
      recurrence_end_date: '',
      custom_interval_days: 1,
      assigned_user_id: '',
    })
  }

  const saveShiftEdit = async () => {
    if (!selectedShift || !internalUserId) return
    setShiftActionError('')
    setShiftActionWarning('')
    setEditRecurringError('')
    if (shiftEditForm.shift_date > maxDate) {
      setShiftActionError('Shift date must be within the next 30 days.')
      return
    }
    if (shiftEditForm.start_time >= shiftEditForm.end_time) {
      setShiftActionError('Start time must be before end time.')
      return
    }
    if (editSplitEnabled) {
      if (shiftEditForm.start_time >= editSplitBlock1End) {
        setShiftActionError('Shift 1: start time must be before end time.')
        return
      }
      if (editSplitBlock2Start >= shiftEditForm.end_time) {
        setShiftActionError('Shift 2: start time must be before end time.')
        return
      }
      if (editSplitBlock1End > editSplitBlock2Start) {
        setShiftActionError('Shift 1 must end before Shift 2 starts.')
        return
      }
    }
    const shouldSubmitRecurrence = editRepeatEnabled && (!editIsRecurrenceOriginal || editRecurringTouched)
    if (shouldSubmitRecurrence) {
      if (!editRecurringForm.recurrence_rule) {
        setEditRecurringError('Choose how often this shift repeats.')
        return
      }
      if (!editRecurringForm.recurrence_end_date) {
        setEditRecurringError('Choose a repeat until date.')
        return
      }
      if (editRecurringForm.recurrence_end_date <= shiftEditForm.shift_date) {
        setEditRecurringError('Repeat until date must be after the shift date.')
        return
      }
      if (editRecurringForm.recurrence_end_date > repeatUntilMaxDate) {
        setEditRecurringError('Repeat until date is too far in the future.')
        return
      }
    }
    setShiftActionLoading(true)
    try {
      if (editSplitEnabled) {
        const splitRes = await fetch('/api/shift/split', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            company_id: companyId,
            department_id: shiftEditForm.department_id,
            shift_date: shiftEditForm.shift_date,
            blocks: [
              { start_time: shiftEditForm.start_time, end_time: editSplitBlock1End },
              { start_time: editSplitBlock2Start, end_time: shiftEditForm.end_time },
            ],
            created_by: internalUserId,
            assigned_user_id: shiftEditForm.assigned_user_id || null,
          }),
        })
        const splitData = await splitRes.json()
        if (!splitData.success) throw new Error((splitData.message || 'Failed to create split shift').replace('CLOPENING_CONFLICT: ', ''))
        const deleteRes = await fetch(`/api/shift/${selectedShift.id}${internalUserId ? `?performed_by=${internalUserId}` : ''}`, { method: 'DELETE' })
        const deleteData = await deleteRes.json()
        if (!deleteData.success) throw new Error(deleteData.message || 'Failed to remove the original shift')

        const splitGroupId: string | null = splitData.shifts?.[0]?.split_group_id ?? null
        if (shouldSubmitRecurrence && splitGroupId) {
          const recRes = await fetch(`/api/shift/split/${splitGroupId}/recurrence`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              recurrence_rule: editRecurringForm.recurrence_rule,
              recurrence_end_date: editRecurringForm.recurrence_end_date,
              custom_interval_days: editRecurringForm.recurrence_rule === 'custom' ? editRecurringForm.custom_interval_days : undefined,
              created_by: internalUserId,
              assigned_user_id: shiftEditForm.assigned_user_id || null,
            }),
          })
          const recData = await recRes.json()
          if (!recData.success) throw new Error((recData.message || 'Failed to set recurring shift').replace('CLOPENING_CONFLICT: ', ''))
        }

        // The original shift no longer exists once split, so there's nothing left to keep this modal open against — surface the warning as a toast instead.
        setSelectedShift(null)
        if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
        setSuccessToast(splitData.warning ? `Shift split into two — ${splitData.warning.message}` : 'Shift split into two')
        toastTimerRef.current = setTimeout(() => setSuccessToast(null), 3000)
        await refreshShiftData()
        return
      }
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
          publication_status: selectedShift.publication_status,
          acceptance_deadline_at: shiftEditForm.acceptance_deadline_at || null,
          assigned_user_id: shiftEditForm.assigned_user_id || null,
          assigned_by: internalUserId,
          template_id: editSelectedTemplateId || null,
          performed_by: internalUserId,
        }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.message || 'Failed to update shift')

      let recurrenceUpdated = false
      if (shouldSubmitRecurrence) {
        const recRes = await fetch(`/api/shift/${selectedShift.id}/recurrence`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            recurrence_rule: editRecurringForm.recurrence_rule,
            recurrence_end_date: editRecurringForm.recurrence_end_date,
            custom_interval_days: editRecurringForm.recurrence_rule === 'custom' ? editRecurringForm.custom_interval_days : undefined,
            created_by: internalUserId,
            assigned_user_id: shiftEditForm.assigned_user_id || null,
          }),
        })
        const recData = await recRes.json()
        if (!recData.success) throw new Error(recData.message || 'Failed to update recurring schedule')
        recurrenceUpdated = true
      }

      await refreshShiftData()
      if (data.warning) {
        setShiftActionWarning(data.warning.message)
      } else {
        setSelectedShift(null)
        if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
        setSuccessToast(recurrenceUpdated ? 'Shift updated — recurring schedule updated' : 'Shift updated successfully')
        toastTimerRef.current = setTimeout(() => setSuccessToast(null), 3000)
      }
    } catch (err) {
      setShiftActionError(err instanceof Error ? err.message : 'Failed to update shift')
    } finally {
      setShiftActionLoading(false)
    }
  }

  const deleteShift = async () => {
    if (!selectedShift) return
    setShiftActionLoading(true)
    setShiftActionError('')
    try {
      const qs = internalUserId ? `?performed_by=${internalUserId}` : ''
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

  const openDuplicateShiftModal = () => {
    if (!selectedShift) return
    setDuplicateShiftForm({
      shift_date: selectedShift.shift_date,
      start_time: selectedShift.start_time,
      end_time: selectedShift.end_time,
      assigned_user_id: '',
    })
    setDuplicateShiftError('')
    setDuplicateSelectedTemplateId(selectedShift.template_id ?? '')
    setDuplicateShiftModalOpen(true)
  }

  const closeDuplicateShiftModal = () => {
    setDuplicateShiftModalOpen(false)
    setDuplicateShiftError('')
  }

  const submitDuplicateShift = async () => {
    if (!selectedShift || !internalUserId) return
    if (!duplicateShiftForm.assigned_user_id) {
      setDuplicateShiftError('Please select who to assign this shift to.')
      return
    }
    if (duplicateShiftForm.shift_date > maxDate) {
      setDuplicateShiftError('Shift date must be within the next 30 days.')
      return
    }
    if (duplicateShiftForm.start_time >= duplicateShiftForm.end_time) {
      setDuplicateShiftError('Start time must be before end time.')
      return
    }
    setDuplicateShiftLoading(true)
    setDuplicateShiftError('')
    try {
      const res = await fetch(`/api/shift/${selectedShift.id}/duplicate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shift_date: duplicateShiftForm.shift_date,
          start_time: duplicateShiftForm.start_time,
          end_time: duplicateShiftForm.end_time,
          created_by: internalUserId,
          assigned_user_id: duplicateShiftForm.assigned_user_id,
          template_id: duplicateSelectedTemplateId || null,
        }),
      })
      const data = await res.json()
      if (!data.success) throw new Error((data.message || 'Failed to duplicate shift').replace('CLOPENING_CONFLICT: ', ''))
      setDuplicateShiftModalOpen(false)
      setSelectedShift(null)
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
      setSuccessToast(data.warning ? 'Shift duplicated with a clopening warning' : 'Shift duplicated as a draft')
      toastTimerRef.current = setTimeout(() => setSuccessToast(null), 3000)
      await refreshShiftData()
    } catch (err) {
      setDuplicateShiftError(err instanceof Error ? err.message : 'Failed to duplicate shift')
    } finally {
      setDuplicateShiftLoading(false)
    }
  }

  const openBulkEditModal = () => {
    setBulkEditDateFrom(todayStr > minDate ? todayStr : minDate)
    setBulkEditDateTo(formatDateKey(addDays(new Date(), 7)))
    setBulkEditDepartmentIds([])
    setBulkEditUserIds([])
    setBulkEditRows([])
    setBulkEditError('')
    setBulkEditRowErrors({})
    setBulkEditModalOpen(true)
  }

  const closeBulkEditModal = () => {
    setBulkEditModalOpen(false)
  }

  const loadBulkEditRows = async () => {
    if (!companyId) return
    if (bulkEditDateFrom > bulkEditDateTo) {
      setBulkEditError('Start date must be before end date.')
      return
    }
    setBulkEditLoading(true)
    setBulkEditError('')
    try {
      const res = await fetch(`/api/shift?company_id=${companyId}&date_from=${bulkEditDateFrom}&date_to=${bulkEditDateTo}`)
      const data = await res.json()
      if (!data.success) throw new Error(data.message || 'Failed to load shifts')
      const rows: TimelineRow[] = data.rows ?? []
      const nextRows: BulkEditRow[] = []
      for (const row of rows) {
        if (bulkEditDepartmentIds.length > 0 && !bulkEditDepartmentIds.includes(row.department_id)) continue
        if (bulkEditUserIds.length > 0 && (!row.user_id || !bulkEditUserIds.includes(row.user_id))) continue
        for (const shift of row.shifts) {
          nextRows.push({
            id: shift.id,
            shift_date: shift.shift_date,
            original_shift_date: shift.shift_date,
            start_time: shift.start_time,
            end_time: shift.end_time,
            department_id: shift.department_id,
            assigned_user_id: row.user_id ?? '',
          })
        }
      }
      nextRows.sort((a, b) => a.shift_date.localeCompare(b.shift_date) || a.start_time.localeCompare(b.start_time))
      setBulkEditRows(nextRows)
      setBulkEditRowErrors({})
    } catch (err) {
      setBulkEditError(err instanceof Error ? err.message : 'Failed to load shifts')
    } finally {
      setBulkEditLoading(false)
    }
  }

  useEffect(() => {
    if (!bulkEditModalOpen) return
    void loadBulkEditRows()
  }, [bulkEditModalOpen, bulkEditDateFrom, bulkEditDateTo, bulkEditDepartmentIds, bulkEditUserIds])

  const updateBulkEditRow = (id: string, fields: Partial<BulkEditRow>) => {
    setBulkEditRows(prev => prev.map(row => row.id === id ? { ...row, ...fields } : row))
  }

  const submitBulkEdit = async () => {
    const editableRows = bulkEditRows.filter(row => row.shift_date >= todayStr)
    if (!companyId || !internalUserId || editableRows.length === 0) return
    setBulkEditSaving(true)
    setBulkEditError('')
    setBulkEditRowErrors({})
    try {
      const res = await fetch('/api/shift/bulk-edit', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company_id: companyId,
          performed_by: internalUserId,
          items: editableRows.map(row => ({
            id: row.id,
            shift_date: row.shift_date,
            start_time: row.start_time,
            end_time: row.end_time,
            department_id: row.department_id,
            assigned_user_id: row.assigned_user_id || null,
          })),
        }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.message || 'Failed to save changes')
      const failed: { id: string; message: string }[] = data.result?.failed ?? []
      if (failed.length > 0) {
        setBulkEditRowErrors(Object.fromEntries(failed.map(f => [f.id, f.message])))
        setBulkEditError(`${failed.length} row${failed.length === 1 ? '' : 's'} failed to save — see details below.`)
      } else {
        setBulkEditModalOpen(false)
        if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
        setSuccessToast(`Updated ${data.result.updated.length} shift${data.result.updated.length === 1 ? '' : 's'}`)
        toastTimerRef.current = setTimeout(() => setSuccessToast(null), 3000)
      }
      await refreshShiftData()
    } catch (err) {
      setBulkEditError(err instanceof Error ? err.message : 'Failed to save changes')
    } finally {
      setBulkEditSaving(false)
    }
  }

  const deleteBulkEditRow = async (id: string) => {
    if (!internalUserId) return
    setBulkEditDeletingId(id)
    setBulkEditError('')
    try {
      const res = await fetch(`/api/shift/${id}?performed_by=${internalUserId}`, { method: 'DELETE' })
      const data = await res.json()
      if (!data.success) throw new Error(data.message || 'Failed to delete shift')
      // Deleting a recurring original cascades to its sibling occurrences server-side, so reload the full row set instead of filtering only this id.
      await loadBulkEditRows()
      await refreshShiftData()
      setSuccessToast('Shift deleted')
      toastTimerRef.current = setTimeout(() => setSuccessToast(null), 3000)
    } catch (err) {
      setBulkEditError(err instanceof Error ? err.message : 'Failed to delete shift')
    } finally {
      setBulkEditDeletingId(null)
    }
  }

  const submitSaveTemplate = async () => {
    if (!companyId || !internalUserId || !batchDepartment) return
    if (!templateSaveName.trim()) {
      setTemplateSaveError('Please name this template.')
      return
    }
    const toHM = (t: string) => t.slice(0, 5)
    const isDuplicateTime = shiftTemplates.some(t => toHM(t.start_time) === toHM(defaultStartTime) && toHM(t.end_time) === toHM(defaultEndTime))
    if (isDuplicateTime) {
      setTemplateSaveError('A template with this start and end time already exists.')
      return
    }
    setTemplateSaveLoading(true)
    setTemplateSaveError('')
    try {
      const res = await fetch('/api/shift-template', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company_id: companyId,
          name: templateSaveName.trim(),
          start_time: defaultStartTime,
          end_time: defaultEndTime,
          created_by: internalUserId,
        }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.message || 'Failed to save template')
      setTemplateSaveOpen(false)
      setTemplateSaveName('')
      await fetchShiftTemplates(companyId)
      setErrorToast(null)
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
      setSuccessToast('Shift template created')
      toastTimerRef.current = setTimeout(() => setSuccessToast(null), 3000)
    } catch (err) {
      setTemplateSaveError(err instanceof Error ? err.message : 'Failed to save template')
    } finally {
      setTemplateSaveLoading(false)
    }
  }

  const startEditTemplate = (template: ShiftTemplate) => {
    setTemplateEditId(template.id)
    setTemplateEditName(template.name)
    setTemplateEditStartTime(template.start_time.slice(0, 5))
    setTemplateEditEndTime(template.end_time.slice(0, 5))
    setTemplateEditError('')
  }

  const cancelEditTemplate = () => {
    setTemplateEditId(null)
    setTemplateEditError('')
  }

  const submitEditTemplate = async () => {
    if (!templateEditId) return
    if (!templateEditName.trim()) {
      setTemplateEditError('Please name this template.')
      return
    }
    setTemplateEditLoading(true)
    setTemplateEditError('')
    try {
      const res = await fetch(`/api/shift-template/${templateEditId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: templateEditName.trim(),
          start_time: templateEditStartTime,
          end_time: templateEditEndTime,
        }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.message || 'Failed to update template')
      setTemplateEditId(null)
      if (companyId) await fetchShiftTemplates(companyId)
      setErrorToast(null)
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
      setSuccessToast('Shift template updated')
      toastTimerRef.current = setTimeout(() => setSuccessToast(null), 3000)
    } catch (err) {
      setTemplateEditError(err instanceof Error ? err.message : 'Failed to update template')
    } finally {
      setTemplateEditLoading(false)
    }
  }

  const deleteTemplate = async (templateId: string) => {
    if (!companyId) return
    setTemplateDeleteLoadingId(templateId)
    try {
      const res = await fetch(`/api/shift-template/${templateId}`, { method: 'DELETE' })
      const data = await res.json()
      if (!data.success) throw new Error(data.message || 'Failed to delete template')
      await fetchShiftTemplates(companyId)
      setErrorToast(null)
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
      setSuccessToast('Shift template deleted')
      toastTimerRef.current = setTimeout(() => setSuccessToast(null), 3000)
    } catch (err) {
      setSuccessToast(null)
      if (errorToastTimerRef.current) clearTimeout(errorToastTimerRef.current)
      setErrorToast(err instanceof Error ? err.message : 'Failed to delete template')
      errorToastTimerRef.current = setTimeout(() => setErrorToast(null), 3000)
    } finally {
      setTemplateDeleteLoadingId(null)
    }
  }

  // Standalone "Shift Templates" modal handlers (list -> create/edit), mirroring Task Templates'
  // handleSaveTemplate/handleDeleteTemplate in src/app/owner/tasks/page.tsx.
  const openCreateShiftTemplateEntry = () => {
    setShiftTemplateFormId('')
    setShiftTemplateFormName('')
    setShiftTemplateFormStartTime('09:00')
    setShiftTemplateFormEndTime('17:00')
    setShiftTemplateTimeTouched(false)
    setShiftTemplateFormMode('create')
    setShiftTemplateFormError('')
    setShiftTemplateModalOpen(true)
  }

  const openEditShiftTemplateEntry = (template: ShiftTemplate) => {
    setShiftTemplateFormId(template.id)
    setShiftTemplateFormName(template.name)
    setShiftTemplateFormStartTime(template.start_time)
    setShiftTemplateFormEndTime(template.end_time)
    setShiftTemplateTimeTouched(true)
    setShiftTemplateFormMode('edit')
    setShiftTemplateFormError('')
    setShiftTemplateModalOpen(true)
  }

  const handleSaveShiftTemplateEntry = async () => {
    if (!shiftTemplateFormName.trim()) { setShiftTemplateFormError('Name is required'); return }
    if (!shiftTemplateFormStartTime || !shiftTemplateFormEndTime) { setShiftTemplateFormError('Start and end time are required'); return }
    if (shiftTemplateFormStartTime >= shiftTemplateFormEndTime) { setShiftTemplateFormError('Start time must be before end time'); return }
    setShiftTemplateFormLoading(true)
    setShiftTemplateFormError('')
    try {
      const isEdit = shiftTemplateFormMode === 'edit'
      const res = await fetch(isEdit ? `/api/shift-template/${shiftTemplateFormId}` : '/api/shift-template', {
        method: isEdit ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(isEdit ? {
          name: shiftTemplateFormName.trim(),
          start_time: shiftTemplateFormStartTime,
          end_time: shiftTemplateFormEndTime,
        } : {
          company_id: companyId,
          name: shiftTemplateFormName.trim(),
          start_time: shiftTemplateFormStartTime,
          end_time: shiftTemplateFormEndTime,
          created_by: internalUserId,
        }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.message || 'Failed to save template')
      await fetchShiftTemplates(companyId)
      setShiftTemplateModalOpen(false)
      setErrorToast(null)
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
      setSuccessToast(isEdit ? 'Shift template updated' : 'Shift template created')
      toastTimerRef.current = setTimeout(() => setSuccessToast(null), 3000)
    } catch (err) {
      setShiftTemplateFormError(err instanceof Error ? err.message : 'Failed to save template')
    } finally {
      setShiftTemplateFormLoading(false)
    }
  }

  const handleDeleteShiftTemplateEntry = async (id: string) => {
    setDeleteShiftTemplateLoading(true)
    try {
      const res = await fetch(`/api/shift-template/${id}`, { method: 'DELETE' })
      const data = await res.json()
      if (!data.success) throw new Error(data.message || 'Failed to delete template')
      await fetchShiftTemplates(companyId)
      setErrorToast(null)
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
      setSuccessToast('Shift template deleted')
      toastTimerRef.current = setTimeout(() => setSuccessToast(null), 3000)
    } catch (err) {
      setShiftTemplateFormError(err instanceof Error ? err.message : 'Failed to delete template')
    } finally {
      setDeleteShiftTemplateLoading(false)
    }
  }

  const handleUndoLastAction = async () => {
    if (!companyId || !internalUserId) return
    setUndoLoading(true)
    try {
      const res = await fetch('/api/shift/undo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ company_id: companyId, performed_by: internalUserId }),
      })
      const data = await res.json()
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
      if (!data.success) {
        setSuccessToast(null)
        setErrorToast(data.message || 'No recent shift action to undo')
        errorToastTimerRef.current = setTimeout(() => setErrorToast(null), 3000)
        return
      }
      setErrorToast(null)
      setSuccessToast(`Undid last action: ${data.action_type}`)
      toastTimerRef.current = setTimeout(() => setSuccessToast(null), 3000)
      await refreshShiftData()
    } catch (err) {
      if (errorToastTimerRef.current) clearTimeout(errorToastTimerRef.current)
      setErrorToast(err instanceof Error ? err.message : 'Failed to undo last action')
      errorToastTimerRef.current = setTimeout(() => setErrorToast(null), 3000)
    } finally {
      setUndoLoading(false)
    }
  }

  const handleRedoLastAction = async () => {
    if (!companyId || !internalUserId) return
    setRedoLoading(true)
    try {
      const res = await fetch('/api/shift/redo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ company_id: companyId, performed_by: internalUserId }),
      })
      const data = await res.json()
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
      if (!data.success) {
        setSuccessToast(null)
        setErrorToast(data.message || 'No recently undone action to redo')
        errorToastTimerRef.current = setTimeout(() => setErrorToast(null), 3000)
        return
      }
      setErrorToast(null)
      setSuccessToast(`Redid action: ${data.action_type}`)
      toastTimerRef.current = setTimeout(() => setSuccessToast(null), 3000)
      await refreshShiftData()
    } catch (err) {
      if (errorToastTimerRef.current) clearTimeout(errorToastTimerRef.current)
      setErrorToast(err instanceof Error ? err.message : 'Failed to redo last undone action')
      errorToastTimerRef.current = setTimeout(() => setErrorToast(null), 3000)
    } finally {
      setRedoLoading(false)
    }
  }

  const visibleScheduleRange = (): { date_from: string; date_to: string } => {
    if (shiftViewMode === 'calendar') {
      const anchor = new Date(`${timelineDate}T00:00:00`)
      const dow = (anchor.getDay() + 6) % 7  // 0=Mon … 6=Sun
      const mon = new Date(anchor); mon.setDate(anchor.getDate() - dow)
      const sun = new Date(mon); sun.setDate(mon.getDate() + 6)
      return { date_from: formatDateKey(mon), date_to: formatDateKey(sun) }
    }
    return { date_from: timelineDate, date_to: timelineDate }
  }

  const visibleShiftsForPublishToggle = (shiftViewMode === 'calendar' ? calWeekRows : timelineRows)
    .filter(row => !selectedDepartmentId || row.department_id === selectedDepartmentId)
    .flatMap(row => row.shifts)
    .filter(shift => shift.shift_date >= todayStr)
  const hasDraftInScope = visibleShiftsForPublishToggle.some(s => s.publication_status === 'draft')
  const isFullyPublished = visibleShiftsForPublishToggle.length > 0 && !hasDraftInScope

  const handleTogglePublishSchedule = async () => {
    if (!companyId) return
    const nextStatus: 'draft' | 'published' = hasDraftInScope ? 'published' : 'draft'
    const { date_from, date_to } = visibleScheduleRange()
    const clampedDateFrom = date_from < todayStr ? todayStr : date_from
    if (clampedDateFrom > date_to) return
    setPublishLoading(true)
    try {
      const res = await fetch('/api/shift/schedule', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ company_id: companyId, date_from: clampedDateFrom, date_to, publication_status: nextStatus, performed_by: internalUserId, department_id: selectedDepartmentId ?? undefined }),
      })
      const data = await res.json()
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
      if (!data.success) {
        setSuccessToast(null)
        setErrorToast(data.message || `Failed to ${nextStatus === 'published' ? 'publish' : 'unpublish'} schedule`)
        errorToastTimerRef.current = setTimeout(() => setErrorToast(null), 4000)
        return
      }
      setErrorToast(null)
      setSuccessToast(nextStatus === 'published' ? 'Schedule published' : 'Schedule unpublished')
      toastTimerRef.current = setTimeout(() => setSuccessToast(null), 3000)
      await refreshShiftData()
    } catch (err) {
      if (errorToastTimerRef.current) clearTimeout(errorToastTimerRef.current)
      setErrorToast(err instanceof Error ? err.message : 'Failed to update schedule')
      errorToastTimerRef.current = setTimeout(() => setErrorToast(null), 4000)
    } finally {
      setPublishLoading(false)
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
    <div style={{ display: 'flex', background: 'linear-gradient(135deg, #0F172A 0%, #1E293B 100%)', borderRadius: '12px 12px 0 0', position: 'sticky', top: 0, zIndex: 5 }}>
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
    const isUnassignedRow = row.user_id === null
    const isOpenRow = isUnassignedRow && timelineDate >= formatDateKey(new Date())
    return (
      <div key={row.user_id ?? `${row.department_id}_open`} className="tl-row" style={{ display: 'flex', height: 58, borderTop, background: isUnassignedRow ? '#FAFAFA' : '#FFFFFF' }}>
        <div style={{ width: 8, flexShrink: 0, background: isUnassignedRow ? '#CBD5E1' : barColor, opacity: 0.85 }} />
        <div style={{ width: TL_NAME_COL - 8, flexShrink: 0, display: 'flex', alignItems: 'center', overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flex: 1, padding: '0 10px 0 12px', cursor: 'default', textAlign: 'left', height: '100%' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 26, height: 26, flexShrink: 0, background: row.profile_photo_url ? 'transparent' : isUnassignedRow ? '#F3F4F6' : (row.role === 'Manager' ? '#FFF7ED' : '#F3F4F6'), color: isUnassignedRow ? '#9CA3AF' : row.role === 'Manager' ? '#EA580C' : '#4B5563', borderRadius: 999, overflow: 'hidden', border: isOpenRow ? '1.5px dashed #CBD5E1' : 'none' }}>
              {row.profile_photo_url
                ? <img src={row.profile_photo_url} alt={row.full_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : isOpenRow ? <AlertTriangle size={12} /> : isUnassignedRow ? <UserRound size={13} /> : row.role === 'Manager' ? <UserCog size={13} /> : <UserRound size={13} />}
            </div>
            <span className="tl-name" style={{ ...MEMBER_NAME_STYLE, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', transition: 'color 0.14s ease', color: isUnassignedRow ? '#9CA3AF' : MEMBER_NAME_STYLE.color, fontStyle: isOpenRow ? 'italic' : 'normal' }}>
              {isOpenRow ? 'Open — needs staffing' : isUnassignedRow ? 'Unassigned' : row.full_name}
            </span>
          </div>
        </div>
        <div style={{ position: 'relative', flex: 1 }}>
          {tlHourTicks.map(h => (
            <div key={`grid-${h}`} style={{ position: 'absolute', top: 0, bottom: 0, left: `${tlPad(h * 60)}%`, width: 0, borderLeft: '1px dashed rgba(15,23,42,0.55)', pointerEvents: 'none', zIndex: 2 }} />
          ))}
          {row.shifts.length === 0 && row.user_id && (() => {
            if (fixedOffByUserDate.get(`${row.user_id}|${timelineDate}`)) {
              return (
                <div title={`${row.full_name} — approved off day`} style={{ position: 'absolute', top: 10, bottom: 10, left: `${TL_PAD}%`, right: `${TL_PAD}%`, borderRadius: 999, background: '#F5F3FF', border: '1.5px solid #C4B5FD', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, zIndex: 1 }}>
                  <CalendarIcon size={12} color="#7C3AED" />
                  <span style={{ fontSize: '0.78rem', fontWeight: 600, color: '#7C3AED', whiteSpace: 'nowrap' }}>Off Day</span>
                </div>
              )
            }
            const dept = departments.find(d => d.id === row.department_id)
            const isTimelinePast = timelineDate < formatDateKey(new Date())
            return (
              <button
                type="button"
                className="off-bar"
                onClick={() => { if (!isTimelinePast && dept) openBatchDrawer(dept, row.user_id!, timelineDate) }}
                onMouseEnter={e => { if (!isTimelinePast) e.currentTarget.style.background = '#CBD5E1' }}
                onMouseLeave={e => { e.currentTarget.style.background = '#E2E8F0' }}
                style={{ position: 'absolute', top: 10, bottom: 10, left: `${TL_PAD}%`, right: `${TL_PAD}%`, borderRadius: 999, background: '#E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1, border: 'none', cursor: isTimelinePast ? 'default' : 'pointer', transition: 'background 0.15s' }}
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
            const shiftColor = isUnassignedRow ? '#94A3B8' : deptColor(row.department_id)
            const isDraft = shift.publication_status === 'draft'
            return (
              <button
                key={`${shift.id}_${shift.assignment_id ?? 'open'}`}
                type="button"
                className="shift-bar"
                onClick={() => openShiftDetail(shift, row, timelineDate < formatDateKey(new Date()))}
                onMouseEnter={e => { if (timelineDate >= formatDateKey(new Date())) e.currentTarget.style.filter = 'brightness(1.08)' }}
                onMouseLeave={e => { e.currentTarget.style.filter = 'none' }}
                style={{
                  position: 'absolute',
                  top: 10, bottom: 10,
                  left: `${left}%`,
                  width: `${Math.max(width, 1.5)}%`,
                  border: isOpenRow ? '1.5px dashed #FFFFFF' : isDraft ? '1.5px dashed rgba(255,255,255,0.85)' : 0,
                  borderRadius: 999,
                  background: shiftColor,
                  opacity: isDraft ? 0.72 : 1,
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
                  gap: 4,
                }}
                title={`${isOpenRow ? 'Open shift — needs staffing' : isUnassignedRow ? 'Unassigned shift' : row.full_name} ${formatShiftHour(shift.start_time)} – ${formatShiftHour(shift.end_time)}${isDraft ? ' (Draft)' : ''}`}
              >
                {isOpenRow && width > 8 && <AlertTriangle size={10} style={{ flexShrink: 0 }} />}
                <span style={{ fontSize: '0.72rem', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {formatShiftHour(shift.start_time)} – {formatShiftHour(shift.end_time)}
                </span>
                {isDraft && width > 12 && (
                  <span style={{ fontSize: '0.6rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', opacity: 0.85, flexShrink: 0 }}>Draft</span>
                )}
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
      <div className="shift-tab-content" style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: '14px 16px 18px 18px' }}>
        <div style={{ minWidth: 700, borderRadius: 12, overflow: 'hidden', border: `1px solid ${BORDER}` }}>
          {/* Header row */}
          <div style={{ display: 'grid', gridTemplateColumns: `${NAME_COL}px repeat(7, 1fr)`, background: 'linear-gradient(135deg, #0F172A 0%, #1E293B 100%)', height: 54, position: 'sticky', top: 0, zIndex: 5 }}>
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
                  const maxShiftsInRow = Math.max(1, ...weekDates.map(date => row.shifts.filter((s: TimelineShiftBlock) => s.shift_date === date).length))
                  const rowHeight = Math.max(58, maxShiftsInRow * 28 + (maxShiftsInRow - 1) * 4 + 30)
                  return (
                    <div key={row.user_id ?? `r-${deptIdx}-${rowIdx}`} style={{ display: 'grid', gridTemplateColumns: `${NAME_COL}px repeat(7, 1fr)`, borderTop, background: '#FFFFFF', height: rowHeight }}>
                      {/* Color bar + Name cell */}
                      <div style={{ display: 'flex', alignItems: 'center', borderRight: `1px solid ${BORDER}`, overflow: 'hidden', height: rowHeight }}>
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
                          <div key={date} style={{ padding: '0 6px', borderRight: `1px solid ${BORDER}`, height: rowHeight, overflow: 'hidden', display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'stretch', justifyContent: 'center' }}>
                            {dayShifts.length === 0 ? (
                              fixedOffByUserDate.get(`${row.user_id}|${date}`) ? (
                                <div title={`${row.full_name} — approved off day`} style={{ borderRadius: 999, background: '#F5F3FF', border: '1.5px solid #C4B5FD', display: 'flex', alignItems: 'center', justifyContent: 'center', height: 24, gap: 4 }}>
                                  <CalendarIcon size={10} color="#7C3AED" />
                                  <span style={{ fontSize: 10, fontWeight: 600, color: '#7C3AED', whiteSpace: 'nowrap' }}>Off Day</span>
                                </div>
                              ) : (
                              <div style={{ borderRadius: 999, background: '#E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'center', height: 24, cursor: isPastDate ? 'default' : 'pointer', transition: 'background 0.15s' }}
                                onClick={() => {
                                  if (isPastDate) return
                                  const dept = departments.find(d => d.id === row.department_id)
                                  if (!dept) return
                                  openBatchDrawer(dept, row.user_id!, date)
                                }}
                                onMouseEnter={e => { if (!isPastDate) e.currentTarget.style.background = '#CBD5E1' }}
                                onMouseLeave={e => { e.currentTarget.style.background = '#E2E8F0' }}
                                title={isPastDate ? undefined : `Assign shift to ${row.full_name} on ${date}`}
                              >
                                <span style={{ fontSize: 10, fontWeight: 600, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Off</span>
                              </div>
                              )
                            ) : dayShifts.map((shift: TimelineShiftBlock) => {
                                const isDraft = shift.publication_status === 'draft'
                                return (
                                <button
                                  key={shift.id}
                                  onClick={() => openShiftDetail(shift, row, isPastDate)}
                                  title={`${formatShiftHour(shift.start_time)} – ${formatShiftHour(shift.end_time)}${isDraft ? ' (Draft)' : ''}`}
                                  style={{
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                                    padding: '0 8px', height: 28, flexShrink: 0,
                                    background: barColor,
                                    border: isDraft ? '1.5px dashed rgba(255,255,255,0.85)' : 'none', borderRadius: 999,
                                    cursor: isPastDate ? 'default' : 'pointer', width: '100%',
                                    opacity: isPastDate ? 0.7 : (isDraft ? 0.72 : 1),
                                  }}
                                  onMouseEnter={e => { if (!isPastDate) e.currentTarget.style.filter = 'brightness(1.08)' }}
                                  onMouseLeave={e => { e.currentTarget.style.filter = 'none' }}
                                >
                                  <span style={{ fontSize: 10.5, fontWeight: 600, color: '#FFFFFF', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                    {formatShiftHour(shift.start_time)} – {formatShiftHour(shift.end_time)}
                                  </span>
                                  {isDraft && <span style={{ fontSize: '0.55rem', fontWeight: 700, color: '#FFFFFF', textTransform: 'uppercase', letterSpacing: '0.04em', opacity: 0.85, flexShrink: 0 }}>Draft</span>}
                                </button>
                                )
                              })}
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
      <div className="shift-tab-content" style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: '14px 16px 18px 18px' }}>
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

          <div data-owner-header-badges style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0, paddingTop: 4 }}>
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

        <div style={{ display: 'flex', flexDirection: 'column', gap: 24, padding: '0 28px 24px', flex: 1, minHeight: 0, overflow: 'hidden' }}>
          {initialReady && !companyId && (
            <div style={{ background: '#FFFBEB', borderRadius: 12, padding: '14px 16px', fontSize: 13, color: '#92400E', border: '1px solid #FDE68A' }}>
              No company is linked to your profile yet. If you just accepted an invitation, try signing out and signing in again.
            </div>
          )}

          {companyId && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(300px, 326px) minmax(0, 1fr)', gap: 16, alignItems: 'stretch', flex: 1, minHeight: 0, overflow: 'hidden' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0, minHeight: 0, overflowY: 'auto' }}>
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
                  <h2 style={{ margin: 0, ...SECTION_TITLE_STYLE, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
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
                    <div key={`${member.id}-${shiftViewMode}`} className="member-card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, border: `1px solid ${PANEL_BORDER}`, borderRadius: 12, padding: '13px 12px', background: '#FFFFFF', animationDelay: `${memberIdx * 50}ms` }}>
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
                  const employeeCount = deptMembers.filter(member => member.role === 'Employee' && userIdsWithShiftToday.has(member.id)).length
                  const deptManagerList = departmentManagers.filter(item => item.department_id === department.id)
                  const managerCountToday = deptManagerList.filter(item => userIdsWithShiftToday.has(item.manager_id)).length
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
                            <span style={{ color: '#111827', fontSize: 15, fontWeight: 600 }}>{managerCountToday}</span>
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
                  style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7, border: 0, borderRadius: 10, background: 'linear-gradient(135deg, #7C3AED, #6D28D9)', color: '#FFFFFF', height: 36, padding: '0 14px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
                >
                  <Sparkles size={15} strokeWidth={2.5} /> AI Schedule
                </button>
              </div>
              </>
            )}
          </div>
        </section>

        <section className="shift-template-panel" style={{ background: '#FFFFFF', border: `1px solid ${PANEL_BORDER}`, borderRadius: 14, overflow: 'visible' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '16px 18px', borderBottom: `1px solid ${PANEL_BORDER}` }}>
            <div style={{ width: 30, height: 30, borderRadius: 9, background: '#FFF7ED', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <LayoutTemplate size={15} style={{ color: '#F97316' }} />
            </div>
            <span style={SECTION_TITLE_STYLE}>Templates</span>
          </div>
          <div style={{ padding: 14 }}>
            {shiftTemplates.length === 0 ? (
              <div style={{ borderRadius: 12, background: '#F8FAFC', padding: 18, color: '#94A3B8', fontSize: 13, fontWeight: 600, textAlign: 'center', marginBottom: 10 }}>
                No shift templates yet.
              </div>
            ) : (
              <div style={{ display: 'grid', gap: 10, marginBottom: 10 }}>
                {shiftTemplates.map((t, idx) => (
                  <div key={`${t.id}-${shiftViewMode}`} className="shift-template-card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, border: `1px solid ${PANEL_BORDER}`, borderRadius: 12, padding: '13px 14px', background: '#F9FAFB', animationDelay: `${idx * 50}ms` }}>
                    <div style={{ minWidth: 0, paddingLeft: 4 }}>
                      <p style={{ margin: 0, ...DEPARTMENT_NAME_STYLE, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.name}</p>
                      <p style={{ margin: '6px 0 0', fontSize: 12, color: '#9CA3AF', fontWeight: 600 }}>{formatShiftHour(t.start_time)} – {formatShiftHour(t.end_time)}</p>
                    </div>
                    <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                      <button
                        type="button"
                        onClick={() => openEditShiftTemplateEntry(t)}
                        title="Edit template"
                        style={{ border: 'none', background: 'transparent', color: '#6B7280', cursor: 'pointer', display: 'flex', padding: 6, borderRadius: 6 }}
                        onMouseEnter={e => { e.currentTarget.style.color = OWNER_ORANGE; e.currentTarget.style.background = '#FFF7ED' }}
                        onMouseLeave={e => { e.currentTarget.style.color = '#6B7280'; e.currentTarget.style.background = 'transparent' }}
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleDeleteShiftTemplateEntry(t.id)}
                        disabled={deleteShiftTemplateLoading}
                        title="Delete template"
                        style={{ border: 'none', background: 'transparent', color: '#DC2626', cursor: deleteShiftTemplateLoading ? 'default' : 'pointer', display: 'flex', padding: 6, borderRadius: 6, opacity: deleteShiftTemplateLoading ? 0.5 : 1 }}
                        onMouseEnter={e => { if (!deleteShiftTemplateLoading) e.currentTarget.style.background = '#FEE2E2' }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                      >
                        {deleteShiftTemplateLoading ? <Spinner size={13} /> : <Trash2 size={14} />}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {companyId && (
              <div style={{ display: 'flex', justifyContent: 'center' }}>
                <button
                  type="button"
                  onClick={openCreateShiftTemplateEntry}
                  style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7, border: 'none', borderRadius: 10, background: 'linear-gradient(135deg, #F97316, #EA580C)', color: '#FFFFFF', height: 36, padding: '0 14px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
                >
                  <Plus size={15} strokeWidth={2.5} /> New Template
                </button>
              </div>
            )}
          </div>
        </section>
        </div>

        <section className="shift-timeline-panel" style={{ background: '#FFFFFF', border: `1px solid ${PANEL_BORDER}`, borderRadius: 14, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '14px 18px', borderBottom: `1px solid ${PANEL_BORDER}`, flexWrap: 'wrap', flexShrink: 0 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 30, height: 30, borderRadius: 9, background: '#FFF7ED', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <CalendarDays size={15} style={{ color: '#F97316' }} />
                </div>
                <span style={SECTION_TITLE_STYLE}>{shiftViewMode === 'calendar' ? (selectedDepartment ? `${selectedDepartment.name} Weekly Shift` : 'All Department Weekly Shift') : (selectedDepartment ? `${selectedDepartment.name} Shift Timeline` : 'All Departments Shift Timeline')}</span>
                {companyId && (
                  <button
                    type="button"
                    onClick={handleTogglePublishSchedule}
                    disabled={publishLoading || visibleShiftsForPublishToggle.length === 0}
                    aria-label={isFullyPublished ? 'Unpublish schedule' : 'Publish schedule'}
                    title={isFullyPublished ? 'Unpublish the currently viewed schedule' : 'Publish the currently viewed schedule'}
                    style={{
                      ...secondaryButtonStyle,
                      opacity: (publishLoading || visibleShiftsForPublishToggle.length === 0) ? 0.55 : 1,
                      cursor: (publishLoading || visibleShiftsForPublishToggle.length === 0) ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {publishLoading ? <Spinner size={13} dark /> : <Send size={14} />} {isFullyPublished ? 'Unpublish' : 'Publish'}
                  </button>
                )}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              {companyId && (
                <button
                  type="button"
                  onClick={handleUndoLastAction}
                  disabled={undoLoading}
                  aria-label="Undo last shift action"
                  title="Undo last shift action"
                  style={{ ...secondaryButtonStyle, opacity: undoLoading ? 0.65 : 1, cursor: undoLoading ? 'not-allowed' : 'pointer' }}
                >
                  {undoLoading ? <Spinner size={13} dark /> : <Undo2 size={14} />} Undo
                </button>
              )}
              {companyId && (
                <button
                  type="button"
                  onClick={handleRedoLastAction}
                  disabled={redoLoading}
                  aria-label="Redo last undone shift action"
                  title="Redo last undone shift action"
                  style={{ ...secondaryButtonStyle, opacity: redoLoading ? 0.65 : 1, cursor: redoLoading ? 'not-allowed' : 'pointer' }}
                >
                  {redoLoading ? <Spinner size={13} dark /> : <Redo2 size={14} />} Redo
                </button>
              )}
              {companyId && departments.length > 0 && (
                <button
                  type="button"
                  onClick={openBulkEditModal}
                  style={secondaryButtonStyle}
                >
                  <Table2 size={14} /> Bulk Edit
                </button>
              )}
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
                    return (
                      <>
                        <button type="button" onClick={() => goWeek(-1)} style={iconButtonStyle}><ChevronLeft size={16} /></button>
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
                    <button type="button" onClick={() => setTimelineByOffset(-1)} style={iconButtonStyle}><ChevronLeft size={16} /></button>
                    <TimelineDatePicker value={timelineDate} onChange={setTimelineDateAndClearSelection} shiftDates={datesWithShifts} anchorRef={timelineControlsRef} />
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
                    <p style={{ margin: '0 0 8px', fontSize: 11, fontWeight: 800, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Weekly Days Off</p>
                    {profileSummary.fixed_off_days.length === 0 ? (
                      <p style={{ margin: 0, fontSize: 13, color: MUTED }}>No approved weekly day off dates.</p>
                    ) : (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {profileSummary.fixed_off_days.map(date => (
                          <span key={date} style={{ height: 28, padding: '0 12px', borderRadius: 999, fontSize: 12, fontWeight: 700, display: 'inline-flex', alignItems: 'center', background: '#FEF2F2', color: '#B91C1C', border: '1px solid #FECACA' }}>
                            {new Date(`${date}T00:00:00`).toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' })}
                          </span>
                        ))}
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
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, animation: 'overlayFadeIn 0.18s ease-out', opacity: aiShiftMinimizing ? 0 : 1, transition: aiShiftMinimizing ? 'opacity 0.45s ease' : 'none', pointerEvents: aiShiftMinimizing ? 'none' : 'auto' }}>
          <div onClick={e => e.stopPropagation()} style={{ width: aiShiftWizardStep === 'generate' && aiShiftSuggestions.length > 0 ? 1120 : 480, maxWidth: 'calc(100% - 40px)', maxHeight: '92vh', background: '#FFFFFF', borderRadius: 20, boxShadow: '0 24px 64px rgba(0,0,0,0.16), 0 4px 16px rgba(0,0,0,0.08)', display: 'flex', flexDirection: 'column', overflow: 'hidden', flexShrink: 0, transformOrigin: 'top right', transform: aiShiftMinimizing ? 'translate(46vw, -46vh) scale(0.04)' : 'none', opacity: aiShiftMinimizing ? 0 : 1, transition: aiShiftMinimizing ? 'transform 0.5s cubic-bezier(0.4,0,0.2,1), opacity 0.5s ease' : 'width 0.25s ease', animation: aiShiftMinimizing ? 'none' : 'modalSlideIn 0.22s cubic-bezier(0.16,1,0.3,1)' }}>
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
                      aria-label="Close"
                      style={{ background: '#F9FAFB', border: '1px solid #E5E7EB', cursor: 'pointer', color: '#6B7280', display: 'flex', padding: '6px', borderRadius: 8, flexShrink: 0 }}
                      onMouseEnter={e => { e.currentTarget.style.background = '#F3F4F6' }}
                      onMouseLeave={e => { e.currentTarget.style.background = '#F9FAFB' }}
                    ><X size={16} /></button>
                  </div>

                  <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 28 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 8 }}>
                      {AI_WIZARD_STEPS.map((s, i) => {
                        const isDone = stepIdx > i
                        return (
                          <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                            {isDone ? (
                              <button
                                type="button"
                                onClick={() => {
                                  // Going back to an earlier step to change dates/departments/shift
                                  // types means the Owner no longer wants the run currently in
                                  // flight — cancel it rather than let it keep generating for
                                  // inputs they're about to change (or already stepped away from).
                                  if (aiScheduleGenerationStore.getSnapshot().status === 'generating') {
                                    aiScheduleGenerationStore.clear()
                                  }
                                  setAiShiftWizardStep(s)
                                }}
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
                        <label style={{ ...modalLabelStyle, marginBottom: 8, display: 'block' }}>Shift</label>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 8 }}>
                          {aiShiftTypes.map((shift, index) => (
                            <div key={index} style={{ position: 'relative', border: '1px solid #E5E7EB', background: '#FFFFFF', borderRadius: 10, padding: '10px 12px' }}>
                              {aiShiftTypes.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() => { setAiShiftTypes(prev => prev.filter((_, i) => i !== index)); setAiShiftTypeTemplateIds(prev => prev.filter((_, i) => i !== index)) }}
                                  aria-label="Remove shift"
                                  style={{ position: 'absolute', top: 8, right: 8, width: 20, height: 20, border: 'none', borderRadius: 6, background: '#F9FAFB', color: '#9CA3AF', cursor: 'pointer', display: 'grid', placeItems: 'center' }}
                                  onMouseEnter={e => { e.currentTarget.style.background = '#FEF2F2'; e.currentTarget.style.color = '#DC2626' }}
                                  onMouseLeave={e => { e.currentTarget.style.background = '#F9FAFB'; e.currentTarget.style.color = '#9CA3AF' }}
                                >
                                  <X size={12} strokeWidth={2.5} />
                                </button>
                              )}
                              {shiftTemplates.length > 0 && (
                                <div style={{ marginBottom: 10 }}>
                                  <label style={modalLabelStyle}>Template</label>
                                  <DropdownField
                                    value={aiShiftTypeTemplateIds[index] ?? ''}
                                    options={shiftTemplates.map(t => ({ value: t.id, label: t.name }))}
                                    onChange={v => {
                                      const template = shiftTemplates.find(t => t.id === v)
                                      if (!template) return
                                      setAiShiftTypes(prev => prev.map((item, i) => i === index ? { ...item, label: template.name, start_time: template.start_time, end_time: template.end_time } : item))
                                      setAiShiftTypeTemplateIds(prev => prev.map((id, i) => i === index ? v : id))
                                    }}
                                    placeholder="Use a template…"
                                  />
                                </div>
                              )}
                              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                                <div><label style={modalLabelStyle}>Start Time</label><TimePicker value={shift.start_time} onChange={value => { setAiShiftTypes(prev => prev.map((item, i) => i === index ? { ...item, start_time: value } : item)); setAiShiftTypeTemplateIds(prev => prev.map((id, i) => i === index ? '' : id)) }} /></div>
                                <div><label style={modalLabelStyle}>End Time</label><TimePicker value={shift.end_time} onChange={value => { setAiShiftTypes(prev => prev.map((item, i) => i === index ? { ...item, end_time: value } : item)); setAiShiftTypeTemplateIds(prev => prev.map((id, i) => i === index ? '' : id)) }} /></div>
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
                      <button type="button" onClick={handleAiGenerateAndMinimize} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, padding: '11px 14px', background: 'linear-gradient(135deg, #7C3AED, #6D28D9)', border: 'none', borderRadius: 8, fontWeight: 600, fontSize: '0.8125rem', color: '#FFFFFF', cursor: 'pointer' }}>
                        <Sparkles size={13} strokeWidth={2.5} />
                        Generate Schedule with AI
                      </button>
                    )}

                    {aiShiftWizardStep === 'generate' && aiShiftLoading && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        <div style={{ width: '100%', height: 8, borderRadius: 999, background: '#EDE9FE', overflow: 'hidden' }}>
                          <div style={{ width: `${aiShiftProgress}%`, height: '100%', borderRadius: 999, background: 'linear-gradient(135deg, #7C3AED, #6D28D9)', transition: 'width 0.2s linear' }} />
                        </div>
                        <div key={aiShiftRuleStepIndex} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, textAlign: 'center', animation: 'tabContentIn 0.25s ease-out' }}>
                          <Spinner size={13} />
                          <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#6D28D9' }}>{AI_SCHEDULE_RULE_STEPS[aiShiftRuleStepIndex]}</span>
                        </div>
                      </div>
                    )}

                    {aiShiftWizardStep === 'generate' && (aiShiftError || aiShiftGenerationError) && <div style={{ padding: '10px 14px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, fontSize: '0.875rem', color: '#DC2626' }}>{aiShiftError || aiShiftGenerationError}</div>}

                    {aiShiftWizardStep === 'generate' && aiShiftSuggestions.length > 0 && (() => {
                      const allDates = Array.from(new Set(aiShiftSuggestions.map(b => b.shift_date))).sort()
                      const weekStartDates: string[] = []
                      for (let i = 0; i < allDates.length; i += 7) weekStartDates.push(allDates[i])
                      const clampedWeekOffset = Math.min(aiResultWeekOffset, Math.max(0, weekStartDates.length - 1))
                      const weekDates = allDates.slice(clampedWeekOffset * 7, clampedWeekOffset * 7 + 7)

                      const membersById = new Map(members.map(m => [m.id, m]))
                      const departmentOrder = new Map(orderedDepartments.map((dept, index) => [dept.id, index]))

                      type PersonRow = { key: string; name: string; deptId: string; deptName: string; photoUrl: string | null; role: string | null }
                      const rowMap = new Map<string, PersonRow>()
                      // Seed rows from every person seen since generation started, not just current slots —
                      // otherwise dragging someone's last shift away makes them disappear with no way to drag one back.
                      // Slots with no assigned_user_id (nobody eligible) never get a row here — they're
                      // surfaced as a staffing-gap summary below the grid instead, not as a fake person row.
                      for (const [rowKey, known] of aiShiftKnownRows) {
                        const member = membersById.get(rowKey)
                        rowMap.set(rowKey, {
                          key: rowKey,
                          name: known.name,
                          deptId: known.deptId,
                          deptName: known.deptName,
                          photoUrl: member?.profile_photo_url ?? null,
                          role: member?.role ?? null,
                        })
                      }
                      for (const block of aiShiftSuggestions) {
                        for (const slot of block.slots) {
                          if (!slot.assigned_user_id) continue
                          if (!rowMap.has(slot.assigned_user_id)) {
                            const member = membersById.get(slot.assigned_user_id)
                            rowMap.set(slot.assigned_user_id, {
                              key: slot.assigned_user_id,
                              name: slot.assigned_user_name ?? '',
                              deptId: block.department_id,
                              deptName: block.department_name,
                              photoUrl: member?.profile_photo_url ?? null,
                              role: member?.role ?? null,
                            })
                          }
                        }
                      }
                      const rows = Array.from(rowMap.values()).sort((a, b) => {
                        const deptOrderDiff = (departmentOrder.get(a.deptId) ?? 999) - (departmentOrder.get(b.deptId) ?? 999)
                        if (deptOrderDiff !== 0) return deptOrderDiff
                        const roleDiff = roleRank(a.role ?? '') - roleRank(b.role ?? '')
                        if (roleDiff !== 0) return roleDiff
                        return a.name.localeCompare(b.name)
                      })

                      const cellsFor = (rowKey: string, date: string) => {
                        const out: { block: AutoShiftBlock; slot: AiShiftSlot; slotIndex: number }[] = []
                        for (const block of aiShiftSuggestions) {
                          if (block.shift_date !== date) continue
                          block.slots.forEach((slot, slotIndex) => {
                            if (slot.assigned_user_id === rowKey) out.push({ block, slot, slotIndex })
                          })
                        }
                        return out
                      }

                      // Per department+date, which role has nobody covering it — drives the red "needs
                      // coverage" cell painted directly on that role's rows, instead of a separate banner.
                      const missingRoleByCell = new Map<string, { missingManager: boolean; missingEmployee: boolean }>()
                      for (const block of aiShiftSuggestions) {
                        missingRoleByCell.set(`${block.department_id}_${block.shift_date}`, {
                          missingManager: block.slots.some(s => s.role === 'Manager' && !s.assigned_user_id),
                          missingEmployee: block.slots.some(s => s.role === 'Employee' && !s.assigned_user_id),
                        })
                      }

                      return (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                              <label style={{ ...modalLabelStyle, marginBottom: 0 }}>Suggested Schedule</label>
                              <span style={{ fontSize: 11, fontWeight: 500, color: '#9CA3AF' }}>Drag a shift to reassign the person or date</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <button
                              type="button"
                              onClick={() => aiScheduleGenerationStore.setSelected(() => new Set(aiShiftSuggestions.flatMap(block => block.slots.map((_, slotIndex) => aiSlotSelectionKey(block.key, slotIndex)))))}
                              title="Select all"
                              aria-label="Select all"
                              style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 26, height: 26, borderRadius: 7, background: 'none', border: '1px solid #E5E7EB', color: '#7C3AED', cursor: 'pointer' }}
                            ><CheckCheck size={13} /></button>
                            <button
                              type="button"
                              onClick={() => aiScheduleGenerationStore.setSelected(() => new Set())}
                              title="Clear"
                              aria-label="Clear"
                              style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 26, height: 26, borderRadius: 7, background: 'none', border: '1px solid #E5E7EB', color: '#9CA3AF', cursor: 'pointer' }}
                            ><X size={13} /></button>
                            <button
                              type="button"
                              onClick={handleAiGenerateShifts}
                              disabled={aiShiftLoading}
                              title="Regenerate"
                              aria-label="Regenerate"
                              style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 26, height: 26, borderRadius: 7, background: 'none', border: '1px solid #E5E7EB', color: '#F97316', cursor: aiShiftLoading ? 'default' : 'pointer', opacity: aiShiftLoading ? 0.5 : 1 }}
                            ><RotateCw size={13} /></button>
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
                            <div style={{ minWidth: 900, borderRadius: 12, overflow: 'hidden', border: `1px solid ${PANEL_BORDER}` }}>
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
                              <div style={{ maxHeight: 420, overflowY: 'auto' }}>
                                {rows.map((row, rowIdx) => {
                                  const barColor = deptColor(row.deptId)
                                  return (
                                    <div key={row.key} style={{ display: 'grid', gridTemplateColumns: `${TL_NAME_COL}px repeat(${weekDates.length}, 1fr)`, borderTop: rowIdx === 0 ? 'none' : `1px solid ${PANEL_BORDER}`, background: '#FFFFFF', minHeight: 58 }}>
                                      <div style={{ display: 'flex', alignItems: 'center', borderRight: `1px solid ${PANEL_BORDER}`, overflow: 'hidden' }}>
                                        <div style={{ width: 8, alignSelf: 'stretch', flexShrink: 0, background: barColor, opacity: 0.85 }} />
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 10px 0 12px', minWidth: 0, flex: 1 }}>
                                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 26, height: 26, flexShrink: 0, background: row.photoUrl ? 'transparent' : row.role === 'Manager' ? '#FFF7ED' : '#F3F4F6', color: row.role === 'Manager' ? '#EA580C' : '#4B5563', borderRadius: 999, overflow: 'hidden' }}>
                                            {row.photoUrl
                                              ? <img src={row.photoUrl} alt={row.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                              : row.role === 'Manager' ? <UserCog size={13} /> : <UserRound size={13} />}
                                          </div>
                                          <div style={{ minWidth: 0 }}>
                                            <span style={{ ...MEMBER_NAME_STYLE, display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{row.name}</span>
                                            <span style={{ fontSize: 10.5, fontWeight: 600, color: '#9CA3AF', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'block' }}>{row.role ?? ''}</span>
                                          </div>
                                        </div>
                                      </div>
                                      {weekDates.map(date => {
                                        const cells = cellsFor(row.key, date)
                                        const cellDropKey = `${row.key}_${date}`
                                        const availability = aiStaffAvailability.get(row.key)
                                        const isFixedOff = availability?.fixedOffDates.has(date) ?? false
                                        const isOnLeave = availability?.approvedLeaveDates.has(date) ?? false
                                        const isUnavailable = isFixedOff || isOnLeave
                                        const missingForRole = missingRoleByCell.get(`${row.deptId}_${date}`)
                                        const needsCoverage = !isUnavailable && (row.role === 'Manager' ? missingForRole?.missingManager : missingForRole?.missingEmployee)
                                        const isDragOver = aiDragOverCell === cellDropKey && aiDraggingSlot
                                        const isBlockedDrop = isDragOver && isUnavailable
                                        return (
                                          <div
                                            key={date}
                                            onDragOver={e => {
                                              if (!aiDraggingSlot) return
                                              e.preventDefault()
                                              e.dataTransfer.dropEffect = isUnavailable ? 'none' : 'move'
                                              setAiDragOverCell(cellDropKey)
                                            }}
                                            onDragLeave={() => setAiDragOverCell(prev => prev === cellDropKey ? null : prev)}
                                            onDrop={e => {
                                              e.preventDefault()
                                              setAiDragOverCell(null)
                                              if (!aiDraggingSlot || isUnavailable) { setAiDraggingSlot(null); return }
                                              moveAiShiftSlot(aiDraggingSlot.blockKey, aiDraggingSlot.slotIndex, {
                                                department_id: row.deptId,
                                                shift_date: date,
                                                assigned_user_id: row.key,
                                                assigned_user_name: row.name,
                                              })
                                              setAiDraggingSlot(null)
                                            }}
                                            style={{ padding: '6px', borderRight: `1px solid ${PANEL_BORDER}`, display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'stretch', justifyContent: 'center', background: isBlockedDrop ? '#FEF2F2' : isDragOver ? '#F5F3FF' : 'transparent', outline: isBlockedDrop ? '1.5px dashed #DC2626' : isDragOver ? '1.5px dashed #7C3AED' : 'none' }}
                                          >
                                            {cells.length === 0 ? (
                                              isUnavailable ? (
                                                <div title={isOnLeave ? 'Approved Leave' : 'Off Day'} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, borderRadius: 999, background: isOnLeave ? '#FEE2E2' : '#F3F4F6', height: 24, padding: '0 6px' }}>
                                                  {isOnLeave ? <CalendarDays size={11} color="#DC2626" /> : <AlertTriangle size={11} color="#9CA3AF" />}
                                                  <span style={{ fontSize: 9.5, fontWeight: 700, color: isOnLeave ? '#DC2626' : '#6B7280', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                    {isOnLeave ? 'Approved Leave' : 'Off Day'}
                                                  </span>
                                                </div>
                                              ) : needsCoverage ? (
                                                <div title={`No ${row.role} scheduled`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 999, background: '#FCA5A5', border: '1px solid #DC2626', height: 24 }}>
                                                  <AlertTriangle size={11} color="#7F1D1D" />
                                                </div>
                                              ) : (
                                                <div style={{ borderRadius: 999, background: '#F3F4F6', height: 24 }} />
                                              )
                                            ) : cells.map(({ block, slot, slotIndex }, i) => {
                                              const selectionKey = aiSlotSelectionKey(block.key, slotIndex)
                                              const checked = aiShiftSelected.has(selectionKey)
                                              const isEditingThis = aiEditingSlot?.blockKey === block.key && aiEditingSlot?.slotIndex === slotIndex
                                              return (
                                                <div key={`${block.key}_${slot.shift_label}_${i}`} style={{ position: 'relative', width: '100%' }}>
                                                  <div
                                                    draggable
                                                    onDragStart={e => { e.dataTransfer.effectAllowed = 'move'; setAiDraggingSlot({ blockKey: block.key, slotIndex }) }}
                                                    onDragEnd={() => { setAiDraggingSlot(null); setAiDragOverCell(null) }}
                                                    style={{
                                                      display: 'flex', alignItems: 'center', gap: 2,
                                                      padding: '0 3px 0 6px', height: 26, flexShrink: 0,
                                                      background: checked ? deptColor(block.department_id) : '#FFFFFF',
                                                      border: `1.5px solid ${checked ? deptColor(block.department_id) : '#E5E7EB'}`,
                                                      borderRadius: 999, width: '100%', cursor: 'grab',
                                                    }}
                                                  >
                                                    <button
                                                      type="button"
                                                      onClick={() => aiScheduleGenerationStore.setSelected(prev => { const next = new Set(prev); if (next.has(selectionKey)) next.delete(selectionKey); else next.add(selectionKey); return next })}
                                                      title={`${slot.shift_label} ${formatShiftHour(slot.start_time)} – ${formatShiftHour(slot.end_time)}`}
                                                      style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, border: 'none', background: 'transparent', cursor: 'pointer', height: '100%', minWidth: 0, padding: 0 }}
                                                    >
                                                      <span style={{ fontSize: 10, fontWeight: 700, color: checked ? '#FFFFFF' : '#374151', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                        {formatShiftHour(slot.start_time)} – {formatShiftHour(slot.end_time)}
                                                      </span>
                                                    </button>
                                                    <button
                                                      type="button"
                                                      onClick={() => setAiEditingSlot(isEditingThis ? null : { blockKey: block.key, slotIndex })}
                                                      title="Edit this shift"
                                                      aria-label="Edit this shift"
                                                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 18, height: 18, flexShrink: 0, border: 'none', borderRadius: 999, background: isEditingThis ? 'rgba(0,0,0,0.18)' : 'transparent', color: checked ? '#FFFFFF' : '#9CA3AF', cursor: 'pointer', padding: 0 }}
                                                    >
                                                      <Pencil size={10} />
                                                    </button>
                                                  </div>
                                                  {isEditingThis && (
                                                    <div
                                                      onMouseDown={e => e.stopPropagation()}
                                                      style={{
                                                        position: 'absolute', top: '100%', left: 0, marginTop: 4, zIndex: 50,
                                                        width: 220, background: '#FFFFFF', border: `1px solid ${PANEL_BORDER}`,
                                                        borderRadius: 10, boxShadow: '0 8px 24px rgba(15,23,42,0.14)', padding: 10,
                                                        display: 'flex', flexDirection: 'column', gap: 8,
                                                      }}
                                                    >
                                                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                                                        <div>
                                                          <span style={{ display: 'block', fontSize: 10.5, fontWeight: 600, color: '#374151', marginBottom: 3 }}>Start</span>
                                                          <TimePicker compact value={slot.start_time} onChange={v => updateAiShiftSlot(block.key, slotIndex, { start_time: v })} />
                                                        </div>
                                                        <div>
                                                          <span style={{ display: 'block', fontSize: 10.5, fontWeight: 600, color: '#374151', marginBottom: 3 }}>End</span>
                                                          <TimePicker compact value={slot.end_time} onChange={v => updateAiShiftSlot(block.key, slotIndex, { end_time: v })} minTime={slot.start_time} />
                                                        </div>
                                                      </div>
                                                      <button
                                                        type="button"
                                                        onClick={() => setAiEditingSlot(null)}
                                                        style={{ alignSelf: 'flex-end', border: 'none', background: 'none', color: '#7C3AED', fontSize: 11, fontWeight: 700, cursor: 'pointer', padding: '2px 4px' }}
                                                      >
                                                        Done
                                                      </button>
                                                    </div>
                                                  )}
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
                        {aiShiftCreateLoading ? 'Creating...' : `Create ${aiShiftSelected.size} Shifts`}
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
                            const dateShifts = batchUserShiftsByDate.get(date) ?? []
                            const hasShift = dateShifts.length > 0
                            const dayNum = new Date(date + 'T00:00:00').getDate()
                            if (isPast) {
                              return (
                                <div key={date} style={{ width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, color: '#D1D5DB', userSelect: 'none' }}>
                                  {dayNum}
                                </div>
                              )
                            }
                            return (
                              <div key={date} style={{ position: 'relative', width: 32, height: 32 }}>
                                <button
                                  type="button"
                                  onClick={() => toggleBatchDate(date)}
                                  onMouseEnter={() => { if (hasShift) setHoveredBatchCalDate(date) }}
                                  onMouseLeave={() => setHoveredBatchCalDate(prev => prev === date ? null : prev)}
                                  style={{
                                    width: 32, height: 32,
                                    borderRadius: '50%',
                                    border: isToday && !sel ? `2px solid ${OWNER_ORANGE}` : 'none',
                                    background: sel ? OWNER_ORANGE : 'transparent',
                                    color: sel ? '#FFFFFF' : isToday ? OWNER_ORANGE : TEXT_DARK,
                                    fontWeight: sel || isToday ? 700 : 400,
                                    fontSize: 13,
                                    cursor: 'pointer',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: 1,
                                    padding: 0, flexShrink: 0,
                                    transition: 'background 0.12s, color 0.12s',
                                  }}
                                >
                                  <span style={{ lineHeight: 1 }}>{dayNum}</span>
                                  {hasShift && <span style={{ width: 3, height: 3, borderRadius: '50%', background: sel ? 'rgba(255,255,255,0.85)' : OWNER_ORANGE, flexShrink: 0 }} />}
                                </button>
                                {hoveredBatchCalDate === date && hasShift && (
                                  <div style={{
                                    position: 'absolute', bottom: '100%', left: '50%', transform: 'translateX(-50%)',
                                    marginBottom: 6, padding: '6px 10px', borderRadius: 8,
                                    background: '#0F172A', color: '#FFFFFF', fontSize: 11, fontWeight: 600,
                                    whiteSpace: 'nowrap', zIndex: 20, pointerEvents: 'none',
                                    boxShadow: '0 4px 14px rgba(15,23,42,0.25)',
                                  }}>
                                    {dateShifts.map((s, idx) => (
                                      <div key={idx}>{selectedMemberIds.length > 1 ? `${s.full_name}: ` : ''}{formatShiftHour(s.start_time)} – {formatShiftHour(s.end_time)}</div>
                                    ))}
                                    <div style={{
                                      position: 'absolute', top: '100%', left: '50%', transform: 'translateX(-50%)',
                                      width: 0, height: 0, borderLeft: '5px solid transparent', borderRight: '5px solid transparent',
                                      borderTop: '5px solid #0F172A',
                                    }} />
                                  </div>
                                )}
                              </div>
                            )
                          })}
                        </div>
                        <button type="button" onClick={() => { setTemplateSaveOpen(true); setTemplateSaveName(''); setTemplateSaveError('') }}
                          style={{ marginTop: 10, width: '100%', border: `1px solid ${PANEL_BORDER}`, borderRadius: 8, background: '#FFFFFF', color: OWNER_ORANGE, height: 34, padding: '0 12px', fontWeight: 600, fontSize: 12, cursor: 'pointer' }}
                        >
                          + Create shift template
                        </button>
                      </div>

                      {/* Shift Hours */}
                      <div style={{ background: '#FFFFFF', borderRadius: 14, padding: '12px 14px', border: `1px solid ${PANEL_BORDER}`, display: 'flex', flexDirection: 'column', gap: 12 }}>
                        {(() => {
                          const deptTemplates = shiftTemplates
                          return (
                            <div>
                              <span style={{ display: 'block', fontWeight: 600, fontSize: '0.875rem', color: '#374151', marginBottom: 4 }}>Template</span>
                              <DropdownField
                                value={selectedTemplateId}
                                options={deptTemplates.map(t => ({ value: t.id, label: t.name }))}
                                onChange={v => {
                                  const template = deptTemplates.find(t => t.id === v)
                                  if (!template) return
                                  setSelectedTemplateId(v)
                                  setDefaultStartTime(template.start_time)
                                  setDefaultEndTime(template.end_time)
                                  applyDefaultToAllCells(template.start_time, template.end_time, template.name, template.id)
                                }}
                                placeholder={deptTemplates.length ? 'Select a template' : 'No templates yet'}
                                disabled={deptTemplates.length === 0}
                              />
                            </div>
                          )
                        })()}
                        <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          <span style={{ ...modalLabelStyle, marginBottom: 4 }}>Start Time</span>
                          <TimePicker value={defaultStartTime} onChange={v => { setSelectedTemplateId(''); setDefaultStartTime(v); setDefaultEndTime(prev => bumpEndTime(v, prev)) }} />
                        </label>
                        <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          <span style={{ ...modalLabelStyle, marginBottom: 4 }}>End Time</span>
                          <TimePicker value={defaultEndTime} onChange={v => { setSelectedTemplateId(''); setDefaultEndTime(v) }} minTime={defaultStartTime} />
                        </label>
                        <button type="button" onClick={() => {
                          const activeTemplate = shiftTemplates.find(t => t.id === selectedTemplateId)
                          applyDefaultToAllCells(undefined, undefined, activeTemplate?.name, activeTemplate?.id)
                        }}
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

              {isSingleCellRepeatEligible && (
                <div style={{ marginBottom: 20, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, alignItems: 'stretch' }}>
                <div style={{ background: '#FFFFFF', borderRadius: 14, padding: '12px', border: `1px solid ${PANEL_BORDER}`, display: 'flex', flexDirection: 'column' }}>
                  <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}>
                    <span style={{ ...modalLabelStyle, display: 'flex', alignItems: 'center', gap: 6, marginBottom: 0 }}>
                      <Repeat size={13} color={OWNER_ORANGE} /> Recurring
                    </span>
                    <input
                      type="checkbox"
                      checked={batchRepeatEnabled}
                      onChange={e => setBatchRepeatEnabled(e.target.checked)}
                      style={{ width: 16, height: 16, accentColor: OWNER_ORANGE, cursor: 'pointer' }}
                    />
                  </label>

                  {batchRepeatEnabled && (
                    <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
                      <div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
                          {(['daily', 'weekly', 'custom'] as const).map(rule => {
                            const active = recurringShiftForm.recurrence_rule === rule
                            return (
                              <button
                                key={rule}
                                type="button"
                                onClick={() => setRecurringShiftForm(prev => ({ ...prev, recurrence_rule: rule }))}
                                style={{ height: 30, border: active ? `1.5px solid ${OWNER_ORANGE}` : `1px solid ${PANEL_BORDER}`, background: active ? '#FFF7ED' : '#FFFFFF', color: active ? OWNER_ORANGE : TEXT_DARK, borderRadius: 7, fontSize: 11.5, fontWeight: 600, cursor: 'pointer', textTransform: 'capitalize' }}
                              >
                                {rule}
                              </button>
                            )
                          })}
                        </div>
                      </div>

                      {recurringShiftForm.recurrence_rule === 'custom' && (
                        <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          <span style={{ display: 'block', fontWeight: 600, fontSize: '0.75rem', color: '#374151' }}>Repeat Every (Days)</span>
                          <input
                            type="text"
                            inputMode="numeric"
                            value={recurringShiftForm.custom_interval_days || ''}
                            onChange={e => {
                              const digits = e.target.value.replace(/\D/g, '')
                              setRecurringShiftForm(prev => ({ ...prev, custom_interval_days: digits === '' ? 0 : Number(digits) }))
                            }}
                            onBlur={() => setRecurringShiftForm(prev => ({ ...prev, custom_interval_days: Math.min(31, Math.max(1, prev.custom_interval_days || 1)) }))}
                            style={{ width: '100%', padding: '8px 10px', border: `1px solid ${PANEL_BORDER}`, borderRadius: 8, fontSize: 12, color: TEXT_DARK, boxSizing: 'border-box', fontFamily: 'inherit' }}
                          />
                        </label>
                      )}

                      <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <span style={{ display: 'block', fontWeight: 600, fontSize: '0.75rem', color: '#374151' }}>Repeat Until</span>
                        <DatePickerField
                          value={recurringShiftForm.recurrence_end_date}
                          onChange={v => setRecurringShiftForm(prev => ({ ...prev, recurrence_end_date: v }))}
                          min={selectedDates[0]}
                          max={repeatUntilMaxDate}
                          clearable={false}
                          disableYearJump
                          compact
                        />
                      </label>

                      {recurringShiftError && <div ref={recurringShiftErrorRef} style={errorBoxStyle}>{recurringShiftError}</div>}
                    </div>
                  )}
                </div>

                <div style={{ background: '#FFFFFF', borderRadius: 14, padding: '12px', border: `1px solid ${PANEL_BORDER}`, display: 'flex', flexDirection: 'column' }}>
                  <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}>
                    <span style={{ ...modalLabelStyle, display: 'flex', alignItems: 'center', gap: 6, marginBottom: 0 }}>
                      <SplitSquareHorizontal size={13} color={OWNER_ORANGE} /> Splitting
                    </span>
                    <input
                      type="checkbox"
                      checked={batchSplitEnabled}
                      onChange={e => {
                        const checked = e.target.checked
                        setBatchSplitEnabled(checked)
                        if (checked) {
                          const [sh, sm] = defaultStartTime.split(':').map(Number)
                          const [eh, em] = defaultEndTime.split(':').map(Number)
                          const startTotal = sh * 60 + sm
                          const endTotal = eh * 60 + em
                          const midSlot = Math.round((startTotal + endTotal) / 2 / 30)
                          const startSlot = Math.ceil(startTotal / 30)
                          const endSlot = Math.floor(endTotal / 30)
                          const block1EndSlot = Math.max(startSlot + 1, midSlot)
                          const block2StartSlot = Math.min(endSlot - 1, block1EndSlot + 1)
                          const toTime = (slot: number) => `${String(Math.floor(slot * 30 / 60)).padStart(2, '0')}:${String((slot * 30) % 60).padStart(2, '0')}`
                          setBatchSplitBlock1End(toTime(block1EndSlot))
                          setBatchSplitBlock2Start(toTime(Math.max(block2StartSlot, block1EndSlot + 1)))
                        }
                      }}
                      style={{ width: 16, height: 16, accentColor: OWNER_ORANGE, cursor: 'pointer' }}
                    />
                  </label>

                  {batchSplitEnabled && (
                    <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                      <div>
                        <span style={{ display: 'block', textAlign: 'center', fontWeight: 600, fontSize: '0.75rem', color: '#374151', marginBottom: 6 }}>Shift 1</span>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                            <span style={{ display: 'block', fontWeight: 600, fontSize: '0.75rem', color: '#374151', marginBottom: 4 }}>Start</span>
                            <TimePicker compact value={defaultStartTime} disabled onChange={() => {}} />
                          </label>
                          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                            <span style={{ display: 'block', fontWeight: 600, fontSize: '0.75rem', color: '#374151', marginBottom: 4 }}>End</span>
                            <TimePicker compact value={batchSplitBlock1End} onChange={v => setBatchSplitBlock1End(v)} minTime={defaultStartTime} />
                          </label>
                        </div>
                      </div>
                      <div>
                        <span style={{ display: 'block', textAlign: 'center', fontWeight: 600, fontSize: '0.75rem', color: '#374151', marginBottom: 6 }}>Shift 2</span>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                            <span style={{ display: 'block', fontWeight: 600, fontSize: '0.75rem', color: '#374151', marginBottom: 4 }}>Start</span>
                            <TimePicker compact value={batchSplitBlock2Start} onChange={v => setBatchSplitBlock2Start(v)} minTime={batchSplitBlock1End} />
                          </label>
                          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                            <span style={{ display: 'block', fontWeight: 600, fontSize: '0.75rem', color: '#374151', marginBottom: 4 }}>End</span>
                            <TimePicker compact value={defaultEndTime} disabled onChange={() => {}} />
                          </label>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                </div>
              )}

              {/* Preview Grid */}
              <div style={{ marginBottom: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                  <p style={{ margin: 0, fontWeight: 600, fontSize: '0.875rem', color: '#374151', display: 'block' }}>Preview</p>
                  <span
                    title={`${enabledBatchCells.length + previewRepeatDates.length} shift${(enabledBatchCells.length + previewRepeatDates.length) !== 1 ? 's' : ''} selected`}
                    style={{
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      minWidth: 20, height: 20, padding: '0 5px', borderRadius: 999,
                      background: (enabledBatchCells.length + previewRepeatDates.length) > 0 ? OWNER_ORANGE : '#E5E7EB',
                      color: (enabledBatchCells.length + previewRepeatDates.length) > 0 ? '#FFFFFF' : '#9CA3AF',
                      fontSize: 11, fontWeight: 700, flexShrink: 0,
                    }}
                  >
                    {enabledBatchCells.length + previewRepeatDates.length}
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
                              const prevDayKey = `${member.id}_${formatDateKey(addDays(new Date(`${date}T00:00:00`), -1))}`
                              const nextDayKey = `${member.id}_${formatDateKey(addDays(new Date(`${date}T00:00:00`), 1))}`
                              const nearbyShifts = [
                                ...existing,
                                ...(futureShiftMap.get(prevDayKey) ?? []),
                                ...(futureShiftMap.get(nextDayKey) ?? []),
                              ]
                              const clopeningConflict = findClopeningConflict({
                                shift_date: date,
                                start_time: cell.start_time,
                                end_time: cell.end_time,
                                existingShifts: nearbyShifts,
                              })
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
                                  <p style={{ margin: '0 0 7px', fontSize: 13, fontWeight: 600, color: TEXT_DARK, paddingRight: 14 }}>{previewDateLabel(date)}</p>
                                  {batchSplitEnabled && isSingleCellRepeatEligible ? (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 8px', border: `1px solid ${PANEL_BORDER}`, borderRadius: 8, background: '#FFFFFF', fontSize: 13, fontWeight: 600, color: TEXT_DARK }}>
                                        {formatShiftHour(cell.start_time)} – {formatShiftHour(batchSplitBlock1End)}
                                      </div>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 8px', border: `1px solid ${PANEL_BORDER}`, borderRadius: 8, background: '#FFFFFF', fontSize: 13, fontWeight: 600, color: TEXT_DARK }}>
                                        {formatShiftHour(batchSplitBlock2Start)} – {formatShiftHour(cell.end_time)}
                                      </div>
                                    </div>
                                  ) : (() => {
                                    const deptTemplates = shiftTemplates
                                    const isCustom = expandedBatchCells.has(key) || !cell.template_name
                                    if (!isCustom) {
                                      return (
                                        <DropdownField
                                          compact
                                          value={cell.template_id ?? ''}
                                          options={[...deptTemplates.map(t => ({ value: t.id, label: t.name })), { value: '__custom__', label: 'Custom' }]}
                                          onChange={v => {
                                            if (v === '__custom__') {
                                              setExpandedBatchCells(prev => new Set(prev).add(key))
                                              return
                                            }
                                            const template = deptTemplates.find(t => t.id === v)
                                            if (!template) return
                                            updateBatchCell(member.id, date, { start_time: template.start_time, end_time: template.end_time, template_name: template.name, template_id: template.id })
                                          }}
                                        />
                                      )
                                    }
                                    return (
                                      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                                        {deptTemplates.length > 0 && (
                                          <DropdownField
                                            compact
                                            value=""
                                            options={deptTemplates.map(t => ({ value: t.id, label: t.name }))}
                                            onChange={v => {
                                              const template = deptTemplates.find(t => t.id === v)
                                              if (!template) return
                                              setExpandedBatchCells(prev => { const next = new Set(prev); next.delete(key); return next })
                                              updateBatchCell(member.id, date, { start_time: template.start_time, end_time: template.end_time, template_name: template.name, template_id: template.id })
                                            }}
                                            placeholder="Use a template…"
                                          />
                                        )}
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 5 }}>
                                          <TimePicker compact value={cell.start_time} onChange={v => updateBatchCell(member.id, date, { start_time: v })} />
                                          <TimePicker compact value={cell.end_time} onChange={v => updateBatchCell(member.id, date, { end_time: v })} minTime={cell.start_time} />
                                        </div>
                                      </div>
                                    )
                                  })()}
                                  {existing.length > 0 && (
                                    <div style={{ display: 'flex', gap: 4, marginTop: 5, color: '#B45309', fontSize: '0.68rem', fontWeight: 600, alignItems: 'center', flexWrap: 'wrap' }}>
                                      <AlertTriangle size={11} style={{ flexShrink: 0 }} />
                                      <span>Has {existing.length} shift{existing.length !== 1 ? 's' : ''} ({[...new Set(existing.map(s => s.department_name))].join(', ')})</span>
                                    </div>
                                  )}
                                  {clopeningConflict && (
                                    <div style={{ display: 'flex', gap: 4, marginTop: 5, color: '#DC2626', fontSize: '0.68rem', fontWeight: 600, alignItems: 'center', flexWrap: 'wrap' }}>
                                      <AlertTriangle size={11} style={{ flexShrink: 0 }} />
                                      <span>Clopening: this person has another shift {clopeningConflict.direction === 'after' ? `starting in ${clopeningConflict.rest_hours}h` : `that ended ${clopeningConflict.rest_hours}h ago`}</span>
                                    </div>
                                  )}
                                </div>
                              )
                            })}
                            {previewRepeatDates.map(date => {
                              const key = `repeat-preview_${date}`
                              const cell = enabledBatchCells[0]
                              return (
                                <div key={key} style={{ border: `1px solid ${PANEL_BORDER}`, borderRadius: 10, padding: '9px 10px', background: '#FFFFFF' }}>
                                  <p style={{ margin: '0 0 7px', fontSize: 13, fontWeight: 600, color: TEXT_DARK }}>{previewDateLabel(date)}</p>
                                  {batchSplitEnabled ? (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 8px', border: `1px solid ${PANEL_BORDER}`, borderRadius: 8, background: '#FFFFFF', fontSize: 13, fontWeight: 600, color: TEXT_DARK }}>
                                        {formatShiftHour(cell?.start_time ?? defaultStartTime)} – {formatShiftHour(batchSplitBlock1End)}
                                      </div>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 8px', border: `1px solid ${PANEL_BORDER}`, borderRadius: 8, background: '#FFFFFF', fontSize: 13, fontWeight: 600, color: TEXT_DARK }}>
                                        {formatShiftHour(batchSplitBlock2Start)} – {formatShiftHour(cell?.end_time ?? defaultEndTime)}
                                      </div>
                                    </div>
                                  ) : (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 8px', border: `1px solid ${PANEL_BORDER}`, borderRadius: 8, background: '#FFFFFF', fontSize: 13, fontWeight: 600, color: TEXT_DARK }}>
                                      {formatShiftHour(cell?.start_time ?? defaultStartTime)} – {formatShiftHour(cell?.end_time ?? defaultEndTime)}
                                    </div>
                                  )}
                                  <p style={{ margin: '6px 0 0', fontSize: 10.5, color: '#B45309', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 3 }}>
                                    <Repeat size={10} /> Auto-generated
                                  </p>
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

              {(bulkError || bulkFailures.length > 0 || bulkWarning) && (
                <div style={{ marginBottom: 16 }}>
                  {bulkError && <div style={errorBoxStyle}>{bulkError}</div>}
                  {bulkWarning && (
                    <div style={warningBoxStyle}>
                      <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
                      <span>Shift assigned, but: {bulkWarning}</span>
                    </div>
                  )}
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
              {bulkWarning ? (
                <button type="button" onClick={closeBatchDrawer} style={{ padding: '7px 18px', background: 'linear-gradient(135deg, #F97316, #EA580C)', border: 'none', borderRadius: 8, fontWeight: 600, fontSize: '0.8125rem', color: '#FFFFFF', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Check size={13} /> Got it
                </button>
              ) : (
                <button type="button" onClick={submitBulkAssignment} disabled={bulkSubmitting} style={{ padding: '7px 18px', background: bulkSubmitting ? '#FDA060' : 'linear-gradient(135deg, #F97316, #EA580C)', border: 'none', borderRadius: 8, fontWeight: 600, fontSize: '0.8125rem', color: '#FFFFFF', cursor: bulkSubmitting ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 6, opacity: bulkSubmitting ? 0.65 : 1 }}>
                  {bulkSubmitting ? <Spinner size={13} /> : <Check size={13} />} Create {(enabledBatchCells.length + previewRepeatDates.length) || ''} Draft{(enabledBatchCells.length + previewRepeatDates.length) === 1 ? '' : 's'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {templateSaveOpen && batchDepartment && (
        <div style={{ ...modalOverlayStyle, zIndex: 1100 }}>
          <div style={{ ...modalStyle, width: 'min(380px, calc(100% - 32px))', padding: 0, display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '20px 24px 18px', borderBottom: '1px solid #F3F4F6', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 32, height: 32, borderRadius: 9, background: 'linear-gradient(135deg, #F97316, #EA580C)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Sparkles size={14} color="#fff" strokeWidth={2} />
                </div>
                <h2 style={{ fontWeight: 700, fontSize: '1rem', color: '#111827', margin: 0, fontFamily: "'Inter', system-ui, -apple-system, sans-serif" }}>Create Shift Template</h2>
              </div>
              <button
                type="button"
                onClick={() => { setTemplateSaveOpen(false); cancelEditTemplate() }}
                disabled={templateSaveLoading}
                style={{ background: '#F9FAFB', border: '1px solid #E5E7EB', cursor: 'pointer', color: '#6B7280', display: 'flex', padding: '6px', borderRadius: 8, flexShrink: 0 }}
              >
                <X size={16} />
              </button>
            </div>
            <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 12 }}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ display: 'block', fontWeight: 600, fontSize: '0.875rem', color: '#374151', marginBottom: 4 }}>Name</span>
                <input
                  type="text"
                  value={templateSaveName}
                  onChange={e => setTemplateSaveName(e.target.value)}
                  placeholder="e.g. Morning Shift"
                  style={{ width: '100%', padding: '9px 12px', border: `1px solid ${PANEL_BORDER}`, borderRadius: 8, fontSize: 13, color: TEXT_DARK, boxSizing: 'border-box', fontFamily: 'inherit' }}
                />
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span style={{ display: 'block', fontWeight: 600, fontSize: '0.8125rem', color: '#374151', marginBottom: 4 }}>Start time</span>
                  <TimePicker value={defaultStartTime} onChange={v => { setDefaultStartTime(v); setDefaultEndTime(prev => bumpEndTime(v, prev)) }} />
                </label>
                <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span style={{ display: 'block', fontWeight: 600, fontSize: '0.8125rem', color: '#374151', marginBottom: 4 }}>End time</span>
                  <TimePicker value={defaultEndTime} onChange={setDefaultEndTime} minTime={defaultStartTime} />
                </label>
              </div>
              {shiftTemplates.length > 0 && (
                <div>
                  <span style={{ display: 'block', fontWeight: 600, fontSize: '0.8125rem', color: '#374151', marginBottom: 6 }}>Existing templates</span>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {shiftTemplates.map(t => {
                      const isEditingThis = templateEditId === t.id
                      if (isEditingThis) {
                        return (
                          <div key={t.id} style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '10px', border: `1.5px solid #F97316`, borderRadius: 8, background: '#FFF7ED' }}>
                            <input
                              type="text"
                              value={templateEditName}
                              onChange={e => setTemplateEditName(e.target.value)}
                              placeholder="e.g. Morning Shift"
                              style={{ width: '100%', padding: '7px 10px', border: `1px solid ${PANEL_BORDER}`, borderRadius: 7, fontSize: 12.5, color: TEXT_DARK, boxSizing: 'border-box', fontFamily: 'inherit' }}
                            />
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                              <TimePicker compact value={templateEditStartTime} onChange={v => { setTemplateEditStartTime(v); setTemplateEditEndTime(prev => bumpEndTime(v, prev)) }} />
                              <TimePicker compact value={templateEditEndTime} onChange={setTemplateEditEndTime} minTime={templateEditStartTime} />
                            </div>
                            {templateEditError && <div style={{ ...errorBoxStyle, fontSize: 11.5, padding: '6px 8px' }}>{templateEditError}</div>}
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
                              <button type="button" onClick={cancelEditTemplate} disabled={templateEditLoading} style={{ ...secondaryButtonStyle, height: 28, padding: '0 12px', fontSize: 12 }}>Cancel</button>
                              <button
                                type="button"
                                onClick={submitEditTemplate}
                                disabled={templateEditLoading}
                                style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 5, border: 0, borderRadius: 7, background: templateEditLoading ? '#FDA060' : '#F97316', color: '#FFFFFF', height: 28, padding: '0 12px', fontSize: 12, fontWeight: 700, cursor: templateEditLoading ? 'not-allowed' : 'pointer', opacity: templateEditLoading ? 0.65 : 1 }}
                              >
                                {templateEditLoading ? <Spinner size={11} /> : <Check size={12} />} Save
                              </button>
                            </div>
                          </div>
                        )
                      }
                      return (
                        <div key={t.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '7px 10px', border: `1px solid ${PANEL_BORDER}`, borderRadius: 8 }}>
                          <span style={{ fontSize: 12.5, color: TEXT_DARK }}>{t.name} · {formatShiftHour(t.start_time)} – {formatShiftHour(t.end_time)}</span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                            <button
                              type="button"
                              onClick={() => startEditTemplate(t)}
                              title="Edit template"
                              aria-label="Edit template"
                              style={{ border: 'none', background: 'transparent', color: '#6B7280', cursor: 'pointer', display: 'flex', padding: 4 }}
                            >
                              <Pencil size={13} />
                            </button>
                            <button
                              type="button"
                              onClick={() => deleteTemplate(t.id)}
                              disabled={templateDeleteLoadingId === t.id}
                              title="Delete template"
                              aria-label="Delete template"
                              style={{ border: 'none', background: 'transparent', color: '#DC2626', cursor: 'pointer', display: 'flex', padding: 4 }}
                            >
                              {templateDeleteLoadingId === t.id ? <Spinner size={12} /> : <Trash2 size={13} />}
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
              {templateSaveError && <div style={errorBoxStyle}>{templateSaveError}</div>}
            </div>
            <div style={{ padding: '18px 24px 24px', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 10, borderTop: '1px solid #F3F4F6' }}>
              <button type="button" onClick={() => { setTemplateSaveOpen(false); cancelEditTemplate() }} disabled={templateSaveLoading} style={{ ...secondaryButtonStyle, height: 36 }}>Cancel</button>
              <button type="button" onClick={submitSaveTemplate} disabled={templateSaveLoading} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7, border: 0, borderRadius: 10, background: templateSaveLoading ? '#FDA060' : '#F97316', color: '#FFFFFF', height: 36, padding: '0 18px', fontSize: 13, fontWeight: 700, cursor: templateSaveLoading ? 'not-allowed' : 'pointer', opacity: templateSaveLoading ? 0.65 : 1 }}>
                {templateSaveLoading ? <Spinner size={13} /> : <Check size={14} />} Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════ SHIFT TEMPLATES MODAL (mirrors Task Templates) ═══════════════ */}
      {shiftTemplateModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, animation: 'overlayFadeIn 0.18s ease-out' }}>
          <div onClick={e => e.stopPropagation()} style={{ width: 440, maxHeight: '88vh', overflowY: 'auto', background: '#FFFFFF', borderRadius: 20, overflow: 'hidden', boxShadow: '0 24px 64px rgba(0,0,0,0.16), 0 4px 16px rgba(0,0,0,0.08)', animation: 'modalSlideIn 0.22s cubic-bezier(0.16,1,0.3,1)' }}>

            {/* Header */}
            <div style={{ padding: '18px 20px 16px', borderBottom: '1px solid #F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 32, height: 32, borderRadius: 9, background: 'linear-gradient(135deg, #F97316, #EA580C)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <LayoutTemplate size={15} color="#fff" strokeWidth={2.5} />
                </div>
                <h2 style={{ fontWeight: 700, fontSize: '1rem', color: '#111827', margin: 0, fontFamily: "'Inter', system-ui, -apple-system, sans-serif" }}>
                  {shiftTemplateFormMode === 'edit' ? 'Edit Template' : 'New Template'}
                </h2>
              </div>
              <button onClick={() => setShiftTemplateModalOpen(false)} style={{ background: '#F9FAFB', border: '1px solid #E5E7EB', cursor: 'pointer', color: '#6B7280', display: 'flex', padding: '6px', borderRadius: 8 }}
                onMouseEnter={e => { e.currentTarget.style.background = '#F3F4F6' }}
                onMouseLeave={e => { e.currentTarget.style.background = '#F9FAFB' }}
              >
                <X size={16} />
              </button>
            </div>

            {/* Body */}
            <div style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={modalLabelStyle}>Name</label>
                <input
                  autoFocus
                  value={shiftTemplateFormName}
                  onChange={e => {
                    const value = e.target.value
                    setShiftTemplateFormName(value)
                    if (!shiftTemplateTimeTouched) {
                      const preset = matchShiftNameTimePreset(value)
                      if (preset) {
                        setShiftTemplateFormStartTime(preset.start_time)
                        setShiftTemplateFormEndTime(preset.end_time)
                      }
                    }
                  }}
                  placeholder="e.g. Morning Shift"
                  style={modalInputStyle}
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={modalLabelStyle}>Start Time</label>
                  <TimePicker value={shiftTemplateFormStartTime} onChange={v => { setShiftTemplateFormStartTime(v); setShiftTemplateFormEndTime(prev => bumpEndTime(v, prev)); setShiftTemplateTimeTouched(true) }} />
                </div>
                <div>
                  <label style={modalLabelStyle}>End Time</label>
                  <TimePicker value={shiftTemplateFormEndTime} onChange={v => { setShiftTemplateFormEndTime(v); setShiftTemplateTimeTouched(true) }} minTime={shiftTemplateFormStartTime} />
                </div>
              </div>
            </div>

            {shiftTemplateFormError && <div style={{ margin: '0 20px 12px', ...errorBoxStyle }}>{shiftTemplateFormError}</div>}

            {/* Footer */}
            <div style={{ padding: '0 20px 18px', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button
                type="button"
                onClick={handleSaveShiftTemplateEntry}
                disabled={shiftTemplateFormLoading || !shiftTemplateFormName.trim()}
                style={{ padding: '7px 18px', background: !shiftTemplateFormName.trim() ? '#E5E7EB' : shiftTemplateFormLoading ? '#FDA060' : 'linear-gradient(135deg, #F97316, #EA580C)', border: 'none', borderRadius: 8, fontWeight: 600, fontSize: '0.8125rem', color: !shiftTemplateFormName.trim() ? '#9CA3AF' : '#FFFFFF', cursor: shiftTemplateFormLoading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 6, opacity: shiftTemplateFormLoading ? 0.65 : 1 }}
              >
                {shiftTemplateFormLoading ? <Spinner size={13} /> : <Check size={13} />} {shiftTemplateFormMode === 'edit' ? 'Save Changes' : 'Create Template'}
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
            <div style={{ ...modalStyle, width: 'min(520px, calc(100% - 32px))', padding: 0, display: 'flex', flexDirection: 'column' }}>
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

              <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 16 }}>
                {selectedShift.recurrence_group_id && (
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, alignSelf: 'flex-start', background: '#FFF7ED', border: `1px solid #FDE3C8`, borderRadius: 999, padding: '5px 12px 5px 9px' }}>
                    <Repeat size={12} color={OWNER_ORANGE} strokeWidth={2.5} style={{ flexShrink: 0 }} />
                    <span style={{ fontSize: 12, fontWeight: 600, color: '#B45309', whiteSpace: 'nowrap' }}>
                      {selectedShift.source_shift_id === null
                        ? `Original · ${selectedShift.recurrence_rule} series`
                        : `Part of ${selectedShift.recurrence_rule} series`
                      }
                    </span>
                  </div>
                )}
                <div>
                  <span style={modalLabelStyle}>Reassign To</span>
                  <DropdownField
                    value={shiftEditForm.assigned_user_id}
                    options={members
                      .filter(member => member.department_id === shiftEditForm.department_id)
                      .map(member => ({ value: member.id, label: member.full_name }))}
                    onChange={v => setShiftEditForm(prev => ({ ...prev, assigned_user_id: v }))}
                    placeholder="Select person"
                  />
                </div>

                <style>{`
                  @keyframes editCalSlideNext { from { opacity: 0; transform: translateX(18px) } to { opacity: 1; transform: translateX(0) } }
                  @keyframes editCalSlidePrev { from { opacity: 0; transform: translateX(-18px) } to { opacity: 1; transform: translateX(0) } }
                `}</style>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 190px', gap: 14, alignItems: 'stretch' }}>
                  <div style={{ background: '#FFFFFF', borderRadius: 14, padding: '12px 14px', border: `1px solid ${PANEL_BORDER}` }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                      <button type="button" onClick={goPrev} disabled={!canGoPrev}
                        style={{ width: 26, height: 26, border: `1px solid ${canGoPrev ? PANEL_BORDER : 'transparent'}`, background: canGoPrev ? '#FFFFFF' : 'transparent', borderRadius: 7, cursor: canGoPrev ? 'pointer' : 'default', display: 'flex', alignItems: 'center', justifyContent: 'center', color: canGoPrev ? MUTED : '#D1D5DB', flexShrink: 0, opacity: canGoPrev ? 1 : 0.3 }}>
                        <ChevronLeft size={12} />
                      </button>
                      <span style={{ fontSize: 13, fontWeight: 600, color: TEXT_DARK }}>{monthLabel}</span>
                      <button type="button" onClick={goNext}
                        style={{ width: 26, height: 26, border: `1px solid ${PANEL_BORDER}`, background: '#FFFFFF', borderRadius: 7, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: MUTED, flexShrink: 0 }}>
                        <ChevronRight size={12} />
                      </button>
                    </div>
                    <div key={`edit-hd-${editShiftCalKey}`} style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 32px)', justifyContent: 'center', marginBottom: 2 }}>
                      {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => (
                        <div key={d} style={{ fontSize: 11, fontWeight: 600, color: '#9CA3AF', textAlign: 'center', height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{d}</div>
                      ))}
                    </div>
                    <div key={`edit-grid-${editShiftCalKey}`} style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 32px)', justifyContent: 'center', gap: 2, animation: `${editShiftCalDir === 'next' ? 'editCalSlideNext' : 'editCalSlidePrev'} 0.18s ease` }}>
                      {cells.map((date, i) => {
                        if (!date) return <div key={`e-${i}`} style={{ width: 32, height: 32 }} />
                        const isPast = date < todayStr
                        const isSel = date === shiftEditForm.shift_date
                        const isToday = date === todayStr
                        const dateShifts = editUserShiftsByDate.get(date) ?? []
                        const hasShift = dateShifts.length > 0
                        const dayNum = new Date(`${date}T00:00:00`).getDate()
                        if (isPast) {
                          return (
                            <div key={date} style={{ width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, color: '#D1D5DB', userSelect: 'none' }}>
                              {dayNum}
                            </div>
                          )
                        }
                        return (
                          <div key={date} style={{ position: 'relative', width: 32, height: 32 }}>
                            <button
                              type="button"
                              onClick={() => setShiftEditForm(prev => ({ ...prev, shift_date: date }))}
                              onMouseEnter={e => { if (!isSel) e.currentTarget.style.background = '#F8FAFC'; if (hasShift) setHoveredEditCalDate(date) }}
                              onMouseLeave={e => { if (!isSel) e.currentTarget.style.background = 'transparent'; setHoveredEditCalDate(prev => prev === date ? null : prev) }}
                              style={{
                                width: 32, height: 32,
                                borderRadius: '50%',
                                border: isToday && !isSel ? `2px solid ${OWNER_ORANGE}` : 'none',
                                background: isSel ? OWNER_ORANGE : 'transparent',
                                color: isSel ? '#FFFFFF' : isToday ? OWNER_ORANGE : TEXT_DARK,
                                fontWeight: isSel || isToday ? 700 : 400,
                                fontSize: 13,
                                cursor: 'pointer',
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: 1,
                                padding: 0,
                                flexShrink: 0,
                                transition: 'background 0.12s, color 0.12s',
                              }}
                            >
                              <span style={{ lineHeight: 1 }}>{dayNum}</span>
                              {hasShift && <span style={{ width: 3, height: 3, borderRadius: '50%', background: isSel ? 'rgba(255,255,255,0.85)' : OWNER_ORANGE, flexShrink: 0 }} />}
                            </button>
                            {hoveredEditCalDate === date && hasShift && (
                              <div style={{
                                position: 'absolute', bottom: '100%', left: '50%', transform: 'translateX(-50%)',
                                marginBottom: 6, padding: '6px 10px', borderRadius: 8,
                                background: '#0F172A', color: '#FFFFFF', fontSize: 11, fontWeight: 600,
                                whiteSpace: 'nowrap', zIndex: 20, pointerEvents: 'none',
                                boxShadow: '0 4px 14px rgba(15,23,42,0.25)',
                              }}>
                                {dateShifts.map((s, idx) => (
                                  <div key={idx}>{formatShiftHour(s.start_time)} – {formatShiftHour(s.end_time)}</div>
                                ))}
                                <div style={{
                                  position: 'absolute', top: '100%', left: '50%', transform: 'translateX(-50%)',
                                  width: 0, height: 0, borderLeft: '5px solid transparent', borderRight: '5px solid transparent',
                                  borderTop: '5px solid #0F172A',
                                }} />
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>

                  <div style={{ background: '#FFFFFF', borderRadius: 14, padding: '12px 14px', border: `1px solid ${PANEL_BORDER}`, display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {(() => {
                      const deptTemplates = shiftTemplates
                      return (
                        <div>
                          <span style={{ display: 'block', fontWeight: 600, fontSize: '0.875rem', color: '#374151', marginBottom: 4 }}>Template</span>
                          <DropdownField
                            value={editSelectedTemplateId}
                            options={deptTemplates.map(t => ({ value: t.id, label: t.name }))}
                            onChange={v => {
                              const template = deptTemplates.find(t => t.id === v)
                              if (!template) return
                              setEditSelectedTemplateId(v)
                              setShiftEditForm(prev => ({ ...prev, start_time: template.start_time, end_time: template.end_time }))
                            }}
                            placeholder={deptTemplates.length ? 'Select a template' : 'No templates yet'}
                            disabled={deptTemplates.length === 0}
                          />
                        </div>
                      )
                    })()}
                    <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <span style={{ ...modalLabelStyle, marginBottom: 4 }}>Start Time</span>
                      <TimePicker value={shiftEditForm.start_time} onChange={val => { setEditSelectedTemplateId(''); setShiftEditForm(prev => ({ ...prev, start_time: val, end_time: bumpEndTime(val, prev.end_time) })) }} />
                    </label>
                    <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <span style={{ ...modalLabelStyle, marginBottom: 4 }}>End Time</span>
                      <TimePicker value={shiftEditForm.end_time} onChange={val => { setEditSelectedTemplateId(''); setShiftEditForm(prev => ({ ...prev, end_time: val })) }} minTime={shiftEditForm.start_time} />
                    </label>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: selectedShift?.split_group_id ? '1fr' : '1fr 1fr', gap: 12, alignItems: 'stretch' }}>
                <div style={{ background: '#FFFFFF', borderRadius: 14, padding: '12px', border: `1px solid ${PANEL_BORDER}`, display: 'flex', flexDirection: 'column' }}>
                  <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: editIsRecurrenceOriginal ? 'not-allowed' : 'pointer' }}>
                    <span style={{ ...modalLabelStyle, display: 'flex', alignItems: 'center', gap: 6, marginBottom: 0 }}>
                      <Repeat size={13} color={OWNER_ORANGE} /> Recurring
                    </span>
                    <input
                      type="checkbox"
                      checked={editRepeatEnabled}
                      disabled={editIsRecurrenceOriginal}
                      onChange={e => {
                        setEditRepeatEnabled(e.target.checked)
                        setEditRecurringTouched(true)
                      }}
                      style={{ width: 16, height: 16, accentColor: OWNER_ORANGE, cursor: editIsRecurrenceOriginal ? 'not-allowed' : 'pointer' }}
                    />
                  </label>

                  {editRepeatEnabled && (
                    <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
                      <div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
                          {(['daily', 'weekly', 'custom'] as const).map(rule => {
                            const active = editRecurringForm.recurrence_rule === rule
                            return (
                              <button
                                key={rule}
                                type="button"
                                onClick={() => { setEditRecurringForm(prev => ({ ...prev, recurrence_rule: rule })); setEditRecurringTouched(true) }}
                                style={{ height: 30, border: active ? `1.5px solid ${OWNER_ORANGE}` : `1px solid ${PANEL_BORDER}`, background: active ? '#FFF7ED' : '#FFFFFF', color: active ? OWNER_ORANGE : TEXT_DARK, borderRadius: 7, fontSize: 11.5, fontWeight: 600, cursor: 'pointer', textTransform: 'capitalize' }}
                              >
                                {rule}
                              </button>
                            )
                          })}
                        </div>
                      </div>

                      {editRecurringForm.recurrence_rule === 'custom' && (
                        <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          <span style={{ display: 'block', fontWeight: 600, fontSize: '0.75rem', color: '#374151' }}>Repeat Every (Days)</span>
                          <input
                            type="text"
                            inputMode="numeric"
                            value={editRecurringForm.custom_interval_days || ''}
                            onChange={e => {
                              const digits = e.target.value.replace(/\D/g, '')
                              setEditRecurringForm(prev => ({ ...prev, custom_interval_days: digits === '' ? 0 : Number(digits) }))
                              setEditRecurringTouched(true)
                            }}
                            onBlur={() => setEditRecurringForm(prev => ({ ...prev, custom_interval_days: Math.min(31, Math.max(1, prev.custom_interval_days || 1)) }))}
                            style={{ width: '100%', padding: '8px 10px', border: `1px solid ${PANEL_BORDER}`, borderRadius: 8, fontSize: 12, color: TEXT_DARK, boxSizing: 'border-box', fontFamily: 'inherit' }}
                          />
                        </label>
                      )}

                      <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <span style={{ display: 'block', fontWeight: 600, fontSize: '0.75rem', color: '#374151' }}>Repeat Until</span>
                        <DatePickerField
                          value={editRecurringForm.recurrence_end_date}
                          onChange={v => { setEditRecurringForm(prev => ({ ...prev, recurrence_end_date: v })); setEditRecurringTouched(true) }}
                          min={shiftEditForm.shift_date}
                          max={repeatUntilMaxDate}
                          clearable={false}
                          disableYearJump
                          compact
                        />
                      </label>

                      {editRecurringError && <div ref={editRecurringErrorRef} style={errorBoxStyle}>{editRecurringError}</div>}
                    </div>
                  )}
                </div>

                {!selectedShift?.split_group_id && (
                <div style={{ background: '#FFFFFF', borderRadius: 14, padding: '12px', border: `1px solid ${PANEL_BORDER}`, display: 'flex', flexDirection: 'column' }}>
                  <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}>
                    <span style={{ ...modalLabelStyle, display: 'flex', alignItems: 'center', gap: 6, marginBottom: 0 }}>
                      <SplitSquareHorizontal size={13} color={OWNER_ORANGE} /> Splitting
                    </span>
                    <input
                      type="checkbox"
                      checked={editSplitEnabled}
                      onChange={e => {
                        const checked = e.target.checked
                        setEditSplitEnabled(checked)
                        if (checked) {
                          const [sh, sm] = shiftEditForm.start_time.split(':').map(Number)
                          const [eh, em] = shiftEditForm.end_time.split(':').map(Number)
                          const startTotal = sh * 60 + sm
                          const endTotal = eh * 60 + em
                          const midSlot = Math.round((startTotal + endTotal) / 2 / 30)
                          const startSlot = Math.ceil(startTotal / 30)
                          const endSlot = Math.floor(endTotal / 30)
                          const block1EndSlot = Math.max(startSlot + 1, midSlot)
                          const block2StartSlot = Math.min(endSlot - 1, block1EndSlot + 1)
                          const toTime = (slot: number) => `${String(Math.floor(slot * 30 / 60)).padStart(2, '0')}:${String((slot * 30) % 60).padStart(2, '0')}`
                          setEditSplitBlock1End(toTime(block1EndSlot))
                          setEditSplitBlock2Start(toTime(Math.max(block2StartSlot, block1EndSlot + 1)))
                        }
                      }}
                      style={{ width: 16, height: 16, accentColor: OWNER_ORANGE, cursor: 'pointer' }}
                    />
                  </label>

                  {editSplitEnabled && (
                    <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                      <div>
                        <span style={{ display: 'block', textAlign: 'center', fontWeight: 600, fontSize: '0.75rem', color: '#374151', marginBottom: 6 }}>Shift 1</span>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                            <span style={{ display: 'block', fontWeight: 600, fontSize: '0.75rem', color: '#374151', marginBottom: 4 }}>Start</span>
                            <TimePicker compact value={shiftEditForm.start_time} disabled onChange={() => {}} />
                          </label>
                          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                            <span style={{ display: 'block', fontWeight: 600, fontSize: '0.75rem', color: '#374151', marginBottom: 4 }}>End</span>
                            <TimePicker compact value={editSplitBlock1End} onChange={v => setEditSplitBlock1End(v)} minTime={shiftEditForm.start_time} />
                          </label>
                        </div>
                      </div>
                      <div>
                        <span style={{ display: 'block', textAlign: 'center', fontWeight: 600, fontSize: '0.75rem', color: '#374151', marginBottom: 6 }}>Shift 2</span>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                            <span style={{ display: 'block', fontWeight: 600, fontSize: '0.75rem', color: '#374151', marginBottom: 4 }}>Start</span>
                            <TimePicker compact value={editSplitBlock2Start} onChange={v => setEditSplitBlock2Start(v)} minTime={editSplitBlock1End} />
                          </label>
                          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                            <span style={{ display: 'block', fontWeight: 600, fontSize: '0.75rem', color: '#374151', marginBottom: 4 }}>End</span>
                            <TimePicker compact value={shiftEditForm.end_time} disabled onChange={() => {}} />
                          </label>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                )}
                </div>

                {shiftActionError && <div ref={shiftActionErrorRef} style={errorBoxStyle}>{shiftActionError}</div>}
                {shiftActionWarning && (
                  <div style={warningBoxStyle}>
                    <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
                    <span>Shift updated, but: {shiftActionWarning}</span>
                  </div>
                )}
              </div>

              <div style={{ padding: '18px 34px 24px', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 10, borderTop: '1px solid #F3F4F6' }}>
                {shiftActionWarning ? (
                  <button type="button" onClick={() => setSelectedShift(null)} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7, border: 0, borderRadius: 10, background: '#F97316', color: '#FFFFFF', height: 36, padding: '0 18px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                    <Check size={16} /> Got it
                  </button>
                ) : (<>
                  <button type="button" onClick={deleteShift} disabled={shiftActionLoading} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, border: 'none', borderRadius: 10, background: shiftActionLoading ? '#F3A8A8' : 'linear-gradient(135deg, #EF4444, #DC2626)', color: '#FFFFFF', height: 36, padding: '0 14px', fontSize: 13, fontWeight: 700, cursor: shiftActionLoading ? 'not-allowed' : 'pointer', marginRight: 'auto' }}>{shiftActionLoading ? <Spinner size={13} /> : <Trash2 size={13} />} Delete</button>
                  <button type="button" onClick={openDuplicateShiftModal} disabled={shiftActionLoading} style={{ ...secondaryButtonStyle, height: 36, opacity: shiftActionLoading ? 0.65 : 1, cursor: shiftActionLoading ? 'not-allowed' : 'pointer' }}><Copy size={13} /> Duplicate</button>
                  <button type="button" onClick={saveShiftEdit} disabled={shiftActionLoading} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7, border: 0, borderRadius: 10, background: shiftActionLoading ? '#FDA060' : '#F97316', color: '#FFFFFF', height: 36, padding: '0 18px', fontSize: 13, fontWeight: 700, cursor: shiftActionLoading ? 'not-allowed' : 'pointer', opacity: shiftActionLoading ? 0.65 : 1 }}>{shiftActionLoading ? <Spinner size={13} /> : <Check size={16} />} {selectedShift.publication_status === 'draft' ? 'Save Draft' : 'Save'}</button>
                </>)}
              </div>
            </div>
          </div>
        )
      })()}

      {duplicateShiftModalOpen && selectedShift && (
        <div style={modalOverlayStyle}>
          <div style={{ ...modalStyle, width: 'min(440px, calc(100% - 32px))', padding: 0, display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '20px 24px 18px', borderBottom: '1px solid #F3F4F6', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 32, height: 32, borderRadius: 9, background: 'linear-gradient(135deg, #F97316, #EA580C)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Copy size={14} color="#fff" strokeWidth={2} />
                </div>
                <h2 style={{ fontWeight: 700, fontSize: '1rem', color: '#111827', margin: 0, fontFamily: "'Inter', system-ui, -apple-system, sans-serif" }}>Duplicate Shift</h2>
              </div>
              <button
                type="button"
                onClick={closeDuplicateShiftModal}
                disabled={duplicateShiftLoading}
                style={{ background: '#F9FAFB', border: '1px solid #E5E7EB', cursor: 'pointer', color: '#6B7280', display: 'flex', padding: '6px', borderRadius: 8, flexShrink: 0 }}
                onMouseEnter={e => { e.currentTarget.style.background = '#F3F4F6' }}
                onMouseLeave={e => { e.currentTarget.style.background = '#F9FAFB' }}
              >
                <X size={16} />
              </button>
            </div>

            <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <span style={{ display: 'block', fontWeight: 600, fontSize: '0.875rem', color: '#374151', marginBottom: 4 }}>Date</span>
                <TimelineDatePicker
                  value={duplicateShiftForm.shift_date}
                  onChange={nextDate => {
                    setDuplicateShiftForm(prev => {
                      const stillAvailable = prev.assigned_user_id
                        && !(futureShiftMap.get(`${prev.assigned_user_id}_${nextDate}`) ?? []).length
                      return { ...prev, shift_date: nextDate, assigned_user_id: stillAvailable ? prev.assigned_user_id : '' }
                    })
                  }}
                  shiftDates={EMPTY_DATE_SET}
                  minDate={dateOptions[0]}
                  maxDate={maxDate}
                  triggerStyle={{ width: '100%' }}
                />
              </div>

              {(() => {
                const deptTemplates = shiftTemplates
                return (
                  <div>
                    <span style={{ display: 'block', fontWeight: 600, fontSize: '0.875rem', color: '#374151', marginBottom: 4 }}>Template</span>
                    <DropdownField
                      value={duplicateSelectedTemplateId}
                      options={deptTemplates.map(t => ({ value: t.id, label: t.name }))}
                      onChange={v => {
                        const template = deptTemplates.find(t => t.id === v)
                        if (!template) return
                        setDuplicateSelectedTemplateId(v)
                        setDuplicateShiftForm(prev => ({ ...prev, start_time: template.start_time, end_time: template.end_time }))
                      }}
                      placeholder={deptTemplates.length ? 'Select a template' : 'No templates yet'}
                      disabled={deptTemplates.length === 0}
                    />
                  </div>
                )
              })()}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span style={{ ...modalLabelStyle, marginBottom: 4 }}>Start Time</span>
                  <TimePicker value={duplicateShiftForm.start_time} onChange={v => { setDuplicateSelectedTemplateId(''); setDuplicateShiftForm(prev => ({ ...prev, start_time: v, end_time: bumpEndTime(v, prev.end_time) })) }} />
                </label>
                <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span style={{ ...modalLabelStyle, marginBottom: 4 }}>End Time</span>
                  <TimePicker value={duplicateShiftForm.end_time} onChange={v => { setDuplicateSelectedTemplateId(''); setDuplicateShiftForm(prev => ({ ...prev, end_time: v })) }} minTime={duplicateShiftForm.start_time} />
                </label>
              </div>

              {(() => {
                const availableMembers = members.filter(member =>
                  !(futureShiftMap.get(`${member.id}_${duplicateShiftForm.shift_date}`) ?? []).length,
                )
                const noOneAvailable = availableMembers.length === 0
                return (
                  <div>
                    <span style={modalLabelStyle}>Assign To</span>
                    <DropdownField
                      value={duplicateShiftForm.assigned_user_id}
                      options={availableMembers.map(member => ({ value: member.id, label: member.full_name }))}
                      onChange={v => setDuplicateShiftForm(prev => ({ ...prev, assigned_user_id: v }))}
                      placeholder={noOneAvailable ? 'No one available on this date' : 'Select person'}
                      disabled={noOneAvailable}
                    />
                    {noOneAvailable && (
                      <p style={{ margin: '6px 0 0', fontSize: 12, color: '#B45309', whiteSpace: 'nowrap' }}>
                        Everyone already has a shift this date.
                      </p>
                    )}
                  </div>
                )
              })()}

              {duplicateShiftError && <div ref={duplicateShiftErrorRef} style={errorBoxStyle}>{duplicateShiftError}</div>}
            </div>

            <div style={{ padding: '18px 24px 24px', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 10, borderTop: '1px solid #F3F4F6' }}>
              <button type="button" onClick={closeDuplicateShiftModal} disabled={duplicateShiftLoading} style={{ ...secondaryButtonStyle, height: 36 }}>Cancel</button>
              <button type="button" onClick={submitDuplicateShift} disabled={duplicateShiftLoading || !duplicateShiftForm.assigned_user_id} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7, border: 0, borderRadius: 10, background: (duplicateShiftLoading || !duplicateShiftForm.assigned_user_id) ? '#FDA060' : '#F97316', color: '#FFFFFF', height: 36, padding: '0 18px', fontSize: 13, fontWeight: 700, cursor: (duplicateShiftLoading || !duplicateShiftForm.assigned_user_id) ? 'not-allowed' : 'pointer', opacity: (duplicateShiftLoading || !duplicateShiftForm.assigned_user_id) ? 0.65 : 1 }}>
                {duplicateShiftLoading ? <Spinner size={13} /> : <Copy size={14} />} Duplicate
              </button>
            </div>
          </div>
        </div>
      )}

      {bulkEditModalOpen && (
        <div style={modalOverlayStyle}>
          <div style={{ ...modalStyle, width: 'min(960px, calc(100% - 32px))', maxHeight: 'min(680px, 88vh)', padding: 0, display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '20px 24px 18px', borderBottom: '1px solid #F3F4F6', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 32, height: 32, borderRadius: 9, background: 'linear-gradient(135deg, #F97316, #EA580C)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Table2 size={14} color="#fff" strokeWidth={2} />
                </div>
                <h2 style={{ fontWeight: 700, fontSize: '1rem', color: '#111827', margin: 0, fontFamily: "'Inter', system-ui, -apple-system, sans-serif" }}>Bulk Shift Editor</h2>
              </div>
              <button
                type="button"
                onClick={closeBulkEditModal}
                style={{ background: '#F9FAFB', border: '1px solid #E5E7EB', cursor: 'pointer', color: '#6B7280', display: 'flex', padding: '6px', borderRadius: 8, flexShrink: 0 }}
                onMouseEnter={e => { e.currentTarget.style.background = '#F3F4F6' }}
                onMouseLeave={e => { e.currentTarget.style.background = '#F9FAFB' }}
              >
                <X size={16} />
              </button>
            </div>

            <div style={{ padding: '16px 24px', borderBottom: '1px solid #F3F4F6', display: 'flex', gap: 16, alignItems: 'flex-end', flexWrap: 'wrap', flexShrink: 0 }}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 4, width: 150 }}>
                <span style={{ display: 'block', fontWeight: 600, fontSize: '0.8125rem', color: '#374151' }}>From</span>
                <DatePickerField
                  value={bulkEditDateFrom}
                  onChange={setBulkEditDateFrom}
                  clearable={false}
                  compact
                />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 4, width: 150 }}>
                <span style={{ display: 'block', fontWeight: 600, fontSize: '0.8125rem', color: '#374151' }}>To</span>
                <DatePickerField
                  value={bulkEditDateTo}
                  onChange={setBulkEditDateTo}
                  clearable={false}
                  compact
                />
              </label>
              <div style={{ flex: 1, minWidth: 200 }}>
                <span style={{ display: 'block', fontWeight: 600, fontSize: '0.8125rem', color: '#374151', marginBottom: 4 }}>Department</span>
                <MultiSelectDropdownField
                  values={bulkEditDepartmentIds}
                  options={departments.map(dept => ({ value: dept.id, label: dept.name }))}
                  onChange={next => {
                    setBulkEditDepartmentIds(next)
                    if (next.length > 0) {
                      const allowedUserIds = new Set(members.filter(m => m.department_id && next.includes(m.department_id)).map(m => m.id))
                      setBulkEditUserIds(prev => prev.filter(id => allowedUserIds.has(id)))
                    }
                  }}
                  allLabel="All departments"
                />
              </div>
              <div style={{ flex: 1, minWidth: 200 }}>
                <span style={{ display: 'block', fontWeight: 600, fontSize: '0.8125rem', color: '#374151', marginBottom: 4 }}>User</span>
                <MultiSelectDropdownField
                  values={bulkEditUserIds}
                  options={members
                    .filter(member => bulkEditDepartmentIds.length === 0 || (member.department_id && bulkEditDepartmentIds.includes(member.department_id)))
                    .map(member => ({ value: member.id, label: member.full_name }))}
                  onChange={setBulkEditUserIds}
                  allLabel="All people"
                />
              </div>
              {bulkEditLoading && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: '#94A3B8', fontSize: 12.5, fontWeight: 600, height: 36 }}>
                  <Spinner size={13} /> Loading…
                </span>
              )}
            </div>

            <div style={{ padding: '16px 24px', flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
              {bulkEditError && <div style={{ ...errorBoxStyle, marginBottom: 12, flexShrink: 0 }}>{bulkEditError}</div>}
              {bulkEditRows.length === 0 ? (
                <div style={{ border: `1.5px dashed ${PANEL_BORDER}`, borderRadius: 12, padding: '32px 18px', textAlign: 'center' }}>
                  <div style={{ marginBottom: 6, display: 'flex', justifyContent: 'center' }}><Table2 size={20} color="#CBD5E1" /></div>
                  <p style={{ margin: 0, color: '#94A3B8', fontSize: 13, fontWeight: 600 }}>
                    {bulkEditLoading ? 'Loading shifts…' : 'No shifts found for this date range.'}
                  </p>
                </div>
              ) : (
                <div style={{ border: `1px solid ${PANEL_BORDER}`, borderRadius: 12, flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                <div style={{ background: '#0F172A', flexShrink: 0, paddingRight: 17 }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
                    <colgroup>
                      {BULK_EDIT_COLUMN_WIDTHS.map((w, i) => <col key={i} style={{ width: w }} />)}
                    </colgroup>
                    <thead>
                      <tr>
                        {['Date', 'Start', 'End', 'Department', 'Assigned To', ''].map(h => (
                          <th key={h} style={{ textAlign: 'center', padding: '16px 8px', fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.55)', letterSpacing: '0.05em' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                  </table>
                </div>
                <div style={{ overflowY: 'auto', flex: 1, minHeight: 0 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, tableLayout: 'fixed' }}>
                  <colgroup>
                    {BULK_EDIT_COLUMN_WIDTHS.map((w, i) => <col key={i} style={{ width: w }} />)}
                  </colgroup>
                  <tbody>
                    {bulkEditRows.map(row => {
                      const rowError = bulkEditRowErrors[row.id]
                      const rowMembers = members.filter(m => m.department_id === row.department_id)
                      const isPast = row.shift_date < todayStr
                      const isDeleting = bulkEditDeletingId === row.id
                      return (
                        <tr key={row.id} style={{ background: rowError ? '#FEF2F2' : 'transparent', opacity: isPast ? 0.6 : 1 }}>
                          <td style={{ padding: '6px 8px', borderBottom: `1px solid ${PANEL_BORDER}`, width: 150 }}>
                            <DatePickerField
                              value={row.shift_date}
                              onChange={v => updateBulkEditRow(row.id, { shift_date: v })}
                              disabled={isPast}
                              min={row.original_shift_date}
                              clearable={false}
                              compact
                            />
                          </td>
                          <td style={{ padding: '6px 8px', borderBottom: `1px solid ${PANEL_BORDER}` }}>
                            <TimePicker disabled={isPast} value={row.start_time} onChange={v => updateBulkEditRow(row.id, { start_time: v, end_time: bumpEndTime(v, row.end_time) })} />
                          </td>
                          <td style={{ padding: '6px 8px', borderBottom: `1px solid ${PANEL_BORDER}` }}>
                            <TimePicker disabled={isPast} value={row.end_time} onChange={v => updateBulkEditRow(row.id, { end_time: v })} minTime={row.start_time} />
                          </td>
                          <td style={{ padding: '6px 8px', borderBottom: `1px solid ${PANEL_BORDER}` }}>
                            <DropdownField
                              value={row.department_id}
                              options={departments.map(dept => ({ value: dept.id, label: dept.name }))}
                              onChange={v => updateBulkEditRow(row.id, { department_id: v, assigned_user_id: '' })}
                              disabled={isPast}
                            />
                          </td>
                          <td style={{ padding: '6px 8px', borderBottom: `1px solid ${PANEL_BORDER}` }}>
                            <DropdownField
                              value={row.assigned_user_id}
                              options={rowMembers.map(m => ({ value: m.id, label: m.full_name }))}
                              onChange={v => updateBulkEditRow(row.id, { assigned_user_id: v })}
                              placeholder={isPast ? 'Unassigned' : 'Open — needs staffing'}
                              disabled={isPast}
                            />
                            {!row.assigned_user_id && !isPast && (
                              <p style={{ margin: '4px 0 0', fontSize: 11, color: '#B45309', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                                <AlertTriangle size={11} /> No one assigned yet
                              </p>
                            )}
                            {rowError && (
                              <p style={{ margin: '4px 0 0', fontSize: 11, color: '#DC2626', fontWeight: 600 }}>{rowError}</p>
                            )}
                          </td>
                          <td style={{ padding: '6px 8px', borderBottom: `1px solid ${PANEL_BORDER}`, textAlign: 'right' }}>
                            <button
                              type="button"
                              onClick={() => deleteBulkEditRow(row.id)}
                              disabled={isPast || isDeleting}
                              title={isPast ? 'Past shifts cannot be deleted' : 'Delete shift'}
                              style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, border: 'none', borderRadius: 7, background: 'transparent', color: isPast ? '#D1D5DB' : '#DC2626', cursor: isPast || isDeleting ? 'not-allowed' : 'pointer' }}
                              onMouseEnter={e => { if (!isPast && !isDeleting) e.currentTarget.style.background = '#FEF2F2' }}
                              onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                            >
                              {isDeleting ? <Spinner size={13} /> : <Trash2 size={13} />}
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
                </div>
                </div>
              )}
            </div>

            <div style={{ padding: '14px 24px 20px', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 10, borderTop: '1px solid #F3F4F6', flexShrink: 0 }}>
              {(() => {
                const hasEditableRows = bulkEditRows.some(row => row.shift_date >= todayStr)
                const saveDisabled = bulkEditSaving || !hasEditableRows
                return (
                  <button type="button" onClick={submitBulkEdit} disabled={saveDisabled} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7, border: 0, borderRadius: 10, background: saveDisabled ? '#FDA060' : '#F97316', color: '#FFFFFF', height: 36, padding: '0 18px', fontSize: 13, fontWeight: 700, cursor: saveDisabled ? 'not-allowed' : 'pointer', opacity: saveDisabled ? 0.65 : 1 }}>
                    {bulkEditSaving ? <Spinner size={13} /> : <Check size={14} />} Save Changes
                  </button>
                )
              })()}
            </div>
          </div>
        </div>
      )}

      <Toast message={successToast ?? ''} />
      <Toast message={errorToast ?? ''} variant="error" />
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

function DropdownField({ value, options, onChange, placeholder, disabled = false, compact = false }: {
  value: string
  options: { value: string; label: string }[]
  onChange: (v: string) => void
  placeholder?: string
  disabled?: boolean
  compact?: boolean
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
          padding: compact ? '5px 10px' : '8px 12px', minHeight: compact ? 32 : 38, border: `1px solid ${open ? '#F97316' : '#E5E7EB'}`, borderRadius: 8,
          background: disabled ? '#F9FAFB' : '#FFFFFF', cursor: canOpen ? 'pointer' : 'default',
          fontSize: compact ? 12 : 13, color: selected ? '#111827' : '#9CA3AF',
          fontWeight: selected ? 500 : 400, outline: 'none', boxSizing: 'border-box',
          transition: 'border-color 0.15s',
        }}>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {selected?.label ?? placeholder ?? 'Select...'}
        </span>
        <ChevronDown size={compact ? 11 : 13} style={{ color: '#9CA3AF', flexShrink: 0, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
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

const BULK_EDIT_COLUMN_WIDTHS = ['18%', '16%', '16%', '23%', '20%', '7%']

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
  background: 'rgba(15,23,42,0.45)',
  display: 'grid',
  placeItems: 'center',
  padding: 18,
  zIndex: 100,
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

const warningBoxStyle: React.CSSProperties = {
  border: '1px solid #FDE3C8',
  background: '#FFF7ED',
  color: '#B45309',
  borderRadius: 10,
  padding: '10px 12px',
  fontSize: '0.82rem',
  fontWeight: 600,
  display: 'flex',
  alignItems: 'flex-start',
  gap: 8,
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
