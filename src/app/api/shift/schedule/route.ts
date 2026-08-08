// LAYER: Controller
// RULE: Only handles request/response. No business logic. No DB access.

import { NextRequest, NextResponse } from 'next/server'
import { shiftService } from '@/services/owner/shiftService'
import { getServerSessionUser } from '@/lib/serverAuth'

export async function PATCH(req: NextRequest) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ success: false, message: 'Invalid JSON body' }, { status: 400 })
  }

  const { company_id, date_from, date_to, publication_status, department_id } = body as Record<string, unknown>
  if (typeof company_id !== 'string' || !company_id) {
    return NextResponse.json({ success: false, message: 'company_id is required' }, { status: 400 })
  }
  if (typeof date_from !== 'string' || !date_from) {
    return NextResponse.json({ success: false, message: 'date_from is required' }, { status: 400 })
  }
  if (typeof date_to !== 'string' || !date_to) {
    return NextResponse.json({ success: false, message: 'date_to is required' }, { status: 400 })
  }
  if (publication_status !== 'draft' && publication_status !== 'published') {
    return NextResponse.json({ success: false, message: 'publication_status must be draft or published' }, { status: 400 })
  }

  const session = await getServerSessionUser()
  if (!session) return NextResponse.json({ success: false, message: 'Not authenticated' }, { status: 401 })
  if (session.user.company_id !== company_id) {
    return NextResponse.json({ success: false, message: 'You can only manage your own company\'s schedule' }, { status: 403 })
  }

  try {
    const result = await shiftService.publishSchedule({
      company_id,
      date_from,
      date_to,
      publication_status,
      performed_by: session.user.id,
      department_id: typeof department_id === 'string' ? department_id : undefined,
    })
    return NextResponse.json({ success: true, shifts: result.shifts })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to update schedule'
    return NextResponse.json({ success: false, message }, { status: 400 })
  }
}
