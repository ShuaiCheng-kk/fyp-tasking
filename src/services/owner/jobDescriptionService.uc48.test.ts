import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase', () => ({
  supabase: {},
  createClient: () => ({}),
}))

vi.mock('@/services/ai/openAIService', () => ({
  openAIService: {
    generateStructuredJson: vi.fn(),
  },
}))

import { jobDescriptionService } from './jobDescriptionService'
import { openAIService } from '@/services/ai/openAIService'

const aiDraft = {
  title: 'Weekend Retail Assistant',
  description: 'Assist customers and restock shelves during weekend shifts.',
  requirements: ['Comfortable standing for long periods'],
  responsibilities: ['Greet customers', 'Restock shelves'],
  screening_questions: ['Are you available on weekends?'],
}

describe('UC48 Generate AI Job Description Suggestion', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(openAIService.generateStructuredJson).mockResolvedValue(aiDraft as never)
  })

  it('UC48-M-UT-O: Owner generates an AI job description from a title, framed around a Shift job', async () => {
    const result = await jobDescriptionService.generateDescription({
      title: 'weekend cashier needed', job_type: 'shift', company_name: 'Test Co', department_name: 'Retail', location: 'Singapore', pay: '$12/hr',
    })

    expect(result).toEqual(aiDraft)
    expect(openAIService.generateStructuredJson).toHaveBeenCalledWith(expect.objectContaining({
      instructions: expect.stringContaining('recurring scheduled shifts'),
      input: expect.objectContaining({ title: 'weekend cashier needed', job_type: 'shift' }),
    }))
  })

  it('UC48-M-UT-P: Partner generates an AI job description from a title, framed around a Shift job', async () => {
    const result = await jobDescriptionService.generateDescription({
      title: 'weekend cashier needed', job_type: 'shift',
    })

    expect(result).toEqual(aiDraft)
    expect(openAIService.generateStructuredJson).toHaveBeenCalledWith(expect.objectContaining({
      instructions: expect.stringContaining('recurring scheduled shifts'),
    }))
  })

  it('UC48-M-UT-M: Manager generates an AI job description from a title, framed around a Shift job', async () => {
    const result = await jobDescriptionService.generateDescription({
      title: 'weekend cashier needed', job_type: 'shift',
    })

    expect(result).toEqual(aiDraft)
    expect(openAIService.generateStructuredJson).toHaveBeenCalledWith(expect.objectContaining({
      instructions: expect.stringContaining('recurring scheduled shifts'),
    }))
  })

  it('UC48-A1-UT-O: Owner is blocked from generating an AI description with no Title typed', async () => {
    await expect(jobDescriptionService.generateDescription({ title: '' }))
      .rejects.toThrow('title is required')

    expect(openAIService.generateStructuredJson).not.toHaveBeenCalled()
  })

  it('UC48-A1-UT-P: Partner is blocked from generating an AI description with no Title typed', async () => {
    await expect(jobDescriptionService.generateDescription({ title: '' }))
      .rejects.toThrow('title is required')

    expect(openAIService.generateStructuredJson).not.toHaveBeenCalled()
  })

  it('UC48-A1-UT-M: Manager is blocked from generating an AI description with no Title typed', async () => {
    await expect(jobDescriptionService.generateDescription({ title: '' }))
      .rejects.toThrow('title is required')

    expect(openAIService.generateStructuredJson).not.toHaveBeenCalled()
  })

  it('UC48-BR-UT-O: Owner generates a description for a One-Off job, framed around a single self-contained task instead of recurring shifts', async () => {
    await jobDescriptionService.generateDescription({
      title: 'need help moving office furniture this Saturday', job_type: 'oneoff',
    })

    expect(openAIService.generateStructuredJson).toHaveBeenCalledWith(expect.objectContaining({
      instructions: expect.stringContaining('do not describe recurring shifts'),
    }))
  })
})
