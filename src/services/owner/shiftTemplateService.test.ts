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
    it('returns templates for a company', async () => {
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

    it('throws when the template does not exist', async () => {
      vi.mocked(shiftTemplateRepository.getTemplateById).mockResolvedValue(null)

      await expect(shiftTemplateService.deleteTemplate('missing')).rejects.toThrow('Template not found')
    })
  })
})
