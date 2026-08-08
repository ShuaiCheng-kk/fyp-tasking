// LAYER: Controller
// RULE: Only handles request/response. No business logic. No DB access.

import { NextRequest, NextResponse } from 'next/server'
import { ownerDashboardService } from '@/services/owner/ownerDashboardService'
import { getServerSessionUser } from '@/lib/serverAuth'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const company_id = searchParams.get('company_id')
  const owner_id = searchParams.get('owner_id')
  const viewer_role = searchParams.get('viewer_role') ?? undefined

  if (!company_id) {
    return NextResponse.json({ success: false, message: 'company_id is required' }, { status: 400 })
  }
  if (!owner_id) {
    return NextResponse.json({ success: false, message: 'owner_id is required' }, { status: 400 })
  }
  const session = await getServerSessionUser()
  if (!session) return NextResponse.json({ success: false, message: 'Not authenticated' }, { status: 401 })
  if (owner_id !== session.user.id && owner_id !== session.auth_id) {
    return NextResponse.json({ success: false, message: 'You can only view your own dashboard' }, { status: 403 })
  }

  try {
    const summary = await ownerDashboardService.getDashboardSummary(company_id, owner_id, viewer_role)
    return NextResponse.json({ success: true, summary })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to load dashboard summary'
    return NextResponse.json({ success: false, message }, { status: 500 })
  }
}
