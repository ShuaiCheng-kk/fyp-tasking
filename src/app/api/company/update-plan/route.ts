// LAYER: Controller
// RULE: Only handles request/response. No business logic. No DB access.

import { NextRequest, NextResponse } from 'next/server'
import { companyService } from '@/services/company/companyService'
import type { Company } from '@/types/company.types'
import { authService } from '@/services/auth/authService'
import { getServerSessionUser } from '@/lib/serverAuth'

const VALID_PLANS: Company['plan'][] = ['Free', 'Paid']

export async function POST(req: NextRequest) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ success: false, message: 'Invalid JSON body' }, { status: 400 })
  }

  const { company_id, plan, user_id } = body as Record<string, unknown>

  if (!company_id || typeof company_id !== 'string') {
    return NextResponse.json({ success: false, message: 'company_id is required' }, { status: 400 })
  }
  if (!plan || !VALID_PLANS.includes(plan as Company['plan'])) {
    return NextResponse.json(
      { success: false, message: `plan must be one of: ${VALID_PLANS.join(', ')}` },
      { status: 400 },
    )
  }
  // Called on return from Stripe, which for a brand-new owner happens before they have ever signed
  // in. The Stripe webhook is the authoritative path for flipping the plan; this is the client-side
  // fallback, so it accepts the same sessionless proof the rest of registration uses.
  const session = await getServerSessionUser()
  if (session) {
    if (session.user.company_id !== company_id) {
      return NextResponse.json({ success: false, message: 'You can only manage your own company\'s plan' }, { status: 403 })
    }
  } else {
    if (!user_id || typeof user_id !== 'string') {
      return NextResponse.json({ success: false, message: 'Not authenticated' }, { status: 401 })
    }
    const user = await authService.findVerifiedUserOfCompany(user_id, company_id)
    if (!user) {
      return NextResponse.json({ success: false, message: 'You can only manage your own company\'s plan' }, { status: 403 })
    }
  }

  try {
    await companyService.updatePlan(company_id, plan as Company['plan'])
    return NextResponse.json({ success: true }, { status: 200 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to update plan'
    return NextResponse.json({ success: false, message }, { status: 400 })
  }
}
