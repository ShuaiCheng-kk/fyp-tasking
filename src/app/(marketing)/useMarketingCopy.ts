'use client'

import { useEffect, useMemo, useState } from 'react'
import type { MarketingPage } from '@/types/MarketingPage'

// Pass `initialPage` when the caller already fetched the page server-side (see
// industries/page.tsx for the pattern) — this skips the client fetch entirely, so there's no
// loading state and no flash on first paint. Omit it for the normal client-only fetch behavior.
export function useMarketingCopy(slug: string, initialPage?: MarketingPage | null) {
  const hasInitialPage = initialPage !== undefined
  const [page, setPage] = useState<MarketingPage | null>(initialPage ?? null)
  const [loading, setLoading] = useState(!hasInitialPage)

  useEffect(() => {
    if (hasInitialPage) return

    let cancelled = false
    setLoading(true)

    async function loadPage() {
      try {
        const response = await fetch(`/api/marketing/pages?slug=${encodeURIComponent(slug)}`)
        const data = await response.json()
        if (!cancelled && data.success && data.page) setPage(data.page)
      } catch {
        if (!cancelled) setPage(null)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    loadPage()
    return () => { cancelled = true }
  }, [slug, hasInitialPage])

  const blocks = useMemo(() => {
    const map: Record<string, string> = {}
    for (const block of page?.blocks ?? []) map[block.block_key] = block.value
    return map
  }, [page])

  // Returns the text value for a block key, falling back to the provided default
  const copy = (key: string, fallback: string) => blocks[key] || fallback

  copy.visible = (sectionKey: string) => (blocks[`section.${sectionKey}.visible`] ?? 'true') !== 'false'

  // True until the first fetch resolves (success or failure) — use to render a stable-height
  // skeleton instead of nothing for sections built from copy.keys(), avoiding a layout jump.
  copy.loading = loading

  // Returns all block keys that match prefix + suffix (e.g. 'feature.', '.name')
  copy.keys = (prefix: string, suffix: string) =>
    (page?.blocks ?? [])
      .filter(b => b.block_key.startsWith(prefix) && b.block_key.endsWith(suffix))
      .sort((a, b) => a.sort_order - b.sort_order)
      .map(b => b.block_key.slice(prefix.length, b.block_key.length - suffix.length))

  return copy
}
