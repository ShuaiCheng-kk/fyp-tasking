// LAYER: Controller
// RULE: Only handles request/response. No business logic. No DB access.

import { NextRequest, NextResponse } from 'next/server'
import { shiftService } from '@/services/owner/shiftService'
import { BulkShiftAssignmentInput } from '@/types/Shift'
import { getServerSessionUser } from '@/lib/serverAuth'

export async function POST(req: NextRequest) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ success: false, message: 'Invalid JSON body' }, { status: 400 })
  }

  const { company_id, department_id, assignments } = body as Record<string, unknown>

  if (!company_id || typeof company_id !== 'string') {
    return NextResponse.json({ success: false, message: 'company_id is required' }, { status: 400 })
  }
  if (!department_id || typeof department_id !== 'string') {
    return NextResponse.json({ success: false, message: 'department_id is required' }, { status: 400 })
  }
  const session = await getServerSessionUser()
  if (!session) return NextResponse.json({ success: false, message: 'Not authenticated' }, { status: 401 })
  if (session.user.company_id !== company_id) {
    return NextResponse.json({ success: false, message: 'You can only manage your own company\'s shifts' }, { status: 403 })
  }
  if (!Array.isArray(assignments)) {
    return NextResponse.json({ success: false, message: 'assignments must be an array' }, { status: 400 })
  }

  const cleanedAssignments: BulkShiftAssignmentInput[] = assignments
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object')
    .map(item => ({
      user_id: typeof item.user_id === 'string' ? item.user_id : '',
      shift_date: typeof item.shift_date === 'string' ? item.shift_date : '',
      start_time: typeof item.start_time === 'string' ? item.start_time : '',
      end_time: typeof item.end_time === 'string' ? item.end_time : '',
      supervisor_employee_id: typeof item.supervisor_employee_id === 'string' ? item.supervisor_employee_id : null,
      template_id: typeof item.template_id === 'string' && item.template_id ? item.template_id : null,
    }))

  try {
    const result = await shiftService.assignShiftsInBulk({
      company_id,
      department_id,
      created_by: session.user.id,
      assignments: cleanedAssignments,
    })
    return NextResponse.json({ success: true, result }, { status: 201 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to assign shifts'
    return NextResponse.json({ success: false, message }, { status: 400 })
  }
}
