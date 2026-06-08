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
    return () => {
      cancelled = true
    }
  }, [slug])

  const blocks = useMemo(() => {
    const map: Record<string, string> = {}
    for (const block of page?.blocks ?? []) map[block.block_key] = block.value
    return map
  }, [page])

  return (key: string, fallback: string) => blocks[key] || fallback
}
