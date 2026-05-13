// LAYER: Controller
// RULE: Only handles request/response. No business logic. No DB access.

import { NextRequest, NextResponse } from 'next/server'
import { companyService } from '@/services/companyService'

export async function GET(req: NextRequest) {
  const company_id = req.nextUrl.searchParams.get('company_id')

  if (!company_id) {
    return NextResponse.json({ success: false, message: 'company_id is required' }, { status: 400 })
  }

  try {
    const departments = await companyService.getDepartments(company_id)
    return NextResponse.json({ success: true, departments }, { status: 200 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch departments'
    return NextResponse.json({ success: false, message }, { status: 500 })
  }
}
