// LAYER: Service
// RULE: Business logic only. No HTTP handling. No direct DB access.

import { jobTemplateRepository } from '@/repositories/owner/jobTemplateRepository'
import { JobTemplate, JobTemplateInput, JobTemplateUpdateInput, JobTemplateUsageStats } from '@/types/JobTemplate'

export const jobTemplateService = {

  async createTemplate(input: JobTemplateInput): Promise<JobTemplate> {
    if (!input.company_id || !input.name?.trim() || !input.title?.trim() || !input.created_by) {
      throw new Error('Missing required job template fields')
    }
    return jobTemplateRepository.createTemplate(input)
  },

  async listTemplates(company_id: string, created_by: string): Promise<JobTemplate[]> {
    if (!company_id) throw new Error('company_id is required')
    if (!created_by) throw new Error('created_by is required')
    return jobTemplateRepository.getTemplatesByCompany(company_id, created_by)
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
    const department_id = fields.department_id !== undefined ? fields.department_id : existing.department_id
    const salary_amount = fields.salary_amount !== undefined ? fields.salary_amount : existing.salary_amount
    const salary_type = fields.salary_type !== undefined ? fields.salary_type : existing.salary_type
    const uniform_required = fields.uniform_required !== undefined ? fields.uniform_required : existing.uniform_required
    const uniform_type = fields.uniform_type !== undefined ? fields.uniform_type : existing.uniform_type
    const uniform_details = fields.uniform_details !== undefined ? fields.uniform_details : existing.uniform_details
    const experience_required = fields.experience_required !== undefined ? fields.experience_required : existing.experience_required
    const minimum_age = fields.minimum_age !== undefined ? fields.minimum_age : existing.minimum_age
    const estimated_hours = fields.estimated_hours !== undefined ? fields.estimated_hours : existing.estimated_hours
    const urgency = fields.urgency !== undefined ? fields.urgency : existing.urgency
    return jobTemplateRepository.updateTemplate(id, {
      name, title, description, requirements, employment_type, form_type,
      department_id, salary_amount, salary_type,
      uniform_required, uniform_type, uniform_details, experience_required, minimum_age,
      estimated_hours, urgency,
    })
  },

  async getTemplateUsageStats(id: string): Promise<JobTemplateUsageStats> {
    if (!id) throw new Error('Template id is required')
    const existing = await jobTemplateRepository.getTemplateById(id)
    if (!existing) throw new Error('Template not found')
    return jobTemplateRepository.getUsageStats(id)
  },

}
