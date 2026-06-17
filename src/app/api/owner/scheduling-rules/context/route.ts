// LAYER: Controller
// RULE: Only handles request/response. No business logic. No DB access.

import { NextRequest, NextResponse } from 'next/server'
import { schedulingRuleService } from '@/services/owner/schedulingRuleService'

export async function GET(req: NextRequest) {
  const company_id = req.nextUrl.searchParams.get('company_id')
  const user_id = req.nextUrl.searchParams.get('user_id')
  const date_from = req.nextUrl.searchParams.get('date_from')
  const date_to = req.nextUrl.searchParams.get('date_to')

  if (!company_id) return NextResponse.json({ success: false, message: 'company_id is required' }, { status: 400 })
  if (!user_id) return NextResponse.json({ success: false, message: 'user_id is required' }, { status: 400 })
  if (!date_from) return NextResponse.json({ success: false, message: 'date_from is required' }, { status: 400 })
  if (!date_to) return NextResponse.json({ success: false, message: 'date_to is required' }, { status: 400 })

  try {
    const context = await schedulingRuleService.getScheduleContext({
      company_id,
      user_id,
      date_from,
      date_to,
    })
    return NextResponse.json({ success: true, context })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to load scheduling context'
    return NextResponse.json({ success: false, message }, { status: message.includes('Only Owner') ? 403 : 400 })
  }
}
