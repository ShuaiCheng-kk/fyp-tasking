// LAYER: Controller
// RULE: Only handles request/response. No business logic. No DB access.

import { NextRequest, NextResponse } from 'next/server'
import { userService } from '@/services/auth/userService'
import { getServerSessionUser } from '@/lib/serverAuth'

export async function PATCH(req: NextRequest) {
  try {
    const { user_id, full_name, phone_number, date_of_birth, profile_photo_url } = await req.json()
    if (!user_id) return NextResponse.json({ success: false, message: 'user_id is required' }, { status: 400 })
    if (!full_name?.trim()) return NextResponse.json({ success: false, message: 'Full name is required' }, { status: 400 })

    const session = await getServerSessionUser()
    if (!session) return NextResponse.json({ success: false, message: 'Not authenticated' }, { status: 401 })
    // A user may only ever edit their own profile — accepts either the internal users.id or the
    // Supabase auth id (callers of this route pass whichever they already have on hand).
    if (user_id !== session.user.id && user_id !== session.auth_id) {
      return NextResponse.json({ success: false, message: 'You can only edit your own profile' }, { status: 403 })
    }

    const user = await userService.updateProfile(session.user.id, {
      full_name: full_name.trim(),
      phone_number: phone_number?.trim() || null,
      date_of_birth: date_of_birth?.trim() || null,
      profile_photo_url: profile_photo_url?.trim() || null,
    })
    return NextResponse.json({ success: true, user })
  } catch (error) {
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : 'Failed to update profile' },
      { status: 500 },
    )
  }
}
