// LAYER: Controller
// RULE: Only handles request/response. No business logic. No DB access.

import { NextRequest, NextResponse } from 'next/server'
import { employeeDashboardService } from '@/services/employee/employeeDashboardService'
import { getServerSessionUser } from '@/lib/serverAuth'

export async function GET(req: NextRequest) {
  const user_id = req.nextUrl.searchParams.get('user_id')
  if (!user_id) {
    return NextResponse.json({ success: false, message: 'user_id is required' }, { status: 400 })
  }
  const session = await getServerSessionUser()
  if (!session) return NextResponse.json({ success: false, message: 'Not authenticated' }, { status: 401 })
  if (user_id !== session.user.id && user_id !== session.auth_id) {
    return NextResponse.json({ success: false, message: 'You can only view your own dashboard' }, { status: 403 })
  }
  try {
    const data = await employeeDashboardService.getDashboard(user_id)
    return NextResponse.json({ success: true, ...data }, { status: 200 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch dashboard'
    return NextResponse.json({ success: false, message }, { status: 500 })
  }
}
