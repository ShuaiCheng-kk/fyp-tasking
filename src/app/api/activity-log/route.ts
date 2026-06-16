// LAYER: Controller
// RULE: Only handles request/response. No business logic. No DB access.

import { NextRequest, NextResponse } from 'next/server'
import { activityLogService } from '@/services/activityLog/activityLogService'

export async function GET(req: NextRequest) {
  const company_id = req.nextUrl.searchParams.get('company_id')
  if (!company_id) {
    return NextResponse.json({ success: false, message: 'company_id is required' }, { status: 400 })
  }
  try {
    const logs = await activityLogService.getCompanyLogs(company_id)
    return NextResponse.json({ success: true, logs })
  } catch (error) {
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : 'Failed to fetch logs' },
      { status: 500 }
    )
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { company_id, actor_id, action, target_name, detail } = body
    if (!company_id || !actor_id || !action) {
      return NextResponse.json({ success: false, message: 'company_id, actor_id, action are required' }, { status: 400 })
    }
    await activityLogService.log({ company_id, actor_id, action, target_name, detail })
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : 'Failed to log activity' },
      { status: 500 }
    )
  }
}
