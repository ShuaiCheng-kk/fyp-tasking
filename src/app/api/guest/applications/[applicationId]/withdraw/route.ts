// LAYER: Controller
// RULE: Only handles request/response. No business logic. No DB access.

import { NextResponse } from 'next/server'
import { workerApplicationService } from '@/services/guest/workerApplicationService'
import { getServerSessionUser } from '@/lib/serverAuth'

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ applicationId: string }> }
) {
  try {
    const session = await getServerSessionUser()
    if (!session) return NextResponse.json({ success: false, message: 'Not authenticated' }, { status: 401 })
    const { applicationId } = await params
    const application = await workerApplicationService.withdrawApplication(applicationId, session.user.id)

    return NextResponse.json({ success: true, application })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to withdraw application'
    // "already processed" is the caller's fault (stale card), not a server fault.
    const status = message.includes('not found or already processed') ? 404 : message.includes('your own') ? 403 : 500

    return NextResponse.json({ success: false, message }, { status })
  }
}
