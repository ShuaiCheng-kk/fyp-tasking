// LAYER: Controller
// RULE: Only handles request/response. No business logic. No DB access.

import { NextRequest, NextResponse } from 'next/server'
import { employeeAttendanceService } from '@/services/employee/employeeAttendanceService'
import { getServerSessionUser } from '@/lib/serverAuth'

export async function GET(req: NextRequest) {
  const user_id = req.nextUrl.searchParams.get('user_id')
  const resource = req.nextUrl.searchParams.get('resource')
  if (!user_id) {
    return NextResponse.json({ success: false, message: 'user_id is required' }, { status: 400 })
  }
  const session = await getServerSessionUser()
  if (!session) return NextResponse.json({ success: false, message: 'Not authenticated' }, { status: 401 })
  if (user_id !== session.user.id && user_id !== session.auth_id) {
    return NextResponse.json({ success: false, message: 'You can only view your own attendance' }, { status: 403 })
  }
  try {
    if (resource === 'my_shift') {
      const myShift = await employeeAttendanceService.getMyShift(user_id)
      return NextResponse.json({ success: true, myShift })
    }
    if (resource === 'clockout_release_queue') {
      const queue = await employeeAttendanceService.getClockOutReleaseQueue(user_id)
      return NextResponse.json({ success: true, queue })
    }
    if (resource === 'clock_lock_status') {
      const locked = await employeeAttendanceService.getClockLockStatus(user_id)
      return NextResponse.json({ success: true, locked })
    }
    const records = await employeeAttendanceService.getAttendanceRecords(user_id)
    return NextResponse.json({ success: true, records })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch attendance records'
    return NextResponse.json({ success: false, message }, { status: 500 })
  }
}

// UC49 — shared by Manager and Employee, both of whom clock in/out against their own
// shift_assignment the same way (see employeeAttendanceService for why this file covers both).
export async function POST(req: NextRequest) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ success: false, message: 'Invalid JSON body' }, { status: 400 })
  }

  const b = body as Record<string, unknown>
  if (typeof b.user_id !== 'string' || !b.user_id) {
    return NextResponse.json({ success: false, message: 'user_id is required' }, { status: 400 })
  }
  const session = await getServerSessionUser()
  if (!session) return NextResponse.json({ success: false, message: 'Not authenticated' }, { status: 401 })
  if (b.user_id !== session.user.id && b.user_id !== session.auth_id) {
    return NextResponse.json({ success: false, message: 'You can only act on your own attendance' }, { status: 403 })
  }

  try {
    const authId = b.user_id

    if (b.action === 'release_clockout') {
      if (typeof b.attendance_record_id !== 'string' || !b.attendance_record_id) {
        return NextResponse.json({ success: false, message: 'attendance_record_id is required' }, { status: 400 })
      }
      const record = await employeeAttendanceService.releaseClockOut(authId, b.attendance_record_id)
      return NextResponse.json({ success: true, record })
    }

    if (typeof b.shift_assignment_id !== 'string' || !b.shift_assignment_id) {
      return NextResponse.json({ success: false, message: 'shift_assignment_id is required' }, { status: 400 })
    }
    const shift_assignment_id = b.shift_assignment_id

    if (b.action === 'clock_in') {
      const record = await employeeAttendanceService.clockIn({
        authId,
        shift_assignment_id,
        clock_time: typeof b.clock_time === 'string' ? b.clock_time : undefined,
      })
      return NextResponse.json({ success: true, record }, { status: 201 })
    }

    if (b.action === 'clock_out') {
      const record = await employeeAttendanceService.clockOut({
        authId,
        shift_assignment_id,
        clock_time: typeof b.clock_time === 'string' ? b.clock_time : undefined,
      })
      return NextResponse.json({ success: true, record })
    }

    if (b.action === 'break_in') {
      const record = await employeeAttendanceService.breakIn({ authId, shift_assignment_id })
      return NextResponse.json({ success: true, record })
    }

    if (b.action === 'break_out') {
      const record = await employeeAttendanceService.breakOut({ authId, shift_assignment_id })
      return NextResponse.json({ success: true, record })
    }

    return NextResponse.json({ success: false, message: 'Unsupported attendance action' }, { status: 400 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to update attendance'
    return NextResponse.json({ success: false, message }, { status: 400 })
  }
}
