import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase', () => ({
  supabase: {},
  createClient: () => ({}),
}))

vi.mock('@/repositories/userAdminRepository', () => ({
  suspendCompany: vi.fn(),
}))

import { suspendCompany } from './userAdminService'
import * as repo from '@/repositories/userAdminRepository'

describe('UC77 Suspend Company', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(repo.suspendCompany).mockResolvedValue(undefined as never)
  })

  it('UC77-M-UT: User Admin suspends a company with a reason', async () => {
    await suspendCompany({ company_id: 'comp-1', reason: 'Repeated policy violations' })

    expect(repo.suspendCompany).toHaveBeenCalledWith('comp-1', 'Repeated policy violations')
  })

  it('UC77-A1-UT: User Admin is blocked from confirming the suspension without typing a reason', async () => {
    await expect(suspendCompany({ company_id: 'comp-1', reason: '' }))
      .rejects.toThrow('Suspension reason is required')
    expect(repo.suspendCompany).not.toHaveBeenCalled()
  })
})
