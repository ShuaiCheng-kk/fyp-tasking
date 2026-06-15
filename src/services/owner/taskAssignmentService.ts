// LAYER: Service
// RULE: Business logic only. No HTTP handling. No direct DB access.

import { openAIService } from '@/services/ai/openAIService'
import { TaskAssignmentDraft } from '@/types/AI'

export interface AssignmentCandidate {
  id: string
  name: string
  role: string
  department_name?: string | null
  skills?: string[]
  recent_task_titles?: string[]
  active_task_count: number
  current_task_count: number
  completed_task_count?: number
}

export const taskAssignmentService = {
  async recommendAssignee(input: {
    task_title: string
    task_description?: string | null
    task_priority?: string | null
    department_name?: string | null
    candidates: AssignmentCandidate[]
  }): Promise<TaskAssignmentDraft> {
    if (!input.task_title.trim()) throw new Error('task_title is required')
    if (!input.candidates.length) throw new Error('No candidates provided')

    return openAIService.generateStructuredJson<TaskAssignmentDraft>({
      schemaName: 'task_assignment_draft',
      maxOutputTokens: 700,
      instructions: [
        'You are a smart task assignment advisor for SME workforce management.',
        'Given a task and a list of team members with skills, recent task history, and current workloads, recommend the top candidates (up to 3) to assign this task to.',
        'This recommendation must support both skill-based task matching and workload balancing.',
        'Skill matching: compare the task title, description, priority, and department against each candidate skills, department, role, and recent task titles.',
        'Workload balancing: prefer candidates with fewer active tasks, but do not ignore a clearly stronger skill match for urgent or specialised work.',
        'Assign a fit score from 0 to 100. Categorise as: strong (80+), good (60-79), fair (below 60).',
        'Set workload_level to light, balanced, or heavy based mainly on active_task_count.',
        'Set skill_match to strong, partial, or weak. Include 1-3 short skill_evidence items using only evidence from the input.',
        'Write a concise 1-2 sentence reason explaining the overall recommendation and a separate workload_reason.',
        'Always return the exact candidate id and name from the input — never invent new ones.',
        'Return candidates sorted by score descending.',
      ].join(' '),
      input,
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          recommendations: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              properties: {
                candidate_id:   { type: 'string' },
                candidate_name: { type: 'string' },
                score:          { type: 'number' },
                fit:            { type: 'string', enum: ['strong', 'good', 'fair'] },
                workload_level: { type: 'string', enum: ['light', 'balanced', 'heavy'] },
                skill_match:    { type: 'string', enum: ['strong', 'partial', 'weak'] },
                skill_evidence: {
                  type: 'array',
                  items: { type: 'string' },
                },
                reason:         { type: 'string' },
                workload_reason:{ type: 'string' },
              },
              required: ['candidate_id', 'candidate_name', 'score', 'fit', 'workload_level', 'skill_match', 'skill_evidence', 'reason', 'workload_reason'],
            },
          },
        },
        required: ['recommendations'],
      },
    })
  },
}
