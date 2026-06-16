// LAYER: Service
// RULE: Business logic only. No HTTP handling. No direct DB access.

import { openAIService } from '@/services/ai/openAIService'
import { ShiftSchedulingDraft } from '@/types/AI'

export const shiftSchedulingService = {
  async generateShifts(input: {
    context: string
    department_name?: string | null
    date_from: string
    date_to: string
    preferred_hours?: string | null
    num_staff?: number | null
  }): Promise<ShiftSchedulingDraft> {
    if (!input.context.trim()) throw new Error('context is required')
    if (!input.date_from || !input.date_to) throw new Error('date_from and date_to are required')

    return openAIService.generateStructuredJson<ShiftSchedulingDraft>({
      schemaName: 'shift_scheduling_draft',
      instructions: [
        'You are a workforce shift scheduling assistant for SMEs.',
        'Given a work coverage description and a date range, generate a practical list of 3 to 8 shift slots that cover the described needs.',
        'Each shift must fall within the given date_from to date_to range (inclusive).',
        'Return shift_date in YYYY-MM-DD format exactly. Return start_time and end_time in HH:MM 24-hour format exactly (e.g. "09:00", "17:30").',
        'Shift titles should be short and descriptive (e.g. "Morning Shift", "Evening Rush", "Weekend Cover").',
        'Reason should be 1 sentence explaining why this slot is needed based on the context.',
        'Do not overlap shifts on the same date unless the context clearly requires multiple shifts per day.',
        'Ensure end_time is always after start_time on the same calendar day.',
      ].join(' '),
      input,
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          shifts: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              properties: {
                shift_date:  { type: 'string' },
                start_time:  { type: 'string' },
                end_time:    { type: 'string' },
                title:       { type: 'string' },
                reason:      { type: 'string' },
              },
              required: ['shift_date', 'start_time', 'end_time', 'title', 'reason'],
            },
          },
        },
        required: ['shifts'],
      },
    })
  },
}
