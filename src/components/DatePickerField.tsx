'use client'

import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']
const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const DAYS_SHORT = ['Su','Mo','Tu','We','Th','Fr','Sa']

type CalMode = 'day' | 'month' | 'year'

function formatDateLabel(val: string): string {
  if (!val) return ''
  const [y, m, d] = val.split('-').map(Number)
  if (!y || !m || !d) return ''
  return `${d} ${MONTHS[m - 1]?.slice(0, 3)} ${y}`
}

function CalNavBtn({ onClick, disabled, children }: { onClick: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        width: 32, height: 32, border: '1.5px solid #E5E7EB', borderRadius: 8,
        background: disabled ? '#FAFAFA' : '#F9FAFB',
        cursor: disabled ? 'default' : 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: disabled ? '#D1D5DB' : '#374151',
        opacity: disabled ? 0.4 : 1, flexShrink: 0,
      }}
      onMouseEnter={e => { if (!disabled) e.currentTarget.style.background = '#F3F4F6' }}
      onMouseLeave={e => { if (!disabled) e.currentTarget.style.background = '#F9FAFB' }}
    >
      {children}
    </button>
  )
}

const ChevL = () => <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M8.5 2.5L4.5 7l4 4.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
const ChevR = () => <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M5.5 2.5L9.5 7l-4 4.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>

