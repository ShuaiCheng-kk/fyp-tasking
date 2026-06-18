'use client'

import { useState, useEffect, useLayoutEffect, useCallback, useRef, useMemo, Fragment } from 'react'
import { useRouter } from 'next/navigation'
import { createPortal } from 'react-dom'
import {
  Plus, X, ChevronDown, Calendar, AlertCircle,
  CheckCircle, Clock, Eye, Layers, Users,
  Crown, UserCog, UserRound, Pencil, Trash2, CalendarDays, ChevronLeft, ChevronRight,
  Sparkles, Check,
} from 'lucide-react'
import { AiAssignSuggestion } from '@/types/AI'
import { createBrowserClient } from '@supabase/ssr'
import OwnerSidebar from '@/components/OwnerSidebar'
import OwnerPlanBadge from '@/components/owner/PlanBadge'
import OwnerUserBadge from '@/components/owner/OwnerUserBadge'
import { Task, TaskInput, KanbanGroup } from '@/types/Task'
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

function formatDeadlineInputDisplay(dateValue: string, timeValue: string): string {
  if (!dateValue) return 'Select deadline'
  if (!timeValue) {
    const dayMonth = new Date(`${dateValue}T00:00:00`).toLocaleDateString('en-US', { day: 'numeric', month: 'long' })
    return `${dayMonth}, select time`
  }
  return formatDeadlineDisplay(`${dateValue}T${timeValue}:00`)
}


// ─── Task Date Picker ──────────────────────────────────────────────────────────

