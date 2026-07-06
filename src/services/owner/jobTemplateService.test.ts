import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase', () => ({
  supabase: {},
  createClient: () => ({}),
}))

vi.mock('@/repositories/owner/jobTemplateRepository', () => ({
  jobTemplateRepository: {
    createTemplate: vi.fn(),
    getTemplatesByCompany: vi.fn(),
    getTemplateById: vi.fn(),
    deleteTemplate: vi.fn(),
    updateTemplate: vi.fn(),
    getUsageStats: vi.fn(),
  },
}))

import { jobTemplateService } from './jobTemplateService'
import { jobTemplateRepository } from '@/repositories/owner/jobTemplateRepository'

const baseTemplate = {
  id: 'template-1',
  company_id: 'company-1',
  name: 'Weekend Cashier',
  title: 'Cashier',
  description: 'Run the front register',
  requirements: 'Available weekends',
  employment_type: 'casual',
  form_type: 'shift',
  department_id: null,
  salary_amount: null,
  salary_type: null,
  uniform_required: false,
  uniform_details: null,
  experience_required: null,
  minimum_age: null,
  estimated_hours: null,
  urgency: null,
  created_by: 'owner-1',
  created_at: '2026-06-01T00:00:00.000Z',
  updated_at: '2026-06-01T00:00:00.000Z',
}

