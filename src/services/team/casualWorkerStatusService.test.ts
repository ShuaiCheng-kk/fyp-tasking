import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase', () => ({
  supabase: {},
  createClient: () => ({}),
}))

vi.mock('@/repositories/team/casualWorkerStatusRepository', () => ({
  casualWorkerStatusRepository: {
    updateStatus: vi.fn(),
    setCompanyBlock: vi.fn(),
    getCompanyJobIds: vi.fn(),
    withdrawPendingApplicationsForJobs: vi.fn(),
  },
}))

import { casualWorkerStatusService } from './casualWorkerStatusService'
import { casualWorkerStatusRepository } from '@/repositories/team/casualWorkerStatusRepository'

describe('casualWorkerStatusService — per-company ban (Team page inactivate/reactivate)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(casualWorkerStatusRepository.getCompanyJobIds).mockResolvedValue(['job-1', 'job-2'])
    vi.mocked(casualWorkerStatusRepository.updateStatus).mockResolvedValue({ id: 'cw-1' })
  })

  it('banning stamps a per-company block and withdraws the worker\'s pending applications to that company', async () => {
    await casualWorkerStatusService.updateStatus({
      user_id: 'cw-1',
      company_id: 'co-1',
      worker_status: 'inactive',
      inactivate_reason: 'Repeated no-shows',
    })

    expect(casualWorkerStatusRepository.setCompanyBlock).toHaveBeenCalledWith(
      'cw-1', 'co-1', expect.any(String), 'Repeated no-shows',
    )
    expect(casualWorkerStatusRepository.getCompanyJobIds).toHaveBeenCalledWith('co-1')
    expect(casualWorkerStatusRepository.withdrawPendingApplicationsForJobs).toHaveBeenCalledWith('cw-1', ['job-1', 'job-2'])
    // Global column mirrored for display surfaces still reading worker_status.
    expect(casualWorkerStatusRepository.updateStatus).toHaveBeenCalledWith('cw-1', 'inactive', 'Repeated no-shows')
  })

  it('reactivating clears the per-company block, the reason, and does not withdraw applications', async () => {
    await casualWorkerStatusService.updateStatus({
      user_id: 'cw-1',
      company_id: 'co-1',
      worker_status: 'active',
      inactivate_reason: 'ignored on reactivate',
    })

    expect(casualWorkerStatusRepository.setCompanyBlock).toHaveBeenCalledWith('cw-1', 'co-1', null, null)
    expect(casualWorkerStatusRepository.getCompanyJobIds).not.toHaveBeenCalled()
    expect(casualWorkerStatusRepository.withdrawPendingApplicationsForJobs).not.toHaveBeenCalled()
    expect(casualWorkerStatusRepository.updateStatus).toHaveBeenCalledWith('cw-1', 'active', null)
  })

  it('returns the mirrored users row from the repository', async () => {
    const updated = { id: 'cw-1', worker_status: 'inactive' }
    vi.mocked(casualWorkerStatusRepository.updateStatus).mockResolvedValue(updated)

    const result = await casualWorkerStatusService.updateStatus({
      user_id: 'cw-1',
      company_id: 'co-1',
      worker_status: 'inactive',
      inactivate_reason: 'Seasonal',
    })

    expect(result).toEqual(updated)
  })
})
