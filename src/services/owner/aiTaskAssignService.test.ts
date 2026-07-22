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
  taskRepository: { getActiveTasksByAssignees: vi.fn(), hasShiftOnDate: vi.fn(), getEmployeesByDepartment: vi.fn() },
}))

import { aiTaskAssignService } from './aiTaskAssignService'
import { openAIService } from '@/services/ai/openAIService'
import { companyService } from '@/services/company/companyService'
import { taskRepository } from '@/repositories/owner/taskRepository'

const departments = [
  { id: 'dept-1', name: 'Operations' },
  { id: 'dept-2', name: 'Marketing' },
  { id: 'dept-3', name: 'Finance' },
]
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

  // Task assignment is independent of shift scheduling (see taskService.assignTask/editTask) —
  // every manager in the department is a candidate regardless of task_date or shift presence.
  it('ranks every manager in the department regardless of shift presence on task_date', async () => {
    vi.mocked(taskRepository.hasShiftOnDate).mockResolvedValue(false)

    const result = await aiTaskAssignService.generateAssignmentSuggestion({
      company_id: 'company-1', title: 'Prepare report', description: '', priority: 'High', want_sub_tasks: false, task_date: '2026-07-01',
    })

    expect(taskRepository.hasShiftOnDate).not.toHaveBeenCalled()
    expect(result.candidates).toHaveLength(2)
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

  it('returns AI sub-task titles only when want_sub_tasks is true', async () => {
    vi.mocked(openAIService.generateStructuredJson).mockResolvedValue({
      department_id: 'dept-1',
      description: 'Polished description.',
      reason: 'This is a multi-stage task.',
      steps: [
        { title: 'Report Draft' },
        { title: 'Final Report' },
      ],
    })

    const result = await aiTaskAssignService.generateAssignmentSuggestion({
      company_id: 'company-1', title: 'Prepare report', description: '', priority: 'High', want_sub_tasks: true,
    })

    expect(result.sub_tasks).toEqual([
      { title: 'Report Draft' },
      { title: 'Final Report' },
    ])
  })

  it('caps AI generated sub_tasks at four titles', async () => {
    vi.mocked(openAIService.generateStructuredJson).mockResolvedValue({
      department_id: 'dept-1',
      description: 'Polished description.',
      reason: 'This is a multi-stage task.',
      steps: [
        { title: 'One' },
        { title: 'Two' },
        { title: 'Three' },
        { title: 'Four' },
        { title: 'Five' },
      ],
    })

    const result = await aiTaskAssignService.generateAssignmentSuggestion({
      company_id: 'company-1', title: 'Website launch campaign project', description: '', priority: 'High', want_sub_tasks: true,
    })

    expect(result.sub_tasks).toEqual([
      { title: 'One' },
      { title: 'Two' },
      { title: 'Three' },
      { title: 'Four' },
    ])
  })

  it('caps single-deliverable tasks like a promotion video at two sub_tasks', async () => {
    vi.mocked(openAIService.generateStructuredJson).mockResolvedValue({
      department_id: 'dept-2',
      description: 'Create a promotional video.',
      reason: 'This task is related to promotion.',
      steps: [
        { title: 'Video Script' },
        { title: 'Video Production' },
        { title: 'Video Editing' },
        { title: 'Video Distribution' },
      ],
    })

    const result = await aiTaskAssignService.generateAssignmentSuggestion({
      company_id: 'company-1', title: 'Promotion Video', description: '', priority: 'Urgent', want_sub_tasks: true,
    })

    expect(result.sub_tasks).toEqual([
      { title: 'Video Script' },
      { title: 'Video Production' },
    ])
  })

  it('falls back to a keyword-matched draft with steps when the LLM call fails', async () => {
    vi.mocked(openAIService.generateStructuredJson).mockRejectedValue(new Error('LLM down'))

    const result = await aiTaskAssignService.generateAssignmentSuggestion({
      company_id: 'company-1', title: 'Prepare report', description: '', priority: 'Urgent', want_sub_tasks: true,
    })

    expect(result.department_id).toBe('dept-3')
    expect(result.sub_tasks).toHaveLength(2)
    expect(result.sub_tasks[0]).not.toHaveProperty('description')
    expect(result.reason).toBeTruthy()
  })

  it('uses task keywords instead of the first department when the LLM call fails', async () => {
    vi.mocked(openAIService.generateStructuredJson).mockRejectedValue(new Error('LLM down'))

    const poster = await aiTaskAssignService.generateAssignmentSuggestion({
      company_id: 'company-1', title: 'Promotion Poster', description: '', priority: 'Urgent', want_sub_tasks: true,
    })
    const report = await aiTaskAssignService.generateAssignmentSuggestion({
      company_id: 'company-1', title: 'Financial report', description: '', priority: 'High', want_sub_tasks: false,
    })

    expect(poster.department_id).toBe('dept-2')
    expect(poster.description).not.toBe('Complete: Promotion Poster.')
    expect(poster.sub_tasks.length).toBeGreaterThan(0)
    expect(report.department_id).toBe('dept-3')
  })

  it('returns no recommended_manager_id when the department has no managers', async () => {
    vi.mocked(companyService.getManagersByDepartment).mockResolvedValue([])

    const result = await aiTaskAssignService.generateAssignmentSuggestion({
      company_id: 'company-1', title: 'Prepare report', description: '', priority: 'High', want_sub_tasks: false,
    })

    expect(result.recommended_manager_id).toBeNull()
    expect(result.candidates).toEqual([])
  })

  // Manager viewer (department_ids + candidate_role resolved server-side from manager_scope_id
  // in the route) — the AI never guesses across departments and never recommends a Manager.
  describe('Manager viewer scope (department_ids + candidate_role: Employee)', () => {
    const employees = [
      { id: 'emp-1', full_name: 'Grace' },
      { id: 'emp-2', full_name: 'Ben' },
    ]

    beforeEach(() => {
      vi.mocked(taskRepository.getEmployeesByDepartment).mockResolvedValue(employees)
    })

    it('forces the department instead of letting the AI pick one — even when the AI/keyword match would pick another', async () => {
      // The LLM (and the keyword fallback) would normally pick Marketing (dept-2) for a
      // promotion-flavoured title — department_ids constrains it to the manager's own dept-1.
      const result = await aiTaskAssignService.generateAssignmentSuggestion({
        company_id: 'company-1', title: 'Promotion Poster', description: '', priority: 'High', want_sub_tasks: false,
        department_ids: ['dept-1'], candidate_role: 'Employee',
      })

      expect(result.department_id).toBe('dept-1')
      expect(companyService.getManagersByDepartment).not.toHaveBeenCalled()
      expect(taskRepository.getEmployeesByDepartment).toHaveBeenCalledWith('company-1', 'dept-1')
    })

    it('recommends the lightest-loaded Employee, not a Manager', async () => {
      const result = await aiTaskAssignService.generateAssignmentSuggestion({
        company_id: 'company-1', title: 'Prepare report', description: '', priority: 'High', want_sub_tasks: false,
        department_ids: ['dept-1'], candidate_role: 'Employee',
      })

      expect(result.recommended_manager_id).toBe('emp-1')
      expect(result.candidates.map(c => c.id)).toEqual(['emp-1', 'emp-2'])
    })

    it('drops the AI\'s department-justification text from the reason — nothing to justify when it was forced', async () => {
      const result = await aiTaskAssignService.generateAssignmentSuggestion({
        company_id: 'company-1', title: 'Prepare report', description: '', priority: 'High', want_sub_tasks: false,
        department_ids: ['dept-1'], candidate_role: 'Employee',
      })

      expect(result.reason).not.toContain('promotion')
      expect(result.reason).toContain('Grace')
      expect(result.reason).toContain('employees')
    })

    it('reports no employees available, distinct from the Owner/Partner "no managers" case', async () => {
      vi.mocked(taskRepository.getEmployeesByDepartment).mockResolvedValue([])

      const result = await aiTaskAssignService.generateAssignmentSuggestion({
        company_id: 'company-1', title: 'Prepare report', description: '', priority: 'High', want_sub_tasks: false,
        department_ids: ['dept-1'], candidate_role: 'Employee',
      })

      expect(result.recommended_manager_id).toBeNull()
      expect(result.reason).toContain('No employees available')
    })
  })
})
