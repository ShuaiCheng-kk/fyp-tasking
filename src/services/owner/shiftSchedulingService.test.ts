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

import { shiftSchedulingService } from './shiftSchedulingService'
import { openAIService } from '@/services/ai/openAIService'

describe('shiftSchedulingService — AI Auto-Schedule (UC13)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns the AI-generated shift draft for a valid request', async () => {
    const draft = {
      shifts: [
        { shift_date: '2026-06-22', start_time: '09:00', end_time: '17:00', title: 'Morning Shift', reason: 'Covers opening rush.' },
      ],
    }
    vi.mocked(openAIService.generateStructuredJson).mockResolvedValue(draft)

    const result = await shiftSchedulingService.generateShifts({
      context: 'Need coverage for the kitchen during lunch rush.',
      date_from: '2026-06-22',
      date_to: '2026-06-28',
    })

    expect(openAIService.generateStructuredJson).toHaveBeenCalledWith(expect.objectContaining({
      schemaName: 'shift_scheduling_draft',
    }))
    expect(result).toEqual(draft)
  })

  it('rejects an empty context', async () => {
    await expect(shiftSchedulingService.generateShifts({
      context: '   ',
      date_from: '2026-06-22',
      date_to: '2026-06-28',
    })).rejects.toThrow('context is required')
    expect(openAIService.generateStructuredJson).not.toHaveBeenCalled()
  })

  it('rejects a missing date range', async () => {
    await expect(shiftSchedulingService.generateShifts({
      context: 'Need coverage',
      date_from: '',
      date_to: '2026-06-28',
    })).rejects.toThrow('date_from and date_to are required')
  })
})
