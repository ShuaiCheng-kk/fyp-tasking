// LAYER: Controller
// RULE: Only handles request/response. No business logic. No DB access.

import { NextRequest, NextResponse } from 'next/server'
import { userService } from '@/services/userService'

export async function GET(req: NextRequest) {
  const user_id = req.nextUrl.searchParams.get('user_id')

  if (!user_id) {
    return NextResponse.json({ success: false, message: 'user_id is required' }, { status: 400 })
  }

  try {
    const user = await userService.getUserById(user_id)
    return NextResponse.json(
      { success: true, user: { full_name: user.full_name, role: user.role, email_address: user.email_address } },
      { status: 200 },
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : 'User not found'
    return NextResponse.json({ success: false, message }, { status: 404 })
  }
}
