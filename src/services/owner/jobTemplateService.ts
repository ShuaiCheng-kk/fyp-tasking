// LAYER: Service
// RULE: Business logic only. No HTTP handling. No direct DB access.

import { jobTemplateRepository } from '@/repositories/owner/jobTemplateRepository'
import { JobTemplate, JobTemplateInput, JobTemplateUpdateInput, JobTemplateUsageStats } from '@/types/JobTemplate'

export const jobTemplateService = {

  // UC35: Title, Responsibilities, Skills, Department, and Pay amount are all required to save a
  // template — mirrors the check the Create Job wizard's "Save as Template" button already does
  // client-side, so a caller that bypasses the UI can't skip it.
  async createTemplate(input: JobTemplateInput): Promise<JobTemplate> {
    if (!input.company_id || !input.title?.trim() || !input.created_by) {
      throw new Error('Missing required job template fields')
    }
    if (!input.responsibilities?.trim()) throw new Error('Responsibilities is required to save a template')
    if (!input.skills?.trim()) throw new Error('Skills is required to save a template')
    if (!input.department_id) throw new Error('Department is required to save a template')
    if (input.salary_amount === undefined || input.salary_amount === null) {
      throw new Error('Pay amount is required to save a template')
    }
    return jobTemplateRepository.createTemplate(input)
  },

  // department_ids omitted → Owner/Partner see every template in the company (their own
  // Owner/Partner-only templates plus every Manager's). Passed (Manager, resolved server-side
  // from manager_scope_id) → only templates tagged to their own department — never another
  // department's, and never an Owner/Partner template (those carry no department at all).
  async listTemplates(company_id: string, department_ids?: string[]): Promise<JobTemplate[]> {
    if (!company_id) throw new Error('company_id is required')
    return jobTemplateRepository.getTemplatesByCompany(company_id, department_ids)
  },

  async deleteTemplate(id: string, company_id: string): Promise<void> {
    if (!id) throw new Error('Template id is required')
    const existing = await jobTemplateRepository.getTemplateById(id)
    if (!existing) throw new Error('Template not found')
    if (existing.company_id !== company_id) throw new Error('You can only manage your own company\'s templates')
    await jobTemplateRepository.deleteTemplate(id)
  },

  async updateTemplate(id: string, fields: JobTemplateUpdateInput, company_id: string): Promise<JobTemplate> {
    if (!id) throw new Error('Template id is required')
    const existing = await jobTemplateRepository.getTemplateById(id)
    if (!existing) throw new Error('Template not found')
    if (existing.company_id !== company_id) throw new Error('You can only manage your own company\'s templates')
    const title = fields.title !== undefined ? fields.title.trim() : existing.title
    if (!title) throw new Error('Please give this template a job title.')
    const responsibilities = fields.responsibilities !== undefined ? fields.responsibilities : existing.responsibilities
    const skills = fields.skills !== undefined ? fields.skills : existing.skills
    const job_type = fields.job_type !== undefined ? fields.job_type : existing.job_type
    const department_id = fields.department_id !== undefined ? fields.department_id : existing.department_id
    const salary_amount = fields.salary_amount !== undefined ? fields.salary_amount : existing.salary_amount
    const uniform_type = fields.uniform_type !== undefined ? fields.uniform_type : existing.uniform_type
    const uniform_details = fields.uniform_details !== undefined ? fields.uniform_details : existing.uniform_details
    const experience_required = fields.experience_required !== undefined ? fields.experience_required : existing.experience_required
    const minimum_age = fields.minimum_age !== undefined ? fields.minimum_age : existing.minimum_age
    const estimated_hours = fields.estimated_hours !== undefined ? fields.estimated_hours : existing.estimated_hours
    const urgency = fields.urgency !== undefined ? fields.urgency : existing.urgency
    // UC36: Job Type, Responsibilities, Skills, Department, and Pay amount are all required to
    // save changes — same required-field list as UC35's create, checked here against the merged
    // (existing + incoming) values so clearing a field via a direct API call is caught too.
    if (!job_type) throw new Error('Job Type is required to save this template')
    if (!responsibilities?.trim()) throw new Error('Responsibilities is required to save this template')
    if (!skills?.trim()) throw new Error('Skills is required to save this template')
    if (!department_id) throw new Error('Department is required to save this template')
    if (salary_amount === undefined || salary_amount === null) {
      throw new Error('Pay amount is required to save this template')
    }
    return jobTemplateRepository.updateTemplate(id, {
      title, responsibilities, skills, job_type,
      department_id, salary_amount,
      uniform_type, uniform_details, experience_required, minimum_age,
      estimated_hours, urgency,
    })
  },

  async getTemplateUsageStats(id: string, company_id: string): Promise<JobTemplateUsageStats> {
    if (!id) throw new Error('Template id is required')
    const existing = await jobTemplateRepository.getTemplateById(id)
    if (!existing) throw new Error('Template not found')
    if (existing.company_id !== company_id) throw new Error('You can only manage your own company\'s templates')
    return jobTemplateRepository.getUsageStats(id)
  },

}
