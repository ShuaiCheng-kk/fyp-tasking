// LAYER: Controller
// RULE: Parse request, validate, call service, return response. No business logic.

import { NextRequest, NextResponse } from 'next/server'
import { stripeService } from '@/services/stripeService'
import { getServerSessionUser } from '@/lib/serverAuth'

export async function POST(req: NextRequest) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ success: false, message: 'Invalid JSON body' }, { status: 400 })
  }

  const { companyId } = body as Record<string, unknown>

  if (!companyId || typeof companyId !== 'string') {
    return NextResponse.json({ success: false, message: 'companyId is required' }, { status: 400 })
  }
  const session = await getServerSessionUser()
  if (!session) return NextResponse.json({ success: false, message: 'Not authenticated' }, { status: 401 })
  if (session.user.company_id !== companyId) {
    return NextResponse.json({ success: false, message: 'You can only manage your own company\'s billing' }, { status: 403 })
  }

  try {
    await stripeService.cancelSubscription(companyId)
    return NextResponse.json({ success: true }, { status: 200 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to cancel subscription'
    return NextResponse.json({ success: false, message }, { status: 500 })
  }
}
