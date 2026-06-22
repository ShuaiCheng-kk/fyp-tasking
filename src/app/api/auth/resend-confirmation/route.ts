// LAYER: Controller
// RULE: Parse request, validate, call service, return response. No business logic, no DB access.

import { NextRequest, NextResponse } from 'next/server'
import { authService } from '@/services/auth/authService'

export async function POST(req: NextRequest) {
  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ success: false, message: 'Invalid JSON' }, { status: 400 })
  }

  const { email } = body as Record<string, unknown>
  if (!email || typeof email !== 'string') {
    return NextResponse.json({ success: false, message: 'email is required' }, { status: 400 })
  }

  try {
    await authService.resendConfirmation(email)
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : 'Failed to resend confirmation' },
      { status: 400 },
    )
  }
}
