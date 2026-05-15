// LAYER: Controller only
import { NextRequest, NextResponse } from 'next/server'
import { companyService } from '@/services/companyService'

export async function PATCH(req: NextRequest) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ success: false, message: 'Invalid JSON body' }, { status: 400 })
  }

  const { company_id, name, description } = body as Record<string, unknown>

  if (!company_id || typeof company_id !== 'string') {
    return NextResponse.json({ success: false, message: 'company_id is required' }, { status: 400 })
  }
  if (!name || typeof name !== 'string' || !name.trim()) {
    return NextResponse.json({ success: false, message: 'name is required' }, { status: 400 })
  }

  try {
    const company = await companyService.updateCompany(company_id, {
      name: name.trim(),
      description: typeof description === 'string' ? description.trim() || null : null,
    })
    return NextResponse.json({ success: true, company })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to update company'
    return NextResponse.json({ success: false, message }, { status: 500 })
  }
}
