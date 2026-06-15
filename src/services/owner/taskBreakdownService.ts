// LAYER: Service
// RULE: Business logic only. No HTTP handling. No direct DB access.

import { openAIService } from '@/services/ai/openAIService'
import { TaskBreakdownDraft } from '@/types/AI'

export const taskBreakdownService = {
  async generateTasks(input: {
    context: string
    shift_title?: string | null
    department_name?: string | null
    shift_date?: string | null
    start_time?: string | null
    end_time?: string | null
  }): Promise<TaskBreakdownDraft> {
    if (!input.context.trim()) throw new Error('context is required')

    return openAIService.generateStructuredJson<TaskBreakdownDraft>({
      schemaName: 'task_breakdown_draft',
      maxOutputTokens: 650,
      instructions: [
        'You are a workforce task planner for SMEs.',
        'Given a shift or work context, generate a practical list of 5 to 8 specific tasks that need to be completed.',
        'Each task should be concrete and actionable, not vague.',
        'Assign a realistic priority based on urgency and importance.',
        'Keep task titles short (under 10 words). Descriptions should be 1-2 sentences.',
      ].join(' '),
      input,
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          tasks: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              properties: {
                title:       { type: 'string' },
                description: { type: 'string' },
                priority:    { type: 'string', enum: ['Low', 'Medium', 'High', 'Urgent'] },
              },
              required: ['title', 'description', 'priority'],
            },
          },
        },
        required: ['tasks'],
      },
    })
  },
}
