import { NextRequest, NextResponse } from 'next/server'
import { workerProfileService } from '@/services/worker/workerProfileService'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const userId = searchParams.get('user_id')

    if (!userId) {
      return NextResponse.json(
        { success: false, message: 'Missing user ID' },
        { status: 400 }
      )
    }

    const profile = await workerProfileService.getProfile(userId)

    return NextResponse.json({
      success: true,
      profile,
    })
  } catch (err) {
    return NextResponse.json(
      {
        success: false,
        message: err instanceof Error ? err.message : 'Failed to load profile',
      },
      { status: 500 }
    )
  }
}