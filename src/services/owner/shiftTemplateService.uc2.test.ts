import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabaseAdmin', () => ({
  getSupabaseAdmin: () => ({}),
}))

vi.mock('@/lib/supabase', () => ({
  supabase: {},
  createClient: () => ({}),
}))

vi.mock('@/repositories/owner/shiftTemplateRepository', () => ({
  shiftTemplateRepository: {
    createTemplate: vi.fn(),
  },
}))

import { shiftTemplateService } from './shiftTemplateService'
import { shiftTemplateRepository } from '@/repositories/owner/shiftTemplateRepository'

describe('UC2 Create Shift Template', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('UC2-M-UT-O: Owner creates a new shift template', async () => {
    const template = {
      id: 'template-1',
      company_id: 'comp-1',
      name: 'Morning Shift',
      start_time: '09:00',
      end_time: '17:00',
      created_by: 'owner-1',
      created_at: '2026-08-01T00:00:00.000Z',
    }
    vi.mocked(shiftTemplateRepository.createTemplate).mockResolvedValue(template)

    const result = await shiftTemplateService.createTemplate({
      company_id: 'comp-1',
      name: 'Morning Shift',
      start_time: '09:00',
      end_time: '17:00',
      created_by: 'owner-1',
    })

    expect(result).toEqual(template)
    expect(shiftTemplateRepository.createTemplate).toHaveBeenCalledTimes(1)
  })

  it('UC2-M-UT-P: Partner creates a new shift template', async () => {
    const template = {
      id: 'template-2',
      company_id: 'comp-1',
      name: 'Evening Shift',
      start_time: '13:00',
      end_time: '21:00',
      created_by: 'partner-1',
      created_at: '2026-08-01T00:00:00.000Z',
    }
    vi.mocked(shiftTemplateRepository.createTemplate).mockResolvedValue(template)

    const result = await shiftTemplateService.createTemplate({
      company_id: 'comp-1',
      name: 'Evening Shift',
      start_time: '13:00',
      end_time: '21:00',
      created_by: 'partner-1',
    })

    expect(result).toEqual(template)
    expect(shiftTemplateRepository.createTemplate).toHaveBeenCalledTimes(1)
  })

  it('UC2-A1-UT-O: Owner attempts to create a shift template with a missing name', async () => {
    await expect(shiftTemplateService.createTemplate({
      company_id: 'comp-1',
      name: '',
      start_time: '09:00',
      end_time: '17:00',
      created_by: 'owner-1',
    })).rejects.toThrow('Missing required shift template fields')

    expect(shiftTemplateRepository.createTemplate).not.toHaveBeenCalled()
  })

  it('UC2-A1-UT-P: Partner attempts to create a shift template with a missing name', async () => {
    await expect(shiftTemplateService.createTemplate({
      company_id: 'comp-1',
      name: '',
      start_time: '13:00',
      end_time: '21:00',
      created_by: 'partner-1',
    })).rejects.toThrow('Missing required shift template fields')

    expect(shiftTemplateRepository.createTemplate).not.toHaveBeenCalled()
  })

  it('UC2-A2-UT-O: Owner attempts to create a shift template with identical start and end times', async () => {
    await expect(shiftTemplateService.createTemplate({
      company_id: 'comp-1',
      name: 'Overlap Shift',
      start_time: '09:00',
      end_time: '09:00',
      created_by: 'owner-1',
    })).rejects.toThrow('start_time and end_time cannot be the same')

    expect(shiftTemplateRepository.createTemplate).not.toHaveBeenCalled()
  })

  it('UC2-A2-UT-P: Partner attempts to create a shift template with identical start and end times', async () => {
    await expect(shiftTemplateService.createTemplate({
      company_id: 'comp-1',
      name: 'Overlap Shift',
      start_time: '13:00',
      end_time: '13:00',
      created_by: 'partner-1',
    })).rejects.toThrow('start_time and end_time cannot be the same')

    expect(shiftTemplateRepository.createTemplate).not.toHaveBeenCalled()
  })
})
