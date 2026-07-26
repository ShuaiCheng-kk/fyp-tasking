'use client'

import { useCallback, useLayoutEffect, useRef, useState } from 'react'

// Generic pill-style tab bar with a sliding active indicator — shared by AttendanceView's
// Records/Swap Requests/Off Day tabs and ShiftsView's Manager-only merged Shift page tabs.
export function CapsuleTabBar<T extends string>({
  tabs,
  active,
  onChange,
}: {
  tabs: { key: T; label: string; count?: number; dot?: boolean }[]
  active: T
  onChange: (key: T) => void
}) {
  const barRef = useRef<HTMLDivElement>(null)
  const btnRefs = useRef<Record<string, HTMLButtonElement | null>>({})
  const [indicator, setIndicator] = useState({ left: 0, width: 0, opacity: 0 })

  const measure = useCallback(() => {
    const container = barRef.current
    const btn = btnRefs.current[active]
    if (!container || !btn) return
    const cr = container.getBoundingClientRect()
    const br = btn.getBoundingClientRect()
    setIndicator({ left: br.left - cr.left, width: br.width, opacity: 1 })
  }, [active])

  // A tab's width changes after mount (count/dot appearing once data loads, fonts swapping in),
  // so the indicator must track button resizes — measuring only on `active` leaves it misaligned
  // when the user switches tabs before the Requests data has finished loading.
  const tabSignature = tabs.map(t => `${t.key}:${t.label}:${t.count ?? ''}:${t.dot ? 1 : 0}`).join('|')
  useLayoutEffect(() => { measure() }, [measure, tabSignature])
  useLayoutEffect(() => {
    const observed: Element[] = [barRef.current, ...Object.values(btnRefs.current)].filter((el): el is HTMLButtonElement | HTMLDivElement => !!el)
    const ro = new ResizeObserver(() => measure())
    observed.forEach(el => ro.observe(el))
    return () => ro.disconnect()
  }, [measure])

  return (
    <div
      ref={barRef}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: 4, background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: 999, boxShadow: '0 1px 4px rgba(0,0,0,0.05)', position: 'relative' }}
    >
      <span
        aria-hidden="true"
        style={{
          position: 'absolute', top: 4, left: indicator.left, width: indicator.width,
          height: 'calc(100% - 8px)', borderRadius: 999,
          background: 'linear-gradient(180deg, #0F172A 0%, #111827 100%)',
          boxShadow: '0 6px 18px rgba(15,23,42,0.18)',
          opacity: indicator.opacity,
          transform: indicator.opacity ? 'translateY(0)' : 'translateY(4px)',
          transition: 'left 0.24s cubic-bezier(0.22,1,0.36,1), width 0.24s cubic-bezier(0.22,1,0.36,1), opacity 0.16s ease',
          pointerEvents: 'none',
        }}
      />
      {tabs.map(tab => {
        const isActive = active === tab.key
        return (
          <button
            key={tab.key}
            ref={el => { btnRefs.current[tab.key] = el }}
            onClick={() => onChange(tab.key)}
            style={{
              position: 'relative', zIndex: 1, height: 36, padding: '0 18px',
              border: 'none', borderRadius: 999, fontWeight: 700, fontSize: 13, cursor: 'pointer',
              background: 'transparent', color: isActive ? '#FFFFFF' : '#64748B',
              display: 'inline-flex', alignItems: 'center', gap: 8,
              transition: 'color 0.18s ease',
              transform: isActive ? 'translateY(-0.5px)' : 'translateY(0)',
            }}
          >
            {tab.label}
            {tab.count !== undefined && tab.count > 0 && (
              <span style={{ minWidth: 22, height: 22, padding: '0 7px', borderRadius: 999, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: isActive ? 'rgba(255,255,255,0.16)' : '#F1F5F9', color: isActive ? '#FFFFFF' : '#64748B', fontSize: 11, fontWeight: 900 }}>
                {tab.count}
              </span>
            )}
            {tab.dot && (
              <span style={{ width: 10, height: 10, borderRadius: 999, background: '#EF4444', flexShrink: 0, border: isActive ? '1.5px solid #111827' : '1.5px solid #fff' }} />
            )}
          </button>
        )
      })}
    </div>
  )
}
