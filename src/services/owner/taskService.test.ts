import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

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
    getManagersByDepartment: vi.fn(),
    getManagersByDepartmentIds: vi.fn(),
    getEmployeesByDepartment: vi.fn(),
    getEmployeeDepartmentIds: vi.fn(),
    getSupervisedCasualWorkerIds: vi.fn(),
    getShiftById: vi.fn(),
    hasShiftOnDate: vi.fn(),
    updateTask: vi.fn(),
    replaceTaskAssignees: vi.fn(),
    updateSubTasksByParent: vi.fn(),
    deleteTask: vi.fn(),
    deleteSubTasksByParent: vi.fn(),
    getTaskStatsByCompany: vi.fn(),
    getTaskStatsByDepartment: vi.fn(),
    getActivityFeedToday: vi.fn(),
    getTasksByCompanyWithFilters: vi.fn(),
    getActiveTasksByAssignees: vi.fn(),
    getTaskDelayThreshold: vi.fn(),
    upsertTaskDelayThreshold: vi.fn(),
    markDelayAlertsRead: vi.fn(),
    getDelayAlertReadsByUser: vi.fn(),
    clearDelayAlertReads: vi.fn(),
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
  is_completed: false,
  created_at: '2026-06-20T00:00:00.000Z',
  updated_at: '2026-06-20T00:00:00.000Z',
}

