// LAYER: Controller
// RULE: Only handles request/response. No business logic. No DB access.

import { NextRequest, NextResponse } from 'next/server'
import { schedulingRuleService } from '@/services/owner/schedulingRuleService'

export async function GET(req: NextRequest) {
  const company_id = req.nextUrl.searchParams.get('company_id')
  const user_id    = req.nextUrl.searchParams.get('user_id')

  if (!company_id) return NextResponse.json({ success: false, message: 'company_id is required' }, { status: 400 })
  if (!user_id)    return NextResponse.json({ success: false, message: 'user_id is required' }, { status: 400 })

  try {
    const staff = await schedulingRuleService.getStaffHours(company_id, user_id)
    return NextResponse.json({ success: true, staff })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to load staff hours'
    return NextResponse.json({ success: false, message }, { status: message.includes('Only Owner') ? 403 : 500 })
  }
}
