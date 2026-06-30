'use client'

import { useEffect, useMemo, useState } from 'react'
import type { MarketingPage } from '@/types/MarketingPage'

export function useMarketingCopy(slug: string) {
  const [page, setPage] = useState<MarketingPage | null>(null)

  useEffect(() => {
    let cancelled = false

    async function loadPage() {
      try {
        const response = await fetch(`/api/marketing/pages?slug=${encodeURIComponent(slug)}`)
        const data = await response.json()
        if (!cancelled && data.success && data.page) setPage(data.page)
      } catch {
        if (!cancelled) setPage(null)
      }
    }

    loadPage()
    return () => { cancelled = true }
  }, [slug])

  const blocks = useMemo(() => {
    const map: Record<string, string> = {}
    for (const block of page?.blocks ?? []) map[block.block_key] = block.value
    return map
  }, [page])

  // Returns the text value for a block key, falling back to the provided default
  const copy = (key: string, fallback: string) => blocks[key] || fallback

  copy.visible = (sectionKey: string) => (blocks[`section.${sectionKey}.visible`] ?? 'true') !== 'false'

  // Returns all block keys that match prefix + suffix (e.g. 'feature.', '.name')
  copy.keys = (prefix: string, suffix: string) =>
    (page?.blocks ?? [])
      .filter(b => b.block_key.startsWith(prefix) && b.block_key.endsWith(suffix))
      .sort((a, b) => a.sort_order - b.sort_order)
      .map(b => b.block_key.slice(prefix.length, b.block_key.length - suffix.length))

  return copy
}
