// LAYER: Service
// RULE: Business logic only. No HTTP handling. No direct DB access.

import { taskTemplateRepository } from '@/repositories/owner/taskTemplateRepository'
import { TaskTemplate, TaskTemplateInput, TaskTemplateUpdateInput } from '@/types/TaskTemplate'

export const taskTemplateService = {

  async createTemplate(input: TaskTemplateInput): Promise<TaskTemplate> {
    if (!input.company_id || !input.name || !input.title || !input.created_by) {
      throw new Error('Missing required task template fields')
    }
    return taskTemplateRepository.createTemplate(input)
  },

  async listTemplates(company_id: string): Promise<TaskTemplate[]> {
    if (!company_id) throw new Error('company_id is required')
    return taskTemplateRepository.getTemplatesByCompany(company_id)
  },

  async deleteTemplate(id: string): Promise<void> {
    if (!id) throw new Error('Template id is required')
    const existing = await taskTemplateRepository.getTemplateById(id)
    if (!existing) throw new Error('Template not found')
    await taskTemplateRepository.deleteTemplate(id)
  },

  async updateTemplate(id: string, fields: TaskTemplateUpdateInput): Promise<TaskTemplate> {
    if (!id) throw new Error('Template id is required')
    const existing = await taskTemplateRepository.getTemplateById(id)
    if (!existing) throw new Error('Template not found')
    const name = fields.name !== undefined ? fields.name.trim() : existing.name
    if (!name) throw new Error('Please name this template.')
    const title = fields.title !== undefined ? fields.title.trim() : existing.title
    if (!title) throw new Error('Please give this template a task title.')
    const description = fields.description !== undefined ? fields.description : existing.description
    const priority = fields.priority !== undefined ? fields.priority : existing.priority
    return taskTemplateRepository.updateTemplate(id, { name, title, description, priority })
  },

}
