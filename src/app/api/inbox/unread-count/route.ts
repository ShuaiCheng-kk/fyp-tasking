import { NextRequest, NextResponse } from 'next/server'
import { getUnreadCount } from '@/services/inboxService'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const user_id = searchParams.get('user_id')
    const company_id = searchParams.get('company_id')
    const last_announcement_read_at = searchParams.get('last_announcement_read_at')
    if (!user_id || !company_id) {
      return NextResponse.json({ success: false, error: 'Missing user_id or company_id' }, { status: 400 })
    }
    const result = await getUnreadCount(user_id, company_id, last_announcement_read_at)
    return NextResponse.json({ success: true, ...result })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
