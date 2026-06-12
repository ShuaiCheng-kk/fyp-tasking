// LAYER: Controller
// RULE: Only handles request/response. No business logic. No DB access.

import { NextRequest, NextResponse } from 'next/server'
import { employeeAttendanceService } from '@/services/employee/employeeAttendanceService'

export async function GET(req: NextRequest) {
  const user_id = req.nextUrl.searchParams.get('user_id')
  if (!user_id) {
    return NextResponse.json({ success: false, message: 'user_id is required' }, { status: 400 })
  }
  try {
    const records = await employeeAttendanceService.getAttendanceRecords(user_id)
    return NextResponse.json({ success: true, records })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch attendance records'
    return NextResponse.json({ success: false, message }, { status: 500 })
  }
}
