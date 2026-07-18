import { NextResponse } from 'next/server'
import { casualAttendanceService } from '@/services/casual/casualAttendanceService'

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const user_id = searchParams.get('user_id')
    const resource = searchParams.get('resource')

    if (!user_id) {
      return NextResponse.json(
        { success: false, message: 'Missing user_id' },
        { status: 400 }
      )
    }

    if (resource === 'history') {
      const history = await casualAttendanceService.getHistory(user_id)
      return NextResponse.json({ success: true, history })
    }

    const attendance = await casualAttendanceService.getAttendance(user_id)

    return NextResponse.json({
      success: true,
      attendance,
    })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : 'Failed to load casual attendance',
      },
      { status: 500 }
    )
  }
}

export async function POST(req: Request) {
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
  if (typeof b.shift_assignment_id !== 'string' || !b.shift_assignment_id) {
    return NextResponse.json({ success: false, message: 'shift_assignment_id is required' }, { status: 400 })
  }

  try {
    const payload = {
      authId: b.user_id,
      shift_assignment_id: b.shift_assignment_id,
      clock_time: typeof b.clock_time === 'string' ? b.clock_time : undefined,
      notes: typeof b.notes === 'string' ? b.notes : null,
    }

    if (b.action === 'clock_in') {
      const record = await casualAttendanceService.clockIn(payload)
      return NextResponse.json({ success: true, record }, { status: 201 })
    }

    if (b.action === 'clock_out') {
      const record = await casualAttendanceService.clockOut(payload)
      return NextResponse.json({ success: true, record })
    }

    if (b.action === 'break_in') {
      const record = await casualAttendanceService.breakIn({ authId: payload.authId, shift_assignment_id: payload.shift_assignment_id, break_time: payload.clock_time })
      return NextResponse.json({ success: true, record })
    }

    if (b.action === 'break_out') {
      const record = await casualAttendanceService.breakOut({ authId: payload.authId, shift_assignment_id: payload.shift_assignment_id, break_time: payload.clock_time })
      return NextResponse.json({ success: true, record })
    }

    return NextResponse.json({ success: false, message: 'Unsupported attendance action' }, { status: 400 })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : 'Failed to update casual attendance',
      },
      { status: 400 },
    )
  }
}
