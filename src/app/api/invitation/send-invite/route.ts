// LAYER: Controller
// RULE: Only handles request/response. No business logic. No DB access.

import { NextRequest, NextResponse } from 'next/server'
import { invitationService } from '@/services/invitation/invitationService'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { email, role, company_id, department_id, invited_by, reporting_manager_id } = body

    if (!email || !role || !company_id || !invited_by) {
      return NextResponse.json(
        { success: false, message: 'Missing required fields' },
        { status: 400 },
      )
    }

    await invitationService.sendInvite({
      email,
      role,
      company_id,
      department_id: department_id || null,
      invited_by,
      reporting_manager_id: reporting_manager_id || null,
    })

    return NextResponse.json({ success: true, message: 'Invite sent' })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Something went wrong'
    const clientError =
      message === 'You cannot send an invitation to yourself.' ||
      message.startsWith('An active invitation already exists')
    return NextResponse.json({ success: false, message }, { status: clientError ? 200 : 500 })
  }
}
