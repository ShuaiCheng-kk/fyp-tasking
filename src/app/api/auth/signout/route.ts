// LAYER: Controller
// RULE: Only handles request/response. No business logic. No DB access.

import { NextResponse } from 'next/server'
import { authService } from '@/services/authService'

export async function POST() {
  try {
    await authService.signOut()
    return NextResponse.json({ success: true }, { status: 200 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Sign out failed'
    return NextResponse.json({ success: false, message }, { status: 500 })
  }
}
