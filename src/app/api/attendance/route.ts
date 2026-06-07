// LAYER: Controller
// RULE: Only handles request/response. No business logic. No DB access.

import { NextRequest, NextResponse } from 'next/server'
import { attendanceService } from '@/services/owner/attendanceService'
import { AttendanceOwnerStatus, AttendanceRequestStatus } from '@/types/Attendance'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const company_id = searchParams.get('company_id')
  const resource = searchParams.get('resource') ?? 'dashboard'

  if (!company_id) {
    return NextResponse.json({ success: false, message: 'company_id is required' }, { status: 400 })
  }

  try {
    if (resource === 'time_off') {
      const requests = await attendanceService.getTimeOffRequests(company_id)
      return NextResponse.json({ success: true, requests })
    }
    if (resource === 'shift_swaps') {
      const requests = await attendanceService.getShiftSwapRequests(company_id)
      return NextResponse.json({ success: true, requests })
    }
    const dashboard = await attendanceService.getAttendanceDashboard(company_id)
    return NextResponse.json({ success: true, dashboard })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch attendance'
    return NextResponse.json({ success: false, message }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ success: false, message: 'Invalid JSON body' }, { status: 400 })
  }

  const b = body as Record<string, unknown>
  const action = b.action

  try {
    if (action === 'final_review') {
      if (typeof b.id !== 'string' || typeof b.owner_id !== 'string' || typeof b.decision !== 'string') {
        return NextResponse.json({ success: false, message: 'id, owner_id and decision are required' }, { status: 400 })
      }
      const record = await attendanceService.finalReviewAttendance({
        id: b.id,
        owner_id: b.owner_id,
        decision: b.decision as AttendanceOwnerStatus,
        owner_notes: (b.owner_notes as string | null) ?? null,
        clock_in_time: (b.clock_in_time as string | null) ?? null,
        clock_out_time: (b.clock_out_time as string | null) ?? null,
      })
      return NextResponse.json({ success: true, record })
    }

    if (action === 'decide_time_off') {
      if (typeof b.id !== 'string' || typeof b.reviewer_id !== 'string' || typeof b.decision !== 'string') {
        return NextResponse.json({ success: false, message: 'id, reviewer_id and decision are required' }, { status: 400 })
      }
      const request = await attendanceService.decideTimeOffRequest({
        id: b.id,
        reviewer_id: b.reviewer_id,
        decision: b.decision as AttendanceRequestStatus,
      })
      return NextResponse.json({ success: true, request })
    }

    if (action === 'decide_shift_swap') {
      if (typeof b.id !== 'string' || typeof b.reviewer_id !== 'string' || typeof b.decision !== 'string') {
        return NextResponse.json({ success: false, message: 'id, reviewer_id and decision are required' }, { status: 400 })
      }
      const request = await attendanceService.decideShiftSwapRequest({
        id: b.id,
        reviewer_id: b.reviewer_id,
        decision: b.decision as AttendanceRequestStatus,
      })
      return NextResponse.json({ success: true, request })
    }

    return NextResponse.json({ success: false, message: 'Unsupported attendance action' }, { status: 400 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to update attendance'
    return NextResponse.json({ success: false, message }, { status: 400 })
  }
}
