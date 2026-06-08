// LAYER: Controller
// RULE: Only handles request/response. No business logic. No DB access.

import { NextRequest, NextResponse } from 'next/server'
import { timesheetAutoApprovalService } from '@/services/owner/timesheetAutoApprovalService'

export async function POST(req: NextRequest) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ success: false, message: 'Invalid JSON body' }, { status: 400 })
  }

  const b = body as Record<string, unknown>
  if (typeof b.company_id !== 'string') {
    return NextResponse.json({ success: false, message: 'company_id is required' }, { status: 400 })
  }

  try {
    const decisions = b.apply === true && typeof b.owner_id === 'string'
      ? await timesheetAutoApprovalService.applyAutoApprovals(b.company_id, b.owner_id)
      : await timesheetAutoApprovalService.reviewTimesheets(b.company_id)
    return NextResponse.json({ success: true, decisions })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to review timesheets'
    return NextResponse.json({ success: false, message }, { status: 500 })
  }
}
