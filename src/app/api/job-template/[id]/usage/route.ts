// LAYER: Controller
// RULE: Only handles request/response. No business logic. No DB access.

import { NextRequest, NextResponse } from 'next/server'
import { jobTemplateService } from '@/services/owner/jobTemplateService'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  if (!id) return NextResponse.json({ success: false, message: 'id is required' }, { status: 400 })

  try {
    const stats = await jobTemplateService.getTemplateUsageStats(id)
    return NextResponse.json({ success: true, stats })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch template usage stats'
    return NextResponse.json({ success: false, message }, { status: 400 })
  }
}
