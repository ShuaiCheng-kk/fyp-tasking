import { NextRequest, NextResponse } from 'next/server'
import { getInvitesByRecipient } from '@/repositories/inboxRepository'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const user_id = searchParams.get('user_id')
    if (!user_id) {
      return NextResponse.json({ success: false, error: 'Missing user_id' }, { status: 400 })
    }
    const invites = await getInvitesByRecipient(user_id)
    return NextResponse.json({ success: true, invites })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
