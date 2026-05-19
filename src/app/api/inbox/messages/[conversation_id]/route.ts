import { NextRequest, NextResponse } from 'next/server'
import { getMessages } from '@/services/inboxService'
import { markMessagesAsRead } from '@/repositories/inboxRepository'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ conversation_id: string }> }
) {
  try {
    const { searchParams } = new URL(req.url)
    const user_id = searchParams.get('user_id')
    const company_id = searchParams.get('company_id')
    const { conversation_id: other_user_id } = await params
    if (!user_id || !company_id) {
      return NextResponse.json({ success: false, error: 'Missing user_id or company_id' }, { status: 400 })
    }
    const messages = await getMessages(user_id, other_user_id, company_id)
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
    const { user_id, company_id } = body
    const { conversation_id: other_user_id } = await params
    if (!user_id || !company_id) {
      return NextResponse.json({ success: false, error: 'Missing user_id or company_id' }, { status: 400 })
    }
    await markMessagesAsRead(user_id, other_user_id, company_id)
    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
