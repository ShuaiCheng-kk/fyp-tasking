// LAYER: Controller
// RULE: Only handles request/response. No business logic. No DB access.

import { NextResponse } from 'next/server'
import { workerApplicationService } from '@/services/guest/workerApplicationService'

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ applicationId: string }> }
) {
  try {
    const { applicationId } = await params
    const application = await workerApplicationService.withdrawApplication(applicationId)

    return NextResponse.json({ success: true, application })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to withdraw application'
    // "already processed" is the caller's fault (stale card), not a server fault.
    const status = message.includes('not found or already processed') ? 404 : 500

    return NextResponse.json({ success: false, message }, { status })
  }
}
