// LAYER: Controller only
import { NextRequest, NextResponse } from 'next/server'
import { companyService } from '@/services/company/companyService'
import { getServerSessionUser } from '@/lib/serverAuth'

export async function PATCH(req: NextRequest) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ success: false, message: 'Invalid JSON body' }, { status: 400 })
  }

  const { company_id, name, description, location, address, postal_code, industry, size } = body as Record<string, unknown>

  if (!company_id || typeof company_id !== 'string') {
    return NextResponse.json({ success: false, message: 'company_id is required' }, { status: 400 })
  }
  const session = await getServerSessionUser()
  if (!session) return NextResponse.json({ success: false, message: 'Not authenticated' }, { status: 401 })
  if (session.user.company_id !== company_id) {
    return NextResponse.json({ success: false, message: 'You can only edit your own company' }, { status: 403 })
  }

  try {
    const company = await companyService.updateCompany(company_id, session.user.id, {
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
