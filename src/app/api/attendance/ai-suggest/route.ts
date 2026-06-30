// LAYER: Controller
// RULE: Only handles request/response. No business logic. No DB access.

import { NextRequest, NextResponse } from 'next/server'
import { requestAISuggestService } from '@/services/ai/requestAISuggestService'
import { attendanceService } from '@/services/owner/attendanceService'

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

  try {
    if (request_type === 'shift_swap') {
      const id = b.id as string
      if (!id) return NextResponse.json({ success: false, message: 'id is required' }, { status: 400 })
      const swaps = await attendanceService.getShiftSwapRequests(company_id)
      const req2 = swaps.find(s => s.id === id)
      if (!req2) return NextResponse.json({ success: false, message: 'Request not found' }, { status: 404 })
      const suggestion = await requestAISuggestService.suggestShiftSwap({
        id,
        requester_name: req2.requester_name,
        replacement_name: req2.replacement_name,
        shift_date: req2.shift_date,
        shift_title: req2.shift_title,
        start_time: req2.start_time,
        end_time: req2.end_time,
        reason: req2.reason,
        company_id,
      })
      return NextResponse.json({ success: true, suggestion })
    }

    if (request_type === 'fixed_off_day') {
      const id = b.id as string
      if (!id) return NextResponse.json({ success: false, message: 'id is required' }, { status: 400 })
      const fixedOff = await attendanceService.getFixedOffDayRequests(company_id)
      const req2 = fixedOff.find(r => r.id === id)
      if (!req2) return NextResponse.json({ success: false, message: 'Request not found' }, { status: 404 })
      const suggestion = await requestAISuggestService.suggestFixedOffDay({
        id,
        requester_name: req2.requester_name,
        weekday: req2.weekday,
        company_id,
        user_id: req2.user_id,
      })
      return NextResponse.json({ success: true, suggestion })
    }

    if (request_type === 'leave') {
      const id = b.id as string
      if (!id) return NextResponse.json({ success: false, message: 'id is required' }, { status: 400 })
      const leaves = await attendanceService.getTimeOffRequests(company_id)
      const req2 = leaves.find(r => r.id === id)
      if (!req2) return NextResponse.json({ success: false, message: 'Request not found' }, { status: 404 })
      const suggestion = await requestAISuggestService.suggestLeaveRequest({
        id,
        requester_name: req2.requester_name,
        request_type: req2.request_type,
        shift_date: req2.shift_date,
        shift_title: req2.shift_title,
        start_time: req2.start_time,
        end_time: req2.end_time,
        reason: req2.reason,
        company_id,
        requester_id: req2.requester_id,
      })
      return NextResponse.json({ success: true, suggestion })
    }

    return NextResponse.json({ success: false, message: 'Unsupported request_type' }, { status: 400 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'AI suggestion failed'
    return NextResponse.json({ success: false, message }, { status: 500 })
  }
}
