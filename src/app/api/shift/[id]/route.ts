// LAYER: Controller
// RULE: Only handles request/response. No business logic. No DB access.

import { NextRequest, NextResponse } from 'next/server'
import { shiftService } from '@/services/owner/shiftService'
import { Shift } from '@/types/Shift'
import { getServerSessionUser } from '@/lib/serverAuth'

export async function PATCH(
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

  const {
    department_id,
    shift_date,
    start_time,
    end_time,
    status,
    publication_status,
    assigned_user_id,
    assigned_by,
    supervisor_employee_id,
    template_id,
  } = body as Record<string, unknown>

  const fields: Partial<Omit<Shift, 'id' | 'company_id' | 'created_by'>> = {}
  if (typeof department_id === 'string') fields.department_id = department_id
  if (typeof shift_date === 'string') fields.shift_date = shift_date
  if (typeof start_time === 'string') fields.start_time = start_time
  if (typeof end_time === 'string') fields.end_time = end_time
  if (status === 'active' || status === 'inactive') fields.status = status
  if (publication_status === 'draft' || publication_status === 'published') fields.publication_status = publication_status
  if (typeof template_id === 'string' || template_id === null) fields.template_id = template_id

  // supervisor_employee_id is only touched when the caller's body explicitly includes the key —
  // callers with no supervisor field (e.g. Bulk Edit) must leave the existing supervisor alone
  // rather than have it silently default to null on every unrelated save.
  const supervisorProvided = Object.prototype.hasOwnProperty.call(body as Record<string, unknown>, 'supervisor_employee_id')
  const assignment = assigned_user_id === undefined
    ? undefined
    : {
        assigned_user_id: typeof assigned_user_id === 'string' && assigned_user_id ? assigned_user_id : null,
        assigned_by: session.user.id,
        supervisor_employee_id: supervisorProvided
          ? (typeof supervisor_employee_id === 'string' && supervisor_employee_id ? supervisor_employee_id : null)
          : undefined,
      }

  if (assignment?.assigned_user_id && !assignment.assigned_by) {
    return NextResponse.json({ success: false, message: 'assigned_by is required when assigning a shift' }, { status: 400 })
  }

  const performedBy = typeof (body as Record<string, unknown>).performed_by === 'string'
    ? (body as Record<string, unknown>).performed_by as string
    : undefined

  try {
    const result = await shiftService.editShift(id, fields, assignment, performedBy, session.user.company_id ?? undefined)
    return NextResponse.json({ success: true, shift: result.shift, warning: result.warning })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to update shift'
    const status = message.includes('own company') ? 403 : 400
    return NextResponse.json({ success: false, message }, { status })
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  if (!id) return NextResponse.json({ success: false, message: 'id is required' }, { status: 400 })
  const session = await getServerSessionUser()
  if (!session) return NextResponse.json({ success: false, message: 'Not authenticated' }, { status: 401 })
  try {
    const result = await shiftService.deleteShift(id, session.user.id, session.user.company_id ?? undefined)
    return NextResponse.json({ success: true, skipped_shifts: result.skipped_shifts })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to delete shift'
    const status = message.includes('own company') ? 403 : 400
    return NextResponse.json({ success: false, message }, { status })
  }
}
