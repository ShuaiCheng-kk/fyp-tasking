import { NextRequest, NextResponse } from 'next/server'
import { ownerAnnouncementService } from '@/services/owner/ownerAnnouncementService'
import { getServerSessionUser } from '@/lib/serverAuth'

// GET /api/inbox/announcements/read?user_id=&company_id=
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const user_id = searchParams.get('user_id')
    const company_id = searchParams.get('company_id')
    if (!user_id || !company_id) {
      return NextResponse.json({ success: false, error: 'Missing user_id or company_id' }, { status: 400 })
    }
    const session = await getServerSessionUser()
    if (!session) return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 })
    if (user_id !== session.user.id && user_id !== session.auth_id) {
      return NextResponse.json({ success: false, error: 'You can only view your own read state' }, { status: 403 })
    }
    const readIds = await ownerAnnouncementService.getReadAnnouncementIds(user_id, company_id)
    return NextResponse.json({ success: true, readIds })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

// POST /api/inbox/announcements/read  { user_id, announcement_ids: string[] }
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { user_id, announcement_ids } = body
    if (!user_id || !Array.isArray(announcement_ids)) {
      return NextResponse.json({ success: false, error: 'Missing user_id or announcement_ids' }, { status: 400 })
    }
    const session = await getServerSessionUser()
    if (!session) return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 })
    if (user_id !== session.user.id && user_id !== session.auth_id) {
      return NextResponse.json({ success: false, error: 'You can only mark your own read state' }, { status: 403 })
    }
    await ownerAnnouncementService.markAnnouncementsRead(user_id, announcement_ids)
    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
