'use client'

// Canonical animated counter — lifted from src/app/owner/team/page.tsx. `suffix` is an additive,
// backward-compatible prop (defaults to '' so existing call sites render unchanged) to also cover
// other pages' variant that appends a unit/suffix string. Do not redesign here.

import { useState, useEffect, useRef } from 'react'

export default function AnimatedNumber({ value, duration = 550, suffix = '' }: { value: number; duration?: number; suffix?: string }) {
  const [display, setDisplay] = useState(value)
  const prevRef = useRef(value)
  const rafRef = useRef<number | null>(null)

  useEffect(() => {
    const from = prevRef.current
    const to = value
    if (from === to) return
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    const start = performance.now()
    const tick = (now: number) => {
      const t = Math.min((now - start) / duration, 1)
      const eased = 1 - (1 - t) ** 3
      setDisplay(Math.round(from + (to - from) * eased))
      if (t < 1) rafRef.current = requestAnimationFrame(tick)
      else prevRef.current = to
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [value, duration])

  return <>{display.toLocaleString()}{suffix}</>
}
