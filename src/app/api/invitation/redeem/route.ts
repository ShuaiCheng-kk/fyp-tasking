// LAYER: Controller
// RULE: This file must ONLY contain request handling — no business logic
// RULE: Never import supabase directly in Service or Controller layers
// RULE: Never write business logic in Repository or Controller layers

import { NextRequest, NextResponse } from 'next/server'
import { invitationService } from '@/services/invitationService'

export async function POST(req: NextRequest) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ success: false, message: 'Invalid JSON body' }, { status: 400 })
  }

  const { code, user_id } = body as Record<string, unknown>

  if (!code || typeof code !== 'string') {
    return NextResponse.json({ success: false, message: 'code is required' }, { status: 400 })
  }
  if (!user_id || typeof user_id !== 'string') {
    return NextResponse.json({ success: false, message: 'user_id is required' }, { status: 400 })
  }

  try {
    const result = await invitationService.redeemCode({ code: code.trim().toUpperCase(), user_id })
    return NextResponse.json({ success: true, role: result.role, company_id: result.company_id, department_id: result.department_id }, { status: 200 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Invitation redemption failed'
    return NextResponse.json({ success: false, message }, { status: 400 })
  }
}
