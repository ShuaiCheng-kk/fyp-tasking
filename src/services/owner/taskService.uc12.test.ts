import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase', () => ({
  supabase: {},
  createClient: () => ({}),
}))

vi.mock('@/repositories/owner/taskRepository', () => ({
  taskRepository: {
    getTaskById: vi.fn(),
    getUserById: vi.fn(),
    getManagerDepartmentIds: vi.fn(),
    getEmployeeDepartmentIds: vi.fn(),
    getSupervisedCasualWorkerIds: vi.fn(),
    updateTask: vi.fn(),
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

describe('UC12 Edit Task', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('UC12-M-UT-O: Owner edits an active task they created themselves', async () => {
    const existing = { ...baseTask, assigned_by: 'owner-1', assigned_user_id: 'mgr-1' }
    vi.mocked(taskRepository.getTaskById).mockResolvedValue(existing)
    vi.mocked(taskRepository.getUserById).mockImplementation(async (id: string) => {
      if (id === 'owner-1') return { id: 'owner-1', role: 'Owner', company_id: 'comp-1' } as never
      if (id === 'mgr-1') return { id: 'mgr-1', role: 'Manager', company_id: 'comp-1' } as never
      return null
    })
    const updated = { ...existing, title: 'Restock and label shelves' }
    vi.mocked(taskRepository.updateTask).mockResolvedValue(updated)

    const result = await taskService.editTask('task-1', { title: 'Restock and label shelves' }, 'owner-1')

    expect(result).toEqual(updated)
    expect(taskRepository.updateTask).toHaveBeenCalledTimes(1)
  })

  it('UC12-M-UT-P: Partner edits an active task the Owner created', async () => {
    const existing = { ...baseTask, id: 'task-2', assigned_by: 'owner-2', assigned_user_id: 'mgr-2' }
    vi.mocked(taskRepository.getTaskById).mockResolvedValue(existing)
    vi.mocked(taskRepository.getUserById).mockImplementation(async (id: string) => {
      if (id === 'partner-1') return { id: 'partner-1', role: 'Partner', company_id: 'comp-1' } as never
      if (id === 'owner-2') return { id: 'owner-2', role: 'Owner', company_id: 'comp-1' } as never
      if (id === 'mgr-2') return { id: 'mgr-2', role: 'Manager', company_id: 'comp-1' } as never
      return null
    })
    const updated = { ...existing, title: 'Restock and label shelves' }
    vi.mocked(taskRepository.updateTask).mockResolvedValue(updated)

    const result = await taskService.editTask('task-2', { title: 'Restock and label shelves' }, 'partner-1')

    expect(result).toEqual(updated)
    expect(taskRepository.updateTask).toHaveBeenCalledTimes(1)
  })

  it('UC12-M-UT-M: Manager edits an active task they created themselves', async () => {
    const existing = { ...baseTask, id: 'task-3', assigned_by: 'mgr-3', assigned_user_id: 'emp-3' }
    vi.mocked(taskRepository.getTaskById).mockResolvedValue(existing)
    vi.mocked(taskRepository.getUserById).mockImplementation(async (id: string) => {
      if (id === 'mgr-3') return { id: 'mgr-3', role: 'Manager', company_id: 'comp-1' } as never
      if (id === 'emp-3') return { id: 'emp-3', role: 'Employee', company_id: 'comp-1' } as never
      return null
    })
    vi.mocked(taskRepository.getManagerDepartmentIds).mockResolvedValue(['dept-1'])
    vi.mocked(taskRepository.getEmployeeDepartmentIds).mockResolvedValue(['dept-1'])
    const updated = { ...existing, title: 'Restock and label shelves' }
    vi.mocked(taskRepository.updateTask).mockResolvedValue(updated)

    const result = await taskService.editTask('task-3', { title: 'Restock and label shelves' }, 'mgr-3')

    expect(result).toEqual(updated)
    expect(taskRepository.updateTask).toHaveBeenCalledTimes(1)
  })

  it('UC12-A1-UT-E: Employee edits an active task they created themselves for a Casual Worker', async () => {
    const existing = { ...baseTask, id: 'task-4', assigned_by: 'emp-4', assigned_user_id: 'cw-4' }
    vi.mocked(taskRepository.getTaskById).mockResolvedValue(existing)
    vi.mocked(taskRepository.getUserById).mockImplementation(async (id: string) => {
      if (id === 'emp-4') return { id: 'emp-4', role: 'Employee', company_id: 'comp-1' } as never
      if (id === 'cw-4') return { id: 'cw-4', role: 'Casual Worker', company_id: 'comp-1' } as never
      return null
    })
    vi.mocked(taskRepository.getEmployeeDepartmentIds).mockResolvedValue(['dept-1'])
    vi.mocked(taskRepository.getSupervisedCasualWorkerIds).mockResolvedValue(['cw-4'])
    const updated = { ...existing, title: 'Restock and label shelves' }
    vi.mocked(taskRepository.updateTask).mockResolvedValue(updated)

    const result = await taskService.editTask('task-4', { title: 'Restock and label shelves' }, 'emp-4')

    expect(result).toEqual(updated)
    expect(taskRepository.updateTask).toHaveBeenCalledTimes(1)
  })
})
