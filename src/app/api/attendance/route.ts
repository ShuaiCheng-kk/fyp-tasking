// LAYER: Controller
// RULE: Only handles request/response. No business logic. No DB access.

import { NextRequest, NextResponse } from 'next/server'
import { attendanceService } from '@/services/owner/attendanceService'
import { timesheetAutoApprovalService } from '@/services/owner/timesheetAutoApprovalService'
import { AttendanceOwnerStatus, AttendanceRequestStatus } from '@/types/Attendance'

// CHANGE TYPE: Code only

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const company_id = searchParams.get('company_id')
  const resource = searchParams.get('resource') ?? 'dashboard'

  if (resource === 'my_requests') {
    const user_id = searchParams.get('user_id')
    if (!user_id) return NextResponse.json({ success: false, message: 'user_id is required' }, { status: 400 })
    try {
      const requests = await attendanceService.getMyRequests(user_id)
      return NextResponse.json({ success: true, ...requests })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch requests'
      return NextResponse.json({ success: false, message }, { status: 500 })
    }
  }

  if (!company_id) {
    return NextResponse.json({ success: false, message: 'company_id is required' }, { status: 400 })
  }

  try {
    if (resource === 'pending_requests_count') {
      const [swaps, fixedOff] = await Promise.all([
        attendanceService.getShiftSwapRequests(company_id),
        attendanceService.getFixedOffDayRequests(company_id),
      ])
      const count = swaps.filter((r: { status: string }) => r.status === 'pending').length
        + fixedOff.filter((r: { status: string }) => r.status === 'pending').length
      return NextResponse.json({ success: true, count })
    }
    if (resource === 'shift_swaps') {
      const manager_id = searchParams.get('manager_id') ?? undefined
      const requests = await attendanceService.getShiftSwapRequests(company_id, { managerId: manager_id })
      return NextResponse.json({ success: true, requests })
    }
    if (resource === 'fixed_off_days') {
      const requests = await attendanceService.getFixedOffDayRequests(company_id)
      return NextResponse.json({ success: true, requests })
    }
    if (resource === 'range') {
      const from_date = searchParams.get('from_date')
      const to_date = searchParams.get('to_date')
      if (!from_date || !to_date) {
        return NextResponse.json({ success: false, message: 'from_date and to_date are required' }, { status: 400 })
      }
      const records = await attendanceService.getAttendanceByDateRange(company_id, from_date, to_date)
      return NextResponse.json({ success: true, records })
    }
    if (resource === 'ai_suggestions') {
      const suggestions = await timesheetAutoApprovalService.reviewTimesheets(company_id)
      return NextResponse.json({ success: true, suggestions })
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
    if (action === 'manager_review') {
      if (typeof b.id !== 'string' || typeof b.manager_id !== 'string') {
        return NextResponse.json({ success: false, message: 'id and manager_id are required' }, { status: 400 })
      }
      const record = await attendanceService.managerReviewAttendance({
        id: b.id,
        manager_id: b.manager_id,
        manager_notes: (b.manager_notes as string | null) ?? null,
      })
      return NextResponse.json({ success: true, record })
    }

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

    if (action === 'decide_shift_swap') {
      if (typeof b.id !== 'string' || typeof b.reviewer_id !== 'string' || typeof b.decision !== 'string') {
        return NextResponse.json({ success: false, message: 'id, reviewer_id and decision are required' }, { status: 400 })
      }
      const request = await attendanceService.decideShiftSwapRequest({
        id: b.id,
        reviewer_id: b.reviewer_id,
        decision: b.decision as 'approved' | 'rejected',
      })
      return NextResponse.json({ success: true, request })
    }

    if (action === 'respond_shift_swap') {
      if (typeof b.id !== 'string' || typeof b.counterpart_id !== 'string' || typeof b.decision !== 'string') {
        return NextResponse.json({ success: false, message: 'id, counterpart_id and decision are required' }, { status: 400 })
      }
      const request = await attendanceService.respondShiftSwapRequest({
        id: b.id,
        counterpart_id: b.counterpart_id,
        decision: b.decision as 'approved' | 'rejected',
      })
      return NextResponse.json({ success: true, request })
    }

    if (action === 'withdraw_shift_swap') {
      if (typeof b.id !== 'string' || typeof b.requester_id !== 'string') {
        return NextResponse.json({ success: false, message: 'id and requester_id are required' }, { status: 400 })
      }
      const request = await attendanceService.withdrawShiftSwapRequest({
        id: b.id,
        requester_id: b.requester_id,
      })
      return NextResponse.json({ success: true, request })
    }

    if (action === 'decide_fixed_off_day') {
      if (typeof b.id !== 'string' || typeof b.reviewer_id !== 'string' || typeof b.decision !== 'string') {
        return NextResponse.json({ success: false, message: 'id, reviewer_id and decision are required' }, { status: 400 })
      }
      const request = await attendanceService.decideFixedOffDayRequest({
        id: b.id,
        reviewer_id: b.reviewer_id,
        decision: b.decision as AttendanceRequestStatus,
      })
      return NextResponse.json({ success: true, request })
    }

    if (action === 'apply_ai_approvals') {
      if (typeof b.company_id !== 'string' || typeof b.owner_id !== 'string') {
        return NextResponse.json({ success: false, message: 'company_id and owner_id are required' }, { status: 400 })
      }
      const min_confidence = typeof b.min_confidence === 'number' ? b.min_confidence : 85
      const decisions = await timesheetAutoApprovalService.applyAutoApprovals(b.company_id, b.owner_id, min_confidence)
      return NextResponse.json({ success: true, decisions })
    }

    return NextResponse.json({ success: false, message: 'Unsupported attendance action' }, { status: 400 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to update attendance'
    return NextResponse.json({ success: false, message }, { status: 400 })
  }
}

export async function POST(req: NextRequest) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ success: false, message: 'Invalid JSON body' }, { status: 400 })
  }

  const b = body as Record<string, unknown>
  const action = b.action

  try {
    if (action === 'submit_shift_swap') {
      if (
        typeof b.company_id !== 'string' ||
        typeof b.requester_id !== 'string' ||
        typeof b.requester_assignment_id !== 'string' ||
        typeof b.counterpart_id !== 'string' ||
        typeof b.counterpart_assignment_id !== 'string'
      ) {
        return NextResponse.json({ success: false, message: 'company_id, requester_id, requester_assignment_id, counterpart_id and counterpart_assignment_id are required' }, { status: 400 })
      }
      const request = await attendanceService.submitShiftSwapRequest({
        company_id: b.company_id,
        requester_id: b.requester_id,
        requester_assignment_id: b.requester_assignment_id,
        counterpart_id: b.counterpart_id,
        counterpart_assignment_id: b.counterpart_assignment_id,
        reason: (b.reason as string | null) ?? null,
      })
      return NextResponse.json({ success: true, request })
    }

    if (action === 'submit_fixed_off_day') {
      if (
        typeof b.user_id !== 'string' ||
        typeof b.company_id !== 'string' ||
        typeof b.weekday !== 'number'
      ) {
        return NextResponse.json({ success: false, message: 'user_id, company_id and weekday are required' }, { status: 400 })
      }
      const request = await attendanceService.submitFixedOffDayRequest({
        user_id: b.user_id,
        company_id: b.company_id,
        weekday: b.weekday,
      })
      return NextResponse.json({ success: true, request })
    }

    return NextResponse.json({ success: false, message: 'Unsupported action' }, { status: 400 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to submit request'
    return NextResponse.json({ success: false, message }, { status: 400 })
  }
}
