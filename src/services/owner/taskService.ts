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
  TaskDelayAlert,
  TaskDelayAlertSettings,
} from '@/types/Task'
import { User } from '@/types/auth.types'

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
    // A task belongs to exactly one assignee. assigned_user_ids is still accepted as a
    // single-element alias for assigned_user_id, but 2+ ids are rejected here so the rule holds
    // even for callers that bypass the UI and hit the API directly.
    const assigneeIds = input.assigned_user_ids?.filter(Boolean) ?? []
    if (assigneeIds.length > 1) {
      throw new Error('A task can only be assigned to one person')
    }
    if (assigneeIds.length === 1) {
      input = { ...input, assigned_user_id: assigneeIds[0] }
    }
    if (!input.assigned_user_id && !input.parent_task_id) {
      throw new Error('A task must be assigned to a user')
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
      // in UI and recurrence flows. They are not scored separately for workload/delay alerts.
      // They also inherit the parent's assignee when none is given, so a sub-task never ends up
      // unassigned even though the assignee-required check above only covers top-level tasks.
      input = { ...input, priority: parent.priority, due_at: parent.due_at, assigned_user_id: input.assigned_user_id ?? parent.assigned_user_id }
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
        // AI-distributed sub-tasks (UC20) carry their own assignee/due_at per step; manually
        // created sub-tasks (UC19) have neither, so they inherit the parent's values.
        assigned_user_id: subTasks[i].assigned_user_id ?? mainTask.assigned_user_id,
        assigned_by: mainTask.assigned_by,
        status: 'Assigned',
        percentage_complete: 0,
        task_date: mainTask.task_date,
        priority: mainTask.priority,
        due_at: subTasks[i].due_at ?? mainTask.due_at,
      })
    }
    return mainTask
  },

  async editTask(id: string, input: Partial<TaskInput>, actingUserId?: string | null): Promise<Task> {
    if (!id) throw new Error('Task id is required')
    const existing = await assertIsTaskOwner(id, actingUserId)
    // Same single-assignee rule as assignTask — assigned_user_ids is only a one-element alias
    // for assigned_user_id, and an edit can reassign the task but never unassign it.
    const assigneeIds = input.assigned_user_ids?.filter(Boolean) ?? null
    if (assigneeIds && assigneeIds.length > 1) {
      throw new Error('A task can only be assigned to one person')
    }
    if (assigneeIds) {
      input = { ...input, assigned_user_id: assigneeIds[0] ?? null }
    }
    if (existing.parent_task_id === null && input.assigned_user_id === null) {
      throw new Error('A task must be assigned to a user')
    }
    const mergedInput = {
      ...existing,
      ...input,
      company_id: input.company_id ?? existing.company_id,
      department_id: input.department_id ?? existing.department_id,
      title: input.title ?? existing.title,
    }
    await validateTaskAssignment(mergedInput)
    if (input.status && !VALID_STATUSES.includes(input.status as typeof VALID_STATUSES[number])) {
      throw new Error(`status must be one of: ${VALID_STATUSES.join(', ')}`)
    }
    if (input.percentage_complete !== undefined) {
      if (input.percentage_complete < 0 || input.percentage_complete > 100) {
        throw new Error('percentage_complete must be between 0 and 100')
      }
    }
    const updated = await taskRepository.updateTask(id, input, actingUserId)
    // A new deadline is a new delay window — un-dismiss the Task Delay Alert for every viewer
    // who had acknowledged it, so it can re-fire for all of them.
    if (input.due_at !== undefined && input.due_at !== existing.due_at) {
      await taskRepository.clearDelayAlertReads(id)
    }
    if (existing.parent_task_id === null) {
      const cascade: Partial<TaskInput> = {}
      if (input.assigned_user_id !== undefined && input.assigned_user_id !== existing.assigned_user_id) {
        cascade.assigned_user_id = input.assigned_user_id
      }
      // Sub-tasks mirror the parent's priority/deadline/start date (see assignTask) — keep them
      // in sync whenever the parent's own values change, not just at creation time.
      if (input.priority !== undefined && input.priority !== existing.priority) {
        cascade.priority = input.priority
      }
      if (input.due_at !== undefined && input.due_at !== existing.due_at) {
        cascade.due_at = input.due_at
      }
      if (input.task_date !== undefined && input.task_date !== existing.task_date) {
        cascade.task_date = input.task_date
      }
      if (Object.keys(cascade).length > 0) {
        await taskRepository.updateSubTasksByParent(id, cascade)
      }
    }
    return updated
  },

  // UC21 follow-through — applying a Workload Rebalancing suggestion is a company-wide,
  // algorithmically-computed reassignment, not a manual edit, so it uses peer authorization
  // (assertCanApplyWorkloadSuggestion) instead of the strict assigner-only editTask path.
  async applyWorkloadSuggestionReassignment(id: string, newAssigneeId: string, actingUserId?: string | null): Promise<Task> {
    if (!id) throw new Error('Task id is required')
    if (!newAssigneeId) throw new Error('assigned_user_id is required')
    const existing = await assertCanApplyWorkloadSuggestion(id, actingUserId)
    if (existing.parent_task_id !== null) throw new Error('Only a top-level task can be reassigned this way')
    await validateTaskAssignment({ ...existing, assigned_user_id: newAssigneeId })
    const updated = await taskRepository.updateTask(id, { assigned_user_id: newAssigneeId }, actingUserId)
    if (newAssigneeId !== existing.assigned_user_id) {
      await taskRepository.updateSubTasksByParent(id, { assigned_user_id: newAssigneeId })
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

    // due_at encodes a LOCAL wall-clock deadline (see moveIsoDate below) — take its local
    // calendar date, not the UTC slice, or early-morning deadlines anchor a day early.
    const baseDate = original.task_date ?? (original.due_at ? formatDateKey(new Date(original.due_at)) : undefined)
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
      // Task assignment is independent of shift scheduling (see assignTask/editTask) — every
      // occurrence keeps the original's assignee regardless of whether they have a shift on
      // that occurrence's date.
      const occurrenceAssigneeId = original.assigned_user_id
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
    // Review is the assigner's checkpoint: once the assignee submits work there, the only ways
    // out are approveTask (→ Complete) or rejectTask (→ In Progress with a reason). The drag
    // path can therefore never move a Review card, and can never reach Complete on its own.
    const existing = await taskRepository.getTaskById(id)
    if (existing.status === 'Review') {
      throw new Error('Tasks in Review can only be approved or rejected by the user who assigned them')
    }
    if (status === 'Complete') {
      throw new Error('Tasks reach Complete only when the user who assigned them approves the review')
    }
    return taskRepository.updateTask(id, { status, percentage_complete })
  },

  // Assigner's sign-off on a task the assignee submitted for Review — the only way a task
  // reaches Complete. Clears any earlier rejection so the rework notice disappears.
  async approveTask(id: string, actingUserId?: string | null): Promise<Task> {
    if (!id) throw new Error('Task id is required')
    const task = await assertIsTaskOwner(id, actingUserId)
    if (task.status !== 'Review') throw new Error('Only tasks in Review can be approved')
    const updated = await taskRepository.updateTask(id, {
      status: 'Complete',
      percentage_complete: 100,
      rejection_reason: null,
      rejected_at: null,
      completed_at: new Date().toISOString(),
      reviewed_by: actingUserId,
    })
    await taskRepository.updateSubTasksByParent(id, { status: 'Complete', percentage_complete: 100 })
    return updated
  },

  // Assigner found problems in the submitted work — the task returns to In Progress carrying a
  // required reason, which the assignee's board surfaces as a rework notice until re-submission.
  async rejectTask(id: string, reason: string, actingUserId?: string | null): Promise<Task> {
    if (!id) throw new Error('Task id is required')
    if (!reason?.trim()) throw new Error('A rejection reason is required')
    const task = await assertIsTaskOwner(id, actingUserId)
    if (task.status !== 'Review') throw new Error('Only tasks in Review can be rejected')
    const updated = await taskRepository.updateTask(id, {
      status: 'In Progress',
      percentage_complete: 33,
      rejection_reason: reason.trim(),
      rejected_at: new Date().toISOString(),
    })
    await taskRepository.updateSubTasksByParent(id, { status: 'In Progress', percentage_complete: 33 })
    return updated
  },

  // To-do checkbox for a sub-task — only meaningful while the parent is In Progress (the work is
  // actually happening), only the parent's assignee may tick it (the person doing the work, same
  // permission as dragging the parent's Kanban card), and only in sequence_order — the previous
  // sub-task must already be ticked before the next one can be. Ticking the last sub-task in the
  // chain auto-promotes the parent and every sub-task to Review, mirroring the one-step-forward
  // drag-and-drop move.
  async completeSubTask(subTaskId: string, actingUserId?: string | null): Promise<Task[]> {
    if (!subTaskId) throw new Error('Sub-task id is required')
    const subTask = await taskRepository.getTaskById(subTaskId)
    if (!subTask.parent_task_id) throw new Error('Task is not a sub-task')
    const parent = await taskRepository.getTaskById(subTask.parent_task_id)
    const parentAssigneeIds = parent.assigned_user_ids ?? (parent.assigned_user_id ? [parent.assigned_user_id] : [])
    if (!actingUserId || !parentAssigneeIds.includes(actingUserId)) {
      throw new Error('Only a user assigned to this task can complete its sub-tasks')
    }
    if (parent.status !== 'In Progress') {
      throw new Error('Sub-tasks can only be completed while the task is In Progress')
    }
    if (subTask.is_completed) return [subTask, parent]

    const siblings = await taskRepository.getSubTasks(parent.id)
    const ordered = [...siblings].sort((a, b) => (a.sequence_order ?? 0) - (b.sequence_order ?? 0))
    const index = ordered.findIndex(t => t.id === subTaskId)
    if (index === -1) throw new Error('Sub-task does not belong to this task')
    const priorIncomplete = ordered.slice(0, index).some(t => !t.is_completed)
    if (priorIncomplete) throw new Error('Complete the previous sub-tasks first')

    const updatedSubTask = await taskRepository.updateTask(subTaskId, { is_completed: true })
    const allComplete = ordered.every((t, i) => i === index ? true : t.is_completed)
    if (!allComplete) return [updatedSubTask, parent]

    const updatedParent = await taskRepository.updateTask(parent.id, { status: 'Review', percentage_complete: 66 })
    await taskRepository.updateSubTasksByParent(parent.id, { status: 'Review', percentage_complete: 66 })
    return [updatedSubTask, updatedParent]
  },

  // A Manager's own department membership plus every peer Manager sharing at least one of those
  // departments — this is the correctness boundary for "Manager Tasks page shows tasks created by
  // any manager collaboratively managing the same team" without leaking a peer's OTHER, unrelated
  // department (see department_ids on getTasksByCompany). Falls back to [manager_id] alone when the
  // manager has no department yet, so an unassigned manager sees nothing rather than the company.
  async getManagerTeamScope(company_id: string, manager_id: string): Promise<{ departmentIds: string[]; managerIds: string[] }> {
    const departmentIds = await taskRepository.getManagerDepartmentIds(manager_id, company_id)
    if (departmentIds.length === 0) return { departmentIds: [], managerIds: [manager_id] }
    const peers = await taskRepository.getManagersByDepartmentIds(company_id, departmentIds)
    const managerIds = peers.length > 0 ? peers.map(p => p.id) : [manager_id]
    return { departmentIds, managerIds }
  },

  async getKanbanTasks(company_id: string, assigned_by?: string | string[], department_ids?: string[], viewer_user_id?: string): Promise<KanbanGroup> {
    const tasks = await attachDelayAlertReadState(
      await taskRepository.getTasksByCompany(company_id, assigned_by, department_ids),
      viewer_user_id,
    )
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
      // due_at encodes a LOCAL wall-clock deadline — bucket it by its local calendar date,
      // not the UTC slice, or early-morning deadlines land on the previous day's cell.
      .map(task => ({ ...task, calendar_date: task.task_date ?? (task.due_at ? formatDateKey(new Date(task.due_at)) : '') }))
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
  async getWorkloadRebalancingSuggestions(
    company_id: string,
    department_id?: string,
    assigned_by?: string | string[],
    scopeDepartmentIds?: string[],
    candidateRole: 'Manager' | 'Employee' = 'Manager',
  ): Promise<TaskWorkloadSuggestion[]> {
    const activeTasks = (await taskRepository.getTasksByCompany(company_id, assigned_by, scopeDepartmentIds))
      .filter(task => task.status !== 'Complete' && task.parent_task_id === null && task.assigned_user_id)
      .filter(task => !department_id || task.department_id === department_id)

    const departmentIds = department_id ? [department_id] : [...new Set(activeTasks.map(task => task.department_id))]

    // One shift-eligibility lookup per (user, date) pair for the whole computation — the naive
    // per-candidate-per-task await chain is what made this endpoint visibly slower than the
    // locally-derived Task Delay Alert.
    const shiftOnDateCache = new Map<string, Promise<boolean>>()
    const hasShiftOnDateCached = (userId: string, date: string): Promise<boolean> => {
      const key = `${userId}|${date}`
      let hit = shiftOnDateCache.get(key)
      if (!hit) { hit = taskRepository.hasShiftOnDate(userId, company_id, date); shiftOnDateCache.set(key, hit) }
      return hit
    }

    const suggestionsByDept = await Promise.all(departmentIds.map(async (deptId): Promise<TaskWorkloadSuggestion | null> => {
      const scores = new Map<string, number>()
      const taskCounts = new Map<string, number>()
      const candidates = candidateRole === 'Employee'
        ? await taskRepository.getEmployeesByDepartment(company_id, deptId)
        : await taskRepository.getManagersByDepartment(company_id, deptId)
      for (const candidate of candidates) scores.set(candidate.id, 0)

      for (const task of activeTasks) {
        if (task.department_id !== deptId) continue
        scores.set(task.assigned_user_id!, (scores.get(task.assigned_user_id!) ?? 0) + taskWorkloadWeight(task))
        taskCounts.set(task.assigned_user_id!, (taskCounts.get(task.assigned_user_id!) ?? 0) + 1)
      }
      if (scores.size < 2) return null

      // Compared against the lightest-loaded person, not the group average — averaging in the
      // overloaded person's own score pulls the average up toward them, which (with only two
      // people) makes "overloaded > 2x average" algebraically impossible to ever trigger.
      const ranked = [...scores.entries()].sort((a, b) => b[1] - a[1])
      const [overloaded_user_id, overloaded_score] = ranked[0]
      if ((taskCounts.get(overloaded_user_id) ?? 0) < 2) return null

      let suggestedTask: Task | undefined
      let recommended_user_id = ''
      let recommended_score = 0
      let bestPostSpread = Number.POSITIVE_INFINITY
      const currentSpread = ranked[0][1] - ranked[ranked.length - 1][1]
      // Never suggest moving a task that is already in Review (the work is done, awaiting the
      // assigner's sign-off) or one carrying a rejection (rework) — only the original assignee
      // has the context to redo a rejected task, so it must stay with them.
      const movableTasks = activeTasks
        .filter(task => task.department_id === deptId && task.assigned_user_id === overloaded_user_id)
        .filter(task => task.status !== 'Review' && !task.rejection_reason)
        .sort((a, b) => taskWorkloadWeight(b) - taskWorkloadWeight(a))
      for (const [candidateUserId, candidateScore] of ranked.slice(1).reverse()) {
        if (overloaded_score <= candidateScore * 2) continue
        for (const task of movableTasks) {
          if (task.task_date && !(await hasShiftOnDateCached(candidateUserId, task.task_date))) continue
          const taskWeight = taskWorkloadWeight(task)
          const postScores = new Map(scores)
          postScores.set(overloaded_user_id, overloaded_score - taskWeight)
          postScores.set(candidateUserId, candidateScore + taskWeight)
          const postRanked = [...postScores.values()].sort((a, b) => b - a)
          const postSpread = postRanked[0] - postRanked[postRanked.length - 1]
          if (postSpread < currentSpread && postSpread < bestPostSpread) {
            recommended_user_id = candidateUserId
            recommended_score = candidateScore
            suggestedTask = task
            bestPostSpread = postSpread
          }
        }
      }
      if (!suggestedTask) return null

      const improvement = currentSpread - bestPostSpread
      if (improvement <= 0) return null
      return {
        type: 'rebalance',
        message: `Move one active task from ${overloaded_user_id} to ${recommended_user_id}.`,
        department_id: deptId,
        overloaded_user_id,
        recommended_user_id,
        suggested_task_id: suggestedTask.id,
        suggested_task_title: suggestedTask.title,
        reason: `This move reduces the workload score gap from ${currentSpread} to ${bestPostSpread}.`,
        score_gap_before: currentSpread,
        score_gap_after: bestPostSpread,
        overloaded_score,
        recommended_score,
      } satisfies TaskWorkloadSuggestion
    }))

    return suggestionsByDept.filter((s): s is TaskWorkloadSuggestion => s !== null)
  },

  async getWorkloadRebalancingSuggestion(company_id: string, department_id?: string): Promise<TaskWorkloadSuggestion> {
    const suggestions = await this.getWorkloadRebalancingSuggestions(company_id, department_id)
    return suggestions
      .sort((a, b) => (b.score_gap_before ?? 0) - (b.score_gap_after ?? 0) - ((a.score_gap_before ?? 0) - (a.score_gap_after ?? 0)))[0]
      ?? { type: 'balanced', message: 'Workload is currently balanced across assigned users.' }
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

  // UC22 Task Delay Alert — flags a top-level task that is still sitting in Assigned (the
  // assignee never pulled it into In Progress) once the time elapsed since assignment
  // (created_at) exceeds the company's threshold percentage of the total assigned-to-deadline
  // window. Threshold is configurable per company (default 50). A task already In Progress is
  // being worked on, so it never triggers this alert.
  async getTaskDelayAlerts(company_id: string, department_id?: string, assigned_by?: string | string[], scopeDepartmentIds?: string[], viewer_user_id?: string): Promise<TaskDelayAlert[]> {
    const now = Date.now()
    const { threshold_percent } = await this.getTaskDelayThreshold(company_id)
    const readTaskIds = viewer_user_id ? await taskRepository.getDelayAlertReadsByUser(viewer_user_id) : new Map<string, string>()
    return (await taskRepository.getTasksByCompany(company_id, assigned_by, scopeDepartmentIds))
      .filter(task => task.status === 'Assigned')
      .filter(task => task.parent_task_id === null)
      .filter(task => !!task.due_at)
      // Marked as read by this viewer specifically — stays dismissed for them until the deadline
      // changes. A peer viewer (e.g. the other Owner/Partner) who hasn't read it still sees it.
      .filter(task => !readTaskIds.has(task.id))
      .filter(task => !department_id || task.department_id === department_id)
      .map(task => {
        const createdAt = new Date(task.created_at).getTime()
        const dueAt = new Date(task.due_at!).getTime()
        const totalWindow = dueAt - createdAt
        const percentElapsed = totalWindow > 0 ? ((now - createdAt) / totalWindow) * 100 : 100
        return { task, percentElapsed }
      })
      .filter(row => row.percentElapsed > threshold_percent)
      .map(row => ({
        task_id: row.task.id,
        title: row.task.title,
        status: row.task.status,
        percent_elapsed: Math.round(row.percentElapsed),
        message: row.percentElapsed >= 100
          ? `"${row.task.title}" is past its deadline and still hasn't been started.`
          : `"${row.task.title}" has used ${Math.round(row.percentElapsed)}% of its time before the deadline and still hasn't been started.`,
      }))
  },

  async getTaskDelayThreshold(company_id: string): Promise<TaskDelayAlertSettings> {
    if (!company_id) throw new Error('company_id is required')
    const stored = await taskRepository.getTaskDelayThreshold(company_id)
    return { threshold_percent: stored ?? 50 }
  },

  async updateTaskDelayThreshold(company_id: string, threshold_percent: number, updated_by?: string | null): Promise<TaskDelayAlertSettings> {
    if (!company_id) throw new Error('company_id is required')
    if (!Number.isInteger(threshold_percent) || threshold_percent < 1 || threshold_percent > 100) {
      throw new Error('threshold_percent must be an integer between 1 and 100')
    }
    await taskRepository.upsertTaskDelayThreshold(company_id, threshold_percent, updated_by ?? null)
    return { threshold_percent }
  },

  // "Mark as read" on the Task Delay Alert — only for the viewer who clicked it (Owner and
  // Partner are peers who each see the same tasks but dismiss independently). A task that
  // becomes delayed later, or whose deadline changes, still alerts again for everyone.
  async markTaskDelayAlertsRead(task_ids: string[], user_id?: string | null): Promise<void> {
    if (!Array.isArray(task_ids) || task_ids.length === 0) throw new Error('task_ids is required')
    if (task_ids.some(id => typeof id !== 'string' || !id)) throw new Error('task_ids must be non-empty strings')
    if (!user_id) throw new Error('user_id is required')
    await taskRepository.markDelayAlertsRead(task_ids, user_id)
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

// The user who originally assigned a task may edit, delete, archive, duplicate, extend its
// recurrence, reorder its sub-tasks, add new sub-tasks to it, or approve/reject its Review
// submission. Owner and Partner are peer "assigner" roles (a Partner is effectively a backup
// Owner) — same cross-management the Shifts page already gives them over each other's shifts —
// so either may also act on a task the OTHER one assigned. Manager/Employee assigners are
// unaffected: still assigner-only, no peer widening.
async function assertIsTaskOwner(taskId: string, actingUserId?: string | null): Promise<Task> {
  const task = await taskRepository.getTaskById(taskId)
  if (!actingUserId) {
    throw new Error('Only the user who assigned this task can perform this action')
  }
  if (task.assigned_by === actingUserId) return task
  if (task.assigned_by) {
    const [actingUser, assigner] = await Promise.all([
      taskRepository.getUserById(actingUserId),
      taskRepository.getUserById(task.assigned_by),
    ])
    const ownerPartner = ['Owner', 'Partner']
    if (
      actingUser && assigner &&
      actingUser.company_id === assigner.company_id &&
      ownerPartner.includes(actingUser.role) &&
      ownerPartner.includes(assigner.role)
    ) {
      return task
    }
  }
  throw new Error('Only the user who assigned this task can perform this action')
}

// Maps each task's per-viewer Task Delay Alert read state onto it — a no-op (all nulls) when no
// viewer_user_id is given, since some callers (e.g. calendar/reassignment lookups) don't care.
async function attachDelayAlertReadState(tasks: Task[], viewer_user_id?: string): Promise<Task[]> {
  if (!viewer_user_id) return tasks
  const reads = await taskRepository.getDelayAlertReadsByUser(viewer_user_id)
  return tasks.map(t => ({ ...t, delay_alert_read_at: reads.get(t.id) ?? null }))
}

// Owner and Partner are peer "assigner" roles over the same Manager tier (mirrors the Kanban
// visibility scope in TasksView.tsx's fetchKanban / ownerDashboardService) — a company-wide,
// algorithmically-suggested action like Workload Rebalancing may be applied by either peer, even
// onto a task the OTHER one assigned. This is intentionally narrower than a full ownership bypass:
// manual edit/delete/archive/duplicate stay assigner-only via assertIsTaskOwner above.
async function assertCanApplyWorkloadSuggestion(taskId: string, actingUserId?: string | null): Promise<Task> {
  const task = await taskRepository.getTaskById(taskId)
  if (!actingUserId) throw new Error('Only a peer of the assigner can apply this suggestion')
  if (task.assigned_by === actingUserId) return task
  if (!task.assigned_by) throw new Error('Only a peer of the assigner can apply this suggestion')
  const [actingUser, assigner] = await Promise.all([
    taskRepository.getUserById(actingUserId),
    taskRepository.getUserById(task.assigned_by),
  ])
  if (!actingUser || !assigner || actingUser.company_id !== assigner.company_id) {
    throw new Error('Only a peer of the assigner can apply this suggestion')
  }
  const ownerPartner = ['Owner', 'Partner']
  if (ownerPartner.includes(actingUser.role) && ownerPartner.includes(assigner.role)) return task
  if (actingUser.role === 'Manager' && assigner.role === 'Manager') {
    const scope = await taskService.getManagerTeamScope(task.company_id, actingUserId)
    if (scope.managerIds.includes(assigner.id)) return task
  }
  throw new Error('Only a peer of the assigner can apply this suggestion')
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

// One assignee's worth of the Owner->Manager / Manager->Employee / Employee->CasualWorker check —
// factored out so a multi-assignee task can run the exact same check per co-assignee, not just
// the primary.
async function validateAssignee(creator: User | null, assigneeId: string, input: TaskInput): Promise<void> {
  const assignee = await taskRepository.getUserById(assigneeId)
  if (!assignee) throw new Error('Selected assignee not found')
  if (assignee.company_id !== input.company_id) throw new Error('Selected assignee does not belong to this company')

  if (!creator || creator.role === 'Owner' || creator.role === 'Partner') {
    if (assignee.role !== 'Manager') {
      throw new Error('Owner tasks can only be assigned to Managers')
    }
  } else if (creator.role === 'Manager') {
    // Strictly one level down — Casual Workers are the supervising Employee's to assign, never
    // skipped straight to from Manager.
    if (assignee.role !== 'Employee') {
      throw new Error('Manager tasks can only be assigned to Employees')
    }

    const managerDeptIds = await taskRepository.getManagerDepartmentIds(creator.id, input.company_id)
    if (!managerDeptIds.includes(input.department_id)) {
      throw new Error('Managers can only create tasks for their own departments')
    }

    const assigneeDeptIds = await taskRepository.getEmployeeDepartmentIds(assignee.id)
    if (!assigneeDeptIds.includes(input.department_id)) {
      throw new Error('Managers can only assign tasks to employees in their own department')
    }
  } else if (creator.role === 'Employee') {
    // One level down from Employee — Casual Workers, and only ones this Employee actually
    // supervises via a real shift_assignment, not any Casual Worker in the department.
    if (assignee.role !== 'Casual Worker') {
      throw new Error('Employee tasks can only be assigned to Casual Workers')
    }

    const employeeDeptIds = await taskRepository.getEmployeeDepartmentIds(creator.id)
    if (!employeeDeptIds.includes(input.department_id)) {
      throw new Error('Employees can only create tasks for their own department')
    }

    const supervisedCwIds = await taskRepository.getSupervisedCasualWorkerIds(creator.id, input.company_id, input.department_id)
    if (!supervisedCwIds.includes(assignee.id)) {
      throw new Error('Employees can only assign tasks to casual workers they supervise')
    }
  } else {
    throw new Error('This role cannot assign tasks')
  }
}

async function validateTaskAssignment(input: TaskInput): Promise<void> {
  const creator = input.assigned_by ? await taskRepository.getUserById(input.assigned_by) : null

  if (input.assigned_user_id) {
    await validateAssignee(creator, input.assigned_user_id, input)
  }

  if (input.shift_id) {
    const shift = await taskRepository.getShiftById(input.shift_id)
    if (!shift) throw new Error('Selected shift not found')
    if (shift.company_id !== input.company_id) throw new Error('Selected shift does not belong to this company')
    if (shift.department_id !== input.department_id) throw new Error('Selected shift does not belong to this department')
  }
}
