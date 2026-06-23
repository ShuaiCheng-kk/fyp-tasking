import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase', () => ({
  supabase: {},
  createClient: () => ({}),
}))

vi.mock('@/repositories/owner/taskRepository', () => ({
  taskRepository: {
    createTask: vi.fn(),
    getTasksByCompany: vi.fn(),
    getTasksByShift: vi.fn(),
    getTasksByShiftForCompany: vi.fn(),
    getSubTasks: vi.fn(),
    getTaskById: vi.fn(),
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
  title: 'Stock shelves',
  description: null,
  assigned_user_id: 'manager-1',
  assigned_by: 'owner-1',
  status: 'Assigned',
  percentage_complete: 0,
  priority: 'Medium',
  due_at: '2026-06-25T17:00:00.000Z',
  task_date: '2026-06-25',
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
  })

  describe('editTask (UC16)', () => {
    it('requires an id', async () => {
      await expect(taskService.editTask('', { title: 'x' })).rejects.toThrow('Task id is required')
    })

    const unassignedTask: Task = { ...baseTask, assigned_user_id: null, assigned_by: null, shift_id: null }

    it('rejects an invalid status', async () => {
      vi.mocked(taskRepository.getTaskById).mockResolvedValue(unassignedTask)
      await expect(taskService.editTask('task-1', { status: 'Bogus' as any }))
        .rejects.toThrow('status must be one of: Assigned, In Progress, Review, Complete')
    })

    it('rejects percentage_complete outside 0-100', async () => {
      vi.mocked(taskRepository.getTaskById).mockResolvedValue(unassignedTask)
      await expect(taskService.editTask('task-1', { percentage_complete: -5 }))
        .rejects.toThrow('percentage_complete must be between 0 and 100')
    })

    it('updates the task when valid', async () => {
      vi.mocked(taskRepository.getTaskById).mockResolvedValue(unassignedTask)
      vi.mocked(taskRepository.updateTask).mockResolvedValue({ ...baseTask, status: 'In Progress' })

      const result = await taskService.editTask('task-1', { status: 'In Progress' })

      expect(result.status).toBe('In Progress')
      expect(taskRepository.updateTask).toHaveBeenCalledWith('task-1', { status: 'In Progress' })
    })
  })

  describe('deleteTask (UC17)', () => {
    it('requires an id', async () => {
      await expect(taskService.deleteTask('')).rejects.toThrow('Task id is required')
    })

    it('deletes sub-tasks before deleting the task', async () => {
      await taskService.deleteTask('task-1')
      expect(taskRepository.deleteSubTasksByParent).toHaveBeenCalledWith('task-1')
      expect(taskRepository.deleteTask).toHaveBeenCalledWith('task-1')
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

      const result = await taskService.duplicateTask('task-1', 'owner-2')

      expect(result.title).toBe('Stock shelves (copy)')
      expect(taskRepository.createTask).toHaveBeenCalledTimes(2)
      expect(taskRepository.createTask).toHaveBeenNthCalledWith(1, expect.objectContaining({
        title: 'Stock shelves (copy)', status: 'Assigned', percentage_complete: 0, assigned_by: 'owner-2',
      }))
    })
  })

  describe('createRecurringTasks (UC19)', () => {
    it('rejects an invalid recurrence_rule', async () => {
      vi.mocked(taskRepository.getTaskById).mockResolvedValue(baseTask)
      await expect(taskService.createRecurringTasks('task-1', {
        recurrence_rule: 'monthly' as any, recurrence_end_date: '2026-07-01',
      })).rejects.toThrow('recurrence_rule must be daily, weekly, or custom')
    })

    it('requires recurrence_end_date', async () => {
      vi.mocked(taskRepository.getTaskById).mockResolvedValue(baseTask)
      await expect(taskService.createRecurringTasks('task-1', {
        recurrence_rule: 'daily', recurrence_end_date: '',
      })).rejects.toThrow('recurrence_end_date is required')
    })

    it('rejects an end date before the task date', async () => {
      vi.mocked(taskRepository.getTaskById).mockResolvedValue(baseTask)
      await expect(taskService.createRecurringTasks('task-1', {
        recurrence_rule: 'daily', recurrence_end_date: '2026-06-20',
      })).rejects.toThrow('recurrence_end_date must be after the task date')
    })

    it('creates one task per weekly interval up to the end date', async () => {
      vi.mocked(taskRepository.getTaskById).mockResolvedValue(baseTask)
      vi.mocked(taskRepository.createTask).mockImplementation(async (input) => ({
        ...baseTask, id: `copy-${input.task_date}`, task_date: input.task_date ?? null,
      }))

      const result = await taskService.createRecurringTasks('task-1', {
        recurrence_rule: 'weekly', recurrence_end_date: '2026-07-09',
      })

      expect(result).toHaveLength(2)
      expect(result.map(t => t.task_date)).toEqual(['2026-07-02', '2026-07-09'])
    })
  })

  describe('archiveTask (UC20)', () => {
    it('requires an id', async () => {
      await expect(taskService.archiveTask('')).rejects.toThrow('Task id is required')
    })

    it('marks the task Complete at 100%', async () => {
      vi.mocked(taskRepository.updateTask).mockResolvedValue({ ...baseTask, status: 'Complete', percentage_complete: 100 })

      const result = await taskService.archiveTask('task-1')

      expect(taskRepository.updateTask).toHaveBeenCalledWith('task-1', { status: 'Complete', percentage_complete: 100 })
      expect(result.status).toBe('Complete')
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

  describe('setTaskDependencies (UC26)', () => {
    it('requires an id', async () => {
      await expect(taskService.setTaskDependencies('', ['task-2'])).rejects.toThrow('Task id is required')
    })

    it('rejects a non-array dependency_ids', async () => {
      await expect(taskService.setTaskDependencies('task-1', 'task-2' as any))
        .rejects.toThrow('dependency_ids must be an array')
    })

    it('rejects a task depending on itself', async () => {
      vi.mocked(taskRepository.getTaskById).mockResolvedValue(baseTask)
      await expect(taskService.setTaskDependencies('task-1', ['task-1']))
        .rejects.toThrow('Task cannot depend on itself')
    })

    it('rejects a dependency from a different company', async () => {
      vi.mocked(taskRepository.getTaskById).mockImplementation(async (id: string) =>
        id === 'task-1' ? baseTask : { ...baseTask, id: 'task-2', company_id: 'company-2' })

      await expect(taskService.setTaskDependencies('task-1', ['task-2']))
        .rejects.toThrow('Dependency must belong to the same company')
    })

    it('sets parent_task_id on each dependency', async () => {
      vi.mocked(taskRepository.getTaskById).mockImplementation(async (id: string) =>
        id === 'task-1' ? baseTask : { ...baseTask, id: 'task-2', company_id: 'company-1' })
      vi.mocked(taskRepository.updateTask).mockResolvedValue({ ...baseTask, id: 'task-2', parent_task_id: 'task-1' })

      const result = await taskService.setTaskDependencies('task-1', ['task-2'])

      expect(taskRepository.updateTask).toHaveBeenCalledWith('task-2', { parent_task_id: 'task-1' })
      expect(result).toHaveLength(1)
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
  })
})
