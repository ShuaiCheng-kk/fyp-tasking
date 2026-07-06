import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase', () => ({
  supabase: {},
  createClient: () => ({}),
}))

vi.mock('@/repositories/guest/workerApplicationRepository', () => ({
  workerApplicationRepository: {
    respondToInvitation: vi.fn(),
    getInvitationContext: vi.fn(),
    promoteGuestToWorker: vi.fn(),
    addCasualWorkerToDepartment: vi.fn(),
  },
}))

vi.mock('@/services/owner/shiftService', () => ({
  shiftService: {
    createShift: vi.fn(),
  },
}))

import { workerApplicationService } from './workerApplicationService'
import { workerApplicationRepository } from '@/repositories/guest/workerApplicationRepository'
import { shiftService } from '@/services/owner/shiftService'

const baseJob = {
  id: 'job-1', company_id: 'company-1', department_id: 'dept-1', title: 'Warehouse Assistant',
  created_by: 'owner-1', form_type: 'shift', shift_date: '2026-07-10',
  shift_start_time: '09:00', shift_end_time: '17:00', job_start_time: null,
}

describe('workerApplicationService.respondToInvitation (UC — Casual Worker promotion on invitation accept)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('does nothing beyond recording the response when declined', async () => {
    await workerApplicationService.respondToInvitation('inv-1', 'declined')

    expect(workerApplicationRepository.respondToInvitation).toHaveBeenCalledWith('inv-1', 'declined')
    expect(workerApplicationRepository.promoteGuestToWorker).not.toHaveBeenCalled()
    expect(workerApplicationRepository.addCasualWorkerToDepartment).not.toHaveBeenCalled()
  })

  it('promotes the guest and gives them a stable department membership on accept', async () => {
    vi.mocked(workerApplicationRepository.getInvitationContext).mockResolvedValue({
      user_id: 'user-1',
      job: baseJob,
    } as any)
    vi.mocked(shiftService.createShift).mockResolvedValue({} as any)

    await workerApplicationService.respondToInvitation('inv-1', 'accepted')

    expect(workerApplicationRepository.promoteGuestToWorker).toHaveBeenCalledWith('user-1')
    // casualworker_departments mirrors employee_departments/manager_departments — without this,
    // the new Casual Worker's department_id resolves to null everywhere (getTeamByCompany etc.),
    // hiding them from every department-scoped member picker (e.g. an Employee assigning tasks).
    expect(workerApplicationRepository.addCasualWorkerToDepartment).toHaveBeenCalledWith('user-1', 'dept-1', 'company-1')
  })

  it('skips the department membership insert when the job has no department', async () => {
    vi.mocked(workerApplicationRepository.getInvitationContext).mockResolvedValue({
      user_id: 'user-1',
      job: { ...baseJob, department_id: null },
    } as any)

    await workerApplicationService.respondToInvitation('inv-1', 'accepted')

    expect(workerApplicationRepository.promoteGuestToWorker).toHaveBeenCalledWith('user-1')
    expect(workerApplicationRepository.addCasualWorkerToDepartment).not.toHaveBeenCalled()
  })
})
