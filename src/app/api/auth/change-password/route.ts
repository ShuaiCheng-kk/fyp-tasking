// LAYER: Controller
// RULE: Only handles request/response. No business logic. No DB access.

import { NextRequest, NextResponse } from 'next/server'
import { authService } from '@/services/auth/authService'

export async function POST(req: NextRequest) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ success: false, message: 'Invalid JSON body' }, { status: 400 })
  }

  const { email, current_password, new_password } = body as Record<string, unknown>

  if (!email || typeof email !== 'string') {
    return NextResponse.json({ success: false, message: 'email is required' }, { status: 400 })
  }
  if (!current_password || typeof current_password !== 'string') {
    return NextResponse.json({ success: false, message: 'current_password is required' }, { status: 400 })
  }
  if (!new_password || typeof new_password !== 'string') {
    return NextResponse.json({ success: false, message: 'new_password is required' }, { status: 400 })
  }
  if (new_password.length < 6) {
    return NextResponse.json({ success: false, message: 'Password must be at least 6 characters' }, { status: 400 })
  }

  try {
    await authService.changePassword(email, current_password, new_password)
    return NextResponse.json({ success: true }, { status: 200 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to change password'
    const status = message.includes('incorrect') ? 401 : 500
    return NextResponse.json({ success: false, message }, { status })
  }
}
