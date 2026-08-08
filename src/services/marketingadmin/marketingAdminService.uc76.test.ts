import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabaseAdmin', () => ({
  getSupabaseAdmin: () => ({}),
}))

vi.mock('@/lib/supabase', () => ({
  supabase: {},
  createClient: () => ({}),
}))

vi.mock('@/repositories/marketingadmin/marketingAdminRepository', () => ({
  marketingAdminRepository: {
    findAdminByAuthId: vi.fn(),
    listMarketingPages: vi.fn(),
    getMarketingPageBySlug: vi.fn(),
  },
}))

import { marketingAdminService } from './marketingAdminService'
import { marketingAdminRepository } from '@/repositories/marketingadmin/marketingAdminRepository'

describe('UC76 Edit Marketing Page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(marketingAdminRepository.findAdminByAuthId).mockResolvedValue({ id: 'madmin-1', role: 'Marketing Admin' } as never)
  })

  it('UC76-M-UT-1: Marketing Admin opens the dashboard and sees the list of marketing pages', async () => {
    vi.mocked(marketingAdminRepository.listMarketingPages).mockResolvedValue([
      { id: 'page-1', slug: 'home', title: 'Home' },
      { id: 'page-2', slug: 'pricing', title: 'Pricing' },
    ] as never)

    const result = await marketingAdminService.listMarketingPages('madmin-1')

    expect(result).toHaveLength(2)
    expect(result.map(p => p.slug)).toEqual(['home', 'pricing'])
  })

  it('UC76-M-UT-2: Marketing Admin clicks a page and its content blocks load', async () => {
    vi.mocked(marketingAdminRepository.getMarketingPageBySlug).mockResolvedValue({
      id: 'page-1', slug: 'home', title: 'Home', is_editable: true, content_blocks: [{ id: 'block-1', block_key: 'hero_title', value: 'Welcome' }],
    } as never)

    const result = await marketingAdminService.getMarketingPageForAdmin('madmin-1', 'home')

    expect(result).toMatchObject({ slug: 'home', content_blocks: [{ block_key: 'hero_title', value: 'Welcome' }] })
  })

  it('UC76-BR-UT-1: A non-Marketing-Admin user is blocked from accessing the dashboard', async () => {
    vi.mocked(marketingAdminRepository.findAdminByAuthId).mockResolvedValue({ id: 'owner-1', role: 'Owner' } as never)

    await expect(marketingAdminService.listMarketingPages('owner-1'))
      .rejects.toThrow('Marketing Admin access required')
  })

  it('UC76-BR-UT-2: A page that is not editable cannot be opened for editing', async () => {
    vi.mocked(marketingAdminRepository.getMarketingPageBySlug).mockResolvedValue({
      id: 'page-3', slug: 'legacy', title: 'Legacy', is_editable: false, content_blocks: [],
    } as never)

    await expect(marketingAdminService.getMarketingPageForAdmin('madmin-1', 'legacy'))
      .rejects.toThrow('Editable marketing page not found')
  })
})
