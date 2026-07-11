// LAYER: Controller
// RULE: Only handles request/response. No business logic. No DB access.

import { NextRequest, NextResponse } from 'next/server'
import { workerApplicationService } from '@/services/guest/workerApplicationService'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ applicationId: string }> }
) {
  const { applicationId } = await params

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ success: false, message: 'Invalid JSON body' }, { status: 400 })
  }

  const b = body as Record<string, unknown>
  const { invitation_id, response } = b

  if (typeof invitation_id !== 'string' || !invitation_id) {
    return NextResponse.json({ success: false, message: 'invitation_id is required' }, { status: 400 })
  }
  if (response !== 'accepted' && response !== 'declined') {
    return NextResponse.json({ success: false, message: 'response must be accepted or declined' }, { status: 400 })
  }

  void applicationId

  try {
    await workerApplicationService.respondToInvitation(invitation_id, response)
    return NextResponse.json({ success: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to respond to invitation'
    return NextResponse.json({ success: false, message }, { status: 400 })
  }
}
