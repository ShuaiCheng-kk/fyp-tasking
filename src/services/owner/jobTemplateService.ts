// LAYER: Service
// RULE: Business logic only. No HTTP handling. No direct DB access.

import { jobTemplateRepository } from '@/repositories/owner/jobTemplateRepository'
import { JobTemplate, JobTemplateInput, JobTemplateUpdateInput } from '@/types/JobTemplate'

export const jobTemplateService = {

  async createTemplate(input: JobTemplateInput): Promise<JobTemplate> {
    if (!input.company_id || !input.name?.trim() || !input.title?.trim() || !input.created_by) {
      throw new Error('Missing required job template fields')
    }
    return jobTemplateRepository.createTemplate(input)
  },

  async listTemplates(company_id: string): Promise<JobTemplate[]> {
    if (!company_id) throw new Error('company_id is required')
    return jobTemplateRepository.getTemplatesByCompany(company_id)
  },

  async deleteTemplate(id: string): Promise<void> {
    if (!id) throw new Error('Template id is required')
    const existing = await jobTemplateRepository.getTemplateById(id)
    if (!existing) throw new Error('Template not found')
    await jobTemplateRepository.deleteTemplate(id)
  },

  async updateTemplate(id: string, fields: JobTemplateUpdateInput): Promise<JobTemplate> {
    if (!id) throw new Error('Template id is required')
    const existing = await jobTemplateRepository.getTemplateById(id)
    if (!existing) throw new Error('Template not found')
    const name = fields.name !== undefined ? fields.name.trim() : existing.name
    if (!name) throw new Error('Please name this template.')
    const title = fields.title !== undefined ? fields.title.trim() : existing.title
    if (!title) throw new Error('Please give this template a job title.')
    const description = fields.description !== undefined ? fields.description : existing.description
    const requirements = fields.requirements !== undefined ? fields.requirements : existing.requirements
    const employment_type = fields.employment_type !== undefined ? fields.employment_type : existing.employment_type
    const form_type = fields.form_type !== undefined ? fields.form_type : existing.form_type
    return jobTemplateRepository.updateTemplate(id, { name, title, description, requirements, employment_type, form_type })
  },

}
