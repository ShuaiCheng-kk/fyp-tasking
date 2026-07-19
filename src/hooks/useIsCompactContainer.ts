'use client'

import { useCallback, useEffect, useState } from 'react'

// Container-width counterpart to useIsCompactViewport: some panels (e.g. one of several
// side-by-side columns in a flex/grid row) don't get anywhere near the full window width, so
// gating their internal compact behavior (icon-only buttons, truncated labels) on
// window.innerWidth is wrong — the panel can be squeezed at any window width, or never be
// squeezed even below a viewport breakpoint, depending on how many siblings share the row.
// This measures the panel's own rendered width via ResizeObserver instead.
//
// Uses a callback ref (not a plain useRef) because the panel this measures is typically
// conditionally rendered (e.g. only once a job/record is selected) — a plain ref would still be
// null when the mount-only effect ran, and since the effect never re-runs, the observer would
// never attach once the panel actually appeared.
export function useIsCompactContainer<T extends HTMLElement>(breakpoint: number) {
  const [node, setNode] = useState<T | null>(null)
  const ref = useCallback((el: T | null) => setNode(el), [])
  const [isCompact, setIsCompact] = useState(false)

  useEffect(() => {
    if (!node) return
    const check = () => setIsCompact(node.clientWidth < breakpoint)
    check()
    const observer = new ResizeObserver(check)
    observer.observe(node)
    return () => observer.disconnect()
  }, [node, breakpoint])

  return [ref, isCompact] as const
}
