// LAYER: Controller
// RULE: Only handles request/response. No business logic. No DB access.

import { NextRequest, NextResponse } from 'next/server'
import { requestAISuggestService } from '@/services/ai/requestAISuggestService'
import { attendanceService } from '@/services/owner/attendanceService'
import { getServerSessionUser } from '@/lib/serverAuth'

// CHANGE TYPE: Code only

export async function POST(req: NextRequest) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ success: false, message: 'Invalid JSON body' }, { status: 400 })
  }

  const b = body as Record<string, unknown>
  const request_type = b.request_type as string | undefined
  const company_id = b.company_id as string | undefined

  if (!request_type || !company_id) {
    return NextResponse.json({ success: false, message: 'request_type and company_id are required' }, { status: 400 })
  }
  const session = await getServerSessionUser()
  if (!session) return NextResponse.json({ success: false, message: 'Not authenticated' }, { status: 401 })
  if (session.user.company_id !== company_id) {
    return NextResponse.json({ success: false, message: 'You can only use this for your own company' }, { status: 403 })
  }

  try {
    if (request_type === 'fixed_off_day') {
      const ids = b.ids as unknown
      if (!Array.isArray(ids) || ids.length === 0 || !ids.every((id): id is string => typeof id === 'string')) {
        return NextResponse.json({ success: false, message: 'ids (non-empty string array) is required' }, { status: 400 })
      }
      const fixedOff = await attendanceService.getFixedOffDayRequests(company_id)
      const group = fixedOff.filter(r => ids.includes(r.id))
      if (group.length === 0) return NextResponse.json({ success: false, message: 'Request not found' }, { status: 404 })
      const first = group[0]
      const suggestion = await requestAISuggestService.suggestFixedOffDayGroup({
        requester_name: first.requester_name,
        requester_role: first.requester_role,
        requested_dates: group.map(r => r.requested_date),
        department_id: first.department_id,
        company_id,
        user_id: first.user_id,
      })
      return NextResponse.json({ success: true, suggestion })
    }

    // Whole-queue pass: every pending weekly submission for the company, walked in submission
    // order — returns a safe/flagged verdict per submission so the safe ones can be bulk-approved.
    if (request_type === 'fixed_off_day_queue') {
      const rows = await attendanceService.getFixedOffDayRequests(company_id)
      const suggestion = await requestAISuggestService.suggestFixedOffDayQueue({ company_id, rows })
      return NextResponse.json({ success: true, suggestion })
    }

    return NextResponse.json({ success: false, message: 'Unsupported request_type' }, { status: 400 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'AI suggestion failed'
    return NextResponse.json({ success: false, message }, { status: 500 })
  }
}
