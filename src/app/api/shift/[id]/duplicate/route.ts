// LAYER: Controller
// RULE: Only handles request/response. No business logic. No DB access.

import { NextRequest, NextResponse } from 'next/server'
import { shiftService } from '@/services/owner/shiftService'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  if (!id) return NextResponse.json({ success: false, message: 'id is required' }, { status: 400 })

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ success: false, message: 'Invalid JSON body' }, { status: 400 })
  }

  const { shift_date, start_time, end_time, created_by, assigned_user_id, override_clopening } = body as Record<string, unknown>
  if (typeof shift_date !== 'string' || !shift_date) {
    return NextResponse.json({ success: false, message: 'shift_date is required' }, { status: 400 })
  }
  if (typeof start_time !== 'string' || !start_time) {
    return NextResponse.json({ success: false, message: 'start_time is required' }, { status: 400 })
  }
  if (typeof end_time !== 'string' || !end_time) {
    return NextResponse.json({ success: false, message: 'end_time is required' }, { status: 400 })
  }
  if (typeof created_by !== 'string' || !created_by) {
    return NextResponse.json({ success: false, message: 'created_by is required' }, { status: 400 })
  }

  try {
    const result = await shiftService.duplicateShift(id, {
      shift_date,
      start_time,
      end_time,
      created_by,
      assigned_user_id: typeof assigned_user_id === 'string' && assigned_user_id ? assigned_user_id : null,
      override_clopening: override_clopening === true,
    })
    return NextResponse.json({ success: true, shift: result.shift, warning: result.warning }, { status: 201 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to duplicate shift'
    return NextResponse.json({ success: false, message }, { status: 400 })
  }
}
