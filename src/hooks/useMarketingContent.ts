'use client'

import { useEffect, useState } from 'react'

interface BlockMap { [key: string]: string }

interface MarketingContent {
  get: (key: string, fallback: string) => string
  visible: (sectionKey: string) => boolean
  ready: boolean
}

export function useMarketingContent(slug: string): MarketingContent {
  const [blocks, setBlocks] = useState<BlockMap>({})
  const [ready, setReady] = useState(false)

  useEffect(() => {
    fetch(`/api/marketing/pages?slug=${slug}`)
      .then(r => r.json())
      .then(d => {
        if (d.success && d.page?.blocks) {
          const map: BlockMap = {}
          for (const b of d.page.blocks) map[b.block_key] = b.value
          setBlocks(map)
        }
      })
      .catch(() => {})
      .finally(() => setReady(true))
  }, [slug])

  return {
    get: (key, fallback) => blocks[key] ?? fallback,
    // block_key pattern: section.<name>.visible, value 'true'/'false'
    visible: (sectionKey) => (blocks[`section.${sectionKey}.visible`] ?? 'true') !== 'false',
    ready,
  }
}
