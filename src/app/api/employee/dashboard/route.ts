// LAYER: Controller
// RULE: Only handles request/response. No business logic. No DB access.

import { NextRequest, NextResponse } from 'next/server'
import { employeeDashboardService } from '@/services/employee/employeeDashboardService'

export async function GET(req: NextRequest) {
  const user_id = req.nextUrl.searchParams.get('user_id')
  if (!user_id) {
    return NextResponse.json({ success: false, message: 'user_id is required' }, { status: 400 })
  }
  try {
    const data = await employeeDashboardService.getDashboard(user_id)
    return NextResponse.json({ success: true, ...data }, { status: 200 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch dashboard'
    return NextResponse.json({ success: false, message }, { status: 500 })
  }
}
