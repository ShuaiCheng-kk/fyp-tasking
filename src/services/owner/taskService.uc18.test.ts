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
    getUserById: vi.fn(),
    getManagerDepartmentIds: vi.fn(),
    getEmployeeDepartmentIds: vi.fn(),
    getSupervisedCasualWorkerIds: vi.fn(),
    createTask: vi.fn(),
  },
}))

import { taskService } from './taskService'
import { taskRepository } from '@/repositories/owner/taskRepository'

const baseTask = {
  shift_id: null,
  company_id: 'comp-1',
  department_id: 'dept-1',
  parent_task_id: null,
  sequence_order: null,
  title: 'Restock shelves',
  description: null,
  status: 'Assigned' as const,
  priority: 'Medium',
  due_at: null,
  task_date: '2026-08-10',
  recurrence_group_id: null,
  source_task_id: null,
  is_archived: false,
  is_completed: false,
  created_at: '2026-08-01T00:00:00.000Z',
}

describe('UC18 Create Sub Task', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('UC18-M-UT-O: Owner adds a sub-task while assigning a task to a Manager', async () => {
    vi.mocked(taskRepository.getUserById).mockImplementation(async (id: string) => {
      if (id === 'owner-1') return { id: 'owner-1', role: 'Owner', company_id: 'comp-1' } as never
      if (id === 'mgr-1') return { id: 'mgr-1', role: 'Manager', company_id: 'comp-1' } as never
      return null
    })
    const mainTask = { ...baseTask, id: 'task-1', assigned_user_id: 'mgr-1', assigned_by: 'owner-1' }
    const subTask = { ...baseTask, id: 'task-1-sub', parent_task_id: 'task-1', title: 'Check inventory count', assigned_user_id: 'mgr-1', assigned_by: 'owner-1' }
    vi.mocked(taskRepository.createTask).mockResolvedValueOnce(mainTask).mockResolvedValueOnce(subTask)

    const result = await taskService.assignTaskWithSubTasks(
      { company_id: 'comp-1', department_id: 'dept-1', title: 'Restock shelves', assigned_user_id: 'mgr-1', assigned_by: 'owner-1' },
      [{ title: 'Check inventory count' }],
    )

    expect(result).toEqual(mainTask)
    expect(taskRepository.createTask).toHaveBeenCalledTimes(2)
    expect(taskRepository.createTask).toHaveBeenCalledWith(expect.objectContaining({
      parent_task_id: 'task-1', title: 'Check inventory count', sequence_order: null,
    }))
  })

  it('UC18-M-UT-P: Partner adds a sub-task while assigning a task to a Manager', async () => {
    vi.mocked(taskRepository.getUserById).mockImplementation(async (id: string) => {
      if (id === 'partner-1') return { id: 'partner-1', role: 'Partner', company_id: 'comp-1' } as never
      if (id === 'mgr-2') return { id: 'mgr-2', role: 'Manager', company_id: 'comp-1' } as never
      return null
    })
    const mainTask = { ...baseTask, id: 'task-2', assigned_user_id: 'mgr-2', assigned_by: 'partner-1' }
    const subTask = { ...baseTask, id: 'task-2-sub', parent_task_id: 'task-2', title: 'Check inventory count', assigned_user_id: 'mgr-2', assigned_by: 'partner-1' }
    vi.mocked(taskRepository.createTask).mockResolvedValueOnce(mainTask).mockResolvedValueOnce(subTask)

    const result = await taskService.assignTaskWithSubTasks(
      { company_id: 'comp-1', department_id: 'dept-1', title: 'Restock shelves', assigned_user_id: 'mgr-2', assigned_by: 'partner-1' },
      [{ title: 'Check inventory count' }],
    )

    expect(result).toEqual(mainTask)
    expect(taskRepository.createTask).toHaveBeenCalledTimes(2)
  })

  it('UC18-M-UT-M: Manager adds a sub-task while assigning a task to an Employee', async () => {
    vi.mocked(taskRepository.getUserById).mockImplementation(async (id: string) => {
      if (id === 'mgr-3') return { id: 'mgr-3', role: 'Manager', company_id: 'comp-1' } as never
      if (id === 'emp-1') return { id: 'emp-1', role: 'Employee', company_id: 'comp-1' } as never
      return null
    })
    vi.mocked(taskRepository.getManagerDepartmentIds).mockResolvedValue(['dept-1'])
    vi.mocked(taskRepository.getEmployeeDepartmentIds).mockResolvedValue(['dept-1'])
    const mainTask = { ...baseTask, id: 'task-3', assigned_user_id: 'emp-1', assigned_by: 'mgr-3' }
    const subTask = { ...baseTask, id: 'task-3-sub', parent_task_id: 'task-3', title: 'Check inventory count', assigned_user_id: 'emp-1', assigned_by: 'mgr-3' }
    vi.mocked(taskRepository.createTask).mockResolvedValueOnce(mainTask).mockResolvedValueOnce(subTask)

    const result = await taskService.assignTaskWithSubTasks(
      { company_id: 'comp-1', department_id: 'dept-1', title: 'Restock shelves', assigned_user_id: 'emp-1', assigned_by: 'mgr-3' },
      [{ title: 'Check inventory count' }],
    )

    expect(result).toEqual(mainTask)
    expect(taskRepository.createTask).toHaveBeenCalledTimes(2)
  })

  it('UC18-M-UT-E: Employee adds a sub-task while assigning a task to a Casual Worker', async () => {
    vi.mocked(taskRepository.getUserById).mockImplementation(async (id: string) => {
      if (id === 'emp-2') return { id: 'emp-2', role: 'Employee', company_id: 'comp-1' } as never
      if (id === 'cw-1') return { id: 'cw-1', role: 'Casual Worker', company_id: 'comp-1' } as never
      return null
    })
    vi.mocked(taskRepository.getEmployeeDepartmentIds).mockResolvedValue(['dept-1'])
    vi.mocked(taskRepository.getSupervisedCasualWorkerIds).mockResolvedValue(['cw-1'])
    const mainTask = { ...baseTask, id: 'task-4', assigned_user_id: 'cw-1', assigned_by: 'emp-2' }
    const subTask = { ...baseTask, id: 'task-4-sub', parent_task_id: 'task-4', title: 'Check inventory count', assigned_user_id: 'cw-1', assigned_by: 'emp-2' }
    vi.mocked(taskRepository.createTask).mockResolvedValueOnce(mainTask).mockResolvedValueOnce(subTask)

    const result = await taskService.assignTaskWithSubTasks(
      { company_id: 'comp-1', department_id: 'dept-1', title: 'Restock shelves', assigned_user_id: 'cw-1', assigned_by: 'emp-2' },
      [{ title: 'Check inventory count' }],
    )

    expect(result).toEqual(mainTask)
    expect(taskRepository.createTask).toHaveBeenCalledTimes(2)
  })
})
