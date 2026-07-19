import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase', () => ({
  supabase: {},
  createClient: () => ({}),
}))

vi.mock('@/repositories/owner/taskTemplateRepository', () => ({
  taskTemplateRepository: {
    createTemplate: vi.fn(),
    getTemplatesByCompany: vi.fn(),
    getTemplateById: vi.fn(),
    deleteTemplate: vi.fn(),
    updateTemplate: vi.fn(),
  },
}))

import { taskTemplateService } from './taskTemplateService'
import { taskTemplateRepository } from '@/repositories/owner/taskTemplateRepository'

const baseTemplate = {
  id: 'template-1',
  company_id: 'company-1',
  title: 'Clean front desk',
  description: 'Wipe down and restock',
  priority: 'Medium',
  sub_task_titles: ['Wipe counters', 'Restock supplies'],
  created_by: 'owner-1',
  created_at: '2026-06-01T00:00:00.000Z',
}

describe('taskTemplateService — Task Template', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('createTemplate', () => {
    it('creates a template with valid input', async () => {
      vi.mocked(taskTemplateRepository.createTemplate).mockResolvedValue(baseTemplate)

      const result = await taskTemplateService.createTemplate({
        company_id: 'company-1',
        title: 'Clean front desk',
        description: 'Wipe down and restock',
        priority: 'Medium',
        sub_task_titles: ['Wipe counters', 'Restock supplies'],
        created_by: 'owner-1',
      })

      expect(taskTemplateRepository.createTemplate).toHaveBeenCalledWith({
        company_id: 'company-1',
        title: 'Clean front desk',
        description: 'Wipe down and restock',
        priority: 'Medium',
        sub_task_titles: ['Wipe counters', 'Restock supplies'],
        created_by: 'owner-1',
      })
      expect(result).toEqual(baseTemplate)
    })

    it('trims and drops blank sub-task titles', async () => {
      vi.mocked(taskTemplateRepository.createTemplate).mockResolvedValue(baseTemplate)

      await taskTemplateService.createTemplate({
        company_id: 'company-1',
        title: 'Clean front desk',
        sub_task_titles: ['  Wipe counters  ', '   ', 'Restock supplies'],
        created_by: 'owner-1',
      })

      expect(taskTemplateRepository.createTemplate).toHaveBeenCalledWith(
        expect.objectContaining({ sub_task_titles: ['Wipe counters', 'Restock supplies'] })
      )
    })

    it('defaults sub_task_titles to an empty array when omitted', async () => {
      vi.mocked(taskTemplateRepository.createTemplate).mockResolvedValue(baseTemplate)

      await taskTemplateService.createTemplate({
        company_id: 'company-1',
        title: 'Clean front desk',
        created_by: 'owner-1',
      })

      expect(taskTemplateRepository.createTemplate).toHaveBeenCalledWith(
        expect.objectContaining({ sub_task_titles: [] })
      )
    })

    it('throws when required fields are missing', async () => {
      await expect(taskTemplateService.createTemplate({
        company_id: '',
        title: 'Clean front desk',
        created_by: 'owner-1',
      })).rejects.toThrow('Missing required task template fields')
    })
  })

  describe('listTemplates', () => {
    it('returns templates for a company', async () => {
      vi.mocked(taskTemplateRepository.getTemplatesByCompany).mockResolvedValue([baseTemplate])

      const result = await taskTemplateService.listTemplates('company-1')

      expect(taskTemplateRepository.getTemplatesByCompany).toHaveBeenCalledWith('company-1')
      expect(result).toEqual([baseTemplate])
    })

    it('throws when company_id is missing', async () => {
      await expect(taskTemplateService.listTemplates('')).rejects.toThrow('company_id is required')
    })
  })

  describe('deleteTemplate', () => {
    it('deletes an existing template', async () => {
      vi.mocked(taskTemplateRepository.getTemplateById).mockResolvedValue(baseTemplate)
      vi.mocked(taskTemplateRepository.deleteTemplate).mockResolvedValue(undefined)

      await taskTemplateService.deleteTemplate('template-1')

      expect(taskTemplateRepository.deleteTemplate).toHaveBeenCalledWith('template-1')
    })

    it('throws when the template does not exist', async () => {
      vi.mocked(taskTemplateRepository.getTemplateById).mockResolvedValue(null)

      await expect(taskTemplateService.deleteTemplate('missing')).rejects.toThrow('Template not found')
    })
  })

  describe('updateTemplate', () => {
    it('updates title, description, priority, and sub_task_titles for an existing template', async () => {
      vi.mocked(taskTemplateRepository.getTemplateById).mockResolvedValue(baseTemplate)
      vi.mocked(taskTemplateRepository.updateTemplate).mockResolvedValue({
        ...baseTemplate,
        title: 'Renamed title',
        description: 'Renamed description',
        priority: 'High',
        sub_task_titles: ['Check inventory'],
      })

      const result = await taskTemplateService.updateTemplate('template-1', {
        title: 'Renamed title',
        description: 'Renamed description',
        priority: 'High',
        sub_task_titles: ['  Check inventory  '],
      })

      expect(taskTemplateRepository.updateTemplate).toHaveBeenCalledWith('template-1', {
        title: 'Renamed title',
        description: 'Renamed description',
        priority: 'High',
        sub_task_titles: ['Check inventory'],
      })
      expect(result.title).toBe('Renamed title')
    })

    it('falls back to existing values for fields not provided', async () => {
      vi.mocked(taskTemplateRepository.getTemplateById).mockResolvedValue(baseTemplate)
      vi.mocked(taskTemplateRepository.updateTemplate).mockResolvedValue(baseTemplate)

      await taskTemplateService.updateTemplate('template-1', { priority: 'High' })

      expect(taskTemplateRepository.updateTemplate).toHaveBeenCalledWith('template-1', {
        title: baseTemplate.title,
        description: baseTemplate.description,
        priority: 'High',
        sub_task_titles: baseTemplate.sub_task_titles,
      })
    })

    it('throws when the template does not exist', async () => {
      vi.mocked(taskTemplateRepository.getTemplateById).mockResolvedValue(null)

      await expect(taskTemplateService.updateTemplate('missing', { title: 'X' })).rejects.toThrow('Template not found')
    })

    it('throws when title is blank', async () => {
      vi.mocked(taskTemplateRepository.getTemplateById).mockResolvedValue(baseTemplate)

      await expect(taskTemplateService.updateTemplate('template-1', { title: '   ' })).rejects.toThrow('Please give this template a task title.')
    })
  })
})
