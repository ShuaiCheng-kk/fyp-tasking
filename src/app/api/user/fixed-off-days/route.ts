// LAYER: Controller
// RULE: Only handles request/response. No business logic. No DB access.

import { NextRequest, NextResponse } from 'next/server'
import { availabilityService } from '@/services/user/availabilityService'

export async function GET(req: NextRequest) {
  const user_id = req.nextUrl.searchParams.get('user_id')
  if (!user_id) return NextResponse.json({ success: false, message: 'user_id is required' }, { status: 400 })
  try {
    const days = await availabilityService.getFixedOffDays(user_id)
    return NextResponse.json({ success: true, days })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch fixed off days'
    return NextResponse.json({ success: false, message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ success: false, message: 'Invalid JSON body' }, { status: 400 })
  }
  const b = body as Record<string, unknown>
  if (typeof b.user_id !== 'string' || !b.user_id)
    return NextResponse.json({ success: false, message: 'user_id is required' }, { status: 400 })
  if (typeof b.company_id !== 'string' || !b.company_id)
    return NextResponse.json({ success: false, message: 'company_id is required' }, { status: 400 })
  if (!Array.isArray(b.weekdays))
    return NextResponse.json({ success: false, message: 'weekdays must be an array' }, { status: 400 })

  try {
    await availabilityService.setFixedOffDays(b.user_id, b.company_id, b.weekdays as number[])
    return NextResponse.json({ success: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to save fixed off days'
    return NextResponse.json({ success: false, message }, { status: 500 })
  }
}
