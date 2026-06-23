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

}
