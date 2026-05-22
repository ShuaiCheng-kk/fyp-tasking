// LAYER: Controller
// RULE: Only handles request/response. No business logic. No DB access.

import { NextRequest, NextResponse } from 'next/server'
import { employeeInboxService } from '@/services/employee/employeeInboxService'

export async function GET(req: NextRequest) {
  const user_id = req.nextUrl.searchParams.get('user_id')
  if (!user_id) {
    return NextResponse.json({ success: false, message: 'user_id is required' }, { status: 400 })
  }
  try {
    const contacts = await employeeInboxService.getContacts(user_id)
    return NextResponse.json({ success: true, contacts }, { status: 200 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch contacts'
    return NextResponse.json({ success: false, message }, { status: 500 })
  }
}
