// LAYER: Controller
// RULE: Only handles request/response. No business logic. No DB access.

import { NextRequest, NextResponse } from 'next/server'
import { schedulingRuleService } from '@/services/owner/schedulingRuleService'
import { SchedulingRuleKey, SchedulingRuleValue } from '@/types/SchedulingRule'

export async function GET(req: NextRequest) {
  const company_id = req.nextUrl.searchParams.get('company_id')
  const user_id = req.nextUrl.searchParams.get('user_id')

  if (!company_id) return NextResponse.json({ success: false, message: 'company_id is required' }, { status: 400 })
  if (!user_id) return NextResponse.json({ success: false, message: 'user_id is required' }, { status: 400 })

  try {
    await schedulingRuleService.assertOwner(user_id, company_id)
    const rules = await schedulingRuleService.getRules(company_id)
    return NextResponse.json({ success: true, rules })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to load scheduling rules'
    return NextResponse.json({ success: false, message }, { status: message.includes('Only Owner') ? 403 : 500 })
  }
}

export async function PATCH(req: NextRequest) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ success: false, message: 'Invalid JSON body' }, { status: 400 })
  }

  const b = body as Record<string, unknown>
  if (typeof b.company_id !== 'string' || !b.company_id) {
    return NextResponse.json({ success: false, message: 'company_id is required' }, { status: 400 })
  }
  if (typeof b.user_id !== 'string' || !b.user_id) {
    return NextResponse.json({ success: false, message: 'user_id is required' }, { status: 400 })
  }
  if (typeof b.rule_key !== 'string' || !b.rule_key) {
    return NextResponse.json({ success: false, message: 'rule_key is required' }, { status: 400 })
  }

  try {
    const rule = await schedulingRuleService.updateRule({
      company_id: b.company_id,
      user_id: b.user_id,
      rule_key: b.rule_key as SchedulingRuleKey,
      value: b.value as SchedulingRuleValue,
      active: b.active === true,
    })
    return NextResponse.json({ success: true, rule })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to update scheduling rule'
    return NextResponse.json({ success: false, message }, { status: message.includes('Only Owner') ? 403 : 400 })
  }
}
