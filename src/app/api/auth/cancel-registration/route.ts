// LAYER: Controller
// RULE: Only handles request/response. No business logic, no DB access.

import { NextRequest, NextResponse } from 'next/server'
import { authService } from '@/services/auth/authService'

export async function POST(req: NextRequest) {
  const { email } = await req.json()
  if (!email || typeof email !== 'string') {
    return NextResponse.json({ success: false, message: 'email is required' }, { status: 400 })
  }
  // Best-effort — the user has already been sent back to step 0 client-side regardless of
  // whether this succeeds, so a failure here must never surface as an error to them.
  try {
    await authService.deleteOrphanedAuthUser(email)
  } catch { /* ignore */ }
  return NextResponse.json({ success: true })
}
