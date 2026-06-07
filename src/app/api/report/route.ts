// LAYER: Controller
// RULE: Only handles request/response. No business logic. No DB access.

import { NextRequest, NextResponse } from 'next/server'
import { reportService } from '@/services/owner/reportService'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const company_id = searchParams.get('company_id')
  const date_from = searchParams.get('date_from')
  const date_to = searchParams.get('date_to')
  const department_id = searchParams.get('department_id')

  if (!company_id || !date_from || !date_to) {
    return NextResponse.json({ success: false, message: 'company_id, date_from and date_to are required' }, { status: 400 })
  }

  try {
    const report = await reportService.getWorkforceAnalytics({
      company_id,
      date_from,
      date_to,
      department_id: department_id || null,
    })
    return NextResponse.json({ success: true, report })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch report'
    return NextResponse.json({ success: false, message }, { status: 500 })
  }
}
