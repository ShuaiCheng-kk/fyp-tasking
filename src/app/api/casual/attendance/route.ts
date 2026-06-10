import { NextResponse } from 'next/server'
import { casualAttendanceService } from '@/services/casual/casualAttendanceService'

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const user_id = searchParams.get('user_id')

    if (!user_id) {
      return NextResponse.json(
        { success: false, message: 'Missing user_id' },
        { status: 400 }
      )
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