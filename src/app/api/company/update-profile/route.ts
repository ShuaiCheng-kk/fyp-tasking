// LAYER: Controller only
import { NextRequest, NextResponse } from 'next/server'
import { companyService } from '@/services/company/companyService'

export async function PATCH(req: NextRequest) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ success: false, message: 'Invalid JSON body' }, { status: 400 })
  }

  const { company_id, name, description, location, address, postal_code, industry, size, requester_user_id } = body as Record<string, unknown>

  if (!company_id || typeof company_id !== 'string') {
    return NextResponse.json({ success: false, message: 'company_id is required' }, { status: 400 })
  }
  if (!requester_user_id || typeof requester_user_id !== 'string') {
    return NextResponse.json({ success: false, message: 'requester_user_id is required' }, { status: 400 })
  }

  try {
    const company = await companyService.updateCompany(company_id, requester_user_id, {
      name: typeof name === 'string' ? name : '',
      description: typeof description === 'string' ? description : null,
      location: typeof location === 'string' ? location : null,
      address: typeof address === 'string' ? address : null,
      postal_code: typeof postal_code === 'string' ? postal_code : null,
      industry: typeof industry === 'string' ? industry : null,
      size: typeof size === 'string' ? size : null,
    })
    return NextResponse.json({ success: true, company })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to update company'
    const status = message === 'Only an Owner can perform this action' ? 403 : 400
    return NextResponse.json({ success: false, message }, { status })
  }
}
