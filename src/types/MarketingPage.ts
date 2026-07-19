export type MarketingContentBlockType = 'text' | 'textarea' | 'list' | 'image'

export interface MarketingContentBlock {
  id: string
  page_id: string
  block_key: string
  block_type: MarketingContentBlockType
  label: string
  value: string
  sort_order: number
}

export interface MarketingPage {
  id: string
  slug: string
  title: string
  route_path: string
  is_editable: boolean
  blocks: MarketingContentBlock[]
}

export interface MarketingPageSummary {
  id: string
  slug: string
  title: string
  route_path: string
  is_editable: boolean
  block_count: number
}

export interface UpdateMarketingContentBlockInput {
  block_id: string
  value: string
}

export interface CreateMarketingContentBlockInput {
  page_id: string
  block_key: string
  block_type: MarketingContentBlockType
  label: string
  value: string
  sort_order: number
}
