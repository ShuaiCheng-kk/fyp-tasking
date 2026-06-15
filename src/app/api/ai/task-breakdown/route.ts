// LAYER: Controller
// RULE: Only handles request/response. No business logic. No DB access.

import { NextRequest, NextResponse } from 'next/server'
import { taskBreakdownService } from '@/services/owner/taskBreakdownService'

export async function POST(req: NextRequest) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ success: false, message: 'Invalid JSON body' }, { status: 400 })
  }

  const b = body as Record<string, unknown>
  if (typeof b.context !== 'string' || !b.context.trim()) {
    return NextResponse.json({ success: false, message: 'context is required' }, { status: 400 })
  }

  try {
    const draft = await taskBreakdownService.generateTasks({
      context:         b.context as string,
      shift_title:     (b.shift_title as string | null) ?? null,
      department_name: (b.department_name as string | null) ?? null,
      shift_date:      (b.shift_date as string | null) ?? null,
      start_time:      (b.start_time as string | null) ?? null,
      end_time:        (b.end_time as string | null) ?? null,
    })
    return NextResponse.json({ success: true, draft })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to generate tasks'
    return NextResponse.json({ success: false, message }, { status: 500 })
  }
}
