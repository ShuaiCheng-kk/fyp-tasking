// LAYER: Controller
// RULE: Only handles request/response. No business logic. No DB access.

import { NextRequest, NextResponse } from 'next/server'
import { userService } from '@/services/auth/userService'
import { getServerSessionUser } from '@/lib/serverAuth'

export async function GET(req: NextRequest) {
  const company_id = req.nextUrl.searchParams.get('company_id')
  const department_id = req.nextUrl.searchParams.get('department_id')

  if (!company_id) {
    return NextResponse.json({ success: false, message: 'company_id is required' }, { status: 400 })
  }

  const session = await getServerSessionUser()
  if (!session) return NextResponse.json({ success: false, message: 'Not authenticated' }, { status: 401 })
  if (session.user.company_id !== company_id) {
    return NextResponse.json({ success: false, message: 'You can only view your own company\'s team' }, { status: 403 })
  }

  try {
    const members = department_id
      ? await userService.getTeamByDepartment(company_id, department_id)
      : await userService.getTeamByCompany(company_id)
    return NextResponse.json({ success: true, members }, { status: 200 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch team members'
    return NextResponse.json({ success: false, message }, { status: 500 })
  }
}
