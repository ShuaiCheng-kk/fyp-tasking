// LAYER: Service
// RULE: Business logic only. No HTTP handling. No direct DB access.

import { openAIService } from '@/services/ai/openAIService'
import { JobDescriptionDraft } from '@/types/AI'

export const jobDescriptionService = {
  async generateDescription(input: {
    title: string
    job_type?: string | null
    company_name?: string | null
    department_name?: string | null
    location?: string | null
    employment_type?: string | null
    pay?: string | null
    notes?: string | null
  }): Promise<JobDescriptionDraft> {
    if (!input.title.trim()) throw new Error('title is required')

    const jobTypeContext =
      input.job_type === 'shift'
        ? 'This posting is a SHIFT job: recurring scheduled shifts with fixed start and end times. Frame the description and responsibilities around reliably covering assigned shifts.'
        : input.job_type === 'oneoff'
          ? 'This posting is a ONE-OFF job: a single, self-contained piece of work completed once. Frame the description and responsibilities around finishing that specific task — do not describe recurring shifts.'
          : ''

    return openAIService.generateStructuredJson<JobDescriptionDraft>({
      schemaName: 'job_description_draft',
      maxOutputTokens: 700,
      instructions: [
        'You write practical job postings for SME casual worker recruitment.',
        'The "title" field contains the owner\'s free-text description of the job. Derive a concise job title from it and ground the description, responsibilities, and requirements in its specifics.',
        jobTypeContext,
        'Be concrete to this exact role: name the actual tasks, tools, and skills implied by the owner\'s description. Do not fall back to generic boilerplate about reliability, punctuality, or flexible shifts unless the owner\'s description asks for it.',
        'Avoid exaggerated marketing language.',
      ].filter(Boolean).join(' '),
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