function TaskDatePicker({ value, onChange, taskDates, minDate, accentColor, fullWidth }: {
  value: string
  onChange: (date: string) => void
  taskDates: Set<string>
  minDate: string
  accentColor: string
  fullWidth?: boolean
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
          padding: '10px 12px', border: `1.5px solid ${open ? '#F97316' : '#E5E7EB'}`, borderRadius: 8,
          background: '#FFFFFF', cursor: 'pointer', fontSize: '0.9375rem', color: '#111827', fontWeight: 500,
          outline: 'none', boxSizing: 'border-box', transition: 'border-color 0.15s',
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

// ─── Local page types ─────────────────────────────────────────────────────────

type Department = { id: string; name: string }
type Member = {
  id: string
  full_name: string
  role: string
  department_id: string | null
  skills?: string[] | string | null
  worker_status?: string | null
  profile_photo_url?: string | null
}
type ManagerInfo = { id: string; full_name: string; department_id: string | null }
type ShiftOption = TimelineShiftBlock & {
  assignee_name: string
  user_id: string | null
}

type DeptTaskStats = {
  department_id: string
  department_name: string
  assigned: number
  inProgress: number
  review: number
  complete: number
}

type PriorityLevel = 'Low' | 'Medium' | 'High' | 'Urgent'
const PRIORITY_COLORS: Record<string, { bg: string; text: string }> = {
  Low:    { bg: '#F1F5F9', text: '#475569' },
  Medium: { bg: '#DBEAFE', text: '#1D4ED8' },
  High:   { bg: '#FFEDD5', text: '#C2410C' },
  Urgent: { bg: '#FEE2E2', text: '#B91C1C' },
}

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

function formatShiftOptionLabel(shift: ShiftOption): string {
  const date = new Date(`${shift.shift_date}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  const time = `${shift.start_time.slice(0, 5)}-${shift.end_time.slice(0, 5)}`
  return `${date} · ${time} · ${shift.assignee_name}`
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
  width: '100%', padding: '10px 12px', border: '1.5px solid #E5E7EB',
  borderRadius: '8px', fontSize: '0.9375rem', color: '#111827',
  outline: 'none', boxSizing: 'border-box', background: '#FFFFFF',
}
const modalLabelStyle: React.CSSProperties = {
  display: 'block', fontWeight: 600, fontSize: '0.875rem', color: '#374151', marginBottom: '8px',
}
const modalSelectStyle: React.CSSProperties = {
  ...modalInputStyle, paddingRight: 36, appearance: 'none', cursor: 'pointer',
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
          fontSize: '0.9375rem', color: selected ? '#111827' : '#9CA3AF',
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

// ─── Deadline Date+Time Picker (combined, single field) ──────────────────────

function DeadlineDateTimePicker({ dateValue, timeValue, onChange, minDate }: {
  dateValue: string
  timeValue: string
  onChange: (date: string, time: string) => void
  minDate: string
}) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState({ top: 0, left: 0, width: 320 })
  const [viewMonth, setViewMonth] = useState((dateValue || minDate).slice(0, 7))
  const triggerRef = useRef<HTMLButtonElement>(null)
  const popoverRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

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
    if (open && listRef.current) {
      const sel = listRef.current.querySelector('[data-selected="true"]') as HTMLElement | null
      if (sel) sel.scrollIntoView({ block: 'center' })
    }
  }, [open])

  const handleOpen = () => {
    if (triggerRef.current) {
      const r = triggerRef.current.getBoundingClientRect()
      const POPOVER_H = 280
      const fitsBelow = r.bottom + POPOVER_H + 8 <= window.innerHeight
      setViewMonth((dateValue || minDate).slice(0, 7))
      setPos({ top: fitsBelow ? r.bottom + 6 : r.top - POPOVER_H - 6, left: r.left, width: Math.max(r.width, 300) })
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

  const times = useMemo(() => {
    const res: { value: string; label: string }[] = []
    for (let mins = 0; mins < 24 * 60; mins += 30) {
      const h = Math.floor(mins / 60)
      const m = mins % 60
      const dh = h === 0 ? 12 : h > 12 ? h - 12 : h
      const ampm = h < 12 ? 'AM' : 'PM'
      res.push({ value: `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`, label: `${dh}:${String(m).padStart(2, '0')} ${ampm}` })
    }
    return res
  }, [])

  const hNum = timeValue ? parseInt(timeValue.split(':')[0]) : -1
  const mNum = timeValue ? parseInt(timeValue.split(':')[1]) : 0
  const timeLabel = timeValue
    ? `${hNum === 0 ? 12 : hNum > 12 ? hNum - 12 : hNum}:${String(mNum).padStart(2, '0')} ${hNum < 12 ? 'AM' : 'PM'}`
    : null
  const dateLabel = dateValue
    ? new Date(`${dateValue}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : null
  const displayLabel = dateLabel && timeLabel ? `${dateLabel} · ${timeLabel}` : dateLabel ? `${dateLabel} · select time` : 'Select deadline'

  const popover = open ? (
    <div ref={popoverRef} style={{ position: 'fixed', top: pos.top, left: pos.left, zIndex: 9999, background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: 16, boxShadow: '0 8px 32px rgba(15,23,42,0.14)', padding: '14px 14px', width: pos.width, display: 'flex', gap: 12 }}>
      {/* Calendar */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <button type="button" onClick={goPrev} disabled={!canGoPrev} style={{ width: 22, height: 22, border: '1px solid #E2E8F0', borderRadius: 6, background: '#FFFFFF', cursor: canGoPrev ? 'pointer' : 'default', display: 'flex', alignItems: 'center', justifyContent: 'center', color: canGoPrev ? '#64748B' : '#D1D5DB' }}><ChevronLeft size={12} /></button>
          <span style={{ fontSize: 12, fontWeight: 700, color: '#0F172A' }}>{monthLabel}</span>
          <button type="button" onClick={goNext} style={{ width: 22, height: 22, border: '1px solid #E2E8F0', borderRadius: 6, background: '#FFFFFF', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748B' }}><ChevronRight size={12} /></button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', marginBottom: 2 }}>
          {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
            <div key={i} style={{ fontSize: 10, fontWeight: 600, color: '#9CA3AF', textAlign: 'center', height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{d}</div>
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 1 }}>
          {cells.map((date, i) => {
            if (!date) return <div key={`e-${i}`} style={{ height: 26 }} />
            if (date < minDate) {
              return (
                <div key={date} style={{ height: 26, width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: '#D1D5DB', userSelect: 'none' }}>
                  {parseInt(date.split('-')[2])}
                </div>
              )
            }
            const isSel = date === dateValue
            const isToday = date === todayStr
            return (
              <button key={date} type="button" onClick={() => onChange(date, timeValue)}
                style={{ height: 26, width: '100%', border: isToday && !isSel ? '2px solid #F97316' : 'none', borderRadius: 6, background: isSel ? '#F97316' : 'transparent', color: isSel ? '#FFFFFF' : isToday ? '#F97316' : '#0F172A', fontWeight: isSel || isToday ? 700 : 400, fontSize: 11, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}
                onMouseEnter={e => { if (!isSel) e.currentTarget.style.background = '#F8FAFC' }}
                onMouseLeave={e => { if (!isSel) e.currentTarget.style.background = 'transparent' }}
              >{parseInt(date.split('-')[2])}</button>
            )
          })}
        </div>
      </div>
      {/* Time list */}
      <div style={{ width: 100, flexShrink: 0, borderLeft: '1px solid #F1F5F9', paddingLeft: 10, display: 'flex', flexDirection: 'column' }}>
        <p style={{ margin: '0 0 6px', fontSize: 10, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Time</p>
        <div ref={listRef} style={{ flex: 1, maxHeight: 210, overflowY: 'auto' }}>
          {times.map(t => {
            const isSel = t.value === timeValue
            return (
              <button key={t.value} type="button" data-selected={isSel ? 'true' : 'false'}
                onClick={() => onChange(dateValue || minDate, t.value)}
                style={{ display: 'block', width: '100%', padding: '6px 8px', textAlign: 'left', border: 'none', borderRadius: 6, background: isSel ? '#FFF7ED' : 'transparent', color: isSel ? '#EA580C' : '#374151', fontWeight: isSel ? 700 : 400, fontSize: 12, cursor: 'pointer' }}
                onMouseEnter={e => { if (!isSel) e.currentTarget.style.background = '#F9FAFB' }}
                onMouseLeave={e => { if (!isSel) e.currentTarget.style.background = 'transparent' }}
              >{t.label}</button>
            )
          })}
        </div>
      </div>
    </div>
  ) : null

  return (
    <div style={{ position: 'relative' }}>
      <button ref={triggerRef} type="button" onClick={handleOpen}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '10px 12px', border: `1.5px solid ${open ? '#F97316' : '#E5E7EB'}`, borderRadius: 8,
          background: '#FFFFFF', cursor: 'pointer', fontSize: '0.9375rem',
          color: dateValue ? '#111827' : '#9CA3AF', fontWeight: dateValue ? 500 : 400,
          outline: 'none', boxSizing: 'border-box', transition: 'border-color 0.15s',
        }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          <CalendarDays size={14} color="#9CA3AF" style={{ flexShrink: 0 }} />
          {formatDeadlineInputDisplay(dateValue, timeValue)}
        </span>
        <ChevronDown size={13} style={{ color: '#9CA3AF', flexShrink: 0, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
      </button>
      {typeof document !== 'undefined' && createPortal(popover, document.body)}
    </div>
  )
}

// ─── Task Card ────────────────────────────────────────────────────────────────

function TaskCard({
  task, members, shiftOptions, departments, showDept, onClick, onEdit,
}: {
  task: Task
  members: Member[]
  shiftOptions: ShiftOption[]
  departments: Department[]
  showDept: boolean
  onClick: () => void
  onEdit: () => void
}) {
  const assignee = members.find(m => m.id === task.assigned_user_id)
  const shift = task.shift_id ? shiftOptions.find(s => s.id === task.shift_id) : null
  const priority = task.priority ? PRIORITY_COLORS[task.priority] : null
  const overdue = task.due_at && task.status !== 'Complete' && isDueOverdue(task.due_at)
  const dept = showDept ? departments.find(d => d.id === task.department_id) : null

  return (
    <div
      onClick={onClick}
      className="task-card"
      style={{
        background: '#FFFFFF',
        border: '1px solid #E5E7EB',
        borderLeft: '1px solid #E5E7EB',
        borderRadius: '10px',
        padding: '16px 16px',
        cursor: 'pointer',
        position: 'relative',
        marginBottom: 14,
      }}
    >
      {/* Top row: priority badge + edit pencil */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
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
        </div>
        <button
          onClick={e => { e.stopPropagation(); onEdit() }}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center', color: '#9CA3AF', borderRadius: 6, flexShrink: 0 }}
          onMouseEnter={e => { e.currentTarget.style.background = '#E5E7EB'; (e.currentTarget as HTMLButtonElement).style.color = '#F97316' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'none'; (e.currentTarget as HTMLButtonElement).style.color = '#9CA3AF' }}
        >
          <Pencil size={13} />
        </button>
      </div>

      {/* Title */}
      <p style={{ fontWeight: 600, fontSize: '0.875rem', color: '#111827', margin: '0 0 16px', lineHeight: 1.4 }}>
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
            {overdue && <AlertCircle size={11} color="#EF4444" />}
            <span style={{ fontSize: '0.7rem', fontWeight: 600, color: overdue ? '#EF4444' : '#9CA3AF', whiteSpace: 'nowrap' }}>
              {formatDeadlineDisplay(task.due_at)}
            </span>
          </div>
        )}
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
  const [subTaskLoading,  setSubTaskLoading]  = useState(false)
  const [taskViewMode,    setTaskViewMode]    = useState(false)

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

  // AI Assign state (merged breakdown + department/manager/deadline suggestion)
  const [aiModal,          setAiModal]          = useState(false)
  const [aiStep,           setAiStep]           = useState<'input' | 'review'>('input')
  const [aiTitle,          setAiTitle]          = useState('')
  const [aiDescription,    setAiDescription]    = useState('')
  const [aiPriority,       setAiPriority]       = useState('')
  const [aiPeopleNeeded,   setAiPeopleNeeded]   = useState(1)
  const [aiLoading,        setAiLoading]        = useState(false)
  const [aiError,          setAiError]          = useState('')
  const [aiSuggestion,     setAiSuggestion]     = useState<AiAssignSuggestion | null>(null)
  const [aiDeptId,         setAiDeptId]         = useState('')
  const [aiManagerIds,     setAiManagerIds]     = useState<string[]>([])
  const [aiDueDate,        setAiDueDate]        = useState('')
  const [aiDueTime,        setAiDueTime]        = useState('')
  const [aiCreateLoading,  setAiCreateLoading]  = useState(false)

  // Toast
  const [taskToast, setTaskToast] = useState('')
  const taskToastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const showTaskToast = useCallback((message: string) => {
    if (taskToastTimerRef.current) clearTimeout(taskToastTimerRef.current)
    setTaskToast(message)
    taskToastTimerRef.current = setTimeout(() => setTaskToast(''), 3000)
  }, [])

  const panelRef = useRef<HTMLDivElement>(null)

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
      setNewDeadlineDate(shiftOnViewedDate.shift_date)
      setNewDeadlineTime(shiftOnViewedDate.end_time.slice(0, 5))
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
    setTaskViewMode(viewOnly)
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
      await fetchKanban(companyId)
      setTaskDate(editStartDate)
      closePanel()
      showTaskToast('Task updated successfully.')
    } catch (err) { setPanelError(err instanceof Error ? err.message : 'Failed to save') }
    finally { setEditLoading(false) }
  }

  // ── Delete task ────────────────────────────────────────────────────────────

  const handleDeleteTask = async () => {
    if (!selectedTask) return
    setDeleteLoading(true)
    const taskId = selectedTask.id
    // Optimistic: remove task from kanban immediately
    setKanban(prev => {
      if (!prev) return prev
      const next = { ...prev } as KanbanGroup
      for (const col of COLUMNS) next[col] = (prev[col] ?? []).filter(t => t.id !== taskId)
      return next
    })
    closePanel()
    try {
      const res = await fetch(`/api/task?id=${taskId}`, { method: 'DELETE' })
      const data = await res.json()
      if (!data.success) fetchKanban(companyId, true)
      else showTaskToast('Task deleted successfully.')
    } catch { fetchKanban(companyId, true) }
    finally { setDeleteLoading(false) }
  }

  const handleDeleteTaskDirect = async () => {
    if (!deleteTaskModal) return
    setDeleteTaskLoading(true); setDeleteTaskError('')
    const taskId = deleteTaskModal.id
    setKanban(prev => {
      if (!prev) return prev
      const next = { ...prev } as KanbanGroup
      for (const col of COLUMNS) next[col] = (prev[col] ?? []).filter(t => t.id !== taskId)
      return next
    })
    setDeleteTaskModal(null)
    try {
      const res = await fetch(`/api/task?id=${taskId}`, { method: 'DELETE' })
      const data = await res.json()
      if (!data.success) { fetchKanban(companyId, true); setDeleteTaskError(data.message ?? 'Failed to delete') }
      else showTaskToast('Task deleted successfully.')
    } catch { fetchKanban(companyId, true) }
    finally { setDeleteTaskLoading(false) }
  }

  // ── Create task ────────────────────────────────────────────────────────────

  const handleCreateSubTask = async () => {
    if (!selectedTask || !subTaskTitle.trim()) return
    setSubTaskLoading(true); setPanelError('')
    try {
      const input: Partial<TaskInput> & { company_id: string; department_id: string; title: string } = {
        company_id: selectedTask.company_id,
        department_id: selectedTask.department_id,
        shift_id: editShiftId || selectedTask.shift_id,
        parent_task_id: selectedTask.id,
        title: subTaskTitle.trim(),
        assigned_user_id: editAssignee || selectedTask.assigned_user_id,
        assigned_by: internalUserId || null,
        status: 'Assigned',
        percentage_complete: 0,
        task_date: selectedTask.task_date ?? taskDate,
      }
      const res = await fetch('/api/task', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.message)
      setSubTaskTitle('')
      fetchKanban(companyId)
      showTaskToast('Sub-task created successfully.')
    } catch (err) { setPanelError(err instanceof Error ? err.message : 'Failed to create sub-task') }
    finally { setSubTaskLoading(false) }
  }

  const handleCreateTask = async () => {
    if (!newTitle.trim() || !newDeptId || !newPriority || !newStartDate || !newDeadlineDate || !newDeadlineTime) { setNewError('Title, department, priority, start date, and deadline are required'); return }
    setNewLoading(true); setNewError('')
    try {
      const input: Partial<TaskInput> & { company_id: string; department_id: string; title: string } = {
        company_id: companyId,
        department_id: newDeptId,
        title: newTitle.trim(),
        description: newDescription || null,
        assigned_user_id: newAssigneeId || null,
        assigned_by: internalUserId || null,
        shift_id: newShiftId || null,
        priority: newPriority || null,
        due_at: newDeadlineDate && newDeadlineTime ? new Date(`${newDeadlineDate}T${newDeadlineTime}:00`).toISOString() : null,
        task_date: newStartDate,
        status: 'Assigned',
        percentage_complete: 0,
      }
      const res = await fetch('/api/task', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.message)
      setNewTaskModal(false)
      setNewTitle(''); setNewDescription(''); setNewDeptId(''); setNewAssigneeId(''); setNewShiftId(''); setNewStartDate(''); setNewPriority(''); setNewDeadlineDate(''); setNewDeadlineTime('')
      setTaskDate(taskDate)
      fetchKanban(companyId)
      showTaskToast('Task created successfully.')
    } catch (err) { setNewError(err instanceof Error ? err.message : 'Failed to create task') }
    finally { setNewLoading(false) }
  }

  // Open new task modal pre-filled with dept + assignee
  const openNewTaskFor = (memberId: string, deptId: string) => {
    setNewDeptId(deptId)
    setNewAssigneeId(memberId)
    setNewShiftId('')
    setNewStartDate(taskDate)
    setNewTitle(''); setNewDescription(''); setNewPriority(''); setNewDeadlineDate(''); setNewDeadlineTime(''); setNewError('')
    setNewTaskModal(true)
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

  const minTaskDate = useMemo(() => {
    const d = addDays(new Date(), -7)
    const dow = (d.getDay() + 6) % 7
    return formatDateKey(addDays(d, -dow))
  }, [])

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
    // Bar spans from the task's assigned start date (task_date, set when assigning) to its deadline date
    return allVisibleTasks.flatMap(task => {
      const startDate = kanbanDateKey(task)
      const endDate = task.due_at ? formatDateKey(new Date(task.due_at)) : startDate
      if (endDate < calendarWeekDates[0] || startDate > calendarWeekDates[6]) return []
      return [{ task, startDate: startDate < endDate ? startDate : endDate, endDate: endDate > startDate ? endDate : startDate }]
    }).sort((a, b) => (PRIORITY_ORDER[a.task.priority ?? ''] ?? 4) - (PRIORITY_ORDER[b.task.priority ?? ''] ?? 4) || a.startDate.localeCompare(b.startDate))
  }, [allVisibleTasks, calendarWeekDates])

  const renderTaskCalendarView = () => {
    const todayStr = formatDateKey(new Date())
    const ROW_HEIGHT = 58
    const NAME_COL = 180
    const dayIndex = (date: string) => calendarWeekDates.indexOf(date)

    return (
      <div className="task-tab-content" style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: '14px 16px 18px' }}>
        <div style={{ minWidth: 880, border: `1px solid ${TASK_BORDER}`, borderRadius: 12, overflow: 'hidden', background: '#FFFFFF' }}>
          {/* Header row — matches Shifts page Calendar tab date header */}
          <div style={{ display: 'grid', gridTemplateColumns: `${NAME_COL}px repeat(7, 1fr)`, background: 'linear-gradient(135deg, #0F172A 0%, #1E293B 100%)', height: 54 }}>
            <div style={{ borderRight: '1px solid rgba(255,255,255,0.08)' }} />
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
              {taskCalendarItems.map(item => {
                const dept = departments.find(d => d.id === item.task.department_id)
                const color = dept ? deptColor(dept.id) : STATUS_CONFIG[item.task.status].color
                const startCol = Math.max(0, dayIndex(item.startDate))
                const endCol = dayIndex(item.endDate) === -1 ? 6 : dayIndex(item.endDate)
                const truncatedStart = item.startDate < calendarWeekDates[0]
                const truncatedEnd = item.endDate > calendarWeekDates[6]
                const assignee = members.find(m => m.id === item.task.assigned_user_id)
                const isManager = assignee?.role === 'Manager'
                return (
                  <div key={item.task.id} style={{ display: 'grid', gridTemplateColumns: `${NAME_COL}px repeat(7, 1fr)`, height: ROW_HEIGHT, borderBottom: '1px solid #CBD5E1', boxSizing: 'border-box' }}>
                    {/* Assignee column */}
                    <div style={{ display: 'flex', alignItems: 'center', borderRight: `1px solid ${TASK_BORDER}`, overflow: 'hidden' }}>
                      <div style={{ width: 8, alignSelf: 'stretch', flexShrink: 0, background: color, opacity: 0.85 }} />
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
                    <button
                      type="button"
                      onClick={() => openTask(item.task, false)}
                      title={`${item.task.title} • ${item.startDate} – ${item.endDate}`}
                      style={{
                        gridColumn: `${startCol + 2} / ${endCol + 3}`,
                        gridRow: 1,
                        alignSelf: 'center',
                        position: 'relative',
                        margin: '0 6px',
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
                      <span style={{ fontSize: 12, fontWeight: 700, color: '#FFFFFF', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.task.title}</span>
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
  const newTaskDeptMembers = newDeptId ? assignableMembers.filter(m => m.department_id === newDeptId) : assignableMembers
  const deptDropdownOptions = departments.map(d => ({ value: d.id, label: d.name }))
  const assigneeDropdownOptions = newTaskDeptMembers.map(m => ({ value: m.id, label: m.full_name }))
  const priorityDropdownOptions: { value: string; label: string }[] =
    (['Low', 'Medium', 'High', 'Urgent'] as PriorityLevel[]).map(p => ({ value: p, label: p }))
  const isNewTaskValid = newTitle.trim() !== '' && newDeptId !== '' && newPriority !== '' && newStartDate !== '' && newDeadlineDate !== '' && newDeadlineTime !== ''
  const editTaskDeptMembers = editDeptId ? assignableMembers.filter(m => m.department_id === editDeptId) : assignableMembers
  const editAssigneeDropdownOptions = editTaskDeptMembers.map(m => ({ value: m.id, label: m.full_name }))
  const isEditTaskValid = editTitle.trim() !== '' && editDeptId !== '' && editStartDate !== '' && editPriority !== '' && editDueAt !== '' && editDeadlineTime !== ''
  const selectedSubTasks = selectedTask && kanban
    ? COLUMNS.flatMap(col => kanban[col]).filter(task => task.parent_task_id === selectedTask.id)
    : []

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
        @keyframes overlayFadeIn { from { opacity: 0 } to { opacity: 1 } }
        @keyframes modalSlideIn  { from { opacity: 0; transform: scale(0.97) translateY(8px) } to { opacity: 1; transform: scale(1) translateY(0) } }

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

        {/* Content — single card like Shifts/Communication */}
        <div style={{ padding: '0 28px 28px', flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          {!initialReady || kanbanLoading ? (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flex: 1 }}>
              <Spinner size={24} dark />
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 16, alignItems: 'stretch', flex: 1, minHeight: 0 }}>

              {/* ── DEPARTMENT PANEL ───────────────────────────────────────── */}
              <section className="task-dept-panel" style={{ width: 326, flexShrink: 0, alignSelf: 'flex-start', background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: 14, overflow: 'visible' }}>
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
                              const managerCount = members.filter(m => m.department_id === d.id && m.role === 'Manager').length
                              const taskCount = dayTasks.filter(t => t.department_id === d.id).length
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
                                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: deptColor(d.id), flexShrink: 0 }} />
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
                              onClick={() => { setAiModal(true); setAiStep('input'); setAiTitle(''); setAiDescription(''); setAiPriority(''); setAiPeopleNeeded(1); setAiSuggestion(null); setAiDeptId(''); setAiManagerIds([]); setAiDueDate(''); setAiDueTime(''); setAiError('') }}
                              style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7, border: 0, borderRadius: 10, background: 'linear-gradient(135deg, #7C3AED, #6D28D9)', color: '#FFFFFF', height: 36, padding: '0 24px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
                            >
                              <Sparkles size={14} /> AI Assign
                            </button>
                          </div>
                        </>
                      )
                    }

                    // ── Department selected: manager list ──
                    const deptMembers = members.filter(m => m.department_id === dept.id && m.role === 'Manager')
                    // Count tasks due on the selected date only, so the panel matches what's visible in the Kanban
                    const dateTaskCountByUser = COLUMNS
                      .flatMap(col => filteredTasks(col))
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
                    {boardViewMode === 'calendar' ? (
                      <>
                        <button
                          type="button"
                          onClick={() => setTaskDate(formatDateKey(addDays(new Date(`${taskDate}T00:00:00`), -7)))}
                          disabled={taskDate <= minTaskDate}
                          style={{ width: 38, height: 38, borderRadius: 9, border: `1px solid ${TASK_BORDER}`, background: '#FFFFFF', display: 'inline-grid', placeItems: 'center', cursor: taskDate <= minTaskDate ? 'default' : 'pointer', color: TASK_TEXT, opacity: taskDate <= minTaskDate ? 0.3 : 1 }}
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
                          disabled={taskDate <= minTaskDate}
                          style={{ width: 38, height: 38, borderRadius: 9, border: `1px solid ${TASK_BORDER}`, background: '#FFFFFF', display: 'inline-grid', placeItems: 'center', cursor: taskDate <= minTaskDate ? 'default' : 'pointer', color: TASK_TEXT, opacity: taskDate <= minTaskDate ? 0.3 : 1 }}
                        ><ChevronLeft size={16} /></button>
                        <TaskDatePicker value={taskDate} onChange={setTaskDate} taskDates={datesWithTasks} minDate={minTaskDate} accentColor={TASK_ORANGE} />
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
                            <span style={{ fontSize: '0.72rem', fontWeight: 700, background: cfg.bg, color: cfg.color, padding: '2px 8px', borderRadius: '99px' }}>{tasks.length}</span>
                          </div>
                          {/* Scrollable card area */}
                          <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '10px 18px 12px', display: 'flex', flexDirection: 'column' }}>
                            {tasks.length === 0 ? (
                              <div style={{ flex: 1, minHeight: 164, margin: '8px 0', padding: '32px 0', textAlign: 'center', background: '#F8FAFC', borderRadius: 14, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', animation: 'fadeSlideUp 0.3s ease both', animationDelay: `${0.1 + colIdx * 0.05}s` }}>
                                {{ Assigned: <Layers size={24} style={{ color: '#CBD5E1', margin: '0 auto 8px', display: 'block' }} />, 'In Progress': <Clock size={24} style={{ color: '#CBD5E1', margin: '0 auto 8px', display: 'block' }} />, Review: <Eye size={24} style={{ color: '#CBD5E1', margin: '0 auto 8px', display: 'block' }} />, Complete: <CheckCircle size={24} style={{ color: '#CBD5E1', margin: '0 auto 8px', display: 'block' }} /> }[col]}
                                <p style={{ fontSize: 12, color: '#94A3B8', margin: 0 }}>No {cfg.label.toLowerCase()} tasks</p>
                              </div>
                            ) : (
                              tasks.map(task => (
                                <TaskCard
                                  key={task.id}
                                  task={task}
                                  members={members}
                                  shiftOptions={shiftOptions}
                                  departments={departments}
                                  showDept={selectedDeptId === ''}
                                  onClick={() => openTask(task, true)}
                                  onEdit={() => openTask(task, false)}
                                />
                              ))
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
        const viewAssigneeName = selectedTask.assigned_user_id
          ? (members.find(m => m.id === selectedTask.assigned_user_id)?.full_name ?? 'Unknown')
          : null
        const viewDept = departments.find(d => d.id === selectedTask.department_id)
        const viewPriorityStyle = selectedTask.priority ? PRIORITY_COLORS[selectedTask.priority as keyof typeof PRIORITY_COLORS] : null
        const viewStartDate = new Date(`${kanbanDateKey(selectedTask)}T00:00:00`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
        const viewDeadline = selectedTask.due_at
          ? (() => {
              const d = new Date(selectedTask.due_at)
              return d.toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
            })()
          : null
        const viewFieldValue: React.CSSProperties = {
          padding: '10px 12px',
          border: '1.5px solid #E5E7EB',
          borderRadius: 8,
          background: '#FFFFFF',
          fontSize: '0.9375rem',
          color: '#111827',
          minHeight: 40,
          display: 'flex',
          alignItems: 'center',
          boxSizing: 'border-box',
        }
        const viewEmpty: React.CSSProperties = { ...viewFieldValue, color: '#9CA3AF', fontStyle: 'italic' }
        return (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, animation: 'overlayFadeIn 0.18s ease-out' }}>
            <div
              ref={panelRef}
              onClick={e => e.stopPropagation()}
              style={{ width: 440, background: '#FFFFFF', borderRadius: 20, overflow: 'hidden', boxShadow: '0 24px 64px rgba(0,0,0,0.16), 0 4px 16px rgba(0,0,0,0.08)', animation: 'modalSlideIn 0.22s cubic-bezier(0.16,1,0.3,1)' }}
            >
              {/* Header */}
              <div style={{ padding: '18px 20px 16px', borderBottom: '1px solid #F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 32, height: 32, borderRadius: 9, background: 'linear-gradient(135deg, #F97316, #EA580C)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Eye size={15} color="#fff" strokeWidth={2.5} />
                  </div>
                  <h2 style={{ fontWeight: 700, fontSize: '1rem', color: '#111827', margin: 0, fontFamily: "'Inter', system-ui, -apple-system, sans-serif" }}>Task Details</h2>
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

                {/* Title */}
                <div>
                  <label style={modalLabelStyle}>Title</label>
                  <div style={viewFieldValue}>{selectedTask.title}</div>
                </div>

                {/* Description */}
                <div>
                  <label style={modalLabelStyle}>Description</label>
                  {selectedTask.description
                    ? <div style={{ ...viewFieldValue, alignItems: 'flex-start', whiteSpace: 'pre-wrap', lineHeight: 1.55 }}>{selectedTask.description}</div>
                    : <div style={viewEmpty}>No description</div>
                  }
                </div>

                {/* Department + Assign To */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div>
                    <label style={modalLabelStyle}>Department</label>
                    <div style={viewDept ? viewFieldValue : viewEmpty}>{viewDept?.name ?? 'Unknown'}</div>
                  </div>
                  <div>
                    <label style={modalLabelStyle}>Assigned To</label>
                    {viewAssigneeName
                      ? <div style={viewFieldValue}>{viewAssigneeName}</div>
                      : <div style={viewEmpty}>Unassigned</div>
                    }
                  </div>
                </div>

                {/* Divider */}
                <div style={{ borderTop: '1px dashed #E5E7EB' }} />

                {/* Start Date + Priority */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div>
                    <label style={modalLabelStyle}>Start Date</label>
                    <div style={viewFieldValue}>{viewStartDate}</div>
                  </div>
                  <div>
                    <label style={modalLabelStyle}>Priority</label>
                    {viewPriorityStyle
                      ? <div style={{ ...viewFieldValue, background: viewPriorityStyle.bg, justifyContent: 'center' }}>
                          <span style={{ color: '#111827', fontWeight: 700, fontSize: '0.85rem' }}>{selectedTask.priority}</span>
                        </div>
                      : <div style={viewEmpty}>None</div>
                    }
                  </div>
                </div>

                {/* Deadline */}
                <div>
                  <label style={modalLabelStyle}>Deadline</label>
                  {viewDeadline
                    ? <div style={viewFieldValue}>{viewDeadline}</div>
                    : <div style={viewEmpty}>No deadline set</div>
                  }
                </div>

              </div>
            </div>
          </div>
        )
      })()}

      {selectedTask && !taskViewMode && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, animation: 'overlayFadeIn 0.18s ease-out' }}>
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

              {/* Title */}
              <div>
                <label style={modalLabelStyle}>Title</label>
                <input autoFocus value={editTitle} onChange={e => setEditTitle(e.target.value)} style={modalInputStyle} onKeyDown={e => { if (e.key === 'Enter') handleSaveTask() }} />
              </div>

              {/* Description */}
              <div>
                <label style={modalLabelStyle}>Description</label>
                <textarea value={editDescription} onChange={e => setEditDescription(e.target.value)} rows={2} style={{ ...modalInputStyle, resize: 'vertical', lineHeight: 1.55 }} />
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

              {/* Start Date + Priority */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={modalLabelStyle}>Start Date</label>
                  <TaskDatePicker
                    value={editStartDate || formatDateKey(new Date())}
                    onChange={setEditStartDate}
                    taskDates={datesWithTasks}
                    minDate={minTaskDate}
                    accentColor={TASK_ORANGE}
                    fullWidth
                  />
                </div>
                <div>
                  <label style={modalLabelStyle}>Priority</label>
                  <DropdownField
                    value={editPriority}
                    options={priorityDropdownOptions}
                    onChange={v => setEditPriority(v)}
                    placeholder="Select priority"
                  />
                </div>
              </div>

              {/* Deadline */}
              <div>
                <label style={modalLabelStyle}>Deadline</label>
                <DeadlineDateTimePicker
                  dateValue={editDueAt}
                  timeValue={editDeadlineTime}
                  onChange={(date, time) => { setEditDueAt(date); setEditDeadlineTime(time) }}
                  minDate={editStartDate || formatDateKey(new Date())}
                />
              </div>

              <InlineError message={panelError} />
            </div>

            {/* Footer */}
            <div style={{ padding: '0 20px 18px', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8 }}>
              <button
                type="button"
                onClick={handleDeleteTask}
                disabled={deleteLoading}
                style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, border: 'none', borderRadius: 8, background: deleteLoading ? '#F3A8A8' : 'linear-gradient(135deg, #EF4444, #DC2626)', color: '#FFFFFF', height: 34, padding: '0 14px', fontSize: '0.8125rem', fontWeight: 600, cursor: deleteLoading ? 'not-allowed' : 'pointer', opacity: deleteLoading ? 0.7 : 1, marginRight: 'auto' }}
              >
                {deleteLoading ? <Spinner size={13} /> : <Trash2 size={13} />} Delete
              </button>
              <button
                type="button"
                onClick={handleSaveTask}
                disabled={editLoading || !isEditTaskValid}
                style={{ padding: '7px 18px', background: !isEditTaskValid ? '#E5E7EB' : editLoading ? '#FDA060' : 'linear-gradient(135deg, #F97316, #EA580C)', border: 'none', borderRadius: 8, fontWeight: 600, fontSize: '0.8125rem', color: !isEditTaskValid ? '#9CA3AF' : '#FFFFFF', cursor: editLoading || !isEditTaskValid ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 6, opacity: editLoading ? 0.65 : 1 }}
              >
                {editLoading ? <Spinner size={13} /> : <Check size={13} />} Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════ DELETE TASK MODAL ═══════════════ */}
      {deleteTaskModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.42)', display: 'grid', placeItems: 'center', padding: 18, zIndex: 100, animation: 'overlayFadeIn 0.18s ease-out' }}>
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
                <h2 style={{ fontWeight: 700, fontSize: '1rem', color: '#111827', margin: 0, fontFamily: "'Inter', system-ui, -apple-system, sans-serif" }}>New Task</h2>
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

              {/* Title */}
              <div>
                <label style={modalLabelStyle}>Title</label>
                <input autoFocus value={newTitle} onChange={e => setNewTitle(e.target.value)} placeholder="Task title..." style={modalInputStyle} onKeyDown={e => { if (e.key === 'Enter') handleCreateTask() }} />
              </div>

              {/* Description */}
              <div>
                <label style={modalLabelStyle}>Description</label>
                <textarea value={newDescription} onChange={e => setNewDescription(e.target.value)} rows={2} placeholder="Add more context..." style={{ ...modalInputStyle, resize: 'vertical', lineHeight: 1.55 }} />
              </div>

              {/* Department + Assign To */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={modalLabelStyle}>Department</label>
                  <DropdownField
                    value={newDeptId}
                    options={deptDropdownOptions}
                    onChange={v => { setNewDeptId(v); setNewAssigneeId(''); setNewShiftId(''); setNewDeadlineDate(''); setNewDeadlineTime('') }}
                    placeholder="Select department"
                  />
                </div>
                <div>
                  <label style={modalLabelStyle}>Assign To</label>
                  <DropdownField
                    value={newAssigneeId}
                    options={assigneeDropdownOptions}
                    onChange={v => setNewAssigneeId(v)}
                    placeholder="Unassigned"
                    disabled={!newDeptId}
                  />
                </div>
              </div>

              {/* Divider */}
              <div style={{ borderTop: '1px dashed #E5E7EB' }} />

              {/* Start Date + Priority */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={modalLabelStyle}>Start Date</label>
                  <TaskDatePicker
                    value={newStartDate || formatDateKey(new Date())}
                    onChange={setNewStartDate}
                    taskDates={datesWithTasks}
                    minDate={minTaskDate}
                    accentColor={TASK_ORANGE}
                    fullWidth
                  />
                </div>
                <div>
                  <label style={modalLabelStyle}>Priority</label>
                  <DropdownField
                    value={newPriority}
                    options={priorityDropdownOptions}
                    onChange={v => setNewPriority(v)}
                    placeholder="Select priority"
                  />
                </div>
              </div>

              {/* Deadline */}
              <div>
                <label style={modalLabelStyle}>Deadline</label>
                <DeadlineDateTimePicker
                  dateValue={newDeadlineDate}
                  timeValue={newDeadlineTime}
                  onChange={(date, time) => { setNewDeadlineDate(date); setNewDeadlineTime(time) }}
                  minDate={newStartDate || formatDateKey(new Date())}
                />
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

      {/* ═══════════════ EDIT DEPT NAME MODAL ═══════════════ */}
      {editDeptModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, animation: 'overlayFadeIn 0.18s ease-out' }}>
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
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, animation: 'overlayFadeIn 0.18s ease-out' }}>
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
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, animation: 'overlayFadeIn 0.18s ease-out' }}>
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

      {/* ═══════════════ AI TASK BREAKDOWN MODAL ═══════════════ */}
      {aiModal && (() => {
        const isReview = aiStep === 'review'
        const aiDeptManagers = members.filter(m => m.role === 'Manager' && m.department_id === aiDeptId)

        const handleGenerate = async () => {
          if (!aiTitle.trim()) { setAiError('Please enter a task title'); return }
          if (!aiPriority) { setAiError('Please select a priority'); return }
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
                people_needed: aiPeopleNeeded,
                task_date: taskDate,
              }),
            })
            const data = await res.json()
            if (!data.success) throw new Error(data.message)
            const suggestion = data.suggestion as AiAssignSuggestion
            setAiSuggestion(suggestion)
            setAiDeptId(suggestion.department_id)
            setAiManagerIds(suggestion.suggested_manager_ids)
            const due = new Date(suggestion.due_at)
            setAiDueDate(formatDateKey(due))
            setAiDueTime(due.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }))
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
            const res = await fetch('/api/task', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                company_id: companyId,
                department_id: aiDeptId,
                title: aiTitle.trim(),
                description: aiDescription || null,
                priority: aiPriority,
                due_at,
                assigned_user_id: aiManagerIds[0] || null,
                assigned_by: internalUserId || null,
                status: 'Assigned',
                percentage_complete: 0,
                task_date: taskDate,
              }),
            })
            const data = await res.json()
            if (!data.success) throw new Error(data.message)
            const parentId = data.task.id as string
            if (aiSuggestion.steps.length > 0) {
              await Promise.all(aiSuggestion.steps.map((step, i) =>
                fetch('/api/task', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    company_id: companyId,
                    department_id: aiDeptId,
                    parent_task_id: parentId,
                    title: step.title,
                    description: step.description,
                    priority: aiPriority,
                    due_at,
                    assigned_user_id: aiManagerIds.length > 0 ? aiManagerIds[i % aiManagerIds.length] : null,
                    assigned_by: internalUserId || null,
                    status: 'Assigned',
                    percentage_complete: 0,
                    task_date: taskDate,
                  }),
                })
              ))
            }
            setAiModal(false)
            fetchKanban(companyId)
            showTaskToast('Task created successfully.')
          } catch (err) {
            setAiError(err instanceof Error ? err.message : 'Failed to create task')
          } finally {
            setAiCreateLoading(false)
          }
        }

        return (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, animation: 'overlayFadeIn 0.18s ease-out' }}>
            <div onClick={e => e.stopPropagation()} style={{ width: 560, maxHeight: '90vh', background: '#FFFFFF', borderRadius: 20, overflow: 'hidden', boxShadow: '0 24px 64px rgba(0,0,0,0.18)', display: 'flex', flexDirection: 'column', animation: 'modalSlideIn 0.22s cubic-bezier(0.16,1,0.3,1)' }}>

              {/* Header */}
              <div style={{ padding: '20px 24px 18px', borderBottom: '1px solid #F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 32, height: 32, borderRadius: 9, background: 'linear-gradient(135deg, #7C3AED, #6D28D9)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Sparkles size={15} color="#fff" strokeWidth={2} />
                  </div>
                  <div>
                    <p style={{ margin: 0, fontWeight: 700, fontSize: '1rem', color: '#111827' }}>AI Assign</p>
                    <p style={{ margin: 0, fontSize: 11, color: '#9CA3AF' }}>{isReview ? 'Review and confirm' : 'Powered by OpenAI'}</p>
                  </div>
                </div>
                <button onClick={() => setAiModal(false)} style={{ background: '#F9FAFB', border: '1px solid #E5E7EB', cursor: 'pointer', color: '#6B7280', display: 'flex', padding: '6px', borderRadius: 8 }}>
                  <X size={16} />
                </button>
              </div>

              {/* Body */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>

                {!isReview ? (
                  <>
                    {/* Title */}
                    <div>
                      <label style={modalLabelStyle}>Task Title <span style={{ color: '#F97316' }}>*</span></label>
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
                        rows={3}
                        placeholder="Add context to help AI break this down accurately..."
                        style={{ ...modalInputStyle, resize: 'vertical', lineHeight: 1.55 }}
                      />
                    </div>

                    {/* Priority + People Needed */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                      <div>
                        <label style={modalLabelStyle}>Priority <span style={{ color: '#F97316' }}>*</span></label>
                        <DropdownField
                          value={aiPriority}
                          options={priorityDropdownOptions}
                          onChange={setAiPriority}
                          placeholder="Select priority"
                        />
                      </div>
                      <div>
                        <label style={modalLabelStyle}>People Needed</label>
                        <div style={{ display: 'flex', gap: 6 }}>
                          {[1, 2, 3].map(n => (
                            <button
                              key={n}
                              type="button"
                              onClick={() => setAiPeopleNeeded(n)}
                              style={{ flex: 1, height: 42, border: `1.5px solid ${aiPeopleNeeded === n ? '#7C3AED' : '#E5E7EB'}`, borderRadius: 8, background: aiPeopleNeeded === n ? '#7C3AED' : '#FFFFFF', color: aiPeopleNeeded === n ? '#FFFFFF' : '#374151', fontWeight: 700, fontSize: '0.9375rem', cursor: 'pointer' }}
                            >
                              {n}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    <InlineError message={aiError} />

                    <button
                      onClick={handleGenerate}
                      disabled={aiLoading}
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '11px', background: aiLoading ? '#EDE9FE' : 'linear-gradient(135deg, #7C3AED, #6D28D9)', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: '0.9375rem', color: '#fff', cursor: aiLoading ? 'default' : 'pointer' }}
                    >
                      {aiLoading ? <><Spinner size={16} /> Generating...</> : <><Sparkles size={15} /> Generate</>}
                    </button>
                  </>
                ) : aiSuggestion && (
                  <>
                    {/* Steps */}
                    <div>
                      <label style={modalLabelStyle}>Completion Steps</label>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {aiSuggestion.steps.map((step, i) => (
                          <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 9, padding: '9px 11px', border: '1px solid #E5E7EB', borderRadius: 9, background: '#FAFAFA' }}>
                            <span style={{ flexShrink: 0, width: 18, height: 18, borderRadius: 999, background: '#EDE9FE', color: '#7C3AED', fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 1 }}>{i + 1}</span>
                            <div style={{ minWidth: 0 }}>
                              <p style={{ margin: 0, fontWeight: 600, fontSize: '0.8125rem', color: '#111827' }}>{step.title}</p>
                              <p style={{ margin: '2px 0 0', fontSize: '0.75rem', color: '#6B7280', lineHeight: 1.45 }}>{step.description}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Divider */}
                    <div style={{ borderTop: '1px dashed #E5E7EB' }} />

                    {/* Department */}
                    <div>
                      <label style={modalLabelStyle}>Department <span style={{ fontSize: 11, fontWeight: 400, color: '#7C3AED' }}>· AI picked</span></label>
                      <DropdownField
                        value={aiDeptId}
                        options={deptDropdownOptions}
                        onChange={v => { setAiDeptId(v); setAiManagerIds([]) }}
                        placeholder="Select department"
                      />
                    </div>

                    {/* Assign To (multi-select, up to people_needed) */}
                    <div>
                      <label style={modalLabelStyle}>
                        Assign To <span style={{ fontWeight: 400, color: '#9CA3AF' }}>({aiManagerIds.length}/{aiPeopleNeeded} selected)</span>
                        <span style={{ fontSize: 11, fontWeight: 400, color: '#7C3AED', marginLeft: 6 }}>· AI picked</span>
                      </label>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {aiDeptManagers.length === 0 && (
                          <p style={{ margin: 0, fontSize: '0.8125rem', color: '#9CA3AF', fontStyle: 'italic' }}>No managers in this department.</p>
                        )}
                        {aiDeptManagers.map(m => {
                          const cand = aiSuggestion.candidates.find(c => c.id === m.id)
                          const checked = aiManagerIds.includes(m.id)
                          const isAiPick = aiSuggestion.suggested_manager_ids.includes(m.id)
                          const atLimit = aiManagerIds.length >= aiPeopleNeeded && !checked
                          return (
                            <div
                              key={m.id}
                              onClick={() => {
                                if (atLimit) return
                                setAiManagerIds(prev => checked ? prev.filter(id => id !== m.id) : [...prev, m.id])
                              }}
                              style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '9px 11px', border: `1.5px solid ${checked ? '#7C3AED' : '#E5E7EB'}`, borderRadius: 9, background: checked ? '#FAF5FF' : '#FFFFFF', cursor: atLimit ? 'not-allowed' : 'pointer', opacity: atLimit ? 0.5 : 1 }}
                            >
                              <div style={{ width: 16, height: 16, borderRadius: 5, border: `2px solid ${checked ? '#7C3AED' : '#D1D5DB'}`, background: checked ? '#7C3AED' : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                {checked && <CheckCircle size={11} color="#fff" strokeWidth={3} />}
                              </div>
                              <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#111827' }}>{m.full_name}</span>
                              {cand && <span style={{ fontSize: 11, color: '#9CA3AF' }}>{cand.active_task_count} active</span>}
                              {isAiPick && <span style={{ fontSize: 10, fontWeight: 700, color: '#7C3AED', marginLeft: 'auto' }}>AI PICK</span>}
                            </div>
                          )
                        })}
                      </div>
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
                        />
                      </div>
                      <div>
                        <label style={modalLabelStyle}>Deadline <span style={{ fontSize: 11, fontWeight: 400, color: '#7C3AED' }}>· AI suggested</span></label>
                        <DeadlineDateTimePicker
                          dateValue={aiDueDate}
                          timeValue={aiDueTime}
                          onChange={(date, time) => { setAiDueDate(date); setAiDueTime(time) }}
                          minDate={formatDateKey(new Date())}
                        />
                      </div>
                    </div>

                    <InlineError message={aiError} />
                  </>
                )}
              </div>

              {/* Footer */}
              {isReview && (
                <div style={{ padding: '14px 24px', borderTop: '1px solid #F3F4F6', display: 'flex', gap: 10, flexShrink: 0 }}>
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
