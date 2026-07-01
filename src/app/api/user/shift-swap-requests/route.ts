// LAYER: Controller
// RULE: Only handles request/response. No business logic. No DB access.

import { NextRequest, NextResponse } from 'next/server'
import { availabilityService } from '@/services/user/availabilityService'

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
  if (typeof b.requester_id !== 'string' || !b.requester_id) {
    return NextResponse.json({ success: false, message: 'requester_id is required' }, { status: 400 })
  }
  if (typeof b.requester_assignment_id !== 'string' || !b.requester_assignment_id) {
    return NextResponse.json({ success: false, message: 'requester_assignment_id is required' }, { status: 400 })
  }
  if (typeof b.counterpart_id !== 'string' || !b.counterpart_id) {
    return NextResponse.json({ success: false, message: 'counterpart_id is required' }, { status: 400 })
  }
  if (typeof b.counterpart_assignment_id !== 'string' || !b.counterpart_assignment_id) {
    return NextResponse.json({ success: false, message: 'counterpart_assignment_id is required' }, { status: 400 })
  }

  try {
    const request = await availabilityService.submitShiftSwapRequest({
      company_id: b.company_id,
      requester_id: b.requester_id,
      requester_assignment_id: b.requester_assignment_id,
      counterpart_id: b.counterpart_id,
      counterpart_assignment_id: b.counterpart_assignment_id,
      reason: typeof b.reason === 'string' ? b.reason : null,
    })
    return NextResponse.json({ success: true, request }, { status: 201 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to submit shift swap request'
    return NextResponse.json({ success: false, message }, { status: 400 })
  }
}
