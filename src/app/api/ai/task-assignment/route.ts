// LAYER: Controller
// RULE: Only handles request/response. No business logic. No DB access.

import { NextRequest, NextResponse } from 'next/server'
import { taskAssignmentService, AssignmentCandidate } from '@/services/owner/taskAssignmentService'

export async function POST(req: NextRequest) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ success: false, message: 'Invalid JSON body' }, { status: 400 })
  }

  const b = body as Record<string, unknown>
  if (typeof b.task_title !== 'string' || !b.task_title.trim()) {
    return NextResponse.json({ success: false, message: 'task_title is required' }, { status: 400 })
  }
  if (!Array.isArray(b.candidates) || (b.candidates as unknown[]).length === 0) {
    return NextResponse.json({ success: false, message: 'candidates array is required' }, { status: 400 })
  }

  try {
    const draft = await taskAssignmentService.recommendAssignee({
      task_title:       b.task_title as string,
      task_description: (b.task_description as string | null) ?? null,
      task_priority:    (b.task_priority as string | null) ?? null,
      department_name:  (b.department_name as string | null) ?? null,
      candidates:       b.candidates as AssignmentCandidate[],
    })
    return NextResponse.json({ success: true, draft })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to get assignment recommendation'
    return NextResponse.json({ success: false, message }, { status: 500 })
  }
}
