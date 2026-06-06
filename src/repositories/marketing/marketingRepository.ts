import { supabase } from '@/lib/supabase'
import { MarketingContentBlock, MarketingPage, MarketingPageSummary } from '@/types/MarketingPage'

type MarketingPageRow = Omit<MarketingPage, 'blocks'>
type MarketingPageListRow = Pick<MarketingPage, 'id' | 'slug' | 'title' | 'route_path' | 'is_editable'> & {
  marketing_content_blocks?: { id: string }[] | null
}

function mapPage(row: MarketingPageRow, blocks: MarketingContentBlock[]): MarketingPage {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    route_path: row.route_path,
    is_editable: row.is_editable,
    created_at: row.created_at,
    updated_at: row.updated_at,
    blocks,
  }
}

export const marketingRepository = {
  async findAdminByAuthId(supabase_auth_id: string): Promise<{ id: string; full_name: string; email_address: string; role: string } | null> {
    const { data, error } = await supabase
      .from('users')
      .select('id, full_name, email_address, role')
      .eq('supabase_auth_id', supabase_auth_id)
      .single()

    if (error || !data) return null
    return data
  },

  async listMarketingPages(): Promise<MarketingPageSummary[]> {
    const { data: pages, error } = await supabase
      .from('marketing_pages')
      .select('id, slug, title, route_path, is_editable, marketing_content_blocks(id)')
      .eq('is_editable', true)
      .order('title', { ascending: true })

    if (error) throw new Error(error.message)

    return ((pages ?? []) as MarketingPageListRow[]).map(page => ({
      id: page.id,
      slug: page.slug,
      title: page.title,
      route_path: page.route_path,
      is_editable: page.is_editable,
      block_count: Array.isArray(page.marketing_content_blocks) ? page.marketing_content_blocks.length : 0,
    }))
  },

  async getMarketingPageBySlug(slug: string): Promise<MarketingPage | null> {
    const { data: page, error: pageError } = await supabase
      .from('marketing_pages')
      .select('id, slug, title, route_path, is_editable, created_at, updated_at')
      .eq('slug', slug)
      .single()

    if (pageError || !page) return null

    const { data: blocks, error: blocksError } = await supabase
      .from('marketing_content_blocks')
      .select('id, page_id, block_key, block_type, label, value, sort_order, updated_at')
      .eq('page_id', page.id)
      .order('sort_order', { ascending: true })

    if (blocksError) throw new Error(blocksError.message)
    return mapPage(page, (blocks ?? []) as MarketingContentBlock[])
  },

  async getMarketingPageById(page_id: string): Promise<MarketingPage | null> {
    const { data: page, error: pageError } = await supabase
      .from('marketing_pages')
      .select('id, slug, title, route_path, is_editable, created_at, updated_at')
      .eq('id', page_id)
      .single()

    if (pageError || !page) return null

    const { data: blocks, error: blocksError } = await supabase
      .from('marketing_content_blocks')
      .select('id, page_id, block_key, block_type, label, value, sort_order, updated_at')
      .eq('page_id', page.id)
      .order('sort_order', { ascending: true })

    if (blocksError) throw new Error(blocksError.message)
    return mapPage(page, (blocks ?? []) as MarketingContentBlock[])
  },

  async getMarketingBlock(block_id: string): Promise<MarketingContentBlock | null> {
    const { data, error } = await supabase
      .from('marketing_content_blocks')
      .select('id, page_id, block_key, block_type, label, value, sort_order, updated_at')
      .eq('id', block_id)
      .single()

    if (error || !data) return null
    return data as MarketingContentBlock
  },

  async updateMarketingContentBlock(block_id: string, value: string): Promise<MarketingContentBlock> {
    const { data, error } = await supabase
      .from('marketing_content_blocks')
      .update({ value, updated_at: new Date().toISOString() })
      .eq('id', block_id)
      .select('id, page_id, block_key, block_type, label, value, sort_order, updated_at')
      .single()

    if (error) throw new Error(error.message)
    return data as MarketingContentBlock
  },
}
