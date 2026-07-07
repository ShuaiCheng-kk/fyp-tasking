// LAYER: Service
// RULE: Business logic only. No HTTP handling. No direct DB access.

import { marketingRepository } from '@/repositories/marketing/marketingRepository'
import { MarketingPage } from '@/types/MarketingPage'

export const marketingService = {
  async getPublicMarketingPage(slug: string): Promise<MarketingPage | null> {
    const page = await marketingRepository.getMarketingPageBySlug(slug)
    if (!page || !page.is_editable) return null
    return page
  },
}
