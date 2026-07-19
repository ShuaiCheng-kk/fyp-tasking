// LAYER: Repository
// RULE: Supabase queries only. No business logic. No HTTP handling.

import { supabase } from '@/lib/supabase'
import { MarketingContentBlock, MarketingPage } from '@/types/MarketingPage'

type MarketingPageRow = Omit<MarketingPage, 'blocks'>

function mapPage(row: MarketingPageRow, blocks: MarketingContentBlock[]): MarketingPage {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    route_path: row.route_path,
    is_editable: row.is_editable,
    blocks,
  }
}

export const marketingRepository = {
  async getMarketingPageBySlug(slug: string): Promise<MarketingPage | null> {
    const { data: page, error: pageError } = await supabase
      .from('marketing_pages')
      .select('id, slug, title, route_path, is_editable')
      .eq('slug', slug)
      .single()

    if (pageError || !page) return null

    const { data: blocks, error: blocksError } = await supabase
      .from('marketing_content_blocks')
      .select('id, page_id, block_key, block_type, label, value, sort_order')
      .eq('page_id', page.id)
      .order('sort_order', { ascending: true })

    if (blocksError) throw new Error(blocksError.message)
    return mapPage(page, (blocks ?? []) as MarketingContentBlock[])
  },
}
