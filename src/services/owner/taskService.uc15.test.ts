import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase', () => ({
  supabase: {},
  createClient: () => ({}),
}))

vi.mock('@/repositories/owner/taskRepository', () => ({
  taskRepository: {
    getTaskById: vi.fn(),
    getUserById: vi.fn(),
    createTask: vi.fn(),
    getSubTasks: vi.fn(),
  },
}))

import { taskService } from './taskService'
import { taskRepository } from '@/repositories/owner/taskRepository'

const baseTask = {
  id: 'task-1',
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

describe('UC15 Duplicate Task', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(taskRepository.getSubTasks).mockResolvedValue([])
  })

  it('UC15-M-UT-O: Owner duplicates a task they created themselves', async () => {
    const original = { ...baseTask, id: 'task-1', assigned_by: 'owner-1', assigned_user_id: 'mgr-1' }
    const duplicated = { ...original, id: 'task-1-copy', title: 'Restock shelves (copy)' }
    vi.mocked(taskRepository.getTaskById).mockResolvedValue(original)
    vi.mocked(taskRepository.createTask).mockResolvedValue(duplicated)

    const result = await taskService.duplicateTask('task-1', 'owner-1')

    expect(result).toEqual(duplicated)
    expect(taskRepository.createTask).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Restock shelves (copy)', assigned_user_id: 'mgr-1', assigned_by: 'owner-1', status: 'Assigned',
    }))
  })

  it('UC15-M-UT-P: Partner duplicates a task the Owner created', async () => {
    const original = { ...baseTask, id: 'task-2', assigned_by: 'owner-2', assigned_user_id: 'mgr-2' }
    const duplicated = { ...original, id: 'task-2-copy', title: 'Restock shelves (copy)', assigned_by: 'partner-1' }
    vi.mocked(taskRepository.getTaskById).mockResolvedValue(original)
    vi.mocked(taskRepository.getUserById).mockImplementation(async (id: string) => {
      if (id === 'partner-1') return { id: 'partner-1', role: 'Partner', company_id: 'comp-1' } as never
      if (id === 'owner-2') return { id: 'owner-2', role: 'Owner', company_id: 'comp-1' } as never
      return null
    })
    vi.mocked(taskRepository.createTask).mockResolvedValue(duplicated)

    const result = await taskService.duplicateTask('task-2', 'partner-1')

    expect(result).toEqual(duplicated)
    expect(taskRepository.createTask).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Restock shelves (copy)', assigned_user_id: 'mgr-2', assigned_by: 'partner-1', status: 'Assigned',
    }))
  })

  it('UC15-M-UT-M: Manager duplicates a task they created themselves', async () => {
    const original = { ...baseTask, id: 'task-3', assigned_by: 'mgr-3', assigned_user_id: 'emp-3' }
    const duplicated = { ...original, id: 'task-3-copy', title: 'Restock shelves (copy)' }
    vi.mocked(taskRepository.getTaskById).mockResolvedValue(original)
    vi.mocked(taskRepository.createTask).mockResolvedValue(duplicated)

    const result = await taskService.duplicateTask('task-3', 'mgr-3')

    expect(result).toEqual(duplicated)
    expect(taskRepository.createTask).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Restock shelves (copy)', assigned_user_id: 'emp-3', assigned_by: 'mgr-3', status: 'Assigned',
    }))
  })
})
