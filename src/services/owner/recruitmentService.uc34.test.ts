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
  expires_at: '2026-09-01T00:00:00.000Z',
  job_type: 'shift',
  job_date: '2026-08-20',
  job_start_time: '09:00',
  job_end_time: '17:00',
  assigned_employee_id: 'emp-1',
  status: 'open',
}

describe('UC34 Publish Job Opening', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(recruitmentRepository.getEmployeeShiftOnDate).mockResolvedValue(null)
  })

  it('UC34-M-UT-O: Owner publishes a fully completed job posting', async () => {
    vi.mocked(recruitmentRepository.getUserRole).mockResolvedValue('Owner')
    const created = { id: 'job-1', ...fullPostingInput }
    vi.mocked(recruitmentRepository.createJobPosting).mockResolvedValue(created as never)

    const result = await recruitmentService.createJobPosting(fullPostingInput as never)

    expect(result).toEqual(created)
    expect(recruitmentRepository.createJobPosting).toHaveBeenCalledWith(expect.objectContaining({ status: 'open' }))
  })

  it('UC34-M-UT-P: Partner publishes a fully completed job posting', async () => {
    vi.mocked(recruitmentRepository.getUserRole).mockResolvedValue('Partner')
    const input = { ...fullPostingInput, created_by: 'partner-1' }
    const created = { id: 'job-2', ...input }
    vi.mocked(recruitmentRepository.createJobPosting).mockResolvedValue(created as never)

    const result = await recruitmentService.createJobPosting(input as never)

    expect(result).toEqual(created)
    expect(recruitmentRepository.createJobPosting).toHaveBeenCalledWith(expect.objectContaining({ status: 'open' }))
  })

  it('UC34-A1-UT-O: Owner is blocked from publishing a job with Responsibilities left blank', async () => {
    const input = { ...fullPostingInput, responsibilities: '' }

    await expect(recruitmentService.createJobPosting(input as never))
      .rejects.toThrow('responsibilities is required to publish a job')

    expect(recruitmentRepository.createJobPosting).not.toHaveBeenCalled()
  })

  it('UC34-A1-UT-P: Partner is blocked from publishing a job with Responsibilities left blank', async () => {
    const input = { ...fullPostingInput, created_by: 'partner-1', responsibilities: '' }

    await expect(recruitmentService.createJobPosting(input as never))
      .rejects.toThrow('responsibilities is required to publish a job')

    expect(recruitmentRepository.createJobPosting).not.toHaveBeenCalled()
  })

  it('UC34-BR-UT-O: Owner is blocked from publishing a job whose hours start before the supervisor\'s shift', async () => {
    vi.mocked(recruitmentRepository.getUserRole).mockResolvedValue('Owner')
    vi.mocked(recruitmentRepository.getEmployeeShiftOnDate).mockResolvedValue({
      start_time: '10:00', end_time: '18:00',
    } as never)
    const input = { ...fullPostingInput, job_start_time: '09:00' }

    await expect(recruitmentService.createJobPosting(input as never))
      .rejects.toThrow('Start time cannot be earlier than the supervisor\'s shift start (10:00 AM)')

    expect(recruitmentRepository.createJobPosting).not.toHaveBeenCalled()
  })
})
