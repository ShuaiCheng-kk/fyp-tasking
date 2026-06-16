// LAYER: Controller
// RULE: Only handles request/response. No business logic. No DB access.

import { NextRequest, NextResponse } from 'next/server'
import { userService } from '@/services/auth/userService'

export async function GET(req: NextRequest) {
  const user_id = req.nextUrl.searchParams.get('user_id')

  if (!user_id) {
    return NextResponse.json({ success: false, message: 'user_id is required' }, { status: 400 })
  }

  try {
    const user = await userService.getUserById(user_id) as any
    return NextResponse.json(
      { success: true, user: { id: user.id, full_name: user.full_name, role: user.role, email_address: user.email_address, company_id: user.company_id, department_id: user.department_id ?? null, phone_number: user.phone_number ?? null, date_of_birth: user.date_of_birth ?? null, profile_photo_url: user.profile_photo_url ?? null } },
      { status: 200 },
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : 'User not found'
    return NextResponse.json({ success: false, message }, { status: 404 })
  }
}
