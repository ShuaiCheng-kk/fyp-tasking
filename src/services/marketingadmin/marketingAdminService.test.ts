import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase', () => ({
  supabase: {},
  createClient: () => ({}),
}))

vi.mock('@/repositories/marketingadmin/marketingAdminRepository', () => ({
  marketingAdminRepository: {
    findAdminByAuthId: vi.fn(),
    listMarketingPages: vi.fn(),
    getMarketingPageBySlug: vi.fn(),
    getMarketingPageById: vi.fn(),
    getMarketingBlock: vi.fn(),
    reorderMarketingContentBlocks: vi.fn(),
    updateMarketingContentBlock: vi.fn(),
    createMarketingContentBlock: vi.fn(),
    deleteMarketingContentBlock: vi.fn(),
    uploadMedia: vi.fn(),
  },
}))

import { marketingAdminService } from './marketingAdminService'
import { marketingAdminRepository } from '@/repositories/marketingadmin/marketingAdminRepository'

const marketingAdmin = { id: 'admin-1', full_name: 'Marketing Admin', email_address: 'ma@test.com', role: 'Marketing Admin' }
const editablePage = {
  id: 'page-1', slug: 'about', title: 'About', route_path: '/about', is_editable: true, blocks: [],
}
const nonEditablePage = { ...editablePage, id: 'page-2', slug: 'auto-generated', is_editable: false }
const block = { id: 'block-1', page_id: 'page-1', block_key: 'hero_title', block_type: 'text' as const, label: 'Hero Title', value: 'Old', sort_order: 0 }

