// LAYER: Controller
// RULE: This file must ONLY contain request handling — no business logic
// RULE: Never import supabase directly in Service or Controller layers
// RULE: Never write business logic in Repository or Controller layers

import { NextRequest, NextResponse } from 'next/server'
import { invitationService } from '@/services/invitationService'
import { authService } from '@/services/authService'

export async function POST(req: NextRequest) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ success: false, message: 'Invalid JSON body' }, { status: 400 })
  }

  const { code, user_id, full_name, email_address, phone_number, password } = body as Record<string, unknown>

  if (!code || typeof code !== 'string') {
    return NextResponse.json({ success: false, message: 'code is required' }, { status: 400 })
  }
  if (!user_id || typeof user_id !== 'string') {
    return NextResponse.json({ success: false, message: 'user_id is required' }, { status: 400 })
  }
  if (!full_name || typeof full_name !== 'string') {
    return NextResponse.json({ success: false, message: 'full_name is required' }, { status: 400 })
  }
  if (!email_address || typeof email_address !== 'string') {
    return NextResponse.json({ success: false, message: 'email_address is required' }, { status: 400 })
  }
  if (!password || typeof password !== 'string') {
    return NextResponse.json({ success: false, message: 'password is required' }, { status: 400 })
  }

  try {
    const result = await invitationService.redeemCode({
      code: code.trim().toUpperCase(),
      supabase_auth_id: user_id,
      full_name,
      email_address,
      phone_number: typeof phone_number === 'string' ? phone_number : null,
    })

    const signedInUser = await authService.signIn(email_address, password)

    return NextResponse.json({
      success: true,
      user: {
        id: signedInUser.id,
        email_address: signedInUser.email_address,
        full_name: signedInUser.full_name,
        role: signedInUser.role,
      },
      company_id: result.company_id,
    }, { status: 200 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Invitation redemption failed'
    return NextResponse.json({ success: false, message }, { status: 400 })
  }
}
