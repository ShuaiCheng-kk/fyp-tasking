import { NextRequest, NextResponse } from 'next/server'
import { ownerInboxService } from '@/services/owner/ownerInboxService'
import { getServerSessionUser } from '@/lib/serverAuth'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ conversation_id: string }> }
) {
  try {
    const { searchParams } = new URL(req.url)
    const user_id = searchParams.get('user_id')
    const { conversation_id: other_user_id } = await params
    if (!user_id) {
      return NextResponse.json({ success: false, error: 'Missing user_id' }, { status: 400 })
    }
    const session = await getServerSessionUser()
    if (!session) return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 })
    if (user_id !== session.user.id && user_id !== session.auth_id) {
      return NextResponse.json({ success: false, error: 'You can only view your own conversations' }, { status: 403 })
    }
    const messages = await ownerInboxService.getMessages(user_id, other_user_id)
    return NextResponse.json({ success: true, messages })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ conversation_id: string }> }
) {
  try {
    const body = await req.json()
    const { user_id } = body
    const { conversation_id: other_user_id } = await params
    if (!user_id) {
      return NextResponse.json({ success: false, error: 'Missing user_id' }, { status: 400 })
    }
    const session = await getServerSessionUser()
    if (!session) return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 })
    if (user_id !== session.user.id && user_id !== session.auth_id) {
      return NextResponse.json({ success: false, error: 'You can only manage your own conversations' }, { status: 403 })
    }
    await ownerInboxService.markMessagesAsRead(user_id, other_user_id)
    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ conversation_id: string }> }
) {
  try {
    const { searchParams } = new URL(req.url)
    const user_id = searchParams.get('user_id')
    const { conversation_id: other_user_id } = await params
    if (!user_id) {
      return NextResponse.json({ success: false, error: 'Missing user_id' }, { status: 400 })
    }
    const session = await getServerSessionUser()
    if (!session) return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 })
    if (user_id !== session.user.id && user_id !== session.auth_id) {
      return NextResponse.json({ success: false, error: 'You can only manage your own conversations' }, { status: 403 })
    }
    await ownerInboxService.deleteConversation(user_id, other_user_id)
    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
