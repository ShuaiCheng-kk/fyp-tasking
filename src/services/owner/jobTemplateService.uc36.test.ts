import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabaseAdmin', () => ({
  getSupabaseAdmin: () => ({}),
}))

vi.mock('@/lib/supabase', () => ({
  supabase: {},
  createClient: () => ({}),
}))

vi.mock('@/repositories/owner/jobTemplateRepository', () => ({
  jobTemplateRepository: {
    getTemplateById: vi.fn(),
    updateTemplate: vi.fn(),
  },
}))

import { jobTemplateService } from './jobTemplateService'
import { jobTemplateRepository } from '@/repositories/owner/jobTemplateRepository'

const existingTemplate = {
  id: 'template-1',
  company_id: 'comp-1',
  title: 'Weekend Cashier',
  responsibilities: 'Handle checkout and restock shelves',
  skills: 'Basic maths, customer service',
  job_type: 'shift',
  department_id: 'dept-1',
  salary_amount: 12,
  uniform_type: 'Provided',
  uniform_details: null,
  experience_required: 'None required',
  minimum_age: 18,
  estimated_hours: null,
  urgency: null,
  created_by: 'owner-1',
}

describe('UC36 Edit Job Template', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(jobTemplateRepository.getTemplateById).mockResolvedValue(existingTemplate as never)
  })

  it('UC36-M-UT-O: Owner edits an existing job template', async () => {
    const updated = { ...existingTemplate, salary_amount: 14 }
    vi.mocked(jobTemplateRepository.updateTemplate).mockResolvedValue(updated as never)

    const result = await jobTemplateService.updateTemplate('template-1', { salary_amount: 14 }, 'comp-1')

    expect(result).toEqual(updated)
    expect(jobTemplateRepository.updateTemplate).toHaveBeenCalledWith('template-1', expect.objectContaining({ salary_amount: 14, title: 'Weekend Cashier' }))
  })

  it('UC36-M-UT-P: Partner edits an existing job template', async () => {
    const updated = { ...existingTemplate, salary_amount: 15 }
    vi.mocked(jobTemplateRepository.updateTemplate).mockResolvedValue(updated as never)

    const result = await jobTemplateService.updateTemplate('template-1', { salary_amount: 15 }, 'comp-1')

    expect(result).toEqual(updated)
  })

  it('UC36-M-UT-M: Manager edits a job template in their own department', async () => {
    const updated = { ...existingTemplate, title: 'Weekend Cashier (Updated)' }
    vi.mocked(jobTemplateRepository.updateTemplate).mockResolvedValue(updated as never)

    const result = await jobTemplateService.updateTemplate('template-1', { title: 'Weekend Cashier (Updated)' }, 'comp-1')

    expect(result).toEqual(updated)
  })

  it('UC36-A1-UT-O: Owner is blocked from saving changes with Skills cleared', async () => {
    await expect(jobTemplateService.updateTemplate('template-1', { skills: '' }, 'comp-1'))
      .rejects.toThrow('Skills is required to save this template')

    expect(jobTemplateRepository.updateTemplate).not.toHaveBeenCalled()
  })

  it('UC36-A1-UT-P: Partner is blocked from saving changes with Skills cleared', async () => {
    await expect(jobTemplateService.updateTemplate('template-1', { skills: '' }, 'comp-1'))
      .rejects.toThrow('Skills is required to save this template')

    expect(jobTemplateRepository.updateTemplate).not.toHaveBeenCalled()
  })

  it('UC36-A1-UT-M: Manager is blocked from saving changes with Skills cleared', async () => {
    await expect(jobTemplateService.updateTemplate('template-1', { skills: '' }, 'comp-1'))
      .rejects.toThrow('Skills is required to save this template')

    expect(jobTemplateRepository.updateTemplate).not.toHaveBeenCalled()
  })

  it('UC36-BR-UT-O: Owner is blocked from editing a template belonging to another company', async () => {
    await expect(jobTemplateService.updateTemplate('template-1', { salary_amount: 14 }, 'comp-2'))
      .rejects.toThrow('You can only manage your own company\'s templates')

    expect(jobTemplateRepository.updateTemplate).not.toHaveBeenCalled()
  })
})
