'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import {
  CalendarDays, ChevronLeft, ChevronRight, ChevronDown,
  Trash2, X, Check, UserCog, UserRound, MoreHorizontal, Users, MessageCircle,
} from 'lucide-react'
import { createBrowserClient } from '@supabase/ssr'
import ManagerSidebar from '@/components/ManagerSidebar'
import { TimelineRow, TimelineShiftBlock } from '@/types/Timeline'

// ─── Theme ────────────────────────────────────────────────────────────────────
const BLUE        = '#2563EB'
const BLUE_LIGHT  = '#EFF6FF'
const APP_BG      = '#F1F5F9'
const PANEL       = '#FFFFFF'
const PANEL_BORDER = '#E2E8F0'
const TEXT        = '#0F172A'
const MUTED       = '#64748B'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

function prettyDate(dateKey: string): string {
  return new Date(`${dateKey}T00:00:00`).toLocaleDateString('en-AU', {
    weekday: 'short', day: 'numeric', month: 'short',
  })
}

function formatShiftHour(time: string): string {
  const [h, m] = time.split(':').map(Number)
  const ampm = h < 12 ? 'am' : 'pm'
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h
  return m === 0 ? `${h12}${ampm}` : `${h12}:${String(m).padStart(2, '0')}${ampm}`
}

function formatHourLabel(hour: number): string {
  if (hour === 0 || hour === 24) return '12am'
  if (hour === 12) return '12pm'
  return hour < 12 ? `${hour}am` : `${hour - 12}pm`
}

function timeToMinutes(timeStr: string): number {
  const [h, m] = timeStr.split(':').map(Number)
  return h * 60 + (m || 0)
}

function roleRank(role: string): number {
  if (role === 'Manager') return 0
  if (role === 'Employee') return 1
  return 2
}

const minDate = (() => {
  const d = addDays(new Date(), -7)
  const dow = (d.getDay() + 6) % 7
  return formatDateKey(addDays(d, -dow))
})()
const maxDate = formatDateKey(addDays(new Date(), 14))

const TIME_OPTS = (() => {
  const opts: { value: string; label: string }[] = []
  for (let h = 0; h < 24; h++) {
    for (const m of [0, 30]) {
      const hh = String(h).padStart(2, '0'); const mm = String(m).padStart(2, '0')
      const ampm = h < 12 ? 'AM' : 'PM'; const dh = h === 0 ? 12 : h > 12 ? h - 12 : h
      opts.push({ value: `${hh}:${mm}`, label: `${dh}:${mm} ${ampm}` })
    }
  }
  return opts
})()

type Department = { id: string; name: string }
type TeamMember = { id: string; full_name: string; role: string; department_id: string | null; profile_photo_url?: string | null }
type BatchCell = { user_id: string; shift_date: string; start_time: string; end_time: string; enabled: boolean }
type BulkFailure = { user_id: string; shift_date: string; start_time: string; end_time: string; message: string }

function previewDateLabel(dateKey: string): string {
  return new Date(`${dateKey}T00:00:00`).toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' })
}

// ─── TimePicker ───────────────────────────────────────────────────────────────

function TimePicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0 })
  const trigRef = useRef<HTMLButtonElement>(null)
  const dropRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const hNum = parseInt(value.split(':')[0] ?? '0')
  const [meridiem, setMeridiem] = useState<'AM' | 'PM'>(hNum < 12 ? 'AM' : 'PM')
  useEffect(() => { setMeridiem(parseInt(value.split(':')[0]) < 12 ? 'AM' : 'PM') }, [value])
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (trigRef.current?.contains(e.target as Node) || dropRef.current?.contains(e.target as Node)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])
  useEffect(() => {
    if (open && listRef.current) {
      const sel = listRef.current.querySelector('[data-sel="true"]') as HTMLElement | null
      sel?.scrollIntoView({ block: 'center' })
    }
  }, [open, meridiem])
  const mNum = parseInt(value.split(':')[1] ?? '0')
  const derivedAP = hNum < 12 ? 'AM' : 'PM'
  const dh = hNum === 0 ? 12 : hNum > 12 ? hNum - 12 : hNum
  const times = TIME_OPTS.filter(t => {
    const h = parseInt(t.value.split(':')[0])
    return meridiem === 'AM' ? h < 12 : h >= 12
  })
  const dropdown = open ? (
    <div ref={dropRef} style={{ position: 'fixed', top: pos.top, left: pos.left, zIndex: 9999, background: PANEL, border: `1px solid ${PANEL_BORDER}`, borderRadius: 12, boxShadow: '0 8px 28px rgba(15,23,42,0.14)', display: 'flex', overflow: 'hidden', minWidth: Math.max(pos.width, 148) }}>
      <div ref={listRef} style={{ flex: 1, maxHeight: 192, overflowY: 'auto', padding: '4px 0' }}>
        {times.map(t => {
          const isSel = t.value === value
          return (
            <button key={t.value} type="button" data-sel={isSel ? 'true' : 'false'}
              onClick={() => { onChange(t.value); setOpen(false) }}
              style={{ display: 'block', width: '100%', padding: '7px 16px', textAlign: 'left', border: 'none', background: isSel ? BLUE_LIGHT : 'transparent', color: isSel ? BLUE : TEXT, fontWeight: isSel ? 700 : 400, fontSize: 13, cursor: 'pointer' }}
            >{t.label}</button>
          )
        })}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 6, padding: '8px', borderLeft: `1px solid ${PANEL_BORDER}` }}>
        {(['AM', 'PM'] as const).map(mp => (
          <button key={mp} type="button"
            onClick={() => {
              const [ch, cm] = value.split(':').map(Number)
              let nh = ch
              if (mp === 'AM' && ch >= 12) nh = ch - 12
              if (mp === 'PM' && ch < 12) nh = ch + 12
              onChange(`${String(nh).padStart(2, '0')}:${String(cm).padStart(2, '0')}`)
              setMeridiem(mp)
            }}
            style={{ borderRadius: 7, border: 'none', background: meridiem === mp ? BLUE : '#F1F5F9', color: meridiem === mp ? '#FFFFFF' : TEXT, fontWeight: 700, fontSize: 12, padding: '7px 10px', cursor: 'pointer', lineHeight: 1 }}
          >{mp}</button>
        ))}
      </div>
    </div>
  ) : null
  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <button ref={trigRef} type="button"
        onClick={() => {
          if (trigRef.current) {
            const r = trigRef.current.getBoundingClientRect()
            const fitsBelow = r.bottom + 212 + 8 <= window.innerHeight
            setPos({ top: fitsBelow ? r.bottom + 4 : r.top - 212 - 4, left: r.left, width: r.width })
          }
          setOpen(o => !o)
        }}
        style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4, border: `1px solid ${PANEL_BORDER}`, borderRadius: 8, background: PANEL, cursor: 'pointer', padding: '8px 12px', fontSize: 13, fontWeight: 500, color: TEXT, minHeight: 38 }}
      >
        <span style={{ userSelect: 'none' }}>{`${dh}:${String(mNum).padStart(2, '0')} ${derivedAP}`}</span>
        <ChevronDown size={12} color={MUTED} style={{ flexShrink: 0 }} />
      </button>
      {typeof document !== 'undefined' && createPortal(dropdown, document.body)}
    </div>
  )
}

// ─── TimelineDatePicker ───────────────────────────────────────────────────────

