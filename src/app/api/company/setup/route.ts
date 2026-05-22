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

  const { owner_id, name, description, plan, location, industry, size, logo_url, website } = body as Record<string, unknown>

  if (!owner_id || typeof owner_id !== 'string') {
    return NextResponse.json({ success: false, message: 'owner_id is required' }, { status: 400 })
  }
  if (!name || typeof name !== 'string') {
    return NextResponse.json({ success: false, message: 'name is required' }, { status: 400 })
  }
  if (!plan || !VALID_PLANS.includes(plan as Company['plan'])) {
    return NextResponse.json(
      { success: false, message: `plan must be one of: ${VALID_PLANS.join(', ')}` },
      { status: 400 },
    )
  }

  try {
    const company = await companyService.setupCompany({
      owner_id,
      name,
      description: typeof description === 'string' ? description : null,
      plan: plan as Company['plan'],
      location: typeof location === 'string' ? location.trim() || null : null,
      industry: typeof industry === 'string' ? industry.trim() || null : null,
      size: typeof size === 'string' ? size.trim() || null : null,
      logo_url: typeof logo_url === 'string' ? logo_url.trim() || null : null,
      website: typeof website === 'string' ? website.trim() || null : null,
    })
    return NextResponse.json(
      { success: true, company: { id: company.id, name: company.name } },
      { status: 201 },
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Company setup failed'
    return NextResponse.json({ success: false, message }, { status: 400 })
  }
}
