// LAYER: Controller only
import { NextRequest, NextResponse } from 'next/server'
import { companyService } from '@/services/company/companyService'
import { userService } from '@/services/auth/userService'

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
  if (!name || typeof name !== 'string' || !name.trim()) {
    return NextResponse.json({ success: false, message: 'name is required' }, { status: 400 })
  }
  if (!requester_user_id || typeof requester_user_id !== 'string') {
    return NextResponse.json({ success: false, message: 'requester_user_id is required' }, { status: 400 })
  }
  try {
    await userService.assertOwnerRole(requester_user_id)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Forbidden'
    return NextResponse.json({ success: false, message }, { status: 403 })
  }

  try {
    const company = await companyService.updateCompany(company_id, {
      name: name.trim(),
      description: typeof description === 'string' ? description.trim() || null : null,
      location: typeof location === 'string' ? location.trim() || null : null,
      address: typeof address === 'string' ? address.trim() || null : null,
      postal_code: typeof postal_code === 'string' ? postal_code.trim() || null : null,
      industry: typeof industry === 'string' ? industry.trim() || null : null,
      size: typeof size === 'string' ? size.trim() || null : null,
    })
    return NextResponse.json({ success: true, company })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to update company'
    return NextResponse.json({ success: false, message }, { status: 500 })
  }
}
