'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import {
  AlertTriangle,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  MessageCircle,
  MoreHorizontal,
  Pencil,
  Plus,
  Trash2,
  Upload,
  Users,
  UserCog,
  UserRound,
  X,
} from 'lucide-react'
import { createBrowserClient } from '@supabase/ssr'
import OwnerSidebar from '@/components/OwnerSidebar'
import { TimelineRow, TimelineShiftBlock } from '@/types/Timeline'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

type Department = {
  id: string
  name: string
  company_id?: string
  created_at?: string
}

type TeamMember = {
  id: string
  full_name: string
  role: string
  department_id: string | null
}

type Company = {
  id: string
  name: string
  plan: string
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
}

type DepartmentModalMode = 'add' | 'edit' | 'delete' | null

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
              fontWeight: 700, fontSize: 12, padding: '7px 10px', cursor: 'pointer', lineHeight: 1,
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
const DEPT_COLORS = ['#3B82F6', '#10B981', '#8B5CF6', '#F59E0B', '#06B6D4', '#EC4899', '#F97316', '#EF4444']

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

function TimelineDatePicker({ value, onChange, shiftDates, anchorRef, triggerStyle }: {
  value: string
  onChange: (date: string) => void
  shiftDates: Set<string>
  anchorRef?: React.RefObject<HTMLDivElement | null>
  triggerStyle?: React.CSSProperties
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
  const [cy, cm] = viewMonth.split('-').map(Number)
  const firstDay = new Date(cy, cm - 1, 1).getDay()
  const daysInMonth = new Date(cy, cm, 0).getDate()
  const monthLabel = new Date(cy, cm - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  const cells: (string | null)[] = []
  for (let i = 0; i < firstDay; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push(`${cy}-${String(cm).padStart(2, '0')}-${String(d).padStart(2, '0')}`)
  }
  const todayMonth = todayStr.slice(0, 7)
  const goPrev = () => { const d = new Date(cy, cm - 2, 1); const nm = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; if (nm < todayMonth) return; setViewMonth(nm) }
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
        <button type="button" onClick={goPrev} disabled={viewMonth <= todayMonth} style={{ width: 26, height: 26, border: `1px solid ${PANEL_BORDER}`, borderRadius: 7, background: '#FFFFFF', cursor: viewMonth <= todayMonth ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: viewMonth <= todayMonth ? '#D1D5DB' : '#64748B' }}><ChevronLeft size={13} /></button>
        <span style={{ fontSize: 13, fontWeight: 700, color: TEXT_DARK }}>{monthLabel}</span>
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
          const isPast = date < todayStr
          if (isPast) return <div key={date} style={{ height: 36 }} />
          const isSel = date === value
          const isToday = date === todayStr
          const hasShift = shiftDates.has(date)
          return (
            <button key={date} type="button" onClick={() => { onChange(date); setOpen(false) }}
              style={{
                height: 36, width: '100%', border: isToday && !isSel ? `2px solid ${OWNER_ORANGE}` : 'none',
                borderRadius: 8, background: isSel ? OWNER_ORANGE : 'transparent',
                color: isSel ? '#FFFFFF' : isToday ? OWNER_ORANGE : TEXT_DARK,
                fontWeight: isSel || isToday ? 700 : 400, fontSize: 13, cursor: 'pointer',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2, padding: 0,
                position: 'relative',
              }}
              onMouseEnter={e => { if (!isSel) e.currentTarget.style.background = '#F8FAFC' }}
              onMouseLeave={e => { if (!isSel) e.currentTarget.style.background = 'transparent' }}
            >
              <span style={{ lineHeight: 1 }}>{parseInt(date.split('-')[2])}</span>
              {hasShift && (
                <span style={{ width: 4, height: 4, borderRadius: '50%', background: isSel ? 'rgba(255,255,255,0.8)' : OWNER_ORANGE, flexShrink: 0 }} />
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
        style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 38, padding: '0 12px', border: `1px solid ${PANEL_BORDER}`, borderRadius: 9, background: '#FFFFFF', cursor: 'pointer', fontSize: 13, fontWeight: 500, color: TEXT_DARK, minWidth: 140, ...triggerStyle }}
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
    <div style={{ border: `1px solid ${PANEL_BORDER}`, borderRadius: 10, padding: '8px 10px', background: '#FAFBFC' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <button type="button" onClick={goPrev} disabled={!canGoPrevMonth}
          style={{ width: 22, height: 22, border: `1px solid ${PANEL_BORDER}`, borderRadius: 6, background: '#fff', cursor: canGoPrevMonth ? 'pointer' : 'default', display: 'flex', alignItems: 'center', justifyContent: 'center', color: canGoPrevMonth ? '#64748B' : '#D1D5DB', padding: 0 }}>
          <ChevronLeft size={11} />
        </button>
        <span style={{ fontSize: 12, fontWeight: 700, color: TEXT_DARK }}>{monthLabel}</span>
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

function deptColor(deptId: string): string {
  let h = 0
  for (let i = 0; i < deptId.length; i++) h = deptId.charCodeAt(i) + ((h << 5) - h)
  return DEPT_COLORS[Math.abs(h) % DEPT_COLORS.length]
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

function Spinner({ size = 16, dark = false }: { size?: number; dark?: boolean }) {
  return (
    <svg className="animate-spin" width={size} height={size} viewBox="0 0 18 18" style={{ display: 'inline-block', flexShrink: 0 }}>
      <circle cx="9" cy="9" r="7" stroke={dark ? 'rgba(15,23,42,0.18)' : 'rgba(255,255,255,0.35)'} strokeWidth="2.5" fill="none" />
      <path d="M9 2a7 7 0 0 1 7 7" stroke={dark ? '#0F172A' : 'white'} strokeWidth="2.5" strokeLinecap="round" fill="none" />
    </svg>
  )
}

function PlanBadge({ plan, currentCompanyId }: { plan: string; currentCompanyId: string }) {
  const [upgradeLoading, setUpgradeLoading] = useState(false)
  const [upgradeError, setUpgradeError] = useState('')
  const isPro = plan === 'Paid' || plan === 'Pro'

  const handlePlanChange = async (newPlan: 'Free' | 'Paid') => {
    if (!currentCompanyId) return
    setUpgradeLoading(true)
    setUpgradeError('')
    try {
      const res = await fetch('/api/company/update-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ company_id: currentCompanyId, plan: newPlan }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.message)
      window.location.reload()
    } catch (err) {
      setUpgradeError(err instanceof Error ? err.message : 'Failed to update plan')
    } finally {
      setUpgradeLoading(false)
    }
  }

  return (
    <Popover>
      <PopoverTrigger
        aria-label={`${isPro ? 'Pro' : 'Free'} plan`}
        style={{
          display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0, whiteSpace: 'nowrap',
          borderRadius: 999, padding: '0 16px', height: 36, fontSize: 13, fontWeight: 600, cursor: 'pointer',
          background: isPro ? 'linear-gradient(135deg, #10B981, #14B8A6)' : '#F3F4F6',
          color: isPro ? '#fff' : '#4B5563',
          boxShadow: isPro ? '0 1px 4px rgba(16,185,129,0.3)' : 'none',
          transition: 'box-shadow 0.16s ease, transform 0.16s ease',
        }}
        onMouseEnter={event => {
          event.currentTarget.style.transform = 'translateY(-2px)'
          event.currentTarget.style.boxShadow = isPro ? '0 8px 18px rgba(16,185,129,0.28)' : '0 8px 18px rgba(15,23,42,0.10)'
        }}
        onMouseLeave={event => {
          event.currentTarget.style.transform = 'none'
          event.currentTarget.style.boxShadow = isPro ? '0 1px 4px rgba(16,185,129,0.3)' : 'none'
        }}
      >
        <span style={{ width: 6, height: 6, borderRadius: 999, background: isPro ? 'rgba(255,255,255,0.7)' : '#9CA3AF', flexShrink: 0 }} />
        {isPro ? 'Pro Plan' : 'Free Plan'}
      </PopoverTrigger>
      <PopoverContent align="end" sideOffset={8} style={{ width: 280, padding: 0, background: 'transparent', border: 'none', boxShadow: 'none' }}>
        <div style={{ width: 280, borderRadius: 16, overflow: 'hidden', boxShadow: '0 8px 32px rgba(0,0,0,0.12)', background: '#fff' }}>
          <div style={{ padding: '16px 20px', background: isPro ? 'linear-gradient(135deg, #10B981, #14B8A6)' : 'linear-gradient(135deg, #F3F4F6, #E5E7EB)' }}>
            <p style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: isPro ? 'rgba(255,255,255,0.75)' : '#9CA3AF', margin: 0 }}>Current Plan</p>
            <p style={{ fontSize: 20, fontWeight: 700, color: isPro ? '#fff' : '#1F2937', margin: '4px 0 2px' }}>{isPro ? 'Pro' : 'Free'}</p>
            <p style={{ fontSize: 12, color: isPro ? 'rgba(255,255,255,0.85)' : '#6B7280', margin: 0 }}>
              {isPro ? 'AI features & advanced analytics enabled' : 'Upgrade to unlock AI & analytics'}
            </p>
          </div>
          <div style={{ padding: '12px 16px' }}>
            {upgradeError && (
              <p style={{ marginBottom: 10, borderRadius: 8, background: '#FEF2F2', padding: '6px 10px', fontSize: 11, color: '#DC2626' }}>{upgradeError}</p>
            )}
            {isPro ? (
              <button
                type="button"
                onClick={() => handlePlanChange('Free')}
                disabled={upgradeLoading}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: 34, borderRadius: 10, border: 'none', background: '#F3F4F6', fontSize: 12, fontWeight: 500, color: '#6B7280', cursor: 'pointer' }}
              >
                {upgradeLoading ? <Spinner size={13} dark /> : 'Downgrade to Free'}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => handlePlanChange('Paid')}
                disabled={upgradeLoading}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: 34, borderRadius: 10, border: 'none', background: 'linear-gradient(135deg, #10B981, #14B8A6)', fontSize: 12, fontWeight: 600, color: '#fff', cursor: 'pointer' }}
              >
                {upgradeLoading ? <Spinner size={13} /> : 'Upgrade to Pro'}
              </button>
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
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

export default function OwnerShiftsPage() {
  const router = useRouter()
  const timelineControlsRef = useRef<HTMLDivElement>(null)
  const tomorrow = useMemo(() => addDays(new Date(), 1), [])
  const minDate = useMemo(() => formatDateKey(tomorrow), [tomorrow])
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

  const [timelineRows, setTimelineRows] = useState<TimelineRow[]>([])
  const [futureRows, setFutureRows] = useState<TimelineRow[]>([])
  const [timelineLoading, setTimelineLoading] = useState(false)
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null)
  const [timelineDate, setTimelineDate] = useState(minDate)
  const [rangeStartHour, setRangeStartHour] = useState(7)
  const [rangeEndHour, setRangeEndHour] = useState(23)
  const [isAutoFit, setIsAutoFit] = useState(false)
  const [selectedTimelineUserIds, setSelectedTimelineUserIds] = useState<string[]>([])
  const [timelineBulkDeleting, setTimelineBulkDeleting] = useState(false)
  const [timelineDeleteError, setTimelineDeleteError] = useState('')

  const [openDepartmentMenuId, setOpenDepartmentMenuId] = useState<string | null>(null)
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
  const [bulkSubmitting, setBulkSubmitting] = useState(false)
  const [bulkError, setBulkError] = useState('')
  const [bulkResult, setBulkResult] = useState('')
  const [bulkFailures, setBulkFailures] = useState<BulkFailure[]>([])
  const [successToast, setSuccessToast] = useState<string | null>(null)
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [selectedShift, setSelectedShift] = useState<TimelineShiftBlock | null>(null)
  const [shiftEditForm, setShiftEditForm] = useState<ShiftEditForm>({
    shift_date: minDate,
    start_time: '09:00',
    end_time: '17:00',
    assigned_user_id: '',
    department_id: '',
  })
  const [shiftActionLoading, setShiftActionLoading] = useState(false)
  const [shiftActionError, setShiftActionError] = useState('')

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

  const refreshShiftData = useCallback(async () => {
    if (!companyId) return
    await Promise.all([
      fetchTimeline(companyId, timelineDate),
      fetchFutureRows(companyId),
    ])
    setLastRefreshed(new Date())
  }, [companyId, fetchFutureRows, fetchTimeline, timelineDate])

  useEffect(() => {
    if (!companyId) return
    void Promise.all([
      fetchAssignmentData(companyId),
      fetchTimeline(companyId, timelineDate),
      fetchFutureRows(companyId),
    ]).then(() => setLastRefreshed(new Date()))
  }, [companyId, fetchAssignmentData, fetchFutureRows, fetchTimeline, timelineDate])

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
          shifts,
        }
      })
  }, [departments, getDepartmentPeople, members, selectedDepartment, timelineRows])
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
    () => visibleTimelineRows.filter(row => row.user_id && selectedTimelineUserIds.includes(row.user_id)),
    [selectedTimelineUserIds, visibleTimelineRows],
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
    setTimelineDeleteError('')
    setSelectedTimelineUserIds(prev => (
      prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
    ))
  }

  const deleteSelectedTimelineAssignments = async () => {
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
    const current = departmentManagers.find(item => item.department_id === department.id)
    setManagerModalDepartment(department)
    setSelectedManagerId(current?.manager_id ?? '')
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
      await Promise.all([fetchAssignmentData(companyId, true), refreshShiftData()])
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
      if (!data.success) throw new Error(data.message || 'Failed to set manager')
      setManagerModalDepartment(null)
      await fetchAssignmentData(companyId, true)
    } catch (err) {
      setManagerActionError(err instanceof Error ? err.message : 'Failed to set manager')
    } finally {
      setManagerActionLoading(false)
    }
  }

  const openShiftDetail = (shift: TimelineShiftBlock, row: TimelineRow) => {
    setSelectedShift(shift)
    setShiftEditForm({
      shift_date: shift.shift_date,
      start_time: shift.start_time,
      end_time: shift.end_time,
      assigned_user_id: row.user_id ?? '',
      department_id: shift.department_id,
    })
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
          acceptance_deadline_at: null,
          assigned_user_id: shiftEditForm.assigned_user_id || null,
          assigned_by: internalUserId,
        }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.message || 'Failed to update shift')
      setSelectedShift(null)
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
      <div style={{ width: 188, flexShrink: 0 }} />
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
    const rowSelected = !!row.user_id && selectedTimelineUserIds.includes(row.user_id)
    return (
      <div key={row.user_id ?? `${row.department_id}_open`} className="tl-row" style={{ display: 'flex', height: 72, borderTop: isDeptBoundary ? EDGE : '1px solid rgba(15,23,42,0.12)', background: rowSelected ? '#FFF7ED' : '#FFFFFF' }}>
        <div style={{ width: 8, flexShrink: 0, background: barColor, opacity: 0.85 }} />
        <div style={{ width: 180, flexShrink: 0, display: 'flex', alignItems: 'center', padding: '0 10px 0 12px', overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 26, height: 26, flexShrink: 0, background: row.role === 'Manager' ? '#FFF7ED' : '#F3F4F6', color: row.role === 'Manager' ? '#EA580C' : '#4B5563', borderRadius: 999 }}>
              {row.role === 'Manager' ? <UserCog size={13} /> : <UserRound size={13} />}
            </div>
            <span className="tl-name" style={{ minWidth: 0, fontSize: 13, fontWeight: 600, color: row.role === 'Manager' ? '#EA580C' : '#111827', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', transition: 'color 0.14s ease' }}>
              {row.full_name}
            </span>
          </div>
          {row.user_id ? (
            <input
              type="checkbox"
              aria-label={`Select ${row.full_name} for deletion`}
              checked={rowSelected}
              onChange={() => toggleTimelineUserSelection(row.user_id!)}
              style={{ width: 16, height: 16, flexShrink: 0, marginLeft: 8, accentColor: OWNER_ORANGE, cursor: 'pointer' }}
            />
          ) : null}
        </div>
        <div style={{ position: 'relative', flex: 1 }}>
          {tlHourTicks.map(h => (
            <div key={`grid-${h}`} style={{ position: 'absolute', top: 0, bottom: 0, left: `${tlPad(h * 60)}%`, width: 0, borderLeft: '1px dashed rgba(15,23,42,0.55)', pointerEvents: 'none', zIndex: 2 }} />
          ))}
          {row.shifts.length === 0 && row.user_id && (() => {
            const dept = departments.find(d => d.id === row.department_id)
            return (
              <button
                type="button"
                className="off-bar"
                onClick={() => { if (dept) openBatchDrawer(dept, row.user_id!, timelineDate) }}
                style={{ position: 'absolute', top: 10, bottom: 10, left: `${TL_PAD}%`, right: `${TL_PAD}%`, borderRadius: 999, background: '#E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1, border: 'none', cursor: 'pointer' }}
                title={`Assign shift to ${row.full_name}`}
              >
                <span style={{ fontSize: '0.78rem', fontWeight: 800, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.05em', pointerEvents: 'none' }}>Off</span>
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
            const shiftColor = deptColor(shift.department_id)
            return (
              <button
                key={`${shift.id}_${shift.assignment_id ?? 'open'}`}
                type="button"
                className="shift-bar"
                onClick={() => openShiftDetail(shift, row)}
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
                  cursor: 'pointer',
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
                <span style={{ fontSize: '0.72rem', fontWeight: 900, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {formatShiftHour(shift.start_time)} – {formatShiftHour(shift.end_time)}
                </span>
              </button>
            )
          })}
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
    deptOrder.sort((a, b) => deptMap[a].name.localeCompare(deptMap[b].name))
    for (const dept of Object.values(deptMap)) {
      dept.rows.sort((a, b) => roleRank(a.role) - roleRank(b.role) || a.full_name.localeCompare(b.full_name))
    }
    return (
      <div style={{ overflow: 'auto', flex: 1, minHeight: 0, padding: '14px 16px 18px 18px', marginRight: 8, marginBottom: 8, borderRadius: '0 0 14px 14px' }}>
        <div style={{ minWidth: 820 }}>
          {renderTimeAxis()}
          <div style={{ borderLeft: EDGE, borderRight: EDGE, borderBottom: EDGE }}>
            {deptOrder.map((deptId, deptIdx) => {
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

  if (!initialReady) {
    return (
      <div style={{ display: 'flex', minHeight: '100vh', background: APP_BG }}>
        <OwnerSidebar />
        <main style={{ flex: 1, display: 'grid', placeItems: 'center', color: TEXT_DARK, fontWeight: 800 }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}><Spinner dark /> Loading shifts</span>
        </main>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: APP_BG }}>
      <OwnerSidebar />
      <main style={{ marginLeft: 64, height: '100vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', flex: 1, gap: 0 }}>
        <div style={{ padding: '20px 28px 16px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 24, flexShrink: 0 }}>
          <div>
            {companies.length > 1 ? (
              <div style={{ position: 'relative' }}>
                <button
                  type="button"
                  onClick={() => setDropdownOpen(open => !open)}
                  className="flex cursor-pointer items-center gap-2 border-0 bg-transparent p-0 font-heading text-3xl font-bold tracking-tight text-gray-950"
                >
                  {company?.name ? `Shift Planning for ${company.name}` : 'Shift Planning'}
                  <ChevronDown size={18} strokeWidth={2.5} className={`mt-1 text-gray-400 transition-transform duration-150 ${dropdownOpen ? 'rotate-180' : ''}`} />
                </button>
                {dropdownOpen && (
                  <div className="absolute left-0 top-[calc(100%+8px)] z-50 min-w-[200px] rounded-xl border border-gray-100 bg-white p-1.5 shadow-lg">
                    {companies.map(item => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => switchCompany(item)}
                        className={`w-full cursor-pointer rounded-lg border-0 px-3 py-2 text-left text-sm ${item.id === companyId ? 'bg-orange-50 font-semibold text-orange-600' : 'bg-transparent font-normal text-gray-700'}`}
                      >
                        {item.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <h1 className="mb-0 font-heading text-3xl font-bold tracking-tight text-gray-950">
                {company?.name ? `Shift Planning for ${company.name}` : 'Shift Planning'}
              </h1>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0, paddingTop: 4 }}>
            {ownerName && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, height: 36, background: '#fff', border: '1.5px solid #E5E7EB', borderRadius: 999, padding: '0 14px 0 6px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                <div style={{ width: 26, height: 26, borderRadius: 999, background: 'linear-gradient(135deg, #F97316, #EA580C)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#fff' }}>{ownerName.charAt(0).toUpperCase()}</span>
                </div>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>{ownerName}</span>
              </div>
            )}
            {companyId && <PlanBadge plan={company?.plan ?? 'Free'} currentCompanyId={companyId} />}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 24, flex: 1, minHeight: 0, padding: '0 28px 24px' }}>
          {initialReady && !companyId && (
            <div style={{ background: '#FFFBEB', borderRadius: 12, padding: '14px 16px', fontSize: 13, color: '#92400E', border: '1px solid #FDE68A' }}>
              No company is linked to your profile yet. If you just accepted an invitation, try signing out and signing in again.
            </div>
          )}

          {companyId && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(300px, 320px) minmax(0, 1fr)', gap: 16, alignItems: 'stretch', flex: 1, minHeight: 0 }}>
        <section style={{ background: '#FFFFFF', border: `1px solid ${PANEL_BORDER}`, borderRadius: 14, overflow: 'visible' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, padding: '16px 18px', borderBottom: `1px solid ${PANEL_BORDER}`, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Users size={15} style={{ color: '#F97316' }} />
              <h2 style={{ margin: 0, color: '#0F172A', fontSize: 14, fontWeight: 700, letterSpacing: '-0.2px' }}>Departments</h2>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={openAddDepartment}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 5, border: 0, borderRadius: 10, background: OWNER_ORANGE, color: '#FFFFFF', height: 34, padding: '0 11px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
              >
                <Plus size={14} /> Add
              </button>
            </div>
          </div>
          <div style={{ padding: 14 }}>
            {assignmentDataLoading ? (
              <div style={{ minHeight: 150, display: 'grid', placeItems: 'center', color: MUTED, fontWeight: 700 }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}><Spinner dark /> Loading departments</span>
              </div>
            ) : selectedDepartment ? (
              <div style={{ display: 'grid', gap: 12 }}>
                <button
                  type="button"
                  onClick={() => { clearTimelineSelection(); setSelectedDepartmentId(null) }}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6, width: 'fit-content', border: 0, background: 'transparent', color: MUTED, fontSize: 12, fontWeight: 700, cursor: 'pointer', padding: 0 }}
                >
                  <ChevronLeft size={14} /> All Departments
                </button>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                  <span style={{ width: 8, height: 8, borderRadius: 999, background: deptColor(selectedDepartment.id), flexShrink: 0 }} />
                  <h3 style={{ margin: 0, color: TEXT_DARK, fontSize: 16, fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{selectedDepartment.name}</h3>
                </div>
                <div style={{ display: 'grid', gap: 12 }}>
                  {getDepartmentPeople(selectedDepartment).length === 0 ? (
                    <div style={{ borderRadius: 12, background: '#F8FAFC', padding: 18, color: '#94A3B8', fontSize: 13, fontWeight: 700, textAlign: 'center' }}>
                      No Manager or Employee yet.
                    </div>
                  ) : getDepartmentPeople(selectedDepartment).map(member => (
                    <div key={member.id} className="member-card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, border: `1px solid ${PANEL_BORDER}`, borderRadius: 12, padding: '13px 12px', background: '#FFFFFF' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, borderRadius: 999, background: member.role === 'Manager' ? '#FFF7ED' : '#F3F4F6', color: member.role === 'Manager' ? '#EA580C' : '#4B5563', flexShrink: 0 }}>
                          {member.role === 'Manager' ? <UserCog size={14} /> : <UserRound size={14} />}
                        </span>
                        <div style={{ minWidth: 0 }}>
                          <p style={{ margin: 0, color: member.role === 'Manager' ? '#EA580C' : TEXT_DARK, fontSize: 13, fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{member.full_name}</p>
                          {member.role === 'Manager' ? (
                            <button
                              type="button"
                              onClick={() => router.push(`/owner/communication?tab=messages&partner_id=${member.id}`)}
                              style={{ display: 'inline-flex', alignItems: 'center', gap: 4, border: 0, background: 'transparent', color: '#CBD5E1', cursor: 'pointer', padding: 0, marginTop: 3, fontSize: 11, fontWeight: 700 }}
                              onMouseEnter={e => { e.currentTarget.style.color = '#F97316' }}
                              onMouseLeave={e => { e.currentTarget.style.color = '#CBD5E1' }}
                            >
                              <MessageCircle size={11} /> Send message
                            </button>
                          ) : (
                            <p style={{ margin: '3px 0 0', color: '#94A3B8', fontSize: 11, fontWeight: 600 }}>{member.role}</p>
                          )}
                        </div>
                      </div>
                      <button
                        type="button"
                        className="assign-btn"
                        onClick={() => openBatchDrawer(selectedDepartment, member.id)}
                        style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 5, border: `1px solid #FDBA74`, borderRadius: 9, background: '#FFF7ED', color: '#EA580C', height: 30, padding: '0 9px', fontSize: 12, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}
                      >
                        <CalendarDays size={13} /> Assign
                      </button>
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  className="schedule-btn"
                  onClick={() => openBatchDrawer(selectedDepartment)}
                  disabled={getDepartmentPeople(selectedDepartment).length === 0}
                  style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7, border: 0, borderRadius: 10, background: getDepartmentPeople(selectedDepartment).length === 0 ? '#E2E8F0' : 'linear-gradient(135deg, #F97316, #EA580C)', color: getDepartmentPeople(selectedDepartment).length === 0 ? '#94A3B8' : '#FFFFFF', height: 36, padding: '0 12px', fontSize: 13, fontWeight: 800, cursor: getDepartmentPeople(selectedDepartment).length === 0 ? 'not-allowed' : 'pointer' }}
                >
                  <CalendarDays size={14} /> Schedule shifts
                </button>
              </div>
            ) : departments.length === 0 ? (
              <div style={{ minHeight: 150, display: 'grid', placeItems: 'center', color: MUTED, fontWeight: 700 }}>No departments yet.</div>
            ) : (
              <div style={{ display: 'grid', gap: 10 }}>
                {departments.map((department, deptIdx) => {
                  const deptMembers = membersByDepartment.get(department.id) ?? []
                  const employeeCount = deptMembers.filter(member => member.role === 'Employee').length
                  const manager = departmentManagers.find(item => item.department_id === department.id)
                  return (
                    <article
                      key={department.id}
                      className="dept-card"
                      style={{
                        position: 'relative',
                        animationDelay: `${deptIdx * 55}ms`,
                        zIndex: openDepartmentMenuId === department.id ? 50 : 1,
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        gap: 14,
                        minHeight: 112,
                        border: `1px solid ${PANEL_BORDER}`,
                        borderRadius: 12,
                        padding: '12px 12px 12px 15px',
                        background: '#FFFFFF',
                        cursor: 'pointer',
                        overflow: 'hidden',
                        transition: 'box-shadow 0.16s ease, transform 0.16s ease, border-color 0.16s ease',
                      }}
                      onClick={() => { clearTimelineSelection(); setSelectedDepartmentId(department.id) }}
                      onMouseEnter={event => {
                        event.currentTarget.style.transform = 'translateY(-3px)'
                        event.currentTarget.style.boxShadow = `0 10px 28px rgba(15,23,42,0.11)`
                        event.currentTarget.style.borderColor = deptColor(department.id)
                      }}
                      onMouseLeave={event => {
                        event.currentTarget.style.transform = 'none'
                        event.currentTarget.style.boxShadow = 'none'
                        event.currentTarget.style.borderColor = PANEL_BORDER
                      }}
                    >
                      <span className="dept-card-bar" style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: deptColor(department.id), borderRadius: '12px 0 0 12px' }} />
                      <button
                        type="button"
                        data-department-menu-root="true"
                        aria-label={`Open ${department.name} actions`}
                        onClick={(event) => {
                          event.stopPropagation()
                          setOpenDepartmentMenuId(openDepartmentMenuId === department.id ? null : department.id)
                        }}
                        style={{ position: 'absolute', top: 12, right: 12, width: 30, height: 30, borderRadius: 9, border: `1px solid ${PANEL_BORDER}`, background: '#FFFFFF', display: 'grid', placeItems: 'center', cursor: 'pointer', flexShrink: 0 }}
                      >
                        <MoreHorizontal size={17} color={TEXT_DARK} />
                      </button>
                      {openDepartmentMenuId === department.id && (
                        <div data-department-menu-root="true" onClick={event => event.stopPropagation()} style={{ position: 'absolute', top: 44, right: 12, zIndex: 20, width: 180, background: '#FFFFFF', border: `1px solid #E5E7EB`, borderRadius: 14, boxShadow: '0 4px 24px rgba(0,0,0,0.10)', padding: '8px 6px' }}>
                          <p style={{ margin: '0 6px 4px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#9CA3AF' }}>
                            Department
                          </p>
                          <button type="button" onClick={() => openEditDepartment(department)} style={menuButtonStyle}><Pencil size={13} style={{ color: '#F97316' }} /> Edit department</button>
                          <button type="button" onClick={() => openManagerModal(department)} style={menuButtonStyle}><Users size={13} style={{ color: '#F97316' }} /> Set manager</button>
                          <div style={{ height: 1, background: '#F1F5F9', margin: '4px 6px' }} />
                          <button type="button" onClick={() => openDeleteDepartment(department)} style={{ ...menuButtonStyle, color: '#DC2626' }}><Trash2 size={13} /> Delete</button>
                        </div>
                      )}

                      <div style={{ minWidth: 0, display: 'grid', gap: 20, paddingRight: 34 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span
                            className={activeDeptIds.has(department.id) ? 'dept-dot-active' : undefined}
                            style={{ width: 8, height: 8, borderRadius: 999, background: deptColor(department.id), flexShrink: 0, display: 'inline-block' }}
                          />
                          <h3 style={{ margin: 0, color: '#0F172A', fontSize: 15, fontWeight: 800, letterSpacing: '-0.15px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{department.name}</h3>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', alignItems: 'start', gap: 14 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                            <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 26, height: 26, borderRadius: 999, background: '#FFF7ED', color: '#EA580C', flexShrink: 0 }}>
                              <UserCog size={13} />
                            </span>
                            <div style={{ minWidth: 0 }}>
                              <span style={{ display: 'block', color: manager?.manager_name ? '#EA580C' : '#94A3B8', fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {manager?.manager_name ?? 'No manager set'}
                              </span>
                              {manager?.manager_id && (
                                <button
                                  type="button"
                                  onClick={(event) => {
                                    event.stopPropagation()
                                    router.push(`/owner/communication?tab=messages&partner_id=${manager.manager_id}`)
                                  }}
                                  style={{ display: 'inline-flex', alignItems: 'center', gap: 4, border: 0, background: 'transparent', color: '#CBD5E1', cursor: 'pointer', padding: 0, marginTop: 4, fontSize: 11, fontWeight: 700 }}
                                  onMouseEnter={e => { e.currentTarget.style.color = '#F97316' }}
                                  onMouseLeave={e => { e.currentTarget.style.color = '#CBD5E1' }}
                                >
                                  <MessageCircle size={11} /> Send message
                                </button>
                              )}
                            </div>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                            <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 26, height: 26, borderRadius: 999, background: '#F3F4F6', color: '#4B5563', flexShrink: 0 }}>
                              <UserRound size={13} />
                            </span>
                            <span style={{ display: 'block', color: '#111827', fontSize: 13, fontWeight: 700 }}>
                              {employeeCount}
                            </span>
                          </div>
                        </div>
                      </div>

                    </article>
                  )
                })}
              </div>
            )}
          </div>
        </section>

        <section style={{ background: '#FFFFFF', border: `1px solid ${PANEL_BORDER}`, borderRadius: 14, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '14px 18px', borderBottom: `1px solid ${PANEL_BORDER}`, flexWrap: 'wrap', flexShrink: 0 }}>
            <div>
              <h2 style={{ margin: 0, color: TEXT_DARK, fontSize: '1.12rem', fontWeight: 900 }}>Shift Timeline</h2>
              {timelineDeleteError ? (
                <p style={{ margin: '4px 0 0', color: '#DC2626', fontSize: 12, fontWeight: 700 }}>{timelineDeleteError}</p>
              ) : null}
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <div ref={timelineControlsRef} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                {selectedTimelineUserIds.length > 0 ? (
                  <>
                    <button
                      type="button"
                      aria-label="Cancel timeline selection"
                      onClick={() => { setSelectedTimelineUserIds([]); setTimelineDeleteError('') }}
                      style={{ ...iconButtonStyle, width: 38, height: 38, color: MUTED }}
                    >
                      <X size={16} />
                    </button>
                    <button
                      type="button"
                      aria-label={`Assign shifts for ${selectedTimelineUserIds.length} selected people`}
                      onClick={openBatchDrawerForSelection}
                      style={{
                        ...iconButtonStyle,
                        width: 38,
                        height: 38,
                        background: '#FFF7ED',
                        border: '1px solid #FDBA74',
                        color: '#EA580C',
                        cursor: 'pointer',
                      }}
                      title={`Assign shifts to ${selectedTimelineUserIds.length} selected people`}
                    >
                      <CalendarDays size={16} />
                    </button>
                    <button
                      type="button"
                      aria-label={`Delete shifts for ${selectedTimelineUserIds.length} selected people`}
                      onClick={deleteSelectedTimelineAssignments}
                      disabled={timelineBulkDeleting}
                      style={{
                        ...iconButtonStyle,
                        width: 38,
                        height: 38,
                        background: '#FEF2F2',
                        border: '1px solid #FECACA',
                        color: '#DC2626',
                        cursor: timelineBulkDeleting ? 'default' : 'pointer',
                        opacity: timelineBulkDeleting ? 0.65 : 1,
                      }}
                      title={selectedTimelineAssignmentIds.length === 0 ? 'No shifts selected on this date' : `Delete ${selectedTimelineAssignmentIds.length} selected shift assignment${selectedTimelineAssignmentIds.length === 1 ? '' : 's'}`}
                    >
                      {timelineBulkDeleting ? <Spinner dark /> : <Trash2 size={16} />}
                    </button>
                  </>
                ) : (
                  <button type="button" onClick={() => setTimelineDateAndClearSelection(formatDateKey(new Date()))} style={{ height: 38, padding: '0 14px', border: `1px solid ${PANEL_BORDER}`, borderRadius: 8, background: timelineDate === formatDateKey(new Date()) ? '#F97316' : '#FFFFFF', color: timelineDate === formatDateKey(new Date()) ? '#FFFFFF' : TEXT_DARK, fontSize: 13, fontWeight: 700, cursor: 'pointer', transition: 'background 0.15s, color 0.15s' }}>Today</button>
                )}
                <button type="button" onClick={() => setTimelineByOffset(-1)} disabled={timelineDate <= formatDateKey(new Date())} style={{ ...iconButtonStyle, opacity: timelineDate <= formatDateKey(new Date()) ? 0.3 : 1, cursor: timelineDate <= formatDateKey(new Date()) ? 'default' : 'pointer' }}><ChevronLeft size={16} /></button>
                <TimelineDatePicker value={timelineDate} onChange={setTimelineDateAndClearSelection} shiftDates={datesWithShifts} anchorRef={timelineControlsRef} />
                <button type="button" onClick={() => setTimelineByOffset(1)} style={iconButtonStyle}><ChevronRight size={16} /></button>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger
                  data-testid="shift-timeline-menu"
                  aria-label="Timeline options"
                  style={{ ...iconButtonStyle, width: 38, height: 38 }}
                >
                  <MoreHorizontal size={16} />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" sideOffset={10} style={{ width: 300, borderRadius: 16, padding: 16, border: `1px solid ${PANEL_BORDER}`, background: '#FFFFFF', boxShadow: '0 4px 24px rgba(0,0,0,0.10)' }}>
                  <div style={{ marginBottom: 8 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#9CA3AF' }}>Time window</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 10 }}>
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
                        <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: option.active ? '#EA580C' : '#374151' }}>{option.label}</p>
                      </button>
                    ))}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    {[
                      { label: 'From', val: rangeStartHour, dec: () => { setIsAutoFit(false); setRangeStartHour(Math.max(0, rangeStartHour - 1)) }, inc: () => { setIsAutoFit(false); setRangeStartHour(Math.min(rangeEndHour - 1, rangeStartHour + 1)) } },
                      { label: 'To', val: rangeEndHour, dec: () => { setIsAutoFit(false); setRangeEndHour(Math.max(rangeStartHour + 1, rangeEndHour - 1)) }, inc: () => { setIsAutoFit(false); setRangeEndHour(Math.min(24, rangeEndHour + 1)) } },
                    ].map(control => (
                      <div key={control.label} style={{ borderRadius: 10, border: `1px solid ${PANEL_BORDER}`, background: '#F9FAFB', padding: '8px 10px' }}>
                        <p style={{ margin: '0 0 6px 0', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#9CA3AF' }}>{control.label}</p>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4 }}>
                          <button type="button" onClick={control.dec} aria-label={`Decrease ${control.label}`} style={{ width: 26, height: 26, borderRadius: 8, border: `1px solid ${PANEL_BORDER}`, background: '#FFFFFF', cursor: 'pointer', fontSize: 14, color: MUTED, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>-</button>
                          <span style={{ fontSize: 13, fontWeight: 700, color: TEXT_DARK }}>{formatHourLabel(control.val)}</span>
                          <button type="button" onClick={control.inc} aria-label={`Increase ${control.label}`} style={{ width: 26, height: 26, borderRadius: 8, border: `1px solid ${PANEL_BORDER}`, background: '#FFFFFF', cursor: 'pointer', fontSize: 14, color: MUTED, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
          {renderTimeline()}
        </section>
              </div>
            </>
          )}
        </div>
      </main>

      {batchDepartment && (
        <div style={drawerOverlayStyle}>
          <div style={drawerStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, padding: 18, borderBottom: `1px solid ${PANEL_BORDER}` }}>
              <div>
                <h2 style={{ margin: 0, color: TEXT_DARK, fontSize: '1.25rem', fontWeight: 900 }}>
                  {batchSingleMember
                    ? `Assign Shift to ${batchSingleMember.full_name}`
                    : selectedMemberIds.length > 0 && new Set(selectedMemberIds.map(id => members.find(m => m.id === id)?.department_id)).size > 1
                      ? `Assign Shifts to Selected (${selectedMemberIds.length})`
                      : `Assign Shift to ${batchDepartment.name}`
                  }
                </h2>
              </div>
              <button type="button" onClick={closeBatchDrawer} style={iconButtonStyle}><X size={18} /></button>
            </div>
            <div style={{ padding: '20px 22px 0', overflowY: 'auto', flex: 1 }}>
              {/* Batch mode: People picker */}
              {!batchSingleMember && (
                <div style={{ marginBottom: 20 }}>
                  <p style={{ margin: '0 0 8px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#94A3B8' }}>People</p>
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
                              <p style={{ margin: 0, color: isManager ? '#EA580C' : TEXT_DARK, fontSize: 13, fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{member.full_name}</p>
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
                  <p style={{ margin: 0, color: '#94A3B8', fontSize: 13, fontWeight: 500 }}>Select team members above to pick shift dates</p>
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
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 210px', gap: 14, alignItems: 'stretch' }}>
                      {/* Calendar */}
                      <div style={{ background: '#F8FAFC', borderRadius: 14, padding: '12px 14px', border: `1px solid ${PANEL_BORDER}` }}>
                        <p style={{ margin: '0 0 10px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#94A3B8' }}>Select Dates</p>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                          <button type="button" onClick={goPrev} disabled={!canGoPrev}
                            style={{ width: 26, height: 26, border: `1px solid ${canGoPrev ? PANEL_BORDER : 'transparent'}`, background: canGoPrev ? '#FFFFFF' : 'transparent', borderRadius: 7, cursor: canGoPrev ? 'pointer' : 'default', display: 'flex', alignItems: 'center', justifyContent: 'center', color: canGoPrev ? MUTED : '#D1D5DB', flexShrink: 0, opacity: canGoPrev ? 1 : 0.3, transition: 'opacity 0.15s' }}>
                            <ChevronLeft size={12} />
                          </button>
                          <span style={{ fontSize: 13, fontWeight: 700, color: TEXT_DARK }}>{monthLabel}</span>
                          <button type="button" onClick={goNext}
                            style={{ width: 26, height: 26, border: `1px solid ${PANEL_BORDER}`, background: '#FFFFFF', borderRadius: 7, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: MUTED, flexShrink: 0 }}>
                            <ChevronRight size={12} />
                          </button>
                        </div>
                        <div key={`hd-${calKey}`} style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 36px)', justifyContent: 'center', marginBottom: 2 }}>
                          {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => (
                            <div key={d} style={{ fontSize: 11, fontWeight: 600, color: '#9CA3AF', textAlign: 'center', height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{d}</div>
                          ))}
                        </div>
                        <div key={`grid-${calKey}`} style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 36px)', justifyContent: 'center', gap: 2, animation: `${calDir === 'next' ? 'calSlideNext' : 'calSlidePrev'} 0.18s ease` }}>
                          {cells.map((date, i) => {
                            if (!date || date < todayStr) return <div key={`e-${i}`} style={{ width: 36, height: 36 }} />
                            const avail = date >= todayStr
                            const sel = selectedDates.includes(date)
                            const isToday = date === todayStr
                            const dayNum = new Date(date + 'T00:00:00').getDate()
                            return (
                              <button
                                key={date}
                                type="button"
                                disabled={!avail}
                                onClick={() => avail && toggleBatchDate(date)}
                                style={{
                                  width: 36, height: 36,
                                  borderRadius: '50%',
                                  border: isToday && !sel ? `2px solid ${OWNER_ORANGE}` : 'none',
                                  background: sel ? OWNER_ORANGE : 'transparent',
                                  color: sel ? '#FFFFFF' : isToday ? OWNER_ORANGE : avail ? TEXT_DARK : '#94A3B8',
                                  fontWeight: sel || isToday ? 700 : 400,
                                  fontSize: 13,
                                  cursor: avail ? 'pointer' : 'default',
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
                      <div style={{ background: '#F8FAFC', borderRadius: 14, padding: '12px 14px', border: `1px solid ${PANEL_BORDER}`, display: 'flex', flexDirection: 'column', gap: 12 }}>
                        <p style={{ margin: 0, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#94A3B8' }}>Shift Hours</p>
                        <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          <span style={{ ...labelStyle, margin: 0 }}>Start time</span>
                          <TimePicker value={defaultStartTime} onChange={setDefaultStartTime} />
                        </label>
                        <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          <span style={{ ...labelStyle, margin: 0 }}>End time</span>
                          <TimePicker value={defaultEndTime} onChange={setDefaultEndTime} />
                        </label>
                        <button type="button" onClick={applyDefaultToAllCells}
                          style={{ border: `1px solid ${PANEL_BORDER}`, borderRadius: 8, background: '#FFFFFF', color: TEXT_DARK, height: 34, padding: '0 12px', fontWeight: 700, fontSize: 12, cursor: 'pointer', width: '100%', marginTop: 2 }}
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
                  <p style={{ margin: 0, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#94A3B8' }}>Preview</p>
                  <span style={{ fontSize: 12, color: enabledBatchCells.length > 0 ? OWNER_ORANGE : '#CBD5E1', fontWeight: 700 }}>
                    {enabledBatchCells.length} shift{enabledBatchCells.length !== 1 ? 's' : ''} selected
                  </span>
                </div>
                {selectedMembers.length === 0 || selectedDates.length === 0 ? (
                  <div style={{ border: `1.5px dashed ${PANEL_BORDER}`, borderRadius: 12, padding: '22px 18px', textAlign: 'center' }}>
                    <div style={{ marginBottom: 6, display: 'flex', justifyContent: 'center' }}><CalendarDays size={20} color="#CBD5E1" /></div>
                    <p style={{ margin: 0, color: '#94A3B8', fontSize: 13, fontWeight: 500 }}>
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
                              <span style={{ fontSize: 12, fontWeight: 700, color: isManager ? OWNER_ORANGE : TEXT_DARK }}>{member.full_name}</span>
                              <span style={{ fontSize: 11, color: '#94A3B8', fontWeight: 500 }}>{member.role}</span>
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
                                  <p style={{ margin: '0 0 7px', fontSize: 11, fontWeight: 700, color: TEXT_DARK, paddingRight: 14 }}>{previewDateLabel(date)}</p>
                                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 5 }}>
                                    <TimePicker compact value={cell.start_time} onChange={v => updateBatchCell(member.id, date, { start_time: v })} />
                                    <TimePicker compact value={cell.end_time} onChange={v => updateBatchCell(member.id, date, { end_time: v })} />
                                  </div>
                                  {existing.length > 0 && (
                                    <div style={{ display: 'flex', gap: 4, marginTop: 5, color: '#B45309', fontSize: '0.68rem', fontWeight: 700, alignItems: 'center', flexWrap: 'wrap' }}>
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
            <div style={{ padding: 18, borderTop: `1px solid ${PANEL_BORDER}`, display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button type="button" onClick={closeBatchDrawer} style={secondaryButtonStyle}>Cancel</button>
              <button type="button" onClick={submitBulkAssignment} disabled={bulkSubmitting} style={primaryButtonStyle}>
                {bulkSubmitting ? <Spinner /> : <Check size={16} />} Assign {enabledBatchCells.length || ''} Shift{enabledBatchCells.length === 1 ? '' : 's'}
              </button>
            </div>
          </div>
        </div>
      )}

      {departmentModal && (
        <Modal title={departmentModal === 'delete' ? 'Delete Department' : departmentModal === 'edit' ? 'Edit Department' : 'Add Department'} onClose={() => setDepartmentModal(null)}>
          {departmentModal === 'delete' ? (
            <>
              <p style={{ color: MUTED, marginTop: 0, fontSize: 13, whiteSpace: 'nowrap' }}>Are you sure you want to delete <strong>{activeDepartment?.name}</strong>? This cannot be undone.</p>
              {departmentActionError && <div style={errorBoxStyle}>{departmentActionError}</div>}
              <div style={modalFooterStyle}>
                <button type="button" onClick={() => setDepartmentModal(null)} style={secondaryButtonStyle}>Cancel</button>
                <button type="button" onClick={handleDeleteDepartment} disabled={departmentActionLoading} style={{ ...primaryButtonStyle, background: '#DC2626' }}>{departmentActionLoading ? <Spinner /> : <Trash2 size={16} />} Delete</button>
              </div>
            </>
          ) : (
            <>
              {departmentModal === 'add' && (
                <div style={{ display: 'inline-flex', border: `1px solid ${PANEL_BORDER}`, borderRadius: 9, overflow: 'hidden', marginBottom: 16 }}>
                  {(['manual', 'import'] as const).map(tab => (
                    <button key={tab} type="button" onClick={() => setDepartmentModalTab(tab)} style={{ border: 0, height: 34, padding: '0 13px', background: departmentModalTab === tab ? '#111827' : '#FFFFFF', color: departmentModalTab === tab ? '#FFFFFF' : TEXT_DARK, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                      {tab === 'manual' ? 'Manual' : 'Import'}
                    </button>
                  ))}
                </div>
              )}
              {departmentModalTab === 'manual' ? (
                <label>
                  <span style={labelStyle}>Department name</span>
                  <input value={departmentNameInput} onChange={e => setDepartmentNameInput(e.target.value)} style={inputStyle} placeholder="Operations" />
                </label>
              ) : (
                <>
                  <label>
                    <span style={labelStyle}>CSV file</span>
                    <input type="file" accept=".csv,text/csv,text/plain" onChange={e => void handleDepartmentImportFile(e.target.files?.[0] ?? null)} style={inputStyle} />
                  </label>
                  {departmentImportRows.length > 0 && (
                    <div style={{ marginTop: 12, border: `1px solid ${PANEL_BORDER}`, borderRadius: 10, maxHeight: 180, overflowY: 'auto' }}>
                      {departmentImportRows.map(name => <div key={name} style={{ padding: '8px 10px', borderBottom: `1px solid ${PANEL_BORDER}`, color: TEXT_DARK, fontWeight: 800, fontSize: '0.82rem' }}>{name}</div>)}
                    </div>
                  )}
                </>
              )}
              {departmentActionError && <div style={{ ...errorBoxStyle, marginTop: 12 }}>{departmentActionError}</div>}
              {departmentActionResult && <div style={{ ...successBoxStyle, marginTop: 12 }}>{departmentActionResult}</div>}
              <div style={modalFooterStyle}>
                <button type="button" onClick={() => setDepartmentModal(null)} style={secondaryButtonStyle}>Cancel</button>
                <button type="button" onClick={handleSaveDepartment} disabled={departmentActionLoading} style={primaryButtonStyle}>{departmentActionLoading ? <Spinner /> : departmentModalTab === 'import' ? <Upload size={16} /> : <Check size={16} />} Save</button>
              </div>
            </>
          )}
        </Modal>
      )}

      {managerModalDepartment && (
        <Modal title={`Set Manager - ${managerModalDepartment.name}`} onClose={() => setManagerModalDepartment(null)}>
          <div>
            <span style={labelStyle}>Manager</span>
            <DropdownField
              value={selectedManagerId}
              options={(() => {
                const assignedMap = new Map(departmentManagers.map(a => [a.manager_id, a.department_id]))
                const deptNameMap = new Map(departments.map(d => [d.id, d.name]))
                const unassigned = managerOptions.filter(m => !assignedMap.has(m.id))
                const assigned = managerOptions.filter(m => assignedMap.has(m.id))
                return [
                  ...unassigned.map(m => ({ value: m.id, label: m.full_name })),
                  ...assigned.map(m => ({ value: m.id, label: `${m.full_name} · ${deptNameMap.get(assignedMap.get(m.id)!) ?? ''}` })),
                ]
              })()}
              onChange={v => setSelectedManagerId(v)}
              placeholder="Select manager"
            />
          </div>
          {managerActionError && <div style={{ ...errorBoxStyle, marginTop: 12 }}>{managerActionError}</div>}
          <div style={modalFooterStyle}>
            <button type="button" onClick={() => setManagerModalDepartment(null)} style={secondaryButtonStyle}>Cancel</button>
            <button type="button" onClick={handleSetManager} disabled={managerActionLoading || !selectedManagerId} style={primaryButtonStyle}>{managerActionLoading ? <Spinner /> : <Check size={16} />} Save</button>
          </div>
        </Modal>
      )}

      {selectedShift && (
        <Modal title="Edit Shift" onClose={() => setSelectedShift(null)}>
          <div style={{ display: 'grid', gap: 12 }}>
            <div>
              <span style={labelStyle}>Reassign to</span>
              <DropdownField
                value={shiftEditForm.assigned_user_id}
                options={members
                  .filter(member => member.department_id === shiftEditForm.department_id)
                  .map(member => ({ value: member.id, label: `${member.full_name} · ${member.role}` }))}
                onChange={v => setShiftEditForm(prev => ({ ...prev, assigned_user_id: v }))}
                placeholder="Select person"
              />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, alignItems: 'start' }}>
              <div>
                <span style={labelStyle}>Date</span>
                <InlineDatePicker
                  value={shiftEditForm.shift_date}
                  onChange={date => setShiftEditForm(prev => ({ ...prev, shift_date: date }))}
                  shiftDates={editUserShiftDates}
                />
              </div>
              <div style={{ display: 'grid', gap: 8 }}>
                <div>
                  <span style={labelStyle}>Start</span>
                  <TimePicker value={shiftEditForm.start_time} onChange={val => setShiftEditForm(prev => ({ ...prev, start_time: val }))} />
                </div>
                <div>
                  <span style={labelStyle}>End</span>
                  <TimePicker value={shiftEditForm.end_time} onChange={val => setShiftEditForm(prev => ({ ...prev, end_time: val }))} />
                </div>
              </div>
            </div>
          </div>
          {shiftActionError && <div style={{ ...errorBoxStyle, marginTop: 12 }}>{shiftActionError}</div>}
          <div style={modalFooterStyle}>
            <button type="button" onClick={deleteShift} disabled={shiftActionLoading} style={{ ...secondaryButtonStyle, color: '#DC2626' }}><Trash2 size={16} /> Delete</button>
            <div style={{ flex: 1 }} />
            <button type="button" onClick={() => setSelectedShift(null)} style={secondaryButtonStyle}>Cancel</button>
            <button type="button" onClick={saveShiftEdit} disabled={shiftActionLoading} style={primaryButtonStyle}>{shiftActionLoading ? <Spinner /> : <Check size={16} />} Save</button>
          </div>
        </Modal>
      )}

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
      <style>{`
        @keyframes fadeSlideUpToast {
          from { opacity: 0; transform: translateX(-50%) translateY(10px); }
          to   { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
      `}</style>
    </div>
  )
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div style={modalOverlayStyle}>
      <div style={modalStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ margin: 0, color: TEXT_DARK, fontSize: 16, fontWeight: 700 }}>{title}</h2>
          <button type="button" onClick={onClose} style={{ ...iconButtonStyle, width: 34, height: 34 }}><X size={16} /></button>
        </div>
        {children}
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
  fontWeight: 500,
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
  fontWeight: 700,
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
  fontWeight: 700,
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
}

const modalStyle: React.CSSProperties = {
  width: 'min(480px, 100%)',
  maxHeight: '88vh',
  overflowY: 'auto',
  background: '#FFFFFF',
  borderRadius: 16,
  border: `1px solid ${PANEL_BORDER}`,
  boxShadow: '0 24px 70px rgba(15,23,42,0.32)',
  padding: 16,
}

const drawerOverlayStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(15,23,42,0.42)',
  zIndex: 80,
  display: 'grid',
  placeItems: 'center',
  padding: 18,
}

const drawerStyle: React.CSSProperties = {
  width: 'min(660px, 100%)',
  maxHeight: '90vh',
  background: '#FFFFFF',
  borderRadius: 16,
  border: `1px solid ${PANEL_BORDER}`,
  boxShadow: '0 24px 70px rgba(15,23,42,0.32)',
  display: 'flex',
  flexDirection: 'column',
}

const drawerSectionTitleStyle: React.CSSProperties = {
  margin: '0 0 9px',
  color: TEXT_DARK,
  fontSize: '0.92rem',
  fontWeight: 900,
}

const tableHeaderStyle: React.CSSProperties = {
  padding: '10px 9px',
  background: '#F8FAFC',
  color: '#334155',
  fontSize: '0.76rem',
  fontWeight: 900,
  borderBottom: `1px solid ${PANEL_BORDER}`,
  textAlign: 'left',
}

const tablePersonStyle: React.CSSProperties = {
  padding: 10,
  color: TEXT_DARK,
  fontWeight: 900,
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
  fontWeight: 800,
}

const successBoxStyle: React.CSSProperties = {
  border: '1px solid #BBF7D0',
  background: '#F0FDF4',
  color: '#166534',
  borderRadius: 10,
  padding: '10px 12px',
  fontSize: '0.82rem',
  fontWeight: 800,
}
