// LAYER: Service
// RULE: Business logic only. No HTTP handling. No direct DB access.

import { marketingAdminRepository } from '@/repositories/marketingadmin/marketingAdminRepository'
import { CreateMarketingContentBlockInput, MarketingContentBlock, MarketingPage, MarketingPageSummary, UpdateMarketingContentBlockInput } from '@/types/MarketingPage'

const MARKETING_ADMIN_ROLE = 'Marketing Admin'

export const marketingAdminService = {
  async verifyMarketingAdmin(admin_user_id: string): Promise<void> {
    const admin = await marketingAdminRepository.findAdminByAuthId(admin_user_id)
    if (!admin || admin.role !== MARKETING_ADMIN_ROLE) {
      throw new Error('Marketing Admin access required')
    }
  },

  async listMarketingPages(admin_user_id: string): Promise<MarketingPageSummary[]> {
    await marketingAdminService.verifyMarketingAdmin(admin_user_id)
    return marketingAdminRepository.listMarketingPages()
  },

  async getMarketingPageForAdmin(admin_user_id: string, slug: string): Promise<MarketingPage> {
    await marketingAdminService.verifyMarketingAdmin(admin_user_id)
    const page = await marketingAdminRepository.getMarketingPageBySlug(slug)
    if (!page || !page.is_editable) throw new Error('Editable marketing page not found')
    return page
  },

  async reorderMarketingContentBlocks(admin_user_id: string, updates: { id: string; sort_order: number }[]): Promise<void> {
    await marketingAdminService.verifyMarketingAdmin(admin_user_id)
    await marketingAdminRepository.reorderMarketingContentBlocks(updates)
  },

  async updateMarketingContentBlock(admin_user_id: string, input: UpdateMarketingContentBlockInput): Promise<MarketingContentBlock> {
    await marketingAdminService.verifyMarketingAdmin(admin_user_id)
    const block = await marketingAdminRepository.getMarketingBlock(input.block_id)
    if (!block) throw new Error('Content block not found')
    const page = await marketingAdminRepository.getMarketingPageById(block.page_id)
    if (!page || !page.is_editable) throw new Error('Editable marketing page not found')
    return marketingAdminRepository.updateMarketingContentBlock(input.block_id, input.value.trim())
  },

  async createMarketingContentBlock(admin_user_id: string, input: CreateMarketingContentBlockInput): Promise<MarketingContentBlock> {
    await marketingAdminService.verifyMarketingAdmin(admin_user_id)
    const page = await marketingAdminRepository.getMarketingPageById(input.page_id)
    if (!page || !page.is_editable) throw new Error('Editable marketing page not found')
    return marketingAdminRepository.createMarketingContentBlock(input)
  },

  async deleteMarketingContentBlock(admin_user_id: string, block_id: string): Promise<void> {
    await marketingAdminService.verifyMarketingAdmin(admin_user_id)
    const block = await marketingAdminRepository.getMarketingBlock(block_id)
    if (!block) throw new Error('Content block not found')
    const page = await marketingAdminRepository.getMarketingPageById(block.page_id)
    if (!page || !page.is_editable) throw new Error('Editable marketing page not found')
    await marketingAdminRepository.deleteMarketingContentBlock(block_id)
  },

  async uploadMedia(admin_user_id: string, block_key: string, file: File): Promise<{ publicUrl: string }> {
    await marketingAdminService.verifyMarketingAdmin(admin_user_id)
    return marketingAdminRepository.uploadMedia(block_key, file)
  },
}