export default function DatePickerField({ value, onChange, placeholder = 'Select date' }: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
}) {
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<CalMode>('day')
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0 })
  const [mounted, setMounted] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const calRef = useRef<HTMLDivElement>(null)

  useEffect(() => { setMounted(true) }, [])

  const today = new Date()
  const maxDate = new Date(today.getFullYear() - 16, today.getMonth(), today.getDate())
  const maxY = maxDate.getFullYear()
  const maxM = maxDate.getMonth()
  const maxD = maxDate.getDate()

  const parseView = () => {
    if (value) { const [y, m] = value.split('-').map(Number); return { y, m: m - 1 } }
    return { y: maxY, m: maxM }
  }

  const [view, setView] = useState<{ y: number; m: number }>(parseView)
  const [yearPage, setYearPage] = useState(0)

  const yearBlockStart = maxY - yearPage * 12 - 11
  const yearList = Array.from({ length: 12 }, (_, i) => yearBlockStart + i)

  const openYearMode = (vy: number) => {
    setYearPage(Math.max(0, Math.floor((maxY - vy) / 12)))
    setMode('year')
  }

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (triggerRef.current?.contains(e.target as Node) || calRef.current?.contains(e.target as Node)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  const recalcPos = () => {
    if (!triggerRef.current) return
    const r = triggerRef.current.getBoundingClientRect()
    const CAL_H = 360
    const fitsBelow = r.bottom + CAL_H + 8 <= window.innerHeight
    setPos({ top: fitsBelow ? r.bottom + 6 : r.top - CAL_H - 6, left: r.left, width: r.width })
  }

  const handleOpen = () => {
    if (!open) { const v = parseView(); setView(v); setMode('day'); recalcPos() }
    setOpen(o => !o)
  }

  const canNextMonth = view.y < maxY || (view.y === maxY && view.m < maxM)
  const prevMonth = () => setView(v => v.m === 0 ? { y: v.y - 1, m: 11 } : { y: v.y, m: v.m - 1 })
  const nextMonth = () => { if (!canNextMonth) return; setView(v => v.m === 11 ? { y: v.y + 1, m: 0 } : { y: v.y, m: v.m + 1 }) }

  const canNextYear = view.y < maxY
  const prevYear = () => setView(v => ({ ...v, y: v.y - 1 }))
  const nextYear = () => { if (!canNextYear) return; setView(v => ({ ...v, y: v.y + 1 })) }

  const canPrevYearBlock = yearBlockStart > 1924
  const canNextYearBlock = yearPage > 0
  const prevYearBlock = () => { if (canPrevYearBlock) setYearPage(p => p + 1) }
  const nextYearBlock = () => { if (canNextYearBlock) setYearPage(p => p - 1) }

  const selParts = value ? value.split('-').map(Number) : []
  const selY = selParts[0], selM = (selParts[1] ?? 0) - 1, selD = selParts[2]

  const isDayFuture = (d: number) => view.y > maxY || (view.y === maxY && (view.m > maxM || (view.m === maxM && d > maxD)))
  const isMonthFuture = (mi: number) => view.y > maxY || (view.y === maxY && mi > maxM)
  const isYearFuture = (y: number) => y > maxY

  const selectDay = (d: number) => {
    if (isDayFuture(d)) return
    onChange(`${view.y}-${String(view.m + 1).padStart(2,'0')}-${String(d).padStart(2,'0')}`)
    setOpen(false)
  }
  const selectMonth = (mi: number) => { if (!isMonthFuture(mi)) { setView(v => ({ ...v, m: mi })); setMode('day') } }
  const selectYear = (y: number) => { if (!isYearFuture(y)) { setView(v => ({ ...v, y })); setMode('month') } }

  const firstDow = new Date(view.y, view.m, 1).getDay()
  const daysInMonth = new Date(view.y, view.m + 1, 0).getDate()
  const cells: (number | null)[] = [...Array(firstDow).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)]
  while (cells.length % 7 !== 0) cells.push(null)

  const label = formatDateLabel(value)
  const calWidth = Math.max(pos.width, 288)

  const headerBtnStyle: React.CSSProperties = {
    background: 'none', border: 'none', cursor: 'pointer', padding: '2px 8px',
    borderRadius: 8, fontWeight: 700, fontSize: '0.9375rem',
    color: '#1C1917', display: 'flex', alignItems: 'center', gap: 4,
    transition: 'background 0.12s',
  }

  return (
    <div style={{ position: 'relative' }}>
      <button
        ref={triggerRef}
        type="button"
        onClick={handleOpen}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '10px 12px', border: `1.5px solid ${open ? '#F97316' : '#E5E7EB'}`,
          borderRadius: '8px', background: '#FFFFFF', cursor: 'pointer',
          fontSize: '0.9375rem', color: label ? '#111827' : '#9CA3AF',
          outline: 'none', boxSizing: 'border-box', transition: 'border-color 0.15s',
          fontFamily: 'inherit',
        }}
      >
        <span>{label || placeholder}</span>
        <svg width="15" height="15" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0, color: '#9CA3AF' }}>
          <rect x="2" y="3" width="12" height="11" rx="2" stroke="currentColor" strokeWidth="1.5" fill="none"/>
          <path d="M5 1v2M11 1v2M2 7h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
      </button>

      {open && mounted && createPortal(
        <div ref={calRef} style={{
          position: 'fixed', top: pos.top, left: pos.left, width: calWidth,
          background: '#FFFFFF', border: '1.5px solid #E5E7EB', borderRadius: 16,
          boxShadow: '0 16px 48px rgba(15,23,42,0.14), 0 2px 8px rgba(0,0,0,0.06)',
          zIndex: 99999, padding: '16px 16px 14px',
        }}>

          {/* ── DAY VIEW ── */}
          {mode === 'day' && (<>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <CalNavBtn onClick={prevMonth}><ChevL /></CalNavBtn>
              <button
                type="button"
                style={headerBtnStyle}
                onClick={() => openYearMode(view.y)}
                onMouseEnter={e => { e.currentTarget.style.background = '#FFF7ED' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'none' }}
              >
                {MONTHS[view.m]} {view.y}
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ color: '#9CA3AF' }}>
                  <path d="M2.5 4.5L6 8l3.5-3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
              <CalNavBtn onClick={nextMonth} disabled={!canNextMonth}><ChevR /></CalNavBtn>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', marginBottom: 4 }}>
              {DAYS_SHORT.map(d => (
                <div key={d} style={{ textAlign: 'center', fontSize: '0.6875rem', fontWeight: 700, color: '#9CA3AF', padding: '3px 0', letterSpacing: '0.04em' }}>{d}</div>
              ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 1 }}>
              {cells.map((d, i) => {
                if (d === null) return <div key={`e-${i}`} />
                const sel = d === selD && view.m === selM && view.y === selY
                const fut = isDayFuture(d)
                return (
                  <button key={`d-${i}`} type="button" onClick={() => selectDay(d)} disabled={fut}
                    style={{
                      width: '100%', aspectRatio: '1', border: '1.5px solid transparent',
                      borderRadius: 8, cursor: fut ? 'default' : 'pointer',
                      background: sel ? '#F97316' : 'transparent',
                      color: sel ? '#FFFFFF' : fut ? '#D1D5DB' : '#1C1917',
                      fontSize: '0.8125rem', fontWeight: sel ? 700 : 400,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      transition: 'background 0.1s',
                    }}
                    onMouseEnter={e => { if (!fut && !sel) e.currentTarget.style.background = '#FFF7ED' }}
                    onMouseLeave={e => { if (!fut && !sel) e.currentTarget.style.background = 'transparent' }}
                  >{d}</button>
                )
              })}
            </div>

            {value && (
              <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid #F3F4F6', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.8125rem', color: '#6B7280' }}>{label}</span>
                <button type="button" onClick={() => { onChange(''); setOpen(false) }}
                  style={{ fontSize: '0.8125rem', color: '#F97316', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                  Clear
                </button>
              </div>
            )}
          </>)}

          {/* ── MONTH VIEW ── */}
          {mode === 'month' && (<>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <CalNavBtn onClick={prevYear}><ChevL /></CalNavBtn>
              <button
                type="button"
                style={headerBtnStyle}
                onClick={() => openYearMode(view.y)}
                onMouseEnter={e => { e.currentTarget.style.background = '#FFF7ED' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'none' }}
              >
                {view.y}
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ color: '#9CA3AF' }}>
                  <path d="M2.5 4.5L6 8l3.5-3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
              <CalNavBtn onClick={nextYear} disabled={!canNextYear}><ChevR /></CalNavBtn>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
              {MONTHS_SHORT.map((name, mi) => {
                const isCurSel = mi === selM && view.y === selY
                const fut = isMonthFuture(mi)
                const isViewMonth = mi === view.m
                return (
                  <button key={name} type="button" onClick={() => selectMonth(mi)} disabled={fut}
                    style={{
                      padding: '10px 4px', border: isCurSel ? 'none' : isViewMonth ? '1.5px solid #F97316' : '1.5px solid transparent',
                      borderRadius: 10, cursor: fut ? 'default' : 'pointer',
                      background: isCurSel ? '#F97316' : 'transparent',
                      color: isCurSel ? '#FFFFFF' : fut ? '#D1D5DB' : '#1C1917',
                      fontSize: '0.9375rem', fontWeight: isCurSel || isViewMonth ? 700 : 400,
                      textAlign: 'center', transition: 'background 0.1s',
                    }}
                    onMouseEnter={e => { if (!fut && !isCurSel) e.currentTarget.style.background = '#FFF7ED' }}
                    onMouseLeave={e => { if (!fut && !isCurSel) e.currentTarget.style.background = 'transparent' }}
                  >{name}</button>
                )
              })}
            </div>

            <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid #F3F4F6', display: 'flex', justifyContent: 'flex-start' }}>
              <button type="button" onClick={() => setMode('day')}
                style={{ fontSize: '0.8125rem', color: '#6B7280', fontWeight: 500, background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', gap: 4 }}>
                <ChevL /> Back to days
              </button>
            </div>
          </>)}

          {/* ── YEAR VIEW ── */}
          {mode === 'year' && (<>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <CalNavBtn onClick={prevYearBlock} disabled={!canPrevYearBlock}><ChevL /></CalNavBtn>
              <span style={{ fontWeight: 700, fontSize: '0.9375rem', color: '#1C1917' }}>
                {yearBlockStart} – {yearBlockStart + 11}
              </span>
              <CalNavBtn onClick={nextYearBlock} disabled={!canNextYearBlock}><ChevR /></CalNavBtn>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
              {yearList.map(y => {
                const isCurSel = y === selY
                const isViewY = y === view.y
                const fut = isYearFuture(y)
                return (
                  <button key={y} type="button" onClick={() => selectYear(y)} disabled={fut}
                    style={{
                      padding: '10px 4px', border: isCurSel ? 'none' : isViewY ? '1.5px solid #F97316' : '1.5px solid transparent',
                      borderRadius: 10, cursor: fut ? 'default' : 'pointer',
                      background: isCurSel ? '#F97316' : 'transparent',
                      color: isCurSel ? '#FFFFFF' : fut ? '#D1D5DB' : '#1C1917',
                      fontSize: '0.9375rem', fontWeight: isCurSel || isViewY ? 700 : 400,
                      textAlign: 'center', transition: 'background 0.1s',
                    }}
                    onMouseEnter={e => { if (!fut && !isCurSel) e.currentTarget.style.background = '#FFF7ED' }}
                    onMouseLeave={e => { if (!fut && !isCurSel) e.currentTarget.style.background = 'transparent' }}
                  >{y}</button>
                )
              })}
            </div>

            <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid #F3F4F6', display: 'flex', justifyContent: 'flex-start' }}>
              <button type="button" onClick={() => setMode('month')}
                style={{ fontSize: '0.8125rem', color: '#6B7280', fontWeight: 500, background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', gap: 4 }}>
                <ChevL /> Back to months
              </button>
            </div>
          </>)}

        </div>,
        document.body
      )}
    </div>
  )
}
