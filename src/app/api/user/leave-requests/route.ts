// LAYER: Controller
// RULE: Only handles request/response. No business logic. No DB access.

import { NextRequest, NextResponse } from 'next/server'
import { availabilityService } from '@/services/user/availabilityService'

export async function GET(req: NextRequest) {
  const user_id = req.nextUrl.searchParams.get('user_id')
  if (!user_id) return NextResponse.json({ success: false, message: 'user_id is required' }, { status: 400 })
  try {
    const requests = await availabilityService.getBreakWaiverRequests(user_id)
    return NextResponse.json({ success: true, requests })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch break waiver requests'
    return NextResponse.json({ success: false, message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ success: false, message: 'Invalid JSON body' }, { status: 400 })
  }
  const b = body as Record<string, unknown>
  if (typeof b.user_id !== 'string' || !b.user_id)
    return NextResponse.json({ success: false, message: 'user_id is required' }, { status: 400 })
  if (typeof b.company_id !== 'string' || !b.company_id)
    return NextResponse.json({ success: false, message: 'company_id is required' }, { status: 400 })
  if (typeof b.request_type !== 'string' || !b.request_type)
    return NextResponse.json({ success: false, message: 'request_type is required' }, { status: 400 })

  try {
    const request = await availabilityService.submitBreakWaiverRequest({
      user_id: b.user_id,
      company_id: b.company_id,
      request_type: b.request_type,
      reason: typeof b.reason === 'string' ? b.reason : null,
      shift_assignment_id: typeof b.shift_assignment_id === 'string' ? b.shift_assignment_id : null,
    })
    return NextResponse.json({ success: true, request })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to submit break waiver request'
    return NextResponse.json({ success: false, message }, { status: 500 })
  }
}
