// LAYER: Controller
// RULE: Only handles request/response. No business logic. No DB access.

import { NextRequest, NextResponse } from 'next/server'
import { activityLogService } from '@/services/activityLog/activityLogService'
import { getServerSessionUser } from '@/lib/serverAuth'

export async function GET(req: NextRequest) {
  const company_id = req.nextUrl.searchParams.get('company_id')
  if (!company_id) {
    return NextResponse.json({ success: false, message: 'company_id is required' }, { status: 400 })
  }
  const session = await getServerSessionUser()
  if (!session) return NextResponse.json({ success: false, message: 'Not authenticated' }, { status: 401 })
  if (session.user.company_id !== company_id) {
    return NextResponse.json({ success: false, message: 'You can only view your own company\'s activity log' }, { status: 403 })
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
    const { company_id, action, target_id, target_name, detail } = body
    if (!company_id || !action) {
      return NextResponse.json({ success: false, message: 'company_id and action are required' }, { status: 400 })
    }
    const session = await getServerSessionUser()
    if (!session) return NextResponse.json({ success: false, message: 'Not authenticated' }, { status: 401 })
    if (session.user.company_id !== company_id) {
      return NextResponse.json({ success: false, message: 'You can only log activity for your own company' }, { status: 403 })
    }
    await activityLogService.log({ company_id, actor_id: session.user.id, action, target_id, target_name, detail })
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : 'Failed to log activity' },
      { status: 500 }
    )
  }
}
