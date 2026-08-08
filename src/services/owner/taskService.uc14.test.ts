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
    getTaskById: vi.fn(),
    getTasksByRecurrenceGroupId: vi.fn(),
    deleteSubTasksByParent: vi.fn(),
    deleteTask: vi.fn(),
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
  assigned_user_id: null,
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

describe('UC14 Delete Task', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(taskRepository.deleteSubTasksByParent).mockResolvedValue(undefined as never)
    vi.mocked(taskRepository.deleteTask).mockResolvedValue(undefined as never)
  })

  it('UC14-M-UT-O: Owner deletes an active task they created themselves', async () => {
    const task = { ...baseTask, id: 'task-1', assigned_by: 'owner-1' }
    vi.mocked(taskRepository.getTaskById).mockResolvedValue(task)

    await taskService.deleteTask('task-1', 'owner-1')

    expect(taskRepository.deleteTask).toHaveBeenCalledTimes(1)
    expect(taskRepository.deleteTask).toHaveBeenCalledWith('task-1')
  })

  it('UC14-M-UT-P: Partner deletes an active task they created themselves', async () => {
    const task = { ...baseTask, id: 'task-2', assigned_by: 'partner-1' }
    vi.mocked(taskRepository.getTaskById).mockResolvedValue(task)

    await taskService.deleteTask('task-2', 'partner-1')

    expect(taskRepository.deleteTask).toHaveBeenCalledTimes(1)
    expect(taskRepository.deleteTask).toHaveBeenCalledWith('task-2')
  })

  it('UC14-M-UT-M: Manager deletes an active task they created themselves', async () => {
    const task = { ...baseTask, id: 'task-3', assigned_by: 'mgr-1' }
    vi.mocked(taskRepository.getTaskById).mockResolvedValue(task)

    await taskService.deleteTask('task-3', 'mgr-1')

    expect(taskRepository.deleteTask).toHaveBeenCalledTimes(1)
    expect(taskRepository.deleteTask).toHaveBeenCalledWith('task-3')
  })

  it('UC14-M-UT-E: Employee deletes an active task they created themselves for a Casual Worker', async () => {
    const task = { ...baseTask, id: 'task-4', assigned_by: 'emp-1' }
    vi.mocked(taskRepository.getTaskById).mockResolvedValue(task)

    await taskService.deleteTask('task-4', 'emp-1')

    expect(taskRepository.deleteTask).toHaveBeenCalledTimes(1)
    expect(taskRepository.deleteTask).toHaveBeenCalledWith('task-4')
  })

  it('UC14-A1-UT-O: Owner deletes the original task of a recurring series', async () => {
    const original = { ...baseTask, id: 'task-10', assigned_by: 'owner-1', recurrence_group_id: 'rec-10', source_task_id: null }
    const sibling = { ...baseTask, id: 'task-11', assigned_by: 'owner-1', recurrence_group_id: 'rec-10', source_task_id: 'task-10' }
    vi.mocked(taskRepository.getTaskById).mockResolvedValue(original)
    vi.mocked(taskRepository.getTasksByRecurrenceGroupId).mockResolvedValue([original, sibling])

    await taskService.deleteTask('task-10', 'owner-1')

    expect(taskRepository.deleteTask).toHaveBeenCalledTimes(2)
    expect(taskRepository.deleteTask).toHaveBeenCalledWith('task-10')
    expect(taskRepository.deleteTask).toHaveBeenCalledWith('task-11')
  })

  it('UC14-A1-UT-P: Partner deletes the original task of a recurring series', async () => {
    const original = { ...baseTask, id: 'task-12', assigned_by: 'partner-1', recurrence_group_id: 'rec-11', source_task_id: null }
    const sibling = { ...baseTask, id: 'task-13', assigned_by: 'partner-1', recurrence_group_id: 'rec-11', source_task_id: 'task-12' }
    vi.mocked(taskRepository.getTaskById).mockResolvedValue(original)
    vi.mocked(taskRepository.getTasksByRecurrenceGroupId).mockResolvedValue([original, sibling])

    await taskService.deleteTask('task-12', 'partner-1')

    expect(taskRepository.deleteTask).toHaveBeenCalledTimes(2)
    expect(taskRepository.deleteTask).toHaveBeenCalledWith('task-12')
    expect(taskRepository.deleteTask).toHaveBeenCalledWith('task-13')
  })

  it('UC14-A1-UT-M: Manager deletes the original task of a recurring series', async () => {
    const original = { ...baseTask, id: 'task-14', assigned_by: 'mgr-1', recurrence_group_id: 'rec-12', source_task_id: null }
    const sibling = { ...baseTask, id: 'task-15', assigned_by: 'mgr-1', recurrence_group_id: 'rec-12', source_task_id: 'task-14' }
    vi.mocked(taskRepository.getTaskById).mockResolvedValue(original)
    vi.mocked(taskRepository.getTasksByRecurrenceGroupId).mockResolvedValue([original, sibling])

    await taskService.deleteTask('task-14', 'mgr-1')

    expect(taskRepository.deleteTask).toHaveBeenCalledTimes(2)
    expect(taskRepository.deleteTask).toHaveBeenCalledWith('task-14')
    expect(taskRepository.deleteTask).toHaveBeenCalledWith('task-15')
  })

  it('UC14-A1-UT-E: Employee deletes the original task of a recurring series', async () => {
    const original = { ...baseTask, id: 'task-16', assigned_by: 'emp-1', recurrence_group_id: 'rec-13', source_task_id: null }
    const sibling = { ...baseTask, id: 'task-17', assigned_by: 'emp-1', recurrence_group_id: 'rec-13', source_task_id: 'task-16' }
    vi.mocked(taskRepository.getTaskById).mockResolvedValue(original)
    vi.mocked(taskRepository.getTasksByRecurrenceGroupId).mockResolvedValue([original, sibling])

    await taskService.deleteTask('task-16', 'emp-1')

    expect(taskRepository.deleteTask).toHaveBeenCalledTimes(2)
    expect(taskRepository.deleteTask).toHaveBeenCalledWith('task-16')
    expect(taskRepository.deleteTask).toHaveBeenCalledWith('task-17')
  })
})
