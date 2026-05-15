// LAYER: Controller
// RULE: Only handles request/response. No business logic. No DB access.

import { NextRequest, NextResponse } from 'next/server'
import { authService } from '@/services/authService'

export async function POST(req: NextRequest) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ success: false, message: 'Invalid JSON body' }, { status: 400 })
  }

  const { email_address, password } = body as Record<string, unknown>

  if (!email_address || typeof email_address !== 'string') {
    return NextResponse.json({ success: false, message: 'email_address is required' }, { status: 400 })
  }
  if (!password || typeof password !== 'string') {
    return NextResponse.json({ success: false, message: 'password is required' }, { status: 400 })
  }

  try {
    const user = await authService.signIn(email_address, password)
    return NextResponse.json(
      { success: true, user: { id: user.id, role: user.role, full_name: user.full_name, company_id: user.company_id } },
      { status: 200 },
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Sign-in failed'
    return NextResponse.json({ success: false, message }, { status: 401 })
  }
}
