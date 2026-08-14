import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabaseAdmin', () => ({
  getSupabaseAdmin: () => ({}),
}))

vi.mock('@/lib/supabase', () => ({
  supabase: {},
  createClient: () => ({}),
}))

vi.mock('@/repositories/owner/taskRepository', () => ({
  taskRepository: {
    getTasksByCompany: vi.fn(),
    getManagersByDepartment: vi.fn(),
    getEmployeesByDepartment: vi.fn(),
    getSupervisedCasualWorkersByEmployee: vi.fn(),
    hasShiftOnDate: vi.fn(),
  },
}))

import { taskService } from './taskService'
import { taskRepository } from '@/repositories/owner/taskRepository'

const HOUR = 60 * 60 * 1000
const DAY = 24 * HOUR
const overdue = () => new Date(Date.now() - HOUR).toISOString()
const plentyOfTime = () => new Date(Date.now() + 30 * DAY).toISOString()
const within24h = () => new Date(Date.now() + 12 * HOUR).toISOString()
const within3days = () => new Date(Date.now() + 2 * DAY).toISOString()

const baseTask = {
  shift_id: null,
  company_id: 'comp-1',
  department_id: 'dept-1',
  parent_task_id: null,
  sequence_order: null,
  description: null,
  task_date: '2026-08-10',
  recurrence_group_id: null,
  source_task_id: null,
  is_archived: false,
  is_completed: false,
  created_at: '2026-08-01T00:00:00.000Z',
  status: 'Assigned' as const,
}

