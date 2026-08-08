// LAYER: Controller
// RULE: Only handles request/response. No business logic. No DB access.

import { NextRequest, NextResponse } from 'next/server'
import { reportService } from '@/services/owner/reportService'
import { getServerSessionUser } from '@/lib/serverAuth'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const company_id = searchParams.get('company_id')
  const date_from = searchParams.get('date_from')
  const date_to = searchParams.get('date_to')
  const department_id = searchParams.get('department_id')

  if (!company_id || !date_from || !date_to) {
    return NextResponse.json({ success: false, message: 'company_id, date_from and date_to are required' }, { status: 400 })
  }
  const session = await getServerSessionUser()
  if (!session) return NextResponse.json({ success: false, message: 'Not authenticated' }, { status: 401 })
  if (session.user.company_id !== company_id) {
    return NextResponse.json({ success: false, message: 'You can only view your own company\'s report' }, { status: 403 })
  }

  try {
    const recruitment = await reportService.getRecruitmentHistory({
      company_id,
      date_from,
      date_to,
      department_id: department_id || null,
    })
    return NextResponse.json({ success: true, recruitment })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch recruitment history'
    return NextResponse.json({ success: false, message }, { status: 500 })
  }
}
