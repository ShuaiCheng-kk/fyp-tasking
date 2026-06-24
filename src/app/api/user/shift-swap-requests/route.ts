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
  if (typeof b.shift_assignment_id !== 'string' || !b.shift_assignment_id) {
    return NextResponse.json({ success: false, message: 'shift_assignment_id is required' }, { status: 400 })
  }
  if (typeof b.requester_id !== 'string' || !b.requester_id) {
    return NextResponse.json({ success: false, message: 'requester_id is required' }, { status: 400 })
  }
  if (typeof b.replacement_user_id !== 'string' || !b.replacement_user_id) {
    return NextResponse.json({ success: false, message: 'replacement_user_id is required' }, { status: 400 })
  }

  try {
    const request = await availabilityService.submitShiftSwapRequest({
      company_id: b.company_id,
      shift_assignment_id: b.shift_assignment_id,
      requester_id: b.requester_id,
      replacement_user_id: b.replacement_user_id,
      reason: typeof b.reason === 'string' ? b.reason : null,
    })
    return NextResponse.json({ success: true, request }, { status: 201 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to submit shift swap request'
    return NextResponse.json({ success: false, message }, { status: 400 })
  }
}