function TimelineDatePicker({ value, onChange, shiftDates, anchorRef, triggerStyle, minDate: minDateProp }: {
  value: string
  onChange: (date: string) => void
  shiftDates: Set<string>
  anchorRef?: React.RefObject<HTMLDivElement | null>
  minDate?: string
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
        <span style={{ fontSize: 13, fontWeight: 700, color: TEXT }}>{monthLabel}</span>
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
          const isTooOld = date < minSelectableStr
          if (isTooOld) return <div key={date} style={{ height: 36 }} />
          const isSel = date === value
          const isToday = date === todayStr
          const isPast = date < todayStr
          const hasShift = shiftDates.has(date)
          return (
            <button key={date} type="button" onClick={() => { onChange(date); setOpen(false) }}
              style={{
                height: 36, width: '100%',
                border: isToday && !isSel ? `2px solid ${BLUE}` : 'none',
                borderRadius: 8, background: isSel ? BLUE : 'transparent',
                color: isSel ? '#FFFFFF' : isToday ? BLUE : TEXT,
                fontWeight: isSel || isToday ? 700 : 400, fontSize: 13, cursor: 'pointer',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2, padding: 0,
              }}
              onMouseEnter={e => { if (!isSel) e.currentTarget.style.background = '#F8FAFC' }}
              onMouseLeave={e => { if (!isSel) e.currentTarget.style.background = 'transparent' }}
            >
              <span style={{ lineHeight: 1 }}>{parseInt(date.split('-')[2])}</span>
              {hasShift && (
                <span style={{ width: 4, height: 4, borderRadius: '50%', background: isPast ? '#94A3B8' : isSel ? 'rgba(255,255,255,0.8)' : BLUE, flexShrink: 0 }} />
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
        style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 38, padding: '0 12px', border: `1px solid ${PANEL_BORDER}`, borderRadius: 9, background: '#FFFFFF', cursor: 'pointer', fontSize: 13, fontWeight: 500, color: TEXT, minWidth: 140, ...triggerStyle }}
      >
        <CalendarDays size={14} color="#64748B" style={{ flexShrink: 0 }} />
        <span>{displayLabel}</span>
      </button>
      {typeof document !== 'undefined' && createPortal(popover, document.body)}
    </>
  )
}

// ─── OptionsMenu ─────────────────────────────────────────────────────────────

function OptionsMenu({
  rangeStartHour, rangeEndHour, isAutoFit, autoFitRange,
  setRangeStartHour, setRangeEndHour, setIsAutoFit,
  shiftViewMode, setShiftViewMode,
}: {
  rangeStartHour: number
  rangeEndHour: number
  isAutoFit: boolean
  autoFitRange: { from: number; to: number }
  setRangeStartHour: (h: number) => void
  setRangeEndHour: (h: number) => void
  setIsAutoFit: (v: boolean) => void
  shiftViewMode: 'timeline' | 'calendar'
  setShiftViewMode: (v: 'timeline' | 'calendar') => void
}) {
  const [open, setOpen] = useState(false)
  const btnRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ top: 0, right: 0 })

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (btnRef.current?.contains(e.target as Node) || menuRef.current?.contains(e.target as Node)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const menu = open ? (
    <div ref={menuRef} style={{
      position: 'fixed', top: pos.top, right: pos.right, zIndex: 9999,
      background: '#FFFFFF', border: `1px solid ${PANEL_BORDER}`,
      borderRadius: 16, boxShadow: '0 4px 24px rgba(0,0,0,0.10)',
      padding: 16, width: 300,
    }}>
      <div style={{ marginBottom: 8 }}>
        <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#9CA3AF' }}>View</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 16 }}>
        {([
          { value: 'timeline' as const, label: 'Timeline' },
          { value: 'calendar' as const, label: 'Calendar' },
        ]).map(opt => (
          <button key={opt.value} type="button" onClick={() => setShiftViewMode(opt.value)}
            style={{
              cursor: 'pointer', borderRadius: 10,
              border: shiftViewMode === opt.value ? `1.5px solid ${BLUE}88` : `1px solid ${PANEL_BORDER}`,
              background: shiftViewMode === opt.value ? BLUE_LIGHT : '#F9FAFB',
              padding: '8px 6px', textAlign: 'center',
            }}
          >
            <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: shiftViewMode === opt.value ? BLUE : '#374151' }}>{opt.label}</p>
          </button>
        ))}
      </div>
      <div style={{ height: 1, background: '#F3F4F6', margin: '0 0 12px' }} />
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
          <button key={option.label} type="button" onClick={option.onClick}
            style={{
              cursor: 'pointer', borderRadius: 10,
              border: option.active ? `1.5px solid ${BLUE}88` : `1px solid ${PANEL_BORDER}`,
              background: option.active ? BLUE_LIGHT : '#F9FAFB',
              padding: '8px 6px', textAlign: 'center',
            }}
          >
            <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: option.active ? BLUE : '#374151' }}>{option.label}</p>
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
              <button type="button" onClick={control.dec} style={{ width: 26, height: 26, borderRadius: 8, border: `1px solid ${PANEL_BORDER}`, background: '#FFFFFF', cursor: 'pointer', fontSize: 14, color: MUTED, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>-</button>
              <span style={{ fontSize: 13, fontWeight: 700, color: TEXT }}>{formatHourLabel(control.val)}</span>
              <button type="button" onClick={control.inc} style={{ width: 26, height: 26, borderRadius: 8, border: `1px solid ${PANEL_BORDER}`, background: '#FFFFFF', cursor: 'pointer', fontSize: 14, color: MUTED, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  ) : null

  return (
    <>
      <button ref={btnRef} type="button"
        onClick={() => {
          if (btnRef.current) {
            const r = btnRef.current.getBoundingClientRect()
            setPos({ top: r.bottom + 4, right: window.innerWidth - r.right })
          }
          setOpen(o => !o)
        }}
        style={{ width: 38, height: 38, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#FFFFFF', border: `1px solid ${PANEL_BORDER}`, borderRadius: 9, cursor: 'pointer', color: MUTED }}
      >
        <MoreHorizontal size={16} />
      </button>
      {typeof document !== 'undefined' && createPortal(menu, document.body)}
    </>
  )
}

// ─── InlineDatePicker (edit modal) ───────────────────────────────────────────

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
          style={{ width: 22, height: 22, border: `1px solid ${PANEL_BORDER}`, borderRadius: 6, background: '#fff', cursor: canGoPrevMonth ? 'pointer' : 'default', display: 'flex', alignItems: 'center', justifyContent: 'center', color: canGoPrevMonth ? MUTED : '#D1D5DB', padding: 0 }}>
          <ChevronLeft size={11} />
        </button>
        <span style={{ fontSize: 12, fontWeight: 700, color: TEXT }}>{monthLabel}</span>
        <button type="button" onClick={goNext}
          style={{ width: 22, height: 22, border: `1px solid ${PANEL_BORDER}`, borderRadius: 6, background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: MUTED, padding: 0 }}>
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
                height: 28, width: '100%',
                border: isToday && !isSel ? `2px solid ${BLUE}` : 'none',
                borderRadius: 6, background: isSel ? BLUE : 'transparent',
                color: isSel ? '#FFFFFF' : isToday ? BLUE : TEXT,
                fontWeight: isSel || isToday ? 700 : 400, fontSize: 11, cursor: 'pointer',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 1, padding: 0,
              }}
              onMouseEnter={e => { if (!isSel) e.currentTarget.style.background = '#F1F5F9' }}
              onMouseLeave={e => { if (!isSel) e.currentTarget.style.background = 'transparent' }}
            >
              <span style={{ lineHeight: 1 }}>{parseInt(date.split('-')[2])}</span>
              {hasShift && (
                <span style={{ width: 3, height: 3, borderRadius: '50%', background: isSel ? 'rgba(255,255,255,0.8)' : BLUE, flexShrink: 0 }} />
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ─── DropdownField (edit modal) ───────────────────────────────────────────────

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

  const dropdown = open ? (
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
              border: 'none', background: isSel ? BLUE_LIGHT : 'transparent',
              color: isSel ? BLUE : '#374151', fontWeight: isSel ? 700 : 400,
              fontSize: 13, cursor: 'pointer',
            }}
            onMouseEnter={e => { if (!isSel) e.currentTarget.style.background = '#F9FAFB' }}
            onMouseLeave={e => { if (!isSel) e.currentTarget.style.background = 'transparent' }}
          >{opt.label}</button>
        )
      })}
    </div>
  ) : null

  return (
    <div style={{ position: 'relative' }}>
      <button ref={triggerRef} type="button" disabled={disabled}
        onClick={handleOpen}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '10px 12px', border: `1.5px solid ${open ? BLUE : '#E5E7EB'}`, borderRadius: 8,
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
      {typeof document !== 'undefined' && createPortal(dropdown, document.body)}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ManagerShiftsPage() {
  const router = useRouter()
  const [companyId, setCompanyId] = useState('')
  const [managerId, setManagerId] = useState('')
  const [managerName, setManagerName] = useState('')
  const [departments, setDepartments] = useState<Department[]>([])
  const [selectedDeptId, setSelectedDeptId] = useState('')
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])
  const [deptMembersMap, setDeptMembersMap] = useState<Record<string, TeamMember[]>>({})

  const [timelineRows, setTimelineRows] = useState<TimelineRow[]>([])
  const [futureRows, setFutureRows] = useState<TimelineRow[]>([])
  const [timelineLoading, setTimelineLoading] = useState(false)
  const [timelineDate, setTimelineDate] = useState(() => formatDateKey(new Date()))
  const [rangeStartHour, setRangeStartHour] = useState(7)
  const [rangeEndHour, setRangeEndHour] = useState(23)
  const [isAutoFit, setIsAutoFit] = useState(false)
  const [selectedTimelineUserIds, setSelectedTimelineUserIds] = useState<string[]>([])
  const [timelineBulkDeleting, setTimelineBulkDeleting] = useState(false)
  const [timelineDeleteError, setTimelineDeleteError] = useState('')

  const timelineControlsRef = useRef<HTMLDivElement>(null)

  // Assign drawer
  const [assignOpen, setAssignOpen] = useState(false)
  const [editShift, setEditShift] = useState<TimelineShiftBlock | null>(null)
  const [editUserShiftDates, setEditUserShiftDates] = useState<Set<string>>(new Set())
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')

  const todayStr = formatDateKey(new Date())
  const [fDate, setFDate] = useState(todayStr)
  const [fStart, setFStart] = useState('09:00')
  const [fEnd, setFEnd] = useState('17:00')
  const [fTitle, setFTitle] = useState('')
  const [fInstr, setFInstr] = useState('')
  const [fUserId, setFUserId] = useState('')
  const [fDeptId, setFDeptId] = useState('')
  const [fStatus, setFStatus] = useState<'draft' | 'published'>('published')

  // View mode
  const [shiftViewMode, setShiftViewMode] = useState<'timeline' | 'calendar'>('timeline')
  const [calWeekRows, setCalWeekRows] = useState<TimelineRow[]>([])
  const [calWeekLoading, setCalWeekLoading] = useState(false)

  // Batch assign drawer
  const [batchOpen, setBatchOpen] = useState(false)
  const [batchSingleMember, setBatchSingleMember] = useState<TeamMember | null>(null)
  const [batchSelectedMemberIds, setBatchSelectedMemberIds] = useState<string[]>([])
  const [batchSelectedDates, setBatchSelectedDates] = useState<string[]>([])
  const [batchDefaultStartTime, setBatchDefaultStartTime] = useState('09:00')
  const [batchDefaultEndTime, setBatchDefaultEndTime] = useState('17:00')
  const [batchCells, setBatchCells] = useState<Record<string, BatchCell>>({})
  const [batchCalMonth, setBatchCalMonth] = useState('')
  const [batchCalDir, setBatchCalDir] = useState<'next' | 'prev'>('next')
  const [batchCalKey, setBatchCalKey] = useState(0)
  const [bulkSubmitting, setBulkSubmitting] = useState(false)
  const [bulkError, setBulkError] = useState('')
  const [bulkFailures, setBulkFailures] = useState<BulkFailure[]>([])

  // ── Auth init ──
  useEffect(() => {
    let cancelled = false
    const run = async () => {
      let uid = localStorage.getItem('tasking_user_id')
      if (!uid) {
        const sb = createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
        const { data: { session } } = await sb.auth.getSession()
        if (session?.user?.id) { uid = session.user.id; localStorage.setItem('tasking_user_id', uid) }
      }
      if (!uid) { router.replace('/signin'); return }
      const meRes = await fetch(`/api/user/me?user_id=${uid}`)
      const meData = await meRes.json()
      if (cancelled || !meData.success) return
      const { id, full_name, company_id } = meData.user
      if (full_name) setManagerName(full_name)
      if (id) setManagerId(id)
      const cid = localStorage.getItem(`tasking_company_id_${uid}`) || company_id || ''
      if (!cid) return
      setCompanyId(cid)
      const deptRes = await fetch(`/api/manager/departments?manager_id=${id}&company_id=${cid}`)
      const deptData = await deptRes.json()
      if (cancelled) return
      const depts: Department[] = deptData.success
        ? (deptData.departments ?? []).map((d: { department_id: string; department_name: string }) => ({ id: d.department_id, name: d.department_name }))
        : []
      setDepartments(depts)
      if (depts.length > 0) setSelectedDeptId(depts[0].id)
    }
    void run()
    return () => { cancelled = true }
  }, [router])

  // ── Fetch team members for assign dropdown (current dept) ──
  useEffect(() => {
    if (!companyId || !selectedDeptId) return
    fetch(`/api/team/members?company_id=${companyId}&department_id=${selectedDeptId}`)
      .then(r => r.json())
      .then(d => { if (d.success) setTeamMembers(d.members ?? []) })
      .catch(() => {})
  }, [companyId, selectedDeptId])

  // ── Fetch members for all departments (for dept card) ──
  useEffect(() => {
    if (!companyId || departments.length === 0) return
    Promise.all(
      departments.map(d =>
        fetch(`/api/team/members?company_id=${companyId}&department_id=${d.id}`)
          .then(r => r.json())
          .then(data => ({ id: d.id, members: data.success ? (data.members as TeamMember[]) : [] }))
          .catch(() => ({ id: d.id, members: [] as TeamMember[] }))
      )
    ).then(results => {
      const map: Record<string, TeamMember[]> = {}
      for (const r of results) map[r.id] = r.members
      setDeptMembersMap(map)
    })
  }, [companyId, departments])

  // ── Fetch timeline (single day) ──
  const fetchTimeline = useCallback(async (cid: string, date: string) => {
    if (!cid || !date) return
    setTimelineLoading(true)
    try {
      const params = new URLSearchParams({ company_id: cid, date_from: date, date_to: date })
      if (selectedDeptId) params.set('department_id', selectedDeptId)
      const res = await fetch(`/api/shift?${params}`)
      const data = await res.json()
      setTimelineRows(data.success ? data.rows ?? [] : [])
    } finally { setTimelineLoading(false) }
  }, [selectedDeptId])

  // ── Fetch future rows for date picker dots ──
  const fetchFutureRows = useCallback(async (cid: string) => {
    if (!cid) return
    const params = new URLSearchParams({ company_id: cid, date_from: minDate, date_to: maxDate })
    if (selectedDeptId) params.set('department_id', selectedDeptId)
    const res = await fetch(`/api/shift?${params}`)
    const data = await res.json()
    setFutureRows(data.success ? data.rows ?? [] : [])
  }, [selectedDeptId])

  // ── Fetch calendar week rows ──
  const fetchCalWeek = useCallback(async (cid: string, anchorDate: string) => {
    if (!cid || !anchorDate) return
    setCalWeekLoading(true)
    try {
      const anchor = new Date(`${anchorDate}T00:00:00`)
      const dow = (anchor.getDay() + 6) % 7
      const mon = new Date(anchor); mon.setDate(anchor.getDate() - dow)
      const sun = new Date(mon); sun.setDate(mon.getDate() + 6)
      const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
      const params = new URLSearchParams({ company_id: cid, date_from: fmt(mon), date_to: fmt(sun) })
      if (selectedDeptId) params.set('department_id', selectedDeptId)
      const res = await fetch(`/api/shift?${params}`)
      const data = await res.json()
      setCalWeekRows(data.success ? data.rows ?? [] : [])
    } finally { setCalWeekLoading(false) }
  }, [selectedDeptId])

  useEffect(() => {
    if (!companyId) return
    void fetchTimeline(companyId, timelineDate)
    void fetchFutureRows(companyId)
  }, [companyId, timelineDate, fetchTimeline, fetchFutureRows])

  useEffect(() => {
    if (!companyId || shiftViewMode !== 'calendar') return
    void fetchCalWeek(companyId, timelineDate)
  }, [companyId, shiftViewMode, timelineDate, fetchCalWeek])

  // ── Date navigation ──
  const clearTimelineSelection = () => { setSelectedTimelineUserIds([]); setTimelineDeleteError('') }
  const setTimelineDateAndClearSelection = (date: string) => { clearTimelineSelection(); setTimelineDate(date) }

  // ── Dept card ──
  const setTimelineByOffset = (offset: number) => {
    if (!timelineDate) return
    const next = formatDateKey(addDays(new Date(`${timelineDate}T00:00:00`), offset))
    if (next < minDate) return
    setTimelineDateAndClearSelection(next)
  }

  // ── Computed ──
  const assignedDeptIds = useMemo(() => new Set(departments.map(d => d.id)), [departments])

  const visibleTimelineRows = useMemo(() => {
    const rows = timelineRows.filter(row =>
      row.user_id === managerId ||
      (selectedDeptId ? row.department_id === selectedDeptId : assignedDeptIds.has(row.department_id))
    )
    rows.sort((a, b) => roleRank(a.role) - roleRank(b.role) || a.full_name.localeCompare(b.full_name))
    return rows
  }, [timelineRows, managerId, selectedDeptId, assignedDeptIds])
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

  const datesWithShifts = useMemo(() => {
    const dates = new Set<string>()
    for (const row of futureRows) {
      if (!row.user_id) continue
      for (const shift of row.shifts) {
        if (selectedDeptId && shift.department_id !== selectedDeptId) continue
        dates.add(shift.shift_date)
      }
    }
    return dates
  }, [futureRows, selectedDeptId])

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

  const toggleTimelineUserSelection = (userId: string) => {
    if (timelineIsPast) return
    setTimelineDeleteError('')
    setSelectedTimelineUserIds(prev => prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId])
  }

  const deleteSelectedTimelineAssignments = async () => {
    if (timelineIsPast) return
    if (selectedTimelineUserIds.length === 0 || timelineBulkDeleting) return
    if (selectedTimelineAssignmentIds.length === 0) {
      clearTimelineSelection()
      return
    }
    setTimelineBulkDeleting(true)
    setTimelineDeleteError('')
    try {
      for (const assignmentId of selectedTimelineAssignmentIds) {
        const res = await fetch(`/api/shift-assignment/${assignmentId}`, { method: 'DELETE' })
        const data = await res.json()
        if (!data.success) throw new Error(data.message || 'Failed to delete')
      }
      clearTimelineSelection()
      await fetchTimeline(companyId, timelineDate)
      await fetchFutureRows(companyId)
    } catch (err) {
      setTimelineDeleteError(err instanceof Error ? err.message : 'Failed to delete selected shifts')
    } finally { setTimelineBulkDeleting(false) }
  }

  // ── Assign form ──
  function openAssign(prefillDate?: string) {
    openBatchDrawer(undefined, prefillDate)
  }

  // ── Batch assign helpers ──
  const openBatchDrawer = (prefillMember?: TeamMember, prefillDate?: string) => {
    const base = prefillDate ? new Date(`${prefillDate}T00:00:00`) : addDays(new Date(), 1)
    setBatchSingleMember(prefillMember ?? null)
    setBatchSelectedMemberIds(prefillMember ? [prefillMember.id] : [])
    setBatchSelectedDates(prefillDate ? [prefillDate] : [])
    setBatchCells({})
    setBulkError(''); setBulkFailures([])
    setBatchCalMonth(`${base.getFullYear()}-${String(base.getMonth() + 1).padStart(2, '0')}`)
    setBatchCalDir('next'); setBatchCalKey(0)
    setBatchOpen(true)
  }

  const closeBatchDrawer = () => {
    setBatchOpen(false)
    setBatchSingleMember(null)
    setBatchSelectedMemberIds([])
    setBatchSelectedDates([])
    setBatchCells({})
    setBulkError(''); setBulkFailures([])
  }

  const toggleBatchMember = (memberId: string) => {
    setBatchSelectedMemberIds(prev => prev.includes(memberId) ? prev.filter(id => id !== memberId) : [...prev, memberId])
  }

  const toggleBatchDate = (date: string) => {
    setBatchSelectedDates(prev => prev.includes(date) ? prev.filter(d => d !== date) : [...prev, date])
  }

  const updateBatchCell = (memberId: string, date: string, fields: Partial<BatchCell>) => {
    const key = `${memberId}_${date}`
    setBatchCells(prev => ({
      ...prev,
      [key]: { ...(prev[key] ?? { user_id: memberId, shift_date: date, start_time: batchDefaultStartTime, end_time: batchDefaultEndTime, enabled: true }), ...fields },
    }))
  }

  const removeShiftCard = (memberId: string, date: string) => {
    updateBatchCell(memberId, date, { enabled: false })
  }

  const applyDefaultToAll = () => {
    setBatchCells(prev => {
      const next = { ...prev }
      for (const memberId of batchSelectedMemberIds) {
        for (const date of batchSelectedDates) {
          const key = `${memberId}_${date}`
          next[key] = { ...(next[key] ?? { user_id: memberId, shift_date: date, enabled: true }), start_time: batchDefaultStartTime, end_time: batchDefaultEndTime }
        }
      }
      return next
    })
  }

  const batchSelectedCells = useMemo(() => {
    const cells: BatchCell[] = []
    for (const memberId of batchSelectedMemberIds) {
      for (const date of batchSelectedDates) {
        const key = `${memberId}_${date}`
        cells.push(batchCells[key] ?? { user_id: memberId, shift_date: date, start_time: batchDefaultStartTime, end_time: batchDefaultEndTime, enabled: true })
      }
    }
    return cells
  }, [batchCells, batchDefaultEndTime, batchDefaultStartTime, batchSelectedDates, batchSelectedMemberIds])

  const enabledBatchCells = batchSelectedCells.filter(c => c.enabled)

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

  const submitBulkAssignment = async () => {
    if (!companyId || !managerId) return
    setBulkError(''); setBulkFailures([])
    if (enabledBatchCells.length === 0) { setBulkError('Select at least one shift.'); return }
    const invalid = enabledBatchCells.find(c => c.start_time >= c.end_time)
    if (invalid) { setBulkError(`Invalid time on ${previewDateLabel(invalid.shift_date)}. Start must be before end.`); return }
    setBulkSubmitting(true)
    try {
      const deptId = departments[0]?.id ?? selectedDeptId
      const res = await fetch('/api/shift/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company_id: companyId,
          department_id: deptId,
          created_by: managerId,
          assignments: enabledBatchCells.map(c => ({ user_id: c.user_id, shift_date: c.shift_date, start_time: c.start_time, end_time: c.end_time })),
        }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.message || 'Failed to assign shifts')
      const failures: BulkFailure[] = data.result?.failed ?? []
      await fetchTimeline(companyId, timelineDate)
      await fetchFutureRows(companyId)
      if (failures.length > 0) { setBulkFailures(failures) }
      else { closeBatchDrawer() }
    } catch (err) {
      setBulkError(err instanceof Error ? err.message : 'Failed to assign shifts')
    } finally { setBulkSubmitting(false) }
  }

  // ── Assign form (single shift) ──
  function openEdit(shift: TimelineShiftBlock, userId: string | null) {
    if (shift.shift_date < todayStr) return
    setEditShift(shift)
    setFDate(shift.shift_date)
    setFStart(shift.start_time.slice(0, 5)); setFEnd(shift.end_time.slice(0, 5))
    setFTitle(shift.title ?? ''); setFInstr(shift.instruction ?? ''); setFUserId(userId ?? '')
    setFDeptId(shift.department_id); setFStatus(shift.publication_status)
    // Compute shift dates for this user to show dots in inline calendar
    const userRows = futureRows.filter(r => r.user_id === userId)
    const dates = new Set(userRows.flatMap(r => r.shifts.map((s: TimelineShiftBlock) => s.shift_date)))
    setEditUserShiftDates(dates)
    setFormError(''); setAssignOpen(true)
  }

  async function handleSave() {
    if (!fDate || !fStart || !fEnd || !fDeptId || !companyId) {
      setFormError('Please fill in all required fields.')
      return
    }
    setSaving(true); setFormError('')
    try {
      if (editShift) {
        const res = await fetch(`/api/shift/${editShift.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ shift_date: fDate, start_time: fStart, end_time: fEnd, title: fTitle || null, instruction: fInstr || null, publication_status: fStatus, assigned_user_id: fUserId || undefined }),
        })
        const data = await res.json()
        if (!data.success) throw new Error(data.message ?? 'Failed to update shift')
      } else {
        if (!fUserId) { setFormError('Please select a team member.'); setSaving(false); return }
        const res = await fetch('/api/shift', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            company_id: companyId, department_id: fDeptId, title: fTitle || null,
            instruction: fInstr || null, shift_date: fDate, start_time: fStart, end_time: fEnd,
            created_by: managerId, publication_status: fStatus, assigned_user_id: fUserId,
          }),
        })
        const data = await res.json()
        if (!data.success) throw new Error(data.message ?? 'Failed to create shift')
      }
      setAssignOpen(false)
      await fetchTimeline(companyId, timelineDate)
      await fetchFutureRows(companyId)
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'An error occurred')
    } finally { setSaving(false) }
  }

  async function handleDelete() {
    if (!deleteId) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/shift/${deleteId}`, { method: 'DELETE' })
      const data = await res.json()
      if (!data.success) throw new Error(data.message ?? 'Failed to delete')
      setDeleteId(null)
      await fetchTimeline(companyId, timelineDate)
      await fetchFutureRows(companyId)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Delete failed')
    } finally { setDeleting(false) }
  }

  const assignableMembers = useMemo(() =>
    departments.flatMap(d => (deptMembersMap[d.id] ?? []).filter(m => m.role === 'Employee'))
      .filter((m, i, arr) => arr.findIndex(x => x.id === m.id) === i)
      .sort((a, b) => a.full_name.localeCompare(b.full_name))
  , [departments, deptMembersMap])

  // All Employees across all manager's departments (for batch drawer)
  const allDeptEmployees = useMemo(() =>
    departments.flatMap(d => (deptMembersMap[d.id] ?? []).filter(m => m.role === 'Employee'))
      .filter((m, i, arr) => arr.findIndex(x => x.id === m.id) === i)
      .sort((a, b) => a.full_name.localeCompare(b.full_name))
  , [departments, deptMembersMap])

  // ── Timeline math ──
  const TL_PAD = 4
  const tlHourTicks: number[] = []
  for (let h = rangeStartHour; h <= rangeEndHour; h++) tlHourTicks.push(h)
  const tlTotalMin = Math.max(60, (rangeEndHour - rangeStartHour) * 60)
  const tlPad = (min: number) => {
    const raw = ((Math.max(rangeStartHour * 60, Math.min(rangeEndHour * 60, min)) - rangeStartHour * 60) / tlTotalMin) * 100
    return TL_PAD + (raw / 100) * (100 - TL_PAD * 2)
  }

  // ── Timeline render ──
  const renderTimeAxis = () => (
    <div style={{ display: 'flex', background: 'linear-gradient(135deg, #0F172A 0%, #1E293B 100%)', borderRadius: '12px 12px 0 0' }}>
      <div style={{ width: 228, flexShrink: 0 }} />
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

  const renderShiftRow = (row: TimelineRow, isDeptBoundary = false, isRoleBoundary = false) => {
    const EDGE = '2px solid rgba(15,23,42,0.45)'
    const rowSelected = !timelineIsPast && !!row.user_id && selectedTimelineUserIds.includes(row.user_id)
    const borderTop = isDeptBoundary || isRoleBoundary ? EDGE : 'none'
    return (
      <div key={row.user_id ?? `${row.department_id}_open`} className="tl-row" style={{ display: 'flex', height: 58, borderTop, background: rowSelected ? BLUE_LIGHT : '#FFFFFF' }}>
        <div style={{ width: 220, flexShrink: 0, display: 'flex', alignItems: 'center', padding: '0 10px 0 12px', overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 26, height: 26, flexShrink: 0, background: row.profile_photo_url ? 'transparent' : (row.role === 'Manager' ? BLUE_LIGHT : '#F3F4F6'), color: row.role === 'Manager' ? BLUE : '#4B5563', borderRadius: 999, overflow: 'hidden' }}>
              {row.profile_photo_url
                ? <img src={row.profile_photo_url} alt={row.full_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : row.role === 'Manager' ? <UserCog size={13} /> : <UserRound size={13} />}
            </div>
            <span className="tl-name" style={{ minWidth: 0, fontSize: 13, fontWeight: 600, color: '#111827', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', transition: 'color 0.14s ease' }}>
              {row.full_name}
            </span>
          </div>
          {row.user_id && row.role !== 'Manager' && !timelineIsPast ? (
            <input
              type="checkbox"
              aria-label={`Select ${row.full_name} for deletion`}
              checked={rowSelected}
              onChange={() => toggleTimelineUserSelection(row.user_id!)}
              style={{ width: 16, height: 16, flexShrink: 0, marginLeft: 12, accentColor: BLUE, cursor: 'pointer' }}
            />
          ) : null}
        </div>
        <div style={{ position: 'relative', flex: 1 }}>
          {tlHourTicks.map(h => (
            <div key={`grid-${h}`} style={{ position: 'absolute', top: 0, bottom: 0, left: `${tlPad(h * 60)}%`, width: 0, borderLeft: '1px dashed rgba(15,23,42,0.55)', pointerEvents: 'none', zIndex: 2 }} />
          ))}
          {row.shifts.length === 0 && row.user_id && (() => {
            return (
              <button
                type="button"
                className="off-bar"
                onClick={() => {
                  if (!timelineIsPast && row.role !== 'Manager') {
                    const member = allDeptEmployees.find(m => m.id === row.user_id)
                    openBatchDrawer(member, timelineDate)
                  }
                }}
                style={{ position: 'absolute', top: 10, bottom: 10, left: `${TL_PAD}%`, right: `${TL_PAD}%`, borderRadius: 999, background: '#E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1, border: 'none', cursor: (timelineIsPast || row.role === 'Manager') ? 'default' : 'pointer' }}
                title={(!timelineIsPast && row.role !== 'Manager') ? `Assign shift to ${row.full_name}` : undefined}
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
            return (
              <button
                key={`${shift.id}_${shift.assignment_id ?? 'open'}`}
                type="button"
                onClick={() => { if (row.role !== 'Manager') openEdit(shift, row.user_id) }}
                onMouseEnter={e => { if (!timelineIsPast && row.role !== 'Manager') e.currentTarget.style.filter = 'brightness(1.08)' }}
                onMouseLeave={e => { e.currentTarget.style.filter = 'none' }}
                style={{
                  position: 'absolute', top: 10, bottom: 10,
                  left: `${left}%`, width: `${Math.max(width, 1.5)}%`,
                  border: 0, borderRadius: 999,
                  background: BLUE,
                  color: '#FFFFFF',
                  boxShadow: '0 2px 8px rgba(37,99,235,0.25)',
                  cursor: (row.role === 'Manager' || timelineIsPast) ? 'default' : 'pointer', padding: '0 8px',
                  textAlign: 'center', overflow: 'hidden', zIndex: 1,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
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

  const renderCalendarView = () => {
    const anchor = new Date(`${timelineDate}T00:00:00`)
    const dow = (anchor.getDay() + 6) % 7
    const mon = new Date(anchor); mon.setDate(anchor.getDate() - dow)
    const weekDates: string[] = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(mon); d.setDate(mon.getDate() + i)
      return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
    })
    const todayKey = formatDateKey(new Date())

    const currentDepartment = departments.find(d => d.id === selectedDeptId)
    const rowsByUser = new Map(
      calWeekRows
        .filter(row => row.user_id !== null)
        .map(row => [row.user_id as string, row])
    )
    const sortedRows: TimelineRow[] = teamMembers
      .filter(member => member.role === 'Employee' || member.role === 'Manager')
      .map(member => {
        const row = rowsByUser.get(member.id)
        return {
          user_id: member.id,
          full_name: member.full_name,
          role: member.role,
          department_id: selectedDeptId || member.department_id || row?.department_id || '',
          department_name: currentDepartment?.name ?? row?.department_name ?? '',
          profile_photo_url: (member as any).profile_photo_url ?? null,
          shifts: (row?.shifts ?? []).filter(shift => !selectedDeptId || shift.department_id === selectedDeptId),
        }
      })
      .sort((a, b) => roleRank(a.role) - roleRank(b.role) || a.full_name.localeCompare(b.full_name))

    const BORDER = PANEL_BORDER
    const NAME_COL = 180
    const EDGE = `2px solid rgba(15,23,42,0.45)`

    if (calWeekLoading) {
      return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 260, color: MUTED, gap: 10 }}>
          <svg className="animate-spin" width={18} height={18} viewBox="0 0 18 18"><circle cx="9" cy="9" r="7" stroke="rgba(37,99,235,0.2)" strokeWidth="2.5" fill="none" /><path d="M9 2a7 7 0 0 1 7 7" stroke={BLUE} strokeWidth="2.5" strokeLinecap="round" fill="none" /></svg>
          <span style={{ fontSize: 13, fontWeight: 600 }}>Loading week schedule…</span>
        </div>
      )
    }

    return (
      <div style={{ overflowX: 'auto', padding: '14px 16px 18px 18px', marginRight: 8, marginBottom: 8 }}>
        <div style={{ minWidth: 700, borderRadius: 12, overflow: 'hidden', border: `1px solid ${BORDER}` }}>
          {/* Header row */}
          <div style={{ display: 'grid', gridTemplateColumns: `${NAME_COL}px repeat(7, 1fr)`, background: 'linear-gradient(135deg, #0F172A 0%, #1E293B 100%)' }}>
            <div style={{ padding: '10px 14px', borderRight: '1px solid rgba(255,255,255,0.08)' }} />
            {weekDates.map(date => {
              const d = new Date(`${date}T00:00:00`)
              const dayNum = String(d.getDate()).padStart(2, '0')
              const month = d.toLocaleDateString('en-AU', { month: 'short' })
              const weekday = d.toLocaleDateString('en-AU', { weekday: 'long' })
              const isToday = date === todayKey
              return (
                <div key={date} style={{ padding: '10px 8px', borderRight: '1px solid rgba(255,255,255,0.08)', textAlign: 'center' }}>
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 800, color: isToday ? BLUE : 'rgba(255,255,255,0.9)', letterSpacing: '0.01em' }}>{dayNum} {month}</p>
                  <p style={{ margin: '2px 0 0', fontSize: 10, fontWeight: 600, color: isToday ? BLUE : 'rgba(255,255,255,0.5)', letterSpacing: '0.03em' }}>{weekday}</p>
                </div>
              )
            })}
          </div>

          {/* Body rows */}
          {sortedRows.length === 0 ? (
            <div style={{ padding: '48px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, color: '#9CA3AF' }}>
              <CalendarDays size={22} strokeWidth={1.5} />
              <p style={{ margin: 0, fontWeight: 700, fontSize: 14 }}>No shifts this week</p>
            </div>
          ) : (
            <div style={{ borderLeft: `1px solid ${BORDER}`, borderRight: EDGE, borderBottom: EDGE }}>
              {(() => {
                const lastMgrIdx = sortedRows.reduce((acc, r, i) => r.role === 'Manager' ? i : acc, -1)
                return sortedRows.map((row, rowIdx) => {
                const isManager = row.role === 'Manager'
                const isRoleBoundary = lastMgrIdx >= 0 && rowIdx === lastMgrIdx + 1
                return (
                  <div key={row.user_id ?? `r-${rowIdx}`} style={{ display: 'grid', gridTemplateColumns: `${NAME_COL}px repeat(7, 1fr)`, borderTop: rowIdx === 0 ? EDGE : isRoleBoundary ? EDGE : `1px solid ${BORDER}`, background: '#FFFFFF', height: 58 }}>
                    {/* Name cell */}
                    <div style={{ display: 'flex', alignItems: 'center', borderRight: `1px solid ${BORDER}`, overflow: 'hidden', height: 58 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 10px 0 12px', minWidth: 0, flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 26, height: 26, flexShrink: 0, background: row.profile_photo_url ? 'transparent' : (isManager ? BLUE_LIGHT : '#F3F4F6'), color: isManager ? BLUE : '#4B5563', borderRadius: 999, overflow: 'hidden' }}>
                          {row.profile_photo_url
                            ? <img src={row.profile_photo_url} alt={row.full_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            : isManager ? <UserCog size={13} /> : <UserRound size={13} />}
                        </div>
                        <span style={{ fontSize: 13, fontWeight: 600, color: TEXT, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{row.full_name}</span>
                      </div>
                    </div>
                    {/* Day cells */}
                    {weekDates.map(date => {
                      const dayShifts = row.shifts.filter((s: TimelineShiftBlock) => s.shift_date === date)
                      const isPastDate = date < todayKey
                      return (
                        <div key={date} style={{ padding: '0 6px', borderRight: `1px solid ${BORDER}`, height: 58, overflow: 'hidden', display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'stretch', justifyContent: 'center' }}>
                          {dayShifts.length === 0 ? (
                            <div style={{ borderRadius: 999, background: '#E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'center', height: 24, cursor: (isPastDate || isManager) ? 'default' : 'pointer' }}
                              onClick={() => {
                                if (isPastDate || isManager || !row.user_id) return
                                const member = allDeptEmployees.find(m => m.id === row.user_id)
                                openBatchDrawer(member, date)
                              }}
                              title={(!isPastDate && !isManager) ? `Assign shift to ${row.full_name} on ${date}` : undefined}
                            >
                              <span style={{ fontSize: 10, fontWeight: 800, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Off</span>
                            </div>
                          ) : dayShifts.map((shift: TimelineShiftBlock) => (
                            <button key={shift.id}
                              onClick={() => { if (!isManager && !isPastDate) openEdit(shift, row.user_id) }}
                              style={{
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                padding: '0 8px', height: 28, flexShrink: 0,
                                background: BLUE, border: 'none', borderRadius: 999,
                                cursor: (isManager || isPastDate) ? 'default' : 'pointer', width: '100%', opacity: isPastDate ? 0.7 : 1,
                              }}
                              onMouseEnter={e => { if (!isManager && !isPastDate) e.currentTarget.style.filter = 'brightness(1.08)' }}
                              onMouseLeave={e => { e.currentTarget.style.filter = 'none' }}
                            >
                              <span style={{ fontSize: 10.5, fontWeight: 700, color: '#FFFFFF', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
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
              })()}
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
          <svg className="animate-spin" width={18} height={18} viewBox="0 0 18 18"><circle cx="9" cy="9" r="7" stroke="rgba(37,99,235,0.2)" strokeWidth="2.5" fill="none" /><path d="M9 2a7 7 0 0 1 7 7" stroke={BLUE} strokeWidth="2.5" strokeLinecap="round" fill="none" /></svg>
          <span style={{ fontSize: 13, fontWeight: 600 }}>Loading shifts…</span>
        </div>
      )
    }
    if (visibleTimelineRows.length === 0) {
      return (
        <div style={{ minHeight: 260, display: 'grid', placeItems: 'center' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, color: '#9CA3AF' }}>
            <div style={{ width: 52, height: 52, borderRadius: 16, background: BLUE_LIGHT, display: 'flex', alignItems: 'center', justifyContent: 'center', color: BLUE }}>
              <CalendarDays size={22} strokeWidth={1.5} />
            </div>
            <p style={{ margin: 0, fontWeight: 700, fontSize: 14 }}>No people available for {prettyDate(timelineDate)}</p>
            <p style={{ margin: 0, fontSize: 12, fontWeight: 500, color: '#CBD5E1' }}>Use &quot;Assign Shift&quot; to schedule your team</p>
          </div>
        </div>
      )
    }
    const EDGE = '2px solid rgba(15,23,42,0.45)'
    const deptOrder: string[] = []
    const deptMap: Record<string, { name: string; rows: TimelineRow[] }> = {}
    for (const row of visibleTimelineRows) {
      if (!deptMap[row.department_id]) {
        deptOrder.push(row.department_id)
        deptMap[row.department_id] = { name: row.department_name, rows: [] }
      }
      deptMap[row.department_id].rows.push(row)
    }
    deptOrder.sort((a, b) => deptMap[a].name.localeCompare(deptMap[b].name))
    for (const dept of Object.values(deptMap)) {
      dept.rows.sort((a, b) => roleRank(a.role) - roleRank(b.role) || a.full_name.localeCompare(b.full_name))
    }
    return (
      <div style={{ overflowX: 'auto', padding: '14px 16px 18px 18px', borderRadius: '0 0 14px 14px' }}>
        <div style={{ minWidth: 860 }}>
          {renderTimeAxis()}
          <div style={{ borderLeft: `1px solid ${PANEL_BORDER}`, borderRight: EDGE, borderBottom: EDGE }}>
            {(() => {
              const allRows = deptOrder.flatMap(deptId => deptMap[deptId].rows)
              const lastManagerIdx = allRows.reduce((acc, r, i) => r.role === 'Manager' ? i : acc, -1)
              return allRows.map((row, idx) =>
                renderShiftRow(row, false, lastManagerIdx >= 0 && idx === lastManagerIdx + 1)
              )
            })()}
          </div>
        </div>
      </div>
    )
  }

  const iconButtonStyle: React.CSSProperties = {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    width: 38, height: 38, borderRadius: 9, border: `1px solid ${PANEL_BORDER}`,
    background: '#FFFFFF', cursor: 'pointer', color: MUTED,
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: APP_BG, fontFamily: 'inherit' }}>
      <style>{`
        @keyframes fadeSlideUp { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
        .tl-row:hover { background: ${BLUE_LIGHT} !important; }
        .off-bar:hover { background: #CBD5E1 !important; }
        .shift-bar:hover { filter: brightness(1.08); }
      `}</style>
      <ManagerSidebar />
      <main style={{ marginLeft: '64px', flex: 1, height: '100vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', scrollbarGutter: 'stable' }}>

        {/* Page header */}
        <div style={{ padding: '20px 28px 16px', flexShrink: 0, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 24 }}>
          <div>
            <h1 className="mb-0 font-heading text-3xl font-bold tracking-tight text-gray-950">
              Shifts
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

        <div style={{ padding: '0 28px 40px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(260px, 290px) minmax(0, 1fr)', gap: 16, alignItems: 'start' }}>

          {/* Departments card */}
          <section style={{ background: '#FFFFFF', border: `1px solid ${PANEL_BORDER}`, borderRadius: 14, overflow: 'visible' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '16px 18px', borderBottom: `1px solid ${PANEL_BORDER}` }}>
              <Users size={15} style={{ color: BLUE }} />
              <h2 style={{ margin: 0, color: TEXT, fontSize: 14, fontWeight: 700, letterSpacing: '-0.2px' }}>Employees</h2>
            </div>
            <div style={{ padding: 14 }}>
              {departments.length === 0 ? (
                <div style={{ minHeight: 150, display: 'grid', placeItems: 'center', color: MUTED, fontWeight: 700 }}>No departments yet.</div>
              ) : (
                <div style={{ display: 'grid', gap: 10 }}>
                  {(() => {
                    const allEmployees = departments.flatMap(d =>
                      (deptMembersMap[d.id] ?? []).filter(m => m.role === 'Employee')
                    ).sort((a, b) => a.full_name.localeCompare(b.full_name))
                    return allEmployees.length === 0 ? (
                      <div style={{ padding: '10px 0', color: '#94A3B8', fontSize: 13, fontWeight: 600 }}>No employees yet.</div>
                    ) : allEmployees.map(member => (
                      <div key={member.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, border: `1px solid ${PANEL_BORDER}`, borderRadius: 12, padding: '13px 12px', background: '#FFFFFF' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, borderRadius: 999, background: BLUE_LIGHT, color: BLUE, flexShrink: 0 }}>
                            <UserRound size={14} />
                          </span>
                          <p style={{ margin: 0, color: TEXT, fontSize: 13, fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{member.full_name}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => router.push(`/manager/communication?tab=messages&partner_id=${member.id}`)}
                          title="Send message"
                          style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', border: `1px solid #E2E8F0`, borderRadius: 9, background: '#F8FAFC', color: '#CBD5E1', width: 30, height: 30, cursor: 'pointer', flexShrink: 0 }}
                          onMouseEnter={e => { e.currentTarget.style.color = BLUE; e.currentTarget.style.borderColor = '#BFDBFE'; e.currentTarget.style.background = BLUE_LIGHT }}
                          onMouseLeave={e => { e.currentTarget.style.color = '#CBD5E1'; e.currentTarget.style.borderColor = '#E2E8F0'; e.currentTarget.style.background = '#F8FAFC' }}
                        >
                          <MessageCircle size={13} />
                        </button>
                      </div>
                    ))
                  })()}
                </div>
              )}
              <button
                type="button"
                onClick={() => openBatchDrawer()}
                style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7, width: '100%', marginTop: 14, border: 0, borderRadius: 10, background: 'linear-gradient(135deg, #2563EB, #1D4ED8)', color: '#FFFFFF', height: 38, fontSize: 13, fontWeight: 800, cursor: 'pointer' }}
                onMouseEnter={e => { e.currentTarget.style.filter = 'brightness(1.08)' }}
                onMouseLeave={e => { e.currentTarget.style.filter = 'none' }}
              >
                <CalendarDays size={14} /> Schedule shifts
              </button>
            </div>
          </section>

          {/* Timeline panel */}
          <section style={{ background: '#FFFFFF', border: `1px solid ${PANEL_BORDER}`, borderRadius: 14, display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '14px 18px', borderBottom: `1px solid ${PANEL_BORDER}`, flexWrap: 'wrap', flexShrink: 0 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 30, height: 30, borderRadius: 9, background: BLUE_LIGHT, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <CalendarDays size={15} style={{ color: BLUE }} />
                  </div>
                  <h2 style={{ margin: 0, color: TEXT, fontSize: 14, fontWeight: 700, letterSpacing: '-0.2px' }}>Shift Timeline</h2>
                </div>
                {timelineDeleteError ? (
                  <p style={{ margin: 0, color: '#DC2626', fontSize: 12, fontWeight: 700 }}>{timelineDeleteError}</p>
                ) : null}
              </div>

              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <div ref={timelineControlsRef} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  {shiftViewMode === 'calendar' ? (
                    // Calendar week navigation
                    (() => {
                      const anchor = new Date(`${timelineDate}T00:00:00`)
                      const dow = (anchor.getDay() + 6) % 7
                      const mon = new Date(anchor); mon.setDate(anchor.getDate() - dow)
                      const sun = new Date(mon); sun.setDate(mon.getDate() + 6)
                      const fmt = (d: Date) => `${String(d.getDate()).padStart(2,'0')} ${d.toLocaleDateString('en-AU',{month:'short'})}`
                      const weekLabel = `${fmt(mon)} – ${fmt(sun)} ${sun.getFullYear()}`
                      const goWeek = (dir: number) => setTimelineDateAndClearSelection(formatDateKey(addDays(mon, dir * 7)))
                      const minAnchor = new Date(`${minDate}T00:00:00`)
                      const minDow = (minAnchor.getDay() + 6) % 7
                      const minMon = new Date(minAnchor); minMon.setDate(minAnchor.getDate() - minDow)
                      const canGoPrev = mon > minMon
                      return (
                        <>
                          <button type="button" onClick={() => goWeek(-1)} disabled={!canGoPrev} style={{ ...iconButtonStyle, opacity: canGoPrev ? 1 : 0.3, cursor: canGoPrev ? 'pointer' : 'default' }}><ChevronLeft size={16} /></button>
                          <span style={{ fontSize: 13, fontWeight: 700, color: TEXT, padding: '0 10px', minWidth: 176, textAlign: 'center', height: 38, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', border: `1px solid ${PANEL_BORDER}`, borderRadius: 8, background: '#FFFFFF' }}>{weekLabel}</span>
                          <button type="button" onClick={() => goWeek(1)} style={iconButtonStyle}><ChevronRight size={16} /></button>
                        </>
                      )
                    })()
                  ) : !timelineIsPast && selectedTimelineUserIds.length > 0 ? (
                    <>
                      <button type="button" onClick={() => { clearTimelineSelection() }} style={{ ...iconButtonStyle, color: MUTED }} aria-label="Cancel selection">
                        <X size={16} />
                      </button>
                      <button
                        type="button"
                        onClick={deleteSelectedTimelineAssignments}
                        disabled={timelineBulkDeleting}
                        style={{ ...iconButtonStyle, background: '#FEF2F2', border: '1px solid #FECACA', color: '#DC2626', cursor: timelineBulkDeleting ? 'default' : 'pointer', opacity: timelineBulkDeleting ? 0.65 : 1 }}
                        title={selectedTimelineAssignmentIds.length === 0 ? 'No shifts on this date' : `Delete ${selectedTimelineAssignmentIds.length} selected shift${selectedTimelineAssignmentIds.length === 1 ? '' : 's'}`}
                      >
                        {timelineBulkDeleting
                          ? <svg className="animate-spin" width={16} height={16} viewBox="0 0 18 18"><circle cx="9" cy="9" r="7" stroke="rgba(220,38,38,0.2)" strokeWidth="2.5" fill="none" /><path d="M9 2a7 7 0 0 1 7 7" stroke="#DC2626" strokeWidth="2.5" strokeLinecap="round" fill="none" /></svg>
                          : <Trash2 size={16} />}
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => setTimelineDateAndClearSelection(formatDateKey(new Date()))}
                        style={{ height: 38, padding: '0 14px', border: `1px solid ${PANEL_BORDER}`, borderRadius: 8, background: timelineDate === todayStr ? BLUE : '#FFFFFF', color: timelineDate === todayStr ? '#FFFFFF' : TEXT, fontSize: 13, fontWeight: 700, cursor: 'pointer', transition: 'background 0.15s, color 0.15s' }}
                      >
                        Today
                      </button>
                      <button type="button" onClick={() => setTimelineByOffset(-1)} disabled={timelineDate <= minDate} style={{ ...iconButtonStyle, opacity: timelineDate <= minDate ? 0.3 : 1, cursor: timelineDate <= minDate ? 'default' : 'pointer' }}>
                        <ChevronLeft size={16} />
                      </button>
                    <TimelineDatePicker value={timelineDate} onChange={setTimelineDateAndClearSelection} shiftDates={datesWithShifts} anchorRef={timelineControlsRef} minDate={minDate} />
                      <button type="button" onClick={() => setTimelineByOffset(1)} style={iconButtonStyle}>
                        <ChevronRight size={16} />
                      </button>
                    </>
                  )}
                </div>

                <OptionsMenu
                  rangeStartHour={rangeStartHour} rangeEndHour={rangeEndHour}
                  isAutoFit={isAutoFit} autoFitRange={autoFitRange}
                  setRangeStartHour={setRangeStartHour} setRangeEndHour={setRangeEndHour}
                  setIsAutoFit={setIsAutoFit}
                  shiftViewMode={shiftViewMode} setShiftViewMode={setShiftViewMode}
                />

              </div>
            </div>

            {shiftViewMode === 'calendar' ? renderCalendarView() : renderTimeline()}
          </section>

          </div>{/* end two-column grid */}
        </div>
      </main>

      {/* ── Edit Shift Modal (OP-style) ── */}
      {assignOpen && editShift && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)', backdropFilter: 'blur(4px)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ width: 520, maxWidth: '94vw', maxHeight: '90vh', background: PANEL, borderRadius: 18, boxShadow: '0 24px 70px rgba(0,0,0,0.18)', display: 'flex', flexDirection: 'column', overflow: 'hidden', animation: 'fadeSlideUp 0.22s ease both' }}>
            {/* Header */}
            <div style={{ padding: '18px 22px 14px', borderBottom: `1px solid #F0F4F8`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h3 style={{ fontWeight: 800, fontSize: '0.9375rem', color: TEXT, margin: 0 }}>Edit Shift</h3>
              <button onClick={() => setAssignOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF', display: 'flex', padding: 4, borderRadius: 6 }}>
                <X size={18} />
              </button>
            </div>
            {/* Body */}
            <div style={{ padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: 14, overflowY: 'auto', flex: 1 }}>
              <div>
                <label style={labelSt}>Reassign to</label>
                <DropdownField
                  value={fUserId}
                  options={assignableMembers.map(m => ({ value: m.id, label: `${m.full_name} · ${m.role}` }))}
                  onChange={v => setFUserId(v)}
                  placeholder="Select person"
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, alignItems: 'start' }}>
                <div>
                  <label style={labelSt}>Date</label>
                  <InlineDatePicker
                    value={fDate}
                    onChange={date => setFDate(date)}
                    shiftDates={editUserShiftDates}
                  />
                </div>
                <div style={{ display: 'grid', gap: 8 }}>
                  <div>
                    <label style={labelSt}>Start</label>
                    <TimePicker value={fStart} onChange={setFStart} />
                  </div>
                  <div>
                    <label style={labelSt}>End</label>
                    <TimePicker value={fEnd} onChange={setFEnd} />
                  </div>
                </div>
              </div>
              {formError && (
                <div style={{ fontSize: 12.5, color: '#DC2626', background: '#FEF2F2', padding: '9px 12px', borderRadius: 8, fontWeight: 600 }}>
                  {formError}
                </div>
              )}
            </div>
            {/* Footer */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 22px', borderTop: `1px solid #F0F4F8` }}>
              <button
                type="button"
                onClick={() => { setAssignOpen(false); setDeleteId(editShift.id) }}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, border: 'none', background: 'none', cursor: 'pointer', color: '#DC2626', fontWeight: 600, fontSize: 13, padding: '8px 4px', borderRadius: 8 }}
              >
                <Trash2 size={14} /> Delete
              </button>
              <div style={{ flex: 1 }} />
              <button onClick={() => setAssignOpen(false)} disabled={saving} style={cancelBtnSt}>Close</button>
              <button onClick={handleSave} disabled={saving} style={{ ...primaryBtnSt, background: BLUE, opacity: saving ? 0.65 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                {saving
                  ? <><svg className="animate-spin" width={13} height={13} viewBox="0 0 18 18"><circle cx="9" cy="9" r="7" stroke="rgba(255,255,255,0.35)" strokeWidth="2.5" fill="none" /><path d="M9 2a7 7 0 0 1 7 7" stroke="white" strokeWidth="2.5" strokeLinecap="round" fill="none" /></svg> Saving…</>
                  : <><Check size={13} /> Save</>
                }
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Batch Assign Drawer ── */}
      {batchOpen && (() => {
        const employees = allDeptEmployees.filter(m => m.role === 'Employee')
        const todayKey = formatDateKey(new Date())
        const todayMonthStr = todayKey.slice(0, 7)
        const [cy, cm] = batchCalMonth ? batchCalMonth.split('-').map(Number) : [0, 0]
        const firstDay = batchCalMonth ? new Date(cy, cm - 1, 1).getDay() : 0
        const daysInMonth = batchCalMonth ? new Date(cy, cm, 0).getDate() : 0
        const monthLabel = batchCalMonth ? new Date(cy, cm - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : ''
        const canGoPrevMonth = batchCalMonth > todayMonthStr
        const cells: (string | null)[] = []
        for (let i = 0; i < firstDay; i++) cells.push(null)
        for (let d = 1; d <= daysInMonth; d++) cells.push(`${cy}-${String(cm).padStart(2, '0')}-${String(d).padStart(2, '0')}`)
        const goPrev = () => {
          if (!canGoPrevMonth) return
          setBatchCalDir('prev'); setBatchCalKey(k => k + 1)
          const d = new Date(cy, cm - 2, 1)
          setBatchCalMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
        }
        const goNext = () => {
          setBatchCalDir('next'); setBatchCalKey(k => k + 1)
          const d = new Date(cy, cm, 1)
          setBatchCalMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
        }
        const selectedMembers = employees.filter(m => batchSelectedMemberIds.includes(m.id))
        return (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)', backdropFilter: 'blur(4px)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ width: 600, maxWidth: '96vw', maxHeight: '92vh', background: PANEL, borderRadius: 18, boxShadow: '0 24px 70px rgba(0,0,0,0.18)', display: 'flex', flexDirection: 'column', overflow: 'hidden', animation: 'fadeSlideUp 0.22s ease both' }}>
              {/* Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, padding: 18, borderBottom: `1px solid ${PANEL_BORDER}` }}>
                <h2 style={{ margin: 0, color: TEXT, fontSize: '1.1rem', fontWeight: 900 }}>
                  {batchSingleMember ? `Assign Shift to ${batchSingleMember.full_name}` : 'Assign Shifts'}
                </h2>
                <button type="button" onClick={closeBatchDrawer} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF', display: 'flex', padding: 4, borderRadius: 6 }}><X size={18} /></button>
              </div>

              <div style={{ padding: '20px 22px 0', overflowY: 'auto', flex: 1 }}>
                {/* People picker — only Employees, hidden when single member pre-filled */}
                {!batchSingleMember && (
                  <div style={{ marginBottom: 20 }}>
                    <p style={{ margin: '0 0 8px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#94A3B8' }}>People</p>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 8 }}>
                      {employees.map(member => {
                        const active = batchSelectedMemberIds.includes(member.id)
                        return (
                          <button type="button" key={member.id} onClick={() => toggleBatchMember(member.id)}
                            style={{ border: active ? `1.5px solid ${BLUE}` : `1px solid ${PANEL_BORDER}`, background: active ? BLUE_LIGHT : '#FFFFFF', borderRadius: 10, padding: '10px 12px', textAlign: 'left', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                              <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, borderRadius: 999, background: '#F3F4F6', color: '#4B5563', flexShrink: 0 }}>
                                <UserRound size={13} />
                              </span>
                              <div style={{ minWidth: 0 }}>
                                <p style={{ margin: 0, color: TEXT, fontSize: 13, fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{member.full_name}</p>
                                <p style={{ margin: '2px 0 0', color: '#94A3B8', fontSize: 11, fontWeight: 600 }}>Employee</p>
                              </div>
                            </div>
                            {active && <Check size={15} color={BLUE} style={{ flexShrink: 0 }} />}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Empty state before selection */}
                {!batchSingleMember && batchCalMonth && batchSelectedMemberIds.length === 0 && (
                  <div style={{ marginBottom: 20, background: '#F8FAFC', borderRadius: 14, padding: '24px 18px', border: `1.5px dashed ${PANEL_BORDER}`, textAlign: 'center' }}>
                    <CalendarDays size={20} color="#CBD5E1" style={{ margin: '0 auto 6px', display: 'block' }} />
                    <p style={{ margin: 0, color: '#94A3B8', fontSize: 13, fontWeight: 500 }}>Select employees above to pick shift dates</p>
                  </div>
                )}

                {/* Calendar + Shift Hours */}
                {batchCalMonth && (batchSelectedMemberIds.length > 0 || !!batchSingleMember) && (() => (
                  <>
                    <style>{`
                      @keyframes calSlideNext { from { opacity:0;transform:translateX(18px) } to { opacity:1;transform:translateX(0) } }
                      @keyframes calSlidePrev { from { opacity:0;transform:translateX(-18px) } to { opacity:1;transform:translateX(0) } }
                    `}</style>
                    <div style={{ marginBottom: 20 }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 210px', gap: 14, alignItems: 'stretch' }}>
                        {/* Calendar */}
                        <div style={{ background: '#F8FAFC', borderRadius: 14, padding: '12px 14px', border: `1px solid ${PANEL_BORDER}` }}>
                          <p style={{ margin: '0 0 10px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#94A3B8' }}>Select Dates</p>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                            <button type="button" onClick={goPrev} disabled={!canGoPrevMonth}
                              style={{ width: 26, height: 26, border: `1px solid ${canGoPrevMonth ? PANEL_BORDER : 'transparent'}`, background: canGoPrevMonth ? '#FFFFFF' : 'transparent', borderRadius: 7, cursor: canGoPrevMonth ? 'pointer' : 'default', display: 'flex', alignItems: 'center', justifyContent: 'center', color: canGoPrevMonth ? MUTED : '#D1D5DB', opacity: canGoPrevMonth ? 1 : 0.3 }}>
                              <ChevronLeft size={12} />
                            </button>
                            <span style={{ fontSize: 13, fontWeight: 700, color: TEXT }}>{monthLabel}</span>
                            <button type="button" onClick={goNext}
                              style={{ width: 26, height: 26, border: `1px solid ${PANEL_BORDER}`, background: '#FFFFFF', borderRadius: 7, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: MUTED }}>
                              <ChevronRight size={12} />
                            </button>
                          </div>
                          <div key={`hd-${batchCalKey}`} style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 36px)', justifyContent: 'center', marginBottom: 2 }}>
                            {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => (
                              <div key={d} style={{ fontSize: 11, fontWeight: 600, color: '#9CA3AF', textAlign: 'center', height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{d}</div>
                            ))}
                          </div>
                          <div key={`grid-${batchCalKey}`} style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 36px)', justifyContent: 'center', gap: 2, animation: `${batchCalDir === 'next' ? 'calSlideNext' : 'calSlidePrev'} 0.18s ease` }}>
                            {cells.map((date, i) => {
                              if (!date || date < todayKey) return <div key={`e-${i}`} style={{ width: 36, height: 36 }} />
                              const sel = batchSelectedDates.includes(date)
                              const isToday = date === todayKey
                              return (
                                <button key={date} type="button" onClick={() => toggleBatchDate(date)}
                                  style={{ width: 36, height: 36, borderRadius: '50%', border: isToday && !sel ? `2px solid ${BLUE}` : 'none', background: sel ? BLUE : 'transparent', color: sel ? '#FFFFFF' : isToday ? BLUE : TEXT, fontWeight: sel || isToday ? 700 : 400, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, flexShrink: 0, transition: 'background 0.12s, color 0.12s' }}
                                  onMouseEnter={e => { if (!sel) e.currentTarget.style.background = '#EFF6FF' }}
                                  onMouseLeave={e => { if (!sel) e.currentTarget.style.background = 'transparent' }}
                                >
                                  {new Date(`${date}T00:00:00`).getDate()}
                                </button>
                              )
                            })}
                          </div>
                        </div>
                        {/* Shift Hours */}
                        <div style={{ background: '#F8FAFC', borderRadius: 14, padding: '12px 14px', border: `1px solid ${PANEL_BORDER}`, display: 'flex', flexDirection: 'column', gap: 12 }}>
                          <p style={{ margin: 0, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#94A3B8' }}>Shift Hours</p>
                          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                            <span style={labelSt}>Start time</span>
                            <TimePicker value={batchDefaultStartTime} onChange={setBatchDefaultStartTime} />
                          </label>
                          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                            <span style={labelSt}>End time</span>
                            <TimePicker value={batchDefaultEndTime} onChange={setBatchDefaultEndTime} />
                          </label>
                          <button type="button" onClick={applyDefaultToAll}
                            style={{ border: `1px solid ${PANEL_BORDER}`, borderRadius: 8, background: '#FFFFFF', color: TEXT, height: 34, padding: '0 12px', fontWeight: 700, fontSize: 12, cursor: 'pointer', width: '100%', marginTop: 2 }}>
                            Apply to all
                          </button>
                        </div>
                      </div>
                    </div>
                  </>
                ))()}

                {/* Preview */}
                <div style={{ marginBottom: 20 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <p style={{ margin: 0, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#94A3B8' }}>Preview</p>
                    <span style={{ fontSize: 12, color: enabledBatchCells.length > 0 ? BLUE : '#CBD5E1', fontWeight: 700 }}>
                      {enabledBatchCells.length} shift{enabledBatchCells.length !== 1 ? 's' : ''} selected
                    </span>
                  </div>
                  {selectedMembers.length === 0 || batchSelectedDates.length === 0 ? (
                    <div style={{ border: `1.5px dashed ${PANEL_BORDER}`, borderRadius: 12, padding: '22px 18px', textAlign: 'center' }}>
                      <CalendarDays size={20} color="#CBD5E1" style={{ margin: '0 auto 6px', display: 'block' }} />
                      <p style={{ margin: 0, color: '#94A3B8', fontSize: 13, fontWeight: 500 }}>
                        {selectedMembers.length === 0 ? 'Select employees to get started' : 'Select dates from the calendar above'}
                      </p>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {selectedMembers.map(member => (
                        <div key={member.id} style={{ border: `1px solid ${PANEL_BORDER}`, borderRadius: 12, overflow: 'hidden' }}>
                          {!batchSingleMember && (
                            <div style={{ padding: '8px 12px', borderBottom: `1px solid ${PANEL_BORDER}`, background: '#F8FAFC', display: 'flex', alignItems: 'center', gap: 7 }}>
                              <div style={{ width: 22, height: 22, borderRadius: '50%', background: '#F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                <UserRound size={12} color="#94A3B8" />
                              </div>
                              <span style={{ fontSize: 12, fontWeight: 700, color: TEXT }}>{member.full_name}</span>
                              <span style={{ fontSize: 11, color: '#94A3B8', fontWeight: 500 }}>Employee</span>
                            </div>
                          )}
                          <div style={{ padding: '10px', display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
                            {batchSelectedDates.map(date => {
                              const key = `${member.id}_${date}`
                              const cell = batchCells[key] ?? { user_id: member.id, shift_date: date, start_time: batchDefaultStartTime, end_time: batchDefaultEndTime, enabled: true }
                              if (cell.enabled === false) return null
                              const existing = futureShiftMap.get(key) ?? []
                              return (
                                <div key={key} style={{ border: `1px solid ${PANEL_BORDER}`, borderRadius: 10, padding: '9px 10px', background: '#FFFFFF', position: 'relative' }}>
                                  <button type="button" onClick={() => removeShiftCard(member.id, date)}
                                    style={{ position: 'absolute', top: 5, right: 5, width: 18, height: 18, border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#CBD5E1', borderRadius: 4, padding: 0 }}
                                    onMouseEnter={e => { e.currentTarget.style.color = '#DC2626'; e.currentTarget.style.background = '#FEF2F2' }}
                                    onMouseLeave={e => { e.currentTarget.style.color = '#CBD5E1'; e.currentTarget.style.background = 'transparent' }}
                                  ><X size={10} /></button>
                                  <p style={{ margin: '0 0 7px', fontSize: 11, fontWeight: 700, color: TEXT, paddingRight: 14 }}>{previewDateLabel(date)}</p>
                                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 5 }}>
                                    <TimePicker value={cell.start_time} onChange={v => updateBatchCell(member.id, date, { start_time: v })} />
                                    <TimePicker value={cell.end_time} onChange={v => updateBatchCell(member.id, date, { end_time: v })} />
                                  </div>
                                  {existing.length > 0 && (
                                    <p style={{ margin: '5px 0 0', fontSize: 11, fontWeight: 700, color: '#B45309', display: 'flex', alignItems: 'center', gap: 4 }}>
                                      ⚠ Has {existing.length} shift{existing.length !== 1 ? 's' : ''}
                                    </p>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {bulkError && <div style={{ marginBottom: 16, fontSize: 12.5, color: '#DC2626', background: '#FEF2F2', padding: '9px 12px', borderRadius: 8, fontWeight: 600 }}>{bulkError}</div>}
                {bulkFailures.length > 0 && (
                  <div style={{ marginBottom: 16, fontSize: 12.5, color: '#DC2626', background: '#FEF2F2', padding: '9px 12px', borderRadius: 8, fontWeight: 600 }}>
                    {bulkFailures.slice(0, 5).map((f, i) => <div key={i}>{previewDateLabel(f.shift_date)}: {f.message}</div>)}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div style={{ padding: 18, borderTop: `1px solid ${PANEL_BORDER}`, display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button type="button" onClick={closeBatchDrawer} style={cancelBtnSt}>Cancel</button>
                <button type="button" onClick={submitBulkAssignment} disabled={bulkSubmitting}
                  style={{ ...primaryBtnSt, background: BLUE, opacity: bulkSubmitting ? 0.65 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                  {bulkSubmitting
                    ? <><svg className="animate-spin" width={13} height={13} viewBox="0 0 18 18"><circle cx="9" cy="9" r="7" stroke="rgba(255,255,255,0.35)" strokeWidth="2.5" fill="none" /><path d="M9 2a7 7 0 0 1 7 7" stroke="white" strokeWidth="2.5" strokeLinecap="round" fill="none" /></svg> Assigning…</>
                    : <><Check size={13} /> Assign {enabledBatchCells.length || ''} Shift{enabledBatchCells.length === 1 ? '' : 's'}</>
                  }
                </button>
              </div>
            </div>
          </div>
        )
      })()}

      {/* ── Delete Confirm ── */}
      {deleteId && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)', backdropFilter: 'blur(4px)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: PANEL, borderRadius: 16, padding: 28, width: 400, maxWidth: '90vw', boxShadow: '0 20px 60px rgba(0,0,0,0.18)', animation: 'fadeSlideUp 0.2s ease both' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
              <div style={{ width: 38, height: 38, borderRadius: 10, background: '#FEF2F2', color: '#DC2626', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Trash2 size={17} />
              </div>
              <h3 style={{ fontWeight: 800, fontSize: '1rem', color: TEXT, margin: 0 }}>Delete Shift</h3>
            </div>
            <p style={{ fontSize: 13.5, color: MUTED, margin: '0 0 20px', lineHeight: 1.6 }}>
              This will remove the shift and all its assignments. This cannot be undone.
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setDeleteId(null)} disabled={deleting} style={cancelBtnSt}>Cancel</button>
              <button onClick={handleDelete} disabled={deleting}
                style={{ flex: 1, height: 40, background: '#DC2626', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 13, color: '#fff', cursor: deleting ? 'not-allowed' : 'pointer', opacity: deleting ? 0.65 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                {deleting
                  ? <><svg className="animate-spin" width={13} height={13} viewBox="0 0 18 18"><circle cx="9" cy="9" r="7" stroke="rgba(255,255,255,0.35)" strokeWidth="2.5" fill="none" /><path d="M9 2a7 7 0 0 1 7 7" stroke="white" strokeWidth="2.5" strokeLinecap="round" fill="none" /></svg> Deleting…</>
                  : 'Delete'
                }
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Shared styles ─────────────────────────────────────────────────────────────

const labelSt: React.CSSProperties = {
  display: 'block', fontSize: 11.5, fontWeight: 700, color: '#374151',
  marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.05em',
}

const inputSt: React.CSSProperties = {
  width: '100%', padding: '9px 12px', border: `1px solid ${PANEL_BORDER}`, borderRadius: 9,
  fontSize: 13, outline: 'none', boxSizing: 'border-box', background: '#FAFBFC',
  color: TEXT, fontWeight: 500,
}

const cancelBtnSt: React.CSSProperties = {
  flex: 1, height: 40, background: 'none', border: `1.5px solid ${PANEL_BORDER}`, borderRadius: 10,
  fontWeight: 700, fontSize: 13, color: MUTED, cursor: 'pointer',
}

const primaryBtnSt: React.CSSProperties = {
  flex: 1, height: 40, border: 'none', borderRadius: 10,
  fontWeight: 700, fontSize: 13, color: '#fff', cursor: 'pointer',
}
