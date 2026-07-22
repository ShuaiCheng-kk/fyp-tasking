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

vi.mock('@/repositories/owner/taskRepository', () => ({
  taskRepository: {
    getUserById: vi.fn(),
  },
}))

import { taskTemplateService } from './taskTemplateService'
import { taskTemplateRepository } from '@/repositories/owner/taskTemplateRepository'
import { taskRepository } from '@/repositories/owner/taskRepository'

const baseTemplate = {
  id: 'template-1',
  company_id: 'company-1',
  department_id: null,
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
        department_id: null,
        title: 'Clean front desk',
        description: 'Wipe down and restock',
        priority: 'Medium',
        sub_task_titles: ['Wipe counters', 'Restock supplies'],
        created_by: 'owner-1',
      })

      expect(taskTemplateRepository.createTemplate).toHaveBeenCalledWith({
        company_id: 'company-1',
        department_id: null,
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
    it('returns every company template when no department scope is given (Owner/Partner)', async () => {
      vi.mocked(taskTemplateRepository.getTemplatesByCompany).mockResolvedValue([baseTemplate])

      const result = await taskTemplateService.listTemplates('company-1')

      expect(taskTemplateRepository.getTemplatesByCompany).toHaveBeenCalledWith('company-1', undefined)
      expect(result).toEqual([baseTemplate])
    })

    it('passes department scope through for a Manager viewer', async () => {
      vi.mocked(taskTemplateRepository.getTemplatesByCompany).mockResolvedValue([baseTemplate])

      await taskTemplateService.listTemplates('company-1', ['dept-1'])

      expect(taskTemplateRepository.getTemplatesByCompany).toHaveBeenCalledWith('company-1', ['dept-1'])
    })

    it('throws when company_id is missing', async () => {
      await expect(taskTemplateService.listTemplates('')).rejects.toThrow('company_id is required')
    })
  })

  describe('deleteTemplate', () => {
    it('deletes when the acting user is the creator', async () => {
      vi.mocked(taskTemplateRepository.getTemplateById).mockResolvedValue(baseTemplate)
      vi.mocked(taskTemplateRepository.deleteTemplate).mockResolvedValue(undefined)

      await taskTemplateService.deleteTemplate('template-1', 'owner-1')

      expect(taskTemplateRepository.deleteTemplate).toHaveBeenCalledWith('template-1')
    })

    it('allows an Owner/Partner peer to delete a template created by the other', async () => {
      vi.mocked(taskTemplateRepository.getTemplateById).mockResolvedValue(baseTemplate) // created_by: owner-1
      vi.mocked(taskTemplateRepository.deleteTemplate).mockResolvedValue(undefined)
      vi.mocked(taskRepository.getUserById).mockImplementation(async (id: string) => (
        id === 'partner-1' ? { id: 'partner-1', company_id: 'company-1', role: 'Partner' } as never
          : { id: 'owner-1', company_id: 'company-1', role: 'Owner' } as never
      ))

      await taskTemplateService.deleteTemplate('template-1', 'partner-1')

      expect(taskTemplateRepository.deleteTemplate).toHaveBeenCalledWith('template-1')
    })

    it('rejects a Manager deleting a peer Manager\'s template (no peer widening)', async () => {
      const managerTemplate = { ...baseTemplate, created_by: 'manager-1' }
      vi.mocked(taskTemplateRepository.getTemplateById).mockResolvedValue(managerTemplate)
      vi.mocked(taskRepository.getUserById).mockImplementation(async (id: string) => (
        id === 'manager-2' ? { id: 'manager-2', company_id: 'company-1', role: 'Manager' } as never
          : { id: 'manager-1', company_id: 'company-1', role: 'Manager' } as never
      ))

      await expect(taskTemplateService.deleteTemplate('template-1', 'manager-2'))
        .rejects.toThrow('Only the user who created this template can perform this action')
      expect(taskTemplateRepository.deleteTemplate).not.toHaveBeenCalled()
    })

    it('rejects when no acting user is given', async () => {
      vi.mocked(taskTemplateRepository.getTemplateById).mockResolvedValue(baseTemplate)

      await expect(taskTemplateService.deleteTemplate('template-1'))
        .rejects.toThrow('Only the user who created this template can perform this action')
    })

    it('throws when the template does not exist', async () => {
      vi.mocked(taskTemplateRepository.getTemplateById).mockResolvedValue(null)

      await expect(taskTemplateService.deleteTemplate('missing', 'owner-1')).rejects.toThrow('Template not found')
    })
  })

  describe('updateTemplate', () => {
    it('updates title, description, priority, department, and sub_task_titles for an existing template', async () => {
      vi.mocked(taskTemplateRepository.getTemplateById).mockResolvedValue(baseTemplate)
      vi.mocked(taskTemplateRepository.updateTemplate).mockResolvedValue({
        ...baseTemplate,
        title: 'Renamed title',
        description: 'Renamed description',
        priority: 'High',
        department_id: 'dept-1',
        sub_task_titles: ['Check inventory'],
      })

      const result = await taskTemplateService.updateTemplate('template-1', {
        title: 'Renamed title',
        description: 'Renamed description',
        priority: 'High',
        department_id: 'dept-1',
        sub_task_titles: ['  Check inventory  '],
      }, 'owner-1')

      expect(taskTemplateRepository.updateTemplate).toHaveBeenCalledWith('template-1', {
        title: 'Renamed title',
        description: 'Renamed description',
        priority: 'High',
        department_id: 'dept-1',
        sub_task_titles: ['Check inventory'],
      })
      expect(result.title).toBe('Renamed title')
    })

    it('falls back to existing values for fields not provided', async () => {
      vi.mocked(taskTemplateRepository.getTemplateById).mockResolvedValue(baseTemplate)
      vi.mocked(taskTemplateRepository.updateTemplate).mockResolvedValue(baseTemplate)

      await taskTemplateService.updateTemplate('template-1', { priority: 'High' }, 'owner-1')

      expect(taskTemplateRepository.updateTemplate).toHaveBeenCalledWith('template-1', {
        title: baseTemplate.title,
        description: baseTemplate.description,
        priority: 'High',
        department_id: baseTemplate.department_id,
        sub_task_titles: baseTemplate.sub_task_titles,
      })
    })

    it('rejects a non-creator, non-peer acting user', async () => {
      vi.mocked(taskTemplateRepository.getTemplateById).mockResolvedValue(baseTemplate)
      vi.mocked(taskRepository.getUserById).mockImplementation(async (id: string) => (
        id === 'manager-1' ? { id: 'manager-1', company_id: 'company-1', role: 'Manager' } as never
          : { id: 'owner-1', company_id: 'company-1', role: 'Owner' } as never
      ))

      await expect(taskTemplateService.updateTemplate('template-1', { title: 'X' }, 'manager-1'))
        .rejects.toThrow('Only the user who created this template can perform this action')
      expect(taskTemplateRepository.updateTemplate).not.toHaveBeenCalled()
    })

    it('throws when the template does not exist', async () => {
      vi.mocked(taskTemplateRepository.getTemplateById).mockResolvedValue(null)

      await expect(taskTemplateService.updateTemplate('missing', { title: 'X' }, 'owner-1')).rejects.toThrow('Template not found')
    })

    it('throws when title is blank', async () => {
      vi.mocked(taskTemplateRepository.getTemplateById).mockResolvedValue(baseTemplate)

      await expect(taskTemplateService.updateTemplate('template-1', { title: '   ' }, 'owner-1')).rejects.toThrow('Please give this template a task title.')
    })
  })
})
