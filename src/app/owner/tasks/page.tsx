'use client'

import { useState, useEffect, useLayoutEffect, useCallback, useRef, useMemo, Fragment } from 'react'
import { useRouter } from 'next/navigation'
import { createPortal } from 'react-dom'
import {
  Plus, X, ChevronDown, Calendar, AlertCircle,
  CheckCircle, Clock, Eye, Layers, Users,
  Crown, UserCog, UserRound, Pencil, Trash2, CalendarDays, ChevronLeft, ChevronRight,
  Sparkles, Check, Archive, ArchiveRestore, Repeat, Copy, GitBranch, Bell, ArrowRightLeft, LayoutTemplate, AlertTriangle,
} from 'lucide-react'
import { AiAssignSuggestion } from '@/types/AI'
import { createBrowserClient } from '@supabase/ssr'
import OwnerSidebar from '@/components/OwnerSidebar'
import OwnerPlanBadge from '@/components/owner/PlanBadge'
import OwnerUserBadge from '@/components/owner/OwnerUserBadge'
import { Task, TaskInput, KanbanGroup, TaskReassignmentSuggestion, TaskWorkloadSuggestion, StalledTaskAlert } from '@/types/Task'
import { TaskTemplate } from '@/types/TaskTemplate'
import { TimelineRow, TimelineShiftBlock } from '@/types/Timeline'

// ─── Date picker constants ────────────────────────────────────────────────────

const TASK_ORANGE = '#F97316'
const TASK_BORDER = '#E2E8F0'
const TASK_TEXT   = '#0F172A'

function formatDeadlineDisplay(value: string | null | undefined): string {
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


// ─── Task Date Picker ──────────────────────────────────────────────────────────

function TaskDatePicker({ value, onChange, taskDates, minDate, accentColor, fullWidth, compact }: {
  value: string
  onChange: (date: string) => void
  taskDates: Set<string>
  minDate: string
  accentColor: string
  fullWidth?: boolean
  compact?: boolean
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
    if (triggerRef.current) {
      const r = triggerRef.current.getBoundingClientRect()
      const POPOVER_H = 320
      const fitsBelow = r.bottom + POPOVER_H + 8 <= window.innerHeight
      setViewMonth(value.slice(0, 7))
      setPos({ top: fitsBelow ? r.bottom + 6 : r.top - POPOVER_H - 6, left: r.right - Math.max(r.width, 292), width: Math.max(r.width, 292) })
    }
    setOpen(o => !o)
  }

  const todayStr = formatDateKey(new Date())
  const minMonth = minDate.slice(0, 7)
  const [cy, cm] = viewMonth.split('-').map(Number)
  const firstDay = new Date(cy, cm - 1, 1).getDay()
  const daysInMonth = new Date(cy, cm, 0).getDate()
  const monthLabel = new Date(cy, cm - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  const cells: (string | null)[] = []
  for (let i = 0; i < firstDay; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(`${cy}-${String(cm).padStart(2, '0')}-${String(d).padStart(2, '0')}`)

  const canGoPrev = viewMonth > minMonth
  const goPrev = () => { const d = new Date(cy, cm - 2, 1); const nm = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; if (nm < minMonth) return; setViewMonth(nm) }
  const goNext = () => { const d = new Date(cy, cm, 1); setViewMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`) }

  const displayLabel = new Date(`${value}T00:00:00`).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })

  const popover = open ? (
    <div ref={popoverRef} style={{ position: 'fixed', top: pos.top, left: pos.left, zIndex: 9999, background: '#FFFFFF', border: `1px solid ${TASK_BORDER}`, borderRadius: 16, boxShadow: '0 8px 32px rgba(15,23,42,0.14)', padding: '14px 16px', width: pos.width }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <button type="button" onClick={goPrev} disabled={!canGoPrev} style={{ width: 26, height: 26, border: `1px solid ${TASK_BORDER}`, borderRadius: 7, background: '#FFFFFF', cursor: canGoPrev ? 'pointer' : 'default', display: 'flex', alignItems: 'center', justifyContent: 'center', color: canGoPrev ? '#64748B' : '#D1D5DB' }}><ChevronLeft size={13} /></button>
        <span style={{ fontSize: 13, fontWeight: 700, color: TASK_TEXT }}>{monthLabel}</span>
        <button type="button" onClick={goNext} style={{ width: 26, height: 26, border: `1px solid ${TASK_BORDER}`, borderRadius: 7, background: '#FFFFFF', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748B' }}><ChevronRight size={13} /></button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', marginBottom: 4 }}>
        {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => (
          <div key={d} style={{ fontSize: 11, fontWeight: 600, color: '#9CA3AF', textAlign: 'center', height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{d}</div>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
        {cells.map((date, i) => {
          if (!date) return <div key={`e-${i}`} style={{ height: 36 }} />
          if (date < minDate) {
            return (
              <div key={date} style={{ height: 36, width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, color: '#D1D5DB', userSelect: 'none' }}>
                {parseInt(date.split('-')[2])}
              </div>
            )
          }
          const isSel = date === value
          const isToday = date === todayStr
          const isPast = date < todayStr
          const hasTask = taskDates.has(date)
          return (
            <button key={date} type="button" onClick={() => { onChange(date); setOpen(false) }}
              style={{ height: 36, width: '100%', border: isToday && !isSel ? `2px solid ${accentColor}` : 'none', borderRadius: 8, background: isSel ? accentColor : 'transparent', color: isSel ? '#FFFFFF' : isToday ? accentColor : TASK_TEXT, fontWeight: isSel || isToday ? 700 : 400, fontSize: 13, cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2, padding: 0 }}
              onMouseEnter={e => { if (!isSel) e.currentTarget.style.background = '#F8FAFC' }}
              onMouseLeave={e => { if (!isSel) e.currentTarget.style.background = 'transparent' }}
            >
              <span style={{ lineHeight: 1 }}>{parseInt(date.split('-')[2])}</span>
              {hasTask && <span style={{ width: 4, height: 4, borderRadius: '50%', background: isPast ? '#94A3B8' : isSel ? 'rgba(255,255,255,0.8)' : accentColor, flexShrink: 0 }} />}
            </button>
          )
        })}
      </div>
    </div>
  ) : null

  return (
    <>
      <button ref={triggerRef} type="button" onClick={handleOpen}
        style={fullWidth ? {
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: compact ? '6px 10px' : '9px 12px', border: `1.5px solid ${open ? '#F97316' : '#E5E7EB'}`, borderRadius: 8,
          background: '#FFFFFF', cursor: 'pointer', fontSize: compact ? 12 : '0.8125rem', color: '#111827', fontWeight: 500,
          outline: 'none', boxSizing: 'border-box', transition: 'border-color 0.15s', minHeight: compact ? 32 : 40,
        } : { display: 'inline-flex', alignItems: 'center', gap: 6, height: 38, padding: '0 12px', border: `1px solid ${TASK_BORDER}`, borderRadius: 9, background: '#FFFFFF', cursor: 'pointer', fontSize: 13, fontWeight: 500, color: TASK_TEXT, minWidth: 140, boxSizing: 'border-box', fontFamily: 'var(--font-body), system-ui, sans-serif' }}
      >
        {fullWidth ? (
          <>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              <CalendarDays size={14} color="#9CA3AF" style={{ flexShrink: 0 }} />
              {displayLabel}
            </span>
            <ChevronDown size={13} style={{ color: '#9CA3AF', flexShrink: 0, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
          </>
        ) : (
          <>
            <CalendarDays size={14} color="#64748B" style={{ flexShrink: 0 }} />
            <span>{displayLabel}</span>
          </>
        )}
      </button>
      {typeof document !== 'undefined' && createPortal(popover, document.body)}
    </>
  )
}

// ─── Compact Date Picker (single field, popover calendar — for date-only pickers like "Repeat until") ──

function CompactDatePicker({ value, onChange, minDate, accentColor, placeholder = 'Select date' }: {
  value: string
  onChange: (date: string) => void
  minDate: string
  accentColor: string
  placeholder?: string
}) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState({ top: 0, left: 0, width: 220 })
  const [viewMonth, setViewMonth] = useState((value || minDate).slice(0, 7))
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
    if (triggerRef.current) {
      const r = triggerRef.current.getBoundingClientRect()
      const POPOVER_H = 300
      const fitsBelow = r.bottom + POPOVER_H + 8 <= window.innerHeight
      setViewMonth((value || minDate).slice(0, 7))
      setPos({ top: fitsBelow ? r.bottom + 6 : r.top - POPOVER_H - 6, left: r.left, width: Math.max(r.width, 240) })
    }
    setOpen(o => !o)
  }

  const todayStr = formatDateKey(new Date())
  const minMonth = minDate.slice(0, 7)
  const [cy, cm] = viewMonth.split('-').map(Number)
  const firstDay = new Date(cy, cm - 1, 1).getDay()
  const daysInMonth = new Date(cy, cm, 0).getDate()
  const monthLabel = new Date(cy, cm - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  const cells: (string | null)[] = []
  for (let i = 0; i < firstDay; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(`${cy}-${String(cm).padStart(2, '0')}-${String(d).padStart(2, '0')}`)
  const canGoPrev = viewMonth > minMonth
  const goPrev = () => { const d = new Date(cy, cm - 2, 1); const nm = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; if (nm < minMonth) return; setViewMonth(nm) }
  const goNext = () => { const d = new Date(cy, cm, 1); setViewMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`) }

  const displayLabel = value
    ? new Date(`${value}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : placeholder

  const popover = open ? (
    <div ref={popoverRef} style={{ position: 'fixed', top: pos.top, left: pos.left, zIndex: 9999, background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: 16, boxShadow: '0 8px 32px rgba(15,23,42,0.14)', overflow: 'hidden', width: pos.width, padding: '14px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <button type="button" onClick={goPrev} disabled={!canGoPrev} style={{ width: 26, height: 26, border: '1px solid #E5E7EB', borderRadius: 7, background: '#FFFFFF', cursor: canGoPrev ? 'pointer' : 'default', display: 'flex', alignItems: 'center', justifyContent: 'center', color: canGoPrev ? '#64748B' : '#D1D5DB' }}><ChevronLeft size={13} /></button>
        <span style={{ fontSize: 13, fontWeight: 700, color: '#0F172A' }}>{monthLabel}</span>
        <button type="button" onClick={goNext} style={{ width: 26, height: 26, border: '1px solid #E5E7EB', borderRadius: 7, background: '#FFFFFF', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748B' }}><ChevronRight size={13} /></button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', marginBottom: 4 }}>
        {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => (
          <div key={d} style={{ fontSize: 11, fontWeight: 600, color: '#9CA3AF', textAlign: 'center', height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{d}</div>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
        {cells.map((date, i) => {
          if (!date) return <div key={`e-${i}`} style={{ height: 32 }} />
          if (date < minDate) {
            return <div key={date} style={{ height: 32, width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: '#D1D5DB', userSelect: 'none' }}>{parseInt(date.split('-')[2])}</div>
          }
          const isSel = date === value
          const isToday = date === todayStr
          return (
            <button key={date} type="button" onClick={() => { onChange(date); setOpen(false) }}
              style={{ height: 32, width: '100%', border: isToday && !isSel ? `1.5px solid ${accentColor}` : 'none', borderRadius: 8, background: isSel ? accentColor : 'transparent', color: isSel ? '#FFFFFF' : isToday ? accentColor : '#0F172A', fontWeight: isSel || isToday ? 700 : 400, fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}
              onMouseEnter={e => { if (!isSel) e.currentTarget.style.background = '#F8FAFC' }}
              onMouseLeave={e => { if (!isSel) e.currentTarget.style.background = 'transparent' }}
            >{parseInt(date.split('-')[2])}</button>
          )
        })}
      </div>
    </div>
  ) : null

  return (
    <div style={{ position: 'relative' }}>
      <button ref={triggerRef} type="button" onClick={handleOpen}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '9px 12px', border: `1.5px solid ${open ? accentColor : '#E5E7EB'}`, borderRadius: 8,
          background: '#FFFFFF', cursor: 'pointer', fontSize: '0.8125rem',
          color: value ? '#111827' : '#9CA3AF', fontWeight: value ? 500 : 400,
          outline: 'none', boxSizing: 'border-box', transition: 'border-color 0.15s', minHeight: 40,
        }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          <CalendarDays size={14} color="#9CA3AF" style={{ flexShrink: 0 }} />
          {displayLabel}
        </span>
        <ChevronDown size={13} style={{ color: '#9CA3AF', flexShrink: 0, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
      </button>
      {typeof document !== 'undefined' && createPortal(popover, document.body)}
    </div>
  )
}

// ─── Local page types ─────────────────────────────────────────────────────────

type Department = { id: string; name: string }
type Member = {
  id: string
  full_name: string
  role: string
  department_id: string | null
  email_address?: string | null
  phone_number?: string | null
  date_of_birth?: string | null
  created_at?: string | null
  skills?: string[] | string | null
  worker_status?: string | null
  profile_photo_url?: string | null
}
type ManagerInfo = { id: string; full_name: string; department_id: string | null }
type ShiftOption = TimelineShiftBlock & {
  assignee_name: string
  user_id: string | null
}

const EMPTY_USER_ID_SET: Set<string> = new Set()

type DeptTaskStats = {
  department_id: string
  department_name: string
  assigned: number
  inProgress: number
  review: number
  complete: number
}

type PriorityLevel = 'Low' | 'Medium' | 'High' | 'Urgent'
type TaskRecurrenceRule = 'daily' | 'weekly' | 'custom'
type TaskDeadlineRuleType = 'same_day' | 'fixed_day' | 'relative'
const PRIORITY_COLORS: Record<string, { bg: string; text: string }> = {
  Low:    { bg: '#F1F5F9', text: '#475569' },
  Medium: { bg: '#DBEAFE', text: '#1D4ED8' },
  High:   { bg: '#FFEDD5', text: '#C2410C' },
  Urgent: { bg: '#FEE2E2', text: '#B91C1C' },
}

const WEEKDAY_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']
const TIME_OPTIONS: { value: string; label: string }[] = (() => {
  const res: { value: string; label: string }[] = []
  for (let h = 0; h < 24; h++) {
    for (const m of [0, 30]) {
      const dh = h === 0 ? 12 : h > 12 ? h - 12 : h
      const ampm = h < 12 ? 'AM' : 'PM'
      res.push({ value: `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`, label: `${dh}:${String(m).padStart(2, '0')} ${ampm}` })
    }
  }
  return res
})()

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; colBg: string; icon: React.ReactNode }> = {
  'Assigned':    { label: 'Assigned',    color: '#475569', bg: '#E2E8F0', colBg: '#F4F4F5', icon: <Layers size={13} /> },
  'In Progress': { label: 'In Progress', color: '#2563EB', bg: '#DBEAFE', colBg: '#F4F4F5', icon: <Clock size={13} /> },
  'Review':      { label: 'Review',      color: '#EA580C', bg: '#FED7AA', colBg: '#F4F4F5', icon: <Eye size={13} /> },
  'Complete':    { label: 'Complete',    color: '#16A34A', bg: '#BBF7D0', colBg: '#F4F4F5', icon: <CheckCircle size={13} /> },
}

const COLUMNS: Task['status'][] = ['Assigned', 'In Progress', 'Review', 'Complete']

// ─── Helpers ──────────────────────────────────────────────────────────────────

function Spinner({ size = 16, dark = false }: { size?: number; dark?: boolean }) {
  return (
    <svg className="animate-spin" width={size} height={size} viewBox="0 0 18 18" style={{ display: 'inline-block', flexShrink: 0 }}>
      <circle cx="9" cy="9" r="7" stroke={dark ? 'rgba(17,24,39,0.2)' : 'rgba(255,255,255,0.35)'} strokeWidth="2.5" fill="none" />
      <path d="M9 2a7 7 0 0 1 7 7" stroke={dark ? '#111827' : 'white'} strokeWidth="2.5" strokeLinecap="round" fill="none" />
    </svg>
  )
}

function formatDueDate(due: string): string {
  const d = new Date(due)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function formatDateKey(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function kanbanDateKey(task: Task): string {
  if (task.task_date) return task.task_date
  if (task.shift_date) return task.shift_date
  return formatDateKey(new Date(task.created_at))
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

function isDueOverdue(due: string): boolean {
  return new Date(due) < new Date()
}

function isDueWithinHours(due: string, hours: number): boolean {
  const msRemaining = new Date(due).getTime() - Date.now()
  return msRemaining > 0 && msRemaining <= hours * 60 * 60 * 1000
}

function formatDateDisplay(value: string | null | undefined, empty = '—'): string {
  if (!value) return empty
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return empty
  return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).format(date)
}

function formatShiftOptionLabel(shift: ShiftOption): string {
  const date = new Date(`${shift.shift_date}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  const time = `${shift.start_time.slice(0, 5)}-${shift.end_time.slice(0, 5)}`
  return `${date} | ${time} | ${shift.assignee_name}`
}

import { deptColor, setDeptColorOverrides } from '@/lib/deptColor'
function deptCardBg(deptId: string): string {
  const hex = deptColor(deptId)
  const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r},${g},${b},0.06)`
}
function deptCardBorder(deptId: string): string {
  const hex = deptColor(deptId)
  const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r},${g},${b},0.22)`
}

const PRIORITY_ORDER: Record<string, number> = { Urgent: 0, High: 1, Medium: 2, Low: 3 }

// ─── Modal helpers ────────────────────────────────────────────────────────────

const modalInputStyle: React.CSSProperties = {
  width: '100%', padding: '9px 12px', border: '1.5px solid #E5E7EB',
  borderRadius: '8px', fontSize: '0.8125rem', color: '#111827',
  outline: 'none', boxSizing: 'border-box', background: '#FFFFFF', minHeight: 40,
}
const modalLabelStyle: React.CSSProperties = {
  display: 'block', fontWeight: 600, fontSize: '0.8125rem', color: '#374151', marginBottom: '6px',
}
const modalSelectStyle: React.CSSProperties = {
  ...modalInputStyle, paddingRight: 36, appearance: 'none', cursor: 'pointer',
}

// ─── Description textarea: Tab → bullet point, "1." + space → numbered list ──

function handleDescriptionKeyDown(
  e: React.KeyboardEvent<HTMLTextAreaElement>,
  value: string,
  onChange: (v: string) => void,
) {
  const el = e.currentTarget
  const start = el.selectionStart
  const end = el.selectionEnd
  const lineStart = value.lastIndexOf('\n', start - 1) + 1

  // Mutate the native textarea synchronously (value + caret) before calling onChange — React's
  // re-render lags one tick behind, and fast typing right after this keystroke would otherwise
  // land at the stale caret position and corrupt the text.
  if (e.key === 'Tab') {
    e.preventDefault()
    const line = value.slice(lineStart, start)
    if (/^(-|\d+\.)\s/.test(line)) return // already a list line, don't double up
    const next = value.slice(0, lineStart) + '- ' + value.slice(lineStart)
    const caret = start + 2 + (end - start)
    el.value = next
    el.selectionStart = el.selectionEnd = caret
    onChange(next)
    return
  }

  if (e.key === ' ') {
    const line = value.slice(lineStart, start)
    if (/^\d+$/.test(line)) {
      // digits-only at the start of a line + space → numbered list marker, e.g. "1" + space becomes "1. "
      e.preventDefault()
      const next = value.slice(0, start) + '. ' + value.slice(end)
      const caret = start + 2
      el.value = next
      el.selectionStart = el.selectionEnd = caret
      onChange(next)
    }
  }
}

function InlineError({ message }: { message: string }) {
  if (!message) return null
  return (
    <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '8px', padding: '10px 14px', fontSize: '0.875rem', color: '#DC2626', marginTop: '12px' }}>
      {message}
    </div>
  )
}

// ─── Custom Dropdown Field ────────────────────────────────────────────────────

