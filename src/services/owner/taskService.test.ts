import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase', () => ({
  supabase: {},
  createClient: () => ({}),
}))

vi.mock('@/repositories/owner/taskRepository', () => ({
  taskRepository: {
    createTask: vi.fn(),
    getTasksByCompany: vi.fn(),
    getArchivedTasksByCompany: vi.fn(),
    getTasksByShift: vi.fn(),
    getTasksByShiftForCompany: vi.fn(),
    getSubTasks: vi.fn(),
    getTaskById: vi.fn(),
    getTasksByRecurrenceGroupId: vi.fn(),
    getUserById: vi.fn(),
    getManagerDepartmentIds: vi.fn(),
    getEmployeeDepartmentIds: vi.fn(),
    getShiftById: vi.fn(),
    updateTask: vi.fn(),
    deleteTask: vi.fn(),
    deleteSubTasksByParent: vi.fn(),
    getTaskStatsByCompany: vi.fn(),
    getTaskStatsByDepartment: vi.fn(),
    getActivityFeedToday: vi.fn(),
    getTasksByCompanyWithFilters: vi.fn(),
    getActiveTasksByAssignees: vi.fn(),
  },
}))

import { taskService } from './taskService'
import { taskRepository } from '@/repositories/owner/taskRepository'
import { Task } from '@/types/Task'

const baseTask: Task = {
  id: 'task-1',
  shift_id: 'shift-1',
  company_id: 'company-1',
  department_id: 'dept-1',
  parent_task_id: null,
  sequence_order: null,
  title: 'Stock shelves',
  description: null,
  assigned_user_id: 'manager-1',
  assigned_by: 'owner-1',
  status: 'Assigned',
  percentage_complete: 0,
  priority: 'Medium',
  due_at: '2026-06-25T17:00:00.000Z',
  task_date: '2026-06-25',
  recurrence_group_id: null,
  source_task_id: null,
  is_archived: false,
  created_at: '2026-06-20T00:00:00.000Z',
  updated_at: '2026-06-20T00:00:00.000Z',
}

