import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase', () => ({
  supabase: {},
  createClient: () => ({}),
}))

vi.mock('@/services/email/emailService', () => ({
  emailService: {
    sendInviteEmail: vi.fn(),
    sendRemovedFromCompanyEmail: vi.fn(),
  },
}))

vi.mock('@/repositories/owner/recruitmentRepository', () => ({
  recruitmentRepository: {
    createJobPosting: vi.fn(),
    getUserRole: vi.fn(),
    getEmployeeShiftOnDate: vi.fn(),
    getExpiredOpenJobPostingIds: vi.fn(),
    closeJobPostingsByIds: vi.fn(),
  },
}))

import { recruitmentService } from './recruitmentService'
import { recruitmentRepository } from '@/repositories/owner/recruitmentRepository'

const fullPostingInput = {
  company_id: 'comp-1',
  department_id: 'dept-1',
  created_by: 'owner-1',
  title: 'Weekend Cashier',
  responsibilities: 'Handle checkout and restock shelves',
  skills: 'Basic maths, customer service',
  experience_required: 'None required',
  minimum_age: 18,
  uniform_type: 'Provided',
  salary_amount: 12,
  openings: 2,
  job_type: 'shift',
  job_date: '2026-08-20',
  job_start_time: '09:00',
  job_end_time: '17:00',
  assigned_employee_id: 'emp-1',
  status: 'open',
}

describe('UC43 Set Application Deadline', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(recruitmentRepository.getUserRole).mockResolvedValue('Owner')
    vi.mocked(recruitmentRepository.getEmployeeShiftOnDate).mockResolvedValue(null)
  })

  it('UC43-M-UT-O: Owner publishes a job with a specific application deadline date and time', async () => {
    const input = { ...fullPostingInput, expires_at: '2026-09-01T23:59:00.000Z' }
    const created = { id: 'job-1', ...input }
    vi.mocked(recruitmentRepository.createJobPosting).mockResolvedValue(created as never)

    const result = await recruitmentService.createJobPosting(input as never)

    expect(result).toEqual(created)
    expect(recruitmentRepository.createJobPosting).toHaveBeenCalledWith(expect.objectContaining({ expires_at: '2026-09-01T23:59:00.000Z' }))
  })

  it('UC43-M-UT-P: Partner publishes a job with a specific application deadline date and time', async () => {
    vi.mocked(recruitmentRepository.getUserRole).mockResolvedValue('Partner')
    const input = { ...fullPostingInput, created_by: 'partner-1', expires_at: '2026-09-01T23:59:00.000Z' }
    const created = { id: 'job-2', ...input }
    vi.mocked(recruitmentRepository.createJobPosting).mockResolvedValue(created as never)

    const result = await recruitmentService.createJobPosting(input as never)

    expect(result).toEqual(created)
    expect(recruitmentRepository.createJobPosting).toHaveBeenCalledWith(expect.objectContaining({ expires_at: '2026-09-01T23:59:00.000Z' }))
  })

  it('UC43-M-UT-M: Manager publishes a job with a specific application deadline date and time', async () => {
    vi.mocked(recruitmentRepository.getUserRole).mockResolvedValue('Manager')
    const input = { ...fullPostingInput, created_by: 'mgr-1', expires_at: '2026-09-01T23:59:00.000Z' }
    const created = { id: 'job-3', ...input, status: 'pending_approval' }
    vi.mocked(recruitmentRepository.createJobPosting).mockResolvedValue(created as never)

    const result = await recruitmentService.createJobPosting(input as never)

    expect(result).toEqual(created)
    expect(recruitmentRepository.createJobPosting).toHaveBeenCalledWith(expect.objectContaining({ expires_at: '2026-09-01T23:59:00.000Z' }))
  })

  it('UC43-A1-UT-O: Owner publishes a job choosing No Deadline instead of a date', async () => {
    const input = { ...fullPostingInput, no_deadline: true }
    const created = { id: 'job-4', ...input, expires_at: null }
    vi.mocked(recruitmentRepository.createJobPosting).mockResolvedValue(created as never)

    const result = await recruitmentService.createJobPosting(input as never)

    expect(result).toEqual(created)
    expect(recruitmentRepository.createJobPosting).toHaveBeenCalledWith(expect.objectContaining({ no_deadline: true }))
  })

  it('UC43-A1-UT-P: Partner publishes a job choosing No Deadline instead of a date', async () => {
    vi.mocked(recruitmentRepository.getUserRole).mockResolvedValue('Partner')
    const input = { ...fullPostingInput, created_by: 'partner-1', no_deadline: true }
    const created = { id: 'job-5', ...input, expires_at: null }
    vi.mocked(recruitmentRepository.createJobPosting).mockResolvedValue(created as never)

    const result = await recruitmentService.createJobPosting(input as never)

    expect(result).toEqual(created)
    expect(recruitmentRepository.createJobPosting).toHaveBeenCalledWith(expect.objectContaining({ no_deadline: true }))
  })

  it('UC43-A1-UT-M: Manager publishes a job choosing No Deadline instead of a date', async () => {
    vi.mocked(recruitmentRepository.getUserRole).mockResolvedValue('Manager')
    const input = { ...fullPostingInput, created_by: 'mgr-1', no_deadline: true }
    const created = { id: 'job-6', ...input, expires_at: null, status: 'pending_approval' }
    vi.mocked(recruitmentRepository.createJobPosting).mockResolvedValue(created as never)

    const result = await recruitmentService.createJobPosting(input as never)

    expect(result).toEqual(created)
    expect(recruitmentRepository.createJobPosting).toHaveBeenCalledWith(expect.objectContaining({ no_deadline: true }))
  })

  it('UC43-BR-UT-O: Owner is blocked from publishing a job with no deadline choice made at all', async () => {
    const input = { ...fullPostingInput }

    await expect(recruitmentService.createJobPosting(input as never))
      .rejects.toThrow('Application deadline is required to publish — choose a date or "No Deadline"')

    expect(recruitmentRepository.createJobPosting).not.toHaveBeenCalled()
  })

  it('UC43-BR-UT-System-1: An open posting whose deadline has passed is automatically closed the next time postings are fetched', async () => {
    vi.mocked(recruitmentRepository.getExpiredOpenJobPostingIds).mockResolvedValue(['job-7', 'job-8'])
    vi.mocked(recruitmentRepository.closeJobPostingsByIds).mockResolvedValue(undefined as never)

    await recruitmentService.sweepExpiredJobPostings('comp-1')

    expect(recruitmentRepository.getExpiredOpenJobPostingIds).toHaveBeenCalledWith('comp-1')
    expect(recruitmentRepository.closeJobPostingsByIds).toHaveBeenCalledWith(['job-7', 'job-8'])
  })

  it('UC43-BR-UT-System-2: Fetching postings with none past their deadline closes nothing', async () => {
    vi.mocked(recruitmentRepository.getExpiredOpenJobPostingIds).mockResolvedValue([])

    await recruitmentService.sweepExpiredJobPostings('comp-1')

    expect(recruitmentRepository.closeJobPostingsByIds).not.toHaveBeenCalled()
  })
})
