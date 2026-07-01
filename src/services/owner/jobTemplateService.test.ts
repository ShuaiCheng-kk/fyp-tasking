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
  created_by: 'owner-1',
  created_at: '2026-06-01T00:00:00.000Z',
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
      })
      expect(result.name).toBe('Renamed')
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
})
