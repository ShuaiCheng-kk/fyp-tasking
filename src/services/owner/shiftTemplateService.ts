// LAYER: Service
// RULE: Business logic only. No HTTP handling. No direct DB access.

import { shiftTemplateRepository } from '@/repositories/owner/shiftTemplateRepository'
import { ShiftTemplate, ShiftTemplateInput } from '@/types/ShiftTemplate'

export const shiftTemplateService = {

  async createTemplate(input: ShiftTemplateInput): Promise<ShiftTemplate> {
    if (!input.company_id || !input.name || !input.start_time || !input.end_time || !input.created_by) {
      throw new Error('Missing required shift template fields')
    }
    if (input.start_time >= input.end_time) {
      throw new Error('start_time must be before end_time')
    }
    return shiftTemplateRepository.createTemplate(input)
  },

  async listTemplates(company_id: string): Promise<ShiftTemplate[]> {
    if (!company_id) throw new Error('company_id is required')
    return shiftTemplateRepository.getTemplatesByCompany(company_id)
  },

  async deleteTemplate(id: string): Promise<void> {
    if (!id) throw new Error('Template id is required')
    const existing = await shiftTemplateRepository.getTemplateById(id)
    if (!existing) throw new Error('Template not found')
    await shiftTemplateRepository.deleteTemplate(id)
  },

  async updateTemplate(id: string, fields: Partial<Pick<ShiftTemplateInput, 'name' | 'start_time' | 'end_time'>>): Promise<ShiftTemplate> {
    if (!id) throw new Error('Template id is required')
    const existing = await shiftTemplateRepository.getTemplateById(id)
    if (!existing) throw new Error('Template not found')
    const name = fields.name !== undefined ? fields.name.trim() : existing.name
    if (!name) throw new Error('Please name this template.')
    const start_time = fields.start_time ?? existing.start_time
    const end_time = fields.end_time ?? existing.end_time
    if (start_time >= end_time) throw new Error('start_time must be before end_time')
    return shiftTemplateRepository.updateTemplate(id, { name, start_time, end_time })
  },

}
