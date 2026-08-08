// LAYER: Controller
// RULE: Only handles request/response. No business logic. No DB access.

import { NextRequest, NextResponse } from 'next/server'
import { workerProfileService } from '@/services/guest/workerProfileService'
import { getServerSessionUser } from '@/lib/serverAuth'

export async function PATCH(req: NextRequest) {
  let body: { user_id?: string; skills?: string | null }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ success: false, message: 'Invalid JSON body' }, { status: 400 })
  }

  if (!body.user_id) {
    return NextResponse.json({ success: false, message: 'user_id is required' }, { status: 400 })
  }
  const session = await getServerSessionUser()
  if (!session) return NextResponse.json({ success: false, message: 'Not authenticated' }, { status: 401 })
  if (body.user_id !== session.user.id && body.user_id !== session.auth_id) {
    return NextResponse.json({ success: false, message: 'You can only edit your own profile' }, { status: 403 })
  }

  try {
    const profile = await workerProfileService.updateSkills(
      body.user_id,
      typeof body.skills === 'string' ? body.skills : null,
    )
    return NextResponse.json({ success: true, profile })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to update skills'
    return NextResponse.json({ success: false, message }, { status: 400 })
  }
}
