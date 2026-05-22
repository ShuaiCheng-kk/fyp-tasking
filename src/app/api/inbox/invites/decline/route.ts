import { NextRequest, NextResponse } from 'next/server'
import { ownerInboxService } from '@/services/owner/ownerInboxService'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { inbox_id } = body
    if (!inbox_id) {
      return NextResponse.json({ success: false, error: 'Missing inbox_id' }, { status: 400 })
    }
    await ownerInboxService.updateInboxStatus(inbox_id, 'declined')
    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