describe('taskService — Task (UC14-26)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('assignTask (UC14)', () => {
    it('requires company_id, department_id, and title', async () => {
      await expect(taskService.assignTask({
        company_id: '', department_id: 'dept-1', title: 'x',
      })).rejects.toThrow('company_id, department_id, and title are required')
    })

    it('rejects percentage_complete outside 0-100', async () => {
      vi.mocked(taskRepository.getUserById).mockResolvedValue(null)
      await expect(taskService.assignTask({
        company_id: 'company-1', department_id: 'dept-1', title: 'Task', percentage_complete: 150,
      })).rejects.toThrow('percentage_complete must be between 0 and 100')
    })

    it('rejects when Owner assigns to a non-Manager', async () => {
      vi.mocked(taskRepository.getUserById).mockImplementation(async (id: string) => {
        if (id === 'owner-1') return { id: 'owner-1', role: 'Owner', company_id: 'company-1' } as any
        if (id === 'employee-1') return { id: 'employee-1', role: 'Employee', company_id: 'company-1' } as any
        return null
      })
      await expect(taskService.assignTask({
        company_id: 'company-1', department_id: 'dept-1', title: 'Task',
        assigned_by: 'owner-1', assigned_user_id: 'employee-1',
      })).rejects.toThrow('Owner tasks can only be assigned to Managers')
    })

    it('rejects when assignee belongs to a different company', async () => {
      vi.mocked(taskRepository.getUserById).mockImplementation(async (id: string) => {
        if (id === 'owner-1') return { id: 'owner-1', role: 'Owner', company_id: 'company-1' } as any
        if (id === 'manager-1') return { id: 'manager-1', role: 'Manager', company_id: 'company-2' } as any
        return null
      })
      await expect(taskService.assignTask({
        company_id: 'company-1', department_id: 'dept-1', title: 'Task',
        assigned_by: 'owner-1', assigned_user_id: 'manager-1',
      })).rejects.toThrow('Selected assignee does not belong to this company')
    })

    it('creates a task when Owner assigns to a Manager', async () => {
      vi.mocked(taskRepository.getUserById).mockImplementation(async (id: string) => {
        if (id === 'owner-1') return { id: 'owner-1', role: 'Owner', company_id: 'company-1' } as any
        if (id === 'manager-1') return { id: 'manager-1', role: 'Manager', company_id: 'company-1' } as any
        return null
      })
      vi.mocked(taskRepository.createTask).mockResolvedValue(baseTask)

      const result = await taskService.assignTask({
        company_id: 'company-1', department_id: 'dept-1', title: 'Stock shelves',
        assigned_by: 'owner-1', assigned_user_id: 'manager-1',
      })

      expect(result).toEqual(baseTask)
      expect(taskRepository.createTask).toHaveBeenCalledOnce()
    })

    it('rejects a Manager assigning outside their own department', async () => {
      vi.mocked(taskRepository.getUserById).mockImplementation(async (id: string) => {
        if (id === 'manager-1') return { id: 'manager-1', role: 'Manager', company_id: 'company-1' } as any
        if (id === 'employee-1') return { id: 'employee-1', role: 'Employee', company_id: 'company-1' } as any
        return null
      })
      vi.mocked(taskRepository.getManagerDepartmentIds).mockResolvedValue(['dept-2'])

      await expect(taskService.assignTask({
        company_id: 'company-1', department_id: 'dept-1', title: 'Task',
        assigned_by: 'manager-1', assigned_user_id: 'employee-1',
      })).rejects.toThrow('Managers can only create tasks for their own departments')
    })

    it('rejects when the shift belongs to a different department', async () => {
      vi.mocked(taskRepository.getUserById).mockResolvedValue(null)
      vi.mocked(taskRepository.getShiftById).mockResolvedValue({
        id: 'shift-1', company_id: 'company-1', department_id: 'dept-2',
      } as any)

      await expect(taskService.assignTask({
        company_id: 'company-1', department_id: 'dept-1', title: 'Task', shift_id: 'shift-1',
      })).rejects.toThrow('Selected shift does not belong to this department')
    })

    it('rejects adding a sub-task to an existing task when the acting user did not assign the parent', async () => {
      vi.mocked(taskRepository.getUserById).mockResolvedValue(null)
      vi.mocked(taskRepository.getTaskById).mockResolvedValue(baseTask)
      await expect(taskService.assignTask({
        company_id: 'company-1', department_id: 'dept-1', title: 'Sub task',
        parent_task_id: 'task-1', assigned_by: 'someone-else',
      })).rejects.toThrow('Only the user who assigned this task can perform this action')
    })

    it('allows adding a sub-task to an existing task when the acting user is the parent\'s assigner', async () => {
      vi.mocked(taskRepository.getUserById).mockResolvedValue(null)
      vi.mocked(taskRepository.getTaskById).mockResolvedValue(baseTask)
      vi.mocked(taskRepository.createTask).mockResolvedValue({ ...baseTask, id: 'sub-1', parent_task_id: 'task-1' })
      const result = await taskService.assignTask({
        company_id: 'company-1', department_id: 'dept-1', title: 'Sub task',
        parent_task_id: 'task-1', assigned_by: 'owner-1',
      })
      expect(result.id).toBe('sub-1')
    })
  })

  describe('editTask (UC16)', () => {
    it('requires an id', async () => {
      await expect(taskService.editTask('', { title: 'x' })).rejects.toThrow('Task id is required')
    })

    const unassignedTask: Task = { ...baseTask, assigned_user_id: null, shift_id: null }

    it('rejects an invalid status', async () => {
      vi.mocked(taskRepository.getTaskById).mockResolvedValue(unassignedTask)
      await expect(taskService.editTask('task-1', { status: 'Bogus' as any }, 'owner-1'))
        .rejects.toThrow('status must be one of: Assigned, In Progress, Review, Complete')
    })

    it('rejects percentage_complete outside 0-100', async () => {
      vi.mocked(taskRepository.getTaskById).mockResolvedValue(unassignedTask)
      await expect(taskService.editTask('task-1', { percentage_complete: -5 }, 'owner-1'))
        .rejects.toThrow('percentage_complete must be between 0 and 100')
    })

    it('updates the task when valid', async () => {
      vi.mocked(taskRepository.getTaskById).mockResolvedValue(unassignedTask)
      vi.mocked(taskRepository.updateTask).mockResolvedValue({ ...baseTask, status: 'In Progress' })

      const result = await taskService.editTask('task-1', { status: 'In Progress' }, 'owner-1')

      expect(result.status).toBe('In Progress')
      expect(taskRepository.updateTask).toHaveBeenCalledWith('task-1', { status: 'In Progress' })
    })

    it('rejects when the acting user is not the one who assigned the task', async () => {
      vi.mocked(taskRepository.getTaskById).mockResolvedValue(unassignedTask)
      await expect(taskService.editTask('task-1', { status: 'In Progress' }, 'someone-else'))
        .rejects.toThrow('Only the user who assigned this task can perform this action')
    })
  })

  describe('deleteTask (UC17)', () => {
    it('requires an id', async () => {
      await expect(taskService.deleteTask('')).rejects.toThrow('Task id is required')
    })

    it('deletes sub-tasks before deleting the task', async () => {
      vi.mocked(taskRepository.getTaskById).mockResolvedValue(baseTask)
      await taskService.deleteTask('task-1', 'owner-1')
      expect(taskRepository.deleteSubTasksByParent).toHaveBeenCalledWith('task-1')
      expect(taskRepository.deleteTask).toHaveBeenCalledWith('task-1')
    })

    it('rejects when the acting user is not the one who assigned the task', async () => {
      vi.mocked(taskRepository.getTaskById).mockResolvedValue(baseTask)
      await expect(taskService.deleteTask('task-1', 'someone-else'))
        .rejects.toThrow('Only the user who assigned this task can perform this action')
      expect(taskRepository.deleteTask).not.toHaveBeenCalled()
    })

    it('cascades to every sibling occurrence when deleting the original of a recurring series', async () => {
      const original = { ...baseTask, id: 'task-1', recurrence_group_id: 'group-1', source_task_id: null }
      const sibling1 = { ...baseTask, id: 'task-2', recurrence_group_id: 'group-1', source_task_id: 'task-1' }
      const sibling2 = { ...baseTask, id: 'task-3', recurrence_group_id: 'group-1', source_task_id: 'task-1' }
      vi.mocked(taskRepository.getTaskById).mockResolvedValue(original)
      vi.mocked(taskRepository.getTasksByRecurrenceGroupId).mockResolvedValue([original, sibling1, sibling2])

      await taskService.deleteTask('task-1', 'owner-1')

      expect(taskRepository.getTasksByRecurrenceGroupId).toHaveBeenCalledWith('group-1')
      for (const id of ['task-1', 'task-2', 'task-3']) {
        expect(taskRepository.deleteSubTasksByParent).toHaveBeenCalledWith(id)
        expect(taskRepository.deleteTask).toHaveBeenCalledWith(id)
      }
    })

    it('only deletes the one occurrence when deleting a sibling (not the original)', async () => {
      const sibling = { ...baseTask, id: 'task-2', recurrence_group_id: 'group-1', source_task_id: 'task-1' }
      vi.mocked(taskRepository.getTaskById).mockResolvedValue(sibling)

      await taskService.deleteTask('task-2', 'owner-1')

      expect(taskRepository.getTasksByRecurrenceGroupId).not.toHaveBeenCalled()
      expect(taskRepository.deleteSubTasksByParent).toHaveBeenCalledTimes(1)
      expect(taskRepository.deleteSubTasksByParent).toHaveBeenCalledWith('task-2')
      expect(taskRepository.deleteTask).toHaveBeenCalledTimes(1)
      expect(taskRepository.deleteTask).toHaveBeenCalledWith('task-2')
    })
  })

  describe('duplicateTask (UC18)', () => {
    it('duplicates the task as Assigned/0% and copies sub-tasks', async () => {
      vi.mocked(taskRepository.getTaskById).mockResolvedValue(baseTask)
      vi.mocked(taskRepository.createTask).mockImplementation(async (input) => ({
        ...baseTask, id: `${input.title}-new`, title: input.title!, parent_task_id: input.parent_task_id ?? null,
      }))
      vi.mocked(taskRepository.getSubTasks).mockResolvedValue([
        { ...baseTask, id: 'sub-1', title: 'Sub task', parent_task_id: 'task-1' },
      ])

      const result = await taskService.duplicateTask('task-1', 'owner-1')

      expect(result.title).toBe('Stock shelves (copy)')
      expect(taskRepository.createTask).toHaveBeenCalledTimes(2)
      expect(taskRepository.createTask).toHaveBeenNthCalledWith(1, expect.objectContaining({
        title: 'Stock shelves (copy)', status: 'Assigned', percentage_complete: 0, assigned_by: 'owner-1',
      }))
    })

    it('rejects when the acting user is not the one who assigned the task', async () => {
      vi.mocked(taskRepository.getTaskById).mockResolvedValue(baseTask)
      await expect(taskService.duplicateTask('task-1', 'owner-2'))
        .rejects.toThrow('Only the user who assigned this task can perform this action')
      expect(taskRepository.createTask).not.toHaveBeenCalled()
    })
  })

  describe('createRecurringTasks (UC19)', () => {
    it('rejects an invalid recurrence_rule', async () => {
      vi.mocked(taskRepository.getTaskById).mockResolvedValue(baseTask)
      await expect(taskService.createRecurringTasks('task-1', {
        recurrence_rule: 'monthly' as any, recurrence_end_date: '2026-07-01', assigned_by: 'owner-1',
      })).rejects.toThrow('recurrence_rule must be daily, weekly, or custom')
    })

    it('requires recurrence_end_date', async () => {
      vi.mocked(taskRepository.getTaskById).mockResolvedValue(baseTask)
      await expect(taskService.createRecurringTasks('task-1', {
        recurrence_rule: 'daily', recurrence_end_date: '', assigned_by: 'owner-1',
      })).rejects.toThrow('recurrence_end_date is required')
    })

    it('rejects an end date before the task date', async () => {
      vi.mocked(taskRepository.getTaskById).mockResolvedValue(baseTask)
      await expect(taskService.createRecurringTasks('task-1', {
        recurrence_rule: 'daily', recurrence_end_date: '2026-06-20', assigned_by: 'owner-1',
      })).rejects.toThrow('recurrence_end_date must be after the task date')
    })

    it('rejects when the acting user is not the one who assigned the task', async () => {
      vi.mocked(taskRepository.getTaskById).mockResolvedValue(baseTask)
      await expect(taskService.createRecurringTasks('task-1', {
        recurrence_rule: 'daily', recurrence_end_date: '2026-07-01', assigned_by: 'someone-else',
      })).rejects.toThrow('Only the user who assigned this task can perform this action')
    })

    it('creates one task per weekly interval up to the end date', async () => {
      vi.mocked(taskRepository.getTaskById).mockResolvedValue(baseTask)
      vi.mocked(taskRepository.createTask).mockImplementation(async (input) => ({
        ...baseTask, id: `copy-${input.task_date}`, task_date: input.task_date ?? null,
      }))

      const result = await taskService.createRecurringTasks('task-1', {
        recurrence_rule: 'weekly', recurrence_end_date: '2026-07-09', assigned_by: 'owner-1',
      })

      expect(result).toHaveLength(2)
      expect(result.map(t => t.task_date)).toEqual(['2026-07-02', '2026-07-09'])
    })

    it('copies the sub-task checklist onto every occurrence, shifted to that occurrence\'s date', async () => {
      vi.mocked(taskRepository.getTaskById).mockResolvedValue(baseTask)
      vi.mocked(taskRepository.getSubTasks).mockResolvedValue([
        { ...baseTask, id: 'sub-1', parent_task_id: 'task-1', sequence_order: 0, title: 'Unlock doors', due_at: null, task_date: '2026-06-25' },
        { ...baseTask, id: 'sub-2', parent_task_id: 'task-1', sequence_order: 1, title: 'Turn on lights', due_at: '2026-06-25T13:00:00.000Z', task_date: '2026-06-25' },
      ])
      let callCount = 0
      vi.mocked(taskRepository.createTask).mockImplementation(async (input) => ({
        ...baseTask, id: `created-${++callCount}`, parent_task_id: input.parent_task_id ?? null,
        title: input.title, due_at: input.due_at ?? null, task_date: input.task_date ?? null,
      }))

      const result = await taskService.createRecurringTasks('task-1', {
        recurrence_rule: 'daily', recurrence_end_date: '2026-06-26', assigned_by: 'owner-1',
      })

      expect(result).toHaveLength(1) // only main-task copies are returned, sub-task copies are a side effect
      expect(taskRepository.createTask).toHaveBeenCalledTimes(3) // 1 main copy + 2 sub-task copies
      const subTaskCalls = vi.mocked(taskRepository.createTask).mock.calls.filter(([input]) => input.parent_task_id === result[0].id)
      expect(subTaskCalls).toHaveLength(2)
      expect(subTaskCalls.map(([input]) => input.title).sort()).toEqual(['Turn on lights', 'Unlock doors'])
      expect(subTaskCalls.map(([input]) => input.task_date)).toEqual(['2026-06-26', '2026-06-26'])
    })

    it('preserves the original deadline\'s local wall-clock time on the new date (UTC+8 2AM stays 2AM, not the next day)', async () => {
      vi.mocked(taskRepository.getTaskById).mockResolvedValue({
        ...baseTask, task_date: '2026-06-26', due_at: '2026-06-25T18:00:00.000Z', // 2026-06-26T02:00 UTC+8
      })
      vi.mocked(taskRepository.getSubTasks).mockResolvedValue([])
      vi.mocked(taskRepository.createTask).mockImplementation(async (input) => ({
        ...baseTask, id: 'copy-1', due_at: input.due_at ?? null, task_date: input.task_date ?? null,
      }))
      const originalTZ = process.env.TZ
      process.env.TZ = 'Asia/Singapore'

      const result = await taskService.createRecurringTasks('task-1', {
        recurrence_rule: 'daily', recurrence_end_date: '2026-06-27', assigned_by: 'owner-1',
      })

      process.env.TZ = originalTZ
      expect(result[0].task_date).toBe('2026-06-27')
      expect(result[0].due_at).toBe('2026-06-26T18:00:00.000Z') // still 2AM local on the 27th, not the 28th
    })

    it('rejects editing the recurrence from a sibling occurrence, only the original may', async () => {
      vi.mocked(taskRepository.getTaskById).mockResolvedValue({
        ...baseTask, id: 'task-2', recurrence_group_id: 'group-1', source_task_id: 'task-1',
      })
      await expect(taskService.createRecurringTasks('task-2', {
        recurrence_rule: 'daily', recurrence_end_date: '2026-06-30', assigned_by: 'owner-1',
      })).rejects.toThrow('Only the original task in a recurring series can have its recurrence edited')
    })

    it('tags the original and every created copy with a shared recurrence_group_id and source_task_id', async () => {
      vi.mocked(taskRepository.getTaskById).mockResolvedValue(baseTask)
      vi.mocked(taskRepository.getSubTasks).mockResolvedValue([])
      vi.mocked(taskRepository.createTask).mockImplementation(async (input) => ({
        ...baseTask, id: `copy-${input.task_date}`, task_date: input.task_date ?? null,
        recurrence_group_id: input.recurrence_group_id ?? null, source_task_id: input.source_task_id ?? null,
      }))

      const result = await taskService.createRecurringTasks('task-1', {
        recurrence_rule: 'daily', recurrence_end_date: '2026-06-27', assigned_by: 'owner-1',
      })

      expect(taskRepository.updateTask).toHaveBeenCalledWith('task-1', { recurrence_group_id: expect.any(String) })
      const groupId = vi.mocked(taskRepository.updateTask).mock.calls[0][1].recurrence_group_id
      expect(result.every(t => t.recurrence_group_id === groupId)).toBe(true)
      expect(result.every(t => t.source_task_id === 'task-1')).toBe(true)
    })

    it('replaces previously generated occurrences when recurrence is re-run on the original', async () => {
      const original = { ...baseTask, id: 'task-1', recurrence_group_id: 'group-1', source_task_id: null }
      const oldSibling = { ...baseTask, id: 'old-copy', recurrence_group_id: 'group-1', source_task_id: 'task-1' }
      vi.mocked(taskRepository.getTaskById).mockResolvedValue(original)
      vi.mocked(taskRepository.getTasksByRecurrenceGroupId).mockResolvedValue([original, oldSibling])
      vi.mocked(taskRepository.getSubTasks).mockResolvedValue([])
      vi.mocked(taskRepository.createTask).mockImplementation(async (input) => ({ ...baseTask, id: `copy-${input.task_date}` }))

      await taskService.createRecurringTasks('task-1', {
        recurrence_rule: 'daily', recurrence_end_date: '2026-06-27', assigned_by: 'owner-1',
      })

      expect(taskRepository.deleteSubTasksByParent).toHaveBeenCalledWith('old-copy')
      expect(taskRepository.deleteTask).toHaveBeenCalledWith('old-copy')
    })

    describe('deadline_rule', () => {
      beforeEach(() => {
        vi.mocked(taskRepository.getSubTasks).mockResolvedValue([])
        vi.mocked(taskRepository.createTask).mockImplementation(async (input) => ({
          ...baseTask, id: `copy-${input.task_date}`, task_date: input.task_date ?? null, due_at: input.due_at ?? null,
        }))
      })

      it('same_day: every occurrence is due the same day at the given time, including the original', async () => {
        vi.mocked(taskRepository.getTaskById).mockResolvedValue({ ...baseTask, task_date: '2026-06-26' })

        const result = await taskService.createRecurringTasks('task-1', {
          recurrence_rule: 'daily', recurrence_end_date: '2026-06-28', assigned_by: 'owner-1',
          deadline_rule: { type: 'same_day', time: '21:00' },
        })

        expect(taskRepository.updateTask).toHaveBeenCalledWith('task-1', expect.objectContaining({
          due_at: new Date('2026-06-26T21:00:00').toISOString(),
        }))
        expect(result.map(t => t.due_at)).toEqual([
          new Date('2026-06-27T21:00:00').toISOString(),
          new Date('2026-06-28T21:00:00').toISOString(),
        ])
      })

      it('fixed_day: "repeat every Monday, due every Friday" lands deadline in the same week', async () => {
        // 2026-06-22 is a Monday
        vi.mocked(taskRepository.getTaskById).mockResolvedValue({ ...baseTask, task_date: '2026-06-22' })

        const result = await taskService.createRecurringTasks('task-1', {
          recurrence_rule: 'weekly', recurrence_end_date: '2026-06-29', assigned_by: 'owner-1',
          deadline_rule: { type: 'fixed_day', weekday: 5, time: '17:00' }, // Friday
        })

        expect(taskRepository.updateTask).toHaveBeenCalledWith('task-1', expect.objectContaining({
          due_at: new Date('2026-06-26T17:00:00').toISOString(), // Friday of that same week
        }))
        expect(result.map(t => t.due_at)).toEqual([
          new Date('2026-07-03T17:00:00').toISOString(),
        ])
      })

      it('fixed_day: wraps to the following week when the occurrence starts after the deadline weekday', async () => {
        // 2026-06-27 is a Saturday — later in the week than Friday (weekday 5)
        vi.mocked(taskRepository.getTaskById).mockResolvedValue({ ...baseTask, task_date: '2026-06-27' })

        await taskService.createRecurringTasks('task-1', {
          recurrence_rule: 'weekly', recurrence_end_date: '2026-07-11', assigned_by: 'owner-1',
          deadline_rule: { type: 'fixed_day', weekday: 5, time: '17:00' },
        })

        expect(taskRepository.updateTask).toHaveBeenCalledWith('task-1', expect.objectContaining({
          due_at: new Date('2026-07-03T17:00:00').toISOString(), // next Friday, not the one already passed
        }))
      })

      it('fixed_day is rejected outside weekly recurrence', async () => {
        vi.mocked(taskRepository.getTaskById).mockResolvedValue({ ...baseTask, task_date: '2026-06-26' })

        await expect(taskService.createRecurringTasks('task-1', {
          recurrence_rule: 'daily', recurrence_end_date: '2026-06-28', assigned_by: 'owner-1',
          deadline_rule: { type: 'fixed_day', weekday: 5, time: '17:00' },
        })).rejects.toThrow('Fixed day deadlines are only available for weekly recurrence')
      })

      it('relative: due within X days after the occurrence is generated', async () => {
        vi.mocked(taskRepository.getTaskById).mockResolvedValue({ ...baseTask, task_date: '2026-06-01' })

        const result = await taskService.createRecurringTasks('task-1', {
          recurrence_rule: 'custom', custom_interval_days: 31, recurrence_end_date: '2026-07-02', assigned_by: 'owner-1',
          deadline_rule: { type: 'relative', offset_amount: 3, offset_unit: 'days' },
        })

        expect(taskRepository.updateTask).toHaveBeenCalledWith('task-1', expect.objectContaining({
          due_at: new Date('2026-06-04T00:00:00').toISOString(),
        }))
        expect(result.map(t => t.due_at)).toEqual([
          new Date('2026-07-05T00:00:00').toISOString(),
        ])
      })

      it('relative: due within X hours after the occurrence is generated', async () => {
        vi.mocked(taskRepository.getTaskById).mockResolvedValue({ ...baseTask, task_date: '2026-06-26' })

        await taskService.createRecurringTasks('task-1', {
          recurrence_rule: 'daily', recurrence_end_date: '2026-06-27', assigned_by: 'owner-1',
          deadline_rule: { type: 'relative', offset_amount: 5, offset_unit: 'hours' },
        })

        expect(taskRepository.updateTask).toHaveBeenCalledWith('task-1', expect.objectContaining({
          due_at: new Date('2026-06-26T05:00:00').toISOString(),
        }))
      })

      it('rejects relative without offset_amount/offset_unit', async () => {
        vi.mocked(taskRepository.getTaskById).mockResolvedValue({ ...baseTask, task_date: '2026-06-26' })

        await expect(taskService.createRecurringTasks('task-1', {
          recurrence_rule: 'daily', recurrence_end_date: '2026-06-28', assigned_by: 'owner-1',
          deadline_rule: { type: 'relative' },
        })).rejects.toThrow('deadline_rule.offset_amount and offset_unit are required for relative')
      })

      it('without deadline_rule, behavior is unchanged: moveIsoDate shifts the original due_at', async () => {
        vi.mocked(taskRepository.getTaskById).mockResolvedValue({
          ...baseTask, task_date: '2026-06-26', due_at: '2026-06-26T13:00:00.000Z',
        })

        const result = await taskService.createRecurringTasks('task-1', {
          recurrence_rule: 'daily', recurrence_end_date: '2026-06-27', assigned_by: 'owner-1',
        })

        expect(taskRepository.updateTask).toHaveBeenCalledWith('task-1', { recurrence_group_id: expect.any(String) })
        expect(result[0].due_at).toBe('2026-06-27T13:00:00.000Z')
      })
    })
  })

  describe('archiveTask (UC20)', () => {
    it('requires an id', async () => {
      await expect(taskService.archiveTask('')).rejects.toThrow('Task id is required')
    })

    it('flags the task as archived without touching its status', async () => {
      vi.mocked(taskRepository.getTaskById).mockResolvedValue(baseTask)
      vi.mocked(taskRepository.updateTask).mockResolvedValue({ ...baseTask, is_archived: true })

      const result = await taskService.archiveTask('task-1', 'owner-1')

      expect(taskRepository.updateTask).toHaveBeenCalledWith('task-1', { is_archived: true })
      expect(result.is_archived).toBe(true)
      expect(result.status).toBe(baseTask.status)
    })

    it('rejects when the acting user is not the one who assigned the task', async () => {
      vi.mocked(taskRepository.getTaskById).mockResolvedValue(baseTask)
      await expect(taskService.archiveTask('task-1', 'someone-else'))
        .rejects.toThrow('Only the user who assigned this task can perform this action')
      expect(taskRepository.updateTask).not.toHaveBeenCalled()
    })
  })

  describe('unarchiveTask', () => {
    it('requires an id', async () => {
      await expect(taskService.unarchiveTask('')).rejects.toThrow('Task id is required')
    })

    it('restores an archived task without changing its status', async () => {
      vi.mocked(taskRepository.getTaskById).mockResolvedValue({ ...baseTask, is_archived: true })
      vi.mocked(taskRepository.updateTask).mockResolvedValue({ ...baseTask, is_archived: false })

      const result = await taskService.unarchiveTask('task-1', 'owner-1')

      expect(taskRepository.updateTask).toHaveBeenCalledWith('task-1', { is_archived: false })
      expect(result.is_archived).toBe(false)
      expect(result.status).toBe(baseTask.status)
    })

    it('rejects when the acting user is not the one who assigned the task', async () => {
      vi.mocked(taskRepository.getTaskById).mockResolvedValue({ ...baseTask, is_archived: true })
      await expect(taskService.unarchiveTask('task-1', 'someone-else'))
        .rejects.toThrow('Only the user who assigned this task can perform this action')
      expect(taskRepository.updateTask).not.toHaveBeenCalled()
    })
  })

  describe('getArchivedTasks', () => {
    it('requires a company_id', async () => {
      await expect(taskService.getArchivedTasks('')).rejects.toThrow('company_id is required')
    })

    it('returns archived tasks for the company', async () => {
      const archived = { ...baseTask, is_archived: true }
      vi.mocked(taskRepository.getArchivedTasksByCompany).mockResolvedValue([archived])

      const result = await taskService.getArchivedTasks('company-1')

      expect(taskRepository.getArchivedTasksByCompany).toHaveBeenCalledWith('company-1')
      expect(result).toEqual([archived])
    })
  })

  describe('getCalendarTasks (UC21)', () => {
    it('requires both date_from and date_to', async () => {
      await expect(taskService.getCalendarTasks('company-1', '', '2026-06-30'))
        .rejects.toThrow('date_from and date_to are required')
    })

    it('rejects date_to before date_from', async () => {
      await expect(taskService.getCalendarTasks('company-1', '2026-06-30', '2026-06-01'))
        .rejects.toThrow('date_to must be on or after date_from')
    })

    it('filters tasks to the requested date range', async () => {
      vi.mocked(taskRepository.getTasksByCompany).mockResolvedValue([
        { ...baseTask, id: 't1', task_date: '2026-06-10' },
        { ...baseTask, id: 't2', task_date: '2026-06-25' },
        { ...baseTask, id: 't3', task_date: '2026-07-05' },
      ])

      const result = await taskService.getCalendarTasks('company-1', '2026-06-20', '2026-06-30')

      expect(result.map(t => t.id)).toEqual(['t2'])
    })
  })

  describe('assignTaskWithSubTasks (UC22)', () => {
    it('creates the main task without sequence_order when there is only one sub-task', async () => {
      vi.mocked(taskRepository.createTask).mockImplementation(async input => ({ ...baseTask, ...input, id: input.parent_task_id ? 'sub-1' : 'main-1' }))

      await taskService.assignTaskWithSubTasks(
        { company_id: 'company-1', department_id: 'dept-1', title: 'Main task' },
        [{ title: 'Only sub-task' }],
      )

      expect(taskRepository.createTask).toHaveBeenCalledTimes(2)
      expect(taskRepository.createTask).toHaveBeenNthCalledWith(2, expect.objectContaining({
        title: 'Only sub-task', parent_task_id: 'main-1', sequence_order: null,
      }))
    })

    it('assigns 0-based sequence_order to sub-tasks when there are 2 or more', async () => {
      vi.mocked(taskRepository.createTask).mockImplementation(async input => ({ ...baseTask, ...input, id: input.parent_task_id ? `sub-${input.title}` : 'main-1' }))

      await taskService.assignTaskWithSubTasks(
        { company_id: 'company-1', department_id: 'dept-1', title: 'Main task' },
        [{ title: 'First' }, { title: 'Second' }],
      )

      expect(taskRepository.createTask).toHaveBeenCalledTimes(3)
      expect(taskRepository.createTask).toHaveBeenNthCalledWith(2, expect.objectContaining({ title: 'First', sequence_order: 0 }))
      expect(taskRepository.createTask).toHaveBeenNthCalledWith(3, expect.objectContaining({ title: 'Second', sequence_order: 1 }))
    })

    it('skips blank sub-task titles', async () => {
      vi.mocked(taskRepository.createTask).mockResolvedValue({ ...baseTask, id: 'main-1' })

      await taskService.assignTaskWithSubTasks(
        { company_id: 'company-1', department_id: 'dept-1', title: 'Main task' },
        [{ title: '   ' }],
      )

      expect(taskRepository.createTask).toHaveBeenCalledTimes(1)
    })
  })

  describe('reorderSubTasks (UC28)', () => {
    it('requires a parent task id', async () => {
      await expect(taskService.reorderSubTasks('', ['sub-1'])).rejects.toThrow('Task id is required')
    })

    it('rejects a non-array sub_task_ids', async () => {
      await expect(taskService.reorderSubTasks('task-1', 'sub-1' as any))
        .rejects.toThrow('sub_task_ids must be an array')
    })

    it('rejects a sub_task_ids list that does not match the existing sub-tasks', async () => {
      vi.mocked(taskRepository.getTaskById).mockResolvedValue(baseTask)
      vi.mocked(taskRepository.getSubTasks).mockResolvedValue([
        { ...baseTask, id: 'sub-1', parent_task_id: 'task-1' },
        { ...baseTask, id: 'sub-2', parent_task_id: 'task-1' },
      ])

      await expect(taskService.reorderSubTasks('task-1', ['sub-1'], 'owner-1'))
        .rejects.toThrow('sub_task_ids must match the parent task\'s existing sub-tasks')
    })

    it('rejects when the acting user is not the one who assigned the parent task', async () => {
      vi.mocked(taskRepository.getTaskById).mockResolvedValue(baseTask)
      await expect(taskService.reorderSubTasks('task-1', ['sub-1'], 'someone-else'))
        .rejects.toThrow('Only the user who assigned this task can perform this action')
    })

    it('clears sequence_order when reordered down to a single sub-task', async () => {
      vi.mocked(taskRepository.getTaskById).mockResolvedValue(baseTask)
      vi.mocked(taskRepository.getSubTasks).mockResolvedValue([
        { ...baseTask, id: 'sub-1', parent_task_id: 'task-1' },
      ])
      vi.mocked(taskRepository.updateTask).mockResolvedValue({ ...baseTask, id: 'sub-1', sequence_order: null })

      await taskService.reorderSubTasks('task-1', ['sub-1'], 'owner-1')

      expect(taskRepository.updateTask).toHaveBeenCalledWith('sub-1', { sequence_order: null })
    })

    it('assigns 0-based sequence_order in the given order', async () => {
      vi.mocked(taskRepository.getTaskById).mockResolvedValue(baseTask)
      vi.mocked(taskRepository.getSubTasks).mockResolvedValue([
        { ...baseTask, id: 'sub-1', parent_task_id: 'task-1' },
        { ...baseTask, id: 'sub-2', parent_task_id: 'task-1' },
      ])
      vi.mocked(taskRepository.updateTask).mockImplementation(async (id, input) => ({ ...baseTask, id, ...input }))

      const result = await taskService.reorderSubTasks('task-1', ['sub-2', 'sub-1'], 'owner-1')

      expect(taskRepository.updateTask).toHaveBeenNthCalledWith(1, 'sub-2', { sequence_order: 0 })
      expect(taskRepository.updateTask).toHaveBeenNthCalledWith(2, 'sub-1', { sequence_order: 1 })
      expect(result).toHaveLength(2)
    })
  })

  describe('getKanbanTasks (UC15)', () => {
    it('groups tasks by status', async () => {
      vi.mocked(taskRepository.getTasksByCompany).mockResolvedValue([
        { ...baseTask, id: 't1', status: 'Assigned' },
        { ...baseTask, id: 't2', status: 'In Progress' },
        { ...baseTask, id: 't3', status: 'Review' },
        { ...baseTask, id: 't4', status: 'Complete' },
        { ...baseTask, id: 't5', status: 'Assigned' },
      ])

      const result = await taskService.getKanbanTasks('company-1')

      expect(result.Assigned.map(t => t.id)).toEqual(['t1', 't5'])
      expect(result['In Progress'].map(t => t.id)).toEqual(['t2'])
      expect(result.Review.map(t => t.id)).toEqual(['t3'])
      expect(result.Complete.map(t => t.id)).toEqual(['t4'])
    })
  })

  describe('getWorkloadRebalancingSuggestion (UC23)', () => {
    it('reports balanced when the gap between users is small', async () => {
      vi.mocked(taskRepository.getTasksByCompany).mockResolvedValue([
        { ...baseTask, id: 't1', assigned_user_id: 'user-1', status: 'Assigned' },
        { ...baseTask, id: 't2', assigned_user_id: 'user-2', status: 'Assigned' },
      ])

      const result = await taskService.getWorkloadRebalancingSuggestion('company-1')

      expect(result.type).toBe('balanced')
    })

    it('recommends rebalancing when one user is overloaded', async () => {
      vi.mocked(taskRepository.getTasksByCompany).mockResolvedValue([
        { ...baseTask, id: 't1', assigned_user_id: 'user-1', status: 'Assigned' },
        { ...baseTask, id: 't2', assigned_user_id: 'user-1', status: 'In Progress' },
        { ...baseTask, id: 't3', assigned_user_id: 'user-1', status: 'Review' },
        { ...baseTask, id: 't4', assigned_user_id: 'user-2', status: 'Assigned' },
      ])

      const result = await taskService.getWorkloadRebalancingSuggestion('company-1')

      expect(result.type).toBe('rebalance')
      expect(result.overloaded_user_id).toBe('user-1')
      expect(result.recommended_user_id).toBe('user-2')
    })

    it('scopes the suggestion to the given department only', async () => {
      vi.mocked(taskRepository.getTasksByCompany).mockResolvedValue([
        { ...baseTask, id: 't1', department_id: 'dept-1', assigned_user_id: 'user-1', status: 'Assigned' },
        { ...baseTask, id: 't2', department_id: 'dept-1', assigned_user_id: 'user-1', status: 'In Progress' },
        { ...baseTask, id: 't3', department_id: 'dept-1', assigned_user_id: 'user-1', status: 'Review' },
        { ...baseTask, id: 't4', department_id: 'dept-1', assigned_user_id: 'user-2', status: 'Assigned' },
        { ...baseTask, id: 't5', department_id: 'dept-2', assigned_user_id: 'user-3', status: 'Assigned' },
      ])

      const result = await taskService.getWorkloadRebalancingSuggestion('company-1', 'dept-2')

      expect(result.type).toBe('balanced')
    })
  })

  describe('getTaskReassignmentSuggestion (UC24)', () => {
    it('recommends the assignee with fewer active tasks', async () => {
      vi.mocked(taskRepository.getTaskById).mockResolvedValue({ ...baseTask, assigned_user_id: 'user-1' })
      vi.mocked(taskRepository.getTasksByCompany).mockResolvedValue([
        { ...baseTask, id: 't1', assigned_user_id: 'user-1', status: 'Assigned' },
        { ...baseTask, id: 't2', assigned_user_id: 'user-1', status: 'In Progress' },
        { ...baseTask, id: 't3', assigned_user_id: 'user-2', status: 'Assigned' },
      ])

      const result = await taskService.getTaskReassignmentSuggestion('task-1')

      expect(result.recommended_assignee_id).toBe('user-2')
    })

    it('returns no recommendation when no lighter assignee exists', async () => {
      vi.mocked(taskRepository.getTaskById).mockResolvedValue({ ...baseTask, assigned_user_id: 'user-1' })
      vi.mocked(taskRepository.getTasksByCompany).mockResolvedValue([
        { ...baseTask, id: 't1', assigned_user_id: 'user-1', status: 'Assigned' },
      ])

      const result = await taskService.getTaskReassignmentSuggestion('task-1')

      expect(result.recommended_assignee_id).toBeNull()
    })
  })

  describe('getStalledTaskAlerts (UC25)', () => {
    it('flags incomplete tasks not updated within the stale window', async () => {
      const now = Date.now()
      const staleDate = new Date(now - 5 * 24 * 60 * 60 * 1000).toISOString()
      const freshDate = new Date(now - 1 * 24 * 60 * 60 * 1000).toISOString()
      vi.mocked(taskRepository.getTasksByCompany).mockResolvedValue([
        { ...baseTask, id: 't1', status: 'In Progress', updated_at: staleDate },
        { ...baseTask, id: 't2', status: 'In Progress', updated_at: freshDate },
        { ...baseTask, id: 't3', status: 'Complete', updated_at: staleDate },
      ])

      const result = await taskService.getStalledTaskAlerts('company-1', 3)

      expect(result.map(a => a.task_id)).toEqual(['t1'])
    })

    it('scopes alerts to the given department only', async () => {
      const now = Date.now()
      const staleDate = new Date(now - 5 * 24 * 60 * 60 * 1000).toISOString()
      vi.mocked(taskRepository.getTasksByCompany).mockResolvedValue([
        { ...baseTask, id: 't1', department_id: 'dept-1', status: 'In Progress', updated_at: staleDate },
        { ...baseTask, id: 't2', department_id: 'dept-2', status: 'In Progress', updated_at: staleDate },
      ])

      const result = await taskService.getStalledTaskAlerts('company-1', 3, 'dept-2')

      expect(result.map(a => a.task_id)).toEqual(['t2'])
    })
  })
})
