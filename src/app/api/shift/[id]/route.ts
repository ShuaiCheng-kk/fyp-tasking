// LAYER: Controller
// RULE: Only handles request/response. No business logic. No DB access.

import { NextRequest, NextResponse } from 'next/server'
import { shiftService } from '@/services/owner/shiftService'
import { Shift } from '@/types/Shift'

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const { id } = params
  if (!id) return NextResponse.json({ success: false, message: 'id is required' }, { status: 400 })

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ success: false, message: 'Invalid JSON body' }, { status: 400 })
  }

  const fields = body as Partial<Omit<Shift, 'id' | 'company_id' | 'created_by' | 'created_at'>>

  try {
    const shift = await shiftService.editShift(id, fields)
    return NextResponse.json({ success: true, shift })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to update shift'
    return NextResponse.json({ success: false, message }, { status: 400 })
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const { id } = params
  if (!id) return NextResponse.json({ success: false, message: 'id is required' }, { status: 400 })

  try {
    await shiftService.deleteShift(id)
    return NextResponse.json({ success: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to delete shift'
    return NextResponse.json({ success: false, message }, { status: 400 })
  }
}
