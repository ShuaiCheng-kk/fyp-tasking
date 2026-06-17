// LAYER: Controller
// RULE: Only handles request/response. No business logic. No DB access.

import { NextRequest, NextResponse } from 'next/server'
import { taskService } from '@/services/owner/taskService'
import { TaskInput } from '@/types/Task'

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

  if (!company_id) {
    return NextResponse.json({ success: false, message: 'company_id is required' }, { status: 400 })
  }

  try {
    if (kanban) {
      const groups = await taskService.getKanbanTasks(company_id)
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

  // Handle duplicate action
  if (b.action === 'duplicate' && typeof b.id === 'string') {
    try {
      const task = await taskService.duplicateTask(b.id, b.assigned_by as string | undefined)
      return NextResponse.json({ success: true, task }, { status: 201 })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to duplicate task'
      return NextResponse.json({ success: false, message }, { status: 400 })
    }
  }

  if (!b.company_id || typeof b.company_id !== 'string')
    return NextResponse.json({ success: false, message: 'company_id is required' }, { status: 400 })
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
    assigned_by: (b.assigned_by as string) ?? null,
    status: (b.status as TaskInput['status']) ?? 'Assigned',
    percentage_complete: typeof b.percentage_complete === 'number' ? b.percentage_complete : 0,
    priority: (b.priority as string) ?? null,
    due_at: (b.due_at as string) ?? null,
    task_date: (b.task_date as string) ?? null,
  }

  try {
    const task = await taskService.assignTask(input)
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

  // Quick status+percentage update shortcut (only when no other fields are present)
  if (b.status !== undefined && b.percentage_complete !== undefined && !b.title) {
    try {
      const task = await taskService.updateTaskStatus(
        b.id,
        b.status as 'Assigned' | 'In Progress' | 'Review' | 'Complete',
        b.percentage_complete as number,
      )
      return NextResponse.json({ success: true, task })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update task status'
      return NextResponse.json({ success: false, message }, { status: 400 })
    }
  }

  const { id, ...rest } = b
  try {
    const task = await taskService.editTask(id as string, rest as Partial<TaskInput>)
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
  try {
    await taskService.deleteTask(id)
    return NextResponse.json({ success: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to delete task'
    return NextResponse.json({ success: false, message }, { status: 500 })
  }
}
