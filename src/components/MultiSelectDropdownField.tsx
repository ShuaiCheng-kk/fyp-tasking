'use client'

// Canonical multi-select dropdown primitive — lifted from src/app/owner/shifts/page.tsx (bulk-edit
// department/user filters). Checkbox-style popover, "N selected" trigger label. Use this instead of
// a page-local copy whenever a field needs to pick more than one value (e.g. multiple task assignees).

import { useState, useRef, useEffect } from 'react'
import { ChevronDown, Check } from 'lucide-react'

export default function MultiSelectDropdownField({ values, options, onChange, allLabel, disabled = false, compact = false }: {
  values: string[]
  options: { value: string; label: string }[]
  onChange: (values: string[]) => void
  allLabel: string
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

  const canOpen = !disabled && options.length > 0
  const label = values.length === 0
    ? allLabel
    : values.length === 1
      ? options.find(o => o.value === values[0])?.label ?? allLabel
      : `${values.length} selected`

  const handleOpen = () => {
    if (!canOpen) return
    if (!open && triggerRef.current) {
      const r = triggerRef.current.getBoundingClientRect()
      const DROPDOWN_H = Math.min(options.length * 37 + 8, 240)
      const fitsBelow = r.bottom + DROPDOWN_H + 4 <= window.innerHeight
      setPos({ top: fitsBelow ? r.bottom + 4 : r.top - DROPDOWN_H - 4, left: r.left, width: r.width })
    }
    setOpen(o => !o)
  }

  const toggle = (v: string) => onChange(values.includes(v) ? values.filter(id => id !== v) : [...values, v])

  return (
    <div style={{ position: 'relative' }}>
      <button ref={triggerRef} type="button" disabled={disabled}
        onClick={handleOpen}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: compact ? '5px 10px' : '8px 12px', minHeight: compact ? 32 : 38, border: `1px solid ${open ? '#F97316' : '#E5E7EB'}`, borderRadius: 8,
          background: disabled ? '#F9FAFB' : '#FFFFFF', cursor: canOpen ? 'pointer' : 'default',
          fontSize: compact ? 12 : 13, color: values.length > 0 ? '#111827' : '#9CA3AF',
          fontWeight: values.length > 0 ? 500 : 400, outline: 'none', boxSizing: 'border-box',
          transition: 'border-color 0.15s',
        }}>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
        <ChevronDown size={compact ? 11 : 13} style={{ color: '#9CA3AF', flexShrink: 0, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
      </button>
      {open && (
        <div ref={dropdownRef} style={{
          position: 'fixed', top: pos.top, left: pos.left, width: pos.width,
          background: '#FFFFFF', border: '1.5px solid #E5E7EB', borderRadius: 10,
          boxShadow: '0 8px 24px rgba(15,23,42,0.12)', zIndex: 9999, maxHeight: 240, overflowY: 'auto',
          padding: '4px 0',
        }}>
          {values.length > 0 && (
            <button type="button" onClick={() => onChange([])}
              style={{ display: 'block', width: '100%', padding: '8px 14px', textAlign: 'left', border: 'none', borderBottom: '1px solid #F3F4F6', background: 'transparent', color: '#9CA3AF', fontWeight: 600, fontSize: 12, cursor: 'pointer' }}
            >
              Clear ({allLabel})
            </button>
          )}
          {options.map(opt => {
            const isSel = values.includes(opt.value)
            return (
              <button key={opt.value} type="button"
                onClick={() => toggle(opt.value)}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, width: '100%', padding: '8px 14px', textAlign: 'left',
                  border: 'none', background: isSel ? '#FFF7ED' : 'transparent',
                  color: isSel ? '#EA580C' : '#374151', fontWeight: isSel ? 700 : 400,
                  fontSize: 13, cursor: 'pointer',
                }}
                onMouseEnter={e => { if (!isSel) e.currentTarget.style.background = '#F9FAFB' }}
                onMouseLeave={e => { if (!isSel) e.currentTarget.style.background = 'transparent' }}
              >
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{opt.label}</span>
                <span style={{ width: 16, height: 16, borderRadius: 5, border: `2px solid ${isSel ? '#EA580C' : '#D1D5DB'}`, background: isSel ? '#EA580C' : 'transparent', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {isSel && <Check size={10} color="#FFFFFF" strokeWidth={3} />}
                </span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
