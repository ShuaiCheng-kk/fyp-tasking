import { NextResponse } from 'next/server'
import { casualDashboardService } from '@/services/casual/casualDashboardService'
import { getServerSessionUser } from '@/lib/serverAuth'

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
    const session = await getServerSessionUser()
    if (!session) return NextResponse.json({ success: false, message: 'Not authenticated' }, { status: 401 })
    if (user_id !== session.user.id && user_id !== session.auth_id) {
      return NextResponse.json({ success: false, message: 'You can only view your own dashboard' }, { status: 403 })
    }

    const dashboard = await casualDashboardService.getDashboard(user_id)

    return NextResponse.json({
      success: true,
      dashboard,
    })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : 'Failed to load casual dashboard',
      },
      { status: 500 }
    )
  }
}