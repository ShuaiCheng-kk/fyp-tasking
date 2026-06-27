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
    // Adding a sub-task to an existing task is an operation on that task, so only the
    // person who originally assigned the parent may add to it.
    if (input.parent_task_id) {
      const parent = await taskRepository.getTaskById(input.parent_task_id)
      if (!input.assigned_by || parent.assigned_by !== input.assigned_by) {
        throw new Error('Only the user who assigned this task can perform this action')
      }
      // Sub-tasks inherit the parent's priority/deadline so they stay aligned with the main task
      // in UI and recurrence flows. They are not scored separately for workload/stalled alerts.
      input = { ...input, priority: parent.priority, due_at: parent.due_at }
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
        // Sub-tasks inherit the parent's priority/deadline so they remain part of the same task plan.
        priority: mainTask.priority,
        due_at: mainTask.due_at,
      })
    }
    return mainTask
  },

  async editTask(id: string, input: Partial<TaskInput>, actingUserId?: string | null): Promise<Task> {
    if (!id) throw new Error('Task id is required')
    const existing = await assertIsTaskOwner(id, actingUserId)
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
    const updated = await taskRepository.updateTask(id, input)
    if (
      existing.parent_task_id === null &&
      input.assigned_user_id !== undefined &&
      input.assigned_user_id !== existing.assigned_user_id
    ) {
      await taskRepository.updateSubTasksByParent(id, { assigned_user_id: input.assigned_user_id })
    }
    return updated
  },

  async deleteTask(id: string, actingUserId?: string | null): Promise<void> {
    if (!id) throw new Error('Task id is required')
    const task = await assertIsTaskOwner(id, actingUserId)

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
    const original = await assertIsTaskOwner(id, assigned_by)
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
    const original = await assertIsTaskOwner(id, input.assigned_by)
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
      // The original's assignee was only validated to have a shift on the original's own
      // task_date — each occurrence falls on a different date, so re-check per occurrence
      // rather than blindly copying the assignment. Occurrences that land on a date the
      // assignee has no shift go out Unassigned instead of blocking the whole series.
      const occurrenceAssigneeId = original.assigned_user_id
        && (await taskRepository.hasShiftOnDate(original.assigned_user_id, original.company_id, nextDate))
        ? original.assigned_user_id
        : null
      const copy = await taskRepository.createTask({
        shift_id: original.shift_id,
        company_id: original.company_id,
        department_id: original.department_id,
        parent_task_id: original.parent_task_id,
        title: original.title,
        description: original.description,
        assigned_user_id: occurrenceAssigneeId,
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
          assigned_user_id: occurrenceAssigneeId,
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

  async archiveTask(id: string, actingUserId?: string | null): Promise<Task> {
    if (!id) throw new Error('Task id is required')
    const task = await assertIsTaskOwner(id, actingUserId)
    // Archiving hides the task from the board — it does not change its status, so an archived
    // task that gets restored picks up exactly where it was instead of resetting to Complete/Assigned.
    const isRecurrenceOriginal = task.recurrence_group_id && task.source_task_id === null
    const siblings = isRecurrenceOriginal
      ? (await taskRepository.getTasksByRecurrenceGroupId(task.recurrence_group_id!)).filter(t => t.id !== id)
      : []
    const tasksToArchive = [task, ...siblings]

    let archivedTask = task
    for (const t of tasksToArchive) {
      const subTasks = await taskRepository.getSubTasks(t.id)
      for (const subTask of subTasks) {
        await taskRepository.updateTask(subTask.id, { is_archived: true })
      }
      const updated = await taskRepository.updateTask(t.id, { is_archived: true })
      if (t.id === id) archivedTask = updated
    }
    return archivedTask
  },

  async unarchiveTask(id: string, actingUserId?: string | null): Promise<Task> {
    if (!id) throw new Error('Task id is required')
    const task = await assertIsTaskOwner(id, actingUserId)
    const isRecurrenceOriginal = task.recurrence_group_id && task.source_task_id === null
    const siblings = isRecurrenceOriginal
      ? (await taskRepository.getTasksByRecurrenceGroupId(task.recurrence_group_id!)).filter(t => t.id !== id)
      : []
    const tasksToUnarchive = [task, ...siblings]

    let unarchivedTask = task
    for (const t of tasksToUnarchive) {
      const subTasks = await taskRepository.getSubTasks(t.id)
      for (const subTask of subTasks) {
        await taskRepository.updateTask(subTask.id, { is_archived: false })
      }
      const updated = await taskRepository.updateTask(t.id, { is_archived: false })
      if (t.id === id) unarchivedTask = updated
    }
    return unarchivedTask
  },

  async getArchivedTasks(company_id: string): Promise<Task[]> {
    if (!company_id) throw new Error('company_id is required')
    return taskRepository.getArchivedTasksByCompany(company_id)
  },

  // UC28 Set Task Dependencies — reorders the sub-tasks of a parent task so each one must
  // be completed before the next starts. sub_task_ids must be the full, reordered set of
  // the parent's existing sub-tasks (drag-to-reorder result from the UI).
  async reorderSubTasks(parentTaskId: string, subTaskIds: string[], actingUserId?: string | null): Promise<Task[]> {
    if (!parentTaskId) throw new Error('Task id is required')
    if (!Array.isArray(subTaskIds)) throw new Error('sub_task_ids must be an array')
    await assertIsTaskOwner(parentTaskId, actingUserId)
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

  // UC21 — workload is weighted by priority x deadline urgency for top-level tasks only. Sub-tasks
  // are execution steps of their parent, so counting them separately would inflate the parent's
  // workload just because it was broken down. Rebalancing is department-scoped; each department's
  // manager pool starts at score 0 so managers with no active tasks can be recommended. A user
  // must have at least two active main tasks before we suggest moving one away; moving their only
  // task is not a meaningful rebalance.
  async getWorkloadRebalancingSuggestion(company_id: string, department_id?: string): Promise<TaskWorkloadSuggestion> {
    const activeTasks = (await taskRepository.getTasksByCompany(company_id))
      .filter(task => task.status !== 'Complete' && task.parent_task_id === null && task.assigned_user_id)
      .filter(task => !department_id || task.department_id === department_id)

    const departmentIds = department_id ? [department_id] : [...new Set(activeTasks.map(task => task.department_id))]

    let worst: TaskWorkloadSuggestion | null = null
    let worstGap = 0
    for (const deptId of departmentIds) {
      const scores = new Map<string, number>()
      const taskCounts = new Map<string, number>()
      const managers = await taskRepository.getManagersByDepartment(company_id, deptId)
      for (const manager of managers) scores.set(manager.id, 0)

      for (const task of activeTasks) {
        if (task.department_id !== deptId) continue
        scores.set(task.assigned_user_id!, (scores.get(task.assigned_user_id!) ?? 0) + taskWorkloadWeight(task))
        taskCounts.set(task.assigned_user_id!, (taskCounts.get(task.assigned_user_id!) ?? 0) + 1)
      }
      if (scores.size < 2) continue

      // Compared against the lightest-loaded person, not the group average — averaging in the
      // overloaded person's own score pulls the average up toward them, which (with only two
      // people) makes "overloaded > 2x average" algebraically impossible to ever trigger.
      const ranked = [...scores.entries()].sort((a, b) => b[1] - a[1])
      const [overloaded_user_id, overloaded_score] = ranked[0]
      if ((taskCounts.get(overloaded_user_id) ?? 0) < 2) continue

      let suggestedTask: Task | undefined
      let recommended_user_id = ''
      let recommended_score = 0
      const movableTasks = activeTasks
        .filter(task => task.department_id === deptId && task.assigned_user_id === overloaded_user_id)
        .sort((a, b) => taskWorkloadWeight(b) - taskWorkloadWeight(a))
      for (const [candidateUserId, candidateScore] of ranked.slice(1).reverse()) {
        if (overloaded_score <= candidateScore * 2) continue
        for (const task of movableTasks) {
          if (!task.task_date || await taskRepository.hasShiftOnDate(candidateUserId, company_id, task.task_date)) {
            recommended_user_id = candidateUserId
            recommended_score = candidateScore
            suggestedTask = task
            break
          }
        }
        if (suggestedTask) break
      }
      if (!suggestedTask) continue

      const gap = overloaded_score - recommended_score
      if (gap <= worstGap) continue
      worst = {
        type: 'rebalance',
        message: `Move one active task from ${overloaded_user_id} to ${recommended_user_id}.`,
        department_id: deptId,
        overloaded_user_id,
        recommended_user_id,
        suggested_task_id: suggestedTask.id,
        suggested_task_title: suggestedTask.title,
        overloaded_score,
        recommended_score,
      }
      worstGap = gap
    }

    return worst ?? { type: 'balanced', message: 'Workload is currently balanced across assigned users.' }
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

  // UC22 — flags a top-level task once the time elapsed since it was assigned (created_at) exceeds 50% of
  // its total assigned-to-deadline window, as long as it hasn't reached Review yet. A task already
  // in Review or Complete is past the point this alert is meant to catch, so it's excluded
  // regardless of how much time has elapsed.
  async getStalledTaskAlerts(company_id: string, department_id?: string): Promise<StalledTaskAlert[]> {
    const now = Date.now()
    return (await taskRepository.getTasksByCompany(company_id))
      .filter(task => task.status === 'Assigned' || task.status === 'In Progress')
      .filter(task => task.parent_task_id === null)
      .filter(task => !department_id || task.department_id === department_id)
      .map(task => {
        const createdAt = new Date(task.created_at).getTime()
        const dueAt = new Date(task.due_at!).getTime()
        const totalWindow = dueAt - createdAt
        const percentElapsed = totalWindow > 0 ? ((now - createdAt) / totalWindow) * 100 : 100
        return { task, percentElapsed }
      })
      .filter(row => row.percentElapsed > 50)
      .map(row => ({
        task_id: row.task.id,
        title: row.task.title,
        status: row.task.status,
        percent_elapsed: Math.round(row.percentElapsed),
        message: row.percentElapsed >= 100
          ? `"${row.task.title}" is past its deadline and hasn't moved to Review.`
          : `"${row.task.title}" is past the halfway point to its deadline and hasn't moved to Review.`,
      }))
  },

}

const PRIORITY_WEIGHT: Record<string, number> = { Urgent: 4, High: 3, Medium: 2, Low: 1 }

// UC21 — a task's weight is priority x deadline urgency, so an urgent, overdue task outweighs
// several low-priority tasks with plenty of time left, instead of every task counting as "1".
function taskWorkloadWeight(task: Task): number {
  const priorityWeight = PRIORITY_WEIGHT[task.priority ?? 'Medium'] ?? PRIORITY_WEIGHT.Medium
  return priorityWeight * deadlineUrgencyWeight(task.due_at)
}

function deadlineUrgencyWeight(due_at: string | null): number {
  if (!due_at) return 1
  const hoursRemaining = (new Date(due_at).getTime() - Date.now()) / (60 * 60 * 1000)
  if (hoursRemaining < 0) return 4   // overdue
  if (hoursRemaining <= 24) return 3 // due within a day
  if (hoursRemaining <= 72) return 2 // due within 3 days
  return 1                            // plenty of time
}

// Only the user who originally assigned a task may edit, delete, archive, duplicate, extend its
// recurrence, reorder its sub-tasks, or add new sub-tasks to it. Everyone else (including the
// assignee) has view-only access.
async function assertIsTaskOwner(taskId: string, actingUserId?: string | null): Promise<Task> {
  const task = await taskRepository.getTaskById(taskId)
  if (!actingUserId || task.assigned_by !== actingUserId) {
    throw new Error('Only the user who assigned this task can perform this action')
  }
  return task
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
      if (input.task_date) {
        const hasShift = await taskRepository.hasShiftOnDate(assignee.id, input.company_id, input.task_date)
        if (!hasShift) {
          throw new Error('Selected manager does not have a shift on the task date')
        }
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
