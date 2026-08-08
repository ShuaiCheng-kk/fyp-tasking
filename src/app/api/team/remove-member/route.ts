// LAYER: Controller
// RULE: Only handles request/response. No business logic. No DB access.

import { NextRequest, NextResponse } from 'next/server'
import { ownerTeamService as teamService } from '@/services/owner/ownerTeamService'
import { getServerSessionUser } from '@/lib/serverAuth'

export async function DELETE(req: NextRequest) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ success: false, message: 'Invalid request body' }, { status: 400 })
  }

  const { company_id, user_id_to_remove } = body as Record<string, string>

  if (!company_id || !user_id_to_remove) {
    return NextResponse.json(
      { success: false, message: 'company_id and user_id_to_remove are required' },
      { status: 400 },
    )
  }

  const session = await getServerSessionUser()
  if (!session) return NextResponse.json({ success: false, message: 'Not authenticated' }, { status: 401 })
  if (session.user.company_id !== company_id) {
    return NextResponse.json({ success: false, message: 'You can only manage your own company\'s team' }, { status: 403 })
  }

  try {
    const result = await teamService.removeMember(company_id, user_id_to_remove, session.user.id)
    return NextResponse.json(result, { status: 200 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to remove member'
    return NextResponse.json({ success: false, message }, { status: 400 })
  }
}
