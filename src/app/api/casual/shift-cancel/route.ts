// LAYER: Controller
// RULE: Only handles request/response. No business logic. No DB access.

import { NextRequest, NextResponse } from 'next/server'
import { casualShiftCancellationService } from '@/services/casual/casualShiftCancellationService'

export async function POST(req: NextRequest) {
  let body: { user_id?: string; shift_id?: string; reason?: string | null }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ success: false, message: 'Invalid JSON body' }, { status: 400 })
  }

  if (!body.user_id) {
    return NextResponse.json({ success: false, message: 'user_id is required' }, { status: 400 })
  }
  if (!body.shift_id) {
    return NextResponse.json({ success: false, message: 'shift_id is required' }, { status: 400 })
  }

  try {
    await casualShiftCancellationService.cancelShift({
      auth_id: body.user_id,
      shift_id: body.shift_id,
      reason: typeof body.reason === 'string' ? body.reason : null,
    })
    return NextResponse.json({ success: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to cancel shift'
    return NextResponse.json({ success: false, message }, { status: 400 })
  }
}
