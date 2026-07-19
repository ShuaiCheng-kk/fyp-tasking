// LAYER: Controller
// RULE: Only handles request/response. No business logic. No DB access.

import { NextRequest, NextResponse } from 'next/server'
import { ownerTeamService } from '@/services/owner/ownerTeamService'

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json()
    const { user_id, department_id, company_id } = body

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
