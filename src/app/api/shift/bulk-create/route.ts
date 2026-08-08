// LAYER: Controller
// RULE: Only handles request/response. No business logic. No DB access.

import { NextRequest, NextResponse } from 'next/server'
import { shiftService } from '@/services/owner/shiftService'
import { BulkCreateShiftInput } from '@/types/Shift'
import { getServerSessionUser } from '@/lib/serverAuth'

export async function POST(req: NextRequest) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ success: false, message: 'Invalid JSON body' }, { status: 400 })
  }

  const { company_id, items } = body as Record<string, unknown>

  if (!company_id || typeof company_id !== 'string') {
    return NextResponse.json({ success: false, message: 'company_id is required' }, { status: 400 })
  }
  const session = await getServerSessionUser()
  if (!session) return NextResponse.json({ success: false, message: 'Not authenticated' }, { status: 401 })
  if (session.user.company_id !== company_id) {
    return NextResponse.json({ success: false, message: 'You can only manage your own company\'s shifts' }, { status: 403 })
  }
  if (!Array.isArray(items)) {
    return NextResponse.json({ success: false, message: 'items must be an array' }, { status: 400 })
  }

  const cleanedItems: BulkCreateShiftInput[] = items
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object')
    .map(item => ({
      department_id: typeof item.department_id === 'string' ? item.department_id : '',
      shift_date: typeof item.shift_date === 'string' ? item.shift_date : '',
      start_time: typeof item.start_time === 'string' ? item.start_time : '',
      end_time: typeof item.end_time === 'string' ? item.end_time : '',
      assigned_user_id: typeof item.assigned_user_id === 'string' && item.assigned_user_id ? item.assigned_user_id : null,
      template_id: typeof item.template_id === 'string' && item.template_id ? item.template_id : null,
    }))

  try {
    const result = await shiftService.createShiftsInBulk({ company_id, created_by: session.user.id, items: cleanedItems })
    return NextResponse.json({ success: true, result }, { status: 201 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to create shifts'
    return NextResponse.json({ success: false, message }, { status: 400 })
  }
}
