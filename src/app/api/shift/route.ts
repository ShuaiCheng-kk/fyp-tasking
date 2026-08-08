// LAYER: Controller
// RULE: Only handles request/response. No business logic. No DB access.

import { NextRequest, NextResponse } from 'next/server'
import { shiftService } from '@/services/owner/shiftService'
import { ShiftInput } from '@/types/Shift'
import { getServerSessionUser } from '@/lib/serverAuth'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const company_id = searchParams.get('company_id')
  const date_from = searchParams.get('date_from')
  const date_to = searchParams.get('date_to')
  const viewer_role = searchParams.get('viewer_role') ?? undefined
  const viewer_user_id = searchParams.get('viewer_user_id') ?? undefined

  if (!company_id || !date_from || !date_to) {
    return NextResponse.json(
      { success: false, message: 'company_id, date_from, and date_to are required' },
      { status: 400 },
    )
  }

  const session = await getServerSessionUser()
  if (!session) return NextResponse.json({ success: false, message: 'Not authenticated' }, { status: 401 })
  if (session.user.company_id !== company_id) {
    return NextResponse.json({ success: false, message: 'You can only view your own company\'s schedule' }, { status: 403 })
  }

  try {
    const rows = await shiftService.getTimelineShifts(company_id, date_from, date_to, {
      role: viewer_role,
      user_id: viewer_user_id,
    })
    return NextResponse.json({ success: true, rows })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch shifts'
    return NextResponse.json({ success: false, message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ success: false, message: 'Invalid JSON body' }, { status: 400 })
  }

  const {
    company_id,
    department_id,
    shift_date,
    start_time,
    end_time,
    created_by,
    publication_status,
    assigned_user_id,
    supervisor_employee_id,
    template_id,
  } =
    body as Record<string, unknown>

  if (!company_id || typeof company_id !== 'string')
    return NextResponse.json({ success: false, message: 'company_id is required' }, { status: 400 })
  if (!department_id || typeof department_id !== 'string')
    return NextResponse.json({ success: false, message: 'department_id is required' }, { status: 400 })
  if (!shift_date || typeof shift_date !== 'string')
    return NextResponse.json({ success: false, message: 'shift_date is required' }, { status: 400 })
  if (!start_time || typeof start_time !== 'string')
    return NextResponse.json({ success: false, message: 'start_time is required' }, { status: 400 })
  if (!end_time || typeof end_time !== 'string')
    return NextResponse.json({ success: false, message: 'end_time is required' }, { status: 400 })

  const session = await getServerSessionUser()
  if (!session) return NextResponse.json({ success: false, message: 'Not authenticated' }, { status: 401 })
  if (session.user.company_id !== company_id) {
    return NextResponse.json({ success: false, message: 'You can only create shifts for your own company' }, { status: 403 })
  }

  const input: ShiftInput = {
    company_id,
    department_id,
    shift_date,
    start_time,
    end_time,
    created_by: session.user.id,
    publication_status: publication_status === 'published' ? 'published' : 'draft',
    template_id: typeof template_id === 'string' && template_id ? template_id : null,
  }
  const assignmentInput = {
    ...input,
    assigned_user_id: typeof assigned_user_id === 'string' && assigned_user_id ? assigned_user_id : null,
    supervisor_employee_id: typeof supervisor_employee_id === 'string' && supervisor_employee_id ? supervisor_employee_id : null,
  }

  try {
    const result = await shiftService.createShift(assignmentInput)
    return NextResponse.json({ success: true, shift: result.shift, warning: result.warning }, { status: 201 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to create shift'
    return NextResponse.json({ success: false, message }, { status: 400 })
  }
}
