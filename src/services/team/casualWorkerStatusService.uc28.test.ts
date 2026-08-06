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

describe('UC28 Deactivate Casual Worker', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(casualWorkerStatusRepository.setCompanyBlock).mockResolvedValue(undefined as never)
  })

  it('UC28-M-UT-O: Owner sets an active Casual Worker to Inactive with a reason', async () => {
    vi.mocked(casualWorkerStatusRepository.getCompanyJobIds).mockResolvedValue(['job-10'])
    vi.mocked(casualWorkerStatusRepository.withdrawPendingApplicationsForJobs).mockResolvedValue(undefined as never)

    await casualWorkerStatusService.updateStatus({
      user_id: 'cw-10', company_id: 'comp-1', worker_status: 'inactive', inactivate_reason: 'Repeated no-shows',
    })

    expect(casualWorkerStatusRepository.setCompanyBlock).toHaveBeenCalledWith(
      'cw-10', 'comp-1', expect.any(String), 'Repeated no-shows',
    )
    expect(casualWorkerStatusRepository.withdrawPendingApplicationsForJobs).toHaveBeenCalledWith('cw-10', ['job-10'])
  })

  it('UC28-M-UT-P: Partner sets an active Casual Worker to Inactive with a reason', async () => {
    vi.mocked(casualWorkerStatusRepository.getCompanyJobIds).mockResolvedValue(['job-11'])
    vi.mocked(casualWorkerStatusRepository.withdrawPendingApplicationsForJobs).mockResolvedValue(undefined as never)

    await casualWorkerStatusService.updateStatus({
      user_id: 'cw-11', company_id: 'comp-1', worker_status: 'inactive', inactivate_reason: 'On extended leave',
    })

    expect(casualWorkerStatusRepository.setCompanyBlock).toHaveBeenCalledWith(
      'cw-11', 'comp-1', expect.any(String), 'On extended leave',
    )
    expect(casualWorkerStatusRepository.withdrawPendingApplicationsForJobs).toHaveBeenCalledWith('cw-11', ['job-11'])
  })

  it('UC28-BR-UT-O: Owner is blocked from setting a Casual Worker to Inactive without a reason', async () => {
    await expect(casualWorkerStatusService.updateStatus({
      user_id: 'cw-12', company_id: 'comp-1', worker_status: 'inactive', inactivate_reason: '   ',
    })).rejects.toThrow('A reason is required to inactivate this Casual Worker.')

    expect(casualWorkerStatusRepository.setCompanyBlock).not.toHaveBeenCalled()
  })
})
