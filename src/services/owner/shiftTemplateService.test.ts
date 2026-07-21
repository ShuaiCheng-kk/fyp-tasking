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

  // Shift templates are shared company-wide (any Owner/Partner can list, edit, or delete any
  // template) — not scoped to whoever happened to create it. Same policy as Task Templates.
  describe('listTemplates', () => {
    it('returns every template in the company, regardless of who created it', async () => {
      vi.mocked(shiftTemplateRepository.getTemplatesByCompany).mockResolvedValue([baseTemplate])

      const result = await shiftTemplateService.listTemplates('company-1')

      expect(shiftTemplateRepository.getTemplatesByCompany).toHaveBeenCalledWith('company-1')
      expect(result).toEqual([baseTemplate])
    })

    it('throws when company_id is missing', async () => {
      await expect(shiftTemplateService.listTemplates('')).rejects.toThrow('company_id is required')
    })
  })

  describe('deleteTemplate', () => {
    it('deletes an existing template', async () => {
      vi.mocked(shiftTemplateRepository.getTemplateById).mockResolvedValue(baseTemplate)
      vi.mocked(shiftTemplateRepository.deleteTemplate).mockResolvedValue(undefined)

      await shiftTemplateService.deleteTemplate('template-1')

      expect(shiftTemplateRepository.deleteTemplate).toHaveBeenCalledWith('template-1')
    })

    it('deletes a template even when created by someone else', async () => {
      vi.mocked(shiftTemplateRepository.getTemplateById).mockResolvedValue({ ...baseTemplate, created_by: 'someone-else' })
      vi.mocked(shiftTemplateRepository.deleteTemplate).mockResolvedValue(undefined)

      await shiftTemplateService.deleteTemplate('template-1')

      expect(shiftTemplateRepository.deleteTemplate).toHaveBeenCalledWith('template-1')
    })

    it('throws when the template does not exist', async () => {
      vi.mocked(shiftTemplateRepository.getTemplateById).mockResolvedValue(null)

      await expect(shiftTemplateService.deleteTemplate('missing')).rejects.toThrow('Template not found')
    })
  })

  describe('updateTemplate', () => {
    it('updates name and times for an existing template', async () => {
      vi.mocked(shiftTemplateRepository.getTemplateById).mockResolvedValue(baseTemplate)
      vi.mocked(shiftTemplateRepository.updateTemplate).mockResolvedValue({
        ...baseTemplate,
        name: 'Late Shift',
        start_time: '12:00',
        end_time: '20:00',
      })

      const result = await shiftTemplateService.updateTemplate('template-1', {
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

    it('updates a template even when created by someone else', async () => {
      vi.mocked(shiftTemplateRepository.getTemplateById).mockResolvedValue({ ...baseTemplate, created_by: 'someone-else' })
      vi.mocked(shiftTemplateRepository.updateTemplate).mockResolvedValue({ ...baseTemplate, name: 'Renamed' })

      await shiftTemplateService.updateTemplate('template-1', { name: 'Renamed' })

      expect(shiftTemplateRepository.updateTemplate).toHaveBeenCalledWith('template-1', {
        name: 'Renamed',
        start_time: baseTemplate.start_time,
        end_time: baseTemplate.end_time,
      })
    })

    it('falls back to existing values for fields not provided', async () => {
      vi.mocked(shiftTemplateRepository.getTemplateById).mockResolvedValue(baseTemplate)
      vi.mocked(shiftTemplateRepository.updateTemplate).mockResolvedValue(baseTemplate)

      await shiftTemplateService.updateTemplate('template-1', { name: 'Renamed' })

      expect(shiftTemplateRepository.updateTemplate).toHaveBeenCalledWith('template-1', {
        name: 'Renamed',
        start_time: baseTemplate.start_time,
        end_time: baseTemplate.end_time,
      })
    })

    it('throws when the template does not exist', async () => {
      vi.mocked(shiftTemplateRepository.getTemplateById).mockResolvedValue(null)

      await expect(shiftTemplateService.updateTemplate('missing', { name: 'X' })).rejects.toThrow('Template not found')
    })

    it('throws when name is blank', async () => {
      vi.mocked(shiftTemplateRepository.getTemplateById).mockResolvedValue(baseTemplate)

      await expect(shiftTemplateService.updateTemplate('template-1', { name: '   ' })).rejects.toThrow('Please name this template.')
    })

    it('rejects when start_time is not before end_time', async () => {
      vi.mocked(shiftTemplateRepository.getTemplateById).mockResolvedValue(baseTemplate)

      await expect(shiftTemplateService.updateTemplate('template-1', { start_time: '18:00', end_time: '09:00' })).rejects.toThrow('start_time must be before end_time')
    })
  })
})
