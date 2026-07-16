'use client'

import { useEffect, useState } from 'react'

// Tracks whether the window is narrower than a breakpoint so pages can switch
// a multi-column inline-style grid to a single stacked column. SSR-safe:
// starts `false` (desktop) so there's no layout flash before hydration.
export function useIsCompactViewport(breakpoint: number) {
  const [isCompact, setIsCompact] = useState(false)

  useEffect(() => {
    const check = () => setIsCompact(window.innerWidth < breakpoint)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [breakpoint])

  return isCompact
}
