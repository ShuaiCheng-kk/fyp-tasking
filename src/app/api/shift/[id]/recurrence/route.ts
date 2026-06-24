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

  const {
    recurrence_rule,
    recurrence_end_date,
    custom_interval_days,
    created_by,
    assigned_user_id,
  } = body as Record<string, unknown>

  if (recurrence_rule !== 'daily' && recurrence_rule !== 'weekly' && recurrence_rule !== 'custom') {
    return NextResponse.json({ success: false, message: 'recurrence_rule must be daily, weekly, or custom' }, { status: 400 })
  }
  if (typeof recurrence_end_date !== 'string' || !recurrence_end_date) {
    return NextResponse.json({ success: false, message: 'recurrence_end_date is required' }, { status: 400 })
  }
  if (typeof created_by !== 'string' || !created_by) {
    return NextResponse.json({ success: false, message: 'created_by is required' }, { status: 400 })
  }

  try {
    const shifts = await shiftService.createRecurringShifts(id, {
      recurrence_rule,
      recurrence_end_date,
      custom_interval_days: typeof custom_interval_days === 'number' ? custom_interval_days : undefined,
      created_by,
      assigned_user_id: typeof assigned_user_id === 'string' && assigned_user_id ? assigned_user_id : null,
    })
    return NextResponse.json({ success: true, shifts }, { status: 201 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to create recurring shifts'
    return NextResponse.json({ success: false, message }, { status: 400 })
  }
}
