// LAYER: Controller
// RULE: Only handles request/response. No business logic. No DB access.

import { NextRequest, NextResponse } from 'next/server'
import { shiftService } from '@/services/owner/shiftService'
import { getServerSessionUser } from '@/lib/serverAuth'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  if (!id) return NextResponse.json({ success: false, message: 'id is required' }, { status: 400 })

  const session = await getServerSessionUser()
  if (!session) return NextResponse.json({ success: false, message: 'Not authenticated' }, { status: 401 })

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ success: false, message: 'Invalid JSON body' }, { status: 400 })
  }

  const { shift_date, start_time, end_time, assigned_user_id, template_id } = body as Record<string, unknown>
  if (typeof shift_date !== 'string' || !shift_date) {
    return NextResponse.json({ success: false, message: 'shift_date is required' }, { status: 400 })
  }
  if (typeof start_time !== 'string' || !start_time) {
    return NextResponse.json({ success: false, message: 'start_time is required' }, { status: 400 })
  }
  if (typeof end_time !== 'string' || !end_time) {
    return NextResponse.json({ success: false, message: 'end_time is required' }, { status: 400 })
  }

  try {
    const result = await shiftService.duplicateShift(id, {
      shift_date,
      start_time,
      end_time,
      created_by: session.user.id,
      assigned_user_id: typeof assigned_user_id === 'string' && assigned_user_id ? assigned_user_id : null,
      template_id: typeof template_id === 'string' && template_id ? template_id : null,
    }, session.user.company_id ?? undefined)
    return NextResponse.json({ success: true, shift: result.shift, warning: result.warning }, { status: 201 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to duplicate shift'
    const status = message.includes('own company') ? 403 : 400
    return NextResponse.json({ success: false, message }, { status })
  }
}
