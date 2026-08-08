// LAYER: Service
// RULE: Business logic only. No HTTP handling. No direct DB access.

import { shiftTemplateRepository } from '@/repositories/owner/shiftTemplateRepository'
import { ShiftTemplate, ShiftTemplateInput } from '@/types/ShiftTemplate'

export const shiftTemplateService = {

  async createTemplate(input: ShiftTemplateInput): Promise<ShiftTemplate> {
    if (!input.company_id || !input.name || !input.start_time || !input.end_time || !input.created_by) {
      throw new Error('Missing required shift template fields')
    }
    // BUG-021: overnight templates (e.g. a Night Shift ending the following day) are valid —
    // end_time <= start_time is only rejected when they're exactly equal (zero-length, ambiguous).
    if (input.start_time === input.end_time) {
      throw new Error('start_time and end_time cannot be the same')
    }
    return shiftTemplateRepository.createTemplate(input)
  },

  // Shift templates are shared across the whole company (any Owner/Partner can use, edit, or
  // delete any of them) — not scoped to whoever happened to create it. Same policy as Task
  // Templates (taskTemplateService), which never gated on created_by either.
  async listTemplates(company_id: string): Promise<ShiftTemplate[]> {
    if (!company_id) throw new Error('company_id is required')
    return shiftTemplateRepository.getTemplatesByCompany(company_id)
  },

  async deleteTemplate(id: string, company_id: string): Promise<void> {
    if (!id) throw new Error('Template id is required')
    const existing = await shiftTemplateRepository.getTemplateById(id)
    if (!existing) throw new Error('Template not found')
    if (existing.company_id !== company_id) throw new Error('You can only manage your own company\'s templates')
    await shiftTemplateRepository.deleteTemplate(id)
  },

  async updateTemplate(id: string, fields: Partial<Pick<ShiftTemplateInput, 'name' | 'start_time' | 'end_time'>>, company_id: string): Promise<ShiftTemplate> {
    if (!id) throw new Error('Template id is required')
    const existing = await shiftTemplateRepository.getTemplateById(id)
    if (!existing) throw new Error('Template not found')
    if (existing.company_id !== company_id) throw new Error('You can only manage your own company\'s templates')
    const name = fields.name !== undefined ? fields.name.trim() : existing.name
    if (!name) throw new Error('Please name this template.')
    const start_time = fields.start_time ?? existing.start_time
    const end_time = fields.end_time ?? existing.end_time
    // BUG-021: overnight templates are valid — see createTemplate's comment above.
    if (start_time === end_time) throw new Error('start_time and end_time cannot be the same')
    return shiftTemplateRepository.updateTemplate(id, { name, start_time, end_time })
  },

}
