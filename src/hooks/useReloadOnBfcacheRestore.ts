'use client'

import { useEffect } from 'react'

// BUG-078: after signing out, pressing the browser Back button could land on a protected page's
// last-rendered state (sidebar, data, everything) instead of bouncing to /signin — the browser's
// back/forward cache (bfcache) restores the page exactly as it was frozen, without re-running the
// mount effects a role layout's auth guard relies on. `pageshow` with `event.persisted === true` is
// how a bfcache restore is detected; forcing a full reload re-runs the guard from scratch.
export function useReloadOnBfcacheRestore(): void {
  useEffect(() => {
    const handlePageShow = (e: PageTransitionEvent) => {
      if (e.persisted) window.location.reload()
    }
    window.addEventListener('pageshow', handlePageShow)
    return () => window.removeEventListener('pageshow', handlePageShow)
  }, [])
}
