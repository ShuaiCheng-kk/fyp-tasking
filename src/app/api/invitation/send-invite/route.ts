// LAYER: Controller
// RULE: Only handles request/response. No business logic. No DB access.

import { NextRequest, NextResponse } from 'next/server'
import { invitationService } from '@/services/invitation/invitationService'
import { getServerSessionUser } from '@/lib/serverAuth'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { email, role, company_id, department_id } = body

    if (!email || !role || !company_id) {
      return NextResponse.json(
        { success: false, message: 'Missing required fields' },
        { status: 400 },
      )
    }

    const session = await getServerSessionUser()
    if (!session) return NextResponse.json({ success: false, message: 'Not authenticated' }, { status: 401 })
    if (session.user.company_id !== company_id) {
      return NextResponse.json({ success: false, message: 'You can only invite to your own company' }, { status: 403 })
    }

    await invitationService.sendInvite({
      email,
      role,
      company_id,
      department_id: department_id || null,
      invited_by: session.user.id,
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
