import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase', () => ({
  supabase: {},
  createClient: () => ({}),
}))

vi.mock('@/repositories/team/casualWorkerStatusRepository', () => ({
  casualWorkerStatusRepository: {
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
  })
})
