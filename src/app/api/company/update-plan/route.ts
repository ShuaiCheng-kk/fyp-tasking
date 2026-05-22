// LAYER: Controller
// RULE: Only handles request/response. No business logic. No DB access.

import { NextRequest, NextResponse } from 'next/server'
import { companyService } from '@/services/company/companyService'
import type { Company } from '@/types/company.types'

const VALID_PLANS: Company['plan'][] = ['Free', 'Paid']

export async function POST(req: NextRequest) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ success: false, message: 'Invalid JSON body' }, { status: 400 })
  }

  const { company_id, plan } = body as Record<string, unknown>

  if (!company_id || typeof company_id !== 'string') {
    return NextResponse.json({ success: false, message: 'company_id is required' }, { status: 400 })
  }
  if (!plan || !VALID_PLANS.includes(plan as Company['plan'])) {
    return NextResponse.json(
      { success: false, message: `plan must be one of: ${VALID_PLANS.join(', ')}` },
      { status: 400 },
    )
  }

  try {
    await companyService.updatePlan(company_id, plan as Company['plan'])
    return NextResponse.json({ success: true }, { status: 200 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to update plan'
    return NextResponse.json({ success: false, message }, { status: 400 })
  }
}
