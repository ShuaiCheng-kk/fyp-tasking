import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabaseAdmin', () => ({
  getSupabaseAdmin: () => ({}),
}))

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

describe('UC27 Activate Casual Worker', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(casualWorkerStatusRepository.setCompanyBlock).mockResolvedValue(undefined as never)
  })

  it('UC27-M-UT-O: Owner sets an inactive Casual Worker back to Active', async () => {
    await casualWorkerStatusService.updateStatus({
      user_id: 'cw-1', company_id: 'comp-1', worker_status: 'active', inactivate_reason: null,
    })

    expect(casualWorkerStatusRepository.setCompanyBlock).toHaveBeenCalledWith('cw-1', 'comp-1', null, null)
    expect(casualWorkerStatusRepository.getCompanyJobIds).not.toHaveBeenCalled()
  })

  it('UC27-M-UT-P: Partner sets an inactive Casual Worker back to Active', async () => {
    await casualWorkerStatusService.updateStatus({
      user_id: 'cw-2', company_id: 'comp-1', worker_status: 'active', inactivate_reason: null,
    })

    expect(casualWorkerStatusRepository.setCompanyBlock).toHaveBeenCalledWith('cw-2', 'comp-1', null, null)
    expect(casualWorkerStatusRepository.getCompanyJobIds).not.toHaveBeenCalled()
  })

  it('UC27-A1-UT-O: Owner sets an active Casual Worker to Inactive with a reason', async () => {
    vi.mocked(casualWorkerStatusRepository.getCompanyJobIds).mockResolvedValue(['job-1'])
    vi.mocked(casualWorkerStatusRepository.withdrawPendingApplicationsForJobs).mockResolvedValue(undefined as never)

    await casualWorkerStatusService.updateStatus({
      user_id: 'cw-3', company_id: 'comp-1', worker_status: 'inactive', inactivate_reason: 'No longer available',
    })

    expect(casualWorkerStatusRepository.setCompanyBlock).toHaveBeenCalledWith(
      'cw-3', 'comp-1', expect.any(String), 'No longer available',
    )
    expect(casualWorkerStatusRepository.withdrawPendingApplicationsForJobs).toHaveBeenCalledWith('cw-3', ['job-1'])
  })

  it('UC27-A1-UT-P: Partner sets an active Casual Worker to Inactive with a reason', async () => {
    vi.mocked(casualWorkerStatusRepository.getCompanyJobIds).mockResolvedValue(['job-2'])
    vi.mocked(casualWorkerStatusRepository.withdrawPendingApplicationsForJobs).mockResolvedValue(undefined as never)

    await casualWorkerStatusService.updateStatus({
      user_id: 'cw-4', company_id: 'comp-1', worker_status: 'inactive', inactivate_reason: 'Moved away',
    })

    expect(casualWorkerStatusRepository.setCompanyBlock).toHaveBeenCalledWith(
      'cw-4', 'comp-1', expect.any(String), 'Moved away',
    )
    expect(casualWorkerStatusRepository.withdrawPendingApplicationsForJobs).toHaveBeenCalledWith('cw-4', ['job-2'])
  })

  it('UC27-BR-UT-O: Owner is blocked from setting a Casual Worker to Inactive without a reason', async () => {
    await expect(casualWorkerStatusService.updateStatus({
      user_id: 'cw-5', company_id: 'comp-1', worker_status: 'inactive', inactivate_reason: '',
    })).rejects.toThrow('A reason is required to inactivate this Casual Worker.')

    expect(casualWorkerStatusRepository.setCompanyBlock).not.toHaveBeenCalled()
  })
})
