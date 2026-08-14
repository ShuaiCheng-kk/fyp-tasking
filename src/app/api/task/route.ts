// LAYER: Controller
// RULE: Only handles request/response. No business logic. No DB access.

import { NextRequest, NextResponse } from 'next/server'
import { taskService } from '@/services/owner/taskService'
import { TaskInput, TaskRecurrenceInput } from '@/types/Task'
import { getServerSessionUser } from '@/lib/serverAuth'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const company_id = searchParams.get('company_id')
  const status = searchParams.get('status') ?? undefined
  const department_id = searchParams.get('department_id') ?? undefined
  const shift_id = searchParams.get('shift_id') ?? undefined
  const kanban = searchParams.get('kanban') === 'true'
  const stats = searchParams.get('stats') === 'true'
  const dept_stats = searchParams.get('dept_stats') === 'true'
  const activity_feed = searchParams.get('activity_feed') === 'true'
  const calendar = searchParams.get('calendar') === 'true'
  const archived = searchParams.get('archived') === 'true'
  const delay_threshold = searchParams.get('delay_threshold') === 'true'
  const suggestion = searchParams.get('suggestion')
  const task_id = searchParams.get('task_id') ?? undefined
  const date_from = searchParams.get('date_from') ?? undefined
  const date_to = searchParams.get('date_to') ?? undefined
  const assigned_by = searchParams.get('assigned_by') ?? undefined
  // Manager Tasks page scope: resolves to "every manager sharing a department with this manager"
  // (assigned_by) plus that department set (a security-scoping filter, separate from the
  // UI-level `department_id` filter below) — see taskService.getManagerTeamScope.
  const manager_scope_id = searchParams.get('manager_scope_id') ?? undefined
  // The actual current user, distinct from assigned_by above (which for Owner/Partner is the
  // whole peer id list, not just the caller) — used to look up THIS viewer's own Task Delay
  // Alert read state so a peer's dismissal doesn't hide it for anyone else.
  const viewer_id = searchParams.get('viewer_id') ?? undefined
  // Manager Tasks page's My Tasks tab: tasks assigned TO this user (by Owner/Partner, per the
  // one-level-down assignment rule), the inverse of assigned_by/manager_scope_id above.
  const assigned_user_id = searchParams.get('assigned_user_id') ?? undefined
  // Employee Tasks page scope for the Workload Suggestion: the rebalancing candidate pool becomes
  // the Casual Workers this Employee supervises today, rather than a department roster.
  const supervisor_id = searchParams.get('supervisor_id') ?? undefined

  if (!company_id) {
    return NextResponse.json({ success: false, message: 'company_id is required' }, { status: 400 })
  }

  const session = await getServerSessionUser()
  if (!session) return NextResponse.json({ success: false, message: 'Not authenticated' }, { status: 401 })
  if (session.user.company_id !== company_id) {
    return NextResponse.json({ success: false, message: 'You can only view your own company\'s tasks' }, { status: 403 })
  }

  try {
    const managerScope = manager_scope_id ? await taskService.getManagerTeamScope(company_id, manager_scope_id) : null
    const assignedByFilter = managerScope
      ? managerScope.managerIds
      : assigned_by?.includes(',') ? assigned_by.split(',').filter(Boolean) : assigned_by

    if (kanban) {
      const groups = await taskService.getKanbanTasks(company_id, assignedByFilter, managerScope?.departmentIds, viewer_id, assigned_user_id)
      return NextResponse.json({ success: true, groups })
    }
    if (stats) {
      const taskStats = await taskService.getCompanyTaskStats(company_id)
      return NextResponse.json({ success: true, stats: taskStats })
    }
    if (dept_stats) {
      const deptStats = await taskService.getDepartmentTaskStats(company_id)
      return NextResponse.json({ success: true, dept_stats: deptStats })
    }
    if (activity_feed) {
      const feed = await taskService.getTodayActivityFeed(company_id)
      return NextResponse.json({ success: true, feed })
    }
    if (calendar) {
      const tasks = await taskService.getCalendarTasks(company_id, date_from ?? '', date_to ?? '')
      return NextResponse.json({ success: true, tasks })
    }
    if (archived) {
      const tasks = await taskService.getArchivedTasks(company_id, assignedByFilter, managerScope?.departmentIds)
      return NextResponse.json({ success: true, tasks })
    }
    if (suggestion === 'workload') {
      const suggestions = await taskService.getWorkloadRebalancingSuggestions(
        company_id,
        department_id,
        assignedByFilter,
        managerScope?.departmentIds,
        supervisor_id ? 'Casual Worker' : managerScope ? 'Employee' : 'Manager',
        supervisor_id,
      )
      return NextResponse.json({
        success: true,
        suggestions,
        suggestion: suggestions[0] ?? { type: 'balanced', message: 'Workload is currently balanced across assigned users.' },
      })
    }
    if (suggestion === 'reassignment' && task_id) {
      const reassignmentSuggestion = await taskService.getTaskReassignmentSuggestion(task_id, company_id)
      return NextResponse.json({ success: true, suggestion: reassignmentSuggestion })
    }
    if (suggestion === 'delay') {
      const alerts = await taskService.getTaskDelayAlerts(
        company_id,
        department_id,
        assignedByFilter,
        managerScope?.departmentIds,
        viewer_id,
      )
      return NextResponse.json({ success: true, alerts })
    }
    if (delay_threshold) {
      const settings = await taskService.getTaskDelayThreshold(company_id)
      return NextResponse.json({ success: true, settings })
    }
    if (shift_id) {
      const tasks = await taskService.getTasksByCompanyShift(company_id, shift_id)
      return NextResponse.json({ success: true, tasks })
    }
    const tasks = await taskService.getFilteredTasks(company_id, { status, department_id })
    return NextResponse.json({ success: true, tasks })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch tasks'
    return NextResponse.json({ success: false, message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ success: false, message: 'Invalid JSON body' }, { status: 400 })
  }

  const b = body as Record<string, unknown>

  const session = await getServerSessionUser()
  if (!session) return NextResponse.json({ success: false, message: 'Not authenticated' }, { status: 401 })

  if (b.action === 'set_delay_threshold') {
    if (!b.company_id || typeof b.company_id !== 'string')
      return NextResponse.json({ success: false, message: 'company_id is required' }, { status: 400 })
    if (session.user.company_id !== b.company_id) {
      return NextResponse.json({ success: false, message: 'You can only manage your own company\'s settings' }, { status: 403 })
    }
    try {
      const settings = await taskService.updateTaskDelayThreshold(
        b.company_id,
        Number(b.threshold_percent),
        session.user.id,
      )
      return NextResponse.json({ success: true, settings })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update delay threshold'
      return NextResponse.json({ success: false, message }, { status: 400 })
    }
  }

  if (b.action === 'mark_delay_alerts_read') {
    try {
      const task_ids = Array.isArray(b.task_ids) ? b.task_ids.filter((v): v is string => typeof v === 'string') : []
      await taskService.markTaskDelayAlertsRead(task_ids, session.user.id)
      return NextResponse.json({ success: true })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to mark delay alerts as read'
      return NextResponse.json({ success: false, message }, { status: 400 })
    }
  }

  // Handle duplicate action
  if (b.action === 'duplicate' && typeof b.id === 'string') {
    try {
      const task = await taskService.duplicateTask(b.id, session.user.id)
      return NextResponse.json({ success: true, task }, { status: 201 })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to duplicate task'
      return NextResponse.json({ success: false, message }, { status: 400 })
    }
  }

  if (b.action === 'recurring' && typeof b.id === 'string') {
    try {
      const tasks = await taskService.createRecurringTasks(b.id, {
        recurrence_rule: b.recurrence_rule as 'daily' | 'weekly' | 'custom',
        recurrence_end_date: String(b.recurrence_end_date ?? ''),
        custom_interval_days: typeof b.custom_interval_days === 'number' ? b.custom_interval_days : undefined,
        assigned_by: session.user.id,
        deadline_rule: b.deadline_rule as TaskRecurrenceInput['deadline_rule'],
      })
      return NextResponse.json({ success: true, tasks }, { status: 201 })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create recurring tasks'
      return NextResponse.json({ success: false, message }, { status: 400 })
    }
  }

  if (!b.company_id || typeof b.company_id !== 'string')
    return NextResponse.json({ success: false, message: 'company_id is required' }, { status: 400 })
  if (session.user.company_id !== b.company_id) {
    return NextResponse.json({ success: false, message: 'You can only create tasks for your own company' }, { status: 403 })
  }
  if (!b.department_id || typeof b.department_id !== 'string')
    return NextResponse.json({ success: false, message: 'department_id is required' }, { status: 400 })
  if (!b.title || typeof b.title !== 'string')
    return NextResponse.json({ success: false, message: 'title is required' }, { status: 400 })

  const input: TaskInput = {
    company_id: b.company_id,
    department_id: b.department_id,
    title: b.title,
    shift_id: (b.shift_id as string) ?? null,
    parent_task_id: (b.parent_task_id as string) ?? null,
    description: (b.description as string) ?? null,
    assigned_user_id: (b.assigned_user_id as string) ?? null,
    assigned_by: session.user.id,
    status: (b.status as TaskInput['status']) ?? 'Assigned',
    priority: (b.priority as string) ?? null,
    due_at: (b.due_at as string) ?? null,
    task_date: (b.task_date as string) ?? null,
    assigned_user_ids: Array.isArray(b.assigned_user_ids) ? b.assigned_user_ids.filter((v): v is string => typeof v === 'string') : undefined,
  }

  const subTasks = Array.isArray(b.sub_tasks)
    ? b.sub_tasks.filter((s): s is { title: string; description?: string } => !!s && typeof s.title === 'string')
    : null

  try {
    const task = subTasks
      ? await taskService.assignTaskWithSubTasks(input, subTasks)
      : await taskService.assignTask(input)
    return NextResponse.json({ success: true, task }, { status: 201 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to create task'
    return NextResponse.json({ success: false, message }, { status: 400 })
  }
}

export async function PATCH(req: NextRequest) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ success: false, message: 'Invalid JSON body' }, { status: 400 })
  }

  const b = body as Record<string, unknown>
  if (!b.id || typeof b.id !== 'string')
    return NextResponse.json({ success: false, message: 'id is required' }, { status: 400 })

  const session = await getServerSessionUser()
  if (!session) return NextResponse.json({ success: false, message: 'Not authenticated' }, { status: 401 })

  if (b.action === 'approve') {
    try {
      const task = await taskService.approveTask(b.id, session.user.id)
      return NextResponse.json({ success: true, task })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to approve task'
      return NextResponse.json({ success: false, message }, { status: 400 })
    }
  }

  if (b.action === 'apply_workload_suggestion') {
    try {
      const task = await taskService.applyWorkloadSuggestionReassignment(
        b.id,
        b.assigned_user_id as string,
        session.user.id,
      )
      return NextResponse.json({ success: true, task })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to reassign task'
      return NextResponse.json({ success: false, message }, { status: 400 })
    }
  }

  if (b.action === 'reject') {
    try {
      const task = await taskService.rejectTask(b.id, String(b.reason ?? ''), session.user.id)
      return NextResponse.json({ success: true, task })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to reject task'
      return NextResponse.json({ success: false, message }, { status: 400 })
    }
  }

  if (b.action === 'archive') {
    try {
      const task = await taskService.archiveTask(b.id, session.user.id)
      return NextResponse.json({ success: true, task })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to archive task'
      return NextResponse.json({ success: false, message }, { status: 400 })
    }
  }

  if (b.action === 'unarchive') {
    try {
      const task = await taskService.unarchiveTask(b.id, session.user.id)
      return NextResponse.json({ success: true, task })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to unarchive task'
      return NextResponse.json({ success: false, message }, { status: 400 })
    }
  }

  if (b.action === 'reorder_subtasks') {
    try {
      const subTasks = await taskService.reorderSubTasks(
        b.id,
        Array.isArray(b.sub_task_ids) ? b.sub_task_ids.map(String) : [],
        session.user.id,
      )
      return NextResponse.json({ success: true, subTasks })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to reorder sub-tasks'
      return NextResponse.json({ success: false, message }, { status: 400 })
    }
  }

  if (b.action === 'complete_subtask') {
    try {
      const [subTask, parent] = await taskService.completeSubTask(b.id, session.user.id)
      return NextResponse.json({ success: true, subTask, parent })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to complete sub-task'
      return NextResponse.json({ success: false, message }, { status: 400 })
    }
  }

  // Quick status update shortcut (only when no other fields are present)
  if (b.status !== undefined && !b.title) {
    try {
      const task = await taskService.updateTaskStatus(
        b.id,
        b.status as 'Assigned' | 'In Progress' | 'Review' | 'Complete',
        session.user.id,
      )
      return NextResponse.json({ success: true, task })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update task status'
      const status = message.includes('own company') ? 403 : 400
      return NextResponse.json({ success: false, message }, { status })
    }
  }

  const { id, assigned_by: _assigned_by, ...rest } = b
  try {
    const task = await taskService.editTask(id as string, rest as Partial<TaskInput>, session.user.id)
    return NextResponse.json({ success: true, task })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to update task'
    return NextResponse.json({ success: false, message }, { status: 400 })
  }
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) {
    return NextResponse.json({ success: false, message: 'id is required' }, { status: 400 })
  }
  const session = await getServerSessionUser()
  if (!session) return NextResponse.json({ success: false, message: 'Not authenticated' }, { status: 401 })
  try {
    await taskService.deleteTask(id, session.user.id)
    return NextResponse.json({ success: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to delete task'
    return NextResponse.json({ success: false, message }, { status: 500 })
  }
}
