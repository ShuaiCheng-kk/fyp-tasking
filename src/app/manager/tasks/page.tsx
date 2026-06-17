'use client'

import { useState, useEffect, useCallback, useRef, useMemo, Fragment } from 'react'
import { useRouter } from 'next/navigation'
import { createPortal } from 'react-dom'
import {
  Plus, X, ChevronDown, AlertCircle,
  CheckCircle, Clock, Eye, Layers, MoreHorizontal,
  Copy, UserCog, UserRound, Pencil, Trash2, CalendarDays, ChevronLeft, ChevronRight,
} from 'lucide-react'
import { createBrowserClient } from '@supabase/ssr'
import ManagerSidebar from '@/components/ManagerSidebar'
import { Task, TaskInput, KanbanGroup } from '@/types/Task'
import { TimelineRow, TimelineShiftBlock } from '@/types/Timeline'

// ─── Theme ────────────────────────────────────────────────────────────────────

const TASK_BLUE   = '#2563EB'
const TASK_BORDER = '#E2E8F0'
const TASK_TEXT   = '#0F172A'

// ─── Task Date Picker ──────────────────────────────────────────────────────────

function TaskDatePicker({ value, onChange, taskDates, minDate }: {
  value: string
  onChange: (date: string) => void
  taskDates: Set<string>
  minDate: string
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
          if (date < minDate) return <div key={date} style={{ height: 36 }} />
          const isSel = date === value
          const isToday = date === todayStr
          const isPast = date < todayStr
          const hasTask = taskDates.has(date)
          return (
            <button key={date} type="button" onClick={() => { onChange(date); setOpen(false) }}
              style={{ height: 36, width: '100%', border: isToday && !isSel ? `2px solid ${TASK_BLUE}` : 'none', borderRadius: 8, background: isSel ? TASK_BLUE : 'transparent', color: isSel ? '#FFFFFF' : isToday ? TASK_BLUE : TASK_TEXT, fontWeight: isSel || isToday ? 700 : 400, fontSize: 13, cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2, padding: 0 }}
              onMouseEnter={e => { if (!isSel) e.currentTarget.style.background = '#F8FAFC' }}
              onMouseLeave={e => { if (!isSel) e.currentTarget.style.background = 'transparent' }}
            >
              <span style={{ lineHeight: 1 }}>{parseInt(date.split('-')[2])}</span>
              {hasTask && <span style={{ width: 4, height: 4, borderRadius: '50%', background: isPast ? '#94A3B8' : isSel ? 'rgba(255,255,255,0.8)' : TASK_BLUE, flexShrink: 0 }} />}
            </button>
          )
        })}
      </div>
    </div>
  ) : null

  return (
    <>
      <button ref={triggerRef} type="button" onClick={handleOpen}
        style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 38, padding: '0 12px', border: `1px solid ${TASK_BORDER}`, borderRadius: 9, background: '#FFFFFF', cursor: 'pointer', fontSize: 13, fontWeight: 500, color: TASK_TEXT, minWidth: 140 }}
      >
        <CalendarDays size={14} color="#64748B" style={{ flexShrink: 0 }} />
        <span>{displayLabel}</span>
      </button>
      {typeof document !== 'undefined' && createPortal(popover, document.body)}
    </>
  )
}

// ─── Local page types ─────────────────────────────────────────────────────────

type Department = { id: string; name: string }
type Member = { id: string; full_name: string; role: string; department_id: string | null }
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

