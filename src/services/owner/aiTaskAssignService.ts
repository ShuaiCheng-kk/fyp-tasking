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
  departments: { id: string; name: string }[]
}): Promise<AiAssignDraft> {
  let draft: AiAssignDraft

  try {
    draft = await openAIService.generateStructuredJson<AiAssignDraft>({
      schemaName: 'ai_assign_draft',
      maxOutputTokens: 700,
      instructions: [
        'You are a workforce task planner for SMEs.',
        'Given a task title, description, and priority, break the task down into 3 to 6 concrete completion steps.',
        'Each step needs a short title (under 10 words) and a 1-sentence description.',
        'Pick the single best-fit department for this task from the given list of departments by id - return the exact id from the list, never invent one.',
        'Estimate due_in_days: how many days from today this task should realistically be completed in, based on priority (Urgent = 1-2 days, High = 2-4 days, Medium = 4-7 days, Low = 7-14 days) and the number/complexity of the steps.',
      ].join(' '),
      input,
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
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
          department_id: { type: 'string' },
          due_in_days: { type: 'integer' },
        },
        required: ['steps', 'department_id', 'due_in_days'],
      },
    })
  } catch {
    draft = buildFallbackDraft(input)
  }

  if (!input.departments.some(d => d.id === draft.department_id)) {
    draft.department_id = input.departments[0].id
  }
  return draft
}

function buildFallbackDraft(input: {
  title: string
  description: string
  priority: string
  departments: { id: string; name: string }[]
}): AiAssignDraft {
  const dueByPriority: Record<string, number> = {
    Urgent: 1,
    High: 3,
    Medium: 5,
    Low: 10,
  }
  return {
    department_id: input.departments[0]?.id ?? '',
    due_in_days: dueByPriority[input.priority] ?? 5,
    steps: [
      { title: 'Confirm scope', description: `Review the requirements for ${input.title}.` },
      { title: 'Assign owner', description: 'Choose the best available manager for delivery.' },
      { title: 'Track completion', description: 'Move the task through review and completion.' },
    ],
  }
}

export const aiTaskAssignService = {
  async generateAssignmentSuggestion(input: {
    company_id: string
    title: string
    description: string
    priority: string
    people_needed: number
    task_date?: string
  }): Promise<AiAssignSuggestion> {
    if (!input.title.trim()) throw new Error('title is required')

    const departments = await companyService.getDepartments(input.company_id)
    if (departments.length === 0) throw new Error('No departments found for this company')

    const draft = await generateDraft({
      title: input.title,
      description: input.description,
      priority: input.priority,
      departments: departments.map(d => ({ id: d.id, name: d.name })),
    })

    const department = departments.find(d => d.id === draft.department_id) ?? departments[0]
    const managers = await companyService.getManagersByDepartment(input.company_id, department.id)

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

    const dueAt = input.task_date ? new Date(`${input.task_date}T00:00:00`) : new Date()
    dueAt.setDate(dueAt.getDate() + draft.due_in_days)
    dueAt.setHours(18, 0, 0, 0)

    const peopleNeeded = Math.min(Math.max(input.people_needed, 1), 3)

    return {
      steps: draft.steps,
      department_id: department.id,
      department_name: department.name,
      due_at: dueAt.toISOString(),
      candidates,
      suggested_manager_ids: candidates.slice(0, peopleNeeded).map(c => c.id),
    }
  },
}
