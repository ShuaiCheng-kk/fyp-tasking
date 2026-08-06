import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase', () => ({
  supabase: {},
  createClient: () => ({}),
}))

vi.mock('@/repositories/owner/taskRepository', () => ({
  taskRepository: {
    getTaskById: vi.fn(),
    getUserById: vi.fn(),
    getSubTasks: vi.fn(),
    updateTask: vi.fn(),
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

describe('UC21 Set Task Dependencies', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('UC21-M-UT-O: Owner reorders the sub-tasks of a task they created themselves', async () => {
    const parent = { ...baseTask, id: 'task-1', assigned_by: 'owner-1' }
    const sub1 = { ...baseTask, id: 'sub-1', parent_task_id: 'task-1', title: 'Count stock', sequence_order: 0 }
    const sub2 = { ...baseTask, id: 'sub-2', parent_task_id: 'task-1', title: 'Label shelves', sequence_order: 1 }
    vi.mocked(taskRepository.getTaskById).mockResolvedValue(parent)
    vi.mocked(taskRepository.getSubTasks).mockResolvedValue([sub1, sub2])
    vi.mocked(taskRepository.updateTask).mockImplementation(async (id: string, fields: any) => ({ id, ...fields }) as never)

    const result = await taskService.reorderSubTasks('task-1', ['sub-2', 'sub-1'], 'owner-1')

    expect(result).toHaveLength(2)
    expect(taskRepository.updateTask).toHaveBeenCalledWith('sub-2', { sequence_order: 0 })
    expect(taskRepository.updateTask).toHaveBeenCalledWith('sub-1', { sequence_order: 1 })
  })

  it('UC21-M-UT-P: Partner reorders the sub-tasks of a task that the Owner created', async () => {
    const parent = { ...baseTask, id: 'task-2', assigned_by: 'owner-2' }
    const sub1 = { ...baseTask, id: 'sub-3', parent_task_id: 'task-2', title: 'Count stock', sequence_order: 0 }
    const sub2 = { ...baseTask, id: 'sub-4', parent_task_id: 'task-2', title: 'Label shelves', sequence_order: 1 }
    vi.mocked(taskRepository.getTaskById).mockResolvedValue(parent)
    vi.mocked(taskRepository.getUserById).mockImplementation((async (id: string) => {
      if (id === 'partner-1') return { id: 'partner-1', role: 'Partner', company_id: 'comp-1' }
      if (id === 'owner-2') return { id: 'owner-2', role: 'Owner', company_id: 'comp-1' }
      return null
    }) as never)
    vi.mocked(taskRepository.getSubTasks).mockResolvedValue([sub1, sub2])
    vi.mocked(taskRepository.updateTask).mockImplementation(async (id: string, fields: any) => ({ id, ...fields }) as never)

    const result = await taskService.reorderSubTasks('task-2', ['sub-4', 'sub-3'], 'partner-1')

    expect(result).toHaveLength(2)
    expect(taskRepository.updateTask).toHaveBeenCalledWith('sub-4', { sequence_order: 0 })
    expect(taskRepository.updateTask).toHaveBeenCalledWith('sub-3', { sequence_order: 1 })
  })

  it('UC21-M-UT-M: Manager reorders the sub-tasks of a task they created themselves', async () => {
    const parent = { ...baseTask, id: 'task-3', assigned_by: 'mgr-1' }
    const sub1 = { ...baseTask, id: 'sub-5', parent_task_id: 'task-3', title: 'Count stock', sequence_order: 0 }
    const sub2 = { ...baseTask, id: 'sub-6', parent_task_id: 'task-3', title: 'Label shelves', sequence_order: 1 }
    vi.mocked(taskRepository.getTaskById).mockResolvedValue(parent)
    vi.mocked(taskRepository.getSubTasks).mockResolvedValue([sub1, sub2])
    vi.mocked(taskRepository.updateTask).mockImplementation(async (id: string, fields: any) => ({ id, ...fields }) as never)

    const result = await taskService.reorderSubTasks('task-3', ['sub-6', 'sub-5'], 'mgr-1')

    expect(result).toHaveLength(2)
    expect(taskRepository.updateTask).toHaveBeenCalledWith('sub-6', { sequence_order: 0 })
    expect(taskRepository.updateTask).toHaveBeenCalledWith('sub-5', { sequence_order: 1 })
  })

  it('UC21-BR-UT-E-1: Employee ticks a sub-task in the correct order', async () => {
    const parent = { ...baseTask, id: 'task-10', assigned_by: 'mgr-1', assigned_user_id: 'emp-1', status: 'In Progress' as const }
    const sub1 = { ...baseTask, id: 'sub-10', parent_task_id: 'task-10', sequence_order: 0, is_completed: false }
    const sub2 = { ...baseTask, id: 'sub-11', parent_task_id: 'task-10', sequence_order: 1, is_completed: false }
    vi.mocked(taskRepository.getTaskById).mockImplementation((async (id: string) => {
      if (id === 'sub-10') return sub1
      if (id === 'task-10') return parent
      return null
    }) as never)
    vi.mocked(taskRepository.getSubTasks).mockResolvedValue([sub1, sub2])
    const ticked = { ...sub1, is_completed: true }
    vi.mocked(taskRepository.updateTask).mockResolvedValue(ticked)

    const result = await taskService.completeSubTask('sub-10', 'emp-1')

    expect(result).toEqual([ticked, parent])
    expect(taskRepository.updateTask).toHaveBeenCalledWith('sub-10', { is_completed: true })
  })

  it('UC21-BR-UT-E-2: Employee is blocked from ticking a sub-task before the earlier one is ticked', async () => {
    const parent = { ...baseTask, id: 'task-11', assigned_by: 'mgr-1', assigned_user_id: 'emp-1', status: 'In Progress' as const }
    const sub1 = { ...baseTask, id: 'sub-12', parent_task_id: 'task-11', sequence_order: 0, is_completed: false }
    const sub2 = { ...baseTask, id: 'sub-13', parent_task_id: 'task-11', sequence_order: 1, is_completed: false }
    vi.mocked(taskRepository.getTaskById).mockImplementation((async (id: string) => {
      if (id === 'sub-13') return sub2
      if (id === 'task-11') return parent
      return null
    }) as never)
    vi.mocked(taskRepository.getSubTasks).mockResolvedValue([sub1, sub2])

    await expect(taskService.completeSubTask('sub-13', 'emp-1'))
      .rejects.toThrow('Complete the previous sub-tasks first')

    expect(taskRepository.updateTask).not.toHaveBeenCalled()
  })
})
