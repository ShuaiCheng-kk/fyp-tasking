// LAYER: Controller
// RULE: Parse request, validate, call service, return response. No business logic. No DB access.

import { NextRequest, NextResponse } from 'next/server'
import { stripeService } from '@/services/stripeService'
import { authService } from '@/services/auth/authService'
import { getServerSessionUser } from '@/lib/serverAuth'

export async function POST(req: NextRequest) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ success: false, message: 'Invalid JSON body' }, { status: 400 })
  }

  const { companyId, email, userId } = body as Record<string, unknown>

  if (!companyId || typeof companyId !== 'string') {
    return NextResponse.json({ success: false, message: 'companyId is required' }, { status: 400 })
  }
  if (!email || typeof email !== 'string') {
    return NextResponse.json({ success: false, message: 'email is required' }, { status: 400 })
  }
  // Reached during registration (Choose your plan -> Pro) before the owner has ever signed in, as
  // well as later from an authenticated session. Prefer the session; fall back to proving the
  // supplied auth id is a verified account belonging to this company.
  const session = await getServerSessionUser()
  let actingUserId: string
  if (session) {
    if (session.user.company_id !== companyId) {
      return NextResponse.json({ success: false, message: 'You can only manage your own company\'s billing' }, { status: 403 })
    }
    actingUserId = session.user.id
  } else {
    if (!userId || typeof userId !== 'string') {
      return NextResponse.json({ success: false, message: 'Not authenticated' }, { status: 401 })
    }
    const user = await authService.findVerifiedUserOfCompany(userId, companyId)
    if (!user) {
      return NextResponse.json({ success: false, message: 'You can only manage your own company\'s billing' }, { status: 403 })
    }
    actingUserId = user.id
  }

  try {
    const url = await stripeService.createCheckoutSession(actingUserId, companyId, email)
    return NextResponse.json({ success: true, url }, { status: 200 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to create checkout session'
    return NextResponse.json({ success: false, message }, { status: 500 })
  }
}