function formatDateKey(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

function isDueOverdue(due: string): boolean {
  return new Date(due) < new Date()
}

import { deptColor, setDeptColorOverrides } from '@/lib/deptColor'

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
          padding: '10px 12px', border: `1.5px solid ${open ? TASK_BLUE : '#E5E7EB'}`, borderRadius: 8,
          background: disabled ? '#F9FAFB' : '#FAFAFA', cursor: canOpen ? 'pointer' : 'default',
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
                  border: 'none', background: isSel ? '#EFF6FF' : 'transparent',
                  color: isSel ? '#2563EB' : '#374151', fontWeight: isSel ? 700 : 400,
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

// ─── Deadline Time Picker ─────────────────────────────────────────────────────

function DeadlineTimePicker({ value, onChange, shiftStart, shiftEnd }: {
  value: string
  onChange: (v: string) => void
  shiftStart: string
  shiftEnd: string
}) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0 })
  const triggerRef = useRef<HTMLButtonElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const h = (e: MouseEvent) => {
      if (!triggerRef.current?.contains(e.target as Node) && !dropdownRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [open])

  useEffect(() => {
    if (open && listRef.current) {
      const sel = listRef.current.querySelector('[data-selected="true"]') as HTMLElement | null
      if (sel) sel.scrollIntoView({ block: 'center' })
    }
  }, [open])

  const times = useMemo(() => {
    const [sh, sm] = shiftStart.split(':').map(Number)
    const [eh, em] = shiftEnd.split(':').map(Number)
    const startMins = sh * 60 + (sm || 0)
    const endMins = eh * 60 + (em || 0)
    const res: { value: string; label: string }[] = []
    for (let mins = startMins; mins <= endMins; mins += 30) {
      const h = Math.floor(mins / 60)
      const m = mins % 60
      const dh = h === 0 ? 12 : h > 12 ? h - 12 : h
      const ampm = h < 12 ? 'AM' : 'PM'
      res.push({ value: `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`, label: `${dh}:${String(m).padStart(2, '0')} ${ampm}` })
    }
    return res
  }, [shiftStart, shiftEnd])

  const hNum = value ? parseInt(value.split(':')[0]) : -1
  const mNum = value ? parseInt(value.split(':')[1]) : 0
  const displayLabel = value
    ? `${hNum === 0 ? 12 : hNum > 12 ? hNum - 12 : hNum}:${String(mNum).padStart(2, '0')} ${hNum < 12 ? 'AM' : 'PM'}`
    : 'Select time'

  const handleOpen = () => {
    if (!open && triggerRef.current) {
      const r = triggerRef.current.getBoundingClientRect()
      const DROPDOWN_H = 200
      const fitsBelow = r.bottom + DROPDOWN_H + 4 <= window.innerHeight
      setPos({ top: fitsBelow ? r.bottom + 4 : r.top - DROPDOWN_H - 4, left: r.left, width: r.width })
    }
    setOpen(o => !o)
  }

  return (
    <div style={{ position: 'relative' }}>
      <button ref={triggerRef} type="button" onClick={handleOpen}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '10px 12px', border: `1.5px solid ${open ? TASK_BLUE : '#E5E7EB'}`, borderRadius: 8,
          background: '#FAFAFA', cursor: 'pointer', fontSize: '0.9375rem',
          color: value ? '#111827' : '#9CA3AF', fontWeight: value ? 500 : 400,
          outline: 'none', boxSizing: 'border-box', transition: 'border-color 0.15s',
        }}>
        <span>{displayLabel}</span>
        <ChevronDown size={13} style={{ color: '#9CA3AF', flexShrink: 0, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
      </button>
      {open && (
        <div ref={dropdownRef} style={{
          position: 'fixed', top: pos.top, left: pos.left, width: pos.width,
          background: '#FFFFFF', border: '1.5px solid #E5E7EB', borderRadius: 10,
          boxShadow: '0 8px 24px rgba(15,23,42,0.12)', zIndex: 9999, overflow: 'hidden',
        }}>
          <div ref={listRef} style={{ maxHeight: 196, overflowY: 'auto', padding: '4px 0' }}>
            {times.map(t => {
              const isSel = t.value === value
              return (
                <button key={t.value} type="button" data-selected={isSel ? 'true' : 'false'}
                  onClick={() => { onChange(t.value); setOpen(false) }}
                  style={{
                    display: 'block', width: '100%', padding: '8px 14px', textAlign: 'left',
                    border: 'none', background: isSel ? '#EFF6FF' : 'transparent',
                    color: isSel ? '#2563EB' : '#374151', fontWeight: isSel ? 700 : 400,
                    fontSize: 13, cursor: 'pointer',
                  }}
                  onMouseEnter={e => { if (!isSel) e.currentTarget.style.background = '#F9FAFB' }}
                  onMouseLeave={e => { if (!isSel) e.currentTarget.style.background = 'transparent' }}
                >{t.label}</button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Task Card ────────────────────────────────────────────────────────────────

function TaskCard({
  task, members, shiftOptions, onClick, onEdit, onDelete, onDuplicate,
}: {
  task: Task
  members: Member[]
  shiftOptions: ShiftOption[]
  onClick: () => void
  onEdit: () => void
  onDelete: () => void
  onDuplicate: () => void
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 })
  const menuRef = useRef<HTMLDivElement>(null)
  const menuBtnRef = useRef<HTMLButtonElement>(null)
  const menuPortalRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!menuOpen) return
    const h = (e: MouseEvent) => {
      const t = e.target as Node
      if (!menuRef.current?.contains(t) && !menuPortalRef.current?.contains(t)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [menuOpen])

  const assignee = members.find(m => m.id === task.assigned_user_id)
  const priority = task.priority ? PRIORITY_COLORS[task.priority] : null
  const overdue = task.due_at && task.status !== 'Complete' && isDueOverdue(task.due_at)

  const MENU_ITEMS = [
    { label: 'Edit',      icon: <Pencil size={13} style={{ color: TASK_BLUE }} />,  action: onEdit,      color: '#374151' },
    { label: 'Duplicate', icon: <Copy size={13} style={{ color: TASK_BLUE }} />,    action: onDuplicate, color: '#374151' },
  ]

  return (
    <div
      onClick={onClick}
      className="task-card"
      style={{
        background: '#FFFFFF',
        border: '1px solid #E5E7EB',
        borderRadius: '10px',
        padding: '12px 14px',
        cursor: 'pointer',
        position: 'relative',
        zIndex: menuOpen ? 100 : undefined,
        marginBottom: 8,
      }}
    >
      {/* Top row: priority badge + ... menu */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 7 }}>
        <div>
          {priority && task.priority && (
            <span style={{ fontSize: '0.75rem', fontWeight: 800, padding: '3px 9px', borderRadius: '99px', background: priority.bg, color: priority.text, letterSpacing: '0.01em' }}>
              {task.priority}
            </span>
          )}
        </div>
        <div ref={menuRef} style={{ position: 'relative', flexShrink: 0 }}>
          <button
            ref={menuBtnRef}
            onClick={e => {
              e.stopPropagation()
              if (!menuOpen && menuBtnRef.current) {
                const r = menuBtnRef.current.getBoundingClientRect()
                const menuW = 152
                const left = Math.max(8, Math.min(r.right - menuW, window.innerWidth - menuW - 8))
                setMenuPos({ top: r.bottom + 4, left })
              }
              setMenuOpen(o => !o)
            }}
            style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '2px 4px', borderRadius: 5, color: '#9CA3AF', display: 'flex', alignItems: 'center', lineHeight: 1 }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(0,0,0,0.07)'; e.currentTarget.style.color = '#374151' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#9CA3AF' }}
          >
            <MoreHorizontal size={14} />
          </button>
          {menuOpen && typeof document !== 'undefined' && createPortal(
            <div ref={menuPortalRef} style={{ position: 'fixed', top: menuPos.top, left: menuPos.left, background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: 12, boxShadow: '0 8px 32px rgba(0,0,0,0.14)', zIndex: 9999, width: 152, padding: '6px 4px' }}>
              <p style={{ margin: '0 6px 3px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#9CA3AF' }}>Task</p>
              {MENU_ITEMS.map(item => (
                <button key={item.label} type="button"
                  onClick={e => { e.stopPropagation(); setMenuOpen(false); item.action() }}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '5px 10px', textAlign: 'left', border: 'none', background: 'transparent', color: item.color, fontWeight: 500, fontSize: 12, cursor: 'pointer', borderRadius: 10 }}
                  onMouseEnter={e => { e.currentTarget.style.background = '#F9FAFB' }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                >
                  {item.icon}
                  {item.label}
                </button>
              ))}
              <div style={{ height: 1, background: '#F1F5F9', margin: '3px 6px' }} />
              <button type="button"
                onClick={e => { e.stopPropagation(); setMenuOpen(false); onDelete() }}
                style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '5px 10px', textAlign: 'left', border: 'none', background: 'transparent', color: '#DC2626', fontWeight: 500, fontSize: 12, cursor: 'pointer', borderRadius: 10 }}
                onMouseEnter={e => { e.currentTarget.style.background = '#FEF2F2' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
              >
                <Trash2 size={13} /> Delete
              </button>
            </div>,
            document.body
          )}
        </div>
      </div>

      {/* Title */}
      <p style={{ fontWeight: 600, fontSize: '0.875rem', color: '#111827', margin: '0 0 10px', lineHeight: 1.4 }}>
        {task.title}
      </p>

      {/* Footer: assignee + deadline time */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        {assignee ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div className="task-card-icon" style={{ width: 22, height: 22, borderRadius: '50%', background: '#EFF6FF', border: '1.5px solid #2563EB', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <UserCog size={12} color="#2563EB" strokeWidth={2} />
            </div>
            <span style={{ fontSize: '0.75rem', color: '#374151', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {assignee.full_name}
            </span>
          </div>
        ) : (
          <span style={{ fontSize: '0.75rem', color: '#CBD5E1', fontStyle: 'italic' }}>No assignee</span>
        )}
        {task.due_at && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
            {overdue && <AlertCircle size={11} color="#EF4444" />}
            <span style={{ fontSize: '0.7rem', fontWeight: 600, color: overdue ? '#EF4444' : '#9CA3AF' }}>
              {new Date(task.due_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ManagerTasksPage() {
  const router = useRouter()

  const [internalUserId, setInternalUserId] = useState('')
  const [companyId,      setCompanyId]      = useState('')
  const [managerName,    setManagerName]    = useState('')
  const [initialReady,   setInitialReady]   = useState(false)

  const [departments, setDepartments] = useState<Department[]>([])
  const [members,     setMembers]     = useState<Member[]>([])
  const [shiftOptions, setShiftOptions] = useState<ShiftOption[]>([])

  const [deptManagerMap,  setDeptManagerMap]   = useState<Record<string, string>>({})
  const [allManagers,     setAllManagers]      = useState<ManagerInfo[]>([])

  const [kanban,        setKanban]        = useState<KanbanGroup | null>(null)
  const [kanbanLoading, setKanbanLoading] = useState(false)
  const [taskDate,      setTaskDate]      = useState(() => formatDateKey(new Date()))

  // Task detail/edit panel
  const [selectedTask,  setSelectedTask]  = useState<Task | null>(null)
  const [editLoading,   setEditLoading]   = useState(false)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [duplicateLoading, setDuplicateLoading] = useState(false)
  const [panelError,    setPanelError]    = useState('')
  const [editTitle,       setEditTitle]       = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editPriority,    setEditPriority]    = useState('')
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

  // Employee filter
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('')

  // New task modal
  const [newTaskModal,    setNewTaskModal]    = useState(false)
  const [newTitle,        setNewTitle]        = useState('')
  const [newDescription,  setNewDescription]  = useState('')
  const [newDeptId,       setNewDeptId]       = useState('')
  const [newAssigneeId,   setNewAssigneeId]   = useState('')
  const [newShiftId,      setNewShiftId]      = useState('')
  const [newPriority,     setNewPriority]     = useState('')
  const [newDeadlineTime, setNewDeadlineTime] = useState('')
  const [newLoading,      setNewLoading]      = useState(false)
  const [newError,        setNewError]        = useState('')

  const panelRef = useRef<HTMLDivElement>(null)

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

      fetch(`/api/user/me?user_id=${userIdResolved}`)
        .then(r => r.json())
        .then(d => {
          if (!cancelled && d.success) {
            if (d.user?.full_name) setManagerName(d.user.full_name)
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
    if (!companyId || !internalUserId) return
    Promise.all([
      fetch(`/api/company/departments?company_id=${companyId}`).then(r => r.json()),
      fetch(`/api/team/members?company_id=${companyId}`).then(r => r.json()),
      fetch(`/api/company/managers?company_id=${companyId}`).then(r => r.json()),
      fetch(`/api/manager/departments?manager_id=${internalUserId}&company_id=${companyId}`).then(r => r.json()),
    ]).then(([deptData, memberData, mgrData, managerDeptData]) => {
      const managerDeptIds = new Set((managerDeptData.success ? managerDeptData.departments : []).map((dept: { department_id: string }) => dept.department_id))
      if (deptData.success) {
        setDepartments(deptData.departments.filter((dept: Department) => managerDeptIds.has(dept.id)))
        setDeptColorOverrides(deptData.departments)
      }
      if (memberData.success) setMembers(memberData.members.filter((member: Member) => member.department_id && managerDeptIds.has(member.department_id)))
      if (mgrData.success) {
        setAllManagers(mgrData.managers)
        const map: Record<string, string> = {}
        for (const mgr of mgrData.managers as ManagerInfo[]) {
          if (mgr.department_id && !map[mgr.department_id]) map[mgr.department_id] = mgr.full_name
        }
        setDeptManagerMap(map)
      }
    }).catch(() => {})
  }, [companyId, internalUserId])

  // ── Fetch shift options ────────────────────────────────────────────────────

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

  // ── Open task panel ────────────────────────────────────────────────────────

  const openTask = (task: Task, viewOnly = false) => {
    setTaskViewMode(viewOnly)
    setSelectedTask(task)
    setEditTitle(task.title)
    setEditDescription(task.description ?? '')
    setEditPriority(task.priority ?? '')
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
    if (!selectedTask || !editTitle.trim()) return
    if (editAssignee && !editShiftId) { setPanelError('Please select a shift for the assignee'); return }
    setEditLoading(true); setPanelError('')
    try {
      const resolvedShift = shiftOptions.find(x => x.id === editShiftId)
      const due_at = resolvedShift && editDeadlineTime
        ? new Date(`${resolvedShift.shift_date}T${editDeadlineTime}:00`).toISOString()
        : null
      const payload = {
        id: selectedTask.id,
        company_id: selectedTask.company_id,
        department_id: selectedTask.department_id,
        title: editTitle.trim(),
        description: editDescription || null,
        priority: editPriority || null,
        due_at,
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
      if (resolvedShift?.shift_date) setTaskDate(resolvedShift.shift_date)
      closePanel()
    } catch (err) { setPanelError(err instanceof Error ? err.message : 'Failed to save') }
    finally { setEditLoading(false) }
  }

  // ── Delete task ────────────────────────────────────────────────────────────

  const handleDeleteTask = async () => {
    if (!selectedTask) return
    setDeleteLoading(true)
    const taskId = selectedTask.id
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
    } catch { fetchKanban(companyId, true) }
    finally { setDeleteTaskLoading(false) }
  }

  const handleDuplicateTask = async () => {
    if (!selectedTask) return
    setDuplicateLoading(true); setPanelError('')
    try {
      const res = await fetch('/api/task', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'duplicate', id: selectedTask.id, assigned_by: internalUserId || undefined }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.message)
      closePanel()
      fetchKanban(companyId, true)
    } catch (err) { setPanelError(err instanceof Error ? err.message : 'Failed to duplicate task') }
    finally { setDuplicateLoading(false) }
  }

  const handleQuickDuplicate = async (task: Task) => {
    try {
      const res = await fetch('/api/task', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'duplicate', id: task.id, assigned_by: internalUserId || undefined }),
      })
      const data = await res.json()
      if (data.success) fetchKanban(companyId, true)
    } catch {}
  }

  // ── Create sub-task ────────────────────────────────────────────────────────

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
    } catch (err) { setPanelError(err instanceof Error ? err.message : 'Failed to create sub-task') }
    finally { setSubTaskLoading(false) }
  }

  // ── Create task ────────────────────────────────────────────────────────────

  const openNewTaskFor = (memberId: string, deptId: string) => {
    setNewDeptId(deptId)
    setNewAssigneeId(memberId)
    setNewShiftId('')
    setNewTitle(''); setNewDescription(''); setNewPriority(''); setNewDeadlineTime(''); setNewError('')
    setNewTaskModal(true)
  }

  const handleCreateTask = async () => {
    if (!newTitle.trim() || !newDeptId) { setNewError('Title and department are required'); return }
    if (newAssigneeId && !newShiftId) { setNewError('Please select a shift for the assignee'); return }
    setNewLoading(true); setNewError('')
    try {
      const selShift = newTaskShiftOptions.find(s => s.id === newShiftId)
      const input: Partial<TaskInput> & { company_id: string; department_id: string; title: string } = {
        company_id: companyId,
        department_id: newDeptId,
        title: newTitle.trim(),
        description: newDescription || null,
        assigned_user_id: newAssigneeId || null,
        assigned_by: internalUserId || null,
        shift_id: newShiftId || null,
        priority: newPriority || null,
        due_at: selShift && newDeadlineTime ? new Date(`${selShift.shift_date}T${newDeadlineTime}:00`).toISOString() : null,
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
      setNewTitle(''); setNewDescription(''); setNewDeptId(''); setNewAssigneeId(''); setNewShiftId(''); setNewPriority(''); setNewDeadlineTime('')
      fetchKanban(companyId)
    } catch (err) { setNewError(err instanceof Error ? err.message : 'Failed to create task') }
    finally { setNewLoading(false) }
  }

  // ── Dates that have tasks (for calendar dots) ─────────────────────────────

  const datesWithTasks = useMemo<Set<string>>(() => {
    if (!kanban) return new Set()
    const allTasks = [...kanban.Assigned, ...kanban['In Progress'], ...kanban.Review, ...kanban.Complete]
    const dates = new Set<string>()
    for (const t of allTasks) {
      if (t.shift_id) {
        const date = t.shift_date ?? shiftOptions.find(s => s.id === t.shift_id)?.shift_date ?? null
        if (date) dates.add(date)
      } else if (t.due_at) {
        dates.add(t.due_at.slice(0, 10))
      }
    }
    return dates
  }, [kanban, shiftOptions])

  const minTaskDate = useMemo(() => {
    const d = addDays(new Date(), -7)
    const dow = (d.getDay() + 6) % 7
    return formatDateKey(addDays(d, -dow))
  }, [])

  // ── Filtered tasks per column ──────────────────────────────────────────────

  const visibleDeptIds = useMemo(() => new Set(departments.map(d => d.id)), [departments])

  const filteredTasks = (col: Task['status']): Task[] => {
    if (!kanban) return []
    return (kanban[col] ?? [])
      .filter(t => visibleDeptIds.has(t.department_id))
      .filter(t => !selectedEmployeeId || t.assigned_user_id === selectedEmployeeId)
      .filter(t => {
        if (t.shift_id) {
          const date = t.shift_date ?? shiftOptions.find(s => s.id === t.shift_id)?.shift_date ?? null
          return date === taskDate
        }
        if (t.due_at) return t.due_at.slice(0, 10) === taskDate
        return false
      })
      .sort((a, b) => (PRIORITY_ORDER[a.priority ?? ''] ?? 4) - (PRIORITY_ORDER[b.priority ?? ''] ?? 4))
  }

  const assignableMembers = members.filter(m => m.role === 'Employee')
  const _todayStr = formatDateKey(new Date())
  const newTaskShiftOptions = (newAssigneeId
    ? shiftOptions.filter(s => s.user_id === newAssigneeId)
    : newDeptId
      ? shiftOptions.filter(s => s.department_id === newDeptId)
      : shiftOptions
  ).filter(s => s.shift_date >= _todayStr)
  const selectedShiftForDeadline = newTaskShiftOptions.find(s => s.id === newShiftId) ?? null
  const newTaskDeptMembers = newDeptId ? assignableMembers.filter(m => m.department_id === newDeptId) : assignableMembers
  const newAssigneeDropdownOptions = newTaskDeptMembers.map(m => ({ value: m.id, label: m.full_name }))
  const newShiftDropdownOptions = newTaskShiftOptions.map(s => ({
    value: s.id,
    label: `${new Date(`${s.shift_date}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} · ${s.start_time.slice(0, 5)} – ${s.end_time.slice(0, 5)}`,
  }))
  const editTaskShiftOptions = selectedTask ? shiftOptions.filter(shift => shift.department_id === selectedTask.department_id) : shiftOptions
  const editAssigneeShiftOptions = editAssignee
    ? editTaskShiftOptions.filter(s => s.user_id === editAssignee)
    : editTaskShiftOptions
  const editShiftDropdownOptions = editAssigneeShiftOptions.map(s => ({
    value: s.id,
    label: `${new Date(`${s.shift_date}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} · ${s.start_time.slice(0, 5)} – ${s.end_time.slice(0, 5)}`,
  }))
  const editAssigneeDropdownOptions = assignableMembers.map(m => ({ value: m.id, label: m.full_name }))
  const editSelectedShiftForDeadline = editAssigneeShiftOptions.find(s => s.id === editShiftId) ?? null
  const priorityDropdownOptions: { value: string; label: string }[] = [
    { value: '', label: 'None' },
    ...(['Low', 'Medium', 'High', 'Urgent'] as PriorityLevel[]).map(p => ({ value: p, label: p })),
  ]
  const selectedSubTasks = selectedTask && kanban
    ? COLUMNS.flatMap(col => kanban[col]).filter(task => task.parent_task_id === selectedTask.id)
    : []

  // ── Button helpers ────────────────────────────────────────────────────────

  const primaryBtn = (loading: boolean): React.CSSProperties => ({
    flex: 1, padding: '10px', background: TASK_BLUE, border: 'none', borderRadius: '8px',
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
      <ManagerSidebar />

      <style>{`
        @keyframes dropdownFadeIn {
          from { opacity: 0; transform: translateY(-6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadeSlideUp {
          from { opacity: 0; transform: translateY(14px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes slideInLeft {
          from { opacity: 0; transform: translateX(-12px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        @keyframes scaleIn {
          from { opacity: 0; transform: scale(0.95); }
          to   { opacity: 1; transform: scale(1); }
        }
        @keyframes iconBounce {
          0%, 100% { transform: translateY(0); }
          40%      { transform: translateY(-3px); }
          70%      { transform: translateY(-1px); }
        }
        .task-card {
          transition: box-shadow 0.16s ease, transform 0.16s ease, border-color 0.16s ease;
        }
        .task-card:hover {
          box-shadow: 0 6px 22px rgba(0,0,0,0.10), 0 0 0 1.5px rgba(37,99,235,0.15) !important;
          transform: translateY(-2px);
        }
        .task-card:hover .task-card-icon {
          animation: iconBounce 0.45s ease forwards;
        }
        .kanban-col {
          transition: box-shadow 0.18s ease;
        }
        .kanban-col:hover {
          box-shadow: 0 4px 18px rgba(0,0,0,0.06);
        }
        /* Employee filter pills */
        .dept-pill {
          transition: all 0.13s ease;
        }
        .dept-pill:hover {
          transform: translateY(-1px);
          box-shadow: 0 2px 8px rgba(0,0,0,0.08);
        }

        .member-card {
          transition: box-shadow 0.15s ease, transform 0.15s ease, border-color 0.15s ease;
        }
        .member-card:hover {
          box-shadow: 0 4px 14px rgba(0,0,0,0.07);
          transform: translateX(2px);
          border-color: #93C5FD !important;
        }
        .assign-task-btn {
          transition: background 0.13s ease, transform 0.13s ease, box-shadow 0.13s ease;
        }
        .assign-task-btn:hover {
          background: #DBEAFE !important;
          border-color: #60A5FA !important;
          transform: scale(1.12);
          box-shadow: 0 2px 8px rgba(37,99,235,0.22);
        }
        /* New Task button */
        .new-task-btn {
          transition: background 0.15s ease, transform 0.12s ease, box-shadow 0.15s ease;
        }
        .new-task-btn:hover {
          background: #1D4ED8 !important;
          transform: translateY(-1px);
          box-shadow: 0 4px 14px rgba(37,99,235,0.30);
        }

        .today-btn {
          transition: background 0.15s ease, color 0.15s ease, transform 0.12s ease;
        }
        .today-btn:hover {
          transform: translateY(-1px);
        }
        .kanban-col { animation: scaleIn 0.32s ease both; }
        .task-card:nth-child(1) { animation: fadeSlideUp 0.26s ease both; animation-delay: 0.04s; }
        .task-card:nth-child(2) { animation: fadeSlideUp 0.26s ease both; animation-delay: 0.08s; }
        .task-card:nth-child(3) { animation: fadeSlideUp 0.26s ease both; animation-delay: 0.12s; }
        .task-card:nth-child(4) { animation: fadeSlideUp 0.26s ease both; animation-delay: 0.16s; }
        .task-card:nth-child(5) { animation: fadeSlideUp 0.26s ease both; animation-delay: 0.20s; }
        .member-card:nth-child(1) { animation: slideInLeft 0.24s ease both; animation-delay: 0.05s; }
        .member-card:nth-child(2) { animation: slideInLeft 0.24s ease both; animation-delay: 0.10s; }
        .member-card:nth-child(3) { animation: slideInLeft 0.24s ease both; animation-delay: 0.15s; }
        .member-card:nth-child(4) { animation: slideInLeft 0.24s ease both; animation-delay: 0.20s; }
        .member-card:nth-child(5) { animation: slideInLeft 0.24s ease both; animation-delay: 0.25s; }
      `}</style>

      <main style={{ marginLeft: '64px', flex: 1, height: '100vh', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>

        {/* Page header */}
        <div style={{ padding: '20px 28px 16px', flexShrink: 0, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 24 }}>
          <div>
            <h1 className="mb-0 font-heading text-3xl font-bold tracking-tight text-gray-950">
              Tasks
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
          </div>
        </div>

        {/* Content — single card */}
        <div style={{ padding: '0 28px 28px', flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <div style={{ background: '#FFFFFF', borderRadius: 16, border: '1px solid #E5E7EB', boxShadow: '0 1px 6px rgba(0,0,0,0.06)', flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0 }}>

            {/* ── CARD TOP BAR: employee filter + date nav ── */}
            <div style={{ padding: '14px 20px', borderBottom: '1px solid #F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0, gap: 12, flexWrap: 'wrap' }}>
              {/* Employee pills */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                  <UserRound size={15} style={{ color: TASK_BLUE }} />
                  <span style={{ fontSize: 14, fontWeight: 700, color: '#0F172A', letterSpacing: '-0.2px' }}>Employee:</span>
                </div>
                <button
                  onClick={() => setSelectedEmployeeId('')}
                  className="dept-pill"
                  style={{ padding: '5px 13px', borderRadius: '99px', border: selectedEmployeeId === '' ? `2px solid ${TASK_BLUE}` : '1.5px solid #E5E7EB', background: selectedEmployeeId === '' ? TASK_BLUE : 'transparent', color: selectedEmployeeId === '' ? '#FFFFFF' : '#374151', fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer', flexShrink: 0 }}
                >
                  All
                </button>
                {assignableMembers.map(m => (
                  <button
                    key={m.id}
                    onClick={() => setSelectedEmployeeId(selectedEmployeeId === m.id ? '' : m.id)}
                    className="dept-pill"
                    style={{ padding: '5px 13px', borderRadius: '99px', border: selectedEmployeeId === m.id ? `2px solid ${TASK_BLUE}` : '1.5px solid #E5E7EB', background: selectedEmployeeId === m.id ? TASK_BLUE : 'transparent', color: selectedEmployeeId === m.id ? '#FFFFFF' : '#374151', fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer', flexShrink: 0 }}
                  >
                    {m.full_name}
                  </button>
                ))}
              </div>
              {/* Date nav */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                <button
                  type="button"
                  onClick={() => setTaskDate(formatDateKey(new Date()))}
                  className="today-btn"
                  style={{ height: 38, padding: '0 14px', border: `1px solid ${TASK_BORDER}`, borderRadius: 8, background: taskDate === formatDateKey(new Date()) ? TASK_BLUE : '#FFFFFF', color: taskDate === formatDateKey(new Date()) ? '#FFFFFF' : TASK_TEXT, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
                >Today</button>
                <button
                  type="button"
                  onClick={() => setTaskDate(formatDateKey(addDays(new Date(`${taskDate}T00:00:00`), -1)))}
                  disabled={taskDate <= minTaskDate}
                  style={{ width: 38, height: 38, borderRadius: 9, border: `1px solid ${TASK_BORDER}`, background: '#FFFFFF', display: 'inline-grid', placeItems: 'center', cursor: taskDate <= minTaskDate ? 'default' : 'pointer', color: TASK_TEXT, opacity: taskDate <= minTaskDate ? 0.3 : 1 }}
                ><ChevronLeft size={16} /></button>
                <TaskDatePicker value={taskDate} onChange={setTaskDate} taskDates={datesWithTasks} minDate={minTaskDate} />
                <button
                  type="button"
                  onClick={() => setTaskDate(formatDateKey(addDays(new Date(`${taskDate}T00:00:00`), 1)))}
                  style={{ width: 38, height: 38, borderRadius: 9, border: `1px solid ${TASK_BORDER}`, background: '#FFFFFF', display: 'inline-grid', placeItems: 'center', cursor: 'pointer', color: TASK_TEXT }}
                ><ChevronRight size={16} /></button>
                {selectedEmployeeId && (
                  <button
                    onClick={() => {
                      const emp = members.find(m => m.id === selectedEmployeeId)
                      setNewTitle(''); setNewDescription(''); setNewPriority(''); setNewShiftId(''); setNewDeadlineTime(''); setNewError('')
                      setNewAssigneeId(selectedEmployeeId)
                      setNewDeptId(emp?.department_id ?? departments[0]?.id ?? '')
                      setNewTaskModal(true)
                    }}
                    className="new-task-btn"
                    style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', background: TASK_BLUE, border: 'none', borderRadius: 8, fontWeight: 600, fontSize: '0.8125rem', color: '#fff', cursor: 'pointer', height: 38, flexShrink: 0 }}
                  >
                    <Plus size={13} strokeWidth={2.5} /> New Task
                  </button>
                )}
              </div>
            </div>

            {/* ── BODY: sidebar + kanban ───────────────────────────────────── */}
            {!initialReady || kanbanLoading ? (
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flex: 1 }}>
                <Spinner size={24} dark />
              </div>
            ) : (
              <div style={{ display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden' }}>

                {/* ── LEFT SIDEBAR: only shown when no employee filter is active ── */}
                {!selectedEmployeeId && departments.length > 0 && (() => {
                  const deptMembers = members.filter(m => m.role === 'Employee')
                  const allDateTasks = COLUMNS.flatMap(col => filteredTasks(col))
                  const busyIds = new Set(allDateTasks.map(t => t.assigned_user_id).filter(Boolean) as string[])
                  const freeMembers = deptMembers.filter(m => !busyIds.has(m.id))
                  const busyMembers = deptMembers.filter(m => busyIds.has(m.id))

                  if (deptMembers.length === 0) return null

                  const renderMember = (m: Member) => (
                    <div key={m.id} className="member-card" style={{ display: 'flex', alignItems: 'center', gap: 8, border: '1px solid #F1F5F9', borderRadius: 12, padding: '9px 10px', background: '#FFFFFF', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0 }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 26, height: 26, borderRadius: 999, background: '#EFF6FF', color: '#2563EB', flexShrink: 0 }}>
                          <UserRound size={13} />
                        </span>
                        <p style={{ margin: 0, color: '#111827', fontSize: 12, fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.full_name}</p>
                      </div>
                      <button
                        onClick={() => openNewTaskFor(m.id, m.department_id ?? departments[0]?.id ?? '')}
                        className="assign-task-btn"
                        style={{ flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 26, height: 26, background: '#EFF6FF', border: '1px solid #93C5FD', borderRadius: 7, color: '#2563EB', cursor: 'pointer' }}
                        title="Assign Task"
                      >
                        <Plus size={13} strokeWidth={2.5} />
                      </button>
                    </div>
                  )

                  return (
                    <div style={{ width: 220, flexShrink: 0, borderRight: '1px solid #F3F4F6', display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
                      <div style={{ padding: '12px 10px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {freeMembers.length > 0 && (
                          <>
                            <p style={{ margin: '0 2px 2px', fontSize: '0.68rem', fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Available</p>
                            {freeMembers.map(renderMember)}
                          </>
                        )}
                        {busyMembers.length > 0 && (
                          <>
                            <p style={{ margin: `${freeMembers.length > 0 ? '10px' : '0'} 2px 2px`, fontSize: '0.68rem', fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Has Tasks</p>
                            {busyMembers.map(renderMember)}
                          </>
                        )}
                      </div>
                    </div>
                  )
                })()}

                {/* ── KANBAN COLUMNS ───────────────────────────────────────── */}
                <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'row', alignItems: 'stretch', padding: '16px 16px 20px', gap: 0 }}>
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
                      <div className="kanban-col" style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', background: '#F7F8FA', borderRadius: '12px', overflow: 'hidden', minHeight: 0, border: '1px solid #F0F1F3', animationDelay: `${0.06 + colIdx * 0.05}s` }}>
                        {/* Column header */}
                        <div style={{ padding: '11px 14px 10px', display: 'flex', alignItems: 'center', gap: 7, flexShrink: 0, borderBottom: '1px solid #ECEEF1' }}>
                          <div style={{ color: cfg.color, display: 'flex', alignItems: 'center' }}>{cfg.icon}</div>
                          <span style={{ fontWeight: 700, fontSize: '0.8125rem', color: cfg.color, flex: 1 }}>{cfg.label}</span>
                          <span style={{ fontSize: '0.72rem', fontWeight: 700, background: cfg.bg, color: cfg.color, padding: '2px 8px', borderRadius: '99px' }}>{tasks.length}</span>
                        </div>
                        {/* Scrollable card area */}
                        <div style={{ flex: 1, overflowY: 'auto', padding: '10px 10px 12px' }}>
                          {tasks.length === 0 ? (
                            <div style={{ margin: '8px 0', padding: '32px 0', textAlign: 'center', background: '#F8FAFC', borderRadius: 14 }}>
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
                                onClick={() => openTask(task, true)}
                                onEdit={() => openTask(task, false)}
                                onDelete={() => { setDeleteTaskModal(task); setDeleteTaskError('') }}
                                onDuplicate={() => handleQuickDuplicate(task)}
                              />
                            ))
                          )}
                        </div>
                      </div>
                      </Fragment>
                    )
                  })}
                </div>

              </div>
            )}

          </div>
        </div>
      </main>

      {/* ═══════════════ TASK VIEW PANEL ═══════════════ */}
      {selectedTask && taskViewMode && (() => {
        const viewAssigneeName = selectedTask.assigned_user_id
          ? (members.find(m => m.id === selectedTask.assigned_user_id)?.full_name ?? 'Unknown')
          : null
        const viewShift = selectedTask.shift_id ? shiftOptions.find(s => s.id === selectedTask.shift_id) : null
        const viewDept = departments.find(d => d.id === selectedTask.department_id)
        const viewPriorityStyle = selectedTask.priority ? PRIORITY_COLORS[selectedTask.priority as keyof typeof PRIORITY_COLORS] : null
        const viewDeadline = selectedTask.due_at
          ? (() => {
              const d = new Date(selectedTask.due_at)
              return d.toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
            })()
          : null
        const viewFieldValue: React.CSSProperties = {
          padding: '10px 12px', border: '1.5px solid #E5E7EB', borderRadius: 8,
          background: '#F9FAFB', fontSize: '0.9375rem', color: '#111827',
          minHeight: 40, display: 'flex', alignItems: 'center',
        }
        const viewEmpty: React.CSSProperties = { ...viewFieldValue, color: '#9CA3AF', fontStyle: 'italic' }
        return (
          <div onClick={closePanel} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
            <div ref={panelRef} onClick={e => e.stopPropagation()}
              style={{ width: 540, background: '#FFFFFF', borderRadius: 20, overflow: 'hidden', boxShadow: '0 24px 64px rgba(0,0,0,0.16), 0 4px 16px rgba(0,0,0,0.08)' }}
            >
              <div style={{ padding: '20px 24px 18px', borderBottom: '1px solid #F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 32, height: 32, borderRadius: 9, background: '#F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Eye size={15} color="#64748B" strokeWidth={2.5} />
                  </div>
                  <span style={{ fontWeight: 700, fontSize: '1.0625rem', color: '#111827' }}>Task Details</span>
                </div>
                <button onClick={closePanel} style={{ background: '#F9FAFB', border: '1px solid #E5E7EB', cursor: 'pointer', color: '#6B7280', display: 'flex', padding: '6px', borderRadius: 8 }}
                  onMouseEnter={e => { e.currentTarget.style.background = '#F3F4F6' }}
                  onMouseLeave={e => { e.currentTarget.style.background = '#F9FAFB' }}
                >
                  <X size={16} />
                </button>
              </div>
              <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16, maxHeight: 'calc(90vh - 130px)', overflowY: 'auto' }}>
                <div>
                  <label style={modalLabelStyle}>Title</label>
                  <div style={viewFieldValue}>{selectedTask.title}</div>
                </div>
                <div>
                  <label style={modalLabelStyle}>Description</label>
                  {selectedTask.description
                    ? <div style={{ ...viewFieldValue, alignItems: 'flex-start', whiteSpace: 'pre-wrap', lineHeight: 1.55 }}>{selectedTask.description}</div>
                    : <div style={viewEmpty}>No description</div>
                  }
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={modalLabelStyle}>Department</label>
                    <div style={viewDept ? viewFieldValue : viewEmpty}>{viewDept?.name ?? 'Unknown'}</div>
                  </div>
                  <div>
                    <label style={modalLabelStyle}>Priority</label>
                    {viewPriorityStyle
                      ? <div style={{ ...viewFieldValue, background: viewPriorityStyle.bg }}>
                          <span style={{ color: viewPriorityStyle.text, fontWeight: 700, fontSize: '0.85rem' }}>{selectedTask.priority}</span>
                        </div>
                      : <div style={viewEmpty}>None</div>
                    }
                  </div>
                </div>
                <div style={{ borderTop: '1px dashed #E5E7EB' }} />
                <div>
                  <label style={modalLabelStyle}>Assigned To</label>
                  {viewAssigneeName
                    ? <div style={viewFieldValue}>{viewAssigneeName}</div>
                    : <div style={viewEmpty}>Unassigned</div>
                  }
                </div>
                <div>
                  <label style={modalLabelStyle}>Shift</label>
                  {viewShift
                    ? <div style={viewFieldValue}>
                        {viewShift.title ? `${viewShift.title} — ` : ''}
                        {new Date(`${viewShift.shift_date}T00:00:00`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}{' '}
                        {viewShift.start_time.slice(0, 5)} – {viewShift.end_time.slice(0, 5)}
                      </div>
                    : <div style={viewEmpty}>No shift assigned</div>
                  }
                </div>
                <div>
                  <label style={modalLabelStyle}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      <Clock size={12} color={TASK_BLUE} />
                      Deadline
                    </span>
                  </label>
                  {viewDeadline
                    ? <div style={viewFieldValue}>{viewDeadline}</div>
                    : <div style={viewEmpty}>No deadline set</div>
                  }
                </div>
              </div>
              <div style={{ padding: '0 24px 20px', display: 'flex', justifyContent: 'flex-end' }}>
                <button style={ghostBtn} onClick={closePanel}>Close</button>
              </div>
            </div>
          </div>
        )
      })()}

      {/* ═══════════════ TASK EDIT PANEL ═══════════════ */}
      {selectedTask && !taskViewMode && (
        <div onClick={closePanel} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div ref={panelRef} onClick={e => e.stopPropagation()} data-testid="task-detail-panel"
            style={{ width: 540, background: '#FFFFFF', borderRadius: 20, overflow: 'hidden', boxShadow: '0 24px 64px rgba(0,0,0,0.16), 0 4px 16px rgba(0,0,0,0.08)' }}
          >
            <div style={{ padding: '20px 24px 18px', borderBottom: '1px solid #F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 32, height: 32, borderRadius: 9, background: 'linear-gradient(135deg, #2563EB, #1D4ED8)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Pencil size={14} color="#fff" strokeWidth={2.5} />
                </div>
                <span style={{ fontWeight: 700, fontSize: '1.0625rem', color: '#111827' }}>Edit Task</span>
              </div>
              <button onClick={closePanel} style={{ background: '#F9FAFB', border: '1px solid #E5E7EB', cursor: 'pointer', color: '#6B7280', display: 'flex', padding: '6px', borderRadius: 8 }}
                onMouseEnter={e => { e.currentTarget.style.background = '#F3F4F6' }}
                onMouseLeave={e => { e.currentTarget.style.background = '#F9FAFB' }}
              >
                <X size={16} />
              </button>
            </div>

            <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16, maxHeight: 'calc(90vh - 140px)', overflowY: 'auto' }}>
              <div>
                <label style={modalLabelStyle}>Title <span style={{ color: TASK_BLUE }}>*</span></label>
                <input autoFocus value={editTitle} onChange={e => setEditTitle(e.target.value)} style={{ ...modalInputStyle, background: '#FAFAFA' }} onKeyDown={e => { if (e.key === 'Enter') handleSaveTask() }} />
              </div>
              <div>
                <label style={modalLabelStyle}>Description <span style={{ color: '#D1D5DB', fontWeight: 400 }}>(optional)</span></label>
                <textarea value={editDescription} onChange={e => setEditDescription(e.target.value)} rows={2} style={{ ...modalInputStyle, resize: 'vertical', background: '#FAFAFA', lineHeight: 1.55 }} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={modalLabelStyle}>Priority</label>
                  <DropdownField value={editPriority} options={priorityDropdownOptions} onChange={v => setEditPriority(v)} placeholder="None" />
                </div>
                <div>
                  <label style={modalLabelStyle}>Assign To</label>
                  <DropdownField value={editAssignee} options={editAssigneeDropdownOptions} onChange={v => { setEditAssignee(v); setEditShiftId(''); setEditDeadlineTime('') }} placeholder="Unassigned" />
                </div>
              </div>
              <div style={{ borderTop: '1px dashed #E5E7EB' }} />
              <div>
                <label style={modalLabelStyle}>
                  Shift
                  {editAssignee && editAssigneeShiftOptions.length === 0 && (
                    <span style={{ fontWeight: 400, color: TASK_BLUE, marginLeft: 8, fontSize: '0.78rem' }}>no upcoming shifts</span>
                  )}
                </label>
                <DropdownField
                  value={editShiftId}
                  options={editShiftDropdownOptions}
                  onChange={v => { setEditShiftId(v); const s = editAssigneeShiftOptions.find(x => x.id === v); if (s) setEditDeadlineTime(s.end_time.slice(0, 5)) }}
                  placeholder={editAssignee ? 'Select shift' : 'Select assignee first'}
                  disabled={!editAssignee}
                />
              </div>
              <div>
                <label style={modalLabelStyle}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <Clock size={12} color={TASK_BLUE} />
                    Deadline
                    {editSelectedShiftForDeadline && (
                      <span style={{ color: '#9CA3AF', fontWeight: 400, fontSize: '0.78rem' }}>
                        — {new Date(`${editSelectedShiftForDeadline.shift_date}T00:00:00`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                      </span>
                    )}
                  </span>
                </label>
                {editSelectedShiftForDeadline ? (
                  <DeadlineTimePicker value={editDeadlineTime} onChange={setEditDeadlineTime} shiftStart={editSelectedShiftForDeadline.start_time.slice(0, 5)} shiftEnd={editSelectedShiftForDeadline.end_time.slice(0, 5)} />
                ) : (
                  <div style={{ padding: '10px 12px', border: '1.5px solid #E5E7EB', borderRadius: 8, background: '#F9FAFB', fontSize: '0.9375rem', color: '#9CA3AF' }}>Select a shift first</div>
                )}
              </div>
              <div>
                <label style={modalLabelStyle}>Sub-tasks</label>
                {selectedSubTasks.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 }}>
                    {selectedSubTasks.map(task => (
                      <div key={task.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '8px 10px', background: '#F8FAFC', border: '1px solid #E5E7EB', borderRadius: 8 }}>
                        <span style={{ fontSize: '0.82rem', color: '#111827', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{task.title}</span>
                        <span style={{ fontSize: '0.7rem', color: STATUS_CONFIG[task.status].color, fontWeight: 700, flexShrink: 0 }}>{task.status}</span>
                      </div>
                    ))}
                  </div>
                )}
                <div style={{ display: 'flex', gap: 8 }}>
                  <input value={subTaskTitle} onChange={e => setSubTaskTitle(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') handleCreateSubTask() }} placeholder="Add a sub-task" style={modalInputStyle} />
                  <button onClick={handleCreateSubTask} disabled={subTaskLoading || !subTaskTitle.trim()} style={{ padding: '0 12px', border: 'none', borderRadius: 8, background: TASK_BLUE, color: '#FFFFFF', fontWeight: 700, fontSize: '0.82rem', cursor: subTaskLoading || !subTaskTitle.trim() ? 'default' : 'pointer', opacity: subTaskLoading || !subTaskTitle.trim() ? 0.6 : 1 }}>
                    Add
                  </button>
                </div>
              </div>
              <InlineError message={panelError} />
            </div>

            <div style={{ padding: '0 24px 20px', display: 'flex', gap: 10 }}>
              {!deleteConfirm ? (
                <>
                  <button onClick={() => setDeleteConfirm(true)} style={{ padding: '8px 14px', background: 'none', border: '1.5px solid #FECACA', borderRadius: 8, fontWeight: 600, fontSize: '0.875rem', color: '#DC2626', cursor: 'pointer' }}>
                    Delete
                  </button>
                  <button onClick={handleDuplicateTask} disabled={duplicateLoading}
                    style={{ padding: '8px 14px', background: '#FFFFFF', border: '1.5px solid #D1D5DB', borderRadius: 8, fontWeight: 600, fontSize: '0.875rem', color: '#374151', cursor: duplicateLoading ? 'default' : 'pointer', opacity: duplicateLoading ? 0.65 : 1, display: 'flex', alignItems: 'center', gap: 6 }}
                  >
                    {duplicateLoading ? <Spinner size={13} dark /> : <Copy size={13} />} Duplicate
                  </button>
                  <div style={{ flex: 1, display: 'flex', gap: 10 }}>
                    <button style={ghostBtn} onClick={closePanel}>Cancel</button>
                    <button
                      style={{ ...primaryBtn(editLoading), background: editLoading ? '#3B82F6' : 'linear-gradient(135deg, #2563EB, #1D4ED8)', border: 'none' }}
                      onClick={handleSaveTask} disabled={editLoading}
                    >
                      {editLoading && <Spinner size={14} />} Save Changes
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <span style={{ fontSize: '0.875rem', color: '#374151', flex: 1 }}>Delete this task?</span>
                  <button style={ghostBtn} onClick={() => setDeleteConfirm(false)}>No</button>
                  <button style={dangerBtn(deleteLoading)} onClick={handleDeleteTask} disabled={deleteLoading}>
                    {deleteLoading && <Spinner size={14} />} Yes, Delete
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════ DELETE TASK MODAL ═══════════════ */}
      {/* ═══════════════ DELETE TASK MODAL ═══════════════ */}
      {deleteTaskModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.42)', display: 'grid', placeItems: 'center', padding: 18, zIndex: 100 }}>
          <div onClick={e => e.stopPropagation()} style={{ width: 'min(480px, 100%)', maxHeight: '88vh', overflowY: 'auto', background: '#FFFFFF', borderRadius: 16, border: '1px solid #E2E8F0', boxShadow: '0 24px 70px rgba(15,23,42,0.32)', padding: 16 }}>
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
        <div onClick={() => setNewTaskModal(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div onClick={e => e.stopPropagation()} style={{ width: 540, background: '#FFFFFF', borderRadius: 20, overflow: 'hidden', boxShadow: '0 24px 64px rgba(0,0,0,0.16), 0 4px 16px rgba(0,0,0,0.08)' }}>

            <div style={{ padding: '20px 24px 18px', borderBottom: '1px solid #F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 32, height: 32, borderRadius: 9, background: 'linear-gradient(135deg, #2563EB, #1D4ED8)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Plus size={15} color="#fff" strokeWidth={2.5} />
                </div>
                <h2 style={{ fontWeight: 700, fontSize: '1rem', color: '#111827', margin: 0 }}>New Task</h2>
              </div>
              <button onClick={() => setNewTaskModal(false)} style={{ background: '#F9FAFB', border: '1px solid #E5E7EB', cursor: 'pointer', color: '#6B7280', display: 'flex', padding: '6px', borderRadius: 8 }}
                onMouseEnter={e => { e.currentTarget.style.background = '#F3F4F6' }}
                onMouseLeave={e => { e.currentTarget.style.background = '#F9FAFB' }}
              >
                <X size={16} />
              </button>
            </div>

            <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={modalLabelStyle}>Title <span style={{ color: TASK_BLUE }}>*</span></label>
                <input autoFocus value={newTitle} onChange={e => setNewTitle(e.target.value)} placeholder="Task title..." style={{ ...modalInputStyle, background: '#FAFAFA' }} onKeyDown={e => { if (e.key === 'Enter') handleCreateTask() }} />
              </div>
              <div>
                <label style={modalLabelStyle}>Description <span style={{ color: '#D1D5DB', fontWeight: 400 }}>(optional)</span></label>
                <textarea value={newDescription} onChange={e => setNewDescription(e.target.value)} rows={2} placeholder="Add more context..." style={{ ...modalInputStyle, resize: 'vertical', background: '#FAFAFA', lineHeight: 1.55 }} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={modalLabelStyle}>Priority</label>
                  <DropdownField value={newPriority} options={priorityDropdownOptions} onChange={v => setNewPriority(v)} placeholder="None" />
                </div>
                <div>
                  <label style={modalLabelStyle}>Assign To</label>
                  <DropdownField value={newAssigneeId} options={newAssigneeDropdownOptions} onChange={v => { setNewAssigneeId(v); setNewShiftId(''); setNewDeadlineTime('') }} placeholder="Unassigned" />
                </div>
              </div>
              <div style={{ borderTop: '1px dashed #E5E7EB' }} />
              <div>
                <label style={modalLabelStyle}>
                  Shift
                  {newAssigneeId && newTaskShiftOptions.length === 0 && (
                    <span style={{ fontWeight: 400, color: TASK_BLUE, marginLeft: 8, fontSize: '0.78rem' }}>no upcoming shifts</span>
                  )}
                </label>
                <DropdownField
                  value={newShiftId}
                  options={newShiftDropdownOptions}
                  onChange={v => { setNewShiftId(v); const s = newTaskShiftOptions.find(x => x.id === v); if (s) setNewDeadlineTime(s.end_time.slice(0, 5)) }}
                  placeholder={newAssigneeId ? 'Select shift' : 'Select assignee first'}
                  disabled={!newAssigneeId}
                />
              </div>
              <div>
                <label style={modalLabelStyle}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <Clock size={12} color={TASK_BLUE} />
                    Deadline
                    {selectedShiftForDeadline && (
                      <span style={{ color: '#9CA3AF', fontWeight: 400, fontSize: '0.78rem' }}>
                        — {new Date(`${selectedShiftForDeadline.shift_date}T00:00:00`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                      </span>
                    )}
                  </span>
                </label>
                {selectedShiftForDeadline ? (
                  <DeadlineTimePicker value={newDeadlineTime} onChange={setNewDeadlineTime} shiftStart={selectedShiftForDeadline.start_time.slice(0, 5)} shiftEnd={selectedShiftForDeadline.end_time.slice(0, 5)} />
                ) : (
                  <div style={{ padding: '10px 12px', border: '1.5px solid #E5E7EB', borderRadius: 8, background: '#F9FAFB', fontSize: '0.9375rem', color: '#9CA3AF' }}>Select a shift first</div>
                )}
              </div>
            </div>

            <InlineError message={newError} />

            <div style={{ padding: '0 24px 20px', display: 'flex', gap: 10 }}>
              <button style={ghostBtn} onClick={() => setNewTaskModal(false)}>Cancel</button>
              <button
                style={{ ...primaryBtn(newLoading), background: newLoading ? '#3B82F6' : 'linear-gradient(135deg, #2563EB, #1D4ED8)', border: 'none' }}
                onClick={handleCreateTask} disabled={newLoading}
              >
                {newLoading && <Spinner size={14} />} Create Task
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
