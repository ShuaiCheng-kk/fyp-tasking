import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase', () => ({
  supabase: {},
  createClient: () => ({}),
}))

vi.mock('@/repositories/owner/shiftTemplateRepository', () => ({
  shiftTemplateRepository: {
    createTemplate: vi.fn(),
    getTemplatesByCompany: vi.fn(),
    getTemplateById: vi.fn(),
    deleteTemplate: vi.fn(),
    updateTemplate: vi.fn(),
  },
}))

import { shiftTemplateService } from './shiftTemplateService'
import { shiftTemplateRepository } from '@/repositories/owner/shiftTemplateRepository'

const baseTemplate = {
  id: 'template-1',
  company_id: 'company-1',
  name: 'Morning Shift',
  start_time: '09:00',
  end_time: '17:00',
  created_by: 'owner-1',
  created_at: '2026-06-01T00:00:00.000Z',
}

describe('shiftTemplateService — Shift Template', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('createTemplate', () => {
    it('creates a template with valid input', async () => {
      vi.mocked(shiftTemplateRepository.createTemplate).mockResolvedValue(baseTemplate)

      const result = await shiftTemplateService.createTemplate({
        company_id: 'company-1',
        name: 'Morning Shift',
        start_time: '09:00',
        end_time: '17:00',
        created_by: 'owner-1',
      })

      expect(shiftTemplateRepository.createTemplate).toHaveBeenCalledWith({
        company_id: 'company-1',
        name: 'Morning Shift',
        start_time: '09:00',
        end_time: '17:00',
        created_by: 'owner-1',
      })
      expect(result).toEqual(baseTemplate)
    })

    it('throws when required fields are missing', async () => {
      await expect(shiftTemplateService.createTemplate({
        company_id: '',
        name: 'Morning Shift',
        start_time: '09:00',
        end_time: '17:00',
        created_by: 'owner-1',
      })).rejects.toThrow('Missing required shift template fields')
    })

    it('rejects when start_time is not before end_time', async () => {
      await expect(shiftTemplateService.createTemplate({
        company_id: 'company-1',
        name: 'Morning Shift',
        start_time: '18:00',
        end_time: '09:00',
        created_by: 'owner-1',
      })).rejects.toThrow('start_time must be before end_time')
    })
  })

  describe('listTemplates', () => {
    it('returns templates created by the requesting user', async () => {
      vi.mocked(shiftTemplateRepository.getTemplatesByCompany).mockResolvedValue([baseTemplate])

      const result = await shiftTemplateService.listTemplates('company-1', 'owner-1')

      expect(shiftTemplateRepository.getTemplatesByCompany).toHaveBeenCalledWith('company-1', 'owner-1')
      expect(result).toEqual([baseTemplate])
    })

    it('throws when company_id is missing', async () => {
      await expect(shiftTemplateService.listTemplates('', 'owner-1')).rejects.toThrow('company_id is required')
    })

    it('throws when created_by is missing', async () => {
      await expect(shiftTemplateService.listTemplates('company-1', '')).rejects.toThrow('created_by is required')
    })
  })

  describe('deleteTemplate', () => {
    it('deletes an existing template owned by the requester', async () => {
      vi.mocked(shiftTemplateRepository.getTemplateById).mockResolvedValue(baseTemplate)
      vi.mocked(shiftTemplateRepository.deleteTemplate).mockResolvedValue(undefined)

      await shiftTemplateService.deleteTemplate('template-1', 'owner-1')

      expect(shiftTemplateRepository.deleteTemplate).toHaveBeenCalledWith('template-1')
    })

    it('throws when the template does not exist', async () => {
      vi.mocked(shiftTemplateRepository.getTemplateById).mockResolvedValue(null)

      await expect(shiftTemplateService.deleteTemplate('missing', 'owner-1')).rejects.toThrow('Template not found')
    })

    it('throws when the requester did not create the template', async () => {
      vi.mocked(shiftTemplateRepository.getTemplateById).mockResolvedValue(baseTemplate)

      await expect(shiftTemplateService.deleteTemplate('template-1', 'someone-else')).rejects.toThrow('You can only delete templates you created')
      expect(shiftTemplateRepository.deleteTemplate).not.toHaveBeenCalled()
    })
  })

  describe('updateTemplate', () => {
    it('updates name and times for an existing template owned by the requester', async () => {
      vi.mocked(shiftTemplateRepository.getTemplateById).mockResolvedValue(baseTemplate)
      vi.mocked(shiftTemplateRepository.updateTemplate).mockResolvedValue({
        ...baseTemplate,
        name: 'Late Shift',
        start_time: '12:00',
        end_time: '20:00',
      })

      const result = await shiftTemplateService.updateTemplate('template-1', 'owner-1', {
        name: 'Late Shift',
        start_time: '12:00',
        end_time: '20:00',
      })

      expect(shiftTemplateRepository.updateTemplate).toHaveBeenCalledWith('template-1', {
        name: 'Late Shift',
        start_time: '12:00',
        end_time: '20:00',
      })
      expect(result.name).toBe('Late Shift')
    })

    it('falls back to existing values for fields not provided', async () => {
      vi.mocked(shiftTemplateRepository.getTemplateById).mockResolvedValue(baseTemplate)
      vi.mocked(shiftTemplateRepository.updateTemplate).mockResolvedValue(baseTemplate)

      await shiftTemplateService.updateTemplate('template-1', 'owner-1', { name: 'Renamed' })

      expect(shiftTemplateRepository.updateTemplate).toHaveBeenCalledWith('template-1', {
        name: 'Renamed',
        start_time: baseTemplate.start_time,
        end_time: baseTemplate.end_time,
      })
    })

    it('throws when the template does not exist', async () => {
      vi.mocked(shiftTemplateRepository.getTemplateById).mockResolvedValue(null)

      await expect(shiftTemplateService.updateTemplate('missing', 'owner-1', { name: 'X' })).rejects.toThrow('Template not found')
    })

    it('throws when the requester did not create the template', async () => {
      vi.mocked(shiftTemplateRepository.getTemplateById).mockResolvedValue(baseTemplate)

      await expect(shiftTemplateService.updateTemplate('template-1', 'someone-else', { name: 'X' })).rejects.toThrow('You can only edit templates you created')
      expect(shiftTemplateRepository.updateTemplate).not.toHaveBeenCalled()
    })

    it('throws when name is blank', async () => {
      vi.mocked(shiftTemplateRepository.getTemplateById).mockResolvedValue(baseTemplate)

      await expect(shiftTemplateService.updateTemplate('template-1', 'owner-1', { name: '   ' })).rejects.toThrow('Please name this template.')
    })

    it('rejects when start_time is not before end_time', async () => {
      vi.mocked(shiftTemplateRepository.getTemplateById).mockResolvedValue(baseTemplate)

      await expect(shiftTemplateService.updateTemplate('template-1', 'owner-1', { start_time: '18:00', end_time: '09:00' })).rejects.toThrow('start_time must be before end_time')
    })
  })
})
