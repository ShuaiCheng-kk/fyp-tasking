// LAYER: Controller
// RULE: Only handles request/response. No business logic. No DB access.

import { NextRequest, NextResponse } from 'next/server'
import { invitationService } from '@/services/invitation/invitationService'
import type { InvitationCode } from '@/types/invitation.types'
import { getServerSessionUser } from '@/lib/serverAuth'

const VALID_ROLES: InvitationCode['role'][] = ['Owner', 'Manager', 'Employee']

export async function POST(req: NextRequest) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ success: false, message: 'Invalid JSON body' }, { status: 400 })
  }

  const { company_id, department_id, role } = body as Record<string, unknown>

  if (!company_id || typeof company_id !== 'string') {
    return NextResponse.json({ success: false, message: 'company_id is required' }, { status: 400 })
  }
  if (!role || !VALID_ROLES.includes(role as InvitationCode['role'])) {
    return NextResponse.json(
      { success: false, message: `role must be one of: ${VALID_ROLES.join(', ')}` },
      { status: 400 },
    )
  }

  const session = await getServerSessionUser()
  if (!session) return NextResponse.json({ success: false, message: 'Not authenticated' }, { status: 401 })
  if (session.user.company_id !== company_id) {
    return NextResponse.json({ success: false, message: 'You can only generate invitations for your own company' }, { status: 403 })
  }

  try {
    const invitation = await invitationService.generateCode({
      company_id,
      department_id: typeof department_id === 'string' ? department_id : null,
      role: role as InvitationCode['role'],
      generated_by: session.user.id,
    })
    return NextResponse.json(
      { success: true, code: invitation.code, expired_at: invitation.expired_at },
      { status: 201 },
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Invitation generation failed'
    return NextResponse.json({ success: false, message }, { status: 400 })
  }
}
