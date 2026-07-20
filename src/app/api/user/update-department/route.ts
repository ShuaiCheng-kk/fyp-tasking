// LAYER: Controller
// RULE: Only handles request/response. No business logic. No DB access.

import { NextRequest, NextResponse } from 'next/server'
import { ownerTeamService } from '@/services/owner/ownerTeamService'
import { userService } from '@/services/auth/userService'

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json()
    const { user_id, department_id, company_id, requester_user_id } = body

    if (!requester_user_id || typeof requester_user_id !== 'string') {
      return NextResponse.json({ success: false, message: 'requester_user_id is required' }, { status: 400 })
    }
    try {
      await userService.assertOwnerRole(requester_user_id)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Forbidden'
      return NextResponse.json({ success: false, message }, { status: 403 })
    }

    await ownerTeamService.changeMemberDepartment({ user_id, department_id, company_id })
    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Something went wrong'
    const status = message.includes('is required') || message.includes('Cannot resolve') || message.includes('not a member') || message.includes('Only Managers and Employees')
      ? 400
      : message.includes('not found')
      ? 404
      : 500
    return NextResponse.json({ success: false, message }, { status })
  }
}
