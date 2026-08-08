// LAYER: Controller
// RULE: Only handles request/response. No business logic. No DB access.

import { NextRequest, NextResponse } from 'next/server'
import { jobTemplateService } from '@/services/owner/jobTemplateService'
import { getServerSessionUser } from '@/lib/serverAuth'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  if (!id) return NextResponse.json({ success: false, message: 'id is required' }, { status: 400 })
  const session = await getServerSessionUser()
  if (!session) return NextResponse.json({ success: false, message: 'Not authenticated' }, { status: 401 })

  try {
    const stats = await jobTemplateService.getTemplateUsageStats(id, session.user.company_id ?? '')
    return NextResponse.json({ success: true, stats })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch template usage stats'
    const status = message.includes('own company') ? 403 : 400
    return NextResponse.json({ success: false, message }, { status })
  }
}
