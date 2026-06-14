// LAYER: Controller
// RULE: Parse request, validate, call service, return response. No business logic.

import { NextRequest, NextResponse } from 'next/server'
import { stripeService } from '@/services/stripeService'

export async function GET(req: NextRequest) {
  const companyId = req.nextUrl.searchParams.get('companyId')

  if (!companyId) {
    return NextResponse.json({ success: false, message: 'companyId is required' }, { status: 400 })
  }

  try {
    const details = await stripeService.getSubscriptionDetails(companyId)
    return NextResponse.json({ success: true, data: details }, { status: 200 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch subscription details'
    return NextResponse.json({ success: false, message }, { status: 500 })
  }
}
