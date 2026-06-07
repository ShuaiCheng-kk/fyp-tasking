// LAYER: Controller
// RULE: Only handles request/response. No business logic. No DB access.

import { NextRequest, NextResponse } from 'next/server'
import { shiftService } from '@/services/owner/shiftService'

export async function POST(req: NextRequest) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ success: false, message: 'Invalid JSON body' }, { status: 400 })
  }

  const { company_id, actor_id } = body as Record<string, unknown>
  if (typeof company_id !== 'string' || !company_id) {
    return NextResponse.json({ success: false, message: 'company_id is required' }, { status: 400 })
  }
  if (typeof actor_id !== 'string' || !actor_id) {
    return NextResponse.json({ success: false, message: 'actor_id is required' }, { status: 400 })
  }

  try {
    await shiftService.undoLastShiftAction(company_id, actor_id)
    return NextResponse.json({ success: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to undo shift action'
    return NextResponse.json({ success: false, message }, { status: 400 })
  }
}
