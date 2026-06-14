// LAYER: Controller
// RULE: Parse request, validate, call service, return response. No business logic.

import { NextRequest, NextResponse } from 'next/server'
import { stripeService } from '@/services/stripeService'

export async function POST(req: NextRequest) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ success: false, message: 'Invalid JSON body' }, { status: 400 })
  }

  const { companyId, userId, email } = body as Record<string, unknown>

  if (!companyId || typeof companyId !== 'string') {
    return NextResponse.json({ success: false, message: 'companyId is required' }, { status: 400 })
  }
  if (!userId || typeof userId !== 'string') {
    return NextResponse.json({ success: false, message: 'userId is required' }, { status: 400 })
  }
  if (!email || typeof email !== 'string') {
    return NextResponse.json({ success: false, message: 'email is required' }, { status: 400 })
  }

  try {
    const url = await stripeService.createUpgradeCheckoutSession(userId, companyId, email)
    return NextResponse.json({ success: true, url }, { status: 200 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to create checkout session'
    return NextResponse.json({ success: false, message }, { status: 500 })
  }
}
