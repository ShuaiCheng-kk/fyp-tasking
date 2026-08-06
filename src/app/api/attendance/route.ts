// LAYER: Controller
// RULE: Only handles request/response. No business logic. No DB access.

import { NextRequest, NextResponse } from 'next/server'
import { attendanceService } from '@/services/owner/attendanceService'
import { FixedOffDayDecision } from '@/types/Attendance'

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
    if (resource === 'shift_swap_conflict') {
      const assignment_id = searchParams.get('assignment_id')
      if (!assignment_id) {
        return NextResponse.json({ success: false, message: 'assignment_id is required' }, { status: 400 })
      }
      const conflict = await attendanceService.getShiftSwapConflict(company_id, assignment_id)
      return NextResponse.json({ success: true, ...conflict })
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
      const viewer_role = searchParams.get('viewer_role') ?? undefined
      const records = await attendanceService.getAttendanceByDateRange(company_id, from_date, to_date, { role: viewer_role })
      return NextResponse.json({ success: true, records })
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
    if (action === 'modify_times') {
      if (typeof b.id !== 'string' || typeof b.actor_id !== 'string') {
        return NextResponse.json({ success: false, message: 'id and actor_id are required' }, { status: 400 })
      }
      const record = await attendanceService.modifyAttendanceTimes({
        id: b.id,
        actor_id: b.actor_id,
        reason: (b.reason as string | null) ?? null,
        clock_in_time: (b.clock_in_time as string | null) ?? null,
        clock_out_time: (b.clock_out_time as string | null) ?? null,
        break_in_time: (b.break_in_time as string | null) ?? null,
        break_out_time: (b.break_out_time as string | null) ?? null,
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
        reason: typeof b.reason === 'string' ? b.reason.trim() : null,
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
      if (typeof b.reviewer_id !== 'string' || typeof b.decision !== 'string') {
        return NextResponse.json({ success: false, message: 'reviewer_id and decision are required' }, { status: 400 })
      }
      if (Array.isArray(b.ids)) {
        if (!b.ids.every((id): id is string => typeof id === 'string')) {
          return NextResponse.json({ success: false, message: 'ids must be an array of strings' }, { status: 400 })
        }
        if (b.new_dates !== undefined && (!Array.isArray(b.new_dates) || !b.new_dates.every((d): d is string => typeof d === 'string'))) {
          return NextResponse.json({ success: false, message: 'new_dates must be an array of strings' }, { status: 400 })
        }
        const requests = await attendanceService.decideFixedOffDayRequestGroup({
          ids: b.ids,
          reviewer_id: b.reviewer_id,
          decision: b.decision as FixedOffDayDecision,
          new_dates: b.new_dates as string[] | undefined,
        })
        return NextResponse.json({ success: true, requests })
      }
      if (typeof b.id !== 'string') {
        return NextResponse.json({ success: false, message: 'id or ids is required' }, { status: 400 })
      }
      if (b.new_date !== undefined && typeof b.new_date !== 'string') {
        return NextResponse.json({ success: false, message: 'new_date must be a string' }, { status: 400 })
      }
      const request = await attendanceService.decideFixedOffDayRequest({
        id: b.id,
        reviewer_id: b.reviewer_id,
        decision: b.decision as FixedOffDayDecision,
        new_date: b.new_date as string | undefined,
      })
      return NextResponse.json({ success: true, request })
    }

    if (action === 'edit_fixed_off_day') {
      if (
        typeof b.user_id !== 'string' ||
        typeof b.company_id !== 'string' ||
        typeof b.requested_week !== 'string' ||
        !Array.isArray(b.dates) ||
        !b.dates.every((d): d is string => typeof d === 'string')
      ) {
        return NextResponse.json({ success: false, message: 'user_id, company_id, requested_week and dates (string[]) are required' }, { status: 400 })
      }
      const requests = await attendanceService.editFixedOffDayRequest({
        user_id: b.user_id,
        company_id: b.company_id,
        requested_week: b.requested_week,
        dates: b.dates,
      })
      return NextResponse.json({ success: true, requests })
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
        !Array.isArray(b.dates) ||
        !b.dates.every((d): d is string => typeof d === 'string')
      ) {
        return NextResponse.json({ success: false, message: 'user_id, company_id and dates (string[]) are required' }, { status: 400 })
      }
      const request = await attendanceService.submitFixedOffDayRequest({
        user_id: b.user_id,
        company_id: b.company_id,
        dates: b.dates,
      })
      return NextResponse.json({ success: true, request })
    }

    return NextResponse.json({ success: false, message: 'Unsupported action' }, { status: 400 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to submit request'
    return NextResponse.json({ success: false, message }, { status: 400 })
  }
}
