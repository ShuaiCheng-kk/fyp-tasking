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
    getUserById: vi.fn(),
    getSubTasks: vi.fn(),
    updateTask: vi.fn(),
    createTask: vi.fn(),
    getTasksByRecurrenceGroupId: vi.fn(),
    deleteSubTasksByParent: vi.fn(),
    deleteTask: vi.fn(),
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
  source_task_id: null,
  is_archived: false,
  is_completed: false,
  created_at: '2026-08-01T00:00:00.000Z',
}

describe('UC16 Set Recurring Task', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(taskRepository.getSubTasks).mockResolvedValue([])
    vi.mocked(taskRepository.updateTask).mockResolvedValue(undefined as never)
    vi.mocked(taskRepository.deleteSubTasksByParent).mockResolvedValue(undefined as never)
    vi.mocked(taskRepository.deleteTask).mockResolvedValue(undefined as never)
  })

  it('UC16-M-UT-O: Owner sets a weekly recurring rule on a task that is not yet recurring', async () => {
    const original = { ...baseTask, id: 'task-1', assigned_by: 'owner-1', assigned_user_id: 'mgr-1', task_date: '2026-08-10', recurrence_group_id: null }
    const generated = { ...baseTask, id: 'task-1a', assigned_by: 'owner-1', assigned_user_id: 'mgr-1', task_date: '2026-08-17', recurrence_group_id: 'rec-new', source_task_id: 'task-1' }
    vi.mocked(taskRepository.getTaskById).mockResolvedValue(original)
    vi.mocked(taskRepository.getUserById).mockResolvedValue({ id: 'owner-1', role: 'Owner', company_id: 'comp-1' } as never)
    vi.mocked(taskRepository.createTask).mockResolvedValue(generated)

    const result = await taskService.createRecurringTasks('task-1', {
      assigned_by: 'owner-1', recurrence_rule: 'weekly', recurrence_end_date: '2026-08-17',
    })

    expect(result).toEqual([generated])
    expect(taskRepository.getTasksByRecurrenceGroupId).not.toHaveBeenCalled()
    expect(taskRepository.deleteTask).not.toHaveBeenCalled()
    expect(taskRepository.createTask).toHaveBeenCalledWith(expect.objectContaining({
      task_date: '2026-08-17', source_task_id: 'task-1',
    }))
  })

  it('UC16-M-UT-P: Partner sets a weekly recurring rule on a task that is not yet recurring', async () => {
    const original = { ...baseTask, id: 'task-2', assigned_by: 'partner-1', assigned_user_id: 'mgr-2', task_date: '2026-08-10', recurrence_group_id: null }
    const generated = { ...baseTask, id: 'task-2a', assigned_by: 'partner-1', assigned_user_id: 'mgr-2', task_date: '2026-08-17', recurrence_group_id: 'rec-new-2', source_task_id: 'task-2' }
    vi.mocked(taskRepository.getTaskById).mockResolvedValue(original)
    vi.mocked(taskRepository.getUserById).mockResolvedValue({ id: 'partner-1', role: 'Partner', company_id: 'comp-1' } as never)
    vi.mocked(taskRepository.createTask).mockResolvedValue(generated)

    const result = await taskService.createRecurringTasks('task-2', {
      assigned_by: 'partner-1', recurrence_rule: 'weekly', recurrence_end_date: '2026-08-17',
    })

    expect(result).toEqual([generated])
    expect(taskRepository.getTasksByRecurrenceGroupId).not.toHaveBeenCalled()
    expect(taskRepository.deleteTask).not.toHaveBeenCalled()
  })

  it('UC16-M-UT-M: Manager sets a weekly recurring rule on a task that is not yet recurring', async () => {
    const original = { ...baseTask, id: 'task-3', assigned_by: 'mgr-1', assigned_user_id: 'emp-1', task_date: '2026-08-10', recurrence_group_id: null }
    const generated = { ...baseTask, id: 'task-3a', assigned_by: 'mgr-1', assigned_user_id: 'emp-1', task_date: '2026-08-17', recurrence_group_id: 'rec-new-3', source_task_id: 'task-3' }
    vi.mocked(taskRepository.getTaskById).mockResolvedValue(original)
    vi.mocked(taskRepository.getUserById).mockResolvedValue({ id: 'mgr-1', role: 'Manager', company_id: 'comp-1' } as never)
    vi.mocked(taskRepository.createTask).mockResolvedValue(generated)

    const result = await taskService.createRecurringTasks('task-3', {
      assigned_by: 'mgr-1', recurrence_rule: 'weekly', recurrence_end_date: '2026-08-17',
    })

    expect(result).toEqual([generated])
    expect(taskRepository.getTasksByRecurrenceGroupId).not.toHaveBeenCalled()
    expect(taskRepository.deleteTask).not.toHaveBeenCalled()
  })

  it('UC16-A1-UT-O: Owner re-edits the rules of an already-recurring task, replacing its series', async () => {
    const original = { ...baseTask, id: 'task-20', assigned_by: 'owner-1', assigned_user_id: 'mgr-1', task_date: '2026-08-10', recurrence_group_id: 'rec-old' }
    const oldSibling = { ...baseTask, id: 'task-21', assigned_by: 'owner-1', assigned_user_id: 'mgr-1', task_date: '2026-08-17', recurrence_group_id: 'rec-old', source_task_id: 'task-20' }
    const newOccurrence = { ...baseTask, id: 'task-22', assigned_by: 'owner-1', assigned_user_id: 'mgr-1', task_date: '2026-08-17', recurrence_group_id: 'rec-old', source_task_id: 'task-20' }
    vi.mocked(taskRepository.getTaskById).mockResolvedValue(original)
    vi.mocked(taskRepository.getUserById).mockResolvedValue({ id: 'owner-1', role: 'Owner', company_id: 'comp-1' } as never)
    vi.mocked(taskRepository.getTasksByRecurrenceGroupId).mockResolvedValue([original, oldSibling])
    vi.mocked(taskRepository.createTask).mockResolvedValue(newOccurrence)

    const result = await taskService.createRecurringTasks('task-20', {
      assigned_by: 'owner-1', recurrence_rule: 'weekly', recurrence_end_date: '2026-08-17',
    })

    expect(result).toEqual([newOccurrence])
    expect(taskRepository.deleteTask).toHaveBeenCalledTimes(1)
    expect(taskRepository.deleteTask).toHaveBeenCalledWith('task-21')
    expect(taskRepository.createTask).toHaveBeenCalledWith(expect.objectContaining({
      task_date: '2026-08-17', recurrence_group_id: 'rec-old', source_task_id: 'task-20',
    }))
  })

  it('UC16-A1-UT-P: Partner re-edits the rules of an already-recurring task, replacing its series', async () => {
    const original = { ...baseTask, id: 'task-23', assigned_by: 'partner-1', assigned_user_id: 'mgr-2', task_date: '2026-08-10', recurrence_group_id: 'rec-old-2' }
    const oldSibling = { ...baseTask, id: 'task-24', assigned_by: 'partner-1', assigned_user_id: 'mgr-2', task_date: '2026-08-17', recurrence_group_id: 'rec-old-2', source_task_id: 'task-23' }
    const newOccurrence = { ...baseTask, id: 'task-25', assigned_by: 'partner-1', assigned_user_id: 'mgr-2', task_date: '2026-08-17', recurrence_group_id: 'rec-old-2', source_task_id: 'task-23' }
    vi.mocked(taskRepository.getTaskById).mockResolvedValue(original)
    vi.mocked(taskRepository.getUserById).mockResolvedValue({ id: 'partner-1', role: 'Partner', company_id: 'comp-1' } as never)
    vi.mocked(taskRepository.getTasksByRecurrenceGroupId).mockResolvedValue([original, oldSibling])
    vi.mocked(taskRepository.createTask).mockResolvedValue(newOccurrence)

    const result = await taskService.createRecurringTasks('task-23', {
      assigned_by: 'partner-1', recurrence_rule: 'weekly', recurrence_end_date: '2026-08-17',
    })

    expect(result).toEqual([newOccurrence])
    expect(taskRepository.deleteTask).toHaveBeenCalledTimes(1)
    expect(taskRepository.deleteTask).toHaveBeenCalledWith('task-24')
  })

  it('UC16-A1-UT-M: Manager re-edits the rules of an already-recurring task, replacing its series', async () => {
    const original = { ...baseTask, id: 'task-26', assigned_by: 'mgr-1', assigned_user_id: 'emp-1', task_date: '2026-08-10', recurrence_group_id: 'rec-old-3' }
    const oldSibling = { ...baseTask, id: 'task-27', assigned_by: 'mgr-1', assigned_user_id: 'emp-1', task_date: '2026-08-17', recurrence_group_id: 'rec-old-3', source_task_id: 'task-26' }
    const newOccurrence = { ...baseTask, id: 'task-28', assigned_by: 'mgr-1', assigned_user_id: 'emp-1', task_date: '2026-08-17', recurrence_group_id: 'rec-old-3', source_task_id: 'task-26' }
    vi.mocked(taskRepository.getTaskById).mockResolvedValue(original)
    vi.mocked(taskRepository.getUserById).mockResolvedValue({ id: 'mgr-1', role: 'Manager', company_id: 'comp-1' } as never)
    vi.mocked(taskRepository.getTasksByRecurrenceGroupId).mockResolvedValue([original, oldSibling])
    vi.mocked(taskRepository.createTask).mockResolvedValue(newOccurrence)

    const result = await taskService.createRecurringTasks('task-26', {
      assigned_by: 'mgr-1', recurrence_rule: 'weekly', recurrence_end_date: '2026-08-17',
    })

    expect(result).toEqual([newOccurrence])
    expect(taskRepository.deleteTask).toHaveBeenCalledTimes(1)
    expect(taskRepository.deleteTask).toHaveBeenCalledWith('task-27')
  })

  // Same deleteTask cascade branch already verified in UC14-A1 — reused here so UC16 (where this
  // behavior is also documented, as "Delete Series") has its own evidence on file.
  it('UC16-A2-UT-O: Owner deletes the original task of a recurring series, deleting the whole series', async () => {
    const original = { ...baseTask, id: 'task-30', assigned_by: 'owner-1', task_date: '2026-08-10', recurrence_group_id: 'rec-30', source_task_id: null }
    const sibling = { ...baseTask, id: 'task-31', assigned_by: 'owner-1', task_date: '2026-08-17', recurrence_group_id: 'rec-30', source_task_id: 'task-30' }
    vi.mocked(taskRepository.getTaskById).mockResolvedValue(original)
    vi.mocked(taskRepository.getTasksByRecurrenceGroupId).mockResolvedValue([original, sibling])

    await taskService.deleteTask('task-30', 'owner-1')

    expect(taskRepository.deleteTask).toHaveBeenCalledTimes(2)
    expect(taskRepository.deleteTask).toHaveBeenCalledWith('task-30')
    expect(taskRepository.deleteTask).toHaveBeenCalledWith('task-31')
  })

  it('UC16-A2-UT-P: Partner deletes the original task of a recurring series, deleting the whole series', async () => {
    const original = { ...baseTask, id: 'task-32', assigned_by: 'partner-1', task_date: '2026-08-10', recurrence_group_id: 'rec-31', source_task_id: null }
    const sibling = { ...baseTask, id: 'task-33', assigned_by: 'partner-1', task_date: '2026-08-17', recurrence_group_id: 'rec-31', source_task_id: 'task-32' }
    vi.mocked(taskRepository.getTaskById).mockResolvedValue(original)
    vi.mocked(taskRepository.getTasksByRecurrenceGroupId).mockResolvedValue([original, sibling])

    await taskService.deleteTask('task-32', 'partner-1')

    expect(taskRepository.deleteTask).toHaveBeenCalledTimes(2)
    expect(taskRepository.deleteTask).toHaveBeenCalledWith('task-32')
    expect(taskRepository.deleteTask).toHaveBeenCalledWith('task-33')
  })

  it('UC16-A2-UT-M: Manager deletes the original task of a recurring series, deleting the whole series', async () => {
    const original = { ...baseTask, id: 'task-34', assigned_by: 'mgr-1', task_date: '2026-08-10', recurrence_group_id: 'rec-32', source_task_id: null }
    const sibling = { ...baseTask, id: 'task-35', assigned_by: 'mgr-1', task_date: '2026-08-17', recurrence_group_id: 'rec-32', source_task_id: 'task-34' }
    vi.mocked(taskRepository.getTaskById).mockResolvedValue(original)
    vi.mocked(taskRepository.getTasksByRecurrenceGroupId).mockResolvedValue([original, sibling])

    await taskService.deleteTask('task-34', 'mgr-1')

    expect(taskRepository.deleteTask).toHaveBeenCalledTimes(2)
    expect(taskRepository.deleteTask).toHaveBeenCalledWith('task-34')
    expect(taskRepository.deleteTask).toHaveBeenCalledWith('task-35')
  })
})
