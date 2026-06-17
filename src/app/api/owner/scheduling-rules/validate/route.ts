// LAYER: Controller
// RULE: Only handles request/response. No business logic. No DB access.

import { NextRequest, NextResponse } from 'next/server'
import { schedulingRuleService } from '@/services/owner/schedulingRuleService'
import { ScheduleValidationItem } from '@/types/SchedulingRule'

export async function POST(req: NextRequest) {
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
  if (typeof b.date_from !== 'string' || !b.date_from) {
    return NextResponse.json({ success: false, message: 'date_from is required' }, { status: 400 })
  }
  if (typeof b.date_to !== 'string' || !b.date_to) {
    return NextResponse.json({ success: false, message: 'date_to is required' }, { status: 400 })
  }

  const items = Array.isArray(b.items)
    ? b.items
        .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object')
        .map(item => ({
          department_id: typeof item.department_id === 'string' ? item.department_id : '',
          shift_date: typeof item.shift_date === 'string' ? item.shift_date : '',
          start_time: typeof item.start_time === 'string' ? item.start_time : '',
          end_time: typeof item.end_time === 'string' ? item.end_time : '',
          user_id: typeof item.user_id === 'string' ? item.user_id : null,
        }))
        .filter(item => item.department_id && item.shift_date && item.start_time && item.end_time)
    : undefined

  try {
    const result = await schedulingRuleService.validateSchedule({
      company_id: b.company_id,
      date_from: b.date_from,
      date_to: b.date_to,
      items: items as ScheduleValidationItem[] | undefined,
    })
    return NextResponse.json({ success: true, validation: result })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to validate schedule'
    return NextResponse.json({ success: false, message }, { status: 400 })
  }
}
