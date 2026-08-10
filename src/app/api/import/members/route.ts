// LAYER: Controller
// RULE: Only handles request/response. No business logic. No DB access.

import { NextRequest, NextResponse, after } from 'next/server'
import { importService } from '@/services/owner/importService'
import { invitationService } from '@/services/invitation/invitationService'
import { userService } from '@/services/auth/userService'
import { MemberImportRow } from '@/types/Import'
import { getServerSessionUser } from '@/lib/serverAuth'

export async function POST(req: NextRequest) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ success: false, message: 'Invalid JSON body' }, { status: 400 })
  }

  const b = body as Record<string, unknown>
  if (typeof b.company_id !== 'string') {
    return NextResponse.json({ success: false, message: 'company_id is required' }, { status: 400 })
  }
  if (!Array.isArray(b.members)) {
    return NextResponse.json({ success: false, message: 'members must be an array' }, { status: 400 })
  }
  const session = await getServerSessionUser()
  if (!session) return NextResponse.json({ success: false, message: 'Not authenticated' }, { status: 401 })
  if (session.user.company_id !== b.company_id) {
    return NextResponse.json({ success: false, message: 'You can only import members into your own company' }, { status: 403 })
  }
  try {
    await userService.assertOwnerOrPartnerRole(session.user.id)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Forbidden'
    return NextResponse.json({ success: false, message }, { status: 403 })
  }

  try {
    const { pendingDeliveries, ...result } = await importService.importMembers({
      company_id: b.company_id,
      invited_by: session.user.id,
      members: b.members as MemberImportRow[],
    })
    // Invitation rows are committed and the accepted/rejected split is already decided; the emails
    // go out after the response so one slow send cannot stall the import. after() keeps them inside
    // the request's lifetime, unlike a floating promise a serverless host may kill.
    if (pendingDeliveries.length > 0) {
      after(() => Promise.all(pendingDeliveries.map(d => invitationService.deliverInvite(d))))
    }
    return NextResponse.json({ success: true, result })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to import members'
    return NextResponse.json({ success: false, message }, { status: 400 })
  }
}
