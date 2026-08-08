// LAYER: Controller
// RULE: Only handles request/response. No business logic. No DB access.

import { NextRequest, NextResponse } from 'next/server'
import { availabilityService } from '@/services/user/availabilityService'
import { getServerSessionUser } from '@/lib/serverAuth'

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
  const session = await getServerSessionUser()
  if (!session) return NextResponse.json({ success: false, message: 'Not authenticated' }, { status: 401 })
  if (session.user.company_id !== b.company_id) {
    return NextResponse.json({ success: false, message: 'You can only submit requests for your own company' }, { status: 403 })
  }

  try {
    if (
      typeof b.shift_assignment_id === 'string' &&
      typeof b.replacement_user_id === 'string'
    ) {
      const request = await availabilityService.submitLegacyShiftSwapRequest({
        company_id: b.company_id,
        requester_id: session.user.id,
        shift_assignment_id: b.shift_assignment_id,
        replacement_user_id: b.replacement_user_id,
        reason: typeof b.reason === 'string' ? b.reason : null,
      })
      return NextResponse.json({ success: true, request }, { status: 201 })
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

    const request = await availabilityService.submitShiftSwapRequest({
      company_id: b.company_id,
      requester_id: session.user.id,
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
