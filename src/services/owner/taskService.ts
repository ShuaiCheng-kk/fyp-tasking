// LAYER: Service
// RULE: Business logic only. No HTTP handling. No direct DB access.

import { taskRepository } from '@/repositories/owner/taskRepository'
import {
  Task,
  TaskInput,
  SubTaskInput,
  TaskStats,
  DepartmentTaskStats,
  KanbanGroup,
  TaskCalendarItem,
  TaskRecurrenceInput,
  TaskDeadlineRule,
  TaskReassignmentSuggestion,
  TaskWorkloadSuggestion,
  StalledTaskAlert,
} from '@/types/Task'

export interface ActivityFeedEvent {
  id: string
  type: 'task_updated'
  actor_name: string
  department: string
  timestamp: string
  description: string
}

const VALID_STATUSES = ['Assigned', 'In Progress', 'Review', 'Complete'] as const

export const taskService = {

  async assignTask(input: TaskInput): Promise<Task> {
    if (!input.company_id || !input.department_id || !input.title?.trim()) {
      throw new Error('company_id, department_id, and title are required')
    }
    await validateTaskAssignment(input)
    if (input.percentage_complete !== undefined) {
      if (input.percentage_complete < 0 || input.percentage_complete > 100) {
        throw new Error('percentage_complete must be between 0 and 100')
      }
    }
    return taskRepository.createTask(input)
  },

  // UC22 Create Sub Task / UC28 Set Task Dependencies — sub_tasks are created under the
  // main task; sequence_order is only set (0-based) when there are 2+ sub-tasks, since a
  // single sub-task has nothing to be sequenced against.
  async assignTaskWithSubTasks(input: TaskInput, subTasks: SubTaskInput[]): Promise<Task> {
    const mainTask = await this.assignTask(input)
    const titles = subTasks.map(s => s.title?.trim()).filter((t): t is string => !!t)
    if (titles.length === 0) return mainTask

    const ordered = titles.length >= 2
    for (let i = 0; i < subTasks.length; i++) {
      const title = subTasks[i].title?.trim()
      if (!title) continue
      await taskRepository.createTask({
        shift_id: mainTask.shift_id,
        company_id: mainTask.company_id,
        department_id: mainTask.department_id,
        parent_task_id: mainTask.id,
        sequence_order: ordered ? i : null,
        title,
        description: subTasks[i].description ?? null,
        assigned_user_id: mainTask.assigned_user_id,
        assigned_by: mainTask.assigned_by,
        status: 'Assigned',
        percentage_complete: 0,
        task_date: mainTask.task_date,
      })
    }
    return mainTask
  },

  async editTask(id: string, input: Partial<TaskInput>): Promise<Task> {
    if (!id) throw new Error('Task id is required')
    const existing = await taskRepository.getTaskById(id)
    await validateTaskAssignment({
      ...existing,
      ...input,
      company_id: input.company_id ?? existing.company_id,
      department_id: input.department_id ?? existing.department_id,
      title: input.title ?? existing.title,
    })
    if (input.status && !VALID_STATUSES.includes(input.status as typeof VALID_STATUSES[number])) {
      throw new Error(`status must be one of: ${VALID_STATUSES.join(', ')}`)
    }
    if (input.percentage_complete !== undefined) {
      if (input.percentage_complete < 0 || input.percentage_complete > 100) {
        throw new Error('percentage_complete must be between 0 and 100')
      }
    }
    return taskRepository.updateTask(id, input)
  },

  async deleteTask(id: string): Promise<void> {
    if (!id) throw new Error('Task id is required')
    const task = await taskRepository.getTaskById(id)

    // Deleting the original of a recurring series takes the whole series with it — mirrors
    // recurring Shift deletion. Deleting a sibling occurrence only removes that one occurrence.
    const isRecurrenceOriginal = task.recurrence_group_id && task.source_task_id === null
    const siblings = isRecurrenceOriginal
      ? (await taskRepository.getTasksByRecurrenceGroupId(task.recurrence_group_id!)).filter(t => t.id !== id)
      : []
    const tasksToDelete = [task, ...siblings]

    for (const t of tasksToDelete) {
      await taskRepository.deleteSubTasksByParent(t.id)
      await taskRepository.deleteTask(t.id)
    }
  },

  async duplicateTask(id: string, assigned_by?: string): Promise<Task> {
    const original = await taskRepository.getTaskById(id)
    const duplicated = await taskRepository.createTask({
      shift_id: original.shift_id,
      company_id: original.company_id,
      department_id: original.department_id,
      parent_task_id: original.parent_task_id,
      title: `${original.title} (copy)`,
      description: original.description,
      assigned_user_id: original.assigned_user_id,
      status: 'Assigned',
      percentage_complete: 0,
      priority: original.priority,
      due_at: original.due_at,
      task_date: original.task_date,
      assigned_by: assigned_by ?? original.assigned_by,
    })

    const subTasks = await taskRepository.getSubTasks(original.id)
    for (const subTask of subTasks) {
      await taskRepository.createTask({
        shift_id: subTask.shift_id,
        company_id: subTask.company_id,
        department_id: subTask.department_id,
        parent_task_id: duplicated.id,
        sequence_order: subTask.sequence_order,
        title: subTask.title,
        description: subTask.description,
        assigned_user_id: subTask.assigned_user_id,
        assigned_by: assigned_by ?? subTask.assigned_by,
        status: 'Assigned',
        percentage_complete: 0,
        priority: subTask.priority,
        due_at: subTask.due_at,
        task_date: subTask.task_date,
      })
    }

    return duplicated
  },

  async createRecurringTasks(id: string, input: TaskRecurrenceInput): Promise<Task[]> {
    const original = await taskRepository.getTaskById(id)
    if (!['daily', 'weekly', 'custom'].includes(input.recurrence_rule)) {
      throw new Error('recurrence_rule must be daily, weekly, or custom')
    }
    if (!input.recurrence_end_date) throw new Error('recurrence_end_date is required')
    if (original.source_task_id !== null) {
      throw new Error('Only the original task in a recurring series can have its recurrence edited')
    }
    const deadlineRule = input.deadline_rule
    if (deadlineRule) {
      if (!['same_day', 'fixed_day', 'relative'].includes(deadlineRule.type)) {
        throw new Error('deadline_rule.type must be same_day, fixed_day, or relative')
      }
      if (deadlineRule.type === 'fixed_day' && input.recurrence_rule !== 'weekly') {
        throw new Error('Fixed day deadlines are only available for weekly recurrence')
      }
      if ((deadlineRule.type === 'same_day' || deadlineRule.type === 'fixed_day') && !deadlineRule.time) {
        throw new Error('deadline_rule.time is required for same_day and fixed_day')
      }
      if (deadlineRule.type === 'fixed_day' && (deadlineRule.weekday === undefined || deadlineRule.weekday < 0 || deadlineRule.weekday > 6)) {
        throw new Error('deadline_rule.weekday must be between 0 and 6 for fixed_day')
      }
      if (deadlineRule.type === 'relative' && (!deadlineRule.offset_amount || deadlineRule.offset_amount < 1 || !deadlineRule.offset_unit)) {
        throw new Error('deadline_rule.offset_amount and offset_unit are required for relative')
      }
    }

    const baseDate = original.task_date ?? original.due_at?.slice(0, 10)
    if (!baseDate) throw new Error('Task needs task_date or due_at before recurrence can be created')
    if (input.recurrence_end_date <= baseDate) {
      throw new Error('recurrence_end_date must be after the task date')
    }

    const intervalDays = input.recurrence_rule === 'daily'
      ? 1
      : input.recurrence_rule === 'weekly'
        ? 7
        : Math.min(31, Math.max(1, input.custom_interval_days || 14))

    // Re-running recurrence on an already-recurring original (e.g. weekly -> daily) replaces its
    // previously generated occurrences rather than layering new ones alongside them.
    if (original.recurrence_group_id) {
      const siblings = (await taskRepository.getTasksByRecurrenceGroupId(original.recurrence_group_id))
        .filter(t => t.id !== id)
      for (const sibling of siblings) {
        await taskRepository.deleteSubTasksByParent(sibling.id)
        await taskRepository.deleteTask(sibling.id)
      }
    }

    const recurrenceGroupId = original.recurrence_group_id ?? crypto.randomUUID()
    await taskRepository.updateTask(id, {
      recurrence_group_id: recurrenceGroupId,
      ...(deadlineRule ? { due_at: computeDeadlineFromRule(baseDate, deadlineRule) } : {}),
    })

    const subTasks = (await taskRepository.getSubTasks(original.id)) ?? []
    const created: Task[] = []
    let nextDate = addDays(baseDate, intervalDays)

    while (nextDate <= input.recurrence_end_date) {
      const due_at = deadlineRule
        ? computeDeadlineFromRule(nextDate, deadlineRule)
        : original.due_at ? moveIsoDate(original.due_at, nextDate) : null
      const copy = await taskRepository.createTask({
        shift_id: original.shift_id,
        company_id: original.company_id,
        department_id: original.department_id,
        parent_task_id: original.parent_task_id,
        title: original.title,
        description: original.description,
        assigned_user_id: original.assigned_user_id,
        assigned_by: input.assigned_by ?? original.assigned_by,
        status: 'Assigned',
        percentage_complete: 0,
        priority: original.priority,
        due_at,
        task_date: nextDate,
        recurrence_group_id: recurrenceGroupId,
        source_task_id: original.id,
      })
      created.push(copy)

      // Each occurrence gets its own copy of the original's sub-task checklist, shifted to the same date.
      for (const subTask of subTasks) {
        await taskRepository.createTask({
          shift_id: subTask.shift_id,
          company_id: subTask.company_id,
          department_id: subTask.department_id,
          parent_task_id: copy.id,
          sequence_order: subTask.sequence_order,
          title: subTask.title,
          description: subTask.description,
          assigned_user_id: subTask.assigned_user_id,
          assigned_by: input.assigned_by ?? subTask.assigned_by,
          status: 'Assigned',
          percentage_complete: 0,
          priority: subTask.priority,
          due_at: subTask.due_at ? moveIsoDate(subTask.due_at, nextDate) : null,
          task_date: subTask.task_date ? nextDate : null,
        })
      }

      nextDate = addDays(nextDate, intervalDays)
    }

    return created
  },

  async archiveTask(id: string): Promise<Task> {
    if (!id) throw new Error('Task id is required')
    return taskRepository.updateTask(id, { status: 'Complete', percentage_complete: 100 })
  },

  // UC28 Set Task Dependencies — reorders the sub-tasks of a parent task so each one must
  // be completed before the next starts. sub_task_ids must be the full, reordered set of
  // the parent's existing sub-tasks (drag-to-reorder result from the UI).
  async reorderSubTasks(parentTaskId: string, subTaskIds: string[]): Promise<Task[]> {
    if (!parentTaskId) throw new Error('Task id is required')
    if (!Array.isArray(subTaskIds)) throw new Error('sub_task_ids must be an array')
    const existing = await taskRepository.getSubTasks(parentTaskId)
    const existingIds = new Set(existing.map(t => t.id))
    if (subTaskIds.length !== existing.length || !subTaskIds.every(id => existingIds.has(id))) {
      throw new Error('sub_task_ids must match the parent task\'s existing sub-tasks')
    }

    const updated: Task[] = []
    for (let i = 0; i < subTaskIds.length; i++) {
      updated.push(await taskRepository.updateTask(subTaskIds[i], { sequence_order: subTaskIds.length >= 2 ? i : null }))
    }
    return updated
  },

  async updateTaskStatus(
    id: string,
    status: Task['status'],
    percentage_complete: number,
  ): Promise<Task> {
    if (!VALID_STATUSES.includes(status)) {
      throw new Error(`status must be one of: ${VALID_STATUSES.join(', ')}`)
    }
    if (percentage_complete < 0 || percentage_complete > 100) {
      throw new Error('percentage_complete must be between 0 and 100')
    }
    return taskRepository.updateTask(id, { status, percentage_complete })
  },

  async getKanbanTasks(company_id: string): Promise<KanbanGroup> {
    const tasks = await taskRepository.getTasksByCompany(company_id)
    return {
      Assigned: tasks.filter(t => t.status === 'Assigned'),
      'In Progress': tasks.filter(t => t.status === 'In Progress'),
      Review: tasks.filter(t => t.status === 'Review'),
      Complete: tasks.filter(t => t.status === 'Complete'),
    }
  },

  async getCompanyTaskStats(company_id: string): Promise<TaskStats> {
    return taskRepository.getTaskStatsByCompany(company_id)
  },

  async getDepartmentTaskStats(company_id: string): Promise<DepartmentTaskStats[]> {
    return taskRepository.getTaskStatsByDepartment(company_id)
  },

  async getFilteredTasks(
    company_id: string,
    filters: { status?: string; department_id?: string },
  ): Promise<Task[]> {
    return taskRepository.getTasksByCompanyWithFilters(company_id, filters)
  },

  async getCalendarTasks(company_id: string, date_from: string, date_to: string): Promise<TaskCalendarItem[]> {
    if (!date_from || !date_to) throw new Error('date_from and date_to are required')
    if (date_to < date_from) throw new Error('date_to must be on or after date_from')
    const tasks = await taskRepository.getTasksByCompany(company_id)
    return tasks
      .map(task => ({ ...task, calendar_date: task.task_date ?? task.due_at?.slice(0, 10) ?? '' }))
      .filter(task => task.calendar_date >= date_from && task.calendar_date <= date_to)
  },

  async getTasksByShift(shift_id: string): Promise<Task[]> {
    return taskRepository.getTasksByShift(shift_id)
  },

  async getTasksByCompanyShift(company_id: string, shift_id: string): Promise<Task[]> {
    if (!company_id || !shift_id) throw new Error('company_id and shift_id are required')
    return taskRepository.getTasksByShiftForCompany(company_id, shift_id)
  },

  async getTodayActivityFeed(company_id: string): Promise<ActivityFeedEvent[]> {
    const { tasks, departments, users } = await taskRepository.getActivityFeedToday(company_id)

    const deptMap = new Map(departments.map(d => [d.id, d.name]))
    const userMap = new Map(users.map(u => [u.id, u.full_name]))

    const events: ActivityFeedEvent[] = []

    for (const task of tasks) {
      if (task.status === 'Assigned') continue
      const actor = task.assigned_user_id ? (userMap.get(task.assigned_user_id) ?? 'Someone') : 'Owner'
      const dept = deptMap.get(task.department_id) ?? 'Unknown'
      events.push({
        id: `task_${task.id}`,
        type: 'task_updated',
        actor_name: actor,
        department: dept,
        timestamp: task.updated_at,
        description: `${actor} moved "${task.title}" to ${task.status}`,
      })
    }

    events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    return events.slice(0, 20)
  },

  async getWorkloadRebalancingSuggestion(company_id: string): Promise<TaskWorkloadSuggestion> {
    const activeTasks = (await taskRepository.getTasksByCompany(company_id)).filter(task => task.status !== 'Complete' && task.assigned_user_id)
    const counts = new Map<string, number>()
    for (const task of activeTasks) {
      counts.set(task.assigned_user_id!, (counts.get(task.assigned_user_id!) ?? 0) + 1)
    }
    const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1])
    if (ranked.length < 2 || ranked[0][1] - ranked[ranked.length - 1][1] < 2) {
      return { type: 'balanced', message: 'Workload is currently balanced across assigned users.' }
    }
    const [overloaded_user_id, overloaded_count] = ranked[0]
    const [recommended_user_id, recommended_count] = ranked[ranked.length - 1]
    return {
      type: 'rebalance',
      message: `Move one active task from ${overloaded_user_id} to ${recommended_user_id}.`,
      overloaded_user_id,
      recommended_user_id,
      overloaded_count,
      recommended_count,
    }
  },

  async getTaskReassignmentSuggestion(id: string): Promise<TaskReassignmentSuggestion> {
    const task = await taskRepository.getTaskById(id)
    const activeTasks = (await taskRepository.getTasksByCompany(task.company_id)).filter(row => row.status !== 'Complete' && row.assigned_user_id)
    const counts = new Map<string, number>()
    for (const row of activeTasks) counts.set(row.assigned_user_id!, (counts.get(row.assigned_user_id!) ?? 0) + 1)
    const candidates = [...counts.entries()].sort((a, b) => a[1] - b[1])
    const recommended = candidates.find(([userId]) => userId !== task.assigned_user_id)?.[0] ?? null
    return {
      task_id: task.id,
      current_assignee_id: task.assigned_user_id,
      recommended_assignee_id: recommended,
      reason: recommended
        ? 'Recommended assignee has fewer active tasks than the current assignee.'
        : 'No lighter active assignee is available for this task.',
    }
  },

  async getStalledTaskAlerts(company_id: string, stale_after_days = 3): Promise<StalledTaskAlert[]> {
    const cutoffMs = Date.now() - stale_after_days * 24 * 60 * 60 * 1000
    return (await taskRepository.getTasksByCompany(company_id))
      .filter(task => task.status !== 'Complete')
      .map(task => {
        const updatedAt = new Date(task.updated_at ?? task.created_at).getTime()
        return {
          task,
          days_since_update: Math.max(0, Math.floor((Date.now() - updatedAt) / (24 * 60 * 60 * 1000))),
          isStalled: updatedAt <= cutoffMs,
        }
      })
      .filter(row => row.isStalled)
      .map(row => ({
        task_id: row.task.id,
        title: row.task.title,
        status: row.task.status,
        days_since_update: row.days_since_update,
        message: `"${row.task.title}" has not moved for ${row.days_since_update} days.`,
      }))
  },

}

