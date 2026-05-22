// LAYER: Controller
// RULE: Only handles request/response. No business logic. No DB access.

import { NextRequest, NextResponse } from 'next/server'
import { userService } from '@/services/auth/userService'

export async function GET(req: NextRequest) {
  const company_id = req.nextUrl.searchParams.get('company_id')

  if (!company_id) {
    return NextResponse.json({ success: false, message: 'company_id is required' }, { status: 400 })
  }

  try {
    const members = await userService.getTeamByCompany(company_id)
    return NextResponse.json({ success: true, members }, { status: 200 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch team members'
    return NextResponse.json({ success: false, message }, { status: 500 })
  }
}
