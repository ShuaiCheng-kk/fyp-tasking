// LAYER: Controller
// RULE: Only handles request/response. No business logic. No DB access.

import { NextRequest, NextResponse } from 'next/server'
import { activityLogService } from '@/services/activityLog/activityLogService'

export async function POST(req: NextRequest) {
  try {
    const { company_id } = await req.json()
    if (!company_id) {
      return NextResponse.json({ success: false, message: 'company_id is required' }, { status: 400 })
    }
    await activityLogService.markAllRead(company_id)
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : 'Failed to mark as read' },
      { status: 500 }
    )
  }
}
