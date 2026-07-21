// LAYER: Controller
// RULE: Only handles request/response. No business logic. No DB access.

import { NextRequest, NextResponse } from 'next/server'
import { shiftTemplateService } from '@/services/owner/shiftTemplateService'

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  if (!id) return NextResponse.json({ success: false, message: 'id is required' }, { status: 400 })

  try {
    await shiftTemplateService.deleteTemplate(id)
    return NextResponse.json({ success: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to delete shift template'
    return NextResponse.json({ success: false, message }, { status: 400 })
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  if (!id) return NextResponse.json({ success: false, message: 'id is required' }, { status: 400 })

  try {
    const body = await req.json()
    const template = await shiftTemplateService.updateTemplate(id, {
      name: body.name,
      start_time: body.start_time,
      end_time: body.end_time,
    })
    return NextResponse.json({ success: true, template })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to update shift template'
    return NextResponse.json({ success: false, message }, { status: 400 })
  }
}
