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

vi.mock('@/services/company/companyService', () => ({
  companyService: {
    getDepartments: vi.fn(),
    getManagersByDepartment: vi.fn(),
  },
}))

vi.mock('@/repositories/owner/taskRepository', () => ({
  taskRepository: {
    getActiveTasksByAssignees: vi.fn(),
    getEmployeesByDepartment: vi.fn(),
  },
}))

import { aiTaskAssignService } from './aiTaskAssignService'
import { openAIService } from '@/services/ai/openAIService'
import { companyService } from '@/services/company/companyService'
import { taskRepository } from '@/repositories/owner/taskRepository'

const allDepartments = [
  { id: 'dept-mkt', name: 'Marketing' },
  { id: 'dept-fin', name: 'Finance' },
  { id: 'dept-eng', name: 'Engineering' },
]

describe('UC19 Generate AI Task Assignment Suggestion', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // The AI call is simulated as unavailable in every case here, so the documented
    // keyword-scoring fallback (department match, description, sub-tasks) is what actually runs —
    // this is itself a first-class documented path, not a made-up error scenario.
    vi.mocked(openAIService.generateStructuredJson).mockRejectedValue(new Error('AI unavailable'))
    vi.mocked(companyService.getDepartments).mockResolvedValue(allDepartments as never)
  })

  it('UC19-M-UT-O: Owner generates an AI task assignment suggestion, matched to a department by keyword and ranked by workload', async () => {
    vi.mocked(companyService.getManagersByDepartment).mockResolvedValue([
      { id: 'mgr-a', full_name: 'Manager A' },
      { id: 'mgr-b', full_name: 'Manager B' },
    ])
    vi.mocked(taskRepository.getActiveTasksByAssignees).mockResolvedValue([
      { assigned_user_id: 'mgr-a', priority: 'High', due_at: '2027-01-01T00:00:00.000Z' },
    ])

    const result = await aiTaskAssignService.generateAssignmentSuggestion({
      company_id: 'comp-1',
      title: 'Design a marketing poster for the summer sale',
      description: '',
      priority: 'Medium',
      want_sub_tasks: true,
    })

    expect(result.department_id).toBe('dept-mkt')
    expect(result.department_name).toBe('Marketing')
    expect(result.recommended_manager_id).toBe('mgr-b')
    expect(result.reason).toBe(
      'This task best matches the Marketing department based on the task title and description. Manager B currently has the lightest workload among managers in this department.',
    )
    expect(result.description).toBe(
      'Plan and complete "Design a marketing poster for the summer sale" with clear deliverables, owner review, and any required supporting materials. This is a medium priority task, so confirm scope early and finish it before the deadline.',
    )
    expect(result.sub_tasks).toEqual([
      { title: 'Design a marketing poster for the summer sale Draft' },
      { title: 'Design a marketing poster for the summer sale Final' },
    ])
  })

  it('UC19-M-UT-P: Partner generates an AI task assignment suggestion, matched to a department by keyword and ranked by workload', async () => {
    vi.mocked(companyService.getManagersByDepartment).mockResolvedValue([
      { id: 'mgr-c', full_name: 'Manager C' },
      { id: 'mgr-d', full_name: 'Manager D' },
    ])
    vi.mocked(taskRepository.getActiveTasksByAssignees).mockResolvedValue([
      { assigned_user_id: 'mgr-d', priority: 'Urgent', due_at: new Date(Date.now() + 60 * 60 * 1000).toISOString() },
    ])

    const result = await aiTaskAssignService.generateAssignmentSuggestion({
      company_id: 'comp-1',
      title: 'Prepare the quarterly budget report',
      description: '',
      priority: 'High',
      want_sub_tasks: true,
    })

    expect(result.department_id).toBe('dept-fin')
    expect(result.department_name).toBe('Finance')
    expect(result.recommended_manager_id).toBe('mgr-c')
    expect(result.reason).toBe(
      'This task best matches the Finance department based on the task title and description. Manager C currently has the lightest workload among managers in this department.',
    )
    expect(result.description).toBe(
      'Plan and complete "Prepare the quarterly budget report" with clear deliverables, owner review, and any required supporting materials. This is a high priority task, so confirm scope early and finish it before the deadline.',
    )
    expect(result.sub_tasks).toEqual([
      { title: 'Prepare the quarterly budget report Draft' },
      { title: 'Prepare the quarterly budget report Review' },
      { title: 'Prepare the quarterly budget report Final Delivery' },
    ])
  })

  it('UC19-M-UT-M: Manager generates an AI task assignment suggestion, forced to their own department and ranked among Employees', async () => {
    vi.mocked(taskRepository.getEmployeesByDepartment).mockResolvedValue([
      { id: 'emp-x', full_name: 'Employee X' },
      { id: 'emp-y', full_name: 'Employee Y' },
    ])
    vi.mocked(taskRepository.getActiveTasksByAssignees).mockResolvedValue([
      { assigned_user_id: 'emp-y', priority: 'Medium', due_at: '2027-01-01T00:00:00.000Z' },
    ])

    const result = await aiTaskAssignService.generateAssignmentSuggestion({
      company_id: 'comp-1',
      title: 'Fix the checkout page bug',
      description: '',
      priority: 'High',
      want_sub_tasks: true,
      department_ids: ['dept-eng'],
      candidate_role: 'Employee',
    })

    expect(result.department_id).toBe('dept-eng')
    expect(result.department_name).toBe('Engineering')
    expect(result.recommended_manager_id).toBe('emp-x')
    // No AI department-choice justification is included, since the Manager's department was
    // forced rather than picked by the AI.
    expect(result.reason).toBe('Employee X currently has the lightest workload among employees in this department.')
    expect(result.description).toBe(
      'Plan and complete "Fix the checkout page bug" with clear deliverables, owner review, and any required supporting materials. This is a high priority task, so confirm scope early and finish it before the deadline.',
    )
    expect(result.sub_tasks).toEqual([
      { title: 'Fix the checkout page bug Draft' },
      { title: 'Fix the checkout page bug Final' },
    ])
  })
})
