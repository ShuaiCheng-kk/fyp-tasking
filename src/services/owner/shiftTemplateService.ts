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

  async listTemplates(company_id: string, created_by: string): Promise<ShiftTemplate[]> {
    if (!company_id) throw new Error('company_id is required')
    if (!created_by) throw new Error('created_by is required')
    return shiftTemplateRepository.getTemplatesByCompany(company_id, created_by)
  },

  async deleteTemplate(id: string, requested_by: string): Promise<void> {
    if (!id) throw new Error('Template id is required')
    if (!requested_by) throw new Error('requested_by is required')
    const existing = await shiftTemplateRepository.getTemplateById(id)
    if (!existing) throw new Error('Template not found')
    if (existing.created_by !== requested_by) throw new Error('You can only delete templates you created')
    await shiftTemplateRepository.deleteTemplate(id)
  },

  async updateTemplate(id: string, requested_by: string, fields: Partial<Pick<ShiftTemplateInput, 'name' | 'start_time' | 'end_time'>>): Promise<ShiftTemplate> {
    if (!id) throw new Error('Template id is required')
    if (!requested_by) throw new Error('requested_by is required')
    const existing = await shiftTemplateRepository.getTemplateById(id)
    if (!existing) throw new Error('Template not found')
    if (existing.created_by !== requested_by) throw new Error('You can only edit templates you created')
    const name = fields.name !== undefined ? fields.name.trim() : existing.name
    if (!name) throw new Error('Please name this template.')
    const start_time = fields.start_time ?? existing.start_time
    const end_time = fields.end_time ?? existing.end_time
    if (start_time >= end_time) throw new Error('start_time must be before end_time')
    return shiftTemplateRepository.updateTemplate(id, { name, start_time, end_time })
  },

}
