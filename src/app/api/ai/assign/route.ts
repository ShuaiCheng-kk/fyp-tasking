// LAYER: Controller
// RULE: Only handles request/response. No business logic. No DB access.

import { NextRequest, NextResponse } from 'next/server'
import { aiTaskAssignService } from '@/services/owner/aiTaskAssignService'

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
    const suggestion = await aiTaskAssignService.generateAssignmentSuggestion({
      company_id: b.company_id,
      title: b.title,
      description: (b.description as string) ?? '',
      priority: b.priority,
      people_needed: typeof b.people_needed === 'number' ? b.people_needed : 1,
      task_date: typeof b.task_date === 'string' ? b.task_date : undefined,
    })
    return NextResponse.json({ success: true, suggestion })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to generate assignment suggestion'
    return NextResponse.json({ success: false, message }, { status: 500 })
  }
}
