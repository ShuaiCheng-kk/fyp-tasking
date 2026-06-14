// LAYER: Controller
// RULE: Parse request, validate, call service, return response. No business logic, no DB access.

import { NextRequest, NextResponse } from 'next/server'
import { authService } from '@/services/auth/authService'

export async function GET(req: NextRequest) {
  const email = req.nextUrl.searchParams.get('email')
  if (!email) {
    return NextResponse.json({ success: false, message: 'email is required' }, { status: 400 })
  }

  try {
    const verified = await authService.isEmailVerified(email)
    return NextResponse.json({ success: true, verified })
  } catch {
    return NextResponse.json({ success: false, message: 'Failed to check verification status' }, { status: 500 })
  }
}
