import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabaseAdmin', () => ({
  getSupabaseAdmin: () => ({}),
}))

vi.mock('@/lib/supabase', () => ({
  supabase: {},
  createClient: () => ({}),
}))

vi.mock('@/repositories/owner/taskTemplateRepository', () => ({
  taskTemplateRepository: {
    createTemplate: vi.fn(),
  },
}))

vi.mock('@/repositories/owner/taskRepository', () => ({
  taskRepository: {
    getUserById: vi.fn(),
  },
}))

import { taskTemplateService } from './taskTemplateService'
import { taskTemplateRepository } from '@/repositories/owner/taskTemplateRepository'

describe('UC13 Create Task Template', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('UC13-M-UT-O: Owner creates a task template shared company-wide', async () => {
    const template = {
      id: 'template-1', company_id: 'comp-1', department_id: null,
      title: 'Weekly Stock Check', description: null, priority: 'Medium',
      sub_task_titles: [], created_by: 'owner-1', created_at: '2026-08-01T00:00:00.000Z',
    }
    vi.mocked(taskTemplateRepository.createTemplate).mockResolvedValue(template)

    const result = await taskTemplateService.createTemplate({
      company_id: 'comp-1', department_id: null, title: 'Weekly Stock Check', created_by: 'owner-1',
    })

    expect(result).toEqual(template)
    expect(taskTemplateRepository.createTemplate).toHaveBeenCalledTimes(1)
  })

  it('UC13-M-UT-P: Partner creates a task template shared company-wide', async () => {
    const template = {
      id: 'template-2', company_id: 'comp-1', department_id: null,
      title: 'Weekly Stock Check', description: null, priority: 'Medium',
      sub_task_titles: [], created_by: 'partner-1', created_at: '2026-08-01T00:00:00.000Z',
    }
    vi.mocked(taskTemplateRepository.createTemplate).mockResolvedValue(template)

    const result = await taskTemplateService.createTemplate({
      company_id: 'comp-1', department_id: null, title: 'Weekly Stock Check', created_by: 'partner-1',
    })

    expect(result).toEqual(template)
    expect(taskTemplateRepository.createTemplate).toHaveBeenCalledTimes(1)
  })

  it('UC13-M-UT-M: Manager creates a task template shared within their own department', async () => {
    const template = {
      id: 'template-3', company_id: 'comp-1', department_id: 'dept-1',
      title: 'Weekly Stock Check', description: null, priority: 'Medium',
      sub_task_titles: [], created_by: 'mgr-1', created_at: '2026-08-01T00:00:00.000Z',
    }
    vi.mocked(taskTemplateRepository.createTemplate).mockResolvedValue(template)

    const result = await taskTemplateService.createTemplate({
      company_id: 'comp-1', department_id: 'dept-1', title: 'Weekly Stock Check', created_by: 'mgr-1',
    })

    expect(result).toEqual(template)
    expect(taskTemplateRepository.createTemplate).toHaveBeenCalledTimes(1)
  })
})
