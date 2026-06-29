// LAYER: Service
// RULE: Business logic only. No HTTP handling. No direct DB access.

import { openAIService } from '@/services/ai/openAIService'
import { companyService } from '@/services/company/companyService'
import { taskAssignmentService } from '@/services/owner/taskAssignmentService'
import { taskRepository } from '@/repositories/owner/taskRepository'
import { AiAssignDraft, AiAssignSuggestion } from '@/types/AI'

async function generateDraft(input: {
  title: string
  description: string
  priority: string
  wantSubTasks: boolean
  departments: { id: string; name: string }[]
}): Promise<AiAssignDraft> {
  let draft: AiAssignDraft

  try {
    draft = await openAIService.generateStructuredJson<AiAssignDraft>({
      schemaName: 'ai_assign_draft',
      maxOutputTokens: 500,
      instructions: [
        'You are a workforce task planner for SMEs.',
        'Pick the single best-fit department for this task from the given list of departments by id - return the exact id from the list, never invent one.',
        input.description.trim()
          ? 'Lightly polish the given description for clarity and grammar, keeping its original meaning and length - do not invent new requirements.'
          : 'No description was given - write a 1-2 sentence description for this task based on its title and priority.',
        'Give a one-sentence reason for the department choice (e.g. "This task is related to promotion, suited to the Marketing department"). Do not name a specific assignee in this reason - the best-fit assignee is chosen separately from workload data, not by you.',
        input.wantSubTasks
          ? 'Break the task into 3 to 6 concrete completion steps, each with a short title (under 10 words) and a 1-sentence description.'
          : 'Return an empty steps array - this task should not be split into sub-tasks.',
      ].join(' '),
      input: { title: input.title, description: input.description, priority: input.priority, departments: input.departments },
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          department_id: { type: 'string' },
          description: { type: 'string' },
          reason: { type: 'string' },
          steps: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              properties: {
                title: { type: 'string' },
                description: { type: 'string' },
              },
              required: ['title', 'description'],
            },
          },
        },
        required: ['department_id', 'description', 'reason', 'steps'],
      },
    })
  } catch {
    draft = buildFallbackDraft(input)
  }

  if (!input.departments.some(d => d.id === draft.department_id)) {
    draft.department_id = input.departments[0].id
  }
  if (!draft.description.trim()) draft.description = input.description
  if (!input.wantSubTasks) draft.steps = []
  return draft
}

function buildFallbackDraft(input: {
  title: string
  description: string
  priority: string
  departments: { id: string; name: string }[]
}): AiAssignDraft {
  return {
    department_id: input.departments[0]?.id ?? '',
    description: input.description.trim() || `Complete: ${input.title}.`,
    reason: `This task best matches the ${input.departments[0]?.name ?? 'selected'} department.`,
    steps: [],
  }
}

export const aiTaskAssignService = {
  async generateAssignmentSuggestion(input: {
    company_id: string
    title: string
    description: string
    priority: string
    want_sub_tasks: boolean
    task_date?: string
  }): Promise<AiAssignSuggestion> {
    if (!input.title.trim()) throw new Error('title is required')

    const departments = await companyService.getDepartments(input.company_id)
    if (departments.length === 0) throw new Error('No departments found for this company')

    const draft = await generateDraft({
      title: input.title,
      description: input.description,
      priority: input.priority,
      wantSubTasks: input.want_sub_tasks,
      departments: departments.map(d => ({ id: d.id, name: d.name })),
    })

    const department = departments.find(d => d.id === draft.department_id) ?? departments[0]
    const allManagers = await companyService.getManagersByDepartment(input.company_id, department.id)

    // Only managers with a published shift on the task's date are real candidates — a draft
    // shift isn't a commitment, and someone with no shift at all on that date can't be assigned.
    const managers = input.task_date
      ? (await Promise.all(allManagers.map(async m => ({
          manager: m,
          eligible: await taskRepository.hasShiftOnDate(m.id, input.company_id, input.task_date!),
        }))))
          .filter(r => r.eligible)
          .map(r => r.manager)
      : allManagers

    let candidates: AiAssignSuggestion['candidates'] = []
    if (managers.length > 0) {
      const tasks = await taskRepository.getActiveTasksByAssignees(managers.map(m => m.id))
      candidates = taskAssignmentService.rankManagers(
        managers.map(m => ({
          id: m.id,
          full_name: m.full_name,
          active_tasks: tasks.filter(t => t.assigned_user_id === m.id),
        })),
      )
    }

    const recommended = candidates[0] ?? null
    const reason = recommended
      ? `${draft.reason} ${recommended.full_name} currently has the lightest workload among managers available on this date.`
      : draft.reason

    return {
      department_id: department.id,
      department_name: department.name,
      description: draft.description,
      recommended_manager_id: recommended?.id ?? null,
      reason,
      candidates,
      sub_tasks: draft.steps,
    }
  },
}
