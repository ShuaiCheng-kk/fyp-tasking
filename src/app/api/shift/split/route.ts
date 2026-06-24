// LAYER: Controller
// RULE: Only handles request/response. No business logic. No DB access.

import { NextRequest, NextResponse } from 'next/server'
import { shiftService } from '@/services/owner/shiftService'
import { SplitShiftBlockInput } from '@/types/Shift'

export async function POST(req: NextRequest) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ success: false, message: 'Invalid JSON body' }, { status: 400 })
  }

  const {
    company_id,
    department_id,
    title,
    instruction,
    shift_date,
    blocks,
    created_by,
    publication_status,
    assigned_user_id,
    supervisor_employee_id,
  } = body as Record<string, unknown>

  if (!company_id || typeof company_id !== 'string')
    return NextResponse.json({ success: false, message: 'company_id is required' }, { status: 400 })
  if (!department_id || typeof department_id !== 'string')
    return NextResponse.json({ success: false, message: 'department_id is required' }, { status: 400 })
  if (!shift_date || typeof shift_date !== 'string')
    return NextResponse.json({ success: false, message: 'shift_date is required' }, { status: 400 })
  if (!created_by || typeof created_by !== 'string')
    return NextResponse.json({ success: false, message: 'created_by is required' }, { status: 400 })
  if (!Array.isArray(blocks) || blocks.length !== 2)
    return NextResponse.json({ success: false, message: 'blocks must contain exactly 2 time blocks' }, { status: 400 })

  const cleanedBlocks: SplitShiftBlockInput[] = blocks.map(block => ({
    start_time: typeof (block as Record<string, unknown>)?.start_time === 'string' ? (block as Record<string, unknown>).start_time as string : '',
    end_time: typeof (block as Record<string, unknown>)?.end_time === 'string' ? (block as Record<string, unknown>).end_time as string : '',
  }))

  try {
    const result = await shiftService.createSplitShift({
      company_id,
      department_id,
      title: typeof title === 'string' && title ? title : null,
      instruction: typeof instruction === 'string' && instruction ? instruction : null,
      shift_date,
      blocks: cleanedBlocks,
      created_by,
      publication_status: publication_status === 'published' ? 'published' : 'draft',
      assigned_user_id: typeof assigned_user_id === 'string' && assigned_user_id ? assigned_user_id : null,
      supervisor_employee_id: typeof supervisor_employee_id === 'string' && supervisor_employee_id ? supervisor_employee_id : null,
    })
    return NextResponse.json({ success: true, shifts: result.shifts, warning: result.warning }, { status: 201 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to create split shift'
    return NextResponse.json({ success: false, message }, { status: 400 })
  }
}
