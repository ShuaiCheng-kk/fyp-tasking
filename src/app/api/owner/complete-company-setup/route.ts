// LAYER: Controller
// RULE: Parse request, validate, call service, return response. No business logic, no DB access.

import { NextRequest, NextResponse } from 'next/server'
import { authService } from '@/services/auth/authService'

export async function POST(req: NextRequest) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ success: false, message: 'Invalid JSON body' }, { status: 400 })
  }

  const {
    user_id, company_name, company_description,
    company_location, company_address, company_postal_code,
    company_industry, company_size, company_website, company_logo_url,
    departments, plan,
  } = body as Record<string, unknown>

  if (!user_id || typeof user_id !== 'string') {
    return NextResponse.json({ success: false, message: 'user_id is required' }, { status: 400 })
  }
  if (!company_name || typeof company_name !== 'string') {
    return NextResponse.json({ success: false, message: 'company_name is required' }, { status: 400 })
  }

  try {
    const result = await authService.completeCompanySetup({
      user_id,
      company_name,
      company_description: typeof company_description === 'string' ? company_description : '',
      company_location: typeof company_location === 'string' ? company_location : null,
      company_address: typeof company_address === 'string' ? company_address : null,
      company_postal_code: typeof company_postal_code === 'string' ? company_postal_code : null,
      company_industry: typeof company_industry === 'string' ? company_industry : null,
      company_size: typeof company_size === 'string' ? company_size : null,
      company_website: typeof company_website === 'string' ? company_website : null,
      company_logo_url: typeof company_logo_url === 'string' ? company_logo_url : null,
      departments: Array.isArray(departments) ? departments as string[] : [],
      plan: typeof plan === 'string' ? plan : 'Free',
    })

    return NextResponse.json({ success: true, company_id: result.company_id })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Something went wrong'
    return NextResponse.json({ success: false, message }, { status: 500 })
  }
}