describe('marketingAdminService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('verifyMarketingAdmin (UC72-74 access gate)', () => {
    it('throws when no user is found for the given auth id', async () => {
      vi.mocked(marketingAdminRepository.findAdminByAuthId).mockResolvedValue(null)
      await expect(marketingAdminService.verifyMarketingAdmin('missing')).rejects.toThrow('Marketing Admin access required')
    })

    it('throws when the user exists but is not a Marketing Admin', async () => {
      vi.mocked(marketingAdminRepository.findAdminByAuthId).mockResolvedValue({ ...marketingAdmin, role: 'Owner' })
      await expect(marketingAdminService.verifyMarketingAdmin('owner-1')).rejects.toThrow('Marketing Admin access required')
    })

    it('passes for a real Marketing Admin', async () => {
      vi.mocked(marketingAdminRepository.findAdminByAuthId).mockResolvedValue(marketingAdmin)
      await expect(marketingAdminService.verifyMarketingAdmin('admin-1')).resolves.toBeUndefined()
    })
  })

  describe('listMarketingPages (UC72 — View Marketing Page List)', () => {
    it('rejects a non-admin before touching the repository', async () => {
      vi.mocked(marketingAdminRepository.findAdminByAuthId).mockResolvedValue(null)
      await expect(marketingAdminService.listMarketingPages('nobody')).rejects.toThrow('Marketing Admin access required')
      expect(marketingAdminRepository.listMarketingPages).not.toHaveBeenCalled()
    })

    it('returns the page list for a verified admin', async () => {
      vi.mocked(marketingAdminRepository.findAdminByAuthId).mockResolvedValue(marketingAdmin)
      vi.mocked(marketingAdminRepository.listMarketingPages).mockResolvedValue([
        { id: 'page-1', slug: 'about', title: 'About', route_path: '/about', is_editable: true, block_count: 3 },
      ])
      const result = await marketingAdminService.listMarketingPages('admin-1')
      expect(result).toHaveLength(1)
      expect(result[0].block_count).toBe(3)
    })
  })

  describe('getMarketingPageForAdmin (UC73 — Edit Marketing Page)', () => {
    it('returns an editable page', async () => {
      vi.mocked(marketingAdminRepository.findAdminByAuthId).mockResolvedValue(marketingAdmin)
      vi.mocked(marketingAdminRepository.getMarketingPageBySlug).mockResolvedValue(editablePage)
      const result = await marketingAdminService.getMarketingPageForAdmin('admin-1', 'about')
      expect(result).toEqual(editablePage)
    })

    it('rejects a page that does not exist', async () => {
      vi.mocked(marketingAdminRepository.findAdminByAuthId).mockResolvedValue(marketingAdmin)
      vi.mocked(marketingAdminRepository.getMarketingPageBySlug).mockResolvedValue(null)
      await expect(marketingAdminService.getMarketingPageForAdmin('admin-1', 'missing')).rejects.toThrow('Editable marketing page not found')
    })

    it('rejects a page that exists but is not editable', async () => {
      vi.mocked(marketingAdminRepository.findAdminByAuthId).mockResolvedValue(marketingAdmin)
      vi.mocked(marketingAdminRepository.getMarketingPageBySlug).mockResolvedValue(nonEditablePage)
      await expect(marketingAdminService.getMarketingPageForAdmin('admin-1', 'auto-generated')).rejects.toThrow('Editable marketing page not found')
    })
  })

  describe('updateMarketingContentBlock (UC74 — Edit Content Block)', () => {
    it('rejects a non-admin', async () => {
      vi.mocked(marketingAdminRepository.findAdminByAuthId).mockResolvedValue(null)
      await expect(marketingAdminService.updateMarketingContentBlock('nobody', { block_id: 'block-1', value: 'New' }))
        .rejects.toThrow('Marketing Admin access required')
      expect(marketingAdminRepository.updateMarketingContentBlock).not.toHaveBeenCalled()
    })

    it('rejects a block that does not exist', async () => {
      vi.mocked(marketingAdminRepository.findAdminByAuthId).mockResolvedValue(marketingAdmin)
      vi.mocked(marketingAdminRepository.getMarketingBlock).mockResolvedValue(null)
      await expect(marketingAdminService.updateMarketingContentBlock('admin-1', { block_id: 'missing', value: 'New' }))
        .rejects.toThrow('Content block not found')
    })

    it('rejects a block belonging to a non-editable page', async () => {
      vi.mocked(marketingAdminRepository.findAdminByAuthId).mockResolvedValue(marketingAdmin)
      vi.mocked(marketingAdminRepository.getMarketingBlock).mockResolvedValue(block)
      vi.mocked(marketingAdminRepository.getMarketingPageById).mockResolvedValue(nonEditablePage)
      await expect(marketingAdminService.updateMarketingContentBlock('admin-1', { block_id: 'block-1', value: 'New' }))
        .rejects.toThrow('Editable marketing page not found')
    })

    it('trims the value and updates the block', async () => {
      vi.mocked(marketingAdminRepository.findAdminByAuthId).mockResolvedValue(marketingAdmin)
      vi.mocked(marketingAdminRepository.getMarketingBlock).mockResolvedValue(block)
      vi.mocked(marketingAdminRepository.getMarketingPageById).mockResolvedValue(editablePage)
      vi.mocked(marketingAdminRepository.updateMarketingContentBlock).mockResolvedValue({ ...block, value: 'New Title' })

      const result = await marketingAdminService.updateMarketingContentBlock('admin-1', { block_id: 'block-1', value: '  New Title  ' })

      expect(marketingAdminRepository.updateMarketingContentBlock).toHaveBeenCalledWith('block-1', 'New Title')
      expect(result.value).toBe('New Title')
    })
  })

  describe('createMarketingContentBlock', () => {
    it('rejects adding a block to a non-editable page', async () => {
      vi.mocked(marketingAdminRepository.findAdminByAuthId).mockResolvedValue(marketingAdmin)
      vi.mocked(marketingAdminRepository.getMarketingPageById).mockResolvedValue(nonEditablePage)
      await expect(marketingAdminService.createMarketingContentBlock('admin-1', {
        page_id: 'page-2', block_key: 'new_block', block_type: 'text', label: 'New', value: '', sort_order: 0,
      })).rejects.toThrow('Editable marketing page not found')
    })

    it('creates the block on an editable page', async () => {
      vi.mocked(marketingAdminRepository.findAdminByAuthId).mockResolvedValue(marketingAdmin)
      vi.mocked(marketingAdminRepository.getMarketingPageById).mockResolvedValue(editablePage)
      vi.mocked(marketingAdminRepository.createMarketingContentBlock).mockResolvedValue(block)

      const result = await marketingAdminService.createMarketingContentBlock('admin-1', {
        page_id: 'page-1', block_key: 'hero_title', block_type: 'text', label: 'Hero Title', value: '', sort_order: 0,
      })
      expect(result).toEqual(block)
    })
  })

  describe('deleteMarketingContentBlock', () => {
    it('rejects a block that does not exist', async () => {
      vi.mocked(marketingAdminRepository.findAdminByAuthId).mockResolvedValue(marketingAdmin)
      vi.mocked(marketingAdminRepository.getMarketingBlock).mockResolvedValue(null)
      await expect(marketingAdminService.deleteMarketingContentBlock('admin-1', 'missing')).rejects.toThrow('Content block not found')
    })

    it('deletes an existing block on an editable page', async () => {
      vi.mocked(marketingAdminRepository.findAdminByAuthId).mockResolvedValue(marketingAdmin)
      vi.mocked(marketingAdminRepository.getMarketingBlock).mockResolvedValue(block)
      vi.mocked(marketingAdminRepository.getMarketingPageById).mockResolvedValue(editablePage)

      await marketingAdminService.deleteMarketingContentBlock('admin-1', 'block-1')

      expect(marketingAdminRepository.deleteMarketingContentBlock).toHaveBeenCalledWith('block-1')
    })
  })

  describe('reorderMarketingContentBlocks', () => {
    it('rejects a non-admin', async () => {
      vi.mocked(marketingAdminRepository.findAdminByAuthId).mockResolvedValue(null)
      await expect(marketingAdminService.reorderMarketingContentBlocks('nobody', [{ id: 'block-1', sort_order: 1 }]))
        .rejects.toThrow('Marketing Admin access required')
      expect(marketingAdminRepository.reorderMarketingContentBlocks).not.toHaveBeenCalled()
    })

    it('forwards the reorder list to the repository', async () => {
      vi.mocked(marketingAdminRepository.findAdminByAuthId).mockResolvedValue(marketingAdmin)
      const updates = [{ id: 'block-1', sort_order: 1 }, { id: 'block-2', sort_order: 0 }]
      await marketingAdminService.reorderMarketingContentBlocks('admin-1', updates)
      expect(marketingAdminRepository.reorderMarketingContentBlocks).toHaveBeenCalledWith(updates)
    })
  })
})
