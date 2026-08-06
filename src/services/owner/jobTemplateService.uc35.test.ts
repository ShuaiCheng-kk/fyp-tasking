import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase', () => ({
  supabase: {},
  createClient: () => ({}),
}))

vi.mock('@/repositories/owner/jobTemplateRepository', () => ({
  jobTemplateRepository: {
    createTemplate: vi.fn(),
  },
}))

import { jobTemplateService } from './jobTemplateService'
import { jobTemplateRepository } from '@/repositories/owner/jobTemplateRepository'

const fullTemplateInput = {
  company_id: 'comp-1',
  title: 'Weekend Cashier',
  responsibilities: 'Handle checkout and restock shelves',
  skills: 'Basic maths, customer service',
  department_id: 'dept-1',
  salary_amount: 12,
  created_by: 'owner-1',
}

describe('UC35 Create Job Template', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('UC35-M-UT-O: Owner saves the in-progress job wizard as a template', async () => {
    const created = { id: 'template-1', ...fullTemplateInput }
    vi.mocked(jobTemplateRepository.createTemplate).mockResolvedValue(created as never)

    const result = await jobTemplateService.createTemplate(fullTemplateInput)

    expect(result).toEqual(created)
    expect(jobTemplateRepository.createTemplate).toHaveBeenCalledTimes(1)
  })

  it('UC35-M-UT-P: Partner saves the in-progress job wizard as a template', async () => {
    const input = { ...fullTemplateInput, created_by: 'partner-1' }
    const created = { id: 'template-2', ...input }
    vi.mocked(jobTemplateRepository.createTemplate).mockResolvedValue(created as never)

    const result = await jobTemplateService.createTemplate(input)

    expect(result).toEqual(created)
    expect(jobTemplateRepository.createTemplate).toHaveBeenCalledTimes(1)
  })

  it('UC35-M-UT-M: Manager saves the in-progress job wizard as a template for their own department', async () => {
    const input = { ...fullTemplateInput, created_by: 'mgr-1' }
    const created = { id: 'template-3', ...input }
    vi.mocked(jobTemplateRepository.createTemplate).mockResolvedValue(created as never)

    const result = await jobTemplateService.createTemplate(input)

    expect(result).toEqual(created)
    expect(jobTemplateRepository.createTemplate).toHaveBeenCalledTimes(1)
  })

  it('UC35-A1-UT-O: Owner is blocked from saving a template with Skills left blank', async () => {
    const input = { ...fullTemplateInput, skills: '' }

    await expect(jobTemplateService.createTemplate(input))
      .rejects.toThrow('Skills is required to save a template')

    expect(jobTemplateRepository.createTemplate).not.toHaveBeenCalled()
  })

  it('UC35-A1-UT-P: Partner is blocked from saving a template with Skills left blank', async () => {
    const input = { ...fullTemplateInput, created_by: 'partner-1', skills: '' }

    await expect(jobTemplateService.createTemplate(input))
      .rejects.toThrow('Skills is required to save a template')

    expect(jobTemplateRepository.createTemplate).not.toHaveBeenCalled()
  })

  it('UC35-A1-UT-M: Manager is blocked from saving a template with Skills left blank', async () => {
    const input = { ...fullTemplateInput, created_by: 'mgr-1', skills: '' }

    await expect(jobTemplateService.createTemplate(input))
      .rejects.toThrow('Skills is required to save a template')

    expect(jobTemplateRepository.createTemplate).not.toHaveBeenCalled()
  })

  it('UC35-A2-UT-O: Owner creates a job template from scratch using the New Template button', async () => {
    const created = { id: 'template-4', ...fullTemplateInput }
    vi.mocked(jobTemplateRepository.createTemplate).mockResolvedValue(created as never)

    const result = await jobTemplateService.createTemplate(fullTemplateInput)

    expect(result).toEqual(created)
    expect(jobTemplateRepository.createTemplate).toHaveBeenCalledTimes(1)
  })
})
