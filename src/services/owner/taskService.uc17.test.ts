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
  assigned_user_id: null,
  status: 'Assigned' as const,
  priority: 'Medium',
  due_at: null,
  task_date: '2026-08-10',
  source_task_id: null,
  is_archived: false,
  is_completed: false,
  created_at: '2026-08-01T00:00:00.000Z',
}

describe('UC17 Archive Task', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(taskRepository.getSubTasks).mockResolvedValue([])
  })

  it('UC17-M-UT-O: Owner archives an active task they created themselves', async () => {
    const task = { ...baseTask, id: 'task-1', assigned_by: 'owner-1', recurrence_group_id: null }
    const archived = { ...task, is_archived: true }
    vi.mocked(taskRepository.getTaskById).mockResolvedValue(task)
    vi.mocked(taskRepository.updateTask).mockResolvedValue(archived)

    const result = await taskService.archiveTask('task-1', 'owner-1')

    expect(result).toEqual(archived)
    expect(taskRepository.updateTask).toHaveBeenCalledWith('task-1', { is_archived: true })
  })

  it('UC17-M-UT-P: Partner archives an active task they created themselves', async () => {
    const task = { ...baseTask, id: 'task-2', assigned_by: 'partner-1', recurrence_group_id: null }
    const archived = { ...task, is_archived: true }
    vi.mocked(taskRepository.getTaskById).mockResolvedValue(task)
    vi.mocked(taskRepository.updateTask).mockResolvedValue(archived)

    const result = await taskService.archiveTask('task-2', 'partner-1')

    expect(result).toEqual(archived)
    expect(taskRepository.updateTask).toHaveBeenCalledWith('task-2', { is_archived: true })
  })

  it('UC17-M-UT-M: Manager archives an active task they created themselves', async () => {
    const task = { ...baseTask, id: 'task-3', assigned_by: 'mgr-1', recurrence_group_id: null }
    const archived = { ...task, is_archived: true }
    vi.mocked(taskRepository.getTaskById).mockResolvedValue(task)
    vi.mocked(taskRepository.updateTask).mockResolvedValue(archived)

    const result = await taskService.archiveTask('task-3', 'mgr-1')

    expect(result).toEqual(archived)
    expect(taskRepository.updateTask).toHaveBeenCalledWith('task-3', { is_archived: true })
  })

  it('UC17-A1-UT-O: Owner archives the original task of a recurring series, archiving the whole series', async () => {
    const original = { ...baseTask, id: 'task-10', assigned_by: 'owner-1', recurrence_group_id: 'rec-10' }
    const sibling = { ...baseTask, id: 'task-11', assigned_by: 'owner-1', recurrence_group_id: 'rec-10', source_task_id: 'task-10' }
    vi.mocked(taskRepository.getTaskById).mockResolvedValue(original)
    vi.mocked(taskRepository.getTasksByRecurrenceGroupId).mockResolvedValue([original, sibling])
    vi.mocked(taskRepository.updateTask).mockImplementation(async (id: string, fields: any) => ({ id, ...fields }) as never)

    await taskService.archiveTask('task-10', 'owner-1')

    expect(taskRepository.updateTask).toHaveBeenCalledWith('task-10', { is_archived: true })
    expect(taskRepository.updateTask).toHaveBeenCalledWith('task-11', { is_archived: true })
  })

  it('UC17-A1-UT-P: Partner archives the original task of a recurring series, archiving the whole series', async () => {
    const original = { ...baseTask, id: 'task-12', assigned_by: 'partner-1', recurrence_group_id: 'rec-11' }
    const sibling = { ...baseTask, id: 'task-13', assigned_by: 'partner-1', recurrence_group_id: 'rec-11', source_task_id: 'task-12' }
    vi.mocked(taskRepository.getTaskById).mockResolvedValue(original)
    vi.mocked(taskRepository.getTasksByRecurrenceGroupId).mockResolvedValue([original, sibling])
    vi.mocked(taskRepository.updateTask).mockImplementation(async (id: string, fields: any) => ({ id, ...fields }) as never)

    await taskService.archiveTask('task-12', 'partner-1')

    expect(taskRepository.updateTask).toHaveBeenCalledWith('task-12', { is_archived: true })
    expect(taskRepository.updateTask).toHaveBeenCalledWith('task-13', { is_archived: true })
  })

  it('UC17-A1-UT-M: Manager archives the original task of a recurring series, archiving the whole series', async () => {
    const original = { ...baseTask, id: 'task-14', assigned_by: 'mgr-1', recurrence_group_id: 'rec-12' }
    const sibling = { ...baseTask, id: 'task-15', assigned_by: 'mgr-1', recurrence_group_id: 'rec-12', source_task_id: 'task-14' }
    vi.mocked(taskRepository.getTaskById).mockResolvedValue(original)
    vi.mocked(taskRepository.getTasksByRecurrenceGroupId).mockResolvedValue([original, sibling])
    vi.mocked(taskRepository.updateTask).mockImplementation(async (id: string, fields: any) => ({ id, ...fields }) as never)

    await taskService.archiveTask('task-14', 'mgr-1')

    expect(taskRepository.updateTask).toHaveBeenCalledWith('task-14', { is_archived: true })
    expect(taskRepository.updateTask).toHaveBeenCalledWith('task-15', { is_archived: true })
  })

  it('UC17-A2-UT-O: Owner restores an archived task they created themselves', async () => {
    const task = { ...baseTask, id: 'task-20', assigned_by: 'owner-1', recurrence_group_id: null, is_archived: true }
    const restored = { ...task, is_archived: false }
    vi.mocked(taskRepository.getTaskById).mockResolvedValue(task)
    vi.mocked(taskRepository.updateTask).mockResolvedValue(restored)

    const result = await taskService.unarchiveTask('task-20', 'owner-1')

    expect(result).toEqual(restored)
    expect(taskRepository.updateTask).toHaveBeenCalledWith('task-20', { is_archived: false })
  })

  it('UC17-A2-UT-P: Partner restores an archived task they created themselves', async () => {
    const task = { ...baseTask, id: 'task-21', assigned_by: 'partner-1', recurrence_group_id: null, is_archived: true }
    const restored = { ...task, is_archived: false }
    vi.mocked(taskRepository.getTaskById).mockResolvedValue(task)
    vi.mocked(taskRepository.updateTask).mockResolvedValue(restored)

    const result = await taskService.unarchiveTask('task-21', 'partner-1')

    expect(result).toEqual(restored)
    expect(taskRepository.updateTask).toHaveBeenCalledWith('task-21', { is_archived: false })
  })

  it('UC17-A2-UT-M: Manager restores an archived task they created themselves', async () => {
    const task = { ...baseTask, id: 'task-22', assigned_by: 'mgr-1', recurrence_group_id: null, is_archived: true }
    const restored = { ...task, is_archived: false }
    vi.mocked(taskRepository.getTaskById).mockResolvedValue(task)
    vi.mocked(taskRepository.updateTask).mockResolvedValue(restored)

    const result = await taskService.unarchiveTask('task-22', 'mgr-1')

    expect(result).toEqual(restored)
    expect(taskRepository.updateTask).toHaveBeenCalledWith('task-22', { is_archived: false })
  })
})
