import { NextResponse } from 'next/server'
import { casualAvailabilityService } from '@/services/casual/casualAvailabilityService'

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

    const availability = await casualAvailabilityService.getAvailability(user_id)

    return NextResponse.json({
      success: true,
      availability,
    })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : 'Failed to load casual availability',
      },
      { status: 500 }
    )
  }
}