// LAYER: Service
// RULE: Business logic only. No HTTP handling. No direct DB access.

import { openAIService } from '@/services/ai/openAIService'
import { JobDescriptionDraft } from '@/types/AI'

export const jobDescriptionService = {
  async generateDescription(input: {
    title: string
    company_name?: string | null
    department_name?: string | null
    location?: string | null
    employment_type?: string | null
    pay?: string | null
    notes?: string | null
  }): Promise<JobDescriptionDraft> {
    if (!input.title.trim()) throw new Error('title is required')

    return openAIService.generateStructuredJson<JobDescriptionDraft>({
      schemaName: 'job_description_draft',
      instructions: [
        'You write practical job postings for SME casual worker recruitment.',
        'Do more than generate text: create a usable draft with responsibilities, requirements, and screening questions.',
        'Keep it specific to shift-based task allocation and workforce reliability.',
        'Avoid exaggerated marketing language.',
      ].join(' '),
      input,
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          title: { type: 'string' },
          description: { type: 'string' },
          requirements: { type: 'array', items: { type: 'string' } },
          responsibilities: { type: 'array', items: { type: 'string' } },
          screening_questions: { type: 'array', items: { type: 'string' } },
        },
        required: ['title', 'description', 'requirements', 'responsibilities', 'screening_questions'],
      },
    })
  },
}
