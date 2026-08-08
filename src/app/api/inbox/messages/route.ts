import { NextRequest, NextResponse } from 'next/server'
import { ownerInboxService } from '@/services/owner/ownerInboxService'
import { getServerSessionUser } from '@/lib/serverAuth'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const user_id = searchParams.get('user_id')
    if (!user_id) {
      return NextResponse.json({ success: false, error: 'Missing user_id' }, { status: 400 })
    }
    const session = await getServerSessionUser()
    if (!session) return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 })
    if (user_id !== session.user.id && user_id !== session.auth_id) {
      return NextResponse.json({ success: false, error: 'You can only view your own conversations' }, { status: 403 })
    }
    const conversations = await ownerInboxService.getConversations(user_id)
    return NextResponse.json({ success: true, conversations })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { to_user_id, company_id, content } = body
    if (!to_user_id || !company_id || !content) {
      return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 })
    }
    const session = await getServerSessionUser()
    if (!session) return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 })
    const message = await ownerInboxService.sendMessage(session.user.id, to_user_id, company_id, content)
    return NextResponse.json({ success: true, message })
  } catch (error: any) {
    const status = error.message === 'Managers can only message the Owner, Partner, or members of their own department' ? 403 : 400
    return NextResponse.json({ success: false, error: error.message }, { status })
  }
}
