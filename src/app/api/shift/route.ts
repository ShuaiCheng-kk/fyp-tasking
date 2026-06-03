// LAYER: Controller
// RULE: Only handles request/response. No business logic. No DB access.

import { NextRequest, NextResponse } from 'next/server'
import { shiftService } from '@/services/owner/shiftService'
import { ShiftInput } from '@/types/Shift'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const company_id = searchParams.get('company_id')
  const date_from = searchParams.get('date_from')
  const date_to = searchParams.get('date_to')

  if (!company_id || !date_from || !date_to) {
    return NextResponse.json(
      { success: false, message: 'company_id, date_from, and date_to are required' },
      { status: 400 },
    )
  }

  try {
    const rows = await shiftService.getTimelineShifts(company_id, date_from, date_to)
    return NextResponse.json({ success: true, rows })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch shifts'
    return NextResponse.json({ success: false, message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ success: false, message: 'Invalid JSON body' }, { status: 400 })
  }

  const { company_id, department_id, shift_date, start_time, end_time, created_by } =
    body as Record<string, unknown>

  if (!company_id || typeof company_id !== 'string')
    return NextResponse.json({ success: false, message: 'company_id is required' }, { status: 400 })
  if (!department_id || typeof department_id !== 'string')
    return NextResponse.json({ success: false, message: 'department_id is required' }, { status: 400 })
  if (!shift_date || typeof shift_date !== 'string')
    return NextResponse.json({ success: false, message: 'shift_date is required' }, { status: 400 })
  if (!start_time || typeof start_time !== 'string')
    return NextResponse.json({ success: false, message: 'start_time is required' }, { status: 400 })
  if (!end_time || typeof end_time !== 'string')
    return NextResponse.json({ success: false, message: 'end_time is required' }, { status: 400 })
  if (!created_by || typeof created_by !== 'string')
    return NextResponse.json({ success: false, message: 'created_by is required' }, { status: 400 })

  const input: ShiftInput = {
    company_id,
    department_id,
    shift_date,
    start_time,
    end_time,
    created_by,
  }

  try {
    const shift = await shiftService.createShift(input)
    return NextResponse.json({ success: true, shift }, { status: 201 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to create shift'
    return NextResponse.json({ success: false, message }, { status: 400 })
  }
}
