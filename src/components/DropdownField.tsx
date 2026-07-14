'use client'

// Canonical dropdown primitive — lifted from src/app/owner/team/page.tsx. Always use this instead
// of a native <select> for any dropdown field. Do not redesign here.

import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { ChevronDown } from 'lucide-react'

export default function DropdownField({ value, options, onChange, placeholder, disabled = false, compact = false, fontSize, height }: {
  value: string
  options: { value: string; label: string }[]
  onChange: (v: string) => void
  placeholder?: string
  disabled?: boolean
  // Smaller trigger for toolbar/filter contexts (e.g. a search bar's adjacent filter) — the
  // default (non-compact) size remains the form-field standard used everywhere else.
  compact?: boolean
  // Overrides the trigger's font size independent of compact (e.g. a long label list that needs
  // to stay unabbreviated at the default height). Defaults to the compact/non-compact standard.
  fontSize?: string
  // Overrides the trigger's height independent of compact (e.g. matching a taller sibling button
  // in the same row). Defaults to the compact/non-compact standard (32/40).
  height?: number
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

  const handleOpen = () => {
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
      <button ref={triggerRef} type="button" onClick={handleOpen}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: compact ? '6px 10px' : '10px 12px', border: `1.5px solid ${open ? '#F97316' : '#E5E7EB'}`, borderRadius: 8,
          background: '#FFFFFF', cursor: 'pointer', fontSize: fontSize ?? (compact ? '0.8125rem' : '0.9375rem'),
          color: selected ? '#111827' : '#9CA3AF', fontWeight: selected ? 500 : 400,
          outline: 'none', boxSizing: 'border-box', transition: 'border-color 0.15s', height: height ?? (compact ? 32 : 40),
        }}>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {selected?.label ?? placeholder ?? 'Select...'}
        </span>
        <ChevronDown size={13} style={{ color: '#94A3B8', flexShrink: 0, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
      </button>
      {/* Portal to body: the menu uses viewport (fixed) coordinates, but a transformed/animated
          ancestor (e.g. a panel entry animation with `fill: both`) would otherwise become its
          containing block and shift it away from the trigger. */}
      {open && createPortal(
        <div ref={dropdownRef} style={{
          position: 'fixed', top: pos.top, left: pos.left, width: pos.width,
          background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 10,
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
        </div>,
        document.body
      )}
    </div>
  )
}
