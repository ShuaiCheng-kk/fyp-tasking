// LAYER: Controller
// RULE: Only handles request/response. No business logic. No DB access.

import { NextRequest, NextResponse } from 'next/server'
import { shiftService } from '@/services/owner/shiftService'
import { BulkEditShiftItem } from '@/types/Shift'
import { getServerSessionUser } from '@/lib/serverAuth'

export async function PATCH(req: NextRequest) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ success: false, message: 'Invalid JSON body' }, { status: 400 })
  }

  const { company_id, items } = body as Record<string, unknown>

  if (!company_id || typeof company_id !== 'string')
    return NextResponse.json({ success: false, message: 'company_id is required' }, { status: 400 })
  const session = await getServerSessionUser()
  if (!session) return NextResponse.json({ success: false, message: 'Not authenticated' }, { status: 401 })
  if (session.user.company_id !== company_id) {
    return NextResponse.json({ success: false, message: 'You can only manage your own company\'s shifts' }, { status: 403 })
  }
  if (!Array.isArray(items) || items.length === 0)
    return NextResponse.json({ success: false, message: 'items must be a non-empty array' }, { status: 400 })

  const cleanedItems: BulkEditShiftItem[] = items
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object' && typeof item.id === 'string')
    .map(item => ({
      id: item.id as string,
      shift_date: typeof item.shift_date === 'string' ? item.shift_date : undefined,
      start_time: typeof item.start_time === 'string' ? item.start_time : undefined,
      end_time: typeof item.end_time === 'string' ? item.end_time : undefined,
      department_id: typeof item.department_id === 'string' ? item.department_id : undefined,
      assigned_user_id: item.assigned_user_id === null ? null : typeof item.assigned_user_id === 'string' ? item.assigned_user_id : undefined,
    }))

  try {
    const result = await shiftService.bulkEditShifts(company_id, cleanedItems, session.user.id)
    return NextResponse.json({ success: true, result })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to bulk edit shifts'
    return NextResponse.json({ success: false, message }, { status: 400 })
  }
}
