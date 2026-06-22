// LAYER: Controller
// RULE: Only handles request/response. No business logic. No DB access.

import { NextRequest, NextResponse } from 'next/server'
import { shiftService } from '@/services/owner/shiftService'

export async function POST(req: NextRequest) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ success: false, message: 'Invalid JSON body' }, { status: 400 })
  }

  const { company_id, performed_by } = body as Record<string, unknown>
  if (!company_id || typeof company_id !== 'string')
    return NextResponse.json({ success: false, message: 'company_id is required' }, { status: 400 })
  if (!performed_by || typeof performed_by !== 'string')
    return NextResponse.json({ success: false, message: 'performed_by is required' }, { status: 400 })

  try {
    const result = await shiftService.undoLastShiftAction(company_id, performed_by)
    return NextResponse.json({ success: true, action_type: result.action_type })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to undo last shift action'
    return NextResponse.json({ success: false, message }, { status: 400 })
  }
}
