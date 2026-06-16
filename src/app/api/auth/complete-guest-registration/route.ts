// LAYER: Controller
// RULE: Parse request, validate, call service, return response. No business logic, no DB access.

import { NextRequest, NextResponse } from 'next/server'
import { authService } from '@/services/auth/authService'

export async function POST(req: NextRequest) {
  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ success: false, message: 'Invalid JSON body' }, { status: 400 })
  }

  const { user_id, full_name, email_address, password, phone_number, date_of_birth, profile_photo_url } =
    body as Record<string, unknown>

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
    const user = await authService.completeGuestRegistration({
      user_id,
      full_name,
      email_address,
      phone_number: typeof phone_number === 'string' ? phone_number : null,
      date_of_birth: typeof date_of_birth === 'string' ? date_of_birth : null,
      profile_photo_url: typeof profile_photo_url === 'string' ? profile_photo_url : null,
    })

    const signinResult = await authService.signIn(email_address, password)

    return NextResponse.json({
      success: true,
      user: { id: user.id, role: user.role, auth_id: signinResult.supabase_auth_id },
    })
  } catch (err) {
    const msg = (err instanceof Error ? err.message : '').toLowerCase()
    if (msg.includes('duplicate') || msg.includes('unique') || msg.includes('already')) {
      return NextResponse.json(
        { success: false, message: 'An account with this email already exists. Please sign in instead.' },
        { status: 400 },
      )
    }
    return NextResponse.json({ success: false, message: 'Something went wrong. Please try again.' }, { status: 500 })
  }
}
