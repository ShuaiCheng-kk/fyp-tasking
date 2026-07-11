import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase', () => ({
  supabase: {},
  createClient: () => ({}),
}))

vi.mock('@/services/ai/openAIService', () => ({
  openAIService: { generateStructuredJson: vi.fn() },
}))

import { jobDescriptionService } from './jobDescriptionService'
import { openAIService } from '@/services/ai/openAIService'

const draft = {
  title: 'Weekend Cashier',
  description: 'Run the front register on weekends.',
  requirements: ['Available Saturdays and Sundays'],
  responsibilities: ['Process payments', 'Restock shelves'],
  screening_questions: ['Are you available on weekends?'],
}

describe('jobDescriptionService.generateDescription (UC47)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(openAIService.generateStructuredJson).mockResolvedValue(draft)
  })

  it('requires a title', async () => {
    await expect(jobDescriptionService.generateDescription({ title: '   ' })).rejects.toThrow('title is required')
  })

  it('returns the AI-generated draft', async () => {
    const result = await jobDescriptionService.generateDescription({ title: 'Weekend Cashier' })
    expect(result).toEqual(draft)
  })

  it('passes the job context through to the AI call', async () => {
    await jobDescriptionService.generateDescription({
      title: 'Weekend Cashier',
      job_type: 'shift',
      company_name: 'Acme Retail',
      department_name: 'Operations',
      location: 'Downtown',
      employment_type: 'casual',
      pay: '15 per hour',
      notes: 'Must be reliable',
    })

    expect(openAIService.generateStructuredJson).toHaveBeenCalledWith(
      expect.objectContaining({
        schemaName: 'job_description_draft',
        input: expect.objectContaining({
          title: 'Weekend Cashier',
          job_type: 'shift',
          company_name: 'Acme Retail',
          department_name: 'Operations',
          location: 'Downtown',
          employment_type: 'casual',
          pay: '15 per hour',
          notes: 'Must be reliable',
        }),
      }),
    )
  })

  it('steers the prompt by job type', async () => {
    await jobDescriptionService.generateDescription({ title: 'Set up stage for gala dinner', job_type: 'oneoff' })
    expect(openAIService.generateStructuredJson).toHaveBeenLastCalledWith(
      expect.objectContaining({ instructions: expect.stringContaining('ONE-OFF job') }),
    )

    await jobDescriptionService.generateDescription({ title: 'Barista for weekend mornings', job_type: 'shift' })
    expect(openAIService.generateStructuredJson).toHaveBeenLastCalledWith(
      expect.objectContaining({ instructions: expect.stringContaining('SHIFT job') }),
    )
  })
})
