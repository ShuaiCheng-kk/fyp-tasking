import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase', () => ({
  supabase: {},
  createClient: () => ({}),
}))

vi.mock('@/repositories/casual/casualShiftCancellationRepository', () => ({
  casualShiftCancellationRepository: {
    getWorkerByAuthId: vi.fn(),
    getAssignedShift: vi.fn(),
    cancelShift: vi.fn(),
    getJobPosting: vi.fn(),
    findApplicant: vi.fn(),
    cancelAcceptedInvitation: vi.fn(),
    setApplicantStatus: vi.fn(),
    insertCancellation: vi.fn(),
    reopenJobPosting: vi.fn(),
    getUserContact: vi.fn(),
    insertMessage: vi.fn(),
  },
}))

vi.mock('@/services/email/emailService', () => ({
  emailService: {
    sendWorkerCancelledEmail: vi.fn(),
  },
}))

import { casualShiftCancellationService } from './casualShiftCancellationService'
import { casualShiftCancellationRepository } from '@/repositories/casual/casualShiftCancellationRepository'
import { emailService } from '@/services/email/emailService'

const worker = { id: 'worker-1', full_name: 'John Tan', email_address: 'john@test.local' }

const futureShift = {
  id: 'shift-1',
  shift_date: '2030-05-04',
  start_time: '09:00',
  status: 'active',
  source_job_posting_id: 'job-1',
}

const openJob = {
  id: 'job-1',
  title: 'Weekend Cashier',
  company_id: 'company-1',
  created_by: 'owner-1',
  status: 'open',
  expires_at: null,
  openings: 1,
}

describe('casualShiftCancellationService.cancelShift — worker backs out before the shift starts', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(casualShiftCancellationRepository.getWorkerByAuthId).mockResolvedValue(worker)
    vi.mocked(casualShiftCancellationRepository.getAssignedShift).mockResolvedValue(futureShift)
    vi.mocked(casualShiftCancellationRepository.getJobPosting).mockResolvedValue(openJob)
    vi.mocked(casualShiftCancellationRepository.findApplicant).mockResolvedValue({ id: 'applicant-1' })
    vi.mocked(casualShiftCancellationRepository.getUserContact).mockResolvedValue({
      full_name: 'Owner One', email_address: 'owner@test.local',
    })
  })

  it('cancels the shift, voids the invitation, withdraws the application, and records history', async () => {
    await casualShiftCancellationService.cancelShift({ auth_id: 'auth-1', shift_id: 'shift-1', reason: ' Family emergency ' })

    expect(casualShiftCancellationRepository.cancelShift).toHaveBeenCalledWith('shift-1')
    expect(casualShiftCancellationRepository.cancelAcceptedInvitation).toHaveBeenCalledWith('applicant-1')
    expect(casualShiftCancellationRepository.setApplicantStatus).toHaveBeenCalledWith('applicant-1', 'withdrawn')
    expect(casualShiftCancellationRepository.insertCancellation).toHaveBeenCalledWith({
      job_id: 'job-1',
      applicant_id: 'applicant-1',
      cancelled_by: 'worker-1',
      cancelled_role: 'worker',
      scope: 'worker',
      reason: 'Family emergency',
    })
  })

  it('works without a reason — optional on the worker side', async () => {
    await casualShiftCancellationService.cancelShift({ auth_id: 'auth-1', shift_id: 'shift-1' })

    expect(casualShiftCancellationRepository.insertCancellation).toHaveBeenCalledWith(
      expect.objectContaining({ reason: null }),
    )
  })

  it('refuses once the shift has started — Attendance owns no-shows', async () => {
    vi.mocked(casualShiftCancellationRepository.getAssignedShift).mockResolvedValue({
      ...futureShift, shift_date: '2020-01-01',
    })

    await expect(casualShiftCancellationService.cancelShift({ auth_id: 'auth-1', shift_id: 'shift-1' }))
      .rejects.toThrow('already started')
    expect(casualShiftCancellationRepository.cancelShift).not.toHaveBeenCalled()
  })

  it('refuses a shift not assigned to this worker', async () => {
    vi.mocked(casualShiftCancellationRepository.getAssignedShift).mockResolvedValue(null)

    await expect(casualShiftCancellationService.cancelShift({ auth_id: 'auth-1', shift_id: 'shift-x' }))
      .rejects.toThrow('not assigned to you')
  })

  it('reopens a job that had auto-closed on becoming full', async () => {
    vi.mocked(casualShiftCancellationRepository.getJobPosting).mockResolvedValue({ ...openJob, status: 'closed' })

    await casualShiftCancellationService.cancelShift({ auth_id: 'auth-1', shift_id: 'shift-1' })

    expect(casualShiftCancellationRepository.reopenJobPosting).toHaveBeenCalledWith('job-1')
  })

  it('never reopens an expired job — the employer must extend the deadline or repost', async () => {
    vi.mocked(casualShiftCancellationRepository.getJobPosting).mockResolvedValue({
      ...openJob, status: 'closed', expires_at: '2020-01-01T00:00:00.000Z',
    })

    await casualShiftCancellationService.cancelShift({ auth_id: 'auth-1', shift_id: 'shift-1' })

    expect(casualShiftCancellationRepository.reopenJobPosting).not.toHaveBeenCalled()
  })

  it('notifies the employer in-app and by email, and a failed notification never blocks the cancel', async () => {
    await casualShiftCancellationService.cancelShift({ auth_id: 'auth-1', shift_id: 'shift-1', reason: 'Sick' })

    expect(casualShiftCancellationRepository.insertMessage).toHaveBeenCalledWith(
      'worker-1', 'owner-1', 'company-1', expect.stringContaining('cancelled their confirmed shift'), 'John Tan',
    )
    expect(emailService.sendWorkerCancelledEmail).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'owner@test.local', workerName: 'John Tan', reason: 'Sick' }),
    )

    vi.clearAllMocks()
    vi.mocked(casualShiftCancellationRepository.getWorkerByAuthId).mockResolvedValue(worker)
    vi.mocked(casualShiftCancellationRepository.getAssignedShift).mockResolvedValue(futureShift)
    vi.mocked(casualShiftCancellationRepository.getJobPosting).mockResolvedValue(openJob)
    vi.mocked(casualShiftCancellationRepository.findApplicant).mockResolvedValue({ id: 'applicant-1' })
    vi.mocked(casualShiftCancellationRepository.insertMessage).mockRejectedValue(new Error('messages down'))

    await expect(casualShiftCancellationService.cancelShift({ auth_id: 'auth-1', shift_id: 'shift-1' }))
      .resolves.toBeUndefined()
    expect(casualShiftCancellationRepository.cancelShift).toHaveBeenCalled()
  })
})