describe('jobTemplateService — Job Template', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('createTemplate', () => {
    it('creates a template with valid input', async () => {
      vi.mocked(jobTemplateRepository.createTemplate).mockResolvedValue(baseTemplate)

      const result = await jobTemplateService.createTemplate({
        company_id: 'company-1',
        name: 'Weekend Cashier',
        title: 'Cashier',
        description: 'Run the front register',
        requirements: 'Available weekends',
        employment_type: 'casual',
        form_type: 'shift',
        created_by: 'owner-1',
      })

      expect(jobTemplateRepository.createTemplate).toHaveBeenCalledWith({
        company_id: 'company-1',
        name: 'Weekend Cashier',
        title: 'Cashier',
        description: 'Run the front register',
        requirements: 'Available weekends',
        employment_type: 'casual',
        form_type: 'shift',
        created_by: 'owner-1',
      })
      expect(result).toEqual(baseTemplate)
    })

    it('throws when required fields are missing', async () => {
      await expect(jobTemplateService.createTemplate({
        company_id: '',
        name: 'Weekend Cashier',
        title: 'Cashier',
        created_by: 'owner-1',
      })).rejects.toThrow('Missing required job template fields')
    })

    it('throws when name is blank', async () => {
      await expect(jobTemplateService.createTemplate({
        company_id: 'company-1',
        name: '   ',
        title: 'Cashier',
        created_by: 'owner-1',
      })).rejects.toThrow('Missing required job template fields')
    })
  })

  describe('listTemplates', () => {
    it('returns templates for a company', async () => {
      vi.mocked(jobTemplateRepository.getTemplatesByCompany).mockResolvedValue([baseTemplate])

      const result = await jobTemplateService.listTemplates('company-1')

      expect(jobTemplateRepository.getTemplatesByCompany).toHaveBeenCalledWith('company-1')
      expect(result).toEqual([baseTemplate])
    })

    it('throws when company_id is missing', async () => {
      await expect(jobTemplateService.listTemplates('')).rejects.toThrow('company_id is required')
    })
  })

  describe('deleteTemplate', () => {
    it('deletes an existing template', async () => {
      vi.mocked(jobTemplateRepository.getTemplateById).mockResolvedValue(baseTemplate)
      vi.mocked(jobTemplateRepository.deleteTemplate).mockResolvedValue(undefined)

      await jobTemplateService.deleteTemplate('template-1')

      expect(jobTemplateRepository.deleteTemplate).toHaveBeenCalledWith('template-1')
    })

    it('throws when the template does not exist', async () => {
      vi.mocked(jobTemplateRepository.getTemplateById).mockResolvedValue(null)

      await expect(jobTemplateService.deleteTemplate('missing')).rejects.toThrow('Template not found')
    })
  })

  describe('updateTemplate', () => {
    it('updates name, title, description, requirements, employment_type, and form_type', async () => {
      vi.mocked(jobTemplateRepository.getTemplateById).mockResolvedValue(baseTemplate)
      vi.mocked(jobTemplateRepository.updateTemplate).mockResolvedValue({
        ...baseTemplate,
        name: 'Renamed',
      })

      const result = await jobTemplateService.updateTemplate('template-1', { name: 'Renamed' })

      expect(jobTemplateRepository.updateTemplate).toHaveBeenCalledWith('template-1', {
        name: 'Renamed',
        title: baseTemplate.title,
        description: baseTemplate.description,
        requirements: baseTemplate.requirements,
        employment_type: baseTemplate.employment_type,
        form_type: baseTemplate.form_type,
        department_id: baseTemplate.department_id,
        salary_amount: baseTemplate.salary_amount,
        salary_type: baseTemplate.salary_type,
        uniform_required: baseTemplate.uniform_required,
        uniform_details: baseTemplate.uniform_details,
        experience_required: baseTemplate.experience_required,
        minimum_age: baseTemplate.minimum_age,
        estimated_hours: baseTemplate.estimated_hours,
        urgency: baseTemplate.urgency,
      })
      expect(result.name).toBe('Renamed')
    })

    it('updates uniform_required, uniform_details, experience_required, and minimum_age', async () => {
      vi.mocked(jobTemplateRepository.getTemplateById).mockResolvedValue(baseTemplate)
      vi.mocked(jobTemplateRepository.updateTemplate).mockResolvedValue({
        ...baseTemplate, uniform_required: true, uniform_details: 'Black polo + apron', experience_required: '1+ Year', minimum_age: '18+',
      })

      await jobTemplateService.updateTemplate('template-1', {
        uniform_required: true, uniform_details: 'Black polo + apron', experience_required: '1+ Year', minimum_age: '18+',
      })

      expect(jobTemplateRepository.updateTemplate).toHaveBeenCalledWith('template-1', expect.objectContaining({
        uniform_required: true, uniform_details: 'Black polo + apron', experience_required: '1+ Year', minimum_age: '18+',
      }))
    })

    it('updates estimated_hours and urgency for one-off templates', async () => {
      vi.mocked(jobTemplateRepository.getTemplateById).mockResolvedValue(baseTemplate)
      vi.mocked(jobTemplateRepository.updateTemplate).mockResolvedValue({
        ...baseTemplate, estimated_hours: '4-6 hours', urgency: 'urgent',
      })

      await jobTemplateService.updateTemplate('template-1', { estimated_hours: '4-6 hours', urgency: 'urgent' })

      expect(jobTemplateRepository.updateTemplate).toHaveBeenCalledWith('template-1', expect.objectContaining({
        estimated_hours: '4-6 hours', urgency: 'urgent',
      }))
    })

    it('throws when the template does not exist', async () => {
      vi.mocked(jobTemplateRepository.getTemplateById).mockResolvedValue(null)

      await expect(jobTemplateService.updateTemplate('missing', { name: 'X' })).rejects.toThrow('Template not found')
    })

    it('throws when name is blank', async () => {
      vi.mocked(jobTemplateRepository.getTemplateById).mockResolvedValue(baseTemplate)

      await expect(jobTemplateService.updateTemplate('template-1', { name: '   ' })).rejects.toThrow('Please name this template.')
    })

    it('throws when title is blank', async () => {
      vi.mocked(jobTemplateRepository.getTemplateById).mockResolvedValue(baseTemplate)

      await expect(jobTemplateService.updateTemplate('template-1', { title: '   ' })).rejects.toThrow('Please give this template a job title.')
    })
  })

  describe('getTemplateUsageStats', () => {
    it('returns usage stats for an existing template', async () => {
      vi.mocked(jobTemplateRepository.getTemplateById).mockResolvedValue(baseTemplate)
      vi.mocked(jobTemplateRepository.getUsageStats).mockResolvedValue({
        used_in_jobs: 12, published_jobs: 8, draft_jobs: 4, last_used_at: '2026-07-05T00:00:00.000Z',
      })

      const result = await jobTemplateService.getTemplateUsageStats('template-1')

      expect(jobTemplateRepository.getUsageStats).toHaveBeenCalledWith('template-1')
      expect(result).toEqual({ used_in_jobs: 12, published_jobs: 8, draft_jobs: 4, last_used_at: '2026-07-05T00:00:00.000Z' })
    })

    it('throws when the template does not exist', async () => {
      vi.mocked(jobTemplateRepository.getTemplateById).mockResolvedValue(null)

      await expect(jobTemplateService.getTemplateUsageStats('missing')).rejects.toThrow('Template not found')
    })

    it('throws when id is missing', async () => {
      await expect(jobTemplateService.getTemplateUsageStats('')).rejects.toThrow('Template id is required')
    })
  })
})
