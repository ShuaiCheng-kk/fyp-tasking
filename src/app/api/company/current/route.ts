// LAYER: Controller
// RULE: Only handles request/response. No business logic. No DB access.

import { NextRequest, NextResponse } from 'next/server'
import { companyService } from '@/services/company/companyService'

export async function GET(req: NextRequest) {
  const user_id = req.nextUrl.searchParams.get('user_id')
  const company_id = req.nextUrl.searchParams.get('company_id')

  if (!user_id) {
    return NextResponse.json({ success: false, message: 'user_id is required' }, { status: 400 })
  }

  try {
    const ctx = await companyService.getCurrentCompanyContext(user_id, company_id)
    return NextResponse.json({
      success: true,
      role: ctx.role,
      company: ctx.company,
      companies: ctx.companies,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to load company'
    const status = message.includes('not found') ? 404 : 500
    return NextResponse.json({ success: false, message }, { status })
  }
}
