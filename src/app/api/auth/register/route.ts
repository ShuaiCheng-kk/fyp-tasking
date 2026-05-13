// LAYER: Controller
// RULE: Only handles request/response. No business logic. No DB access.

import { NextRequest, NextResponse } from 'next/server'
import { authService } from '@/services/authService'
import type { User } from '@/types/index'

const VALID_ROLES: User['role'][] = ['Owner', 'Guest User']

export async function POST(req: NextRequest) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ success: false, message: 'Invalid JSON body' }, { status: 400 })
  }

  const { email_address, password, full_name, phone_number, role } = body as Record<string, unknown>

  if (!email_address || typeof email_address !== 'string') {
    return NextResponse.json({ success: false, message: 'email_address is required' }, { status: 400 })
  }
  if (!password || typeof password !== 'string') {
    return NextResponse.json({ success: false, message: 'password is required' }, { status: 400 })
  }
  if (!full_name || typeof full_name !== 'string') {
    return NextResponse.json({ success: false, message: 'full_name is required' }, { status: 400 })
  }
  if (!role || !VALID_ROLES.includes(role as User['role'])) {
    return NextResponse.json(
      { success: false, message: `role must be one of: ${VALID_ROLES.join(', ')}` },
      { status: 400 },
    )
  }

  try {
    const user = await authService.register({
      email_address,
      password,
      full_name,
      phone_number: typeof phone_number === 'string' ? phone_number : null,
      role: role as User['role'],
    })
    return NextResponse.json(
      { success: true, user: { id: user.id, role: user.role, full_name: user.full_name } },
      { status: 201 },
    )
  } catch (error: any) {
    console.error('Register error full:', error)
    console.log('Register error:', JSON.stringify(error, null, 2))
    console.log('Register error message:', error?.message)
    console.log('Register error code:', error?.code)

    const msg = error?.message || ''
    const details = error?.details || ''
    const combined = msg + details

    if (combined.includes('phone_number') || combined.includes('users_phone_number_key')) {
      return NextResponse.json({ success: false, message: 'This phone number is already in use.' }, { status: 400 })
    }
    if (combined.includes('email') && (combined.includes('unique') || combined.includes('duplicate'))) {
      return NextResponse.json({ success: false, message: 'This email is already registered.' }, { status: 400 })
    }
    if (error?.code === '23505') {
      return NextResponse.json({ success: false, message: 'This account already exists.' }, { status: 400 })
    }

    return NextResponse.json({ success: false, message: 'Something went wrong. Please try again.' }, { status: 500 })
  }
}
