// LAYER: Controller
// RULE: Only handles request/response. No business logic. No DB access.

import { NextRequest, NextResponse } from 'next/server'
import { casualInboxService } from '@/services/casual/casualInboxService'
import { getServerSessionUser } from '@/lib/serverAuth'

export async function GET(req: NextRequest) {
  const user_id = req.nextUrl.searchParams.get('user_id')
  const other_user_id = req.nextUrl.searchParams.get('other_user_id')
  if (!user_id || !other_user_id) {
    return NextResponse.json({ success: false, message: 'user_id and other_user_id are required' }, { status: 400 })
  }
  const session = await getServerSessionUser()
  if (!session) return NextResponse.json({ success: false, message: 'Not authenticated' }, { status: 401 })
  if (user_id !== session.user.id && user_id !== session.auth_id) {
    return NextResponse.json({ success: false, message: 'You can only view your own messages' }, { status: 403 })
  }
  try {
    const { messages, self_id } = await casualInboxService.getMessages(user_id, other_user_id)
    return NextResponse.json({ success: true, messages, self_id })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to load messages'
    return NextResponse.json({ success: false, message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ success: false, message: 'Invalid JSON body' }, { status: 400 })
  }

  const b = body as Record<string, unknown>
  if (typeof b.user_id !== 'string' || !b.user_id) {
    return NextResponse.json({ success: false, message: 'user_id is required' }, { status: 400 })
  }
  if (typeof b.other_user_id !== 'string' || !b.other_user_id) {
    return NextResponse.json({ success: false, message: 'other_user_id is required' }, { status: 400 })
  }
  if (typeof b.company_id !== 'string' || !b.company_id) {
    return NextResponse.json({ success: false, message: 'company_id is required' }, { status: 400 })
  }
  if (typeof b.content !== 'string' || !b.content.trim()) {
    return NextResponse.json({ success: false, message: 'content is required' }, { status: 400 })
  }
  const session = await getServerSessionUser()
  if (!session) return NextResponse.json({ success: false, message: 'Not authenticated' }, { status: 401 })
  if (b.user_id !== session.user.id && b.user_id !== session.auth_id) {
    return NextResponse.json({ success: false, message: 'You can only send messages as yourself' }, { status: 403 })
  }

  try {
    const message = await casualInboxService.sendMessage(b.user_id, b.other_user_id, b.company_id, b.content)
    return NextResponse.json({ success: true, message }, { status: 201 })
  } catch (err) {
    const errMessage = err instanceof Error ? err.message : 'Failed to send message'
    return NextResponse.json({ success: false, message: errMessage }, { status: 400 })
  }
}
