// LAYER: Controller
// RULE: Only handles request/response. No business logic. No DB access.

import { NextRequest, NextResponse } from 'next/server'
import { userService } from '@/services/userService'

export async function POST(req: NextRequest) {
  let body: { user_id?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ success: false, message: 'Invalid JSON' }, { status: 400 })
  }

  const { user_id } = body
  if (!user_id) {
    return NextResponse.json({ success: false, message: 'user_id is required' }, { status: 400 })
  }

  try {
    await userService.leaveCompany(user_id)
    return NextResponse.json({ success: true }, { status: 200 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to leave company'
    return NextResponse.json({ success: false, message }, { status: 500 })
  }
}
