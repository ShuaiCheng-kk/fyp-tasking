// LAYER: Controller only
import { NextRequest, NextResponse } from 'next/server'
import { companyService } from '@/services/companyService'
import type { Company } from '@/types/index'

const VALID_PLANS: Company['plan'][] = ['Free', 'Paid']

export async function POST(req: NextRequest) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ success: false, message: 'Invalid JSON body' }, { status: 400 })
  }

  const { owner_id, name, description, departments, plan } = body as Record<string, unknown>

  if (!owner_id || typeof owner_id !== 'string') {
    return NextResponse.json({ success: false, message: 'owner_id is required' }, { status: 400 })
  }
  if (!name || typeof name !== 'string' || !name.trim()) {
    return NextResponse.json({ success: false, message: 'name is required' }, { status: 400 })
  }
  if (!plan || !VALID_PLANS.includes(plan as Company['plan'])) {
    return NextResponse.json({ success: false, message: `plan must be one of: ${VALID_PLANS.join(', ')}` }, { status: 400 })
  }

  try {
    const company = await companyService.createAdditionalCompany({
      owner_id,
      name: name.trim(),
      description: typeof description === 'string' ? description.trim() || null : null,
      plan: plan as Company['plan'],
      departments: Array.isArray(departments) ? (departments as string[]) : [],
    })
    return NextResponse.json({ success: true, company }, { status: 201 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to create company'
    return NextResponse.json({ success: false, message }, { status: 500 })
  }
}
