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
  },
}))

import { recruitmentService } from './recruitmentService'
import { recruitmentRepository } from '@/repositories/owner/recruitmentRepository'

describe('UC39 Save Job as Draft', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('UC39-M-UT-O: Owner saves an in-progress job posting as a draft with only a Title', async () => {
    const created = { id: 'job-1', company_id: 'comp-1', created_by: 'owner-1', title: 'Weekend Cashier', status: 'draft' }
    vi.mocked(recruitmentRepository.createJobPosting).mockResolvedValue(created as never)

    const result = await recruitmentService.createJobPosting({
      company_id: 'comp-1', created_by: 'owner-1', title: 'Weekend Cashier', status: 'draft',
    } as never)

    expect(result).toEqual(created)
    expect(recruitmentRepository.getUserRole).not.toHaveBeenCalled()
    expect(recruitmentRepository.createJobPosting).toHaveBeenCalledWith(expect.objectContaining({ status: 'draft', title: 'Weekend Cashier' }))
  })

  it('UC39-M-UT-P: Partner saves an in-progress job posting as a draft with only a Title', async () => {
    const created = { id: 'job-2', company_id: 'comp-1', created_by: 'partner-1', title: 'Weekend Cashier', status: 'draft' }
    vi.mocked(recruitmentRepository.createJobPosting).mockResolvedValue(created as never)

    const result = await recruitmentService.createJobPosting({
      company_id: 'comp-1', created_by: 'partner-1', title: 'Weekend Cashier', status: 'draft',
    } as never)

    expect(result).toEqual(created)
  })

  it('UC39-M-UT-M: Manager saves an in-progress job posting as a draft with only a Title', async () => {
    const created = { id: 'job-3', company_id: 'comp-1', created_by: 'mgr-1', title: 'Weekend Cashier', status: 'draft' }
    vi.mocked(recruitmentRepository.createJobPosting).mockResolvedValue(created as never)

    const result = await recruitmentService.createJobPosting({
      company_id: 'comp-1', created_by: 'mgr-1', title: 'Weekend Cashier', status: 'draft',
    } as never)

    expect(result).toEqual(created)
  })

  it('UC39-A1-UT-O: Owner is blocked from saving a draft with no Title entered', async () => {
    await expect(recruitmentService.createJobPosting({
      company_id: 'comp-1', created_by: 'owner-1', title: '', status: 'draft',
    } as never)).rejects.toThrow('company_id, created_by, and title are required')

    expect(recruitmentRepository.createJobPosting).not.toHaveBeenCalled()
  })

  it('UC39-A1-UT-P: Partner is blocked from saving a draft with no Title entered', async () => {
    await expect(recruitmentService.createJobPosting({
      company_id: 'comp-1', created_by: 'partner-1', title: '', status: 'draft',
    } as never)).rejects.toThrow('company_id, created_by, and title are required')

    expect(recruitmentRepository.createJobPosting).not.toHaveBeenCalled()
  })

  it('UC39-A1-UT-M: Manager is blocked from saving a draft with no Title entered', async () => {
    await expect(recruitmentService.createJobPosting({
      company_id: 'comp-1', created_by: 'mgr-1', title: '', status: 'draft',
    } as never)).rejects.toThrow('company_id, created_by, and title are required')

    expect(recruitmentRepository.createJobPosting).not.toHaveBeenCalled()
  })
})
