// LAYER: Controller
// RULE: Only handles request/response. No business logic. No DB access.

import { NextRequest, NextResponse } from 'next/server'
import { teamService } from '@/services/teamService'

export async function DELETE(req: NextRequest) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ success: false, message: 'Invalid request body' }, { status: 400 })
  }

  const { company_id, user_id_to_remove, requesting_user_id } = body as Record<string, string>

  if (!company_id || !user_id_to_remove || !requesting_user_id) {
    return NextResponse.json(
      { success: false, message: 'company_id, user_id_to_remove, and requesting_user_id are required' },
      { status: 400 },
    )
  }

  try {
    const result = await teamService.removeMember(company_id, user_id_to_remove, requesting_user_id)
    return NextResponse.json(result, { status: 200 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to remove member'
    return NextResponse.json({ success: false, message }, { status: 400 })
  }
}