describe('taskService — Task (UC12-23)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(taskRepository.getManagersByDepartment).mockResolvedValue([])
    vi.mocked(taskRepository.hasShiftOnDate).mockResolvedValue(true)
  })

  describe('assignTask (UC12)', () => {
    it('requires company_id, department_id, and title', async () => {
      await expect(taskService.assignTask({
        company_id: '', department_id: 'dept-1', title: 'x',
      })).rejects.toThrow('company_id, department_id, and title are required')
    })

    it('rejects percentage_complete outside 0-100', async () => {
      vi.mocked(taskRepository.getUserById).mockImplementation(async (id: string) => {
        if (id === 'owner-1') return { id: 'owner-1', role: 'Owner', company_id: 'company-1' } as any
        if (id === 'manager-1') return { id: 'manager-1', role: 'Manager', company_id: 'company-1' } as any
        return null
      })
      await expect(taskService.assignTask({
        company_id: 'company-1', department_id: 'dept-1', title: 'Task', percentage_complete: 150,
        assigned_by: 'owner-1', assigned_user_id: 'manager-1',
      })).rejects.toThrow('percentage_complete must be between 0 and 100')
    })

    it('rejects a top-level task with no assignee', async () => {
      vi.mocked(taskRepository.getUserById).mockResolvedValue(null)
      await expect(taskService.assignTask({
        company_id: 'company-1', department_id: 'dept-1', title: 'Task',
        assigned_by: 'owner-1',
      })).rejects.toThrow('A task must be assigned to a user')
      expect(taskRepository.createTask).not.toHaveBeenCalled()
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

    it('rejects when Owner assigns to a Manager who has no shift on the task date', async () => {
      vi.mocked(taskRepository.getUserById).mockImplementation(async (id: string) => {
        if (id === 'owner-1') return { id: 'owner-1', role: 'Owner', company_id: 'company-1' } as any
        if (id === 'manager-1') return { id: 'manager-1', role: 'Manager', company_id: 'company-1' } as any
        return null
      })
      vi.mocked(taskRepository.hasShiftOnDate).mockResolvedValue(false)

      await expect(taskService.assignTask({
        company_id: 'company-1', department_id: 'dept-1', title: 'Task', task_date: '2026-06-25',
        assigned_by: 'owner-1', assigned_user_id: 'manager-1',
      })).rejects.toThrow('Selected manager does not have a shift on the task date')
      expect(taskRepository.hasShiftOnDate).toHaveBeenCalledWith('manager-1', 'company-1', '2026-06-25')
      expect(taskRepository.createTask).not.toHaveBeenCalled()
    })

    it('creates a task when Owner assigns to a Manager who has a shift on the task date', async () => {
      vi.mocked(taskRepository.getUserById).mockImplementation(async (id: string) => {
        if (id === 'owner-1') return { id: 'owner-1', role: 'Owner', company_id: 'company-1' } as any
        if (id === 'manager-1') return { id: 'manager-1', role: 'Manager', company_id: 'company-1' } as any
        return null
      })
      vi.mocked(taskRepository.hasShiftOnDate).mockResolvedValue(true)
      vi.mocked(taskRepository.createTask).mockResolvedValue(baseTask)

      const result = await taskService.assignTask({
        company_id: 'company-1', department_id: 'dept-1', title: 'Stock shelves', task_date: '2026-06-25',
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

    it('rejects a Manager assigning directly to a Casual Worker (no skipping the Employee level)', async () => {
      vi.mocked(taskRepository.getUserById).mockImplementation(async (id: string) => {
        if (id === 'manager-1') return { id: 'manager-1', role: 'Manager', company_id: 'company-1' } as any
        if (id === 'cw-1') return { id: 'cw-1', role: 'Casual Worker', company_id: 'company-1' } as any
        return null
      })
      vi.mocked(taskRepository.getManagerDepartmentIds).mockResolvedValue(['dept-1'])

      await expect(taskService.assignTask({
        company_id: 'company-1', department_id: 'dept-1', title: 'Task',
        assigned_by: 'manager-1', assigned_user_id: 'cw-1',
      })).rejects.toThrow('Manager tasks can only be assigned to Employees')
      expect(taskRepository.createTask).not.toHaveBeenCalled()
    })

    it('rejects when an Employee tries to assign to someone other than a Casual Worker', async () => {
      vi.mocked(taskRepository.getUserById).mockImplementation(async (id: string) => {
        if (id === 'employee-1') return { id: 'employee-1', role: 'Employee', company_id: 'company-1' } as any
        if (id === 'employee-2') return { id: 'employee-2', role: 'Employee', company_id: 'company-1' } as any
        return null
      })

      await expect(taskService.assignTask({
        company_id: 'company-1', department_id: 'dept-1', title: 'Task',
        assigned_by: 'employee-1', assigned_user_id: 'employee-2',
      })).rejects.toThrow('Employee tasks can only be assigned to Casual Workers')
    })

    it('rejects an Employee assigning outside their own department', async () => {
      vi.mocked(taskRepository.getUserById).mockImplementation(async (id: string) => {
        if (id === 'employee-1') return { id: 'employee-1', role: 'Employee', company_id: 'company-1' } as any
        if (id === 'cw-1') return { id: 'cw-1', role: 'Casual Worker', company_id: 'company-1' } as any
        return null
      })
      vi.mocked(taskRepository.getEmployeeDepartmentIds).mockResolvedValue(['dept-2'])

      await expect(taskService.assignTask({
        company_id: 'company-1', department_id: 'dept-1', title: 'Task',
        assigned_by: 'employee-1', assigned_user_id: 'cw-1',
      })).rejects.toThrow('Employees can only create tasks for their own department')
    })

    it('rejects an Employee assigning to a Casual Worker they do not supervise', async () => {
      vi.mocked(taskRepository.getUserById).mockImplementation(async (id: string) => {
        if (id === 'employee-1') return { id: 'employee-1', role: 'Employee', company_id: 'company-1' } as any
        if (id === 'cw-1') return { id: 'cw-1', role: 'Casual Worker', company_id: 'company-1' } as any
        return null
      })
      vi.mocked(taskRepository.getEmployeeDepartmentIds).mockResolvedValue(['dept-1'])
      vi.mocked(taskRepository.getSupervisedCasualWorkerIds).mockResolvedValue(['cw-2'])

      await expect(taskService.assignTask({
        company_id: 'company-1', department_id: 'dept-1', title: 'Task',
        assigned_by: 'employee-1', assigned_user_id: 'cw-1',
      })).rejects.toThrow('Employees can only assign tasks to casual workers they supervise')
      expect(taskRepository.createTask).not.toHaveBeenCalled()
    })

    it('creates a task when an Employee assigns to a Casual Worker they supervise in their own department', async () => {
      vi.mocked(taskRepository.getUserById).mockImplementation(async (id: string) => {
        if (id === 'employee-1') return { id: 'employee-1', role: 'Employee', company_id: 'company-1' } as any
        if (id === 'cw-1') return { id: 'cw-1', role: 'Casual Worker', company_id: 'company-1' } as any
        return null
      })
      vi.mocked(taskRepository.getEmployeeDepartmentIds).mockResolvedValue(['dept-1'])
      vi.mocked(taskRepository.getSupervisedCasualWorkerIds).mockResolvedValue(['cw-1'])
      vi.mocked(taskRepository.createTask).mockResolvedValue(baseTask)

      const result = await taskService.assignTask({
        company_id: 'company-1', department_id: 'dept-1', title: 'Restock shelves',
        assigned_by: 'employee-1', assigned_user_id: 'cw-1',
      })

      expect(result).toEqual(baseTask)
      expect(taskRepository.getSupervisedCasualWorkerIds).toHaveBeenCalledWith('employee-1', 'company-1', 'dept-1')
      expect(taskRepository.createTask).toHaveBeenCalledOnce()
    })

    it('rejects when the shift belongs to a different department', async () => {
      vi.mocked(taskRepository.getUserById).mockImplementation(async (id: string) => {
        if (id === 'owner-1') return { id: 'owner-1', role: 'Owner', company_id: 'company-1' } as any
        if (id === 'manager-1') return { id: 'manager-1', role: 'Manager', company_id: 'company-1' } as any
        return null
      })
      vi.mocked(taskRepository.getShiftById).mockResolvedValue({
        id: 'shift-1', company_id: 'company-1', department_id: 'dept-2',
      } as any)

      await expect(taskService.assignTask({
        company_id: 'company-1', department_id: 'dept-1', title: 'Task', shift_id: 'shift-1',
        assigned_by: 'owner-1', assigned_user_id: 'manager-1',
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

  describe('assignTask — single assignee only', () => {
    it('rejects an Owner assigning one task to more than one Manager', async () => {
      vi.mocked(taskRepository.getUserById).mockImplementation(async (id: string) => {
        if (id === 'owner-1') return { id: 'owner-1', role: 'Owner', company_id: 'company-1' } as any
        if (id === 'manager-1' || id === 'manager-2') return { id, role: 'Manager', company_id: 'company-1' } as any
        return null
      })

      await expect(taskService.assignTask({
        company_id: 'company-1', department_id: 'dept-1', title: 'Task',
        assigned_by: 'owner-1', assigned_user_ids: ['manager-1', 'manager-2'],
      })).rejects.toThrow('A task can only be assigned to one person')
      expect(taskRepository.createTask).not.toHaveBeenCalled()
    })

    it('rejects a Manager assigning one task to multiple Employees', async () => {
      vi.mocked(taskRepository.getUserById).mockImplementation(async (id: string) => {
        if (id === 'manager-1') return { id: 'manager-1', role: 'Manager', company_id: 'company-1' } as any
        if (id === 'employee-1' || id === 'employee-2') return { id, role: 'Employee', company_id: 'company-1' } as any
        return null
      })
      vi.mocked(taskRepository.getManagerDepartmentIds).mockResolvedValue(['dept-1'])
      vi.mocked(taskRepository.getEmployeeDepartmentIds).mockResolvedValue(['dept-1'])

      await expect(taskService.assignTask({
        company_id: 'company-1', department_id: 'dept-1', title: 'Stock shelves',
        assigned_by: 'manager-1', assigned_user_ids: ['employee-1', 'employee-2'],
      })).rejects.toThrow('A task can only be assigned to one person')
      expect(taskRepository.createTask).not.toHaveBeenCalled()
      expect(taskRepository.replaceTaskAssignees).not.toHaveBeenCalled()
    })

    it('does not call replaceTaskAssignees for a single-assignee task', async () => {
      vi.mocked(taskRepository.getUserById).mockImplementation(async (id: string) => {
        if (id === 'owner-1') return { id: 'owner-1', role: 'Owner', company_id: 'company-1' } as any
        if (id === 'manager-1') return { id: 'manager-1', role: 'Manager', company_id: 'company-1' } as any
        return null
      })
      vi.mocked(taskRepository.createTask).mockResolvedValue(baseTask)

      await taskService.assignTask({
        company_id: 'company-1', department_id: 'dept-1', title: 'Stock shelves',
        assigned_by: 'owner-1', assigned_user_ids: ['manager-1'],
      })

      expect(taskRepository.replaceTaskAssignees).not.toHaveBeenCalled()
    })
  })

  describe('editTask (UC13)', () => {
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
      expect(taskRepository.updateTask).toHaveBeenCalledWith('task-1', { status: 'In Progress' }, 'owner-1')
    })

    it('rejects when the acting user is not the one who assigned the task', async () => {
      vi.mocked(taskRepository.getTaskById).mockResolvedValue(unassignedTask)
      await expect(taskService.editTask('task-1', { status: 'In Progress' }, 'someone-else'))
        .rejects.toThrow('Only the user who assigned this task can perform this action')
    })

    it('un-dismisses every viewer\'s read delay alert when the deadline changes', async () => {
      vi.mocked(taskRepository.getTaskById).mockResolvedValue(unassignedTask)
      vi.mocked(taskRepository.updateTask).mockResolvedValue({ ...unassignedTask, due_at: '2026-07-01T10:00:00Z' })

      await taskService.editTask('task-1', { due_at: '2026-07-01T10:00:00Z' }, 'owner-1')

      expect(taskRepository.updateTask).toHaveBeenCalledWith('task-1', { due_at: '2026-07-01T10:00:00Z' }, 'owner-1')
      expect(taskRepository.clearDelayAlertReads).toHaveBeenCalledWith('task-1')
    })

    it('keeps read delay alerts dismissed when the deadline is unchanged', async () => {
      vi.mocked(taskRepository.getTaskById).mockResolvedValue(unassignedTask)
      vi.mocked(taskRepository.updateTask).mockResolvedValue(unassignedTask)

      await taskService.editTask('task-1', { title: 'Renamed', due_at: unassignedTask.due_at }, 'owner-1')

      expect(taskRepository.updateTask).toHaveBeenCalledWith('task-1', { title: 'Renamed', due_at: unassignedTask.due_at }, 'owner-1')
      expect(taskRepository.clearDelayAlertReads).not.toHaveBeenCalled()
    })

    it('cascades a changed deadline, priority, and start date onto sub-tasks', async () => {
      vi.mocked(taskRepository.getTaskById).mockResolvedValue(unassignedTask)
      vi.mocked(taskRepository.updateTask).mockResolvedValue({ ...unassignedTask, due_at: '2026-07-01T10:00:00Z' })

      await taskService.editTask('task-1', {
        due_at: '2026-07-01T10:00:00Z',
        priority: 'Urgent',
        task_date: '2026-07-01',
      }, 'owner-1')

      expect(taskRepository.updateSubTasksByParent).toHaveBeenCalledWith('task-1', {
        priority: 'Urgent',
        due_at: '2026-07-01T10:00:00Z',
        task_date: '2026-07-01',
      })
    })

    it('does not cascade fields that were not changed', async () => {
      vi.mocked(taskRepository.getTaskById).mockResolvedValue(unassignedTask)
      vi.mocked(taskRepository.updateTask).mockResolvedValue(unassignedTask)

      await taskService.editTask('task-1', { due_at: unassignedTask.due_at, title: 'Renamed' }, 'owner-1')

      expect(taskRepository.updateSubTasksByParent).not.toHaveBeenCalled()
    })

    it('does not cascade when editing a sub-task itself', async () => {
      const subTask: Task = { ...unassignedTask, parent_task_id: 'task-0' }
      vi.mocked(taskRepository.getTaskById).mockResolvedValue(subTask)
      vi.mocked(taskRepository.updateTask).mockResolvedValue({ ...subTask, due_at: '2026-07-01T10:00:00Z' })

      await taskService.editTask('task-1', { due_at: '2026-07-01T10:00:00Z' }, 'owner-1')

      expect(taskRepository.updateSubTasksByParent).not.toHaveBeenCalled()
    })

    it('updates the single assignee when assigned_user_ids is provided', async () => {
      vi.mocked(taskRepository.getTaskById).mockResolvedValue(unassignedTask)
      vi.mocked(taskRepository.getUserById).mockImplementation(async (id: string) => {
        if (id === 'owner-1') return { id: 'owner-1', role: 'Owner', company_id: 'company-1' } as any
        if (id === 'manager-1') return { id: 'manager-1', role: 'Manager', company_id: 'company-1' } as any
        return null
      })
      vi.mocked(taskRepository.updateTask).mockResolvedValue({ ...unassignedTask, assigned_user_id: 'manager-1' })

      await taskService.editTask('task-1', { assigned_user_ids: ['manager-1'] }, 'owner-1')

      expect(taskRepository.updateTask).toHaveBeenCalledWith(
        'task-1', expect.objectContaining({ assigned_user_id: 'manager-1' }), 'owner-1',
      )
    })

    it('rejects an Owner editing a task onto more than one Manager', async () => {
      vi.mocked(taskRepository.getTaskById).mockResolvedValue(unassignedTask)
      vi.mocked(taskRepository.getUserById).mockImplementation(async (id: string) => {
        if (id === 'owner-1') return { id: 'owner-1', role: 'Owner', company_id: 'company-1' } as any
        if (id === 'manager-1' || id === 'manager-2') return { id, role: 'Manager', company_id: 'company-1' } as any
        return null
      })

      await expect(taskService.editTask('task-1', { assigned_user_ids: ['manager-1', 'manager-2'] }, 'owner-1'))
        .rejects.toThrow('A task can only be assigned to one person')
      expect(taskRepository.updateTask).not.toHaveBeenCalled()
    })

    it('rejects unassigning a top-level task', async () => {
      vi.mocked(taskRepository.getTaskById).mockResolvedValue(baseTask)
      await expect(taskService.editTask('task-1', { assigned_user_ids: [] }, 'owner-1'))
        .rejects.toThrow('A task must be assigned to a user')
      await expect(taskService.editTask('task-1', { assigned_user_id: null }, 'owner-1'))
        .rejects.toThrow('A task must be assigned to a user')
      expect(taskRepository.updateTask).not.toHaveBeenCalled()
    })
  })

  describe('applyWorkloadSuggestionReassignment (UC21 follow-through)', () => {
    beforeEach(() => {
      vi.mocked(taskRepository.getUserById).mockImplementation(async (id: string) => {
        if (id === 'owner-1') return { id: 'owner-1', role: 'Owner', company_id: 'company-1' } as any
        if (id === 'partner-1') return { id: 'partner-1', role: 'Partner', company_id: 'company-1' } as any
        if (id === 'other-company-owner') return { id: 'other-company-owner', role: 'Owner', company_id: 'company-2' } as any
        if (id === 'mgr-a' || id === 'mgr-b') return { id, role: 'Manager', company_id: 'company-1' } as any
        if (id === 'manager-2') return { id: 'manager-2', role: 'Manager', company_id: 'company-1' } as any
        if (id === 'employee-2') return { id: 'employee-2', role: 'Employee', company_id: 'company-1' } as any
        return null
      })
    })

    // shift_id: null on every fixture below — shift-linkage validation is orthogonal to this
    // authorization logic and is already covered by the editTask tests above.
    const noShiftTask: Task = { ...baseTask, shift_id: null }

    it('lets the original assigner reassign without a peer lookup', async () => {
      vi.mocked(taskRepository.getTaskById).mockResolvedValue(noShiftTask)
      vi.mocked(taskRepository.updateTask).mockResolvedValue({ ...noShiftTask, assigned_user_id: 'manager-2' })

      await taskService.applyWorkloadSuggestionReassignment('task-1', 'manager-2', 'owner-1')

      expect(taskRepository.updateTask).toHaveBeenCalledWith('task-1', { assigned_user_id: 'manager-2' }, 'owner-1')
      expect(taskRepository.updateSubTasksByParent).toHaveBeenCalledWith('task-1', { assigned_user_id: 'manager-2' })
    })

    it('lets a Partner apply a suggestion for a task an Owner peer assigned', async () => {
      vi.mocked(taskRepository.getTaskById).mockResolvedValue(noShiftTask) // assigned_by: 'owner-1'
      vi.mocked(taskRepository.updateTask).mockResolvedValue({ ...noShiftTask, assigned_user_id: 'manager-2' })

      await taskService.applyWorkloadSuggestionReassignment('task-1', 'manager-2', 'partner-1')

      expect(taskRepository.updateTask).toHaveBeenCalledWith('task-1', { assigned_user_id: 'manager-2' }, 'partner-1')
    })

    it('rejects a peer from a different company', async () => {
      vi.mocked(taskRepository.getTaskById).mockResolvedValue(noShiftTask)

      await expect(taskService.applyWorkloadSuggestionReassignment('task-1', 'manager-2', 'other-company-owner'))
        .rejects.toThrow('Only a peer of the assigner can apply this suggestion')
      expect(taskRepository.updateTask).not.toHaveBeenCalled()
    })

    it('lets a Manager apply a suggestion for a task a peer Manager (shared department) assigned', async () => {
      const mgrTask: Task = { ...noShiftTask, assigned_by: 'mgr-a', assigned_user_id: 'employee-1' }
      vi.mocked(taskRepository.getTaskById).mockResolvedValue(mgrTask)
      vi.mocked(taskRepository.getManagerDepartmentIds).mockResolvedValue(['dept-1'])
      vi.mocked(taskRepository.getManagersByDepartmentIds).mockResolvedValue([{ id: 'mgr-a' } as any, { id: 'mgr-b' } as any])
      vi.mocked(taskRepository.updateTask).mockResolvedValue({ ...mgrTask, assigned_user_id: 'employee-2' })

      await taskService.applyWorkloadSuggestionReassignment('task-1', 'employee-2', 'mgr-b')

      expect(taskRepository.updateTask).toHaveBeenCalledWith('task-1', { assigned_user_id: 'employee-2' }, 'mgr-b')
    })

    it('rejects a Manager who does not share a department with the assigning Manager', async () => {
      const mgrTask: Task = { ...noShiftTask, assigned_by: 'mgr-a', assigned_user_id: 'employee-1' }
      vi.mocked(taskRepository.getTaskById).mockResolvedValue(mgrTask)
      vi.mocked(taskRepository.getManagerDepartmentIds).mockResolvedValue(['dept-9'])
      vi.mocked(taskRepository.getManagersByDepartmentIds).mockResolvedValue([{ id: 'mgr-b' } as any])

      await expect(taskService.applyWorkloadSuggestionReassignment('task-1', 'employee-2', 'mgr-b'))
        .rejects.toThrow('Only a peer of the assigner can apply this suggestion')
    })

    it('rejects reassigning a sub-task this way', async () => {
      vi.mocked(taskRepository.getTaskById).mockResolvedValue({ ...noShiftTask, parent_task_id: 'parent-1' })

      await expect(taskService.applyWorkloadSuggestionReassignment('task-1', 'manager-2', 'owner-1'))
        .rejects.toThrow('Only a top-level task can be reassigned this way')
      expect(taskRepository.updateTask).not.toHaveBeenCalled()
    })
  })

  describe('completeSubTask', () => {
    const parentInProgress: Task = { ...baseTask, id: 'parent-1', status: 'In Progress', assigned_user_id: 'employee-1' }
    const subA: Task = { ...baseTask, id: 'sub-a', parent_task_id: 'parent-1', sequence_order: 0, is_completed: false }
    const subB: Task = { ...baseTask, id: 'sub-b', parent_task_id: 'parent-1', sequence_order: 1, is_completed: false }
    const subC: Task = { ...baseTask, id: 'sub-c', parent_task_id: 'parent-1', sequence_order: 2, is_completed: false }

    it('requires a sub-task id', async () => {
      await expect(taskService.completeSubTask('')).rejects.toThrow('Sub-task id is required')
    })

    it('rejects a task with no parent', async () => {
      vi.mocked(taskRepository.getTaskById).mockResolvedValue({ ...baseTask, parent_task_id: null })
      await expect(taskService.completeSubTask('task-1', 'employee-1')).rejects.toThrow('Task is not a sub-task')
    })

    it('rejects when the acting user is not the parent assignee', async () => {
      vi.mocked(taskRepository.getTaskById).mockImplementation(async id =>
        id === 'sub-a' ? subA : parentInProgress
      )
      await expect(taskService.completeSubTask('sub-a', 'someone-else'))
        .rejects.toThrow('Only a user assigned to this task can complete its sub-tasks')
    })

    it('rejects when the parent is not In Progress', async () => {
      vi.mocked(taskRepository.getTaskById).mockImplementation(async id =>
        id === 'sub-a' ? subA : { ...parentInProgress, status: 'Assigned' }
      )
      await expect(taskService.completeSubTask('sub-a', 'employee-1'))
        .rejects.toThrow('Sub-tasks can only be completed while the task is In Progress')
    })

    it('rejects ticking a sub-task before its predecessor is complete', async () => {
      vi.mocked(taskRepository.getTaskById).mockImplementation(async id =>
        id === 'sub-b' ? subB : parentInProgress
      )
      vi.mocked(taskRepository.getSubTasks).mockResolvedValue([subA, subB, subC])
      await expect(taskService.completeSubTask('sub-b', 'employee-1'))
        .rejects.toThrow('Complete the previous sub-tasks first')
    })

    it('ticks a sub-task in order without promoting the parent if others remain', async () => {
      vi.mocked(taskRepository.getTaskById).mockImplementation(async id =>
        id === 'sub-a' ? subA : parentInProgress
      )
      vi.mocked(taskRepository.getSubTasks).mockResolvedValue([subA, subB, subC])
      vi.mocked(taskRepository.updateTask).mockResolvedValue({ ...subA, is_completed: true })

      const [updatedSub, parent] = await taskService.completeSubTask('sub-a', 'employee-1')

      expect(taskRepository.updateTask).toHaveBeenCalledWith('sub-a', { is_completed: true })
      expect(taskRepository.updateSubTasksByParent).not.toHaveBeenCalled()
      expect(updatedSub.is_completed).toBe(true)
      expect(parent.status).toBe('In Progress')
    })

    it('promotes the parent and all sub-tasks to Review once the last one is ticked', async () => {
      const completedA = { ...subA, is_completed: true }
      const completedB = { ...subB, is_completed: true }
      vi.mocked(taskRepository.getTaskById).mockImplementation(async id =>
        id === 'sub-c' ? subC : parentInProgress
      )
      vi.mocked(taskRepository.getSubTasks).mockResolvedValue([completedA, completedB, subC])
      vi.mocked(taskRepository.updateTask).mockImplementation(async (id, input) =>
        id === 'parent-1' ? { ...parentInProgress, ...input } : { ...subC, ...input }
      )

      const [updatedSub, parent] = await taskService.completeSubTask('sub-c', 'employee-1')

      expect(updatedSub.is_completed).toBe(true)
      expect(taskRepository.updateTask).toHaveBeenCalledWith('parent-1', { status: 'Review', percentage_complete: 66 })
      expect(taskRepository.updateSubTasksByParent).toHaveBeenCalledWith('parent-1', { status: 'Review', percentage_complete: 66 })
      expect(parent.status).toBe('Review')
    })

    it('is a no-op when the sub-task is already completed', async () => {
      const alreadyDone = { ...subA, is_completed: true }
      vi.mocked(taskRepository.getTaskById).mockImplementation(async id =>
        id === 'sub-a' ? alreadyDone : parentInProgress
      )

      const [updatedSub] = await taskService.completeSubTask('sub-a', 'employee-1')

      expect(updatedSub.is_completed).toBe(true)
      expect(taskRepository.updateTask).not.toHaveBeenCalled()
    })

    it('allows a co-assignee (not just the primary assigned_user_id) to complete a sub-task', async () => {
      const multiAssigneeParent = { ...parentInProgress, assigned_user_ids: ['employee-1', 'employee-2'] }
      vi.mocked(taskRepository.getTaskById).mockImplementation(async id =>
        id === 'sub-a' ? subA : multiAssigneeParent
      )
      vi.mocked(taskRepository.getSubTasks).mockResolvedValue([subA, subB, subC])
      vi.mocked(taskRepository.updateTask).mockResolvedValue({ ...subA, is_completed: true })

      const [updatedSub] = await taskService.completeSubTask('sub-a', 'employee-2')

      expect(updatedSub.is_completed).toBe(true)
    })
  })

  describe('deleteTask (UC15)', () => {
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

  describe('duplicateTask (UC16)', () => {
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

  describe('createRecurringTasks (UC17)', () => {
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

    it('keeps the original assignee on occurrences where they have a shift', async () => {
      vi.mocked(taskRepository.getTaskById).mockResolvedValue(baseTask) // assigned_user_id: 'manager-1'
      vi.mocked(taskRepository.hasShiftOnDate).mockResolvedValue(true)
      vi.mocked(taskRepository.createTask).mockImplementation(async (input) => ({
        ...baseTask, id: `copy-${input.task_date}`, task_date: input.task_date ?? null, assigned_user_id: input.assigned_user_id ?? null,
      }))

      const result = await taskService.createRecurringTasks('task-1', {
        recurrence_rule: 'daily', recurrence_end_date: '2026-06-27', assigned_by: 'owner-1',
      })

      expect(taskRepository.hasShiftOnDate).toHaveBeenCalledWith('manager-1', 'company-1', '2026-06-26')
      expect(taskRepository.hasShiftOnDate).toHaveBeenCalledWith('manager-1', 'company-1', '2026-06-27')
      expect(result.every(t => t.assigned_user_id === 'manager-1')).toBe(true)
    })

    it('sends an occurrence out unassigned when the original assignee has no shift that day', async () => {
      vi.mocked(taskRepository.getTaskById).mockResolvedValue(baseTask) // assigned_user_id: 'manager-1'
      vi.mocked(taskRepository.hasShiftOnDate).mockImplementation(async (_userId, _companyId, date) => date !== '2026-06-26')
      vi.mocked(taskRepository.createTask).mockImplementation(async (input) => ({
        ...baseTask, id: `copy-${input.task_date}`, task_date: input.task_date ?? null, assigned_user_id: input.assigned_user_id ?? null,
      }))

      const result = await taskService.createRecurringTasks('task-1', {
        recurrence_rule: 'daily', recurrence_end_date: '2026-06-27', assigned_by: 'owner-1',
      })

      expect(result.find(t => t.task_date === '2026-06-26')?.assigned_user_id).toBeNull()
      expect(result.find(t => t.task_date === '2026-06-27')?.assigned_user_id).toBe('manager-1')
    })

    it('skips the shift check entirely when the original task has no assignee', async () => {
      vi.mocked(taskRepository.getTaskById).mockResolvedValue({ ...baseTask, assigned_user_id: null })
      vi.mocked(taskRepository.createTask).mockImplementation(async (input) => ({
        ...baseTask, id: `copy-${input.task_date}`, task_date: input.task_date ?? null, assigned_user_id: input.assigned_user_id ?? null,
      }))

      const result = await taskService.createRecurringTasks('task-1', {
        recurrence_rule: 'daily', recurrence_end_date: '2026-06-27', assigned_by: 'owner-1',
      })

      expect(taskRepository.hasShiftOnDate).not.toHaveBeenCalled()
      expect(result.every(t => t.assigned_user_id === null)).toBe(true)
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

  describe('archiveTask (UC18)', () => {
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

  describe('getCalendarTasks', () => {
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

  describe('assignTaskWithSubTasks (UC19)', () => {
    beforeEach(() => {
      vi.mocked(taskRepository.getUserById).mockImplementation(async (id: string) => (
        id === 'manager-1' ? { id: 'manager-1', role: 'Manager', company_id: 'company-1' } as any : null
      ))
    })

    it('creates the main task without sequence_order when there is only one sub-task', async () => {
      vi.mocked(taskRepository.createTask).mockImplementation(async input => ({ ...baseTask, ...input, id: input.parent_task_id ? 'sub-1' : 'main-1' }))

      await taskService.assignTaskWithSubTasks(
        { company_id: 'company-1', department_id: 'dept-1', title: 'Main task', assigned_user_id: 'manager-1' },
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
        { company_id: 'company-1', department_id: 'dept-1', title: 'Main task', assigned_user_id: 'manager-1' },
        [{ title: 'First' }, { title: 'Second' }],
      )

      expect(taskRepository.createTask).toHaveBeenCalledTimes(3)
      expect(taskRepository.createTask).toHaveBeenNthCalledWith(2, expect.objectContaining({ title: 'First', sequence_order: 0 }))
      expect(taskRepository.createTask).toHaveBeenNthCalledWith(3, expect.objectContaining({ title: 'Second', sequence_order: 1 }))
    })

    it('skips blank sub-task titles', async () => {
      vi.mocked(taskRepository.createTask).mockResolvedValue({ ...baseTask, id: 'main-1' })

      await taskService.assignTaskWithSubTasks(
        { company_id: 'company-1', department_id: 'dept-1', title: 'Main task', assigned_user_id: 'manager-1' },
        [{ title: '   ' }],
      )

      expect(taskRepository.createTask).toHaveBeenCalledTimes(1)
    })

    it('uses a per-sub-task assigned_user_id/due_at when provided (UC20 AI step distribution), falling back to the parent otherwise', async () => {
      vi.mocked(taskRepository.createTask).mockImplementation(async input => ({
        ...baseTask, ...input, id: input.parent_task_id ? `sub-${input.title}` : 'main-1',
      }))

      await taskService.assignTaskWithSubTasks(
        { company_id: 'company-1', department_id: 'dept-1', title: 'Main task', assigned_user_id: 'manager-1', due_at: '2026-07-01T18:00:00.000Z' },
        [
          { title: 'Step 1', assigned_user_id: 'manager-2', due_at: '2026-06-30T12:00:00.000Z' },
          { title: 'Step 2' },
        ],
      )

      expect(taskRepository.createTask).toHaveBeenNthCalledWith(2, expect.objectContaining({
        title: 'Step 1', assigned_user_id: 'manager-2', due_at: '2026-06-30T12:00:00.000Z',
      }))
      expect(taskRepository.createTask).toHaveBeenNthCalledWith(3, expect.objectContaining({
        title: 'Step 2', due_at: '2026-07-01T18:00:00.000Z',
      }))
    })
  })

  describe('reorderSubTasks (UC23)', () => {
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

  describe('getKanbanTasks', () => {
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

    it('passes an assigned_by list and department_ids through to the repository unchanged', async () => {
      vi.mocked(taskRepository.getTasksByCompany).mockResolvedValue([])
      await taskService.getKanbanTasks('company-1', ['mgr-a', 'mgr-b'], ['dept-1'])
      expect(taskRepository.getTasksByCompany).toHaveBeenCalledWith('company-1', ['mgr-a', 'mgr-b'], ['dept-1'])
    })
  })

  describe('getManagerTeamScope — Manager Tasks page multi-manager visibility', () => {
    it('resolves the department set the manager belongs to plus every peer manager sharing one of those departments', async () => {
      vi.mocked(taskRepository.getManagerDepartmentIds).mockResolvedValue(['dept-1', 'dept-2'])
      vi.mocked(taskRepository.getManagersByDepartmentIds).mockResolvedValue([
        { id: 'mgr-a', full_name: 'Manager A' },
        { id: 'mgr-b', full_name: 'Manager B' },
      ])

      const result = await taskService.getManagerTeamScope('company-1', 'mgr-a')

      expect(taskRepository.getManagerDepartmentIds).toHaveBeenCalledWith('mgr-a', 'company-1')
      expect(taskRepository.getManagersByDepartmentIds).toHaveBeenCalledWith('company-1', ['dept-1', 'dept-2'])
      expect(result).toEqual({ departmentIds: ['dept-1', 'dept-2'], managerIds: ['mgr-a', 'mgr-b'] })
    })

    it('falls back to just the acting manager when they have no department yet', async () => {
      vi.mocked(taskRepository.getManagerDepartmentIds).mockResolvedValue([])

      const result = await taskService.getManagerTeamScope('company-1', 'mgr-a')

      expect(taskRepository.getManagersByDepartmentIds).not.toHaveBeenCalled()
      expect(result).toEqual({ departmentIds: [], managerIds: ['mgr-a'] })
    })
  })

  describe('updateTaskStatus — review flow guards', () => {
    it('moves a task one step forward on the normal drag path', async () => {
      vi.mocked(taskRepository.getTaskById).mockResolvedValue({ ...baseTask, status: 'In Progress' })
      vi.mocked(taskRepository.updateTask).mockResolvedValue({ ...baseTask, status: 'Review', percentage_complete: 66 })

      const result = await taskService.updateTaskStatus('task-1', 'Review', 66)

      expect(result.status).toBe('Review')
      expect(taskRepository.updateTask).toHaveBeenCalledWith('task-1', { status: 'Review', percentage_complete: 66 })
    })

    it('blocks moving a task that is already in Review (only approve/reject may)', async () => {
      vi.mocked(taskRepository.getTaskById).mockResolvedValue({ ...baseTask, status: 'Review' })
      await expect(taskService.updateTaskStatus('task-1', 'Complete', 100))
        .rejects.toThrow('Tasks in Review can only be approved or rejected by the user who assigned them')
      expect(taskRepository.updateTask).not.toHaveBeenCalled()
    })

    it('blocks reaching Complete through the drag path from any status', async () => {
      vi.mocked(taskRepository.getTaskById).mockResolvedValue({ ...baseTask, status: 'In Progress' })
      await expect(taskService.updateTaskStatus('task-1', 'Complete', 100))
        .rejects.toThrow('Tasks reach Complete only when the user who assigned them approves the review')
      expect(taskRepository.updateTask).not.toHaveBeenCalled()
    })
  })

  describe('approveTask / rejectTask (review sign-off)', () => {
    const reviewTask: Task = { ...baseTask, status: 'Review', percentage_complete: 66 }

    it('approve requires the acting user to be the assigner', async () => {
      vi.mocked(taskRepository.getTaskById).mockResolvedValue(reviewTask)
      await expect(taskService.approveTask('task-1', 'someone-else'))
        .rejects.toThrow('Only the user who assigned this task can perform this action')
      expect(taskRepository.updateTask).not.toHaveBeenCalled()
    })

    it('approve only applies to tasks in Review', async () => {
      vi.mocked(taskRepository.getTaskById).mockResolvedValue({ ...baseTask, status: 'In Progress' })
      await expect(taskService.approveTask('task-1', 'owner-1'))
        .rejects.toThrow('Only tasks in Review can be approved')
    })

    it('approve completes the task, clears rejection state, and cascades to sub-tasks', async () => {
      vi.mocked(taskRepository.getTaskById).mockResolvedValue({ ...reviewTask, rejection_reason: 'Old reason' })
      vi.mocked(taskRepository.updateTask).mockResolvedValue({ ...reviewTask, status: 'Complete', percentage_complete: 100, rejection_reason: null })

      const result = await taskService.approveTask('task-1', 'owner-1')

      expect(result.status).toBe('Complete')
      expect(taskRepository.updateTask).toHaveBeenCalledWith('task-1', {
        status: 'Complete', percentage_complete: 100, rejection_reason: null, rejected_at: null,
        completed_at: expect.any(String),
      })
      expect(taskRepository.updateSubTasksByParent).toHaveBeenCalledWith('task-1', { status: 'Complete', percentage_complete: 100 })
    })

    it('reject requires a reason', async () => {
      await expect(taskService.rejectTask('task-1', '   ', 'owner-1'))
        .rejects.toThrow('A rejection reason is required')
      expect(taskRepository.updateTask).not.toHaveBeenCalled()
    })

    it('reject requires the acting user to be the assigner', async () => {
      vi.mocked(taskRepository.getTaskById).mockResolvedValue(reviewTask)
      await expect(taskService.rejectTask('task-1', 'Numbers are off', 'someone-else'))
        .rejects.toThrow('Only the user who assigned this task can perform this action')
    })

    it('reject only applies to tasks in Review', async () => {
      vi.mocked(taskRepository.getTaskById).mockResolvedValue({ ...baseTask, status: 'Assigned' })
      await expect(taskService.rejectTask('task-1', 'Numbers are off', 'owner-1'))
        .rejects.toThrow('Only tasks in Review can be rejected')
    })

    it('reject sends the task back to In Progress with the reason, cascading to sub-tasks', async () => {
      vi.mocked(taskRepository.getTaskById).mockResolvedValue(reviewTask)
      vi.mocked(taskRepository.updateTask).mockResolvedValue({ ...reviewTask, status: 'In Progress', percentage_complete: 33, rejection_reason: 'Numbers are off' })

      const result = await taskService.rejectTask('task-1', '  Numbers are off  ', 'owner-1')

      expect(result.status).toBe('In Progress')
      expect(taskRepository.updateTask).toHaveBeenCalledWith('task-1', {
        status: 'In Progress', percentage_complete: 33,
        rejection_reason: 'Numbers are off', rejected_at: expect.any(String),
      })
      expect(taskRepository.updateSubTasksByParent).toHaveBeenCalledWith('task-1', { status: 'In Progress', percentage_complete: 33 })
    })
  })

  describe('getWorkloadRebalancingSuggestion (UC21)', () => {
    const farOut = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() // plenty of time, lowest urgency weight

    it('reports balanced when scores are close', async () => {
      vi.mocked(taskRepository.getManagersByDepartment).mockResolvedValue([
        { id: 'user-1', full_name: 'User One' },
        { id: 'user-2', full_name: 'User Two' },
      ])
      vi.mocked(taskRepository.getTasksByCompany).mockResolvedValue([
        { ...baseTask, id: 't1', department_id: 'dept-1', assigned_user_id: 'user-1', status: 'Assigned', priority: 'Medium', due_at: farOut },
        { ...baseTask, id: 't2', department_id: 'dept-1', assigned_user_id: 'user-2', status: 'Assigned', priority: 'Medium', due_at: farOut },
      ])

      const result = await taskService.getWorkloadRebalancingSuggestion('company-1')

      expect(result.type).toBe('balanced')
    })

    it('does not rebalance a manager who only has one active main task', async () => {
      const overdue = new Date(Date.now() - 60 * 60 * 1000).toISOString()
      vi.mocked(taskRepository.getManagersByDepartment).mockResolvedValue([
        { id: 'user-1', full_name: 'User One' },
        { id: 'user-2', full_name: 'User Two' },
      ])
      vi.mocked(taskRepository.getTasksByCompany).mockResolvedValue([
        // user-1: one Urgent + overdue task → weight 4 (priority) x 4 (overdue) = 16
        { ...baseTask, id: 't1', department_id: 'dept-1', assigned_user_id: 'user-1', status: 'Assigned', priority: 'Urgent', due_at: overdue },
        // user-2: five Low-priority tasks with a month of runway → weight 1 x 1 = 1 each = 5 total
        { ...baseTask, id: 't2', department_id: 'dept-1', assigned_user_id: 'user-2', status: 'Assigned', priority: 'Low', due_at: farOut },
        { ...baseTask, id: 't3', department_id: 'dept-1', assigned_user_id: 'user-2', status: 'Assigned', priority: 'Low', due_at: farOut },
        { ...baseTask, id: 't4', department_id: 'dept-1', assigned_user_id: 'user-2', status: 'Assigned', priority: 'Low', due_at: farOut },
        { ...baseTask, id: 't5', department_id: 'dept-1', assigned_user_id: 'user-2', status: 'Assigned', priority: 'Low', due_at: farOut },
        { ...baseTask, id: 't6', department_id: 'dept-1', assigned_user_id: 'user-2', status: 'Assigned', priority: 'Low', due_at: farOut },
      ])

      const result = await taskService.getWorkloadRebalancingSuggestion('company-1')

      expect(result.type).toBe('balanced')
    })

    it('rebalances when the overloaded manager has at least two active main tasks', async () => {
      const overdue = new Date(Date.now() - 60 * 60 * 1000).toISOString()
      vi.mocked(taskRepository.getManagersByDepartment).mockResolvedValue([
        { id: 'user-1', full_name: 'User One' },
        { id: 'user-2', full_name: 'User Two' },
      ])
      vi.mocked(taskRepository.getTasksByCompany).mockResolvedValue([
        { ...baseTask, id: 't1', department_id: 'dept-1', parent_task_id: null, assigned_user_id: 'user-1', status: 'Assigned', priority: 'Urgent', due_at: overdue },
        { ...baseTask, id: 't2', department_id: 'dept-1', parent_task_id: null, assigned_user_id: 'user-1', status: 'Assigned', priority: 'High', due_at: overdue },
      ])

      const result = await taskService.getWorkloadRebalancingSuggestion('company-1')

      expect(result.type).toBe('rebalance')
      expect(result.overloaded_user_id).toBe('user-1')
      expect(result.recommended_user_id).toBe('user-2')
    })

    it('chooses the task that improves balance instead of flipping the imbalance', async () => {
      const within24Hours = new Date(Date.now() + 60 * 60 * 1000).toISOString()
      const within3Days = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString()
      vi.mocked(taskRepository.getManagersByDepartment).mockResolvedValue([
        { id: 'user-1', full_name: 'User One' },
        { id: 'user-2', full_name: 'User Two' },
      ])
      vi.mocked(taskRepository.getTasksByCompany).mockResolvedValue([
        // user-1 total: 12 + 6 = 18. Moving t1 would flip to 6 vs 18, so t2 is the useful move.
        { ...baseTask, id: 't1', department_id: 'dept-1', parent_task_id: null, assigned_user_id: 'user-1', status: 'Assigned', priority: 'Urgent', due_at: within24Hours },
        { ...baseTask, id: 't2', department_id: 'dept-1', parent_task_id: null, assigned_user_id: 'user-1', status: 'Assigned', priority: 'High', due_at: within3Days },
        { ...baseTask, id: 't3', department_id: 'dept-1', parent_task_id: null, assigned_user_id: 'user-2', status: 'Assigned', priority: 'High', due_at: within3Days },
      ])

      const result = await taskService.getWorkloadRebalancingSuggestion('company-1')

      expect(result.type).toBe('rebalance')
      expect(result.suggested_task_id).toBe('t2')
    })

    it('returns one workload suggestion card per affected department', async () => {
      const overdue = new Date(Date.now() - 60 * 60 * 1000).toISOString()
      vi.mocked(taskRepository.getManagersByDepartment).mockImplementation(async (_companyId, deptId) => (
        deptId === 'dept-1'
          ? [{ id: 'user-1', full_name: 'User One' }, { id: 'user-2', full_name: 'User Two' }]
          : [{ id: 'user-3', full_name: 'User Three' }, { id: 'user-4', full_name: 'User Four' }]
      ))
      vi.mocked(taskRepository.getTasksByCompany).mockResolvedValue([
        { ...baseTask, id: 'd1-t1', department_id: 'dept-1', parent_task_id: null, assigned_user_id: 'user-1', status: 'Assigned', priority: 'Urgent', due_at: overdue },
        { ...baseTask, id: 'd1-t2', department_id: 'dept-1', parent_task_id: null, assigned_user_id: 'user-1', status: 'Assigned', priority: 'High', due_at: overdue },
        { ...baseTask, id: 'd2-t1', department_id: 'dept-2', parent_task_id: null, assigned_user_id: 'user-3', status: 'Assigned', priority: 'Urgent', due_at: overdue },
        { ...baseTask, id: 'd2-t2', department_id: 'dept-2', parent_task_id: null, assigned_user_id: 'user-3', status: 'Assigned', priority: 'High', due_at: overdue },
      ])

      const result = await taskService.getWorkloadRebalancingSuggestions('company-1')

      expect(result).toHaveLength(2)
      expect(result.map(item => item.department_id).sort()).toEqual(['dept-1', 'dept-2'])
      expect(result.every(item => item.type === 'rebalance' && item.suggested_task_id && item.reason)).toBe(true)
    })

    it('scopes the suggestion to the given department only', async () => {
      const overdue = new Date(Date.now() - 60 * 60 * 1000).toISOString()
      vi.mocked(taskRepository.getManagersByDepartment).mockResolvedValue([
        { id: 'user-3', full_name: 'User Three' },
        { id: 'user-4', full_name: 'User Four' },
      ])
      vi.mocked(taskRepository.getTasksByCompany).mockResolvedValue([
        { ...baseTask, id: 't1', department_id: 'dept-1', assigned_user_id: 'user-1', status: 'Assigned', priority: 'Urgent', due_at: overdue },
        { ...baseTask, id: 't2', department_id: 'dept-1', assigned_user_id: 'user-2', status: 'Assigned', priority: 'Low', due_at: farOut },
        { ...baseTask, id: 't3', department_id: 'dept-2', assigned_user_id: 'user-3', status: 'Assigned', priority: 'Medium', due_at: farOut },
        { ...baseTask, id: 't4', department_id: 'dept-2', assigned_user_id: 'user-4', status: 'Assigned', priority: 'Medium', due_at: farOut },
      ])

      const result = await taskService.getWorkloadRebalancingSuggestion('company-1', 'dept-2')

      expect(result.type).toBe('balanced')
    })

    it('does not count a sub-task as its own scored item', async () => {
      const overdue = new Date(Date.now() - 60 * 60 * 1000).toISOString()
      vi.mocked(taskRepository.getManagersByDepartment).mockResolvedValue([
        { id: 'user-1', full_name: 'User One' },
        { id: 'user-2', full_name: 'User Two' },
      ])
      vi.mocked(taskRepository.getTasksByCompany).mockResolvedValue([
        { ...baseTask, id: 'parent', department_id: 'dept-1', parent_task_id: null, assigned_user_id: 'user-1', status: 'Assigned', priority: 'Low', due_at: farOut },
        { ...baseTask, id: 'sub', department_id: 'dept-1', parent_task_id: 'parent', assigned_user_id: 'user-1', status: 'Assigned', priority: 'Urgent', due_at: overdue },
        { ...baseTask, id: 't2', department_id: 'dept-1', parent_task_id: null, assigned_user_id: 'user-2', status: 'Assigned', priority: 'Low', due_at: farOut },
      ])

      const result = await taskService.getWorkloadRebalancingSuggestion('company-1')

      // parent (16) + sub (16) = 32 for user-1, vs 1 for user-2 — well past the 2x-average threshold
      expect(result.type).toBe('balanced')
    })

    it('can recommend a same-department manager with no active tasks', async () => {
      const overdue = new Date(Date.now() - 60 * 60 * 1000).toISOString()
      vi.mocked(taskRepository.getManagersByDepartment).mockResolvedValue([
        { id: 'user-1', full_name: 'User One' },
        { id: 'user-2', full_name: 'User Two' },
      ])
      vi.mocked(taskRepository.getTasksByCompany).mockResolvedValue([
        { ...baseTask, id: 't1', department_id: 'dept-1', parent_task_id: null, assigned_user_id: 'user-1', status: 'Assigned', priority: 'Urgent', due_at: overdue },
        { ...baseTask, id: 't2', department_id: 'dept-1', parent_task_id: null, assigned_user_id: 'user-1', status: 'Assigned', priority: 'High', due_at: overdue },
      ])

      const result = await taskService.getWorkloadRebalancingSuggestion('company-1')

      expect(result.type).toBe('rebalance')
      expect(result.overloaded_user_id).toBe('user-1')
      expect(result.recommended_user_id).toBe('user-2')
      expect(result.recommended_score).toBe(0)
    })

    it('never suggests moving a task that is in Review', async () => {
      const overdue = new Date(Date.now() - 60 * 60 * 1000).toISOString()
      vi.mocked(taskRepository.getManagersByDepartment).mockResolvedValue([
        { id: 'user-1', full_name: 'User One' },
        { id: 'user-2', full_name: 'User Two' },
      ])
      vi.mocked(taskRepository.getTasksByCompany).mockResolvedValue([
        // The heaviest task is in Review, so the suggestion must fall through to the Assigned one.
        { ...baseTask, id: 't1', department_id: 'dept-1', parent_task_id: null, assigned_user_id: 'user-1', status: 'Review', priority: 'Urgent', due_at: overdue },
        { ...baseTask, id: 't2', department_id: 'dept-1', parent_task_id: null, assigned_user_id: 'user-1', status: 'Assigned', priority: 'High', due_at: overdue },
      ])

      const result = await taskService.getWorkloadRebalancingSuggestion('company-1')

      expect(result.type).toBe('rebalance')
      expect(result.suggested_task_id).toBe('t2')
    })

    it('reports balanced when the overloaded manager\'s tasks are all in Review or rework', async () => {
      const overdue = new Date(Date.now() - 60 * 60 * 1000).toISOString()
      vi.mocked(taskRepository.getManagersByDepartment).mockResolvedValue([
        { id: 'user-1', full_name: 'User One' },
        { id: 'user-2', full_name: 'User Two' },
      ])
      vi.mocked(taskRepository.getTasksByCompany).mockResolvedValue([
        { ...baseTask, id: 't1', department_id: 'dept-1', parent_task_id: null, assigned_user_id: 'user-1', status: 'Review', priority: 'Urgent', due_at: overdue },
        // Rejected rework — only the original assignee has the context, so it can never move.
        { ...baseTask, id: 't2', department_id: 'dept-1', parent_task_id: null, assigned_user_id: 'user-1', status: 'In Progress', priority: 'High', due_at: overdue, rejection_reason: 'Numbers are off', rejected_at: overdue },
      ])

      const result = await taskService.getWorkloadRebalancingSuggestion('company-1')

      expect(result.type).toBe('balanced')
    })

    it('never suggests moving a rework task even when it is the only heavy one', async () => {
      const overdue = new Date(Date.now() - 60 * 60 * 1000).toISOString()
      vi.mocked(taskRepository.getManagersByDepartment).mockResolvedValue([
        { id: 'user-1', full_name: 'User One' },
        { id: 'user-2', full_name: 'User Two' },
      ])
      vi.mocked(taskRepository.getTasksByCompany).mockResolvedValue([
        { ...baseTask, id: 't1', department_id: 'dept-1', parent_task_id: null, assigned_user_id: 'user-1', status: 'In Progress', priority: 'Urgent', due_at: overdue, rejection_reason: 'Redo the summary', rejected_at: overdue },
        { ...baseTask, id: 't2', department_id: 'dept-1', parent_task_id: null, assigned_user_id: 'user-1', status: 'Assigned', priority: 'High', due_at: overdue },
      ])

      const result = await taskService.getWorkloadRebalancingSuggestion('company-1')

      expect(result.type).toBe('rebalance')
      expect(result.suggested_task_id).toBe('t2')
    })
  })

  describe('getWorkloadRebalancingSuggestions — Manager Tasks page (Employee-tier candidates)', () => {
    const overdue = new Date(Date.now() - 60 * 60 * 1000).toISOString()

    it('seeds zero-score baseline candidates from Employees, not Managers, when candidateRole is Employee', async () => {
      vi.mocked(taskRepository.getEmployeesByDepartment).mockResolvedValue([
        { id: 'emp-1', full_name: 'Employee One' },
        { id: 'emp-2', full_name: 'Employee Two' },
      ])
      vi.mocked(taskRepository.getTasksByCompany).mockResolvedValue([
        { ...baseTask, id: 't1', department_id: 'dept-1', parent_task_id: null, assigned_user_id: 'emp-1', status: 'Assigned', priority: 'Urgent', due_at: overdue },
        { ...baseTask, id: 't2', department_id: 'dept-1', parent_task_id: null, assigned_user_id: 'emp-1', status: 'Assigned', priority: 'High', due_at: overdue },
      ])

      const [result] = await taskService.getWorkloadRebalancingSuggestions('company-1', undefined, ['mgr-1'], ['dept-1'], 'Employee')

      expect(taskRepository.getEmployeesByDepartment).toHaveBeenCalledWith('company-1', 'dept-1')
      expect(taskRepository.getManagersByDepartment).not.toHaveBeenCalled()
      expect(result.overloaded_user_id).toBe('emp-1')
      expect(result.recommended_user_id).toBe('emp-2') // never a manager id
    })

    it('defaults to Manager-tier candidates (existing Owner/Partner behaviour) when candidateRole is omitted', async () => {
      vi.mocked(taskRepository.getManagersByDepartment).mockResolvedValue([
        { id: 'mgr-1', full_name: 'Manager One' },
        { id: 'mgr-2', full_name: 'Manager Two' },
      ])
      vi.mocked(taskRepository.getTasksByCompany).mockResolvedValue([
        { ...baseTask, id: 't1', department_id: 'dept-1', parent_task_id: null, assigned_user_id: 'mgr-1', status: 'Assigned', priority: 'Urgent', due_at: overdue },
        { ...baseTask, id: 't2', department_id: 'dept-1', parent_task_id: null, assigned_user_id: 'mgr-1', status: 'Assigned', priority: 'High', due_at: overdue },
      ])

      await taskService.getWorkloadRebalancingSuggestions('company-1')

      expect(taskRepository.getEmployeesByDepartment).not.toHaveBeenCalled()
      expect(taskRepository.getManagersByDepartment).toHaveBeenCalled()
    })

    it('passes scopeDepartmentIds through to getTasksByCompany as the department security scope', async () => {
      vi.mocked(taskRepository.getEmployeesByDepartment).mockResolvedValue([])
      vi.mocked(taskRepository.getTasksByCompany).mockResolvedValue([])

      await taskService.getWorkloadRebalancingSuggestions('company-1', undefined, ['mgr-1', 'mgr-2'], ['dept-1', 'dept-2'], 'Employee')

      expect(taskRepository.getTasksByCompany).toHaveBeenCalledWith('company-1', ['mgr-1', 'mgr-2'], ['dept-1', 'dept-2'])
    })
  })

  describe('getTaskReassignmentSuggestion (UC21)', () => {
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

  describe('getTaskDelayAlerts (UC22 Task Delay Alert)', () => {
    beforeEach(() => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2026-01-15T12:00:00.000Z'))
      vi.mocked(taskRepository.getTaskDelayThreshold).mockResolvedValue(null) // default 50
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('flags an Assigned task only after more than the threshold of its assigned-to-deadline window has elapsed', async () => {
      const now = Date.now()
      // assigned 5 hours ago, due in 3 hours → 8h total window, 62.5% elapsed
      const pastHalfway = { created_at: new Date(now - 5 * 60 * 60 * 1000).toISOString(), due_at: new Date(now + 3 * 60 * 60 * 1000).toISOString() }
      // assigned 4 hours ago, due in 4 hours → 8h total window, exactly 50% — not past it yet
      const halfwayExactly = { created_at: new Date(now - 4 * 60 * 60 * 1000).toISOString(), due_at: new Date(now + 4 * 60 * 60 * 1000).toISOString() }
      // assigned 1 hour ago, due in 7 hours → 12.5%, nowhere near
      const justAssigned = { created_at: new Date(now - 60 * 60 * 1000).toISOString(), due_at: new Date(now + 7 * 60 * 60 * 1000).toISOString() }
      vi.mocked(taskRepository.getTasksByCompany).mockResolvedValue([
        { ...baseTask, id: 't1', status: 'Assigned', ...pastHalfway },
        { ...baseTask, id: 't2', status: 'Assigned', ...halfwayExactly },
        { ...baseTask, id: 't3', status: 'Assigned', ...justAssigned },
      ])

      const result = await taskService.getTaskDelayAlerts('company-1')

      expect(result.map(a => a.task_id)).toEqual(['t1'])
    })

    it('never flags a task that already moved to In Progress, Review, or Complete', async () => {
      const now = Date.now()
      const wayPastDeadline = { created_at: new Date(now - 10 * 60 * 60 * 1000).toISOString(), due_at: new Date(now - 5 * 60 * 60 * 1000).toISOString() }
      vi.mocked(taskRepository.getTasksByCompany).mockResolvedValue([
        { ...baseTask, id: 't1', status: 'In Progress', ...wayPastDeadline },
        { ...baseTask, id: 't2', status: 'Review', ...wayPastDeadline },
        { ...baseTask, id: 't3', status: 'Complete', ...wayPastDeadline },
      ])

      const result = await taskService.getTaskDelayAlerts('company-1')

      expect(result).toHaveLength(0)
    })

    it('honours the company-configured threshold instead of the default', async () => {
      const now = Date.now()
      // 62.5% elapsed — past the default 50 but below a custom 80
      const pastHalfway = { created_at: new Date(now - 5 * 60 * 60 * 1000).toISOString(), due_at: new Date(now + 3 * 60 * 60 * 1000).toISOString() }
      vi.mocked(taskRepository.getTaskDelayThreshold).mockResolvedValue(80)
      vi.mocked(taskRepository.getTasksByCompany).mockResolvedValue([
        { ...baseTask, id: 't1', status: 'Assigned', ...pastHalfway },
      ])

      const result = await taskService.getTaskDelayAlerts('company-1')

      expect(result).toHaveLength(0)
      expect(taskRepository.getTaskDelayThreshold).toHaveBeenCalledWith('company-1')
    })

    it('does not flag sub-tasks separately from their main task', async () => {
      const now = Date.now()
      const pastHalfway = { created_at: new Date(now - 5 * 60 * 60 * 1000).toISOString(), due_at: new Date(now + 3 * 60 * 60 * 1000).toISOString() }
      vi.mocked(taskRepository.getTasksByCompany).mockResolvedValue([
        { ...baseTask, id: 'parent', parent_task_id: null, status: 'Assigned', ...pastHalfway },
        { ...baseTask, id: 'sub', parent_task_id: 'parent', status: 'Assigned', ...pastHalfway },
      ])

      const result = await taskService.getTaskDelayAlerts('company-1')

      expect(result.map(a => a.task_id)).toEqual(['parent'])
    })

    it('scopes alerts to the given department only', async () => {
      const now = Date.now()
      const pastHalfway = { created_at: new Date(now - 5 * 60 * 60 * 1000).toISOString(), due_at: new Date(now + 3 * 60 * 60 * 1000).toISOString() }
      vi.mocked(taskRepository.getTasksByCompany).mockResolvedValue([
        { ...baseTask, id: 't1', department_id: 'dept-1', status: 'Assigned', ...pastHalfway },
        { ...baseTask, id: 't2', department_id: 'dept-2', status: 'Assigned', ...pastHalfway },
      ])

      const result = await taskService.getTaskDelayAlerts('company-1', 'dept-2')

      expect(result.map(a => a.task_id)).toEqual(['t2'])
    })

    it('passes an assigned_by list and scopeDepartmentIds through to the repository (Manager Tasks page scope)', async () => {
      vi.mocked(taskRepository.getTasksByCompany).mockResolvedValue([])

      await taskService.getTaskDelayAlerts('company-1', undefined, ['mgr-a', 'mgr-b'], ['dept-1'])

      expect(taskRepository.getTasksByCompany).toHaveBeenCalledWith('company-1', ['mgr-a', 'mgr-b'], ['dept-1'])
    })

    it('never re-flags a task this viewer has marked as read', async () => {
      const now = Date.now()
      const pastHalfway = { created_at: new Date(now - 5 * 60 * 60 * 1000).toISOString(), due_at: new Date(now + 3 * 60 * 60 * 1000).toISOString() }
      vi.mocked(taskRepository.getTasksByCompany).mockResolvedValue([
        { ...baseTask, id: 't1', status: 'Assigned', ...pastHalfway },
        { ...baseTask, id: 't2', status: 'Assigned', ...pastHalfway },
      ])
      vi.mocked(taskRepository.getDelayAlertReadsByUser).mockResolvedValue(new Map([['t1', new Date(now - 60 * 60 * 1000).toISOString()]]))

      const result = await taskService.getTaskDelayAlerts('company-1', undefined, undefined, undefined, 'owner-1')

      expect(result.map(a => a.task_id)).toEqual(['t2'])
    })

    it('still shows an alert a peer viewer marked as read but this viewer has not', async () => {
      const now = Date.now()
      const pastHalfway = { created_at: new Date(now - 5 * 60 * 60 * 1000).toISOString(), due_at: new Date(now + 3 * 60 * 60 * 1000).toISOString() }
      vi.mocked(taskRepository.getTasksByCompany).mockResolvedValue([
        { ...baseTask, id: 't1', status: 'Assigned', ...pastHalfway },
      ])
      // getDelayAlertReadsByUser is called with THIS viewer's id and returns nothing for them,
      // even though a peer (e.g. Partner) already dismissed it for themselves.
      vi.mocked(taskRepository.getDelayAlertReadsByUser).mockResolvedValue(new Map())

      const result = await taskService.getTaskDelayAlerts('company-1', undefined, undefined, undefined, 'partner-1')

      expect(taskRepository.getDelayAlertReadsByUser).toHaveBeenCalledWith('partner-1')
      expect(result.map(a => a.task_id)).toEqual(['t1'])
    })
  })

  describe('markTaskDelayAlertsRead', () => {
    it('rejects an empty or invalid task_ids list, or a missing user_id', async () => {
      await expect(taskService.markTaskDelayAlertsRead([], 'owner-1')).rejects.toThrow('task_ids is required')
      await expect(taskService.markTaskDelayAlertsRead([''], 'owner-1')).rejects.toThrow('task_ids must be non-empty strings')
      await expect(taskService.markTaskDelayAlertsRead(['t1'])).rejects.toThrow('user_id is required')
      expect(taskRepository.markDelayAlertsRead).not.toHaveBeenCalled()
    })

    it('marks exactly the given tasks as read for the acting viewer', async () => {
      vi.mocked(taskRepository.markDelayAlertsRead).mockResolvedValue(undefined)

      await taskService.markTaskDelayAlertsRead(['t1', 't2'], 'owner-1')

      expect(taskRepository.markDelayAlertsRead).toHaveBeenCalledWith(['t1', 't2'], 'owner-1')
    })
  })

  describe('getTaskDelayThreshold / updateTaskDelayThreshold', () => {
    it('falls back to 50 when the company never customised the threshold', async () => {
      vi.mocked(taskRepository.getTaskDelayThreshold).mockResolvedValue(null)
      await expect(taskService.getTaskDelayThreshold('company-1')).resolves.toEqual({ threshold_percent: 50 })
    })

    it('returns the stored threshold when one exists', async () => {
      vi.mocked(taskRepository.getTaskDelayThreshold).mockResolvedValue(75)
      await expect(taskService.getTaskDelayThreshold('company-1')).resolves.toEqual({ threshold_percent: 75 })
    })

    it('rejects a threshold outside 1-100 or non-integer', async () => {
      for (const bad of [0, 101, -5, 49.5, NaN]) {
        await expect(taskService.updateTaskDelayThreshold('company-1', bad))
          .rejects.toThrow('threshold_percent must be an integer between 1 and 100')
      }
      expect(taskRepository.upsertTaskDelayThreshold).not.toHaveBeenCalled()
    })

    it('persists a valid threshold with the acting user', async () => {
      const result = await taskService.updateTaskDelayThreshold('company-1', 70, 'owner-1')
      expect(result).toEqual({ threshold_percent: 70 })
      expect(taskRepository.upsertTaskDelayThreshold).toHaveBeenCalledWith('company-1', 70, 'owner-1')
    })
  })
})
