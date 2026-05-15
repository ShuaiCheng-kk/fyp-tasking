// LAYER: Controller
// RULE: This file must ONLY contain request handling — no business logic

import { NextRequest, NextResponse } from 'next/server'
import { invitationService } from '@/services/invitationService'

export async function POST(req: NextRequest) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ success: false, message: 'Invalid JSON body' }, { status: 400 })
  }

  const { code, full_name, email, password, phone_number } = body as Record<string, unknown>

  if (!code || typeof code !== 'string') {
    return NextResponse.json({ success: false, message: 'code is required' }, { status: 400 })
  }
  if (!full_name || typeof full_name !== 'string') {
    return NextResponse.json({ success: false, message: 'full_name is required' }, { status: 400 })
  }
  if (!email || typeof email !== 'string') {
    return NextResponse.json({ success: false, message: 'email is required' }, { status: 400 })
  }
  if (!password || typeof password !== 'string') {
    return NextResponse.json({ success: false, message: 'password is required' }, { status: 400 })
  }

  try {
    const result = await invitationService.redeemCode({
      code: code.trim().toUpperCase(),
      full_name,
      email_address: email,
      password,
      phone_number: typeof phone_number === 'string' ? phone_number : null,
    })

    return NextResponse.json({
      success: true,
      user: {
        id: result.user.id,
        full_name: result.user.full_name,
        role: result.user.role,
      },
      company_id: result.company_id,
    }, { status: 200 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Invitation redemption failed'
    return NextResponse.json({ success: false, message }, { status: 400 })
  }
}