function DropdownField({ value, options, onChange, placeholder, disabled = false, badgeColors }: {
  value: string
  options: { value: string; label: string }[]
  onChange: (v: string) => void
  placeholder?: string
  disabled?: boolean
  badgeColors?: Record<string, { bg: string; text: string }>
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
          padding: '9px 12px', border: `1.5px solid ${open ? '#F97316' : '#E5E7EB'}`, borderRadius: 8,
          background: disabled ? '#F9FAFB' : '#FFFFFF', cursor: canOpen ? 'pointer' : 'default',
          fontSize: '0.8125rem', color: selected ? '#111827' : '#9CA3AF',
          fontWeight: selected ? 500 : 400, outline: 'none', boxSizing: 'border-box',
          transition: 'border-color 0.15s', minHeight: 40,
        }}>
        {selected && badgeColors?.[selected.value] ? (
          <span style={{ height: 20, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: 800, padding: '0 10px', borderRadius: '99px', background: badgeColors[selected.value].bg, color: badgeColors[selected.value].text, letterSpacing: '0.01em', lineHeight: 1, alignSelf: 'center' }}>
            {selected.label}
          </span>
        ) : (
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {selected?.label ?? placeholder ?? 'Select...'}
          </span>
        )}
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
            const badge = badgeColors?.[opt.value]
            return (
              <button key={opt.value} type="button"
                onClick={() => { onChange(opt.value); setOpen(false) }}
                style={{
                  display: 'flex', alignItems: 'center', width: '100%', padding: '8px 14px', textAlign: 'left',
                  border: 'none', background: isSel ? '#FFF7ED' : 'transparent',
                  color: isSel ? '#EA580C' : '#374151', fontWeight: isSel ? 700 : 400,
                  fontSize: 13, cursor: 'pointer',
                }}
                onMouseEnter={e => { if (!isSel) e.currentTarget.style.background = '#F9FAFB' }}
                onMouseLeave={e => { if (!isSel) e.currentTarget.style.background = 'transparent' }}
              >
                {badge ? (
                  <span style={{ fontSize: '0.7rem', fontWeight: 800, padding: '3px 9px', borderRadius: '99px', background: badge.bg, color: badge.text, letterSpacing: '0.01em' }}>
                    {opt.label}
                  </span>
                ) : opt.label}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── Deadline Picker (single field, sequential date → time selection) ────────

function DeadlinePicker({ dateValue, timeValue, onChange, minDate }: {
  dateValue: string
  timeValue: string
  onChange: (date: string, time: string) => void
  minDate: string
}) {
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState<'date' | 'time'>('date')
  const [pos, setPos] = useState({ top: 0, left: 0, width: 220 })
  const [viewMonth, setViewMonth] = useState((dateValue || minDate).slice(0, 7))
  const triggerRef = useRef<HTMLButtonElement>(null)
  const popoverRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const hNum = timeValue ? parseInt(timeValue.split(':')[0]) : -1
  const mNum = timeValue ? parseInt(timeValue.split(':')[1]) : 0
  const derivedAmpm: 'AM' | 'PM' = hNum >= 12 ? 'PM' : 'AM'
  const [meridiem, setMeridiem] = useState<'AM' | 'PM'>(derivedAmpm)

  useEffect(() => {
    if (timeValue) setMeridiem(parseInt(timeValue.split(':')[0]) >= 12 ? 'PM' : 'AM')
  }, [timeValue])

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (triggerRef.current?.contains(e.target as Node) || popoverRef.current?.contains(e.target as Node)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  useEffect(() => {
    if (step === 'time' && listRef.current) {
      const sel = listRef.current.querySelector('[data-selected="true"]') as HTMLElement | null
      if (sel) sel.scrollIntoView({ block: 'center' })
    }
  }, [step, meridiem])

  const handleOpen = () => {
    if (triggerRef.current) {
      const r = triggerRef.current.getBoundingClientRect()
      const nextStep = dateValue ? 'time' : 'date'
      const POPOVER_H = nextStep === 'date' ? 320 : 280
      const fitsBelow = r.bottom + POPOVER_H + 8 <= window.innerHeight
      setViewMonth((dateValue || minDate).slice(0, 7))
      setStep(nextStep)
      setPos({ top: fitsBelow ? r.bottom + 6 : r.top - POPOVER_H - 6, left: r.left, width: nextStep === 'date' ? Math.max(r.width, 292) : 220 })
    }
    setOpen(o => !o)
  }

  const roundedDeadlineTimeForToday = () => {
    const now = new Date()
    const totalMinutes = now.getHours() * 60 + now.getMinutes()
    const roundedMinutes = Math.ceil(totalMinutes / 30) * 30
    if (roundedMinutes >= 24 * 60) return ''
    const h = Math.floor(roundedMinutes / 60)
    const m = roundedMinutes % 60
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
  }

  const times = useMemo(() => {
    const res: { value: string; label: string }[] = []
    const startH = meridiem === 'AM' ? 0 : 12
    const endH = meridiem === 'AM' ? 12 : 24
    for (let h = startH; h < endH; h++) {
      for (const m of [0, 30]) {
        const dh = h === 0 ? 12 : h > 12 ? h - 12 : h
        res.push({ value: `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`, label: `${dh}:${String(m).padStart(2, '0')}` })
      }
    }
    return res
  }, [meridiem])

  const todayStr = formatDateKey(new Date())
  const earliestTimeForSelectedDate = dateValue === todayStr ? roundedDeadlineTimeForToday() : ''
  const availableTimes = earliestTimeForSelectedDate
    ? times.filter(t => t.value >= earliestTimeForSelectedDate)
    : times
  const minMonth = minDate.slice(0, 7)
  const [cy, cm] = viewMonth.split('-').map(Number)
  const firstDay = new Date(cy, cm - 1, 1).getDay()
  const daysInMonth = new Date(cy, cm, 0).getDate()
  const monthLabel = new Date(cy, cm - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  const cells: (string | null)[] = []
  for (let i = 0; i < firstDay; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(`${cy}-${String(cm).padStart(2, '0')}-${String(d).padStart(2, '0')}`)
  const canGoPrev = viewMonth > minMonth
  const goPrev = () => { const d = new Date(cy, cm - 2, 1); const nm = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; if (nm < minMonth) return; setViewMonth(nm) }
  const goNext = () => { const d = new Date(cy, cm, 1); setViewMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`) }

  const dateLabel = dateValue
    ? new Date(`${dateValue}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : null
  const displayDateLabel = dateValue
    ? new Date(`${dateValue}T00:00:00`).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit' })
    : null
  const timeLabel = timeValue
    ? `${hNum === 0 ? 12 : hNum > 12 ? hNum - 12 : hNum}:${String(mNum).padStart(2, '0')} ${derivedAmpm}`
    : null
  const displayLabel = displayDateLabel && timeLabel ? `${displayDateLabel}, ${timeLabel}` : displayDateLabel ? `${displayDateLabel}, select time` : 'Select deadline'

  const datePanel = (
    <div style={{ padding: '14px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <button type="button" onClick={goPrev} disabled={!canGoPrev} style={{ width: 26, height: 26, border: `1px solid ${TASK_BORDER}`, borderRadius: 7, background: '#FFFFFF', cursor: canGoPrev ? 'pointer' : 'default', display: 'flex', alignItems: 'center', justifyContent: 'center', color: canGoPrev ? '#64748B' : '#D1D5DB' }}><ChevronLeft size={13} /></button>
        <span style={{ fontSize: 13, fontWeight: 700, color: TASK_TEXT }}>{monthLabel}</span>
        <button type="button" onClick={goNext} style={{ width: 26, height: 26, border: `1px solid ${TASK_BORDER}`, borderRadius: 7, background: '#FFFFFF', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748B' }}><ChevronRight size={13} /></button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', marginBottom: 4 }}>
        {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => (
          <div key={d} style={{ fontSize: 11, fontWeight: 600, color: '#9CA3AF', textAlign: 'center', height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{d}</div>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
        {cells.map((date, i) => {
          if (!date) return <div key={`e-${i}`} style={{ height: 36 }} />
          if (date < minDate) {
            return (
              <div key={date} style={{ height: 36, width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, color: '#D1D5DB', userSelect: 'none' }}>
                {parseInt(date.split('-')[2])}
              </div>
            )
          }
          const isSel = date === dateValue
          const isToday = date === todayStr
          return (
            <button key={date} type="button" onClick={() => {
              const minTime = date === todayStr ? roundedDeadlineTimeForToday() : ''
              const nextTime = minTime && (!timeValue || timeValue < minTime) ? minTime : timeValue
              if (nextTime) setMeridiem(parseInt(nextTime.split(':')[0]) >= 12 ? 'PM' : 'AM')
              onChange(date, nextTime)
              setStep('time')
              setPos(current => ({ ...current, width: 220 }))
            }}
              style={{ height: 36, width: '100%', border: isToday && !isSel ? '2px solid #F97316' : 'none', borderRadius: 8, background: isSel ? '#F97316' : 'transparent', color: isSel ? '#FFFFFF' : isToday ? '#F97316' : TASK_TEXT, fontWeight: isSel || isToday ? 700 : 400, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}
              onMouseEnter={e => { if (!isSel) e.currentTarget.style.background = '#F8FAFC' }}
              onMouseLeave={e => { if (!isSel) e.currentTarget.style.background = 'transparent' }}
            >{parseInt(date.split('-')[2])}</button>
          )
        })}
      </div>
    </div>
  )

  const timePanel = (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 12px', borderBottom: '1px solid #F1F5F9' }}>
        <button type="button" onClick={() => setStep('date')} style={{ border: 'none', background: 'transparent', color: '#64748B', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 600, padding: 0 }}>
          <ChevronLeft size={13} /> {dateLabel}
        </button>
      </div>
      <div style={{ display: 'flex' }}>
        <div ref={listRef} style={{ flex: 1, maxHeight: 168, overflowY: 'auto', padding: '4px 0' }}>
          {availableTimes.map(t => {
            const isSel = t.value === timeValue
            return (
              <button key={t.value} type="button" data-selected={isSel ? 'true' : 'false'}
                onClick={() => { onChange(dateValue, t.value); setOpen(false) }}
                style={{ display: 'block', width: '100%', padding: '7px 16px', textAlign: 'left', border: 'none', background: isSel ? '#FFF7ED' : 'transparent', color: isSel ? '#EA580C' : '#0F172A', fontWeight: isSel ? 700 : 400, fontSize: 13, cursor: 'pointer' }}
                onMouseEnter={e => { if (!isSel) e.currentTarget.style.background = '#F9FAFB' }}
                onMouseLeave={e => { if (!isSel) e.currentTarget.style.background = 'transparent' }}
              >{t.label}</button>
            )
          })}
          {availableTimes.length === 0 && (
            <div style={{ padding: '12px 16px', color: '#9CA3AF', fontSize: 12, fontWeight: 600 }}>
              No available time today
            </div>
          )}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 6, padding: 8, borderLeft: '1px solid #E2E8F0' }}>
          {(['AM', 'PM'] as const).map(mp => (
            <button key={mp} type="button"
              onClick={() => {
                const periodAvailable = !earliestTimeForSelectedDate || (mp === 'AM' ? earliestTimeForSelectedDate < '12:00' : earliestTimeForSelectedDate <= '23:30')
                if (!periodAvailable) return
                if (!timeValue) { setMeridiem(mp); return }
                const [ch, cm] = timeValue.split(':').map(Number)
                let newH = ch
                if (mp === 'AM' && ch >= 12) newH = ch - 12
                if (mp === 'PM' && ch < 12) newH = ch + 12
                const nextTime = `${String(newH).padStart(2, '0')}:${String(cm).padStart(2, '0')}`
                if (earliestTimeForSelectedDate && nextTime < earliestTimeForSelectedDate) return
                onChange(dateValue, nextTime)
                setMeridiem(mp)
              }}
              style={{
                borderRadius: 7,
                border: 'none',
                background: meridiem === mp ? '#F97316' : '#F1F5F9',
                color: meridiem === mp ? '#FFFFFF' : '#0F172A',
                fontWeight: 600,
                fontSize: 12,
                padding: '7px 10px',
                cursor: (!earliestTimeForSelectedDate || (mp === 'AM' ? earliestTimeForSelectedDate < '12:00' : earliestTimeForSelectedDate <= '23:30')) ? 'pointer' : 'not-allowed',
                lineHeight: 1,
                opacity: (!earliestTimeForSelectedDate || (mp === 'AM' ? earliestTimeForSelectedDate < '12:00' : earliestTimeForSelectedDate <= '23:30')) ? 1 : 0.45,
              }}
            >{mp}</button>
          ))}
        </div>
      </div>
    </div>
  )

  const popover = open ? (
    <div ref={popoverRef} style={{ position: 'fixed', top: pos.top, left: pos.left, zIndex: 9999, background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: 16, boxShadow: '0 8px 32px rgba(15,23,42,0.14)', overflow: 'hidden', width: pos.width }}>
      {step === 'date' ? datePanel : timePanel}
    </div>
  ) : null

  return (
    <div style={{ position: 'relative' }}>
      <button ref={triggerRef} type="button" onClick={handleOpen}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '9px 12px', border: `1.5px solid ${open ? '#F97316' : '#E5E7EB'}`, borderRadius: 8,
          background: '#FFFFFF', cursor: 'pointer', fontSize: '0.8125rem',
          color: dateValue ? '#111827' : '#9CA3AF', fontWeight: dateValue ? 500 : 400,
          outline: 'none', boxSizing: 'border-box', transition: 'border-color 0.15s', minHeight: 40,
        }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          <CalendarDays size={14} color="#9CA3AF" style={{ flexShrink: 0 }} />
          {displayLabel}
        </span>
        <ChevronDown size={13} style={{ color: '#9CA3AF', flexShrink: 0, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
      </button>
      {typeof document !== 'undefined' && createPortal(popover, document.body)}
    </div>
  )
}

// ─── Sub-task Order List (drag to reorder; shows step numbers + "do in order" connector once 2+) ──

function SubTaskOrderList({ items, onReorder, onRemove, onRename, disabled }: {
  items: { id: string; title: string }[]
  onReorder: (orderedIds: string[]) => void
  onRemove?: (id: string) => void
  onRename?: (id: string, title: string) => void
  disabled?: boolean
}) {
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [dragOverId, setDragOverId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingTitle, setEditingTitle] = useState('')
  const ordered = items.length >= 2

  const saveRename = () => {
    if (!editingId) return
    const title = editingTitle.trim()
    if (title) onRename?.(editingId, title)
    setEditingId(null)
    setEditingTitle('')
  }

  const moveItem = (sourceId: string, targetId: string) => {
    if (sourceId === targetId) return
    const sourceIdx = items.findIndex(i => i.id === sourceId)
    const targetIdx = items.findIndex(i => i.id === targetId)
    if (sourceIdx === -1 || targetIdx === -1) return
    const next = [...items.map(i => i.id)]
    next.splice(sourceIdx, 1)
    next.splice(targetIdx, 0, sourceId)
    onReorder(next)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {items.map((item, idx) => {
        const isDragging = draggingId === item.id
        const isDragOver = dragOverId === item.id
        const isLast = idx === items.length - 1
        return (
          <div key={item.id}>
            <div
              draggable={!disabled}
              onDragStart={event => {
                if (editingId) { event.preventDefault(); return }
                const target = event.target as HTMLElement | null
                if (target?.closest('button')) { event.preventDefault(); return }
                event.dataTransfer.effectAllowed = 'move'
                event.dataTransfer.setData('text/plain', item.id)
                setDraggingId(item.id)
              }}
              onDragEnd={() => { setDraggingId(null); setDragOverId(null) }}
              onDragOver={event => {
                event.preventDefault()
                if (draggingId && draggingId !== item.id) setDragOverId(item.id)
              }}
              onDragLeave={event => {
                if (event.currentTarget.contains(event.relatedTarget as Node | null)) return
                setDragOverId(current => current === item.id ? null : current)
              }}
              onDrop={event => {
                event.preventDefault()
                const sourceId = event.dataTransfer.getData('text/plain')
                if (sourceId) moveItem(sourceId, item.id)
                setDraggingId(null); setDragOverId(null)
              }}
              style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '9px 10px',
                border: `1px solid ${isDragOver ? '#F97316' : '#E5E7EB'}`, borderRadius: 9,
                background: '#FFFFFF', cursor: disabled ? 'default' : isDragging ? 'grabbing' : 'grab',
                opacity: isDragging ? 0.6 : 1,
                outline: isDragOver ? '2px dashed #F97316' : 'none', outlineOffset: 2,
                transition: 'border-color 0.15s, opacity 0.15s',
              }}
            >
              {ordered ? (
                <span style={{ width: 20, height: 20, borderRadius: '50%', background: '#FFF3E8', color: '#EA580C', fontSize: 11, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {idx + 1}
                </span>
              ) : (
                <GitBranch size={13} color="#9CA3AF" style={{ flexShrink: 0 }} />
              )}
              {editingId === item.id ? (
                <input
                  autoFocus
                  value={editingTitle}
                  onChange={event => setEditingTitle(event.target.value)}
                  onBlur={saveRename}
                  onKeyDown={event => {
                    if (event.key === 'Enter') saveRename()
                    if (event.key === 'Escape') { setEditingId(null); setEditingTitle('') }
                  }}
                  style={{ ...modalInputStyle, flex: 1, minHeight: 30, padding: '5px 8px', fontSize: 13 }}
                />
              ) : (
                <span
                  onDoubleClick={() => { if (!disabled && onRename) { setEditingId(item.id); setEditingTitle(item.title) } }}
                  title={onRename ? 'Double-click to edit' : undefined}
                  style={{ flex: 1, fontSize: 13, color: '#111827', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', cursor: onRename && !disabled ? 'text' : undefined }}
                >
                  {item.title}
                </span>
              )}
              {onRemove && (
                <button type="button" onClick={() => onRemove(item.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex', color: '#9CA3AF', borderRadius: 6, flexShrink: 0 }}>
                  <X size={13} />
                </button>
              )}
            </div>
            {ordered && !isLast && (
              <div style={{ display: 'flex', alignItems: 'center', padding: '3px 0 3px 19px', color: '#CBD5E1' }}>
                <div style={{ width: 1, height: 12, background: '#E2E8F0' }} />
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── Task Card ────────────────────────────────────────────────────────────────

function TaskCard({
  task, members, shiftOptions, departments, showDept, onClick, onEdit, subTaskCount, expanded, onToggleExpand, clickable = true, isOwner = true, highlighted = false, noOuterMargin = false, fillHeight = false,
}: {
  task: Task
  members: Member[]
  shiftOptions: ShiftOption[]
  departments: Department[]
  showDept: boolean
  onClick: () => void
  onEdit: () => void
  subTaskCount?: number
  expanded?: boolean
  onToggleExpand?: () => void
  clickable?: boolean
  isOwner?: boolean
  highlighted?: boolean
  noOuterMargin?: boolean
  fillHeight?: boolean
}) {
  const assignee = members.find(m => m.id === task.assigned_user_id)
  const shift = task.shift_id ? shiftOptions.find(s => s.id === task.shift_id) : null
  const priority = task.priority ? PRIORITY_COLORS[task.priority] : null
  const deadlineWarning = task.due_at && task.status !== 'Complete' && (isDueOverdue(task.due_at) || isDueWithinHours(task.due_at, 2))
  const dept = showDept ? departments.find(d => d.id === task.department_id) : null
  const showStack = !!subTaskCount && !expanded
  const hasTopRowBadges = !!(priority && task.priority) || !!dept || !!subTaskCount

  return (
    <div style={{ position: 'relative', marginBottom: noOuterMargin ? 0 : (showStack ? 22 : 14), height: fillHeight ? '100%' : undefined }}>
      {showStack && (
        <>
          <div style={{ position: 'absolute', left: 12, right: 12, bottom: -8, height: 14, background: '#EEF1F5', border: '1px solid #E2E8F0', borderRadius: 10, zIndex: 0 }} />
          <div style={{ position: 'absolute', left: 6, right: 6, bottom: -4, height: 14, background: '#F7F9FB', border: '1px solid #E5E7EB', borderRadius: 10, zIndex: 1 }} />
        </>
      )}
      <div
        onClick={clickable ? onClick : undefined}
        className="task-card"
        style={{
          background: '#FFFFFF',
          border: highlighted ? '1.5px solid #F97316' : '1px solid #E5E7EB',
          borderLeft: highlighted ? '1.5px solid #F97316' : '1px solid #E5E7EB',
          borderRadius: '10px',
          padding: '16px 16px',
          cursor: clickable ? 'pointer' : 'default',
          position: 'relative',
          zIndex: 2,
          height: fillHeight ? '100%' : undefined,
          boxSizing: 'border-box',
          display: fillHeight ? 'flex' : undefined,
          flexDirection: fillHeight ? 'column' : undefined,
          justifyContent: fillHeight ? 'space-between' : undefined,
          boxShadow: highlighted ? '0 0 0 3px rgba(249,115,22,0.16), 0 10px 28px rgba(249,115,22,0.16)' : undefined,
        }}
      >
      {/* Edit pencil: absolutely positioned so it never reserves flow height when there are no badges */}
      {clickable && isOwner && (
        <button
          onClick={e => { e.stopPropagation(); onEdit() }}
          style={{ position: 'absolute', top: 12, right: 12, background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center', color: '#9CA3AF', borderRadius: 6, flexShrink: 0, zIndex: 1 }}
          onMouseEnter={e => { e.currentTarget.style.background = '#E5E7EB'; (e.currentTarget as HTMLButtonElement).style.color = '#F97316' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'none'; (e.currentTarget as HTMLButtonElement).style.color = '#9CA3AF' }}
        >
          <Pencil size={13} />
        </button>
      )}

      {/* Top row: priority / department / sub-task badges */}
      {hasTopRowBadges && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 12, paddingRight: 24 }}>
          {priority && task.priority && (
            <span style={{ fontSize: '0.65rem', fontWeight: 800, padding: '2px 7px', borderRadius: '99px', background: priority.bg, color: priority.text, letterSpacing: '0.01em' }}>
              {task.priority}
            </span>
          )}
          {dept && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.65rem', fontWeight: 700, padding: '2px 7px', borderRadius: '99px', background: deptCardBg(dept.id), color: deptColor(dept.id) }}>
              <span style={{ width: 5, height: 5, borderRadius: '50%', background: deptColor(dept.id), flexShrink: 0 }} />
              {dept.name}
            </span>
          )}
          {!!subTaskCount && (
            <button
              type="button"
              onClick={e => { e.stopPropagation(); onToggleExpand?.() }}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.65rem', fontWeight: 700, padding: '2px 7px', borderRadius: '99px', background: '#F1F5F9', color: '#475569', border: 'none', cursor: 'pointer' }}
            >
              <GitBranch size={10} />
              {subTaskCount}
              <ChevronDown size={10} style={{ transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
            </button>
          )}
        </div>
      )}

      {/* Title */}
      <p style={{ fontWeight: 600, fontSize: '0.875rem', color: '#111827', margin: '0 0 16px', lineHeight: 1.4, paddingRight: !clickable || !isOwner || hasTopRowBadges ? 0 : 24 }}>
        {task.title}
      </p>

      {/* Footer: assignee + deadline time */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        {assignee ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div className="task-card-icon" style={{ width: 18, height: 18, borderRadius: '50%', background: assignee.profile_photo_url ? 'transparent' : '#FFF3E8', border: '1.5px solid #F97316', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden' }}>
              {assignee.profile_photo_url
                ? <img src={assignee.profile_photo_url} alt={assignee.full_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : <UserCog size={10} color="#F97316" strokeWidth={2} />}
            </div>
            <span style={{ fontSize: '0.7rem', color: '#374151', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {assignee.full_name}
            </span>
          </div>
        ) : (
          <span style={{ fontSize: '0.75rem', color: '#CBD5E1', fontStyle: 'italic' }}>No assignee</span>
        )}
        {task.due_at && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
            {deadlineWarning ? <AlertCircle size={11} color="#EF4444" /> : <Clock size={11} color="#9CA3AF" />}
            <span style={{ fontSize: '0.7rem', fontWeight: 600, color: deadlineWarning ? '#EF4444' : '#9CA3AF', whiteSpace: 'nowrap' }}>
              {formatDeadlineDisplay(task.due_at)}
            </span>
          </div>
        )}
      </div>
      </div>
    </div>
  )
}

// ─── Department Info Card ─────────────────────────────────────────────────────


// ─── Page ─────────────────────────────────────────────────────────────────────

export default function OwnerTasksPage() {
  const router = useRouter()

  const [internalUserId, setInternalUserId] = useState('')
  const [companyId,      setCompanyId]      = useState('')
  const [ownerName,      setOwnerName]      = useState('')
  const [userRole,       setUserRole]       = useState('')
  const [companyName,    setCompanyName]    = useState('')
  const [currentPlan,    setCurrentPlan]    = useState('Free')
  const [initialReady,   setInitialReady]   = useState(false)

  const [departments, setDepartments] = useState<Department[]>([])
  const [members,     setMembers]     = useState<Member[]>([])
  const [shiftOptions, setShiftOptions] = useState<ShiftOption[]>([])

  // Department selector
  const [selectedDeptId,  setSelectedDeptId]  = useState('') // '' = All
  const [deptTaskStats,   setDeptTaskStats]    = useState<DeptTaskStats[]>([])
  const [deptManagerMap,  setDeptManagerMap]   = useState<Record<string, string>>({})
  const [allManagers,     setAllManagers]      = useState<ManagerInfo[]>([])

  // Department CRUD modals
  const [editDeptModal,         setEditDeptModal]         = useState<Department | null>(null)
  const [editDeptName,          setEditDeptName]          = useState('')
  const [editDeptLoading,       setEditDeptLoading]       = useState(false)
  const [editDeptError,         setEditDeptError]         = useState('')
  const [deleteDeptModal,       setDeleteDeptModal]       = useState<Department | null>(null)
  const [deleteDeptLoading,     setDeleteDeptLoading]     = useState(false)
  const [deleteDeptError,       setDeleteDeptError]       = useState('')
  const [editManagerModal,      setEditManagerModal]      = useState<Department | null>(null)
  const [editManagerSelectedId, setEditManagerSelectedId] = useState('')
  const [editManagerLoading,    setEditManagerLoading]    = useState(false)
  const [editManagerError,      setEditManagerError]      = useState('')

  const [kanban,        setKanban]        = useState<KanbanGroup | null>(null)
  const [kanbanLoading, setKanbanLoading] = useState(false)
  const [taskDate,      setTaskDate]      = useState(() => formatDateKey(new Date()))
  const [expandedTaskIds, setExpandedTaskIds] = useState<Set<string>>(new Set())
  const toggleTaskExpanded = (id: string) => {
    setExpandedTaskIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  // Cards flagged here play a fade/scale-out transition (see .task-card-removing) before
  // removeTasksFromKanban actually drops them from state — otherwise a deleted card just
  // disappears on the next render with no exit animation.
  const [removingTaskIds, setRemovingTaskIds] = useState<Set<string>>(new Set())
  const TASK_REMOVE_ANIM_MS = 220
  const removeTasksFromKanban = (taskId: string) => {
    setKanban(prev => {
      if (!prev) return prev
      const next = { ...prev } as KanbanGroup
      for (const col of COLUMNS) next[col] = (prev[col] ?? []).filter(t => t.id !== taskId && t.parent_task_id !== taskId)
      return next
    })
    setRemovingTaskIds(prev => { const next = new Set(prev); next.delete(taskId); return next })
  }
  const playDeleteAnimation = (taskId: string) => new Promise<void>(resolve => {
    setRemovingTaskIds(prev => new Set(prev).add(taskId))
    setTimeout(resolve, TASK_REMOVE_ANIM_MS)
  })

  // Task detail/edit panel
  const [selectedTask,  setSelectedTask]  = useState<Task | null>(null)
  const [editLoading,   setEditLoading]   = useState(false)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [panelError,    setPanelError]    = useState('')
  const [editTitle,       setEditTitle]       = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editDeptId,      setEditDeptId]      = useState('')
  const [editStartDate,   setEditStartDate]   = useState('')
  const [editPriority,    setEditPriority]    = useState('')
  const [editDueAt,          setEditDueAt]          = useState('')
  const [editDeadlineTime,   setEditDeadlineTime]   = useState('')
  const [editAssignee,       setEditAssignee]       = useState('')
  const [editShiftId,        setEditShiftId]        = useState('')
  const [editStatus,      setEditStatus]      = useState<Task['status']>('Assigned')
  const [editPercent,     setEditPercent]     = useState(0)
  const [deleteConfirm,   setDeleteConfirm]   = useState(false)
  const [deleteTaskModal, setDeleteTaskModal] = useState<Task | null>(null)
  const [deleteTaskLoading, setDeleteTaskLoading] = useState(false)
  const [deleteTaskError, setDeleteTaskError] = useState('')
  const [subTaskTitle,    setSubTaskTitle]    = useState('')
  const [editSubTaskEnabled, setEditSubTaskEnabled] = useState(false)
  const [editSubTaskCollapsed, setEditSubTaskCollapsed] = useState(false)
  const [editRecurringEnabled, setEditRecurringEnabled] = useState(false)
  const [editRecurringCollapsed, setEditRecurringCollapsed] = useState(false)
  const [taskViewMode,    setTaskViewMode]    = useState(false)
  const [taskActionLoading, setTaskActionLoading] = useState('')
  const [recurrenceRule, setRecurrenceRule] = useState<TaskRecurrenceRule | ''>('')
  const [recurrenceEndDate, setRecurrenceEndDate] = useState('')
  const [editCustomIntervalDays, setEditCustomIntervalDays] = useState(14)
  const [editCustomIntervalTouched, setEditCustomIntervalTouched] = useState(false)
  const [editDeadlineRuleType, setEditDeadlineRuleType] = useState<TaskDeadlineRuleType | ''>('')
  const [editDeadlineRuleTime, setEditDeadlineRuleTime] = useState('')
  const [editDeadlineRuleWeekday, setEditDeadlineRuleWeekday] = useState<number | null>(null)
  const [editDeadlineRuleOffsetAmount, setEditDeadlineRuleOffsetAmount] = useState(1)
  const [editDeadlineRuleOffsetUnit, setEditDeadlineRuleOffsetUnit] = useState<'hours' | 'days'>('days')
  const [editSubTasks, setEditSubTasks] = useState<{ id: string; title: string }[]>([])
  const [reassignmentSuggestion, setReassignmentSuggestion] = useState<TaskReassignmentSuggestion | null>(null)
  const [workloadSuggestion, setWorkloadSuggestion] = useState<TaskWorkloadSuggestion | null>(null)
  const [workloadSuggestions, setWorkloadSuggestions] = useState<TaskWorkloadSuggestion[]>([])
  const [workloadApplyLoadingId, setWorkloadApplyLoadingId] = useState('')
  const [workloadApplyError, setWorkloadApplyError] = useState('')
  const [profileMember, setProfileMember] = useState<Member | null>(null)
  const [stalledAlerts, setStalledAlerts] = useState<StalledTaskAlert[]>([])
  const [workloadInsightOpen, setWorkloadInsightOpen] = useState(false)
  const [highlightedStalledTaskId, setHighlightedStalledTaskId] = useState('')
  const [insightLoading, setInsightLoading] = useState('')
  const [insightError, setInsightError] = useState('')

  // Board view mode (Kanban / Calendar) + animated tab indicator
  const [boardViewMode, setBoardViewMode] = useState<'kanban' | 'calendar'>('kanban')
  const boardTabBarRef = useRef<HTMLDivElement>(null)
  const boardTabButtonRefs = useRef<Record<'kanban' | 'calendar', HTMLButtonElement | null>>({ kanban: null, calendar: null })
  const [boardTabIndicator, setBoardTabIndicator] = useState({ left: 0, width: 0, opacity: 0 })

  useLayoutEffect(() => {
    const container = boardTabBarRef.current
    const activeButton = boardTabButtonRefs.current[boardViewMode]
    if (!container || !activeButton) return
    const containerRect = container.getBoundingClientRect()
    const activeRect = activeButton.getBoundingClientRect()
    setBoardTabIndicator({ left: activeRect.left - containerRect.left, width: activeRect.width, opacity: 1 })
  }, [boardViewMode])

  // Department card order (drag-to-reorder, local-only like the Shifts page)
  const [departmentOrder, setDepartmentOrder] = useState<string[]>([])
  const [draggingDepartmentId, setDraggingDepartmentId] = useState<string | null>(null)
  const [dragOverDepartmentId, setDragOverDepartmentId] = useState<string | null>(null)
  const departmentOrderRef = useRef<string[]>([])

  // New task modal
  const [newTaskModal,    setNewTaskModal]    = useState(false)
  const [newTitle,        setNewTitle]        = useState('')
  const [newDescription,  setNewDescription]  = useState('')
  const [newDeptId,       setNewDeptId]       = useState('')
  const [newAssigneeId,   setNewAssigneeId]   = useState('')
  const [newShiftId,        setNewShiftId]        = useState('')
  const [newStartDate,      setNewStartDate]      = useState('')
  const [newPriority,       setNewPriority]       = useState('')
  const [newDeadlineDate,   setNewDeadlineDate]   = useState('')
  const [newDeadlineTime,   setNewDeadlineTime]   = useState('')
  const [newLoading,      setNewLoading]      = useState(false)
  const [newError,        setNewError]        = useState('')
  const [newTemplateId,   setNewTemplateId]   = useState('')
  const [newSubTaskEnabled, setNewSubTaskEnabled] = useState(false)
  const [newSubTasks,      setNewSubTasks]      = useState<{ id: string; title: string }[]>([])
  const [newSubTaskCollapsed, setNewSubTaskCollapsed] = useState(false)
  const [newSubTaskDraft,  setNewSubTaskDraft]  = useState('')
  const [newRecurringEnabled, setNewRecurringEnabled] = useState(false)
  const [newRecurringCollapsed, setNewRecurringCollapsed] = useState(false)
  const [newRecurrenceRule, setNewRecurrenceRule] = useState<TaskRecurrenceRule | ''>('')
  const [newRecurrenceEndDate, setNewRecurrenceEndDate] = useState('')
  const [newCustomIntervalDays, setNewCustomIntervalDays] = useState(14)
  const [newCustomIntervalTouched, setNewCustomIntervalTouched] = useState(false)
  const [newDeadlineRuleType, setNewDeadlineRuleType] = useState<TaskDeadlineRuleType | ''>('')
  const [newDeadlineRuleTime, setNewDeadlineRuleTime] = useState('')
  const [newDeadlineRuleWeekday, setNewDeadlineRuleWeekday] = useState<number | null>(null)
  const [newDeadlineRuleOffsetAmount, setNewDeadlineRuleOffsetAmount] = useState(1)
  const [newDeadlineRuleOffsetUnit, setNewDeadlineRuleOffsetUnit] = useState<'hours' | 'days'>('days')
  const [draggingSubTaskId, setDraggingSubTaskId] = useState<string | null>(null)
  const [dragOverSubTaskId, setDragOverSubTaskId] = useState<string | null>(null)

  // Fixed-day deadlines only make sense against weekly recurrence — drop the selection if the
  // user switches the recurrence rule away from weekly while it's active.
  useEffect(() => {
    if (newDeadlineRuleType === 'fixed_day' && newRecurrenceRule !== 'weekly') setNewDeadlineRuleType('')
  }, [newRecurrenceRule, newDeadlineRuleType])

  useEffect(() => {
    if (newRecurrenceRule !== 'custom') setNewCustomIntervalTouched(false)
  }, [newRecurrenceRule])

  useEffect(() => {
    if (editDeadlineRuleType === 'fixed_day' && recurrenceRule !== 'weekly') setEditDeadlineRuleType('')
  }, [recurrenceRule, editDeadlineRuleType])

  useEffect(() => {
    if (recurrenceRule !== 'custom') setEditCustomIntervalTouched(false)
  }, [recurrenceRule])

  // AI Assign state (merged breakdown + department/manager/deadline suggestion)
  const [aiModal,          setAiModal]          = useState(false)
  const [aiStep,           setAiStep]           = useState<'input' | 'review'>('input')
  const [aiTitle,          setAiTitle]          = useState('')
  const [aiDescription,    setAiDescription]    = useState('')
  const [aiPriority,       setAiPriority]       = useState('')
  const [aiDueDate,        setAiDueDate]        = useState('')
  const [aiDueTime,        setAiDueTime]        = useState('')
  // Both optional, chosen up front so Generate already knows whether to ask the AI for
  // sub-tasks, and whether to surface the (simple Repeats + Repeat-until) recurring fields.
  const [aiSubTaskEnabled, setAiSubTaskEnabled] = useState(false)
  const [aiRecurringEnabled, setAiRecurringEnabled] = useState(false)
  const [aiRecurrenceRule, setAiRecurrenceRule] = useState<TaskRecurrenceRule | ''>('')
  const [aiRecurrenceEndDate, setAiRecurrenceEndDate] = useState('')
  const [aiLoading,        setAiLoading]        = useState(false)
  const [aiError,          setAiError]          = useState('')
  const [aiSuggestion,     setAiSuggestion]     = useState<AiAssignSuggestion | null>(null)
  const [aiDeptId,         setAiDeptId]         = useState('')
  const [aiManagerId,      setAiManagerId]      = useState('')
  const [aiSubTaskDrafts,  setAiSubTaskDrafts]  = useState<{ title: string; description: string }[]>([])
  const [aiCreateLoading,  setAiCreateLoading]  = useState(false)

  // Task Template management modal
  const [taskTemplates,        setTaskTemplates]        = useState<TaskTemplate[]>([])
  const [templateModalOpen,    setTemplateModalOpen]    = useState(false)
  const [templateFormMode,     setTemplateFormMode]     = useState<'list' | 'create' | 'edit'>('list')
  const [templateFormId,       setTemplateFormId]       = useState('')
  const [templateFormName,     setTemplateFormName]     = useState('')
  const [templateFormTitle,    setTemplateFormTitle]    = useState('')
  const [templateFormDesc,     setTemplateFormDesc]     = useState('')
  const [templateFormPriority, setTemplateFormPriority] = useState('')
  const [templateLoading,      setTemplateLoading]      = useState(false)
  const [templateError,        setTemplateError]        = useState('')
  const [deleteTemplateModal,  setDeleteTemplateModal]  = useState<TaskTemplate | null>(null)
  const [deleteTemplateLoading, setDeleteTemplateLoading] = useState(false)
  const [archiveModalOpen,     setArchiveModalOpen]     = useState(false)
  const [archivedTasks,        setArchivedTasks]        = useState<Task[]>([])
  const [archiveListLoading,   setArchiveListLoading]   = useState(false)
  const [archiveListError,     setArchiveListError]     = useState('')
  const [unarchiveLoadingId,   setUnarchiveLoadingId]   = useState('')
  const [archiveDeleteLoadingId, setArchiveDeleteLoadingId] = useState('')
  const [selectedArchivedTask, setSelectedArchivedTask] = useState<Task | null>(null)
  const [expandedArchivedTaskIds, setExpandedArchivedTaskIds] = useState<Set<string>>(new Set())
  const toggleArchivedTaskExpanded = (id: string) => {
    setExpandedArchivedTaskIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // Toast
  const [taskToast, setTaskToast] = useState('')
  const taskToastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const showTaskToast = useCallback((message: string) => {
    if (taskToastTimerRef.current) clearTimeout(taskToastTimerRef.current)
    setTaskToast(message)
    taskToastTimerRef.current = setTimeout(() => setTaskToast(''), 3000)
  }, [])

  const panelRef = useRef<HTMLDivElement>(null)
  const hasAutoSelectedTaskDateRef = useRef(false)
  const [panelClosing, setPanelClosing] = useState(false)

  const canManageDepartments = userRole === 'Owner' || userRole === 'Partner'

  // ── Header theme ──────────────────────────────────────────────────────────

  // ── Department card order: load saved order, persist on change ────────────

  const deptOrderKey = companyId ? `owner_task_department_order_${companyId}` : null

  useEffect(() => {
    if (!companyId || departments.length === 0) return
    const fallbackOrder = departments.map(d => d.id)
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
    try { localStorage.setItem(deptOrderKey, JSON.stringify(departmentOrder)) } catch {}
  }, [deptOrderKey, departmentOrder])

  useEffect(() => {
    departmentOrderRef.current = departmentOrder
  }, [departmentOrder])

  // ── Mount: resolve session ────────────────────────────────────────────────

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      let userIdResolved = localStorage.getItem('tasking_user_id')
      if (!userIdResolved) {
        const supabase = createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
        const { data: { session } } = await supabase.auth.getSession()
        if (session?.user?.id) { userIdResolved = session.user.id; localStorage.setItem('tasking_user_id', userIdResolved) }
      }
      if (!userIdResolved) { router.replace('/signin'); return }
      if (cancelled) return
      const role = localStorage.getItem('tasking_user_role') || ''
      setUserRole(role)

      fetch(`/api/user/me?user_id=${userIdResolved}`)
        .then(r => r.json())
        .then(d => {
          if (!cancelled && d.success) {
            if (d.user?.full_name) setOwnerName(d.user.full_name)
            if (d.user?.id)        setInternalUserId(d.user.id)
          }
        })
        .catch(() => {})

      const storedCid = localStorage.getItem(`tasking_company_id_${userIdResolved}`)
      const qs = new URLSearchParams({ user_id: userIdResolved })
      if (storedCid) qs.set('company_id', storedCid)

      const res = await fetch(`/api/company/current?${qs}`)
      if (!res.ok) { if (!cancelled) setInitialReady(true); return }
      const data = await res.json()
      if (cancelled || !data.success) { setInitialReady(true); return }

      if (data.company) {
        const cid = data.company.id
        if (!cancelled) {
          setCompanyId(cid)
          setCompanyName(data.company.name)
          setCurrentPlan(data.company.plan ?? 'Free')
          setInitialReady(true)
        }
      } else {
        setInitialReady(true)
      }
    }
    void run()
    return () => { cancelled = true }
  }, [router])

  // ── Fetch departments + members + managers ─────────────────────────────────

  useEffect(() => {
    if (!companyId) return
    Promise.all([
      fetch(`/api/company/departments?company_id=${companyId}`).then(r => r.json()),
      fetch(`/api/team/members?company_id=${companyId}`).then(r => r.json()),
      fetch(`/api/company/managers?company_id=${companyId}`).then(r => r.json()),
      fetch(`/api/task?company_id=${companyId}&dept_stats=true`).then(r => r.json()),
    ]).then(([deptData, memberData, mgrData, statsData]) => {
      if (deptData.success) {
        setDepartments(deptData.departments)
        setDeptColorOverrides(deptData.departments)
      }
      if (memberData.success) setMembers(memberData.members)
      if (mgrData.success) {
        setAllManagers(mgrData.managers)
        const map: Record<string, string> = {}
        for (const mgr of mgrData.managers as ManagerInfo[]) {
          if (mgr.department_id) {
            map[mgr.department_id] = map[mgr.department_id]
              ? `${map[mgr.department_id]}, ${mgr.full_name}`
              : mgr.full_name
          }
        }
        setDeptManagerMap(map)
      }
      if (statsData.success) setDeptTaskStats(statsData.dept_stats ?? [])
    }).catch(() => {})
  }, [companyId])

  // ── Fetch task templates ────────────────────────────────────────────────────

  const fetchTaskTemplates = useCallback(async (cid: string) => {
    if (!cid) return
    const res = await fetch(`/api/task-template?company_id=${cid}`)
    const data = await res.json()
    setTaskTemplates(data.success ? data.templates ?? [] : [])
  }, [])

  useEffect(() => {
    if (!companyId) return
    fetchTaskTemplates(companyId)
  }, [companyId, fetchTaskTemplates])

  // ── Fetch kanban ───────────────────────────────────────────────────────────

  useEffect(() => {
    if (!companyId) return
    const today = new Date()
    const dateFrom = formatDateKey(addDays(today, -30))
    const dateTo = formatDateKey(addDays(today, 14))

    fetch(`/api/shift?company_id=${companyId}&date_from=${dateFrom}&date_to=${dateTo}`)
      .then(r => r.json())
      .then(data => {
        if (!data.success) return
        const options: ShiftOption[] = (data.rows ?? []).flatMap((row: TimelineRow) =>
          row.shifts.map(shift => ({
            ...shift,
            assignee_name: row.full_name,
            user_id: row.user_id,
          })),
        )
        setShiftOptions(options)
      })
      .catch(() => setShiftOptions([]))
  }, [companyId])

  // ── Auto-select shift for the currently viewed date when assignee changes ──
  // Anchored to taskDate (the date the kanban is showing), not "today" — otherwise
  // a task can silently land on a future shift date and appear to vanish once the
  // user navigates away and the view resets to today.

  useEffect(() => {
    if (!newAssigneeId || !newTaskModal) { return }
    const shiftOnViewedDate = shiftOptions
      .filter(s => s.user_id === newAssigneeId && s.shift_date === taskDate)
      .sort((a, b) => a.start_time.localeCompare(b.start_time))[0] ?? null
    if (shiftOnViewedDate) {
      setNewShiftId(shiftOnViewedDate.id)
    } else {
      setNewShiftId('')
    }
  }, [newAssigneeId, newTaskModal, shiftOptions, taskDate])

  const fetchKanban = useCallback(async (cid: string, silent = false) => {
    if (!cid) return
    if (!silent) setKanbanLoading(true)
    try {
      const res = await fetch(`/api/task?company_id=${cid}&kanban=true`)
      const data = await res.json()
      if (data.success) setKanban(data.groups)
    } catch {}
    finally { if (!silent) setKanbanLoading(false) }
  }, [])

  useEffect(() => {
    if (!companyId) return
    void Promise.resolve().then(() => fetchKanban(companyId))
  }, [companyId, fetchKanban])

  // Real-time subscription — refresh kanban whenever any task in this company changes
  useEffect(() => {
    if (!companyId) return
    const supabase = createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
    const channel = supabase
      .channel(`tasks-realtime-${companyId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks', filter: `company_id=eq.${companyId}` },
        () => { void fetchKanban(companyId, true) }
      )
      .subscribe()
    return () => { void supabase.removeChannel(channel) }
  }, [companyId, fetchKanban])

  // ── Open task panel ────────────────────────────────────────────────────────

  const openTask = (task: Task, viewOnly = false) => {
    const existingSubTasks = kanban
      ? COLUMNS.flatMap(col => kanban[col])
          .filter(row => row.parent_task_id === task.id)
          .sort((a, b) => (a.sequence_order ?? 0) - (b.sequence_order ?? 0))
          .map(row => ({ id: row.id, title: row.title }))
      : []
    // Recurrence isn't stored as a rule on the task row — it's only expressed as the actual
    // generated sibling occurrences sharing recurrence_group_id. Re-derive the rule/end date
    // (and the deadline rule, from how due_at moves relative to task_date) from those siblings
    // so re-opening a recurring task shows what was configured, instead of resetting to blank.
    let inferredRecurrenceRule: TaskRecurrenceRule | '' = ''
    let inferredRecurrenceEndDate = ''
    let inferredDeadlineRuleType: TaskDeadlineRuleType | '' = ''
    let inferredDeadlineRuleTime = ''
    let inferredDeadlineRuleWeekday: number | null = null
    let inferredDeadlineRuleOffsetAmount = 1
    let inferredDeadlineRuleOffsetUnit: 'hours' | 'days' = 'days'
    if (task.recurrence_group_id && kanban) {
      const groupOccurrences = COLUMNS.flatMap(col => kanban[col])
        .filter(row => !row.parent_task_id && row.recurrence_group_id === task.recurrence_group_id)
      const groupDates = Array.from(new Set(groupOccurrences.map(row => kanbanDateKey(row)))).sort()
      if (groupDates.length >= 2) {
        const intervalDays = Math.round(
          (new Date(`${groupDates[1]}T00:00:00`).getTime() - new Date(`${groupDates[0]}T00:00:00`).getTime()) / 86400000
        )
        inferredRecurrenceRule = intervalDays === 1 ? 'daily' : intervalDays === 7 ? 'weekly' : 'custom'
        if (inferredRecurrenceRule === 'custom') setEditCustomIntervalDays(intervalDays)
        inferredRecurrenceEndDate = groupDates[groupDates.length - 1]
      }
      // Infer the deadline rule from how due_at relates to task_date on two occurrences —
      // same gap every time means it was generated by one of the three rule types.
      const datedOccurrences = groupOccurrences
        .filter(row => row.due_at)
        .map(row => ({ taskDate: kanbanDateKey(row), due: new Date(row.due_at!) }))
        .sort((a, b) => a.taskDate.localeCompare(b.taskDate))
      if (datedOccurrences.length >= 2) {
        const [a, b] = datedOccurrences
        const dueDateKey = (d: Date) => formatDateKey(d)
        const timeKey = (d: Date) => d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
        if (dueDateKey(a.due) === a.taskDate && dueDateKey(b.due) === b.taskDate && timeKey(a.due) === timeKey(b.due)) {
          inferredDeadlineRuleType = 'same_day'
          inferredDeadlineRuleTime = timeKey(a.due)
        } else if (inferredRecurrenceRule === 'weekly' && a.due.getDay() === b.due.getDay() && timeKey(a.due) === timeKey(b.due)) {
          inferredDeadlineRuleType = 'fixed_day'
          inferredDeadlineRuleTime = timeKey(a.due)
          inferredDeadlineRuleWeekday = a.due.getDay()
        } else {
          const offsetMs = a.due.getTime() - new Date(`${a.taskDate}T00:00:00`).getTime()
          const offsetHours = Math.round(offsetMs / 3600000)
          if (offsetHours % 24 === 0 && offsetHours / 24 === Math.round((b.due.getTime() - new Date(`${b.taskDate}T00:00:00`).getTime()) / 3600000 / 24)) {
            inferredDeadlineRuleType = 'relative'
            inferredDeadlineRuleOffsetAmount = offsetHours / 24
            inferredDeadlineRuleOffsetUnit = 'days'
          } else if (offsetHours === Math.round((b.due.getTime() - new Date(`${b.taskDate}T00:00:00`).getTime()) / 3600000)) {
            inferredDeadlineRuleType = 'relative'
            inferredDeadlineRuleOffsetAmount = Math.max(1, offsetHours)
            inferredDeadlineRuleOffsetUnit = 'hours'
          }
        }
      }
    }
    // Only the user who assigned this task may edit it — everyone else always gets the
    // read-only Details view, regardless of which entry point (pencil, calendar bar, etc.) was used.
    const isTaskOwner = !!internalUserId && task.assigned_by === internalUserId
    setTaskViewMode(viewOnly || !isTaskOwner)
    setSelectedTask(task)
    setEditTitle(task.title)
    setEditDescription(task.description ?? '')
    setEditDeptId(task.department_id)
    setEditStartDate(kanbanDateKey(task))
    setEditPriority(task.priority ?? '')
    setEditDueAt(task.due_at ? formatDateKey(new Date(task.due_at)) : '')
    setEditDeadlineTime(task.due_at ? new Date(task.due_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '')
    setEditAssignee(task.assigned_user_id ?? '')
    setEditShiftId(task.shift_id ?? '')
    setEditStatus(task.status)
    setEditPercent(task.percentage_complete)
    setPanelError('')
    setDeleteConfirm(false)
    setSubTaskTitle('')
    setTaskActionLoading('')
    setRecurrenceRule(inferredRecurrenceRule)
    setRecurrenceEndDate(inferredRecurrenceEndDate)
    if (inferredRecurrenceRule !== 'custom') setEditCustomIntervalDays(14)
    setEditCustomIntervalTouched(inferredRecurrenceRule === 'custom')
    setEditDeadlineRuleType(inferredDeadlineRuleType)
    setEditDeadlineRuleTime(inferredDeadlineRuleTime)
    setEditDeadlineRuleWeekday(inferredDeadlineRuleWeekday)
    setEditDeadlineRuleOffsetAmount(inferredDeadlineRuleOffsetAmount)
    setEditDeadlineRuleOffsetUnit(inferredDeadlineRuleOffsetUnit)
    setEditSubTasks(existingSubTasks)
    setEditSubTaskEnabled(existingSubTasks.length > 0)
    setEditSubTaskCollapsed(true)
    setEditRecurringEnabled(!!task.recurrence_group_id)
    setEditRecurringCollapsed(true)
    setReassignmentSuggestion(null)
  }

  const closePanel = () => { setSelectedTask(null); setDeleteConfirm(false); setPanelError(''); setSubTaskTitle('') }

  // ── Save task ─────────────────────────────────────────────────────────────

  const handleSaveTask = async () => {
    if (!selectedTask || !editTitle.trim() || !editDeptId || !editStartDate || !editPriority || !editDueAt || !editDeadlineTime) {
      setPanelError('Title, department, start date, priority, and deadline are required')
      return
    }
    setEditLoading(true); setPanelError('')
    try {
      const due_at = new Date(`${editDueAt}T${editDeadlineTime}:00`).toISOString()
      const payload = {
        id: selectedTask.id,
        assigned_by: internalUserId || undefined,
        company_id: selectedTask.company_id,
        department_id: editDeptId,
        title: editTitle.trim(),
        description: editDescription || null,
        priority: editPriority || null,
        due_at,
        task_date: editStartDate,
        assigned_user_id: editAssignee || null,
        shift_id: editShiftId || null,
        status: editStatus,
        percentage_complete: editPercent,
      }
      const res = await fetch('/api/task', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.message)

      // Sub-tasks were edited as a local draft (editSubTasks) — diff against the server snapshot
      // taken when the panel opened (selectedSubTasksUnordered) and sync now, in one batch.
      const original = selectedSubTasksUnordered
      const removedIds = original.filter(t => !editSubTasks.some(s => s.id === t.id)).map(t => t.id)
      const renamed = editSubTasks.filter(s => {
        const match = original.find(t => t.id === s.id)
        return match && match.title !== s.title
      })
      const added = editSubTasks.filter(s => !original.some(t => t.id === s.id))

      for (const id of removedIds) {
        const delRes = await fetch(`/api/task?id=${id}&assigned_by=${encodeURIComponent(internalUserId)}`, { method: 'DELETE' })
        const delData = await delRes.json()
        if (!delData.success) throw new Error(delData.message)
      }
      for (const s of renamed) {
        const original_ = original.find(t => t.id === s.id)!
        const renameRes = await fetch('/api/task', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: s.id,
            assigned_by: internalUserId || undefined,
            company_id: original_.company_id,
            department_id: original_.department_id,
            title: s.title,
            description: original_.description,
            priority: original_.priority,
            due_at: original_.due_at,
            task_date: original_.task_date,
            assigned_user_id: original_.assigned_user_id,
            shift_id: original_.shift_id,
            status: original_.status,
            percentage_complete: original_.percentage_complete,
          }),
        })
        const renameData = await renameRes.json()
        if (!renameData.success) throw new Error(renameData.message)
      }
      const createdIdByDraftId = new Map<string, string>()
      for (const s of added) {
        const createRes = await fetch('/api/task', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            company_id: selectedTask.company_id,
            department_id: editDeptId,
            shift_id: editShiftId || null,
            parent_task_id: selectedTask.id,
            title: s.title,
            assigned_user_id: editAssignee || null,
            assigned_by: internalUserId || null,
            status: 'Assigned',
            percentage_complete: 0,
            task_date: editStartDate,
            // priority/due_at are intentionally omitted — the service always inherits them from
            // the parent task whenever parent_task_id is set.
          }),
        })
        const createData = await createRes.json()
        if (!createData.success) throw new Error(createData.message)
        createdIdByDraftId.set(s.id, createData.task.id)
      }
      if (editSubTasks.length > 0) {
        const finalOrderIds = editSubTasks.map(s => createdIdByDraftId.get(s.id) ?? s.id)
        const reorderRes = await fetch('/api/task', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'reorder_subtasks', id: selectedTask.id, sub_task_ids: finalOrderIds, assigned_by: internalUserId || undefined }),
        })
        const reorderData = await reorderRes.json()
        if (!reorderData.success) throw new Error(reorderData.message)
      }

      let recurringCreatedCount = 0
      if (editRecurringEnabled && recurrenceRule && recurrenceEndDate) {
        const deadlineRule = editDeadlineRuleType === 'same_day'
          ? { type: 'same_day' as const, time: editDeadlineRuleTime }
          : editDeadlineRuleType === 'fixed_day'
            ? { type: 'fixed_day' as const, time: editDeadlineRuleTime, weekday: editDeadlineRuleWeekday! }
            : { type: 'relative' as const, offset_amount: editDeadlineRuleOffsetAmount, offset_unit: editDeadlineRuleOffsetUnit }
        const recurringRes = await fetch('/api/task', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'recurring',
            id: selectedTask.id,
            recurrence_rule: recurrenceRule,
            recurrence_end_date: recurrenceEndDate,
            custom_interval_days: recurrenceRule === 'custom' ? editCustomIntervalDays : undefined,
            deadline_rule: deadlineRule,
            assigned_by: internalUserId || undefined,
          }),
        })
        const recurringData = await recurringRes.json()
        if (!recurringData.success) throw new Error(recurringData.message)
        recurringCreatedCount = recurringData.tasks?.length ?? 0
      }

      await fetchKanban(companyId)
      await refreshAllTaskInsights()
      setTaskDate(editStartDate)
      closePanel()
      showTaskToast(recurringCreatedCount > 0
        ? `Task updated and ${recurringCreatedCount} recurring task${recurringCreatedCount === 1 ? '' : 's'} created.`
        : 'Task updated successfully.')
    } catch (err) { setPanelError(err instanceof Error ? err.message : 'Failed to save') }
    finally { setEditLoading(false) }
  }

  // ── Delete task ────────────────────────────────────────────────────────────

  const handleDeleteTask = async () => {
    if (!selectedTask) return
    setDeleteLoading(true)
    const taskId = selectedTask.id
    // Play the card's exit transition and the modal's close transition together, then apply
    // the optimistic removal once both have actually finished (the backend cascades sub-tasks too).
    await Promise.all([playDeleteAnimation(taskId), new Promise<void>(resolve => {
      setPanelClosing(true)
      setTimeout(() => { closePanel(); setPanelClosing(false); resolve() }, 220)
    })])
    removeTasksFromKanban(taskId)
    try {
      const res = await fetch(`/api/task?id=${taskId}&assigned_by=${encodeURIComponent(internalUserId)}`, { method: 'DELETE' })
      const data = await res.json()
      if (!data.success) { fetchKanban(companyId, true); void refreshAllTaskInsights() }
      else { await refreshAllTaskInsights(); showTaskToast('Task deleted successfully.') }
    } catch { fetchKanban(companyId, true); void refreshAllTaskInsights() }
    finally { setDeleteLoading(false) }
  }

  const handleDeleteTaskDirect = async () => {
    if (!deleteTaskModal) return
    setDeleteTaskLoading(true); setDeleteTaskError('')
    const taskId = deleteTaskModal.id
    // Deleting the original of a recurring series takes the whole series with it on the server
    // (taskService.deleteTask) — mirror that here so the board doesn't go stale until a refetch.
    const isRecurrenceOriginal = !!deleteTaskModal.recurrence_group_id && deleteTaskModal.source_task_id === null
    const recurrenceGroupId = deleteTaskModal.recurrence_group_id
    setKanban(prev => {
      if (!prev) return prev
      const allTasks = COLUMNS.flatMap(col => prev[col] ?? [])
      const rootIdsToRemove = new Set(
        isRecurrenceOriginal && recurrenceGroupId
          ? allTasks.filter(t => t.recurrence_group_id === recurrenceGroupId).map(t => t.id)
          : [taskId]
      )
      const next = { ...prev } as KanbanGroup
      for (const col of COLUMNS) {
        next[col] = (prev[col] ?? []).filter(t => !rootIdsToRemove.has(t.id) && !(t.parent_task_id && rootIdsToRemove.has(t.parent_task_id)))
      }
      return next
    })
    setDeleteTaskModal(null)
    try {
      const res = await fetch(`/api/task?id=${taskId}&assigned_by=${encodeURIComponent(internalUserId)}`, { method: 'DELETE' })
      const data = await res.json()
      if (!data.success) { fetchKanban(companyId, true); setDeleteTaskError(data.message ?? 'Failed to delete') }
      else { await refreshAllTaskInsights(); showTaskToast('Task deleted successfully.') }
    } catch { fetchKanban(companyId, true); void refreshAllTaskInsights() }
    finally { setDeleteTaskLoading(false) }
  }

  const handleDuplicateTask = async () => {
    if (!selectedTask) return
    setTaskActionLoading('duplicate'); setPanelError('')
    try {
      const res = await fetch('/api/task', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'duplicate', id: selectedTask.id, assigned_by: internalUserId || undefined }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.message)
      await fetchKanban(companyId)
      await refreshAllTaskInsights()
      closePanel()
      showTaskToast('Task duplicated.')
    } catch (err) { setPanelError(err instanceof Error ? err.message : 'Failed to duplicate task') }
    finally { setTaskActionLoading('') }
  }

  const handleArchiveTask = async () => {
    if (!selectedTask) return
    setTaskActionLoading('archive'); setPanelError('')
    try {
      const res = await fetch('/api/task', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'archive', id: selectedTask.id, assigned_by: internalUserId || undefined }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.message)
      await fetchKanban(companyId)
      await refreshAllTaskInsights()
      closePanel()
      showTaskToast('Task archived.')
    } catch (err) { setPanelError(err instanceof Error ? err.message : 'Failed to archive task') }
    finally { setTaskActionLoading('') }
  }

  const handleApplyWorkloadSuggestion = async (suggestion: TaskWorkloadSuggestion) => {
    if (!suggestion.suggested_task_id || !suggestion.recommended_user_id) return
    setWorkloadApplyLoadingId(suggestion.suggested_task_id); setWorkloadApplyError('')
    try {
      const res = await fetch('/api/task', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: suggestion.suggested_task_id,
          assigned_user_id: suggestion.recommended_user_id,
          assigned_by: internalUserId || undefined,
        }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.message)
      await fetchKanban(companyId)
      await refreshAllTaskInsights()
      setWorkloadInsightOpen(false)
      showTaskToast('Task reassigned.')
    } catch (err) {
      setWorkloadApplyError(err instanceof Error ? err.message : 'Failed to reassign task')
    } finally {
      setWorkloadApplyLoadingId('')
    }
  }

  const handleUnarchiveTask = async (taskId: string) => {
    setUnarchiveLoadingId(taskId)
    try {
      const res = await fetch('/api/task', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'unarchive', id: taskId, assigned_by: internalUserId || undefined }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.message)
      setArchivedTasks(prev => prev.filter(t => t.id !== taskId))
      setSelectedArchivedTask(prev => prev?.id === taskId ? null : prev)
      await fetchKanban(companyId)
      await refreshAllTaskInsights()
      showTaskToast('Task unarchived.')
    } catch (err) {
      setArchiveListError(err instanceof Error ? err.message : 'Failed to unarchive task')
    } finally {
      setUnarchiveLoadingId('')
    }
  }

  const handleDeleteArchivedTask = async (taskId: string) => {
    setArchiveDeleteLoadingId(taskId)
    setArchiveListError('')
    try {
      const res = await fetch(`/api/task?id=${taskId}&assigned_by=${encodeURIComponent(internalUserId)}`, { method: 'DELETE' })
      const data = await res.json()
      if (!data.success) throw new Error(data.message)
      setArchivedTasks(prev => prev.filter(t => t.id !== taskId))
      setSelectedArchivedTask(prev => prev?.id === taskId ? null : prev)
      await refreshAllTaskInsights()
      showTaskToast('Task deleted successfully.')
    } catch (err) {
      setArchiveListError(err instanceof Error ? err.message : 'Failed to delete task')
    } finally {
      setArchiveDeleteLoadingId('')
    }
  }

  // UC28 Set Task Dependencies — drag-reorder of the panel's sub-tasks; saves immediately on drop.
  // Sub-task add/remove/rename/reorder are purely local drafts while the Edit Task panel is
  // open — mirrors the New Task modal's newSubTasks pattern — and only sync to the server
  // (create/delete/rename/reorder calls) when the user clicks Save Changes, see handleSaveTask.
  const handleReorderSubTasks = (orderedIds: string[]) => {
    setEditSubTasks(prev => orderedIds.map(id => prev.find(s => s.id === id)).filter((s): s is { id: string; title: string } => !!s))
  }

  const handleRenameSubTask = (subTaskId: string, title: string) => {
    if (!title.trim()) return
    setEditSubTasks(prev => prev.map(s => s.id === subTaskId ? { ...s, title: title.trim() } : s))
  }

  const handleRemoveSubTask = (subTaskId: string) => {
    setEditSubTasks(prev => prev.filter(s => s.id !== subTaskId))
  }

  const handleFetchReassignmentSuggestion = async () => {
    if (!selectedTask || !companyId) return
    setTaskActionLoading('reassignment'); setPanelError('')
    try {
      const res = await fetch(`/api/task?company_id=${companyId}&suggestion=reassignment&task_id=${selectedTask.id}`)
      const data = await res.json()
      if (!data.success) throw new Error(data.message)
      setReassignmentSuggestion(data.suggestion)
    } catch (err) { setPanelError(err instanceof Error ? err.message : 'Failed to fetch reassignment suggestion') }
    finally { setTaskActionLoading('') }
  }

  const handleApplyReassignment = async () => {
    if (!selectedTask || !reassignmentSuggestion?.recommended_assignee_id) return
    setEditAssignee(reassignmentSuggestion.recommended_assignee_id)
    setPanelError('')
    showTaskToast('Suggested assignee selected. Save changes to apply.')
  }

  const refreshTaskInsights = useCallback(async (kind: 'workload' | 'stalled') => {
    if (!companyId) return
    setInsightLoading(kind); setInsightError('')
    try {
      const deptParam = selectedDeptId ? `&department_id=${selectedDeptId}` : ''
      const query = kind === 'workload'
        ? `/api/task?company_id=${companyId}&suggestion=workload`
        : `/api/task?company_id=${companyId}&suggestion=stalled${deptParam}`
      const res = await fetch(query)
      const data = await res.json()
      if (!data.success) throw new Error(data.message)
      if (kind === 'workload') {
        const suggestions = (data.suggestions ?? []).filter((item: TaskWorkloadSuggestion) => item.type === 'rebalance')
        setWorkloadSuggestions(suggestions)
        setWorkloadSuggestion(suggestions[0] ?? data.suggestion)
        if (suggestions.length === 0) setWorkloadInsightOpen(false)
      } else {
        const alerts = data.alerts ?? []
        setStalledAlerts(alerts)
        if (alerts.length === 0) setHighlightedStalledTaskId('')
      }
    } catch (err) { setInsightError(err instanceof Error ? err.message : 'Failed to refresh task insight') }
    finally { setInsightLoading('') }
  }, [companyId, selectedDeptId])

  const refreshAllTaskInsights = useCallback(async () => {
    await refreshTaskInsights('workload')
    await refreshTaskInsights('stalled')
  }, [refreshTaskInsights])

  // ── Create task ────────────────────────────────────────────────────────────

  const highlightFirstStalledTask = useCallback(() => {
    const alert = stalledAlerts[0]
    if (!alert) return
    if (highlightedStalledTaskId === alert.task_id) {
      setHighlightedStalledTaskId('')
      return
    }
    setHighlightedStalledTaskId(alert.task_id)
    setBoardViewMode('kanban')

    const task = kanban
      ? COLUMNS.flatMap(col => kanban[col] ?? []).find(row => row.id === alert.task_id)
      : null
    if (!task) return
    setSelectedDeptId(task.department_id)
    setTaskDate(kanbanDateKey(task))
  }, [highlightedStalledTaskId, kanban, stalledAlerts])

  useEffect(() => {
    if (!companyId) return
    void refreshTaskInsights('workload')
    void refreshTaskInsights('stalled')
  }, [companyId, selectedDeptId, refreshTaskInsights])

  const handleCreateSubTask = () => {
    if (!subTaskTitle.trim()) return
    setEditSubTasks(prev => [...prev, { id: crypto.randomUUID(), title: subTaskTitle.trim() }])
    setSubTaskTitle('')
    setEditSubTaskEnabled(true)
  }

  const handleCreateTask = async () => {
    if (!newTitle.trim() || !newDeptId || !newPriority || !newStartDate) { setNewError('Title, department, priority, and start date are required'); return }
    if (!newRecurringEnabled && (!newDeadlineDate || !newDeadlineTime)) { setNewError('Deadline is required'); return }
    if (newRecurringEnabled && !newRecurrenceRule) { setNewError('Choose how often this task repeats'); return }
    if (newRecurringEnabled && !newRecurrenceEndDate) { setNewError('Repeat until date is required for recurring tasks'); return }
    if (newRecurringEnabled && newRecurrenceEndDate <= newStartDate) { setNewError('Repeat until date must be after the start date'); return }
    if (newRecurringEnabled && newRecurrenceRule === 'custom' && newCustomIntervalDays < 1) { setNewError('Repeat every days must be at least 1'); return }
    if (newRecurringEnabled && !newDeadlineRuleType) { setNewError('Choose a deadline rule for the recurring task'); return }
    if (newRecurringEnabled && (newDeadlineRuleType === 'same_day' || newDeadlineRuleType === 'fixed_day') && !newDeadlineRuleTime) { setNewError('Deadline time is required'); return }
    if (newRecurringEnabled && newDeadlineRuleType === 'fixed_day' && newDeadlineRuleWeekday === null) { setNewError('Choose a deadline weekday'); return }
    if (newRecurringEnabled && newDeadlineRuleType === 'relative' && newDeadlineRuleOffsetAmount < 1) { setNewError('Deadline offset must be at least 1'); return }
    setNewLoading(true); setNewError('')
    try {
      const input: Partial<TaskInput> & { company_id: string; department_id: string; title: string; sub_tasks?: { title: string }[] } = {
        company_id: companyId,
        department_id: newDeptId,
        title: newTitle.trim(),
        description: newDescription || null,
        assigned_user_id: newAssigneeId || null,
        assigned_by: internalUserId || null,
        shift_id: newShiftId || null,
        priority: newPriority || null,
        due_at: newRecurringEnabled ? null : new Date(`${newDeadlineDate}T${newDeadlineTime}:00`).toISOString(),
        task_date: newStartDate,
        status: 'Assigned',
        percentage_complete: 0,
        ...(newSubTaskEnabled && newSubTasks.length > 0 ? { sub_tasks: newSubTasks.map(s => ({ title: s.title })) } : {}),
      }
      const res = await fetch('/api/task', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.message)
      if (newRecurringEnabled) {
        const taskId = data.task?.id
        if (!taskId) throw new Error('Task created, but recurring setup could not find the new task')
        const deadlineRule = newDeadlineRuleType === 'same_day'
          ? { type: 'same_day' as const, time: newDeadlineRuleTime }
          : newDeadlineRuleType === 'fixed_day'
            ? { type: 'fixed_day' as const, time: newDeadlineRuleTime, weekday: newDeadlineRuleWeekday! }
            : { type: 'relative' as const, offset_amount: newDeadlineRuleOffsetAmount, offset_unit: newDeadlineRuleOffsetUnit }
        const recurringRes = await fetch('/api/task', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'recurring',
            id: taskId,
            recurrence_rule: newRecurrenceRule,
            recurrence_end_date: newRecurrenceEndDate,
            custom_interval_days: newRecurrenceRule === 'custom' ? newCustomIntervalDays : undefined,
            assigned_by: internalUserId || undefined,
            deadline_rule: deadlineRule,
          }),
        })
        const recurringData = await recurringRes.json()
        if (!recurringData.success) throw new Error(recurringData.message)
      }
      setNewTaskModal(false)
      setNewTitle(''); setNewDescription(''); setNewDeptId(''); setNewAssigneeId(''); setNewShiftId(''); setNewStartDate(''); setNewPriority(''); setNewDeadlineDate(''); setNewDeadlineTime(''); setNewTemplateId('')
      setNewSubTaskEnabled(false); setNewSubTasks([]); setNewSubTaskDraft(''); setNewSubTaskCollapsed(false)
      setNewRecurringEnabled(false); setNewRecurringCollapsed(false); setNewRecurrenceRule(''); setNewRecurrenceEndDate(''); setNewCustomIntervalDays(14); setNewCustomIntervalTouched(false)
      setNewDeadlineRuleType(''); setNewDeadlineRuleTime(''); setNewDeadlineRuleWeekday(null); setNewDeadlineRuleOffsetAmount(1); setNewDeadlineRuleOffsetUnit('days')
      setTaskDate(taskDate)
      await fetchKanban(companyId)
      await refreshAllTaskInsights()
      showTaskToast(newRecurringEnabled ? 'Recurring task created successfully.' : 'Task created successfully.')
    } catch (err) { setNewError(err instanceof Error ? err.message : 'Failed to create task') }
    finally { setNewLoading(false) }
  }

  const openAiAssign = () => {
    setAiModal(true)
    setAiStep('input')
    setAiTitle('')
    setAiDescription('')
    setAiPriority('')
    setAiDueDate('')
    setAiDueTime('')
    setAiSubTaskEnabled(false)
    setAiRecurringEnabled(false)
    setAiRecurrenceRule('')
    setAiRecurrenceEndDate('')
    setAiSuggestion(null)
    setAiDeptId(selectedDeptId || '')
    setAiManagerId('')
    setAiSubTaskDrafts([])
    setAiError('')
  }

  // Open new task modal pre-filled with dept + assignee.
  // Kanban tab: pre-fill with the selected day, clamped to today (a task can't start in the past).
  // Calendar tab shows a whole week, not one day, so the user must pick the start date themselves — leave it blank.
  const openNewTaskFor = (memberId: string, deptId: string) => {
    setNewDeptId(deptId)
    setNewAssigneeId(memberId)
    setNewShiftId('')
    setNewStartDate(boardViewMode === 'kanban' && taskDate > todayTaskDate ? taskDate : todayTaskDate)
    setNewTitle(''); setNewDescription(''); setNewPriority(''); setNewDeadlineDate(''); setNewDeadlineTime(''); setNewError(''); setNewTemplateId('')
    setNewSubTaskEnabled(false); setNewSubTasks([]); setNewSubTaskDraft(''); setNewSubTaskCollapsed(false)
    setNewRecurringEnabled(false); setNewRecurringCollapsed(false); setNewRecurrenceRule(''); setNewRecurrenceEndDate(''); setNewCustomIntervalDays(14); setNewCustomIntervalTouched(false)
    setNewDeadlineRuleType(''); setNewDeadlineRuleTime(''); setNewDeadlineRuleWeekday(null); setNewDeadlineRuleOffsetAmount(1); setNewDeadlineRuleOffsetUnit('days')
    setNewTaskModal(true)
  }

  // ── Task Template CRUD ──────────────────────────────────────────────────────

  const openCreateTemplate = () => {
    setTemplateFormMode('create')
    setTemplateFormId('')
    setTemplateFormName('')
    setTemplateFormTitle('')
    setTemplateFormDesc('')
    setTemplateFormPriority('')
    setTemplateError('')
  }

  const openArchiveModal = async () => {
    if (!companyId) return
    setArchiveModalOpen(true)
    setArchiveListLoading(true)
    setArchiveListError('')
    setSelectedArchivedTask(null)
    try {
      const res = await fetch(`/api/task?company_id=${companyId}&archived=true`)
      const data = await res.json()
      if (!data.success) throw new Error(data.message)
      const tasks = data.tasks ?? []
      setArchivedTasks(tasks)
      setSelectedArchivedTask(null)
    } catch (err) {
      setArchiveListError(err instanceof Error ? err.message : 'Failed to load archived tasks')
      setArchivedTasks([])
      setSelectedArchivedTask(null)
    } finally {
      setArchiveListLoading(false)
    }
  }

  const openEditTemplate = (template: TaskTemplate) => {
    setTemplateFormMode('edit')
    setTemplateFormId(template.id)
    setTemplateFormName(template.name)
    setTemplateFormTitle(template.title)
    setTemplateFormDesc(template.description ?? '')
    setTemplateFormPriority(template.priority ?? '')
    setTemplateError('')
  }

  const handleSaveTemplate = async () => {
    if (!templateFormName.trim() || !templateFormTitle.trim()) {
      setTemplateError('Name and task title are required.')
      return
    }
    setTemplateLoading(true)
    setTemplateError('')
    try {
      const isEdit = templateFormMode === 'edit'
      const res = await fetch(isEdit ? `/api/task-template/${templateFormId}` : '/api/task-template', {
        method: isEdit ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(isEdit ? {
          name: templateFormName.trim(),
          title: templateFormTitle.trim(),
          description: templateFormDesc.trim() || null,
          priority: templateFormPriority || null,
        } : {
          company_id: companyId,
          name: templateFormName.trim(),
          title: templateFormTitle.trim(),
          description: templateFormDesc.trim() || null,
          priority: templateFormPriority || null,
          created_by: internalUserId || undefined,
        }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.message || 'Failed to save template')
      await fetchTaskTemplates(companyId)
      setTemplateFormMode('list')
      showTaskToast(isEdit ? 'Template updated.' : 'Template created.')
    } catch (err) {
      setTemplateError(err instanceof Error ? err.message : 'Failed to save template')
    } finally {
      setTemplateLoading(false)
    }
  }

  const handleDeleteTemplate = async () => {
    if (!deleteTemplateModal) return
    setDeleteTemplateLoading(true)
    try {
      const res = await fetch(`/api/task-template/${deleteTemplateModal.id}`, { method: 'DELETE' })
      const data = await res.json()
      if (!data.success) throw new Error(data.message || 'Failed to delete template')
      await fetchTaskTemplates(companyId)
      setDeleteTemplateModal(null)
      showTaskToast('Template deleted.')
    } catch (err) {
      setTemplateError(err instanceof Error ? err.message : 'Failed to delete template')
    } finally {
      setDeleteTemplateLoading(false)
    }
  }

  // ── Department CRUD ────────────────────────────────────────────────────────

  const handleEditDept = async () => {
    if (!editDeptModal || !editDeptName.trim()) return
    setEditDeptLoading(true); setEditDeptError('')
    try {
      const res = await fetch('/api/company/update-department', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ department_id: editDeptModal.id, name: editDeptName.trim() }) })
      const data = await res.json()
      if (!data.success) throw new Error(data.message)
      setEditDeptModal(null)
      const deptRes = await fetch(`/api/company/departments?company_id=${companyId}`)
      const deptData = await deptRes.json()
      if (deptData.success) { setDepartments(deptData.departments); setDeptColorOverrides(deptData.departments) }
    } catch (err) { setEditDeptError(err instanceof Error ? err.message : 'Failed to update') }
    finally { setEditDeptLoading(false) }
  }

  const handleDeleteDept = async () => {
    if (!deleteDeptModal) return
    setDeleteDeptLoading(true); setDeleteDeptError('')
    try {
      const res = await fetch('/api/company/delete-department', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ department_id: deleteDeptModal.id }) })
      const data = await res.json()
      if (!data.success) throw new Error(data.message)
      setDeleteDeptModal(null)
      if (selectedDeptId === deleteDeptModal.id) setSelectedDeptId('')
      const deptRes = await fetch(`/api/company/departments?company_id=${companyId}`)
      const deptData = await deptRes.json()
      if (deptData.success) { setDepartments(deptData.departments); setDeptColorOverrides(deptData.departments) }
    } catch (err) { setDeleteDeptError(err instanceof Error ? err.message : 'Failed to delete') }
    finally { setDeleteDeptLoading(false) }
  }

  const handleEditDeptManager = async () => {
    if (!editManagerModal || !editManagerSelectedId) return
    setEditManagerLoading(true); setEditManagerError('')
    try {
      const res = await fetch('/api/user/update-department', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ user_id: editManagerSelectedId, department_id: editManagerModal.id }) })
      const data = await res.json()
      if (!data.success) throw new Error(data.message)
      setEditManagerModal(null); setEditManagerSelectedId('')
      const mgrRes = await fetch(`/api/company/managers?company_id=${companyId}`)
      const mgrData = await mgrRes.json()
      if (mgrData.success) {
        setAllManagers(mgrData.managers)
        const map: Record<string, string> = {}
        for (const mgr of mgrData.managers as ManagerInfo[]) {
          if (mgr.department_id) {
            map[mgr.department_id] = map[mgr.department_id]
              ? `${map[mgr.department_id]}, ${mgr.full_name}`
              : mgr.full_name
          }
        }
        setDeptManagerMap(map)
      }
    } catch (err) { setEditManagerError(err instanceof Error ? err.message : 'Failed to update manager') }
    finally { setEditManagerLoading(false) }
  }

  // ── Members with a shift on a given date ───────────────────────────────────

  const shiftUserIdsByDate = useMemo(() => {
    const map = new Map<string, Set<string>>()
    // A draft shift isn't a real commitment yet, so it can't make someone eligible for a task.
    for (const shift of shiftOptions) {
      if (!shift.user_id || shift.publication_status !== 'published') continue
      const set = map.get(shift.shift_date) ?? new Set<string>()
      set.add(shift.user_id)
      map.set(shift.shift_date, set)
    }
    return map
  }, [shiftOptions])
  const userIdsWithShiftOnDate = useCallback(
    (date: string) => shiftUserIdsByDate.get(date) ?? EMPTY_USER_ID_SET,
    [shiftUserIdsByDate],
  )
  const userIdsWithShiftOnTaskDate = useMemo(() => userIdsWithShiftOnDate(taskDate), [userIdsWithShiftOnDate, taskDate])

  // ── Dates that have tasks (for calendar dots) ─────────────────────────────

  const datesWithTasks = useMemo<Set<string>>(() => {
    if (!kanban) return new Set()
    const allTasks = [...kanban.Assigned, ...kanban['In Progress'], ...kanban.Review, ...kanban.Complete]
    const dates = new Set<string>()
    for (const t of allTasks) {
      dates.add(kanbanDateKey(t))
    }
    return dates
  }, [kanban])

  const allKanbanTasks = useMemo(() => (
    kanban ? COLUMNS.flatMap(col => kanban[col] ?? []) : []
  ), [kanban])

  useEffect(() => {
    if (hasAutoSelectedTaskDateRef.current || datesWithTasks.size === 0) return
    if (datesWithTasks.has(taskDate)) {
      hasAutoSelectedTaskDateRef.current = true
      return
    }
    const today = formatDateKey(new Date())
    const orderedDates = [...datesWithTasks].sort()
    const nextDate = orderedDates.find(date => date >= today) ?? orderedDates[0]
    if (nextDate) setTaskDate(nextDate)
    hasAutoSelectedTaskDateRef.current = true
  }, [datesWithTasks, taskDate])

  // Floor for the Start Date field itself — a task can't start in the past. Board navigation (Kanban day / Calendar week) is unrestricted, like the Shifts page.
  const todayTaskDate = useMemo(() => formatDateKey(new Date()), [])
  // Effectively-unrestricted floor for the Kanban day picker, since the picker component requires a minDate prop
  const boardNavMinDate = '1970-01-01'

  // ── Filtered tasks per column ──────────────────────────────────────────────

  const filteredTasks = (col: Task['status']): Task[] => {
    if (!kanban) return []
    return (kanban[col] ?? [])
      .filter(t => !selectedDeptId || t.department_id === selectedDeptId)
      .filter(t => kanbanDateKey(t) === taskDate)
      .sort((a, b) => (PRIORITY_ORDER[a.priority ?? ''] ?? 4) - (PRIORITY_ORDER[b.priority ?? ''] ?? 4))
  }

  const allVisibleTasks = useMemo(() => {
    if (!kanban) return []
    return COLUMNS
      .flatMap(col => kanban[col] ?? [])
      .filter(t => !selectedDeptId || t.department_id === selectedDeptId)
      .sort((a, b) => {
        const aTime = a.due_at ? new Date(a.due_at).getTime() : 0
        const bTime = b.due_at ? new Date(b.due_at).getTime() : 0
        return aTime - bTime || (PRIORITY_ORDER[a.priority ?? ''] ?? 4) - (PRIORITY_ORDER[b.priority ?? ''] ?? 4)
      })
  }, [kanban, selectedDeptId])

  const calendarWeekDates = useMemo(() => {
    const anchor = new Date(`${taskDate}T00:00:00`)
    const dow = (anchor.getDay() + 6) % 7
    const monday = addDays(anchor, -dow)
    return Array.from({ length: 7 }, (_, i) => formatDateKey(addDays(monday, i)))
  }, [taskDate])

  const calendarWeekLabel = useMemo(() => {
    const first = new Date(`${calendarWeekDates[0]}T00:00:00`)
    const last = new Date(`${calendarWeekDates[6]}T00:00:00`)
    return `${first.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${last.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
  }, [calendarWeekDates])

  const taskCalendarItems = useMemo(() => {
    const subTasksByParent = new Map<string, Task[]>()
    for (const t of allVisibleTasks) {
      if (!t.parent_task_id) continue
      const arr = subTasksByParent.get(t.parent_task_id) ?? []
      arr.push(t)
      subTasksByParent.set(t.parent_task_id, arr)
    }
    for (const arr of subTasksByParent.values()) arr.sort((a, b) => (a.sequence_order ?? 0) - (b.sequence_order ?? 0))
    const subTaskIndexById = new Map<string, number>()
    for (const arr of subTasksByParent.values()) arr.forEach((t, idx) => subTaskIndexById.set(t.id, idx + 1))

    // Sub-tasks only render once their parent is expanded — collapsed by default, same as Kanban.
    const visibleTasks = allVisibleTasks.filter(t => !t.parent_task_id || expandedTaskIds.has(t.parent_task_id))
    // Bar spans from the task's assigned start date (task_date, set when assigning) to its deadline date
    return visibleTasks.flatMap(task => {
      const startDate = kanbanDateKey(task)
      const endDate = task.due_at ? formatDateKey(new Date(task.due_at)) : startDate
      if (endDate < calendarWeekDates[0] || startDate > calendarWeekDates[6]) return []
      return [{
        task,
        startDate: startDate < endDate ? startDate : endDate,
        endDate: endDate > startDate ? endDate : startDate,
        subTaskCount: task.parent_task_id ? 0 : (subTasksByParent.get(task.id)?.length ?? 0),
        subTaskIndex: task.parent_task_id ? subTaskIndexById.get(task.id) ?? null : null,
      }]
    }).sort((a, b) => (PRIORITY_ORDER[a.task.priority ?? ''] ?? 4) - (PRIORITY_ORDER[b.task.priority ?? ''] ?? 4) || a.startDate.localeCompare(b.startDate))
  }, [allVisibleTasks, calendarWeekDates, expandedTaskIds])

  const renderTaskCalendarView = () => {
    const todayStr = formatDateKey(new Date())
    const ROW_HEIGHT = 58
    const NAME_COL = 180
    const dayIndex = (date: string) => calendarWeekDates.indexOf(date)
    const taskCalendarRows = (() => {
      const rows = new Map<string, {
        key: string
        assignee: typeof members[number] | null
        items: typeof taskCalendarItems
      }>()
      for (const item of taskCalendarItems) {
        const assignee = members.find(m => m.id === item.task.assigned_user_id) ?? null
        const key = item.task.assigned_user_id ?? `unassigned_${item.task.department_id ?? 'none'}`
        if (!rows.has(key)) rows.set(key, { key, assignee, items: [] })
        rows.get(key)!.items.push(item)
      }

      return [...rows.values()].map(row => {
        row.items = [...row.items].sort((a, b) => (
          (PRIORITY_ORDER[a.task.priority ?? ''] ?? 4) - (PRIORITY_ORDER[b.task.priority ?? ''] ?? 4) ||
          a.startDate.localeCompare(b.startDate) ||
          a.task.title.localeCompare(b.task.title)
        ))
        return row
      }).sort((a, b) => {
        const aName = a.assignee?.full_name ?? 'Unassigned'
        const bName = b.assignee?.full_name ?? 'Unassigned'
        const aPriority = Math.min(...a.items.map(item => PRIORITY_ORDER[item.task.priority ?? ''] ?? 4))
        const bPriority = Math.min(...b.items.map(item => PRIORITY_ORDER[item.task.priority ?? ''] ?? 4))
        return aPriority - bPriority || aName.localeCompare(bName)
      })
    })()

    return (
      <div className="task-tab-content" style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: '14px 16px 18px' }}>
        <div style={{ minWidth: 880, border: `1px solid ${TASK_BORDER}`, borderRadius: 12, overflow: 'visible', background: '#FFFFFF' }}>
          {/* Header row — matches Shifts page Calendar tab date header */}
          <div style={{ position: 'sticky', top: 0, zIndex: 20, display: 'grid', gridTemplateColumns: `${NAME_COL}px repeat(7, 1fr)`, background: 'linear-gradient(135deg, #0F172A 0%, #1E293B 100%)', height: 54, overflow: 'hidden' }}>
            <div style={{ position: 'relative', marginLeft: -1, borderRight: '1px solid rgba(255,255,255,0.08)', background: '#0F172A' }} />
            {calendarWeekDates.map(date => {
              const day = new Date(`${date}T00:00:00`)
              const isToday = date === todayStr
              const dayNum = String(day.getDate()).padStart(2, '0')
              const month = day.toLocaleDateString('en-AU', { month: 'short' })
              const weekday = day.toLocaleDateString('en-AU', { weekday: 'long' })
              return (
                <div key={date} style={{ padding: '10px 8px', borderRight: '1px solid rgba(255,255,255,0.08)', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                  <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: isToday ? TASK_ORANGE : 'rgba(255,255,255,0.85)', letterSpacing: '0.01em', lineHeight: 1.2 }}>{dayNum} {month}</p>
                  <p style={{ margin: '3px 0 0', fontSize: 12, fontWeight: 500, color: isToday ? TASK_ORANGE : 'rgba(255,255,255,0.5)', letterSpacing: '0.01em', lineHeight: 1.2 }}>{weekday}</p>
                </div>
              )
            })}
          </div>

          {taskCalendarItems.length === 0 ? (
            <div style={{ minHeight: 320, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, color: '#94A3B8' }}>
              <CalendarDays size={24} strokeWidth={1.6} />
              <p style={{ margin: 0, fontWeight: 700, fontSize: 14 }}>{selectedDept ? `No tasks for ${selectedDept.name} this week` : 'No tasks this week'}</p>
            </div>
          ) : (
            <div>
              {taskCalendarRows.map(row => {
                const rowDept = departments.find(d => d.id === row.items[0]?.task.department_id)
                const rowColor = rowDept ? deptColor(rowDept.id) : STATUS_CONFIG[row.items[0]?.task.status ?? 'Assigned'].color
                // Every top-level task gets its own dedicated lane (no packing two unrelated tasks
                // into one lane just because their dates don't overlap) — assigned once, up front, so
                // every bar in the row agrees on the same layout instead of each recomputing "who
                // overlaps me" and centering independently. An expanded task's sub-task rows are
                // inserted directly under their own parent's lane, never interleaved with siblings.
                const primaryItemsForLanes = row.items
                  .filter(item => !item.task.parent_task_id)
                  .sort((a, b) => (
                    a.startDate.localeCompare(b.startDate) || a.endDate.localeCompare(b.endDate) || a.task.title.localeCompare(b.task.title)
                  ))
                const laneByTaskId = new Map<string, number>()
                let nextLane = 0
                for (const primary of primaryItemsForLanes) {
                  laneByTaskId.set(primary.task.id, nextLane)
                  nextLane += 1
                  const subItems = row.items
                    .filter(sub => sub.task.parent_task_id === primary.task.id)
                    .sort((a, b) => (a.subTaskIndex ?? 0) - (b.subTaskIndex ?? 0))
                  for (const sub of subItems) {
                    laneByTaskId.set(sub.task.id, nextLane)
                    nextLane += 1
                  }
                }
                const laneCount = nextLane
                const rowHeight = Math.max(ROW_HEIGHT, laneCount * 34 + 18)
                const assignee = row.assignee
                const isManager = assignee?.role === 'Manager'
                return (
                  <div key={row.key} style={{ display: 'grid', gridTemplateColumns: `${NAME_COL}px repeat(7, 1fr)`, minHeight: rowHeight, borderBottom: '1px solid #CBD5E1', boxSizing: 'border-box' }}>
                    {/* Assignee column */}
                    <div style={{ display: 'flex', alignItems: 'center', borderRight: `1px solid ${TASK_BORDER}`, overflow: 'hidden' }}>
                      <div style={{ width: 8, alignSelf: 'stretch', flexShrink: 0, background: rowColor, opacity: 0.85 }} />
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 10px 0 12px', minWidth: 0, flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 26, height: 26, flexShrink: 0, background: assignee?.profile_photo_url ? 'transparent' : (isManager ? '#FFF7ED' : '#F3F4F6'), color: isManager ? '#EA580C' : '#4B5563', borderRadius: 999, overflow: 'hidden' }}>
                          {assignee?.profile_photo_url
                            ? <img src={assignee.profile_photo_url} alt={assignee.full_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            : isManager ? <UserCog size={13} /> : <UserRound size={13} />}
                        </div>
                        <span style={{ fontSize: '0.9375rem', fontWeight: 600, color: assignee ? '#111827' : '#9CA3AF', fontStyle: assignee ? 'normal' : 'italic', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {assignee?.full_name ?? 'Unassigned'}
                        </span>
                      </div>
                    </div>
                    {calendarWeekDates.map((date, i) => (
                      <div key={date} style={{ gridColumn: i + 2, gridRow: 1, borderRight: i < 6 ? `1px solid ${TASK_BORDER}` : 'none', background: date === todayStr ? '#FFF7ED' : '#FFFFFF' }} />
                    ))}
                    {[...row.items].sort((a, b) => (
                      (PRIORITY_ORDER[a.task.priority ?? ''] ?? 4) - (PRIORITY_ORDER[b.task.priority ?? ''] ?? 4) ||
                      a.startDate.localeCompare(b.startDate) ||
                      a.task.title.localeCompare(b.task.title)
                    )).map(item => {
                      const dept = departments.find(d => d.id === item.task.department_id)
                      const color = dept ? deptColor(dept.id) : TASK_ORANGE
                      const startCol = Math.max(0, dayIndex(item.startDate))
                      const endCol = dayIndex(item.endDate) === -1 ? 6 : dayIndex(item.endDate)
                      const truncatedStart = item.startDate < calendarWeekDates[0]
                      const truncatedEnd = item.endDate > calendarWeekDates[6]
                      const stackHeight = laneCount * 28 + Math.max(0, laneCount - 1) * 6
                      const stackTop = Math.max(0, (rowHeight - stackHeight) / 2) + (laneByTaskId.get(item.task.id) ?? 0) * 34
                      return (
                        <button
                          key={item.task.id}
                          type="button"
                          onClick={() => openTask(item.task, false)}
                          title={`${item.task.title} | ${item.startDate} - ${item.endDate}`}
                          style={{
                            gridColumn: `${startCol + 2} / ${endCol + 3}`,
                            gridRow: 1,
                            alignSelf: 'start',
                            position: 'relative',
                            margin: `${stackTop}px 6px 0`,
                            height: 28,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            padding: '0 12px',
                            border: 'none',
                            borderRadius: 999,
                            background: color,
                            cursor: 'pointer',
                            overflow: 'hidden',
                          }}
                          onMouseEnter={e => { e.currentTarget.style.filter = 'brightness(1.08)' }}
                          onMouseLeave={e => { e.currentTarget.style.filter = 'none' }}
                        >
                          {truncatedStart && (
                            <span
                              role="button"
                              aria-label="View previous week"
                              title="View previous week"
                              onClick={e => { e.stopPropagation(); setTaskDate(formatDateKey(addDays(new Date(`${taskDate}T00:00:00`), -7))) }}
                              style={{ position: 'absolute', left: 2, top: 2, bottom: 2, width: 24, borderRadius: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', background: 'transparent', transition: 'background 0.12s ease' }}
                              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.25)' }}
                              onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                            >
                              <ChevronLeft size={13} color="#FFFFFF" strokeWidth={3} style={{ flexShrink: 0 }} />
                            </span>
                          )}
                          {item.subTaskIndex !== null && (
                            <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 16, height: 16, borderRadius: '50%', background: 'rgba(255,255,255,0.3)', color: '#FFFFFF', fontSize: 9, fontWeight: 800, flexShrink: 0, marginRight: 5 }}>
                              {item.subTaskIndex}
                            </span>
                          )}
                          <span style={{ fontSize: 12, fontWeight: 700, color: '#FFFFFF', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.task.title}</span>
                          {item.subTaskCount > 0 && (
                            <span
                              role="button"
                              aria-label={expandedTaskIds.has(item.task.id) ? 'Collapse sub-tasks' : 'Expand sub-tasks'}
                              onClick={e => { e.stopPropagation(); toggleTaskExpanded(item.task.id) }}
                              style={{ display: 'inline-flex', alignItems: 'center', gap: 3, marginLeft: 6, flexShrink: 0, padding: '2px 6px', borderRadius: 999, background: 'rgba(255,255,255,0.25)', cursor: 'pointer' }}
                            >
                              <ChevronDown size={11} color="#FFFFFF" strokeWidth={3} style={{ transform: expandedTaskIds.has(item.task.id) ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
                            </span>
                          )}
                          {truncatedEnd && (
                            <span
                              role="button"
                              aria-label="View next week"
                              title="View next week"
                              onClick={e => { e.stopPropagation(); setTaskDate(formatDateKey(addDays(new Date(`${taskDate}T00:00:00`), 7))) }}
                              style={{ position: 'absolute', right: 2, top: 2, bottom: 2, width: 24, borderRadius: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', background: 'transparent', transition: 'background 0.12s ease' }}
                              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.25)' }}
                              onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                            >
                              <ChevronRight size={13} color="#FFFFFF" strokeWidth={3} style={{ flexShrink: 0 }} />
                            </span>
                          )}
                        </button>
                      )
                    })}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    )
  }

  const assignableMembers = members.filter(m => m.role === 'Manager')
  const deptDropdownOptions = departments.map(d => ({ value: d.id, label: d.name }))
  const newAssigneeMember = members.find(m => m.id === newAssigneeId) ?? null
  const priorityDropdownOptions: { value: string; label: string }[] =
    (['Low', 'Medium', 'High', 'Urgent'] as PriorityLevel[]).map(p => ({ value: p, label: p }))
  const templateDropdownOptions = taskTemplates.map(t => ({ value: t.id, label: t.name }))
  const newRecurringPreviewDates: string[] = (() => {
    if (!newRecurringEnabled || !newRecurrenceRule || !newStartDate || !newRecurrenceEndDate) return []
    const intervalDays = newRecurrenceRule === 'daily'
      ? 1
      : newRecurrenceRule === 'weekly'
        ? 7
        : newCustomIntervalDays
    if (!intervalDays || intervalDays < 1) return []
    const dates: string[] = []
    let next = addDays(new Date(`${newStartDate}T00:00:00`), intervalDays)
    while (formatDateKey(next) <= newRecurrenceEndDate && dates.length < 60) {
      dates.push(formatDateKey(next))
      next = addDays(next, intervalDays)
    }
    return dates
  })()

  // Preview-only mirror of taskService's computeDeadlineFromRule — purely a UI hint, the server
  // remains the source of truth for what's actually persisted.
  const previewDeadlineFor = (taskDate: string): string | null => {
    if (!isNewDeadlineRuleValid) return null
    if (newDeadlineRuleType === 'same_day') {
      return new Date(`${taskDate}T${newDeadlineRuleTime}:00`).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
    }
    if (newDeadlineRuleType === 'fixed_day') {
      const d = new Date(`${taskDate}T00:00:00`)
      d.setDate(d.getDate() + (((newDeadlineRuleWeekday ?? 0) - d.getDay() + 7) % 7))
      return new Date(`${formatDateKey(d)}T${newDeadlineRuleTime}:00`).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
    }
    const base = new Date(`${taskDate}T00:00:00`)
    if (newDeadlineRuleOffsetUnit === 'hours') base.setHours(base.getHours() + newDeadlineRuleOffsetAmount)
    else base.setDate(base.getDate() + newDeadlineRuleOffsetAmount)
    return base.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
  }
  const isNewDeadlineRuleValid = newDeadlineRuleType !== '' && (
    newDeadlineRuleType === 'same_day' ? newDeadlineRuleTime !== '' :
    newDeadlineRuleType === 'fixed_day' ? newDeadlineRuleTime !== '' && newDeadlineRuleWeekday !== null :
    newDeadlineRuleOffsetAmount >= 1
  )
  const isNewTaskValid = newTitle.trim() !== '' && newDeptId !== '' && newPriority !== '' && newStartDate !== ''
    && (newRecurringEnabled ? (newRecurrenceRule !== '' && newRecurrenceEndDate !== '' && newRecurrenceEndDate > newStartDate && (newRecurrenceRule !== 'custom' || newCustomIntervalDays >= 1) && isNewDeadlineRuleValid) : (newDeadlineDate !== '' && newDeadlineTime !== ''))
  // When editing a sibling occurrence (not the original), the original's own task_date is
  // earlier than editStartDate — look it up from the loaded siblings so the Preview can still
  // anchor on and label the true original, instead of treating the opened occurrence as it.
  const originalTaskDateForEdit = (() => {
    if (!selectedTask?.recurrence_group_id || !kanban) return editStartDate
    if (selectedTask.source_task_id === null) return editStartDate
    const original = COLUMNS.flatMap(col => kanban[col])
      .find(row => row.recurrence_group_id === selectedTask.recurrence_group_id && row.source_task_id === null)
    return original ? kanbanDateKey(original) : editStartDate
  })()
  const editRecurringPreviewDates: string[] = (() => {
    if (!editRecurringEnabled || !recurrenceRule || !originalTaskDateForEdit || !recurrenceEndDate) return []
    const intervalDays = recurrenceRule === 'daily'
      ? 1
      : recurrenceRule === 'weekly'
        ? 7
        : editCustomIntervalDays
    if (!intervalDays || intervalDays < 1) return []
    const dates: string[] = []
    let next = addDays(new Date(`${originalTaskDateForEdit}T00:00:00`), intervalDays)
    while (formatDateKey(next) <= recurrenceEndDate && dates.length < 60) {
      dates.push(formatDateKey(next))
      next = addDays(next, intervalDays)
    }
    return dates
  })()
  const isEditDeadlineRuleValid = editDeadlineRuleType !== '' && (
    editDeadlineRuleType === 'same_day' ? editDeadlineRuleTime !== '' :
    editDeadlineRuleType === 'fixed_day' ? editDeadlineRuleTime !== '' && editDeadlineRuleWeekday !== null :
    editDeadlineRuleOffsetAmount >= 1
  )
  // Preview-only mirror of taskService's computeDeadlineFromRule for the Edit panel's recurring preview.
  const previewDeadlineForEdit = (taskDate: string): string | null => {
    if (!isEditDeadlineRuleValid) return null
    if (editDeadlineRuleType === 'same_day') {
      return new Date(`${taskDate}T${editDeadlineRuleTime}:00`).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
    }
    if (editDeadlineRuleType === 'fixed_day') {
      const d = new Date(`${taskDate}T00:00:00`)
      d.setDate(d.getDate() + (((editDeadlineRuleWeekday ?? 0) - d.getDay() + 7) % 7))
      return new Date(`${formatDateKey(d)}T${editDeadlineRuleTime}:00`).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
    }
    const base = new Date(`${taskDate}T00:00:00`)
    if (editDeadlineRuleOffsetUnit === 'hours') base.setHours(base.getHours() + editDeadlineRuleOffsetAmount)
    else base.setDate(base.getDate() + editDeadlineRuleOffsetAmount)
    return base.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
  }
  const editTaskDeptMembers = (editDeptId ? assignableMembers.filter(m => m.department_id === editDeptId) : assignableMembers)
    .filter(m => userIdsWithShiftOnDate(editStartDate).has(m.id) || m.id === editAssignee)
  const editAssigneeDropdownOptions = editTaskDeptMembers.map(m => ({ value: m.id, label: m.full_name }))
  const isEditTaskValid = editTitle.trim() !== '' && editDeptId !== '' && editStartDate !== '' && editPriority !== '' && editDueAt !== '' && editDeadlineTime !== ''
  const isEditRecurringFormValid = !editRecurringEnabled || (
    recurrenceEndDate !== '' && recurrenceEndDate > editStartDate && (recurrenceRule !== 'custom' || editCustomIntervalDays >= 1) && isEditDeadlineRuleValid
  )
  // The server-persisted sub-tasks as of when the panel was opened — used as the "before" side
  // of the diff handleSaveTask runs against editSubTasks (the local draft) on Save Changes.
  const selectedSubTasksUnordered = selectedTask && kanban
    ? COLUMNS.flatMap(col => kanban[col]).filter(task => task.parent_task_id === selectedTask.id)
    : []
  const visibleArchivedTasks = useMemo(
    () => archivedTasks.filter(t => !t.parent_task_id && !t.source_task_id),
    [archivedTasks],
  )
  const recommendedAssigneeName = reassignmentSuggestion?.recommended_assignee_id
    ? members.find(m => m.id === reassignmentSuggestion.recommended_assignee_id)?.full_name ?? 'Unknown'
    : ''
  const currentAssigneeName = reassignmentSuggestion?.current_assignee_id
    ? members.find(m => m.id === reassignmentSuggestion.current_assignee_id)?.full_name ?? 'Unassigned'
    : 'Unassigned'

  const visibleDepts = departments.filter(d =>
    selectedDeptId === '' ? true : d.id === selectedDeptId
  )
  const selectedDept = selectedDeptId ? visibleDepts[0] : null

  const orderedDepartments = useMemo(() => {
    if (departments.length === 0) return []
    const byId = new Map(departments.map(d => [d.id, d] as const))
    const saved = departmentOrder.filter(id => byId.has(id))
    const remaining = departments.map(d => d.id).filter(id => !saved.includes(id))
    const orderedIds = saved.length > 0 ? [...saved, ...remaining] : departments.map(d => d.id)
    return orderedIds.map(id => byId.get(id)!).filter(Boolean)
  }, [departments, departmentOrder])

  const activeDeptIds = useMemo(() => {
    const ids = new Set<string>()
    for (const shift of shiftOptions) {
      if (shift.user_id && shift.publication_status !== 'draft') ids.add(shift.department_id)
    }
    return ids
  }, [shiftOptions])

  const moveDepartment = useCallback((sourceId: string, targetId: string) => {
    if (!sourceId || !targetId || sourceId === targetId) return
    const ids = departmentOrderRef.current.length > 0 ? departmentOrderRef.current : departments.map(d => d.id)
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

  // ── Button helpers ────────────────────────────────────────────────────────

  const primaryBtn = (loading: boolean): React.CSSProperties => ({
    flex: 1, padding: '10px', background: '#111827', border: 'none', borderRadius: '8px',
    fontWeight: 600, fontSize: '0.9375rem', color: '#FFFFFF',
    cursor: loading ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '7px', opacity: loading ? 0.65 : 1,
  })
  const ghostBtn: React.CSSProperties = {
    flex: 1, padding: '10px', background: 'none', border: '1.5px solid #E5E7EB',
    borderRadius: '8px', fontWeight: 600, fontSize: '0.9375rem', color: '#6B7280', cursor: 'pointer',
  }
  const dangerBtn = (loading: boolean): React.CSSProperties => ({
    padding: '8px 16px', background: '#EF4444', border: 'none', borderRadius: '8px',
    fontWeight: 600, fontSize: '0.875rem', color: '#FFFFFF',
    cursor: loading ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', opacity: loading ? 0.65 : 1,
  })

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div style={{ display: 'flex', height: '100vh', background: '#F7F8FA' }}>
      <OwnerSidebar />

      {/* Dropdown animation */}
      <style>{`
        @keyframes dropdownFadeIn {
          from { opacity: 0; transform: translateY(-6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadeSlideUp {
          from { opacity: 0; transform: scale(0.97) translateY(8px); }
          to   { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes slideInLeft {
          from { opacity: 0; transform: translateX(-12px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        @keyframes scaleIn {
          from { opacity: 0; transform: scale(0.95); }
          to   { opacity: 1; transform: scale(1); }
        }
        @keyframes blockSlideUp {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes blockPopIn {
          0% { opacity: 0; transform: scale(0.93) translateY(10px); }
          65% { opacity: 1; transform: scale(1.025) translateY(-2px); }
          100% { transform: scale(1) translateY(0); }
        }
        @keyframes drawerSlideIn {
          from { opacity: 0; transform: translateX(24px); }
          to { opacity: 1; transform: translateX(0); }
        }
        @keyframes fadeSlideUpToast {
          from { opacity: 0; transform: translateX(-50%) translateY(10px); }
          to { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
        @keyframes cardStagger {
          from { opacity: 0; transform: translateY(14px) scale(0.96); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes deptCardIn {
          from { opacity: 0; transform: translateX(-10px); }
          to { opacity: 1; transform: translateX(0); }
        }
        @keyframes rowSlideIn {
          from { opacity: 0; transform: translateX(-8px); }
          to { opacity: 1; transform: translateX(0); }
        }
        @keyframes tabContentIn {
          from { opacity: 0; transform: translateY(8px) scale(0.99); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes shimmer {
          0% { background-position: -400px 0; }
          100% { background-position: 400px 0; }
        }
        @keyframes iconBounce {
          0%, 100% { transform: translateY(0); }
          40%      { transform: translateY(-3px); }
          70%      { transform: translateY(-1px); }
        }
        @keyframes overlayFadeIn  { from { opacity: 0 } to { opacity: 1 } }
        @keyframes overlayFadeOut { from { opacity: 1 } to { opacity: 0 } }
        @keyframes modalSlideIn   { from { opacity: 0; transform: scale(0.97) translateY(8px) } to { opacity: 1; transform: scale(1) translateY(0) } }
        @keyframes modalSlideOut  { from { opacity: 1; transform: scale(1) translateY(0) } to { opacity: 0; transform: scale(0.97) translateY(8px) } }
        @keyframes taskCardRemove {
          from { opacity: 1; transform: scale(1); max-height: 200px; margin-bottom: 14px; }
          to   { opacity: 0; transform: scale(0.92); max-height: 0; margin-bottom: 0; padding-top: 0; padding-bottom: 0; }
        }
        .task-card-removing { overflow: hidden; animation: taskCardRemove 0.22s ease forwards; }

        /* Kanban task cards */
        .task-card {
          transition: box-shadow 0.16s ease, transform 0.16s ease, border-color 0.16s ease;
        }
        .task-card:hover {
          box-shadow: 0 6px 22px rgba(0,0,0,0.10), 0 0 0 1.5px rgba(249,115,22,0.15) !important;
          transform: translateY(-2px);
        }
        .task-card:hover .task-card-icon {
          animation: iconBounce 0.45s ease forwards;
        }

        /* Kanban column */
        .kanban-col {
          transition: box-shadow 0.18s ease;
        }
        .kanban-col:hover {
          box-shadow: 0 4px 18px rgba(0,0,0,0.06);
        }

        .task-dept-panel {
          animation: blockPopIn 0.42s cubic-bezier(0.34,1.56,0.64,1) both 0.05s;
        }
        .task-board-panel {
          animation: blockSlideUp 0.38s ease both 0.12s;
        }
        .task-dept-card:hover {
          box-shadow: 0 4px 14px rgba(0,0,0,0.09) !important;
          transform: translateY(-1px) !important;
        }
        .task-tab-content {
          animation: tabContentIn 0.22s ease-out both;
        }

        /* Member sidebar cards */
        .member-card {
          animation: cardStagger 0.30s ease both;
          transition: box-shadow 0.18s ease, border-color 0.18s ease;
        }
        .member-card:hover {
          box-shadow: 0 3px 10px rgba(0,0,0,0.08);
          border-color: #FDBA74 !important;
        }

        /* Assign task (+) button */
        .assign-task-btn {
          transition: background 0.13s ease, transform 0.13s ease, box-shadow 0.13s ease;
        }
        .assign-task-btn:hover {
          background: #FEF3C7 !important;
          transform: scale(1.12);
          box-shadow: 0 2px 8px rgba(249,115,22,0.18);
        }

        /* Today button */
        .today-btn {
          transition: background 0.15s ease, color 0.15s ease, transform 0.12s ease;
        }
        .today-btn:hover {
          transform: translateY(-1px);
        }

        /* Staggered entry — kanban columns (delay set via inline style) */
        .kanban-col { animation: scaleIn 0.32s ease both; }

        /* Staggered entry — task cards */
        .task-card:nth-child(1) { animation: fadeSlideUp 0.26s ease both; animation-delay: 0.04s; }
        .task-card:nth-child(2) { animation: fadeSlideUp 0.26s ease both; animation-delay: 0.08s; }
        .task-card:nth-child(3) { animation: fadeSlideUp 0.26s ease both; animation-delay: 0.12s; }
        .task-card:nth-child(4) { animation: fadeSlideUp 0.26s ease both; animation-delay: 0.16s; }
        .task-card:nth-child(5) { animation: fadeSlideUp 0.26s ease both; animation-delay: 0.20s; }

        /* Staggered entry — member sidebar */
        .member-card:nth-child(1) { animation-delay: 0.05s; }
        .member-card:nth-child(2) { animation-delay: 0.10s; }
        .member-card:nth-child(3) { animation-delay: 0.15s; }
        .member-card:nth-child(4) { animation-delay: 0.20s; }
        .member-card:nth-child(5) { animation-delay: 0.25s; }
      `}</style>

      <main style={{ marginLeft: '64px', flex: 1, height: '100vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', animation: 'blockSlideUp 0.38s ease both 0.04s' }}>

        {/* Page header — matches Dashboard style */}
        <div style={{ padding: '20px 28px 16px', flexShrink: 0, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h1 className="mb-0 font-heading text-3xl font-bold tracking-tight text-gray-950">
              Tasks
            </h1>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0, paddingTop: 4 }}>
            {internalUserId && <OwnerUserBadge userId={internalUserId} companyId={companyId} />}
            {companyId && <OwnerPlanBadge plan={currentPlan} currentCompanyId={companyId} />}
          </div>
        </div>

        {/* Board view tab switcher: Kanban / Calendar */}
        <div style={{ padding: '0 28px 16px', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start' }}>
            <div
              ref={boardTabBarRef}
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
                  left: boardTabIndicator.left,
                  width: boardTabIndicator.width,
                  height: 'calc(100% - 8px)',
                  borderRadius: 999,
                  background: 'linear-gradient(180deg, #0F172A 0%, #111827 100%)',
                  boxShadow: '0 6px 18px rgba(15,23,42,0.18)',
                  opacity: boardTabIndicator.opacity,
                  transform: boardTabIndicator.opacity ? 'translateY(0)' : 'translateY(4px)',
                  transition: 'left 0.24s cubic-bezier(0.22, 1, 0.36, 1), width 0.24s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.16s ease, transform 0.24s cubic-bezier(0.22, 1, 0.36, 1)',
                  pointerEvents: 'none',
                }}
              />
              {([
                { id: 'kanban' as const, label: 'Kanban' },
                { id: 'calendar' as const, label: 'Calendar' },
              ]).map(tab => {
                const active = boardViewMode === tab.id
                return (
                  <button
                    key={tab.id}
                    ref={el => { boardTabButtonRefs.current[tab.id] = el }}
                    type="button"
                    onClick={() => setBoardViewMode(tab.id)}
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

        <div style={{ padding: '0 28px 28px', flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          {!initialReady || kanbanLoading ? (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flex: 1 }}>
              <Spinner size={24} dark />
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 16, alignItems: 'stretch', flex: 1, minHeight: 0 }}>

              {/* ── DEPARTMENT PANEL ───────────────────────────────────────── */}
              <div style={{ width: 326, flexShrink: 0, alignSelf: 'flex-start', display: 'flex', flexDirection: 'column', gap: 12 }}>
                <section style={{ background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: 14, overflow: 'hidden' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 18px', borderBottom: '1px solid #F3F4F6' }}>
                    <div style={{ width: 30, height: 30, borderRadius: 9, background: '#FFF7ED', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Bell size={15} style={{ color: '#F97316' }} />
                    </div>
                    <span style={{ fontWeight: 700, fontSize: '1rem', color: '#0F172A' }}>Notification</span>
                  </div>
                  <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {(() => {
                      const hasIssue = workloadSuggestions.length > 0
                      return (
                        <div style={{ border: '1px solid #E5E7EB', borderRadius: 12, background: '#F9FAFB', padding: '11px 12px', display: 'flex', alignItems: 'center', gap: 10 }}>
                          <span style={{ width: 28, height: 28, borderRadius: 9, background: '#EEF2FF', color: '#4F46E5', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <ArrowRightLeft size={14} />
                          </span>
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: TASK_TEXT }}>Workload Suggestion</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              if (hasIssue) { setWorkloadApplyError(''); setWorkloadInsightOpen(true) }
                              else void refreshTaskInsights('workload')
                            }}
                            disabled={insightLoading === 'workload'}
                            title={hasIssue ? 'View workload suggestion' : 'Refresh'}
                            style={{ width: 30, height: 30, border: 'none', borderRadius: 999, background: hasIssue ? '#FEF3C7' : '#DCFCE7', color: hasIssue ? '#D97706' : '#16A34A', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, cursor: insightLoading === 'workload' ? 'default' : 'pointer' }}
                          >
                            {insightLoading === 'workload' ? <Spinner size={12} dark /> : hasIssue ? <AlertTriangle size={15} /> : <Check size={15} strokeWidth={3} />}
                          </button>
                        </div>
                      )
                    })()}

                    {(() => {
                      const hasIssue = stalledAlerts.length > 0
                      return (
                        <div style={{ border: '1px solid #E5E7EB', borderRadius: 12, background: '#F9FAFB', padding: '11px 12px', display: 'flex', alignItems: 'center', gap: 10 }}>
                          <span style={{ width: 28, height: 28, borderRadius: 9, background: hasIssue ? '#FEF2F2' : '#F0FDF4', color: hasIssue ? '#DC2626' : '#16A34A', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <Bell size={14} />
                          </span>
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: TASK_TEXT }}>Stalled Tasks</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              if (hasIssue) highlightFirstStalledTask()
                              else void refreshTaskInsights('stalled')
                            }}
                            disabled={insightLoading === 'stalled'}
                            title={hasIssue ? 'Highlight stalled task' : 'Refresh'}
                            style={{ width: 30, height: 30, border: 'none', borderRadius: 999, background: hasIssue ? '#FEF3C7' : '#DCFCE7', color: hasIssue ? '#D97706' : '#16A34A', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, cursor: insightLoading === 'stalled' ? 'default' : 'pointer' }}
                          >
                            {insightLoading === 'stalled' ? <Spinner size={12} dark /> : hasIssue ? <AlertTriangle size={15} /> : <Check size={15} strokeWidth={3} />}
                          </button>
                        </div>
                      )
                    })()}
                    {insightError && <div style={{ color: '#DC2626', fontSize: 12, fontWeight: 700 }}>{insightError}</div>}
                  </div>
                </section>

              <section className="task-dept-panel" style={{ width: '100%', background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: 14, overflow: 'visible' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '16px 18px', borderBottom: '1px solid #F3F4F6' }}>
                  {selectedDept ? (
                    <>
                      <button
                        type="button"
                        onClick={() => setSelectedDeptId('')}
                        aria-label="Back to all departments"
                        title="Back to all departments"
                        style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 30, height: 30, borderRadius: 8, border: '1px solid #E5E7EB', background: '#FFFFFF', color: '#64748B', cursor: 'pointer', flexShrink: 0 }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor = '#FDBA74'; e.currentTarget.style.color = '#F97316'; e.currentTarget.style.background = '#FFF7ED' }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = '#E5E7EB'; e.currentTarget.style.color = '#64748B'; e.currentTarget.style.background = '#FFFFFF' }}
                      >
                        <ChevronLeft size={14} />
                      </button>
                      <span style={{ width: 9, height: 9, borderRadius: '50%', background: deptColor(selectedDept.id), flexShrink: 0 }} />
                      <span style={{ fontWeight: 700, fontSize: '1rem', color: '#0F172A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{selectedDept.name}</span>
                    </>
                  ) : (
                    <>
                      <div style={{ width: 30, height: 30, borderRadius: 9, background: '#FFF7ED', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <Users size={15} style={{ color: '#F97316' }} />
                      </div>
                      <span style={{ fontWeight: 700, fontSize: '1rem', color: '#0F172A' }}>Departments</span>
                    </>
                  )}
                </div>

                <div key={`dept-panel-body-${boardViewMode}-${selectedDeptId}`} style={{ padding: 14 }}>
                  {(() => {
                    const dept = selectedDept
                    if (selectedDeptId && !dept) return null

                    if (!dept) {
                      // ── Department cards grid (draggable to reorder) ──
                      // Kanban tab: tasks due on the selected day. Calendar tab: tasks overlapping the visible week.
                      const dayTasks = COLUMNS.flatMap(col => (kanban?.[col] ?? [])).filter(t => {
                        if (t.parent_task_id) return false
                        if (boardViewMode === 'calendar') {
                          const startDate = kanbanDateKey(t)
                          const endDate = t.due_at ? formatDateKey(new Date(t.due_at)) : startDate
                          return endDate >= calendarWeekDates[0] && startDate <= calendarWeekDates[6]
                        }
                        return kanbanDateKey(t) === taskDate
                      })
                      return (
                        <>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 12 }}>
                            {orderedDepartments.map((d, deptIdx) => {
                              const managerCount = members.filter(m => m.department_id === d.id && m.role === 'Manager' && userIdsWithShiftOnTaskDate.has(m.id)).length
                              // A recurring task's occurrences all count as one task — same principle as a
                              // task with sub-tasks still being one task — so dedupe by recurrence_group_id
                              // (falling back to the task's own id when it isn't part of a series).
                              const taskCount = new Set(
                                dayTasks.filter(t => t.department_id === d.id).map(t => t.recurrence_group_id ?? t.id)
                              ).size
                              const isDragging = draggingDepartmentId === d.id
                              const isDragOver = dragOverDepartmentId === d.id
                              return (
                                <article
                                  key={d.id}
                                  className="task-dept-card"
                                  draggable
                                  onDragStart={(event) => {
                                    const target = event.target as HTMLElement | null
                                    if (target?.closest('button, input, textarea, select, a, [role="button"]')) {
                                      event.preventDefault()
                                      return
                                    }
                                    event.dataTransfer.effectAllowed = 'move'
                                    event.dataTransfer.setData('text/plain', d.id)
                                    handleDepartmentDragStart(d.id)
                                  }}
                                  onDragEnd={handleDepartmentDragEnd}
                                  onDragOver={(event) => {
                                    event.preventDefault()
                                    if (draggingDepartmentId && draggingDepartmentId !== d.id) setDragOverDepartmentId(d.id)
                                  }}
                                  onDragLeave={(event) => {
                                    if (event.currentTarget.contains(event.relatedTarget as Node | null)) return
                                    setDragOverDepartmentId(current => current === d.id ? null : current)
                                  }}
                                  onDrop={(event) => {
                                    event.preventDefault()
                                    const sourceId = event.dataTransfer.getData('text/plain')
                                    if (sourceId) moveDepartment(sourceId, d.id)
                                    handleDepartmentDragEnd()
                                  }}
                                  onClick={() => setSelectedDeptId(d.id)}
                                  style={{
                                    border: '1px solid #F1F5F9', borderRadius: 12, padding: '14px 16px', background: '#F9FAFB',
                                    cursor: isDragging ? 'grabbing' : 'grab',
                                    transition: 'box-shadow 0.18s ease, transform 0.18s ease, border-color 0.18s ease, opacity 0.18s ease',
                                    opacity: isDragging ? 0.88 : 1,
                                    outline: isDragOver ? '2px dashed #F97316' : 'none',
                                    outlineOffset: 3,
                                    boxShadow: isDragOver ? '0 14px 34px rgba(249,115,22,0.12)' : undefined,
                                    transform: isDragging ? 'scale(0.985)' : undefined,
                                    animation: `deptCardIn 0.28s ease both ${deptIdx * 55}ms`,
                                  }}
                                  onMouseEnter={e => { if (draggingDepartmentId) return; e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = '0 10px 28px rgba(15,23,42,0.11)'; e.currentTarget.style.borderColor = deptColor(d.id) }}
                                  onMouseLeave={e => { if (draggingDepartmentId) return; e.currentTarget.style.transform = isDragging ? 'scale(0.985)' : 'none'; e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.borderColor = '#F1F5F9' }}
                                >
                                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 12 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                                      <span
                                        className={activeDeptIds.has(d.id) ? 'dept-dot-active' : undefined}
                                        style={{ width: 8, height: 8, borderRadius: '50%', background: deptColor(d.id), flexShrink: 0, display: 'inline-block' }}
                                      />
                                      <h3 style={{ margin: 0, fontWeight: 700, fontSize: '0.9375rem', color: '#0F172A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{d.name}</h3>
                                    </div>
                                    <span
                                      aria-hidden="true"
                                      title="Drag to reorder"
                                      style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 26, height: 26, borderRadius: 8, color: '#9CA3AF', flexShrink: 0, cursor: 'grab', background: 'transparent', transition: 'color 0.15s ease, background 0.15s ease, transform 0.15s ease' }}
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
                                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="9" cy="6" r="1"/><circle cx="15" cy="6" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="9" cy="18" r="1"/><circle cx="15" cy="18" r="1"/></svg>
                                    </span>
                                  </div>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                      <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 26, height: 26, borderRadius: 999, background: '#FFF7ED', color: '#EA580C', flexShrink: 0 }}>
                                        <UserCog size={13} />
                                      </span>
                                      <span style={{ color: '#111827', fontSize: 14, fontWeight: 600 }}>{managerCount}</span>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                      <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 26, height: 26, borderRadius: 999, background: '#F3F4F6', color: '#4B5563', flexShrink: 0 }}>
                                        <Layers size={13} />
                                      </span>
                                      <span style={{ color: '#111827', fontSize: 14, fontWeight: 600 }}>{taskCount} Task{taskCount !== 1 ? 's' : ''}</span>
                                    </div>
                                  </div>
                                </article>
                              )
                            })}
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'center' }}>
                            <button
                              type="button"
                              onClick={openAiAssign}
                              style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7, border: 0, borderRadius: 10, background: 'linear-gradient(135deg, #7C3AED, #6D28D9)', color: '#FFFFFF', height: 36, padding: '0 24px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
                            >
                              <Sparkles size={14} /> AI Assign
                            </button>
                          </div>
                        </>
                      )
                    }

                    // ── Department selected: manager list ──
                    const deptMembers = members.filter(m => m.department_id === dept.id && m.role === 'Manager' && userIdsWithShiftOnTaskDate.has(m.id))
                    // Count tasks due on the selected date only, so the panel matches what's visible in the Kanban
                    const dateTaskCountByUser = COLUMNS
                      .flatMap(col => filteredTasks(col))
                      .filter(t => !t.parent_task_id)
                      .reduce<Record<string, number>>((acc, t) => {
                        if (t.assigned_user_id) acc[t.assigned_user_id] = (acc[t.assigned_user_id] ?? 0) + 1
                        return acc
                      }, {})
                    const freeMembers = deptMembers.filter(m => (dateTaskCountByUser[m.id] ?? 0) === 0)
                    const busyMembers = deptMembers.filter(m => (dateTaskCountByUser[m.id] ?? 0) > 0)

                    const workloadColor = (count: number) => {
                      if (count === 0) return { bg: '#F3F4F6', text: '#6B7280' }
                      if (count <= 2)  return { bg: '#DCFCE7', text: '#16A34A' }
                      if (count <= 4)  return { bg: '#FEF3C7', text: '#D97706' }
                      return { bg: '#FEE2E2', text: '#DC2626' }
                    }

                    const renderMember = (m: Member) => {
                      const count = dateTaskCountByUser[m.id] ?? 0
                      const wc = workloadColor(count)
                      return (
                        <div key={m.id} className="member-card" style={{ display: 'flex', alignItems: 'center', gap: 10, border: '1px solid #F1F5F9', borderRadius: 12, padding: '12px 14px', background: '#FFFFFF', justifyContent: 'space-between' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: 1 }}>
                            <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 38, height: 38, borderRadius: 999, background: m.profile_photo_url ? 'transparent' : (m.role === 'Manager' ? '#FFF7ED' : '#F3F4F6'), color: m.role === 'Manager' ? '#EA580C' : '#4B5563', flexShrink: 0, overflow: 'hidden' }}>
                              {m.profile_photo_url
                                ? <img src={m.profile_photo_url} alt={m.full_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                : m.role === 'Manager' ? <UserCog size={18} /> : <UserRound size={18} />}
                            </span>
                            <div style={{ minWidth: 0, flex: 1 }}>
                              <p style={{ margin: 0, color: '#0F172A', fontSize: '0.875rem', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.full_name}</p>
                              {count > 0 && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 3 }}>
                                  <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 7px', borderRadius: 99, background: wc.bg, color: wc.text }}>
                                    {count} Task{count !== 1 ? 's' : ''}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                          <button
                            onClick={() => openNewTaskFor(m.id, dept.id)}
                            className="assign-task-btn"
                            style={{ flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 30, height: 30, background: '#FFF7ED', border: '1px solid #FDBA74', borderRadius: 8, color: '#EA580C', cursor: 'pointer' }}
                            title="Assign Task"
                          >
                            <Plus size={15} strokeWidth={2.5} />
                          </button>
                        </div>
                      )
                    }

                    return (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {/* Free members first */}
                        {freeMembers.length > 0 && (
                          <>
                            <p style={{ margin: '0 2px 6px', fontWeight: 600, fontSize: '0.875rem', color: '#374151' }}>Available</p>
                            {freeMembers.map(renderMember)}
                          </>
                        )}
                        {/* Busy members below */}
                        {busyMembers.length > 0 && (
                          <>
                            <p style={{ margin: `${freeMembers.length > 0 ? '10px' : '0'} 2px 6px`, fontWeight: 600, fontSize: '0.875rem', color: '#374151' }}>Has Tasks</p>
                            {busyMembers.map(renderMember)}
                          </>
                        )}
                      </div>
                    )
                  })()}
                </div>
              </section>
              </div>

              {/* ── BOARD PANEL ────────────────────────────────────────────── */}
              <section className="task-board-panel" style={{ flex: 1, minWidth: 0, minHeight: 0, alignSelf: 'stretch', display: 'flex', flexDirection: 'column', background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: 14, overflow: 'hidden' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '14px 18px', borderBottom: '1px solid #F3F4F6', flexWrap: 'wrap', flexShrink: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 30, height: 30, borderRadius: 9, background: '#FFF7ED', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      {boardViewMode === 'calendar'
                        ? <CalendarDays size={15} style={{ color: '#F97316' }} />
                        : <Layers size={15} style={{ color: '#F97316' }} />}
                    </div>
                    <span style={{ fontWeight: 700, fontSize: '1rem', color: '#0F172A' }}>{boardViewMode === 'calendar' ? 'Calendar' : 'Kanban'}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      onClick={openArchiveModal}
                      disabled={!companyId}
                      style={{ height: 38, padding: '0 14px', border: `1px solid ${TASK_BORDER}`, borderRadius: 8, background: '#FFFFFF', color: companyId ? TASK_TEXT : '#94A3B8', fontSize: 13, fontWeight: 700, cursor: companyId ? 'pointer' : 'not-allowed', display: 'inline-flex', alignItems: 'center', gap: 7 }}
                    >
                      <Archive size={15} /> Archive
                    </button>
                    <button
                      type="button"
                      onClick={() => { setTemplateModalOpen(true); setTemplateFormMode('list'); setTemplateError('') }}
                      disabled={!companyId}
                      style={{ height: 38, padding: '0 14px', border: `1px solid ${TASK_BORDER}`, borderRadius: 8, background: '#FFFFFF', color: companyId ? TASK_TEXT : '#94A3B8', fontSize: 13, fontWeight: 700, cursor: companyId ? 'pointer' : 'not-allowed', display: 'inline-flex', alignItems: 'center', gap: 7 }}
                    >
                      <LayoutTemplate size={15} /> Template
                    </button>
                    {boardViewMode === 'calendar' ? (
                      <>
                        <button
                          type="button"
                          onClick={() => setTaskDate(formatDateKey(addDays(new Date(`${taskDate}T00:00:00`), -7)))}
                          style={{ width: 38, height: 38, borderRadius: 9, border: `1px solid ${TASK_BORDER}`, background: '#FFFFFF', display: 'inline-grid', placeItems: 'center', cursor: 'pointer', color: TASK_TEXT }}
                        ><ChevronLeft size={16} /></button>
                        <span style={{ height: 38, minWidth: 188, padding: '0 12px', border: `1px solid ${TASK_BORDER}`, borderRadius: 9, background: '#FFFFFF', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, color: TASK_TEXT, fontSize: 13, fontWeight: 500, fontFamily: 'var(--font-body), system-ui, sans-serif' }}>
                          <CalendarDays size={14} color="#64748B" />{calendarWeekLabel}
                        </span>
                        <button
                          type="button"
                          onClick={() => setTaskDate(formatDateKey(addDays(new Date(`${taskDate}T00:00:00`), 7)))}
                          style={{ width: 38, height: 38, borderRadius: 9, border: `1px solid ${TASK_BORDER}`, background: '#FFFFFF', display: 'inline-grid', placeItems: 'center', cursor: 'pointer', color: TASK_TEXT }}
                        ><ChevronRight size={16} /></button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => setTaskDate(formatDateKey(new Date()))}
                          className="today-btn"
                          style={{ height: 38, padding: '0 14px', border: `1px solid ${TASK_BORDER}`, borderRadius: 8, background: taskDate === formatDateKey(new Date()) ? '#F97316' : '#FFFFFF', color: taskDate === formatDateKey(new Date()) ? '#FFFFFF' : TASK_TEXT, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
                        >Today</button>
                        <button
                          type="button"
                          onClick={() => setTaskDate(formatDateKey(addDays(new Date(`${taskDate}T00:00:00`), -1)))}
                          style={{ width: 38, height: 38, borderRadius: 9, border: `1px solid ${TASK_BORDER}`, background: '#FFFFFF', display: 'inline-grid', placeItems: 'center', cursor: 'pointer', color: TASK_TEXT }}
                        ><ChevronLeft size={16} /></button>
                        <TaskDatePicker value={taskDate} onChange={setTaskDate} taskDates={datesWithTasks} minDate={boardNavMinDate} accentColor={TASK_ORANGE} />
                        <button
                          type="button"
                          onClick={() => setTaskDate(formatDateKey(addDays(new Date(`${taskDate}T00:00:00`), 1)))}
                          style={{ width: 38, height: 38, borderRadius: 9, border: `1px solid ${TASK_BORDER}`, background: '#FFFFFF', display: 'inline-grid', placeItems: 'center', cursor: 'pointer', color: TASK_TEXT }}
                        ><ChevronRight size={16} /></button>
                      </>
                    )}
                  </div>
                </div>

                {boardViewMode === 'calendar' ? renderTaskCalendarView() : (
                  <div key={`kanban-${taskDate}-${selectedDeptId}-${boardViewMode}`} className="task-tab-content" style={{ flex: 1, minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'row', alignItems: 'stretch', padding: '16px 16px 20px', gap: 0 }}>
                    {COLUMNS.map((col, colIdx) => {
                      const cfg = STATUS_CONFIG[col]
                      const tasks = filteredTasks(col)
                      const topLevelTasks = tasks.filter(t => !t.parent_task_id)
                      const subTasksByParent = new Map<string, Task[]>()
                      for (const t of tasks) {
                        if (!t.parent_task_id) continue
                        const arr = subTasksByParent.get(t.parent_task_id) ?? []
                        arr.push(t)
                        subTasksByParent.set(t.parent_task_id, arr)
                      }
                      for (const arr of subTasksByParent.values()) arr.sort((a, b) => (a.sequence_order ?? 0) - (b.sequence_order ?? 0))
                      return (
                        <Fragment key={col}>
                        {colIdx > 0 && (
                          <div style={{ flexShrink: 0, width: 24, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <svg width="24" height="18" viewBox="0 0 24 18" fill="none" xmlns="http://www.w3.org/2000/svg">
                              <line x1="0" y1="9" x2="17" y2="9" stroke="#94A3B8" strokeWidth="2"/>
                              <polyline points="11,3 19,9 11,15" fill="none" stroke="#94A3B8" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round"/>
                            </svg>
                          </div>
                        )}
                        <div className="kanban-col" style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', background: '#F7F8FA', borderRadius: '12px', overflow: 'hidden', minHeight: 0, height: '100%', border: '1px solid #F0F1F3', animationDelay: `${0.06 + colIdx * 0.05}s` }}>
                          {/* Column header */}
                          <div style={{ padding: '11px 14px 10px', display: 'flex', alignItems: 'center', gap: 7, flexShrink: 0, borderBottom: '1px solid #ECEEF1' }}>
                            <div style={{ color: cfg.color, display: 'flex', alignItems: 'center' }}>{cfg.icon}</div>
                            <span style={{ fontWeight: 700, fontSize: '0.8125rem', color: cfg.color, flex: 1 }}>{cfg.label}</span>
                            <span style={{ fontSize: '0.72rem', fontWeight: 700, background: cfg.bg, color: cfg.color, padding: '2px 8px', borderRadius: '99px' }}>{topLevelTasks.length}</span>
                          </div>
                          {/* Scrollable card area */}
                          <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '10px 18px 12px', display: 'flex', flexDirection: 'column' }}>
                            {topLevelTasks.length === 0 ? (
                              <div style={{ flex: 1, minHeight: 164, margin: '8px 0', padding: '32px 0', textAlign: 'center', background: '#F8FAFC', borderRadius: 14, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', animation: 'fadeSlideUp 0.3s ease both', animationDelay: `${0.1 + colIdx * 0.05}s` }}>
                                {{ Assigned: <Layers size={24} style={{ color: '#CBD5E1', margin: '0 auto 8px', display: 'block' }} />, 'In Progress': <Clock size={24} style={{ color: '#CBD5E1', margin: '0 auto 8px', display: 'block' }} />, Review: <Eye size={24} style={{ color: '#CBD5E1', margin: '0 auto 8px', display: 'block' }} />, Complete: <CheckCircle size={24} style={{ color: '#CBD5E1', margin: '0 auto 8px', display: 'block' }} /> }[col]}
                                <p style={{ fontSize: 12, color: '#94A3B8', margin: 0 }}>No {cfg.label.toLowerCase()} tasks</p>
                              </div>
                            ) : (
                              topLevelTasks.map(task => {
                                const subTasks = subTasksByParent.get(task.id) ?? []
                                const isExpanded = expandedTaskIds.has(task.id)
                                return (
                                  <div key={task.id} className={removingTaskIds.has(task.id) ? 'task-card-removing' : undefined}>
                                    <TaskCard
                                      task={task}
                                      members={members}
                                      shiftOptions={shiftOptions}
                                      departments={departments}
                                      showDept={selectedDeptId === ''}
                                      onClick={() => openTask(task, true)}
                                      onEdit={() => openTask(task, false)}
                                      subTaskCount={subTasks.length}
                                      expanded={isExpanded}
                                      onToggleExpand={() => toggleTaskExpanded(task.id)}
                                      isOwner={!!internalUserId && task.assigned_by === internalUserId}
                                      highlighted={highlightedStalledTaskId === task.id}
                                    />
                                    {isExpanded && subTasks.length > 0 && (
                                      <div style={{ marginTop: -6, marginBottom: 14, paddingLeft: 6 }}>
                                        {subTasks.map((sub, idx) => (
                                          <div key={sub.id} style={{ display: 'flex', alignItems: 'stretch', gap: 8 }}>
                                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                                              <span style={{ width: 26, height: 26, marginTop: 14, borderRadius: '50%', background: '#FFF3E8', color: '#EA580C', fontSize: 13, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                                {idx + 1}
                                              </span>
                                              {idx < subTasks.length - 1 && (
                                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}>
                                                  <div style={{ width: 1, flex: 1, background: '#E2E8F0' }} />
                                                  <ChevronDown size={12} color="#CBD5E1" style={{ marginTop: -2, flexShrink: 0 }} />
                                                </div>
                                              )}
                                            </div>
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                              <TaskCard
                                                task={sub}
                                                members={members}
                                                shiftOptions={shiftOptions}
                                                departments={departments}
                                                showDept={selectedDeptId === ''}
                                                onClick={() => {}}
                                                onEdit={() => openTask(sub, false)}
                                                clickable={false}
                                              />
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                )
                              })
                            )}
                          </div>
                        </div>
                        </Fragment>
                      )
                    })}
                  </div>
                )}
              </section>

            </div>
          )}
        </div>
      </main>

      {/* ═══════════════ TASK DETAIL PANEL ═══════════════ */}
      {selectedTask && taskViewMode && (() => {
        const viewFieldValue: React.CSSProperties = {
          ...modalInputStyle,
          display: 'flex',
          alignItems: 'center',
        }
        const viewEmpty: React.CSSProperties = { ...viewFieldValue, color: '#9CA3AF', fontStyle: 'italic' }
        const isOwner = !!internalUserId && selectedTask.assigned_by === internalUserId
        return (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, animation: `${panelClosing ? 'overlayFadeOut' : 'overlayFadeIn'} 0.18s ease-out` }}>
            <div
              ref={panelRef}
              onClick={e => e.stopPropagation()}
              data-testid="task-details-panel"
              style={{ width: 440, background: '#FFFFFF', borderRadius: 20, overflow: 'hidden', boxShadow: '0 24px 64px rgba(0,0,0,0.16), 0 4px 16px rgba(0,0,0,0.08)', animation: `${panelClosing ? 'modalSlideOut' : 'modalSlideIn'} 0.22s cubic-bezier(0.16,1,0.3,1)` }}
            >
              {/* Header */}
              <div style={{ padding: '18px 20px 16px', borderBottom: '1px solid #F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 32, height: 32, borderRadius: 9, background: 'linear-gradient(135deg, #F97316, #EA580C)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Eye size={15} color="#fff" strokeWidth={2.5} />
                  </div>
                  <h2 style={{ fontWeight: 700, fontSize: '1rem', color: '#111827', margin: 0, fontFamily: "'Inter', system-ui, -apple-system, sans-serif" }}>{selectedTask.title}&rsquo;s Details</h2>
                </div>
                <button onClick={closePanel} style={{ background: '#F9FAFB', border: '1px solid #E5E7EB', cursor: 'pointer', color: '#6B7280', display: 'flex', padding: '6px', borderRadius: 8 }}
                  onMouseEnter={e => { e.currentTarget.style.background = '#F3F4F6' }}
                  onMouseLeave={e => { e.currentTarget.style.background = '#F9FAFB' }}
                >
                  <X size={16} />
                </button>
              </div>

              {/* Body */}
              <div style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 12, maxHeight: 'calc(90vh - 130px)', overflowY: 'auto' }}>

                {/* Description */}
                <div>
                  <label style={modalLabelStyle}>Description</label>
                  {selectedTask.description
                    ? <div style={{ ...viewFieldValue, alignItems: 'flex-start', whiteSpace: 'pre-wrap', lineHeight: 1.55 }}>{selectedTask.description}</div>
                    : <div style={viewEmpty}>No description</div>
                  }
                </div>

                {/* Assigned Time */}
                <div>
                  <label style={modalLabelStyle}>Assigned Time</label>
                  <div style={viewFieldValue}>
                    {new Date(selectedTask.created_at).toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>

                <InlineError message={panelError} />
              </div>

              {/* Footer — only the user who assigned this task may operate on it */}
              {isOwner && (
                <div style={{ padding: '0 20px 18px', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                  <button type="button" onClick={handleDuplicateTask} disabled={taskActionLoading === 'duplicate'} style={{ height: 36, border: '1px solid #E5E7EB', borderRadius: 8, background: '#FFFFFF', color: '#334155', fontSize: 12, fontWeight: 700, cursor: taskActionLoading ? 'default' : 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                    {taskActionLoading === 'duplicate' ? <Spinner size={12} dark /> : <Copy size={13} />} Duplicate
                  </button>
                  <button type="button" onClick={handleArchiveTask} disabled={taskActionLoading === 'archive'} style={{ height: 36, border: '1px solid #FED7AA', borderRadius: 8, background: '#FFF7ED', color: '#C2410C', fontSize: 12, fontWeight: 700, cursor: taskActionLoading ? 'default' : 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                    {taskActionLoading === 'archive' ? <Spinner size={12} dark /> : <Archive size={13} />} Archive
                  </button>
                  <button type="button" onClick={handleDeleteTask} disabled={deleteLoading} style={{ height: 36, border: 'none', borderRadius: 8, background: deleteLoading ? '#F3A8A8' : 'linear-gradient(135deg, #EF4444, #DC2626)', color: '#FFFFFF', fontSize: 12, fontWeight: 700, cursor: deleteLoading ? 'not-allowed' : 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, opacity: deleteLoading ? 0.7 : 1 }}>
                    {deleteLoading ? <Spinner size={12} /> : <Trash2 size={13} />} Delete
                  </button>
                </div>
              )}
            </div>
          </div>
        )
      })()}

      {selectedTask && !taskViewMode && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, animation: 'overlayFadeIn 0.18s ease-out' }}>
          <div
            ref={panelRef}
            onClick={e => e.stopPropagation()}
            data-testid="task-detail-panel"
            style={{ width: 440, background: '#FFFFFF', borderRadius: 20, overflow: 'hidden', boxShadow: '0 24px 64px rgba(0,0,0,0.16), 0 4px 16px rgba(0,0,0,0.08)', animation: 'modalSlideIn 0.22s cubic-bezier(0.16,1,0.3,1)' }}
          >
            {/* Header */}
            <div style={{ padding: '18px 20px 16px', borderBottom: '1px solid #F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 32, height: 32, borderRadius: 9, background: 'linear-gradient(135deg, #F97316, #EA580C)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Pencil size={14} color="#fff" strokeWidth={2.5} />
                </div>
                <h2 style={{ fontWeight: 700, fontSize: '1rem', color: '#111827', margin: 0, fontFamily: "'Inter', system-ui, -apple-system, sans-serif" }}>Edit Task</h2>
              </div>
              <button onClick={closePanel} style={{ background: '#F9FAFB', border: '1px solid #E5E7EB', cursor: 'pointer', color: '#6B7280', display: 'flex', padding: '6px', borderRadius: 8 }}
                onMouseEnter={e => { e.currentTarget.style.background = '#F3F4F6' }}
                onMouseLeave={e => { e.currentTarget.style.background = '#F9FAFB' }}
              >
                <X size={16} />
              </button>
            </div>

            {/* Body */}
            <div style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 12, maxHeight: 'calc(90vh - 140px)', overflowY: 'auto' }}>

              {/* Title + Priority */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={modalLabelStyle}>Title</label>
                  <input autoFocus value={editTitle} onChange={e => setEditTitle(e.target.value)} placeholder="Task title..." style={modalInputStyle} onKeyDown={e => { if (e.key === 'Enter') handleSaveTask() }} />
                </div>
                <div>
                  <label style={modalLabelStyle}>Priority</label>
                  <DropdownField
                    value={editPriority}
                    options={priorityDropdownOptions}
                    onChange={v => setEditPriority(v)}
                    placeholder="Select priority"
                    badgeColors={PRIORITY_COLORS}
                  />
                </div>
              </div>

              {/* Description */}
              <div>
                <label style={modalLabelStyle}>Description</label>
                <textarea value={editDescription} onChange={e => setEditDescription(e.target.value)} onKeyDown={e => handleDescriptionKeyDown(e, editDescription, setEditDescription)} rows={2} placeholder="Add more context..." style={{ ...modalInputStyle, resize: 'vertical', lineHeight: 1.55 }} />
              </div>

              {/* Department + Assign To */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={modalLabelStyle}>Department</label>
                  <DropdownField
                    value={editDeptId}
                    options={deptDropdownOptions}
                    onChange={v => { setEditDeptId(v); setEditAssignee(''); setEditShiftId('') }}
                    placeholder="Select department"
                  />
                </div>
                <div>
                  <label style={modalLabelStyle}>Assign To</label>
                  <DropdownField
                    value={editAssignee}
                    options={editAssigneeDropdownOptions}
                    onChange={v => { setEditAssignee(v); setEditShiftId('') }}
                    placeholder="Unassigned"
                  />
                </div>
              </div>

              {/* Divider */}
              <div style={{ borderTop: '1px dashed #E5E7EB' }} />

              {/* Start Date + Deadline */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={modalLabelStyle}>Start Date</label>
                  <TaskDatePicker
                    value={editStartDate || formatDateKey(new Date())}
                    onChange={setEditStartDate}
                    taskDates={datesWithTasks}
                    minDate={todayTaskDate}
                    accentColor={TASK_ORANGE}
                    fullWidth
                  />
                </div>
                <div>
                  <label style={modalLabelStyle}>Deadline</label>
                  <DeadlinePicker
                    dateValue={editDueAt}
                    timeValue={editDeadlineTime}
                    onChange={(date, time) => { setEditDueAt(date); setEditDeadlineTime(time) }}
                    minDate={editStartDate || formatDateKey(new Date())}
                  />
                </div>
              </div>

              {/* Divider */}
              <div style={{ borderTop: '1px dashed #E5E7EB' }} />

              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ border: '1px solid #E5E7EB', borderRadius: 10, padding: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', flex: 1 }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, fontSize: '0.8125rem', color: '#374151' }}>
                        <GitBranch size={13} color={TASK_ORANGE} /> Sub Task
                        {editSubTasks.length > 0 && (
                          <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: 18, height: 18, padding: '0 5px', borderRadius: 9, background: '#FFF3E8', color: '#EA580C', fontSize: 11, fontWeight: 800 }}>
                            {editSubTasks.length}
                          </span>
                        )}
                      </span>
                      <input
                        type="checkbox"
                        checked={editSubTaskEnabled}
                        onChange={e => setEditSubTaskEnabled(e.target.checked)}
                        style={{ width: 16, height: 16, accentColor: TASK_ORANGE, cursor: 'pointer', marginLeft: 'auto' }}
                      />
                    </label>
                    {editSubTaskEnabled && editSubTasks.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setEditSubTaskCollapsed(prev => !prev)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, marginLeft: 6, display: 'flex', color: '#9CA3AF', borderRadius: 6, flexShrink: 0 }}
                      >
                        <ChevronDown size={14} style={{ transform: editSubTaskCollapsed ? 'none' : 'rotate(180deg)', transition: 'transform 0.15s' }} />
                      </button>
                    )}
                  </div>

                  {editSubTaskEnabled && !(editSubTaskCollapsed && editSubTasks.length > 0) && (
                    <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {editSubTasks.length > 0 && (
                        <div>
                          <SubTaskOrderList
                            items={editSubTasks}
                            onReorder={handleReorderSubTasks}
                            onRemove={handleRemoveSubTask}
                            onRename={handleRenameSubTask}
                          />
                        </div>
                      )}

                      <div style={{ display: 'flex', gap: 8 }}>
                        <input
                          value={subTaskTitle}
                          onChange={e => setSubTaskTitle(e.target.value)}
                          placeholder="Sub-task title..."
                          style={{ ...modalInputStyle, flex: 1, minWidth: 0, minHeight: 32, padding: '6px 10px', fontSize: 12 }}
                          onKeyDown={e => { if (e.key === 'Enter') handleCreateSubTask() }}
                        />
                        <button type="button" onClick={handleCreateSubTask} disabled={!subTaskTitle.trim()} style={{ flexShrink: 0, width: 32, height: 30, padding: 0, border: 0, borderRadius: 7, background: subTaskTitle.trim() ? 'linear-gradient(135deg, #F97316, #EA580C)' : '#E5E7EB', color: subTaskTitle.trim() ? '#FFFFFF' : '#9CA3AF', fontWeight: 700, fontSize: 12, cursor: subTaskTitle.trim() ? 'pointer' : 'not-allowed', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Plus size={14} strokeWidth={2.5} />
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                <div style={{ border: '1px solid #E5E7EB', borderRadius: 10, padding: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', flex: 1 }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, fontSize: '0.8125rem', color: '#374151' }}>
                        <Repeat size={13} color={TASK_ORANGE} /> Recurring
                      </span>
                      <input
                        type="checkbox"
                        checked={editRecurringEnabled}
                        onChange={e => setEditRecurringEnabled(e.target.checked)}
                        style={{ width: 16, height: 16, accentColor: TASK_ORANGE, cursor: 'pointer', marginLeft: 'auto' }}
                      />
                    </label>
                    {editRecurringEnabled && (
                      <button
                        type="button"
                        onClick={() => setEditRecurringCollapsed(prev => !prev)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, marginLeft: 6, display: 'flex', color: '#9CA3AF', borderRadius: 6, flexShrink: 0 }}
                      >
                        <ChevronDown size={14} style={{ transform: editRecurringCollapsed ? 'none' : 'rotate(180deg)', transition: 'transform 0.15s' }} />
                      </button>
                    )}
                  </div>
                  {editRecurringEnabled && !editRecurringCollapsed && (
                    <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                        <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          <span style={{ display: 'block', fontWeight: 600, fontSize: '0.75rem', color: '#374151' }}>Repeats</span>
                          <DropdownField
                            value={recurrenceRule}
                            options={[
                              { value: 'daily', label: 'Daily' },
                              { value: 'weekly', label: 'Weekly' },
                              { value: 'custom', label: 'Custom' },
                            ]}
                            onChange={v => setRecurrenceRule(v as TaskRecurrenceRule)}
                            placeholder="Select frequency"
                          />
                        </label>
                        <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          <span style={{ display: 'block', fontWeight: 600, fontSize: '0.75rem', color: '#374151' }}>Repeat until</span>
                          <CompactDatePicker
                            value={recurrenceEndDate}
                            onChange={setRecurrenceEndDate}
                            minDate={editStartDate || todayTaskDate}
                            accentColor={TASK_ORANGE}
                          />
                        </label>
                      </div>
                      {recurrenceRule === 'custom' && recurrenceEndDate && (
                        <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          <span style={{ display: 'block', fontWeight: 600, fontSize: '0.75rem', color: '#374151' }}>Repeat every (days)</span>
                          <input
                            type="text"
                            inputMode="numeric"
                            value={editCustomIntervalDays || ''}
                            onChange={e => {
                              const digits = e.target.value.replace(/\D/g, '')
                              setEditCustomIntervalDays(digits === '' ? 0 : Number(digits))
                              setEditCustomIntervalTouched(true)
                            }}
                            onBlur={() => setEditCustomIntervalDays(prev => Math.min(31, Math.max(1, prev || 1)))}
                            style={{ ...modalInputStyle, minHeight: 40, padding: '9px 12px', fontSize: '0.8125rem' }}
                          />
                        </label>
                      )}
                      {recurrenceRule && recurrenceEndDate && (recurrenceRule !== 'custom' || editCustomIntervalTouched) && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, minWidth: 0, borderTop: '1px dashed #E5E7EB', paddingTop: 10 }}>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                            <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                              <span style={{ display: 'block', fontWeight: 600, fontSize: '0.75rem', color: '#374151' }}>Deadline rule</span>
                              <DropdownField
                                value={editDeadlineRuleType}
                                options={[
                                  { value: 'same_day', label: 'Same day' },
                                  ...(recurrenceRule === 'weekly' ? [{ value: 'fixed_day', label: 'Fixed day' }] : []),
                                  { value: 'relative', label: 'Relative' },
                                ]}
                                onChange={v => setEditDeadlineRuleType(v as TaskDeadlineRuleType)}
                                placeholder="Select deadline rule"
                              />
                            </label>

                            {editDeadlineRuleType === 'same_day' && (
                              <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                <span style={{ display: 'block', fontWeight: 600, fontSize: '0.75rem', color: '#374151' }}>Due at</span>
                                <DropdownField
                                  value={editDeadlineRuleTime}
                                  options={TIME_OPTIONS}
                                  onChange={setEditDeadlineRuleTime}
                                  placeholder="Select time"
                                />
                              </label>
                            )}

                            {editDeadlineRuleType === 'fixed_day' && (
                              <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                <span style={{ display: 'block', fontWeight: 600, fontSize: '0.75rem', color: '#374151' }}>At</span>
                                <DropdownField
                                  value={editDeadlineRuleTime}
                                  options={TIME_OPTIONS}
                                  onChange={setEditDeadlineRuleTime}
                                  placeholder="Select time"
                                />
                              </label>
                            )}

                            {editDeadlineRuleType === 'relative' && (
                              <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                <span style={{ display: 'block', fontWeight: 600, fontSize: '0.75rem', color: '#374151' }}>Due within</span>
                                <input
                                  type="text"
                                  inputMode="numeric"
                                  value={editDeadlineRuleOffsetAmount || ''}
                                  onChange={e => {
                                    const digits = e.target.value.replace(/\D/g, '')
                                    setEditDeadlineRuleOffsetAmount(digits === '' ? 0 : Number(digits))
                                  }}
                                  onBlur={() => setEditDeadlineRuleOffsetAmount(prev => Math.max(1, prev || 1))}
                                  style={{ ...modalInputStyle, minHeight: 40, padding: '9px 12px', fontSize: '0.8125rem' }}
                                />
                              </label>
                            )}
                          </div>

                          {editDeadlineRuleType === 'fixed_day' && (
                            <div>
                              <span style={{ display: 'block', fontWeight: 600, fontSize: '0.75rem', color: '#374151', marginBottom: 6 }}>Due every</span>
                              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                {WEEKDAY_LABELS.map((label, weekday) => {
                                  const active = editDeadlineRuleWeekday === weekday
                                  return (
                                    <button
                                      key={weekday}
                                      type="button"
                                      onClick={() => setEditDeadlineRuleWeekday(weekday)}
                                      style={{ width: 34, height: 30, border: active ? `1.5px solid ${TASK_ORANGE}` : '1.5px solid #E5E7EB', background: active ? '#FFF7ED' : '#FFFFFF', color: active ? TASK_ORANGE : '#374151', borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                                    >
                                      {label}
                                    </button>
                                  )
                                })}
                              </div>
                            </div>
                          )}

                          {editDeadlineRuleType === 'relative' && (
                            <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                              <span style={{ display: 'block', fontWeight: 600, fontSize: '0.75rem', color: '#374151' }}>Unit</span>
                              <DropdownField
                                value={editDeadlineRuleOffsetUnit}
                                options={[{ value: 'days', label: 'Days' }, { value: 'hours', label: 'Hours' }]}
                                onChange={v => setEditDeadlineRuleOffsetUnit(v as 'hours' | 'days')}
                              />
                            </label>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {editRecurringEnabled && editRecurringPreviewDates.length > 0 && (
                  <div>
                    <p style={{ margin: '0 0 10px', fontWeight: 600, fontSize: '0.875rem', color: '#374151' }}>Preview</p>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
                      {[originalTaskDateForEdit, ...editRecurringPreviewDates].map((date, idx) => {
                        const isOriginal = idx === 0
                        const isCurrentlyEditing = date === editStartDate
                        const deadlinePreview = isOriginal
                          ? (editDeadlineRuleType ? previewDeadlineForEdit(date) : null)
                          : previewDeadlineForEdit(date)
                        const d = new Date(`${date}T00:00:00`)
                        const dateLabel = `${d.toLocaleDateString('en-US', { weekday: 'short' })}, ${d.toLocaleDateString('en-US', { month: 'long' })} ${d.getDate()}`
                        return (
                          <div key={date} style={{ border: isCurrentlyEditing ? `1.5px solid ${TASK_ORANGE}` : '1px solid #E5E7EB', borderRadius: 10, padding: '9px 10px', background: '#FFFFFF' }}>
                            <p style={{ margin: '0 0 7px', fontSize: 11, fontWeight: 600, color: TASK_TEXT }}>{dateLabel}</p>
                            {deadlinePreview && (
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 8px', border: '1px solid #E5E7EB', borderRadius: 8, background: '#FFFFFF', fontSize: 11, fontWeight: 600, color: TASK_TEXT }}>
                                <Clock size={11} color="#9CA3AF" /> {deadlinePreview}
                              </div>
                            )}
                            <p style={{ margin: '6px 0 0', fontSize: 10.5, color: isOriginal ? TASK_ORANGE : '#B45309', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 3 }}>
                              {isOriginal ? <><GitBranch size={10} /> Main Task</> : <><Repeat size={10} /> Auto-generated</>}
                              {isCurrentlyEditing && !isOriginal && <span style={{ marginLeft: 4, color: TASK_ORANGE }}>· Editing</span>}
                            </p>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>

              <InlineError message={panelError} />
            </div>

            {/* Footer */}
            <div style={{ padding: '0 20px 18px', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8 }}>
              <button
                type="button"
                onClick={handleSaveTask}
                disabled={editLoading || !isEditTaskValid || !isEditRecurringFormValid}
                style={{ padding: '7px 18px', background: (!isEditTaskValid || !isEditRecurringFormValid) ? '#E5E7EB' : editLoading ? '#FDA060' : 'linear-gradient(135deg, #F97316, #EA580C)', border: 'none', borderRadius: 8, fontWeight: 600, fontSize: '0.8125rem', color: (!isEditTaskValid || !isEditRecurringFormValid) ? '#9CA3AF' : '#FFFFFF', cursor: editLoading || !isEditTaskValid || !isEditRecurringFormValid ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 6, opacity: editLoading ? 0.65 : 1 }}
              >
                {editLoading ? <Spinner size={13} /> : <Check size={13} />} Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════ DELETE TASK MODAL ═══════════════ */}
      {workloadInsightOpen && workloadSuggestions.length > 0 && (
        <div
          onClick={() => setWorkloadInsightOpen(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 18, zIndex: 110, animation: 'overlayFadeIn 0.18s ease-out' }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="workload-suggestion-title"
            onClick={e => e.stopPropagation()}
            style={{ width: 'min(560px, calc(100vw - 36px))', maxHeight: '88vh', background: '#FFFFFF', borderRadius: 20, overflow: 'hidden', boxShadow: '0 24px 64px rgba(0,0,0,0.16), 0 4px 16px rgba(0,0,0,0.08)', animation: 'modalSlideIn 0.22s cubic-bezier(0.16,1,0.3,1)', display: 'flex', flexDirection: 'column' }}
          >
            <div style={{ padding: '18px 20px 16px', borderBottom: '1px solid #F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 32, height: 32, borderRadius: 9, background: 'linear-gradient(135deg, #F97316, #EA580C)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <AlertTriangle size={15} color="#fff" strokeWidth={2.5} />
                </div>
                <h2 id="workload-suggestion-title" style={{ fontWeight: 700, fontSize: '1rem', color: '#111827', margin: 0, fontFamily: "'Inter', system-ui, -apple-system, sans-serif" }}>
                  Workload Suggestion
                </h2>
              </div>
              <button onClick={() => setWorkloadInsightOpen(false)} style={{ background: '#F9FAFB', border: '1px solid #E5E7EB', cursor: 'pointer', color: '#6B7280', display: 'flex', padding: '6px', borderRadius: 8 }}
                onMouseEnter={e => { e.currentTarget.style.background = '#F3F4F6' }}
                onMouseLeave={e => { e.currentTarget.style.background = '#F9FAFB' }}
              >
                <X size={16} />
              </button>
            </div>

            <div style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 10, overflowY: 'auto' }}>
              {workloadSuggestions.map(suggestion => {
                const recommendedMember = members.find(m => m.id === suggestion.recommended_user_id)
                const recommendedName = recommendedMember?.full_name ?? 'another manager'
                const suggestedTask = allKanbanTasks.find(task => task.id === suggestion.suggested_task_id)
                const loading = workloadApplyLoadingId === suggestion.suggested_task_id
                return (
                  <div key={`${suggestion.department_id}-${suggestion.suggested_task_id}`} style={{ border: '1px solid #E5E7EB', borderRadius: 10, padding: 10, background: '#FFFFFF' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '260px 40px 150px', alignItems: 'stretch', justifyContent: 'center', gap: 12 }}>
                      <div style={{ minWidth: 0 }}>
                        {suggestedTask ? (
                          <TaskCard
                            task={suggestedTask}
                            members={members}
                            shiftOptions={shiftOptions}
                            departments={departments}
                            showDept
                            onClick={() => {}}
                            onEdit={() => {}}
                            clickable={false}
                            isOwner={false}
                            noOuterMargin
                            fillHeight
                          />
                        ) : (
                          <div className="task-card" style={{ height: '100%', boxSizing: 'border-box', background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: 10, padding: '16px 16px', color: TASK_TEXT, fontSize: 14, fontWeight: 800 }}>
                            {suggestion.suggested_task_title ?? 'Task'}
                          </div>
                        )}
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <button
                          type="button"
                          title="Reassign task"
                          aria-label={`Reassign task to ${recommendedName}`}
                          onClick={() => handleApplyWorkloadSuggestion(suggestion)}
                          disabled={!!workloadApplyLoadingId || !suggestion.suggested_task_id || !suggestion.recommended_user_id}
                          style={{ width: 36, height: 36, border: '1px solid #FED7AA', borderRadius: 8, background: loading ? '#FFEDD5' : '#FFF7ED', color: '#EA580C', cursor: workloadApplyLoadingId ? 'default' : 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: 0, opacity: (!suggestion.suggested_task_id || !suggestion.recommended_user_id) ? 0.55 : 1, transition: 'opacity 0.18s ease, box-shadow 0.18s ease, background 0.18s ease' }}
                        >
                          {loading ? <Spinner size={13} /> : <ArrowRightLeft size={15} />}
                        </button>
                      </div>

                      <div style={{ minWidth: 0, width: 150, justifySelf: 'stretch', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 7 }}>
                        <p style={{ margin: 0, width: '100%', fontSize: 10, fontWeight: 800, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.02em', lineHeight: 1.15, textAlign: 'center', whiteSpace: 'nowrap' }}>Reassign Suggestion</p>
                        <button
                          type="button"
                          aria-label={`Open ${recommendedName} profile`}
                          onClick={() => { if (recommendedMember) setProfileMember(recommendedMember) }}
                          className="internal-member-card"
                          style={{ width: 126, height: 128, padding: '10px 8px', borderRadius: 8, border: '1.5px solid #E5E7EB', background: '#FFFFFF', boxShadow: '0 1px 3px rgba(15,23,42,0.06)', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', cursor: recommendedMember ? 'pointer' : 'default', textAlign: 'center', transition: 'box-shadow 0.22s ease, border-color 0.22s ease, transform 0.22s ease, background 0.22s ease' }}
                          onMouseEnter={e => { if (recommendedMember) { e.currentTarget.style.borderColor = '#E5E7EB'; e.currentTarget.style.boxShadow = '0 3px 10px rgba(0,0,0,0.10)'; e.currentTarget.style.background = '#FFFFFF' } }}
                          onMouseLeave={e => { e.currentTarget.style.borderColor = '#E5E7EB'; e.currentTarget.style.boxShadow = '0 1px 3px rgba(15,23,42,0.06)'; e.currentTarget.style.background = '#FFFFFF' }}
                        >
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, width: '100%' }}>
                            <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 64, height: 64, borderRadius: 999, background: recommendedMember?.profile_photo_url ? 'transparent' : '#FFF7ED', color: '#EA580C', flexShrink: 0, overflow: 'hidden' }}>
                              {recommendedMember?.profile_photo_url
                                ? <img src={recommendedMember.profile_photo_url} alt={recommendedName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                : <UserCog size={30} />}
                            </span>
                            <p style={{ fontWeight: 700, fontSize: '0.875rem', color: '#0F172A', margin: 0, lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%' }}>
                              {recommendedName}
                            </p>
                          </div>
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
              {workloadApplyError && (
                <div style={{ border: '1px solid #FECACA', background: '#FEF2F2', color: '#B91C1C', borderRadius: 8, padding: '9px 11px', fontSize: 12, fontWeight: 700 }}>
                  {workloadApplyError}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ─────────────── MEMBER PROFILE MODAL ─────────────── */}
      {profileMember && (
        <div
          onClick={() => setProfileMember(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 18, zIndex: 130, animation: 'overlayFadeIn 0.18s ease-out' }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="workload-member-profile-title"
            onClick={e => e.stopPropagation()}
            style={{ width: 'min(420px, calc(100vw - 36px))', maxHeight: '88vh', overflowY: 'auto', background: '#FFFFFF', borderRadius: 20, overflow: 'hidden', boxShadow: '0 24px 64px rgba(0,0,0,0.16), 0 4px 16px rgba(0,0,0,0.08)', animation: 'modalSlideIn 0.22s cubic-bezier(0.16,1,0.3,1)' }}
          >
            <div style={{ padding: '18px 20px 16px', borderBottom: '1px solid #F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 32, height: 32, borderRadius: 9, background: 'linear-gradient(135deg, #F97316, #EA580C)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <UserRound size={15} color="#fff" strokeWidth={2.5} />
                </div>
                <h2 id="workload-member-profile-title" style={{ fontWeight: 700, fontSize: '1rem', color: '#111827', margin: 0, fontFamily: "'Inter', system-ui, -apple-system, sans-serif" }}>
                  Member Profile
                </h2>
              </div>
              <button
                type="button"
                aria-label="Close member profile"
                onClick={() => setProfileMember(null)}
                style={{ background: '#F9FAFB', border: '1px solid #E5E7EB', cursor: 'pointer', color: '#6B7280', display: 'flex', padding: '6px', borderRadius: 8 }}
                onMouseEnter={e => { e.currentTarget.style.background = '#F3F4F6' }}
                onMouseLeave={e => { e.currentTarget.style.background = '#F9FAFB' }}
              >
                <X size={16} />
              </button>
            </div>

            <div style={{ padding: '16px 24px', borderBottom: '1px solid #F3F4F6', display: 'flex', alignItems: 'center', gap: 14 }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 44, height: 44, borderRadius: 999, background: profileMember.profile_photo_url ? 'transparent' : '#FFF7ED', color: '#EA580C', flexShrink: 0, overflow: 'hidden' }}>
                {profileMember.profile_photo_url
                  ? <img src={profileMember.profile_photo_url} alt={profileMember.full_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : profileMember.role === 'Employee' ? <UserRound size={19} /> : <UserCog size={19} />}
              </span>
              <div>
                <p style={{ fontWeight: 700, fontSize: '1rem', color: '#0F172A', margin: '0 0 5px' }}>{profileMember.full_name}</p>
                <span style={{
                  display: 'inline-block',
                  padding: '3px 10px',
                  borderRadius: 999,
                  fontSize: '0.6875rem',
                  fontWeight: 700,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  background: profileMember.role === 'Owner' || profileMember.role === 'Partner' ? '#0F172A' :
                    profileMember.role === 'Manager' ? '#FFF7ED' :
                    profileMember.role === 'Employee' ? '#F3F4F6' : '#EFF6FF',
                  color: profileMember.role === 'Owner' || profileMember.role === 'Partner' ? '#FFFFFF' :
                    profileMember.role === 'Manager' ? '#EA580C' :
                    profileMember.role === 'Employee' ? '#4B5563' : '#2563EB',
                }}>
                  {profileMember.role}
                </span>
              </div>
            </div>

            <div style={{ padding: '0 24px 20px', display: 'flex', flexDirection: 'column' }}>
              {[
                { label: 'Email Address', value: profileMember.email_address ?? '—' },
                { label: 'Date of Birth', value: formatDateDisplay(profileMember.date_of_birth) },
                { label: 'Phone Number', value: profileMember.phone_number ?? '—' },
                { label: 'Joined On', value: formatDateDisplay(profileMember.created_at) },
                { label: 'Department', value: departments.find(d => d.id === profileMember.department_id)?.name ?? '—' },
              ].map(field => (
                <div key={field.label} style={{ padding: '14px 0', borderBottom: '1px solid #F3F4F6' }}>
                  <label style={{ display: 'block', fontWeight: 700, fontSize: '0.8125rem', color: '#374151', marginBottom: 4 }}>{field.label}</label>
                  <p style={{ fontSize: '0.9375rem', color: '#111827', margin: 0, fontFamily: "'Inter', system-ui, sans-serif" }}>{field.value}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {deleteTaskModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)', backdropFilter: 'blur(4px)', display: 'grid', placeItems: 'center', padding: 18, zIndex: 100, animation: 'overlayFadeIn 0.18s ease-out' }}>
          <div onClick={e => e.stopPropagation()} style={{ width: 'min(480px, 100%)', maxHeight: '88vh', overflowY: 'auto', background: '#FFFFFF', borderRadius: 16, border: '1px solid #E2E8F0', boxShadow: '0 24px 70px rgba(15,23,42,0.32)', padding: 16, animation: 'modalSlideIn 0.22s cubic-bezier(0.16,1,0.3,1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', marginBottom: 16 }}>
              <h2 style={{ margin: 0, color: TASK_TEXT, fontSize: 16, fontWeight: 700 }}>Delete Task</h2>
              <button type="button" onClick={() => setDeleteTaskModal(null)} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 34, height: 34, border: `1px solid ${TASK_BORDER}`, borderRadius: 9, background: '#FFFFFF', cursor: 'pointer', color: TASK_TEXT }}><X size={16} /></button>
            </div>
            <p style={{ color: '#64748B', marginTop: 0, fontSize: 13, whiteSpace: 'nowrap' }}>Are you sure you want to delete <strong style={{ color: TASK_TEXT }}>{deleteTaskModal.title}</strong>?</p>
            {deleteTaskError && <div style={{ border: '1px solid #FECACA', background: '#FEF2F2', color: '#B91C1C', borderRadius: 10, padding: '10px 12px', fontSize: '0.82rem', fontWeight: 700, marginBottom: 12 }}>{deleteTaskError}</div>}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 10, marginTop: 18 }}>
              <button type="button" onClick={() => setDeleteTaskModal(null)} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7, border: `1px solid ${TASK_BORDER}`, borderRadius: 10, background: '#FFFFFF', color: TASK_TEXT, height: 36, padding: '0 12px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Cancel</button>
              <button type="button" onClick={handleDeleteTaskDirect} disabled={deleteTaskLoading} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7, border: 0, borderRadius: 10, background: '#DC2626', color: '#FFFFFF', height: 36, padding: '0 12px', fontSize: 13, fontWeight: 700, cursor: deleteTaskLoading ? 'default' : 'pointer', opacity: deleteTaskLoading ? 0.65 : 1 }}>{deleteTaskLoading ? null : <Trash2 size={16} />} Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════ NEW TASK MODAL ═══════════════ */}
      {newTaskModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, animation: 'overlayFadeIn 0.18s ease-out' }}>
          <div onClick={e => e.stopPropagation()} style={{ width: 440, background: '#FFFFFF', borderRadius: 20, overflow: 'hidden', boxShadow: '0 24px 64px rgba(0,0,0,0.16), 0 4px 16px rgba(0,0,0,0.08)', animation: 'modalSlideIn 0.22s cubic-bezier(0.16,1,0.3,1)' }}>

            {/* Header */}
            <div style={{ padding: '18px 20px 16px', borderBottom: '1px solid #F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 32, height: 32, borderRadius: 9, background: 'linear-gradient(135deg, #F97316, #EA580C)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <AlertCircle size={15} color="#fff" strokeWidth={2.5} />
                </div>
                <h2 style={{ fontWeight: 700, fontSize: '1rem', color: '#111827', margin: 0, fontFamily: "'Inter', system-ui, -apple-system, sans-serif" }}>
                  {newAssigneeMember ? `Assign Task to ${newAssigneeMember.full_name}` : 'New Task'}
                </h2>
              </div>
              <button onClick={() => setNewTaskModal(false)} style={{ background: '#F9FAFB', border: '1px solid #E5E7EB', cursor: 'pointer', color: '#6B7280', display: 'flex', padding: '6px', borderRadius: 8 }}
                onMouseEnter={e => { e.currentTarget.style.background = '#F3F4F6' }}
                onMouseLeave={e => { e.currentTarget.style.background = '#F9FAFB' }}
              >
                <X size={16} />
              </button>
            </div>

            {/* Body */}
            <div style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>

              {/* Use Template */}
              {templateDropdownOptions.length > 0 && (
                <div>
                  <label style={modalLabelStyle}>Use Template</label>
                  <DropdownField
                    value={newTemplateId}
                    options={templateDropdownOptions}
                    onChange={v => {
                      setNewTemplateId(v)
                      const template = taskTemplates.find(t => t.id === v)
                      if (!template) return
                      setNewTitle(template.title)
                      setNewDescription(template.description ?? '')
                      setNewPriority(template.priority ?? '')
                    }}
                    placeholder="Use a template…"
                  />
                </div>
              )}

              {/* Title + Priority */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={modalLabelStyle}>Title</label>
                  <input autoFocus value={newTitle} onChange={e => setNewTitle(e.target.value)} placeholder="Task title..." style={modalInputStyle} onKeyDown={e => { if (e.key === 'Enter') handleCreateTask() }} />
                </div>
                <div>
                  <label style={modalLabelStyle}>Priority</label>
                  <DropdownField
                    value={newPriority}
                    options={priorityDropdownOptions}
                    onChange={v => setNewPriority(v)}
                    placeholder="Select priority"
                    badgeColors={PRIORITY_COLORS}
                  />
                </div>
              </div>

              {/* Description */}
              <div>
                <label style={modalLabelStyle}>Description</label>
                <textarea value={newDescription} onChange={e => setNewDescription(e.target.value)} onKeyDown={e => handleDescriptionKeyDown(e, newDescription, setNewDescription)} rows={2} placeholder="Add more context..." style={{ ...modalInputStyle, resize: 'vertical', lineHeight: 1.55 }} />
              </div>

              {/* Divider */}
              <div style={{ borderTop: '1px dashed #E5E7EB' }} />

              {/* Start Date + Deadline (Deadline replaced by the Deadline Rule picker below once Recurring is on) */}
              <div style={newRecurringEnabled ? undefined : { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={modalLabelStyle}>Start Date</label>
                  <TaskDatePicker
                    value={newStartDate || formatDateKey(new Date())}
                    onChange={setNewStartDate}
                    taskDates={datesWithTasks}
                    minDate={todayTaskDate}
                    accentColor={TASK_ORANGE}
                    fullWidth
                  />
                </div>
                {!newRecurringEnabled && (
                  <div>
                    <label style={modalLabelStyle}>Deadline</label>
                    <DeadlinePicker
                      dateValue={newDeadlineDate}
                      timeValue={newDeadlineTime}
                      onChange={(date, time) => { setNewDeadlineDate(date); setNewDeadlineTime(time) }}
                      minDate={newStartDate || formatDateKey(new Date())}
                    />
                  </div>
                )}
              </div>

              {/* Divider */}
              <div style={{ borderTop: '1px dashed #E5E7EB' }} />

              {/* Sub Task + Recurring toggles */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ border: '1px solid #E5E7EB', borderRadius: 10, padding: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', flex: 1 }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, fontSize: '0.8125rem', color: '#374151' }}>
                        <GitBranch size={13} color={TASK_ORANGE} /> Sub Task
                        {newSubTasks.length > 0 && (
                          <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: 18, height: 18, padding: '0 5px', borderRadius: 9, background: '#FFF3E8', color: '#EA580C', fontSize: 11, fontWeight: 800 }}>
                            {newSubTasks.length}
                          </span>
                        )}
                      </span>
                      <input
                        type="checkbox"
                        checked={newSubTaskEnabled}
                        onChange={e => setNewSubTaskEnabled(e.target.checked)}
                        style={{ width: 16, height: 16, accentColor: TASK_ORANGE, cursor: 'pointer', marginLeft: 'auto' }}
                      />
                    </label>
                    {newSubTaskEnabled && newSubTasks.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setNewSubTaskCollapsed(prev => !prev)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, marginLeft: 6, display: 'flex', color: '#9CA3AF', borderRadius: 6, flexShrink: 0 }}
                      >
                        <ChevronDown size={14} style={{ transform: newSubTaskCollapsed ? 'none' : 'rotate(180deg)', transition: 'transform 0.15s' }} />
                      </button>
                    )}
                  </div>

                  {newSubTaskEnabled && !(newSubTaskCollapsed && newSubTasks.length > 0) && (
                    <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {newSubTasks.length > 0 && (
                        <SubTaskOrderList
                          items={newSubTasks}
                          onReorder={orderedIds => setNewSubTasks(prev => orderedIds.map(id => prev.find(s => s.id === id)!))}
                          onRemove={id => setNewSubTasks(prev => prev.filter(s => s.id !== id))}
                          onRename={(id, title) => setNewSubTasks(prev => prev.map(s => s.id === id ? { ...s, title } : s))}
                        />
                      )}
                      <div style={{ display: 'flex', gap: 8 }}>
                        <input
                          value={newSubTaskDraft}
                          onChange={e => setNewSubTaskDraft(e.target.value)}
                          placeholder="Sub-task title..."
                          style={{ ...modalInputStyle, flex: 1, minWidth: 0, minHeight: 32, padding: '6px 10px', fontSize: 12 }}
                          onKeyDown={e => {
                            if (e.key !== 'Enter' || !newSubTaskDraft.trim()) return
                            e.preventDefault()
                            setNewSubTasks(prev => [...prev, { id: crypto.randomUUID(), title: newSubTaskDraft.trim() }])
                            setNewSubTaskDraft('')
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => {
                            if (!newSubTaskDraft.trim()) return
                            setNewSubTasks(prev => [...prev, { id: crypto.randomUUID(), title: newSubTaskDraft.trim() }])
                            setNewSubTaskDraft('')
                          }}
                          disabled={!newSubTaskDraft.trim()}
                          style={{ flexShrink: 0, width: 32, height: 30, padding: 0, border: 'none', borderRadius: 7, background: newSubTaskDraft.trim() ? 'linear-gradient(135deg, #F97316, #EA580C)' : '#E5E7EB', color: newSubTaskDraft.trim() ? '#FFFFFF' : '#9CA3AF', fontWeight: 700, fontSize: 12, cursor: newSubTaskDraft.trim() ? 'pointer' : 'not-allowed', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                        >
                          <Plus size={14} strokeWidth={2.5} />
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                <div style={{ border: '1px solid #E5E7EB', borderRadius: 10, padding: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', flex: 1 }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, fontSize: '0.8125rem', color: '#374151' }}>
                        <Repeat size={13} color={TASK_ORANGE} /> Recurring
                      </span>
                      <input
                        type="checkbox"
                        checked={newRecurringEnabled}
                        onChange={e => setNewRecurringEnabled(e.target.checked)}
                        style={{ width: 16, height: 16, accentColor: TASK_ORANGE, cursor: 'pointer', marginLeft: 'auto' }}
                      />
                    </label>
                    {newRecurringEnabled && (
                      <button
                        type="button"
                        onClick={() => setNewRecurringCollapsed(prev => !prev)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, marginLeft: 6, display: 'flex', color: '#9CA3AF', borderRadius: 6, flexShrink: 0 }}
                      >
                        <ChevronDown size={14} style={{ transform: newRecurringCollapsed ? 'none' : 'rotate(180deg)', transition: 'transform 0.15s' }} />
                      </button>
                    )}
                  </div>

                  {newRecurringEnabled && !newRecurringCollapsed && (
                    <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                        <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          <span style={{ display: 'block', fontWeight: 600, fontSize: '0.75rem', color: '#374151' }}>Repeats</span>
                          <DropdownField
                            value={newRecurrenceRule}
                            options={[
                              { value: 'daily', label: 'Daily' },
                              { value: 'weekly', label: 'Weekly' },
                              { value: 'custom', label: 'Custom' },
                            ]}
                            onChange={v => setNewRecurrenceRule(v as TaskRecurrenceRule)}
                            placeholder="Select frequency"
                          />
                        </label>
                        <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          <span style={{ display: 'block', fontWeight: 600, fontSize: '0.75rem', color: '#374151' }}>Repeat until</span>
                          <CompactDatePicker
                            value={newRecurrenceEndDate}
                            onChange={setNewRecurrenceEndDate}
                            minDate={newStartDate || todayTaskDate}
                            accentColor={TASK_ORANGE}
                          />
                        </label>
                      </div>
                      {newRecurrenceRule === 'custom' && newRecurrenceEndDate && (
                        <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          <span style={{ display: 'block', fontWeight: 600, fontSize: '0.75rem', color: '#374151' }}>Repeat every (days)</span>
                          <input
                            type="text"
                            inputMode="numeric"
                            value={newCustomIntervalDays || ''}
                            onChange={e => {
                              const digits = e.target.value.replace(/\D/g, '')
                              setNewCustomIntervalDays(digits === '' ? 0 : Number(digits))
                              setNewCustomIntervalTouched(true)
                            }}
                            onBlur={() => setNewCustomIntervalDays(prev => Math.min(31, Math.max(1, prev || 1)))}
                            style={{ ...modalInputStyle, minHeight: 40, padding: '9px 12px', fontSize: '0.8125rem' }}
                          />
                        </label>
                      )}
                      {newRecurrenceRule && newRecurrenceEndDate && (newRecurrenceRule !== 'custom' || newCustomIntervalTouched) && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, minWidth: 0, borderTop: '1px dashed #E5E7EB', paddingTop: 10 }}>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                            <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                              <span style={{ display: 'block', fontWeight: 600, fontSize: '0.75rem', color: '#374151' }}>Deadline rule</span>
                              <DropdownField
                                value={newDeadlineRuleType}
                                options={[
                                  { value: 'same_day', label: 'Same day' },
                                  ...(newRecurrenceRule === 'weekly' ? [{ value: 'fixed_day', label: 'Fixed day' }] : []),
                                  { value: 'relative', label: 'Relative' },
                                ]}
                                onChange={v => setNewDeadlineRuleType(v as TaskDeadlineRuleType)}
                                placeholder="Select deadline rule"
                              />
                            </label>

                            {newDeadlineRuleType === 'same_day' && (
                              <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                <span style={{ display: 'block', fontWeight: 600, fontSize: '0.75rem', color: '#374151' }}>Due at</span>
                                <DropdownField
                                  value={newDeadlineRuleTime}
                                  options={TIME_OPTIONS}
                                  onChange={setNewDeadlineRuleTime}
                                  placeholder="Select time"
                                />
                              </label>
                            )}

                            {newDeadlineRuleType === 'fixed_day' && (
                              <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                <span style={{ display: 'block', fontWeight: 600, fontSize: '0.75rem', color: '#374151' }}>At</span>
                                <DropdownField
                                  value={newDeadlineRuleTime}
                                  options={TIME_OPTIONS}
                                  onChange={setNewDeadlineRuleTime}
                                  placeholder="Select time"
                                />
                              </label>
                            )}

                            {newDeadlineRuleType === 'relative' && (
                              <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                <span style={{ display: 'block', fontWeight: 600, fontSize: '0.75rem', color: '#374151' }}>Due within</span>
                                <input
                                  type="text"
                                  inputMode="numeric"
                                  value={newDeadlineRuleOffsetAmount || ''}
                                  onChange={e => {
                                    const digits = e.target.value.replace(/\D/g, '')
                                    setNewDeadlineRuleOffsetAmount(digits === '' ? 0 : Number(digits))
                                  }}
                                  onBlur={() => setNewDeadlineRuleOffsetAmount(prev => Math.max(1, prev || 1))}
                                  style={{ ...modalInputStyle, minHeight: 40, padding: '9px 12px', fontSize: '0.8125rem' }}
                                />
                              </label>
                            )}
                          </div>

                          {newDeadlineRuleType === 'fixed_day' && (
                            <div>
                              <span style={{ display: 'block', fontWeight: 600, fontSize: '0.75rem', color: '#374151', marginBottom: 6 }}>Due every</span>
                              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                {WEEKDAY_LABELS.map((label, weekday) => {
                                  const active = newDeadlineRuleWeekday === weekday
                                  return (
                                    <button
                                      key={weekday}
                                      type="button"
                                      onClick={() => setNewDeadlineRuleWeekday(weekday)}
                                      style={{ width: 34, height: 30, border: active ? `1.5px solid ${TASK_ORANGE}` : '1.5px solid #E5E7EB', background: active ? '#FFF7ED' : '#FFFFFF', color: active ? TASK_ORANGE : '#374151', borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                                    >
                                      {label}
                                    </button>
                                  )
                                })}
                              </div>
                            </div>
                          )}

                          {newDeadlineRuleType === 'relative' && (
                            <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                              <span style={{ display: 'block', fontWeight: 600, fontSize: '0.75rem', color: '#374151' }}>Unit</span>
                              <DropdownField
                                value={newDeadlineRuleOffsetUnit}
                                options={[{ value: 'days', label: 'Days' }, { value: 'hours', label: 'Hours' }]}
                                onChange={v => setNewDeadlineRuleOffsetUnit(v as 'hours' | 'days')}
                              />
                            </label>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {newRecurringEnabled && newRecurringPreviewDates.length > 0 && (
                  <div>
                    <p style={{ margin: '0 0 10px', fontWeight: 600, fontSize: '0.875rem', color: '#374151' }}>Preview</p>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
                      {[newStartDate, ...newRecurringPreviewDates].map((date, idx) => {
                        const isOriginal = idx === 0
                        const deadlinePreview = isOriginal
                          ? (newDeadlineRuleType ? previewDeadlineFor(date) : null)
                          : previewDeadlineFor(date)
                        const d = new Date(`${date}T00:00:00`)
                        const dateLabel = `${d.toLocaleDateString('en-US', { weekday: 'short' })}, ${d.toLocaleDateString('en-US', { month: 'long' })} ${d.getDate()}`
                        return (
                          <div key={date} style={{ border: '1px solid #E5E7EB', borderRadius: 10, padding: '9px 10px', background: '#FFFFFF' }}>
                            <p style={{ margin: '0 0 7px', fontSize: 11, fontWeight: 600, color: TASK_TEXT }}>{dateLabel}</p>
                            {deadlinePreview && (
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 8px', border: '1px solid #E5E7EB', borderRadius: 8, background: '#FFFFFF', fontSize: 11, fontWeight: 600, color: TASK_TEXT }}>
                                <Clock size={11} color="#9CA3AF" /> {deadlinePreview}
                              </div>
                            )}
                            <p style={{ margin: '6px 0 0', fontSize: 10.5, color: isOriginal ? TASK_ORANGE : '#B45309', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 3 }}>
                              {isOriginal ? <><GitBranch size={10} /> Main Task</> : <><Repeat size={10} /> Auto-generated</>}
                            </p>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>

            </div>

            <InlineError message={newError} />

            {/* Footer */}
            <div style={{ padding: '0 20px 18px', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button
                type="button"
                onClick={handleCreateTask}
                disabled={newLoading || !isNewTaskValid}
                style={{ padding: '7px 18px', background: !isNewTaskValid ? '#E5E7EB' : newLoading ? '#FDA060' : 'linear-gradient(135deg, #F97316, #EA580C)', border: 'none', borderRadius: 8, fontWeight: 600, fontSize: '0.8125rem', color: !isNewTaskValid ? '#9CA3AF' : '#FFFFFF', cursor: newLoading || !isNewTaskValid ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 6, opacity: newLoading ? 0.65 : 1 }}
              >
                {newLoading ? <Spinner size={13} /> : <Check size={13} />} Create Task
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════ ARCHIVED TASKS MODAL ═══════════════ */}
      {archiveModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, animation: 'overlayFadeIn 0.18s ease-out' }}>
          <div onClick={e => e.stopPropagation()} style={{ width: 460, maxWidth: 'calc(100vw - 48px)', maxHeight: '88vh', overflowY: 'auto', background: '#FFFFFF', borderRadius: 20, overflow: 'hidden', boxShadow: '0 24px 64px rgba(0,0,0,0.16), 0 4px 16px rgba(0,0,0,0.08)', animation: 'modalSlideIn 0.22s cubic-bezier(0.16,1,0.3,1)' }}>
            <div style={{ padding: '18px 20px 16px', borderBottom: '1px solid #F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 32, height: 32, borderRadius: 9, background: 'linear-gradient(135deg, #F97316, #EA580C)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Archive size={15} color="#fff" strokeWidth={2.5} />
                </div>
                <h2 style={{ fontWeight: 700, fontSize: '1rem', color: '#111827', margin: 0, fontFamily: "'Inter', system-ui, -apple-system, sans-serif" }}>Archived Tasks</h2>
              </div>
              <button onClick={() => setArchiveModalOpen(false)} style={{ background: '#F9FAFB', border: '1px solid #E5E7EB', cursor: 'pointer', color: '#6B7280', display: 'flex', padding: '6px', borderRadius: 8 }}
                onMouseEnter={e => { e.currentTarget.style.background = '#F3F4F6' }}
                onMouseLeave={e => { e.currentTarget.style.background = '#F9FAFB' }}
              >
                <X size={16} />
              </button>
            </div>

            <div style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              {archiveListLoading ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: 18 }}><Spinner size={16} dark /></div>
              ) : archiveListError ? (
                <InlineError message={archiveListError} />
              ) : visibleArchivedTasks.length === 0 ? (
                <div style={{ height: 180, borderRadius: 12, background: '#F8FAFC', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#94A3B8', gap: 8, fontWeight: 600, fontSize: 13 }}>
                  <Archive size={26} strokeWidth={1.5} />
                  No archived tasks yet
                </div>
              ) : (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 12 }}>
                    {visibleArchivedTasks.map(task => {
                      const assignee = task.assigned_user_id ? members.find(m => m.id === task.assigned_user_id) : null
                      const priorityStyle = task.priority ? PRIORITY_COLORS[task.priority] : null
                      const dept = departments.find(d => d.id === task.department_id)
                      const deadlineWarning = task.due_at && task.status !== 'Complete' && (isDueOverdue(task.due_at) || isDueWithinHours(task.due_at, 2))
                      const busy = unarchiveLoadingId === task.id || archiveDeleteLoadingId === task.id
                      const subTasks = archivedTasks
                        .filter(t => t.parent_task_id === task.id)
                        .sort((a, b) => (a.sequence_order ?? 0) - (b.sequence_order ?? 0))
                      const isExpanded = expandedArchivedTaskIds.has(task.id)
                      const hasBadges = !!(priorityStyle && task.priority) || !!dept || subTasks.length > 0
                      return (
                        <Fragment key={task.id}>
                          <div
                            onClick={() => setSelectedArchivedTask(task)}
                            className="task-card"
                            style={{
                              background: '#FFFFFF',
                              border: '1px solid #E5E7EB',
                              borderRadius: 10,
                              padding: '16px 16px',
                              cursor: 'pointer',
                              position: 'relative',
                              textAlign: 'left',
                              minHeight: 112,
                            }}
                          >
                            <div style={{ position: 'absolute', top: 12, right: 12, display: 'flex', alignItems: 'center', gap: 4, zIndex: 1 }}>
                              <button
                                type="button"
                                onClick={event => { event.stopPropagation(); handleUnarchiveTask(task.id) }}
                                disabled={busy}
                                title="Unarchive"
                                style={{ width: 24, height: 24, border: 'none', borderRadius: 6, background: 'transparent', color: '#16A34A', cursor: busy ? 'default' : 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: 0, opacity: busy ? 0.55 : 1 }}
                                onMouseEnter={e => { if (!busy) e.currentTarget.style.background = '#DCFCE7' }}
                                onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                              >
                                {unarchiveLoadingId === task.id ? <Spinner size={12} dark /> : <ArchiveRestore size={14} />}
                              </button>
                              <button
                                type="button"
                                onClick={event => { event.stopPropagation(); handleDeleteArchivedTask(task.id) }}
                                disabled={busy}
                                title="Delete"
                                style={{ width: 24, height: 24, border: 'none', borderRadius: 6, background: 'transparent', color: '#DC2626', cursor: busy ? 'default' : 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: 0, opacity: busy ? 0.55 : 1 }}
                                onMouseEnter={e => { if (!busy) e.currentTarget.style.background = '#FEE2E2' }}
                                onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                              >
                                {archiveDeleteLoadingId === task.id ? <Spinner size={12} dark /> : <Trash2 size={14} />}
                              </button>
                            </div>
                            {hasBadges && (
                              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 12, paddingRight: 58 }}>
                                {priorityStyle && task.priority && (
                                  <span style={{ fontSize: '0.65rem', fontWeight: 800, padding: '2px 7px', borderRadius: '99px', background: priorityStyle.bg, color: priorityStyle.text, letterSpacing: '0.01em' }}>
                                    {task.priority}
                                  </span>
                                )}
                                {dept && (
                                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.65rem', fontWeight: 700, padding: '2px 7px', borderRadius: '99px', background: deptCardBg(dept.id), color: deptColor(dept.id), minWidth: 0 }}>
                                    <span style={{ width: 5, height: 5, borderRadius: '50%', background: deptColor(dept.id), flexShrink: 0 }} />
                                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{dept.name}</span>
                                  </span>
                                )}
                                {subTasks.length > 0 && (
                                  <button
                                    type="button"
                                    onClick={event => { event.stopPropagation(); toggleArchivedTaskExpanded(task.id) }}
                                    style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.65rem', fontWeight: 700, padding: '2px 7px', borderRadius: '99px', background: '#F1F5F9', color: '#475569', border: 'none', cursor: 'pointer' }}
                                  >
                                    <GitBranch size={10} />
                                    {subTasks.length}
                                    <ChevronDown size={10} style={{ transform: isExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
                                  </button>
                                )}
                              </div>
                            )}
                            <p style={{ fontWeight: 600, fontSize: '0.875rem', color: '#111827', margin: '0 0 12px', lineHeight: 1.4, paddingRight: 58, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {task.title}
                            </p>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                              {assignee ? (
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                                  <div className="task-card-icon" style={{ width: 18, height: 18, borderRadius: '50%', background: assignee.profile_photo_url ? 'transparent' : '#FFF3E8', border: '1.5px solid #F97316', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden' }}>
                                    {assignee.profile_photo_url
                                      ? <img src={assignee.profile_photo_url} alt={assignee.full_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                      : <UserCog size={10} color="#F97316" strokeWidth={2} />}
                                  </div>
                                  <span style={{ fontSize: '0.7rem', color: '#374151', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {assignee.full_name}
                                  </span>
                                </div>
                              ) : (
                                <span style={{ fontSize: '0.75rem', color: '#CBD5E1', fontStyle: 'italic' }}>No assignee</span>
                              )}
                              {task.due_at && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                                  {deadlineWarning ? <AlertCircle size={11} color="#EF4444" /> : <Clock size={11} color="#9CA3AF" />}
                                  <span style={{ fontSize: '0.7rem', fontWeight: 600, color: deadlineWarning ? '#EF4444' : '#9CA3AF', whiteSpace: 'nowrap' }}>
                                    {formatDeadlineDisplay(task.due_at)}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                          {isExpanded && subTasks.length > 0 && (
                            <div style={{ marginTop: -4, marginBottom: 2, paddingLeft: 6 }}>
                              {subTasks.map((sub, idx) => (
                                <div key={sub.id} style={{ display: 'flex', alignItems: 'stretch', gap: 8 }}>
                                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                                    <span style={{ width: 26, height: 26, marginTop: 14, borderRadius: '50%', background: '#FFF3E8', color: '#EA580C', fontSize: 13, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                      {idx + 1}
                                    </span>
                                    {idx < subTasks.length - 1 && (
                                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}>
                                        <div style={{ width: 1, flex: 1, background: '#E2E8F0' }} />
                                        <ChevronDown size={12} color="#CBD5E1" style={{ marginTop: -2, flexShrink: 0 }} />
                                      </div>
                                    )}
                                  </div>
                                  <div style={{ flex: 1, minWidth: 0 }}>
                                    <TaskCard
                                      task={sub}
                                      members={members}
                                      shiftOptions={shiftOptions}
                                      departments={departments}
                                      showDept
                                      onClick={() => {}}
                                      onEdit={() => {}}
                                      clickable={false}
                                    />
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </Fragment>
                      )
                    })}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {archiveModalOpen && selectedArchivedTask && (() => {
        const task = selectedArchivedTask
        const viewFieldValue: React.CSSProperties = {
          ...modalInputStyle,
          display: 'flex',
          alignItems: 'center',
        }
        const viewEmpty: React.CSSProperties = { ...viewFieldValue, color: '#9CA3AF', fontStyle: 'italic' }
        return (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.28)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 120, animation: 'overlayFadeIn 0.18s ease-out' }}>
            <div onClick={e => e.stopPropagation()} style={{ width: 440, background: '#FFFFFF', borderRadius: 20, overflow: 'hidden', boxShadow: '0 24px 64px rgba(0,0,0,0.16), 0 4px 16px rgba(0,0,0,0.08)', animation: 'modalSlideIn 0.22s cubic-bezier(0.16,1,0.3,1)' }}>
              <div style={{ padding: '18px 20px 16px', borderBottom: '1px solid #F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                  <div style={{ width: 32, height: 32, borderRadius: 9, background: 'linear-gradient(135deg, #F97316, #EA580C)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Eye size={15} color="#fff" strokeWidth={2.5} />
                  </div>
                  <h2 style={{ fontWeight: 700, fontSize: '1rem', color: '#111827', margin: 0, fontFamily: "'Inter', system-ui, -apple-system, sans-serif", whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{task.title}&rsquo;s Details</h2>
                </div>
                <button onClick={() => setSelectedArchivedTask(null)} style={{ background: '#F9FAFB', border: '1px solid #E5E7EB', cursor: 'pointer', color: '#6B7280', display: 'flex', padding: '6px', borderRadius: 8, flexShrink: 0 }}
                  onMouseEnter={e => { e.currentTarget.style.background = '#F3F4F6' }}
                  onMouseLeave={e => { e.currentTarget.style.background = '#F9FAFB' }}
                >
                  <X size={16} />
                </button>
              </div>

              <div style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 12, maxHeight: 'calc(90vh - 130px)', overflowY: 'auto' }}>
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
              </div>
            </div>
          </div>
        )
      })()}

      {/* ═══════════════ TASK TEMPLATE MODAL ═══════════════ */}
      {templateModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, animation: 'overlayFadeIn 0.18s ease-out' }}>
          <div onClick={e => e.stopPropagation()} style={{ width: 440, maxHeight: '88vh', overflowY: 'auto', background: '#FFFFFF', borderRadius: 20, overflow: 'hidden', boxShadow: '0 24px 64px rgba(0,0,0,0.16), 0 4px 16px rgba(0,0,0,0.08)', animation: 'modalSlideIn 0.22s cubic-bezier(0.16,1,0.3,1)' }}>

            {/* Header */}
            <div style={{ padding: '18px 20px 16px', borderBottom: '1px solid #F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 32, height: 32, borderRadius: 9, background: 'linear-gradient(135deg, #F97316, #EA580C)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <LayoutTemplate size={15} color="#fff" strokeWidth={2.5} />
                </div>
                <h2 style={{ fontWeight: 700, fontSize: '1rem', color: '#111827', margin: 0, fontFamily: "'Inter', system-ui, -apple-system, sans-serif" }}>
                  {templateFormMode === 'list' ? 'Task Templates' : templateFormMode === 'edit' ? 'Edit Template' : 'New Template'}
                </h2>
              </div>
              <button onClick={() => setTemplateModalOpen(false)} style={{ background: '#F9FAFB', border: '1px solid #E5E7EB', cursor: 'pointer', color: '#6B7280', display: 'flex', padding: '6px', borderRadius: 8 }}
                onMouseEnter={e => { e.currentTarget.style.background = '#F3F4F6' }}
                onMouseLeave={e => { e.currentTarget.style.background = '#F9FAFB' }}
              >
                <X size={16} />
              </button>
            </div>

            {/* Body */}
            <div style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
              {templateFormMode === 'list' ? (
                <>
                  {taskTemplates.length === 0 ? (
                    <div style={{ height: 180, borderRadius: 12, background: '#F8FAFC', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#94A3B8', gap: 8, fontWeight: 600, fontSize: 13 }}>
                      <LayoutTemplate size={26} strokeWidth={1.5} />
                      No task templates yet
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {taskTemplates.map(t => {
                        const priorityStyle = t.priority ? PRIORITY_COLORS[t.priority] : null
                        return (
                          <div key={t.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '12px 14px', border: '1px solid #E5E7EB', borderRadius: 10 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flex: 1 }}>
                              {priorityStyle && (
                                <span style={{ flexShrink: 0, fontSize: '0.65rem', fontWeight: 800, padding: '2px 7px', borderRadius: '99px', background: priorityStyle.bg, color: priorityStyle.text, letterSpacing: '0.01em' }}>
                                  {t.priority}
                                </span>
                              )}
                              <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#111827', minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.name}</p>
                            </div>
                            <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                              <button type="button" onClick={() => openEditTemplate(t)} style={{ border: 'none', background: 'transparent', color: '#6B7280', cursor: 'pointer', display: 'flex', padding: 6, borderRadius: 6 }} title="Edit">
                                <Pencil size={14} />
                              </button>
                              <button type="button" onClick={() => setDeleteTemplateModal(t)} style={{ border: 'none', background: 'transparent', color: '#DC2626', cursor: 'pointer', display: 'flex', padding: 6, borderRadius: 6 }} title="Delete">
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={openCreateTemplate}
                    style={{ alignSelf: 'center', marginTop: 10, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7, border: 'none', borderRadius: 10, background: 'linear-gradient(135deg, #F97316, #EA580C)', color: '#FFFFFF', height: 36, padding: '0 14px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
                  >
                    <Plus size={15} strokeWidth={2.5} /> New Template
                  </button>
                </>
              ) : (
                <>
                  <div>
                    <label style={modalLabelStyle}>Name</label>
                    <input autoFocus value={templateFormName} onChange={e => setTemplateFormName(e.target.value)} placeholder="e.g. Daily Cleaning Checklist" style={modalInputStyle} />
                  </div>
                  <div>
                    <label style={modalLabelStyle}>Task Title</label>
                    <input value={templateFormTitle} onChange={e => setTemplateFormTitle(e.target.value)} placeholder="Task title this template creates..." style={modalInputStyle} />
                  </div>
                  <div>
                    <label style={modalLabelStyle}>Description</label>
                    <textarea value={templateFormDesc} onChange={e => setTemplateFormDesc(e.target.value)} onKeyDown={e => handleDescriptionKeyDown(e, templateFormDesc, setTemplateFormDesc)} rows={2} placeholder="Add more context..." style={{ ...modalInputStyle, resize: 'vertical', lineHeight: 1.55 }} />
                  </div>
                  <div>
                    <label style={modalLabelStyle}>Priority</label>
                    <DropdownField
                      value={templateFormPriority}
                      options={priorityDropdownOptions}
                      onChange={setTemplateFormPriority}
                      placeholder="Select priority"
                      badgeColors={PRIORITY_COLORS}
                    />
                  </div>
                </>
              )}
            </div>

            <InlineError message={templateError} />

            {/* Footer */}
            <div style={{ padding: '0 20px 18px', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              {templateFormMode !== 'list' && (
                <button
                  type="button"
                  onClick={() => { setTemplateFormMode('list'); setTemplateError('') }}
                  style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7, border: `1px solid ${TASK_BORDER}`, borderRadius: 10, background: '#FFFFFF', color: TASK_TEXT, height: 36, padding: '0 14px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
                >
                  Cancel
                </button>
              )}
              {templateFormMode !== 'list' && (
                <button
                  type="button"
                  onClick={handleSaveTemplate}
                  disabled={templateLoading || !templateFormName.trim() || !templateFormTitle.trim()}
                  style={{ padding: '7px 18px', background: (!templateFormName.trim() || !templateFormTitle.trim()) ? '#E5E7EB' : templateLoading ? '#FDA060' : 'linear-gradient(135deg, #F97316, #EA580C)', border: 'none', borderRadius: 8, fontWeight: 600, fontSize: '0.8125rem', color: (!templateFormName.trim() || !templateFormTitle.trim()) ? '#9CA3AF' : '#FFFFFF', cursor: templateLoading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 6, opacity: templateLoading ? 0.65 : 1 }}
                >
                  {templateLoading ? <Spinner size={13} /> : <Check size={13} />} {templateFormMode === 'edit' ? 'Save Changes' : 'Create Template'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════ DELETE TASK TEMPLATE MODAL ═══════════════ */}
      {deleteTemplateModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)', backdropFilter: 'blur(4px)', display: 'grid', placeItems: 'center', padding: 18, zIndex: 110, animation: 'overlayFadeIn 0.18s ease-out' }}>
          <div onClick={e => e.stopPropagation()} style={{ width: 'min(420px, 100%)', background: '#FFFFFF', borderRadius: 16, border: '1px solid #E2E8F0', boxShadow: '0 24px 70px rgba(15,23,42,0.32)', padding: 16, animation: 'modalSlideIn 0.22s cubic-bezier(0.16,1,0.3,1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', marginBottom: 16 }}>
              <h2 style={{ margin: 0, color: TASK_TEXT, fontSize: 16, fontWeight: 700 }}>Delete Template</h2>
              <button type="button" onClick={() => setDeleteTemplateModal(null)} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 34, height: 34, border: `1px solid ${TASK_BORDER}`, borderRadius: 9, background: '#FFFFFF', cursor: 'pointer', color: TASK_TEXT }}><X size={16} /></button>
            </div>
            <p style={{ color: '#64748B', marginTop: 0, fontSize: 13 }}>Are you sure you want to delete <strong style={{ color: TASK_TEXT }}>{deleteTemplateModal.name}</strong>?</p>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 10, marginTop: 18 }}>
              <button type="button" onClick={() => setDeleteTemplateModal(null)} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7, border: `1px solid ${TASK_BORDER}`, borderRadius: 10, background: '#FFFFFF', color: TASK_TEXT, height: 36, padding: '0 12px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Cancel</button>
              <button type="button" onClick={handleDeleteTemplate} disabled={deleteTemplateLoading} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7, border: 0, borderRadius: 10, background: '#DC2626', color: '#FFFFFF', height: 36, padding: '0 12px', fontSize: 13, fontWeight: 700, cursor: deleteTemplateLoading ? 'default' : 'pointer', opacity: deleteTemplateLoading ? 0.65 : 1 }}>{deleteTemplateLoading ? null : <Trash2 size={16} />} Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════ EDIT DEPT NAME MODAL ═══════════════ */}
      {editDeptModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, animation: 'overlayFadeIn 0.18s ease-out' }}>
          <div onClick={e => e.stopPropagation()} style={{ width: '480px', background: '#FFFFFF', borderRadius: '16px', padding: '32px', boxShadow: '0 8px 40px rgba(0,0,0,0.12)', animation: 'modalSlideIn 0.22s cubic-bezier(0.16,1,0.3,1)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <h2 style={{ fontWeight: 700, fontSize: '1.0625rem', color: '#111827', margin: 0 }}>Edit Department Name</h2>
              <button onClick={() => setEditDeptModal(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF', display: 'flex', padding: 4 }}><X size={18} /></button>
            </div>
            <label style={modalLabelStyle}>Department Name</label>
            <input autoFocus value={editDeptName} onChange={e => setEditDeptName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') handleEditDept() }} style={modalInputStyle} />
            <InlineError message={editDeptError} />
            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button style={primaryBtn(editDeptLoading)} onClick={handleEditDept} disabled={editDeptLoading}>
                {editDeptLoading && <Spinner size={14} />} Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════ DELETE DEPT MODAL ═══════════════ */}
      {deleteDeptModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, animation: 'overlayFadeIn 0.18s ease-out' }}>
          <div onClick={e => e.stopPropagation()} style={{ width: '480px', background: '#FFFFFF', borderRadius: '16px', padding: '32px', boxShadow: '0 8px 40px rgba(0,0,0,0.12)', animation: 'modalSlideIn 0.22s cubic-bezier(0.16,1,0.3,1)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <h2 style={{ fontWeight: 700, fontSize: '1.0625rem', color: '#111827', margin: 0 }}>Delete Department</h2>
              <button onClick={() => setDeleteDeptModal(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF', display: 'flex', padding: 4 }}><X size={18} /></button>
            </div>
            <p style={{ fontSize: '0.9375rem', color: '#374151', margin: 0, lineHeight: 1.6 }}>
              Are you sure you want to delete <strong style={{ color: '#111827' }}>{deleteDeptModal.name}</strong>?
            </p>
            <InlineError message={deleteDeptError} />
            <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
              <button style={ghostBtn} onClick={() => setDeleteDeptModal(null)}>Cancel</button>
              <button style={dangerBtn(deleteDeptLoading)} onClick={handleDeleteDept} disabled={deleteDeptLoading}>
                {deleteDeptLoading && <Spinner size={14} />} Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════ EDIT DEPT MANAGER MODAL ═══════════════ */}
      {editManagerModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, animation: 'overlayFadeIn 0.18s ease-out' }}>
          <div onClick={e => e.stopPropagation()} style={{ width: '480px', background: '#FFFFFF', borderRadius: '16px', padding: '32px', boxShadow: '0 8px 40px rgba(0,0,0,0.12)', animation: 'modalSlideIn 0.22s cubic-bezier(0.16,1,0.3,1)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <h2 style={{ fontWeight: 700, fontSize: '1.0625rem', color: '#111827', margin: 0 }}>Change Manager</h2>
              <button onClick={() => { setEditManagerModal(null); setEditManagerSelectedId('') }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF', display: 'flex', padding: 4 }}><X size={18} /></button>
            </div>
            <p style={{ fontSize: '0.875rem', color: '#6B7280', margin: '0 0 16px', lineHeight: 1.55 }}>
              Assign a manager to <strong>{editManagerModal.name}</strong>.
            </p>
            {allManagers.length === 0
              ? <p style={{ fontSize: '0.875rem', color: '#9CA3AF', textAlign: 'center', margin: '8px 0 16px' }}>No managers in this company yet.</p>
              : (
                <>
                  <label style={modalLabelStyle}>Manager</label>
                  <div style={{ position: 'relative' }}>
                    <select value={editManagerSelectedId} onChange={e => setEditManagerSelectedId(e.target.value)} style={{ ...modalInputStyle, paddingRight: 36, appearance: 'none', cursor: 'pointer' }}>
                      <option value="">Select a manager</option>
                      {allManagers.map(m => <option key={m.id} value={m.id}>{m.full_name}</option>)}
                    </select>
                    <ChevronDown size={15} style={{ position: 'absolute', right: 11, top: '50%', transform: 'translateY(-50%)', color: '#9CA3AF', pointerEvents: 'none' }} />
                  </div>
                </>
              )
            }
            <InlineError message={editManagerError} />
            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button style={primaryBtn(editManagerLoading)} onClick={handleEditDeptManager} disabled={editManagerLoading || !editManagerSelectedId}>
                {editManagerLoading && <Spinner size={14} />} Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════ AI TASK ASSIGNMENT MODAL ═══════════════ */}
      {aiModal && (() => {
        const isReview = aiStep === 'review'
        // Eligibility is based on the task's own deadline date, not whatever date happens to be
        // selected on the board — those can differ once the user picks a Deadline in this modal.
        const aiDeptManagers = members.filter(m => m.role === 'Manager' && m.department_id === aiDeptId && userIdsWithShiftOnDate(aiDueDate).has(m.id))

        const handleGenerate = async () => {
          if (!aiTitle.trim()) { setAiError('Please enter a task title'); return }
          if (!aiPriority) { setAiError('Please select a priority'); return }
          if (!aiDueDate || !aiDueTime) { setAiError('Please select a deadline'); return }
          if (aiRecurringEnabled && !aiRecurrenceRule) { setAiError('Choose how often this task repeats'); return }
          if (aiRecurringEnabled && !aiRecurrenceEndDate) { setAiError('Repeat until date is required for recurring tasks'); return }
          setAiLoading(true); setAiError('')
          try {
            const res = await fetch('/api/ai/assign', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                company_id: companyId,
                title: aiTitle,
                description: aiDescription,
                priority: aiPriority,
                want_sub_tasks: aiSubTaskEnabled,
                task_date: aiDueDate,
              }),
            })
            const data = await res.json()
            if (!data.success) throw new Error(data.message)
            const suggestion = data.suggestion as AiAssignSuggestion
            setAiSuggestion(suggestion)
            setAiDescription(suggestion.description)
            setAiDeptId(suggestion.department_id)
            setAiManagerId(suggestion.recommended_manager_id ?? '')
            setAiSubTaskDrafts(suggestion.sub_tasks.map(s => ({ title: s.title, description: s.description })))
            setAiStep('review')
          } catch (err) {
            setAiError(err instanceof Error ? err.message : 'Failed to generate suggestion')
          } finally {
            setAiLoading(false)
          }
        }

        const handleCreate = async () => {
          if (!aiSuggestion || !aiDeptId || !aiDueDate || !aiDueTime) return
          setAiCreateLoading(true); setAiError('')
          try {
            const due_at = new Date(`${aiDueDate}T${aiDueTime}:00`).toISOString()
            const subTasks = aiSubTaskEnabled
              ? aiSubTaskDrafts
                  .map(s => ({ title: s.title.trim(), description: s.description.trim() || null }))
                  .filter(s => s.title)
              : []
            const res = await fetch('/api/task', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                company_id: companyId,
                department_id: aiDeptId,
                title: aiTitle.trim(),
                description: aiDescription.trim() || null,
                priority: aiPriority,
                due_at,
                assigned_user_id: aiManagerId || null,
                assigned_by: internalUserId || null,
                status: 'Assigned',
                percentage_complete: 0,
                task_date: taskDate,
                sub_tasks: subTasks.length > 0 ? subTasks : undefined,
              }),
            })
            const data = await res.json()
            if (!data.success) throw new Error(data.message)

            // Recurring is set up as a second step against the task just created, mirroring
            // the New Task modal's flow — but kept to just Repeats + Repeat-until here, so the
            // deadline rule defaults to same_day at the AI deadline's own time.
            if (aiRecurringEnabled && aiRecurrenceRule) {
              const taskId = data.task?.id
              if (!taskId) throw new Error('Task created, but recurring setup could not find the new task')
              const recurringRes = await fetch('/api/task', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  action: 'recurring',
                  id: taskId,
                  recurrence_rule: aiRecurrenceRule,
                  recurrence_end_date: aiRecurrenceEndDate,
                  assigned_by: internalUserId || undefined,
                  deadline_rule: { type: 'same_day', time: aiDueTime },
                }),
              })
              const recurringData = await recurringRes.json()
              if (!recurringData.success) throw new Error(recurringData.message)
            }

            setAiModal(false)
            await fetchKanban(companyId)
            await refreshAllTaskInsights()
            showTaskToast(aiRecurringEnabled ? 'Recurring task created successfully.' : 'Task created successfully.')
          } catch (err) {
            setAiError(err instanceof Error ? err.message : 'Failed to create task')
          } finally {
            setAiCreateLoading(false)
          }
        }

        return (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, animation: 'overlayFadeIn 0.18s ease-out' }}>
            <div onClick={e => e.stopPropagation()} style={{ width: 440, maxHeight: '90vh', background: '#FFFFFF', borderRadius: 20, overflow: 'hidden', boxShadow: '0 24px 64px rgba(0,0,0,0.18)', display: 'flex', flexDirection: 'column', animation: 'modalSlideIn 0.22s cubic-bezier(0.16,1,0.3,1)' }}>

              {/* Header */}
              <div style={{ padding: '18px 20px 16px', borderBottom: '1px solid #F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 32, height: 32, borderRadius: 9, background: 'linear-gradient(135deg, #7C3AED, #6D28D9)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Sparkles size={15} color="#fff" strokeWidth={2} />
                  </div>
                  <div>
                    <h2 style={{ margin: 0, fontWeight: 700, fontSize: '1rem', color: '#111827' }}>AI Assign</h2>
                  </div>
                </div>
                <button onClick={() => setAiModal(false)} style={{ background: '#F9FAFB', border: '1px solid #E5E7EB', cursor: 'pointer', color: '#6B7280', display: 'flex', padding: '6px', borderRadius: 8 }}>
                  <X size={16} />
                </button>
              </div>

              {/* Body */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>

                {!isReview ? (
                  <>
                    {/* Title */}
                    <div>
                      <label style={modalLabelStyle}>Task Title</label>
                      <input
                        autoFocus
                        value={aiTitle}
                        onChange={e => setAiTitle(e.target.value)}
                        placeholder="e.g. Prepare quarterly financial report"
                        style={modalInputStyle}
                        onKeyDown={e => { if (e.key === 'Enter') handleGenerate() }}
                      />
                    </div>

                    {/* Description */}
                    <div>
                      <label style={modalLabelStyle}>Description</label>
                      <textarea
                        value={aiDescription}
                        onChange={e => setAiDescription(e.target.value)}
                        onKeyDown={e => handleDescriptionKeyDown(e, aiDescription, setAiDescription)}
                        rows={2}
                        placeholder="Add more context..."
                        style={{ ...modalInputStyle, resize: 'vertical', lineHeight: 1.55 }}
                      />
                    </div>

                    {/* Priority + Deadline */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                      <div>
                        <label style={modalLabelStyle}>Priority</label>
                        <DropdownField
                          value={aiPriority}
                          options={priorityDropdownOptions}
                          onChange={setAiPriority}
                          placeholder="Select priority"
                          badgeColors={PRIORITY_COLORS}
                        />
                      </div>
                      <div>
                        <label style={modalLabelStyle}>Deadline</label>
                        <DeadlinePicker
                          dateValue={aiDueDate}
                          timeValue={aiDueTime}
                          onChange={(date, time) => { setAiDueDate(date); setAiDueTime(time) }}
                          minDate={formatDateKey(new Date())}
                        />
                      </div>
                    </div>

                    {/* Divider */}
                    <div style={{ borderTop: '1px dashed #E5E7EB' }} />

                    {/* Sub Task + Recurring toggles — both optional */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      <div style={{ border: '1px solid #E5E7EB', borderRadius: 10, padding: 10 }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, fontSize: '0.8125rem', color: '#374151' }}>
                            <GitBranch size={13} color="#7C3AED" /> Sub Task <span style={{ fontWeight: 400, color: '#9CA3AF' }}>(Optional)</span>
                          </span>
                          <input
                            type="checkbox"
                            checked={aiSubTaskEnabled}
                            onChange={e => setAiSubTaskEnabled(e.target.checked)}
                            style={{ width: 16, height: 16, accentColor: '#7C3AED', cursor: 'pointer', marginLeft: 'auto' }}
                          />
                        </label>
                      </div>

                      <div style={{ border: '1px solid #E5E7EB', borderRadius: 10, padding: 10 }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, fontSize: '0.8125rem', color: '#374151' }}>
                            <Repeat size={13} color="#7C3AED" /> Recurring <span style={{ fontWeight: 400, color: '#9CA3AF' }}>(Optional)</span>
                          </span>
                          <input
                            type="checkbox"
                            checked={aiRecurringEnabled}
                            onChange={e => setAiRecurringEnabled(e.target.checked)}
                            style={{ width: 16, height: 16, accentColor: '#7C3AED', cursor: 'pointer', marginLeft: 'auto' }}
                          />
                        </label>
                        {aiRecurringEnabled && (
                          <div style={{ marginTop: 10, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                            <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                              <span style={{ display: 'block', fontWeight: 600, fontSize: '0.75rem', color: '#374151' }}>Repeats</span>
                              <DropdownField
                                value={aiRecurrenceRule}
                                options={[
                                  { value: 'daily', label: 'Daily' },
                                  { value: 'weekly', label: 'Weekly' },
                                ]}
                                onChange={v => setAiRecurrenceRule(v as TaskRecurrenceRule)}
                                placeholder="Select frequency"
                              />
                            </label>
                            <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                              <span style={{ display: 'block', fontWeight: 600, fontSize: '0.75rem', color: '#374151' }}>Repeat until</span>
                              <CompactDatePicker
                                value={aiRecurrenceEndDate}
                                onChange={setAiRecurrenceEndDate}
                                minDate={aiDueDate || formatDateKey(new Date())}
                                accentColor="#7C3AED"
                              />
                            </label>
                          </div>
                        )}
                      </div>
                    </div>

                    <InlineError message={aiError} />

                    <button
                      onClick={handleGenerate}
                      disabled={aiLoading}
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '11px', background: aiLoading ? '#EDE9FE' : 'linear-gradient(135deg, #7C3AED, #6D28D9)', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: '0.9375rem', color: '#fff', cursor: aiLoading ? 'default' : 'pointer' }}
                    >
                      {aiLoading ? <><Spinner size={16} /> Generating...</> : <><Sparkles size={15} /> Generate AI Suggestion</>}
                    </button>
                  </>
                ) : aiSuggestion && (
                  <>
                    {/* Title */}
                    <div>
                      <label style={modalLabelStyle}>Task Title</label>
                      <input
                        value={aiTitle}
                        onChange={e => setAiTitle(e.target.value)}
                        style={modalInputStyle}
                      />
                    </div>

                    {/* Description */}
                    <div>
                      <label style={modalLabelStyle}>Description</label>
                      <textarea
                        value={aiDescription}
                        onChange={e => setAiDescription(e.target.value)}
                        onKeyDown={e => handleDescriptionKeyDown(e, aiDescription, setAiDescription)}
                        rows={2}
                        style={{ ...modalInputStyle, resize: 'vertical', lineHeight: 1.55 }}
                      />
                    </div>

                    {/* Recommended Department */}
                    <div>
                      <label style={modalLabelStyle}>Recommended Department</label>
                      <DropdownField
                        value={aiDeptId}
                        options={deptDropdownOptions}
                        onChange={v => { setAiDeptId(v); setAiManagerId('') }}
                        placeholder="Select department"
                      />
                    </div>

                    {/* Recommended Assignee */}
                    <div>
                      <label style={modalLabelStyle}>Recommended Assignee</label>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {aiDeptManagers.length === 0 && (
                          <p style={{ margin: 0, fontSize: '0.8125rem', color: '#9CA3AF', fontStyle: 'italic' }}>No managers available on this date.</p>
                        )}
                        {aiDeptManagers.map(m => {
                          const selected = aiManagerId === m.id
                          const isAiPick = aiSuggestion.recommended_manager_id === m.id
                          return (
                            <div
                              key={m.id}
                              onClick={() => setAiManagerId(m.id)}
                              style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '9px 11px', border: `1.5px solid ${selected ? '#7C3AED' : '#E5E7EB'}`, borderRadius: 9, background: selected ? '#FAF5FF' : '#FFFFFF', cursor: 'pointer' }}
                            >
                              <div style={{ width: 16, height: 16, borderRadius: 999, border: `2px solid ${selected ? '#7C3AED' : '#D1D5DB'}`, background: selected ? '#7C3AED' : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                {selected && <div style={{ width: 6, height: 6, borderRadius: 999, background: '#fff' }} />}
                              </div>
                              <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#111827' }}>{m.full_name}</span>
                              {isAiPick && <span style={{ fontSize: 10, fontWeight: 700, color: '#7C3AED', marginLeft: 'auto' }}>AI PICK</span>}
                            </div>
                          )
                        })}
                      </div>
                    </div>

                    {/* Reason */}
                    <div style={{ display: 'flex', gap: 8, padding: '10px 12px', background: '#FAF5FF', border: '1px solid #EDE9FE', borderRadius: 9 }}>
                      <Sparkles size={14} color="#7C3AED" style={{ flexShrink: 0, marginTop: 1 }} />
                      <p style={{ margin: 0, fontSize: '0.8125rem', color: '#5B21B6', lineHeight: 1.5 }}>{aiSuggestion.reason}</p>
                    </div>

                    {/* Divider */}
                    <div style={{ borderTop: '1px dashed #E5E7EB' }} />

                    {/* Priority + Deadline */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                      <div>
                        <label style={modalLabelStyle}>Priority</label>
                        <DropdownField
                          value={aiPriority}
                          options={priorityDropdownOptions}
                          onChange={setAiPriority}
                          placeholder="Select priority"
                          badgeColors={PRIORITY_COLORS}
                        />
                      </div>
                      <div>
                        <label style={modalLabelStyle}>Deadline</label>
                        <DeadlinePicker
                          dateValue={aiDueDate}
                          timeValue={aiDueTime}
                          onChange={(date, time) => { setAiDueDate(date); setAiDueTime(time) }}
                          minDate={formatDateKey(new Date())}
                        />
                      </div>
                    </div>

                    {/* Sub-tasks — requested up front, AI-generated, still editable here */}
                    {aiSubTaskEnabled && (
                      <>
                        <div style={{ borderTop: '1px dashed #E5E7EB' }} />
                        <div>
                          <label style={modalLabelStyle}>Sub-Tasks <span style={{ fontSize: 11, fontWeight: 400, color: '#7C3AED' }}>| AI generated</span></label>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                            {aiSubTaskDrafts.map((step, i) => (
                              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 9, padding: '9px 11px', border: '1px solid #E5E7EB', borderRadius: 9, background: '#FAFAFA' }}>
                                <span style={{ flexShrink: 0, width: 18, height: 18, borderRadius: 999, background: '#EDE9FE', color: '#7C3AED', fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 1 }}>{i + 1}</span>
                                <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
                                  <input
                                    value={step.title}
                                    onChange={e => setAiSubTaskDrafts(prev => prev.map((s, si) => si === i ? { ...s, title: e.target.value } : s))}
                                    style={{ ...modalInputStyle, height: 32, fontSize: '0.8125rem', fontWeight: 600 }}
                                  />
                                  <textarea
                                    value={step.description}
                                    onChange={e => setAiSubTaskDrafts(prev => prev.map((s, si) => si === i ? { ...s, description: e.target.value } : s))}
                                    rows={2}
                                    style={{ ...modalInputStyle, fontSize: '0.75rem', resize: 'vertical' }}
                                  />
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </>
                    )}

                    <InlineError message={aiError} />
                  </>
                )}
              </div>

              {/* Footer */}
              {isReview && (
                <div style={{ padding: '14px 20px', borderTop: '1px solid #F3F4F6', display: 'flex', gap: 10, flexShrink: 0 }}>
                  <button
                    onClick={() => setAiStep('input')}
                    style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, border: '1px solid #E5E7EB', borderRadius: 10, background: '#FFFFFF', color: '#374151', height: 40, padding: '0 16px', fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer' }}
                  >
                    Back
                  </button>
                  <button
                    onClick={handleCreate}
                    disabled={aiCreateLoading}
                    style={{ ...primaryBtn(aiCreateLoading), background: 'linear-gradient(135deg, #7C3AED, #6D28D9)', color: '#fff', flex: 1 }}
                  >
                    {aiCreateLoading ? <><Spinner size={14} /> Creating...</> : 'Create Task'}
                  </button>
                </div>
              )}
            </div>
          </div>
        )
      })()}

      {taskToast && (
        <div style={{
          position: 'fixed',
          bottom: 28,
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          background: '#0F172A',
          color: '#FFFFFF',
          borderRadius: 12,
          padding: '12px 20px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
          fontSize: 13,
          fontWeight: 600,
          whiteSpace: 'nowrap',
          animation: 'fadeSlideUpToast 0.22s ease',
        }}>
          <Check size={15} style={{ color: '#10B981', flexShrink: 0 }} />
          {taskToast}
        </div>
      )}
      <style>{`
        @keyframes fadeSlideUpToast {
          from { opacity: 0; transform: translateX(-50%) translateY(10px); }
          to { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
      `}</style>
    </div>
  )
}
