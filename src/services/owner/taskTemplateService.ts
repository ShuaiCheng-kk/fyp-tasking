// LAYER: Service
// RULE: Business logic only. No HTTP handling. No direct DB access.

import { taskTemplateRepository } from '@/repositories/owner/taskTemplateRepository'
import { taskRepository } from '@/repositories/owner/taskRepository'
import { TaskTemplate, TaskTemplateInput, TaskTemplateUpdateInput } from '@/types/TaskTemplate'

// Mirrors assertIsTaskOwner in taskService.ts: only the creator may edit/delete their own
// template. Owner and Partner are peer "assigner" roles over the same company, so either may
// also act on a template the OTHER one created — Manager creators are unaffected, still
// creator-only, no peer widening (a Manager can't touch a peer manager's template).
async function assertIsTemplateOwner(templateId: string, actingUserId?: string | null): Promise<TaskTemplate> {
  const template = await taskTemplateRepository.getTemplateById(templateId)
  if (!template) throw new Error('Template not found')
  if (!actingUserId) throw new Error('Only the user who created this template can perform this action')
  if (template.created_by === actingUserId) return template
  const [actingUser, creator] = await Promise.all([
    taskRepository.getUserById(actingUserId),
    taskRepository.getUserById(template.created_by),
  ])
  const ownerPartner = ['Owner', 'Partner']
  if (
    actingUser && creator &&
    actingUser.company_id === creator.company_id &&
    ownerPartner.includes(actingUser.role) &&
    ownerPartner.includes(creator.role)
  ) {
    return template
  }
  throw new Error('Only the user who created this template can perform this action')
}

export const taskTemplateService = {

  async createTemplate(input: TaskTemplateInput): Promise<TaskTemplate> {
    if (!input.company_id || !input.title || !input.created_by) {
      throw new Error('Missing required task template fields')
    }
    return taskTemplateRepository.createTemplate({
      ...input,
      sub_task_titles: (input.sub_task_titles ?? []).map(t => t.trim()).filter(Boolean),
    })
  },

  // department_ids omitted → Owner/Partner see only their own Owner/Partner-tier templates
  // (never a Manager's department template). Passed (Manager, resolved server-side from
  // manager_scope_id) → only templates tagged to their own department — never another
  // department's, and never an Owner/Partner template (those carry no department at all).
  async listTemplates(company_id: string, department_ids?: string[]): Promise<TaskTemplate[]> {
    if (!company_id) throw new Error('company_id is required')
    return taskTemplateRepository.getTemplatesByCompany(company_id, department_ids)
  },

  async deleteTemplate(id: string, actingUserId?: string | null): Promise<void> {
    if (!id) throw new Error('Template id is required')
    await assertIsTemplateOwner(id, actingUserId)
    await taskTemplateRepository.deleteTemplate(id)
  },

  async updateTemplate(id: string, fields: TaskTemplateUpdateInput, actingUserId?: string | null): Promise<TaskTemplate> {
    if (!id) throw new Error('Template id is required')
    const existing = await assertIsTemplateOwner(id, actingUserId)
    const title = fields.title !== undefined ? fields.title.trim() : existing.title
    if (!title) throw new Error('Please give this template a task title.')
    const description = fields.description !== undefined ? fields.description : existing.description
    const priority = fields.priority !== undefined ? fields.priority : existing.priority
    const department_id = fields.department_id !== undefined ? fields.department_id : existing.department_id
    const sub_task_titles = fields.sub_task_titles !== undefined
      ? fields.sub_task_titles.map(t => t.trim()).filter(Boolean)
      : existing.sub_task_titles
    return taskTemplateRepository.updateTemplate(id, { title, description, priority, department_id, sub_task_titles })
  },

}
