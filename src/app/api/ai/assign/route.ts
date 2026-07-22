// LAYER: Controller
// RULE: Only handles request/response. No business logic. No DB access.

import { NextRequest, NextResponse } from 'next/server'
import { aiTaskAssignService } from '@/services/owner/aiTaskAssignService'
import { taskService } from '@/services/owner/taskService'

export async function POST(req: NextRequest) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ success: false, message: 'Invalid JSON body' }, { status: 400 })
  }

  const b = body as Record<string, unknown>
  if (typeof b.company_id !== 'string' || !b.company_id) {
    return NextResponse.json({ success: false, message: 'company_id is required' }, { status: 400 })
  }
  if (typeof b.title !== 'string' || !b.title.trim()) {
    return NextResponse.json({ success: false, message: 'title is required' }, { status: 400 })
  }
  if (typeof b.priority !== 'string' || !b.priority) {
    return NextResponse.json({ success: false, message: 'priority is required' }, { status: 400 })
  }

  try {
    // Manager Tasks page scope: same manager_scope_id resolution as /api/task — the AI picks
    // among this manager's own department(s)/Employees only, never guesses a different
    // department or recommends another Manager as the assignee.
    const manager_scope_id = typeof b.manager_scope_id === 'string' ? b.manager_scope_id : undefined
    const managerScope = manager_scope_id ? await taskService.getManagerTeamScope(b.company_id, manager_scope_id) : null

    const suggestion = await aiTaskAssignService.generateAssignmentSuggestion({
      company_id: b.company_id,
      title: b.title,
      description: (b.description as string) ?? '',
      priority: b.priority,
      want_sub_tasks: b.want_sub_tasks === true,
      task_date: typeof b.task_date === 'string' ? b.task_date : undefined,
      department_ids: managerScope?.departmentIds,
      candidate_role: managerScope ? 'Employee' : 'Manager',
    })
    return NextResponse.json({ success: true, suggestion })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to generate assignment suggestion'
    return NextResponse.json({ success: false, message }, { status: 500 })
  }
}
