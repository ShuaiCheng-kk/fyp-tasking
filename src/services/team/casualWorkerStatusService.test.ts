import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase', () => ({
  supabase: {},
  createClient: () => ({}),
}))

vi.mock('@/repositories/team/casualWorkerStatusRepository', () => ({
  casualWorkerStatusRepository: {
    updateStatus: vi.fn(),
  },
}))

import { casualWorkerStatusService } from './casualWorkerStatusService'
import { casualWorkerStatusRepository } from '@/repositories/team/casualWorkerStatusRepository'

describe('casualWorkerStatusService — Activate/Deactivate Casual Worker (UC29)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('clears the inactivate_reason when activating', async () => {
    vi.mocked(casualWorkerStatusRepository.updateStatus).mockResolvedValue({ id: 'cw-1', worker_status: 'active' })

    await casualWorkerStatusService.updateStatus({
      user_id: 'cw-1',
      worker_status: 'active',
      inactivate_reason: 'No longer needed',
    })

    expect(casualWorkerStatusRepository.updateStatus).toHaveBeenCalledWith('cw-1', 'active', null)
  })

  it('keeps the inactivate_reason when deactivating', async () => {
    vi.mocked(casualWorkerStatusRepository.updateStatus).mockResolvedValue({ id: 'cw-1', worker_status: 'inactive' })

    await casualWorkerStatusService.updateStatus({
      user_id: 'cw-1',
      worker_status: 'inactive',
      inactivate_reason: 'No longer needed',
    })

    expect(casualWorkerStatusRepository.updateStatus).toHaveBeenCalledWith('cw-1', 'inactive', 'No longer needed')
  })

  it('returns the repository result', async () => {
    const updated = { id: 'cw-1', worker_status: 'inactive', inactivate_reason: 'Seasonal' }
    vi.mocked(casualWorkerStatusRepository.updateStatus).mockResolvedValue(updated)

    const result = await casualWorkerStatusService.updateStatus({
      user_id: 'cw-1',
      worker_status: 'inactive',
      inactivate_reason: 'Seasonal',
    })

    expect(result).toEqual(updated)
  })
})
