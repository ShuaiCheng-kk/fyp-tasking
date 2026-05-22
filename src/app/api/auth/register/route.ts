// LAYER: Controller
// RULE: Only handles request/response. No business logic. No DB access.

import { NextRequest, NextResponse } from 'next/server'
import { authService } from '@/services/auth/authService'
import type { User } from '@/types/auth.types'

const VALID_ROLES: User['role'][] = ['Owner', 'Guest User']

export async function POST(req: NextRequest) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ success: false, message: 'Invalid JSON body' }, { status: 400 })
  }

  const { email_address, password, full_name, phone_number, role, is_invitation_path } =
    body as Record<string, unknown>

  if (!email_address || typeof email_address !== 'string') {
    return NextResponse.json({ success: false, message: 'email_address is required' }, { status: 400 })
  }
  if (!password || typeof password !== 'string') {
    return NextResponse.json({ success: false, message: 'password is required' }, { status: 400 })
  }
  if (!full_name || typeof full_name !== 'string') {
    return NextResponse.json({ success: false, message: 'full_name is required' }, { status: 400 })
  }

  // Invitation path: only create the Auth user, skip the users table insert
  if (is_invitation_path === true) {
    try {
      const user_id = await authService.registerAuthOnly({ email_address, password })
      return NextResponse.json({ success: true, user_id }, { status: 201 })
    } catch (error: any) {
      const msg = (error?.message || '').toLowerCase()
      if (msg.includes('user already registered') || msg.includes('already registered')) {
        return NextResponse.json({
          success: false,
          message: 'This email is already registered. Please sign in instead.',
        })
      }
      return NextResponse.json({ success: false, message: 'Something went wrong. Please try again.' }, { status: 500 })
    }
  }

  // Owner path: create Auth user + users table record
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
    const msg = error?.message || ''
    const details = error?.details || ''
    const combined = msg + details

    if (msg.includes('user already registered') || msg.includes('already registered')) {
      const existingUser = await import('@/repositories/auth/authRepository')
        .then((m) => m.authRepository.findByEmail(email_address as string))
      if (!existingUser) {
        await import('@/services/auth/authService')
          .then((m) => m.authService.deleteOrphanedAuthUser(email_address as string))
        return NextResponse.json({ success: false, message: 'Registration incomplete. Please try again.' })
      }
      return NextResponse.json({ success: false, message: 'This email is already registered. Please sign in instead.' })
    }
    if (combined.includes('phone_number') || combined.includes('users_phone_number_key')) {
      return NextResponse.json({ success: false, message: 'This phone number is already in use.' })
    }
    if (combined.includes('email') && (combined.includes('unique') || combined.includes('duplicate'))) {
      return NextResponse.json({ success: false, message: 'This email is already registered.' })
    }
    if (error?.code === '23505') {
      return NextResponse.json({ success: false, message: 'This account already exists.' })
    }

    return NextResponse.json({ success: false, message: 'Something went wrong. Please try again.' }, { status: 500 })
  }
}
