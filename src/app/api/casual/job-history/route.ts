import { NextResponse } from 'next/server'
import { casualJobHistoryService } from '@/services/casual/casualJobHistoryService'

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

    const jobHistory = await casualJobHistoryService.getJobHistory(user_id)

    return NextResponse.json({
      success: true,
      jobHistory,
    })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : 'Failed to load casual job history',
      },
      { status: 500 }
    )
  }
}