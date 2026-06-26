export type MarketingContentBlockType = 'text' | 'textarea' | 'list' | 'image'

export interface MarketingContentBlock {
  id: string
  page_id: string
  block_key: string
  block_type: MarketingContentBlockType
  label: string
  value: string
  sort_order: number
  updated_at: string
}

export interface MarketingPage {
  id: string
  slug: string
  title: string
  route_path: string
  is_editable: boolean
  created_at: string
  updated_at: string
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
