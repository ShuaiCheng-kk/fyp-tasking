import { marketingRepository } from '@/repositories/marketing/marketingRepository'
import { CreateMarketingContentBlockInput, MarketingContentBlock, MarketingPage, MarketingPageSummary, UpdateMarketingContentBlockInput } from '@/types/MarketingPage'

const MARKETING_ADMIN_ROLE = 'Marketing Admin'

export const marketingService = {
  async verifyMarketingAdmin(admin_user_id: string): Promise<void> {
    const admin = await marketingRepository.findAdminByAuthId(admin_user_id)
    if (!admin || admin.role !== MARKETING_ADMIN_ROLE) {
      throw new Error('Marketing Admin access required')
    }
  },

  async listMarketingPages(admin_user_id: string): Promise<MarketingPageSummary[]> {
    await marketingService.verifyMarketingAdmin(admin_user_id)
    return marketingRepository.listMarketingPages()
  },

  async getMarketingPageForAdmin(admin_user_id: string, slug: string): Promise<MarketingPage> {
    await marketingService.verifyMarketingAdmin(admin_user_id)
    const page = await marketingRepository.getMarketingPageBySlug(slug)
    if (!page || !page.is_editable) throw new Error('Editable marketing page not found')
    return page
  },

  async updateMarketingContentBlock(admin_user_id: string, input: UpdateMarketingContentBlockInput): Promise<MarketingContentBlock> {
    await marketingService.verifyMarketingAdmin(admin_user_id)

    const block = await marketingRepository.getMarketingBlock(input.block_id)
    if (!block) throw new Error('Content block not found')

    const page = await marketingRepository.getMarketingPageById(block.page_id)
    if (!page || !page.is_editable) throw new Error('Editable marketing page not found')

    return marketingRepository.updateMarketingContentBlock(input.block_id, input.value.trim())
  },

  async getPublicMarketingPage(slug: string): Promise<MarketingPage | null> {
    const page = await marketingRepository.getMarketingPageBySlug(slug)
    if (!page || !page.is_editable) return null
    return page
  },

  async createMarketingContentBlock(admin_user_id: string, input: CreateMarketingContentBlockInput): Promise<MarketingContentBlock> {
    await marketingService.verifyMarketingAdmin(admin_user_id)
    const page = await marketingRepository.getMarketingPageById(input.page_id)
    if (!page || !page.is_editable) throw new Error('Editable marketing page not found')
    return marketingRepository.createMarketingContentBlock(input)
  },

  async deleteMarketingContentBlock(admin_user_id: string, block_id: string): Promise<void> {
    await marketingService.verifyMarketingAdmin(admin_user_id)
    const block = await marketingRepository.getMarketingBlock(block_id)
    if (!block) throw new Error('Content block not found')
    const page = await marketingRepository.getMarketingPageById(block.page_id)
    if (!page || !page.is_editable) throw new Error('Editable marketing page not found')
    await marketingRepository.deleteMarketingContentBlock(block_id)
  },
}