function addDays(date: string, days: number): string {
  const next = new Date(`${date}T00:00:00.000Z`)
  next.setUTCDate(next.getUTCDate() + days)
  return next.toISOString().slice(0, 10)
}

// Preserves the original deadline's local wall-clock time on the new calendar date — mirrors how
// the client builds due_at (`new Date(`${date}T${time}:00`).toISOString()`, i.e. local-time parse).
// Re-anchoring via UTC hours instead would shift the local calendar day for early-morning deadlines
// in timezones ahead of UTC (e.g. a 2AM UTC+8 deadline is 6PM UTC the previous day).
function moveIsoDate(iso: string, date: string): string {
  const original = new Date(iso)
  const hh = String(original.getHours()).padStart(2, '0')
  const mm = String(original.getMinutes()).padStart(2, '0')
  const ss = String(original.getSeconds()).padStart(2, '0')
  return new Date(`${date}T${hh}:${mm}:${ss}`).toISOString()
}

function formatDateKey(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

// Computes a recurring occurrence's deadline from its own start date per the chosen rule. Every
// intermediate Date is built from a local-time string (no Z/UTC* accessors) for the same reason
// moveIsoDate above is — re-anchoring via UTC components shifts the local calendar day for
// early-morning deadlines in timezones ahead of UTC.
function computeDeadlineFromRule(taskDate: string, rule: TaskDeadlineRule): string {
  if (rule.type === 'same_day') {
    return new Date(`${taskDate}T${rule.time}:00`).toISOString()
  }
  if (rule.type === 'fixed_day') {
    const d = new Date(`${taskDate}T00:00:00`)
    d.setDate(d.getDate() + ((rule.weekday! - d.getDay() + 7) % 7))
    return new Date(`${formatDateKey(d)}T${rule.time}:00`).toISOString()
  }
  // relative
  const base = new Date(`${taskDate}T00:00:00`)
  if (rule.offset_unit === 'hours') base.setHours(base.getHours() + (rule.offset_amount ?? 0))
  else base.setDate(base.getDate() + (rule.offset_amount ?? 0))
  return base.toISOString()
}

async function validateTaskAssignment(input: TaskInput): Promise<void> {
  const creator = input.assigned_by ? await taskRepository.getUserById(input.assigned_by) : null

  if (input.assigned_user_id) {
    const assignee = await taskRepository.getUserById(input.assigned_user_id)
    if (!assignee) throw new Error('Selected assignee not found')
    if (assignee.company_id !== input.company_id) throw new Error('Selected assignee does not belong to this company')

    if (!creator || creator.role === 'Owner' || creator.role === 'Partner') {
      if (assignee.role !== 'Manager') {
        throw new Error('Owner tasks can only be assigned to Managers')
      }
    } else if (creator.role === 'Manager') {
      if (!['Employee', 'Casual Worker'].includes(assignee.role)) {
        throw new Error('Manager tasks can only be assigned to Employees or Casual Workers')
      }

      const managerDeptIds = await taskRepository.getManagerDepartmentIds(creator.id, input.company_id)
      if (!managerDeptIds.includes(input.department_id)) {
        throw new Error('Managers can only create tasks for their own departments')
      }

      const assigneeDeptIds = assignee.role === 'Employee'
        ? await taskRepository.getEmployeeDepartmentIds(assignee.id)
        : [input.department_id]
      if (assignee.role === 'Employee' && !assigneeDeptIds.includes(input.department_id)) {
        throw new Error('Managers can only assign tasks to employees in their own department')
      }
    } else {
      throw new Error('This role cannot assign tasks')
    }
  }

  if (input.shift_id) {
    const shift = await taskRepository.getShiftById(input.shift_id)
    if (!shift) throw new Error('Selected shift not found')
    if (shift.company_id !== input.company_id) throw new Error('Selected shift does not belong to this company')
    if (shift.department_id !== input.department_id) throw new Error('Selected shift does not belong to this department')
  }
}
