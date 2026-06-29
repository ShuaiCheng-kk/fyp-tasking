import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase', () => ({
  supabase: {},
  createClient: () => ({}),
}))

vi.mock('@/services/ai/openAIService', () => ({
  openAIService: { generateStructuredJson: vi.fn() },
}))

vi.mock('@/services/company/companyService', () => ({
  companyService: { getDepartments: vi.fn(), getManagersByDepartment: vi.fn() },
}))

vi.mock('@/repositories/owner/taskRepository', () => ({
  taskRepository: { getActiveTasksByAssignees: vi.fn(), hasShiftOnDate: vi.fn() },
}))

import { aiTaskAssignService } from './aiTaskAssignService'
import { openAIService } from '@/services/ai/openAIService'
import { companyService } from '@/services/company/companyService'
import { taskRepository } from '@/repositories/owner/taskRepository'

const departments = [{ id: 'dept-1', name: 'Sales' }, { id: 'dept-2', name: 'Ops' }]
const managers = [
  { id: 'mgr-1', full_name: 'Alice' },
  { id: 'mgr-2', full_name: 'Bob' },
]

describe('aiTaskAssignService.generateAssignmentSuggestion (UC20)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(companyService.getDepartments).mockResolvedValue(departments as any)
    vi.mocked(companyService.getManagersByDepartment).mockResolvedValue(managers)
    vi.mocked(taskRepository.getActiveTasksByAssignees).mockResolvedValue([])
    vi.mocked(taskRepository.hasShiftOnDate).mockResolvedValue(true)
    vi.mocked(openAIService.generateStructuredJson).mockResolvedValue({
      department_id: 'dept-1',
      description: 'Polished description.',
      reason: 'This task is related to promotion.',
      steps: [],
    })
  })

  it('requires a title', async () => {
    await expect(aiTaskAssignService.generateAssignmentSuggestion({
      company_id: 'company-1', title: '   ', description: '', priority: 'High', want_sub_tasks: false,
    })).rejects.toThrow('title is required')
  })

  it('recommends the lightest-loaded manager in the AI-picked department, with a reason', async () => {
    const result = await aiTaskAssignService.generateAssignmentSuggestion({
      company_id: 'company-1', title: 'Prepare report', description: '', priority: 'High', want_sub_tasks: false,
    })

    expect(result.department_id).toBe('dept-1')
    expect(result.recommended_manager_id).toBe('mgr-1')
    expect(result.reason).toContain('promotion')
    expect(result.reason).toContain('Alice')
  })

  it('returns the AI-polished description', async () => {
    const result = await aiTaskAssignService.generateAssignmentSuggestion({
      company_id: 'company-1', title: 'Prepare report', description: 'rough notes', priority: 'High', want_sub_tasks: false,
    })

    expect(result.description).toBe('Polished description.')
  })

  it('falls back to the user-supplied description if the AI returns a blank one', async () => {
    vi.mocked(openAIService.generateStructuredJson).mockResolvedValue({
      department_id: 'dept-1',
      description: '',
      reason: 'This task is related to promotion.',
      steps: [],
    })

    const result = await aiTaskAssignService.generateAssignmentSuggestion({
      company_id: 'company-1', title: 'Prepare report', description: 'my own notes', priority: 'High', want_sub_tasks: false,
    })

    expect(result.description).toBe('my own notes')
  })

  it('only ranks managers with a shift on the given task_date', async () => {
    vi.mocked(taskRepository.hasShiftOnDate).mockImplementation(async (userId: string) => userId === 'mgr-2')

    const result = await aiTaskAssignService.generateAssignmentSuggestion({
      company_id: 'company-1', title: 'Prepare report', description: '', priority: 'High', want_sub_tasks: false, task_date: '2026-07-01',
    })

    expect(result.candidates.map(c => c.id)).toEqual(['mgr-2'])
    expect(result.recommended_manager_id).toBe('mgr-2')
  })

  it('does not filter by shift when no task_date is given', async () => {
    const result = await aiTaskAssignService.generateAssignmentSuggestion({
      company_id: 'company-1', title: 'Prepare report', description: '', priority: 'High', want_sub_tasks: false,
    })

    expect(taskRepository.hasShiftOnDate).not.toHaveBeenCalled()
    expect(result.candidates).toHaveLength(2)
  })

  it('returns no sub_tasks when want_sub_tasks is false', async () => {
    const result = await aiTaskAssignService.generateAssignmentSuggestion({
      company_id: 'company-1', title: 'Prepare report', description: '', priority: 'High', want_sub_tasks: false,
    })

    expect(result.sub_tasks).toEqual([])
  })

  it('returns the AI steps as sub_tasks when want_sub_tasks is true', async () => {
    vi.mocked(openAIService.generateStructuredJson).mockResolvedValue({
      department_id: 'dept-1',
      description: 'Polished description.',
      reason: 'This is a multi-stage task.',
      steps: [
        { title: 'Step 1', description: 'Do the first thing' },
        { title: 'Step 2', description: 'Do the second thing' },
      ],
    })

    const result = await aiTaskAssignService.generateAssignmentSuggestion({
      company_id: 'company-1', title: 'Prepare report', description: '', priority: 'High', want_sub_tasks: true,
    })

    expect(result.sub_tasks).toEqual([
      { title: 'Step 1', description: 'Do the first thing' },
      { title: 'Step 2', description: 'Do the second thing' },
    ])
  })

  it('falls back to a no-steps draft when the LLM call fails', async () => {
    vi.mocked(openAIService.generateStructuredJson).mockRejectedValue(new Error('LLM down'))

    const result = await aiTaskAssignService.generateAssignmentSuggestion({
      company_id: 'company-1', title: 'Prepare report', description: '', priority: 'Urgent', want_sub_tasks: true,
    })

    expect(result.department_id).toBe('dept-1')
    expect(result.sub_tasks).toEqual([])
    expect(result.reason).toBeTruthy()
  })

  it('returns no recommended_manager_id when the department has no managers', async () => {
    vi.mocked(companyService.getManagersByDepartment).mockResolvedValue([])

    const result = await aiTaskAssignService.generateAssignmentSuggestion({
      company_id: 'company-1', title: 'Prepare report', description: '', priority: 'High', want_sub_tasks: false,
    })

    expect(result.recommended_manager_id).toBeNull()
    expect(result.candidates).toEqual([])
  })
})
