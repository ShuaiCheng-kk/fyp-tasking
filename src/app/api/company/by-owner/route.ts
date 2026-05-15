// LAYER: Controller
// RULE: Only handles request/response. No business logic. No DB access.

import { NextRequest, NextResponse } from 'next/server'
import { companyService } from '@/services/companyService'

export async function GET(req: NextRequest) {
  const owner_id = req.nextUrl.searchParams.get('owner_id')

  if (!owner_id) {
    return NextResponse.json({ success: false, message: 'owner_id is required' }, { status: 400 })
  }

  try {
    const companies = await companyService.getCompaniesByOwner(owner_id)
    if (!companies || companies.length === 0) {
      return NextResponse.json({ success: false, message: 'Company not found' }, { status: 404 })
    }
    const activeId = req.nextUrl.searchParams.get('company_id')
    const company = (activeId && companies.find((c) => c.id === activeId)) || companies[0]
    return NextResponse.json({ success: true, company }, { status: 200 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch company'
    return NextResponse.json({ success: false, message }, { status: 500 })
  }
}
