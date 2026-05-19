// LAYER: Controller
// RULE: Only handles request/response. No business logic. No DB access.

import { NextRequest, NextResponse } from 'next/server'
import { userService } from '@/services/userService'

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json()
    const { user_id, department_id } = body

    if (!user_id) {
      return NextResponse.json({ success: false, message: 'user_id is required' }, { status: 400 })
    }

    await userService.updateUserDepartment(user_id, department_id ?? null)
    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Something went wrong'
    return NextResponse.json({ success: false, message }, { status: 500 })
  }
}