describe('UC20 Rebalance Task Workload', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(taskRepository.hasShiftOnDate).mockResolvedValue(true)
  })

  it('UC20-M-UT-O: Owner sees a rebalancing suggestion for an overloaded Manager', async () => {
    const tasks = [
      { ...baseTask, id: 'task-a1', title: 'Handle vendor escalation', priority: 'Urgent', due_at: overdue(), assigned_user_id: 'mgr-a' },
      { ...baseTask, id: 'task-a2', title: 'Review monthly report', priority: 'Medium', due_at: plentyOfTime(), assigned_user_id: 'mgr-a' },
      { ...baseTask, id: 'task-b1', title: 'File supply request', priority: 'Low', due_at: plentyOfTime(), assigned_user_id: 'mgr-b' },
    ]
    vi.mocked(taskRepository.getTasksByCompany).mockResolvedValue(tasks as never)
    vi.mocked(taskRepository.getManagersByDepartment).mockResolvedValue([
      { id: 'mgr-a', full_name: 'Manager A' },
      { id: 'mgr-b', full_name: 'Manager B' },
    ])

    const [suggestion] = await taskService.getWorkloadRebalancingSuggestions('comp-1', 'dept-1')

    expect(suggestion.overloaded_user_id).toBe('mgr-a')
    expect(suggestion.recommended_user_id).toBe('mgr-b')
    expect(suggestion.suggested_task_id).toBe('task-a2')
    expect(suggestion.suggested_task_title).toBe('Review monthly report')
    expect(suggestion.score_gap_before).toBe(17)
    expect(suggestion.score_gap_after).toBe(13)
  })

  it('UC20-M-UT-P: Partner sees a rebalancing suggestion for an overloaded Manager', async () => {
    const tasks = [
      { ...baseTask, id: 'task-c1', title: 'Prepare marketing brief', priority: 'High', due_at: within24h(), assigned_user_id: 'mgr-c' },
      { ...baseTask, id: 'task-c2', title: 'Update client records', priority: 'High', due_at: within3days(), assigned_user_id: 'mgr-c' },
      { ...baseTask, id: 'task-d1', title: 'Order office supplies', priority: 'Low', due_at: plentyOfTime(), assigned_user_id: 'mgr-d' },
    ]
    vi.mocked(taskRepository.getTasksByCompany).mockResolvedValue(tasks as never)
    vi.mocked(taskRepository.getManagersByDepartment).mockResolvedValue([
      { id: 'mgr-c', full_name: 'Manager C' },
      { id: 'mgr-d', full_name: 'Manager D' },
    ])

    const [suggestion] = await taskService.getWorkloadRebalancingSuggestions('comp-1', 'dept-1')

    expect(suggestion.overloaded_user_id).toBe('mgr-c')
    expect(suggestion.recommended_user_id).toBe('mgr-d')
    expect(suggestion.suggested_task_id).toBe('task-c2')
    expect(suggestion.suggested_task_title).toBe('Update client records')
    expect(suggestion.score_gap_before).toBe(14)
    expect(suggestion.score_gap_after).toBe(2)
  })

  it('UC20-M-UT-M: Manager sees a rebalancing suggestion for an overloaded Employee in their department', async () => {
    const tasks = [
      { ...baseTask, id: 'task-x1', title: 'Investigate server outage', priority: 'Urgent', due_at: overdue(), assigned_user_id: 'emp-x' },
      { ...baseTask, id: 'task-x2', title: 'Fix login bug', priority: 'Urgent', due_at: overdue(), assigned_user_id: 'emp-x' },
      { ...baseTask, id: 'task-y1', title: 'Update documentation', priority: 'Low', due_at: plentyOfTime(), assigned_user_id: 'emp-y' },
    ]
    vi.mocked(taskRepository.getTasksByCompany).mockResolvedValue(tasks as never)
    vi.mocked(taskRepository.getEmployeesByDepartment).mockResolvedValue([
      { id: 'emp-x', full_name: 'Employee X' },
      { id: 'emp-y', full_name: 'Employee Y' },
    ])

    const [suggestion] = await taskService.getWorkloadRebalancingSuggestions('comp-1', 'dept-1', undefined, undefined, 'Employee')

    expect(suggestion.overloaded_user_id).toBe('emp-x')
    expect(suggestion.recommended_user_id).toBe('emp-y')
    expect(suggestion.suggested_task_id).toBe('task-x1')
    expect(suggestion.suggested_task_title).toBe('Investigate server outage')
    expect(suggestion.score_gap_before).toBe(31)
    expect(suggestion.score_gap_after).toBe(1)
  })

  it('UC20-E-UT-M: Employee sees a rebalancing suggestion for an overloaded Casual Worker they supervise', async () => {
    const tasks = [
      { ...baseTask, id: 'task-c1', title: 'Restock the front display', priority: 'Urgent', due_at: overdue(), assigned_user_id: 'cw-a' },
      { ...baseTask, id: 'task-c2', title: 'Clear the loading bay', priority: 'Urgent', due_at: overdue(), assigned_user_id: 'cw-a' },
      { ...baseTask, id: 'task-c3', title: 'Wipe down the back tables', priority: 'Low', due_at: plentyOfTime(), assigned_user_id: 'cw-b' },
    ]
    vi.mocked(taskRepository.getTasksByCompany).mockResolvedValue(tasks as never)
    vi.mocked(taskRepository.getSupervisedCasualWorkersByEmployee).mockResolvedValue([
      { id: 'cw-a', full_name: 'Casual Worker A' },
      { id: 'cw-b', full_name: 'Casual Worker B' },
    ])

    const [suggestion] = await taskService.getWorkloadRebalancingSuggestions('comp-1', 'dept-1', undefined, undefined, 'Casual Worker', 'emp-1')

    expect(taskRepository.getSupervisedCasualWorkersByEmployee).toHaveBeenCalledWith('emp-1', 'comp-1', 'dept-1')
    expect(taskRepository.getEmployeesByDepartment).not.toHaveBeenCalled()
    expect(suggestion.overloaded_user_id).toBe('cw-a')
    expect(suggestion.recommended_user_id).toBe('cw-b')
    expect(suggestion.suggested_task_id).toBe('task-c1')
    expect(suggestion.score_gap_before).toBe(31)
    expect(suggestion.score_gap_after).toBe(1)
  })

  // The Casual Worker pool is a supervisor + today pairing, so without a supervisor there is no
  // pool to compare. Falling back to the department's whole roster would let an Employee rebalance
  // across workers they don't supervise, which the one-level-down assignment rule forbids.
  it('UC20-E-UT-A1: no suggestion when the Casual Worker pool has no supervisor to resolve it from', async () => {
    const tasks = [
      { ...baseTask, id: 'task-c1', title: 'Restock the front display', priority: 'Urgent', due_at: overdue(), assigned_user_id: 'cw-a' },
      { ...baseTask, id: 'task-c2', title: 'Clear the loading bay', priority: 'Urgent', due_at: overdue(), assigned_user_id: 'cw-a' },
      { ...baseTask, id: 'task-c3', title: 'Wipe down the back tables', priority: 'Low', due_at: plentyOfTime(), assigned_user_id: 'cw-b' },
    ]
    vi.mocked(taskRepository.getTasksByCompany).mockResolvedValue(tasks as never)

    const suggestions = await taskService.getWorkloadRebalancingSuggestions('comp-1', 'dept-1', undefined, undefined, 'Casual Worker')

    expect(suggestions).toEqual([])
    expect(taskRepository.getSupervisedCasualWorkersByEmployee).not.toHaveBeenCalled()
  })
})
