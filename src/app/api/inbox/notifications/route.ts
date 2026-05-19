import { NextRequest, NextResponse } from 'next/server'
import { getNotifications, updateNotificationStatus } from '@/services/inboxService'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const user_id = searchParams.get('user_id')
    if (!user_id) {
      return NextResponse.json({ success: false, error: 'Missing user_id' }, { status: 400 })
    }
    const notifications = await getNotifications(user_id)
    return NextResponse.json({ success: true, notifications })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json()
    const { notification_id, status } = body
    if (!notification_id || !status) {
      return NextResponse.json({ success: false, error: 'Missing notification_id or status' }, { status: 400 })
    }
    const notification = await updateNotificationStatus(notification_id, status)
    return NextResponse.json({ success: true, notification })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 400 })
  }
}
