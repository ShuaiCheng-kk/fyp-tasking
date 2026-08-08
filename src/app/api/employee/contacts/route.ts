// LAYER: Controller
// RULE: Only handles request/response. No business logic. No DB access.

import { NextRequest, NextResponse } from 'next/server'
import { employeeInboxService } from '@/services/employee/employeeInboxService'
import { getServerSessionUser } from '@/lib/serverAuth'

export async function GET(req: NextRequest) {
  const user_id = req.nextUrl.searchParams.get('user_id')
  if (!user_id) {
    return NextResponse.json({ success: false, message: 'user_id is required' }, { status: 400 })
  }
  const session = await getServerSessionUser()
  if (!session) return NextResponse.json({ success: false, message: 'Not authenticated' }, { status: 401 })
  if (user_id !== session.user.id && user_id !== session.auth_id) {
    return NextResponse.json({ success: false, message: 'You can only view your own contacts' }, { status: 403 })
  }
  try {
    const contacts = await employeeInboxService.getContacts(user_id)
    return NextResponse.json({ success: true, contacts }, { status: 200 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch contacts'
    return NextResponse.json({ success: false, message }, { status: 500 })
  }
}
